/**
 * Authored coding challenges. Job offers are generated from this pool.
 * Every choice is evaluated by authored, deterministic code in this file —
 * nothing here executes user-provided or model-provided code.
 */
import type { CaseResult, Challenge, SkillId } from '../game/types.ts'
import { generateChallenge } from './generators.ts'

export const SKILLS: { id: SkillId; name: string; short: string }[] = [
  { id: 'debugging', name: 'Debugging', short: 'DBG' },
  { id: 'typescript', name: 'TypeScript', short: 'TS' },
  { id: 'testing', name: 'Testing', short: 'TST' },
  { id: 'performance', name: 'Performance', short: 'PERF' },
  { id: 'async', name: 'Async', short: 'ASYNC' },
]

export const skillName = (id: SkillId) => SKILLS.find((s) => s.id === id)?.name ?? id

const fmt = (value: unknown): string => {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(fmt).join(', ')}]`
  if (value instanceof Promise) return '[object Promise]'
  return String(value)
}

function same(a: unknown, b: unknown) {
  return fmt(a) === fmt(b)
}

function runCases<A extends unknown[], R>(impl: (...args: A) => R, cases: { label: string; args: A; expected: R }[]): CaseResult[] {
  return cases.map(({ label, args, expected }) => {
    let actual: unknown
    try {
      actual = impl(...args)
    } catch (error) {
      actual = error instanceof Error ? error : new Error(String(error))
    }
    return { label, expected: fmt(expected), actual: fmt(actual), pass: same(actual, expected) }
  })
}

async function runAsyncCases<A extends unknown[], R>(impl: (...args: A) => Promise<R> | R, cases: { label: string; args: A; expected: R }[]): Promise<CaseResult[]> {
  const out: CaseResult[] = []
  for (const { label, args, expected } of cases) {
    let actual: unknown
    try {
      actual = await impl(...args)
    } catch (error) {
      actual = error instanceof Error ? error : new Error(String(error))
    }
    out.push({ label, expected: fmt(expected), actual: fmt(actual), pass: same(actual, expected) })
  }
  return out
}

/* ── 1 · off-by-one ─────────────────────────── */
type Task = { title: string; done: boolean }
const counterCases: { label: string; args: [Task[]]; expected: number }[] = [
  { label: 'countDone([])', args: [[]], expected: 0 },
  { label: 'countDone([✓])', args: [[{ title: 'ship', done: true }]], expected: 1 },
  { label: 'countDone([✓, ✗, ✓])', args: [[{ title: 'a', done: true }, { title: 'b', done: false }, { title: 'c', done: true }]], expected: 2 },
]
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

/* ── 2 · quadratic duplicates ───────────────── */
const dupCases = (): { label: string; args: [string[]]; expected: boolean }[] => [
  { label: "hasDuplicates(['a','b','c'])", args: [['a', 'b', 'c']], expected: false },
  { label: "hasDuplicates(['a','b','a'])", args: [['a', 'b', 'a']], expected: true },
  { label: 'hasDuplicates([])', args: [[]], expected: false },
]
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

/* ── 3 · leap-year regression test ──────────── */
const buggyIsLeapYear = (year: number) => year % 4 === 0
const correctIsLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
function testCaseProbe(year: number): () => CaseResult[] {
  return () => {
    const expected = correctIsLeapYear(year)
    const onBuggy = buggyIsLeapYear(year) === expected
    return [
      { label: `Against the buggy code (returns ${fmt(buggyIsLeapYear(year))})`, expected: 'test fails', actual: onBuggy ? 'test passes' : 'test fails', pass: !onBuggy },
      { label: `Against the fixed code (returns ${fmt(correctIsLeapYear(year))})`, expected: 'test passes', actual: 'test passes', pass: true },
      { label: 'Catches the bug?', expected: 'yes', actual: onBuggy ? 'no — the bug slips through' : 'yes', pass: !onBuggy },
    ]
  }
}

/* ── 4 · type guard ─────────────────────────── */
const guardCases: { label: string; args: [unknown]; expected: boolean }[] = [
  { label: 'isUser({ id: 7 })', args: [{ id: 7 }], expected: true },
  { label: 'isUser({ id: 0 })', args: [{ id: 0 }], expected: true },
  { label: 'isUser(null)', args: [null], expected: false },
  { label: 'isUser([])', args: [[]], expected: false },
  { label: "isUser({ id: '7' })", args: [{ id: '7' }], expected: false },
]

/* ── 5 · async forEach ──────────────────────── */
/** Like a real network call: resolves on a later timer tick, not immediately. */
const fetchName = (id: number) => new Promise<string>((resolve) => setTimeout(() => resolve(`user-${id}`), 2))
const asyncCases: { label: string; args: [number[]]; expected: string[] }[] = [
  { label: 'await loadNames([1, 2])', args: [[1, 2]], expected: ['user-1', 'user-2'] },
  { label: 'await loadNames([])', args: [[]], expected: [] },
]

/* ── 6 · closures in loops ──────────────────── */
function handlerResults(build: () => (() => number)[]): CaseResult[] {
  const handlers = build()
  return handlers.map((h, i) => ({ label: `handlers[${i}]()`, expected: String(i), actual: String(h()), pass: h() === i }))
}

/* ── 7 · memoised fibonacci ─────────────────── */
function fibProbe(make: (count: () => void) => (n: number) => number): () => CaseResult[] {
  return () => {
    let calls = 0
    const fib = make(() => calls++)
    const value = fib(25)
    return [
      { label: 'fib(25)', expected: '75025', actual: String(value), pass: value === 75025 },
      { label: 'calls to compute fib(25)', expected: '≤ 100', actual: calls.toLocaleString('en'), pass: calls <= 100 },
    ]
  }
}

/* ── 8 · float equality ─────────────────────── */
const total = 0.1 + 0.2
function assertionProbe(check: (actual: number, expected: number) => boolean): () => CaseResult[] {
  return () => [
    { label: 'expect(0.1 + 0.2) matches 0.3', expected: 'passes', actual: check(total, 0.3) ? 'passes' : 'fails', pass: check(total, 0.3) },
    { label: 'expect(0.1 + 0.2) matches 0.4', expected: 'fails', actual: check(total, 0.4) ? 'passes' : 'fails', pass: !check(total, 0.4) },
  ]
}

/* ── 9 · slugify regex ──────────────────────── */
const slugCases: { label: string; args: [string]; expected: string }[] = [
  { label: "slug('Hello World')", args: ['Hello World'], expected: 'hello-world' },
  { label: "slug('Touch  the grass today')", args: ['Touch  the grass today'], expected: 'touch-the-grass-today' },
]

/* ── 10 · numeric sort ──────────────────────── */
function sortProbe(impl: (nums: number[]) => number[]): () => CaseResult[] {
  return () => {
    const input = [10, 1, 9]
    let actual: unknown
    try {
      actual = impl(input)
    } catch (e) {
      actual = e
    }
    return [
      { label: 'sorted([10, 1, 9])', expected: '[1, 9, 10]', actual: fmt(actual), pass: fmt(actual) === '[1, 9, 10]' },
      { label: 'input left untouched', expected: '[10, 1, 9]', actual: fmt(input), pass: fmt(input) === '[10, 1, 9]' },
    ]
  }
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'broken-counter',
    title: 'The broken progress counter',
    brief: 'countDone() should return how many tasks are marked done. It crashes for anyone with exactly one task.',
    fileName: 'progress.ts',
    code: `type Task = { title: string; done: boolean }

