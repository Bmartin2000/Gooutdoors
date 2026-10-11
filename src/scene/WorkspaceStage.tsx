import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import type { RoomStage } from '../game/types.ts'
import RoomIllustration from './RoomIllustration.tsx'

const LivingWorkspaceScene = lazy(() => import('./LivingWorkspaceScene.tsx'))

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('AFK.exe: 3D workspace unavailable, showing the illustrated fallback.', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** 3D when possible; the illustrated room otherwise. Never blank. */
export default function WorkspaceStage({ stage, reducedMotion }: { stage: RoomStage; reducedMotion: boolean }) {
  const [webgl] = useState(hasWebGL)
  const fallback = <RoomIllustration stage={stage} />
  if (!webgl) return fallback
  return (
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LivingWorkspaceScene stage={stage} reducedMotion={reducedMotion} />
      </Suspense>
    </SceneBoundary>
  )
}
