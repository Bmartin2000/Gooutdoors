import { Briefcase, Code2, Eye, Inbox, Leaf, LogOut, Settings2, ShieldCheck, ShoppingBag, Sparkles, Wrench, X, Zap } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { useAIStatus } from '../app/AIStatusContext.tsx'
import { useGame, type OSApp } from '../app/GameContext.tsx'
import { BrandMark } from '../components/Brand.tsx'
import ErrorBoundary from '../components/ErrorBoundary.tsx'
import SettingsPanel from '../components/SettingsPanel.tsx'
import { levelProgress } from '../game/levels.ts'
import AdminApp from './apps/AdminApp.tsx'
import InboxApp from './apps/InboxApp.tsx'
import OutsideApp from './apps/OutsideApp.tsx'
import ShopApp from './apps/ShopApp.tsx'
import SkillsApp from './apps/SkillsApp.tsx'
import ToolsApp from './apps/ToolsApp.tsx'
import WorkApp from './apps/WorkApp.tsx'

const DOCK: { id: OSApp; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'work', label: 'Work', icon: Code2 },
  { id: 'outside', label: 'Outside', icon: Leaf },
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'tools', label: 'Tools', icon: Wrench },
]

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return <span className="os-bar__clock">{now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
}

function Celebration() {
  const { celebration, dismissCelebration, openApp } = useGame()
  if (!celebration) return null
  return (
    <div className="os-modal" role="dialog" aria-modal="true" aria-labelledby="celebrate-title" onKeyDown={(e) => e.key === 'Escape' && dismissCelebration()}>
      <div className="os-modal__card celebrate">
        <div className="celebrate__burst" aria-hidden>
          <Leaf size={26} />
        </div>
        <p className="eyebrow eyebrow--accent">{celebration.eyebrow}</p>
        <h2 id="celebrate-title" className="celebrate__title">
          {celebration.title}
        </h2>
        {celebration.lines.map((l) => (
          <p key={l} className="muted">
            {l}
          </p>
        ))}
        <div className="row-2 center-row">
          {celebration.cta && (
            <button
              type="button"
              className="btn btn--primary"
              autoFocus
              onClick={() => {
                openApp(celebration.cta!.app)
                dismissCelebration()
              }}
            >
              {celebration.cta.label}
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={dismissCelebration} autoFocus={!celebration.cta}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Toasts() {
  const { toasts, dismissToast } = useGame()
  return (
    <div className="os-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`os-toast os-toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
          <span>{t.text}</span>
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

export default function OS({ mode, style, onLookAround }: { mode: 'monitor' | 'full'; style?: CSSProperties; onLookAround?: () => void }) {
  const { profile, app, openApp, session, signOut } = useGame()
  const isAdmin = !!session?.admin
  const dock = isAdmin ? [...DOCK, { id: 'admin' as OSApp, label: 'Admin', icon: ShieldCheck }] : DOCK
  const { diagnostics } = useAIStatus()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { current, next, ratio } = levelProgress(profile.xp)
  const lowEnergy = profile.energy < 30

  const content =
    app === 'admin' && isAdmin ? <AdminApp /> : app === 'inbox' ? <InboxApp /> : app === 'work' ? <WorkApp /> : app === 'skills' ? <SkillsApp /> : app === 'shop' ? <ShopApp onLookAround={onLookAround} /> : app === 'outside' ? <OutsideApp /> : <ToolsApp />

  return (
    <div className={`os os--${mode}`} style={style}>
      <header className="os-bar">
        <div className="os-bar__left">
          <BrandMark size={18} />
          <span className="os-bar__name">
            AFK<span className="wordmark__ext">.exe</span>
          </span>
        </div>
        <div className="os-bar__stats">
          <span className={`stat stat--energy ${lowEnergy ? 'is-low' : ''}`} title={`Energy ${profile.energy}/100 — walks outside refill it`}>
            <Zap size={13} aria-hidden />
            <span className="meter" aria-hidden>
              <span style={{ transform: `scaleX(${profile.energy / 100})` }} />
            </span>
            <span className="sr-only">Energy</span>
            {profile.energy}
          </span>
          <span className="stat" title="Fresh-air tokens — earned outside">
            <span aria-hidden>🌿</span>
            <span className="sr-only">Tokens</span>
            {profile.tokens}
          </span>
          <span className="stat" title="Money — earned from client jobs">
            <span aria-hidden>$</span>
            <span className="sr-only">Money</span>
            {profile.money.toLocaleString('en')}
          </span>
          <span className="stat stat--level" title={next ? `${next.minXp - profile.xp} XP to ${next.name}` : 'Max level'}>
            L{current.level}
            <span className="meter meter--xp" aria-hidden>
              <span style={{ transform: `scaleX(${Math.max(0.03, ratio)})` }} />
            </span>
          </span>
        </div>
        <div className="os-bar__right">
          <span className={`ai-pip ai-pip--${diagnostics.connection === 'ready' ? 'ok' : 'warn'}`} title={diagnostics.connection === 'ready' ? `${diagnostics.model} ready on this computer` : (diagnostics.detail ?? diagnostics.connection)}>
            <span className="ai-dot" aria-hidden />
            <span className="os-bar__ai">{diagnostics.connection === 'ready' ? 'Local AI' : 'AI offline'}</span>
          </span>
          {session && session.user !== 'guest' && (
            <span className="os-user" title={`Signed in as ${session.user}`}>
              {isAdmin && <i className="os-user__admin">ADMIN</i>}
              {session.user}
            </span>
          )}
          <Clock />
          {onLookAround && (
            <button type="button" className="os-icon" onClick={onLookAround} aria-label="Look around the office" title="Look around the office">
              <Eye size={15} />
            </button>
          )}
          {session && session.user !== 'guest' && (
            <button type="button" className="os-icon" onClick={signOut} aria-label="Sign out" title="Sign out">
              <LogOut size={15} />
            </button>
          )}
          <button type="button" className="os-icon" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
            <Settings2 size={15} />
          </button>
        </div>
      </header>

      <div className="os-body">
        <nav className="os-dock" aria-label="Apps">
          {dock.map(({ id, label, icon: Icon }) => {
            const badge = id === 'inbox' ? profile.board.length : id === 'work' && profile.activeJob ? '•' : id === 'outside' && lowEnergy ? '!' : null
            return (
              <button key={id} type="button" className={`os-dock__item ${app === id ? 'is-active' : ''}`} onClick={() => openApp(id)} aria-current={app === id ? 'page' : undefined}>
                <Icon size={18} strokeWidth={1.8} aria-hidden />
                <span>{label}</span>
                {badge ? <i className={`os-dock__badge ${id === 'outside' ? 'is-warn' : ''}`}>{badge}</i> : null}
              </button>
            )
          })}
          <div className="os-dock__spacer" />
          <div className="os-dock__job" title={profile.activeJob ? profile.activeJob.offer.title : 'No active job'}>
            <Briefcase size={14} aria-hidden />
            <span>{profile.jobsDone}</span>
          </div>
        </nav>
        <main className="os-main" id="main" key={app}>
          <ErrorBoundary key={app}>{content}</ErrorBoundary>
        </main>
      </div>
      <Celebration />
      <Toasts />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
