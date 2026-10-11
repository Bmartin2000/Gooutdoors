/**
 * Admin test overrides: skip a walk, a photo check, a job, energy or a level so you can
 * try the whole loop quickly. Every override is written to the activity feed as such —
 * nothing here pretends to be a GPS walk or an AI verification.
 */
import { getChallenge } from '../content/challenges.ts'
import { addFeed, applyWalk, MAX_ENERGY, submitAnswer, type GrantOutcome, type SubmitOutcome } from './economy.ts'
import { LEVELS, levelForXp } from './levels.ts'
import type { PlayerProfile, VerificationResult, WalkSummary } from './types.ts'

export const ADMIN_PHOTO_RESULT: VerificationResult = {
  matches: true,
  confidence: 1,
  reason: 'Approved by admin override — not checked by the local AI.',
  detectedElements: [],
  needsReview: false,
}

export function adminWalk(profile: PlayerProfile, keys: ReadonlySet<string>, now = new Date()): GrantOutcome {
  const summary: WalkSummary = {
    id: `admin-${now.getTime().toString(36)}`,
    startedAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
    endedAt: now.toISOString(),
    durationMin: 10,
    maxDistanceM: 150,
    pathM: 0,
    fixes: 0,
    rejectedFixes: 0,
    verified: true,
    thresholds: { minMinutes: 10, minDistanceM: 150 },
  }
  const out = applyWalk(profile, keys, summary, now)
  return { ...out, profile: addFeed(out.profile, 'info', 'Admin override: walk skipped (not GPS-verified).', now) }
}

export function adminFinishJob(profile: PlayerProfile, now = new Date()): SubmitOutcome | null {
  const job = profile.activeJob
  const challenge = job && getChallenge(job.offer.challengeId)
  if (!job || !challenge) return null
  const out = submitAnswer(profile, challenge.correctChoiceId, now)
  return { ...out, profile: addFeed(out.profile, 'info', `Admin override: “${job.offer.title}” completed without solving.`, now) }
}

export function adminRefill(profile: PlayerProfile, now = new Date()): PlayerProfile {
  return addFeed({ ...profile, energy: MAX_ENERGY, energyUpdatedAt: now.toISOString() }, 'info', 'Admin override: energy refilled.', now)
}

export function adminLevelUp(profile: PlayerProfile, now = new Date()): PlayerProfile {
  const next = LEVELS.find((l) => l.level === levelForXp(profile.xp).level + 1)
  if (!next) return profile
  return addFeed({ ...profile, xp: next.minXp }, 'level', `Admin override: jumped to level ${next.level}.`, now)
}

export function adminGrant(profile: PlayerProfile, tokens: number, money: number, now = new Date()): PlayerProfile {
  return addFeed({ ...profile, tokens: profile.tokens + tokens, money: profile.money + money }, 'info', `Admin override: +${tokens} 🌿 +$${money}.`, now)
}
