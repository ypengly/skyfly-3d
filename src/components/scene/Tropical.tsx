import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Terrain } from './Terrain'
import { Clouds, FollowSun } from './Common'
import type { WorldData, Quality } from '../../game/types'
import { telemetry } from '../../game/telemetry'

const SUN: [number, number, number] = [0.55, 0.55, 0.35]

function Ocean({ detail }: { detail: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!)
  const uTime = useRef({ value: 0 })
  const mesh = useRef<THREE.Mesh>(null!)

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#1a9bb5',
      roughness: 0.18,
      metalness: 0.15,
      transparent: true,
      opacity: 0.88,
    })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime.current
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position);
           vec3 wp = (modelMatrix * vec4(position,1.0)).xyz;
           float w = sin(wp.x*0.045 + uTime*0.9)*0.55 + sin(wp.z*0.06 + uTime*1.2)*0.4 + sin((wp.x+wp.z)*0.11 + uTime*1.7)*0.18;
           transformed.z += w;`,
        )
    }
    return m
  }, [])

  useFrame(({ clock }) => {
    uTime.current.value = clock.elapsedTime
    // keep the sea centred under the drone so it looks infinite
    const p = telemetry.pos
    const step = 40
    mesh.current.position.set(Math.round(p[0] / step) * step, 0, Math.round(p[2] / step) * step)
  })

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[2600, 2600, detail, detail]} />
    </mesh>
  )
}

function Palms({ data, quality }: { data: number[]; quality: Quality }) {
  const trunk = useRef<THREE.InstancedMesh>(null!)
  const fronds = useRef<THREE.InstancedMesh>(null!)
  const n = data.length / 5

  const frondGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 7; i++) {
      const g = new THREE.PlaneGeometry(0.9, 4.4, 1, 3)
      const pos = g.attributes.position as THREE.BufferAttribute
      for (let k = 0; k < pos.count; k++) {
        const y = pos.getY(k) + 2.2
        pos.setZ(k, -y * y * 0.07)
        pos.setX(k, pos.getX(k) * (1 - y / 6))
        pos.setY(k, y)
      }
      g.rotateX(-0.25)
      g.rotateY((i / 7) * Math.PI * 2)
      g.translate(0, 9.4, 0)
      parts.push(g)
    }
    return mergeGeometries(parts) as THREE.BufferGeometry
  }, [])
  const trunkGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.28, 0.5, 9.6, 7, 1)
    g.translate(0, 4.8, 0)
    return g
  }, [])

  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < n; i++) {
      const [x, y, z, s, rot] = data.slice(i * 5, i * 5 + 5)
      e.set(0, rot, 0)
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(x, y - 0.3, z), q, new THREE.Vector3(s, s, s))
      trunk.current.setMatrixAt(i, m)
      fronds.current.setMatrixAt(i, m)
    }
    trunk.current.instanceMatrix.needsUpdate = true
    fronds.current.instanceMatrix.needsUpdate = true
  }, [data, n])

  return (
    <>
      <instancedMesh ref={trunk} args={[trunkGeo, undefined, n]} castShadow={quality === 'high'}>
        <meshStandardMaterial color="#7b5a3a" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={fronds} args={[frondGeo, undefined, n]} castShadow={quality !== 'low'}>
        <meshStandardMaterial color="#2f9a45" roughness={0.9} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  )
}

function Rocks({ data }: { data: number[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const n = data.length / 5
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    for (let i = 0; i < n; i++) {
      const [x, y, z, s, r] = data.slice(i * 5, i * 5 + 5)
      q.setFromEuler(new THREE.Euler(r, r * 2, r * 3))
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * 1.4, s, s * 1.2))
      ref.current.setMatrixAt(i, m)
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [data, n])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#8a8a86" roughness={1} flatShading />
    </instancedMesh>
  )
}

export function Tropical({ world, quality }: { world: WorldData; quality: Quality }) {
  const seg = quality === 'low' ? 160 : quality === 'medium' ? 240 : 320
  return (
    <>
      <color attach="background" args={['#9fd4f2']} />
      <fog attach="fog" args={['#bfe3f5', 260, quality === 'low' ? 1100 : 1700]} />
      <Sky distance={4500} sunPosition={[SUN[0] * 100, SUN[1] * 100, SUN[2] * 100]} turbidity={3} rayleigh={1.4} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <hemisphereLight args={['#cfeaff', '#6fbf9a', 0.75]} />
      <ambientLight intensity={0.15} />
      <FollowSun dir={SUN} color="#fff1d6" intensity={2.3} shadows={quality !== 'low'} mapSize={quality === 'high' ? 2048 : 1024} />
      <Terrain env="tropical" size={2400} segments={seg} />
      <Ocean detail={quality === 'low' ? 40 : 110} />
      <Palms data={world.decor.palms} quality={quality} />
      <Rocks data={world.decor.rocks} />
      <Clouds count={quality === 'low' ? 14 : 30} />
    </>
  )
}
