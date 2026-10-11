/**
 * The living workspace: one contained, procedurally built diorama (no remote models or
 * textures). Room stage 0 → 3 moves it from a cool graphite cell to a warm biophilic studio.
 */
import { Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { RoomStage } from '../game/types.ts'

interface Palette {
  wall: string
  wallSide: string
  floor: string
  floorEdge: string
  sun: string
  sunIntensity: number
  sky: string
  ground: string
  hemi: number
  glass: string
  screen: string
  bot: string
}

const PALETTES: Palette[] = [
  { wall: '#5b6066', wallSide: '#4d5258', floor: '#5d6266', floorEdge: '#1b1d1f', sun: '#d4e0f0', sunIntensity: 2.2, sky: '#b8c6d6', ground: '#2a2e33', hemi: 1.15, glass: '#bcd0e6', screen: '#7f9bbf', bot: '#cfe0f5' },
  { wall: '#726e64', wallSide: '#625f57', floor: '#8a7864', floorEdge: '#2a241e', sun: '#f6e6c8', sunIntensity: 3.0, sky: '#e2dccb', ground: '#3a342a', hemi: 1.25, glass: '#f1e8cc', screen: '#8dbb84', bot: '#b6e3a9' },
  { wall: '#7f7666', wallSide: '#6e6658', floor: '#9a7a5a', floorEdge: '#3a2c21', sun: '#ffdca6', sunIntensity: 3.6, sky: '#f2e2bf', ground: '#45392a', hemi: 1.3, glass: '#ffe7b8', screen: '#9fd08f', bot: '#a7e29a' },
  { wall: '#8c7d67', wallSide: '#7a6c58', floor: '#a47d58', floorEdge: '#45352a', sun: '#ffc274', sunIntensity: 4.2, sky: '#ffe2ae', ground: '#4d3d29', hemi: 1.35, glass: '#ffd894', screen: '#b5e3a2', bot: '#c3f0b4' },
]

/* ───────────── animated colour helpers ───────────── */

function useLerpColor(target: string, reduced: boolean) {
  const [color] = useState(() => new THREE.Color(target))
  const goal = useMemo(() => new THREE.Color(), [])
  useFrame((_, dt) => {
    goal.set(target)
    if (reduced) color.copy(goal)
    else color.lerp(goal, Math.min(1, dt * 1.6))
  })
  return color
}

function LerpMaterial({ color, reduced, roughness = 0.9, metalness = 0, emissive }: { color: string; reduced: boolean; roughness?: number; metalness?: number; emissive?: string }) {
  const c = useLerpColor(color, reduced)
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.color.copy(c)
    if (emissive) ref.current.emissive.copy(c)
  })
  return <meshStandardMaterial ref={ref} roughness={roughness} metalness={metalness} emissiveIntensity={emissive ? 0.9 : 0} />
}

/* ───────────── growth ───────────── */

function Grow({ visible, reduced, delay = 0, children, position, rotation }: { visible: boolean; reduced: boolean; delay?: number; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null)
  const t = useRef(visible ? 1 : 0)
  const wait = useRef(delay)
  useFrame((_, dt) => {
    if (!ref.current) return
    if (reduced) t.current = visible ? 1 : 0
    else if (visible) {
      if (wait.current > 0) wait.current -= dt
      else t.current = Math.min(1, t.current + dt * 0.7)
    } else {
      wait.current = delay
      t.current = Math.max(0, t.current - dt * 2)
    }
    const e = 1 - Math.pow(1 - t.current, 3)
    ref.current.scale.setScalar(Math.max(0.0001, e))
    ref.current.visible = t.current > 0.001
  })
  return (
    <group ref={ref} position={position} rotation={rotation}>
      {children}
    </group>
  )
}

const leafShape = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.42, 0.18, 0.36, 0.78, 0, 1)
  s.bezierCurveTo(-0.36, 0.78, -0.42, 0.18, 0, 0)
  return s
})()
const leafGeometry = new THREE.ShapeGeometry(leafShape, 10)

