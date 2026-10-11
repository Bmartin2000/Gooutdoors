// Configures the optional admin login WITHOUT storing the password anywhere.
// Derives a PBKDF2-SHA256 hash (600,000 iterations) and writes it to .env.local (git-ignored).
// The same three values can be set as GitHub repository variables so the phone app has the
// login too — they end up in public JavaScript, which is why the hash is deliberately slow.
// Usage (password from an env var so it stays out of shell history):
//   AFK_ADMIN_PASSWORD='…' node scripts/set-admin.mjs <username>[,<alias>] [--github]
import { execFileSync } from 'node:child_process'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export const ITERATIONS = 600_000
const users = (process.argv[2] ?? '').toLowerCase().replace(/\s+/g, '')
const password = process.env.AFK_ADMIN_PASSWORD
if (!users || !password) {
  console.error("Usage: AFK_ADMIN_PASSWORD='…' node scripts/set-admin.mjs <username>[,<alias>] [--github]")
  process.exit(1)
}
const salt = randomBytes(16).toString('hex')
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256').toString('hex')
const values = { VITE_ADMIN_USER: users, VITE_ADMIN_SALT: salt, VITE_ADMIN_HASH: hash }

const keep = existsSync('.env.local')
  ? readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('VITE_ADMIN_'))
  : []
writeFileSync('.env.local', [...keep, ...Object.entries(values).map(([k, v]) => `${k}=${v}`), ''].join('\n'))
console.log(`✔ Admin login configured for "${users}" in .env.local (PBKDF2 hash only, git-ignored).`)

if (process.argv.includes('--github')) {
  for (const [k, v] of Object.entries(values)) execFileSync('gh', ['variable', 'set', k, '--body', v], { stdio: 'inherit' })
  console.log('✔ GitHub repository variables set — the next Pages deploy includes the phone login.')
}
