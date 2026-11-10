import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { CITY_PITCH } from '../../game/world/generate'
import { mulberry32 } from '../../game/noise'
import { telemetry } from '../../game/telemetry'
import type { Quality, WorldData } from '../../game/types'

const buildingVert = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalW;
  attribute vec3 aTint;
  varying vec3 vTint;
  varying float vFog;
  void main() {
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vTint = aTint;
    vec4 mv = viewMatrix * w;
    vFog = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const buildingFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFog;
  uniform float uFogDensity;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vTint;
  varying float vFog;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 n = normalize(vNormalW);
    float side = abs(n.y) < 0.5 ? 1.0 : 0.0;
    vec2 uv = abs(n.x) > abs(n.z) ? vec2(vWorld.z, vWorld.y) : vec2(vWorld.x, vWorld.y);
    vec2 cell = vec2(3.6, 4.2);
    vec2 id = floor(uv / cell);
    vec2 f = fract(uv / cell);
    float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.78);
    float r = hash(id + floor(vTint.rg * 40.0));
    float lit = step(0.46, r);
    float flick = 0.75 + 0.25 * sin(uTime * (0.5 + r * 2.0) + r * 40.0);
    vec3 warm = mix(vec3(0.2, 0.9, 1.0), vec3(1.0, 0.25, 0.9), step(0.5, hash(id.yx + vTint.b * 9.0)));
    warm = mix(warm, vec3(1.0, 0.85, 0.45), step(0.86, r));
    vec3 base = vec3(0.025, 0.03, 0.055) + vTint * 0.05;
    vec3 col = base;
    col += side * win * lit * warm * 1.5 * flick;
    // rim lighting on vertical edges and roof glow
    float roof = step(0.5, n.y);
    col += roof * vec3(0.05, 0.08, 0.16);
    col += (1.0 - roof) * pow(1.0 - abs(f.x - 0.5) * 2.0, 18.0) * 0.0;
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
    col = mix(col, uFog, clamp(fog, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`

function Buildings({ data }: { data: number[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const n = data.length / 6
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uFog: { value: new THREE.Color('#12012b') }, uFogDensity: { value: 0.0016 } }),
    [],
  )
  const tint = useMemo(() => {
    const arr = new Float32Array(n * 3)
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      c.setHSL(data[i * 6 + 5], 0.8, 0.5)
      arr.set([c.r, c.g, c.b], i * 3)
    }
    return arr
  }, [data, n])
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    for (let i = 0; i < n; i++) {
      const [x, z, hw, hd, h] = data.slice(i * 6, i * 6 + 6)
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(hw * 2, h, hd * 2))
      ref.current.setMatrixAt(i, m)
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [data, n])
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]}>
        <instancedBufferAttribute attach="attributes-aTint" args={[tint, 3]} />
      </boxGeometry>
      <shaderMaterial vertexShader={buildingVert} fragmentShader={buildingFrag} uniforms={uniforms} />
    </instancedMesh>
  )
}

/** Glowing neon bars/signs fixed to building sides. */
function Signs({ data }: { data: number[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const count = Math.floor(data.length / 6)
  useEffect(() => {
    const r = mulberry32(5)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    const palette = ['#00e5ff', '#ff3df2', '#ffd23d', '#7dff6b', '#2f7bff']
    for (let i = 0; i < count; i++) {
      const [x, z, hw, hd, h] = data.slice(i * 6, i * 6 + 6)
      const face = Math.floor(r() * 4)
      const y = 8 + r() * Math.min(h - 10, 70)
      const w = 6 + r() * 10
      let px = x
      let pz = z
      let sx = w
      let sz = 0.5
      if (face === 0) pz = z + hd + 0.3
      else if (face === 1) pz = z - hd - 0.3
      else {
        px = x + (face === 2 ? hw + 0.3 : -hw - 0.3)
        sx = 0.5
        sz = w
      }
      m.compose(new THREE.Vector3(px, y, pz), q, new THREE.Vector3(sx, 1.2 + r() * 2.5, sz))
      ref.current.setMatrixAt(i, m)
      c.set(palette[Math.floor(r() * palette.length)]).multiplyScalar(2.2)
      ref.current.setColorAt(i, c)
    }
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [data, count])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

/** Ground with glowing street grid, drawn procedurally in a shader. */
function Ground() {
  const mesh = useRef<THREE.Mesh>(null!)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uFog: { value: new THREE.Color('#12012b') } }), [])
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
    const p = telemetry.pos
    mesh.current.position.set(p[0], 0, p[2])
  })
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3000, 3000]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vWorld; varying float vDist;
          void main(){ vec4 w = modelMatrix*vec4(position,1.0); vWorld=w.xyz; vec4 mv=viewMatrix*w; vDist=length(mv.xyz); gl_Position=projectionMatrix*mv; }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime; uniform vec3 uFog;
          varying vec3 vWorld; varying float vDist;
          void main(){
            float pitch = ${CITY_PITCH.toFixed(1)};
            vec2 g = mod(vWorld.xz + pitch*0.5, pitch) - pitch*0.5; // distance to street centre lines
            float dStreet = min(abs(g.x), abs(g.y));
            float road = 1.0 - smoothstep(11.0, 12.0, dStreet);
            float edge = smoothstep(10.0, 11.0, dStreet) * (1.0 - smoothstep(11.0, 12.2, dStreet));
            float centre = (1.0 - smoothstep(0.1, 0.5, dStreet)) * step(0.5, fract((vWorld.x + vWorld.z) / 12.0));
            vec3 col = mix(vec3(0.02,0.015,0.04), vec3(0.035,0.04,0.08), road);
            col += edge * vec3(0.0, 0.7, 1.0) * 1.3;
            col += centre * road * vec3(1.0, 0.2, 0.9) * 0.7;
            // wet reflections shimmer
            col += road * 0.03 * sin(vWorld.x*0.7 + uTime) * sin(vWorld.z*0.5 - uTime*0.7);
            float fog = 1.0 - exp(-0.0016*0.0016*vDist*vDist);
            col = mix(col, uFog, clamp(fog, 0.0, 1.0));
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  )
}

/** Falling rain streaks wrapped around the drone using only a vertex shader. */
function Rain({ count }: { count: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const geo = useMemo(() => {
    const r = mulberry32(42)
    const pos = new Float32Array(count * 6)
    const end = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const x = r() * 80
      const y = r() * 50
      const z = r() * 80
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], i * 6 + k * 3)
        end[i * 2 + k] = k
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    return g
  }, [count])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uC: { value: new THREE.Vector3() } }), [])
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
    const p = telemetry.pos
    uniforms.uC.value.set(p[0], p[1], p[2])
  })
  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={/* glsl */ `
          uniform float uTime; uniform vec3 uC; attribute float aEnd; varying float vA;
          void main(){
            vec3 p = position;
            p.y = mod(p.y - uTime*38.0, 50.0);
            vec3 base = vec3(mod(p.x - uC.x, 80.0) - 40.0, p.y - 25.0, mod(p.z - uC.z, 80.0) - 40.0);
            vec3 w = uC + base + vec3(0.0, aEnd*1.4, 0.0);
            vA = 0.35 * (1.0 - length(base)/55.0);
            gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `varying float vA; void main(){ gl_FragColor = vec4(0.6,0.85,1.0,max(vA,0.0)); }`}
      />
    </lineSegments>
  )
}

export function Cyber({ world, quality }: { world: WorldData; quality: Quality }) {
  return (
    <>
      <color attach="background" args={['#12012b']} />
      <fogExp2 attach="fog" args={['#12012b', 0.0016]} />
      <Stars radius={900} depth={60} count={quality === 'low' ? 600 : 2200} factor={5} fade speed={0.5} />
      <ambientLight intensity={0.3} color="#5c3cff" />
      <hemisphereLight args={['#3a2a8a', '#0a0220', 0.5]} />
      <Ground />
      <Buildings data={world.decor.buildings} />
      <Signs data={world.decor.buildings} />
      {quality !== 'low' && <Rain count={quality === 'high' ? 1800 : 900} />}
      {/* distant glow plane on the horizon */}
      <mesh position={[0, 120, -1500]}>
        <planeGeometry args={[3600, 500]} />
        <meshBasicMaterial color="#6d1aff" transparent opacity={0.16} fog={false} depthWrite={false} />
      </mesh>
    </>
  )
}
