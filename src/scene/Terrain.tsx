import { useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight, WATER_LEVEL } from './terrain.ts'

const SIZE = 60
const SEGMENTS = 90

const grass = new THREE.Color('#5f8f4e')
const rock = new THREE.Color('#7b7a72')
const snow = new THREE.Color('#f4f6f8')
const sand = new THREE.Color('#c9b98a')

export default function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors: number[] = []
    const c = new THREE.Color()

    for (let i = 0; i < pos.count; i++) {
      const h = terrainHeight(pos.getX(i), pos.getZ(i))
      pos.setY(i, h)
      if (h < WATER_LEVEL + 0.25) c.copy(sand)
      else if (h < 3.5) c.copy(grass)
      else if (h < 7) c.copy(rock)
      else c.copy(snow)
      colors.push(c.r, c.g, c.b)
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo.toNonIndexed()
  }, [])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors flatShading />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={WATER_LEVEL}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshStandardMaterial color="#3d8fb5" transparent opacity={0.75} roughness={0.15} />
      </mesh>
    </group>
  )
}
