import { applyReward, createProfile, type RewardOutcome } from '../game/rewardEngine.ts'
import type { AppSettings, FieldMission, MissionEvidence, PlayerProfile, RewardTransaction, VerificationResult } from '../game/types.ts'
import { getDB } from './db.ts'

export const DEFAULT_SETTINGS: AppSettings = { theme: 'system', motion: 'system', sound: false }

export async function loadProfile(): Promise<PlayerProfile> {
  const db = await getDB()
  const stored = (await db.get('kv', 'profile')) as PlayerProfile | undefined
  if (stored && stored.version === 1) return stored
  const fresh = createProfile()
  await db.put('kv', fresh, 'profile')
  return fresh
}

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  await (await getDB()).put('kv', profile, 'profile')
}

export async function loadSettings(): Promise<AppSettings> {
  const stored = (await (await getDB()).get('kv', 'settings')) as AppSettings | undefined
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await (await getDB()).put('kv', settings, 'settings')
}

export async function listEvidence(): Promise<MissionEvidence[]> {
  const all = await (await getDB()).getAll('evidence')
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export async function getEvidence(id: string): Promise<MissionEvidence | undefined> {
  return (await getDB()).get('evidence', id)
}

export async function putEvidence(evidence: MissionEvidence): Promise<void> {
  await (await getDB()).put('evidence', evidence)
}

export async function updateEvidence(id: string, patch: Partial<MissionEvidence>): Promise<MissionEvidence | undefined> {
  const db = await getDB()
  const tx = db.transaction('evidence', 'readwrite')
  const current = await tx.store.get(id)
  if (!current) {
    await tx.done
    return undefined
  }
  const next = { ...current, ...patch, id }
  await tx.store.put(next)
  await tx.done
  return next
}

export async function deleteEvidence(id: string): Promise<void> {
  await (await getDB()).delete('evidence', id)
}

export async function listRewards(): Promise<RewardTransaction[]> {
  return (await getDB()).getAll('rewards')
}

/**
 * Marks the evidence verified and grants the contract reward inside ONE IndexedDB
 * transaction. A second call (double click, retry, another tab, reload) finds the
 * completion key and grants nothing.
 */
export async function grantVerifiedReward(
  contractId: string,
  evidenceId: string,
  verification: { result: VerificationResult; model: string },
  now = new Date(),
): Promise<RewardOutcome> {
  const db = await getDB()
  const tx = db.transaction(['kv', 'rewards', 'evidence'], 'readwrite')
  const profile = ((await tx.objectStore('kv').get('profile')) as PlayerProfile | undefined) ?? createProfile(now)
  const keys = new Set(await tx.objectStore('rewards').getAllKeys())
  const outcome = applyReward(profile, keys, contractId, evidenceId, now)

  const evidence = await tx.objectStore('evidence').get(evidenceId)
  if (evidence) {
    await tx.objectStore('evidence').put({
      ...evidence,
      status: 'verified',
      result: verification.result,
      model: verification.model,
      verifiedAt: now.toISOString(),
      lastError: undefined,
    })
  }
  if (outcome.transaction) {
    await tx.objectStore('rewards').put(outcome.transaction)
    await tx.objectStore('kv').put(outcome.profile, 'profile')
  }
  await tx.done
  return outcome
}

export async function resetAllData(): Promise<PlayerProfile> {
  const db = await getDB()
  const tx = db.transaction(['kv', 'rewards', 'evidence'], 'readwrite')
  await Promise.all([tx.objectStore('rewards').clear(), tx.objectStore('evidence').clear()])
  const fresh = createProfile()
  await tx.objectStore('kv').put(fresh, 'profile')
  await tx.done
  return fresh
}

/** Replaces all game data with an imported backup (already validated). */
export async function replaceAllData(data: { profile: PlayerProfile; rewards: RewardTransaction[]; evidence: MissionEvidence[] }) {
  const db = await getDB()
  const tx = db.transaction(['kv', 'rewards', 'evidence'], 'readwrite')
  await Promise.all([tx.objectStore('rewards').clear(), tx.objectStore('evidence').clear()])
  for (const r of data.rewards) await tx.objectStore('rewards').put(r)
  for (const e of data.evidence) await tx.objectStore('evidence').put(e)
  await tx.objectStore('kv').put(data.profile, 'profile')
  await tx.done
}

export async function loadFieldMission(): Promise<FieldMission | null> {
  return ((await (await getDB()).get('kv', 'field')) as FieldMission | undefined) ?? null
}

export async function saveFieldMission(field: FieldMission | null): Promise<void> {
  const db = await getDB()
  if (field) await db.put('kv', field, 'field')
  else await db.delete('kv', 'field')
}
