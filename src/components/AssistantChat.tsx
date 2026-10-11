import { ArrowUp, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ASSISTANT_SYSTEM_PROMPT } from '../ai/developerAssistant.ts'
import { chat, OllamaError, type ChatMessage } from '../ai/ollamaClient.ts'
import { useAIStatus } from '../app/AIStatusContext.tsx'
import { OllamaSetupHelp } from './SettingsPanel.tsx'

const STARTERS = ['How does the photo check work offline?', 'Why does AFK.exe use a local model?', 'Give me a 10-minute walk idea between bugs.']
const MAX_TURNS = 8

/** Basic assistant, available from day one. Plain text rendered as text nodes only. */
export default function AssistantChat() {
  const { diagnostics } = useAIStatus()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])
  useEffect(() => () => controller.current?.abort(), [])

  const send = async (text: string) => {
    const content = text.trim().slice(0, 1500)
    if (!content || busy) return
    const history: ChatMessage[] = [...messages, { role: 'user' as const, content }].slice(-MAX_TURNS * 2)
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setError(null)
    setBusy(true)
    const c = new AbortController()
    controller.current = c
    try {
      await chat({
        messages: [{ role: 'system', content: ASSISTANT_SYSTEM_PROMPT }, ...history],
        temperature: 0.5,
        timeoutMs: 5 * 60 * 1000,
        numPredict: 400,
        signal: c.signal,
        onToken: (t) =>
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            next[next.length - 1] = { ...last, content: last.content + t }
            return next
          }),
      })
    } catch (e) {
      if (!(e instanceof OllamaError && e.code === 'aborted')) setError(e instanceof Error ? e.message : 'Unexpected error.')
      setMessages((prev) => (prev.at(-1)?.content ? prev : prev.slice(0, -1)))
    } finally {
      setBusy(false)
      controller.current = null
    }
  }

  return (
    <div className="assistant stack-3">
      <div className="assistant__log" aria-live="polite">
        {messages.length === 0 && (
          <div className="assistant__empty stack-3">
            <p className="muted">Ask Moss anything about AFK.exe, local AI, or a quick dev question.</p>
            <div className="chips">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="chip" disabled={diagnostics.connection !== 'ready'} onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble--${m.role}`}>
            {m.content || (busy && i === messages.length - 1 ? <span className="muted">Thinking…</span> : null)}
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && (
        <p className="error-text small" role="alert">
          {error}
        </p>
      )}
      <OllamaSetupHelp connection={diagnostics.connection} model={diagnostics.model} />
      <form
        className="assistant__form"
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message Moss…" aria-label="Message" maxLength={1500} />
        {busy ? (
          <button type="button" className="icon-btn icon-btn--solid" onClick={() => controller.current?.abort()} aria-label="Stop">
            <Square size={15} />
          </button>
        ) : (
          <button type="submit" className="icon-btn icon-btn--solid" disabled={!input.trim() || diagnostics.connection !== 'ready'} aria-label="Send">
            <ArrowUp size={17} />
          </button>
        )}
      </form>
    </div>
  )
}