const LEAF_GREENS = ['#4f7f45', '#5f9152', '#6fa35f', '#3f6d3a', '#7bb06a']

function Leaf({ position, rotation, scale = 1, color = LEAF_GREENS[0] }: { position: [number, number, number]; rotation: [number, number, number]; scale?: number; color?: string }) {
  return (
    <mesh geometry={leafGeometry} position={position} rotation={rotation} scale={scale} castShadow>
      <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.75} />
    </mesh>
  )
}

function Pot({ radius, height, color }: { radius: number; height: number; color: string }) {
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius * 0.78, height, 28]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, height - 0.01, 0]}>
        <cylinderGeometry args={[radius * 0.92, radius * 0.92, 0.02, 24]} />
        <meshStandardMaterial color="#2a1f17" roughness={1} />
      </mesh>
    </group>
  )
}

/** Deterministic pseudo-random so every render of a stage looks identical. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function Seedling() {
  return (
    <group>
      <Pot radius={0.09} height={0.13} color="#d9d3c7" />
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.006, 0.008, 0.16, 6]} />
        <meshStandardMaterial color="#5f8f4f" />
      </mesh>
      <Leaf position={[0, 0.26, 0]} rotation={[0.4, 0.3, -0.9]} scale={0.1} color="#7bb06a" />
      <Leaf position={[0, 0.25, 0]} rotation={[0.4, -0.4, 0.9]} scale={0.09} color="#6fa35f" />
      <Leaf position={[0, 0.2, 0]} rotation={[0.5, 1.4, 0.7]} scale={0.07} color="#5f9152" />
    </group>
  )
}

function FloorPlant({ seed, height = 1.3, leaves = 20 }: { seed: number; height?: number; leaves?: number }) {
  const items = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: leaves }, (_, i) => {
      const a = (i / leaves) * Math.PI * 2 + r() * 0.6
      const h = 0.35 + r() * (height - 0.35)
      const reach = 0.14 + r() * 0.34
      return {
        stem: { x: Math.cos(a) * reach * 0.5, z: Math.sin(a) * reach * 0.5, h },
        leaf: {
          position: [Math.cos(a) * reach, h, Math.sin(a) * reach] as [number, number, number],
          rotation: [-0.9 + r() * 0.5, -a + Math.PI / 2, (r() - 0.5) * 0.6] as [number, number, number],
          scale: 0.36 + r() * 0.26,
          color: LEAF_GREENS[Math.floor(r() * LEAF_GREENS.length)],
        },
      }
    })
  }, [seed, height, leaves])
  return (
    <group>
      <Pot radius={0.24} height={0.42} color="#cfc6b6" />
      <group position={[0, 0.4, 0]}>
        {items.map((it, i) => (
          <group key={i}>
            <mesh position={[it.stem.x, it.stem.h / 2, it.stem.z]} rotation={[it.stem.z * 0.6, 0, -it.stem.x * 0.6]}>
              <cylinderGeometry args={[0.008, 0.012, it.stem.h, 5]} />
              <meshStandardMaterial color="#4c7440" />
            </mesh>
            <Leaf {...it.leaf} />
          </group>
        ))}
      </group>
    </group>
  )
}

function Vine({ seed, length, dir = [0, -1, 0] }: { seed: number; length: number; dir?: [number, number, number] }) {
  const items = useMemo(() => {
    const r = rng(seed)
    const n = Math.round(length * 18)
    return Array.from({ length: n }, (_, i) => {
      const t = i / n
      return {
        position: [dir[0] * t * length + Math.sin(t * 9 + seed) * 0.05, dir[1] * t * length, dir[2] * t * length + Math.cos(t * 7) * 0.04] as [number, number, number],
        rotation: [r() * 1.2 - 0.6, r() * Math.PI * 2, r() * 1.2 - 0.6] as [number, number, number],
        scale: 0.11 + r() * 0.07,
        color: LEAF_GREENS[Math.floor(r() * LEAF_GREENS.length)],
      }
    })
  }, [seed, length, dir])
  return (
    <group>
      {items.map((leaf, i) => (
        <Leaf key={i} {...leaf} />
      ))}
    </group>
  )
}

function HangingPlant() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.9, 4]} />
        <meshStandardMaterial color="#8a8172" />
      </mesh>
      <group rotation={[Math.PI, 0, 0]}>
        <Pot radius={0.15} height={0.18} color="#e4ddcf" />
      </group>
      <group position={[0.1, -0.12, 0]}>
        <Vine seed={11} length={0.9} />
      </group>
      <group position={[-0.08, -0.12, 0.06]}>
        <Vine seed={23} length={0.65} />
      </group>
      <group position={[0, -0.1, -0.1]}>
        <Vine seed={37} length={0.5} />
      </group>
    </group>
  )
}

/* ───────────── furniture ───────────── */

