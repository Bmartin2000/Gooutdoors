/**
 * Pure game rules: job board, skills, energy, money, tokens, rewards.
 * Persistence wraps reward-granting calls in single IndexedDB transactions keyed by
 * unique ledger keys, so nothing can be granted twice.
 */
import { CHALLENGES, CLIENTS, getChallenge } from '../content/challenges.ts'
import { newGeneratedId } from '../content/generators.ts'
import { getMission } from '../content/missions.ts'
import { getShopItem } from '../content/shop.ts'
import { levelForXp } from './levels.ts'
import type {
  Challenge,
  FeedItem,
  JobOffer,
  LedgerEntry,
  MissionEvidence,
  PlayerProfile,
  SkillId,
  Skills,
  UpgradeId,
  WalkSummary,
} from './types.ts'

export const MAX_ENERGY = 100
export const MAX_BOARD = 5
export const MAX_ATTEMPTS = 2
export const PASSIVE_ENERGY_PER_HOUR = 8
const SKILL_THRESHOLDS = [1, 3, 6, 10]

const ZERO_SKILLS: Skills = { debugging: 0, typescript: 0, testing: 0, performance: 0, async: 0 }

export function skillLevel(points: number): number {
  return SKILL_THRESHOLDS.filter((t) => points >= t).length
}

export function skillsFromPoints(points: Skills): Skills {
  const out = { ...ZERO_SKILLS }
  for (const k of Object.keys(points) as SkillId[]) out[k] = skillLevel(points[k])
  return out
}

/** Points still needed for the next level of a skill (null at max). */
export function pointsToNext(points: number): number | null {
  const next = SKILL_THRESHOLDS.find((t) => points < t)
  return next === undefined ? null : next - points
}

function makeId(prefix: string, now: Date, rng: () => number) {
  return `${prefix}-${now.getTime().toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`
}

function pushFeed(profile: PlayerProfile, kind: FeedItem['kind'], text: string, now: Date): FeedItem[] {
  const item: FeedItem = { id: `f-${now.getTime().toString(36)}-${profile.feed.length}`, at: now.toISOString(), kind, text }
  return [item, ...profile.feed].slice(0, 30)
}

/* ───────────── jobs ───────────── */

export function offerFor(challenge: Challenge, now: Date, rng: () => number, intervalMin: number, repeat = false, featured = false): JobOffer {
  const client = CLIENTS[Math.floor(rng() * CLIENTS.length)]
  const basePay = 60 * challenge.difficulty + Math.round((rng() * 40) / 5) * 5
  const lifetimeMin = featured ? 24 * 60 : Math.max(180, intervalMin * 6)
  const k = featured ? 1.5 : repeat ? 0.6 : 1
  return {
    id: makeId('job', now, rng),
    challengeId: challenge.id,
    client,
    title: challenge.title,
    pitch: challenge.brief,
    pay: Math.round((basePay * k) / 5) * 5,
    xp: Math.round(40 * challenge.difficulty * (featured ? 1.5 : repeat ? 0.5 : 1)),
    energyCost: 15 + 10 * challenge.difficulty,
    arrivedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lifetimeMin * 60_000).toISOString(),
    ...(featured ? { featured: true } : {}),
  }
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/** A fresh procedural job: new app, story, names and data every time. */
export function generatedChallenge(profile: PlayerProfile, now: Date, rng: () => number, tierBoost = 0): Challenge {
  const level = levelForXp(profile.xp).level
  const stretch = rng() < 0.25 ? 1 : 0
  const tier = Math.min(3, Math.max(1, level + stretch + tierBoost))
  const seed = `${dayKey(now).replace(/-/g, '')}-${Math.floor(rng() * 1e9).toString(36)}`
  return getChallenge(newGeneratedId(rng, seed, tier))!
}

export function createProfile(now = new Date(), rng: () => number = Math.random): PlayerProfile {
  const first = [getChallenge('broken-counter')!, getChallenge('trailing-slug')!]
  return {
    version: 2,
    createdAt: now.toISOString(),
    xp: 0,
    money: 0,
    tokens: 0,
    energy: MAX_ENERGY,
    energyUpdatedAt: now.toISOString(),
    skills: { ...ZERO_SKILLS },
    skillPoints: { ...ZERO_SKILLS },
    board: first.map((c) => offerFor(c, now, rng, 60)),
    activeJob: null,
    lastArrivalAt: now.toISOString(),
    completedChallenges: [],
    jobsDone: 0,
    jobsFailed: 0,
    upgrades: [],
    walksVerified: 0,
    minutesOutside: 0,
    feed: [{ id: 'f-welcome', at: now.toISOString(), kind: 'info', text: 'Two job offers are waiting in your inbox.' }],
  }
}

