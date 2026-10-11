import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppSettings, LedgerEntry, MissionEvidence, PhonePairing, PlayerProfile, WalkRecord } from '../game/types.ts'

export interface AfkDB extends DBSchema {
  kv: {
    key: 'profile' | 'settings' | 'pairing'
    value: PlayerProfile | AppSettings | PhonePairing
  }
  evidence: {
    key: string
    value: MissionEvidence
  }
  /** One row per granted reward; the key makes every grant idempotent. */
  ledger: {
    key: string
    value: LedgerEntry
  }
  /** Walks recorded on this device (phone). Coordinates never leave this store. */
  walks: {
    key: string
    value: WalkRecord
  }
}

export const DB_NAME = 'afk-exe'
let dbPromise: Promise<IDBPDatabase<AfkDB>> | null = null

export function getDB(): Promise<IDBPDatabase<AfkDB>> {
  dbPromise ??= openDB<AfkDB>(DB_NAME, 2, {
    upgrade(db, oldVersion, _newVersion, tx) {
      // v1 (contract prototype) → v2 (office + walks): the data model changed, start fresh.
      const names = db.objectStoreNames as unknown as DOMStringList
      for (const name of ['kv', 'evidence', 'rewards', 'ledger', 'walks']) {
        if (oldVersion < 2 && names.contains(name)) db.deleteObjectStore(name as never)
      }
      void tx
      db.createObjectStore('kv')
      db.createObjectStore('evidence', { keyPath: 'id' })
      db.createObjectStore('ledger', { keyPath: 'key' })
      db.createObjectStore('walks', { keyPath: 'id' })
    },
  })
  return dbPromise
}

/** Test helper: forget the cached connection (used with fake-indexeddb). */
export async function closeDB() {
  if (dbPromise) (await dbPromise).close()
  dbPromise = null
}