export function countDone(tasks: Task[]): number {
  let count = 0
  for (let i = 1; i <= tasks.length; i++) {
    if (tasks[i].done) count++
  }
  return count
}`,
    focusLines: [5, 6],
    question: 'Which change fixes the loop?',
    choices: [
      { id: 'a', label: 'Start at 0, stop before the length', code: 'for (let i = 0; i < tasks.length; i++)', evaluate: () => runCases(countFrom(0, false, false), counterCases), feedback: 'Arrays are zero-indexed: valid indexes run from 0 to length − 1.' },
      { id: 'b', label: 'Keep i = 1, use i < tasks.length', code: 'for (let i = 1; i < tasks.length; i++)', evaluate: () => runCases(countFrom(1, false, false), counterCases), feedback: 'The crash is gone, but index 0 is still skipped — quietly wrong.' },
      { id: 'c', label: 'Guard with optional chaining', code: 'if (tasks[i]?.done) count++', evaluate: () => runCases(countFrom(1, true, true), counterCases), feedback: 'Hides the TypeError but the loop still starts at 1.' },
      { id: 'd', label: 'Start at 0, keep i <= length', code: 'for (let i = 0; i <= tasks.length; i++)', evaluate: () => runCases(countFrom(0, true, false), counterCases), feedback: 'Counts index 0, but still reads one past the end and throws.' },
    ],
    correctChoiceId: 'a',
    lesson: 'Test the empty case, the single-item case and a typical case — that trio catches most off-by-one bugs.',
    requires: {},
    trains: ['debugging'],
    minLevel: 1,
    difficulty: 1,
  },
  {
    id: 'trailing-slug',
    title: 'URLs with spaces in them',
    brief: 'slug() should turn any title into a lowercase, dash-separated URL slug.',
    fileName: 'slug.ts',
    code: `export const slug = (title: string) =>
  title.trim().toLowerCase().replace(' ', '-')`,
    focusLines: [2],
    question: 'Which replacement is right?',
    choices: [
      { id: 'a', label: 'Global whitespace regex', code: ".replace(/\\s+/g, '-')", evaluate: () => runCases((t: string) => t.trim().toLowerCase().replace(/\s+/g, '-'), slugCases), feedback: '\\s+ collapses any run of whitespace, and the g flag replaces every run.' },
      { id: 'b', label: 'Regex without the g flag', code: ".replace(/\\s+/, '-')", evaluate: () => runCases((t: string) => t.trim().toLowerCase().replace(/\s+/, '-'), slugCases), feedback: 'Without g, only the first match is replaced.' },
      { id: 'c', label: "Global single space", code: ".replace(/ /g, '-')", evaluate: () => runCases((t: string) => t.trim().toLowerCase().replace(/ /g, '-'), slugCases), feedback: 'Every space is replaced — so double spaces become double dashes.' },
      { id: 'd', label: 'split + join', code: ".split(' ').join('-')", evaluate: () => runCases((t: string) => t.trim().toLowerCase().split(' ').join('-'), slugCases), feedback: 'Same as replacing each single space: "touch--the".' },
    ],
    correctChoiceId: 'a',
    lesson: 'String.replace with a string pattern only replaces the first occurrence. Use a regex with /g (or replaceAll).',
    requires: {},
    trains: ['debugging'],
    minLevel: 1,
    difficulty: 1,
  },
  {
    id: 'type-guard',
    title: 'A type guard that lies',
    brief: 'isUser() must accept any object with a numeric id (including 0) and reject everything else.',
    fileName: 'guards.ts',
    code: `type User = { id: number }

