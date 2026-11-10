import { mulberry32, smoothstep } from '../noise'
import type { Collider, Course, EnvId, Gate, Vec3, WorldData } from '../types'
import { ISLANDS, groundAt, heightAt, valleyX } from './heightfield'

type P2 = [number, number]

const yawFromTo = (a: Vec3, b: Vec3) => Math.atan2(-(b[0] - a[0]), -(b[2] - a[2]))

/** Walk a polyline and drop a point every `spacing` metres. */
function resample(pts: P2[], spacing: number, loop: boolean): P2[] {
  const out: P2[] = []
  const path = loop ? [...pts, pts[0]] : pts
  let carry = 0
  out.push(path[0])
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    let d = spacing - carry
    while (d < len - 1e-6) {
      const t = d / len
      out.push([ax + (bx - ax) * t, az + (bz - az) * t])
      d += spacing
    }
    carry = len - (d - spacing)
  }
  if (!loop) {
    const last = path[path.length - 1]
    const prev = out[out.length - 1]
    if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > spacing * 0.5) out.push(last)
  }
  return out
}

function buildCourse(
  id: string,
  title: string,
  pts: Vec3[],
  opts: { loop: boolean; laps: number; timeLimit: number; radius: number; kind?: Gate['kind']; pad?: boolean },
): Course {
  const gates: Gate[] = pts.map((p, i) => {
    const next = opts.loop ? pts[(i + 1) % pts.length] : pts[Math.min(i + 1, pts.length - 1)]
    const prev = pts[Math.max(i - 1, 0)]
    const yaw = i === pts.length - 1 && !opts.loop ? yawFromTo(prev, p) : yawFromTo(p, next)
    return { id: i, pos: p, yaw, radius: opts.radius, kind: opts.kind ?? 'checkpoint' }
  })
  if (opts.pad && gates.length) gates[gates.length - 1].kind = 'pad'
  return { id, title, gates, laps: opts.laps, timeLimit: opts.timeLimit }
}

/** Lift 2D waypoints to 3D using terrain height plus a wavy offset. */
function lift(env: EnvId, pts: P2[], base: number, amp: number, phase = 0): Vec3[] {
  return pts.map(([x, z], i) => {
    const g = groundAt(env, x, z)
    return [x, g + base + amp * Math.sin(i * 0.9 + phase), z] as Vec3
  })
}

/** Tall pillars at the midpoint of each gate pair, used by Challenge mode. */
function makeObstacles(env: EnvId, gates: Gate[], skipLast: boolean): number[] {
  const out: number[] = []
  const n = gates.length - (skipLast ? 1 : 0)
  for (let i = 0; i < n - 1; i++) {
    if (i % 2 === 1) continue
    const a = gates[i].pos
    const b = gates[i + 1].pos
    const x = (a[0] + b[0]) / 2
    const z = (a[2] + b[2]) / 2
    const y = (a[1] + b[1]) / 2
    const g = groundAt(env, x, z)
    out.push(x, z, 2.6, g - 1, y + 2.5 + (i % 4))
  }
  return out
}

