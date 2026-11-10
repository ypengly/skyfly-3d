import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '../../game/noise'
import { telemetry } from '../../game/telemetry'

/** Directional sun whose shadow frustum follows the drone, so shadows stay sharp near the player. */
export function FollowSun({
  dir,
  color,
  intensity,
  shadows,
  mapSize = 2048,
}: {
  dir: [number, number, number]
  color: string
  intensity: number
  shadows: boolean
  mapSize?: number
}) {
  const light = useRef<THREE.DirectionalLight>(null!)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const p = telemetry.pos
    target.position.set(p[0], p[1], p[2])
    light.current.position.set(p[0] + dir[0] * 140, p[1] + dir[1] * 140, p[2] + dir[2] * 140)
    light.current.target = target
    target.updateMatrixWorld()
  })
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        color={color}
        intensity={intensity}
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={10}
        shadow-camera-far={320}
        shadow-bias={-0.0006}
      />
    </>
  )
}

/** Low-poly drifting clouds as a handful of instanced puffs. */
export function Clouds({
  count = 36,
  altitude = [150, 260],
  spread = 1600,
  color = '#ffffff',
  opacity = 0.9,
}: {
  count?: number
  altitude?: [number, number]
  spread?: number
  color?: string
  opacity?: number
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const group = useRef<THREE.Group>(null!)
  const puffs = 6
  const data = useMemo(() => {
    const r = mulberry32(99)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const out: THREE.Matrix4[] = []
    for (let i = 0; i < count; i++) {
      const cx = (r() - 0.5) * spread * 2
      const cz = (r() - 0.5) * spread * 2
      const cy = altitude[0] + r() * (altitude[1] - altitude[0])
      const s = 30 + r() * 40
      for (let j = 0; j < puffs; j++) {
        const px = cx + (r() - 0.5) * s * 2.2
        const pz = cz + (r() - 0.5) * s * 1.3
        const py = cy + (r() - 0.3) * s * 0.35
        const sc = s * (0.45 + r() * 0.5)
        m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(sc, sc * 0.55, sc * 0.9))
        out.push(m.clone())
      }
    }
    return out
  }, [count, altitude, spread])

  useEffect(() => {
    data.forEach((m, i) => mesh.current.setMatrixAt(i, m))
    mesh.current.instanceMatrix.needsUpdate = true
  }, [data])

  useFrame((_, dt) => {
    group.current.position.x += dt * 4
    if (group.current.position.x > spread) group.current.position.x -= spread * 2
  })

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count * puffs]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial color={color} transparent opacity={opacity} flatShading fog={false} />
      </instancedMesh>
    </group>
  )
}
