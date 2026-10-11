import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { CONTRACTS } from '../src/content/contracts.ts'
import { startContract, submitChallenge } from '../src/game/rewardEngine.ts'
import type { MissionEvidence } from '../src/game/types.ts'
import { closeDB, DB_NAME } from '../src/storage/db.ts'
import {
  getEvidence,
  grantVerifiedReward,
  listRewards,
  loadProfile,
  putEvidence,
  saveProfile,
} from '../src/storage/gamePersistence.ts'

const contract = CONTRACTS[0]
const verification = {
  model: 'qwen3.5:4b',
  result: { matches: true, confidence: 0.9, reason: 'Moss in a pavement crack.', detectedElements: ['moss'], needsReview: false },
}

function evidence(id: string): MissionEvidence {
  return {
    id,
    contractId: contract.id,
    missionId: contract.missionId,
    variantId: 'crack-growth',
    image: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    width: 10,
    height: 10,
    capturedAt: '2026-10-11T12:00:00.000Z',
    savedAt: '2026-10-11T12:00:01.000Z',
    source: 'camera',
    status: 'saved-for-later',
    attempts: 0,
  }
}

beforeEach(async () => {
  await closeDB()
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = req.onerror = () => resolve()
  })
})

async function readyForMission() {
  let profile = await loadProfile()
  profile = startContract(profile, contract.id)
  profile = submitChallenge(profile, contract.id, contract.challenge.correctChoiceId).profile
  await saveProfile(profile)
}

describe('grantVerifiedReward (IndexedDB)', () => {
  it('grants once, persists, and survives a "reload"', async () => {
    await readyForMission()
    await putEvidence(evidence('ev-1'))

    const first = await grantVerifiedReward(contract.id, 'ev-1', verification)
    expect(first.transaction).not.toBeNull()

    // simulate a page reload: drop the connection and read everything back
    await closeDB()
    const reloaded = await loadProfile()
    expect(reloaded.xp).toBe(250)
    expect(reloaded.unlockedToolIds).toContain('debugger')
    expect((await getEvidence('ev-1'))?.status).toBe('verified')
  })

  it('does not grant twice on repeated submit, even with a different photo', async () => {
    await readyForMission()
    await putEvidence(evidence('ev-1'))
    await putEvidence(evidence('ev-2'))

    const results = await Promise.all([
      grantVerifiedReward(contract.id, 'ev-1', verification),
      grantVerifiedReward(contract.id, 'ev-1', verification),
    ])
    const again = await grantVerifiedReward(contract.id, 'ev-2', verification)

    expect(results.filter((r) => r.transaction).length).toBe(1)
    expect(again.alreadyGranted).toBe(true)
    expect((await loadProfile()).xp).toBe(250)
    expect(await listRewards()).toHaveLength(1)
  })
})
