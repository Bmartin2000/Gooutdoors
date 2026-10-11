import { describe, expect, it } from 'vitest'
import { CONTRACTS, MISSIONS, getMission } from '../src/content/contracts.ts'

describe('authored coding challenges', () => {
  it.each(CONTRACTS.map((c) => [c.id, c] as const))('%s has exactly one correct choice whose cases all pass', (_id, contract) => {
    const { choices, correctChoiceId } = contract.challenge
    expect(choices.length).toBeGreaterThanOrEqual(2)
    expect(choices.length).toBeLessThanOrEqual(4)
    const correct = choices.find((c) => c.id === correctChoiceId)
    expect(correct).toBeDefined()
    expect(correct!.evaluate().every((r) => r.pass)).toBe(true)
  })

  it('every wrong choice in the counter and duplicate contracts fails at least one case', () => {
    for (const contract of CONTRACTS.slice(0, 2)) {
      for (const choice of contract.challenge.choices) {
        if (choice.id === contract.challenge.correctChoiceId) continue
        const results = choice.evaluate()
        // choice c of the duplicate check is the deliberate "tests pass but O(n²)" lesson
        if (contract.id === 'slow-duplicates' && choice.id === 'c') {
          expect(results.every((r) => r.pass)).toBe(true)
          continue
        }
        expect(results.some((r) => !r.pass)).toBe(true)
      }
    }
  })

  it('the broken counter reproduces the real TypeError for the single-task case', () => {
    const counter = CONTRACTS[0]
    const optionD = counter.challenge.choices.find((c) => c.id === 'd')!
    const single = optionD.evaluate().find((r) => r.label === 'countDone([✓])')!
    expect(single.pass).toBe(false)
    expect(single.actual).toMatch(/TypeError/)
  })

  it('the sort-based refactor is flagged for mutating its input', () => {
    const sortChoice = CONTRACTS[1].challenge.choices.find((c) => c.id === 'b')!
    const purity = sortChoice.evaluate().find((r) => r.label === 'input left untouched')!
    expect(purity.pass).toBe(false)
  })

  it('only the century test catches the leap-year bug', () => {
    const leap = CONTRACTS[2]
    for (const choice of leap.challenge.choices) {
      const caught = choice.evaluate().find((r) => r.label === 'Catches the bug?')!.pass
      expect(caught).toBe(choice.id === leap.challenge.correctChoiceId)
    }
  })

  it('every contract points at a mission with an urban-friendly alternative and safety notes', () => {
    for (const contract of CONTRACTS) {
      const mission = getMission(contract.missionId)
      expect(mission).toBeDefined()
      expect(mission!.variants.some((v) => v.urbanFriendly)).toBe(true)
      expect(mission!.safety.length).toBeGreaterThan(0)
    }
    expect(MISSIONS).toHaveLength(3)
  })
})
