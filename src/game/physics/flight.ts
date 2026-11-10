import { DRONE_RADIUS } from '../config'
import { clamp } from '../noise'
import { groundAt } from '../world/heightfield'
import { sphereVsCollider } from './collision'
import type { ControlInput, DroneSpec, DroneState, EnvId, Settings, Vec3, WorldData } from '../types'

export const NO_INPUT: ControlInput = { forward: 0, strafe: 0, vertical: 0, yaw: 0, boost: false, brake: false }

export function createDroneState(pos: Vec3, yaw: number): DroneState {
  return {
    pos: [pos[0], pos[1], pos[2]],
    vel: [0, 0, 0],
    yaw,
    pitch: 0,
    roll: 0,
    yawRate: 0,
    throttle: 0.3,
    battery: 100,
    distance: 0,
    boosting: false,
    braking: false,
    hits: 0,
    grounded: false,
  }
}

export interface StepEvents {
  hit: boolean
  hardLanding: boolean
  speed: number
}

const CLIMB = 9
const MAX_ALT = 450

/** Move a vector toward a target by at most maxDelta (keeps direction so inertia feels natural). */
function approach3(v: Vec3, t: Vec3, maxDelta: number) {
  const dx = t[0] - v[0]
  const dy = t[1] - v[1]
  const dz = t[2] - v[2]
  const len = Math.hypot(dx, dy, dz)
  if (len <= maxDelta || len < 1e-6) {
    v[0] = t[0]
    v[1] = t[1]
    v[2] = t[2]
    return
  }
  const k = maxDelta / len
  v[0] += dx * k
  v[1] += dy * k
  v[2] += dz * k
}

/**
 * One fixed physics step. Mutates `s` in place.
 * Yaw 0 faces -Z (three.js convention). Positive yaw rotates counter-clockwise seen from above.
 */
