import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ImageIntakeError } from '../ai/image.ts'
import { verifyPhoto } from '../ai/missionVerifier.ts'
import { OllamaError, type ChatProgress } from '../ai/ollamaClient.ts'
import { ModelOutputError } from '../ai/schemas.ts'
import { getMission, getVariant } from '../content/missions.ts'
import { getShopItem } from '../content/shop.ts'
import * as eco from '../game/economy.ts'
import { levelForXp, TOOLS } from '../game/levels.ts'
import type { AppSettings, MissionEvidence, PlayerProfile, SkillId, UpgradeId } from '../game/types.ts'
import * as store from '../storage/gamePersistence.ts'
import { buildBackup, downloadJson, ImportError, parseBackup, parseOuting, photoToEvidence, readJsonFile, type OutingBundle } from '../storage/transfer.ts'
import * as admin from '../game/admin.ts'
import { useAIStatus } from './AIStatusContext.tsx'
import * as auth from './auth.ts'
import { playChime, showSystemNotification } from './notify.ts'

export interface Toast {
  id: number
  tone: 'info' | 'success' | 'warn' | 'error'
  text: string
}

export type OSApp = 'inbox' | 'work' | 'skills' | 'shop' | 'outside' | 'tools' | 'admin'

export interface MossLine {
  id: number
  text: string
  mood: 'job' | 'reward' | 'warn' | 'hello'
  cta?: { label: string; app: OSApp }
}

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
  moss: MossLine | null
  dismissMoss: () => void
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
  train: (skill: SkillId) => Promise<eco.TrainError | null>
  verify: (evidenceId: string) => Promise<void>
  cancelVerify: (evidenceId: string) => void
  removeEvidence: (evidenceId: string) => Promise<void>
  importFile: (file: File) => Promise<void>
  exportBackup: () => Promise<void>
  resetAll: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  /** Same-device hand-off: credit an outing recorded on this computer and show the result at the desk. */
  deliverOuting: (bundle: OutingBundle) => Promise<void>
  session: auth.Session | null
  signIn: (user: string, password: string) => Promise<auth.SignInError | null>
  continueAsGuest: () => void
  signOut: () => void
  adminActions: {
    walk: () => Promise<void>
    approvePhoto: (evidenceId: string) => Promise<void>
    approveAllPhotos: () => Promise<void>
    finishJob: () => Promise<void>
    refill: () => Promise<void>
    levelUp: () => Promise<void>
    grant: (tokens: number, money: number) => Promise<void>
  }
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
  const [moss, setMoss] = useState<MossLine | null>(null)
  const [session, setSession] = useState<auth.Session | null>(() => auth.loadSession())
  const mossSeq = useRef(0)
  const mossTimer = useRef<number | undefined>(undefined)
  const say = useCallback((text: string, mood: MossLine['mood'], cta?: MossLine['cta'], ms = 12_000) => {
    const id = ++mossSeq.current
    setMoss({ id, text, mood, cta })
    window.clearTimeout(mossTimer.current)
    mossTimer.current = window.setTimeout(() => setMoss((m) => (m?.id === id ? null : m)), ms)
  }, [])
  const dismissMoss = useCallback(() => setMoss(null), [])
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
      const h = new Date().getHours()
      const greet = h < 12 ? 'Good morning' : h < 18 ? 'Hi' : 'Good evening'
      window.setTimeout(() => say(p.board.length ? `${greet}! ${p.board.length} job offer${p.board.length > 1 ? 's are' : ' is'} waiting in your inbox.` : `${greet}! The inbox is quiet — perfect time for a walk.`, 'hello', { label: 'Open inbox', app: 'inbox' }, 9000), 1800)
    })()
  }, [say])

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
    if (!ready) return
    const tick = async () => {
      let arrived: string[] = []
      let featured: { client: string; title: string; pay: number } | null = null
      await mutate((p) => {
        const regen = eco.applyEnergyRegen(p, new Date())
        const out = eco.refreshBoard(regen, new Date(), settingsRef.current.jobEveryMin)
        arrived = out.arrived.map((o) => `${o.client}: ${o.title}`)
        const f = out.arrived.find((o) => o.featured)
        if (f) featured = { client: f.client, title: f.title, pay: f.pay }
        return { profile: out.profile, ledger: null }
      })
      if (featured) {
        const f = featured as { client: string; title: string; pay: number }
        say(`Today’s contract just landed: ${f.client} pays ${f.pay} for “${f.title}”.`, 'job', { label: 'Take a look', app: 'inbox' })
      } else if (arrived.length) {
        say(arrived.length === 1 ? `New job — ${arrived[0]}. Want it?` : `${arrived.length} new jobs came in.`, 'job', { label: 'Open inbox', app: 'inbox' })
      }
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
  }, [isAIHost, mutate, notify, ready, say])

  /* ── jobs ── */
  const accept = useCallback(
    async (offerId: string) => {
      let error: eco.AcceptError | null = null
      await mutate((p) => {
        const out = eco.acceptJob(p, offerId)
        error = out.error
        return { profile: out.error ? out.profile : eco.refreshBoard(out.profile, new Date(), settingsRef.current.jobEveryMin).profile, ledger: null }
      })
      if (!error) setApp('work')
      return error
    },
    [mutate],
  )

  const decline = useCallback(async (offerId: string) => {
    await mutate((p) => ({ profile: eco.refreshBoard(eco.declineOffer(p, offerId), new Date(), settingsRef.current.jobEveryMin).profile, ledger: null }))
  }, [mutate])

  const submit = useCallback(
    async (choiceId: string) => {
      const res = await mutate<eco.SubmitOutcome>((p) => {
        const out = eco.submitAnswer(p, choiceId)
        if (out.finished) out.profile = eco.refreshBoard(out.profile, new Date(), settingsRef.current.jobEveryMin).profile
        return { profile: out.profile, ledger: out.ledger, extra: out }
      })
      const out = res.extra ?? null
      if (out?.finished === 'done') {
        if (settingsRef.current.sound) playChime('reward')
        if (out.levelUp) celebrateLevel(out.levelUp)
        else if (out.profile.energy < 30) say('Nice work. I’m running low on energy though — a walk outside fills us right back up.', 'warn', { label: 'Go outside', app: 'outside' })
        else say(`Paid! That’s ${out.profile.money.toLocaleString('en')} in the bank.`, 'reward')
      } else if (out?.finished === 'failed') {
        say('That one slipped away. Every job teaches something — want another?', 'warn', { label: 'Open inbox', app: 'inbox' })
      }
      return out
    },
    [celebrateLevel, mutate, say],
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

  const train = useCallback(async (skill: SkillId) => {
    let error: eco.TrainError | null = null
    await mutate((p) => {
      const out = eco.trainSkill(p, skill)
      error = out.error
      return { profile: out.profile, ledger: null }
    })
    if (!error) {
      notify('success', `${skill} +1 practice point!`)
      say('A little practice, a little fresh air. Look at you growing!', 'reward')
      if (settingsRef.current.sound) playChime('reward')
    }
    return error
  }, [mutate, notify, say])

  /* ── outings from the phone (LAN inbox or file) ── */
  const receiveOuting = useCallback(
    async (bundle: OutingBundle) => {
      let newPhotos = 0
      for (const p of bundle.photos) {
        if (await store.getEvidence(p.id)) continue
        await store.putEvidence(photoToEvidence(p, 'lan'))
        newPhotos++
      }
      // Photos an admin approved on the phone are accepted without the AI check (and labelled).
      for (const p of bundle.photos.filter((x) => x.adminApproved)) {
        const item = await store.getEvidence(p.id)
        if (!item || item.status === 'verified') continue
        await mutate((prof, keys) => eco.applyPhoto(prof, keys, item), {
          id: item.id,
          patch: { status: 'verified', result: admin.ADMIN_PHOTO_RESULT, model: 'admin-override', verifiedAt: new Date().toISOString() },
        })
      }
      await refreshEvidence()
      const walk = bundle.walk
      const photoLine = newPhotos ? [`${newPhotos} photo${newPhotos > 1 ? 's' : ''} ready for your local AI.`] : []
      if (walk) {
        const res = await mutate((p, keys) => eco.applyWalk(p, keys, walk))
        if (res.ledger) {
          if (settingsRef.current.sound) playChime('reward')
          say('You’re back! I can feel the fresh air from here. Energy is full again.', 'reward')
          setCelebration({
            eyebrow: walk.override === 'admin' ? 'Admin override · walk skipped on phone' : 'Walk verified by GPS',
            title: `+${res.ledger.tokens} 🌿   +${res.ledger.xp} XP`,
            lines: [
              walk.override === 'admin' ? 'Not GPS-verified — skipped by admin on the phone.' : `${Math.round(walk.durationMin)} min outside, up to ${walk.maxDistanceM} m from where you started.`,
              'Energy fully restored.',
              ...photoLine,
            ],
            cta: newPhotos ? { label: 'Verify photos', app: 'outside' } : { label: 'Back to work', app: 'inbox' },
          })
          return
        }
        if (!walk.verified) notify('warn', `Walk received, but it didn’t reach ${walk.thresholds.minMinutes} min and ${walk.thresholds.minDistanceM} m — no walk reward this time.`)
        else notify('info', 'That walk was already credited.')
      }
      if (newPhotos) notify('success', photoLine[0])
    },
    [mutate, notify, refreshEvidence, say],
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

  const deliverOuting = useCallback(
    async (bundle: OutingBundle) => {
      await receiveOuting(parseOuting(bundle))
      setApp(bundle.photos.some((p) => !p.adminApproved) ? 'outside' : 'inbox')
    },
    [receiveOuting],
  )

  const isAdmin = !!session?.admin
  const adminActions = useMemo<GameValue['adminActions']>(() => {
    const guard = <A extends unknown[]>(fn: (...a: A) => Promise<void>) => async (...a: A) => {
      if (!isAdmin) return
      await fn(...a)
    }
    const approve = async (id: string) => {
      const item = await store.getEvidence(id)
      if (!item || item.status === 'verified') return
      await mutate((p, keys) => eco.applyPhoto(p, keys, item), {
        id,
        patch: { status: 'verified', result: admin.ADMIN_PHOTO_RESULT, model: 'admin-override', verifiedAt: new Date().toISOString() },
      })
    }
    return {
      walk: guard(async () => {
        const res = await mutate((p, keys) => admin.adminWalk(p, keys))
        if (res.ledger) notify('success', `Admin: walk skipped. +${res.ledger.tokens} 🌿 +${res.ledger.xp} XP, energy full.`)
      }),
      approvePhoto: guard(async (id: string) => {
        await approve(id)
        await refreshEvidence()
        notify('success', 'Admin: photo approved without AI check.')
      }),
      approveAllPhotos: guard(async () => {
        const pending = (await store.listEvidence()).filter((e) => e.status !== 'verified' && e.status !== 'verifying')
        for (const e of pending) await approve(e.id)
        await refreshEvidence()
        notify('success', `Admin: ${pending.length} photo(s) approved without AI check.`)
      }),
      finishJob: guard(async () => {
        const res = await mutate<eco.SubmitOutcome | null>((p) => {
          const out = admin.adminFinishJob(p)
          return out ? { profile: out.profile, ledger: out.ledger, extra: out } : { profile: p, ledger: null, extra: null }
        })
        if (res.extra) notify('success', `Admin: job completed. +${res.ledger?.money ?? 0}`)
        else notify('info', 'No active job to complete.')
      }),
      refill: guard(async () => void (await mutate((p) => ({ profile: admin.adminRefill(p), ledger: null })))),
      levelUp: guard(async () => void (await mutate((p) => ({ profile: admin.adminLevelUp(p), ledger: null })))),
      grant: guard(async (tokens: number, money: number) => void (await mutate((p) => ({ profile: admin.adminGrant(p, tokens, money), ledger: null })))),
    }
  }, [isAdmin, mutate, notify, refreshEvidence])

  const signIn = useCallback(async (user: string, password: string) => {
    const s = await auth.signIn(user, password)
    if (typeof s === 'string') return s
    setSession(s)
    return null
  }, [])
  const continueAsGuest = useCallback(() => setSession(auth.guestSession()), [])
  const signOut = useCallback(() => {
    auth.signOut()
    setSession(null)
    setApp('inbox')
  }, [])

  const value = useMemo<GameValue>(
    () => ({
      ready, profile, settings, evidence, progress, toasts, celebration, moss, dismissMoss, isAIHost, app,
      openApp: setApp,
      notify,
      dismissToast,
      dismissCelebration: () => setCelebration(null),
      accept, decline, submit, hint, abandon, buy, train, verify, cancelVerify, removeEvidence, importFile, exportBackup, resetAll, updateSettings,
      deliverOuting, session, signIn, continueAsGuest, signOut, adminActions,
    }),
    [ready, profile, settings, evidence, progress, toasts, celebration, moss, dismissMoss, isAIHost, app, notify, dismissToast, accept, decline, submit, hint, abandon, buy, train, verify, cancelVerify, removeEvidence, importFile, exportBackup, resetAll, updateSettings, deliverOuting, session, signIn, continueAsGuest, signOut, adminActions],
  )
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame outside GameProvider')
  return ctx
}
