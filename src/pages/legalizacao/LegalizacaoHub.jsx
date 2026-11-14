import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Legalizacao from './Legalizacao'
import Aberturas from './Aberturas'

export default function LegalizacaoHub() {
  const [aba, setAba] = useState('processos')
  const [novas, setNovas] = useState(0)

  useEffect(() => {
    supabase.from('aberturas').select('id', { count: 'exact', head: true }).eq('status', 'novo').then(({ count }) => setNovas(count || 0))
  }, [])

  const tab = (k, label) => (
    <button onClick={() => setAba(k)} style={{
      padding: '9px 16px', borderRadius: 10, border: `1.5px solid ${aba === k ? '#C9960A' : '#e2e8f0'}`, cursor: 'pointer',
      background: aba === k ? '#fef9e7' : 'white', color: aba === k ? '#7a5a00' : '#475569', fontWeight: 700, fontSize: 13.5,
    }}>{label}</button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tab('processos', '⚖️ Processos')}
        {tab('aberturas', novas ? `📨 Solicitações de abertura (${novas})` : '📨 Solicitações de abertura')}
      </div>
      {aba === 'processos' ? <Legalizacao /> : <Aberturas onContar={setNovas} />}
    </div>
  )
}
