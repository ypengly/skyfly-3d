import * as React from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { audio } from '../../game/audio'

export function Btn({
  primary,
  sound = 'click',
  className = '',
  onClick,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; sound?: 'click' | 'back' }) {
  return (
    <button
      {...rest}
      className={`btn ${primary ? 'btn-primary' : ''} ${className}`}
      onMouseEnter={() => audio.hover()}
      onClick={(e) => {
        audio.init()
        if (sound === 'back') audio.back()
        else audio.click()
        onClick?.(e)
      }}
    >
      {children}
    </button>
  )
}

export function ScreenShell({ title, subtitle, onBack, children, wide }: { title: string; subtitle?: string; onBack?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-ink-900/70 backdrop-blur-sm">
      <div className="mx-auto flex w-full flex-1 flex-col px-4 py-5 sm:px-8 sm:py-8" style={{ maxWidth: wide ? 1200 : 920 }}>
        <header className="mb-5 flex items-center gap-4 animate-fadeIn">
          {onBack && (
            <Btn sound="back" onClick={onBack} className="!px-4 !py-2">
              ← Back
            </Btn>
          )}
          <div>
            <h2 className="font-display text-xl font-black tracking-[0.2em] text-white sm:text-3xl">{title}</h2>
            {subtitle && <p className="text-sm text-cyan-100/60 sm:text-base">{subtitle}</p>}
          </div>
        </header>
        <div className="flex-1 animate-fadeIn">{children}</div>
      </div>
    </div>
  )
}

export function StatBar({ label, value, color = '#00e5ff' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-cyan-100/70">
      <span className="w-16 shrink-0">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => {
        audio.click()
        onChange(!on)
      }}
      className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left"
    >
      <span className="text-base text-cyan-50/90">{label}</span>
      <span className={`relative h-6 w-11 rounded-full border transition ${on ? 'border-cyan-300 bg-cyan-400/40' : 'border-white/20 bg-white/5'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-6 shadow-[0_0_10px_#00e5ff]' : 'left-1'}`} />
      </span>
    </button>
  )
}

export function Slider({ value, min, max, step = 0.05, onChange, label, format }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; format?: (v: number) => string }) {
  return (
    <label className="block py-2">
      <div className="mb-1 flex justify-between text-base text-cyan-50/90">
        <span>{label}</span>
        <span className="font-display text-xs tracking-widest text-neon">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  )
}

export function fmtTime(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const ms = Math.floor((t % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
}

export class ErrorBoundary extends React.Component<{ children: ReactNode; onReset?: () => void }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) {
    return { err }
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink-900 p-6 text-center">
        <div className="glass max-w-md rounded-2xl p-8">
          <h2 className="font-display text-xl font-bold tracking-widest text-neon-pink">SOMETHING WENT WRONG</h2>
          <p className="mt-3 text-cyan-50/80">{this.state.err.message || 'The simulator hit an unexpected error.'}</p>
          <p className="mt-2 text-sm text-cyan-50/50">If this keeps happening, try Low graphics mode in Settings.</p>
          <Btn primary className="mt-6" onClick={() => { this.setState({ err: null }); this.props.onReset?.() }}>
            Back to menu
          </Btn>
        </div>
      </div>
    )
  }
}
