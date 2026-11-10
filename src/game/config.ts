import type { DroneSpec, EnvId, ModeId, Settings } from './types'

export const DRONES: DroneSpec[] = [
  {
    id: 'falcon',
    name: 'Falcon X1',
    tagline: 'Balanced all-rounder',
    color: '#2a3550',
    accent: '#00e5ff',
    maxSpeed: 24,
    boostMul: 1.7,
    accel: 14,
    agility: 1,
    battery: 14,
    stats: { speed: 60, agility: 60, battery: 60 },
  },
  {
    id: 'viper',
    name: 'Viper R5',
    tagline: 'Race-tuned and twitchy',
    color: '#3a1f3f',
    accent: '#ff3df2',
    maxSpeed: 32,
    boostMul: 1.8,
    accel: 22,
    agility: 1.35,
    battery: 9,
    stats: { speed: 90, agility: 90, battery: 35 },
  },
  {
    id: 'atlas',
    name: 'Atlas Pro',
    tagline: 'Long-range survey rig',
    color: '#1f3a33',
    accent: '#7dff6b',
    maxSpeed: 20,
    boostMul: 1.5,
    accel: 10,
    agility: 0.8,
    battery: 26,
    stats: { speed: 45, agility: 40, battery: 95 },
  },
]

export const ENVS: { id: EnvId; name: string; blurb: string; sky: [string, string]; accent: string }[] = [
  {
    id: 'tropical',
    name: 'Tropical Island',
    blurb: 'Turquoise ocean, palm-lined beaches and drifting clouds under a warm sun.',
    sky: ['#3aa7ff', '#ffd9a0'],
    accent: '#ffd166',
  },
  {
    id: 'mountain',
    name: 'Mountain Adventure',
    blurb: 'Towering peaks, misty valleys, pine forests and narrow gaps to thread.',
    sky: ['#6d8fb5', '#dfe7ee'],
    accent: '#9be8a6',
  },
  {
    id: 'cyber',
    name: 'Neon Cyber City',
    blurb: 'Rain-slick megablocks, glowing signage and checkpoints blazing in the night.',
    sky: ['#0a0020', '#32005a'],
    accent: '#ff3df2',
  },
]

export const MODES: { id: ModeId; name: string; blurb: string; icon: string }[] = [
  { id: 'free', name: 'Free Flight', blurb: 'No limits, no clock. Just fly and explore.', icon: '◎' },
  { id: 'race', name: 'Drone Racing', blurb: 'Blast through glowing checkpoints in order. Multiple laps.', icon: '⚑' },
  { id: 'trial', name: 'Time Trial', blurb: 'One tight course. Chase your personal best.', icon: '⏱' },
  { id: 'challenge', name: 'Challenge', blurb: 'Rings, obstacles and a landing pad. Battery and crashes count.', icon: '✦' },
]

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  quality: 'medium',
  masterVolume: 0.6,
  sfx: true,
  fps: false,
  shake: true,
  motionBlur: true,
  invertVertical: false,
  touchScale: 1,
  lefty: false,
  cameraFov: 72,
}

export const STORAGE_KEYS = {
  settings: 'skyfly3d.settings.v1',
  drone: 'skyfly3d.drone.v1',
  env: 'skyfly3d.env.v1',
  mode: 'skyfly3d.mode.v1',
  best: 'skyfly3d.best.v1',
}

export const DRONE_RADIUS = 0.55
export const GATE_TRIGGER_DEPTH = 1.6
export const KMH = 3.6
