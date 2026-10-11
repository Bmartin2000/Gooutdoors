import { Smartphone, Upload } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../app/GameContext.tsx'

interface Pairing {
  token: string
  lanEnabled: boolean
  urls: string[]
}

/**
 * Desktop-only: hand the active mission to a phone on the same Wi-Fi (QR), and accept
 * photo files moved by any offline means (AirDrop, USB, Nearby Share).
 */
export default function PhonePairing({ target }: { target: { contractId: string; variantId: string } }) {
  const { importFile, isAIHost } = useGame()
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [svg, setSvg] = useState<string>('')
  const [urlIndex, setUrlIndex] = useState(0)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAIHost) return
    fetch('/afk-local/pairing', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Pairing>) : null))
      .then(setPairing)
      .catch(() => setPairing(null))
  }, [isAIHost])

  const link = pairing?.urls[urlIndex]
    ? `${pairing.urls[urlIndex]}/explore?field=${encodeURIComponent(target.contractId)}&variant=${encodeURIComponent(target.variantId)}&pair=${encodeURIComponent(pairing.token)}`
    : null

  useEffect(() => {
    if (!link) return
    // The QR is rendered locally into an SVG string; no external QR service.
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111312', light: '#f6f3ec' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [link])

  if (!isAIHost) return null

  return (
    <section className="card card--pad stack-3" aria-labelledby="pair-title">
      <div className="row-2">
        <Smartphone size={18} aria-hidden />
        <h2 id="pair-title" className="section-title">
          Take this mission on your phone
        </h2>
      </div>
      {link && svg ? (
        <>
          <div className="qr">
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt="QR code that opens this mission on your phone" width={168} height={168} />
            <div className="stack-2">
              <p className="small">Scan with your phone on the same Wi-Fi. It opens this mission ready to capture — and works offline once loaded.</p>
              <code className="small break">{link.replace(/pair=.*/, 'pair=…')}</code>
              {pairing && pairing.urls.length > 1 && (
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => setUrlIndex((i) => (i + 1) % pairing.urls.length)}>
                  Try another network address ({urlIndex + 1}/{pairing.urls.length})
                </button>
              )}
            </div>
          </div>
          <p className="muted small">Photos you send from the phone arrive here automatically while this page is open.</p>
        </>
      ) : (
        <div className="stack-2">
          <p className="small">
            To open AFK.exe on a phone, restart it with LAN access (your computer still keeps the AI private):
          </p>
          <code className="cmd">npm run start:lan</code>
          <p className="muted small">No Wi-Fi outside? That’s fine — the phone saves photos offline and sends them when you’re back.</p>
        </div>
      )}
      <div className="divider" />
      <p className="small">
        <strong>Moved a photo another way?</strong> Import an <code>.afk.json</code> file exported from your phone.
      </p>
      <button type="button" className="btn btn--sm" onClick={() => file.current?.click()}>
        <Upload size={14} aria-hidden /> Import photo file
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
    </section>
  )
}
