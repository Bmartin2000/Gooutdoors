import { Download, RefreshCcw, ShieldCheck, Trash2, Upload, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useAIStatus } from '../app/AIStatusContext.tsx'
import { useGame } from '../app/GameContext.tsx'
import type { AppSettings } from '../game/types.ts'

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      <div className="segmented__track">
        {options.map((o) => (
          <label key={o.value} className={`segmented__opt ${value === o.value ? 'is-on' : ''}`}>
            <input type="radio" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="kv">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

export function OllamaSetupHelp({ connection, model }: { connection: string; model: string }) {
  if (connection === 'ready' || connection === 'checking') return null
  if (connection === 'remote-device') {
    return (
      <p className="note">
        This device is a capture device. The model only runs on the computer that serves AFK.exe — photos taken here are sent there (same Wi-Fi) or
        exported as a file.
      </p>
    )
  }
  return (
    <div className="note note--warn stack-2">
      <p>{connection === 'model-missing' ? 'Ollama is running but the model is not installed:' : 'Start Ollama on this computer, then make sure the model is present:'}</p>
      {connection !== 'model-missing' && <code className="cmd">ollama serve</code>}
      <code className="cmd">ollama pull {model}</code>
      <p className="muted small">Mission photos can still be captured and saved while the AI is offline.</p>
    </div>
  )
}

export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, exportBackup, importFile, resetAll } = useGame()
  const { diagnostics, recheck } = useAIStatus()
  const panel = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const set = (patch: Partial<AppSettings>) => void updateSettings(patch)
  const sizeGb = diagnostics.modelSize ? `${(diagnostics.modelSize / 1e9).toFixed(1)} GB` : '—'

  return (
    <div className="overlay overlay--drawer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className="drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1}>
        <header className="drawer__head">
          <h2 id="settings-title" className="h3">
            Settings
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>

        <section className="drawer__section">
          <h3 className="section-title">Appearance</h3>
          <Segmented<AppSettings['theme']>
            label="Theme"
            value={settings.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'dark', label: 'Graphite' },
              { value: 'light', label: 'Paper' },
            ]}
          />
          <Segmented<AppSettings['motion']>
            label="Motion"
            value={settings.motion}
            onChange={(motion) => set({ motion })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'full', label: 'Full' },
              { value: 'reduced', label: 'Reduced' },
            ]}
          />
          <label className="switch">
            <input type="checkbox" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} />
            <span className="switch__track" aria-hidden />
            <span>Soft chime when a tool unlocks</span>
          </label>
        </section>

        <section className="drawer__section">
          <div className="row-between">
            <h3 className="section-title">Local AI diagnostics</h3>
            <button type="button" className="btn btn--sm" onClick={() => void recheck()}>
              <RefreshCcw size={14} aria-hidden /> Recheck
            </button>
          </div>
          <dl className="kv-list">
            <Row k="Status" v={<span className={`pill pill--${diagnostics.connection === 'ready' ? 'ok' : 'warn'}`}>{diagnostics.connection}</span>} />
            <Row k="Model" v={<code>{diagnostics.model}</code>} />
            <Row k="Model size" v={sizeGb} />
            <Row k="Ollama" v={diagnostics.version ?? '—'} />
            <Row k="Capabilities" v={diagnostics.capabilities.length ? diagnostics.capabilities.join(', ') : '—'} />
            <Row k="Endpoint" v={<code>127.0.0.1:11434 via local adapter</code>} />
          </dl>
          {diagnostics.detail && <p className="muted small">{diagnostics.detail}</p>}
          <OllamaSetupHelp connection={diagnostics.connection} model={diagnostics.model} />
        </section>

        <section className="drawer__section">
          <h3 className="section-title">Your data</h3>
          <p className="muted small">Progress, photos and rewards live in this browser’s IndexedDB. Backups are plain JSON files you control.</p>
          <div className="row-2 wrap">
            <button type="button" className="btn btn--sm" onClick={() => void exportBackup()}>
              <Download size={14} aria-hidden /> Export backup
            </button>
            <button type="button" className="btn btn--sm" onClick={() => fileInput.current?.click()}>
              <Upload size={14} aria-hidden /> Import file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importFile(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={() => {
                if (window.confirm('Delete all AFK.exe progress, rewards and photos on this device? This cannot be undone.')) void resetAll()
              }}
            >
              <Trash2 size={14} aria-hidden /> Delete all data
            </button>
          </div>
        </section>

        <section className="drawer__section stack-3">
          <h3 className="section-title">Privacy & offline</h3>
          <p className="fact">
            <ShieldCheck size={16} aria-hidden />
            <span>
              No accounts, analytics or cloud APIs. Photos and code are processed by <strong>{diagnostics.model}</strong> through Ollama on this computer,
              via a same-origin adapter that only answers local requests.
            </span>
          </p>
          <p className="fact">
            <WifiOff size={16} aria-hidden />
            <span>
              After the first load, the app shell and missions are cached for offline use. A phone can capture and save photos with no connection; the AI
              check happens when the photo reaches the computer running Ollama. Photos are re-encoded on capture, which strips location metadata.
            </span>
          </p>
          <p className="muted small">
            The vision check judges plausibility from pixels only. It cannot prove where or when a photo was taken, and its confidence is an estimate.
          </p>
        </section>
      </div>
    </div>
  )
}