export function isUser(v: unknown): v is User {
  return typeof v === 'object' && 'id' in v
}`,
    focusLines: [4],
    question: 'Which implementation is a correct guard?',
    choices: [
      { id: 'a', label: 'Check object, null, and the id type', code: "typeof v === 'object' && v !== null &&\n  !Array.isArray(v) && typeof (v as User).id === 'number'", evaluate: () => runCases((v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { id?: unknown }).id === 'number', guardCases), feedback: 'Covers null (typeof null is "object"), arrays, and the actual id type.' },
      { id: 'b', label: "Keep 'in', as is", code: "typeof v === 'object' && 'id' in v", evaluate: () => runCases((v: unknown) => typeof v === 'object' && 'id' in (v as object), guardCases), feedback: '"in" on null throws a TypeError, and a string id passes.' },
      { id: 'c', label: 'Truthy id', code: '!!(v as User)?.id', evaluate: () => runCases((v: unknown) => !!(v as { id?: unknown } | null)?.id, guardCases), feedback: 'id 0 is falsy, and "7" is truthy — both wrong.' },
      { id: 'd', label: 'instanceof Object', code: 'v instanceof Object', evaluate: () => runCases((v: unknown) => v instanceof Object, guardCases), feedback: 'Arrays and objects with any id pass.' },
    ],
    correctChoiceId: 'a',
    lesson: 'A type guard is a runtime promise to the compiler. Check null, arrays and the field types explicitly.',
    requires: { debugging: 1 },
    trains: ['typescript'],
    minLevel: 1,
    difficulty: 1,
  },
  {
    id: 'closure-loop',
    title: 'Every button says 3',
    brief: 'Each handler should return its own index, but they all return 3.',
    fileName: 'handlers.js',
    code: `const handlers = []
