import { Compass, LayoutGrid, Settings2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useGame } from '../app/GameContext.tsx'
import { useOnline, usePreferences } from '../app/usePreferences.ts'
import { S } from '../content/strings.ts'
import { BrandMark, Wordmark } from './Brand.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import LocalAIStatus from './LocalAIStatus.tsx'
import Onboarding from './Onboarding.tsx'
import RewardReveal from './RewardReveal.tsx'
import SettingsPanel from './SettingsPanel.tsx'
import Toasts from './Toasts.tsx'

const NAV = [
  { to: '/', label: S.nav.workspace, icon: LayoutGrid, end: true },
  { to: '/explore', label: S.nav.explore, icon: Compass, end: false },
  { to: '/companion', label: S.nav.companion, icon: Sparkles, end: false },
]

function SidebarNav({ onSettings }: { onSettings: () => void }) {
  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar__brand">
        <BrandMark />
        <div>
          <Wordmark />
          <p className="sidebar__line">{S.brand.line}</p>
        </div>
      </div>
      <nav className="sidebar__nav">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="sidebar__link">
            <Icon size={17} strokeWidth={1.8} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__foot">
        <LocalAIStatus onClick={onSettings} />
        <button type="button" className="sidebar__link sidebar__settings" onClick={onSettings}>
          <Settings2 size={17} strokeWidth={1.8} aria-hidden />
          {S.nav.settings}
        </button>
      </div>
    </aside>
  )
}

function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="mobile-nav__link">
          <Icon size={20} strokeWidth={1.8} aria-hidden />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default function AppShell() {
  const { ready, profile, settings, isAIHost } = useGame()
  const { reducedMotion } = usePreferences(settings)
  const online = useOnline()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const location = useLocation()
  const fieldMode = location.pathname.startsWith('/explore')

  return (
    <div className={`shell ${fieldMode ? 'shell--field' : ''}`}>
      <a className="skip-link" href="#main">
        {S.nav.skip}
      </a>
      <SidebarNav onSettings={() => setSettingsOpen(true)} />
      <header className="topbar">
        <div className="topbar__brand">
          <BrandMark size={26} />
          <Wordmark />
        </div>
        <div className="topbar__actions">
          <LocalAIStatus compact onClick={() => setSettingsOpen(true)} />
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label={S.nav.settings}>
            <Settings2 size={19} strokeWidth={1.8} />
          </button>
        </div>
      </header>
      {!online && (
        <div className="offline-banner" role="status">
          You’re offline. Missions, photo capture and your saved progress still work on this device.
        </div>
      )}
      <main id="main" className="main" tabIndex={-1}>
        <ErrorBoundary key={location.pathname}>{ready ? <Outlet context={{ reducedMotion }} /> : <ShellSkeleton />}</ErrorBoundary>
      </main>
      <MobileNav />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {ready && isAIHost && !profile.onboardedAt && <Onboarding />}
      <RewardReveal reducedMotion={reducedMotion} />
      <Toasts />
    </div>
  )
}

function ShellSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton--hero" />
      <div className="row-3">
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
      </div>
    </div>
  )
}
