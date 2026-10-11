import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { PLANT_IDS, getShopItem } from '../content/shop.ts'
import type { UpgradeId } from '../game/types.ts'
import { useGame } from '../app/GameContext.tsx'
import { usePreferences } from '../app/usePreferences.ts'
import type { OfficeView, ScreenRect, Stage } from '../scene/OfficeScene.tsx'
import { loginConfigured } from '../app/auth.ts'
import LoginScreen from './LoginScreen.tsx'
import MossBubble from './MossBubble.tsx'
import OS from './OS.tsx'

const OfficeScene = lazy(() => import('../scene/OfficeScene.tsx'))

/**
 * In the desk view the monitor spans roughly 1.05 × the viewport height in width. Below
 * these sizes it is too small to work on, so the OS takes the whole window instead.
 */
const MIN_VW = 900
const MIN_VH = 690

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('AFK.exe: 3D office unavailable, using the flat desktop.', error)
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

const PLANTS: readonly string[] = PLANT_IDS

export function natureStage(upgrades: string[]): Stage {
  const plants = upgrades.filter((u) => PLANTS.includes(u)).length
  return (plants === 0 ? 0 : plants <= 2 ? 1 : plants <= 4 ? 2 : 3) as Stage
}

export default function DeskPage() {
  const { profile, settings, moss, session, ready } = useGame()
  const needsLogin = loginConfigured && !session
  const [botPoint, setBotPoint] = useState<{ x: number; y: number } | null>(null)
  const { reducedMotion } = usePreferences(settings)
  const [webgl, setWebgl] = useState(hasWebGL)
  const [view, setView] = useState<OfficeView>('room')
  const [expanded, setExpanded] = useState(false)
  const [angle, setAngle] = useState(0)
  const [growth, setGrowth] = useState<string | null>(null)
  const previous = useRef<UpgradeId[] | null>(null)
  const growthTimer = useRef<number | undefined>(undefined)
  const [settled, setSettled] = useState<OfficeView | null>(null)
  const [rect, setRect] = useState<ScreenRect | null>(null)
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))

  useEffect(() => {
    if (!ready) return
    const added = previous.current && profile.upgrades.find((id) => !previous.current!.includes(id))
    previous.current = profile.upgrades
    if (!added) return
    setGrowth(`${getShopItem(added).name} · ${getShopItem(added).perkText}`)
    if (webgl) { setSettled(null); setView('room'); setAngle(0) }
    window.clearTimeout(growthTimer.current)
    growthTimer.current = window.setTimeout(() => setGrowth(null), 5500)
  }, [profile.upgrades, ready, webgl])
  useEffect(() => () => window.clearTimeout(growthTimer.current), [])

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onScreenRect = useCallback((r: ScreenRect | null) => setRect(r), [])
  const onSettled = useCallback((v: OfficeView) => setSettled(v), [])
  const onBotPoint = useCallback((p: { x: number; y: number } | null) => setBotPoint(p), [])

  const compact = viewport.w < MIN_VW || viewport.h < MIN_VH
  const full = !webgl || expanded
  const mounted = !full && view === 'desk' && settled === 'desk' && rect !== null
  const showOS = !webgl || (view === 'desk' && (mounted || full))
  const preview = mounted && compact
  const monitorStyle = mounted && rect ? {
    left: rect.left, top: rect.top,
    width: preview ? MIN_VW : rect.width,
    height: preview ? rect.height * MIN_VW / rect.width : rect.height,
    transform: preview ? `scale(${rect.width / MIN_VW})` : undefined,
    transformOrigin: 'top left',
  } : undefined

  const lookAround = () => {
    setExpanded(false)
    setSettled(null)
    setView((v) => (v === 'desk' ? 'room' : 'desk'))
  }

  return (
    <div className={`desk desk--stage-${natureStage(profile.upgrades)}`}>
      {webgl && (
        <div className={`desk__scene ${expanded ? 'is-dimmed' : ''}`} aria-hidden>
          <SceneBoundary onFail={() => setWebgl(false)}>
            <Suspense fallback={null}>
              <OfficeScene
                view={view}
                angle={angle}
                talking={!!moss}
                onBotPoint={onBotPoint}
                natureStage={natureStage(profile.upgrades)}
                upgrades={profile.upgrades}
                reducedMotion={reducedMotion}
                onScreenRect={onScreenRect}
                onSettled={onSettled}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      )}

      {needsLogin && <LoginScreen />}

      {showOS && !needsLogin && (
        <OS
          mode={mounted ? 'monitor' : 'full'}
          style={monitorStyle}
          preview={preview}
          onLookAround={webgl ? lookAround : undefined}
        />
      )}

      {view === 'desk' && !needsLogin && !preview && <MossBubble anchor={mounted ? botPoint : null} />}

      {webgl && view === 'desk' && !needsLogin && (
        <div className={`desk-controls ${expanded ? 'is-expanded' : ''}`}>
          {!expanded && <p>At your desk with Moss <span>Open the monitor to work, or stand up to explore.</span></p>}
          <button type="button" className="btn btn--primary" onClick={() => setExpanded((v) => !v)}>{expanded ? 'Back to desk' : 'Open monitor'}</button>
          {!expanded && <button type="button" className="btn" onClick={lookAround}>Stand up · Office</button>}
        </div>
      )}

      {webgl && view === 'room' && !needsLogin && (
        <div className="room-hud">
          <p className="room-hud__title">{growth ? '🌱 Your office is growing!' : 'Your little sanctuary'}</p>
          <p className="room-hud__sub" role="status">{growth ?? `${profile.upgrades.filter((id) => PLANT_IDS.includes(id)).length}/${PLANT_IDS.length} plants · Each leaf makes this place more alive.`}</p>
          <div className="row-2">
            <button className="btn" aria-label="Look left" onClick={() => setAngle((a) => Math.max(-0.9, a - 0.3))}>↶ Left</button>
            <button className="btn" onClick={() => setAngle(0)}>Center</button>
            <button className="btn" aria-label="Look right" onClick={() => setAngle((a) => Math.min(0.9, a + 0.3))}>Right ↷</button>
          </div>
          <button type="button" className="btn btn--primary btn--lg" onClick={lookAround}>
            Sit at the desk
          </button>
        </div>
      )}
      {growth && view === 'desk' && <div className="growth-toast" role="status">🌱 {growth}</div>}
      {!showOS && view === 'desk' && <div className="desk__boot" aria-hidden />}
    </div>
  )
}
