# SKYFLY 3D - Ultimate Drone Flying Simulator

A browser-based 3D drone simulator built with React, TypeScript, Vite, Three.js (React Three Fiber), drei, Tailwind CSS and Zustand. Everything (terrain, buildings, palms, drone, sound) is generated procedurally, so there are no asset files to download.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # development server (also reachable from your phone on the same network)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

Open the URL Vite prints. For phone testing, open the "Network" address on the same Wi-Fi.

## Controls

| Keyboard | Action |
| --- | --- |
| W / S | Forward / backward |
| A / D | Strafe left / right |
| Arrow Up / Down | Ascend / descend |
| Q / E (or Left / Right arrows) | Yaw left / right |
| Shift | Boost |
| Space | Emergency brake / hover |
| C | Switch chase / FPV camera |
| R | Reset drone to the start |
| Esc | Pause / resume |

Touch: left stick moves (forward/back, left/right), right stick climbs/descends and yaws. Boost and Brake are hold buttons, Cam / Pause / Reset sit at the bottom centre. Both sticks and buttons work at the same time. Settings has control size and a left-handed swap.

## Modes

- Free Flight: no clock, no limits. Battery recharges when landed.
- Drone Racing: pass every gate in order; multiple laps on the island and city.
- Time Trial: one course, personal best saved per world and drone.
- Challenge: rings, tall pillars and a landing pad. Limited time, battery and damage (8 hits ends the run). Land gently and slowly on the green pad to finish.

## Project structure

```
src/
  main.tsx, App.tsx          app shell, screen routing, error handling
  store/useGame.ts           Zustand store (screens, settings, best times) + localStorage
  game/
    config.ts, types.ts      drones, environments, modes, shared types
    noise.ts                 seeded RNG, value / fractal noise
    input.ts                 keyboard + touch input merge
    audio.ts                 Web Audio: motor, wind, ambience, SFX (no audio files)
    telemetry.ts             mutable HUD data (no per-frame React renders)
    sim.ts                   mode rules: countdown, gates, laps, timers, win / fail
    physics/flight.ts        drone flight model (inertia, attitude, battery, terrain)
    physics/collision.ts     sphere vs box / cylinder colliders
    world/heightfield.ts     terrain height functions shared by physics and rendering
    world/generate.ts        procedural worlds, colliders, race / trial / challenge courses
  components/
    scene/                   Canvas, Flight loop, camera rig, drone model, gates,
                             Tropical / Mountain / Cyber environments, terrain
    ui/                      menus, HUD + minimap, touch joysticks, pause / result / loading
```

## Notes

- Quality: Settings has Low (performance), Medium and High. Low lowers resolution, removes shadows and post-processing and thins out vegetation.
- Speed feel: FOV kick, camera shake, speed-line vignette and (High) chromatic aberration. A true per-pixel motion blur is not included.
- All settings, selected drone / world / mode and best times persist in localStorage.
- The page auto-pauses when the tab loses focus.
- `postprocessing` is pinned to `~6.36.7` because newer versions require a newer three.js than 0.166.
