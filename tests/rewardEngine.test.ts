import { describe, expect, it } from 'vitest'
import { CONTRACTS } from '../src/content/contracts.ts'
import { levelForXp, levelProgress } from '../src/game/levels.ts'
import {
  applyReward,
  completionKey,
  contractStatus,
  createProfile,
  currentContract,
  startContract,
  submitChallenge,
} from '../src/game/rewardEngine.ts'

const [first, second] = CONTRACTS

function profileAtMission() {
  let p = createProfile(new Date('2026-10-11T10:00:00Z'))
  p = startContract(p, first.id)
  return submitChallenge(p, first.id, first.challenge.correctChoiceId).profile
}

describe('contract flow', () => {
  it('starts with only the first contract available', () => {
    const p = createProfile()
    expect(contractStatus(p, first.id)).toBe('available')
    expect(contractStatus(p, second.id)).toBe('locked')
    expect(currentContract(p)?.id).toBe(first.id)
    expect(p.unlockedToolIds).toEqual(['assistant'])
  })

  it('a wrong answer keeps the contract in coding and counts the attempt', () => {
    const p = startContract(createProfile(), first.id)
    const { profile, correct } = submitChallenge(p, first.id, 'b')
    expect(correct).toBe(false)
    expect(contractStatus(profile, first.id)).toBe('coding')
    expect(profile.contracts[first.id].challengeAttempts).toBe(1)
  })

  it('a correct answer unlocks the outdoor mission', () => {
    expect(contractStatus(profileAtMission(), first.id)).toBe('mission')
  })
})

describe('applyReward', () => {
  it('grants XP, level, room stage, the tool and unlocks the next contract', () => {
    const { profile, transaction, alreadyGranted } = applyReward(profileAtMission(), new Set(), first.id, 'ev-1')
    expect(alreadyGranted).toBe(false)
    expect(transaction?.completionKey).toBe(completionKey(first.id))
    expect(profile.xp).toBe(250)
    expect(profile.level).toBe(2)
    expect(profile.roomStage).toBe(1)
    expect(profile.unlockedToolIds).toContain('debugger')
    expect(contractStatus(profile, first.id)).toBe('completed')
    expect(contractStatus(profile, second.id)).toBe('available')
  })

  it('is idempotent: a persisted completion key grants nothing a second time', () => {
    const once = applyReward(profileAtMission(), new Set(), first.id, 'ev-1')
    const twice = applyReward(once.profile, new Set([once.transaction!.completionKey]), first.id, 'ev-2')
    expect(twice.alreadyGranted).toBe(true)
    expect(twice.transaction).toBeNull()
    expect(twice.profile).toBe(once.profile)
    expect(twice.profile.xp).toBe(250)
  })

  it('also refuses when the profile already lists the contract as completed (key store lost)', () => {
    const once = applyReward(profileAtMission(), new Set(), first.id, 'ev-1')
    const again = applyReward(once.profile, new Set(), first.id, 'ev-1')
    expect(again.alreadyGranted).toBe(true)
    expect(again.profile.xp).toBe(250)
  })

  it('refuses to reward a contract whose coding challenge is unsolved', () => {
    const p = startContract(createProfile(), first.id)
    const out = applyReward(p, new Set(), first.id, 'ev-1')
    expect(out.transaction).toBeNull()
    expect(out.profile.xp).toBe(0)
  })
})

describe('levels', () => {
  it('maps XP thresholds to named levels', () => {
    expect(levelForXp(0).name).toBe('Cold Start')
    expect(levelForXp(249).level).toBe(1)
    expect(levelForXp(250).name).toBe('First Growth')
    expect(levelForXp(750).name).toBe('Living System')
    expect(levelProgress(125).ratio).toBeCloseTo(0.5)
    expect(levelProgress(900).next).toBeNull()
  })
})
