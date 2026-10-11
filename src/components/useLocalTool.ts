import { useCallback, useEffect, useRef, useState } from 'react'
import { OllamaError, type ChatProgress } from '../ai/ollamaClient.ts'

export type ToolState<T> =
  | { kind: 'idle' }
  | { kind: 'running'; progress: ChatProgress | null }
  | { kind: 'done'; result: T; seconds: number }
  | { kind: 'error'; message: string }

/** Runs one local-model task at a time with progress, cancellation and readable errors. */
export function useLocalTool<I, T>(runner: (input: I, opts: { signal: AbortSignal; onProgress: (p: ChatProgress) => void }) => Promise<T>) {
  const [state, setState] = useState<ToolState<T>>({ kind: 'idle' })
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const run = useCallback(
    async (input: I) => {
      controller.current?.abort()
      const c = new AbortController()
      controller.current = c
      const started = performance.now()
      setState({ kind: 'running', progress: null })
      try {
        const result = await runner(input, { signal: c.signal, onProgress: (progress) => setState({ kind: 'running', progress }) })
        if (controller.current === c) setState({ kind: 'done', result, seconds: Math.round((performance.now() - started) / 1000) })
      } catch (error) {
        if (controller.current !== c) return
        if (error instanceof OllamaError && error.code === 'aborted') setState({ kind: 'idle' })
        else setState({ kind: 'error', message: error instanceof Error ? error.message : 'Unexpected error.' })
      } finally {
        if (controller.current === c) controller.current = null
      }
    },
    [runner],
  )

  const cancel = useCallback(() => controller.current?.abort(), [])
  const reset = useCallback(() => {
    controller.current?.abort()
    setState({ kind: 'idle' })
  }, [])

  return { state, run, cancel, reset }
}
