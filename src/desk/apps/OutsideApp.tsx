import { CheckCircle2, CircleAlert, CircleHelp, Loader2, MapPin, RotateCcw, ShieldCheck, Smartphone, Trash2, Upload, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { useAIStatus } from '../../app/AIStatusContext.tsx'
import { useGame } from '../../app/GameContext.tsx'
import { OllamaSetupHelp } from '../../components/SettingsPanel.tsx'
import { getMission, getVariant } from '../../content/missions.ts'
import { WALK_RULES } from '../../game/location.ts'
import type { MissionEvidence } from '../../game/types.ts'

interface Pairing {
  token: string
  lanEnabled: boolean
  urls: string[]
}

function useObjectUrl(blob: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function PhotoCard({ item }: { item: MissionEvidence }) {
  const { progress, verify, cancelVerify, removeEvidence } = useGame()
  const { diagnostics } = useAIStatus()
  const url = useObjectUrl(item.image)
  const mission = getMission(item.missionId)
  const variant = getVariant(item.missionId, item.variantId)
  const p = progress[item.id]
  const ready = diagnostics.connection === 'ready'

  const status =
    item.status === 'verifying'
      ? { icon: <Loader2 size={15} className="spin" />, text: p?.phase === 'writing' ? 'Writing its verdict…' : 'Your local AI is looking at the photo…', tone: 'busy' }
      : item.status === 'verified'
        ? { icon: <CheckCircle2 size={15} />, text: 'Verified by your local AI', tone: 'ok' }
        : item.status === 'needs-review'
          ? { icon: <CircleHelp size={15} />, text: 'Not sure — reward on hold', tone: 'warn' }
          : item.status === 'rejected'
            ? { icon: <CircleAlert size={15} />, text: 'Doesn’t match the mission', tone: 'warn' }
            : item.status === 'verification-failed'
              ? { icon: <CircleAlert size={15} />, text: 'Unable to verify right now', tone: 'warn' }
              : { icon: <ShieldCheck size={15} />, text: 'Waiting for your local AI', tone: 'muted' }

  return (
    <article className={`photo photo--${status.tone}`}>
      <div className="photo__img">{url && <img src={url} alt={`Photo for ${mission?.title}`} />}</div>
      <div className="photo__body">
        <p className="photo__meta">
          {mission?.title} · {variant?.title} · {new Date(item.capturedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
          {item.distanceFromStartM !== undefined && (
            <>
              {' '}
              · <MapPin size={10} aria-hidden /> {item.distanceFromStartM} m from start
            </>
          )}
        </p>
        <p className={`photo__status photo__status--${status.tone}`} role="status">
          {status.icon} {status.text}
          {item.status === 'verifying' && p ? <span className="muted"> · {Math.round(p.elapsedMs / 1000)}s</span> : null}
        </p>
        {item.result && item.status !== 'verifying' && (
          <p className="photo__reason">
            {item.result.reason} <span className="muted">· match estimate {Math.round(item.result.confidence * 100)}% (a model guess, not proof)</span>
          </p>
        )}
        {item.lastError && item.status !== 'verifying' && <p className="error-text small">{item.lastError}</p>}
        <div className="row-2 wrap">
          {item.status === 'verifying' ? (
            <button type="button" className="btn btn--sm" onClick={() => cancelVerify(item.id)}>
              <X size={13} aria-hidden /> Cancel
            </button>
          ) : (
            item.status !== 'verified' && (
              <button type="button" className="btn btn--sm btn--primary" disabled={!ready} onClick={() => void verify(item.id)}>
                {item.status === 'saved-for-later' ? <ShieldCheck size={13} aria-hidden /> : <RotateCcw size={13} aria-hidden />}
                {item.status === 'saved-for-later' ? 'Verify with local AI' : 'Verify again'}
              </button>
            )
          )}
          {item.status !== 'verifying' && (
            <button type="button" className="btn btn--sm btn--ghost" aria-label="Delete photo" onClick={() => window.confirm('Delete this photo?') && void removeEvidence(item.id)}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function PhoneQR() {
  const { settings } = useGame()
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [svg, setSvg] = useState('')
  const [i, setI] = useState(0)

  useEffect(() => {
    fetch('/afk-local/pairing', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Pairing>) : null))
      .then(setPairing)
      .catch(() => setPairing(null))
  }, [])

  const link = pairing?.urls[i] ? `${pairing.urls[i]}/outside?pair=${encodeURIComponent(pairing.token)}${settings.demoWalk ? '&demo=1' : ''}` : null

  useEffect(() => {
    if (!link) return
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111312', light: '#f6f3ec' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [link])

  if (!link || !svg) {
    return (
      <div className="qr-help stack-2">
        <p className="small">To take AFK.exe on your phone, restart it with local HTTPS on your Wi-Fi:</p>
        <code className="cmd">npm run start:lan</code>
        <p className="muted small">HTTPS lets the phone use GPS. The certificate is generated on this computer — your phone will warn once; that’s expected.</p>
      </div>
    )
  }
  return (
    <div className="qr">
      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt="QR code that opens AFK.exe Outside on your phone" width={150} height={150} />
      <div className="stack-2">
        <p className="small">
          <strong>Scan with your phone</strong> on the same Wi-Fi. Accept the certificate warning once (it’s this computer’s own certificate).
        </p>
        <code className="small break">{link.replace(/pair=[^&]*/, 'pair=…')}</code>
        {pairing && pairing.urls.length > 1 && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setI((x) => (x + 1) % pairing.urls.length)}>
            Try another address ({i + 1}/{pairing.urls.length})
          </button>
        )}
      </div>
    </div>
  )
}

export default function OutsideApp() {
  const { evidence, settings, importFile, profile } = useGame()
  const { diagnostics } = useAIStatus()
  const file = useRef<HTMLInputElement>(null)
  const rules = settings.demoWalk ? WALK_RULES.demo : WALK_RULES.normal
  const pending = evidence.filter((e) => e.status !== 'verified')
  const done = evidence.filter((e) => e.status === 'verified')

  return (
    <div className="app-grid">
      <section className="app-col" aria-labelledby="outside-title">
        <header className="app-head">
          <h2 id="outside-title">Go outside</h2>
          <p className="muted small">The best upgrade isn’t on this screen.</p>
        </header>
        <ol className="how">
          <li>
            <strong>Start a walk on your phone</strong> and pocket it. GPS works without signal.
          </li>
          <li>
            <strong>
              Stay out {rules.minMinutes}+ min and get {rules.minDistanceM}+ m away
            </strong>{' '}
            — that counts as a verified walk: energy back to 100, fresh-air tokens and XP. No task needed.
            {settings.demoWalk && <span className="pill pill--warn">demo thresholds</span>}
          </li>
          <li>
            <strong>The phone buzzes when a photo mission appears.</strong> Snap it, then pocket the phone again.
          </li>
          <li>
            <strong>Back on Wi-Fi, tap “Send to my desk”.</strong> Your local AI checks the photo here for bonus tokens.
          </li>
        </ol>

        <div className="card-lite">
          <div className="row-2">
            <Smartphone size={16} aria-hidden />
            <h3 className="section-title">Your phone</h3>
          </div>
          <PhoneQR />
          <div className="divider" />
          <p className="small">
            No shared Wi-Fi? Export the outing on the phone and import the <code>.afk.json</code> file here.
          </p>
          <button type="button" className="btn btn--sm" onClick={() => file.current?.click()}>
            <Upload size={13} aria-hidden /> Import outing file
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <aside className="app-col app-col--side" aria-labelledby="photos-title">
        <p className="eyebrow">
          Walks verified: {profile.walksVerified} · {profile.minutesOutside} min outside
        </p>
        <h3 id="photos-title" className="section-title">
          Photos from your phone
        </h3>
        <OllamaSetupHelp connection={diagnostics.connection} model={diagnostics.model} />
        {pending.length === 0 && done.length === 0 && <p className="muted small">Nothing yet. Photos you send from a walk appear here for your local AI to check.</p>}
        <div className="photos">
          {pending.map((e) => (
            <PhotoCard key={e.id} item={e} />
          ))}
          {done.slice(0, 4).map((e) => (
            <PhotoCard key={e.id} item={e} />
          ))}
        </div>
      </aside>
    </div>
  )
}
