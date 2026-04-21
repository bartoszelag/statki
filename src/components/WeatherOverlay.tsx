import { useMemo } from 'react'

export type WeatherState = 'calm' | 'storm' | 'hurricane' | 'tornado' | 'blizzard'

interface WeatherOverlayProps {
  state: WeatherState
}

export default function WeatherOverlay({ state }: WeatherOverlayProps) {
  const rainCount = state === 'hurricane' ? 60 : state === 'storm' ? 25 : 0
  const debrisCount = state === 'tornado' ? 35 : 0
  const snowCount = state === 'blizzard' ? 70 : 0

  const rainDrops = useMemo(
    () =>
      Array.from({ length: rainCount }, (_, i) => ({
        id: i,
        left: Math.random() * 110 - 5,
        duration: state === 'hurricane' ? 0.3 + Math.random() * 0.3 : 0.6 + Math.random() * 0.5,
        delay: Math.random() * 2,
        opacity: 0.2 + Math.random() * 0.35,
        height: 8 + Math.random() * 16,
      })),
    [rainCount, state],
  )

  const debris = useMemo(
    () =>
      Array.from({ length: debrisCount }, (_, i) => ({
        id: i,
        angle: (i / debrisCount) * 360,
        radius: 100 + Math.random() * 220,
        w: 3 + Math.random() * 8,
        h: 2 + Math.random() * 4,
        speed: 1.2 + Math.random() * 2.2,
        opacity: 0.45 + Math.random() * 0.45,
        brown: Math.floor(60 + Math.random() * 60),
      })),
    [debrisCount],
  )

  const snowflakes = useMemo(
    () =>
      Array.from({ length: snowCount }, (_, i) => ({
        id: i,
        left: Math.random() * 115 - 5,
        size: 2 + Math.random() * 5,
        duration: 2.5 + Math.random() * 4,
        delay: Math.random() * 5,
        opacity: 0.4 + Math.random() * 0.5,
      })),
    [snowCount],
  )

  if (state === 'calm') return null

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">

      {/* deszcz — storm i hurricane */}
      {rainDrops.map((d) => (
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

      {/* błyskawice — hurricane */}
      {state === 'hurricane' && (
        <div className="lightning-flash absolute inset-0 bg-white" />
      )}

      {/* tornado — latające szczątki orbiting po ekranie */}
      {state === 'tornado' && (
        <>
          {/* lejek wiru — gradient stożkowy */}
          <div
            className="absolute left-1/2 -top-10 tornado-funnel"
            style={{
              width: 220,
              height: 520,
              marginLeft: -110,
              background:
                'linear-gradient(to bottom, rgba(40,30,10,0.0) 0%, rgba(60,45,15,0.35) 40%, rgba(30,20,8,0.6) 100%)',
              clipPath: 'polygon(35% 0%, 65% 0%, 58% 100%, 42% 100%)',
            }}
          />
          {/* orbiting debris */}
          <div className="absolute inset-0 flex items-start justify-center" style={{ paddingTop: '15%' }}>
            {debris.map((d) => (
              <div
                key={d.id}
                className="absolute rounded-sm debris-particle"
                style={
                  {
                    width: d.w,
                    height: d.h,
                    background: `rgba(${100 + d.brown}, ${d.brown}, ${Math.floor(d.brown * 0.3)}, ${d.opacity})`,
                    '--orbit-r': `${d.radius}px`,
                    '--orbit-start': `${d.angle}deg`,
                    animationDuration: `${d.speed}s`,
                    animationDelay: `-${d.speed * (d.angle / 360)}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          {/* ciemna mgła przy dole */}
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: '35%',
              background: 'linear-gradient(to top, rgba(20,14,4,0.7) 0%, transparent 100%)',
            }}
          />
        </>
      )}

      {/* blizzard — śnieg + mleczna zasłona */}
      {state === 'blizzard' && (
        <>
          {snowflakes.map((s) => (
            <div
              key={s.id}
              className="snow-flake absolute rounded-full bg-white"
              style={{
                left: `${s.left}%`,
                top: '-10px',
                width: s.size,
                height: s.size,
                opacity: s.opacity,
                animationDuration: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
          {/* biaława mgiełka */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(200, 220, 255, 0.06)' }}
          />
        </>
      )}
    </div>
  )
}

// Oblicza stan pogody na podstawie łącznej liczby strzałów obu graczy
export function computeWeather(totalShots: number): WeatherState {
  if (totalShots >= 30) return 'blizzard'
  if (totalShots >= 20) return 'tornado'
  if (totalShots >= 12) return 'hurricane'
  if (totalShots >= 5)  return 'storm'
  return 'calm'
}
