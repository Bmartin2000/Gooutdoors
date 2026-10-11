import { describe, expect, it } from 'vitest'
import { ImportError, parseBackup, parseEvidenceBundle } from '../src/storage/transfer.ts'

const bundle = {
  format: 'afk.exe/evidence',
  version: 1,
  exportedAt: '2026-10-11T12:00:00.000Z',
  evidence: {
    id: 'ev-123456',
    contractId: 'broken-counter',
    missionId: 'natures-debugger',
    variantId: 'green-signal',
    capturedAt: '2026-10-11T11:58:00.000Z',
    width: 640,
    height: 480,
    mimeType: 'image/jpeg',
    imageBase64: '/9j/4AAQSkZJRgABAQAAAQABAAD',
  },
}

describe('evidence bundle import', () => {
  it('accepts a valid phone export', () => {
    expect(parseEvidenceBundle(bundle).evidence.missionId).toBe('natures-debugger')
  })

  it('rejects unknown contracts, bad dates, non-image types and non-base64 payloads', () => {
    const variants = [
      { ...bundle, evidence: { ...bundle.evidence, contractId: 'made-up' } },
      { ...bundle, evidence: { ...bundle.evidence, capturedAt: 'yesterday' } },
      { ...bundle, evidence: { ...bundle.evidence, mimeType: 'image/svg+xml' } },
      { ...bundle, evidence: { ...bundle.evidence, imageBase64: '<script>alert(1)</script>' } },
      { ...bundle, format: 'something-else' },
    ]
    for (const v of variants) expect(() => parseEvidenceBundle(v)).toThrow(ImportError)
  })
})

describe('backup import', () => {
  it('rejects a backup with an impossible profile', () => {
    expect(() =>
      parseBackup({
        format: 'afk.exe/backup',
        version: 1,
        exportedAt: '2026-10-11T12:00:00.000Z',
        profile: { version: 1, xp: -50 },
        rewards: [],
        evidence: [],
      }),
    ).toThrow(ImportError)
  })
})
