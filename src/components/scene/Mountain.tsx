import { useEffect, useMemo, useRef } from 'react'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'
import { Terrain } from './Terrain'
import { Clouds, FollowSun } from './Common'
import type { Quality, WorldData } from '../../game/types'

const SUN: [number, number, number] = [-0.5, 0.42, -0.3]

function Forest({ data, quality }: { data: number[]; quality: Quality }) {
  const cones = useRef<THREE.InstancedMesh>(null!)
  const trunks = useRef<THREE.InstancedMesh>(null!)
  const n = data.length / 4
  const coneGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(2.6, 9, 7, 1)
    g.translate(0, 8.2, 0)
    return g
  }, [])
  const trunkGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.35, 0.5, 4, 5)
    g.translate(0, 2, 0)
    return g
  }, [])
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    for (let i = 0; i < n; i++) {
      const x = data[i * 4]
      const y = data[i * 4 + 1]
      const z = data[i * 4 + 2]
      const s = data[i * 4 + 3]
      m.compose(new THREE.Vector3(x, y - 0.4, z), q, new THREE.Vector3(s, s * (0.9 + (i % 5) * 0.08), s))
      cones.current.setMatrixAt(i, m)
      trunks.current.setMatrixAt(i, m)
    }
    cones.current.instanceMatrix.needsUpdate = true
    trunks.current.instanceMatrix.needsUpdate = true
  }, [data, n])
  return (
    <>
      <instancedMesh ref={cones} args={[coneGeo, undefined, n]} castShadow={quality === 'high'}>
        <meshStandardMaterial color="#1f5a33" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[trunkGeo, undefined, n]}>
        <meshStandardMaterial color="#4a3526" roughness={1} />
      </instancedMesh>
    </>
  )
}

export function Mountain({ world, quality }: { world: WorldData; quality: Quality }) {
  const seg = quality === 'low' ? 170 : quality === 'medium' ? 250 : 340
  const trees = useMemo(() => {
    const d = world.decor.trees
    const keep = quality === 'low' ? 0.35 : quality === 'medium' ? 0.7 : 1
    const out: number[] = []
    for (let i = 0; i + 3 < d.length; i += 4) if ((i / 4) % 100 < keep * 100) out.push(d[i], d[i + 1], d[i + 2], d[i + 3])
    return out
  }, [world, quality])
  return (
    <>
      <color attach="background" args={['#aebfd0']} />
      <fog attach="fog" args={['#c4d0dc', 120, quality === 'low' ? 900 : 1350]} />
      <Sky distance={4500} sunPosition={[SUN[0] * 100, SUN[1] * 100, SUN[2] * 100]} turbidity={6} rayleigh={2.2} mieCoefficient={0.01} mieDirectionalG={0.8} />
      <hemisphereLight args={['#cfdcec', '#4b5e48', 0.55]} />
      <FollowSun dir={SUN} color="#ffe6c4" intensity={1.6} shadows={quality !== 'low'} mapSize={quality === 'high' ? 2048 : 1024} />
      <Terrain env="mountain" size={3200} segments={seg} />
      <Forest data={trees} quality={quality} />
      <Clouds count={quality === 'low' ? 8 : 16} altitude={[320, 420]} color="#f4f7fa" opacity={0.8} />
    </>
  )
}
