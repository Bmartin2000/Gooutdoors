import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useGame } from '../app/GameContext.tsx'
import { BrandMark } from '../components/Brand.tsx'

/** Shown on the desk only when a local admin login is configured (.env.local). */
export default function LoginScreen({ onClose }: { onClose?: () => void }) {
  const { signIn, continueAsGuest } = useGame()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(user, password)
    setBusy(false)
    if (!err) onClose?.()
    if (err) {
      setError(
        err === 'user'
          ? 'Unknown username.'
          : err === 'password'
            ? 'Wrong password.'
            : err === 'insecure'
              ? 'Sign-in only works on this computer at http://localhost:5173 (or https).'
              : 'Sign-in is not set up in this build.',
      )
      if (err === 'password') setPassword('')
    }
  }

  return (
    <div className={`login ${onClose ? 'login--sheet' : ''}`}>
      <form className="login__card" onSubmit={(e) => void submit(e)}>
        <div className="login__brand">
          <BrandMark size={36} />
          <div>
            <p className="login__name">
              AFK<span className="wordmark__ext">.exe</span>
            </p>
            <p className="muted small">Code. Explore. Upgrade.</p>
          </div>
        </div>
        <label className="field">
          <span>Username</span>
          <input autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && (
          <p className="error-text small" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          <LogIn size={16} aria-hidden /> Sign in
        </button>
        {onClose ? (
          <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
            Cancel
          </button>
        ) : (
          <button type="button" className="btn btn--ghost btn--block" onClick={continueAsGuest}>
            Continue without signing in
          </button>
        )}
        <p className="muted small center">Checked on this device only. Nothing is sent anywhere.</p>
      </form>
    </div>
  )
}
