import { useEffect, useState } from 'react'
import type { AppSettings } from '../game/types.ts'

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Resolves theme/motion settings against OS preferences and applies them to <html>. */
export function usePreferences(settings: AppSettings) {
  const prefersLight = useMedia('(prefers-color-scheme: light)')
  const prefersReduced = useMedia('(prefers-reduced-motion: reduce)')
  const theme = settings.theme === 'system' ? (prefersLight ? 'light' : 'dark') : settings.theme
  const reducedMotion = settings.motion === 'reduced' || (settings.motion === 'system' && prefersReduced)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f0e9' : '#0d0e0d')
  }, [theme, reducedMotion])

  return { theme, reducedMotion }
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
