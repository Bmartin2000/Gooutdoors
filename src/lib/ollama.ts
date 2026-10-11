/**
 * Minimális, függőségmentes kliens a helyi Ollama REST API-hoz.
 * Dokumentáció: https://github.com/ollama/ollama/blob/main/docs/api.md
 *
 * A kérések a Vite proxy-n (/ollama) keresztül mennek a helyi szerverre,
 * semmilyen adat nem hagyja el a gépet.
 */

export const OLLAMA_BASE_URL = '/ollama'
export const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'qwen3.5:4b'
export const OLLAMA_THINK = import.meta.env.VITE_OLLAMA_THINK === 'true'

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

interface ChatChunk {
  message?: { role: ChatRole; content: string; thinking?: string }
  done: boolean
  error?: string
}

export interface ChatOptions {
  model?: string
  think?: boolean
  signal?: AbortSignal
  onToken?: (token: string) => void
}

export class OllamaError extends Error {}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(`${OLLAMA_BASE_URL}${path}`, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new OllamaError('Az Ollama szerver nem érhető el. Fut az „ollama serve”?')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 404 && text.includes('not found')) {
      throw new OllamaError(`A modell nincs letöltve. Futtasd: ollama pull ${OLLAMA_MODEL}`)
    }
    if (res.status >= 500 && !text) {
      throw new OllamaError('Az Ollama szerver nem érhető el. Fut az „ollama serve”?')
    }
    throw new OllamaError(text || `Ollama hiba (${res.status})`)
  }
  return res
}

/** Ellenőrzi, hogy fut-e az Ollama és le van-e töltve a modell. */
export async function checkOllama(model = OLLAMA_MODEL): Promise<{ version: string; hasModel: boolean }> {
  const [versionRes, tagsRes] = await Promise.all([request('/api/version'), request('/api/tags')])
  const { version } = (await versionRes.json()) as { version: string }
  const { models } = (await tagsRes.json()) as { models: { name: string }[] }
  return { version, hasModel: models.some((m) => m.name === model) }
}

/**
 * Streamelt chat: a tokeneket az onToken callbacken adja vissza,
 * a teljes választ pedig a Promise eredményeként.
 */
export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const res = await request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify({
      model: options.model ?? OLLAMA_MODEL,
      messages,
      stream: true,
      think: options.think ?? OLLAMA_THINK,
    }),
  })

  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let full = ''

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const chunk = JSON.parse(line) as ChatChunk
      if (chunk.error) throw new OllamaError(chunk.error)
      const token = chunk.message?.content ?? ''
      if (token) {
        full += token
        options.onToken?.(token)
      }
    }
  }
  return full
}
