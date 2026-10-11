/**
 * GPS walk verification — pure functions, run on the capture device.
 * Raw coordinates stay on that device; only the derived WalkSummary is shared.
 * GNSS works without any network connection, so this works fully offline.
 */
import type { GeoFix, WalkRecord, WalkSummary } from './types.ts'

export const WALK_RULES = {
  normal: { minMinutes: 10, minDistanceM: 150 },
  /** Short thresholds for recording a demo. Labelled as such in the UI. */
  demo: { minMinutes: 2, minDistanceM: 30 },
}

/** Fixes worse than this are ignored (indoor Wi-Fi estimates are often 50–1000 m). */
export const MAX_ACCURACY_M = 50
/** Faster than this between two fixes is treated as a GPS jump, not walking or cycling. */
export const MAX_SPEED_MS = 12

const R = 6_371_000

export function distanceM(a: Pick<GeoFix, 'lat' | 'lon'>, b: Pick<GeoFix, 'lat' | 'lon'>): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Adds a fix if it is accurate enough and physically plausible. */
export function acceptFix(record: WalkRecord, fix: GeoFix): WalkRecord {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon) || fix.accuracy > MAX_ACCURACY_M) {
    return { ...record, rejectedFixes: record.rejectedFixes + 1 }
  }
  const last = record.fixes.at(-1)
  if (last) {
    const dt = (fix.at - last.at) / 1000
    if (dt <= 0) return record
    // Ignore jitter smaller than the fixes' own uncertainty, reject teleports.
    const d = distanceM(last, fix)
    if (d / dt > MAX_SPEED_MS && d > fix.accuracy + last.accuracy) return { ...record, rejectedFixes: record.rejectedFixes + 1 }
  }
  return { ...record, fixes: [...record.fixes, fix] }
}

export function summarize(record: WalkRecord, rules: { minMinutes: number; minDistanceM: number }, endedAt = Date.now()): WalkSummary {
  const fixes = record.fixes
  const start = fixes[0]
  let maxDistanceM = 0
  let pathM = 0
  for (let i = 0; i < fixes.length; i++) {
    if (start) maxDistanceM = Math.max(maxDistanceM, distanceM(start, fixes[i]))
    if (i > 0) pathM += distanceM(fixes[i - 1], fixes[i])
  }
  const startMs = Date.parse(record.startedAt)
  const lastFixMs = fixes.at(-1)?.at ?? startMs
  // Time only counts while position evidence exists: from the start to the last good fix.
  const durationMin = Math.max(0, (Math.min(endedAt, lastFixMs) - startMs) / 60_000)
  // The distance must clearly exceed GPS noise at the starting point.
  const noiseFloor = start ? 2 * start.accuracy : Infinity
  const verified = fixes.length >= 3 && durationMin >= rules.minMinutes && maxDistanceM >= Math.max(rules.minDistanceM, noiseFloor)
  return {
    id: record.id,
    startedAt: record.startedAt,
    endedAt: new Date(endedAt).toISOString(),
    durationMin: Math.round(durationMin * 10) / 10,
    maxDistanceM: Math.round(maxDistanceM),
    pathM: Math.round(pathM),
    fixes: fixes.length,
    rejectedFixes: record.rejectedFixes,
    verified,
    thresholds: rules,
  }
}

/** Progress towards verification, 0–1 for each criterion. */
export function walkProgress(record: WalkRecord, rules: { minMinutes: number; minDistanceM: number }, now = Date.now()) {
  const s = summarize(record, rules, now)
  const elapsedMin = (now - Date.parse(record.startedAt)) / 60_000
  return {
    summary: s,
    elapsedMin,
    timeRatio: Math.min(1, s.durationMin / rules.minMinutes),
    distanceRatio: Math.min(1, s.maxDistanceM / rules.minDistanceM),
  }
}
