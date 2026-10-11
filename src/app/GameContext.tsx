import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ImageIntakeError, prepareForStorage } from '../ai/image.ts'
import { verifyPhoto } from '../ai/missionVerifier.ts'
import { OllamaError, type ChatProgress } from '../ai/ollamaClient.ts'
import { ModelOutputError } from '../ai/schemas.ts'
import { getContract, getMission, getVariant } from '../content/contracts.ts'
import * as engine from '../game/rewardEngine.ts'
import type {
  AppSettings,
  EvidenceSource,
  FieldMission,
  MissionEvidence,
  PlayerProfile,
  RewardTransaction,
} from '../game/types.ts'
import * as store from '../storage/gamePersistence.ts'
import {
  buildBackup,
  bundleToEvidence,
  evidenceToBundle,
  ImportError,
  parseBackup,
  parseEvidenceBundle,
  readJsonFile,
  shareOrDownload,
  downloadJson,
} from '../storage/transfer.ts'
import { useAIStatus } from './AIStatusContext.tsx'
import { playChime } from './sound.ts'

export interface Toast {
  id: number
  tone: 'info' | 'success' | 'warn' | 'error'
  text: string
}

interface GameValue {
  ready: boolean
  profile: PlayerProfile
  settings: AppSettings
  evidence: MissionEvidence[]
  field: FieldMission | null
  progress: Record<string, ChatProgress>
  reveal: RewardTransaction | null
  toasts: Toast[]
  isAIHost: boolean
  dismissReveal: () => void
  notify: (tone: Toast['tone'], text: string) => void
  dismissToast: (id: number) => void
  completeOnboarding: () => Promise<void>
  startContract: (id: string) => Promise<void>
  submitChallenge: (id: string, choiceId: string) => Promise<boolean>
  chooseVariant: (contractId: string, variantId: string) => Promise<void>
  setField: (field: FieldMission | null) => Promise<void>
  addPhoto: (file: File, source: EvidenceSource, target: { contractId: string; missionId: string; variantId: string }) => Promise<MissionEvidence | null>
  verify: (id: string) => Promise<void>
  cancelVerify: (id: string) => void
  removeEvidence: (id: string) => Promise<void>
  exportEvidence: (id: string) => Promise<void>
  sendToDesk: (id: string) => Promise<void>
  importFile: (file: File) => Promise<void>
  exportBackup: () => Promise<void>
  resetAll: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

const GameContext = createContext<GameValue | null>(null)

function newId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function describeError(error: unknown): string {
  if (error instanceof OllamaError || error instanceof ModelOutputError || error instanceof ImageIntakeError || error instanceof ImportError) {
    return error.message
  }
  return 'Something went wrong. Your photo is still saved — try again.'
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { diagnostics, recheck } = useAIStatus()
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<PlayerProfile>(() => engine.createProfile())
  const [settings, setSettings] = useState<AppSettings>(store.DEFAULT_SETTINGS)
  const [evidence, setEvidence] = useState<MissionEvidence[]>([])
  const [field, setFieldState] = useState<FieldMission | null>(null)
  const [progress, setProgress] = useState<Record<string, ChatProgress>>({})
  const [reveal, setReveal] = useState<RewardTransaction | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const controllers = useRef(new Map<string, AbortController>())
  const toastSeq = useRef(0)
  const settingsRef = useRef(settings)

  const isAIHost = diagnostics.connection !== 'remote-device' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)

  const refreshEvidence = useCallback(async () => setEvidence(await store.listEvidence()), [])

