import { describe, expect, it } from 'vitest'
import { adminFinishJob, adminGrant, adminLevelUp, adminRefill, adminWalk } from '../src/game/admin.ts'
import { acceptJob, createProfile } from '../src/game/economy.ts'
import { levelForXp } from '../src/game/levels.ts'

const T0 = new Date('2026-10-11T08:00:00Z')

describe('admin overrides', () => {
  it('a skipped walk grants the walk reward once and is logged as an override', () => {
    const p = { ...createProfile(T0), energy: 5 }
    const out = adminWalk(p, new Set(), T0)
    expect(out.profile.energy).toBe(100)
    expect(out.ledger?.key).toMatch(/^walk:admin-/)
    expect(out.profile.feed[0].text).toMatch(/Admin override/)
    expect(adminWalk(out.profile, new Set([out.ledger!.key]), T0).ledger).toBeNull()
  })

  it('completes the active job with pay, and is logged', () => {
    const p = createProfile(T0)
    const { profile } = acceptJob(p, p.board[0].id, T0)
    const out = adminFinishJob(profile, T0)!
    expect(out.finished).toBe('done')
    expect(out.profile.money).toBe(profile.activeJob!.offer.pay)
    expect(out.profile.feed[0].text).toMatch(/Admin override/)
    expect(adminFinishJob(out.profile, T0)).toBeNull()
  })

  it('refill, level-up and grant are logged', () => {
    const p = { ...createProfile(T0), energy: 10 }
    expect(adminRefill(p, T0).energy).toBe(100)
    expect(levelForXp(adminLevelUp(p, T0).xp).level).toBe(2)
    const g = adminGrant(p, 5, 200, T0)
    expect([g.tokens, g.money]).toEqual([5, 200])
    for (const x of [adminRefill(p, T0), adminLevelUp(p, T0), g]) expect(x.feed[0].text).toMatch(/Admin override/)
  })
})
