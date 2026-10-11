import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { terrainHeight } from './terrain.ts'

const X = 3
const Z = 6

export default function Campsite() {
  const fire = useRef<THREE.PointLight>(null)
  const y = terrainHeight(X, Z)

  // Pislákoló tábortűz
  useFrame(({ clock }) => {
    if (fire.current) fire.current.intensity = 6 + Math.sin(clock.elapsedTime * 12) * 1.5
  })

  return (
    <group position={[X, y, Z]}>
      {/* Sátor */}
      <mesh position={[0, 0.55, 0]} rotation-y={Math.PI / 5} castShadow>
        <coneGeometry args={[0.9, 1.1, 4]} />
        <meshStandardMaterial color="#e07a3f" flatShading />
      </mesh>
      {/* Tábortűz */}
      <mesh position={[1.4, 0.15, 0.6]}>
        <coneGeometry args={[0.18, 0.4, 5]} />
        <meshStandardMaterial color="#f2b84b" emissive="#ff7a1a" emissiveIntensity={2} />
      </mesh>
      <pointLight ref={fire} position={[1.4, 0.6, 0.6]} color="#ff9a3c" distance={6} />
    </group>
  )
}
