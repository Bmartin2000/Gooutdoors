/** Typed data contracts shared by game logic, persistence and UI. */

export type ToolId = 'assistant' | 'debugger' | 'optimizer' | 'test-generator'

export type SkillId = 'debugging' | 'typescript' | 'testing' | 'performance' | 'async'

export type Skills = Record<SkillId, number>

/** Office upgrades. Plants are bought with fresh-air tokens, tech with money. */
export type UpgradeId =
  | 'desk-seedling'
  | 'floor-plant'
  | 'hanging-plant'
  | 'wall-vines'
  | 'moss-rug'
  | 'big-plant'
  | 'desk-lamp'
  | 'coffee'
  | 'headphones'
  | 'second-monitor'
  | 'poster'

/** One deterministic check shown when a coding choice is "run". */
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
  evaluate: () => CaseResult[] | Promise<CaseResult[]>
  feedback: string
}

/** A coding task from the authored pool. Jobs are generated from these. */
export interface Challenge {
  id: string
  title: string
  brief: string
  fileName: string
  code: string
  focusLines: number[]
  question: string
  choices: ChallengeChoice[]
  correctChoiceId: string
  lesson: string
  /** Skills (and levels) needed to accept the job. */
  requires: Partial<Skills>
  /** Skill points earned on success. */
  trains: SkillId[]
  minLevel: number
  difficulty: 1 | 2 | 3
}

export interface JobOffer {
  id: string
  challengeId: string
  client: string
  title: string
  pitch: string
  pay: number
  xp: number
  energyCost: number
  arrivedAt: string
  expiresAt: string
  /** One per day: bigger pay, announced by Moss. */
  featured?: boolean
}

export interface ActiveJob {
  offer: JobOffer
  acceptedAt: string
  attempts: number
  /** Wrong choices removed with a hint token. */
  eliminated: string[]
}

export interface PlayerProfile {
  version: 2
  createdAt: string
  xp: number
  money: number
  tokens: number
  energy: number
  energyUpdatedAt: string
  skills: Skills
  skillPoints: Skills
  board: JobOffer[]
  activeJob: ActiveJob | null
  lastArrivalAt: string
  completedChallenges: string[]
  jobsDone: number
  jobsFailed: number
  upgrades: UpgradeId[]
  walksVerified: number
  minutesOutside: number
  /** Recent events for the OS feed. */
  feed: FeedItem[]
  /** YYYY-MM-DD of the last featured contract. */
  lastFeaturedDay?: string
}

export interface FeedItem {
  id: string
  at: string
  kind: 'job-arrived' | 'job-done' | 'job-failed' | 'walk' | 'photo' | 'purchase' | 'level' | 'info'
  text: string
}

/* ───────── outdoors ───────── */

export interface MissionVariant {
  id: string
  title: string
  /** The single sentence shown outdoors. */
  instruction: string
  /** What the local vision model is asked to look for. */
  visualCriteria: string
}

export interface OutdoorMission {
  id: string
  title: string
  variants: MissionVariant[]
  safety: string[]
  rewardTokens: number
  rewardXp: number
}

/** A position fix. Raw coordinates never leave the capture device. */
export interface GeoFix {
  lat: number
  lon: number
  accuracy: number
  at: number
}

/** What a phone shares about a walk: derived numbers only, no coordinates. */
export interface WalkSummary {
  id: string
  startedAt: string
  endedAt: string
  durationMin: number
  maxDistanceM: number
  pathM: number
  fixes: number
  rejectedFixes: number
  verified: boolean
  thresholds: { minMinutes: number; minDistanceM: number }
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
  missionId: string
  variantId: string
  walkId?: string
  /** Metres from the walk's start when the photo was taken (derived, no coordinates). */
  distanceFromStartM?: number
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
  sentAt?: string
}

export interface LedgerEntry {
  /** Unique key: a reward can be granted once per key. */
  key: string
  kind: 'job' | 'walk' | 'photo'
  money: number
  tokens: number
  xp: number
  at: string
}

export interface AppSettings {
  theme: 'system' | 'dark' | 'light'
  motion: 'system' | 'reduced' | 'full'
  sound: boolean
  notifications: boolean
  /** Minutes between new job offers. 60 = hourly. */
  jobEveryMin: 60 | 20 | 2
  /** Short walk thresholds for recording a demo. Clearly labelled in the UI. */
  demoWalk: boolean
}

/** Pairing info stored on a phone that scanned the desk QR code. */
export interface PhonePairing {
  token: string | null
  receivedAt: string
  /** Short demo walk thresholds, set by the desk QR code. */
  demo: boolean
}

/** A walk recorded on a capture device. Coordinates stay in this record, on this device. */
export interface WalkRecord {
  id: string
  startedAt: string
  endedAt: string | null
  fixes: GeoFix[]
  rejectedFixes: number
  missionId: string
  missionPromptedAt: string | null
  summary: WalkSummary | null
  sentAt?: string
}
