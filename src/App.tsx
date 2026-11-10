import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { audio } from './game/audio'
import { useGame } from './store/useGame'
import { ErrorBoundary, Btn } from './components/ui/common'
import { DroneScreen, EnvScreen, HowTo, MainMenu, ModeScreen, SettingsPanel } from './components/ui/Menus'
import { Hud } from './components/ui/Hud'
import { LoadingScreen, PauseMenu, ResultScreen } from './components/ui/Overlays'
import { TouchControls, useIsTouch } from './components/ui/TouchControls'

// the heavy 3D bundle is only fetched when the app starts
const GameCanvas = lazy(() => import('./components/scene/GameCanvas').then((m) => ({ default: m.GameCanvas })))

const FLIGHT = new Set(['playing', 'paused', 'result'])

export default function App() {
  const screen = useGame((s) => s.screen)
  const prev = useGame((s) => s.prevScreen)
  const go = useGame((s) => s.go)
  const settings = useGame((s) => s.settings)
  const error = useGame((s) => s.error)
  const setError = useGame((s) => s.setError)
  const env = useGame((s) => s.env)
  const [showPauseSettings, setShowPauseSettings] = useState(false)
  const touch = useIsTouch()
  const [portrait, setPortrait] = useState(false)

  useEffect(() => {
    audio.configure(settings.masterVolume, settings.sfx)
  }, [settings.masterVolume, settings.sfx])

  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth * 1.1)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const onLoaded = useCallback(() => go('menu'), [go])
  const inFlight = FLIGHT.has(screen)
  // keep the canvas alive behind menus once it has been shown, so the menu has a living backdrop
  const showCanvas = screen !== 'loading'
  const backdropOnly = !inFlight

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink-900" style={{ touchAction: 'none' }}>
      <ErrorBoundary onReset={() => go('menu')}>
        {showCanvas && (
          <div className="absolute inset-0" style={{ filter: backdropOnly ? 'blur(2px) brightness(0.55)' : undefined }} key={`cv-${env}`}>
            <Suspense fallback={null}>
              <GameCanvas />
            </Suspense>
          </div>
        )}

        {screen === 'loading' && <LoadingScreen onDone={onLoaded} />}
        {screen === 'menu' && <MainMenu />}
        {screen === 'env' && <EnvScreen />}
        {screen === 'modes' && <ModeScreen />}
        {screen === 'drones' && <DroneScreen />}
        {screen === 'settings' && <SettingsPanel onBack={() => go(prev === 'paused' ? 'paused' : 'menu')} />}
        {screen === 'howto' && <HowTo />}

        {(screen === 'playing' || screen === 'paused') && <Hud />}
        {screen === 'playing' && touch && <TouchControls />}
        {screen === 'paused' && !showPauseSettings && <PauseMenu onSettings={() => setShowPauseSettings(true)} />}
        {screen === 'paused' && showPauseSettings && <SettingsPanel onBack={() => setShowPauseSettings(false)} />}
        {screen === 'result' && <ResultScreen />}

        {touch && portrait && inFlight && (
          <div className="absolute inset-x-0 top-14 z-40 mx-auto w-fit rounded-full border border-cyan-300/40 bg-ink-900/80 px-4 py-2 text-xs tracking-widest text-cyan-100">
            ROTATE YOUR DEVICE FOR BEST CONTROL
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
            <div className="glass max-w-md rounded-2xl p-6 text-center">
              <h2 className="font-display text-lg font-bold tracking-widest text-red-400">GRAPHICS ERROR</h2>
              <p className="mt-2 text-cyan-50/80">{error}</p>
              <Btn
                primary
                className="mt-5"
                onClick={() => {
                  useGame.getState().patchSettings({ quality: 'low' })
                  setError(null)
                  go('menu')
                }}
              >
                Switch to Low and continue
              </Btn>
            </div>
          </div>
        )}
      </ErrorBoundary>
    </div>
  )
}
