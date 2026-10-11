import { ArrowLeft, Camera, Check, ChevronDown, Download, ImagePlus, MapPin, Moon, Send, ShieldAlert, Square, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { prepareForStorage } from '../ai/image.ts'
import { useGame } from '../app/GameContext.tsx'
import { BrandMark } from '../components/Brand.tsx'
import Toasts from '../components/Toasts.tsx'
import { loginConfigured } from '../app/auth.ts'
import LoginScreen from '../desk/LoginScreen.tsx'
import { MossFace } from '../desk/MossBubble.tsx'
import { getMission, getVariant } from '../content/missions.ts'
import type { MissionEvidence, PhonePairing, WalkRecord } from '../game/types.ts'
import { deleteEvidence, listEvidence, loadPairing, putEvidence, savePairing } from '../storage/gamePersistence.ts'
import { buildOuting, shareOrDownload } from '../storage/transfer.ts'
import { useWalk } from './useWalk.ts'

function fmtMin(min: number) {
  const m = Math.floor(min)
  const s = Math.floor((min - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function Ring({ ratio, children }: { ratio: number; children: React.ReactNode }) {
  const r = 46
  const c = 2 * Math.PI * r
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} className="ring__track" />
        <circle cx="50" cy="50" r={r} className="ring__fill" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, ratio))} />
      </svg>
      <div className="ring__inner">{children}</div>
    </div>
  )
}

