import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader, Btn, Badge, Table, EmptyState, StatCard } from '../../components/ui'
import { UserPlus, Search } from 'lucide-react'

const tributacaoLabel = { simples_nacional: 'Simples Nacional', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', mei: 'MEI' }
const tributacaoCor = { simples_nacional: 'blue', lucro_presumido: 'purple', lucro_real: 'orange', mei: 'green' }
const statusCor = { ativo: 'green', inativo: 'slate', suspenso: 'red' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTrib, setFiltroTrib] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('ativo')

  useEffect(() => { fetchClientes() }, [])

  async function fetchClientes() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('razao_social')
    setClientes(data || [])
    setLoading(false)
  }

  const filtrados = clientes.filter(c => {
    const q = busca.toLowerCase()
    return (!busca || c.razao_social.toLowerCase().includes(q) || c.cnpj.includes(q) || (c.nome_fantasia || '').toLowerCase().includes(q))
      && (!filtroTrib || c.tributacao === filtroTrib)
      && (!filtroStatus || c.status === filtroStatus)
  })

  return (
    <div style={{ maxWidth: 1200 }}>
      <PageHeader
        title="Clientes"
        subtitle={`${filtrados.length} de ${clientes.length} clientes`}
        actions={
          <Link to="/clientes/novo">
            <Btn><UserPlus size={15} /> Novo Cliente</Btn>
          </Link>
        }
      />

      {/* Indicadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total" value={clientes.length} icon="🏢" color="#64748b" bg="#f8fafc" border="#e2e8f0" />
        <StatCard label="Ativos" value={clientes.filter(c => c.status === 'ativo').length} icon="✅" color="#10b981" bg="#f0fdf4" border="#bbf7d0" />
        <StatCard label="Inativos" value={clientes.filter(c => c.status !== 'ativo').length} icon="⏸️" color="#94a3b8" bg="#f8fafc" border="#e2e8f0" />
      </div>

      {/* Filtros */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, CNPJ..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>
        <select value={filtroTrib} onChange={e => setFiltroTrib(e.target.value)}
          style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: 'white', cursor: 'pointer', outline: 'none' }}>
          <option value="">Todos os regimes</option>
          <option value="simples_nacional">Simples Nacional</option>
          <option value="lucro_presumido">Lucro Presumido</option>
          <option value="lucro_real">Lucro Real</option>
          <option value="mei">MEI</option>
        </select>
        {/* Status como toggle pills */}
        <div style={{ display: 'flex', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {[['', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos'], ['suspenso', 'Suspensos']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltroStatus(v)}
              style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                background: filtroStatus === v ? '#2563eb' : 'transparent',
                color: filtroStatus === v ? 'white' : '#64748b',
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <Table headers={['Empresa', 'CNPJ', 'Regime', 'Status', 'Entrada', '']} loading={loading}>
        {filtrados.length === 0 ? (
          <tr><td colSpan={6}>
            <EmptyState icon="👥" title="Nenhum cliente encontrado" description="Ajuste os filtros ou cadastre um novo cliente."
              action={<Link to="/clientes/novo"><Btn><UserPlus size={14} /> Cadastrar Cliente</Btn></Link>}
            />
          </td></tr>
        ) : filtrados.map(c => (
          <tr key={c.id}
            style={{ borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
            <td style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {c.razao_social.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{c.razao_social}</div>
                  {c.nome_fantasia && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{c.nome_fantasia}</div>}
                </div>
              </div>
            </td>
            <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{c.cnpj}</td>
            <td style={{ padding: '14px 18px' }}>
              {c.tributacao ? <Badge color={tributacaoCor[c.tributacao]}>{tributacaoLabel[c.tributacao]}</Badge> : <span style={{ color: '#cbd5e1' }}>—</span>}
            </td>
            <td style={{ padding: '14px 18px' }}><Badge color={statusCor[c.status]}>{c.status}</Badge></td>
            <td style={{ padding: '14px 18px', color: '#94a3b8', fontSize: 12 }}>
              {c.data_entrada ? new Date(c.data_entrada).toLocaleDateString('pt-BR') : '—'}
            </td>
            <td style={{ padding: '14px 18px' }}>
              <Link to={`/clientes/${c.id}`}>
                <Btn variant="ghost" size="sm">Ver →</Btn>
              </Link>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
