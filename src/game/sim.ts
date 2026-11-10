import { GATE_TRIGGER_DEPTH, KMH } from './config'
import { audio } from './audio'
import { createDroneState, stepDrone } from './physics/flight'
import { telemetry, pushToast } from './telemetry'
import { groundAt } from './world/heightfield'
import type { Collider, ControlInput, Course, DroneSpec, DroneState, ModeId, Result, Settings, WorldData } from './types'

export const FIXED_DT = 1 / 60
const COUNTDOWN = 3.2

export interface SimEvents {
  onFinish: (r: Result, bestKey: string) => void
  bestKey: (course: Course) => string
}

/** Owns drone state plus mode rules (gates, laps, timer, battery, missions). Runs outside React. */
export class GameSim {
  drone: DroneState
  world: WorldData
  spec: DroneSpec
  mode: ModeId
  course: Course | null = null
  colliders: Collider[]
  time = 0
  gateIndex = 0
  lap = 1
  countdown = COUNTDOWN
  finished = false
  private lastBeep = 99
  private lowBatteryAt = 0
  private prevPos: [number, number, number]
  private acc = 0
  private gateFlash = 0

  constructor(world: WorldData, spec: DroneSpec, mode: ModeId, private events: SimEvents) {
    this.world = world
    this.spec = spec
    this.mode = mode
    this.colliders = world.colliders
    this.drone = createDroneState(world.spawn.pos, world.spawn.yaw)
    this.prevPos = [...this.drone.pos]

    if (mode === 'race') this.course = world.races
    else if (mode === 'trial') this.course = world.trial
    else if (mode === 'challenge') {
      this.course = world.challenge
      const o = world.decor.obstacles ?? []
      const extra: Collider[] = []
      for (let i = 0; i + 4 < o.length; i += 5) extra.push({ kind: 'cyl', x: o[i], z: o[i + 1], r: o[i + 2], y0: o[i + 3], y1: o[i + 4] })
      this.colliders = [...world.colliders, ...extra]
    }
    if (mode === 'free') this.countdown = 0
    this.countdown = mode === 'free' ? 0 : COUNTDOWN
    telemetry.worldExtent = world.extent
    telemetry.coursePath = this.course ? this.course.gates.map((g) => [g.pos[0], g.pos[2]] as [number, number]) : []
    this.syncTelemetry()
  }

  /** Index of the gate to show as active, plus the one after it. */
  get activeGate() {
    if (!this.course) return null
    return this.course.gates[this.gateIndex % this.course.gates.length]
  }

  resetDrone() {
    const keepBattery = this.drone.battery
    const hits = this.drone.hits
    const dist = this.drone.distance
    this.drone = createDroneState(this.world.spawn.pos, this.world.spawn.yaw)
    this.drone.battery = keepBattery
    this.drone.hits = hits
    this.drone.distance = dist
    this.prevPos = [...this.drone.pos]
  }

  /** Advance with a variable frame delta; internally uses fixed steps for stable physics. */
  update(frameDt: number, input: ControlInput, settings: Settings) {
    this.acc += Math.min(frameDt, 0.1)
    while (this.acc >= FIXED_DT) {
      this.acc -= FIXED_DT
      this.step(FIXED_DT, input, settings)
    }
    this.syncTelemetry()
  }

  private step(dt: number, input: ControlInput, settings: Settings) {
    if (this.finished) return
    const locked = this.countdown > 0
    if (locked) {
      const before = Math.ceil(this.countdown)
      this.countdown -= dt
      const after = Math.ceil(Math.max(this.countdown, 0))
      if (after !== before) {
        if (after > 0) audio.beep(false)
        else {
          audio.beep(true)
          pushToast('GO!')
        }
      }
    } else {
      this.time += dt
    }

    this.prevPos = [this.drone.pos[0], this.drone.pos[1], this.drone.pos[2]]
    const ev = stepDrone(this.drone, input, this.spec, settings, this.world, dt, {
      drainBattery: !locked,
      rechargeOnGround: this.mode === 'free',
      locked,
    })
    if (ev.hit) {
      audio.crash()
      pushToast(ev.hardLanding ? 'HARD LANDING' : 'COLLISION')
    }

    // low battery warning
    if (this.drone.battery < 15 && this.drone.battery > 0) {
      this.lowBatteryAt += dt
      if (this.lowBatteryAt > 1.4) {
        this.lowBatteryAt = 0
        audio.lowBattery()
      }
    }

    if (locked || !this.course) {
      if (!locked && this.mode === 'free' && this.drone.battery <= 0 && this.drone.grounded) this.drone.battery = 100
      return
    }

    this.checkGate()
    this.checkEnd()
  }

