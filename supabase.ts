import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true quando o projecto Supabase está configurado (.env.local). */
export const isConfigured = Boolean(url && anon)

// Sem configuração, o cliente nunca é usado: a app mostra o ecrã "Configuração em falta".
export const supabase = createClient(url ?? 'http://localhost:0', anon ?? 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})

export type Role = 'client' | 'driver' | 'admin'
export type DriverStatus = 'pending' | 'approved' | 'suspended' | 'rejected'

export interface Profile {
  id: string
  role: Role
  full_name: string
  phone: string | null
  email: string | null
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  sent: 'Pedido enviado',
  awaiting: 'À espera de aceitação',
  accepted: 'Pedido aceite',
  on_the_way: 'Motorista a caminho',
  arrived: 'Motorista chegou',
  in_progress: 'Abastecimento em curso',
  completed: 'Abastecimento concluído',
  cancelled: 'Pedido cancelado'
}
