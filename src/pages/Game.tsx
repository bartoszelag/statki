import { useEffect, useRef, useState } from 'react'
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
  randomPlacement,
} from '../lib/gameLogic'
import Board from '../components/Board'
import ShipPanel from '../components/ShipPanel'
import WeatherOverlay, { computeWeather } from '../components/WeatherOverlay'
import Chat from '../components/Chat'
import { SHIP_CONFIGS, type Game, type Cell } from '../types/game'

export default function Game() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const playerId = getPlayerId()

  const {
    game, setGame,
    myBoard, setMyBoard,
    opponentBoard, setOpponentBoard,
    placingOrientation, setPlacingOrientation, setSelectedShipSize, selectedShipSize,
    reset,
  } = useGameStore()

  const [hoverCells, setHoverCells] = useState<Set<string>>(new Set())
  const [hoverValid, setHoverValid] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [shipsPlaced, setShipsPlaced] = useState<Record<number, number>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [hitShake, setHitShake] = useState(false)
  const [explosionAt, setExplosionAt] = useState<{ x: number; y: number } | null>(null)
  const [timeLeft, setTimeLeft] = useState(30)

  type AmmoType = 'normal' | 'napalm' | 'nuke'
  const [selectedAmmo, setSelectedAmmo] = useState<AmmoType>('normal')
  const [ammoNapalm, setAmmoNapalm] = useState(3)
  const [ammoNuke, setAmmoNuke] = useState(1)
  const [shootHover, setShootHover] = useState<Set<string>>(new Set())

  // czas rozpoczęcia fazy playing
  const gameStartedAt = useRef<number | null>(null)
  // śledzenie zatopionych statków przeciwnika żeby wykryć nowe zatopienia
  const prevOppSunk = useRef<Set<string>>(new Set())
  const oppSunksInitialized = useRef(false)

  const isPlayer1 = game?.player1Id === playerId
  const isMyTurn = game?.status === 'playing' && game.currentTurn === playerId
  const amIReady = game ? (isPlayer1 ? game.player1Ready : game.player2Ready) : false

  // liczba moich strzałów i strzałów przeciwnika — podstawa pogody
  const myShots = opponentBoard.grid.flat().filter((c) => c !== 'empty' && c !== 'ship').length
  const opponentShots = myBoard.grid.flat().filter((c) => c !== 'empty' && c !== 'ship').length
  const totalShots = myShots + opponentShots
  const weatherState =
    game?.status === 'playing' || game?.status === 'finished'
      ? computeWeather(totalShots)
      : 'calm'

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // rejestruj czas startu gry
  useEffect(() => {
    if (game?.status === 'playing' && gameStartedAt.current === null) {
      gameStartedAt.current = Date.now()
    }
  }, [game?.status])

  // reset timera przy zmianie tury
  useEffect(() => {
    if (game?.status === 'playing') setTimeLeft(30)
  }, [game?.currentTurn])

  // odliczanie sekundy po sekundzie
  useEffect(() => {
    if (game?.status !== 'playing' || timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, game?.status])

  // automatyczna zmiana tury gdy czas minął — tylko aktywny gracz wykonuje
  useEffect(() => {
    if (!isMyTurn || game?.status !== 'playing' || timeLeft !== 0) return
    const nextTurn = isPlayer1 ? game!.player2Id : game!.player1Id
    supabase.from('games').update({ current_turn: nextTurn }).eq('id', id)
  }, [timeLeft])

  // ładuj statki przeciwnika gdy gra przechodzi na 'playing' (wcześniej mogło ich nie być)
  useEffect(() => {
    if (game?.status !== 'playing' || !game.player2Id) return
    const opponentId = game.player1Id === playerId ? game.player2Id : game.player1Id
    setOpponentBoard((prev) => {
      if (prev.ships.length > 0) return prev // już załadowane
      // załaduj asynchronicznie
      supabase
        .from('ships')
        .select()
        .eq('game_id', id)
        .eq('player_id', opponentId)
        .then(({ data }) => {
          if (!data?.length) return
          let b = createEmptyBoard()
          for (const s of data) b = placeShip(b, s.cells as Cell[], s.id)
          oppSunksInitialized.current = false // reset żeby nie pokazać fałszywego toastu
          setOpponentBoard(b)
        })
      return prev
    })
  }, [game?.status])

  // wykrywaj nowe zatopienia statków przeciwnika
  useEffect(() => {
    if (!oppSunksInitialized.current) {
      oppSunksInitialized.current = true
      prevOppSunk.current = new Set(opponentBoard.ships.filter((s) => s.isSunk).map((s) => s.id))
      return
    }
    const newlySunk = opponentBoard.ships.filter(
      (s) => s.isSunk && !prevOppSunk.current.has(s.id),
    )
    if (newlySunk.length > 0) showToast('Zatopiony! 💥')
    prevOppSunk.current = new Set(opponentBoard.ships.filter((s) => s.isSunk).map((s) => s.id))
  }, [opponentBoard])

  // klawisz R obraca statek
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'r' || e.key === 'R') {
        setPlacingOrientation(placingOrientation === 'horizontal' ? 'vertical' : 'horizontal')
        setHoverCells(new Set())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [placingOrientation])

  // inicjalizacja i subskrypcje Realtime
  useEffect(() => {
    if (!id) return
    loadGameAndBoards()

    const gameSub = supabase
      .channel(`game:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${id}` },
        async (payload) => {
          const g = payload.new as Record<string, unknown>
          setGame(rowToGame(g))

          // player1 przełącza na 'playing' gdy obaj gotowi
          if (
            g.status === 'placing' &&
            g.player1_ready === true &&
            g.player2_ready === true &&
            g.player1_id === playerId
          ) {
            await supabase
              .from('games')
              .update({ status: 'playing', current_turn: g.player1_id })
              .eq('id', id)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'moves', filter: `game_id=eq.${id}` },
        (payload) => {
          const move = payload.new as Record<string, unknown>
          // aplikuj tylko ruchy przeciwnika — własne są już aplikowane lokalnie w handleShoot
          if (move.player_id !== playerId) {
            setMyBoard((prev) => applyMove(prev, move.x as number, move.y as number).board)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(gameSub)
      reset()
    }
  }, [id])

  async function loadGameAndBoards() {
    const { data } = await supabase.from('games').select().eq('id', id).single()
    if (!data) { navigate('/'); return }
    const g = rowToGame(data)
    setGame(g)

    const opponentId = g.player1Id === playerId ? g.player2Id : g.player1Id

    // ładuj moje statki
    const { data: myShips } = await supabase
      .from('ships').select().eq('game_id', id).eq('player_id', playerId)

    let myB = createEmptyBoard()
    const placed: Record<number, number> = {}
    for (const s of myShips ?? []) {
      myB = placeShip(myB, s.cells as Cell[], s.id)
      placed[s.size] = (placed[s.size] ?? 0) + 1
    }
    setMyBoard(myB)
    setShipsPlaced(placed)

    // ładuj statki przeciwnika (potrzebne do wykrywania zatopionych, ukryte wizualnie)
    let oppB = createEmptyBoard()
    if (opponentId) {
      const { data: oppShips } = await supabase
        .from('ships').select().eq('game_id', id).eq('player_id', opponentId)
      for (const s of oppShips ?? []) {
        oppB = placeShip(oppB, s.cells as Cell[], s.id)
      }
    }
    setOpponentBoard(oppB)

    // zastosuj istniejące ruchy
    const { data: moves } = await supabase.from('moves').select().eq('game_id', id).order('created_at')
    if (moves?.length) {
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
    setMyBoard(placeShip(myBoard, cells, shipId))

    const newPlaced = { ...shipsPlaced, [selectedShipSize]: alreadyPlaced + 1 }
    setShipsPlaced(newPlaced)

    await supabase.from('ships').insert({ id: shipId, game_id: id, player_id: playerId, cells, size: selectedShipSize })

    if (SHIP_CONFIGS.every((c) => (newPlaced[c.size] ?? 0) >= c.count)) {
      setSelectedShipSize(null)
    }
  }

  async function handleRandomize() {
    const newBoard = randomPlacement(SHIP_CONFIGS)

    // usuń istniejące statki z DB i wstaw nowe
    await supabase.from('ships').delete().eq('game_id', id).eq('player_id', playerId)
    for (const ship of newBoard.ships) {
      await supabase.from('ships').insert({
        id: ship.id,
        game_id: id,
        player_id: playerId,
        cells: ship.cells,
        size: ship.size,
      })
    }

    setMyBoard(newBoard)
    const placed: Record<number, number> = {}
    for (const ship of newBoard.ships) {
      placed[ship.size] = (placed[ship.size] ?? 0) + 1
    }
    setShipsPlaced(placed)
    setSelectedShipSize(null)
  }

  async function handleReady() {
    if (!game) return
    const field = isPlayer1 ? 'player1_ready' : 'player2_ready'
    await supabase.from('games').update({ [field]: true }).eq('id', id)
  }

  function getAmmoCells(x: number, y: number, ammo: 'normal' | 'napalm' | 'nuke'): Cell[] {
    if (ammo === 'napalm') return [{ x: x - 1, y }, { x, y }, { x: x + 1, y }, { x: x + 2, y }]
    if (ammo === 'nuke')   return [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }]
    return [{ x, y }]
  }

  function handleShootHover(x: number, y: number) {
    if (!isMyTurn) return
    const cells = getAmmoCells(x, y, selectedAmmo)
      .filter((c) => c.x >= 0 && c.x < 10 && c.y >= 0 && c.y < 10)
    setShootHover(new Set(cells.map((c) => `${c.x},${c.y}`)))
  }

  async function handleShoot(x: number, y: number) {
    if (!isMyTurn) return

    // sprawdź limit amunicji
    if (selectedAmmo === 'napalm' && ammoNapalm <= 0) return
    if (selectedAmmo === 'nuke'   && ammoNuke   <= 0) return

    // wyznacz pola do trafienia — w granicach planszy, jeszcze nie strzelane
    const targets = getAmmoCells(x, y, selectedAmmo).filter(
      (c) => c.x >= 0 && c.x < 10 && c.y >= 0 && c.y < 10 && canShoot(opponentBoard, c.x, c.y),
    )
    if (targets.length === 0) return

    // zużyj amunicję
    if (selectedAmmo === 'napalm') setAmmoNapalm((n) => n - 1)
    if (selectedAmmo === 'nuke')   setAmmoNuke((n) => n - 1)
    setSelectedAmmo('normal')
    setShootHover(new Set())

    // aplikuj wszystkie trafienia lokalnie
    let board = opponentBoard
    let anyHit = false
    let firstHit: Cell | null = null
    for (const c of targets) {
      const result = applyMove(board, c.x, c.y)
      board = result.board
      if (result.isHit && !firstHit) { firstHit = c; anyHit = true }
    }
    setOpponentBoard(board)

    // efekty przy trafieniu
    if (anyHit && firstHit) {
      setExplosionAt(firstHit)
      setHitShake(true)
      setTimeout(() => { setExplosionAt(null); setHitShake(false) }, 550)
    }

    // zapisz ruchy do bazy (każde pole osobno)
    for (const c of targets) {
      const isHit = board.grid[c.y][c.x] === 'hit' || board.grid[c.y][c.x] === 'sunk' ||
        opponentBoard.grid[c.y][c.x] === 'ship'
      await supabase.from('moves').insert({ game_id: id, player_id: playerId, x: c.x, y: c.y, is_hit: isHit })
    }

    const allSunk = board.ships.length > 0 && board.ships.every((s) => s.isSunk)
    if (allSunk) {
      await supabase.from('games').update({ status: 'finished', winner: playerId }).eq('id', id)
    } else {
      const nextTurn = isPlayer1 ? game!.player2Id : game!.player1Id
      await supabase.from('games').update({ current_turn: nextTurn }).eq('id', id)
    }
  }

  useEffect(() => {
    if (!game) return
    if (game.status === 'waiting') setStatusMsg(`Kod gry: ${game.code} — czekaj na przeciwnika`)
    else if (game.status === 'placing') setStatusMsg(amIReady ? 'Czekasz na przeciwnika...' : 'Rozmieść swoje statki')
    else if (game.status === 'playing') setStatusMsg(isMyTurn ? 'Twoja tura — strzelaj!' : 'Tura przeciwnika...')
    else if (game.status === 'finished') setStatusMsg('')
  }, [game, isMyTurn, amIReady])

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#020b18' }}>
        <p className="text-white/40 tracking-widest text-sm">Ładowanie...</p>
      </div>
    )
  }

  const isPlacing = game.status === 'placing' || game.status === 'waiting'
  const isFinished = game.status === 'finished'
  const iWon = game.winner === playerId

  const weatherBg: Record<string, string> = {
    calm:      'linear-gradient(160deg, #020b18 0%, #071525 40%, #0a1a30 70%, #010810 100%)',
    storm:     'linear-gradient(160deg, #020d10 0%, #051520 40%, #071825 70%, #020b0e 100%)',
    hurricane: 'linear-gradient(160deg, #030408 0%, #07080f 40%, #0a0b14 70%, #020308 100%)',
    tornado:   'linear-gradient(160deg, #0d0a04 0%, #1a1205 40%, #100d04 70%, #070502 100%)',
    blizzard:  'linear-gradient(160deg, #060c18 0%, #0c1428 40%, #0a1020 70%, #04080f 100%)',
  }

  // czas trwania gry
  const durationSec = gameStartedAt.current ? Math.floor((Date.now() - gameStartedAt.current) / 1000) : 0
  const durationStr = `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`

  return (
    <div
      className={[
        'relative flex min-h-screen w-full flex-col items-center justify-center gap-6 overflow-hidden px-4 py-8',
        weatherState === 'hurricane' ? 'weather-hurricane' : '',
        weatherState === 'tornado'   ? 'weather-tornado'   : '',
        weatherState === 'blizzard'  ? 'weather-blizzard'  : '',
        hitShake ? 'hit-shake' : '',
      ].join(' ')}
      style={{ background: weatherBg[weatherState] }}
    >
      <WeatherOverlay state={weatherState} />

      {/* toast */}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-xl border border-white/10 bg-black/70 px-6 py-3 text-sm tracking-widest text-white backdrop-blur-md">
          {toast}
        </div>
      )}

      {/* ekran końcowy */}
      {isFinished && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="glow-card flex flex-col items-center gap-6 rounded-2xl border border-white/10 px-14 py-12 backdrop-blur-md"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <h2
              className={[
                'text-4xl font-light tracking-widest',
                iWon ? 'text-green-400' : 'text-red-400',
              ].join(' ')}
            >
              {iWon ? 'WYGRAŁEŚ!' : 'PRZEGRAŁEŚ'}
            </h2>

            <div className="flex gap-8 text-sm text-white/40">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl text-white">{myShots}</span>
                <span className="text-xs tracking-widest uppercase">strzałów</span>
              </div>
              <div className="w-px bg-white/10" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl text-white">{durationStr}</span>
                <span className="text-xs tracking-widest uppercase">czas gry</span>
              </div>
            </div>

            <button
              onClick={() => { reset(); navigate('/') }}
              className="mt-2 w-full rounded-xl border border-blue-400/30 bg-blue-500/20 py-3 text-sm tracking-widest text-blue-200 transition hover:bg-blue-500/30"
            >
              NOWA GRA
            </button>
          </div>
        </div>
      )}

      {/* header */}
      <div className="relative z-10 flex items-center gap-6">
        <span className="shimmer-text text-xl font-light tracking-[0.25em]">statki</span>
        <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-widest text-white/50">
          {game.code}
        </span>
      </div>

      {/* status + timer */}
      {game.status === 'playing' && (
        <div className="relative z-10 flex items-center gap-4">
          {statusMsg && (
            <p className={['text-sm tracking-wider', isMyTurn ? 'text-blue-300' : 'text-white/50'].join(' ')}>
              {statusMsg}
            </p>
          )}
          <TurnTimer timeLeft={timeLeft} isMyTurn={isMyTurn} />
        </div>
      )}
      {game.status !== 'playing' && statusMsg && (
        <p className="relative z-10 text-sm tracking-wider text-white/50">{statusMsg}</p>
      )}

      {/* panel amunicji */}
      {game.status === 'playing' && !isFinished && (
        <div className="relative z-10 flex gap-2">
          {(
            [
              { type: 'normal' as const, icon: '🎯', label: 'Normalna', count: null },
              { type: 'napalm' as const, icon: '🔥', label: 'Napalm',   count: ammoNapalm },
              { type: 'nuke'   as const, icon: '☢️', label: 'Nuke',     count: ammoNuke },
            ] as const
          ).map(({ type, icon, label, count }) => {
            const outOfAmmo = count !== null && count <= 0
            const isSelected = selectedAmmo === type
            return (
              <button
                key={type}
                onClick={() => setSelectedAmmo(outOfAmmo ? 'normal' : type)}
                disabled={outOfAmmo || !isMyTurn}
                className={[
                  'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-xs transition',
                  isSelected
                    ? 'border-yellow-400/50 bg-yellow-500/20 text-yellow-200'
                    : outOfAmmo
                      ? 'border-white/5 bg-white/3 text-white/20 cursor-not-allowed'
                      : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10',
                ].join(' ')}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="tracking-wider">{label}</span>
                {count !== null && (
                  <span className={outOfAmmo ? 'text-white/20' : 'text-white/40'}>×{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* boards */}
      <div className="relative z-10 flex flex-wrap items-start justify-center gap-8">
        {isPlacing && !amIReady && <ShipPanel shipsPlaced={shipsPlaced} onRandomize={handleRandomize} />}

        <div className="flex flex-col items-center gap-3">
          <Board
            grid={myBoard.grid}
            disabled={!isPlacing || amIReady}
            label="Twoja plansza"
            onCellClick={isPlacing && !amIReady ? handlePlaceClick : undefined}
            onCellHover={isPlacing && !amIReady ? handlePlaceHover : undefined}
            onMouseLeave={() => setHoverCells(new Set())}
            highlightCells={isPlacing && !amIReady ? hoverCells : undefined}
            highlightValid={hoverValid}
          />
          {isPlacing && !amIReady && (() => {
            const allPlaced = SHIP_CONFIGS.every((c) => (shipsPlaced[c.size] ?? 0) >= c.count)
            return (
              <button
                onClick={handleReady}
                disabled={!allPlaced}
                className={[
                  'mt-1 w-full rounded-xl border px-6 py-3 text-sm tracking-widest transition',
                  allPlaced
                    ? 'border-green-400/50 bg-green-500/20 text-green-300 hover:bg-green-500/30 cursor-pointer'
                    : 'border-white/5 bg-white/5 text-white/20 cursor-not-allowed',
                ].join(' ')}
              >
                GOTOWY
              </button>
            )
          })()}
        </div>

        {(game.status === 'playing' || isFinished) && (
          <Board
            grid={opponentBoard.grid}
            onCellClick={isMyTurn ? handleShoot : undefined}
            onCellHover={isMyTurn ? handleShootHover : undefined}
            onMouseLeave={() => setShootHover(new Set())}
            highlightCells={isMyTurn ? shootHover : undefined}
            highlightValid
            disabled={!isMyTurn}
            hideShips
            explosionAt={explosionAt}
            label="Przeciwnik"
          />
        )}

        {/* czat widoczny podczas gry */}
        {(game.status === 'playing' || isFinished) && game.player2Id && (
          <Chat gameId={id!} playerId={playerId} />
        )}
      </div>

      <button
        onClick={() => navigate('/')}
        className="relative z-10 mt-4 text-xs tracking-widest text-white/20 transition hover:text-white/50"
      >
        ← lobby
      </button>
    </div>
  )
}

const TIMER_MAX = 30
const R = 20
const CIRCUMFERENCE = 2 * Math.PI * R

function TurnTimer({ timeLeft, isMyTurn }: { timeLeft: number; isMyTurn: boolean }) {
  const offset = CIRCUMFERENCE - (timeLeft / TIMER_MAX) * CIRCUMFERENCE
  const color = timeLeft > 10 ? '#60a5fa' : timeLeft > 5 ? '#fb923c' : '#f87171'
  return (
    <svg width="54" height="54" viewBox="0 0 54 54">
      <circle cx="27" cy="27" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <circle
        cx="27" cy="27" r={R}
        fill="none"
        stroke={isMyTurn ? color : 'rgba(255,255,255,0.2)'}
        strokeWidth="3"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 27 27)"
        style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
      />
      <text
        x="27" y="32"
        textAnchor="middle"
        fontSize="13"
        fontFamily="monospace"
        fill={isMyTurn ? color : 'rgba(255,255,255,0.3)'}
      >
        {timeLeft}
      </text>
    </svg>
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
