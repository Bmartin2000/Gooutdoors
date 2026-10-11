import { useEffect, useState } from 'react'
import { checkOllama, OLLAMA_MODEL } from '../lib/ollama.ts'

type Status = { kind: 'checking' } | { kind: 'ok'; version: string } | { kind: 'error'; message: string }

export default function OllamaStatus() {
  const [status, setStatus] = useState<Status>({ kind: 'checking' })

  useEffect(() => {
    let cancelled = false
    checkOllama()
      .then(({ version, hasModel }) => {
        if (cancelled) return
        setStatus(
          hasModel
            ? { kind: 'ok', version }
            : { kind: 'error', message: `Hiányzó modell – ollama pull ${OLLAMA_MODEL}` },
        )
      })
      .catch((err: Error) => {
        if (!cancelled) setStatus({ kind: 'error', message: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const title =
    status.kind === 'ok'
      ? `Ollama ${status.version} · ${OLLAMA_MODEL}`
      : status.kind === 'error'
        ? status.message
        : 'Ellenőrzés…'

  return (
    <span className={`status status--${status.kind}`} title={title}>
      <span className="status__dot" aria-hidden />
      {status.kind === 'ok' ? OLLAMA_MODEL : status.kind === 'error' ? 'AI offline' : '…'}
    </span>
  )
}
