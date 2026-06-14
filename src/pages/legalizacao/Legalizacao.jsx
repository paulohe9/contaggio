import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea } from '../../components/ui'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

const tiposProcesso = [
  { type: 'abertura', label: 'Abertura de Empresa', icon: '🏢', color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
  { type: 'alteracao', label: 'Alteração Contratual', icon: '📝', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { type: 'baixa', label: 'Encerramento (Baixa)', icon: '🔒', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { type: 'transformacao', label: 'Transformação de MEI', icon: '🔄', color: '#8b5cf6', bg: '#ede9fe', border: '#c4b5fd' },
]

const statusCor = { em_andamento: 'blue', concluido: 'green', aguardando: 'yellow', cancelado: 'slate' }
const statusLabel = { em_andamento: 'Em andamento', concluido: 'Concluído', aguardando: 'Aguardando', cancelado: 'Cancelado' }

export default function Legalizacao() {
  const [processos, setProcessos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandidos, setExpandidos] = useState({})
  const [form, setForm] = useState({ client_id: '', type: 'abertura', description: '', status: 'em_andamento', started_at: '', notes: '' })

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [pRes, cRes] = await Promise.all([
      supabase.from('legalization_processes').select('*, clients(razao_social)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, razao_social').order('razao_social'),
    ])
    setProcessos(pRes.data || [])
    setClientes(cRes.data || [])
    setLoading(false)
  }

  async function salvarProcesso(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('legalization_processes').insert(form)
    setSaving(false); setShowModal(false)
    setForm({ client_id: '', type: 'abertura', description: '', status: 'em_andamento', started_at: '', notes: '' })
    fetchTudo()
  }

  async function atualizarStatus(id, status) {
    await supabase.from('legalization_processes').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setProcessos(ps => ps.map(p => p.id === id ? { ...p, status } : p))
  }

  function toggleExpand(id) {
    setExpandidos(e => ({ ...e, [id]: !e[id] }))
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHeader
        title="Legalização"
        subtitle="Processos de abertura, alteração, encerramento e transformação"
        actions={<Btn onClick={() => setShowModal(true)}><Plus size={14} /> Novo Processo</Btn>}
      />

      {/* Cards por tipo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {tiposProcesso.map(t => {
          const count = processos.filter(p => p.type === t.type).length
          return (
            <div key={t.type} style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {t.icon}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{count}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Carregando...</div>
      ) : processos.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 60, textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚖️</div>
          <div style={{ fontWeight: 600, color: '#475569', fontSize: 16 }}>Nenhum processo registrado</div>
          <div style={{ fontSize: 13, marginTop: 4, marginBottom: 20 }}>Registre processos de abertura, alteração, baixa ou transformação de empresas</div>
          <Btn onClick={() => setShowModal(true)}><Plus size={14} /> Registrar Processo</Btn>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {processos.map(p => {
            const tipo = tiposProcesso.find(t => t.type === p.type)
            const aberto = expandidos[p.id]
            return (
              <div key={p.id} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div
                  onClick={() => toggleExpand(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: tipo?.bg || '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {tipo?.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{tipo?.label}</span>
                      <Badge color={statusCor[p.status]}>{statusLabel[p.status]}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {p.clients?.razao_social}
                      {p.started_at && <span style={{ color: '#94a3b8', marginLeft: 8 }}>· Iniciado em {format(parseISO(p.started_at), 'dd/MM/yyyy')}</span>}
                    </div>
                  </div>
                  <div style={{ color: '#94a3b8', flexShrink: 0 }}>
                    {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {aberto && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', background: '#fafbfc' }}>
                    {p.description && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Descrição</div>
                        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{p.description}</div>
                      </div>
                    )}
                    {p.notes && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Observações</div>
                        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{p.notes}</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        Registrado em {format(parseISO(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {p.status !== 'concluido' && p.status !== 'cancelado' && (
                          <>
                            <Btn size="sm" variant="secondary" onClick={() => atualizarStatus(p.id, 'aguardando')}>Em espera</Btn>
                            <Btn size="sm" variant="success" onClick={() => atualizarStatus(p.id, 'concluido')}>Concluir</Btn>
                          </>
                        )}
                        {(p.status === 'aguardando' || p.status === 'concluido') && (
                          <Btn size="sm" variant="ghost" onClick={() => atualizarStatus(p.id, 'em_andamento')}>Reabrir</Btn>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Processo de Legalização" size="lg">
        <form onSubmit={salvarProcesso}>
          <Select label="Cliente *" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required>
            <option value="">Selecione o cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </Select>
          <Select label="Tipo de Processo *" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {tiposProcesso.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
          </Select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Data de Início" type="date" value={form.started_at} onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))} />
            <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="em_andamento">Em andamento</option>
              <option value="aguardando">Aguardando</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </Select>
          </div>
          <Textarea label="Descrição do Processo" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Descreva o que precisa ser feito..." />
          <Textarea label="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Pendências, documentos necessários..." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar Processo'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
