import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getPlayerId } from '../lib/supabase'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase()
}

function getNickname(): string {
  return sessionStorage.getItem('statki_nickname') ?? ''
}

export default function Lobby() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(getNickname)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdGame, setCreatedGame] = useState<{ id: string; code: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // nasłuchuj na dołączenie gracza 2 — auto-nawiguj gdy status zmieni się na 'placing'
  useEffect(() => {
    if (!createdGame) return
    const channel = supabase
      .channel(`lobby:${createdGame.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${createdGame.id}` },
        (payload) => {
          const updated = payload.new as Record<string, unknown>
          if (updated.status === 'placing') {
            navigate(`/game/${createdGame.id}`)
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [createdGame])

  function handleNicknameChange(value: string) {
    setNickname(value)
    sessionStorage.setItem('statki_nickname', value)
  }

  async function createGame() {
    if (!nickname.trim()) { setError('Wpisz pseudonim przed rozpoczęciem.'); return }
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
    setCreatedGame({ id: data.id, code: data.code })
  }

  async function copyCode() {
    if (!createdGame) return
    await navigator.clipboard.writeText(createdGame.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function joinGame() {
    if (!nickname.trim()) { setError('Wpisz pseudonim przed dołączeniem.'); return }
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
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4"
      style={{ background: 'linear-gradient(160deg, #020b18 0%, #071525 40%, #0a1a30 70%, #010810 100%)' }}
    >
      <div
        className="glow-card flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-white/10 px-8 py-10 backdrop-blur-md"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <h1 className="shimmer-text text-center text-2xl font-light tracking-[0.3em]">
          statki
        </h1>

        {/* pseudonim */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs tracking-widest text-white/30 uppercase">Pseudonim</label>
          <input
            value={nickname}
            onChange={(e) => handleNicknameChange(e.target.value)}
            placeholder="np. Kapitan Polska"
            maxLength={24}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-400/40 transition"
          />
        </div>

        <div className="h-px bg-white/5" />

        {/* stwórz grę */}
        <div className="flex flex-col gap-3">
          {!createdGame ? (
            <button
              onClick={createGame}
              disabled={loading}
              className="w-full rounded-xl border border-blue-400/30 bg-blue-500/20 py-3 text-sm tracking-widest text-blue-200 transition hover:bg-blue-500/30 disabled:opacity-50"
            >
              STWÓRZ GRĘ
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-center text-xs tracking-widest text-white/40 uppercase">Kod pokoju</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-xl border border-blue-400/30 bg-blue-500/10 py-3 text-center text-xl font-light tracking-[0.4em] text-blue-200">
                  {createdGame.code}
                </div>
                <button
                  onClick={copyCode}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/50 transition hover:bg-white/10"
                >
                  {copied ? '✓' : 'KOPIUJ'}
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-white/30">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400/60" />
                Czekam na gracza...
              </div>
              <button
                onClick={() => navigate(`/game/${createdGame.id}`)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs tracking-widest text-white/30 transition hover:text-white/50"
              >
                wejdź ręcznie →
              </button>
            </div>
          )}
        </div>

        <div className="h-px bg-white/5" />

        {/* dołącz do gry */}
        <div className="flex flex-col gap-2">
          <label className="text-xs tracking-widest text-white/30 uppercase">Dołącz do gry</label>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && joinGame()}
              placeholder="KOD POKOJU"
              maxLength={6}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm tracking-[0.3em] text-white placeholder-white/20 outline-none focus:border-blue-400/40 transition"
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
