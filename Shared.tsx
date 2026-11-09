import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { Empty, ErrorBox, Field, Loading, fmtDate } from '../components/ui'

export function Placeholder({ title, phase, children }: { title: string; phase: string; children?: React.ReactNode }) {
  return (
    <div>
      <h1>{title}</h1>
      <Empty icon="🛠️" title={`Em construção (${phase})`}>{children ?? 'Esta área será implementada na fase indicada.'}</Empty>
    </div>
  )
}

export function Profile() {
  const { profile, session, refresh, signOut } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault(); setErr(null); setOk(false); setBusy(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() }).eq('id', session!.user.id)
    setBusy(false)
    if (error) return setErr('Não foi possível guardar. Tente novamente.')
    await refresh(); setOk(true)
  }

  return (
    <div>
      <h1>Perfil</h1>
      <p className="muted" style={{ marginBottom: 20 }}>{profile?.email}</p>
      <form className="card" onSubmit={save}>
        <ErrorBox message={err} />
        {ok && <div className="form-ok">Dados guardados.</div>}
        <Field label="Nome"><input className="input" required value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Telefone"><input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
        <button className="btn block" disabled={busy}>{busy ? 'A guardar…' : 'Guardar'}</button>
      </form>
      <button className="btn danger block" style={{ marginTop: 16 }} onClick={() => { if (window.confirm('Terminar sessão?')) signOut() }}>Terminar sessão</button>
    </div>
  )
}

interface Notif { id: string; title: string; body: string | null; created_at: string; read_at: string | null }

export function Notifications() {
  const { session } = useAuth()
  const [items, setItems] = useState<Notif[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('notifications').select('id, title, body, created_at, read_at').order('created_at', { ascending: false }).limit(50)
    if (error) setErr('Não foi possível carregar as notificações.'); else setItems(data as Notif[])
  }
  useEffect(() => { load() }, [])

  async function markAll() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', session!.user.id).is('read_at', null)
    load()
  }

  if (err) return <ErrorBox message={err} />
  if (!items) return <Loading />
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Notificações</h1>
        {items.some(n => !n.read_at) && <button className="btn ghost small" onClick={markAll}>Marcar lidas</button>}
      </div>
      {items.length === 0 ? <Empty icon="🔔" title="Sem notificações">Os avisos sobre os seus pedidos aparecem aqui.</Empty> :
        items.map(n => (
          <div className="card" key={n.id} style={{ opacity: n.read_at ? .6 : 1 }}>
            <b>{n.title}</b>{n.body && <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{n.body}</p>}
            <div className="mono muted" style={{ fontSize: 11, marginTop: 8 }}>{fmtDate(n.created_at)}</div>
          </div>
        ))}
    </div>
  )
}