function makeScreenTexture(accent: string, stage: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 296
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0c0e0d'
  ctx.fillRect(0, 0, 512, 296)
  ctx.fillStyle = '#1a1d1b'
  ctx.fillRect(0, 0, 512, 22)
  for (const [i, c] of ['#e5796b', '#e5b96e', '#8dbb84'].entries()) {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(14 + i * 14, 11, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  const r = rng(7 + stage)
  const palette = ['#5d6863', accent, '#e5b96e', '#9aa6a0', accent]
  let y = 40
  for (let line = 0; line < 13; line++) {
    let x = 18 + (line % 4 === 0 ? 0 : 18 * Math.floor(r() * 3))
    const words = 2 + Math.floor(r() * 5)
    for (let w = 0; w < words && x < 470; w++) {
      const len = 18 + r() * 70
      ctx.fillStyle = palette[Math.floor(r() * palette.length)]
      ctx.globalAlpha = 0.85
      ctx.fillRect(x, y, len, 7)
      x += len + 8
    }
    y += 18
  }
  ctx.globalAlpha = 1
  if (stage > 0) {
    ctx.fillStyle = accent
    ctx.globalAlpha = 0.18
    ctx.fillRect(330, 40, 160, 230)
    ctx.globalAlpha = 1
    ctx.fillStyle = accent
    ctx.font = '600 15px sans-serif'
    ctx.fillText('AFK.exe', 348, 66)
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#c7d3c3'
    const tools = ['AI Debugger', 'Code Optimizer', 'Test Generator'].slice(0, stage)
    tools.forEach((t, i) => ctx.fillText(`✓ ${t}`, 348, 96 + i * 22))
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function Monitor({ stage, accent }: { stage: number; accent: string }) {
  const texture = useMemo(() => makeScreenTexture(accent, stage), [accent, stage])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group position={[0.25, 0.79, -2.62]}>
      <mesh position={[0, 0.02, 0.05]} castShadow>
        <boxGeometry args={[0.32, 0.02, 0.2]} />
        <meshStandardMaterial color="#b9b6ae" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.05, 0.36, 0.03]} />
        <meshStandardMaterial color="#b9b6ae" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.5, 0.03]} castShadow>
        <boxGeometry args={[1.18, 0.7, 0.035]} />
        <meshStandardMaterial color="#141615" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0.049]}>
        <planeGeometry args={[1.12, 0.645]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Bot({ color, stage, reduced }: { color: string; stage: number; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const eye = useLerpColor(color, reduced)
  const eyeMat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock, pointer }) => {
    if (eyeMat.current) {
      eyeMat.current.color.copy(eye)
      eyeMat.current.emissive.copy(eye)
    }
    if (!ref.current || reduced) return
    ref.current.position.y = 1.02 + Math.sin(clock.elapsedTime * 1.6) * 0.025
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, -0.5 + pointer.x * 0.5, 0.05)
  })
  return (
    <group ref={ref} position={[1.18, 1.02, -2.3]} rotation={[0, -0.5, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.12, 32, 24]} />
        <meshStandardMaterial color="#e9e6df" roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.01, 0.085]} rotation={[0, 0, 0]}>
        <capsuleGeometry args={[0.035, 0.09, 6, 16]} />
        <meshStandardMaterial color="#121413" roughness={0.3} />
      </mesh>
      {[-0.03, 0.03].map((x) => (
        <mesh key={x} position={[x, 0.015, 0.123]}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshStandardMaterial ref={x < 0 ? eyeMat : undefined} color={color} emissive={color} emissiveIntensity={1.4} />
        </mesh>
      ))}
      <Grow visible={stage >= 1} reduced={reduced} position={[0, 0.115, 0]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.08, 6]} />
          <meshStandardMaterial color="#5f8f4f" />
        </mesh>
        <Leaf position={[0, 0.08, 0]} rotation={[0.3, 0, -0.8]} scale={0.06} color="#7bb06a" />
        <Leaf position={[0, 0.07, 0]} rotation={[0.3, 0, 0.8]} scale={0.05} color="#6fa35f" />
      </Grow>
      <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.07, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>
    </group>
  )
}