export function stepDrone(
  s: DroneState,
  input: ControlInput,
  spec: DroneSpec,
  settings: Settings,
  world: WorldData,
  dt: number,
  options: { drainBattery: boolean; rechargeOnGround: boolean; locked: boolean },
): StepEvents {
  const events: StepEvents = { hit: false, hardLanding: false, speed: 0 }
  const inp = options.locked ? NO_INPUT : input
  const sens = settings.sensitivity
  const dead = s.battery <= 0

  // ---- yaw --------------------------------------------------------------
  const yawTarget = dead ? 0 : -inp.yaw * 1.9 * sens * spec.agility
  s.yawRate += (yawTarget - s.yawRate) * (1 - Math.exp(-7 * dt))
  s.yaw += s.yawRate * dt

  const sinY = Math.sin(s.yaw)
  const cosY = Math.cos(s.yaw)
  const fwd: Vec3 = [-sinY, 0, -cosY]
  const right: Vec3 = [cosY, 0, -sinY]

  // ---- desired velocity ---------------------------------------------------
  const boost = inp.boost && !dead && s.battery > 2
  const speedCap = spec.maxSpeed * (boost ? spec.boostMul : 1) * (0.55 + 0.45 * sens)
  let mx = fwd[0] * inp.forward + right[0] * inp.strafe
  let mz = fwd[2] * inp.forward + right[2] * inp.strafe
  const mlen = Math.hypot(mx, mz)
  if (mlen > 1) {
    mx /= mlen
    mz /= mlen
  }
  const vInput = settings.invertVertical ? -inp.vertical : inp.vertical
  const target: Vec3 = [mx * speedCap, vInput * CLIMB * (boost ? 1.25 : 1), mz * speedCap]
  if (dead) {
    target[0] = 0
    target[1] = -4
    target[2] = 0
  }

  const braking = inp.brake && !dead
  s.braking = braking
  s.boosting = boost && (Math.abs(inp.forward) + Math.abs(inp.strafe) > 0.05 || Math.abs(inp.vertical) > 0.05)
  const hasInput = Math.abs(inp.forward) + Math.abs(inp.strafe) + Math.abs(inp.vertical) > 0.02
  let accel = spec.accel * (boost ? 1.4 : 1)
  if (braking) {
    target[0] = target[1] = target[2] = 0
    accel = 38
  } else if (!hasInput) {
    accel = spec.accel * 0.45 // drift: momentum bleeds off slowly
  }
  approach3(s.vel, target, accel * dt)

  // ---- attitude from motion --------------------------------------------------
  const vf = s.vel[0] * fwd[0] + s.vel[2] * fwd[2]
  const vr = s.vel[0] * right[0] + s.vel[2] * right[2]
  const norm = Math.max(spec.maxSpeed, 1)
  const targetPitch = clamp(-(vf / norm) * 0.5 - inp.forward * 0.18, -0.75, 0.75)
  const targetRoll = clamp(-(vr / norm) * 0.55 - inp.strafe * 0.18 + s.yawRate * 0.12, -0.75, 0.75)
  const att = 1 - Math.exp(-6 * dt)
  s.pitch += (targetPitch - s.pitch) * att
  s.roll += (targetRoll - s.roll) * att

  // ---- integrate -----------------------------------------------------------
  const px = s.pos[0]
  const py = s.pos[1]
  const pz = s.pos[2]
  s.pos[0] += s.vel[0] * dt
  s.pos[1] += s.vel[1] * dt
  s.pos[2] += s.vel[2] * dt
  if (s.pos[1] > MAX_ALT) {
    s.pos[1] = MAX_ALT
    s.vel[1] = Math.min(0, s.vel[1])
  }

  events.speed = Math.hypot(s.vel[0], s.vel[1], s.vel[2])

  // ---- terrain ---------------------------------------------------------------
  s.grounded = false
  const env: EnvId = world.env
  const ground = groundAt(env, s.pos[0], s.pos[2]) + DRONE_RADIUS * 0.8
  if (s.pos[1] < ground) {
    const impact = -s.vel[1]
    if (impact > 7.5) {
      events.hardLanding = true
      registerHit(s, events, 0.35)
    }
    s.pos[1] = ground
    if (s.vel[1] < 0) s.vel[1] = 0
    s.grounded = true
    s.vel[0] *= 1 - Math.min(1, 4 * dt)
    s.vel[2] *= 1 - Math.min(1, 4 * dt)
  }
  // steep terrain: block horizontal motion into rising slopes
  if (!s.grounded && env === 'mountain') {
    const ahead = groundAt(env, s.pos[0] + s.vel[0] * 0.12, s.pos[2] + s.vel[2] * 0.12)
    if (ahead + DRONE_RADIUS > s.pos[1] + 0.2 && events.speed > 4) {
      s.pos[0] = px
      s.pos[2] = pz
      s.vel[0] *= -0.25
      s.vel[2] *= -0.25
      if (s.vel[1] < 0) s.vel[1] = 0
      registerHit(s, events, 0.5)
    }
  }

  // ---- obstacle colliders ------------------------------------------------------
  const cols = world.colliders
  for (let i = 0; i < cols.length; i++) {
    const hit = sphereVsCollider(s.pos, DRONE_RADIUS, cols[i])
    if (!hit) continue
    s.pos[0] += hit.nx * hit.depth
    s.pos[1] += hit.ny * hit.depth
    s.pos[2] += hit.nz * hit.depth
    const vn = s.vel[0] * hit.nx + s.vel[1] * hit.ny + s.vel[2] * hit.nz
    if (vn < 0) {
      const bounce = 1.35
      s.vel[0] -= hit.nx * vn * bounce
      s.vel[1] -= hit.ny * vn * bounce
      s.vel[2] -= hit.nz * vn * bounce
      if (-vn > 2.5) registerHit(s, events, 0.5)
    }
  }

  // ---- bookkeeping -------------------------------------------------------------
  const moved = Math.hypot(s.pos[0] - px, s.pos[1] - py, s.pos[2] - pz)
  s.distance += moved

  const load = clamp(events.speed / (spec.maxSpeed * 1.2), 0, 1)
  const wantThrottle = 0.28 + load * 0.4 + Math.abs(vInput) * 0.2 + (s.boosting ? 0.2 : 0) + (s.grounded ? -0.18 : 0)
  s.throttle += (clamp(wantThrottle, 0.1, 1) - s.throttle) * (1 - Math.exp(-5 * dt))

  if (options.drainBattery) {
    const base = 100 / (spec.battery * 60)
    s.battery = Math.max(0, s.battery - base * dt * (0.7 + load * 0.8 + (s.boosting ? 1.2 : 0)))
  }
  if (options.rechargeOnGround && s.grounded && events.speed < 1) {
    s.battery = Math.min(100, s.battery + 6 * dt)
  }
  return events
}

const HIT_COOLDOWN = 0.6
const lastHit = new WeakMap<DroneState, number>()

function registerHit(s: DroneState, events: StepEvents, _weight: number) {
  const now = performance.now() / 1000
  const prev = lastHit.get(s) ?? -10
  if (now - prev < HIT_COOLDOWN) return
  lastHit.set(s, now)
  s.hits += 1
  events.hit = true
}
