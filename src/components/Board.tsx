import { type CellState, BOARD_SIZE } from '../types/game'

interface BoardProps {
  grid: CellState[][]
  onCellClick?: (x: number, y: number) => void
  onCellHover?: (x: number, y: number) => void
  onMouseLeave?: () => void
  highlightCells?: Set<string>
  highlightValid?: boolean
  disabled?: boolean
  hideShips?: boolean
  liarMode?: boolean
  label: string
}

// Czy to pole kłamie - deterministyczny hash, ~10% pól
function liesAbout(x: number, y: number): boolean {
  return (x * 13 + y * 7 + x * y * 3) % 10 === 0
}

function displayState(state: CellState, x: number, y: number, liarMode: boolean): CellState {
  if (!liarMode) return state
  if ((state === 'hit' || state === 'miss') && liesAbout(x, y)) {
    return state === 'hit' ? 'miss' : 'hit'
  }
  return state
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
  liarMode = false,
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
              const shown = displayState(cell, x, y, liarMode)
              const isLying = liarMode && (cell === 'hit' || cell === 'miss') && liesAbout(x, y)
              return (
                <div key={x} className="relative">
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
                        : cellColor(shown, hideShips),
                      disabled ? 'cursor-default' : 'cursor-pointer',
                    ].join(' ')}
                  />
                  {isLying && (
                    <span className="pointer-events-none absolute -right-1 -top-1 text-[8px] font-bold leading-none text-yellow-300">
                      ?
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