for (var i = 0; i < 3; i++) {
  handlers.push(() => i)
}`,
    focusLines: [2],
    question: 'Which fix gives each handler its own index?',
    choices: [
      { id: 'a', label: 'Use let in the loop', code: 'for (let i = 0; i < 3; i++)', evaluate: () => handlerResults(() => { const h: (() => number)[] = []; for (let i = 0; i < 3; i++) h.push(() => i); return h }), feedback: 'let creates a fresh binding per iteration, so each closure captures its own i.' },
      { id: 'b', label: 'Keep var, read i later', code: 'handlers.push(() => i) // var i', evaluate: () => handlerResults(() => { const h: (() => number)[] = []; let shared = 0; for (shared = 0; shared < 3; shared++) h.push(() => shared); return h }), feedback: 'All closures share one var binding, which ends at 3.' },
      { id: 'c', label: 'Store i in a const after the loop', code: 'const n = i // after the loop\nhandlers.push(() => n)', evaluate: () => handlerResults(() => { let shared = 0; for (shared = 0; shared < 3; shared++); const n = shared; return [() => n, () => n, () => n] }), feedback: 'After the loop i is already 3.' },
      { id: 'd', label: 'Wrap in setTimeout', code: 'setTimeout(() => handlers.push(() => i))', evaluate: () => handlerResults(() => { const h: (() => number)[] = []; let shared = 0; for (shared = 0; shared < 3; shared++); h.push(() => shared, () => shared, () => shared); return h }), feedback: 'Deferring makes it worse: by then the loop has finished.' },
    ],
    correctChoiceId: 'a',
    lesson: 'Closures capture bindings, not values. let gives each loop iteration its own binding.',
    requires: { debugging: 1 },
    trains: ['debugging'],
    minLevel: 1,
    difficulty: 1,
  },
  {
    id: 'slow-duplicates',
    title: 'The kiosk that freezes',
    brief: 'hasDuplicates() must keep its behaviour, avoid O(n²) work and not mutate the caller’s array.',
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
      { id: 'a', label: 'Set size vs. length', code: 'return new Set(ids).size !== ids.length', evaluate: withPurityCheck((ids) => new Set(ids).size !== ids.length), feedback: 'One pass, O(n), input untouched.' },
      { id: 'b', label: 'Sort, compare neighbours', code: 'ids.sort()\nreturn ids.some((id, i) => id === ids[i + 1])', evaluate: withPurityCheck((ids) => { ids.sort(); return ids.some((id, i) => id === ids[i + 1]) }), feedback: 'Correct answers, but sort() reorders the caller’s array in place.' },
      { id: 'c', label: 'indexOf inside some()', code: 'return ids.some((id, i) => ids.indexOf(id) !== i)', evaluate: withPurityCheck((ids) => ids.some((id, i) => ids.indexOf(id) !== i)), feedback: 'All tests pass — and it is still O(n²). Tests alone missed the real problem.' },
      { id: 'd', label: 'Set size, flipped', code: 'return new Set(ids).size === ids.length', evaluate: withPurityCheck((ids) => new Set(ids).size === ids.length), feedback: 'Fast, but inverted.' },
    ],
    correctChoiceId: 'a',
    lesson: 'Passing tests are necessary, not sufficient — complexity and side effects matter too.',
    requires: { debugging: 2 },
    trains: ['performance'],
    minLevel: 2,
    difficulty: 2,
  },
  {
    id: 'numeric-sort',
    title: 'Leaderboard in the wrong order',
    brief: 'sorted() must return the numbers ascending without touching the input.',
    fileName: 'leaderboard.ts',
    code: `export const sorted = (nums: number[]) => nums.sort()`,
    focusLines: [1],
    question: 'Which version is correct?',
    choices: [
      { id: 'a', label: 'Copy, numeric comparator', code: '[...nums].sort((a, b) => a - b)', evaluate: sortProbe((n) => [...n].sort((a, b) => a - b)), feedback: 'Copying keeps the input intact; a − b sorts numerically.' },
      { id: 'b', label: 'Numeric comparator in place', code: 'nums.sort((a, b) => a - b)', evaluate: sortProbe((n) => n.sort((a, b) => a - b)), feedback: 'Right order, but the caller’s array is mutated.' },
      { id: 'c', label: 'Copy, default sort', code: '[...nums].sort()', evaluate: sortProbe((n) => [...n].sort()), feedback: 'Default sort compares strings: "10" sorts before "9".' },
      { id: 'd', label: 'Copy and reverse', code: '[...nums].reverse()', evaluate: sortProbe((n) => [...n].reverse()), feedback: 'Reversing is not sorting.' },
    ],
    correctChoiceId: 'a',
    lesson: 'Array.prototype.sort sorts strings by default and mutates. Copy first and pass a comparator.',
    requires: { typescript: 1 },
    trains: ['typescript', 'debugging'],
    minLevel: 2,
    difficulty: 1,
  },
  {
    id: 'async-foreach',
    title: 'The profile page shows nobody',
    brief: 'loadNames() should resolve to every user name, but it resolves to an empty array.',
    fileName: 'users.ts',
    code: `export async function loadNames(ids: number[]) {
  const names: string[] = []
  ids.forEach(async (id) => {
    names.push(await fetchName(id))
  })
  return names
}`,
    focusLines: [3, 4, 5],
    question: 'Which version actually waits for the names?',
    choices: [
      { id: 'a', label: 'Promise.all over map', code: 'return Promise.all(ids.map(fetchName))', evaluate: () => runAsyncCases((ids: number[]) => Promise.all(ids.map(fetchName)), asyncCases), feedback: 'map returns the promises; Promise.all waits for all of them, in order.' },
      { id: 'b', label: 'await the forEach', code: 'await ids.forEach(async (id) => …)', evaluate: () => runAsyncCases(async (ids: number[]) => { const names: string[] = []; ids.forEach(async (id) => { names.push(await fetchName(id)) }); await undefined; return names }, asyncCases), feedback: 'forEach returns undefined — there is nothing to await.' },
      { id: 'c', label: 'Return the mapped array', code: 'return ids.map(fetchName)', evaluate: () => runAsyncCases((ids: number[]) => ids.map(fetchName) as unknown as string[], asyncCases), feedback: 'You get an array of pending promises, not names.' },
      { id: 'd', label: 'map with async push', code: 'ids.map(async (id) => names.push(await fetchName(id)))\nreturn names', evaluate: () => runAsyncCases(async (ids: number[]) => { const names: string[] = []; ids.map(async (id) => names.push(await fetchName(id))); return names }, asyncCases), feedback: 'Same problem: nobody awaits the promises map created.' },
    ],
    correctChoiceId: 'a',
    lesson: 'forEach ignores the promises its callback returns. Use for…of with await, or Promise.all with map.',
    requires: { typescript: 1, debugging: 2 },
    trains: ['async'],
    minLevel: 2,
    difficulty: 2,
  },
  {
    id: 'leap-year-tests',
    title: 'The leap year that wasn’t',
    brief: 'The calendar will show February 29, 2100. Pick the one test that fails on this buggy code.',
    fileName: 'calendar.ts',
    code: `// Divisible by 4, except centuries,