export interface Eligibility {
  ok: boolean
  missingLevel: number | null
  missingSkills: { skill: SkillId; need: number; have: number }[]
}

export function eligibility(profile: PlayerProfile, challenge: Challenge): Eligibility {
  const level = levelForXp(profile.xp).level
  const missingSkills = (Object.entries(challenge.requires) as [SkillId, number][])
    .filter(([skill, need]) => profile.skills[skill] < need)
    .map(([skill, need]) => ({ skill, need, have: profile.skills[skill] }))
  const missingLevel = level < challenge.minLevel ? challenge.minLevel : null
  return { ok: !missingSkills.length && missingLevel === null, missingLevel, missingSkills }
}

/**
 * Picks the next challenge for the board: unfinished work first, a mix of jobs the
 * player can take now and a few they can't yet (so there is something to grow towards).
 */
export function pickChallenge(profile: PlayerProfile, rng: () => number): { challenge: Challenge; repeat: boolean } | null {
  const taken = new Set([...profile.board.map((o) => o.challengeId), profile.activeJob?.offer.challengeId])
  const fresh = CHALLENGES.filter((c) => !taken.has(c.id) && !profile.completedChallenges.includes(c.id))
  // Half of all offers are freshly generated, so there is always something new.
  if (rng() < 0.5 || !fresh.length) return { challenge: generatedChallenge(profile, new Date(), rng), repeat: false }
  if (fresh.length) {
    const doable = fresh.filter((c) => eligibility(profile, c).ok)
    const stretch = fresh.filter((c) => !eligibility(profile, c).ok)
    const pool = doable.length && (rng() < 0.65 || !stretch.length) ? doable : stretch.length ? stretch : doable
    return { challenge: pool[Math.floor(rng() * pool.length)], repeat: false }
  }
  const repeats = CHALLENGES.filter((c) => !taken.has(c.id))
  if (!repeats.length) return null
  return { challenge: repeats[Math.floor(rng() * repeats.length)], repeat: true }
}

export function applyEnergyRegen(profile: PlayerProfile, now: Date): PlayerProfile {
  const hours = (now.getTime() - Date.parse(profile.energyUpdatedAt)) / 3_600_000
  const gain = Math.floor(hours * PASSIVE_ENERGY_PER_HOUR)
  if (gain <= 0) return profile
  const used = gain / PASSIVE_ENERGY_PER_HOUR
  return {
    ...profile,
    energy: Math.min(MAX_ENERGY, profile.energy + gain),
    energyUpdatedAt: new Date(Date.parse(profile.energyUpdatedAt) + used * 3_600_000).toISOString(),
  }
}

/** Expires stale offers and adds one new offer per elapsed interval (board capped). */
export function refreshBoard(
  profile: PlayerProfile,
  now: Date,
  intervalMin: number,
  rng: () => number = Math.random,
): { profile: PlayerProfile; arrived: JobOffer[]; expired: number } {
  const nowMs = now.getTime()
  const kept = profile.board.filter((o) => Date.parse(o.expiresAt) > nowMs)
  const expired = profile.board.length - kept.length
  let next: PlayerProfile = { ...profile, board: kept }
  const due = Math.floor((nowMs - Date.parse(profile.lastArrivalAt)) / (intervalMin * 60_000))
  const arrived: JobOffer[] = []
  for (let i = 0; i < due && next.board.length < MAX_BOARD; i++) {
    const pick = pickChallenge(next, rng)
    if (!pick) break
    const offer = offerFor(pick.challenge, now, rng, intervalMin, pick.repeat)
    arrived.push(offer)
    next = { ...next, board: [...next.board, offer] }
  }
  if (due > 0) next = { ...next, lastArrivalAt: new Date(Date.parse(profile.lastArrivalAt) + due * intervalMin * 60_000).toISOString() }
  // Today's featured contract: one per day, bigger pay.
  const today = dayKey(now)
  if (next.lastFeaturedDay !== today) {
    const challenge = generatedChallenge(next, now, rng, 0)
    const offer = offerFor(challenge, now, rng, intervalMin, false, true)
    let board = next.board
    if (board.length >= MAX_BOARD) {
      // Make room by dropping the oldest regular offer.
      const oldest = [...board].filter((o) => !o.featured).sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt))[0]
      board = board.filter((o) => o !== oldest)
    }
    arrived.push(offer)
    next = { ...next, board: [offer, ...board], lastFeaturedDay: today }
  }
  for (const offer of arrived) next = { ...next, feed: pushFeed(next, 'job-arrived', `${offer.featured ? 'Today’s contract' : 'New offer'} from ${offer.client}: ${offer.title}`, now) }
  if (!arrived.length && !expired && next === profile) return { profile, arrived, expired }
  return { profile: next, arrived, expired }
}

