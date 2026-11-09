import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ErrorBox, Field } from '../../components/ui'

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card fade-in">
        <Link to="/" className="auth-logo display grad" style={{ display: 'block' }}>MENA</Link>
        <p className="auth-sub">{sub}</p>
        <div className="card">
          <h2 style={{ marginBottom: 16, fontSize: 22 }}>{title}</h2>
          {children}
        </div>
      </div>
    </div>
  )
}

const friendly = (m: string) =>
  m.includes('Invalid login') ? 'E-mail ou palavra-passe incorrectos.'
  : m.includes('already registered') ? 'Já existe uma conta com este e-mail.'
  : m.includes('Email not confirmed') ? 'Confirme o seu e-mail antes de iniciar sessão.'
  : m.includes('Password should') ? 'A palavra-passe deve ter pelo menos 8 caracteres.'
  : m

export function Login() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setErr(friendly(error.message))
    nav(loc.state?.from ?? '/', { replace: true })   // PublicOnly/RequireRole encaminham para o ambiente certo
  }

  return (
    <Shell title="Iniciar sessão" sub="Água potável ao alcance de todos">
      <form onSubmit={submit}>
        <ErrorBox message={err} />
        <Field label="E-mail"><input className="input" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="Palavra-passe"><input className="input" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <button className="btn block" disabled={busy}>{busy ? 'A entrar…' : 'Entrar'}</button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14, textAlign: 'center' }}>
        <Link to="/recuperar">Esqueci-me da palavra-passe</Link><br /><br />
        <span className="muted">Ainda não tem conta? </span><Link to="/registo">Criar conta</Link>
      </p>
    </Shell>
  )
}

export function Register() {
  const [params] = useSearchParams()
  const [role, setRole] = useState<'client' | 'driver'>(params.get('motorista') ? 'driver' : 'client')
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null)
    if (f.password.length < 8) return setErr('A palavra-passe deve ter pelo menos 8 caracteres.')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { full_name: f.full_name.trim(), phone: f.phone.trim(), role } }
    })
    setBusy(false)
    if (error) return setErr(friendly(error.message))
    // Sem sessão = o projecto exige confirmação de e-mail
    setDone(!data.session)
  }

  if (done) return (
    <Shell title="Confirme o seu e-mail" sub="Quase pronto">
      <p className="muted" style={{ lineHeight: 1.6 }}>Enviámos uma ligação de confirmação para <b>{f.email}</b>. Abra-a e depois inicie sessão.</p>
      <Link className="btn block" style={{ marginTop: 16 }} to="/login">Ir para início de sessão</Link>
    </Shell>
  )

  return (
    <Shell title="Criar conta" sub="Peça água ou receba pedidos na sua zona">
      <div className="seg">
        <button type="button" className={role === 'client' ? 'on' : ''} onClick={() => setRole('client')}>💧 Sou cliente</button>
        <button type="button" className={role === 'driver' ? 'on' : ''} onClick={() => setRole('driver')}>🚛 Sou motorista</button>
      </div>
      {role === 'driver' && <p className="muted" style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>As contas de motorista passam por aprovação da administração antes de receberem pedidos. Depois de entrar, registe a sua cisterna.</p>}
      <form onSubmit={submit}>
        <ErrorBox message={err} />
        <Field label="Nome completo"><input className="input" required value={f.full_name} onChange={set('full_name')} /></Field>
        <Field label="Telefone"><input className="input" type="tel" required placeholder="+244 9XX XXX XXX" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="E-mail"><input className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Palavra-passe (mín. 8)"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <button className="btn block" disabled={busy}>{busy ? 'A criar…' : 'Criar conta'}</button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14, textAlign: 'center' }}><span className="muted">Já tem conta? </span><Link to="/login">Entrar</Link></p>
    </Shell>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null); const [sent, setSent] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/nova-palavra-passe` })
    setBusy(false)
    if (error) return setErr(error.message)
    setSent(true)
  }
  return (
    <Shell title="Recuperar palavra-passe" sub="Enviamos-lhe uma ligação por e-mail">
      {sent ? <div className="form-ok">Se existir uma conta com esse e-mail, receberá uma ligação para definir nova palavra-passe.</div> : (
        <form onSubmit={submit}>
          <ErrorBox message={err} />
          <Field label="E-mail"><input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <button className="btn block" disabled={busy}>{busy ? 'A enviar…' : 'Enviar ligação'}</button>
        </form>
      )}
      <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}><Link to="/login">Voltar</Link></p>
    </Shell>
  )
}

export function ResetPassword() {
  const nav = useNavigate()
  const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null)
    if (pw.length < 8) return setErr('A palavra-passe deve ter pelo menos 8 caracteres.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(friendly(error.message))
    nav('/', { replace: true })
  }
  return (
    <Shell title="Nova palavra-passe" sub="Defina a sua nova palavra-passe">
      <form onSubmit={submit}>
        <ErrorBox message={err} />
        <Field label="Nova palavra-passe"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <button className="btn block" disabled={busy}>{busy ? 'A guardar…' : 'Guardar'}</button>
      </form>
    </Shell>
  )
}
