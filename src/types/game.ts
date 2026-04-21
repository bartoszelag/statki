export type GameStatus = 'waiting' | 'placing' | 'playing' | 'finished'

export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk'

export interface Cell {
  x: number
  y: number
}

export interface Ship {
  id: string
  cells: Cell[]
  size: number
  isSunk: boolean
}

export interface Board {
  grid: CellState[][]
  ships: Ship[]
}

export interface Game {
  id: string
  code: string
  player1Id: string
  player2Id: string | null
  status: GameStatus
  currentTurn: string | null
  winner: string | null
  player1Ready: boolean
  player2Ready: boolean
}

export interface Move {
  id: string
  gameId: string
  playerId: string
  x: number
  y: number
  isHit: boolean
  createdAt: string
}

export type Orientation = 'horizontal' | 'vertical'

export interface ShipConfig {
  size: number
  count: number
  label: string
}

export const SHIP_CONFIGS: ShipConfig[] = [
  { size: 4, count: 1, label: 'Pancernik' },
  { size: 3, count: 2, label: 'Krążownik' },
  { size: 2, count: 3, label: 'Niszczyciel' },
  { size: 1, count: 4, label: 'Łódź podwodna' },
]

export const BOARD_SIZE = 10
