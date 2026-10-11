import { describe, expect, it } from 'vitest'
import { decide, VERIFY_THRESHOLD } from '../src/ai/missionVerifier.ts'
import { DebuggerSchema, extractJsonObject, ModelOutputError, parseVerification, parseWith } from '../src/ai/schemas.ts'

const valid = {
  matches: true,
  confidence: 0.82,
  reason: 'Grass is growing out of a crack in grey pavement.',
  detectedElements: ['grass', 'pavement', 'crack'],
  needsReview: false,
}

describe('parseVerification', () => {
  it('accepts clean structured output', () => {
    expect(parseVerification(JSON.stringify(valid))).toEqual(valid)
  })

  it('tolerates code fences, prose and <think> blocks around the JSON', () => {
    const text = `<think>hmm</think>Sure! Here you go:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``
    expect(parseVerification(text).matches).toBe(true)
  })

  it('coerces percentages and string booleans, clamps confidence', () => {
    const r = parseVerification(JSON.stringify({ ...valid, matches: 'true', confidence: 85 }))
    expect(r.matches).toBe(true)
    expect(r.confidence).toBeCloseTo(0.85)
    expect(parseVerification(JSON.stringify({ ...valid, confidence: -3 })).confidence).toBe(0)
  })

  it('defaults missing optional fields conservatively', () => {
    const r = parseVerification(JSON.stringify({ matches: false, confidence: 0.1, reason: 'A keyboard.' }))
    expect(r.detectedElements).toEqual([])
    expect(r.needsReview).toBe(false)
  })

  it('bounds detected elements', () => {
    const r = parseVerification(JSON.stringify({ ...valid, detectedElements: Array.from({ length: 30 }, (_, i) => `thing ${i}`) }))
    expect(r.detectedElements).toHaveLength(10)
  })

  it('rejects non-JSON, missing reason and non-numeric confidence', () => {
    expect(() => parseVerification('I think it is a plant.')).toThrow(ModelOutputError)
    expect(() => parseVerification(JSON.stringify({ matches: true, confidence: 0.9 }))).toThrow(ModelOutputError)
    expect(() => parseVerification(JSON.stringify({ ...valid, confidence: 'high' }))).toThrow(ModelOutputError)
    expect(() => parseVerification(JSON.stringify({ ...valid, reason: '   ' }))).toThrow(ModelOutputError)
  })

  it('extracts the first balanced object even with braces inside strings', () => {
    expect(extractJsonObject('x {"a":"}{","b":{"c":1}} y')).toEqual({ a: '}{', b: { c: 1 } })
  })
})

describe('decide', () => {
  it('only grants a confident, unflagged match', () => {
    expect(decide(valid)).toBe('verified')
    expect(decide({ ...valid, confidence: VERIFY_THRESHOLD - 0.01 })).toBe('needs-review')
    expect(decide({ ...valid, needsReview: true })).toBe('needs-review')
    expect(decide({ ...valid, matches: false })).toBe('rejected')
    expect(decide({ ...valid, matches: false, needsReview: true })).toBe('needs-review')
  })
})

describe('developer tool schemas', () => {
  it('validates debugger output and normalises unknown severities', () => {
    const out = parseWith(
      DebuggerSchema,
      JSON.stringify({
        summary: 'Loop starts at 1.',
        issues: [{ title: 'Off-by-one', detail: 'Index 0 skipped', severity: 'critical' }],
        fixedCode: 'for (let i = 0; i < a.length; i++) {}',
        explanation: 'Arrays are zero-indexed.',
        verification: ['countDone([]) === 0'],
      }),
    )
    expect(out.issues[0].severity).toBe('medium')
  })
})