export type AcceptError = 'busy' | 'not-found' | 'not-qualified' | 'no-energy'

export function acceptJob(profile: PlayerProfile, offerId: string, now = new Date()): { profile: PlayerProfile; error: AcceptError | null } {
  if (profile.activeJob) return { profile, error: 'busy' }
  const offer = profile.board.find((o) => o.id === offerId)
  const challenge = offer && getChallenge(offer.challengeId)
  if (!offer || !challenge) return { profile, error: 'not-found' }
  if (!eligibility(profile, challenge).ok) return { profile, error: 'not-qualified' }
  if (profile.energy < offer.energyCost) return { profile, error: 'no-energy' }
  return {
    profile: {
      ...profile,
      energy: profile.energy - offer.energyCost,
      board: profile.board.filter((o) => o.id !== offerId),
      activeJob: { offer, acceptedAt: now.toISOString(), attempts: 0, eliminated: [] },
    },
    error: null,
  }
}

/** Spend one fresh-air token to remove a wrong option from the active job. */
export function useHint(profile: PlayerProfile): PlayerProfile {
  const job = profile.activeJob
  const challenge = job && getChallenge(job.offer.challengeId)
  if (!job || !challenge || profile.tokens < 1) return profile
  const wrong = challenge.choices.find((c) => c.id !== challenge.correctChoiceId && !job.eliminated.includes(c.id))
  if (!wrong) return profile
  return { ...profile, tokens: profile.tokens - 1, activeJob: { ...job, eliminated: [...job.eliminated, wrong.id] } }
}

export interface SubmitOutcome {
  profile: PlayerProfile
  correct: boolean
  finished: 'done' | 'failed' | null
  ledger: LedgerEntry | null
  levelUp: number | null
}

export function submitAnswer(profile: PlayerProfile, choiceId: string, now = new Date()): SubmitOutcome {
  const job = profile.activeJob
  const challenge = job && getChallenge(job.offer.challengeId)
  if (!job || !challenge) return { profile, correct: false, finished: null, ledger: null, levelUp: null }
  const correct = choiceId === challenge.correctChoiceId
  const attempts = job.attempts + 1

  if (correct) {
    const skillPoints = { ...profile.skillPoints }
    for (const s of challenge.trains) skillPoints[s] += challenge.difficulty
    const before = levelForXp(profile.xp).level
    const xp = profile.xp + job.offer.xp
    const after = levelForXp(xp).level
    let next: PlayerProfile = {
      ...profile,
      xp,
      money: profile.money + job.offer.pay,
      skillPoints,
      skills: skillsFromPoints(skillPoints),
      activeJob: null,
      jobsDone: profile.jobsDone + 1,
      completedChallenges: profile.completedChallenges.includes(challenge.id) ? profile.completedChallenges : [...profile.completedChallenges, challenge.id],
    }
    next = { ...next, feed: pushFeed(next, 'job-done', `${job.offer.client} paid $${job.offer.pay} for “${job.offer.title}”.`, now) }
    if (after > before) next = { ...next, feed: pushFeed(next, 'level', `Level up: you are now level ${after}.`, now) }
    return {
      profile: next,
      correct,
      finished: 'done',
      ledger: { key: `job:${job.offer.id}`, kind: 'job', money: job.offer.pay, tokens: 0, xp: job.offer.xp, at: now.toISOString() },
      levelUp: after > before ? after : null,
    }
  }

  if (attempts >= MAX_ATTEMPTS) {
    let next: PlayerProfile = { ...profile, activeJob: null, jobsFailed: profile.jobsFailed + 1 }
    next = { ...next, feed: pushFeed(next, 'job-failed', `${job.offer.client} cancelled “${job.offer.title}”.`, now) }
    return { profile: next, correct, finished: 'failed', ledger: null, levelUp: null }
  }
  return { profile: { ...profile, activeJob: { ...job, attempts } }, correct, finished: null, ledger: null, levelUp: null }
}

export function abandonJob(profile: PlayerProfile, now = new Date()): PlayerProfile {
  if (!profile.activeJob) return profile
  const next = { ...profile, activeJob: null, jobsFailed: profile.jobsFailed + 1 }
  return { ...next, feed: pushFeed(next, 'job-failed', `You handed back “${profile.activeJob.offer.title}”.`, now) }
}

export function declineOffer(profile: PlayerProfile, offerId: string): PlayerProfile {
  return { ...profile, board: profile.board.filter((o) => o.id !== offerId) }
}

/* ───────────── shop ───────────── */

export type BuyError = 'owned' | 'level' | 'funds'

