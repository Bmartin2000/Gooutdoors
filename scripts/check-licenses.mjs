// License audit: every installed npm package must carry an OSI-approved open-source
// license (permissive code licenses, plus OFL-1.1 for the bundled fonts).
// Usage: npm run licenses:check
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'Unlicense',
  'Python-2.0',
  'Zlib',
  'MPL-2.0',
  'CC-BY-4.0',
  'OFL-1.1',
])

// When package.json has no license field, detect it from the LICENSE file header.
const LICENSE_FILE_PATTERNS = [
  [/^\s*MIT License/i, 'MIT'],
  [/^\s*ISC License/i, 'ISC'],
  [/Apache License\s+Version 2\.0/i, 'Apache-2.0'],
]

function licenseFromFile(dir) {
  const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f))
  if (!file) return 'UNKNOWN'
  const text = readFileSync(join(dir, file), 'utf8').slice(0, 500)
  return LICENSE_FILE_PATTERNS.find(([re]) => re.test(text))?.[1] ?? 'UNKNOWN'
}

function licenseOf(pkg, dir) {
  const raw = pkg.license ?? pkg.licenses
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw.map((l) => l.type ?? l).join(' OR ')
  if (raw && typeof raw === 'object') return raw.type
  return licenseFromFile(dir)
}

// SPDX expressions: "OR" needs one allowed license, "AND" needs all of them.
function isAllowed(expr) {
  const clean = expr.replace(/[()]/g, '').trim()
  if (clean.includes(' OR ')) return clean.split(' OR ').some(isAllowed)
  if (clean.includes(' AND ')) return clean.split(' AND ').every(isAllowed)
  return ALLOWED.has(clean)
}

const seen = new Map()
function walk(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.name.startsWith('@')) {
      walk(full)
      continue
    }
    const manifest = join(full, 'package.json')
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
      if (pkg.name && pkg.version) seen.set(`${pkg.name}@${pkg.version}`, licenseOf(pkg, full))
    }
    walk(join(full, 'node_modules'))
  }
}

walk('node_modules')

const counts = {}
const violations = []
for (const [id, license] of seen) {
  counts[license] = (counts[license] ?? 0) + 1
  if (!isAllowed(license)) violations.push(`${id}: ${license}`)
}

console.log(`${seen.size} packages checked.`)
for (const [license, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${license.padEnd(28)} ${n}`)
}

if (violations.length) {
  console.error(`\n✖ Disallowed or unknown license:\n  ${violations.join('\n  ')}`)
  process.exit(1)
}
console.log('\n✔ Every dependency is under an approved open-source license.')
