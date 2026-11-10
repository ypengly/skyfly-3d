import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, DRONES, ENVS, MODES } from '../../game/config'
import { audio } from '../../game/audio'
import { isTouchDevice } from '../../game/input'
import { useGame } from '../../store/useGame'
import { DroneShowcase } from '../scene/DroneShowcase'
import { Btn, ScreenShell, StatBar, Slider, Toggle, fmtTime } from './common'

const envGradient = (id: string) =>
  id === 'tropical'
    ? 'linear-gradient(160deg,#2aa7ff 0%,#46d6c8 55%,#ffd98a 100%)'
    : id === 'mountain'
      ? 'linear-gradient(160deg,#5d7f9f 0%,#9fb4c4 50%,#27472f 100%)'
      : 'linear-gradient(160deg,#12012b 0%,#5a0a8a 45%,#ff3df2 100%)'

export function MainMenu() {
  const { go, start, env, mode, droneId } = useGame()
  const e = ENVS.find((x) => x.id === env)
  const m = MODES.find((x) => x.id === mode)
  const d = DRONES.find((x) => x.id === droneId)
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto px-4 py-6">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(0,229,255,0.16), transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(255,61,242,0.14), transparent 55%)' }} />
      <div className="animate-float text-center">
        <p className="font-display text-[10px] tracking-[0.6em] text-neon/80 sm:text-xs">ULTIMATE DRONE SIMULATOR</p>
        <h1 className="font-display text-5xl font-black leading-none tracking-[0.12em] text-white drop-shadow-[0_0_30px_rgba(0,229,255,0.6)] sm:text-8xl">
          SKY<span className="text-neon">FLY</span>
          <span className="ml-2 align-top text-2xl text-neon-pink sm:text-4xl">3D</span>
        </h1>
      </div>

      <div className="glass mt-6 w-full max-w-sm animate-fadeIn rounded-2xl p-3 sm:mt-10">
        <div className="mb-3 flex flex-wrap gap-2 px-1">
          <span className="chip">{e?.name}</span>
          <span className="chip">{m?.name}</span>
          <span className="chip">{d?.name}</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <Btn primary className="!py-4 !text-base" onClick={start}>
            ▶ Play
          </Btn>
          <Btn onClick={() => go('env')}>Select Environment</Btn>
          <Btn onClick={() => go('modes')}>Game Modes</Btn>
          <Btn onClick={() => go('drones')}>Choose Drone</Btn>
          <div className="grid grid-cols-2 gap-2.5">
            <Btn onClick={() => go('settings')}>Settings</Btn>
            <Btn onClick={() => go('howto')}>How to Play</Btn>
          </div>
        </div>
      </div>
      <p className="mt-5 text-xs tracking-widest text-cyan-100/40">{isTouchDevice() ? 'TOUCH CONTROLS READY · BEST IN LANDSCAPE' : 'KEYBOARD CONTROLS READY'}</p>
    </div>
  )
}

