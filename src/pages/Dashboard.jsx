import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, isToday, isTomorrow, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../contexts/AuthContext'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Users, TrendingDown, TrendingUp, ClipboardList, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

const G = '#C9960A'
const DARK = '#0a0b0d'
const statusDot = { pendente: '#f59e0b', em_andamento: '#3b82f6', concluida: '#10b981', atrasada: '#ef4444' }
const priorityColor = { alta: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' }, urgente: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' } }
const statusBadge = { pendente: { bg: '#fef9c3', text: '#854d0e' }, em_andamento: { bg: '#dbeafe', text: '#1e40af' }, atrasada: { bg: '#fee2e2', text: '#991b1b' }, concluida: { bg: '#d1fae5', text: '#065f46' } }

const ROTAS = [
  { label: 'Dashboard', value: '/' },
  { label: 'Clientes', value: '/clientes' },
  { label: 'Obrigações', value: '/obrigacoes' },
  { label: 'Financeiro', value: '/financeiro' },
  { label: 'Legalização', value: '/legalizacao' },
  { label: 'Solicitações', value: '/solicitacoes' },
  { label: 'Usuários', value: '/usuarios' },
]

const ATALHOS_PADRAO = [
  { id: '1', label: 'Clientes', icon: '🏢', rota: '/clientes', img: null, cor: '#3b82f6' },
  { id: '2', label: 'Obrigações', icon: '📋', rota: '/obrigacoes', img: null, cor: '#f59e0b' },
  { id: '3', label: 'Financeiro', icon: '💰', rota: '/financeiro', img: null, cor: '#10b981' },
  { id: '4', label: 'Solicitações', icon: '📬', rota: '/solicitacoes', img: null, cor: '#8b5cf6' },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function useAtalhos(userId) {
  const key = `atalhos_${userId}`
  const [atalhos, setAtalhosState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) || ATALHOS_PADRAO } catch { return ATALHOS_PADRAO }
  })
  function setAtalhos(novoArray) {
    setAtalhosState(novoArray)
    localStorage.setItem(key, JSON.stringify(novoArray))
  }
  return [atalhos, setAtalhos]
}

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ clientes: 0, pendentes: 0, pagar: 0, receber: 0 })
  const [tarefas, setTarefas] = useState([])
  const [obCalendario, setObCalendario] = useState([])
  const [mes, setMes] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [diaAtivo, setDiaAtivo] = useState(null)
  const [atalhos, setAtalhos] = useAtalhos(profile?.id || 'guest')
  const [modoEdicao, setModoEdicao] = useState(false)
  const [editando, setEditando] = useState(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetchDashboard() }, [mes])

  async function fetchDashboard() {
    setLoading(true)
    const inicio = format(startOfMonth(mes), 'yyyy-MM-dd')
    const fim = format(endOfMonth(mes), 'yyyy-MM-dd')
    const [a, b, c, d, e] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact' }).eq('status', 'ativo'),
      supabase.from('obligations').select('*').gte('due_date', inicio).lte('due_date', fim),
      supabase.from('financial_transactions').select('amount').eq('type', 'pagar').eq('status', 'pendente'),
      supabase.from('financial_transactions').select('amount').eq('type', 'receber').eq('status', 'pendente'),
      supabase.from('obligations').select('*, clients(razao_social)').in('status', ['pendente', 'atrasada', 'em_andamento']).in('priority', ['alta', 'urgente']).order('due_date').limit(8),
    ])
    setStats({
      clientes: a.count || 0,
      pendentes: b.data?.filter(o => o.status !== 'concluida').length || 0,
      pagar: c.data?.reduce((s, t) => s + t.amount, 0) || 0,
      receber: d.data?.reduce((s, t) => s + t.amount, 0) || 0,
    })
    setObCalendario(b.data || [])
    setTarefas(e.data || [])
    setLoading(false)
  }

  const dias = eachDayOfInterval({ start: startOfMonth(mes), end: endOfMonth(mes) })
  const offset = startOfMonth(mes).getDay()
  const obsDia = (dia) => obCalendario.filter(o => isSameDay(parseISO(o.due_date), dia))
  const detalhesDia = diaAtivo ? obsDia(diaAtivo) : []
  const moeda = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const indicadores = [
    { label: 'Clientes Ativos', value: stats.clientes, icon: Users, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Pendências', value: stats.pendentes, icon: ClipboardList, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
    { label: 'A Pagar', value: moeda(stats.pagar), icon: TrendingDown, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
    { label: 'A Receber', value: moeda(stats.receber), icon: TrendingUp, color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
  ]

  function abrirEdicao(idx) {
    setEditando({ idx, dados: { ...atalhos[idx] } })
    setShowModal(true)
  }

  function abrirNovo() {
    setEditando({ idx: -1, dados: { id: Date.now().toString(), label: '', icon: '⭐', rota: '/clientes', img: null, cor: '#3b82f6' } })
    setShowModal(true)
  }

  function salvarEdicao() {
    const novo = [...atalhos]
    if (editando.idx === -1) novo.push(editando.dados)
    else novo[editando.idx] = editando.dados
    setAtalhos(novo)
    setShowModal(false)
    setEditando(null)
  }

  function excluirAtalho(idx) {
    setAtalhos(atalhos.filter((_, i) => i !== idx))
  }

  function setDados(field, val) {
    setEditando(e => ({ ...e, dados: { ...e.dados, [field]: val } }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0 }}>
          {getGreeting()}, {profile?.name?.split(' ')[0] || 'bem-vindo'} 👋
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4, textTransform: 'capitalize' }}>
          {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Cards indicadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {indicadores.map(ind => {
          const Icon = ind.icon
          return (
            <div key={ind.label} style={{ background: 'white', borderRadius: 16, padding: '20px 22px', border: `1px solid ${ind.border}`, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: ind.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={22} style={{ color: ind.color }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 4 }}>{ind.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{loading ? '...' : ind.value}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Atalhos rápidos */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Atalhos Rápidos</div>
          <button
            onClick={() => setModoEdicao(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: modoEdicao ? DARK : '#f8fafc', border: `1px solid ${modoEdicao ? DARK : '#e2e8f0'}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: modoEdicao ? G : '#64748b' }}
          >
            {modoEdicao ? <><Check size={13} /> Pronto</> : <><Pencil size={13} /> Editar</>}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {atalhos.map((a, idx) => (
            <AtalhoCard key={a.id} atalho={a} modoEdicao={modoEdicao}
              onClick={() => !modoEdicao && navigate(a.rota)}
              onEdit={() => abrirEdicao(idx)}
              onDelete={() => excluirAtalho(idx)} />
          ))}
          {modoEdicao && (
            <button onClick={abrirNovo} style={{ width: 110, height: 100, borderRadius: 14, border: '2px dashed #e2e8f0', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#94a3b8', flexShrink: 0 }}>
              <Plus size={20} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Novo</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid calendário + tarefas — ocupa o restante da altura */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, flex: 1, minHeight: 400 }}>

        {/* Calendário */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Calendário de Obrigações</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{obCalendario.length} obrigações este mês</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 4, border: '1px solid #e2e8f0' }}>
              <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1))}
                style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', minWidth: 120, textAlign: 'center', textTransform: 'capitalize' }}>
                {format(mes, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1))}
                style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{ padding: '16px 20px', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
              {dias.map(dia => {
                const obs = obsDia(dia)
                const hoje = isToday(dia)
                const selecionado = diaAtivo && isSameDay(dia, diaAtivo)
                return (
                  <button key={dia.toISOString()} onClick={() => setDiaAtivo(selecionado ? null : dia)}
                    style={{ borderRadius: 10, padding: '6px 4px', minHeight: 52, border: hoje ? '2px solid #3b82f6' : selecionado ? '2px solid #93c5fd' : '1px solid transparent', background: hoje ? '#2563eb' : selecionado ? '#eff6ff' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', display: 'flex', flexDirection: 'column', gap: 2 }}
                    onMouseEnter={e => { if (!hoje && !selecionado) e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => { if (!hoje && !selecionado) e.currentTarget.style.background = 'transparent' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: hoje ? 'white' : '#475569', paddingLeft: 2 }}>{format(dia, 'd')}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, paddingLeft: 2 }}>
                      {obs.slice(0, 4).map(o => (
                        <span key={o.id} style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot[o.status] || '#94a3b8', display: 'block' }} />
                      ))}
                    </div>
                    {obs.length > 4 && <span style={{ fontSize: 9, color: hoje ? 'rgba(255,255,255,0.7)' : '#94a3b8', paddingLeft: 2 }}>+{obs.length - 4}</span>}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
              {[['#f59e0b', 'Pendente'], ['#3b82f6', 'Em andamento'], ['#10b981', 'Concluída'], ['#ef4444', 'Atrasada']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'block' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {diaAtivo && detalhesDia.length > 0 && (
            <div style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc', padding: '14px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {format(diaAtivo, "dd 'de' MMMM", { locale: ptBR })} — {detalhesDia.length} obrigação(ões)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detalhesDia.map(o => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>{o.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: statusBadge[o.status]?.bg || '#f1f5f9', color: statusBadge[o.status]?.text || '#475569' }}>
                      {o.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tarefas urgentes */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Tarefas Urgentes</div>
          </div>
          {tarefas.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
              <CheckCircle2 size={40} style={{ color: '#10b981' }} />
              <div style={{ fontWeight: 600, color: '#374151', fontSize: 15 }}>Tudo em dia!</div>
              <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>Nenhuma tarefa urgente no momento.</div>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {tarefas.map(t => {
                const vencida = isPast(parseISO(t.due_date)) && t.status !== 'concluida'
                const pColor = priorityColor[t.priority]
                return (
                  <div key={t.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>{t.title}</span>
                      {pColor && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: pColor.bg, color: pColor.text, border: `1px solid ${pColor.border}`, flexShrink: 0 }}>
                          {t.priority.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {t.clients?.razao_social && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{t.clients.razao_social}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: vencida ? '#ef4444' : '#94a3b8' }}>
                        {vencida ? '⚠ ' : '📅 '}
                        {isToday(parseISO(t.due_date)) ? 'Hoje!' : isTomorrow(parseISO(t.due_date)) ? 'Amanhã' : format(parseISO(t.due_date), 'dd/MM/yyyy')}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: statusBadge[t.status]?.bg || '#f1f5f9', color: statusBadge[t.status]?.text || '#64748b' }}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal editar/novo atalho */}
      {showModal && editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{editando.idx === -1 ? 'Novo Atalho' : 'Editar Atalho'}</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            {/* Preview ao vivo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22, padding: '16px', background: '#f8fafc', borderRadius: 12 }}>
              <AtalhoCard atalho={editando.dados} modoEdicao={false} onClick={() => {}} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nome do atalho">
                <input value={editando.dados.label} onChange={e => setDados('label', e.target.value)}
                  placeholder="Ex: Clientes"
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </Field>

              <Field label="Emoji / ícone (se não usar foto)">
                <input value={editando.dados.icon} onChange={e => setDados('icon', e.target.value)}
                  placeholder="Ex: 🏢"
                  style={{ width: 80, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 22, outline: 'none' }} />
              </Field>

              <Field label="Foto — URL de imagem (opcional, substitui o emoji)">
                <input value={editando.dados.img || ''} onChange={e => setDados('img', e.target.value || null)}
                  placeholder="https://... (deixe vazio para usar emoji)"
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </Field>

              <Field label="Cor do card">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#C9960A','#0a0b0d','#06b6d4','#64748b'].map(c => (
                    <button key={c} onClick={() => setDados('cor', c)}
                      style={{ width: 28, height: 28, borderRadius: 8, background: c, border: editando.dados.cor === c ? '3px solid #0f172a' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </Field>

              <Field label="Página de destino">
                <select value={editando.dados.rota} onChange={e => setDados('rota', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                  {ROTAS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)}
                style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#64748b' }}>
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={!editando.dados.label}
                style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${G}, #8a6500)`, cursor: 'pointer', fontWeight: 700, fontSize: 14, color: DARK, opacity: editando.dados.label ? 1 : 0.5 }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AtalhoCard({ atalho, modoEdicao, onClick, onEdit, onDelete }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={onClick}
        style={{ width: 110, height: 100, borderRadius: 14, border: 'none', background: atalho.img ? 'transparent' : `${atalho.cor}18`, cursor: modoEdicao ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'transform 0.12s, box-shadow 0.12s', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden', padding: 0, outline: `2px solid ${atalho.cor}30` }}
        onMouseEnter={e => { if (!modoEdicao) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${atalho.cor}40` } }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)' }}>
        {atalho.img && (
          <img src={atalho.img} alt={atalho.label} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        )}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, ...(atalho.img ? { background: 'rgba(0,0,0,0.38)', width: '100%', height: '100%', justifyContent: 'center' } : {}) }}>
          <span style={{ fontSize: 30 }}>{atalho.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: atalho.img ? 'white' : atalho.cor, letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.2, padding: '0 6px' }}>
            {atalho.label || 'Sem nome'}
          </span>
        </div>
      </button>
      {modoEdicao && (
        <div style={{ position: 'absolute', top: -6, right: -6, display: 'flex', gap: 3 }}>
          <button onClick={onEdit} style={{ width: 22, height: 22, borderRadius: '50%', background: '#3b82f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
            <Pencil size={10} />
          </button>
          <button onClick={onDelete} style={{ width: 22, height: 22, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>
      {children}
    </div>
  )
}
