import type { EnvId } from '../types'
import { fbm, ridged, smoothstep } from '../noise'

/** Island centres for the tropical world: x, z, radius, peak height */
export const ISLANDS: [number, number, number, number][] = [
  [0, 0, 190, 34],
  [-330, 190, 120, 22],
  [300, -260, 140, 26],
  [260, 300, 90, 16],
  [-300, -300, 100, 20],
]

export const TROPICAL_SEA = 0
export const MOUNTAIN_SEED = 7

/** Centre line of the main valley in the mountain world (x as function of z). */
export function valleyX(z: number) {
  return Math.sin(z * 0.0045) * 110 + Math.sin(z * 0.013 + 1.3) * 30
}

function tropicalHeight(x: number, z: number) {
  let h = TROPICAL_SEA - 2
  for (let i = 0; i < ISLANDS.length; i++) {
    const [cx, cz, r, peak] = ISLANDS[i]
    const wob = (fbm(x * 0.012 + i * 9, z * 0.012 - i * 4, 3, 3) - 0.5) * 0.7
    const d = Math.hypot(x - cx, z - cz) / r + wob * 0.55
    if (d < 1) {
      const t = 1 - d
      const dome = Math.pow(smoothstep(0, 1, t), 1.4)
      const detail = fbm(x * 0.03, z * 0.03, 4, 11) * 0.28 + 0.86
      const lump = peak * dome * detail
      const beach = smoothstep(0, 0.12, t) * 3.2 - 2.0
      h = Math.max(h, lump + beach * (1 - smoothstep(0.12, 0.3, t)))
    }
  }
  // distant mountain ring far out beyond the playable islands
  const r = Math.hypot(x, z)
  const ring = smoothstep(560, 900, r)
  if (ring > 0) {
    const m = ridged(x * 0.004, z * 0.004, 4, 21) * 260 + 40
    h = Math.max(h, m * ring - 20)
  }
  return h
}

function mountainHeight(x: number, z: number) {
  const base = fbm(x * 0.0035, z * 0.0035, 3, MOUNTAIN_SEED) * 60
  const peaks = ridged(x * 0.0042 + 4, z * 0.0042 - 3, 5, MOUNTAIN_SEED + 5) * 330
  const d = Math.abs(x - valleyX(z))
  const wall = smoothstep(55, 230, d)
  // pinch the valley at regular z bands so it narrows into mountain gaps
  const pinch = smoothstep(0.7, 1, Math.sin(z * 0.0062 + 0.4) * 0.5 + 0.5)
  const pinchedWall = wall + (1 - wall) * pinch * smoothstep(20, 75, d) * 0.9
  return 6 + base * 0.6 + peaks * pinchedWall
}

export function heightAt(env: EnvId, x: number, z: number): number {
  switch (env) {
    case 'tropical':
      return tropicalHeight(x, z)
    case 'mountain':
      return mountainHeight(x, z)
    default:
      return 0
  }
}

/** Surface height the drone treats as floor (sea counts as ground for tropical). */
export function groundAt(env: EnvId, x: number, z: number): number {
  const h = heightAt(env, x, z)
  return env === 'tropical' ? Math.max(h, TROPICAL_SEA) : h
}
