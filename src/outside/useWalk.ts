import { useCallback, useEffect, useRef, useState } from 'react'
import { MISSIONS } from '../content/missions.ts'
import { acceptFix, distanceM, summarize, WALK_RULES } from '../game/location.ts'
import type { GeoFix, WalkRecord } from '../game/types.ts'
import { listWalks, putWalk } from '../storage/gamePersistence.ts'
import { playChime, vibrate } from '../app/notify.ts'

export type GeoState = 'idle' | 'waiting' | 'tracking' | 'denied' | 'unavailable' | 'insecure'

/** When the phone buzzes with a photo mission during a walk. */
const PROMPT = { normal: { afterMin: 4, orDistanceM: 120 }, demo: { afterMin: 0.75, orDistanceM: 15 } }

function newId() {
  return crypto.randomUUID?.() ?? `walk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function toFix(p: GeolocationPosition): GeoFix {
  return { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp || Date.now() }
}

/**
 * Tracks one walk with the device's GPS. Works with no network (satellite positioning).
 * Browsers pause tracking while the screen is off, so "pocket mode" keeps the screen awake
 * with a black, low-power view; a fresh fix is also taken whenever the page becomes visible.
 */
export function useWalk(demo: boolean) {
  const rules = demo ? WALK_RULES.demo : WALK_RULES.normal
  const prompt = demo ? PROMPT.demo : PROMPT.normal
  const [walk, setWalk] = useState<WalkRecord | null>(null)
  const [history, setHistory] = useState<WalkRecord[]>([])
  const [geo, setGeo] = useState<GeoState>('idle')
  const [now, setNow] = useState(() => Date.now())
  const [missionDue, setMissionDue] = useState(false)
  const [verifiedAlerted, setVerifiedAlerted] = useState(false)
  const watchId = useRef<number | null>(null)
  const walkRef = useRef<WalkRecord | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)

  const save = useCallback(async (next: WalkRecord) => {
    walkRef.current = next
    setWalk(next)
    await putWalk(next)
  }, [])

  const refreshHistory = useCallback(async () => setHistory(await listWalks()), [])

  useEffect(() => {
    void (async () => {
      const all = await listWalks()
      setHistory(all)
      const open = all.find((w) => !w.endedAt)
      if (open) {
        walkRef.current = open
        setWalk(open)
      }
    })()
  }, [])

  const onPosition = useCallback(
    (p: GeolocationPosition) => {
      const current = walkRef.current
      if (!current || current.endedAt) return
      setGeo('tracking')
      void save(acceptFix(current, toFix(p)))
    },
    [save],
  )

  const onError = useCallback((e: GeolocationPositionError) => {
    setGeo(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable')
  }, [])

  const startWatching = useCallback(() => {
    if (!window.isSecureContext) {
      setGeo('insecure')
      return
    }
    if (!('geolocation' in navigator)) {
      setGeo('unavailable')
      return
    }
    if (watchId.current !== null) return
    setGeo((g) => (g === 'tracking' ? g : 'waiting'))
    watchId.current = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 })
  }, [onError, onPosition])

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }, [])

  // Resume tracking for an unfinished walk, tick the clock, refresh on return to the page.
  useEffect(() => {
    if (!walk || walk.endedAt) return
    startWatching()
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        navigator.geolocation?.getCurrentPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 })
        if (wakeLock.current?.released === true) void requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk?.id, walk?.endedAt])

  useEffect(() => () => stopWatching(), [stopWatching])

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null
      return !!wakeLock.current
    } catch {
      return false
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLock.current?.release()
    } catch {
      /* already released */
    }
    wakeLock.current = null
  }, [])

  const start = useCallback(async () => {
    const mission = MISSIONS[Math.floor(Math.random() * MISSIONS.length)]
    const record: WalkRecord = { id: newId(), startedAt: new Date().toISOString(), endedAt: null, fixes: [], rejectedFixes: 0, missionId: mission.id, missionPromptedAt: null, summary: null }
    setMissionDue(false)
    setVerifiedAlerted(false)
    await save(record)
    startWatching()
  }, [save, startWatching])

  const end = useCallback(async () => {
    const current = walkRef.current
    if (!current) return
    stopWatching()
    await releaseWakeLock()
    const endedAt = Date.now()
    const done = { ...current, endedAt: new Date(endedAt).toISOString(), summary: summarize(current, rules, endedAt) }
    await save(done)
    setMissionDue(false)
    await refreshHistory()
    return done
  }, [refreshHistory, releaseWakeLock, rules, save, stopWatching])

  const markSent = useCallback(
    async (id: string) => {
      const all = await listWalks()
      const w = all.find((x) => x.id === id)
      if (w) await putWalk({ ...w, sentAt: new Date().toISOString() })
      await refreshHistory()
      if (walkRef.current?.id === id) setWalk((x) => (x ? { ...x, sentAt: new Date().toISOString() } : x))
    },
    [refreshHistory],
  )

  const closeSummary = useCallback(() => {
    walkRef.current = null
    setWalk(null)
  }, [])

  // Live numbers + the moments that make the phone buzz.
  const live = walk && !walk.endedAt ? summarize(walk, rules, now) : null
  const elapsedMin = walk && !walk.endedAt ? (now - Date.parse(walk.startedAt)) / 60_000 : 0

  useEffect(() => {
    if (!walk || walk.endedAt || walk.missionPromptedAt || !live) return
    if (elapsedMin >= prompt.afterMin || live.maxDistanceM >= prompt.orDistanceM) {
      vibrate([300, 150, 300, 150, 600])
      playChime('job')
      setMissionDue(true)
      void save({ ...walk, missionPromptedAt: new Date().toISOString() })
    }
  }, [elapsedMin, live, prompt.afterMin, prompt.orDistanceM, save, walk])

  useEffect(() => {
    if (live?.verified && !verifiedAlerted) {
      setVerifiedAlerted(true)
      vibrate([150, 80, 150])
      playChime('reward')
    }
  }, [live?.verified, verifiedAlerted])

  /** Metres from the walk's first good fix to its latest one (no coordinates leave the phone). */
  const distanceNow = walk && walk.fixes.length > 1 ? Math.round(distanceM(walk.fixes[0], walk.fixes[walk.fixes.length - 1])) : 0

  return {
    walk,
    history,
    geo,
    rules,
    live,
    elapsedMin,
    distanceNow,
    missionDue,
    dismissMission: () => setMissionDue(false),
    openMission: () => setMissionDue(true),
    start,
    end,
    markSent,
    closeSummary,
    requestWakeLock,
    releaseWakeLock,
    refreshHistory,
  }
}
