/**
 * Authored contracts, coding challenges and outdoor missions.
 *
 * Every challenge choice is evaluated by authored, deterministic code in this file.
 * Nothing here executes user-provided or model-provided code.
 */
import type { CaseResult, Contract, OutdoorMission } from '../game/types.ts'

const fmt = (value: unknown): string => {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

function runCases<A extends unknown[], R>(
  impl: (...args: A) => R,
  cases: { label: string; args: A; expected: R }[],
): CaseResult[] {
  return cases.map(({ label, args, expected }) => {
    let actual: unknown
    try {
      actual = impl(...args)
    } catch (error) {
      actual = error instanceof Error ? error : new Error(String(error))
    }
    return { label, expected: fmt(expected), actual: fmt(actual), pass: Object.is(actual, expected) }
  })
}

/* ───────────────────────── Contract 1 · The Broken Counter ───────────────────────── */

type Task = { title: string; done: boolean }

const counterCases: { label: string; args: [Task[]]; expected: number }[] = [
  { label: 'countDone([])', args: [[]], expected: 0 },
  { label: 'countDone([✓])', args: [[{ title: 'ship', done: true }]], expected: 1 },
  {
    label: 'countDone([✓, ✗, ✓])',
    args: [
      [
        { title: 'design', done: true },
        { title: 'review', done: false },
        { title: 'deploy', done: true },
      ],
    ],
    expected: 2,
  },
]

/** Faithful runtime equivalents of each authored choice (indexing past the end throws like the real code). */
function countFrom(start: number, inclusiveEnd: boolean, optional: boolean) {
  return (tasks: Task[]) => {
    let count = 0
    const end = inclusiveEnd ? tasks.length : tasks.length - 1
    for (let i = start; i <= end; i++) {
      const task = tasks[i] as Task | undefined
      if (optional ? task?.done : (task as Task).done) count++
    }
    return count
  }
}

/* ───────────────────────── Contract 2 · The Slow Duplicate Check ───────────────────────── */

const dupCases = (): { label: string; args: [string[]]; expected: boolean }[] => [
  { label: "hasDuplicates(['a','b','c'])", args: [['a', 'b', 'c']], expected: false },
  { label: "hasDuplicates(['a','b','a'])", args: [['a', 'b', 'a']], expected: true },
  { label: 'hasDuplicates([])', args: [[]], expected: false },
]

/** Wraps an implementation and adds a "does not mutate its input" check. */
function withPurityCheck(impl: (ids: string[]) => boolean): () => CaseResult[] {
  return () => {
    const results = runCases(impl, dupCases())
    const input = ['c', 'a', 'b']
    const before = input.join(',')
    impl(input)
    const after = input.join(',')
    results.push({ label: 'input left untouched', expected: before, actual: after, pass: before === after })
    return results
  }
}

/* ───────────────────────── Contract 3 · Test the Wild ───────────────────────── */

const buggyIsLeapYear = (year: number) => year % 4 === 0
const correctIsLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

function testCaseProbe(year: number): () => CaseResult[] {
  return () => {
    const expected = correctIsLeapYear(year)
    const onBuggy = buggyIsLeapYear(year) === expected
    const onFixed = correctIsLeapYear(year) === expected
    return [
      {
        label: `Run against the buggy code (returns ${fmt(buggyIsLeapYear(year))})`,
        expected: 'test fails',
        actual: onBuggy ? 'test passes' : 'test fails',
        pass: !onBuggy,
      },
      {
        label: `Run against the fixed code (returns ${fmt(correctIsLeapYear(year))})`,
        expected: 'test passes',
        actual: onFixed ? 'test passes' : 'test fails',
        pass: onFixed,
      },
      {
        label: 'Catches the bug?',
        expected: 'yes',
        actual: onBuggy ? 'no — the bug slips through' : 'yes',
        pass: !onBuggy,
      },
    ]
  }
}

/* ───────────────────────── Missions ───────────────────────── */

const SAFETY = [
  'Stay on public paths and places you are allowed to be — no trespassing.',
  'Keep away from traffic, water edges, rail lines, construction sites and steep ground.',
  'Look, don’t pick: leave plants, fungi and animals as you found them.',
  'A balcony, courtyard, garden or a view from a window counts. You never need to go far.',
]

export const MISSIONS: OutdoorMission[] = [
  {
    id: 'natures-debugger',
    title: 'Nature’s Debugger',
    theme: 'Living things patch broken systems.',
    variants: [
      {
        id: 'crack-growth',
        title: 'Growth through a crack',
        instruction: 'Find something growing through or around a crack — nature repairing a broken system.',
        visualCriteria:
          'a living plant, grass, weed or moss growing in, through, or right next to a crack, gap or seam in a built surface such as pavement, asphalt, a wall, steps or a curb',
        urbanFriendly: true,
      },
      {
        id: 'green-signal',
        title: 'Any green signal',
        instruction: 'Photograph one living plant — a street weed, a tree, a leaf or a balcony plant all count.',
        visualCriteria:
          'real living plants (a tree, shrub, weed, grass, moss, leaf or flower) clearly visible as a main subject of a real photograph — any distance is fine, it does not need to be a close-up',
        urbanFriendly: true,
      },
    ],
    safety: SAFETY,
  },
  {
    id: 'pattern-hunter',
    title: 'Pattern Hunter',
    theme: 'Nature repeats what works.',
    variants: [
      {
        id: 'natural-pattern',
        title: 'Repeating pattern',
        instruction: 'Find a natural repeating pattern — leaf veins, tree bark, petals or a pine cone.',
        visualCriteria:
          'a natural object showing a clearly repeating or self-similar pattern, such as leaf veins, bark texture, petals, a pine cone, a fern, seeds or a succulent rosette',
        urbanFriendly: true,
      },
      {
        id: 'symmetry',
        title: 'Natural symmetry',
        instruction: 'Photograph a single leaf or flower so its symmetry is easy to see.',
        visualCriteria: 'a single leaf or flower, roughly centered, whose natural symmetry is visible',
        urbanFriendly: true,
      },
    ],
    safety: SAFETY,
  },
  {
    id: 'test-the-wild',
    title: 'Test the Wild',
    theme: 'Compare two cases, find the difference.',
    variants: [
      {
        id: 'side-by-side',
        title: 'Side-by-side test',
        instruction: 'Find two different leaves and photograph them side by side — nature’s comparison test.',
        visualCriteria:
          'at least two leaves, petals or flowers shown together that visibly differ in shape, size or color',
        urbanFriendly: true,
      },
      {
        id: 'weathered',
        title: 'Weather-tested',
        instruction: 'Photograph something natural that has been tested by weather — bark, a fallen leaf or lichen.',
        visualCriteria:
          'a natural object visibly shaped by weather or time, such as a fallen or dried leaf, cracked bark, lichen on stone or wood, or a weathered branch',
        urbanFriendly: true,
      },
    ],
    safety: SAFETY,
  },
]

/* ───────────────────────── Contracts ───────────────────────── */

export const CONTRACTS: Contract[] = [
  {
    id: 'broken-counter',
    order: 1,
    title: 'Bug Fix: The Broken Counter',
    client: 'Fieldnote — a tiny task app',
    difficulty: 'Warm-up',
    estimate: '≈ 90 seconds',
    story:
      'Fieldnote’s progress badge crashes for anyone with exactly one task. The client needs the counter fixed before their morning release.',
    challenge: {
      brief: 'countDone() should return how many tasks are marked done.',
      language: 'TypeScript',
      fileName: 'progress.ts',
      code: `type Task = { title: string; done: boolean }

// Returns how many tasks are done.
export function countDone(tasks: Task[]): number {
  let count = 0
  for (let i = 1; i <= tasks.length; i++) {
    if (tasks[i].done) count++
  }
  return count
}`,
      focusLines: [6, 7],
      question: 'Which change fixes the loop?',
      choices: [
        {
          id: 'a',
          label: 'Start at 0 and stop before the length',
          code: 'for (let i = 0; i < tasks.length; i++)',
          evaluate: () => runCases(countFrom(0, false, false), counterCases),
          feedback: 'Arrays are zero-indexed: valid indexes run from 0 to length − 1. Every task is visited exactly once.',
        },
        {
          id: 'b',
          label: 'Keep i = 1, but use i < tasks.length',
          code: 'for (let i = 1; i < tasks.length; i++)',
          evaluate: () => runCases(countFrom(1, false, false), counterCases),
          feedback: 'The crash is gone, but the first task (index 0) is still skipped — the count is quietly wrong.',
        },
        {
          id: 'c',
          label: 'Guard the access with optional chaining',
          code: 'if (tasks[i]?.done) count++',
          evaluate: () => runCases(countFrom(1, true, true), counterCases),
          feedback: 'Optional chaining hides the symptom (the TypeError) but the loop still starts at 1 and misses a task.',
        },
        {
          id: 'd',
          label: 'Start at 0, keep i <= tasks.length',
          code: 'for (let i = 0; i <= tasks.length; i++)',
          evaluate: () => runCases(countFrom(0, true, false), counterCases),
          feedback: 'Now index 0 is counted, but i === length still reads one past the end and throws.',
        },
      ],
      correctChoiceId: 'a',
      lesson:
        'Off-by-one errors hide at boundaries. Test the empty case, the single-item case and a typical case — that trio catches most of them.',
    },
    missionId: 'natures-debugger',
    reward: { xp: 250, toolId: 'debugger', achievement: 'First Growth' },
  },
  {
    id: 'slow-duplicates',
    order: 2,
    title: 'Refactor: The Slow Duplicate Check',
    client: 'Trailhead — an event check-in kiosk',
    difficulty: 'Easy',
    estimate: '≈ 2 minutes',
    story:
      'Trailhead’s kiosk freezes when 20,000 hikers check in. Their duplicate-ID check is quadratic. Pick the refactor that stays correct and scales.',
    challenge: {
      brief: 'hasDuplicates() must keep its behaviour, avoid O(n²) work and must not mutate the caller’s array.',
      language: 'TypeScript',
      fileName: 'checkin.ts',
      code: `export function hasDuplicates(ids: string[]): boolean {
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (ids[i] === ids[j]) return true
    }
  }
  return false
}`,
      focusLines: [2, 3, 4],
      question: 'Which refactor should ship?',
      choices: [
        {
          id: 'a',
          label: 'Compare a Set’s size with the array length',
          code: 'return new Set(ids).size !== ids.length',
          evaluate: withPurityCheck((ids) => new Set(ids).size !== ids.length),
          feedback: 'One pass, O(n) time, input untouched. A Set keeps only unique values, so a smaller size means a duplicate.',
        },
        {
          id: 'b',
          label: 'Sort, then compare neighbours',
          code: 'ids.sort()\nreturn ids.some((id, i) => id === ids[i + 1])',
          evaluate: withPurityCheck((ids) => {
            ids.sort()
            return ids.some((id, i) => id === ids[i + 1])
          }),
          feedback: 'Correct answers and O(n log n), but Array.prototype.sort reorders the caller’s array in place — a hidden side effect.',
        },
        {
          id: 'c',
          label: 'Use indexOf inside some()',
          code: 'return ids.some((id, i) => ids.indexOf(id) !== i)',
          evaluate: withPurityCheck((ids) => ids.some((id, i) => ids.indexOf(id) !== i)),
          feedback: 'Every test passes — but indexOf scans the array on each step, so this is still O(n²). Tests alone did not catch the real problem.',
        },
        {
          id: 'd',
          label: 'Compare a Set’s size, flipped',
          code: 'return new Set(ids).size === ids.length',
          evaluate: withPurityCheck((ids) => new Set(ids).size === ids.length),
          feedback: 'Fast, but the comparison is inverted: it returns true when every ID is unique.',
        },
      ],
      correctChoiceId: 'a',
      lesson:
        'Refactors must preserve behaviour, side effects and intent. Passing tests are necessary, not sufficient — complexity and mutation matter too.',
    },
    missionId: 'pattern-hunter',
    reward: { xp: 250, toolId: 'optimizer', achievement: 'New Patterns' },
  },
  {
    id: 'leap-year-tests',
    order: 3,
    title: 'Tests: The Leap Year That Wasn’t',
    client: 'Almanac — a habit-tracking calendar',
    difficulty: 'Moderate',
    estimate: '≈ 2 minutes',
    story:
      'Almanac’s calendar will show February 29, 2100 — a day that won’t exist. Before fixing it, the client wants one regression test that proves the bug.',
    challenge: {
      brief: 'The buggy isLeapYear() ignores the century rule. Pick the single test that fails on this code.',
      language: 'TypeScript',
      fileName: 'calendar.ts',
      code: `// Gregorian rule: divisible by 4, except centuries,
// unless the century is divisible by 400.
export const isLeapYear = (year: number): boolean =>
  year % 4 === 0`,
      focusLines: [4],
      question: 'Which test catches the bug?',
      choices: [
        {
          id: 'a',
          label: 'A normal leap year',
          code: 'expect(isLeapYear(2024)).toBe(true)',
          evaluate: testCaseProbe(2024),
          feedback: '2024 is a leap year under both the buggy and the correct rule, so this test passes and proves nothing.',
        },
        {
          id: 'b',
          label: 'A common year',
          code: 'expect(isLeapYear(2023)).toBe(false)',
          evaluate: testCaseProbe(2023),
          feedback: '2023 isn’t divisible by 4 — both versions agree. A useful sanity test, but not a regression test for this bug.',
        },
        {
          id: 'c',
          label: 'A century year',
          code: 'expect(isLeapYear(1900)).toBe(false)',
          evaluate: testCaseProbe(1900),
          feedback: '1900 is divisible by 4 but is a century not divisible by 400, so it is not a leap year. The buggy code says it is — caught.',
        },
        {
          id: 'd',
          label: 'A 400-year century',
          code: 'expect(isLeapYear(2000)).toBe(true)',
          evaluate: testCaseProbe(2000),
          feedback: '2000 is a leap year under both rules (divisible by 400), so the buggy code happens to pass.',
        },
      ],
      correctChoiceId: 'c',
      lesson: 'A good regression test lives exactly where the buggy and correct behaviour disagree — usually at the edge of a rule.',
    },
    missionId: 'test-the-wild',
    reward: { xp: 250, toolId: 'test-generator', achievement: 'Living System' },
  },
]

export function getContract(id: string): Contract | undefined {
  return CONTRACTS.find((c) => c.id === id)
}

export function getMission(id: string): OutdoorMission | undefined {
  return MISSIONS.find((m) => m.id === id)
}

export function getVariant(missionId: string, variantId: string | undefined) {
  const mission = getMission(missionId)
  return mission?.variants.find((v) => v.id === variantId) ?? mission?.variants[0]
}

export function contractForMission(missionId: string): Contract | undefined {
  return CONTRACTS.find((c) => c.missionId === missionId)
}
