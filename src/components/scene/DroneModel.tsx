import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export interface DroneModelHandle {
  group: THREE.Group
  /** 0..1 motor effort, drives propeller speed */
  setThrottle: (t: number) => void
}

interface Props {
  color: string
  accent: string
  hideBody?: boolean
  spin?: boolean
}

const ARM = 0.62

/** Procedural quadcopter: body, four arms, four spinning props and glowing LEDs. */
export const DroneModel = forwardRef<DroneModelHandle, Props>(function DroneModel({ color, accent, hideBody, spin = true }, ref) {
  const group = useRef<THREE.Group>(null!)
  const props = useRef<(THREE.Group | null)[]>([])
  const throttle = useRef(0.3)
  const discs = useRef<(THREE.Mesh | null)[]>([])

  useImperativeHandle(ref, () => ({
    get group() {
      return group.current
    },
    setThrottle: (t: number) => {
      throttle.current = t
    },
  }))

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 }), [color])
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0b0f18', metalness: 0.4, roughness: 0.6 }), [])
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: accent }), [accent])
  const red = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff3b4a' }), [])
  const discMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#cfefff', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    [],
  )

  useFrame((_, dt) => {
    if (!spin) return
    const speed = 30 + throttle.current * 130
    for (let i = 0; i < 4; i++) {
      const p = props.current[i]
      if (p) p.rotation.y += speed * dt * (i % 2 === 0 ? 1 : -1)
      const d = discs.current[i]
      if (d) (d.material as THREE.MeshBasicMaterial).opacity = 0.05 + throttle.current * 0.12
    }
  })

  const motors: [number, number, boolean][] = [
    [ARM, -ARM, true],
    [-ARM, -ARM, true],
    [ARM, ARM, false],
    [-ARM, ARM, false],
  ]

  return (
    <group ref={group}>
      <pointLight color={accent} intensity={2.5} distance={10} decay={2} position={[0, -0.6, 0]} />
      <group visible={!hideBody}>
        {/* central body */}
        <mesh material={bodyMat} castShadow>
          <boxGeometry args={[0.52, 0.16, 0.7]} />
        </mesh>
        <mesh material={darkMat} position={[0, 0.11, 0.02]} scale={[1, 1, 1]} castShadow>
          <boxGeometry args={[0.36, 0.08, 0.46]} />
        </mesh>
        {/* camera gimbal on the nose (-Z) */}
        <mesh material={darkMat} position={[0, -0.06, -0.36]}>
          <sphereGeometry args={[0.1, 12, 10]} />
        </mesh>
        <mesh material={glow} position={[0, -0.06, -0.45]}>
          <circleGeometry args={[0.04, 10]} />
        </mesh>
        {/* landing skids */}
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} material={darkMat} position={[x, -0.2, 0]}>
            <boxGeometry args={[0.03, 0.03, 0.7]} />
          </mesh>
        ))}
        {/* status LEDs: red at the rear, accent colour at the front */}
        <mesh material={red} position={[0, 0.0, 0.36]}>
          <sphereGeometry args={[0.04, 8, 8]} />
        </mesh>
        <mesh material={glow} position={[0, 0.0, -0.36]}>
          <sphereGeometry args={[0.04, 8, 8]} />
        </mesh>
        {/* arms and motors */}
        {motors.map(([x, z, front], i) => {
          const len = Math.hypot(x, z)
          const ang = Math.atan2(x, z)
          return (
            <group key={i}>
              <mesh material={bodyMat} position={[x / 2, 0, z / 2]} rotation={[0, ang, 0]} castShadow>
                <boxGeometry args={[0.07, 0.06, len]} />
              </mesh>
              <mesh material={darkMat} position={[x, 0.05, z]} castShadow>
                <cylinderGeometry args={[0.09, 0.09, 0.12, 14]} />
              </mesh>
              <mesh material={front ? glow : red} position={[x, -0.03, z]}>
                <sphereGeometry args={[0.035, 8, 8]} />
              </mesh>
              <group
                ref={(el) => {
                  props.current[i] = el
                }}
                position={[x, 0.13, z]}
              >
                <mesh material={darkMat}>
                  <boxGeometry args={[0.62, 0.012, 0.06]} />
                </mesh>
                <mesh material={darkMat} position={[0, 0.006, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.03, 8]} />
                </mesh>
              </group>
              <mesh
                ref={(el) => {
                  discs.current[i] = el
                }}
                material={discMat.clone()}
                position={[x, 0.14, z]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <circleGeometry args={[0.32, 20]} />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
})
