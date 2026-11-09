import { useEffect, useState } from 'react'
import { supabase, ORDER_STATUS_LABEL } from '../../lib/supabase'
import { Empty, ErrorBox, Loading, fmtDate, kz } from '../../components/ui'

interface Tanker { driver_id: string; driver_name: string; capacity_liters: number; distance_m: number }
type Coords = { lat: number; lng: number }

export function ClientHome() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [geoErr, setGeoErr] = useState<string | null>(null)
  const [tankers, setTankers] = useState<Tanker[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  function locate() {
    setGeoErr(null)
    if (!('geolocation' in navigator)) return setGeoErr('Este dispositivo não suporta localização. Poderá indicar a morada manualmente (fase 3).')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      p => { setLocating(false); setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      e => { setLocating(false); setGeoErr(e.code === 1 ? 'Permissão de localização negada. Active-a nas definições do browser ou indique a morada manualmente.' : 'Não foi possível obter a localização.') },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  useEffect(() => {
    if (!coords) return
    setTankers(null); setErr(null)
    supabase.rpc('nearby_tankers', { p_lat: coords.lat, p_lng: coords.lng }).then(({ data, error }) => {
      if (error) setErr('Não foi possível procurar cisternas.'); else setTankers(data as Tanker[])
    })
  }, [coords])

  return (
    <div>
      <h1>Pedir água</h1>
      <p className="muted" style={{ marginBottom: 20 }}>Indique onde está para ver as cisternas disponíveis perto de si.</p>

      <div className="card">
        <button className="btn block" onClick={locate} disabled={locating}>{locating ? 'A localizar…' : '📍 Usar a minha localização'}</button>
        <ErrorBox message={geoErr} />
        {coords && <p className="mono muted" style={{ fontSize: 12, marginTop: 12 }}>Localização obtida (±GPS do dispositivo)</p>}
      </div>

      {coords && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 10 }}>Cisternas disponíveis</h3>
          <ErrorBox message={err} />
          {!tankers && !err && <Loading />}
          {tankers && tankers.length === 0 && <Empty icon="🚛" title="Sem cisternas disponíveis">Não há motoristas disponíveis por perto neste momento. Tente mais tarde.</Empty>}
          {tankers?.map(t => (
            <div className="card" key={t.driver_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><b>{t.driver_name || 'Motorista'}</b><div className="muted" style={{ fontSize: 13 }}>{t.capacity_liters.toLocaleString('pt-PT')} L de capacidade</div></div>
              <span className="badge">{t.distance_m < 1000 ? `${t.distance_m} m` : `${(t.distance_m / 1000).toFixed(1)} km`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface OrderRow { id: string; created_at: string; status: string; liters: number; total_amount: number; currency: string; payment_method: string }

const PAY_LABEL: Record<string, string> = { cash: 'Dinheiro', bank_transfer: 'Transferência', in_app: 'Na aplicação' }

export function ClientOrders() {
  const [rows, setRows] = useState<OrderRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('orders').select('id, created_at, status, liters, total_amount, currency, payment_method').order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => { if (error) setErr('Não foi possível carregar os pedidos.'); else setRows(data as OrderRow[]) })
  }, [])
  if (err) return <ErrorBox message={err} />
  if (!rows) return <Loading />
  return (
    <div>
      <h1>Pedidos</h1>
      {rows.length === 0 ? <Empty icon="🧾" title="Ainda não fez pedidos">Quando pedir água, o histórico aparece aqui.</Empty> :
        rows.map(o => (
          <div className="card" key={o.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{o.liters.toLocaleString('pt-PT')} L</b><span className="badge">{ORDER_STATUS_LABEL[o.status]}</span></div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{fmtDate(o.created_at)} · {kz(o.total_amount, o.currency)} · {PAY_LABEL[o.payment_method]}</div>
          </div>
        ))}
    </div>
  )
}