// ---------------------------------------------------------------------------
// Tropical island
// ---------------------------------------------------------------------------
function genTropical(seed: number): WorldData {
  const rand = mulberry32(seed)
  const colliders: Collider[] = []
  const palms: number[] = [] // x, y, z, scale, rot
  const rocks: number[] = []

  for (let i = 0; i < ISLANDS.length; i++) {
    const [cx, cz, r] = ISLANDS[i]
    const target = i === 0 ? 150 : 38
    let placed = 0
    for (let tries = 0; tries < target * 14 && placed < target; tries++) {
      const a = rand() * Math.PI * 2
      const d = Math.sqrt(rand()) * r * 1.05
      const x = cx + Math.cos(a) * d
      const z = cz + Math.sin(a) * d
      const h = heightAt('tropical', x, z)
      if (h < 1.6 || h > 15) continue
      const s = 0.8 + rand() * 0.7
      palms.push(x, h, z, s, rand() * Math.PI * 2)
      if (colliders.length < 220) colliders.push({ kind: 'cyl', x, z, r: 0.55 * s, y0: h - 1, y1: h + 9.5 * s })
      placed++
    }
    for (let k = 0; k < 12; k++) {
      const a = rand() * Math.PI * 2
      const d = r * (0.6 + rand() * 0.5)
      const x = cx + Math.cos(a) * d
      const z = cz + Math.sin(a) * d
      const h = heightAt('tropical', x, z)
      if (h > -1 && h < 20) rocks.push(x, h, z, 1.5 + rand() * 3.5, rand() * 6)
    }
  }

  // main island circuit
  const circuit: P2[] = []
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const rr = 150 + Math.sin(i * 1.7) * 28
    circuit.push([Math.cos(a) * rr, Math.sin(a) * rr])
  }
  const raceGates = lift('tropical', resample(circuit, 82, true), 12, 5)
  const trialPts: P2[] = [
    [0, 120], [-80, 40], [-60, -110], [110, -170], [300, -260], [350, -120], [260, 60], [250, 300],
    [120, 190], [-60, 150], [-250, 200], [-330, 190], [-300, 40], [-240, -140], [-80, -120],
  ]
  const trialGates = lift('tropical', resample(trialPts, 100, false), 11, 4, 1)
  const chPts: P2[] = [[0, 130], [110, 70], [170, -30], [90, -120], [-40, -150], [-150, -60], [-170, 60], [-90, 120], [0, 60], [20, 10]]
  const chGates = lift('tropical', resample(chPts, 70, false), 11, 4, 2)
  const padXZ: P2 = [chPts[chPts.length - 1][0], chPts[chPts.length - 1][1]]
  chGates[chGates.length - 1] = [padXZ[0], groundAt('tropical', padXZ[0], padXZ[1]) + 0.6, padXZ[1]]

  const chCourse = buildCourse('challenge', 'Island Rescue', chGates, { loop: false, laps: 1, timeLimit: 190, radius: 7.5, kind: 'ring', pad: true })
  chCourse.gates[chCourse.gates.length - 1].radius = 6

  // keep gate openings clear of palm trunks
  const allGates = [...raceGates, ...trialGates, ...chGates]
  const nearGate = (x: number, z: number) => allGates.some((g) => Math.hypot(g[0] - x, g[2] - z) < 13)
  const cleanPalms: number[] = []
  for (let i = 0; i + 4 < palms.length; i += 5) if (!nearGate(palms[i], palms[i + 2])) cleanPalms.push(palms[i], palms[i + 1], palms[i + 2], palms[i + 3], palms[i + 4])
  palms.length = 0
  palms.push(...cleanPalms)
  for (let i = colliders.length - 1; i >= 0; i--) {
    const c = colliders[i]
    if (c.kind === 'cyl' && nearGate(c.x, c.z)) colliders.splice(i, 1)
  }

  const spawnXZ: P2 = [0, 150]
  const spawnY = groundAt('tropical', spawnXZ[0], spawnXZ[1]) + 3
  return {
    env: 'tropical',
    seed,
    spawn: { pos: [spawnXZ[0], spawnY, spawnXZ[1]], yaw: yawFromTo([spawnXZ[0], 0, spawnXZ[1]], raceGates[0]) },
    colliders,
    extent: 720,
    races: buildCourse('race', 'Coral Circuit', raceGates, { loop: true, laps: 2, timeLimit: 0, radius: 9 }),
    trial: buildCourse('trial', 'Archipelago Dash', trialGates, { loop: false, laps: 1, timeLimit: 0, radius: 9 }),
    challenge: chCourse,
    decor: { palms, rocks, obstacles: makeObstacles('tropical', chCourse.gates, true) },
  }
}

// ---------------------------------------------------------------------------
// Mountain adventure
// ---------------------------------------------------------------------------
function genMountain(seed: number): WorldData {
  const rand = mulberry32(seed)
  const colliders: Collider[] = []
  const trees: number[] = [] // x, y, z, scale

  for (let tries = 0; tries < 9000 && trees.length < 4 * 1400; tries++) {
    const z = 200 - rand() * 2200
    const x = valleyX(z) + (rand() - 0.5) * 520
    const h = heightAt('mountain', x, z)
    if (h > 95) continue
    const dv = Math.abs(x - valleyX(z))
    if (dv < 14) continue // keep the centre line clear for the course
    const s = 0.8 + rand() * 1.1
    trees.push(x, h, z, s)
    if (dv < 110 && colliders.length < 260) colliders.push({ kind: 'cyl', x, z, r: 0.9 * s, y0: h - 1, y1: h + 11 * s })
  }

  const zs = (from: number, to: number, step: number) => {
    const out: P2[] = []
    for (let z = from; z >= to; z -= step) out.push([valleyX(z), z])
    return out
  }
  const outPts = zs(-70, -1050, 96)
  const backPts = [...outPts].reverse().map(([x, z]) => [x + 16 * Math.sin(z * 0.01), z] as P2)
  const raceGates = lift('mountain', [...outPts, ...backPts], 14, 7)
  const trialGates = lift('mountain', zs(-60, -980, 82), 16, 12, 1)
  const chGates = lift('mountain', zs(-80, -760, 76), 15, 8, 2)
  const last = chGates.length - 1
  chGates[last] = [chGates[last][0], groundAt('mountain', chGates[last][0], chGates[last][2]) + 0.6, chGates[last][2]]
  const chCourse = buildCourse('challenge', 'Gap Run', chGates, { loop: false, laps: 1, timeLimit: 200, radius: 8, kind: 'ring', pad: true })
  chCourse.gates[last].radius = 6

  // keep gate openings clear of trees
  const allGates = [...raceGates, ...trialGates, ...chGates]
  const nearGate = (x: number, z: number) => allGates.some((g) => Math.hypot(g[0] - x, g[2] - z) < 15)
  const cleanTrees: number[] = []
  for (let i = 0; i + 3 < trees.length; i += 4) if (!nearGate(trees[i], trees[i + 2])) cleanTrees.push(trees[i], trees[i + 1], trees[i + 2], trees[i + 3])
  trees.length = 0
  trees.push(...cleanTrees)
  for (let i = colliders.length - 1; i >= 0; i--) {
    const c = colliders[i]
    if (c.kind === 'cyl' && nearGate(c.x, c.z)) colliders.splice(i, 1)
  }

  const sz = 60
  const sy = groundAt('mountain', valleyX(sz), sz) + 3
  return {
    env: 'mountain',
    seed,
    spawn: { pos: [valleyX(sz), sy, sz], yaw: 0 },
    colliders,
    extent: 900,
    races: buildCourse('race', 'Valley Dash', raceGates, { loop: false, laps: 1, timeLimit: 0, radius: 10 }),
    trial: buildCourse('trial', 'Ridge Runner', trialGates, { loop: false, laps: 1, timeLimit: 0, radius: 10 }),
    challenge: chCourse,
    decor: { trees, obstacles: makeObstacles('mountain', chCourse.gates, true) },
  }
}

