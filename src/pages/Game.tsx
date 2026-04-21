import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getPlayerId } from '../lib/supabase'
import { useGameStore } from '../store/gameStore'
import {
  getShipCells,
  isValidPlacement,
  placeShip,
  applyMove,
  canShoot,
  createEmptyBoard,
} from '../lib/gameLogic'
import Board from '../components/Board'
import ShipPanel from '../components/ShipPanel'
import { SHIP_CONFIGS, type Game, type Cell } from '../types/game'

export default function Game() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const playerId = getPlayerId()

  const {
    game, setGame,
    myBoard, setMyBoard,
    opponentBoard, setOpponentBoard,
    placingOrientation, setSelectedShipSize, selectedShipSize,
    reset,
  } = useGameStore()

  const [hoverCells, setHoverCells] = useState<Set<string>>(new Set())
  const [hoverValid, setHoverValid] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [shipsPlaced, setShipsPlaced] = useState<Record<number, number>>({})

  const isPlayer1 = game?.player1Id === playerId
  const isMyTurn = game?.status === 'playing' && game.currentTurn === playerId
  const amIReady = game ? (isPlayer1 ? game.player1Ready : game.player2Ready) : false

  // load game and subscribe to realtime
  useEffect(() => {
    if (!id) return
    loadGame()
    loadBoards()

    const gameSub = supabase
      .channel(`game:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${id}` },
        (payload) => {
          const g = payload.new as Record<string, unknown>
          setGame(rowToGame(g))
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moves', filter: `game_id=eq.${id}` },
        (payload) => {
          const move = payload.new as Record<string, unknown>
          const isOpponentMove = move.player_id !== playerId
          if (isOpponentMove) {
            setMyBoard((prev) => applyMove(prev, move.x as number, move.y as number).board)
          } else {
            setOpponentBoard((prev) => applyMove(prev, move.x as number, move.y as number).board)
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(gameSub); reset() }
  }, [id])

  async function loadGame() {
    const { data } = await supabase.from('games').select().eq('id', id).single()
    if (!data) { navigate('/'); return }
    setGame(rowToGame(data))
  }

  async function loadBoards() {
    // load my ships
    const { data: myShips } = await supabase.from('ships').select().eq('game_id', id).eq('player_id', playerId)
    if (myShips?.length) {
      let board = createEmptyBoard()
      const placed: Record<number, number> = {}
      for (const s of myShips) {
        board = placeShip(board, s.cells as Cell[], s.id)
        placed[s.size] = (placed[s.size] ?? 0) + 1
      }
      setMyBoard(board)
      setShipsPlaced(placed)
    }

    // load moves and apply on top of ship boards
    const { data: moves } = await supabase.from('moves').select().eq('game_id', id)
    if (moves?.length) {
      // rebuild from fresh so we don't use stale closure state
      setMyBoard((prev) => {
        let b = prev
        for (const m of moves) {
          if (m.player_id !== playerId) b = applyMove(b, m.x, m.y).board
        }
        return b
      })
      setOpponentBoard((prev) => {
        let b = prev
        for (const m of moves) {
          if (m.player_id === playerId) b = applyMove(b, m.x, m.y).board
        }
        return b
      })
    }
  }

  // ship placement hover
  function handlePlaceHover(x: number, y: number) {
    if (!selectedShipSize) return
    const cells = getShipCells(x, y, selectedShipSize, placingOrientation)
    const valid = isValidPlacement(myBoard, cells)
    setHoverCells(new Set(cells.map((c) => `${c.x},${c.y}`)))
    setHoverValid(valid)
  }

  async function handlePlaceClick(x: number, y: number) {
    if (!selectedShipSize || !game) return
    const cells = getShipCells(x, y, selectedShipSize, placingOrientation)
    if (!isValidPlacement(myBoard, cells)) return

    const config = SHIP_CONFIGS.find((c) => c.size === selectedShipSize)!
    const alreadyPlaced = shipsPlaced[selectedShipSize] ?? 0
    if (alreadyPlaced >= config.count) return

    const shipId = crypto.randomUUID()
    const newBoard = placeShip(myBoard, cells, shipId)
    setMyBoard(newBoard)

    const newPlaced = { ...shipsPlaced, [selectedShipSize]: alreadyPlaced + 1 }
    setShipsPlaced(newPlaced)

    await supabase.from('ships').insert({ id: shipId, game_id: id, player_id: playerId, cells, size: selectedShipSize })

    // check if all ships placed
    const allPlaced = SHIP_CONFIGS.every((c) => (newPlaced[c.size] ?? 0) >= c.count)
    if (allPlaced) {
      setSelectedShipSize(null)
      const field = isPlayer1 ? 'player1_ready' : 'player2_ready'
      await supabase.from('games').update({ [field]: true }).eq('id', id)
    }
  }

  async function handleShoot(x: number, y: number) {
    if (!isMyTurn || !canShoot(opponentBoard, x, y)) return

    const { isHit, board: newOppBoard } = applyMove(opponentBoard, x, y)
    setOpponentBoard(newOppBoard)

    await supabase.from('moves').insert({ game_id: id, player_id: playerId, x, y, is_hit: isHit })

    const nextTurn = isPlayer1 ? game!.player2Id : game!.player1Id
    const allSunk = newOppBoard.ships.every((s) => s.isSunk) && newOppBoard.ships.length > 0
    if (allSunk) {
      await supabase.from('games').update({ status: 'finished', winner: playerId }).eq('id', id)
    } else {
      await supabase.from('games').update({ current_turn: nextTurn }).eq('id', id)
    }
  }

  // status message
  useEffect(() => {
    if (!game) return
    if (game.status === 'waiting') {
      setStatusMsg(`Kod gry: ${game.code} — czekaj na przeciwnika`)
    } else if (game.status === 'placing') {
      setStatusMsg(amIReady ? 'Czekasz na przeciwnika...' : 'Rozmieść swoje statki')
    } else if (game.status === 'playing') {
      setStatusMsg(isMyTurn ? 'Twoja tura — strzelaj!' : 'Tura przeciwnika...')
    } else if (game.status === 'finished') {
      setStatusMsg(game.winner === playerId ? 'Wygrałeś!' : 'Przegrałeś.')
    }
  }, [game, isMyTurn, amIReady])

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#020b18' }}>
        <p className="text-white/40 tracking-widest text-sm">Ładowanie...</p>
      </div>
    )
  }

  const isPlacing = game.status === 'placing' || game.status === 'waiting'

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center gap-6 overflow-hidden px-4 py-8"
      style={{ background: 'linear-gradient(160deg, #020b18 0%, #071525 40%, #0a1a30 70%, #010810 100%)' }}
    >
      {/* header */}
      <div className="flex items-center gap-6">
        <span className="shimmer-text text-xl font-light tracking-[0.25em]">statki</span>
        <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-widest text-white/50">
          {game.code}
        </span>
      </div>

      {/* status */}
      <p className={[
        'text-sm tracking-wider',
        game.status === 'finished'
          ? game.winner === playerId ? 'text-green-400' : 'text-red-400'
          : isMyTurn ? 'text-blue-300' : 'text-white/50',
      ].join(' ')}>
        {statusMsg}
      </p>

      {/* boards */}
      <div className="flex flex-wrap items-start justify-center gap-10">
        {/* my board */}
        <div className="flex flex-col items-center gap-3">
          <Board
            grid={myBoard.grid}
            disabled
            label="Twoja plansza"
            onCellClick={isPlacing && !amIReady ? handlePlaceClick : undefined}
            onCellHover={isPlacing && !amIReady ? handlePlaceHover : undefined}
            onMouseLeave={() => setHoverCells(new Set())}
            highlightCells={isPlacing && !amIReady ? hoverCells : undefined}
            highlightValid={hoverValid}
          />
          {isPlacing && !amIReady && (
            <ShipPanel shipsPlaced={shipsPlaced} />
          )}
        </div>

        {/* opponent board */}
        {(game.status === 'playing' || game.status === 'finished') && (
          <Board
            grid={opponentBoard.grid}
            onCellClick={isMyTurn ? handleShoot : undefined}
            disabled={!isMyTurn}
            hideShips
            label="Przeciwnik"
          />
        )}
      </div>

      <button
        onClick={() => navigate('/')}
        className="mt-4 text-xs tracking-widest text-white/20 hover:text-white/50 transition"
      >
        ← lobby
      </button>
    </div>
  )
}

function rowToGame(row: Record<string, unknown>): Game {
  return {
    id: row.id as string,
    code: row.code as string,
    player1Id: row.player1_id as string,
    player2Id: row.player2_id as string | null,
    status: row.status as Game['status'],
    currentTurn: row.current_turn as string | null,
    winner: row.winner as string | null,
    player1Ready: row.player1_ready as boolean,
    player2Ready: row.player2_ready as boolean,
  }
}