export default function OutsidePage() {
  const { notify, session, signOut, isAIHost, deliverOuting } = useGame()
  const navigate = useNavigate()
  const isAdmin = !!session?.admin
  const [showLogin, setShowLogin] = useState(false)
  const [params, setParams] = useSearchParams()
  const [pairing, setPairing] = useState<PhonePairing | null>(null)
  // An unpaired phone owns its own game; paired phones can still send to a computer.
  const sameDevice = isAIHost || !pairing?.token
  const [photos, setPhotos] = useState<MissionEvidence[]>([])
  const [pocket, setPocket] = useState(false)
  const [variantId, setVariantId] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const w = useWalk(!!pairing?.demo)
  const backToGame = async () => {
    await w.releaseWakeLock()
    navigate('/')
  }

  // Pairing from the desk QR: /outside?pair=<token>&demo=1
  useEffect(() => {
    void (async () => {
      const token = params.get('pair')
      if (token || params.has('demo')) {
        const prev = await loadPairing()
        const next: PhonePairing = { token: token ?? prev?.token ?? null, receivedAt: new Date().toISOString(), demo: params.get('demo') === '1' }
        await savePairing(next)
        setPairing(next)
        setParams({}, { replace: true })
      } else setPairing(await loadPairing())
      setPhotos(await listEvidence())
    })()
  }, [params, setParams])

  const refreshPhotos = useCallback(async () => setPhotos(await listEvidence()), [])

  const mission = w.walk ? getMission(w.walk.missionId) : undefined
  const variant = mission ? getVariant(mission.id, variantId) : undefined
  const walkPhotos = (walk: WalkRecord | null) => photos.filter((p) => walk && p.walkId === walk.id)

  const onFile = async (file: File | undefined, source: 'camera' | 'upload') => {
    if (!file || !w.walk || !mission || !variant) return
    try {
      const img = await prepareForStorage(file)
      const now = new Date().toISOString()
      await putEvidence({
        id: crypto.randomUUID?.() ?? `ev-${Date.now().toString(36)}`,
        missionId: mission.id,
        variantId: variant.id,
        walkId: w.walk.id,
        distanceFromStartM: w.distanceNow,
        image: img.blob,
        mimeType: img.mimeType,
        width: img.width,
        height: img.height,
        capturedAt: source === 'camera' ? now : new Date(file.lastModified || Date.now()).toISOString(),
        savedAt: now,
        source,
        status: 'saved-for-later',
        attempts: 0,
        ...(isAdmin ? { adminApproved: true } : {}),
      })
      await refreshPhotos()
      w.dismissMission()
      notify('success', isAdmin ? 'Photo saved and approved (admin override). Your desk accepts it without the AI check.' : 'Photo saved on this phone. Pocket it — your desk checks it later.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Could not save the photo.')
    }
  }

  const send = async (walk: WalkRecord) => {
    const bundle = await buildOuting(walk.summary, walkPhotos(walk))
    // On the desk computer itself: credit it right away and go back to the monitor.
    if (sameDevice) {
      await deliverOuting(bundle)
      await w.markSent(walk.id)
      w.closeSummary()
      navigate('/')
      return
    }
    if (!pairing?.token) {
      notify('warn', 'Not paired with a desk. Export the file instead, or scan the QR code on your computer.')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/afk-sync/evidence?token=${encodeURIComponent(pairing.token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bundle) })
      if (res.status === 401) throw new Error('The pairing expired (AFK.exe restarted on the computer). Scan the QR code again.')
      if (res.status === 413) throw new Error('Too much to send at once. Export the file instead.')
      if (!res.ok) throw new Error('Your desk did not accept the outing.')
      await w.markSent(walk.id)
      w.closeSummary()
      notify('success', 'Sent! Your rewards are waiting on your desk. Ready for the next walk.')
    } catch (e) {
      notify('error', e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'Can’t reach your desk. Are you back on the same Wi-Fi, with AFK.exe running?')
    } finally {
      setSending(false)
    }
  }

  /** After a walk: deliver automatically when possible, otherwise show the summary with Share. */
  const afterWalk = async (walk: WalkRecord | undefined) => {
    if (!walk) return
    if (sameDevice || (pairing?.token && navigator.onLine)) await send(walk)
  }

  const exportFile = async (walk: WalkRecord) => {
    try {
      const bundle = await buildOuting(walk.summary, walkPhotos(walk))
      await shareOrDownload(bundle, `afk-outing-${walk.startedAt.slice(0, 16).replace(/[:T]/g, '-')}.afk.json`)
      await w.markSent(walk.id)
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) notify('error', 'Export failed.')
    }
  }

  const togglePocket = async (on: boolean) => {
    if (on) {
      const ok = await w.requestWakeLock()
      if (!ok) notify('info', 'This browser can’t keep the screen on. Open the page now and then so GPS can update.')
    } else await w.releaseWakeLock()
    setPocket(on)
  }

  const geoMessage =
    w.geo === 'insecure'
      ? 'GPS needs a secure page. Open AFK.exe from the QR code on your computer (it starts with https://).'
      : w.geo === 'denied'
        ? 'Location permission was denied. Allow it in your browser’s site settings to verify the walk. Photos still work.'
        : w.geo === 'unavailable'
          ? 'No GPS fix yet. Step outside, away from tall buildings.'
          : w.geo === 'waiting'
            ? 'Waiting for GPS…'
            : null

  /* ───────── pocket mode: black screen, minimal light, buzzes when needed ───────── */
  if (pocket && w.walk && !w.walk.endedAt) {
    return (
      <button type="button" className="pocket" onClick={() => void togglePocket(false)} aria-label="Leave pocket mode">
        <span className="pocket__time">{fmtMin(w.elapsedMin)}</span>
        <span className="pocket__dist">{w.distanceNow} m</span>
        {w.live?.verified && <span className="pocket__ok">walk verified</span>}
        <span className="pocket__hint">tap to wake</span>
      </button>
    )
  }

  /* ───────── mission prompt ───────── */
  const missionSheet =
    w.missionDue && mission && variant ? (
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="mission-title">
        <div className="sheet__card">
          <p className="eyebrow eyebrow--accent">Mission unlocked · +{mission.rewardTokens} 🌿</p>
          <h2 id="mission-title" className="sheet__title">
            {mission.title}
          </h2>
          <p className="sheet__instruction">{variant.instruction}</p>
          <div className="sheet__variants">
            {mission.variants.map((v) => (
              <button key={v.id} type="button" className={`chip ${v.id === variant.id ? 'is-on' : ''}`} onClick={() => setVariantId(v.id)}>
                {v.title}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--primary btn--xl btn--block" onClick={() => camera.current?.click()}>
            <Camera size={22} aria-hidden /> Take photo
          </button>
          <div className="row-2">
            <button type="button" className="btn btn--block" onClick={() => library.current?.click()}>
              <ImagePlus size={17} aria-hidden /> Library
            </button>
            <button type="button" className="btn btn--block btn--ghost" onClick={w.dismissMission}>
              Later
            </button>
          </div>
          <details className="disclosure">
            <summary>
              <ShieldAlert size={15} aria-hidden /> Stay safe <ChevronDown size={15} className="disclosure__chev" aria-hidden />
            </summary>
            <ul className="disclosure__body">
              {mission.safety.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    ) : null

  return (
    <div className="outside">
      <header className="outside__top">
        <BrandMark size={26} />
        <span className="outside__brand">
          AFK<span className="wordmark__ext">.exe</span> <span className="muted">Outside</span>
        </span>
        <span className={`pill ${pairing?.token ? 'pill--ok' : ''}`}>{pairing?.token ? 'Paired with desk' : 'Phone app'}</span>
        {isAdmin ? (
          <button type="button" className="pill pill--admin" onClick={signOut} title="Sign out">
            ADMIN · sign out
          </button>
        ) : (
          loginConfigured && (
            <button type="button" className="outside__admin-btn" onClick={() => setShowLogin(true)}>
              Admin
            </button>
          )
        )}
      </header>
      <nav className="outside__game-nav" aria-label="Game navigation">
        <button type="button" className="btn btn--primary btn--block" onClick={() => void backToGame()}><ArrowLeft size={20} /> Back to game · Office & jobs</button>
        {w.walk && !w.walk.endedAt && <p className="small muted">Your walk stays saved. GPS resumes when you return to Outside.</p>}
      </nav>
      {showLogin && !isAdmin && <LoginScreen onClose={() => setShowLogin(false)} />}

      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" hidden onChange={(e) => { void onFile(e.target.files?.[0], 'camera'); e.target.value = '' }} />
      <input ref={library} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void onFile(e.target.files?.[0], 'upload'); e.target.value = '' }} />

      {!w.walk && (
        <section className="outside__hero">
          <div className="outside__leaf" aria-hidden>
            <MossFace />
          </div>
          <h1 className="outside__title">Take a walk.</h1>
          <p className="outside__lead">
            {w.rules.minMinutes}+ minutes, {w.rules.minDistanceM}+ metres from here. GPS checks it — no signal needed. Your phone buzzes when a photo mission appears.
          </p>
          {pairing?.demo && <p className="pill pill--warn">Demo thresholds (set on your desk)</p>}
          <div className="walk-reward-preview">
            <strong>Moss is cheering you on 🌱</strong>
            <p>One verified walk → 100 energy, fresh-air tokens and career XP. At 10 minutes: 3 🌿 + 80 XP, before office bonuses.</p>
            <ol><li>Start and allow GPS.</li><li>Walk away from your starting point. Use pocket mode to keep tracking.</li><li>Return and share the outing with your desk. Buy your next plant!</li></ol>
          </div>
          <button type="button" className="btn btn--primary btn--xl btn--block" onClick={() => void w.start()}>
            Start walk
          </button>
          <p className="muted small center">Your location stays on this phone. Only time and distance are shared with your desk.</p>
        </section>
      )}

      {w.walk && !w.walk.endedAt && (
        <section className="outside__live">
          <Ring ratio={Math.min(w.live?.verified ? 1 : 0.999, Math.min(w.elapsedMin / w.rules.minMinutes, 1) * 0.5 + Math.min(w.distanceNow / w.rules.minDistanceM, 1) * 0.5)}>
            <span className="ring__big">{fmtMin(w.elapsedMin)}</span>
            <span className="ring__small">
              <MapPin size={12} aria-hidden /> {w.distanceNow} m
            </span>
          </Ring>
          <div className="goals">
            <span className={w.live && w.live.durationMin >= w.rules.minMinutes ? 'is-done' : ''}>
              {w.live && w.live.durationMin >= w.rules.minMinutes ? <Check size={13} /> : null} {w.rules.minMinutes} min
            </span>
            <span className={w.live && w.live.maxDistanceM >= w.rules.minDistanceM ? 'is-done' : ''}>
              {w.live && w.live.maxDistanceM >= w.rules.minDistanceM ? <Check size={13} /> : null} {w.rules.minDistanceM} m away
            </span>
          </div>
          {w.live?.verified ? <p className="verified-banner">Walk verified — keep going or head back.</p> : geoMessage ? <p className="note">{geoMessage}</p> : null}
          {w.walk.missionPromptedAt && !w.missionDue && walkPhotos(w.walk).length === 0 && (
            <button type="button" className="btn btn--block" onClick={w.openMission}>
              <Camera size={16} aria-hidden /> Open mission: {mission?.title}
            </button>
          )}
          {walkPhotos(w.walk).length > 0 && <p className="muted small center">📷 {walkPhotos(w.walk).length} photo saved for this walk</p>}
          {isAdmin && (
            <div className="admin-bar">
              <span className="admin-bar__title">Admin override</span>
              <button type="button" className="btn btn--block" onClick={async () => void (await afterWalk(await w.skipAsAdmin()))}>
                Skip walk — count it as done
              </button>
              {!w.missionDue && (
                <button type="button" className="btn btn--block" onClick={w.openMission}>
                  Show the photo mission now
                </button>
              )}
              <p className="muted small">Photos you take are approved automatically. Your desk accepts all of it, labelled “Admin override”.</p>
            </div>
          )}
          <button type="button" className="btn btn--xl btn--block" onClick={() => void togglePocket(true)}>
            <Moon size={18} aria-hidden /> Pocket mode
          </button>
          <button type="button" className="btn btn--block btn--ghost" onClick={async () => void (await afterWalk(await w.end()))}>
            <Square size={14} aria-hidden /> End walk
          </button>
        </section>
      )}

      {w.walk?.endedAt && w.walk.summary && (
        <section className="outside__summary">
          <p className="eyebrow">{w.walk.summary.override === 'admin' ? 'Admin override · counted as done' : w.walk.summary.verified ? 'Walk verified by GPS' : 'Walk recorded'}</p>
          <h1 className="outside__title">{w.walk.summary.verified ? 'Nice walk.' : 'Not quite a walk yet.'}</h1>
          <dl className="summary-stats">
            <div>
              <dt>Time</dt>
              <dd>{Math.round(w.walk.summary.durationMin)} min</dd>
            </div>
            <div>
              <dt>Farthest</dt>
              <dd>{w.walk.summary.maxDistanceM} m</dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd>{w.walk.summary.pathM} m</dd>
            </div>
            <div>
              <dt>Photos</dt>
              <dd>{walkPhotos(w.walk).length}</dd>
            </div>
          </dl>
          {!w.walk.summary.verified && isAdmin && (
            <button type="button" className="btn btn--block" onClick={async () => void (await afterWalk(await w.skipAsAdmin()))}>
              Count it anyway (admin override)
            </button>
          )}
          {!w.walk.summary.verified && (
            <p className="note">
              Needs {w.rules.minMinutes} min and {w.rules.minDistanceM} m with a working GPS fix. Photos still count once your desk checks them.
            </p>
          )}
          {sameDevice ? (
            <button type="button" className="btn btn--primary btn--xl btn--block" onClick={() => void send(w.walk!)}>
              <Send size={18} aria-hidden /> Back to my desk
            </button>
          ) : pairing?.token ? (
            <>
              <p className="muted small">{w.walk.sentAt ? 'Sent to your desk.' : 'Back on Wi-Fi? Send it to your desk to collect your rewards there.'}</p>
              <button type="button" className="btn btn--primary btn--xl btn--block" disabled={sending} onClick={() => void send(w.walk!)}>
                <Send size={18} aria-hidden /> {sending ? 'Sending…' : 'Send to my desk'}
              </button>
              <button type="button" className="btn btn--block" onClick={() => void exportFile(w.walk!)}>
                <Download size={15} aria-hidden /> Share as a file instead
              </button>
            </>
          ) : (
            <>
              <p className="muted small">
                {w.walk.sentAt ? 'Shared.' : 'Share the walk with your computer (AirDrop, Nearby Share, e-mail to yourself), then on the desk open Outside › Import outing file.'}
              </p>
              <button type="button" className="btn btn--primary btn--xl btn--block" onClick={() => void exportFile(w.walk!)}>
                <Send size={18} aria-hidden /> Share with my desk
              </button>
            </>
          )}
          <button type="button" className="btn btn--block btn--ghost" onClick={w.closeSummary}>
            Done
          </button>
        </section>
      )}

      {!w.walk && w.history.filter((h) => h.endedAt && !h.sentAt).length > 0 && (
        <section className="outside__pending">
          <p className="eyebrow">Not sent yet</p>
          {w.history
            .filter((h) => h.endedAt && !h.sentAt)
            .map((h) => (
              <div key={h.id} className="pending-row">
                <span>
                  {new Date(h.startedAt).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' })} · {Math.round(h.summary?.durationMin ?? 0)} min · {h.summary?.maxDistanceM ?? 0} m
                  {h.summary?.verified ? ' ✓' : ''}
                </span>
                <span className="row-2">
                  {(pairing?.token || sameDevice) && (
                    <button type="button" className="btn btn--sm btn--primary" onClick={() => void send(h)} aria-label="Send to desk">
                      <Send size={13} />
                    </button>
                  )}
                  <button type="button" className="btn btn--sm" onClick={() => void exportFile(h)} aria-label="Export file">
                    <Download size={13} />
                  </button>
                </span>
              </div>
            ))}
        </section>
      )}

      {!w.walk && photos.length > 0 && (
        <button
          type="button"
          className="btn btn--sm btn--ghost outside__clear"
          onClick={async () => {
            if (!window.confirm('Delete all photos stored on this phone?')) return
            for (const p of photos) await deleteEvidence(p.id)
            await refreshPhotos()
          }}
        >
          <X size={13} aria-hidden /> Clear {photos.length} stored photo{photos.length > 1 ? 's' : ''}
        </button>
      )}
      {missionSheet}
      <Toasts />
    </div>
  )
}