function Desk() {
  return (
    <group>
      <mesh position={[0.3, 0.76, -2.45]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.05, 0.95]} />
        <meshStandardMaterial color="#c9bba4" roughness={0.6} />
      </mesh>
      {[-0.95, 1.55].map((x) => (
        <mesh key={x} position={[x, 0.37, -2.45]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.74, 0.86]} />
          <meshStandardMaterial color="#1c1e1d" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0.25, 0.795, -2.12]} castShadow>
        <boxGeometry args={[0.66, 0.02, 0.2]} />
        <meshStandardMaterial color="#d8d4cb" roughness={0.5} />
      </mesh>
      <mesh position={[0.78, 0.795, -2.12]} castShadow>
        <boxGeometry args={[0.07, 0.022, 0.11]} />
        <meshStandardMaterial color="#d8d4cb" roughness={0.4} />
      </mesh>
      <mesh position={[-0.45, 0.84, -2.2]} castShadow>
        <cylinderGeometry args={[0.045, 0.04, 0.1, 20]} />
        <meshStandardMaterial color="#1f2321" roughness={0.4} />
      </mesh>
      {/* chair */}
      <group position={[0.35, 0, -1.45]} rotation={[0, 0.25, 0]}>
        <mesh position={[0, 0.47, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.52, 0.06, 0.5]} />
          <meshStandardMaterial color="#2a2d2c" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.82, 0.24]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.62, 0.05]} />
          <meshStandardMaterial color="#2a2d2c" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.23, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.44, 10]} />
          <meshStandardMaterial color="#8d8a83" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.03, 5]} />
          <meshStandardMaterial color="#1b1d1c" />
        </mesh>
      </group>
    </group>
  )
}

/* ───────────── room ───────────── */

