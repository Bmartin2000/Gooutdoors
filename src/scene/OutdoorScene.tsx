import { OrbitControls, Sky } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import Campsite from './Campsite.tsx'
import Forest from './Forest.tsx'
import Terrain from './Terrain.tsx'

const SUN: [number, number, number] = [30, 18, 10]

export default function OutdoorScene() {
  return (
    <Canvas shadows camera={{ position: [14, 9, 18], fov: 50 }} dpr={[1, 2]}>
      {/* Procedurális égbolt – nincs külső HDR/textúra letöltés */}
      <Sky sunPosition={SUN} turbidity={6} rayleigh={1.2} />
      <fog attach="fog" args={['#cfe3ea', 30, 70]} />
      <hemisphereLight args={['#dfefff', '#4b5d3a', 0.8]} />
      <directionalLight
        position={SUN}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <Terrain />
      <Forest />
      <Campsite />
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.4}
        enablePan={false}
        minDistance={8}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.2}
      />
    </Canvas>
  )
}
