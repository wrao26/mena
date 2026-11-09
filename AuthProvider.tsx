import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured, type Profile, type DriverStatus } from '../lib/supabase'

interface AuthState {
  loading: boolean
  session: Session | null
  profile: Profile | null
  driverStatus: DriverStatus | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState>({
  loading: true, session: null, profile: null, driverStatus: null,
  refresh: async () => {}, signOut: async () => {}
})

export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [driverStatus, setDriverStatus] = useState<DriverStatus | null>(null)

  // O papel vem SEMPRE da base de dados (RLS), nunca de dados editáveis no browser.
  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setDriverStatus(null); return }
    const { data: p } = await supabase.from('profiles').select('id, role, full_name, phone, email').eq('id', s.user.id).maybeSingle()
    setProfile((p as Profile) ?? null)
    if (p?.role === 'driver') {
      const { data: d } = await supabase.from('drivers').select('status').eq('id', s.user.id).maybeSingle()
      setDriverStatus((d?.status as DriverStatus) ?? null)
    } else setDriverStatus(null)
  }, [])

  useEffect(() => {
    if (!isConfigured) return
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await load(data.session)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      // adiar para fora do callback para evitar deadlocks do cliente Supabase
      setTimeout(() => { load(s) }, 0)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [load])

  const value: AuthState = {
    loading, session, profile, driverStatus,
    refresh: async () => load(session),
    signOut: async () => { await supabase.auth.signOut() }
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
