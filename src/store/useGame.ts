import { create } from 'zustand'
import { DEFAULT_SETTINGS, DRONES, STORAGE_KEYS } from '../game/config'
import type { CameraMode, EnvId, ModeId, Result, Screen, Settings } from '../game/types'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? ({ ...(typeof fallback === 'object' ? fallback : {}), ...JSON.parse(raw) } as T) : fallback
  } catch {
    return fallback
  }
}
function loadRaw<T extends string>(key: string, fallback: T, allowed: readonly string[]): T {
  try {
    const v = localStorage.getItem(key)
    return v && allowed.includes(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

interface GameStore {
  screen: Screen
  prevScreen: Screen
  env: EnvId
  mode: ModeId
  droneId: string
  camera: CameraMode
  settings: Settings
  best: Record<string, number>
  result: Result | null
  /** bump to restart the flight session */
  session: number
  resetTick: number
  error: string | null

  go: (s: Screen) => void
  setEnv: (e: EnvId) => void
  setMode: (m: ModeId) => void
  setDrone: (id: string) => void
  toggleCamera: () => void
  patchSettings: (p: Partial<Settings>) => void
  start: () => void
  pause: () => void
  resume: () => void
  restart: () => void
  reset: () => void
  finish: (r: Result) => void
  recordBest: (key: string, time: number) => boolean
  setError: (e: string | null) => void
}

export const useGame = create<GameStore>((set, get) => ({
  screen: 'loading',
  prevScreen: 'menu',
  env: loadRaw<EnvId>(STORAGE_KEYS.env, 'tropical', ['tropical', 'mountain', 'cyber']),
  mode: loadRaw<ModeId>(STORAGE_KEYS.mode, 'free', ['free', 'race', 'trial', 'challenge']),
  droneId: loadRaw(STORAGE_KEYS.drone, DRONES[0].id, DRONES.map((d) => d.id)),
  camera: 'chase',
  settings: load<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  best: load<Record<string, number>>(STORAGE_KEYS.best, {}),
  result: null,
  session: 0,
  resetTick: 0,
  error: null,

  go: (s) => set((st) => ({ screen: s, prevScreen: st.screen })),
  setEnv: (env) => {
    save(STORAGE_KEYS.env, env)
    set({ env })
  },
  setMode: (mode) => {
    save(STORAGE_KEYS.mode, mode)
    set({ mode })
  },
  setDrone: (droneId) => {
    save(STORAGE_KEYS.drone, droneId)
    set({ droneId })
  },
  toggleCamera: () => set((s) => ({ camera: s.camera === 'chase' ? 'fpv' : 'chase' })),
  patchSettings: (p) => {
    const settings = { ...get().settings, ...p }
    save(STORAGE_KEYS.settings, settings)
    set({ settings })
  },
  start: () => set((s) => ({ screen: 'playing', prevScreen: s.screen, session: s.session + 1, result: null, camera: 'chase' })),
  pause: () => {
    if (get().screen === 'playing') set({ screen: 'paused', prevScreen: 'playing' })
  },
  resume: () => {
    if (get().screen === 'paused') set({ screen: 'playing', prevScreen: 'paused' })
  },
  restart: () => set((s) => ({ screen: 'playing', prevScreen: s.screen, session: s.session + 1, result: null })),
  reset: () => set((s) => ({ resetTick: s.resetTick + 1 })),
  finish: (result) => set((s) => ({ screen: 'result', prevScreen: s.screen, result })),
  recordBest: (key, time) => {
    const prev = get().best[key]
    if (prev !== undefined && prev <= time) return false
    const best = { ...get().best, [key]: time }
    save(STORAGE_KEYS.best, best)
    set({ best })
    return true
  },
  setError: (error) => set({ error }),
}))
