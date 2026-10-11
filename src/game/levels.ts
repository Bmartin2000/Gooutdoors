import type { RoomStage, ToolId } from './types.ts'

export interface LevelInfo {
  level: number
  name: string
  minXp: number
  roomStage: RoomStage
  description: string
}

export const LEVELS: LevelInfo[] = [
  { level: 1, name: 'Cold Start', minXp: 0, roomStage: 0, description: 'Graphite walls, one desk, a quiet bot.' },
  { level: 2, name: 'First Growth', minXp: 250, roomStage: 1, description: 'A seedling and the first warm daylight.' },
  { level: 3, name: 'New Patterns', minXp: 500, roomStage: 2, description: 'Leaf shadows and greenery climb the walls.' },
  { level: 4, name: 'Living System', minXp: 750, roomStage: 3, description: 'A lush, golden-hour biophilic studio.' },
]

export function levelForXp(xp: number): LevelInfo {
  let current = LEVELS[0]
  for (const info of LEVELS) if (xp >= info.minXp) current = info
  return current
}

/** Progress (0–1) toward the next level; 1 at max level. */
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
  unlockedBy: string | null
}

export const TOOLS: ToolInfo[] = [
  { id: 'assistant', name: 'Assistant', tagline: 'Ask about AFK.exe, local AI or a quick dev question.', unlockedBy: null },
  { id: 'debugger', name: 'AI Debugger', tagline: 'Paste code, describe the symptom, get a suspected cause and a fix.', unlockedBy: 'broken-counter' },
  { id: 'optimizer', name: 'Code Optimizer', tagline: 'Complexity, readability and refactoring suggestions.', unlockedBy: 'slow-duplicates' },
  { id: 'test-generator', name: 'Test Generator', tagline: 'Vitest test cases for your function, edge cases first.', unlockedBy: 'leap-year-tests' },
]

export function getTool(id: ToolId): ToolInfo {
  return TOOLS.find((t) => t.id === id)!
}
