import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useOllamaChat } from '../hooks/useOllamaChat.ts'
import { OLLAMA_MODEL } from '../lib/ollama.ts'
import { OUTDOOR_SYSTEM_PROMPT } from '../lib/prompts.ts'

const SUGGESTIONS = [
  'Tervezz egy egynapos, kezdőbarát túrát a Pilisbe!',
  'Mit vigyek egy kétnapos sátras túrára ősszel?',
  'Milyen ingyenes, nyílt térképeket használhatok túrázáshoz?',
]

export default function AssistantPage() {
  const { messages, isStreaming, error, send, stop, reset } = useOllamaChat(OUTDOOR_SYSTEM_PROMPT)
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
    setInput('')
  }

  return (
    <section className="chat">
      <header className="chat__header">
        <div>
          <h1>Túraasszisztens</h1>
          <p className="muted">Helyi modell: {OLLAMA_MODEL} · Ollama</p>
        </div>
        {messages.length > 0 && (
          <button type="button" className="button button--ghost" onClick={reset}>
            Új beszélgetés
          </button>
        )}
      </header>

      <div className="chat__log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat__empty">
            <p>Kérdezz bármit túrákról, felszerelésről vagy útvonalakról!</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble--${m.role}`}>
            {m.content ||
              (isStreaming && i === messages.length - 1 ? <span className="typing">Gondolkodom…</span> : null)}
          </div>
        ))}
        {error && (
          <div className="chat__error" role="alert">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="chat__form" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pl. Hova menjek hétvégén kirándulni Budapest környékén?"
          aria-label="Üzenet"
        />
        {isStreaming ? (
          <button type="button" className="button" onClick={stop}>
            Leállítás
          </button>
        ) : (
          <button type="submit" className="button" disabled={!input.trim()}>
            Küldés
          </button>
        )}
      </form>
    </section>
  )
}
