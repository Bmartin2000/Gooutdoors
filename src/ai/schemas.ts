/**
 * Runtime validation for everything the local model returns. Model output is untrusted:
 * it is parsed, coerced into bounded shapes and rejected when it does not fit.
 */
import { z } from 'zod'
import type { VerificationResult } from '../game/types.ts'

const boundedString = (max: number) =>
  z
    .string()
    .trim()
    .transform((s) => (s.length > max ? `${s.slice(0, max - 1)}…` : s))

const looseBoolean = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])

const confidence = z.union([z.number(), z.string()]).transform((raw, ctx) => {
  let n = typeof raw === 'number' ? raw : Number.parseFloat(raw)
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: 'custom', message: 'confidence is not a number' })
    return z.NEVER
  }
  if (n > 1 && n <= 100) n = n / 100 // tolerate "85" meaning 85 %
  return Math.min(1, Math.max(0, n))
})

export const VerificationSchema = z.object({
  matches: looseBoolean,
  confidence,
  reason: boundedString(500).pipe(z.string().min(1)),
  detectedElements: z
    .array(z.string())
    .default([])
    .transform((items) => items.map((s) => s.trim().slice(0, 60)).filter(Boolean).slice(0, 10)),
  needsReview: looseBoolean.default(false),
})

/** JSON schema handed to Ollama's structured-output `format` field. */
export const VERIFICATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    matches: { type: 'boolean' },
    confidence: { type: 'number' },
    reason: { type: 'string' },
    detectedElements: { type: 'array', items: { type: 'string' } },
    needsReview: { type: 'boolean' },
  },
  required: ['matches', 'confidence', 'reason', 'detectedElements', 'needsReview'],
} as const

const issue = z.object({
  title: boundedString(160),
  detail: boundedString(1200),
  severity: z.enum(['high', 'medium', 'low']).catch('medium'),
})

export const DebuggerSchema = z.object({
  summary: boundedString(600),
  issues: z.array(issue).max(8).default([]),
  fixedCode: boundedString(16000).default(''),
  explanation: boundedString(3000).default(''),
  verification: z.array(boundedString(400)).max(8).default([]),
})

export const DEBUGGER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['title', 'detail', 'severity'],
      },
    },
    fixedCode: { type: 'string' },
    explanation: { type: 'string' },
    verification: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'issues', 'fixedCode', 'explanation', 'verification'],
} as const

export const OptimizerSchema = z.object({
  summary: boundedString(600),
  complexityBefore: boundedString(120).default('unknown'),
  complexityAfter: boundedString(120).default('unknown'),
  suggestions: z
    .array(z.object({ title: boundedString(160), detail: boundedString(1200), impact: z.enum(['high', 'medium', 'low']).catch('medium') }))
    .max(8)
    .default([]),
  refactoredCode: boundedString(16000).default(''),
  caveats: z.array(boundedString(400)).max(6).default([]),
})

export const OPTIMIZER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    complexityBefore: { type: 'string' },
    complexityAfter: { type: 'string' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['title', 'detail', 'impact'],
      },
    },
    refactoredCode: { type: 'string' },
    caveats: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'complexityBefore', 'complexityAfter', 'suggestions', 'refactoredCode', 'caveats'],
} as const

export const TestGenSchema = z.object({
  summary: boundedString(600),
  cases: z.array(z.object({ name: boundedString(200), why: boundedString(600) })).max(12).default([]),
  testCode: boundedString(16000).pipe(z.string().min(1)),
  notes: z.array(boundedString(400)).max(6).default([]),
})

export const TESTGEN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    cases: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, why: { type: 'string' } }, required: ['name', 'why'] },
    },
    testCode: { type: 'string' },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'cases', 'testCode', 'notes'],
} as const

export type DebuggerResult = z.infer<typeof DebuggerSchema>
export type OptimizerResult = z.infer<typeof OptimizerSchema>
export type TestGenResult = z.infer<typeof TestGenSchema>

export class ModelOutputError extends Error {
  readonly raw: string
  constructor(message: string, raw: string) {
    super(message)
    this.name = 'ModelOutputError'
    this.raw = raw
  }
}

/**
 * Extracts the first JSON object from model text. Structured output usually returns clean
 * JSON, but this also tolerates code fences, leading prose and <think> blocks.
 */
export function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // fall through to brace scanning
  }
  const start = cleaned.indexOf('{')
  if (start < 0) throw new ModelOutputError('The model did not return JSON.', text)
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1))
        } catch {
          break
        }
      }
    }
  }
  throw new ModelOutputError('The model returned malformed JSON.', text)
}

export function parseWith<T>(schema: z.ZodType<T>, text: string): T {
  const parsed = schema.safeParse(extractJsonObject(text))
  if (!parsed.success) {
    throw new ModelOutputError(`The model's answer did not match the expected shape (${parsed.error.issues[0]?.path.join('.') || 'root'}).`, text)
  }
  return parsed.data
}

export function parseVerification(text: string): VerificationResult {
  return parseWith(VerificationSchema, text)
}
