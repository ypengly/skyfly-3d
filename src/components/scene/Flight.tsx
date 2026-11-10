import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { DRONES, ENVS } from '../../game/config'
import { attachKeyboard, readInput, resetInput } from '../../game/input'
import { audio } from '../../game/audio'
import { GameSim } from '../../game/sim'
import { telemetry } from '../../game/telemetry'
import { groundAt } from '../../game/world/heightfield'
import { getWorld } from '../../game/world/generate'
import { useGame } from '../../store/useGame'
import { DroneModel, type DroneModelHandle } from './DroneModel'
import { Gates, Obstacles } from './Gates'
import { Tropical } from './Tropical'
import { Mountain } from './Mountain'
import { Cyber } from './Cyber'

const SHAKE_START = 0.55

function CameraRig({ sim }: { sim: GameSim }) {
  const { camera } = useThree()
  const cam = camera as THREE.PerspectiveCamera
  const smooth = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const init = useRef(false)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const fov = useRef(72)
  const yawSmooth = useRef(0)

  useFrame(({ clock }, dt) => {
    const st = useGame.getState()
    const d = sim.drone
    const settings = st.settings
    const speedN = Math.min(1, Math.hypot(d.vel[0], d.vel[1], d.vel[2]) / (sim.spec.maxSpeed * sim.spec.boostMul))

    if (!init.current) {
      yawSmooth.current = d.yaw
      init.current = true
    }
    // yaw follows with lag for a smooth chase
    let dy = d.yaw - yawSmooth.current
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    yawSmooth.current += dy * (1 - Math.exp(-(st.camera === 'chase' ? 5 : 40) * dt))

    const targetFov = settings.cameraFov + speedN * (d.boosting ? 22 : 10) + (st.camera === 'fpv' ? 8 : 0)
    fov.current += (targetFov - fov.current) * (1 - Math.exp(-4 * dt))
    if (Math.abs(cam.fov - fov.current) > 0.05) {
      cam.fov = fov.current
      cam.updateProjectionMatrix()
    }

    if (st.camera === 'chase') {
      const sy = Math.sin(yawSmooth.current)
      const cy = Math.cos(yawSmooth.current)
      const back = 6.5 + speedN * 2.2
      tmp.set(d.pos[0] + sy * back, d.pos[1] + 2.4 + speedN * 0.6, d.pos[2] + cy * back)
      const gh = groundAt(sim.world.env, tmp.x, tmp.z) + 1.2
      if (tmp.y < gh) tmp.y = gh
      if (!smooth.current.lengthSq()) smooth.current.copy(tmp)
      smooth.current.lerp(tmp, 1 - Math.exp(-9 * dt))
      cam.position.copy(smooth.current)
      look.current.set(d.pos[0] - sy * 6, d.pos[1] + 0.6 - d.pitch * 3, d.pos[2] - cy * 6)
      cam.up.set(0, 1, 0)
      cam.lookAt(look.current)
      cam.rotateZ(-d.roll * 0.25)
    } else {
      smooth.current.set(d.pos[0], d.pos[1], d.pos[2])
      const sy = Math.sin(d.yaw)
      const cy = Math.cos(d.yaw)
      cam.position.set(d.pos[0] - sy * 0.45, d.pos[1] + 0.02, d.pos[2] - cy * 0.45)
      // FPV cameras are tilted up so forward flight looks level
      euler.set(d.pitch * 0.9 + 0.32, d.yaw, d.roll * 0.9)
      cam.quaternion.setFromEuler(euler)
    }

    if (settings.shake) {
      const k = Math.max(0, speedN - SHAKE_START) / (1 - SHAKE_START)
      const amp = k * k * 0.07 + (d.boosting ? 0.015 : 0)
      if (amp > 0.0005) {
        const t = clock.elapsedTime
        cam.position.x += (Math.sin(t * 61) + Math.sin(t * 37.3)) * amp
        cam.position.y += (Math.sin(t * 53.7) + Math.cos(t * 41)) * amp
      }
    }
  })
  return null
}

/** Effect stack: bloom plus a speed-driven chromatic aberration as a cheap motion-blur stand-in. */
function Effects({ strength, aberration }: { strength: number; aberration: boolean }) {
  const ca = useRef<{ offset: THREE.Vector2 } | null>(null)
  useFrame(() => {
    if (!ca.current) return
    const k = Math.min(1, telemetry.speedKmh / 110)
    const o = 0.0003 + k * k * 0.0024 * (telemetry.boosting ? 1.4 : 1)
    ca.current.offset.set(o, o)
  })
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={strength} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
      {aberration ? (
        <ChromaticAberration
          ref={ca as never}
          offset={new THREE.Vector2(0.0004, 0.0004)}
          radialModulation={false}
          modulationOffset={0}
          blendFunction={BlendFunction.NORMAL}
        />
      ) : (
        <></>
      )}
    </EffectComposer>
  )
}

