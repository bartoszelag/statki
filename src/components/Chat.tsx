import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  playerId: string
  nickname: string
  content: string
  createdAt: string
}

interface ChatProps {
  gameId: string
  playerId: string
}

export default function Chat({ gameId, playerId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const nickname = sessionStorage.getItem('statki_nickname') || 'Gracz'

  useEffect(() => {
    // załaduj istniejące wiadomości
    supabase
      .from('messages')
      .select()
      .eq('game_id', gameId)
      .order('created_at')
      .then(({ data }) => {
        if (data) setMessages(data.map(rowToMessage))
      })

    // subskrybuj nowe wiadomości w czasie rzeczywistym
    const channel = supabase
      .channel(`chat:${gameId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `game_id=eq.${gameId}` },
        (payload) => {
          setMessages((prev) => [...prev, rowToMessage(payload.new as Record<string, unknown>)])
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  // przewijaj na dół przy nowych wiadomościach
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const content = input.trim()
    if (!content) return
    setInput('')
    await supabase.from('messages').insert({ game_id: gameId, player_id: playerId, nickname, content })
  }

  return (
    <div
      className="flex w-64 flex-col rounded-2xl border border-white/10 backdrop-blur-md"
      style={{ background: 'rgba(255,255,255,0.04)', height: 380 }}
    >
      <div className="border-b border-white/10 px-4 py-2.5">
        <span className="text-xs tracking-widest text-white/30 uppercase">Czat</span>
      </div>

      {/* lista wiadomości */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-xs text-white/20 mt-4">Brak wiadomości</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.playerId === playerId
          return (
            <div key={msg.id} className={['flex flex-col', isMine ? 'items-end' : 'items-start'].join(' ')}>
              <span className="mb-0.5 text-[10px] text-white/30">{msg.nickname}</span>
              <div
                className={[
                  'max-w-[85%] rounded-xl px-3 py-1.5 text-xs leading-relaxed',
                  isMine
                    ? 'bg-blue-500/25 text-blue-100 rounded-tr-sm'
                    : 'bg-white/8 text-white/80 rounded-tl-sm',
                ].join(' ')}
                style={isMine ? {} : { background: 'rgba(255,255,255,0.08)' }}
              >
                {msg.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="flex gap-2 border-t border-white/10 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Wiadomość..."
          maxLength={120}
          className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:bg-white/10 transition"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/30 disabled:opacity-30"
        >
          ↑
        </button>
      </div>
    </div>
  )
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    nickname: row.nickname as string,
    content: row.content as string,
    createdAt: row.created_at as string,
  }
}
