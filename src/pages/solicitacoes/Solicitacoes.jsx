import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea, StatCard } from '../../components/ui'
import { Plus } from 'lucide-react'

const statusCor = { aberta: 'yellow', em_andamento: 'blue', concluida: 'green', cancelada: 'slate' }
const statusLabel = { aberta: 'Aberta', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' }

export default function Solicitacoes() {
  const { profile } = useAuth()
  const [solicitacoes, setSolicitacoes] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ client_id: '', title: '', description: '', status: 'aberta' })

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [sRes, cRes] = await Promise.all([
      supabase.from('client_requests')
        .select('*, clients(id, razao_social)')
        .order('created_at', { ascending: false }),
      supabase.from('clients').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
    ])
    setSolicitacoes(sRes.data || [])
    setClientes(cRes.data || [])
    setLoading(false)
  }

  const filtradas = solicitacoes.filter(s => {
    return (!filtroStatus || s.status === filtroStatus)
      && (!filtroCliente || s.client_id === filtroCliente)
  })

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('client_requests').insert({ ...form, author: profile?.name || 'Sistema' })
    if (form.client_id) {
      await supabase.from('client_observations').insert({
        client_id: form.client_id,
        text: `Solicitação registrada: ${form.title}`,
        author: profile?.name || 'Sistema',
      })
    }
    setSaving(false); setShowModal(false)
    setForm({ client_id: '', title: '', description: '', status: 'aberta' })
    fetchTudo()
  }

  async function atualizarStatus(sid, status) {
    await supabase.from('client_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', sid)
    setSolicitacoes(s => s.map(x => x.id === sid ? { ...x, status } : x))
  }

  const total = solicitacoes.length
  const abertas = solicitacoes.filter(s => s.status === 'aberta').length
  const emAndamento = solicitacoes.filter(s => s.status === 'em_andamento').length
  const concluidas = solicitacoes.filter(s => s.status === 'concluida').length

  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHeader
        title="Solicitações"
        subtitle="Acompanhe todas as solicitações dos clientes"
        actions={<Btn onClick={() => setShowModal(true)}><Plus size={14} /> Nova Solicitação</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total" value={total} icon="📝" color="#64748b" bg="#f8fafc" border="#e2e8f0" />
        <StatCard label="Abertas" value={abertas} icon="🟡" color="#f59e0b" bg="#fffbeb" border="#fde68a" />
        <StatCard label="Em andamento" value={emAndamento} icon="🔵" color="#3b82f6" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Concluídas" value={concluidas} icon="✅" color="#10b981" bg="#f0fdf4" border="#bbf7d0" />
      </div>

      {/* Filtros */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
          style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: 'white', outline: 'none', minWidth: 200 }}>
          <option value="">Todos os clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
        </select>
        <div style={{ display: 'flex', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {[['', 'Todas'], ['aberta', 'Abertas'], ['em_andamento', 'Em andamento'], ['concluida', 'Concluídas'], ['cancelada', 'Canceladas']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltroStatus(v)}
              style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                background: filtroStatus === v ? '#2563eb' : 'transparent',
                color: filtroStatus === v ? 'white' : '#64748b',
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 60, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
            <div style={{ fontWeight: 600, color: '#475569' }}>Nenhuma solicitação encontrada</div>
          </div>
        ) : filtradas.map(s => (
          <div key={s.id} style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{s.title}</span>
                <Badge color={statusCor[s.status]}>{statusLabel[s.status]}</Badge>
              </div>
              {s.clients && (
                <Link to={`/clientes/${s.clients.id}`} style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 600, display: 'inline-block', marginBottom: 4 }}>
                  🏢 {s.clients.razao_social}
                </Link>
              )}
              {s.description && <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>{s.description}</p>}
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                {s.author} · {format(parseISO(s.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
            {s.status !== 'concluida' && s.status !== 'cancelada' && (
              <select value={s.status} onChange={e => atualizarStatus(s.id, e.target.value)}
                style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', background: 'white', flexShrink: 0 }}>
                <option value="aberta">Aberta</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            )}
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Solicitação" size="lg">
        <form onSubmit={salvar}>
          <Select label="Cliente *" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required>
            <option value="">Selecione o cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </Select>
          <Input label="Título *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Certidão negativa, parcelamento..." required />
          <Textarea label="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Detalhes da solicitação..." />
          <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="aberta">Aberta</option>
            <option value="em_andamento">Em andamento</option>
          </Select>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar Solicitação'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
