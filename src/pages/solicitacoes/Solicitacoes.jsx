import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Btn, Modal, Input, Select, Textarea, StatCard } from '../../components/ui'
import { Plus, Pencil } from 'lucide-react'
import { hojeISO, fmtData, diasDesde, inputBase } from '../../lib/util'

const COLUNAS = [
  { key: 'aberta', label: 'Aberta', cor: '#f59e0b' },
  { key: 'em_andamento', label: 'Em andamento', cor: '#3b82f6' },
  { key: 'concluida', label: 'Concluída', cor: '#10b981' },
  { key: 'cancelada', label: 'Cancelada', cor: '#94a3b8' },
]
const formVazio = { client_id: '', title: '', description: '', status: 'aberta', prazo: '' }

export default function Solicitacoes() {
  const { profile } = useAuth()
  const [solicitacoes, setSolicitacoes] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [busca, setBusca] = useState('')
  const [somenteAtrasadas, setSomenteAtrasadas] = useState(false)
  const [mostrarTodasConcluidas, setMostrarTodasConcluidas] = useState(false)
  const [modal, setModal] = useState(null)         // { id?, form }
  const [detalhe, setDetalhe] = useState(null)     // solicitação aberta em modo leitura
  const [finalizar, setFinalizar] = useState(null) // { sol, obs }
  const [saving, setSaving] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [sRes, cRes] = await Promise.all([
      supabase.from('client_requests').select('*, clients(id, razao_social)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
    ])
    setSolicitacoes(sRes.data || [])
    setClientes(cRes.data || [])
    setLoading(false)
  }

  const hoje = hojeISO()
  const atrasada = (s) => s.prazo && s.prazo < hoje && !['concluida', 'cancelada'].includes(s.status)

  const filtradas = useMemo(() => solicitacoes.filter(s => {
    if (filtroCliente && s.client_id !== filtroCliente) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (!`${s.title} ${s.description || ''} ${s.clients?.razao_social || ''}`.toLowerCase().includes(q)) return false
    }
    if (somenteAtrasadas && !atrasada(s)) return false
    return true
  }), [solicitacoes, filtroCliente, busca, somenteAtrasadas])

  function itensDaColuna(key) {
    let itens = filtradas.filter(s => s.status === key)
    if (key === 'aberta' || key === 'em_andamento') {
      itens = [...itens].sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'))
    }
    if ((key === 'concluida' || key === 'cancelada') && !mostrarTodasConcluidas) {
      itens = itens.filter(s => diasDesde(s.concluida_em || s.updated_at || s.created_at) <= 30)
    }
    return itens
  }

  // ─── Ações ───
  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const f = modal.form
    const payload = { client_id: f.client_id, title: f.title, description: f.description || null, prazo: f.prazo || null }
    let error
    if (modal.id) {
      ;({ error } = await supabase.from('client_requests').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', modal.id))
    } else {
      ;({ error } = await supabase.from('client_requests').insert({ ...payload, status: f.status, author: profile?.name || 'Sistema' }))
      if (!error && f.client_id) {
        await supabase.from('client_observations').insert({ client_id: f.client_id, text: `Solicitação registrada: ${f.title}`, author: profile?.name || 'Sistema' })
      }
    }
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setModal(null)
    fetchTudo()
  }

  async function mover(sol, status) {
    if (sol.status === status) return
    if (status === 'concluida') { setFinalizar({ sol, obs: '' }); return }
    const upd = { status, updated_at: new Date().toISOString() }
    if (sol.status === 'concluida') upd.concluida_em = null // reabriu
    setSolicitacoes(ss => ss.map(s => s.id === sol.id ? { ...s, ...upd } : s))
    const { error } = await supabase.from('client_requests').update(upd).eq('id', sol.id)
    if (error) { alert('Erro: ' + error.message); fetchTudo() }
  }

  async function confirmarFinalizacao(e) {
    e.preventDefault(); setSaving(true)
    const { sol, obs } = finalizar
    const agora = new Date().toISOString()
    const upd = { status: 'concluida', observacoes_conclusao: obs.trim() || null, concluida_em: agora, updated_at: agora }
    const { error } = await supabase.from('client_requests').update(upd).eq('id', sol.id)
    if (error) { setSaving(false); alert('Erro: ' + error.message + '\n\nVerifique se o SQL de melhorias foi executado no Supabase.'); return }
    if (sol.client_id) {
      await supabase.from('client_observations').insert({
        client_id: sol.client_id,
        text: `Solicitação concluída: ${sol.title}${obs.trim() ? ` — ${obs.trim()}` : ''}`,
        author: profile?.name || 'Sistema',
      })
    }
    setSolicitacoes(ss => ss.map(s => s.id === sol.id ? { ...s, ...upd } : s))
    setSaving(false); setFinalizar(null); setDetalhe(null)
  }

  const total = solicitacoes.length
  const conta = (st) => solicitacoes.filter(s => s.status === st).length
  const atrasadasQtd = solicitacoes.filter(atrasada).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title="Solicitações"
        subtitle="Arraste os cartões entre as colunas para atualizar o andamento"
        actions={<Btn onClick={() => setModal({ form: { ...formVazio } })}><Plus size={14} /> Nova Solicitação</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard label="Total" value={total} icon="📝" bg="#f8fafc" border="#e2e8f0" />
        <StatCard label="Abertas" value={conta('aberta')} icon="🟡" bg="#fffbeb" border="#fde68a" />
        <StatCard label="Em andamento" value={conta('em_andamento')} icon="🔵" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Concluídas" value={conta('concluida')} icon="✅" bg="#f0fdf4" border="#bbf7d0" />
        <StatCard label="Atrasadas" value={atrasadasQtd} icon="⏰" bg={atrasadasQtd ? '#fef2f2' : '#f8fafc'} border={atrasadasQtd ? '#fecaca' : '#e2e8f0'} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar título, descrição, cliente..." style={{ ...inputBase, flex: 1, minWidth: 220 }} />
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ ...inputBase, minWidth: 200 }}>
          <option value="">Todos os clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
          <input type="checkbox" checked={somenteAtrasadas} onChange={e => setSomenteAtrasadas(e.target.checked)} style={{ accentColor: '#ef4444' }} /> Só atrasadas
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
          <input type="checkbox" checked={mostrarTodasConcluidas} onChange={e => setMostrarTodasConcluidas(e.target.checked)} /> Mostrar concluídas antigas
        </label>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Carregando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(240px, 1fr))', gap: 12, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 12 }}>
          {COLUNAS.map(col => {
            const itens = itensDaColuna(col.key)
            const over = dragOver === col.key
            return (
              <div key={col.key}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
                onDragLeave={() => setDragOver(d => d === col.key ? null : d)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(null)
                  const sol = solicitacoes.find(s => s.id === dragId)
                  if (sol) mover(sol, col.key)
                  setDragId(null)
                }}
                style={{ background: over ? '#eef2ff' : '#eef1f5', borderRadius: 14, padding: 10, border: over ? '2px dashed #6366f1' : '2px solid transparent', minHeight: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 10px' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.cor }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', flex: 1 }}>{col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: 'white', borderRadius: 10, padding: '1px 8px' }}>{itens.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itens.map(s => {
                    const atr = atrasada(s)
                    return (
                      <div key={s.id} draggable
                        onDragStart={() => setDragId(s.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null) }}
                        onClick={() => setDetalhe(s)}
                        style={{
                          background: 'white', borderRadius: 10, padding: '10px 12px', cursor: 'grab',
                          border: `1px solid ${atr ? '#fca5a5' : '#e2e8f0'}`, borderLeft: `4px solid ${atr ? '#ef4444' : col.cor}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', opacity: dragId === s.id ? 0.5 : 1,
                        }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', lineHeight: 1.35 }}>{s.title}</div>
                        {s.clients && <div style={{ fontSize: 11.5, color: '#3b82f6', fontWeight: 600, marginTop: 3 }}>🏢 {s.clients.razao_social}</div>}
                        {s.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.description}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                          <span>{s.author}</span>
                          {s.prazo && (
                            <span style={{ fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: atr ? '#fee2e2' : '#eff6ff', color: atr ? '#b91c1c' : '#2563eb' }}>
                              📅 {fmtData(s.prazo)}
                            </span>
                          )}
                        </div>
                        {s.status === 'concluida' && s.observacoes_conclusao && (
                          <div style={{ marginTop: 8, fontSize: 11.5, color: '#065f46', background: '#f0fdf4', borderRadius: 6, padding: '5px 8px' }}>💬 {s.observacoes_conclusao}</div>
                        )}
                      </div>
                    )
                  })}
                  {itens.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '14px 0' }}>Nenhuma</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detalhe */}
      <Modal open={!!detalhe} onClose={() => setDetalhe(null)} title="Solicitação" size="lg">
        {detalhe && (
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{detalhe.title}</div>
            {detalhe.clients && (
              <Link to={`/clientes/${detalhe.clients.id}`} style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>🏢 {detalhe.clients.razao_social}</Link>
            )}
            {detalhe.description && <p style={{ fontSize: 13.5, color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{detalhe.description}</p>}
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: '#64748b', margin: '12px 0' }}>
              <span>Aberta por <b>{detalhe.author}</b> em {format(parseISO(detalhe.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              {detalhe.prazo && <span>Prazo: <b>{fmtData(detalhe.prazo)}</b></span>}
              {detalhe.concluida_em && <span>Concluída em <b>{format(parseISO(detalhe.concluida_em), 'dd/MM/yyyy', { locale: ptBR })}</b></span>}
            </div>
            {detalhe.observacoes_conclusao && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#065f46', marginBottom: 12 }}>
                <b>Observações da conclusão:</b><br />{detalhe.observacoes_conclusao}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {COLUNAS.filter(c => c.key !== detalhe.status).map(c => (
                <Btn key={c.key} size="sm" variant={c.key === 'concluida' ? 'success' : c.key === 'cancelada' ? 'danger' : 'secondary'}
                  onClick={() => { mover(detalhe, c.key); if (c.key !== 'concluida') setDetalhe(null) }}>
                  {c.key === 'concluida' ? '✓ Finalizar' : `Mover para ${c.label}`}
                </Btn>
              ))}
              <div style={{ flex: 1 }} />
              <Btn size="sm" variant="secondary" onClick={() => { setModal({ id: detalhe.id, form: { client_id: detalhe.client_id || '', title: detalhe.title, description: detalhe.description || '', status: detalhe.status, prazo: detalhe.prazo || '' } }); setDetalhe(null) }}>
                <Pencil size={12} /> Editar
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Finalizar com observações */}
      <Modal open={!!finalizar} onClose={() => setFinalizar(null)} title="Finalizar solicitação">
        {finalizar && (
          <form onSubmit={confirmarFinalizacao}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
              <b>{finalizar.sol.title}</b>{finalizar.sol.clients ? ` · ${finalizar.sol.clients.razao_social}` : ''}
            </div>
            <Textarea label="Observações" value={finalizar.obs} onChange={e => setFinalizar(f => ({ ...f, obs: e.target.value }))} rows={4}
              placeholder="Ex.: Certidão emitida e enviada por e-mail. Cliente precisa renovar em 180 dias." autoFocus />
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: -6, marginBottom: 12 }}>Essa observação também fica registrada no histórico do cliente.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setFinalizar(null)}>Cancelar</Btn>
              <Btn type="submit" variant="success" disabled={saving}>{saving ? 'Salvando...' : '✓ Finalizar'}</Btn>
            </div>
          </form>
        )}
      </Modal>

      {/* Nova / editar */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Editar Solicitação' : 'Nova Solicitação'} size="lg">
        {modal && (
          <form onSubmit={salvar}>
            <Select label="Cliente *" value={modal.form.client_id} onChange={e => setModal(m => ({ ...m, form: { ...m.form, client_id: e.target.value } }))} required>
              <option value="">Selecione o cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
            </Select>
            <Input label="Título *" value={modal.form.title} onChange={e => setModal(m => ({ ...m, form: { ...m.form, title: e.target.value } }))} placeholder="Ex: Certidão negativa, parcelamento..." required />
            <Textarea label="Descrição" value={modal.form.description} onChange={e => setModal(m => ({ ...m, form: { ...m.form, description: e.target.value } }))} rows={3} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {!modal.id && (
                <Select label="Coluna inicial" value={modal.form.status} onChange={e => setModal(m => ({ ...m, form: { ...m.form, status: e.target.value } }))}>
                  <option value="aberta">Aberta</option>
                  <option value="em_andamento">Em andamento</option>
                </Select>
              )}
              <Input label="Prazo" type="date" value={modal.form.prazo} onChange={e => setModal(m => ({ ...m, form: { ...m.form, prazo: e.target.value } }))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
