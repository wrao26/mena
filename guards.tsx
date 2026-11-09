import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import type { Role } from '../lib/supabase'
import { isConfigured } from '../lib/supabase'
import { ConfigMissing } from '../components/ConfigMissing'
import { Loading } from '../components/ui'

export const homeFor = (role: Role) => role === 'admin' ? '/admin' : role === 'driver' ? '/driver' : '/app'

/** Protege um grupo de rotas por papel. A segurança real está no RLS do servidor; isto é só navegação. */
export function RequireRole({ role }: { role: Role }) {
  const { loading, session, profile } = useAuth()
  const loc = useLocation()
  if (!isConfigured) return <ConfigMissing />
  if (loading) return <Loading full />
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (!profile) return <Loading full />
  if (profile.role !== role) return <Navigate to={homeFor(profile.role)} replace />
  return <Outlet />
}

/** Rotas de autenticação: quem já tem sessão vai para o seu ambiente. */
export function PublicOnly() {
  const { loading, session, profile } = useAuth()
  if (!isConfigured) return <ConfigMissing />
  if (loading) return <Loading full />
  if (session && profile) return <Navigate to={homeFor(profile.role)} replace />
  return <Outlet />
}
