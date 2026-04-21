import { useGameStore } from '../store/gameStore'
import { SHIP_CONFIGS } from '../types/game'

interface ShipPanelProps {
  shipsPlaced: Record<number, number>
  onRandomize: () => void
}

export default function ShipPanel({ shipsPlaced, onRandomize }: ShipPanelProps) {
  const { selectedShipSize, setSelectedShipSize, placingOrientation, setPlacingOrientation } =
    useGameStore()

  const allDone = SHIP_CONFIGS.every((c) => (shipsPlaced[c.size] ?? 0) >= c.count)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-md"
      style={{ background: 'rgba(255,255,255,0.04)', minWidth: 200 }}>

      <div className="flex items-center justify-between">
        <span className="text-xs tracking-widest text-white/40 uppercase">Flota</span>
        <div className="flex gap-1.5">
          <button
            onClick={onRandomize}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition hover:bg-white/10"
            title="Losowe rozmieszczenie"
          >
            🎲 LOSUJ
          </button>
          <button
            onClick={() => setPlacingOrientation(placingOrientation === 'horizontal' ? 'vertical' : 'horizontal')}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition hover:bg-white/10"
            title="Skrót: R"
          >
            OBRÓĆ {placingOrientation === 'horizontal' ? '↔' : '↕'} <span className="opacity-40">[R]</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {SHIP_CONFIGS.map((config) => {
          const placed = shipsPlaced[config.size] ?? 0
          const remaining = config.count - placed
          const isDone = remaining === 0
          const isSelected = selectedShipSize === config.size && !isDone

          return (
            <button
              key={config.size}
              disabled={isDone}
              onClick={() => setSelectedShipSize(isSelected ? null : config.size)}
              className={[
                'flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-left transition',
                isSelected
                  ? 'border-blue-400/60 bg-blue-500/20'
                  : isDone
                    ? 'border-white/5 opacity-35 cursor-default'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
              ].join(' ')}
            >
              {/* nazwa i licznik */}
              <div className="flex items-center justify-between gap-3">
                <span className={['text-xs font-medium', isSelected ? 'text-blue-200' : 'text-white/70'].join(' ')}>
                  {config.label}
                </span>
                <span className={['text-xs tabular-nums', isDone ? 'text-white/20' : 'text-white/40'].join(' ')}>
                  {placed}/{config.count}
                </span>
              </div>

              {/* wizualna reprezentacja statku */}
              <div className="flex gap-1">
                {Array.from({ length: config.size }).map((_, i) => (
                  <div
                    key={i}
                    className={[
                      'h-4 w-4 rounded-sm border',
                      isSelected
                        ? 'border-blue-400/70 bg-blue-400/50'
                        : isDone
                          ? 'border-white/10 bg-white/10'
                          : 'border-white/20 bg-white/20',
                    ].join(' ')}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {allDone && (
        <p className="text-center text-xs tracking-wider text-green-400/80">
          Wszystkie statki postawione ✓
        </p>
      )}
    </div>
  )
}
