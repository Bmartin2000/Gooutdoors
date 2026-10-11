import { useOutletContext } from 'react-router-dom'

export interface ShellContext {
  reducedMotion: boolean
}

export function useShell(): ShellContext {
  return useOutletContext<ShellContext>()
}
