import { useGameStore } from '../store/gameStore'
import { SHIP_CONFIGS } from '../types/game'

interface ShipPanelProps {
  shipsPlaced: Record<number, number>
}

export default function ShipPanel({ shipsPlaced }: ShipPanelProps) {
  const { selectedShipSize, setSelectedShipSize, placingOrientation, setPlacingOrientation } =
    useGameStore()

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs tracking-widest text-white/40 uppercase">Statki</span>
        <button
          onClick={() =>
            setPlacingOrientation(placingOrientation === 'horizontal' ? 'vertical' : 'horizontal')
          }
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10 transition"
        >
          {placingOrientation === 'horizontal' ? '↔ poziomo' : '↕ pionowo'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {SHIP_CONFIGS.map((config) => {
          const placed = shipsPlaced[config.size] ?? 0
          const remaining = config.count - placed
          const isSelected = selectedShipSize === config.size
          const isDone = remaining === 0

          return (
            <button
              key={config.size}
              disabled={isDone}
              onClick={() => setSelectedShipSize(isDone ? null : config.size)}
              className={[
                'flex items-center justify-between gap-4 rounded-lg border px-3 py-2 text-left transition',
                isSelected
                  ? 'border-blue-400/50 bg-blue-500/20 text-blue-200'
                  : isDone
                    ? 'border-white/5 bg-white/2 text-white/20 cursor-default'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
              ].join(' ')}
            >
              <span className="text-xs">{config.label}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: config.size }).map((_, i) => (
                  <div
                    key={i}
                    className={[
                      'h-3 w-3 rounded-sm',
                      isDone ? 'bg-white/10' : isSelected ? 'bg-blue-400' : 'bg-white/30',
                    ].join(' ')}
                  />
                ))}
                <span className="ml-2 text-xs opacity-50">{remaining}/{config.count}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
