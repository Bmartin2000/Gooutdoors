import { describe, expect, it } from 'vitest'
import { CHALLENGES, getChallenge } from '../src/content/challenges.ts'
import {
  acceptJob,
  applyEnergyRegen,
  applyPhoto,
  applyWalk,
  buyUpgrade,
  createProfile,
  eligibility,
  MAX_BOARD,
  refreshBoard,
  skillLevel,
  submitAnswer,
  useHint,
} from '../src/game/economy.ts'
import type { MissionEvidence, PlayerProfile, WalkSummary } from '../src/game/types.ts'

const T0 = new Date('2026-10-11T08:00:00Z')
const seq = () => {
  let s = 1
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function acceptFirst(p: PlayerProfile) {
  return acceptJob(p, p.board[0].id, T0)
}

const walk = (over: Partial<WalkSummary> = {}): WalkSummary => ({
  id: 'w1',
  startedAt: T0.toISOString(),
  endedAt: T0.toISOString(),
  durationMin: 14,
  maxDistanceM: 420,
  pathM: 900,
  fixes: 40,
  rejectedFixes: 2,
  verified: true,
  thresholds: { minMinutes: 10, minDistanceM: 150 },
  ...over,
})

describe('job board', () => {
  it('starts with two doable jobs and full energy', () => {
    const p = createProfile(T0, seq())
    expect(p.board).toHaveLength(2)
    expect(p.energy).toBe(100)
    for (const o of p.board) expect(eligibility(p, getChallenge(o.challengeId)!).ok).toBe(true)
  })

  it('adds one offer per elapsed interval, capped, and expires stale ones', () => {
    const p = createProfile(T0, seq())
    const twoHours = new Date(T0.getTime() + 2 * 3_600_000 + 1000)
    const { profile, arrived } = refreshBoard(p, twoHours, 60, seq())
    expect(arrived).toHaveLength(2)
    expect(profile.board).toHaveLength(4)
    const muchLater = refreshBoard(profile, new Date(T0.getTime() + 40 * 3_600_000), 60, seq())
    expect(muchLater.profile.board.length).toBeLessThanOrEqual(MAX_BOARD)
    expect(muchLater.expired).toBeGreaterThan(0)
  })

  it('locks jobs that need skills you do not have yet', () => {
    const p = createProfile(T0, seq())
    const async = CHALLENGES.find((c) => c.id === 'async-foreach')!
    const e = eligibility(p, async)
    expect(e.ok).toBe(false)
    expect(e.missingSkills.map((m) => m.skill)).toEqual(expect.arrayContaining(['typescript', 'debugging']))
    expect(e.missingLevel).toBe(2)
  })
})

describe('working a job', () => {
  it('accepting costs energy and moves the offer to active', () => {
    const p = createProfile(T0, seq())
    const { profile, error } = acceptFirst(p)
    expect(error).toBeNull()
    expect(profile.activeJob?.offer.id).toBe(p.board[0].id)
    expect(profile.energy).toBe(100 - p.board[0].energyCost)
    expect(acceptJob(profile, profile.board[0].id, T0).error).toBe('busy')
  })

  it('refuses without enough energy', () => {
    const p = { ...createProfile(T0, seq()), energy: 5 }
    expect(acceptFirst(p).error).toBe('no-energy')
  })

  it('a correct answer pays money, XP and skill points exactly once', () => {
    const { profile } = acceptFirst(createProfile(T0, seq()))
    const c = getChallenge(profile.activeJob!.offer.challengeId)!
    const out = submitAnswer(profile, c.correctChoiceId, T0)
    expect(out.finished).toBe('done')
    expect(out.profile.money).toBe(profile.activeJob!.offer.pay)
    expect(out.profile.skills.debugging).toBe(1)
    expect(out.ledger?.key).toBe(`job:${profile.activeJob!.offer.id}`)
    // nothing active any more → a second submit grants nothing
    expect(submitAnswer(out.profile, c.correctChoiceId, T0).ledger).toBeNull()
  })

  it('two wrong answers cancel the job; a hint token removes a wrong option', () => {
    const { profile } = acceptFirst({ ...createProfile(T0, seq()), tokens: 1 })
    const c = getChallenge(profile.activeJob!.offer.challengeId)!
    const hinted = useHint(profile)
    expect(hinted.tokens).toBe(0)
    expect(hinted.activeJob!.eliminated).toHaveLength(1)
    expect(hinted.activeJob!.eliminated[0]).not.toBe(c.correctChoiceId)
    const wrong = c.choices.find((x) => x.id !== c.correctChoiceId)!.id
    const once = submitAnswer(hinted, wrong, T0)
    expect(once.finished).toBeNull()
    const twice = submitAnswer(once.profile, wrong, T0)
    expect(twice.finished).toBe('failed')
    expect(twice.profile.activeJob).toBeNull()
  })
})

describe('outdoors', () => {
  it('a verified walk refills energy and grants tokens + XP once', () => {
    const p = { ...createProfile(T0, seq()), energy: 10 }
    const once = applyWalk(p, new Set(), walk(), T0)
    expect(once.profile.energy).toBe(100)
    expect(once.profile.tokens).toBe(3)
    expect(once.profile.xp).toBe(100)
    const twice = applyWalk(once.profile, new Set([once.ledger!.key]), walk(), T0)
    expect(twice.alreadyGranted).toBe(true)
    expect(twice.profile.tokens).toBe(3)
  })

  it('an unverified walk grants nothing', () => {
    const p = createProfile(T0, seq())
    expect(applyWalk(p, new Set(), walk({ verified: false }), T0).ledger).toBeNull()
  })

  it('photo rewards are limited to one per walk', () => {
    const p = createProfile(T0, seq())
    const ev = { id: 'e1', missionId: 'natures-debugger', walkId: 'w1', capturedAt: T0.toISOString() } as MissionEvidence
    const first = applyPhoto(p, new Set(), ev, T0)
    expect(first.profile.tokens).toBe(2)
    const second = applyPhoto(first.profile, new Set([first.ledger!.key]), { ...ev, id: 'e2' }, T0)
    expect(second.alreadyGranted).toBe(true)
  })

  it('passive energy regenerates slowly (8/h), never above 100', () => {
    const p = { ...createProfile(T0, seq()), energy: 40 }
    expect(applyEnergyRegen(p, new Date(T0.getTime() + 2.5 * 3_600_000)).energy).toBe(60)
    expect(applyEnergyRegen(p, new Date(T0.getTime() + 48 * 3_600_000)).energy).toBe(100)
  })
})

describe('shop and skills', () => {
  it('plants cost tokens, tech costs money, and items are level-gated', () => {
    const p = { ...createProfile(T0, seq()), tokens: 3, money: 100 }
    expect(buyUpgrade(p, 'desk-seedling').profile.tokens).toBe(1)
    expect(buyUpgrade(p, 'coffee').profile.money).toBe(20)
    expect(buyUpgrade(p, 'desk-lamp').error).toBe('funds')
    expect(buyUpgrade(p, 'hanging-plant').error).toBe('level')
    const owned = buyUpgrade(p, 'desk-seedling').profile
    expect(buyUpgrade(owned, 'desk-seedling').error).toBe('owned')
  })

  it('skill levels follow 1/3/6/10 point thresholds', () => {
    expect([0, 1, 2, 3, 6, 10].map(skillLevel)).toEqual([0, 1, 1, 2, 3, 4])
  })
})
