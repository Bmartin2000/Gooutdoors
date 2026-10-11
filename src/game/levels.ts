import type { ToolId } from './types.ts'

export interface LevelInfo {
  level: number
  name: string
  minXp: number
}

export const LEVELS: LevelInfo[] = [
  { level: 1, name: 'Intern', minXp: 0 },
  { level: 2, name: 'Junior', minXp: 150 },
  { level: 3, name: 'Mid-level', minXp: 400 },
  { level: 4, name: 'Senior', minXp: 800 },
  { level: 5, name: 'Staff', minXp: 1400 },
]

export function levelForXp(xp: number): LevelInfo {
  let current = LEVELS[0]
  for (const info of LEVELS) if (xp >= info.minXp) current = info
  return current
}

export function levelProgress(xp: number): { current: LevelInfo; next: LevelInfo | null; ratio: number } {
  const current = levelForXp(xp)
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null
  if (!next) return { current, next: null, ratio: 1 }
  return { current, next, ratio: Math.min(1, (xp - current.minXp) / (next.minXp - current.minXp)) }
}

export interface ToolInfo {
  id: ToolId
  name: string
  tagline: string
  minLevel: number
}

/** All tools use the same local model; a level unlocks a focused workflow, not a smarter model. */
export const TOOLS: ToolInfo[] = [
  { id: 'assistant', name: 'Assistant', tagline: 'Ask Moss a quick question.', minLevel: 1 },
  { id: 'debugger', name: 'AI Debugger', tagline: 'Paste code + symptom → suspected cause and fix.', minLevel: 2 },
  { id: 'optimizer', name: 'Code Optimizer', tagline: 'Complexity and refactoring suggestions.', minLevel: 3 },
  { id: 'test-generator', name: 'Test Generator', tagline: 'Vitest cases for your function, edge cases first.', minLevel: 4 },
]

export function getTool(id: ToolId): ToolInfo {
  return TOOLS.find((t) => t.id === id)!
}
