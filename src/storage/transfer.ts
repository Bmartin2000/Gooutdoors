/**
 * Offline-friendly transfer formats. A phone can export a single captured photo as a
 * portable `.afk.json` file (AirDrop, USB, Nearby Share, e-mail to self — no AFK.exe server
 * involved), and the desktop imports it for local verification. Full backups use the same idea.
 * All imports are schema-validated before anything is written.
 */
import { z } from 'zod'
import { getContract, getMission } from '../content/contracts.ts'
import type { MissionEvidence, PlayerProfile, RewardTransaction } from '../game/types.ts'
import { base64ToBlob, blobToBase64 } from '../ai/image.ts'

const MAX_IMAGE_BASE64 = 12 * 1024 * 1024

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date')
const imageBase64 = z.string().min(16).max(MAX_IMAGE_BASE64).regex(/^[A-Za-z0-9+/=]+$/, 'not base64')
const mime = z.enum(['image/jpeg', 'image/png', 'image/webp'])

const evidenceMeta = z.object({
  id: z.string().min(4).max(80),
  contractId: z.string().refine((id) => !!getContract(id), 'unknown contract'),
  missionId: z.string().refine((id) => !!getMission(id), 'unknown mission'),
  variantId: z.string().min(1).max(60),
  capturedAt: isoDate,
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
  mimeType: mime,
  imageBase64,
})

export const EvidenceBundleSchema = z.object({
  format: z.literal('afk.exe/evidence'),
  version: z.literal(1),
  exportedAt: isoDate,
  evidence: evidenceMeta,
})

const verification = z.object({
  matches: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(600),
  detectedElements: z.array(z.string().max(80)).max(12),
  needsReview: z.boolean(),
})

const toolId = z.enum(['assistant', 'debugger', 'optimizer', 'test-generator'])
const stage = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])

const profileSchema = z.object({
  version: z.literal(1),
  xp: z.number().int().min(0).max(100000),
  level: z.number().int().min(1).max(10),
  roomStage: stage,
  createdAt: isoDate,
  onboardedAt: isoDate.nullable(),
  completedContracts: z.array(z.string()).max(20),
  unlockedToolIds: z.array(toolId),
  contracts: z.record(
    z.string(),
    z.object({
      status: z.enum(['available', 'coding', 'mission', 'completed']),
      challengeAttempts: z.number().int().min(0),
      challengeSolvedAt: isoDate.optional(),
      variantId: z.string().optional(),
      completedAt: isoDate.optional(),
    }),
  ),
  lastAchievement: z.object({ title: z.string(), detail: z.string(), at: isoDate }).nullable(),
})

const rewardSchema = z.object({
  completionKey: z.string(),
  contractId: z.string(),
  evidenceId: z.string(),
  xpAmount: z.number(),
  toolsUnlocked: z.array(toolId),
  roomStageFrom: stage,
  roomStageTo: stage,
  levelFrom: z.number(),
  levelTo: z.number(),
  grantedAt: isoDate,
})

export const BackupSchema = z.object({
  format: z.literal('afk.exe/backup'),
  version: z.literal(1),
  exportedAt: isoDate,
  profile: profileSchema,
  rewards: z.array(rewardSchema).max(50),
  evidence: z
    .array(
      evidenceMeta.extend({
        savedAt: isoDate,
        source: z.enum(['camera', 'upload', 'import', 'lan']),
        status: z.enum(['saved-for-later', 'verifying', 'verified', 'needs-review', 'rejected', 'verification-failed']),
        attempts: z.number().int().min(0),
        result: verification.optional(),
        model: z.string().optional(),
        verifiedAt: isoDate.optional(),
      }),
    )
    .max(60),
})

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>

export class ImportError extends Error {}

export async function evidenceToBundle(evidence: MissionEvidence): Promise<EvidenceBundle> {
  return {
    format: 'afk.exe/evidence',
    version: 1,
    exportedAt: new Date().toISOString(),
    evidence: {
      id: evidence.id,
      contractId: evidence.contractId,
      missionId: evidence.missionId,
      variantId: evidence.variantId,
      capturedAt: evidence.capturedAt,
      width: evidence.width,
      height: evidence.height,
      mimeType: evidence.mimeType as 'image/jpeg',
      imageBase64: await blobToBase64(evidence.image),
    },
  }
}

export function bundleToEvidence(bundle: EvidenceBundle, source: 'import' | 'lan'): MissionEvidence {
  const e = bundle.evidence
  return {
    id: e.id,
    contractId: e.contractId,
    missionId: e.missionId,
    variantId: e.variantId,
    image: base64ToBlob(e.imageBase64, e.mimeType),
    mimeType: e.mimeType,
    width: e.width,
    height: e.height,
    capturedAt: e.capturedAt,
    savedAt: new Date().toISOString(),
    source,
    status: 'saved-for-later',
    attempts: 0,
  }
}

export function parseEvidenceBundle(raw: unknown): EvidenceBundle {
  const parsed = EvidenceBundleSchema.safeParse(raw)
  if (!parsed.success) throw new ImportError(`Not a valid AFK.exe photo file (${parsed.error.issues[0]?.message ?? 'invalid'}).`)
  return parsed.data
}

export async function buildBackup(profile: PlayerProfile, rewards: RewardTransaction[], evidence: MissionEvidence[]) {
  return {
    format: 'afk.exe/backup' as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    profile,
    rewards,
    evidence: await Promise.all(
      evidence.map(async (e) => ({
        id: e.id,
        contractId: e.contractId,
        missionId: e.missionId,
        variantId: e.variantId,
        capturedAt: e.capturedAt,
        width: e.width,
        height: e.height,
        mimeType: e.mimeType,
        imageBase64: await blobToBase64(e.image),
        savedAt: e.savedAt,
        source: e.source,
        // An in-flight verification cannot be resumed elsewhere.
        status: e.status === 'verifying' ? ('saved-for-later' as const) : e.status,
        attempts: e.attempts,
        result: e.result,
        model: e.model,
        verifiedAt: e.verifiedAt,
      })),
    ),
  }
}

export function parseBackup(raw: unknown) {
  const parsed = BackupSchema.safeParse(raw)
  if (!parsed.success) throw new ImportError(`Not a valid AFK.exe backup (${parsed.error.issues[0]?.path.join('.') || 'root'}: ${parsed.error.issues[0]?.message}).`)
  const data = parsed.data
  return {
    profile: data.profile as PlayerProfile,
    rewards: data.rewards as RewardTransaction[],
    evidence: data.evidence.map(
      (e): MissionEvidence => ({
        ...e,
        image: base64ToBlob(e.imageBase64, e.mimeType),
      }),
    ),
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

/** Uses the native share sheet (AirDrop / Nearby Share) when the platform supports files. */
export async function shareOrDownload(data: unknown, fileName: string): Promise<'shared' | 'downloaded'> {
  const file = new File([JSON.stringify(data)], fileName, { type: 'application/json' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'AFK.exe mission photo' })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
    }
  }
  downloadJson(data, fileName)
  return 'downloaded'
}
