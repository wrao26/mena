import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { homeFor } from '../auth/guards'

// Landing pública. Sem estatísticas, testemunhos, ganhos ou parceiros fictícios:
// só entram aqui números e depoimentos reais quando existirem na plataforma.
export default function Landing() {
  const { session, profile } = useAuth()
  const enter = session && profile ? homeFor(profile.role) : '/login'
  return (
    <div style={{ background: 'radial-gradient(700px 500px at 85% -10%, rgba(10,132,255,.28), transparent 70%), var(--navy)' }}>
      <div className="lp">
        <header className="lp-nav">
          <span className="display grad" style={{ fontSize: 26, fontWeight: 700 }}>MENA</span>
          <Link className="btn small ghost" to={enter}>{session ? 'Abrir a app' : 'Entrar'}</Link>
        </header>

        <section className="lp-hero">
          <div>
            <span className="badge" style={{ marginBottom: 20 }}>Angola</span>
            <h1>Peça água<br /><span className="grad">em minutos.</span></h1>
            <p>Ligamos quem precisa de água potável a motoristas de cisterna perto de si. Indique onde está, escolha a quantidade e acompanhe o pedido.</p>
            <div className="lp-btns">
              <Link className="btn" to="/registo">💧 Pedir água</Link>
              <Link className="btn ghost" to="/registo?motorista=1">🚛 Sou motorista de cisterna</Link>
            </div>
          </div>
          <div className="card" aria-hidden>
            <div className="mono muted" style={{ fontSize: 11, marginBottom: 10 }}>COMO FUNCIONA O ACOMPANHAMENTO</div>
            {['Pedido enviado', 'Pedido aceite', 'Motorista a caminho', 'Motorista chegou', 'Abastecimento concluído'].map((s, i) => (
              <div key={s} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,.06)' : 0 }}>
                <span className="badge">{i + 1}</span><span>{s}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-steps">
          {[
            ['📍', 'Indique a localização', 'Use o GPS ou escreva a morada onde quer receber a água.'],
            ['💧', 'Escolha a quantidade', 'Veja o preço antes de confirmar. As tarifas são definidas pela plataforma.'],
            ['🚛', 'Um motorista aceita', 'Os motoristas da sua zona recebem o pedido e um deles aceita.'],
            ['🏠', 'Receba em casa', 'Acompanhe o estado até ao fim do abastecimento.']
          ].map(([i, t, d]) => <div className="card" key={t}><div style={{ fontSize: 26 }}>{i}</div><h3>{t}</h3><p>{d}</p></div>)}
        </section>

        <footer className="lp-foot">
          <span>© {new Date().getFullYear()} MENA Angola</span>
          <span>
            <a href="https://instagram.com/mena.agua" target="_blank" rel="noreferrer">@mena.agua</a>
            {' · '}Feito por <a href="https://instagram.com/websitesrapidos.ao" target="_blank" rel="noreferrer">WRAO</a>
          </span>
        </footer>
      </div>
    </div>
  )
}
