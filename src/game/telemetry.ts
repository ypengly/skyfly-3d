/**
 * High-frequency flight data written by the game loop and read by HUD widgets.
 * Kept outside React state so we never re-render at 60 fps.
 */
export const telemetry = {
  pos: [0, 0, 0] as [number, number, number],
  yaw: 0,
  speedKmh: 0,
  altitude: 0,
  battery: 100,
  distance: 0,
  time: 0,
  fps: 60,
  boosting: false,
  braking: false,
  grounded: false,
  hits: 0,
  flightMode: 'HOVER',
  countdown: 0, // seconds remaining of start countdown (0 = go)
  gateIndex: 0,
  gateTotal: 0,
  lap: 1,
  laps: 1,
  objective: '',
  /** positions of upcoming gates (world x,z) for the minimap */
  nextGates: [] as [number, number][],
  /** index of the active gate in nextGates (always 0), plus the final course polyline */
  coursePath: [] as [number, number][],
  worldExtent: 500,
  toast: '' as string,
  toastId: 0,
}

export function pushToast(msg: string) {
  telemetry.toast = msg
  telemetry.toastId++
}
