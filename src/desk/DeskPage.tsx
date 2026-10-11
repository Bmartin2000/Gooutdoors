import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
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

const PLANTS = ['desk-seedling', 'floor-plant', 'hanging-plant', 'moss-rug', 'wall-vines', 'big-plant']

export function natureStage(upgrades: string[]): Stage {
  const plants = upgrades.filter((u) => PLANTS.includes(u)).length
  return (plants === 0 ? 0 : plants <= 2 ? 1 : plants <= 4 ? 2 : 3) as Stage
}

export default function DeskPage() {
  const { profile, settings, moss, session } = useGame()
  const needsLogin = loginConfigured && !session
  const [botPoint, setBotPoint] = useState<{ x: number; y: number } | null>(null)
  const { reducedMotion } = usePreferences(settings)
  const [webgl, setWebgl] = useState(hasWebGL)
  const [view, setView] = useState<OfficeView>('desk')
  const [settled, setSettled] = useState<OfficeView | null>(null)
  const [rect, setRect] = useState<ScreenRect | null>(null)
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onScreenRect = useCallback((r: ScreenRect | null) => setRect(r), [])
  const onSettled = useCallback((v: OfficeView) => setSettled(v), [])
  const onBotPoint = useCallback((p: { x: number; y: number } | null) => setBotPoint(p), [])

  const full = !webgl || viewport.w < MIN_VW || viewport.h < MIN_VH
  const mounted = !full && view === 'desk' && settled === 'desk' && rect !== null
  const showOS = view === 'desk' && (mounted || full)

  const lookAround = () => {
    setSettled(null)
    setView((v) => (v === 'desk' ? 'room' : 'desk'))
  }

  return (
    <div className={`desk desk--stage-${natureStage(profile.upgrades)}`}>
      {webgl && (
        <div className={`desk__scene ${full ? 'is-dimmed' : ''}`} aria-hidden>
          <SceneBoundary onFail={() => setWebgl(false)}>
            <Suspense fallback={null}>
              <OfficeScene
                view={full ? 'room' : view}
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
          style={mounted && rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : undefined}
          onLookAround={webgl && !full ? lookAround : undefined}
        />
      )}

      {view === 'desk' && !needsLogin && <MossBubble anchor={mounted ? botPoint : null} />}

      {view === 'room' && (
        <div className="room-hud">
          <p className="room-hud__title">Your office</p>
          <p className="room-hud__sub">Plants come from fresh-air tokens, gear from client money.</p>
          <button type="button" className="btn btn--primary btn--lg" onClick={lookAround}>
            Sit back down
          </button>
        </div>
      )}
      {!showOS && view === 'desk' && <div className="desk__boot" aria-hidden />}
    </div>
  )
}