export function EnvScreen() {
  const { env, setEnv, go } = useGame()
  return (
    <ScreenShell title="SELECT ENVIRONMENT" subtitle="Each world has its own courses and atmosphere." onBack={() => go('menu')} wide>
      <div className="grid gap-4 md:grid-cols-3">
        {ENVS.map((e) => (
          <button
            key={e.id}
            onClick={() => {
              audio.click()
              setEnv(e.id)
            }}
            className={`glass group overflow-hidden rounded-2xl text-left transition hover:-translate-y-1 ${env === e.id ? '!border-cyan-300 shadow-[0_0_34px_rgba(0,229,255,0.35)]' : ''}`}
          >
            <div className="h-36 w-full sm:h-48" style={{ background: envGradient(e.id) }}>
              <div className="h-full w-full bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,0.45),transparent_35%)]" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold tracking-widest">{e.name}</h3>
                {env === e.id && <span className="chip">Selected</span>}
              </div>
              <p className="mt-2 text-base text-cyan-50/70">{e.blurb}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Btn primary onClick={() => go('menu')}>
          Confirm
        </Btn>
      </div>
    </ScreenShell>
  )
}

export function ModeScreen() {
  const { mode, setMode, go, start, best, env, droneId } = useGame()
  const bestFor = (id: string, course: string) => best[`${env}:${id}:${course}:${droneId}`]
  const courses: Record<string, string> = { race: 'race', trial: 'trial', challenge: 'challenge' }
  return (
    <ScreenShell title="GAME MODES" subtitle="Pick how you want to fly." onBack={() => go('menu')}>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.map((m) => {
          const b = courses[m.id] ? bestFor(m.id, courses[m.id]) : undefined
          return (
            <button
              key={m.id}
              onClick={() => {
                audio.click()
                setMode(m.id)
              }}
              className={`glass flex items-start gap-4 rounded-2xl p-5 text-left transition hover:-translate-y-0.5 ${mode === m.id ? '!border-cyan-300 shadow-[0_0_30px_rgba(0,229,255,0.3)]' : ''}`}
            >
              <span className="font-display text-3xl text-neon">{m.icon}</span>
              <span>
                <span className="font-display block text-base font-bold tracking-widest">{m.name}</span>
                <span className="mt-1 block text-base text-cyan-50/70">{m.blurb}</span>
                {b !== undefined && <span className="mt-2 block text-sm text-neon-lime">BEST {fmtTime(b)}</span>}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Btn onClick={() => go('env')}>Environment</Btn>
        <Btn primary onClick={start}>
          ▶ Start
        </Btn>
      </div>
    </ScreenShell>
  )
}

export function DroneScreen() {
  const { droneId, setDrone, go } = useGame()
  const [idx, setIdx] = useState(Math.max(0, DRONES.findIndex((d) => d.id === droneId)))
  const d = DRONES[idx]
  return (
    <ScreenShell title="CHOOSE YOUR DRONE" onBack={() => go('menu')} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="glass relative h-64 overflow-hidden rounded-2xl sm:h-96" style={{ boxShadow: `0 0 50px ${d.accent}33` }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 60%, ${d.accent}26, transparent 65%)` }} />
          <DroneShowcase key={d.id} color={d.color} accent={d.accent} />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {DRONES.map((x, i) => (
              <button key={x.id} aria-label={x.name} onClick={() => setIdx(i)} className={`h-2.5 rounded-full transition-all ${i === idx ? 'w-8' : 'w-2.5 opacity-50'}`} style={{ background: x.accent }} />
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="font-display text-2xl font-black tracking-widest" style={{ color: d.accent }}>
            {d.name}
          </h3>
          <p className="mb-5 text-base text-cyan-50/70">{d.tagline}</p>
          <div className="space-y-3">
            <StatBar label="Speed" value={d.stats.speed} color={d.accent} />
            <StatBar label="Agility" value={d.stats.agility} color={d.accent} />
            <StatBar label="Battery" value={d.stats.battery} color={d.accent} />
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              ['Top speed', `${Math.round(d.maxSpeed * 3.6)} km/h`],
              ['Boost', `x${d.boostMul}`],
              ['Flight time', `${d.battery} min`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/5 p-2">
                <dt className="text-[10px] uppercase tracking-widest text-cyan-100/50">{k}</dt>
                <dd className="font-display text-sm">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex gap-3">
            <Btn
              primary
              className="flex-1"
              onClick={() => {
                setDrone(d.id)
                go('menu')
              }}
            >
              {droneId === d.id ? 'Selected' : 'Select'}
            </Btn>
          </div>
        </div>
      </div>
    </ScreenShell>
  )
}

export function SettingsPanel({ onBack }: { onBack: () => void }) {
  const { settings, patchSettings } = useGame()
  useEffect(() => {
    audio.configure(settings.masterVolume, settings.sfx)
  }, [settings.masterVolume, settings.sfx])
  return (
    <ScreenShell title="SETTINGS" subtitle="Saved automatically on this device." onBack={onBack}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display mb-2 text-xs tracking-[0.3em] text-neon">FLIGHT</h3>
          <Slider label="Flight sensitivity" min={0.5} max={1.5} value={settings.sensitivity} onChange={(v) => patchSettings({ sensitivity: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Field of view" min={55} max={100} step={1} value={settings.cameraFov} onChange={(v) => patchSettings({ cameraFov: v })} format={(v) => `${Math.round(v)}°`} />
          <Toggle label="Invert vertical" on={settings.invertVertical} onChange={(v) => patchSettings({ invertVertical: v })} />
          <Toggle label="Camera shake at speed" on={settings.shake} onChange={(v) => patchSettings({ shake: v })} />
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display mb-2 text-xs tracking-[0.3em] text-neon">GRAPHICS</h3>
          <div className="mb-2 grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                onClick={() => {
                  audio.click()
                  patchSettings({ quality: q })
                }}
                className={`font-display rounded-lg border py-2 text-xs uppercase tracking-widest transition ${settings.quality === q ? 'border-cyan-300 bg-cyan-400/20 text-white' : 'border-white/15 text-cyan-100/60'}`}
              >
                {q === 'low' ? 'Low (perf)' : q}
              </button>
            ))}
          </div>
          <Toggle label="Speed effects (aberration, high only)" on={settings.motionBlur} onChange={(v) => patchSettings({ motionBlur: v })} />
          <Toggle label="Show FPS counter" on={settings.fps} onChange={(v) => patchSettings({ fps: v })} />
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display mb-2 text-xs tracking-[0.3em] text-neon">AUDIO</h3>
          <Toggle label="Sound enabled" on={settings.sfx} onChange={(v) => patchSettings({ sfx: v })} />
          <Slider label="Master volume" min={0} max={1} value={settings.masterVolume} onChange={(v) => patchSettings({ masterVolume: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display mb-2 text-xs tracking-[0.3em] text-neon">TOUCH CONTROLS</h3>
          <Slider label="Control size" min={0.7} max={1.3} value={settings.touchScale} onChange={(v) => patchSettings({ touchScale: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Toggle label="Swap sticks (left-handed)" on={settings.lefty} onChange={(v) => patchSettings({ lefty: v })} />
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Btn
          onClick={() => {
            patchSettings({ ...DEFAULT_SETTINGS })
          }}
        >
          Reset to defaults
        </Btn>
      </div>
    </ScreenShell>
  )
}

export const KEY_GUIDE: [string, string][] = [
  ['W / S', 'Forward / Back'],
  ['A / D', 'Left / Right'],
  ['↑ / ↓', 'Ascend / Descend'],
  ['Q / E', 'Rotate left / right'],
  ['Shift', 'Boost'],
  ['Space', 'Brake / Hover'],
  ['C', 'Switch camera'],
  ['R', 'Reset drone'],
  ['Esc', 'Pause'],
]

export function HowTo() {
  const go = useGame((s) => s.go)
  return (
    <ScreenShell title="HOW TO PLAY" onBack={() => go('menu')}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display mb-3 text-xs tracking-[0.3em] text-neon">KEYBOARD</h3>
          <div className="space-y-1.5">
            {KEY_GUIDE.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-white/5 py-1">
                <kbd className="font-display rounded-md border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-xs">{k}</kbd>
                <span className="text-cyan-50/80">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display mb-3 text-xs tracking-[0.3em] text-neon">TOUCH</h3>
          <ul className="list-disc space-y-2 pl-5 text-base text-cyan-50/80">
            <li>Left stick: move forward, back, left and right.</li>
            <li>Right stick: climb or descend, and rotate (yaw).</li>
            <li>Buttons: Boost, Brake, Camera, Reset and Pause.</li>
            <li>Both sticks work at the same time (multi-touch).</li>
            <li>Landscape orientation gives the best view.</li>
          </ul>
          <h3 className="font-display mb-3 mt-5 text-xs tracking-[0.3em] text-neon">OBJECTIVES</h3>
          <ul className="list-disc space-y-2 pl-5 text-base text-cyan-50/80">
            <li>Race and Time Trial: fly through each glowing gate in order. Fly through the ring, not around it.</li>
            <li>Challenge: clear the rings, dodge pillars, then land softly on the green pad before time or battery runs out.</li>
            <li>Hard hits and hard landings count as collisions. Boost drains the battery faster.</li>
          </ul>
        </div>
      </div>
    </ScreenShell>
  )
}
