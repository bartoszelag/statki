import { useMemo } from 'react'

export type WeatherState = 'calm' | 'storm' | 'hurricane'

interface RainDrop {
  id: number
  left: number
  duration: number
  delay: number
  opacity: number
  height: number
}

interface WeatherOverlayProps {
  state: WeatherState
}

export default function WeatherOverlay({ state }: WeatherOverlayProps) {
  const dropCount = state === 'hurricane' ? 60 : state === 'storm' ? 25 : 0

  const drops = useMemo<RainDrop[]>(
    () =>
      Array.from({ length: dropCount }, (_, i) => ({
        id: i,
        left: Math.random() * 110 - 5,
        duration: state === 'hurricane' ? 0.3 + Math.random() * 0.3 : 0.6 + Math.random() * 0.5,
        delay: Math.random() * 2,
        opacity: 0.2 + Math.random() * 0.35,
        height: 8 + Math.random() * 16,
      })),
    [dropCount, state],
  )

  if (state === 'calm') return null

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* krople deszczu */}
      {drops.map((d) => (
        <div
          key={d.id}
          className="rain-drop absolute w-px rounded-full"
          style={{
            left: `${d.left}%`,
            top: '-20px',
            height: `${d.height}px`,
            background: `rgba(174, 214, 241, ${d.opacity})`,
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}

      {/* błyskawice tylko podczas huraganu */}
      {state === 'hurricane' && (
        <div className="lightning-flash absolute inset-0 bg-white" />
      )}
    </div>
  )
}

// Oblicza stan pogody na podstawie zniszczeń własnej planszy
export function computeWeather(myBoardDamage: number): WeatherState {
  if (myBoardDamage >= 10) return 'hurricane'
  if (myBoardDamage >= 3) return 'storm'
  return 'calm'
}
