import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppSettings, FieldMission, MissionEvidence, PlayerProfile, RewardTransaction } from '../game/types.ts'

export interface AfkDB extends DBSchema {
  kv: {
    key: 'profile' | 'settings' | 'field'
    value: PlayerProfile | AppSettings | FieldMission
  }
  evidence: {
    key: string
    value: MissionEvidence
    indexes: { 'by-contract': string }
  }
  rewards: {
    key: string
    value: RewardTransaction
  }
}

export const DB_NAME = 'afk-exe'
let dbPromise: Promise<IDBPDatabase<AfkDB>> | null = null

export function getDB(): Promise<IDBPDatabase<AfkDB>> {
  dbPromise ??= openDB<AfkDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('kv')
      const evidence = db.createObjectStore('evidence', { keyPath: 'id' })
      evidence.createIndex('by-contract', 'contractId')
      db.createObjectStore('rewards', { keyPath: 'completionKey' })
    },
    blocked() {
      // Another tab holds an older version open; it will reload on versionchange.
    },
  })
  return dbPromise
}

/** Test helper: forget the cached connection (used with fake-indexeddb). */
export async function closeDB() {
  if (dbPromise) (await dbPromise).close()
  dbPromise = null
}
