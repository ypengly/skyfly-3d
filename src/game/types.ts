export type EnvId = 'tropical' | 'mountain' | 'cyber'
export type ModeId = 'free' | 'race' | 'trial' | 'challenge'
export type CameraMode = 'chase' | 'fpv'
export type Screen = 'loading' | 'menu' | 'env' | 'modes' | 'drones' | 'settings' | 'howto' | 'playing' | 'paused' | 'result'
export type Quality = 'low' | 'medium' | 'high'

export type Vec3 = [number, number, number]

/** Axis-aligned box collider (centre + half extents). */
export interface BoxCollider {
  kind: 'box'
  c: Vec3
  h: Vec3
}

/** Vertical cylinder collider (x,z centre, radius, y range). */
export interface CylCollider {
  kind: 'cyl'
  x: number
  z: number
  r: number
  y0: number
  y1: number
}

export type Collider = BoxCollider | CylCollider

export interface Gate {
  id: number
  pos: Vec3
  /** yaw (radians) of the gate normal - the direction you should fly through. */
  yaw: number
  radius: number
  kind: 'ring' | 'checkpoint' | 'pad'
}

export interface Course {
  id: string
  title: string
  gates: Gate[]
  laps: number
  /** seconds, 0 = unlimited */
  timeLimit: number
}

export interface WorldData {
  env: EnvId
  seed: number
  spawn: { pos: Vec3; yaw: number }
  colliders: Collider[]
  /** world half size used for the minimap and soft boundary hints */
  extent: number
  races: Course
  trial: Course
  challenge: Course
  /** Decorative / render data produced by the generator */
  decor: Record<string, number[]>
}

export interface DroneSpec {
  id: string
  name: string
  tagline: string
  color: string
  accent: string
  maxSpeed: number // m/s
  boostMul: number
  accel: number
  agility: number
  battery: number // minutes at cruise
  stats: { speed: number; agility: number; battery: number }
}

export interface DroneState {
  pos: Vec3
  vel: Vec3
  yaw: number
  pitch: number
  roll: number
  yawRate: number
  throttle: number // 0..1 motor effort for audio and props
  battery: number // 0..100
  distance: number // metres
  boosting: boolean
  braking: boolean
  hits: number
  grounded: boolean
}

export interface ControlInput {
  forward: number // -1..1
  strafe: number
  vertical: number
  yaw: number
  boost: boolean
  brake: boolean
}

export interface Settings {
  sensitivity: number // 0.5..1.5
  quality: Quality
  masterVolume: number
  sfx: boolean
  fps: boolean
  shake: boolean
  motionBlur: boolean
  invertVertical: boolean
  touchScale: number // 0.7..1.3
  lefty: boolean
  cameraFov: number
}

export interface Result {
  title: string
  success: boolean
  time: number
  distance: number
  hits: number
  best?: number
  newBest?: boolean
  note?: string
}