// ---------------------------------------------------------------------------
// Neon city
// ---------------------------------------------------------------------------
export const CITY_PITCH = 80
export const CITY_RANGE = 8

function genCyber(seed: number): WorldData {
  const rand = mulberry32(seed)
  const colliders: Collider[] = []
  const buildings: number[] = [] // x, z, w, d, h, hue

  for (let i = -CITY_RANGE; i <= CITY_RANGE; i++) {
    for (let j = -CITY_RANGE; j <= CITY_RANGE; j++) {
      const cx = i * CITY_PITCH + CITY_PITCH / 2
      const cz = j * CITY_PITCH + CITY_PITCH / 2
      const dist = Math.hypot(i, j)
      if (rand() < 0.05 && dist > 1.5) continue // plazas
      const hw = 14 + rand() * 13
      const hd = 14 + rand() * 13
      const central = 1 - smoothstep(1, CITY_RANGE + 2, dist)
      const h = 26 + rand() * 60 + central * rand() * 190 + (rand() < 0.08 ? 70 : 0)
      buildings.push(cx, cz, hw, hd, h, rand())
      colliders.push({ kind: 'box', c: [cx, h / 2, cz], h: [hw, h / 2, hd] })
    }
  }

  const lifted = (pts: P2[], base: number, amp: number, phase = 0): Vec3[] =>
    pts.map(([x, z], i) => [x, base + amp * Math.sin(i * 0.8 + phase), z] as Vec3)

  const loopPts: P2[] = [
    [0, 0], [0, -240], [160, -240], [160, -80], [320, -80], [320, 160], [80, 160], [80, 80], [-160, 80], [-160, 0],
  ]
  const trialPts: P2[] = [
    [0, 0], [0, -160], [-160, -160], [-160, 0], [-320, 0], [-320, 160], [-160, 160], [-160, 320], [0, 320], [0, 160],
  ]
  const chPts: P2[] = [[0, 0], [160, 0], [160, 160], [320, 160], [320, 320], [160, 320], [160, 240]]

  const raceGates = lifted(resample(loopPts, 72, true), 16, 7)
  const trialGates = lifted(resample(trialPts, 76, false), 15, 9, 1)
  const chGates = lifted(resample(chPts, 62, false), 15, 7, 2)
  const last = chGates.length - 1
  chGates[last] = [chGates[last][0], 0.6, chGates[last][2]]
  const chCourse = buildCourse('challenge', 'Data Courier', chGates, { loop: false, laps: 1, timeLimit: 150, radius: 8, kind: 'ring', pad: true })
  chCourse.gates[last].radius = 6

  return {
    env: 'cyber',
    seed,
    spawn: { pos: [0, 4, 44], yaw: 0 },
    colliders,
    extent: (CITY_RANGE + 1) * CITY_PITCH,
    races: buildCourse('race', 'Neon Loop', raceGates, { loop: true, laps: 2, timeLimit: 0, radius: 9 }),
    trial: buildCourse('trial', 'Midnight Sprint', trialGates, { loop: false, laps: 1, timeLimit: 0, radius: 9 }),
    challenge: chCourse,
    decor: { buildings, obstacles: makeObstacles('cyber', chCourse.gates, true) },
  }
}

const cache = new Map<EnvId, WorldData>()

export function getWorld(env: EnvId): WorldData {
  let w = cache.get(env)
  if (!w) {
    w = env === 'tropical' ? genTropical(11) : env === 'mountain' ? genMountain(5) : genCyber(23)
    cache.set(env, w)
  }
  return w
}
