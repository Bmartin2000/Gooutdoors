import { useCallback, useRef, useState } from 'react'
import { chat, type ChatMessage } from '../lib/ollama.ts'

export function useOllamaChat(systemPrompt: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (content: string) => {
      const text = content.trim()
      if (!text || isStreaming) return

      const history: ChatMessage[] = [...messages, { role: 'user', content: text }]
      setMessages([...history, { role: 'assistant', content: '' }])
      setError(null)
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        await chat([{ role: 'system', content: systemPrompt }, ...history], {
          signal: controller.signal,
          onToken: (token) =>
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              next[next.length - 1] = { ...last, content: last.content + token }
              return next
            }),
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : String(err))
          // Az üres asszisztens-buborék eltávolítása hiba esetén
          setMessages((prev) => (prev.at(-1)?.content ? prev : prev.slice(0, -1)))
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [messages, isStreaming, systemPrompt],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])
  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
  }, [])

  return { messages, isStreaming, error, send, stop, reset }
}