function Room({ palette, reduced }: { palette: Palette; reduced: boolean }) {
  const H = 3.1
  return (
    <group>
      {/* floor slab */}
      <mesh position={[0, -0.1, -0.75]} receiveShadow>
        <boxGeometry args={[6, 0.2, 4.6]} />
        <LerpMaterial color={palette.floor} reduced={reduced} roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.32, -0.75]}>
        <boxGeometry args={[6.02, 0.24, 4.62]} />
        <LerpMaterial color={palette.floorEdge} reduced={reduced} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, H / 2, -3.05]} receiveShadow castShadow>
        <boxGeometry args={[6, H, 0.1]} />
        <LerpMaterial color={palette.wall} reduced={reduced} />
      </mesh>
      {/* left wall with a window opening: z ∈ [-1.7, 0.3], y ∈ [1.0, 2.45] */}
      {(
        [
          [1.0 / 2, 1.0, -0.75, 4.6],
          [(2.45 + H) / 2, H - 2.45, -0.75, 4.6],
          [(1.0 + 2.45) / 2, 1.45, (0.3 + 1.55) / 2, 1.25],
          [(1.0 + 2.45) / 2, 1.45, (-3.05 - 1.7) / 2, 1.35],
        ] as const
      ).map(([y, h, z, d], i) => (
        <mesh key={i} position={[-3.05, y, z]} receiveShadow castShadow>
          <boxGeometry args={[0.1, h, d]} />
          <LerpMaterial color={palette.wallSide} reduced={reduced} />
        </mesh>
      ))}
      {/* window frame + glass glow */}
      <mesh position={[-3.75, 1.725, -0.7]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[3.2, 2.6]} />
        <LerpMaterial color={palette.glass} reduced={reduced} emissive={palette.glass} />
      </mesh>
      {[1.0, 2.45].map((y) => (
        <mesh key={y} position={[-3.0, y, -0.7]} castShadow>
          <boxGeometry args={[0.16, 0.035, 2.04]} />
          <meshStandardMaterial color="#d6d1c6" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[-3.0, 1.725, -0.7]} castShadow>
        <boxGeometry args={[0.06, 1.45, 0.03]} />
        <meshStandardMaterial color="#d6d1c6" roughness={0.5} />
      </mesh>
      {/* shelf */}
      <mesh position={[2.0, 1.95, -2.86]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.04, 0.28]} />
        <meshStandardMaterial color="#c9bba4" roughness={0.6} />
      </mesh>
      {[
        [1.55, 0.26, '#3b4a5a'],
        [1.64, 0.22, '#6d6355'],
        [1.72, 0.29, '#2c3530'],
      ].map(([x, h, c]) => (
        <mesh key={x as number} position={[x as number, 1.97 + (h as number) / 2, -2.86]} castShadow>
          <boxGeometry args={[0.07, h as number, 0.2]} />
          <meshStandardMaterial color={c as string} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function Lights({ palette, reduced, stage }: { palette: Palette; reduced: boolean; stage: number }) {
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sunColor = useLerpColor(palette.sun, reduced)
  const sky = useLerpColor(palette.sky, reduced)
  const ground = useLerpColor(palette.ground, reduced)
  const { scene } = useThree()
  useEffect(() => {
    if (sun.current) scene.add(sun.current.target)
  }, [scene])
  useFrame((_, dt) => {
    const k = reduced ? 1 : Math.min(1, dt * 1.6)
    if (sun.current) {
      sun.current.color.copy(sunColor)
      sun.current.intensity += (palette.sunIntensity - sun.current.intensity) * k
      sun.current.target.position.set(0.4, 0, -1.2)
    }
    if (hemi.current) {
      hemi.current.color.copy(sky)
      hemi.current.groundColor.copy(ground)
      hemi.current.intensity += (palette.hemi - hemi.current.intensity) * k
    }
  })
  return (
    <>
      <hemisphereLight ref={hemi} args={[palette.sky, palette.ground, palette.hemi]} />
      <directionalLight
        ref={sun}
        position={[-7, 4.6, -0.2]}
        intensity={palette.sunIntensity}
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      {/* soft fill from the open front so the diorama never goes muddy */}
      <directionalLight position={[5, 6, 8]} intensity={0.9 + stage * 0.1} color="#fff4e6" />
      {/* the desk lamp: cool in the cold room, gone once daylight arrives */}
      <pointLight position={[-0.6, 1.6, -2.3]} intensity={stage === 0 ? 1.2 : 0.25} distance={3} color={stage === 0 ? '#cfe0ff' : '#ffd9a1'} />
    </>
  )
}

function OutsideFoliage({ visible, reduced }: { visible: boolean; reduced: boolean }) {
  // Branches beyond the window: they cast moving leaf shadows into the room.
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current && !reduced) ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.6) * 0.04
  })
  return (
    <Grow visible={visible} reduced={reduced} position={[-3.4, 2.5, -1.6]}>
      <group ref={ref}>
        <Vine seed={101} length={2.2} dir={[0.05, -0.35, 1]} />
        <group position={[-0.1, 0.05, 0.6]}>
          <Vine seed={131} length={1.4} dir={[0.05, -0.6, 0.8]} />
        </group>
      </group>
    </Grow>
  )
}

