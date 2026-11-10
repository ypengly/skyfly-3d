import type { Collider, Vec3 } from '../types'

export interface Hit {
  nx: number
  ny: number
  nz: number
  depth: number
}

/** Sphere (drone) versus a single collider. Returns push-out normal and depth, or null. */
export function sphereVsCollider(p: Vec3, r: number, c: Collider): Hit | null {
  if (c.kind === 'box') {
    const dx = p[0] - c.c[0]
    const dy = p[1] - c.c[1]
    const dz = p[2] - c.c[2]
    const qx = Math.max(-c.h[0], Math.min(c.h[0], dx))
    const qy = Math.max(-c.h[1], Math.min(c.h[1], dy))
    const qz = Math.max(-c.h[2], Math.min(c.h[2], dz))
    let ox = dx - qx
    let oy = dy - qy
    let oz = dz - qz
    const d2 = ox * ox + oy * oy + oz * oz
    if (d2 > r * r) return null
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2)
      return { nx: ox / d, ny: oy / d, nz: oz / d, depth: r - d }
    }
    // centre is inside the box: push out through the nearest face
    const px = c.h[0] - Math.abs(dx)
    const py = c.h[1] - Math.abs(dy)
    const pz = c.h[2] - Math.abs(dz)
    if (px <= py && px <= pz) return { nx: Math.sign(dx) || 1, ny: 0, nz: 0, depth: px + r }
    if (py <= pz) return { nx: 0, ny: Math.sign(dy) || 1, nz: 0, depth: py + r }
    return { nx: 0, ny: 0, nz: Math.sign(dz) || 1, depth: pz + r }
  }
  // vertical cylinder
  if (p[1] < c.y0 - r || p[1] > c.y1 + r) return null
  const dx = p[0] - c.x
  const dz = p[2] - c.z
  const d = Math.hypot(dx, dz)
  const reach = c.r + r
  if (d > reach) return null
  if (p[1] > c.y1) {
    // resting on the top cap
    const top = p[1] - c.y1
    if (top < r && d < c.r) return { nx: 0, ny: 1, nz: 0, depth: r - top }
  }
  if (d < 1e-6) return { nx: 1, ny: 0, nz: 0, depth: reach }
  return { nx: dx / d, ny: 0, nz: dz / d, depth: reach - d }
}
