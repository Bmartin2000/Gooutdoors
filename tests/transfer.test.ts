import { describe, expect, it } from 'vitest'
import { ImportError, parseBackup, parseOuting } from '../src/storage/transfer.ts'
import { createProfile, refreshBoard } from '../src/game/economy.ts'

const walk = {
  id: 'walk-123456',
  startedAt: '2026-10-11T10:00:00.000Z',
  endedAt: '2026-10-11T10:14:00.000Z',
  durationMin: 14,
  maxDistanceM: 420,
  pathM: 900,
  fixes: 40,
  rejectedFixes: 0,
  verified: true,
  thresholds: { minMinutes: 10, minDistanceM: 150 },
}

const outing = {
  format: 'afk.exe/outing',
  version: 1,
  exportedAt: '2026-10-11T12:00:00.000Z',
  walk,
  photos: [
    {
      id: 'ev-123456',
      missionId: 'natures-debugger',
      variantId: 'green-signal',
      walkId: walk.id,
      distanceFromStartM: 300,
      capturedAt: '2026-10-11T10:08:00.000Z',
      width: 640,
      height: 480,
      mimeType: 'image/jpeg',
      imageBase64: '/9j/4AAQSkZJRgABAQAAAQABAAD',
    },
  ],
}

describe('outing import', () => {
  it('accepts a valid phone outing and carries no coordinates', () => {
    const parsed = parseOuting(outing)
    expect(parsed.photos).toHaveLength(1)
    expect(JSON.stringify(parsed)).not.toMatch(/"lat"|"lon"/)
  })

  it('rejects unknown missions, SVG, non-base64 and malformed walks', () => {
    const bad = [
      { ...outing, photos: [{ ...outing.photos[0], missionId: 'made-up' }] },
      { ...outing, photos: [{ ...outing.photos[0], mimeType: 'image/svg+xml' }] },
      { ...outing, photos: [{ ...outing.photos[0], imageBase64: '<script>alert(1)</script>' }] },
      { ...outing, walk: { ...walk, durationMin: -4 } },
      { ...outing, format: 'something-else' },
    ]
    for (const b of bad) expect(() => parseOuting(b)).toThrow(ImportError)
  })

  it('rejects a walk that claims verification without meeting its own thresholds', () => {
    expect(() => parseOuting({ ...outing, walk: { ...walk, maxDistanceM: 20 } })).toThrow(ImportError)
    expect(() => parseOuting({ ...outing, walk: { ...walk, thresholds: { minMinutes: 0, minDistanceM: 0 } } })).toThrow(ImportError)
  })
})

describe('admin overrides in outings', () => {
  it('accepts an admin-skipped walk and an admin-approved photo, both marked', () => {
    const parsed = parseOuting({
      ...outing,
      walk: { ...walk, durationMin: 1, maxDistanceM: 5, override: 'admin' },
      photos: [{ ...outing.photos[0], adminApproved: true }],
    })
    expect(parsed.walk?.override).toBe('admin')
    expect(parsed.photos[0].adminApproved).toBe(true)
  })

  it('still rejects an unmarked fake "verified" walk', () => {
    expect(() => parseOuting({ ...outing, walk: { ...walk, durationMin: 1, maxDistanceM: 5 } })).toThrow(ImportError)
  })
})

describe('backup import', () => {
  it('restores a board containing generated contracts', () => {
    const date = new Date('2026-10-11T12:00:00Z')
    const profile = refreshBoard(createProfile(date), date, 2).profile
    const parsed = parseBackup({ format: 'afk.exe/backup', version: 2, exportedAt: date.toISOString(), profile, ledger: [], evidence: [] })
    expect(parsed.profile.board).toEqual(profile.board)
  })
  it('rejects an impossible profile', () => {
    expect(() =>
      parseBackup({ format: 'afk.exe/backup', version: 2, exportedAt: '2026-10-11T12:00:00.000Z', profile: { version: 2, xp: -50 }, ledger: [], evidence: [] }),
    ).toThrow(ImportError)
  })
})
