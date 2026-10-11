/**
 * Pure game rules. Persistence wraps these in a single IndexedDB transaction so a
 * reward can be granted at most once per contract completion, even across reloads.
 */
import { CONTRACTS, getContract } from '../content/contracts.ts'
import { levelForXp } from './levels.ts'
import type { ContractStatus, PlayerProfile, RewardTransaction, RoomStage, ToolId } from './types.ts'

export function createProfile(now = new Date()): PlayerProfile {
  return {
    version: 1,
    xp: 0,
    level: 1,
    roomStage: 0,
    createdAt: now.toISOString(),
    onboardedAt: null,
    completedContracts: [],
    unlockedToolIds: ['assistant'],
    contracts: { [CONTRACTS[0].id]: { status: 'available', challengeAttempts: 0 } },
    lastAchievement: null,
  }
}

export function completionKey(contractId: string): string {
  return `contract:${contractId}:mission`
}

export function contractStatus(profile: PlayerProfile, contractId: string): ContractStatus {
  const progress = profile.contracts[contractId]
  if (progress) return progress.status
  const contract = getContract(contractId)
  if (!contract) return 'locked'
  const previous = CONTRACTS.find((c) => c.order === contract.order - 1)
  if (!previous || profile.completedContracts.includes(previous.id)) return 'available'
  return 'locked'
}

/** The contract the player should act on next, or null when everything is complete. */
export function currentContract(profile: PlayerProfile) {
  return CONTRACTS.find((c) => contractStatus(profile, c.id) !== 'completed' && contractStatus(profile, c.id) !== 'locked') ?? null
}

export function startContract(profile: PlayerProfile, contractId: string): PlayerProfile {
  const status = contractStatus(profile, contractId)
  if (status !== 'available') return profile
  return {
    ...profile,
    contracts: { ...profile.contracts, [contractId]: { status: 'coding', challengeAttempts: 0 } },
  }
}

/** Records a challenge attempt; a correct answer moves the contract to its outdoor mission. */
export function submitChallenge(profile: PlayerProfile, contractId: string, choiceId: string, now = new Date()): { profile: PlayerProfile; correct: boolean } {
  const contract = getContract(contractId)
  if (!contract) return { profile, correct: false }
  const status = contractStatus(profile, contractId)
  const correct = choiceId === contract.challenge.correctChoiceId
  if (status !== 'coding' && status !== 'available') return { profile, correct }

  const prev = profile.contracts[contractId] ?? { status: 'coding' as const, challengeAttempts: 0 }
  const next = {
    ...prev,
    challengeAttempts: prev.challengeAttempts + 1,
    ...(correct ? { status: 'mission' as const, challengeSolvedAt: now.toISOString() } : { status: 'coding' as const }),
  }
  return { profile: { ...profile, contracts: { ...profile.contracts, [contractId]: next } }, correct }
}

export function chooseVariant(profile: PlayerProfile, contractId: string, variantId: string): PlayerProfile {
  const prev = profile.contracts[contractId]
  if (!prev) return profile
  return { ...profile, contracts: { ...profile.contracts, [contractId]: { ...prev, variantId } } }
}

export interface RewardOutcome {
  profile: PlayerProfile
  transaction: RewardTransaction | null
  alreadyGranted: boolean
}

/**
 * Applies a contract's reward exactly once. `grantedKeys` holds completion keys that are
 * already persisted. Returns the unchanged profile when the key exists or the contract
 * is not at its mission stage.
 */
export function applyReward(
  profile: PlayerProfile,
  grantedKeys: ReadonlySet<string>,
  contractId: string,
  evidenceId: string,
  now = new Date(),
): RewardOutcome {
  const contract = getContract(contractId)
  const key = completionKey(contractId)
  if (!contract) return { profile, transaction: null, alreadyGranted: false }
  if (grantedKeys.has(key) || profile.completedContracts.includes(contractId)) {
    return { profile, transaction: null, alreadyGranted: true }
  }
  if (contractStatus(profile, contractId) !== 'mission') return { profile, transaction: null, alreadyGranted: false }

  const xp = profile.xp + contract.reward.xp
  const level = levelForXp(xp)
  const roomStage = Math.min(3, profile.completedContracts.length + 1) as RoomStage
  const toolId: ToolId = contract.reward.toolId
  const unlockedToolIds = profile.unlockedToolIds.includes(toolId) ? profile.unlockedToolIds : [...profile.unlockedToolIds, toolId]
  const at = now.toISOString()

  const nextContract = CONTRACTS.find((c) => c.order === contract.order + 1)
  const contracts = {
    ...profile.contracts,
    [contractId]: { ...profile.contracts[contractId], status: 'completed' as const, completedAt: at },
    ...(nextContract && !profile.contracts[nextContract.id]
      ? { [nextContract.id]: { status: 'available' as const, challengeAttempts: 0 } }
      : {}),
  }

  const next: PlayerProfile = {
    ...profile,
    xp,
    level: level.level,
    roomStage,
    unlockedToolIds,
    completedContracts: [...profile.completedContracts, contractId],
    contracts,
    lastAchievement: { title: contract.reward.achievement, detail: `${contract.title} · +${contract.reward.xp} XP`, at },
  }

  const transaction: RewardTransaction = {
    completionKey: key,
    contractId,
    evidenceId,
    xpAmount: contract.reward.xp,
    toolsUnlocked: [toolId],
    roomStageFrom: profile.roomStage,
    roomStageTo: roomStage,
    levelFrom: profile.level,
    levelTo: level.level,
    grantedAt: at,
  }
  return { profile: next, transaction, alreadyGranted: false }
}
