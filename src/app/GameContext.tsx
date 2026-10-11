import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ImageIntakeError } from '../ai/image.ts'
import { verifyPhoto } from '../ai/missionVerifier.ts'
import { OllamaError, type ChatProgress } from '../ai/ollamaClient.ts'
import { ModelOutputError } from '../ai/schemas.ts'
import { getMission, getVariant } from '../content/missions.ts'
import { getShopItem } from '../content/shop.ts'
import * as eco from '../game/economy.ts'
import { levelForXp, TOOLS } from '../game/levels.ts'
import type { AppSettings, MissionEvidence, PlayerProfile, UpgradeId } from '../game/types.ts'
import * as store from '../storage/gamePersistence.ts'
import { buildBackup, downloadJson, ImportError, parseBackup, parseOuting, photoToEvidence, readJsonFile, type OutingBundle } from '../storage/transfer.ts'
import { useAIStatus } from './AIStatusContext.tsx'
import { playChime, showSystemNotification } from './notify.ts'

export interface Toast {
  id: number
  tone: 'info' | 'success' | 'warn' | 'error'
  text: string
}

export type OSApp = 'inbox' | 'work' | 'skills' | 'shop' | 'outside' | 'tools'

export interface Celebration {
  eyebrow: string
  title: string
  lines: string[]
  cta?: { label: string; app: OSApp }
}

interface GameValue {
  ready: boolean
  profile: PlayerProfile
  settings: AppSettings
  evidence: MissionEvidence[]
  progress: Record<string, ChatProgress>
  toasts: Toast[]
  celebration: Celebration | null
  isAIHost: boolean
  app: OSApp
  openApp: (app: OSApp) => void
  notify: (tone: Toast['tone'], text: string) => void
  dismissToast: (id: number) => void
  dismissCelebration: () => void
  accept: (offerId: string) => Promise<eco.AcceptError | null>
  decline: (offerId: string) => Promise<void>
  submit: (choiceId: string) => Promise<eco.SubmitOutcome | null>
  hint: () => Promise<void>
  abandon: () => Promise<void>
  buy: (id: UpgradeId) => Promise<eco.BuyError | null>
  verify: (evidenceId: string) => Promise<void>
  cancelVerify: (evidenceId: string) => void
  removeEvidence: (evidenceId: string) => Promise<void>
  importFile: (file: File) => Promise<void>
  exportBackup: () => Promise<void>
  resetAll: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

const GameContext = createContext<GameValue | null>(null)

function describeError(error: unknown): string {
  if (error instanceof OllamaError || error instanceof ModelOutputError || error instanceof ImageIntakeError || error instanceof ImportError) return error.message
  return 'Something went wrong. Your data is safe — try again.'
}

type Compute<T> = (p: PlayerProfile, keys: ReadonlySet<string>) => store.GrantStep & { extra?: T }

export function GameProvider({ children }: { children: ReactNode }) {
  const { diagnostics, recheck } = useAIStatus()
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<PlayerProfile>(() => eco.createProfile())
  const [settings, setSettings] = useState<AppSettings>(store.DEFAULT_SETTINGS)
  const [evidence, setEvidence] = useState<MissionEvidence[]>([])
  const [progress, setProgress] = useState<Record<string, ChatProgress>>({})
  const [toasts, setToasts] = useState<Toast[]>([])
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const [app, setApp] = useState<OSApp>('inbox')
  const controllers = useRef(new Map<string, AbortController>())
  const toastSeq = useRef(0)
  const settingsRef = useRef(settings)
  const profileRef = useRef(profile)
  // Every profile write is serialized through this queue and runs inside one IndexedDB
  // transaction (store.grantOnce), so jobs, walks and photos can never race or double-grant.
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const isAIHost = diagnostics.connection !== 'remote-device' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)