export function Flight() {
  const session = useGame((s) => s.session)
  const envId = useGame((s) => s.env)
  const mode = useGame((s) => s.mode)
  const droneId = useGame((s) => s.droneId)
  const quality = useGame((s) => s.settings.quality)
  const motionBlur = useGame((s) => s.settings.motionBlur)
  const cameraMode = useGame((s) => s.camera)

  const spec = DRONES.find((d) => d.id === droneId) ?? DRONES[0]
  const world = useMemo(() => getWorld(envId), [envId])
  const accent = ENVS.find((e) => e.id === envId)?.accent ?? '#00e5ff'

  // a fresh sim for every session (start / restart)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sim = useMemo(
    () =>
      new GameSim(world, spec, mode, {
        bestKey: (course) => `${envId}:${mode}:${course.id}:${spec.id}`,
        onFinish: (r, key) => {
          const st = useGame.getState()
          if (r.success) {
            r.best = st.best[key]
            r.newBest = st.recordBest(key, r.time)
            if (r.newBest) r.best = r.time
          }
          st.finish(r)
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, world, spec.id, mode],
  )

  const drone = useRef<DroneModelHandle>(null)
  const fpsAcc = useRef({ t: 0, n: 0 })
  const lastHits = useRef(0)

  // keyboard + audio lifecycle
  useEffect(() => {
    resetInput()
    audio.init()
    audio.startFlight(envId)
    const detach = attachKeyboard({
      onCamera: () => {
        audio.click()
        useGame.getState().toggleCamera()
      },
      onReset: () => {
        if (useGame.getState().screen === 'playing') useGame.getState().reset()
      },
      onPause: () => {
        const st = useGame.getState()
        if (st.screen === 'playing') st.pause()
        else if (st.screen === 'paused') st.resume()
      },
    })
    return () => {
      detach()
      audio.stopFlight()
    }
  }, [envId, session])

  // pausing suspends audio; leaving the page auto-pauses
  const screen = useGame((s) => s.screen)
  useEffect(() => {
    audio.setPaused(screen !== 'playing')
  }, [screen])
  useEffect(() => {
    const vis = () => {
      if (document.hidden) useGame.getState().pause()
    }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [])

  const resetTick = useGame((s) => s.resetTick)
  useEffect(() => {
    if (resetTick > 0) sim.resetDrone()
  }, [resetTick, sim])

  useEffect(() => {
    lastHits.current = 0
  }, [sim])

  useFrame((_, dt) => {
    const st = useGame.getState()
    if (st.screen === 'playing') {
      sim.update(dt, readInput(), st.settings)
      audio.update(sim.drone.throttle, telemetry.speedKmh / 3.6, spec.maxSpeed)
    }
    const d = sim.drone
    const g = drone.current?.group
    if (g) {
      g.position.set(d.pos[0], d.pos[1], d.pos[2])
      g.rotation.set(d.pitch, d.yaw, d.roll, 'YXZ')
      g.visible = st.camera === 'chase'
      drone.current?.setThrottle(st.screen === 'playing' ? d.throttle : 0.15)
    }
    const f = fpsAcc.current
    f.t += dt
    f.n++
    if (f.t >= 0.5) {
      telemetry.fps = Math.round(f.n / f.t)
      f.t = 0
      f.n = 0
    }
  })

  return (
    <>
      {envId === 'tropical' && <Tropical world={world} quality={quality} />}
      {envId === 'mountain' && <Mountain world={world} quality={quality} />}
      {envId === 'cyber' && <Cyber world={world} quality={quality} />}

      <DroneModel ref={drone} color={spec.color} accent={spec.accent} hideBody={cameraMode === 'fpv'} />
      <Gates sim={sim} color={envId === 'cyber' ? '#ff3df2' : accent === '#9be8a6' ? '#9be8a6' : '#00e5ff'} />
      {mode === 'challenge' && <Obstacles data={world.decor.obstacles ?? []} color={accent} />}
      <CameraRig sim={sim} />
      {quality !== 'low' && <Effects strength={envId === 'cyber' ? 1.1 : 0.45} aberration={quality === 'high' && motionBlur} />}
    </>
  )
}
