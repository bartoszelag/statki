import { type CellState, BOARD_SIZE } from '../types/game'
import Explosion from './Explosion'

interface BoardProps {
  grid: CellState[][]
  onCellClick?: (x: number, y: number) => void
  onCellHover?: (x: number, y: number) => void
  onMouseLeave?: () => void
  highlightCells?: Set<string>
  highlightValid?: boolean
  disabled?: boolean
  hideShips?: boolean
  explosionAt?: { x: number; y: number } | null
  label: string
}

const COLS = Array.from({ length: BOARD_SIZE }, (_, i) => String.fromCharCode(65 + i))
const ROWS = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1)

function cellColor(state: CellState, hideShips: boolean): string {
  if (state === 'hit') return 'bg-red-500/80 border-red-400'
  if (state === 'sunk') return 'bg-red-700/90 border-red-600'
  if (state === 'miss') return 'bg-blue-300/30 border-blue-300/40'
  if (state === 'ship' && !hideShips) return 'bg-slate-400/60 border-slate-300/50'
  return 'bg-white/5 border-white/10 hover:bg-blue-400/20'
}

export default function Board({
  grid,
  onCellClick,
  onCellHover,
  onMouseLeave,
  highlightCells,
  highlightValid,
  disabled = false,
  hideShips = false,
  explosionAt = null,
  label,
}: BoardProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm tracking-widest text-blue-300/70 uppercase">{label}</span>
      <div className="flex gap-1">
        <div className="w-5" />
        {COLS.map((col) => (
          <div key={col} className="flex w-7 items-center justify-center text-xs text-white/30">
            {col}
          </div>
        ))}
      </div>
      <div onMouseLeave={onMouseLeave}>
        {grid.map((row, y) => (
          <div key={y} className="flex gap-1 mb-1">
            <div className="flex w-5 items-center justify-center text-xs text-white/30">
              {ROWS[y]}
            </div>
            {row.map((cell, x) => {
              const key = `${x},${y}`
              const isHighlighted = highlightCells?.has(key)
              const isExploding = explosionAt?.x === x && explosionAt?.y === y
              return (
                <div key={x} className="relative" style={{ overflow: 'visible' }}>
                  <button
                    disabled={disabled || !onCellClick}
                    onClick={() => onCellClick?.(x, y)}
                    onMouseEnter={() => onCellHover?.(x, y)}
                    className={[
                      'h-7 w-7 rounded-sm border transition-all duration-100',
                      isHighlighted
                        ? highlightValid
                          ? 'bg-blue-400/50 border-blue-400'
                          : 'bg-red-400/50 border-red-400'
                        : cellColor(cell, hideShips),
                      disabled ? 'cursor-default' : 'cursor-pointer',
                    ].join(' ')}
                  />
                  {isExploding && <Explosion />}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
