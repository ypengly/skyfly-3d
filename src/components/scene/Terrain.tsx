import { useMemo } from 'react'
import * as THREE from 'three'
import { heightAt } from '../../game/world/heightfield'
import type { EnvId } from '../../game/types'
import { smoothstep } from '../../game/noise'

interface Props {
  env: EnvId
  size: number
  segments: number
  receive?: boolean
}

const c = new THREE.Color() // output colour
const tmp = new THREE.Color() // scratch for lerp targets

function colorFor(env: EnvId, h: number, slope: number, out: THREE.Color) {
  if (env === 'tropical') {
    if (h < 0.4) return out.set('#2b8fa0')
    if (h < 2.4) return out.set('#f1dba5').lerp(tmp.set('#e5c98a'), slope)
    if (h < 7) return out.set('#4fae52').lerp(tmp.set('#3b8d46'), smoothstep(2.4, 7, h))
    if (h < 60) return out.set('#2f8a43').lerp(tmp.set('#6b6a58'), smoothstep(14, 34, h) * 0.7 + slope * 0.6)
    return out.set('#7c7f86').lerp(tmp.set('#eef3f6'), smoothstep(150, 260, h))
  }
  // mountain
  out.set('#3f7a40').lerp(tmp.set('#2a5430'), smoothstep(5, 60, h))
  out.lerp(tmp.set('#6e6a60'), Math.min(1, smoothstep(60, 150, h) * 0.9 + smoothstep(0.35, 0.9, slope) * 0.85))
  out.lerp(tmp.set('#f2f6fa'), smoothstep(190, 250, h) * (1 - slope * 0.8))
  return out
}

/** Height-field mesh built once from the same function the physics uses. */
export function Terrain({ env, size, segments, receive = true }: Props) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, segments, segments)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const n = pos.count
    const hs = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const h = heightAt(env, pos.getX(i), pos.getZ(i))
      hs[i] = h
      pos.setY(i, h)
    }
    g.computeVertexNormals()
    const nrm = g.attributes.normal as THREE.BufferAttribute
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const slope = 1 - Math.min(1, Math.max(0, nrm.getY(i)))
      colorFor(env, hs[i], Math.min(1, slope * 2.2), c)
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [env, size, segments])

  return (
    <mesh geometry={geo} receiveShadow={receive}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading={env === 'mountain'} />
    </mesh>
  )
}
