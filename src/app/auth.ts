/**
 * Optional local sign-in for the desk. Configured only when .env.local provides a salted
 * password hash (see scripts/set-admin.mjs); the public build has no admin at all.
 * This is a convenience gate for testing on your own machine — not a security boundary.
 */
// The public phone-app build (mode "pages") never contains admin config, even if a local
// .env.local exists: the constant MODE check lets the bundler drop these values entirely.
const PUBLIC_BUILD = import.meta.env.MODE === 'pages'
const USER = PUBLIC_BUILD ? '' : (import.meta.env.VITE_ADMIN_USER ?? '').toLowerCase()
const SALT = PUBLIC_BUILD ? '' : (import.meta.env.VITE_ADMIN_SALT ?? '')
const HASH = PUBLIC_BUILD ? '' : (import.meta.env.VITE_ADMIN_HASH ?? '')
const SESSION_KEY = 'afk-session'

export const loginConfigured = !!(USER && SALT && HASH)

export interface Session {
  user: string
  admin: boolean
  at: string
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function signIn(user: string, password: string): Promise<Session | null> {
  if (!loginConfigured || !window.isSecureContext) return null
  const ok = user.trim().toLowerCase() === USER && (await sha256(`${SALT}:${password}`)) === HASH
  if (!ok) return null
  const session: Session = { user: USER, admin: true, at: new Date().toISOString() }
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
    if (s?.admin && (!loginConfigured || s.user !== USER)) return null
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
