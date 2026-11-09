import { useEffect, useState } from 'react'
import { supabase, type DriverStatus } from '../../lib/supabase'
import { Empty, ErrorBox, Loading, fmtDate, kz } from '../../components/ui'

interface Stats { clients: number; drivers_total: number; drivers_pending: number; drivers_approved: number; orders_total: number; orders_active: number; orders_completed: number; orders_cancelled: number; liters_delivered: number; revenue_confirmed: number }

export function AdminHome() {
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { supabase.rpc('admin_stats').then(({ data, error }) => { if (error) setErr('Não foi possível carregar os indicadores.'); else setS(data as Stats) }) }, [])
  if (err) return <ErrorBox message={err} />
  if (!s) return <Loading />
  const items: [string, string | number][] = [
    ['Clientes registados', s.clients], ['Motoristas', s.drivers_total], ['Motoristas por aprovar', s.drivers_pending],
    ['Motoristas aprovados', s.drivers_approved], ['Pedidos (total)', s.orders_total], ['Pedidos em curso', s.orders_active],
    ['Pedidos concluídos', s.orders_completed], ['Pedidos cancelados', s.orders_cancelled],
    ['Litros entregues', s.liters_delivered.toLocaleString('pt-PT')], ['Pagamentos confirmados', kz(s.revenue_confirmed)]
  ]
  return (
    <div>
      <h1>Resumo</h1>
      <p className="muted">Dados reais da plataforma, calculados no servidor.</p>
      <div className="stat-grid">{items.map(([l, v]) => <div className="stat" key={l}><b>{v}</b><span>{l}</span></div>)}</div>
    </div>
  )
}

interface DriverRow { id: string; status: DriverStatus; is_available: boolean; created_at: string; profiles: { full_name: string; phone: string | null; email: string | null } | null; tankers: { plate: string; capacity_liters: number }[] }

const STATUS_LABEL: Record<DriverStatus, string> = { pending: 'Por aprovar', approved: 'Aprovado', suspended: 'Suspenso', rejected: 'Rejeitado' }
const STATUS_CLASS: Record<DriverStatus, string> = { pending: 'warn', approved: 'good', suspended: 'bad', rejected: 'bad' }

export function AdminDrivers() {
  const [rows, setRows] = useState<DriverRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('drivers')
      .select('id, status, is_available, created_at, profiles(full_name, phone, email), tankers(plate, capacity_liters)')
      .order('created_at', { ascending: false })
    if (error) setErr('Não foi possível carregar os motoristas.'); else setRows(data as unknown as DriverRow[])
  }
  useEffect(() => { load() }, [])

  async function setStatus(r: DriverRow, status: DriverStatus, verb: string) {
    if (!window.confirm(`${verb} ${r.profiles?.full_name || 'este motorista'}?`)) return
    setErr(null)
    const { error } = await supabase.rpc('admin_set_driver_status', { p_driver: r.id, p_status: status })
    if (error) setErr(error.message); else load()
  }

  if (!rows && !err) return <Loading />
  return (
    <div>
      <h1>Motoristas</h1>
      <ErrorBox message={err} />
      {rows && rows.length === 0 ? <Empty icon="🚛" title="Ainda não há motoristas registados" /> : rows && (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Nome</th><th>Contacto</th><th>Cisterna</th><th>Registo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.profiles?.full_name || '—'}</td>
                  <td>{r.profiles?.phone}<div className="muted" style={{ fontSize: 12 }}>{r.profiles?.email}</div></td>
                  <td>{r.tankers.length ? r.tankers.map(t => `${t.plate} · ${t.capacity_liters.toLocaleString('pt-PT')} L`).join(', ') : <span className="muted">Sem cisterna</span>}</td>
                  <td>{fmtDate(r.created_at)}</td>
                  <td><span className={`badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                    {r.status !== 'approved' && <button className="btn small" onClick={() => setStatus(r, 'approved', 'Aprovar')}>Aprovar</button>}
                    {r.status === 'approved' && <button className="btn danger small" onClick={() => setStatus(r, 'suspended', 'Suspender')}>Suspender</button>}
                    {r.status === 'pending' && <button className="btn danger small" onClick={() => setStatus(r, 'rejected', 'Rejeitar')}>Rejeitar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
