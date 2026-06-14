import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, isToday, isTomorrow, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../contexts/AuthContext'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Users, TrendingDown, TrendingUp, ClipboardList } from 'lucide-react'

const statusDot = { pendente: '#f59e0b', em_andamento: '#3b82f6', concluida: '#10b981', atrasada: '#ef4444' }
const priorityColor = { alta: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' }, urgente: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' } }
const statusBadge = { pendente: { bg: '#fef9c3', text: '#854d0e' }, em_andamento: { bg: '#dbeafe', text: '#1e40af' }, atrasada: { bg: '#fee2e2', text: '#991b1b' }, concluida: { bg: '#d1fae5', text: '#065f46' } }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ clientes: 0, pendentes: 0, pagar: 0, receber: 0 })
  const [tarefas, setTarefas] = useState([])
  const [obCalendario, setObCalendario] = useState([])
  const [mes, setMes] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [diaAtivo, setDiaAtivo] = useState(null)

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

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0 }}>
          {getGreeting()}, {profile?.name?.split(' ')[0] || 'bem-vindo'} 👋
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }} className="capitalize">
          {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Cards indicadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {indicadores.map(ind => {
          const Icon = ind.icon
          return (
            <div key={ind.label} style={{
              background: 'white', borderRadius: 16, padding: '20px 22px',
              border: `1px solid ${ind.border}`, display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: ind.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
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

      {/* Grid calendário + tarefas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* Calendário */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Calendário de Obrigações</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{obCalendario.length} obrigações este mês</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 4, border: '1px solid #e2e8f0' }}>
              <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1))}
                style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'white'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', minWidth: 120, textAlign: 'center', textTransform: 'capitalize' }}>
                {format(mes, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1))}
                style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'white'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {/* Dias da semana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
              ))}
            </div>

            {/* Grid de dias */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
              {dias.map(dia => {
                const obs = obsDia(dia)
                const hoje = isToday(dia)
                const selecionado = diaAtivo && isSameDay(dia, diaAtivo)
                return (
                  <button
                    key={dia.toISOString()}
                    onClick={() => setDiaAtivo(selecionado ? null : dia)}
                    style={{
                      borderRadius: 10, padding: '6px 4px', minHeight: 52,
                      border: hoje ? '2px solid #3b82f6' : selecionado ? '2px solid #93c5fd' : '1px solid transparent',
                      background: hoje ? '#2563eb' : selecionado ? '#eff6ff' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                    onMouseEnter={e => { if (!hoje && !selecionado) e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => { if (!hoje && !selecionado) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: hoje ? 'white' : '#475569', paddingLeft: 2 }}>
                      {format(dia, 'd')}
                    </span>
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

            {/* Legenda */}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
              {[['#f59e0b', 'Pendente'], ['#3b82f6', 'Em andamento'], ['#10b981', 'Concluída'], ['#ef4444', 'Atrasada']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'block' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detalhe do dia selecionado */}
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
                    {t.clients?.razao_social && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{t.clients.razao_social}</div>
                    )}
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
    </div>
  )
}
