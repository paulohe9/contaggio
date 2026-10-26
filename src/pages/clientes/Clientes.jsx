import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader, Btn, Badge, Table, EmptyState, StatCard, Modal } from '../../components/ui'
import { UserPlus, Search, RefreshCw } from 'lucide-react'

const tributacaoLabel = { simples_nacional_comercio: 'SN Comércio', simples_nacional_servico: 'SN Serviço', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', mei: 'MEI' }
const tributacaoCor = { simples_nacional_comercio: 'blue', simples_nacional_servico: 'cyan', lucro_presumido: 'purple', lucro_real: 'orange', mei: 'green' }
const statusCor = { ativo: 'green', inativo: 'slate', suspenso: 'red' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTrib, setFiltroTrib] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('ativo')
  const [soAlertas, setSoAlertas] = useState(false)
  const [revisao, setRevisao] = useState(null) // cliente com alterações na Receita
  const [conferindo, setConferindo] = useState('')

  // ─── Conferência de CNPJ na Receita (nada é alterado sem você mandar) ───
  const comAlerta = clientes.filter(c => c.status === 'ativo' && c.cnpj_alertas?.length)
  const ultimaConferencia = clientes.map(c => c.cnpj_verificado_em).filter(Boolean).sort().pop()

  async function conferirAgora(clientId) {
    setConferindo(clientId ? 'Consultando a Receita...' : 'Conferindo todos os clientes na Receita, pode levar até 2 minutos...')
    const { data, error } = await supabase.functions.invoke('verificar-cnpj', { body: clientId ? { client_id: clientId } : { todos: true } })
    if (error || !data?.ok) setConferindo('Não foi possível conferir agora: ' + (data?.error || error?.message || 'erro'))
    else setConferindo(clientId ? '' : `✅ ${data.conferidos} conferido(s), ${data.com_alteracao} com alteração${data.restantes ? ` · faltam ${data.restantes}, clique de novo` : ''}${data.erros?.length ? ` · ${data.erros.length} erro(s)` : ''}`)
    const { data: atual } = await supabase.from('clients').select('*').order('razao_social')
    setClientes(atual || [])
    if (clientId) setRevisao((atual || []).find(c => c.id === clientId) || null)
  }

  async function resolverAlerta(c, alerta, aplicar) {
    const restantes = (c.cnpj_alertas || []).filter(a => a.campo !== alerta.campo)
    const base = { ...(c.cnpj_snapshot || {}), ignorar: { ...(c.cnpj_snapshot?.ignorar || {}) } }
    const upd = { cnpj_alertas: restantes.length ? restantes : null }
    if (aplicar) upd[alerta.campo] = alerta.receita
    else if (['razao_social', 'nome_fantasia', 'endereco', 'situacao', 'regime'].includes(alerta.campo)) base.ignorar[alerta.campo] = alerta.receita
    else base[alerta.campo] = alerta.receita
    upd.cnpj_snapshot = base
    const { error } = await supabase.from('clients').update(upd).eq('id', c.id)
    if (error) { alert('Erro: ' + error.message); return }
    const novo = { ...c, ...upd }
    setClientes(cs => cs.map(x => x.id === c.id ? novo : x))
    setRevisao(restantes.length ? novo : null)
  }

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
      && (!soAlertas || c.cnpj_alertas?.length)
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

      {/* Conferência semanal na Receita */}
      <div style={{ background: comAlerta.length ? '#fffbeb' : 'white', border: `1px solid ${comAlerta.length ? '#fde68a' : '#e2e8f0'}`, borderRadius: 14, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 22 }}>{comAlerta.length ? '⚠️' : '🛡️'}</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13.5 }}>
            {comAlerta.length ? `${comAlerta.length} cliente(s) com alteração na Receita Federal` : 'Cadastros conferidos com a Receita Federal'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Conferência automática toda segunda. Nada é alterado sem você confirmar.{ultimaConferencia ? ` Última: ${new Date(ultimaConferencia).toLocaleString('pt-BR')}.` : ' Ainda não houve conferência.'}
            {conferindo && <span style={{ color: '#2563eb', fontWeight: 600 }}> {conferindo}</span>}
          </div>
        </div>
        {comAlerta.length > 0 && <Btn size="sm" variant={soAlertas ? 'primary' : 'secondary'} onClick={() => { setSoAlertas(v => !v); setFiltroStatus('ativo') }}>{soAlertas ? 'Mostrar todos' : 'Ver só os alterados'}</Btn>}
        <Btn size="sm" variant="secondary" onClick={() => conferirAgora()}><RefreshCw size={13} /> Conferir agora</Btn>
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
          <option value="simples_nacional_comercio">SN Comércio</option>
          <option value="simples_nacional_servico">SN Serviço</option>
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
                  {c.cnpj_alertas?.length > 0 && (
                    <button onClick={() => setRevisao(c)} style={{ marginTop: 4, border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      ⚠ {c.cnpj_alertas.length} alteração(ões) na Receita — revisar
                    </button>
                  )}
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

      {/* Revisão das alterações na Receita */}
      <Modal open={!!revisao} onClose={() => setRevisao(null)} title="Alterações encontradas na Receita Federal" size="xl">
        {revisao && (
          <div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
              <b>{revisao.razao_social}</b> · CNPJ {revisao.cnpj}
              {revisao.cnpj_verificado_em && <span style={{ color: '#94a3b8' }}> · conferido em {new Date(revisao.cnpj_verificado_em).toLocaleString('pt-BR')}</span>}
            </div>
            {(revisao.cnpj_alertas || []).map(a => (
              <div key={a.campo} style={{ border: `1px solid ${a.grave ? '#fecaca' : '#e2e8f0'}`, background: a.grave ? '#fef2f2' : 'white', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: a.grave ? '#b91c1c' : '#1e293b', fontSize: 13, marginBottom: 6 }}>{a.grave ? '🚨 ' : ''}{a.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
                  <div><div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>{a.aplicavel ? 'No sistema' : 'Antes'}</div><div style={{ color: '#475569' }}>{a.sistema || '—'}</div></div>
                  <div><div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Na Receita</div><div style={{ color: '#0f172a', fontWeight: 600 }}>{a.receita || '—'}</div></div>
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                  {a.aplicavel && <Btn size="sm" onClick={() => resolverAlerta(revisao, a, true)}>Atualizar cadastro</Btn>}
                  <Btn size="sm" variant="secondary" onClick={() => resolverAlerta(revisao, a, false)}>{a.aplicavel ? 'Manter como está' : 'Ciente'}</Btn>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <Btn size="sm" variant="ghost" onClick={() => conferirAgora(revisao.id)}><RefreshCw size={13} /> Consultar de novo</Btn>
              <Link to={`/clientes/${revisao.id}/editar`}><Btn size="sm" variant="secondary">Abrir cadastro</Btn></Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
