import type { EnvId } from './types'

/** Procedural Web Audio engine: motor, wind, ambience and UI / gameplay SFX. No asset files needed. */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private motorGain: GainNode | null = null
  private motorOscs: OscillatorNode[] = []
  private motorFilter: BiquadFilterNode | null = null
  private windGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private ambGain: GainNode | null = null
  private ambNodes: AudioNode[] = []
  private noiseBuf: AudioBuffer | null = null
  private volume = 0.6
  private sfxOn = true
  private running = false
  private env: EnvId | null = null

  /** Must be called from a user gesture the first time. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.sfxOn ? this.volume : 0
      this.master.connect(this.ctx.destination)
      this.noiseBuf = this.makeNoise(2)
    } catch {
      this.ctx = null
    }
  }

  private makeNoise(seconds: number) {
    const ctx = this.ctx as AudioContext
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  configure(volume: number, sfx: boolean) {
    this.volume = volume
    this.sfxOn = sfx
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(sfx ? volume : 0, this.ctx.currentTime, 0.05)
  }

  /** Start continuous loops (motor, wind, ambience) for a flight session. */
  startFlight(env: EnvId) {
    if (!this.ctx || !this.master || !this.noiseBuf) return
    this.stopFlight()
    const ctx = this.ctx
    this.running = true
    this.env = env

    // motor: two detuned saws through a low-pass
    this.motorGain = ctx.createGain()
    this.motorGain.gain.value = 0
    this.motorFilter = ctx.createBiquadFilter()
    this.motorFilter.type = 'lowpass'
    this.motorFilter.frequency.value = 900
    this.motorFilter.Q.value = 2
    for (const detune of [0, 7]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = 120
      o.detune.value = detune
      o.connect(this.motorFilter)
      o.start()
      this.motorOscs.push(o)
    }
    this.motorFilter.connect(this.motorGain)
    this.motorGain.connect(this.master)

    // wind
    const wind = ctx.createBufferSource()
    wind.buffer = this.noiseBuf
    wind.loop = true
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'bandpass'
    this.windFilter.frequency.value = 500
    this.windFilter.Q.value = 0.7
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0
    wind.connect(this.windFilter)
    this.windFilter.connect(this.windGain)
    this.windGain.connect(this.master)
    wind.start()
    this.ambNodes.push(wind)

    // ambience per environment
    this.ambGain = ctx.createGain()
    this.ambGain.gain.value = 0.0
    this.ambGain.connect(this.master)
    const amb = ctx.createBufferSource()
    amb.buffer = this.noiseBuf
    amb.loop = true
    const af = ctx.createBiquadFilter()
    if (env === 'tropical') {
      af.type = 'lowpass'
      af.frequency.value = 650 // surf
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.12
      const lg = ctx.createGain()
      lg.gain.value = 0.05
      lfo.connect(lg)
      lg.connect(this.ambGain.gain)
      lfo.start()
      this.ambNodes.push(lfo)
      this.ambGain.gain.value = 0.07
    } else if (env === 'mountain') {
      af.type = 'bandpass'
      af.frequency.value = 260
      af.Q.value = 0.5
      this.ambGain.gain.value = 0.08
    } else {
      af.type = 'lowpass'
      af.frequency.value = 220
      this.ambGain.gain.value = 0.05
      const hum = ctx.createOscillator()
      hum.type = 'sine'
      hum.frequency.value = 55
      const hg = ctx.createGain()
      hg.gain.value = 0.035
      hum.connect(hg)
      hg.connect(this.master)
      hum.start()
      this.ambNodes.push(hum, hg)
    }
    amb.connect(af)
    af.connect(this.ambGain)
    amb.start()
    this.ambNodes.push(amb, af)
  }

  stopFlight() {
    this.running = false
    for (const o of this.motorOscs) {
      try {
        o.stop()
      } catch {
        /* already stopped */
      }
      o.disconnect()
    }
    this.motorOscs = []
    for (const n of this.ambNodes) {
      try {
        ;(n as AudioScheduledSourceNode).stop?.()
      } catch {
        /* ignore */
      }
      n.disconnect()
    }
    this.ambNodes = []
    this.motorGain?.disconnect()
    this.windGain?.disconnect()
    this.ambGain?.disconnect()
    this.motorGain = this.windGain = this.ambGain = null
  }

  /** Called every frame while flying. */
  update(throttle: number, speed: number, maxSpeed: number) {
    if (!this.ctx || !this.running || !this.motorGain) return
    const t = this.ctx.currentTime
    const freq = 90 + throttle * 260
    for (const o of this.motorOscs) o.frequency.setTargetAtTime(freq, t, 0.06)
    this.motorFilter?.frequency.setTargetAtTime(500 + throttle * 1800, t, 0.08)
    this.motorGain.gain.setTargetAtTime(0.05 + throttle * 0.09, t, 0.08)
    const s = Math.min(1, speed / (maxSpeed * 1.4))
    this.windGain?.gain.setTargetAtTime(s * s * 0.35, t, 0.1)
    this.windFilter?.frequency.setTargetAtTime(350 + s * 1700, t, 0.1)
  }

  /** Mute loops while paused without tearing them down. */
  setPaused(paused: boolean) {
    if (!this.ctx) return
    if (paused) void this.ctx.suspend()
    else void this.ctx.resume()
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.master || !this.sfxOn) return
    const ctx = this.ctx
    const t0 = ctx.currentTime + delay
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g)
    g.connect(this.master)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  }

  click() {
    this.tone(880, 0.07, 'triangle', 0.12)
  }
  hover() {
    this.tone(1320, 0.04, 'sine', 0.05)
  }
  back() {
    this.tone(520, 0.09, 'triangle', 0.1, 360)
  }
  checkpoint(step = 0) {
    const base = 660 * Math.pow(1.0595, Math.min(step, 12))
    this.tone(base, 0.16, 'sine', 0.2)
    this.tone(base * 1.5, 0.22, 'sine', 0.15, undefined, 0.07)
  }
  beep(final = false) {
    this.tone(final ? 1100 : 660, final ? 0.4 : 0.14, 'square', 0.1)
  }
  crash() {
    this.tone(140, 0.28, 'sawtooth', 0.22, 40)
    if (this.ctx && this.master && this.noiseBuf && this.sfxOn) {
      const src = this.ctx.createBufferSource()
      src.buffer = this.noiseBuf
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.25, this.ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25)
      src.connect(g)
      g.connect(this.master)
      src.start()
      src.stop(this.ctx.currentTime + 0.3)
    }
  }
  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.18, undefined, i * 0.1))
  }
  lose() {
    ;[392, 330, 262].forEach((f, i) => this.tone(f, 0.32, 'sawtooth', 0.12, undefined, i * 0.14))
  }
  lowBattery() {
    this.tone(300, 0.12, 'square', 0.08)
  }
  currentEnv() {
    return this.env
  }
}

export const audio = new AudioEngine()