  const notify = useCallback((tone: Toast['tone'], text: string) => {
    const id = ++toastSeq.current
    setToasts((t) => [...t.slice(-2), { id, tone, text }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 8000 : 5000)
  }, [])
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const mutate = useCallback(<T,>(compute: Compute<T>, evidencePatch?: { id: string; patch: Partial<MissionEvidence> }) => {
    const run = queue.current.then(async () => {
      let extra: T | undefined
      const result = await store.grantOnce((p, keys) => {
        const out = compute(p, keys)
        extra = out.extra
        return { profile: out.profile, ledger: out.ledger }
      }, evidencePatch)
      if (result.profileChanged) {
        profileRef.current = result.profile
        setProfile(result.profile)
      }
      return { ...result, extra }
    })
    queue.current = run.catch(() => undefined)
    return run
  }, [])

  const refreshEvidence = useCallback(async () => setEvidence(await store.listEvidence()), [])

  // Load, then re-queue any verification interrupted by a reload.
  useEffect(() => {
    void (async () => {
      const [p, s, list] = await Promise.all([store.loadProfile(), store.loadSettings(), store.listEvidence()])
      for (const e of list.filter((x) => x.status === 'verifying')) {
        await store.updateEvidence(e.id, { status: 'saved-for-later', lastError: 'Interrupted by a reload — verify again.' })
      }
      profileRef.current = p
      settingsRef.current = s
      setProfile(p)
      setSettings(s)
      setEvidence(await store.listEvidence())
      setReady(true)
    })()
  }, [])

  const celebrateLevel = useCallback((level: number) => {
    const tool = TOOLS.find((t) => t.minLevel === level)
    setCelebration({
      eyebrow: 'Level up',
      title: `Level ${level} · ${levelForXp(profileRef.current.xp).name}`,
      lines: [tool ? `${tool.name} unlocked in Tools.` : 'Bigger contracts can now reach your inbox.', 'New items in the shop.'],
      cta: tool ? { label: `Open ${tool.name}`, app: 'tools' } : { label: 'Open inbox', app: 'inbox' },
    })
  }, [])

  /* ── job board ticker: new offers on schedule, slow energy regen, notifications ── */
  useEffect(() => {
    if (!ready || !isAIHost) return
    const tick = async () => {
      let arrived: string[] = []
      await mutate((p) => {
        const regen = eco.applyEnergyRegen(p, new Date())
        const out = eco.refreshBoard(regen, new Date(), settingsRef.current.jobEveryMin)
        arrived = out.arrived.map((o) => `${o.client}: ${o.title}`)
        return { profile: out.profile, ledger: null }
      })
      if (arrived.length) {
        const text = arrived.length === 1 ? `New job offer — ${arrived[0]}` : `${arrived.length} new job offers in your inbox`
        notify('info', text)
        if (settingsRef.current.sound) playChime('job')
        if (settingsRef.current.notifications && document.visibilityState !== 'visible') void showSystemNotification('AFK.exe · new job', text, 'afk-job')
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 15_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [isAIHost, mutate, notify, ready])

  /* ── jobs ── */
  const accept = useCallback(
    async (offerId: string) => {
      let error: eco.AcceptError | null = null
      await mutate((p) => {
        const out = eco.acceptJob(p, offerId)
        error = out.error
        return { profile: out.profile, ledger: null }
      })
      if (!error) setApp('work')
      return error
    },
    [mutate],
  )

  const decline = useCallback(async (offerId: string) => {
    await mutate((p) => ({ profile: eco.declineOffer(p, offerId), ledger: null }))
  }, [mutate])

  const submit = useCallback(
    async (choiceId: string) => {
      const res = await mutate<eco.SubmitOutcome>((p) => {
        const out = eco.submitAnswer(p, choiceId)
        return { profile: out.profile, ledger: out.ledger, extra: out }
      })
      const out = res.extra ?? null
      if (out?.finished === 'done') {
        if (settingsRef.current.sound) playChime('reward')
        if (out.levelUp) celebrateLevel(out.levelUp)
      }
      return out
    },
    [celebrateLevel, mutate],
  )

  const hint = useCallback(async () => {
    await mutate((p) => ({ profile: eco.useHint(p), ledger: null }))
  }, [mutate])

  const abandon = useCallback(async () => {
    await mutate((p) => ({ profile: eco.abandonJob(p), ledger: null }))
    setApp('inbox')
  }, [mutate])

  const buy = useCallback(
    async (id: UpgradeId) => {
      let error: eco.BuyError | null = null
      await mutate((p) => {
        const out = eco.buyUpgrade(p, id)
        error = out.error
        return { profile: out.profile, ledger: null }
      })
      if (!error) {
        notify('success', `${getShopItem(id).name} is now in your office.`)
        if (settingsRef.current.sound) playChime('reward')
      }
      return error
    },
    [mutate, notify],
  )

  /* ── outings from the phone (LAN inbox or file) ── */
  const receiveOuting = useCallback(
    async (bundle: OutingBundle) => {
      let newPhotos = 0
      for (const p of bundle.photos) {
        if (await store.getEvidence(p.id)) continue
        await store.putEvidence(photoToEvidence(p, 'lan'))
        newPhotos++
      }
      await refreshEvidence()
      const walk = bundle.walk
      const photoLine = newPhotos ? [`${newPhotos} photo${newPhotos > 1 ? 's' : ''} ready for your local AI.`] : []
      if (walk) {
        const res = await mutate((p, keys) => eco.applyWalk(p, keys, walk))
        if (res.ledger) {
          if (settingsRef.current.sound) playChime('reward')
          setCelebration({
            eyebrow: 'Walk verified by GPS',
            title: `+${res.ledger.tokens} 🌿   +${res.ledger.xp} XP`,
            lines: [`${Math.round(walk.durationMin)} min outside, up to ${walk.maxDistanceM} m from where you started.`, 'Energy fully restored.', ...photoLine],
            cta: newPhotos ? { label: 'Verify photos', app: 'outside' } : { label: 'Back to work', app: 'inbox' },
          })
          return
        }
        if (!walk.verified) notify('warn', `Walk received, but it didn’t reach ${walk.thresholds.minMinutes} min and ${walk.thresholds.minDistanceM} m — no walk reward this time.`)
        else notify('info', 'That walk was already credited.')
      }
      if (newPhotos) notify('success', photoLine[0])
    },
    [mutate, notify, refreshEvidence],
  )

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
        for (const item of items) {
          try {
            await receiveOuting(parseOuting(item.bundle))
          } catch (e) {
            notify('error', describeError(e))
          }
        }
        await fetch('/afk-sync/inbox/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: items.map((i) => i.id) }) })
      } catch {
        /* adapter not available */
      }
    }
    const id = window.setInterval(poll, 4000)
    void poll()
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [isAIHost, notify, ready, receiveOuting])

  /* ── photo verification with the local model ── */
  const verify = useCallback(
    async (id: string) => {
      const item = await store.getEvidence(id)
      if (!item || controllers.current.has(id)) return
      const mission = getMission(item.missionId)
      const variant = getVariant(item.missionId, item.variantId)
      if (!mission || !variant) return
      const diag = diagnostics.connection === 'ready' ? diagnostics : await recheck()
      if (diag.connection !== 'ready') {
        notify('warn', 'Local AI is not reachable. The photo stays saved — verify when Ollama is running.')
        return
      }
      const controller = new AbortController()
      controllers.current.set(id, controller)
      await store.updateEvidence(id, { status: 'verifying', attempts: item.attempts + 1, lastError: undefined })
      await refreshEvidence()
      try {
        const outcome = await verifyPhoto(item.image, mission, variant, { signal: controller.signal, onProgress: (p) => setProgress((all) => ({ ...all, [id]: p })) })
        if (outcome.decision === 'verified') {
          const res = await mutate((p, keys) => eco.applyPhoto(p, keys, item), {
            id,
            patch: { status: 'verified', result: outcome.result, model: outcome.model, verifiedAt: new Date().toISOString() },
          })
          if (res.ledger) {
            if (settingsRef.current.sound) playChime('reward')
            setCelebration({ eyebrow: 'Verified by your local AI', title: `${mission.title}  +${res.ledger.tokens} 🌿  +${res.ledger.xp} XP`, lines: [outcome.result.reason], cta: { label: 'Spend tokens in the shop', app: 'shop' } })
          } else notify('info', 'Verified — the photo reward for this walk was already collected.')
        } else {
          await store.updateEvidence(id, { status: outcome.decision === 'needs-review' ? 'needs-review' : 'rejected', result: outcome.result, model: outcome.model })
        }
      } catch (error) {
        const aborted = error instanceof OllamaError && error.code === 'aborted'
        await store.updateEvidence(id, { status: aborted ? 'saved-for-later' : 'verification-failed', lastError: aborted ? undefined : describeError(error) })
        if (!aborted) notify('error', describeError(error))
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
    [diagnostics, mutate, notify, recheck, refreshEvidence],
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

  const importFile = useCallback(
    async (file: File) => {
      try {
        const raw = await readJsonFile(file)
        if ((raw as { format?: string } | null)?.format === 'afk.exe/backup') {
          const data = parseBackup(raw)
          if (!window.confirm('Replace all AFK.exe progress on this computer with this backup?')) return
          await queue.current
          await store.replaceAllData(data)
          profileRef.current = data.profile
          setProfile(data.profile)
          await refreshEvidence()
          notify('success', 'Backup restored.')
          return
        }
        await receiveOuting(parseOuting(raw))
      } catch (error) {
        notify('error', describeError(error))
      }
    },
    [notify, receiveOuting, refreshEvidence],
  )

  const exportBackup = useCallback(async () => {
    downloadJson(await buildBackup(profileRef.current, await store.listLedger(), await store.listEvidence()), `afk-exe-backup-${new Date().toISOString().slice(0, 10)}.json`)
    notify('success', 'Backup saved. It includes your photos — keep it private.')
  }, [notify])

  const resetAll = useCallback(async () => {
    for (const c of controllers.current.values()) c.abort()
    await queue.current
    const fresh = await store.resetAllData()
    profileRef.current = fresh
    setProfile(fresh)
    await refreshEvidence()
    setApp('inbox')
    notify('info', 'All local AFK.exe data was deleted from this device.')
  }, [notify, refreshEvidence])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch }
    settingsRef.current = next
    setSettings(next)
    await store.saveSettings(next)
  }, [])

  const value = useMemo<GameValue>(
    () => ({
      ready, profile, settings, evidence, progress, toasts, celebration, isAIHost, app,
      openApp: setApp,
      notify,
      dismissToast,
      dismissCelebration: () => setCelebration(null),
      accept, decline, submit, hint, abandon, buy, verify, cancelVerify, removeEvidence, importFile, exportBackup, resetAll, updateSettings,
    }),
    [ready, profile, settings, evidence, progress, toasts, celebration, isAIHost, app, notify, dismissToast, accept, decline, submit, hint, abandon, buy, verify, cancelVerify, removeEvidence, importFile, exportBackup, resetAll, updateSettings],
  )
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame outside GameProvider')
  return ctx
}
