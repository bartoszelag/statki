import { BOARD_SIZE, type Board, type Cell, type CellState, type Orientation, type Ship, type ShipConfig } from '../types/game'

export function createEmptyBoard(): Board {
  return {
    grid: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, (): CellState => 'empty'),
    ),
    ships: [],
  }
}

export function getShipCells(x: number, y: number, size: number, orientation: Orientation): Cell[] {
  return Array.from({ length: size }, (_, i) => ({
    x: orientation === 'horizontal' ? x + i : x,
    y: orientation === 'vertical' ? y + i : y,
  }))
}

export function isValidPlacement(board: Board, cells: Cell[]): boolean {
  for (const cell of cells) {
    if (cell.x < 0 || cell.x >= BOARD_SIZE || cell.y < 0 || cell.y >= BOARD_SIZE) return false
    if (board.grid[cell.y][cell.x] !== 'empty') return false

    // check surrounding cells (ships can't touch)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cell.x + dx
        const ny = cell.y + dy
        if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
          if (board.grid[ny][nx] === 'ship') return false
        }
      }
    }
  }
  return true
}

export function placeShip(board: Board, cells: Cell[], shipId: string): Board {
  const newGrid = board.grid.map((row) => [...row])
  for (const cell of cells) {
    newGrid[cell.y][cell.x] = 'ship'
  }
  const newShip: Ship = { id: shipId, cells, size: cells.length, isSunk: false }
  return { grid: newGrid, ships: [...board.ships, newShip] }
}

export function removeShip(board: Board, shipId: string): Board {
  const ship = board.ships.find((s) => s.id === shipId)
  if (!ship) return board
  const newGrid = board.grid.map((row) => [...row])
  for (const cell of ship.cells) {
    newGrid[cell.y][cell.x] = 'empty'
  }
  return { grid: newGrid, ships: board.ships.filter((s) => s.id !== shipId) }
}

export function applyMove(board: Board, x: number, y: number): { board: Board; isHit: boolean } {
  const newGrid = board.grid.map((row) => [...row])
  const cellHasShip = newGrid[y][x] === 'ship'
  newGrid[y][x] = cellHasShip ? 'hit' : 'miss'

  let newShips = board.ships
  if (cellHasShip) {
    newShips = board.ships.map((ship) => {
      const stillAlive = ship.cells.some(
        (c) => !(c.x === x && c.y === y) && newGrid[c.y][c.x] === 'ship',
      )
      if (!stillAlive && ship.cells.some((c) => c.x === x && c.y === y)) {
        // mark all cells of sunk ship
        for (const c of ship.cells) {
          newGrid[c.y][c.x] = 'sunk'
        }
        return { ...ship, isSunk: true }
      }
      return ship
    })
  }

  return { board: { grid: newGrid, ships: newShips }, isHit: cellHasShip }
}

export function allShipsSunk(board: Board): boolean {
  return board.ships.every((s) => s.isSunk)
}

export function canShoot(board: Board, x: number, y: number): boolean {
  const state = board.grid[y][x]
  return state === 'empty' || state === 'ship'
}

// Losowe rozmieszczenie wszystkich statków zgodnie z zasadami
export function randomPlacement(configs: ShipConfig[]): Board {
  const ORIENTATIONS: Orientation[] = ['horizontal', 'vertical']

  for (;;) {
    let board = createEmptyBoard()
    let ok = true

    for (const config of configs) {
      for (let n = 0; n < config.count; n++) {
        let placed = false
        for (let tries = 0; tries < 200; tries++) {
          const orientation = ORIENTATIONS[Math.floor(Math.random() * 2)]
          const x = Math.floor(Math.random() * BOARD_SIZE)
          const y = Math.floor(Math.random() * BOARD_SIZE)
          const cells = getShipCells(x, y, config.size, orientation)
          if (isValidPlacement(board, cells)) {
            board = placeShip(board, cells, crypto.randomUUID())
            placed = true
            break
          }
        }
        if (!placed) { ok = false; break }
      }
      if (!ok) break
    }

    if (ok) return board
  }
}
