/**
 * Procedural jobs: every hour (and every day's featured contract) gets a fresh task built
 * from a template with seeded randomness — different app, client story, names, numbers
 * and test data. Answers stay deterministic: each option is a real implementation that is
 * run against generated test cases. Nothing here executes user or model code.
 */
import type { CaseResult, Challenge, SkillId } from '../game/types.ts'

export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)]
const int = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))

function show(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`
  if (typeof v === 'string') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(show).join(', ')}]`
  return String(v)
}

function run<A extends unknown[]>(impl: (...a: A) => unknown, cases: { label: string; args: A; expected: unknown; view?: (r: unknown) => unknown }[]): CaseResult[] {
  return cases.map(({ label, args, expected, view }) => {
    let actual: unknown
    try {
      const r = impl(...args)
      actual = view ? view(r) : r
    } catch (e) {
      actual = e instanceof Error ? e : new Error(String(e))
    }
    return { label, expected: show(expected), actual: show(actual), pass: show(actual) === show(expected) }
  })
}

const APPS = [
  { name: 'TrailMate', what: 'hiking app' },
  { name: 'Canopy', what: 'tree-planting tracker' },
  { name: 'Tidepool', what: 'surf forecast app' },
  { name: 'Fernbox', what: 'plant-care reminder app' },
  { name: 'Ridgeline', what: 'bike-share kiosk' },
  { name: 'Lichen', what: 'birdwatching log' },
  { name: 'Sunpath', what: 'solar-panel dashboard' },
  { name: 'Driftwood', what: 'kayak rental site' },
  { name: 'Mossbank', what: 'community garden planner' },
  { name: 'Waypoint', what: 'orienteering club app' },
]
const URGENCY = ['before Friday’s launch', 'and customers are already emailing', 'before tomorrow’s investor demo', 'on a tight deadline', 'before the weekend rush', 'after a bad app-store review']

interface Template {
  id: string
  difficulty: 1 | 2
  trains: SkillId[]
  build: (rng: () => number, app: (typeof APPS)[number]) => Omit<Challenge, 'id' | 'requires' | 'minLevel' | 'difficulty' | 'trains'>
}