// unless the century is divisible by 400.
export const isLeapYear = (year: number) =>
  year % 4 === 0`,
    focusLines: [4],
    question: 'Which test catches the bug?',
    choices: [
      { id: 'a', label: 'A normal leap year', code: 'expect(isLeapYear(2024)).toBe(true)', evaluate: testCaseProbe(2024), feedback: 'Both versions agree on 2024 — the test proves nothing.' },
      { id: 'b', label: 'A common year', code: 'expect(isLeapYear(2023)).toBe(false)', evaluate: testCaseProbe(2023), feedback: 'Both versions agree on 2023.' },
      { id: 'c', label: 'A century year', code: 'expect(isLeapYear(1900)).toBe(false)', evaluate: testCaseProbe(1900), feedback: '1900 is not a leap year; the buggy code says it is — caught.' },
      { id: 'd', label: 'A 400-year century', code: 'expect(isLeapYear(2000)).toBe(true)', evaluate: testCaseProbe(2000), feedback: '2000 is a leap year under both rules.' },
    ],
    correctChoiceId: 'c',
    lesson: 'A good regression test lives exactly where the buggy and correct behaviour disagree.',
    requires: { debugging: 2, typescript: 1 },
    trains: ['testing'],
    minLevel: 2,
    difficulty: 2,
  },
  {
    id: 'float-assert',
    title: 'The flaky invoice test',
    brief: 'expect(0.1 + 0.2).toBe(0.3) fails in CI. Pick the assertion that is correct for money-like decimals.',
    fileName: 'invoice.test.ts',
    code: `it('adds line items', () => {
  expect(0.1 + 0.2).toBe(0.3)
})`,
    focusLines: [2],
    question: 'Which assertion should replace it?',
    choices: [
      { id: 'a', label: 'toBeCloseTo', code: 'expect(0.1 + 0.2).toBeCloseTo(0.3)', evaluate: assertionProbe((a, e) => Math.abs(a - e) < 0.005), feedback: 'Compares within a tolerance (2 decimal places by default), and still fails for 0.4.' },
      { id: 'b', label: 'toEqual', code: 'expect(0.1 + 0.2).toEqual(0.3)', evaluate: assertionProbe((a, e) => Object.is(a, e)), feedback: 'Deep equality on numbers is still exact: 0.30000000000000004 ≠ 0.3.' },
      { id: 'c', label: 'Round to an integer', code: 'expect(Math.round(0.1 + 0.2)).toBe(Math.round(0.3))', evaluate: assertionProbe((a, e) => Math.round(a) === Math.round(e)), feedback: 'Too coarse: 0.3 and 0.4 both round to 0 — the test can no longer fail.' },
      { id: 'd', label: 'toBeTruthy', code: 'expect(0.1 + 0.2).toBeTruthy()', evaluate: assertionProbe((a) => !!a), feedback: 'Any non-zero number passes. Not a test.' },
    ],
    correctChoiceId: 'a',
    lesson: 'Floating point is binary. Compare with a tolerance — or store money in integer cents.',
    requires: { testing: 1 },
    trains: ['testing'],
    minLevel: 3,
    difficulty: 2,
  },
  {
    id: 'memo-fib',
    title: 'The dashboard that takes 3 seconds',
    brief: 'fib() is called on every render and grinds the tab. Keep the result, cut the work.',
    fileName: 'fib.ts',
    code: `export function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2)
}`,
    focusLines: [2],
    question: 'Which version is fast and still correct?',
    choices: [
      {
        id: 'a',
        label: 'Memoise with a Map',
        code: 'const memo = new Map<number, number>()\nfunction fib(n) {\n  if (n < 2) return n\n  if (!memo.has(n)) memo.set(n, fib(n - 1) + fib(n - 2))\n  return memo.get(n)!\n}',
        evaluate: fibProbe((count) => { const memo = new Map<number, number>(); const f = (n: number): number => { count(); if (n < 2) return n; if (!memo.has(n)) memo.set(n, f(n - 1) + f(n - 2)); return memo.get(n)! }; return f }),
        feedback: 'Each n is computed once: about 2n calls instead of ~1.6ⁿ.',
      },
      { id: 'b', label: 'Unchanged recursion', code: 'return n < 2 ? n : fib(n - 1) + fib(n - 2)', evaluate: fibProbe((count) => { const f = (n: number): number => { count(); return n < 2 ? n : f(n - 1) + f(n - 2) }; return f }), feedback: 'Correct, but 242,785 calls for fib(25).' },
      { id: 'c', label: 'Cache only the last result', code: 'if (n === last) return lastValue', evaluate: fibProbe((count) => { let last = -1; let lastValue = 0; const f = (n: number): number => { count(); if (n === last) return lastValue; const v = n < 2 ? n : f(n - 1) + f(n - 2); last = n; lastValue = v; return v }; return f }), feedback: 'A one-entry cache barely helps a tree of repeated calls.' },
      {
        id: 'd',
        label: 'Iterative loop',
        code: 'let a = 0, b = 1\nfor (let i = 0; i < n - 1; i++) [a, b] = [b, a + b]\nreturn a',
        evaluate: fibProbe((count) => (n: number) => { count(); let a = 0; let b = 1; for (let i = 0; i < n - 1; i++) [a, b] = [b, a + b]; return a }),
        feedback: 'Fast, but the loop stops one step early: it returns fib(n − 1).',
      },
    ],
    correctChoiceId: 'a',
    lesson: 'Repeated sub-problems are the signal for memoisation. Measure call counts, not just results.',
    requires: { performance: 1, debugging: 2 },
    trains: ['performance'],
    minLevel: 3,
    difficulty: 3,
  },
]

export function getChallenge(id: string): Challenge | undefined {
  if (id.startsWith('gen:')) return generateChallenge(id)
  return CHALLENGES.find((c) => c.id === id)
}

export const CLIENTS = [
  'Fieldnote', 'Trailhead', 'Almanac', 'Mossbank', 'Ridgeline', 'Canopy Labs', 'Pebble & Co', 'Sproutly', 'Northwind Studio', 'Lichen Health',
]