  const notify = useCallback((tone: Toast['tone'], text: string) => {
    const id = ++toastSeq.current
    setToasts((t) => [...t.slice(-2), { id, tone, text }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 8000 : 5000)
  }, [])
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // Every profile change goes through the latest value in profileRef, so sequential
  // actions (e.g. finish onboarding → start contract) never overwrite each other.
  const profileRef = useRef(profile)
  const commitProfile = useCallback((next: PlayerProfile) => {
    profileRef.current = next
    setProfile(next)
  }, [])

  // Initial load. Any verification that was in flight when the page closed is re-queued.
  useEffect(() => {
    void (async () => {
      const [p, s, f, list] = await Promise.all([store.loadProfile(), store.loadSettings(), store.loadFieldMission(), store.listEvidence()])
      for (const e of list.filter((x) => x.status === 'verifying')) {
        await store.updateEvidence(e.id, { status: 'saved-for-later', lastError: 'Interrupted by a reload — verify again.' })
      }
      commitProfile(p)
      settingsRef.current = s
      setSettings(s)
      setFieldState(f)
      setEvidence(await store.listEvidence())
      setReady(true)
    })()
  }, [commitProfile])

  const updateProfile = useCallback(
    async (fn: (current: PlayerProfile) => PlayerProfile) => {
      const current = profileRef.current
      const next = fn(current)
      if (next === current) return current
      commitProfile(next)
      await store.saveProfile(next)
      return next
    },
    [commitProfile],
  )

  const completeOnboarding = useCallback(async () => {
    await updateProfile((p) => ({ ...p, onboardedAt: new Date().toISOString() }))
  }, [updateProfile])

  const startContract = useCallback(async (id: string) => void (await updateProfile((p) => engine.startContract(p, id))), [updateProfile])

  const submitChallenge = useCallback(
    async (id: string, choiceId: string) => {
      let correct = false
      await updateProfile((p) => {
        const out = engine.submitChallenge(p, id, choiceId)
        correct = out.correct
        return out.profile
      })
      return correct
    },
    [updateProfile],
  )

  const chooseVariant = useCallback(
    async (contractId: string, variantId: string) => void (await updateProfile((p) => engine.chooseVariant(p, contractId, variantId))),
    [updateProfile],
  )

  const setField = useCallback(async (next: FieldMission | null) => {
    setFieldState(next)
    await store.saveFieldMission(next)
  }, [])

  const addPhoto: GameValue['addPhoto'] = useCallback(
    async (file, source, target) => {
      try {
        const prepared = await prepareForStorage(file)
        const now = new Date().toISOString()
        const record: MissionEvidence = {
          id: newId(),
          ...target,
          image: prepared.blob,
          mimeType: prepared.mimeType,
          width: prepared.width,
          height: prepared.height,
          // File.lastModified is the closest honest capture time a browser exposes.
          capturedAt: source === 'camera' ? now : new Date(file.lastModified || Date.now()).toISOString(),
          savedAt: now,
          source,
          status: 'saved-for-later',
          attempts: 0,
        }
        await store.putEvidence(record)
        await refreshEvidence()
        return record
      } catch (error) {
        notify('error', describeError(error))
        return null
      }
    },
    [notify, refreshEvidence],
  )

  const verify = useCallback(
    async (id: string) => {
      const item = await store.getEvidence(id)
      if (!item || controllers.current.has(id)) return
      const contract = getContract(item.contractId)
      const mission = getMission(item.missionId)
      const variant = getVariant(item.missionId, item.variantId)
      if (!contract || !mission || !variant) return

      const status = engine.contractStatus(profileRef.current, contract.id)
      if (status === 'completed') {
        notify('info', `${contract.title} is already complete — no reward to claim twice.`)
        return
      }
      if (status !== 'mission') {
        notify('warn', 'Solve this contract’s coding step first. Your photo stays saved.')
        return
      }
      const diag = diagnostics.connection === 'ready' ? diagnostics : await recheck()
      if (diag.connection !== 'ready') {
        await store.updateEvidence(id, { status: 'saved-for-later', lastError: diag.detail ?? undefined })
        await refreshEvidence()
        notify('warn', 'Local AI is not reachable. Your photo is saved — verify when Ollama is running.')
        return
      }

      const controller = new AbortController()
      controllers.current.set(id, controller)
      await store.updateEvidence(id, { status: 'verifying', attempts: item.attempts + 1, lastError: undefined })
      await refreshEvidence()

      try {
        const outcome = await verifyPhoto(item.image, mission, variant, {
          signal: controller.signal,
          onProgress: (p) => setProgress((all) => ({ ...all, [id]: p })),
        })
        if (outcome.decision === 'verified') {
          const reward = await store.grantVerifiedReward(contract.id, id, { result: outcome.result, model: outcome.model })
          commitProfile(reward.profile)
          if (reward.transaction) {
            setReveal(reward.transaction)
            if (settingsRef.current.sound) playChime()
          }
        } else {
          await store.updateEvidence(id, {
            status: outcome.decision === 'needs-review' ? 'needs-review' : 'rejected',
            result: outcome.result,
            model: outcome.model,
          })
        }
      } catch (error) {
        const aborted = error instanceof OllamaError && error.code === 'aborted'
        await store.updateEvidence(id, {
          status: aborted ? 'saved-for-later' : 'verification-failed',
          lastError: aborted ? undefined : describeError(error),
        })
        if (!aborted) notify('error', describeError(error))
        if (error instanceof OllamaError && error.code !== 'aborted' && error.code !== 'timeout') void recheck()
      } finally {
        controllers.current.delete(id)
        setProgress((all) => {
          const next = { ...all }
          delete next[id]
          return next
        })
        await refreshEvidence()
      }
    },
    [commitProfile, diagnostics, notify, recheck, refreshEvidence],
  )

  const cancelVerify = useCallback((id: string) => controllers.current.get(id)?.abort(), [])

  const removeEvidence = useCallback(
    async (id: string) => {
      controllers.current.get(id)?.abort()
      await store.deleteEvidence(id)
      await refreshEvidence()
    },
    [refreshEvidence],
  )

  const exportEvidence = useCallback(
    async (id: string) => {
      const item = await store.getEvidence(id)
      if (!item) return
      try {
        const how = await shareOrDownload(await evidenceToBundle(item), `afk-${item.missionId}-${item.capturedAt.slice(0, 10)}.afk.json`)
        await store.updateEvidence(id, { sentAt: new Date().toISOString() })
        await refreshEvidence()
        notify('success', how === 'shared' ? 'Shared. Import it in AFK.exe on your computer.' : 'Saved as a file. Import it in AFK.exe on your computer.')
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) notify('error', 'Export failed.')
      }
    },
    [notify, refreshEvidence],
  )

