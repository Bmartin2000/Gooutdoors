import { describe, expect, it } from 'vitest'
import { acceptFix, distanceM, summarize, WALK_RULES } from '../src/game/location.ts'
import type { GeoFix, WalkRecord } from '../src/game/types.ts'

const START = Date.parse('2026-10-11T10:00:00Z')
const base = { lat: 47.4979, lon: 19.0402 } // Budapest
const north = (m: number) => base.lat + m / 111_320

function record(): WalkRecord {
  return { id: 'w', startedAt: new Date(START).toISOString(), endedAt: null, fixes: [], rejectedFixes: 0, missionId: 'natures-debugger', missionPromptedAt: null, summary: null }
}

function walkNorth(metresPerMin: number, minutes: number, accuracy = 8): WalkRecord {
  let r = record()
  for (let m = 0; m <= minutes; m++) {
    const fix: GeoFix = { lat: north(m * metresPerMin), lon: base.lon, accuracy, at: START + m * 60_000 }
    r = acceptFix(r, fix)
  }
  return r
}

describe('distance', () => {
  it('haversine matches a known 1 km step', () => {
    expect(distanceM(base, { lat: north(1000), lon: base.lon })).toBeGreaterThan(995)
    expect(distanceM(base, { lat: north(1000), lon: base.lon })).toBeLessThan(1005)
  })
})

describe('walk verification', () => {
  it('a 12-minute walk of ~800 m is verified', () => {
    const r = walkNorth(70, 12)
    const s = summarize(r, WALK_RULES.normal, START + 12 * 60_000)
    expect(s.verified).toBe(true)
    expect(s.maxDistanceM).toBeGreaterThan(800)
    expect(s.durationMin).toBeCloseTo(12)
  })

  it('staying at home for 20 minutes is not a walk', () => {
    const s = summarize(walkNorth(0, 20), WALK_RULES.normal, START + 20 * 60_000)
    expect(s.verified).toBe(false)
  })

  it('a quick dash to 400 m and back inside 3 minutes is too short', () => {
    expect(summarize(walkNorth(130, 3), WALK_RULES.normal, START + 3 * 60_000).verified).toBe(false)
  })

  it('rejects inaccurate fixes and GPS teleports', () => {
    let r = record()
    r = acceptFix(r, { ...base, accuracy: 8, at: START })
    r = acceptFix(r, { ...base, accuracy: 900, at: START + 60_000 }) // Wi-Fi guess
    r = acceptFix(r, { lat: north(5000), lon: base.lon, accuracy: 8, at: START + 120_000 }) // 5 km in 2 min
    expect(r.fixes).toHaveLength(1)
    expect(r.rejectedFixes).toBe(2)
  })

  it('distance must exceed the noise floor of a poor starting fix', () => {
    const r = walkNorth(5, 12, 45) // 60 m away but ±45 m at start → needs 90 m
    expect(summarize(r, WALK_RULES.demo, START + 12 * 60_000).verified).toBe(false)
  })

  it('time only counts while fixes keep arriving', () => {
    const r = walkNorth(70, 4)
    // ended much later, but the last evidence is at minute 4
    expect(summarize(r, WALK_RULES.normal, START + 30 * 60_000).durationMin).toBeCloseTo(4)
  })
})
