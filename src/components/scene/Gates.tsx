import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GameSim } from '../../game/sim'

interface Props {
  sim: GameSim
  color: string
}

/**
 * Renders the next three gates only (active, next, next+1) by recycling three meshes,
 * so a 30-gate course costs the same as a 3-gate one.
 */
export function Gates({ sim, color }: Props) {
  const slots = useRef<(THREE.Group | null)[]>([null, null, null])
  const discs = useRef<(THREE.Mesh | null)[]>([null, null, null])
  const pad = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const ringGeo = useMemo(() => new THREE.TorusGeometry(1, 0.045, 12, 56), [])
  const innerGeo = useMemo(() => new THREE.RingGeometry(0.92, 1, 56), [])
  const discGeo = useMemo(() => new THREE.CircleGeometry(0.94, 40), [])
  const mats = useMemo(
    () => [
      new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.75 }),
      new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.3 }),
    ],
    [color],
  )
  const discMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    [color],
  )

  useFrame(({ clock }) => {
    const course = sim.course
    const t = clock.elapsedTime
    for (let i = 0; i < 3; i++) {
      const grp = slots.current[i]
      if (!grp) continue
      if (!course) {
        grp.visible = false
        continue
      }
      const gi = sim.gateIndex + i
      const last = gi >= course.gates.length
      const wrap = last && course.laps > sim.lap
      if (last && !wrap) {
        grp.visible = false
        continue
      }
      const g = course.gates[gi % course.gates.length]
      if (g.kind === 'pad') {
        grp.visible = false
        continue
      }
      grp.visible = true
      grp.position.set(g.pos[0], g.pos[1], g.pos[2])
      grp.rotation.set(0, g.yaw, 0)
      grp.scale.setScalar(g.radius)
      if (i === 0) {
        const pulse = 1 + Math.sin(t * 6) * 0.04
        grp.scale.setScalar(g.radius * pulse)
      }
      const d = discs.current[i]
      if (d) d.visible = i === 0
    }

    // landing pad
    const p = pad.current
    if (p) {
      const g = course && sim.gateIndex < course.gates.length ? course.gates[sim.gateIndex] : null
      if (g && g.kind === 'pad') {
        p.visible = true
        p.position.set(g.pos[0], g.pos[1], g.pos[2])
        p.scale.setScalar(g.radius)
        const b = beam.current
        if (b) (b.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 4) * 0.08
      } else p.visible = false
    }
  })

  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          ref={(el) => {
            slots.current[i] = el
          }}
          visible={false}
        >
          <mesh geometry={ringGeo} material={mats[i]} />
          <mesh geometry={innerGeo} material={mats[i]} scale={[1, 1, 1]} />
          <mesh
            ref={(el) => {
              discs.current[i] = el
            }}
            geometry={discGeo}
            material={discMat}
          />
          {/* direction chevrons */}
          {i === 0 && (
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <ringGeometry args={[0.3, 0.34, 3, 1]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.45} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
      <group ref={pad} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1, 48]} />
          <meshBasicMaterial color="#7dff6b" toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.8, 40]} />
          <meshBasicMaterial color="#7dff6b" transparent opacity={0.25} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh ref={beam} position={[0, 12, 0]}>
          <cylinderGeometry args={[0.9, 0.9, 24, 24, 1, true]} />
          <meshBasicMaterial color="#7dff6b" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Static pillars for challenge mode (positions come from the world generator). */
export function Obstacles({ data, color }: { data: number[]; color: string }) {
  const items = useMemo(() => {
    const out: { x: number; z: number; r: number; y0: number; y1: number }[] = []
    for (let i = 0; i + 4 < data.length; i += 5) out.push({ x: data[i], z: data[i + 1], r: data[i + 2], y0: data[i + 3], y1: data[i + 4] })
    return out
  }, [data])
  return (
    <group>
      {items.map((o, i) => (
        <group key={i} position={[o.x, (o.y0 + o.y1) / 2, o.z]}>
          <mesh castShadow>
            <cylinderGeometry args={[o.r, o.r * 1.1, o.y1 - o.y0, 14]} />
            <meshStandardMaterial color="#1b2233" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0, (o.y1 - o.y0) / 2 + 0.2, 0]}>
            <sphereGeometry args={[o.r * 0.8, 12, 10]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          {[0.25, 0.5, 0.75].map((f) => (
            <mesh key={f} position={[0, (f - 0.5) * (o.y1 - o.y0), 0]}>
              <cylinderGeometry args={[o.r * 1.12, o.r * 1.12, 0.35, 14]} />
              <meshBasicMaterial color="#ff3b4a" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