export function buyUpgrade(profile: PlayerProfile, id: UpgradeId, now = new Date()): { profile: PlayerProfile; error: BuyError | null } {
  const item = getShopItem(id)
  if (profile.upgrades.includes(id)) return { profile, error: 'owned' }
  if (levelForXp(profile.xp).level < item.minLevel) return { profile, error: 'level' }
  const balance = item.currency === 'tokens' ? profile.tokens : profile.money
  if (balance < item.price) return { profile, error: 'funds' }
  let next: PlayerProfile = {
    ...profile,
    upgrades: [...profile.upgrades, id],
    ...(item.currency === 'tokens' ? { tokens: profile.tokens - item.price } : { money: profile.money - item.price }),
  }
  next = { ...next, feed: pushFeed(next, 'purchase', `${item.name} added to your office.`, now) }
  return { profile: next, error: null }
}

/* ───────────── outdoors ───────────── */

export function walkReward(summary: WalkSummary) {
  const minutes = Math.floor(summary.durationMin)
  return { tokens: Math.min(6, 1 + Math.floor(minutes / 5)), xp: Math.min(120, 30 + 5 * minutes) }
}

export interface GrantOutcome {
  profile: PlayerProfile
  ledger: LedgerEntry | null
  alreadyGranted: boolean
  levelUp: number | null
}

/** Credits a GPS-verified walk once (key `walk:<id>`): tokens, XP and a full energy refill. */
export function applyWalk(profile: PlayerProfile, keys: ReadonlySet<string>, summary: WalkSummary, now = new Date()): GrantOutcome {
  const key = `walk:${summary.id}`
  if (keys.has(key)) return { profile, ledger: null, alreadyGranted: true, levelUp: null }
  if (!summary.verified) return { profile, ledger: null, alreadyGranted: false, levelUp: null }
  const { tokens, xp } = walkReward(summary)
  const before = levelForXp(profile.xp).level
  const after = levelForXp(profile.xp + xp).level
  let next: PlayerProfile = {
    ...profile,
    xp: profile.xp + xp,
    tokens: profile.tokens + tokens,
    energy: MAX_ENERGY,
    energyUpdatedAt: now.toISOString(),
    walksVerified: profile.walksVerified + 1,
    minutesOutside: profile.minutesOutside + Math.round(summary.durationMin),
  }
  next = {
    ...next,
    feed: pushFeed(
      next,
      'walk',
      summary.override === 'admin'
        ? `Admin override (phone): walk skipped, not GPS-verified. +${tokens} 🌿 +${xp} XP, energy full.`
        : `Walk verified: ${Math.round(summary.durationMin)} min, ${Math.round(summary.maxDistanceM)} m out. +${tokens} 🌿 +${xp} XP, energy full.`,
      now,
    ),
  }
  if (after > before) next = { ...next, feed: pushFeed(next, 'level', `Level up: you are now level ${after}.`, now) }
  return { profile: next, ledger: { key, kind: 'walk', money: 0, tokens, xp, at: now.toISOString() }, alreadyGranted: false, levelUp: after > before ? after : null }
}

/** One photo reward per walk (or per mission per day for photos taken without a walk). */
export function photoKey(evidence: Pick<MissionEvidence, 'walkId' | 'missionId' | 'capturedAt'>): string {
  return evidence.walkId ? `photo:walk:${evidence.walkId}` : `photo:${evidence.missionId}:${evidence.capturedAt.slice(0, 10)}`
}

export function applyPhoto(profile: PlayerProfile, keys: ReadonlySet<string>, evidence: MissionEvidence, now = new Date()): GrantOutcome {
  const key = photoKey(evidence)
  const mission = getMission(evidence.missionId)
  if (!mission) return { profile, ledger: null, alreadyGranted: false, levelUp: null }
  if (keys.has(key)) return { profile, ledger: null, alreadyGranted: true, levelUp: null }
  const before = levelForXp(profile.xp).level
  const after = levelForXp(profile.xp + mission.rewardXp).level
  let next: PlayerProfile = { ...profile, xp: profile.xp + mission.rewardXp, tokens: profile.tokens + mission.rewardTokens }
  next = { ...next, feed: pushFeed(next, 'photo', `${mission.title} verified by your local AI. +${mission.rewardTokens} 🌿 +${mission.rewardXp} XP.`, now) }
  if (after > before) next = { ...next, feed: pushFeed(next, 'level', `Level up: you are now level ${after}.`, now) }
  return {
    profile: next,
    ledger: { key, kind: 'photo', money: 0, tokens: mission.rewardTokens, xp: mission.rewardXp, at: now.toISOString() },
    alreadyGranted: false,
    levelUp: after > before ? after : null,
  }
}

export function addFeed(profile: PlayerProfile, kind: FeedItem['kind'], text: string, now = new Date()): PlayerProfile {
  return { ...profile, feed: pushFeed(profile, kind, text, now) }
}
