import { describe, expect, it } from 'vitest'
import { generateChallenge, seededRng, TEMPLATE_IDS } from '../src/content/generators.ts'

const SEEDS = Array.from({ length: 25 }, (_, i) => `2026101${i % 10}-${(i * 7919).toString(36)}`)

describe('procedural jobs', () => {
  it('2026-10-10 is a Saturday (weekend template anchor)', () => {
    expect(new Date(Date.UTC(2026, 9, 10)).getUTCDay()).toBe(6)
  })

  it('is deterministic for the same id', () => {
    const a = generateChallenge('gen:clamp:abc:1')!
    const b = generateChallenge('gen:clamp:abc:1')!
    expect(a.brief).toBe(b.brief)
    expect(a.code).toBe(b.code)
  })

  it('produces varied stories across seeds', () => {
    const briefs = new Set(SEEDS.map((s) => generateChallenge(`gen:percent:${s}:1`)!.brief))
    expect(briefs.size).toBeGreaterThan(10)
  })

  for (const template of TEMPLATE_IDS) {
    it(`${template}: for every seed, the answer passes and every wrong option fails`, async () => {
      for (const seed of SEEDS) {
        for (const tier of [1, 2, 3]) {
          const c = generateChallenge(`gen:${template}:${seed}:${tier}`)!
          expect(c.minLevel).toBe(tier)
          for (const choice of c.choices) {
            const results = await choice.evaluate()
            const ok = results.every((r) => r.pass)
            expect(ok, `${c.id} option ${choice.id}`).toBe(choice.id === c.correctChoiceId)
          }
        }
      }
    })
  }

  it('seededRng is stable', () => {
    const r = seededRng('x')
    expect([r(), r()]).toEqual([seededRng('x')(), (() => { const q = seededRng('x'); q(); return q() })()])
  })
})
