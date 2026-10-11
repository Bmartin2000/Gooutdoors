/**
 * Optional admin sign-in (desk and phone app). Configured by scripts/set-admin.mjs, which
 * stores only a PBKDF2-SHA256 hash (600,000 iterations). In the phone app that hash is part
 * of public JavaScript, so it is deliberately slow to brute-force — use a password that is
 * not used anywhere else. This unlocks test overrides in a local game; it is not security.
 */
const ITERATIONS = 600_000
// One or more accepted usernames, comma-separated (e.g. a spelling alias).
const USERS = (import.meta.env.VITE_ADMIN_USER ?? '').toLowerCase().split(',').map((u) => u.trim()).filter(Boolean)
const USER = USERS[0] ?? ''
const SALT = import.meta.env.VITE_ADMIN_SALT ?? ''
const HASH = import.meta.env.VITE_ADMIN_HASH ?? ''
const SESSION_KEY = 'afk-session'

export const loginConfigured = !!(USER && SALT && HASH)

export interface Session {
  user: string
  admin: boolean
  at: string
  /** Ties an admin session to the current password; changing it signs everyone out. */
  key?: string
}

async function pbkdf2(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256)
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type SignInError = 'unavailable' | 'insecure' | 'user' | 'password'

export async function signIn(user: string, password: string): Promise<Session | SignInError> {
  if (!loginConfigured) return 'unavailable'
  if (!window.isSecureContext) return 'insecure'
  if (!USERS.includes(user.trim().toLowerCase())) return 'user'
  // Ignore accidental leading/trailing spaces from autofill or mobile keyboards.
  if ((await pbkdf2(password.trim(), SALT)) !== HASH) return 'password'
  const session: Session = { user: user.trim().toLowerCase(), admin: true, at: new Date().toISOString(), key: HASH.slice(0, 12) }
  saveSession(session)
  return session
}

export function guestSession(): Session {
  const session: Session = { user: 'guest', admin: false, at: new Date().toISOString() }
  saveSession(session)
  return session
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const s = raw ? (JSON.parse(raw) as Session) : null
    // An admin session is only valid while this build still has the same admin configured.
    if (s?.admin && (!loginConfigured || !USERS.includes(s.user) || s.key !== HASH.slice(0, 12))) return null
    return s
  } catch {
    return null
  }
}

function saveSession(s: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: session lasts for this page only */
  }
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
