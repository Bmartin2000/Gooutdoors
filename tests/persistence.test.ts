import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyPhoto, applyWalk } from '../src/game/economy.ts'
import type { MissionEvidence, WalkSummary } from '../src/game/types.ts'
import { closeDB, DB_NAME } from '../src/storage/db.ts'
import { getEvidence, grantOnce, listLedger, loadProfile, putEvidence } from '../src/storage/gamePersistence.ts'

const summary: WalkSummary = {
  id: 'walk-abc123',
  startedAt: '2026-10-11T10:00:00.000Z',
  endedAt: '2026-10-11T10:14:00.000Z',
  durationMin: 14,
  maxDistanceM: 420,
  pathM: 900,
  fixes: 40,
  rejectedFixes: 1,
  verified: true,
  thresholds: { minMinutes: 10, minDistanceM: 150 },
}

const evidence: MissionEvidence = {
  id: 'ev-1',
  missionId: 'natures-debugger',
  variantId: 'crack-growth',
  walkId: summary.id,
  image: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
  mimeType: 'image/jpeg',
  width: 10,
  height: 10,
  capturedAt: '2026-10-11T10:07:00.000Z',
  savedAt: '2026-10-11T10:20:00.000Z',
  source: 'lan',
  status: 'saved-for-later',
  attempts: 0,
}

beforeEach(async () => {
  await closeDB()
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = req.onerror = () => resolve()
  })
})

describe('grantOnce (IndexedDB)', () => {
  it('credits a walk once, even with concurrent calls and a reload', async () => {
    const before = await loadProfile()
    const results = await Promise.all([1, 2, 3].map(() => grantOnce((p, keys) => applyWalk(p, keys, summary))))
    expect(results.filter((r) => r.ledger).length).toBe(1)
    await closeDB()
    const after = await loadProfile()
    expect(after.tokens).toBe(before.tokens + 3)
    expect(await listLedger()).toHaveLength(1)
  })

  it('verifies a photo and grants its reward in the same transaction, once per walk', async () => {
    await putEvidence(evidence)
    const patch = { id: evidence.id, patch: { status: 'verified' as const } }
    const first = await grantOnce((p, keys) => applyPhoto(p, keys, evidence), patch)
    expect(first.ledger).not.toBeNull()
    expect((await getEvidence(evidence.id))?.status).toBe('verified')
    const again = await grantOnce((p, keys) => applyPhoto(p, keys, { ...evidence, id: 'ev-2' }))
    expect(again.ledger).toBeNull()
    expect((await loadProfile()).tokens).toBe(2)
  })
})
