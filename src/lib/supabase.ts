import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function getPlayerId(): string {
  let id = localStorage.getItem('statki_player_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('statki_player_id', id)
  }
  return id
}
