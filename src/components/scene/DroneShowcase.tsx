import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { DroneModel, type DroneModelHandle } from './DroneModel'

function Spinner({ color, accent }: { color: string; accent: string }) {
  const ref = useRef<DroneModelHandle>(null)
  useFrame(({ clock }, dt) => {
    const g = ref.current?.group
    if (!g) return
    g.rotation.y += dt * 0.6
    g.rotation.x = 0.25 + Math.sin(clock.elapsedTime * 0.8) * 0.05
    g.position.y = Math.sin(clock.elapsedTime * 1.4) * 0.06
    ref.current?.setThrottle(0.6)
  })
  return <DroneModel ref={ref} color={color} accent={accent} />
}

/** Small self-contained 3D preview used on the drone selection screen. */
export function DroneShowcase({ color, accent }: { color: string; accent: string }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.1, 2.6], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color('#000000'), 0)
      }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 2]} intensity={2.2} />
      <pointLight position={[-2, 0.5, -1]} intensity={8} color={accent} />
      <Spinner color={color} accent={accent} />
    </Canvas>
  )
}