  private checkGate() {
    const course = this.course as Course
    const g = course.gates[this.gateIndex % course.gates.length]
    const p = this.drone.pos
    const n: [number, number] = [-Math.sin(g.yaw), -Math.cos(g.yaw)]

    if (g.kind === 'pad') {
      const d = Math.hypot(p[0] - g.pos[0], p[2] - g.pos[2])
      const altAbove = p[1] - groundAt(this.world.env, p[0], p[2])
      const speed = Math.hypot(this.drone.vel[0], this.drone.vel[1], this.drone.vel[2])
      if (d < g.radius && altAbove < 2.4 && speed < 3.5) this.passGate()
      return
    }

    // signed distance along gate normal before/after the step
    const sd0 = (this.prevPos[0] - g.pos[0]) * n[0] + (this.prevPos[2] - g.pos[2]) * n[1]
    const sd1 = (p[0] - g.pos[0]) * n[0] + (p[2] - g.pos[2]) * n[1]
    const crossed = (sd0 < 0 && sd1 >= 0) || Math.abs(sd1) < 0.4
    if (crossed || Math.hypot(p[0] - g.pos[0], p[2] - g.pos[2]) < GATE_TRIGGER_DEPTH) {
      // lateral + vertical offset at crossing point
      const t = sd0 === sd1 ? 1 : Math.min(1, Math.max(0, -sd0 / (sd1 - sd0)))
      const cx = this.prevPos[0] + (p[0] - this.prevPos[0]) * t
      const cy = this.prevPos[1] + (p[1] - this.prevPos[1]) * t
      const cz = this.prevPos[2] + (p[2] - this.prevPos[2]) * t
      const dist = Math.hypot(cx - g.pos[0], cy - g.pos[1], cz - g.pos[2])
      if (crossed && dist < g.radius + 0.6) this.passGate()
    }
  }

  private passGate() {
    const course = this.course as Course
    audio.checkpoint(this.gateIndex)
    this.gateIndex++
    this.gateFlash = 1
    const total = course.gates.length
    if (this.mode === 'challenge' || this.mode === 'trial') {
      // battery top-up so missions stay winnable
      this.drone.battery = Math.min(100, this.drone.battery + 3)
    }
    if (this.gateIndex >= total) {
      if (this.lap < course.laps) {
        this.lap++
        this.gateIndex = 0
        pushToast(`LAP ${this.lap}/${course.laps}`)
      } else {
        this.complete(true)
        return
      }
    } else {
      pushToast(`CHECKPOINT ${this.gateIndex}/${total}`)
    }
  }

  private checkEnd() {
    if (this.finished || !this.course) return
    if (this.course.timeLimit > 0 && this.time >= this.course.timeLimit) {
      this.complete(false, 'Time ran out before the mission was complete.')
    } else if (this.drone.battery <= 0 && this.drone.grounded) {
      this.complete(false, 'Battery depleted - the drone went down.')
    } else if (this.mode === 'challenge' && this.drone.hits >= 8) {
      this.complete(false, 'Too much damage - the drone was written off.')
    }
  }

  private complete(success: boolean, note?: string) {
    if (this.finished) return
    this.finished = true
    const course = this.course as Course
    const key = this.events.bestKey(course)
    const r: Result = {
      title: success ? 'MISSION COMPLETE' : 'MISSION FAILED',
      success,
      time: this.time,
      distance: this.drone.distance,
      hits: this.drone.hits,
      note,
    }
    if (success) {
      audio.win()
      r.note = this.mode === 'challenge' ? `Cleared with ${this.drone.hits} collision${this.drone.hits === 1 ? '' : 's'}.` : 'Course cleared.'
    } else audio.lose()
    this.events.onFinish(r, key)
  }

  private syncTelemetry() {
    const d = this.drone
    const t = telemetry
    t.pos = d.pos
    t.yaw = d.yaw
    t.speedKmh = Math.hypot(d.vel[0], d.vel[1], d.vel[2]) * KMH
    t.altitude = Math.max(0, d.pos[1] - groundAt(this.world.env, d.pos[0], d.pos[2]))
    t.battery = d.battery
    t.distance = d.distance
    t.time = this.time
    t.boosting = d.boosting
    t.braking = d.braking
    t.grounded = d.grounded
    t.hits = d.hits
    t.countdown = Math.max(0, this.countdown)
    t.flightMode = d.grounded ? 'LANDED' : d.braking ? 'BRAKE' : d.boosting ? 'BOOST' : t.speedKmh < 2 ? 'HOVER' : 'CRUISE'
    t.gateIndex = this.gateIndex
    t.gateTotal = this.course?.gates.length ?? 0
    t.lap = this.lap
    t.laps = this.course?.laps ?? 1
    const c = this.course
    if (c) {
      const out: [number, number][] = []
      for (let i = 0; i < Math.min(3, c.gates.length); i++) {
        const gi = this.gateIndex + i
        if (gi >= c.gates.length && c.laps === this.lap) break
        const g = c.gates[gi % c.gates.length]
        out.push([g.pos[0], g.pos[2]])
      }
      t.nextGates = out
      if (this.mode === 'challenge') {
        t.objective = this.activeGate?.kind === 'pad' ? 'LAND ON THE PAD' : `RINGS ${this.gateIndex}/${c.gates.length - 1}`
      } else t.objective = `GATE ${Math.min(this.gateIndex + 1, c.gates.length)}/${c.gates.length}`
    } else {
      t.nextGates = []
      t.objective = 'FREE FLIGHT'
    }
  }

  gateFlashValue() {
    const v = this.gateFlash
    this.gateFlash = Math.max(0, this.gateFlash - 0.05)
    return v
  }
}
