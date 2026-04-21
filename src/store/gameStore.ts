import { create } from 'zustand'
import type { Board, Game, Orientation } from '../types/game'
import { createEmptyBoard } from '../lib/gameLogic'

interface GameStore {
  game: Game | null
  myBoard: Board
  opponentBoard: Board
  playerId: string | null
  placingOrientation: Orientation
  selectedShipSize: number | null

  setGame: (game: Game | null) => void
  setMyBoard: (board: Board | ((prev: Board) => Board)) => void
  setOpponentBoard: (board: Board | ((prev: Board) => Board)) => void
  setPlayerId: (id: string) => void
  setPlacingOrientation: (o: Orientation) => void
  setSelectedShipSize: (size: number | null) => void
  reset: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  game: null,
  myBoard: createEmptyBoard(),
  opponentBoard: createEmptyBoard(),
  playerId: null,
  placingOrientation: 'horizontal',
  selectedShipSize: null,

  setGame: (game) => set({ game }),
  setMyBoard: (myBoard) => set((s) => ({ myBoard: typeof myBoard === 'function' ? myBoard(s.myBoard) : myBoard })),
  setOpponentBoard: (opponentBoard) => set((s) => ({ opponentBoard: typeof opponentBoard === 'function' ? opponentBoard(s.opponentBoard) : opponentBoard })),
  setPlayerId: (playerId) => set({ playerId }),
  setPlacingOrientation: (placingOrientation) => set({ placingOrientation }),
  setSelectedShipSize: (selectedShipSize) => set({ selectedShipSize }),
  reset: () =>
    set({
      game: null,
      myBoard: createEmptyBoard(),
      opponentBoard: createEmptyBoard(),
      selectedShipSize: null,
      placingOrientation: 'horizontal',
    }),
}))
