import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getPlayerId } from '../lib/supabase'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase()
}

export default function Lobby() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createGame() {
    setLoading(true)
    setError('')
    const playerId = getPlayerId()
    const code = generateCode()

    const { data, error: err } = await supabase
      .from('games')
      .insert({
        code,
        player1_id: playerId,
        status: 'waiting',
        player1_ready: false,
        player2_ready: false,
      })
      .select()
      .single()

    setLoading(false)
    if (err || !data) {
      setError(`Błąd: ${err?.message ?? 'brak danych'} (kod: ${err?.code ?? '?'})`)
      return
    }
    navigate(`/game/${data.id}`)
  }

  async function joinGame() {
    if (!joinCode.trim()) return
    setLoading(true)
    setError('')
    const playerId = getPlayerId()

    const { data: game, error: fetchErr } = await supabase
      .from('games')
      .select()
      .eq('code', joinCode.trim().toUpperCase())
      .single()

    if (fetchErr || !game) {
      setLoading(false)
      setError('Nie znaleziono gry o tym kodzie.')
      return
    }
    if (game.status !== 'waiting') {
      setLoading(false)
      setError('Ta gra już się rozpoczęła.')
      return
    }
    if (game.player1_id === playerId) {
      setLoading(false)
      navigate(`/game/${game.id}`)
      return
    }

    const { error: updateErr } = await supabase
      .from('games')
      .update({ player2_id: playerId, status: 'placing' })
      .eq('id', game.id)

    setLoading(false)
    if (updateErr) {
      setError('Błąd dołączania do gry.')
      return
    }
    navigate(`/game/${game.id}`)
  }

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #020b18 0%, #071525 40%, #0a1a30 70%, #010810 100%)' }}
    >
      <div
        className="glow-card flex flex-col items-center gap-8 rounded-2xl border border-white/10 px-12 py-10 backdrop-blur-md"
        style={{ background: 'rgba(255,255,255,0.04)', minWidth: 340 }}
      >
        <h1 className="shimmer-text text-2xl font-light tracking-[0.3em]">
          statki — multiplayer
        </h1>

        <div className="flex w-full flex-col gap-3">
          <button
            onClick={createGame}
            disabled={loading}
            className="w-full rounded-xl border border-blue-400/30 bg-blue-500/20 py-3 text-sm tracking-widest text-blue-200 transition hover:bg-blue-500/30 disabled:opacity-50"
          >
            NOWA GRA
          </button>

          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinGame()}
              placeholder="KOD GRY"
              maxLength={6}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm tracking-[0.3em] text-white placeholder-white/20 outline-none focus:border-blue-400/50"
            />
            <button
              onClick={joinGame}
              disabled={loading || !joinCode.trim()}
              className="rounded-xl border border-white/10 bg-white/5 px-5 text-sm tracking-widest text-white/60 transition hover:bg-white/10 disabled:opacity-40"
            >
              DOŁĄCZ
            </button>
          </div>
        </div>

        {error && (
          <p className="text-center text-xs text-red-400/80">{error}</p>
        )}
      </div>
    </div>
  )
}
