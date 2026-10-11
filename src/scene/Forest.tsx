import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { seededRandom, terrainHeight, WATER_LEVEL } from './terrain.ts'

const TREE_COUNT = 220

export default function Forest() {
  const crowns = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)

  const trees = useMemo(() => {
    const rand = seededRandom(42)
    const result: { x: number; y: number; z: number; s: number }[] = []
    while (result.length < TREE_COUNT) {
      const x = (rand() - 0.5) * 50
      const z = (rand() - 0.5) * 50
      const y = terrainHeight(x, z)
      // Csak a fűsávba ültetünk: ne a tóba és ne a sziklás csúcsokra
      if (y > WATER_LEVEL + 0.4 && y < 3.2) result.push({ x, y, z, s: 0.6 + rand() * 0.7 })
    }
    return result
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Object3D()
    trees.forEach((t, i) => {
      m.position.set(t.x, t.y + 1.1 * t.s, t.z)
      m.scale.setScalar(t.s)
      m.updateMatrix()
      crowns.current!.setMatrixAt(i, m.matrix)

      m.position.set(t.x, t.y + 0.25 * t.s, t.z)
      m.updateMatrix()
      trunks.current!.setMatrixAt(i, m.matrix)
    })
    crowns.current!.instanceMatrix.needsUpdate = true
    trunks.current!.instanceMatrix.needsUpdate = true
  }, [trees])

  return (
    <group>
      <instancedMesh ref={crowns} args={[undefined, undefined, TREE_COUNT]} castShadow>
        <coneGeometry args={[0.55, 1.8, 6]} />
        <meshStandardMaterial color="#2f6f4e" flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, TREE_COUNT]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.5, 5]} />
        <meshStandardMaterial color="#6b4a2f" flatShading />
      </instancedMesh>
    </group>
  )
}
