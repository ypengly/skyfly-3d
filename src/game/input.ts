import type { ControlInput } from './types'

/** Shared, mutable input state. Keyboard writes `keys`, touch UI writes `touch`. */
const keys = new Set<string>()

export const touch = {
  left: { x: 0, y: 0 }, // x strafe, y forward (up = +1)
  right: { x: 0, y: 0 }, // x yaw, y vertical (up = +1)
  boost: false,
  brake: false,
}

export interface InputActions {
  onCamera: () => void
  onReset: () => void
  onPause: () => void
}

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space', 'KeyC', 'KeyR', 'Escape',
])

export function attachKeyboard(actions: InputActions) {
  const down = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return
    e.preventDefault()
    if (e.repeat) return
    keys.add(e.code)
    if (e.code === 'KeyC') actions.onCamera()
    else if (e.code === 'KeyR') actions.onReset()
    else if (e.code === 'Escape') actions.onPause()
  }
  const up = (e: KeyboardEvent) => {
    keys.delete(e.code)
  }
  const blur = () => {
    keys.clear()
    touch.boost = false
    touch.brake = false
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    keys.clear()
  }
}

export function resetInput() {
  keys.clear()
  touch.left.x = touch.left.y = touch.right.x = touch.right.y = 0
  touch.boost = false
  touch.brake = false
}

const axis = (pos: string[], neg: string[]) => {
  let v = 0
  for (const k of pos) if (keys.has(k)) v += 1
  for (const k of neg) if (keys.has(k)) v -= 1
  return Math.max(-1, Math.min(1, v))
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))

const out: ControlInput = { forward: 0, strafe: 0, vertical: 0, yaw: 0, boost: false, brake: false }

/** Merge keyboard and touch into one control vector (reused object, do not store). */
export function readInput(): ControlInput {
  out.forward = clamp1(axis(['KeyW'], ['KeyS']) + touch.left.y)
  out.strafe = clamp1(axis(['KeyD'], ['KeyA']) + touch.left.x)
  out.vertical = clamp1(axis(['ArrowUp'], ['ArrowDown']) + touch.right.y)
  out.yaw = clamp1(axis(['KeyE', 'ArrowRight'], ['KeyQ', 'ArrowLeft']) + touch.right.x)
  out.boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.boost
  out.brake = keys.has('Space') || touch.brake
  return out
}

export const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
