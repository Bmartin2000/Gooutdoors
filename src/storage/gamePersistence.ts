import { createProfile } from '../game/economy.ts'
import type { AppSettings, LedgerEntry, MissionEvidence, PhonePairing, PlayerProfile, WalkRecord } from '../game/types.ts'
import { getDB } from './db.ts'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  motion: 'system',
  sound: true,
  notifications: false,
  jobEveryMin: 2,
  demoWalk: false,
}

export async function loadProfile(): Promise<PlayerProfile> {
  const db = await getDB()
  const stored = (await db.get('kv', 'profile')) as PlayerProfile | undefined
  if (stored && stored.version === 2) return stored
  const fresh = createProfile()
  await db.put('kv', fresh, 'profile')
  return fresh
}

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  await (await getDB()).put('kv', profile, 'profile')
}

export async function loadSettings(): Promise<AppSettings> {
  const stored = (await (await getDB()).get('kv', 'settings')) as Partial<AppSettings> | undefined
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await (await getDB()).put('kv', settings, 'settings')
}

export async function loadPairing(): Promise<PhonePairing | null> {
  return ((await (await getDB()).get('kv', 'pairing')) as PhonePairing | undefined) ?? null
}

export async function savePairing(pairing: PhonePairing): Promise<void> {
  await (await getDB()).put('kv', pairing, 'pairing')
}

/* evidence */

export async function listEvidence(): Promise<MissionEvidence[]> {
  const all = await (await getDB()).getAll('evidence')
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export async function getEvidence(id: string) {
  return (await getDB()).get('evidence', id)
}

export async function putEvidence(evidence: MissionEvidence) {
  await (await getDB()).put('evidence', evidence)
}

export async function updateEvidence(id: string, patch: Partial<MissionEvidence>) {
  const db = await getDB()
  const tx = db.transaction('evidence', 'readwrite')
  const current = await tx.store.get(id)
  if (current) await tx.store.put({ ...current, ...patch, id })
  await tx.done
}

export async function deleteEvidence(id: string) {
  await (await getDB()).delete('evidence', id)
}

/* walks (capture device) */

export async function listWalks(): Promise<WalkRecord[]> {
  const all = await (await getDB()).getAll('walks')
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export async function putWalk(walk: WalkRecord) {
  await (await getDB()).put('walks', walk)
}

export async function deleteWalk(id: string) {
  await (await getDB()).delete('walks', id)
}

/* rewards */

export async function listLedger(): Promise<LedgerEntry[]> {
  return (await getDB()).getAll('ledger')
}

export interface GrantStep {
  profile: PlayerProfile
  ledger: LedgerEntry | null
}

/**
 * Runs a reward computation inside ONE readwrite transaction over profile, ledger and
 * evidence. The callback sees the stored profile and every granted key, so a reward
 * keyed on a walk, photo or job can only ever be written once — across double clicks,
 * reloads, tabs and repeated imports.
 */
export async function grantOnce(
  compute: (profile: PlayerProfile, keys: ReadonlySet<string>) => GrantStep,
  evidencePatch?: { id: string; patch: Partial<MissionEvidence> },
): Promise<GrantStep & { profileChanged: boolean }> {
  const db = await getDB()
  const tx = db.transaction(['kv', 'ledger', 'evidence'], 'readwrite')
  const stored = (await tx.objectStore('kv').get('profile')) as PlayerProfile | undefined
  const profile = stored && stored.version === 2 ? stored : createProfile()
  const keys = new Set(await tx.objectStore('ledger').getAllKeys())
  const step = compute(profile, keys)
  if (evidencePatch) {
    const ev = await tx.objectStore('evidence').get(evidencePatch.id)
    if (ev) await tx.objectStore('evidence').put({ ...ev, ...evidencePatch.patch })
  }
  if (step.ledger) await tx.objectStore('ledger').put(step.ledger)
  if (step.profile !== profile) await tx.objectStore('kv').put(step.profile, 'profile')
  await tx.done
  return { ...step, profileChanged: step.profile !== profile }
}

export async function resetAllData(): Promise<PlayerProfile> {
  const db = await getDB()
  const tx = db.transaction(['kv', 'ledger', 'evidence', 'walks'], 'readwrite')
  await Promise.all([tx.objectStore('ledger').clear(), tx.objectStore('evidence').clear(), tx.objectStore('walks').clear()])
  await tx.objectStore('kv').delete('pairing')
  const fresh = createProfile()
  await tx.objectStore('kv').put(fresh, 'profile')
  await tx.done
  return fresh
}

export async function replaceAllData(data: { profile: PlayerProfile; ledger: LedgerEntry[]; evidence: MissionEvidence[] }) {
  const db = await getDB()
  const tx = db.transaction(['kv', 'ledger', 'evidence'], 'readwrite')
  await Promise.all([tx.objectStore('ledger').clear(), tx.objectStore('evidence').clear()])
  for (const r of data.ledger) await tx.objectStore('ledger').put(r)
  for (const e of data.evidence) await tx.objectStore('evidence').put(e)
  await tx.objectStore('kv').put(data.profile, 'profile')
  await tx.done
}
