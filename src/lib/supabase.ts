import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Brak zmiennych środowiskowych VITE_SUPABASE_URL lub VITE_SUPABASE_ANON_KEY. ' +
    'Dodaj je w ustawieniach projektu Vercel i zrób redeploy.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function getPlayerId(): string {
  let id = localStorage.getItem('statki_player_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('statki_player_id', id)
  }
  return id
}
