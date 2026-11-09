export function ConfigMissing() {
  return (
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 520 }}>
        <h2 style={{ marginBottom: 8 }}>Configuração em falta</h2>
        <p className="muted" style={{ lineHeight: 1.6, marginBottom: 12 }}>
          A aplicação ainda não está ligada a um projecto Supabase. Sem isso não há contas, pedidos nem dados reais,
          e a MENA não mostra dados de demonstração.
        </p>
        <ol className="muted" style={{ lineHeight: 1.8, paddingLeft: 18, fontSize: 14 }}>
          <li>Crie um projecto em supabase.com.</li>
          <li>Execute os ficheiros de <code>supabase/migrations</code> por ordem no SQL Editor.</li>
          <li>Copie <code>.env.example</code> para <code>.env.local</code> e preencha URL e chave anon.</li>
          <li>Reinicie o servidor (<code>npm run dev</code>).</li>
        </ol>
      </div>
    </div>
  )
}
