import { useAIStatus } from '../app/AIStatusContext.tsx'
import { S } from '../content/strings.ts'

const LABEL = {
  checking: S.ai.checking,
  ready: S.ai.ready,
  'ollama-unavailable': S.ai.unavailable,
  'model-missing': S.ai.missing,
  'remote-device': S.ai.remote,
} as const

export default function LocalAIStatus({ onClick, compact = false }: { onClick?: () => void; compact?: boolean }) {
  const { diagnostics } = useAIStatus()
  const tone =
    diagnostics.connection === 'ready' ? 'ok' : diagnostics.connection === 'checking' || diagnostics.connection === 'remote-device' ? 'muted' : 'warn'
  const title =
    diagnostics.connection === 'ready'
      ? `${diagnostics.model} ${S.ai.readyDetail}${diagnostics.version ? ` · Ollama ${diagnostics.version}` : ''}`
      : (diagnostics.detail ?? LABEL[diagnostics.connection])
  const content = (
    <>
      <span className={`ai-dot ai-dot--${tone}`} aria-hidden />
      <span className="ai-status__label">{LABEL[diagnostics.connection]}</span>
      {!compact && diagnostics.connection === 'ready' && <span className="ai-status__model">{diagnostics.model}</span>}
    </>
  )
  return onClick ? (
    <button type="button" className="ai-status" onClick={onClick} title={title} aria-label={`${LABEL[diagnostics.connection]}. ${title}. Open diagnostics.`}>
      {content}
    </button>
  ) : (
    <span className="ai-status" title={title} role="status">
      {content}
    </span>
  )
}
