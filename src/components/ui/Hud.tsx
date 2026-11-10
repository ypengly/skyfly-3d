import { useEffect, useRef, useState } from 'react'
import { telemetry } from '../../game/telemetry'
import { useGame } from '../../store/useGame'
import { fmtTime } from './common'

/** Re-render the caller at ~20 Hz from the mutable telemetry object. */
function useTelemetry(hz = 20) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) % 1e6), 1000 / hz)
    return () => window.clearInterval(id)
  }, [hz])
  return telemetry
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function headingDeg(yaw: number) {
  // yaw 0 faces -Z (north). Positive yaw turns left, so heading = -yaw.
  let h = (-yaw * 180) / Math.PI
  h = ((h % 360) + 360) % 360
  return h
}

function Compass({ yaw }: { yaw: number }) {
  const h = headingDeg(yaw)
  const ticks = []
  for (let d = -90; d <= 90; d += 15) {
    const deg = (Math.round((h + d) / 15) * 15 + 360) % 360
    const off = deg - h
    const wrapped = ((off + 540) % 360) - 180
    if (Math.abs(wrapped) > 90) continue
    const label = deg % 45 === 0 ? DIRS[(deg / 45) % 8] : ''
    ticks.push(
      <div key={deg + ':' + d} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${50 + (wrapped / 180) * 100}%` }}>
        <div className={`w-px ${label ? 'h-3 bg-neon' : 'h-1.5 bg-white/40'}`} />
        {label && <span className="font-display text-[10px] text-cyan-100">{label}</span>}
      </div>,
    )
  }
  return (
    <div className="relative mx-auto h-8 w-44 overflow-hidden sm:w-72" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)' }}>
      {ticks}
    </div>
  )
}

function Battery({ pct }: { pct: number }) {
  const low = pct < 20
  return (
    <div className="flex items-center gap-2">
      <div className={`relative h-4 w-9 rounded-sm border ${low ? 'border-red-400' : 'border-cyan-300/70'} p-px`}>
        <div className="h-full rounded-[1px] transition-all" style={{ width: `${pct}%`, background: low ? '#ff4d5e' : pct < 45 ? '#ffd23d' : '#00e5ff' }} />
        <div className="absolute -right-1 top-1 h-2 w-0.5 bg-cyan-300/70" />
      </div>
      <span className={`font-display text-sm ${low ? 'animate-blink text-red-400' : ''}`}>{Math.round(pct)}%</span>
    </div>
  )
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null)
  const t = telemetry
  useEffect(() => {
    let raf = 0
    let last = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 66) return
      last = now
      const cv = ref.current
      if (!cv) return
      const ctx = cv.getContext('2d')
      if (!ctx) return
      const S = cv.width
      const R = S / 2
      const range = Math.min(t.worldExtent, 320)
      const k = R / range
      ctx.clearRect(0, 0, S, S)
      ctx.save()
      ctx.beginPath()
      ctx.arc(R, R, R - 1, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = 'rgba(4,10,22,0.78)'
      ctx.fillRect(0, 0, S, S)
      // rotate so the drone always faces up
      ctx.translate(R, R)
      ctx.rotate(t.yaw)
      // grid
      ctx.strokeStyle = 'rgba(0,229,255,0.12)'
      ctx.lineWidth = 1
      const g = 100
      const px = t.pos[0]
      const pz = t.pos[2]
      for (let gx = Math.floor((px - range) / g) * g; gx < px + range; gx += g) {
        ctx.beginPath()
        ctx.moveTo((gx - px) * k, -R * 1.5)
        ctx.lineTo((gx - px) * k, R * 1.5)
        ctx.stroke()
      }
      for (let gz = Math.floor((pz - range) / g) * g; gz < pz + range; gz += g) {
        ctx.beginPath()
        ctx.moveTo(-R * 1.5, (gz - pz) * k)
        ctx.lineTo(R * 1.5, (gz - pz) * k)
        ctx.stroke()
      }
      // course polyline
      if (t.coursePath.length > 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.beginPath()
        t.coursePath.forEach(([x, z], i) => {
          const sx = (x - px) * k
          const sy = (z - pz) * k
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        })
        ctx.stroke()
      }
      // next gates
      t.nextGates.forEach(([x, z], i) => {
        let sx = (x - px) * k
        let sy = (z - pz) * k
        const d = Math.hypot(sx, sy)
        const max = R - 8
        if (d > max) {
          sx = (sx / d) * max
          sy = (sy / d) * max
        }
        ctx.fillStyle = i === 0 ? '#ffffff' : 'rgba(0,229,255,0.7)'
        ctx.shadowColor = '#00e5ff'
        ctx.shadowBlur = i === 0 ? 10 : 0
        ctx.beginPath()
        ctx.arc(sx, sy, i === 0 ? 5 : 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })
      ctx.restore()
      // drone marker
      ctx.save()
      ctx.translate(R, R)
      ctx.fillStyle = '#00e5ff'
      ctx.shadowColor = '#00e5ff'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(0, -8)
      ctx.lineTo(6, 7)
      ctx.lineTo(0, 4)
      ctx.lineTo(-6, 7)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = 'rgba(0,229,255,0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(R, R, R - 1, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = '700 10px Orbitron, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('N', R + Math.sin(t.yaw) * (R - 11), R - Math.cos(t.yaw) * (R - 11) + 3)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [t])
  return <canvas ref={ref} width={180} height={180} className="h-24 w-24 sm:h-36 sm:w-36" />
}

function Stat({ label, value, unit, className = '' }: { label: string; value: string; unit?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="font-display text-[9px] tracking-[0.3em] text-cyan-100/60 sm:text-[10px]">{label}</div>
      <div className="font-display text-xl font-bold leading-none text-white sm:text-3xl">
        {value}
        {unit && <span className="ml-1 text-[10px] font-medium text-neon sm:text-xs">{unit}</span>}
      </div>
    </div>
  )
}

export function Hud() {
  const t = useTelemetry(20)
  const showFps = useGame((s) => s.settings.fps)
  const mode = useGame((s) => s.mode)
  const camera = useGame((s) => s.camera)
  const speedFx = Math.min(1, t.speedKmh / 110)
  const [toast, setToast] = useState('')
  const lastToast = useRef(0)

  useEffect(() => {
    if (t.toastId !== lastToast.current) {
      lastToast.current = t.toastId
      setToast(t.toast)
      const id = window.setTimeout(() => setToast(''), 1100)
      return () => window.clearTimeout(id)
    }
  })

  const cd = Math.ceil(t.countdown)
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none" style={{ paddingTop: 'var(--safe-top)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}>
      {/* speed lines overlay: cheap motion-blur stand-in */}
      <div
        className="absolute inset-0"
        style={{
          opacity: Math.max(0, speedFx - 0.35) * (t.boosting ? 1.3 : 0.9),
          background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,229,255,0.18) 100%)',
        }}
      />
      {t.battery < 15 && <div className="absolute inset-0 animate-pulseGlow shadow-[inset_0_0_80px_rgba(255,60,80,0.4)]" />}

      {/* top row */}
      <div className="absolute left-3 right-3 top-2 flex items-start justify-between sm:left-6 sm:right-6 sm:top-4">
        <div className="glass rounded-xl px-3 py-2 sm:px-4 sm:py-3">
          <Stat label="TIME" value={fmtTime(t.time)} />
          {mode !== 'free' && <div className="font-display mt-1 text-[10px] tracking-widest text-neon sm:text-xs">{t.objective}{t.laps > 1 ? ` · LAP ${t.lap}/${t.laps}` : ''}</div>}
          {mode === 'free' && <div className="font-display mt-1 text-[10px] tracking-widest text-neon sm:text-xs">FREE FLIGHT</div>}
        </div>
        <div className="mt-1 text-center">
          <Compass yaw={t.yaw} />
          <div className="font-display text-sm font-bold text-white">{String(Math.round(headingDeg(t.yaw))).padStart(3, '0')}°</div>
          <div className="font-display mt-1 text-[10px] tracking-[0.35em] text-neon">{t.flightMode} · {camera === 'fpv' ? 'FPV' : 'CHASE'}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="glass rounded-xl px-3 py-2">
            <Battery pct={t.battery} />
          </div>
          {showFps && <div className="font-display rounded-md bg-black/40 px-2 py-0.5 text-[10px] text-neon-lime">{t.fps} FPS</div>}
        </div>
      </div>

      {/* bottom-left stats */}
      <div className="absolute bottom-3 left-3 flex gap-3 sm:bottom-6 sm:left-6 [@media(pointer:coarse)]:bottom-[68px] [@media(pointer:coarse)]:left-1/2 [@media(pointer:coarse)]:-translate-x-1/2">
        <div className="glass flex gap-5 rounded-xl px-3 py-2 sm:px-5 sm:py-3">
          <Stat label="SPEED" value={String(Math.round(t.speedKmh))} unit="km/h" />
          <Stat label="ALT" value={String(Math.round(t.altitude))} unit="m" />
          <Stat className="hidden sm:block" label="DIST" value={t.distance >= 1000 ? (t.distance / 1000).toFixed(2) : String(Math.round(t.distance))} unit={t.distance >= 1000 ? 'km' : 'm'} />
        </div>
      </div>

      {/* minimap */}
      <div className="absolute right-3 top-24 sm:right-6 sm:top-28">
        <div className="glass rounded-full p-1">
          <Minimap />
        </div>
      </div>

      {/* hit counter for challenge */}
      {mode === 'challenge' && (
        <div className="absolute left-3 top-24 sm:left-6 sm:top-28">
          <div className="glass rounded-lg px-3 py-1 text-xs tracking-widest">
            DAMAGE <span className={t.hits > 5 ? 'text-red-400' : 'text-neon'}>{t.hits}/8</span>
          </div>
        </div>
      )}

      {/* center messages */}
      {cd > 0 && (
        <div key={cd} className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pop font-display text-8xl font-black text-white drop-shadow-[0_0_30px_#00e5ff] sm:text-9xl">{cd}</div>
        </div>
      )}
      {toast && cd === 0 && (
        <div key={t.toastId} className="absolute inset-x-0 top-1/3 flex justify-center">
          <div className={`animate-pop font-display text-2xl font-black tracking-[0.3em] sm:text-4xl ${toast === 'COLLISION' || toast === 'HARD LANDING' ? 'text-red-400' : 'text-neon'}`} style={{ textShadow: '0 0 24px currentColor' }}>
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
