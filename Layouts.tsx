import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { OfflineBanner } from './ui'

/** Contagem de notificações por ler (tempo real). */
function useUnread() {
  const { session } = useAuth()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    const load = async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('read_at', null)
      setN(count ?? 0)
    }
    load()
    const ch = supabase.channel(`notif-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session])
  return n
}

type Tab = { to: string; icon: string; label: string; end?: boolean }

function MobileShell({ tabs, label }: { tabs: Tab[]; label?: string }) {
  const unread = useUnread()
  return (
    <div className="app-shell">
      <OfflineBanner />
      <header className="app-top">
        <span className="logo">MENA</span>
        {label && <span className="badge">{label}</span>}
      </header>
      <main className="app-main fade-in"><Outlet /></main>
      <nav className="tabbar" aria-label="Navegação principal">
        <div className="tabbar-inner">
          {tabs.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
              <span className="ti">{t.icon}</span>
              <span>{t.label}{t.to.endsWith('notificacoes') && unread > 0 && <span className="dot">{unread}</span>}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export const ClientLayout = () => (
  <MobileShell tabs={[
    { to: '/app', icon: '💧', label: 'Pedir', end: true },
    { to: '/app/pedidos', icon: '🧾', label: 'Pedidos' },
    { to: '/app/notificacoes', icon: '🔔', label: 'Avisos' },
    { to: '/app/perfil', icon: '👤', label: 'Perfil' }
  ]} />
)

export const DriverLayout = () => (
  <MobileShell label="Motorista" tabs={[
    { to: '/driver', icon: '🚛', label: 'Hoje', end: true },
    { to: '/driver/servicos', icon: '📋', label: 'Serviços' },
    { to: '/driver/ganhos', icon: '💰', label: 'Ganhos' },
    { to: '/driver/notificacoes', icon: '🔔', label: 'Avisos' },
    { to: '/driver/perfil', icon: '👤', label: 'Perfil' }
  ]} />
)

export function AdminLayout() {
  const { signOut, profile } = useAuth()
  const items: [string, string, boolean?][] = [
    ['/admin', '📊 Resumo', true], ['/admin/pedidos', '🧾 Pedidos'], ['/admin/motoristas', '🚛 Motoristas'],
    ['/admin/clientes', '👥 Clientes'], ['/admin/pagamentos', '💳 Pagamentos'], ['/admin/tarifas', '💲 Tarifas'],
    ['/admin/zonas', '🗺️ Zonas'], ['/admin/reclamacoes', '⚠️ Reclamações']
  ]
  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <div className="logo grad">MENA</div>
        {items.map(([to, label, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}
        <div style={{ marginTop: 24, padding: '0 10px', fontSize: 12 }} className="muted">
          {profile?.full_name}<br />
          <button className="btn ghost small" style={{ marginTop: 8 }} onClick={signOut}>Terminar sessão</button>
        </div>
      </aside>
      <main className="admin-main fade-in"><OfflineBanner /><Outlet /></main>
    </div>
  )
}
