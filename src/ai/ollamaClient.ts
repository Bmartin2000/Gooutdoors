/**
 * Browser-side client for the local Ollama HTTP API, reached through the same-origin
 * `/ollama` adapter (see server/localAdapter.ts). No other network destination is used.
 */

export const OLLAMA_MODEL: string = import.meta.env.VITE_OLLAMA_MODEL || 'qwen3.5:4b'
const BASE = '/ollama'

export type AIConnection = 'checking' | 'ready' | 'ollama-unavailable' | 'model-missing' | 'remote-device'

export interface AIDiagnostics {
  connection: AIConnection
  version: string | null
  model: string
  modelSize: number | null
  capabilities: string[]
  checkedAt: string
  detail: string | null
}

export type OllamaErrorCode =
  | 'unreachable'
  | 'remote-device'
  | 'model-missing'
  | 'timeout'
  | 'aborted'
  | 'server'
  | 'bad-response'

export class OllamaError extends Error {
  readonly code: OllamaErrorCode
  constructor(code: OllamaErrorCode, message: string) {
    super(message)
    this.name = 'OllamaError'
    this.code = code
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  /** Base64 images without data-URL prefix (Ollama multimodal input). */
  images?: string[]
}

export interface ChatProgress {
  phase: 'queued' | 'reading' | 'writing'
  tokens: number
  elapsedMs: number
}

export interface ChatRequest {
  messages: ChatMessage[]
  format?: object
  temperature?: number
  signal?: AbortSignal
  timeoutMs: number
  onProgress?: (p: ChatProgress) => void
  onToken?: (token: string) => void
  numPredict?: number
}

export interface ChatResponse {
  content: string
  model: string
  evalCount: number
  durationMs: number
}

async function errorFromResponse(res: Response): Promise<OllamaError> {
  const text = await res.text().catch(() => '')
  if (res.status === 403 && text.includes('afk-remote-client')) {
    return new OllamaError('remote-device', 'Local AI runs on the computer that hosts AFK.exe, not on this device.')
  }
  if (res.status === 404 && /model .*not found|not found, try pulling/i.test(text)) {
    return new OllamaError('model-missing', `Model ${OLLAMA_MODEL} is not installed. Run: ollama pull ${OLLAMA_MODEL}`)
  }
  if (res.status === 502 || res.status === 504) {
    return new OllamaError('unreachable', 'Ollama is not answering on this computer. Start it with: ollama serve')
  }
  let message = text
  try {
    message = (JSON.parse(text) as { error?: string }).error ?? text
  } catch {
    /* plain text */
  }
  return new OllamaError('server', message ? `Ollama error: ${message.slice(0, 300)}` : `Ollama error (${res.status})`)
}

export async function checkDiagnostics(): Promise<AIDiagnostics> {
  const base: AIDiagnostics = {
    connection: 'ollama-unavailable',
    version: null,
    model: OLLAMA_MODEL,
    modelSize: null,
    capabilities: [],
    checkedAt: new Date().toISOString(),
    detail: null,
  }
  try {
    const signal = AbortSignal.timeout(5000)
    const versionRes = await fetch(`${BASE}/api/version`, { signal, cache: 'no-store' })
    if (!versionRes.ok) {
      const err = await errorFromResponse(versionRes)
      return { ...base, connection: err.code === 'remote-device' ? 'remote-device' : 'ollama-unavailable', detail: err.message }
    }
    if (!(versionRes.headers.get('content-type') ?? '').includes('json')) {
      // e.g. a static host without the AFK.exe adapter answered with index.html
      return { ...base, detail: 'This server has no local AI adapter. Run AFK.exe with npm run dev or npm start.' }
    }
    const { version } = (await versionRes.json()) as { version: string }
    const tagsRes = await fetch(`${BASE}/api/tags`, { signal, cache: 'no-store' })
    const { models } = (await tagsRes.json()) as { models: { name: string; model?: string; size: number }[] }
    const found = models.find((m) => m.name === OLLAMA_MODEL || m.model === OLLAMA_MODEL)
    if (!found) return { ...base, connection: 'model-missing', version, detail: `Run: ollama pull ${OLLAMA_MODEL}` }

    let capabilities: string[] = []
    try {
      const showRes = await fetch(`${BASE}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL }),
        signal,
      })
      if (showRes.ok) capabilities = ((await showRes.json()) as { capabilities?: string[] }).capabilities ?? []
    } catch {
      /* capabilities are informational only */
    }
    return { ...base, connection: 'ready', version, modelSize: found.size, capabilities }
  } catch (error) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    return {
      ...base,
      detail:
        error instanceof DOMException && error.name === 'TimeoutError'
          ? 'Ollama did not answer within 5 seconds.'
          : offline
            ? 'This device is offline and cannot reach the computer running Ollama.'
            : 'Could not reach the local AI adapter.',
    }
  }
}

/**
 * Streams a chat completion. Streaming is used even for JSON answers so CPU-only machines
 * can show honest progress (prompt reading vs. token writing) and support cancellation.
 */
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const started = performance.now()
  const timeout = AbortSignal.timeout(req.timeoutMs)
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout
  const elapsed = () => performance.now() - started

  req.onProgress?.({ phase: 'queued', tokens: 0, elapsedMs: 0 })

  let res: Response
  try {
    res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: req.messages,
        stream: true,
        think: false,
        keep_alive: '20m',
        ...(req.format ? { format: req.format } : {}),
        options: { temperature: req.temperature ?? 0.2, ...(req.numPredict ? { num_predict: req.numPredict } : {}) },
      }),
    })
  } catch (error) {
    throw mapAbort(error, timeout, req.timeoutMs) ?? new OllamaError('unreachable', 'Could not reach the local AI adapter.')
  }
  if (!res.ok || !res.body) throw await errorFromResponse(res)

  req.onProgress?.({ phase: 'reading', tokens: 0, elapsedMs: elapsed() })

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let content = ''
  let tokens = 0
  let model = OLLAMA_MODEL
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        let chunk: { message?: { content?: string }; done?: boolean; error?: string; model?: string }
        try {
          chunk = JSON.parse(line)
        } catch {
          throw new OllamaError('bad-response', 'Ollama sent an unreadable stream chunk.')
        }
        if (chunk.error) throw new OllamaError('server', `Ollama error: ${chunk.error}`)
        if (chunk.model) model = chunk.model
        const token = chunk.message?.content ?? ''
        if (token) {
          content += token
          tokens++
          req.onToken?.(token)
          req.onProgress?.({ phase: 'writing', tokens, elapsedMs: elapsed() })
        }
      }
    }
  } catch (error) {
    if (error instanceof OllamaError) throw error
    throw mapAbort(error, timeout, req.timeoutMs) ?? new OllamaError('unreachable', 'The connection to Ollama dropped.')
  } finally {
    reader.releaseLock()
  }

  if (!content.trim()) throw new OllamaError('bad-response', 'The model returned an empty answer.')
  return { content, model, evalCount: tokens, durationMs: elapsed() }
}

function mapAbort(error: unknown, timeout: AbortSignal, timeoutMs: number): OllamaError | null {
  if (!(error instanceof DOMException) && !(error instanceof Error && error.name === 'AbortError')) return null
  if (timeout.aborted) {
    return new OllamaError('timeout', `No complete answer within ${Math.round(timeoutMs / 1000)} s. On CPU-only machines the first request also loads the model — try again.`)
  }
  if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
    return new OllamaError('aborted', 'Cancelled.')
  }
  return null
}
