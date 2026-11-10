import { useEffect, useRef, type PointerEvent as RPE } from 'react'
import { audio } from '../../game/audio'
import { touch } from '../../game/input'
import { useGame } from '../../store/useGame'

interface StickProps {
  side: 'left' | 'right'
  radius: number
  onValue: (x: number, y: number) => void
  label: string
}

const DEAD = 0.08

/**
 * Floating virtual joystick. The base appears where the thumb lands inside its half of the
 * screen, tracks one pointer id (so both thumbs work at once) and eases toward the target value.
 */
function Stick({ side, radius, onValue, label }: StickProps) {
  const zone = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const state = useRef({ id: -1, ox: 0, oy: 0, tx: 0, ty: 0, x: 0, y: 0, home: true })

  // smoothing loop
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const s = state.current
      const k = s.id === -1 ? 0.35 : 0.4
      s.x += (s.tx - s.x) * k
      s.y += (s.ty - s.y) * k
      if (Math.abs(s.x) < 0.001) s.x = 0
      if (Math.abs(s.y) < 0.001) s.y = 0
      onValue(s.x, s.y)
      if (knob.current) knob.current.style.transform = `translate(${s.x * radius}px, ${-s.y * radius}px)`
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      onValue(0, 0)
    }
  }, [onValue, radius])

  const place = (x: number, y: number, home: boolean) => {
    const b = base.current
    if (!b) return
    b.style.left = `${x}px`
    b.style.top = `${y}px`
    b.style.opacity = home ? '0.45' : '1'
  }

  const goHome = () => {
    const z = zone.current
    if (!z) return
    const r = z.getBoundingClientRect()
    place(side === 'left' ? Math.max(radius + 20, r.width * 0.34) : Math.min(r.width - radius - 20, r.width * 0.66), r.height - radius - 28, true)
  }
  useEffect(() => {
    goHome()
    window.addEventListener('resize', goHome)
    window.addEventListener('orientationchange', goHome)
    return () => {
      window.removeEventListener('resize', goHome)
      window.removeEventListener('orientationchange', goHome)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius])

  const down = (e: RPE) => {
    const s = state.current
    if (s.id !== -1) return
    e.preventDefault()
    const z = zone.current as HTMLDivElement
    z.setPointerCapture(e.pointerId)
    const r = z.getBoundingClientRect()
    s.id = e.pointerId
    s.ox = e.clientX - r.left
    s.oy = e.clientY - r.top
    place(s.ox, s.oy, false)
    move(e)
  }
  const move = (e: RPE) => {
    const s = state.current
    if (e.pointerId !== s.id) return
    const z = zone.current as HTMLDivElement
    const r = z.getBoundingClientRect()
    let dx = e.clientX - r.left - s.ox
    let dy = e.clientY - r.top - s.oy
    const d = Math.hypot(dx, dy)
    if (d > radius) {
      dx = (dx / d) * radius
      dy = (dy / d) * radius
    }
    let nx = dx / radius
    let ny = -dy / radius
    const m = Math.hypot(nx, ny)
    if (m < DEAD) {
      nx = 0
      ny = 0
    } else {
      // rescale after dead zone and add a gentle curve for fine control near centre
      const scaled = (m - DEAD) / (1 - DEAD)
      const curve = Math.pow(scaled, 1.35)
      nx = (nx / m) * curve
      ny = (ny / m) * curve
    }
    s.tx = nx
    s.ty = ny
  }
  const up = (e: RPE) => {
    const s = state.current
    if (e.pointerId !== s.id) return
    s.id = -1
    s.tx = 0
    s.ty = 0
    goHome()
  }

  return (
    <div
      ref={zone}
      className="pointer-events-auto absolute bottom-0 top-[22%]"
      style={{ [side]: 0, width: '42%', touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
    >
      <div
        ref={base}
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/50 bg-cyan-400/5 shadow-[0_0_30px_rgba(0,229,255,0.18)] backdrop-blur-[2px] transition-opacity"
        style={{ width: radius * 2, height: radius * 2 }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-[0.3em] text-cyan-200/40">{label}</div>
        <div
          ref={knob}
          className="absolute left-1/2 top-1/2 -ml-[26px] -mt-[26px] h-[52px] w-[52px] rounded-full border border-cyan-200/80 bg-gradient-to-br from-cyan-300/60 to-blue-500/40 shadow-[0_0_22px_rgba(0,229,255,0.55)]"
        />
      </div>
    </div>
  )
}

function HoldButton({ label, onChange, className = '', accent = false }: { label: string; onChange: (v: boolean) => void; className?: string; accent?: boolean }) {
  const id = useRef(-1)
  const el = useRef<HTMLButtonElement>(null)
  const set = (v: boolean) => {
    onChange(v)
    el.current?.classList.toggle('!bg-cyan-400/40', v)
    el.current?.classList.toggle('!shadow-[0_0_24px_rgba(0,229,255,0.8)]', v)
  }
  return (
    <button
      ref={el}
      className={`font-display pointer-events-auto h-12 w-14 rounded-xl border border-cyan-300/50 bg-ink-800/60 text-[10px] font-bold uppercase tracking-widest text-cyan-50 backdrop-blur sm:h-14 sm:w-16 ${accent ? 'border-neon-pink/70' : ''} ${className}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId)
        id.current = e.pointerId
        audio.init()
        audio.hover()
        set(true)
      }}
      onPointerUp={(e) => {
        if (e.pointerId === id.current) {
          id.current = -1
          set(false)
        }
      }}
      onPointerCancel={() => {
        id.current = -1
        set(false)
      }}
      onLostPointerCapture={() => {
        id.current = -1
        set(false)
      }}
    >
      {label}
    </button>
  )
}

function TapButton({ label, onTap, className = '' }: { label: string; onTap: () => void; className?: string }) {
  return (
    <button
      className={`font-display pointer-events-auto h-11 w-14 rounded-xl border border-white/20 bg-ink-800/60 text-[10px] font-bold uppercase tracking-widest text-cyan-50 backdrop-blur active:bg-cyan-400/30 sm:h-12 sm:w-16 ${className}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault()
        audio.init()
        audio.click()
        onTap()
      }}
    >
      {label}
    </button>
  )
}

export function TouchControls() {
  const scale = useGame((s) => s.settings.touchScale)
  const lefty = useGame((s) => s.settings.lefty)
  const radius = Math.round(Math.min(70, Math.max(46, Math.min(window.innerWidth, window.innerHeight) * 0.16)) * scale)

  // block page scroll / pull-to-refresh / pinch while flying
  useEffect(() => {
    const block = (e: TouchEvent) => e.preventDefault()
    document.addEventListener('touchmove', block, { passive: false })
    document.addEventListener('gesturestart', block as EventListener)
    return () => {
      document.removeEventListener('touchmove', block)
      document.removeEventListener('gesturestart', block as EventListener)
    }
  }, [])

  const moveVal = useRef((x: number, y: number) => {
    touch.left.x = x
    touch.left.y = y
  }).current
  const lookVal = useRef((x: number, y: number) => {
    touch.right.x = x
    touch.right.y = y
  }).current
  const leftMove = lefty ? lookVal : moveVal
  const rightMove = lefty ? moveVal : lookVal

  return (
    <div className="absolute inset-0 z-10" style={{ touchAction: 'none', paddingBottom: 'var(--safe-bottom)' }}>
      <Stick key={`l${lefty}`} side="left" radius={radius} onValue={leftMove} label={lefty ? 'ALT · YAW' : 'MOVE'} />
      <Stick key={`r${lefty}`} side="right" radius={radius} onValue={rightMove} label={lefty ? 'MOVE' : 'ALT · YAW'} />

      <div className={`pointer-events-none absolute bottom-[34%] flex flex-col gap-2 ${lefty ? 'right-3' : 'left-3'}`} style={{ transform: `scale(${scale})`, transformOrigin: lefty ? 'bottom right' : 'bottom left' }}>
        <HoldButton label="Boost" accent onChange={(v) => (touch.boost = v)} />
        <HoldButton label="Brake" onChange={(v) => (touch.brake = v)} />
      </div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2" style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'bottom center' }}>
        <TapButton label="Cam" onTap={() => useGame.getState().toggleCamera()} />
        <button
          className="font-display pointer-events-auto h-11 w-16 rounded-xl border border-white/30 bg-ink-800/70 text-[10px] font-bold uppercase tracking-widest text-cyan-50 backdrop-blur active:bg-cyan-400/30 sm:h-12"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.preventDefault()
            audio.click()
            useGame.getState().pause()
          }}
        >
          Pause
        </button>
        <TapButton label="Reset" onTap={() => useGame.getState().reset()} />
      </div>
    </div>
  )
}

export const useIsTouch = () => {
  return typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0)
}