function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera, size } = useThree()
  const base = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    // Pull back on narrow (portrait) canvases so the whole diorama stays in frame.
    const aspect = size.width / Math.max(1, size.height)
    const dist = aspect < 0.9 ? 1.45 : aspect < 1.25 ? 1.18 : 1
    base.set(7.6 * dist, 6.0 * dist, 8.6 * dist)
    camera.position.copy(base)
    camera.lookAt(-0.2, 0.85, -0.95)
  }, [base, camera, size])
  useFrame(({ pointer }) => {
    if (reduced) return
    camera.position.x += (base.x + pointer.x * 0.45 - camera.position.x) * 0.04
    camera.position.y += (base.y + pointer.y * 0.25 - camera.position.y) * 0.04
    camera.lookAt(-0.2, 0.85, -0.95)
  })
  return null
}

export interface LivingWorkspaceSceneProps {
  stage: RoomStage
  reducedMotion: boolean
}

export default function LivingWorkspaceScene({ stage, reducedMotion }: LivingWorkspaceSceneProps) {
  const palette = PALETTES[stage]
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [7.6, 6.0, 8.6], fov: 30, near: 0.1, far: 80 }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.3
      }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      aria-hidden
    >
      <CameraRig reduced={reducedMotion} />
      <Lights palette={palette} reduced={reducedMotion} stage={stage} />
      <Room palette={palette} reduced={reducedMotion} />
      <Desk />
      <Monitor stage={stage} accent={palette.screen} />
      <Bot color={palette.bot} stage={stage} reduced={reducedMotion} />

      {/* Stage 1 · First Growth */}
      <Grow visible={stage >= 1} reduced={reducedMotion} position={[-0.72, 0.785, -2.45]} delay={0.2}>
        <group scale={1.9}>
          <Seedling />
        </group>
      </Grow>

      {/* Stage 2 · New Patterns */}
      <OutsideFoliage visible={stage >= 2} reduced={reducedMotion} />
      <Grow visible={stage >= 2} reduced={reducedMotion} position={[-2.45, 0, -2.4]} delay={0.1}>
        <FloorPlant seed={3} />
      </Grow>
      <Grow visible={stage >= 2} reduced={reducedMotion} position={[2.15, 2.25, -1.9]} delay={0.5}>
        <HangingPlant />
      </Grow>
      <Grow visible={stage >= 2} reduced={reducedMotion} position={[2.3, 1.97, -2.85]} delay={0.7}>
        <group scale={0.55}>
          <Seedling />
        </group>
      </Grow>

      {/* Stage 3 · Living System */}
      <Grow visible={stage >= 3} reduced={reducedMotion} position={[2.35, 0, -0.4]} delay={0.2}>
        <FloorPlant seed={17} height={1.9} leaves={22} />
      </Grow>
      <Grow visible={stage >= 3} reduced={reducedMotion} position={[-2.95, 3.05, -2.95]} delay={0.6}>
        <Vine seed={211} length={2.6} dir={[1, -0.25, 0]} />
      </Grow>
      <Grow visible={stage >= 3} reduced={reducedMotion} position={[-2.95, 3.0, -2.9]} delay={0.9}>
        <Vine seed={227} length={1.7} dir={[0, -1, 0.15]} />
      </Grow>
      <Grow visible={stage >= 3} reduced={reducedMotion} position={[0.4, 0.005, -1.0]} delay={0.4}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1.25, 48]} />
          <meshStandardMaterial color="#56704a" roughness={1} />
        </mesh>
      </Grow>
      {stage >= 3 && !reducedMotion && (
        <Sparkles count={40} scale={[2.4, 1.6, 2.2]} position={[-1.2, 1.5, -0.8]} size={2.2} speed={0.25} color="#ffd894" opacity={0.6} />
      )}
    </Canvas>
  )
}
