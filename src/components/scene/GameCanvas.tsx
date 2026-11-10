import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useGame } from '../../store/useGame'
import { Flight } from './Flight'

/** The single WebGL canvas for gameplay. Handles DPR by quality and context loss. */
export function GameCanvas() {
  const quality = useGame((s) => s.settings.quality)
  const setError = useGame((s) => s.setError)
  const dpr: [number, number] = quality === 'low' ? [0.7, 1] : quality === 'medium' ? [1, 1.5] : [1, 2]
  const shadows = quality !== 'low'

  // R3F deliberately loses the GL context when the canvas unmounts; only real losses are errors
  const unmounting = useRef(false)
  useEffect(() => {
    unmounting.current = false
    return () => {
      unmounting.current = true
    }
  }, [])

  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    return () => document.removeEventListener('contextmenu', block)
  }, [])

  return (
    <Canvas
      className="absolute inset-0"
      style={{ touchAction: 'none' }}
      dpr={dpr}
      shadows={shadows ? { type: THREE.PCFSoftShadowMap } : false}
      camera={{ fov: 72, near: 0.15, far: 5000, position: [0, 20, 60] }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          if (unmounting.current) return
          setError('The graphics context was lost. Try reloading, or switch to Low graphics in Settings.')
        })
      }}
    >
      <Suspense fallback={null}>
        <Flight />
      </Suspense>
    </Canvas>
  )
}
