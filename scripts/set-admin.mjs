// Configures the optional local admin login WITHOUT storing the password anywhere.
// Writes a salted SHA-256 hash to .env.local (git-ignored). The public build has no admin.
// Usage (password from an env var so it stays out of shell history):
//   AFK_ADMIN_PASSWORD='…' node scripts/set-admin.mjs <username>[,<alias>]
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const user = process.argv[2]
const password = process.env.AFK_ADMIN_PASSWORD
if (!user || !password) {
  console.error("Usage: AFK_ADMIN_PASSWORD='…' node scripts/set-admin.mjs <username>")
  process.exit(1)
}
const salt = randomBytes(16).toString('hex')
const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex')
const keep = existsSync('.env.local')
  ? readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('VITE_ADMIN_'))
  : []
writeFileSync('.env.local', [...keep, `VITE_ADMIN_USER=${user.toLowerCase().replace(/\s+/g, '')}`, `VITE_ADMIN_SALT=${salt}`, `VITE_ADMIN_HASH=${hash}`, ''].join('\n'))
console.log(`✔ Admin login configured for "${user.toLowerCase()}" in .env.local (hash only, git-ignored).`)
