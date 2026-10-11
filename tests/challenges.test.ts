import { describe, expect, it } from 'vitest'
import { CHALLENGES } from '../src/content/challenges.ts'
import { MISSIONS } from '../src/content/missions.ts'

describe('authored challenge pool', () => {
  it('has unique ids and 2–4 options each', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length)
    for (const c of CHALLENGES) {
      expect(c.choices.length).toBeGreaterThanOrEqual(2)
      expect(c.choices.length).toBeLessThanOrEqual(4)
    }
  })

  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s: the correct option passes every check', async (_id, c) => {
    const correct = c.choices.find((x) => x.id === c.correctChoiceId)!
    const results = await correct.evaluate()
    expect(results.every((r) => r.pass)).toBe(true)
  })

  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s: every wrong option fails at least one check (except deliberate lessons)', async (_id, c) => {
    for (const choice of c.choices) {
      if (choice.id === c.correctChoiceId) continue
      const results = await choice.evaluate()
      // "Tests pass but it is still O(n²)" is the point of this one option.
      if (c.id === 'slow-duplicates' && choice.id === 'c') {
        expect(results.every((r) => r.pass)).toBe(true)
        continue
      }
      expect(results.some((r) => !r.pass), `${c.id}/${choice.id}`).toBe(true)
    }
  })

  it('reproduces real runtime behaviour (TypeError past the end, unawaited promises)', async () => {
    const counter = CHALLENGES.find((c) => c.id === 'broken-counter')!
    const d = (await counter.choices.find((x) => x.id === 'd')!.evaluate()).find((r) => r.label === 'countDone([✓])')!
    expect(d.actual).toMatch(/TypeError/)
    const asyncJob = CHALLENGES.find((c) => c.id === 'async-foreach')!
    const c = (await asyncJob.choices.find((x) => x.id === 'c')!.evaluate())[0]
    expect(c.actual).toContain('Promise')
  })

  it('missions offer an easy alternative and safety notes', () => {
    for (const m of MISSIONS) {
      expect(m.variants.length).toBeGreaterThanOrEqual(2)
      expect(m.safety.length).toBeGreaterThan(0)
    }
  })
})
