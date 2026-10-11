/**
 * Optional local sign-in for the desk. Configured only when .env.local provides a salted
 * password hash (see scripts/set-admin.mjs); the public build has no admin at all.
 * This is a convenience gate for testing on your own machine — not a security boundary.
 */
// The public phone-app build (mode "pages") never contains admin config, even if a local
// .env.local exists: the constant MODE check lets the bundler drop these values entirely.
const PUBLIC_BUILD = import.meta.env.MODE === 'pages'
// One or more accepted usernames, comma-separated (e.g. a spelling alias).
const USERS = PUBLIC_BUILD ? [] : (import.meta.env.VITE_ADMIN_USER ?? '').toLowerCase().split(',').map((u) => u.trim()).filter(Boolean)
const USER = USERS[0] ?? ''
const SALT = PUBLIC_BUILD ? '' : (import.meta.env.VITE_ADMIN_SALT ?? '')
const HASH = PUBLIC_BUILD ? '' : (import.meta.env.VITE_ADMIN_HASH ?? '')
const SESSION_KEY = 'afk-session'

export const loginConfigured = !!(USER && SALT && HASH)

export interface Session {
  user: string
  admin: boolean
  at: string
  /** Ties an admin session to the current password; changing it signs everyone out. */
  key?: string
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type SignInError = 'unavailable' | 'insecure' | 'user' | 'password'

export async function signIn(user: string, password: string): Promise<Session | SignInError> {
  if (!loginConfigured) return 'unavailable'
  if (!window.isSecureContext) return 'insecure'
  if (!USERS.includes(user.trim().toLowerCase())) return 'user'
  // Ignore accidental leading/trailing spaces from autofill or mobile keyboards.
  if ((await sha256(`${SALT}:${password.trim()}`)) !== HASH) return 'password'
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
