import type { ToolId } from './types.ts'

export interface LevelInfo {
  level: number
  name: string
  minXp: number
}

/** A full career: ten titles, from your first ticket to Distinguished Engineer. */
export const LEVELS: LevelInfo[] = [
  { level: 1, name: 'Intern', minXp: 0 },
  { level: 2, name: 'Junior Developer', minXp: 150 },
  { level: 3, name: 'Developer', minXp: 400 },
  { level: 4, name: 'Mid-level Developer', minXp: 750 },
  { level: 5, name: 'Senior Developer', minXp: 1200 },
  { level: 6, name: 'Senior II', minXp: 1800 },
  { level: 7, name: 'Lead Developer', minXp: 2600 },
  { level: 8, name: 'Staff Engineer', minXp: 3600 },
  { level: 9, name: 'Principal Engineer', minXp: 4800 },
  { level: 10, name: 'Distinguished Engineer', minXp: 6300 },
]

export const MAX_LEVEL = LEVELS.length

function masteryLevel(level: number): LevelInfo {
  const rank = level - MAX_LEVEL
  return { level, name: `Distinguished · mastery ${rank}`, minXp: 6300 + 1700 * rank + 150 * rank * (rank - 1) }
}

export function levelForXp(xp: number): LevelInfo {
  let current = LEVELS[0]
  for (const info of LEVELS) if (xp >= info.minXp) current = info
  while (current.level >= MAX_LEVEL && xp >= masteryLevel(current.level + 1).minXp) current = masteryLevel(current.level + 1)
  return current
}

export function levelProgress(xp: number): { current: LevelInfo; next: LevelInfo | null; ratio: number } {
  const current = levelForXp(xp)
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? masteryLevel(current.level + 1)
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
  { id: 'optimizer', name: 'Code Optimizer', tagline: 'Complexity and refactoring suggestions.', minLevel: 4 },
  { id: 'test-generator', name: 'Test Generator', tagline: 'Vitest cases for your function, edge cases first.', minLevel: 6 },
]

export function getTool(id: ToolId): ToolInfo {
  return TOOLS.find((t) => t.id === id)!
}
