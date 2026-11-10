import { useEffect, useState } from 'react'
import { ENVS, MODES } from '../../game/config'
import { getWorld } from '../../game/world/generate'
import { useGame } from '../../store/useGame'
import { Btn, fmtTime } from './common'
import { KEY_GUIDE } from './Menus'
import { isTouchDevice } from '../../game/input'

export function PauseMenu({ onSettings }: { onSettings: () => void }) {
  const { resume, restart, go, env, mode } = useGame()
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-md">
      <div className="glass w-full max-w-md animate-fadeIn rounded-2xl p-6">
        <h2 className="font-display text-center text-2xl font-black tracking-[0.3em]">PAUSED</h2>
        <p className="mb-5 mt-1 text-center text-xs tracking-widest text-cyan-100/50">
          {ENVS.find((e) => e.id === env)?.name} · {MODES.find((m) => m.id === mode)?.name}
        </p>
        <div className="flex flex-col gap-2.5">
          <Btn primary onClick={resume}>
            Resume
          </Btn>
          <Btn onClick={restart}>Restart</Btn>
          <Btn onClick={onSettings}>Settings</Btn>
          <Btn sound="back" onClick={() => go('menu')}>
            Quit to menu
          </Btn>
        </div>
        {!isTouchDevice() && (
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/10 pt-4 text-sm">
            {KEY_GUIDE.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <kbd className="font-display min-w-[3.2rem] rounded border border-cyan-300/40 bg-cyan-400/10 px-1.5 py-0.5 text-center text-[10px]">{k}</kbd>
                <span className="text-cyan-50/70">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function ResultScreen() {
  const { result, restart, go, mode } = useGame()
  if (!result) return null
  const ok = result.success
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md">
      <div className={`glass w-full max-w-md animate-fadeIn rounded-2xl p-6 text-center ${ok ? 'shadow-[0_0_60px_rgba(0,229,255,0.3)]' : 'shadow-[0_0_60px_rgba(255,60,80,0.25)]'}`}>
        <h2 className={`font-display text-3xl font-black tracking-[0.2em] ${ok ? 'text-neon' : 'text-red-400'}`}>{result.title}</h2>
        {result.note && <p className="mt-2 text-base text-cyan-50/70">{result.note}</p>}
        {result.newBest && <p className="font-display mt-3 animate-pulseGlow text-xs tracking-[0.4em] text-neon-lime">★ NEW PERSONAL BEST ★</p>}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ['TIME', fmtTime(result.time)],
            ['DISTANCE', `${Math.round(result.distance)} m`],
            ['HITS', String(result.hits)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-cyan-100/50">{k}</div>
              <div className="font-display mt-1 text-lg font-bold">{v}</div>
            </div>
          ))}
        </div>
        {ok && result.best !== undefined && mode !== 'free' && <p className="mt-3 text-sm text-cyan-50/60">Best: {fmtTime(result.best)}</p>}
        <div className="mt-6 flex flex-col gap-2.5">
          <Btn primary onClick={restart}>
            {ok ? 'Fly again' : 'Try again'}
          </Btn>
          <Btn onClick={() => go('modes')}>Change mode</Btn>
          <Btn sound="back" onClick={() => go('menu')}>
            Main menu
          </Btn>
        </div>
      </div>
    </div>
  )
}

/** Generates the three worlds one by one so the progress bar reflects real work. */
export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0)
  const [msg, setMsg] = useState('Initialising flight systems')
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const steps: [string, () => void][] = [
      ['Checking graphics support', () => {
        const c = document.createElement('canvas')
        const gl = c.getContext('webgl2') || c.getContext('webgl')
        if (!gl) throw new Error('WebGL is not available in this browser. Try a recent Chrome, Edge, Firefox or Safari.')
      }],
      ['Sculpting tropical islands', () => void getWorld('tropical')],
      ['Raising mountain ranges', () => void getWorld('mountain')],
      ['Powering up neon city', () => void getWorld('cyber')],
      ['Calibrating gyros', () => undefined],
    ]
    let i = 0
    const run = () => {
      if (cancelled) return
      if (i >= steps.length) {
        setPct(100)
        window.setTimeout(() => !cancelled && onDone(), 350)
        return
      }
      const [label, fn] = steps[i]
      setMsg(label)
      setPct(Math.round((i / steps.length) * 100))
      // yield to the browser so the label paints before heavy generation
      window.setTimeout(() => {
        try {
          fn()
        } catch (e) {
          setFailed(e instanceof Error ? e.message : String(e))
          return
        }
        i++
        run()
      }, 60)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [onDone])

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-ink-900 px-6 text-center">
      <h1 className="font-display text-4xl font-black tracking-[0.15em] sm:text-6xl">
        SKY<span className="text-neon">FLY</span> <span className="text-neon-pink">3D</span>
      </h1>
      {failed ? (
        <div className="glass mt-8 max-w-md rounded-xl p-5">
          <p className="font-display text-sm tracking-widest text-red-400">STARTUP FAILED</p>
          <p className="mt-2 text-cyan-50/80">{failed}</p>
        </div>
      ) : (
        <>
          <div className="mt-8 h-1.5 w-64 overflow-hidden rounded-full bg-white/10 sm:w-96">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_14px_#00e5ff] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="font-display mt-4 text-[11px] tracking-[0.35em] text-cyan-100/60">{msg.toUpperCase()}</p>
        </>
      )}
    </div>
  )
}