const TEMPLATES: Template[] = [
  {
    id: 'batch',
    difficulty: 2,
    trains: ['async', 'typescript'],
    build: (rng, app) => {
      const ids = Array.from({ length: int(rng, 2, 5) }, () => int(rng, 1, 99))
      const evaluate = async (mode: string): Promise<CaseResult[]> => {
        const cases = [ids, [], [7]]
        return Promise.all(cases.map(async (input) => {
          const load = async (id: number) => { await Promise.resolve(); return `item-${id}` }
          let actual: unknown
          if (mode === 'all') actual = await Promise.all(input.map(load))
          else if (mode === 'map') actual = input.map(load).map((p) => p instanceof Promise ? 'Promise' : p)
          else if (mode === 'first') actual = input.length ? [await load(input[0])] : []
          else {
            const results: string[] = []
            input.forEach(async (id) => { results.push(await load(id)) })
            actual = [...results]
          }
          const expected = input.map((id) => `item-${id}`)
          return { label: `loadBatch([${input.join(', ')}])`, expected: show(expected), actual: show(actual), pass: show(actual) === show(expected) }
        }))
      }
      return {
        title: `${app.name}: the batch arrives empty`,
        brief: `${app.name}'s ${app.what} loads every item asynchronously. The UI gets an empty batch even though the requests succeed. Return all loaded items in input order.`,
        fileName: 'loadBatch.ts',
        code: 'async function loadBatch(ids: number[]) {\n  const results: string[] = []\n  ids.forEach(async (id) => {\n    results.push(await load(id))\n  })\n  return results\n}',
        focusLines: [3, 4, 6],
        question: 'Which implementation waits for every request?',
        choices: [
          { id: 'a', label: 'Wait for the batch', code: 'return await Promise.all(ids.map(load))', evaluate: () => evaluate('all'), feedback: 'Promise.all waits for every result and preserves input order.' },
          { id: 'b', label: 'Return the mapped array', code: 'return ids.map(load)', evaluate: () => evaluate('map'), feedback: 'These are promises, not loaded values.' },
          { id: 'c', label: 'Wait for forEach', code: 'await ids.forEach(async id => results.push(await load(id)))\nreturn results', evaluate: () => evaluate('foreach'), feedback: 'forEach returns undefined. Awaiting it does not wait for its callbacks.' },
          { id: 'd', label: 'Load the first item', code: 'return ids.length ? [await load(ids[0])] : []', evaluate: () => evaluate('first'), feedback: 'This drops every item after the first.' },
        ],
        correctChoiceId: 'a',
        lesson: 'For concurrent async work, map to promises and await Promise.all. Use a for…of loop when requests must run one at a time.',
      }
    },
  },
  {
    id: 'clamp',
    difficulty: 1,
    trains: ['debugging'],
    build: (rng, app) => {
      const [fn, what, min, max] = pick(rng, [
        ['clampVolume', 'volume slider', 0, 100],
        ['clampZoom', 'map zoom', 1, 20],
        ['clampBrightness', 'screen brightness', 10, 90],
        ['clampPace', 'pace picker', 3, 12],
      ] as const)
      const inside = int(rng, min + 1, max - 1)
      const cases = [
        { label: `${fn}(${min - int(rng, 1, 9)})`, args: [min - 5] as [number], expected: min },
        { label: `${fn}(${inside})`, args: [inside] as [number], expected: inside },
        { label: `${fn}(${max + 7})`, args: [max + 7] as [number], expected: max },
      ]
      cases[0].label = `${fn}(${min - 5})`
      return {
        title: `${app.name}: the ${what} is stuck`,
        brief: `${app.name}’s ${app.what} has a ${what} that always snaps to ${min}. ${fn}() should keep values between ${min} and ${max}.`,
        fileName: `${fn}.ts`,
        code: `export const ${fn} = (v: number) =>\n  Math.min(Math.max(v, ${max}), ${min})`,
        focusLines: [2],
        question: 'Which clamp is correct?',
        choices: [
          { id: 'a', label: 'max with the minimum, then min with the maximum', code: `Math.min(Math.max(v, ${min}), ${max})`, evaluate: () => run((v: number) => Math.min(Math.max(v, min), max), cases), feedback: 'Raise to the floor first, then cap at the ceiling.' },
          { id: 'b', label: 'Swap min and max functions', code: `Math.max(Math.min(v, ${min}), ${max})`, evaluate: () => run((v: number) => Math.max(Math.min(v, min), max), cases), feedback: `This always returns ${max}.` },
          { id: 'c', label: 'Only cap the top', code: `Math.min(v, ${max})`, evaluate: () => run((v: number) => Math.min(v, max), cases), feedback: 'Values below the floor slip through.' },
          { id: 'd', label: 'Ternary on the floor', code: `v < ${min} ? ${min} : ${max}`, evaluate: () => run((v: number) => (v < min ? min : max), cases), feedback: 'Every valid value jumps to the maximum.' },
        ],
        correctChoiceId: 'a',
        lesson: 'clamp(v) = min(max(v, low), high). Test below, inside and above the range.',
      }
    },
  },
  {
    id: 'percent',
    difficulty: 1,
    trains: ['typescript'],
    build: (rng, app) => {
      const unit = pick(rng, ['files uploaded', 'kilometres hiked', 'seeds planted', 'lessons finished', 'photos synced'])
      const total = pick(rng, [3, 6, 7, 9, 12])
      const done = int(rng, 1, total - 1)
      const pct = (d: number, t: number) => Math.round((d / t) * 100)
      const cases = [
        { label: `progress(${done}, ${total})`, args: [done, total] as [number, number], expected: pct(done, total) },
        { label: `progress(1, 3)`, args: [1, 3] as [number, number], expected: 33 },
        { label: `progress(0, ${total})`, args: [0, total] as [number, number], expected: 0 },
        { label: `progress(${total}, ${total})`, args: [total, total] as [number, number], expected: 100 },
      ]
      return {
        title: `${app.name}: progress bar shows 0%`,
        brief: `${app.name} shows “0%” until every one of the ${unit} is done ${pick(rng, URGENCY)}. progress() should return a whole-number percentage.`,
        fileName: 'progress.ts',
        code: `export const progress = (done: number, total: number) =>\n  Math.floor(done / total) * 100`,
        focusLines: [2],
        question: 'Which formula gives the right percentage?',
        choices: [
          { id: 'a', label: 'Divide, scale, then round', code: 'Math.round((done / total) * 100)', evaluate: () => run((d: number, t: number) => Math.round((d / t) * 100), cases), feedback: 'Scale before rounding so the fraction survives.' },
          { id: 'b', label: 'Round the ratio, then scale', code: 'Math.round(done / total) * 100', evaluate: () => run((d: number, t: number) => Math.round(d / t) * 100, cases), feedback: 'The ratio rounds to 0 or 1 — you only ever see 0% or 100%.' },
          { id: 'c', label: 'No rounding', code: '(done / total) * 100', evaluate: () => run((d: number, t: number) => (d / t) * 100, cases), feedback: '33.333333333333336% is not a whole number.' },
          { id: 'd', label: 'Inverted ratio', code: 'Math.round((total / done) * 100)', evaluate: () => run((d: number, t: number) => Math.round((t / d) * 100), cases), feedback: 'Upside down — and Infinity at zero.' },
        ],
        correctChoiceId: 'a',
        lesson: 'Order matters with integer-ish maths: multiply first, round last.',
      }
    },
  },
  {
    id: 'duration',
    difficulty: 1,
    trains: ['testing'],
    build: (rng, app) => {
      const label = pick(rng, ['workout timer', 'podcast player', 'trail stopwatch', 'sunset countdown'])
      const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
      const a = int(rng, 1, 9) * 60 + int(rng, 1, 9)
      const b = int(rng, 1, 9) * 60 + int(rng, 31, 59)
      const c = int(rng, 1, 9) * 60
      const cases = [a, b, c].map((s) => ({ label: `fmt(${s})`, args: [s] as [number], expected: fmt(s) }))
      return {
        title: `${app.name}: the ${label} reads “3:5”`,
        brief: `${app.name}’s ${label} shows 3:5 instead of 3:05 ${pick(rng, URGENCY)}. fmt() turns seconds into m:ss.`,
        fileName: 'time.ts',
        code: 'export const fmt = (s: number) =>\n  `${Math.floor(s / 60)}:${s % 60}`',
        focusLines: [2],
        question: 'Which seconds part is right?',
        choices: [
          { id: 'a', label: 'padStart to two digits', code: 'String(s % 60).padStart(2, "0")', evaluate: () => run((s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, cases), feedback: '5 → "05", 45 → "45", 0 → "00".' },
          { id: 'b', label: 'padEnd to two digits', code: 'String(s % 60).padEnd(2, "0")', evaluate: () => run((s: number) => `${Math.floor(s / 60)}:${String(s % 60).padEnd(2, '0')}`, cases), feedback: '5 becomes "50" — a different time entirely.' },
          { id: 'c', label: 'Round the minutes', code: '`${Math.round(s / 60)}:${String(s % 60).padStart(2, "0")}`', evaluate: () => run((s: number) => `${Math.round(s / 60)}:${String(s % 60).padStart(2, '0')}`, cases), feedback: 'From :30 on, the minutes round up.' },
          { id: 'd', label: 'toFixed(2)', code: '(s % 60).toFixed(2)', evaluate: () => run((s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2)}`, cases), feedback: 'toFixed adds decimals, not leading zeros.' },
        ],
        correctChoiceId: 'a',
        lesson: 'Good time tests cover a single-digit second, a :30+ second and an exact minute.',
      }
    },
  },
  {
    id: 'weekend',
    difficulty: 1,
    trains: ['debugging', 'testing'],
    build: (rng, app) => {
      // 2026-10-10 is a Saturday (UTC).
      const sat = Date.UTC(2026, 9, 10) + int(rng, 0, 20) * 7 * 86_400_000
      const days = [
        { d: new Date(sat), weekend: true, name: 'Saturday' },
        { d: new Date(sat + 86_400_000), weekend: true, name: 'Sunday' },
        { d: new Date(sat + int(rng, 2, 6) * 86_400_000), weekend: false, name: 'weekday' },
      ]
      const cases = days.map((x) => ({ label: `isWeekend(${x.d.toISOString().slice(0, 10)}) — ${x.name}`, args: [x.d] as [Date], expected: x.weekend }))
      return {
        title: `${app.name}: Sunday prices are wrong`,
        brief: `${app.name}’s ${app.what} charges weekday prices on Sundays. isWeekend() decides the rate.`,
        fileName: 'pricing.ts',
        code: 'export const isWeekend = (d: Date) =>\n  d.getUTCDay() === 6 || d.getUTCDay() === 7',
        focusLines: [2],
        question: 'Which check is correct?',
        choices: [
          { id: 'a', label: 'Sunday is 0, Saturday is 6', code: 'd.getUTCDay() === 0 || d.getUTCDay() === 6', evaluate: () => run((d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6, cases), feedback: 'getDay() runs 0 (Sunday) to 6 (Saturday). There is no 7.' },
          { id: 'b', label: 'Day 5 or later', code: 'd.getUTCDay() >= 5', evaluate: () => run((d: Date) => d.getUTCDay() >= 5, cases), feedback: 'Friday is 5, and Sunday (0) is still missed.' },
          { id: 'c', label: 'Only Saturday', code: 'd.getUTCDay() === 6', evaluate: () => run((d: Date) => d.getUTCDay() === 6, cases), feedback: 'Sunday is still a weekday here.' },
          { id: 'd', label: 'Friday and Saturday', code: '[5, 6].includes(d.getUTCDay())', evaluate: () => run((d: Date) => [5, 6].includes(d.getUTCDay()), cases), feedback: 'That is the Friday–Saturday weekend; this client closes on Sundays.' },
        ],
        correctChoiceId: 'a',
        lesson: 'getDay() is 0-based with Sunday first. Always test both ends of the week.',
      }
    },
  },
  {
    id: 'unique-by-id',
    difficulty: 2,
    trains: ['performance', 'typescript'],
    build: (rng, app) => {
      const pool = ['oak', 'fern', 'moss', 'pine', 'ivy', 'sage', 'reed', 'birch']
      const ids = Array.from({ length: 6 }, () => pick(rng, pool))
      if (new Set(ids).size === ids.length) ids[5] = ids[1]
      // Make sure first-seen order is not alphabetical, so a sort-based answer is visibly wrong.
      const firstSeen = [...new Set(ids)]
      if (firstSeen.length < 2) ids[0] = ids[0] === 'oak' ? 'pine' : 'oak'
      if ([...new Set(ids)].join() === [...new Set(ids)].sort().join()) ids.reverse()
      const items = ids.map((id, i) => ({ id, n: i }))
      const expected = [...new Set(ids)]
      const view = (r: unknown) => (Array.isArray(r) ? r.map((x) => (x as { id?: string })?.id ?? x) : r)
      const cases = [{ label: `uniqueById(${ids.length} items)`, args: [items] as [typeof items], expected, view }, { label: 'uniqueById([])', args: [[]] as [typeof items], expected: [], view }]
      return {
        title: `${app.name}: duplicate cards everywhere`,
        brief: `${app.name}’s feed shows the same card twice ${pick(rng, URGENCY)}. uniqueById() should keep the first item of each id, in order, without mutating the input.`,
        fileName: 'feed.ts',
        code: `type Item = { id: string; n: number }

export const uniqueById = (items: Item[]) =>
  [...new Set(items)]`,
        focusLines: [4],
        question: 'Which version dedupes by id, in one pass?',
        choices: [
          {
            id: 'a',
            label: 'Track seen ids in a Set',
            code: 'const seen = new Set<string>()\nreturn items.filter((x) => !seen.has(x.id) && seen.add(x.id))',
            evaluate: () => run((xs: typeof items) => { const seen = new Set<string>(); return xs.filter((x) => !seen.has(x.id) && !!seen.add(x.id)) }, cases),
            feedback: 'O(n), keeps first occurrences, input untouched.',
          },
          { id: 'b', label: 'indexOf on the objects', code: 'items.filter((x, i) => items.indexOf(x) === i)', evaluate: () => run((xs: typeof items) => xs.filter((x, i) => xs.indexOf(x) === i), cases), feedback: 'Different objects with the same id are all “unique” by reference.' },
          { id: 'c', label: 'Set of ids', code: '[...new Set(items.map((i) => i.id))]', evaluate: () => run((xs: typeof items) => [...new Set(xs.map((i) => i.id))], cases.map((c) => ({ ...c, view: (r: unknown) => (Array.isArray(r) ? r.map((x) => (typeof x === 'string' ? `<string ${x}>` : x)) : r) }))), feedback: 'You get bare id strings back, not the items.' },
          { id: 'd', label: 'Sort, then drop neighbours', code: 'items.sort((a, b) => a.id.localeCompare(b.id))\n  .filter((x, i, a) => x.id !== a[i - 1]?.id)', evaluate: () => run((xs: typeof items) => [...xs].sort((a, b) => a.id.localeCompare(b.id)).filter((x, i, a) => x.id !== a[i - 1]?.id), cases), feedback: 'Unique, but the feed order is lost (and the real sort() mutates).' },
        ],
        correctChoiceId: 'a',
        lesson: 'Sets compare objects by reference. Dedupe by a key, and keep order explicit.',
      }
    },
  },
  {
    id: 'average',
    difficulty: 2,
    trains: ['testing', 'debugging'],
    build: (rng, app) => {
      const xs = Array.from({ length: int(rng, 3, 5) }, () => int(rng, 1, 5))
      const avg = xs.reduce((a, b) => a + b, 0) / xs.length
      const cases = [
        { label: `average([${xs.join(', ')}])`, args: [xs] as [number[]], expected: avg },
        { label: 'average([])', args: [[]] as [number[]], expected: 0 },
      ]
      return {
        title: `${app.name}: new listings crash`,
        brief: `${app.name}’s ${app.what} crashes on anything with no ratings yet. average() should return 0 for an empty list.`,
        fileName: 'ratings.ts',
        code: 'export const average = (xs: number[]) =>\n  xs.reduce((a, b) => a + b) / xs.length',
        focusLines: [2],
        question: 'Which version handles the empty case?',
        choices: [
          { id: 'a', label: 'Guard the empty list, seed reduce', code: 'xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0', evaluate: () => run((v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0), cases), feedback: 'An initial value for reduce, and an explicit answer for “no data”.' },
          { id: 'b', label: 'Seed reduce only', code: 'xs.reduce((a, b) => a + b, 0) / xs.length', evaluate: () => run((v: number[]) => v.reduce((a, b) => a + b, 0) / v.length, cases), feedback: 'No crash — but 0 / 0 is NaN.' },
          { id: 'c', label: 'Divide by length || 1', code: 'xs.reduce((a, b) => a + b) / (xs.length || 1)', evaluate: () => run((v: number[]) => v.reduce((a, b) => a + b) / (v.length || 1), cases), feedback: 'reduce() on an empty array without a seed still throws.' },
          { id: 'd', label: 'Use the best rating', code: 'Math.max(...xs)', evaluate: () => run((v: number[]) => Math.max(...v), cases), feedback: 'Not an average, and -Infinity for empty.' },
        ],
        correctChoiceId: 'a',
        lesson: 'Empty input is a real case: decide the answer, then test it.',
      }
    },
  },
]

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id)

/** Builds a generated challenge from its id: `gen:<template>:<seed>:<tier>`. */
export function generateChallenge(id: string): Challenge | undefined {
  const [, templateId, seed, tierRaw] = id.split(':')
  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template || !seed) return undefined
  const tier = Math.min(10, Math.max(1, Math.floor(Number(tierRaw) || 1)))
  const rng = seededRng(`${templateId}:${seed}`)
  const app = pick(rng, APPS)
  const body = template.build(rng, app)
  const requires: Challenge['requires'] = {}
  if (tier >= 2) requires[template.trains[0]] = tier - 1
  if (tier >= 3) requires.debugging = Math.max(requires.debugging ?? 0, 2)
  return { ...body, id, requires, trains: template.trains, minLevel: tier, difficulty: Math.min(3, template.difficulty + tier - 1) as 1 | 2 | 3 }
}

export function newGeneratedId(rng: () => number, seed: string, tier: number): string {
  return `gen:${pick(rng, TEMPLATES).id}:${seed}:${tier}`
}