  const sendToDesk = useCallback(
    async (id: string) => {
      const item = await store.getEvidence(id)
      if (!item) return
      if (!field?.pairToken) {
        notify('warn', 'This device is not paired. Scan the QR code on your computer, or export the photo as a file.')
        return
      }
      if (!navigator.onLine) {
        notify('warn', 'No connection right now — your photo stays saved here. Send it when you are back on your Wi-Fi.')
        return
      }
      try {
        const res = await fetch(`/afk-sync/evidence?token=${encodeURIComponent(field.pairToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(await evidenceToBundle(item)),
        })
        if (res.status === 401) throw new Error('The pairing expired (the computer restarted AFK.exe). Scan the QR code again.')
        if (!res.ok) throw new Error('Your computer did not accept the photo.')
        await store.updateEvidence(id, { sentAt: new Date().toISOString() })
        await refreshEvidence()
        notify('success', 'Sent to your computer. Verify it there with the local AI.')
      } catch (error) {
        notify('error', error instanceof Error && error.message !== 'Failed to fetch' ? error.message : 'Could not reach your computer. Is it on the same Wi-Fi and running npm run start:lan?')
      }
    },
    [field, notify, refreshEvidence],
  )

  const importBundle = useCallback(
    async (raw: unknown, source: 'import' | 'lan') => {
      const bundle = parseEvidenceBundle(raw)
      const existing = await store.getEvidence(bundle.evidence.id)
      if (existing) return { duplicate: true, record: existing }
      const record = bundleToEvidence(bundle, source)
      await store.putEvidence(record)
      return { duplicate: false, record }
    },
    [],
  )

  const importFile = useCallback(
    async (file: File) => {
      try {
        if (file.type.startsWith('image/')) {
          throw new ImportError('To add a plain photo, use “Choose from library” on the mission card.')
        }
        const raw = await readJsonFile(file)
        const format = (raw as { format?: string } | null)?.format
        if (format === 'afk.exe/backup') {
          const data = parseBackup(raw)
          if (!window.confirm('Replace all AFK.exe progress on this device with this backup?')) return
          await store.replaceAllData(data)
          commitProfile(data.profile)
          await refreshEvidence()
          notify('success', 'Backup restored.')
          return
        }
        const { duplicate, record } = await importBundle(raw, 'import')
        await refreshEvidence()
        const mission = getMission(record.missionId)
        notify(duplicate ? 'info' : 'success', duplicate ? 'That photo is already here.' : `Imported a ${mission?.title ?? 'mission'} photo. Ready to verify.`)
      } catch (error) {
        notify('error', describeError(error))
      }
    },
    [commitProfile, importBundle, notify, refreshEvidence],
  )

  // Same-LAN inbox: only meaningful on the computer that runs AFK.exe + Ollama.
  useEffect(() => {
    if (!ready || !isAIHost) return
    let stopped = false
    const poll = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/afk-sync/inbox', { cache: 'no-store' })
        if (!res.ok) return
        const { items } = (await res.json()) as { items: { id: string; bundle: unknown }[] }
        if (!items.length || stopped) return
        const done: string[] = []
        for (const item of items) {
          try {
            const { duplicate } = await importBundle(item.bundle, 'lan')
            if (!duplicate) notify('success', 'A photo arrived from your phone. Ready to verify.')
          } catch {
            notify('error', 'A phone sent a photo that was not a valid AFK.exe bundle. It was discarded.')
          }
          done.push(item.id)
        }
        await fetch('/afk-sync/inbox/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: done }) })
        await refreshEvidence()
      } catch {
        /* adapter not available (e.g. static hosting) */
      }
    }
    const id = window.setInterval(poll, 4000)
    void poll()
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [importBundle, isAIHost, notify, ready, refreshEvidence])

  const exportBackup = useCallback(async () => {
    const data = await buildBackup(profileRef.current, await store.listRewards(), await store.listEvidence())
    downloadJson(data, `afk-exe-backup-${new Date().toISOString().slice(0, 10)}.json`)
    notify('success', 'Backup saved. It includes your photos — keep it private.')
  }, [notify])

  const resetAll = useCallback(async () => {
    for (const c of controllers.current.values()) c.abort()
    const fresh = await store.resetAllData()
    await store.saveFieldMission(null)
    setFieldState(null)
    commitProfile(fresh)
    await refreshEvidence()
    notify('info', 'All local AFK.exe data was deleted from this device.')
  }, [commitProfile, notify, refreshEvidence])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch }
    settingsRef.current = next
    setSettings(next)
    await store.saveSettings(next)
  }, [])

  const value = useMemo<GameValue>(
    () => ({
      ready,
      profile,
      settings,
      evidence,
      field,
      progress,
      reveal,
      toasts,
      isAIHost,
      dismissReveal: () => setReveal(null),
      notify,
      dismissToast,
      completeOnboarding,
      startContract,
      submitChallenge,
      chooseVariant,
      setField,
      addPhoto,
      verify,
      cancelVerify,
      removeEvidence,
      exportEvidence,
      sendToDesk,
      importFile,
      exportBackup,
      resetAll,
      updateSettings,
    }),
    [
      ready, profile, settings, evidence, field, progress, reveal, toasts, isAIHost, notify, dismissToast,
      completeOnboarding, startContract, submitChallenge, chooseVariant, setField, addPhoto, verify, cancelVerify,
      removeEvidence, exportEvidence, sendToDesk, importFile, exportBackup, resetAll, updateSettings,
    ],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame outside GameProvider')
  return ctx
}
