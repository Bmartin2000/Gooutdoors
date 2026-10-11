/** Typed data contracts shared by game logic, persistence and UI. */

export type ToolId = 'assistant' | 'debugger' | 'optimizer' | 'test-generator'

export type RoomStage = 0 | 1 | 2 | 3

export type ContractStatus = 'locked' | 'available' | 'coding' | 'mission' | 'completed'

export interface ContractProgress {
  status: Exclude<ContractStatus, 'locked'>
  challengeAttempts: number
  challengeSolvedAt?: string
  variantId?: string
  completedAt?: string
}

export interface PlayerProfile {
  version: 1
  xp: number
  level: number
  roomStage: RoomStage
  createdAt: string
  onboardedAt: string | null
  completedContracts: string[]
  unlockedToolIds: ToolId[]
  contracts: Record<string, ContractProgress>
  lastAchievement: { title: string; detail: string; at: string } | null
}

export interface RewardSpec {
  xp: number
  toolId: Exclude<ToolId, 'assistant'>
  achievement: string
}

/** One deterministic test case shown when a coding choice is "run". */
export interface CaseResult {
  label: string
  expected: string
  actual: string
  pass: boolean
}

export interface ChallengeChoice {
  id: string
  label: string
  code: string
  /** Authored, side-effect-free evaluation of this choice. Never runs user input. */
  evaluate: () => CaseResult[]
  feedback: string
}

export interface CodingChallenge {
  brief: string
  language: 'TypeScript'
  fileName: string
  code: string
  /** Highlighted line numbers (1-based) in `code`, if any. */
  focusLines: number[]
  question: string
  choices: ChallengeChoice[]
  correctChoiceId: string
  lesson: string
}

export interface MissionVariant {
  id: string
  title: string
  /** The single sentence shown outdoors. */
  instruction: string
  /** What the local vision model is asked to look for. */
  visualCriteria: string
  urbanFriendly: boolean
}

export interface OutdoorMission {
  id: string
  title: string
  theme: string
  variants: MissionVariant[]
  safety: string[]
}

export interface Contract {
  id: string
  order: number
  title: string
  client: string
  difficulty: 'Warm-up' | 'Easy' | 'Moderate'
  estimate: string
  story: string
  challenge: CodingChallenge
  missionId: string
  reward: RewardSpec
}

export type EvidenceStatus =
  | 'saved-for-later'
  | 'verifying'
  | 'verified'
  | 'needs-review'
  | 'rejected'
  | 'verification-failed'

export type EvidenceSource = 'camera' | 'upload' | 'import' | 'lan'

export interface VerificationResult {
  matches: boolean
  confidence: number
  reason: string
  detectedElements: string[]
  needsReview: boolean
}

export interface MissionEvidence {
  id: string
  contractId: string
  missionId: string
  variantId: string
  image: Blob
  mimeType: string
  width: number
  height: number
  capturedAt: string
  savedAt: string
  source: EvidenceSource
  status: EvidenceStatus
  attempts: number
  result?: VerificationResult
  model?: string
  verifiedAt?: string
  lastError?: string
  /** Set when this photo was handed to another device (export or LAN). */
  sentAt?: string
}

export interface RewardTransaction {
  completionKey: string
  contractId: string
  evidenceId: string
  xpAmount: number
  toolsUnlocked: ToolId[]
  roomStageFrom: RoomStage
  roomStageTo: RoomStage
  levelFrom: number
  levelTo: number
  grantedAt: string
}

export interface AppSettings {
  theme: 'system' | 'dark' | 'light'
  motion: 'system' | 'reduced' | 'full'
  sound: boolean
}

/** A mission picked up on a capture device (e.g. a phone that scanned the desk QR code). */
export interface FieldMission {
  contractId: string
  missionId: string
  variantId: string
  /** Pairing token for the optional same-LAN inbox on the computer that served the app. */
  pairToken?: string
  receivedAt: string
}
