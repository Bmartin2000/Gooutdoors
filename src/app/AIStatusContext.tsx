import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { checkDiagnostics, OLLAMA_MODEL, type AIDiagnostics } from '../ai/ollamaClient.ts'

interface AIStatusValue {
  diagnostics: AIDiagnostics
  recheck: () => Promise<AIDiagnostics>
  /** Loads the model into memory ahead of time so the first real request is faster. */
  warmUp: () => void
  warm: 'idle' | 'warming' | 'warm'
}

const initial: AIDiagnostics = {
  connection: 'checking',
  version: null,
  model: OLLAMA_MODEL,
  modelSize: null,
  capabilities: [],
  checkedAt: new Date(0).toISOString(),
  detail: null,
}

const AIStatusContext = createContext<AIStatusValue | null>(null)

export function AIStatusProvider({ children }: { children: ReactNode }) {
  const [diagnostics, setDiagnostics] = useState<AIDiagnostics>(initial)
  const [warm, setWarm] = useState<'idle' | 'warming' | 'warm'>('idle')
  const warmRef = useRef(warm)
  useEffect(() => {
    warmRef.current = warm
  }, [warm])

  // Only the computer that serves AFK.exe locally can reach Ollama. Anywhere else (a phone
  // on the LAN, the installed phone app on GitHub Pages) is a capture device: never probe.
  const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)

  const recheck = useCallback(async () => {
    if (!isLocalHost) {
      const remote: AIDiagnostics = { ...initial, connection: 'remote-device', checkedAt: new Date().toISOString(), detail: 'This device captures walks and photos. The local AI runs on your desk computer.' }
      setDiagnostics(remote)
      return remote
    }
    const next = await checkDiagnostics()
    setDiagnostics(next)
    return next
  }, [isLocalHost])

  useEffect(() => {
    void recheck()
    if (!isLocalHost) return
    const tick = () => {
      if (document.visibilityState === 'visible') void recheck()
    }
    const id = window.setInterval(tick, 20_000)
    window.addEventListener('online', tick)
    window.addEventListener('offline', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('online', tick)
      window.removeEventListener('offline', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [recheck, isLocalHost])

  const warmUp = useCallback(() => {
    if (warmRef.current !== 'idle' || diagnostics.connection !== 'ready') return
    setWarm('warming')
    // Ollama loads a model when it receives a chat request with no messages.
    fetch('/ollama/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages: [], keep_alive: '20m' }),
    })
      .then((res) => setWarm(res.ok ? 'warm' : 'idle'))
      .catch(() => setWarm('idle'))
  }, [diagnostics.connection])

  const value = useMemo(() => ({ diagnostics, recheck, warmUp, warm }), [diagnostics, recheck, warmUp, warm])
  return <AIStatusContext.Provider value={value}>{children}</AIStatusContext.Provider>
}

export function useAIStatus(): AIStatusValue {
  const ctx = useContext(AIStatusContext)
  if (!ctx) throw new Error('useAIStatus outside AIStatusProvider')
  return ctx
}
