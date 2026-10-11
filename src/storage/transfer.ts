/**
 * Offline-friendly transfer formats. A phone hands an "outing" (walk summary + photos) to the
 * desk over the same-LAN inbox or as a portable `.afk.json` file (AirDrop, USB, Nearby Share).
 * Walk data is derived numbers only — never coordinates. Every import is schema-validated.
 */
import { z } from 'zod'
import { getChallenge } from '../content/challenges.ts'
import { getMission } from '../content/missions.ts'
import type { LedgerEntry, MissionEvidence, PlayerProfile, WalkSummary } from '../game/types.ts'
import { base64ToBlob, blobToBase64 } from '../ai/image.ts'

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date')
const imageBase64 = z.string().min(16).max(12 * 1024 * 1024).regex(/^[A-Za-z0-9+/=]+$/, 'not base64')
const mime = z.enum(['image/jpeg', 'image/png', 'image/webp'])

const walkSummary = z.object({
  id: z.string().min(4).max(80),
  startedAt: isoDate,
  endedAt: isoDate,
  durationMin: z.number().min(0).max(24 * 60),
  maxDistanceM: z.number().min(0).max(200_000),
  pathM: z.number().min(0).max(500_000),
  fixes: z.number().int().min(0).max(100_000),
  rejectedFixes: z.number().int().min(0).max(100_000),
  verified: z.boolean(),
  thresholds: z.object({ minMinutes: z.number().min(0), minDistanceM: z.number().min(0) }),
  override: z.literal('admin').optional(),
})

const photo = z.object({
  id: z.string().min(4).max(80),
  missionId: z.string().refine((id) => !!getMission(id), 'unknown mission'),
  variantId: z.string().min(1).max(60),
  walkId: z.string().max(80).optional(),
  distanceFromStartM: z.number().min(0).max(200_000).optional(),
  adminApproved: z.boolean().optional(),
  capturedAt: isoDate,
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
  mimeType: mime,
  imageBase64,
})

export const OutingSchema = z.object({
  format: z.literal('afk.exe/outing'),
  version: z.literal(1),
  exportedAt: isoDate,
  walk: walkSummary.nullable(),
  photos: z.array(photo).max(12),
})

export type OutingBundle = z.infer<typeof OutingSchema>

export class ImportError extends Error {}

/** A walk claiming verification must actually meet the thresholds it carries. */
export function consistentWalk(w: WalkSummary): boolean {
  if (!w.verified || w.override === 'admin') return true
  return w.fixes >= 3 && w.durationMin >= w.thresholds.minMinutes && w.maxDistanceM >= w.thresholds.minDistanceM && w.thresholds.minMinutes >= 2 && w.thresholds.minDistanceM >= 30
}

export function parseOuting(raw: unknown): OutingBundle {
  const parsed = OutingSchema.safeParse(raw)
  if (!parsed.success) throw new ImportError(`Not a valid AFK.exe outing file (${parsed.error.issues[0]?.message ?? 'invalid'}).`)
  if (parsed.data.walk && !consistentWalk(parsed.data.walk)) throw new ImportError('The walk data is inconsistent and was not imported.')
  return parsed.data
}

export async function buildOuting(walk: WalkSummary | null, photos: MissionEvidence[]): Promise<OutingBundle> {
  return {
    format: 'afk.exe/outing',
    version: 1,
    exportedAt: new Date().toISOString(),
    walk,
    photos: await Promise.all(
      photos.map(async (e) => ({
        id: e.id,
        missionId: e.missionId,
        variantId: e.variantId,
        walkId: e.walkId,
        distanceFromStartM: e.distanceFromStartM,
        adminApproved: e.adminApproved,
        capturedAt: e.capturedAt,
        width: e.width,
        height: e.height,
        mimeType: e.mimeType as 'image/jpeg',
        imageBase64: await blobToBase64(e.image),
      })),
    ),
  }
}

export function photoToEvidence(p: OutingBundle['photos'][number], source: 'import' | 'lan'): MissionEvidence {
  return {
    id: p.id,
    missionId: p.missionId,
    variantId: p.variantId,
    walkId: p.walkId,
    distanceFromStartM: p.distanceFromStartM,
    adminApproved: p.adminApproved,
    image: base64ToBlob(p.imageBase64, p.mimeType),
    mimeType: p.mimeType,
    width: p.width,
    height: p.height,
    capturedAt: p.capturedAt,
    savedAt: new Date().toISOString(),
    source,
    status: 'saved-for-later',
    attempts: 0,
  }
}

/* ───── full backups ───── */

const skills = z.object({ debugging: z.number(), typescript: z.number(), testing: z.number(), performance: z.number(), async: z.number() })

const BackupSchema = z.object({
  format: z.literal('afk.exe/backup'),
  version: z.literal(2),
  exportedAt: isoDate,
  profile: z
    .object({
      version: z.literal(2),
      xp: z.number().int().min(0).max(1e6),
      money: z.number().min(0).max(1e9),
      tokens: z.number().int().min(0).max(1e6),
      energy: z.number().min(0).max(100),
      skills,
      skillPoints: skills,
      board: z.array(z.object({ id: z.string(), challengeId: z.string().refine((id) => !!getChallenge(id)) }).passthrough()).max(10),
      upgrades: z.array(z.string()).max(30),
    })
    .passthrough(),
  ledger: z.array(z.object({ key: z.string(), kind: z.enum(['job', 'walk', 'photo']) }).passthrough()).max(5000),
  evidence: z.array(photo.extend({ status: z.string(), savedAt: isoDate, source: z.string(), attempts: z.number() }).passthrough()).max(60),
})

export async function buildBackup(profile: PlayerProfile, ledger: LedgerEntry[], evidence: MissionEvidence[]) {
  return {
    format: 'afk.exe/backup' as const,
    version: 2 as const,
    exportedAt: new Date().toISOString(),
    profile,
    ledger,
    evidence: await Promise.all(
      evidence.map(async ({ image, ...rest }) => ({ ...rest, status: rest.status === 'verifying' ? 'saved-for-later' : rest.status, imageBase64: await blobToBase64(image) })),
    ),
  }
}

export function parseBackup(raw: unknown) {
  const parsed = BackupSchema.safeParse(raw)
  if (!parsed.success) throw new ImportError(`Not a valid AFK.exe backup (${parsed.error.issues[0]?.path.join('.') || 'root'}).`)
  const data = parsed.data
  return {
    profile: data.profile as unknown as PlayerProfile,
    ledger: data.ledger as unknown as LedgerEntry[],
    evidence: data.evidence.map(({ imageBase64: b64, ...rest }) => ({ ...rest, image: base64ToBlob(b64, rest.mimeType) }) as unknown as MissionEvidence),
  }
}

export async function readJsonFile(file: File): Promise<unknown> {
  if (file.size > 80 * 1024 * 1024) throw new ImportError('File is too large.')
  try {
    return JSON.parse(await file.text())
  } catch {
    throw new ImportError('This file is not valid JSON.')
  }
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Native share sheet (AirDrop / Nearby Share) when files can be shared, else a download. */
export async function shareOrDownload(data: unknown, fileName: string): Promise<'shared' | 'downloaded'> {
  const file = new File([JSON.stringify(data)], fileName, { type: 'application/json' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'AFK.exe outing' })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
    }
  }
  downloadJson(data, fileName)
  return 'downloaded'
}
