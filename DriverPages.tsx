import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { Empty, ErrorBox, Loading } from '../../components/ui'

export function DriverHome() {
  const { driverStatus, session } = useAuth()
  const [available, setAvailable] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const watch = useRef<number | null>(null)

  useEffect(() => {
    supabase.from('drivers').select('is_available').eq('id', session!.user.id).maybeSingle()
      .then(({ data }) => { setAvailable(Boolean(data?.is_available)); setLoaded(true) })
  }, [session])

  // Enquanto "disponível", envia a posição real do dispositivo (só com a app aberta — limite das PWAs).
  useEffect(() => {
    if (!available || !('geolocation' in navigator)) return
    let last = 0
    watch.current = navigator.geolocation.watchPosition(
      p => {
        if (Date.now() - last < 15000) return
        last = Date.now()
        supabase.rpc('update_driver_location', { p_lat: p.coords.latitude, p_lng: p.coords.longitude })
      },
      () => setErr('Sem permissão de localização: não receberá pedidos sem partilhar a posição.'),
      { enableHighAccuracy: true }
    )
    return () => { if (watch.current != null) navigator.geolocation.clearWatch(watch.current) }
  }, [available])

  async function toggle() {
    setErr(null)
    const next = !available
    const { error } = await supabase.rpc('set_driver_available', { p_available: next })
    if (error) return setErr(error.message)
    setAvailable(next)
  }

  if (!loaded) return <Loading />

  if (driverStatus !== 'approved') {
    const msg = driverStatus === 'pending' ? ['⏳', 'Conta em análise', 'A administração está a validar o seu registo. Só depois da aprovação poderá receber pedidos.']
      : driverStatus === 'suspended' ? ['⛔', 'Conta suspensa', 'Contacte o suporte para mais informações.']
      : ['❌', 'Registo rejeitado', 'Contacte o suporte para mais informações.']
    return <div><h1>Hoje</h1><Empty icon={msg[0]} title={msg[1]}>{msg[2]}</Empty></div>
  }

  return (
    <div>
      <h1>Hoje</h1>
      <ErrorBox message={err} />
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><b>{available ? 'Disponível' : 'Indisponível'}</b><div className="muted" style={{ fontSize: 13 }}>{available ? 'A receber pedidos na sua zona' : 'Não recebe pedidos'}</div></div>
          <button className={available ? 'btn danger small' : 'btn small'} onClick={toggle}>{available ? 'Ficar offline' : 'Ficar disponível'}</button>
        </div>
      </div>
      <Empty icon="📭" title="Sem pedidos">Os pedidos próximos de si aparecem aqui (fase 3).</Empty>
    </div>
  )
}
