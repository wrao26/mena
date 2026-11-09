import { useEffect, useState, type ReactNode } from 'react'

export function Loading({ full }: { full?: boolean }) {
  return <div className={full ? 'center-screen' : 'empty'}><div className="spinner" role="status" aria-label="A carregar" /></div>
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return <div className="empty fade-in"><div className="ico">{icon}</div><h3>{title}</h3><p>{children}</p></div>
}

export function ErrorBox({ message }: { message: string | null }) {
  return message ? <div className="form-error" role="alert">{message}</div> : null
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

/** Confirmação antes de operações importantes. */
export function useConfirm() {
  return (msg: string) => window.confirm(msg)
}

export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online ? null : <div className="offline" role="status">Sem ligação. Não é possível pedir ou actualizar pedidos até voltar a ficar online.</div>
}

export const kz = (n: number | null | undefined, currency = 'AOA') =>
  n == null ? '—' : new Intl.NumberFormat('pt-AO', { style: 'currency', currency }).format(n)

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
