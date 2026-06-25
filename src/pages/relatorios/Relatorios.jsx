import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'

const G = '#C9960A'
const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const TABS = [
  { key: 'financeiro', label: '💰 Financeiro' },
  { key: 'obrigacoes', label: '📋 Obrigações' },
  { key: 'clientes', label: '🏢 Clientes' },
]

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

function Card({ title, children, span }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', gridColumn: span ? `span ${span}` : undefined }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 18 }}>{title}</div>
      {children}
    </div>
  )
}

function KPI({ label, value, sub, color = '#0f172a', bg = '#f8fafc', border = '#e2e8f0' }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginTop: 2 }}>{p.name}: <strong>{typeof p.value === 'number' && p.value > 100 ? fmt(p.value) : p.value}</strong></div>
      ))}
    </div>
  )
}

export default function Relatorios() {
  const [tab, setTab] = useState('financeiro')
  const [loading, setLoading] = useState(true)
  const [periodos, setPeriodos] = useState(6) // últimos N meses
  const [dados, setDados] = useState(null)

  useEffect(() => { fetchDados() }, [periodos])

  async function fetchDados() {
    setLoading(true)
    const hoje = new Date()
    const inicioGeral = format(startOfMonth(subMonths(hoje, periodos - 1)), 'yyyy-MM-dd')

    const [tRes, oRes, cRes] = await Promise.all([
      supabase.from('financial_transactions').select('*').gte('due_date', inicioGeral),
      supabase.from('obligations').select('*').gte('due_date', inicioGeral),
      supabase.from('clients').select('id, status, data_entrada, data_saida, created_at'),
    ])

    const transacoes = tRes.data || []
    const obrigacoes = oRes.data || []
    const clientes = cRes.data || []

    // Gera dados mês a mês
    const mesesData = Array.from({ length: periodos }, (_, i) => {
      const ref = subMonths(hoje, periodos - 1 - i)
      const ini = startOfMonth(ref)
      const fim = endOfMonth(ref)
      const label = format(ref, 'MMM/yy', { locale: ptBR })
      const iniStr = format(ini, 'yyyy-MM-dd')
      const fimStr = format(fim, 'yyyy-MM-dd')

      // Financeiro
      const recebidoMes = transacoes.filter(t =>
        t.type === 'receber' && t.status === 'pago' && t.data_pagamento >= iniStr && t.data_pagamento <= fimStr
      ).reduce((s, t) => s + Number(t.amount), 0)

      const pagoMes = transacoes.filter(t =>
        t.type === 'pagar' && t.status === 'pago' && t.data_pagamento >= iniStr && t.data_pagamento <= fimStr
      ).reduce((s, t) => s + Number(t.amount), 0)

      const inadimplenteMes = transacoes.filter(t =>
        t.type === 'receber' && t.status === 'pendente' && t.due_date >= iniStr && t.due_date <= fimStr
        && new Date(t.due_date) < hoje
      ).reduce((s, t) => s + Number(t.amount), 0)

      // Obrigações
      const obsDoMes = obrigacoes.filter(o => o.due_date >= iniStr && o.due_date <= fimStr)
      const obConcluidas = obsDoMes.filter(o => o.status === 'concluida').length
      const obAtrasadas = obsDoMes.filter(o => o.status === 'atrasada').length
      const obPendentes = obsDoMes.filter(o => o.status === 'pendente').length
      // Entregues em atraso (concluidas mas com data depois do due_date)
      const obNoProzo = obsDoMes.filter(o => o.status === 'concluida').length

      // Clientes entradas/saídas
      const entradas = clientes.filter(c => {
        const d = c.data_entrada || c.created_at?.slice(0, 10)
        return d && d >= iniStr && d <= fimStr
      }).length
      const saidas = clientes.filter(c => c.data_saida && c.data_saida >= iniStr && c.data_saida <= fimStr).length

      return { label, recebido: recebidoMes, pago: pagoMes, saldo: recebidoMes - pagoMes, inadimplente: inadimplenteMes, obConcluidas, obAtrasadas, obPendentes, entradas, saidas }
    })

    // KPIs financeiros do mês atual
    const mesAtual = mesesData[mesesData.length - 1]
    const mesAnterior = mesesData[mesesData.length - 2]
    const varReceita = mesAnterior?.recebido > 0
      ? ((mesAtual?.recebido - mesAnterior?.recebido) / mesAnterior?.recebido * 100).toFixed(1)
      : null

    // Clientes por status
    const clientesAtivos = clientes.filter(c => c.status === 'ativo').length
    const clientesInativos = clientes.filter(c => c.status === 'inativo').length
    const clientesSuspensos = clientes.filter(c => c.status === 'suspenso').length

    // Obrigações próximas do prazo (vence nos próximos 7 dias)
    const proximasPrazo = obrigacoes.filter(o => {
      if (o.status === 'concluida' || o.status === 'cancelada') return false
      const dias = differenceInDays(new Date(o.due_date), hoje)
      return dias >= 0 && dias <= 7
    }).length

    // Distribuição de obrigações por status
    const pieObs = [
      { name: 'Concluída', value: obrigacoes.filter(o => o.status === 'concluida').length, color: '#10b981' },
      { name: 'Pendente', value: obrigacoes.filter(o => o.status === 'pendente').length, color: '#f59e0b' },
      { name: 'Em andamento', value: obrigacoes.filter(o => o.status === 'em_andamento').length, color: '#3b82f6' },
      { name: 'Atrasada', value: obrigacoes.filter(o => o.status === 'atrasada').length, color: '#ef4444' },
    ].filter(p => p.value > 0)

    setDados({ mesesData, mesAtual, mesAnterior, varReceita, clientesAtivos, clientesInativos, clientesSuspensos, proximasPrazo, pieObs, totalObs: obrigacoes.length })
    setLoading(false)
  }

  if (loading || !dados) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8', fontSize: 16 }}>
      Carregando relatórios...
    </div>
  )

  const { mesesData, mesAtual, varReceita, clientesAtivos, clientesInativos, clientesSuspensos, proximasPrazo, pieObs } = dados

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Relatórios</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Análise comparativa e indicadores do escritório</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Período:</span>
          {[3, 6, 12].map(n => (
            <button key={n} onClick={() => setPeriodos(n)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${periodos === n ? G : '#e2e8f0'}`, background: periodos === n ? '#fffbeb' : 'white', color: periodos === n ? G : '#64748b', fontWeight: periodos === n ? 700 : 500, cursor: 'pointer', fontSize: 13 }}>
              {n}m
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#0f172a' : '#64748b', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* === TAB FINANCEIRO === */}
      {tab === 'financeiro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <KPI label="Receita este mês" value={fmt(mesAtual?.recebido)} color="#10b981" bg="#f0fdf4" border="#bbf7d0"
              sub={varReceita !== null ? `${varReceita > 0 ? '▲' : '▼'} ${Math.abs(varReceita)}% vs mês anterior` : 'Sem comparativo'} />
            <KPI label="Despesas este mês" value={fmt(mesAtual?.pago)} color="#ef4444" bg="#fef2f2" border="#fecaca" />
            <KPI label="Saldo líquido" value={fmt(mesAtual?.saldo)} color={mesAtual?.saldo >= 0 ? '#10b981' : '#ef4444'} bg={mesAtual?.saldo >= 0 ? '#f0fdf4' : '#fef2f2'} border={mesAtual?.saldo >= 0 ? '#bbf7d0' : '#fecaca'} />
            <KPI label="Variação de receita" value={varReceita !== null ? `${varReceita > 0 ? '+' : ''}${varReceita}%` : '—'}
              color={varReceita > 0 ? '#10b981' : varReceita < 0 ? '#ef4444' : '#64748b'}
              bg={varReceita > 0 ? '#f0fdf4' : varReceita < 0 ? '#fef2f2' : '#f8fafc'}
              border={varReceita > 0 ? '#bbf7d0' : varReceita < 0 ? '#fecaca' : '#e2e8f0'}
              sub="Comparado ao mês anterior" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <Card title={`Receita vs Despesa — Últimos ${periodos} meses`}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mesesData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={customTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="recebido" name="Receita" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="pago" name="Despesa" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Saldo Líquido Mensal">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={mesesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={customTooltip} />
                  <Area type="monotone" dataKey="saldo" name="Saldo" stroke={G} fill={`${G}25`} strokeWidth={2} dot={{ fill: G, r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="Inadimplência Mensal (a receber vencido)">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mesesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={customTooltip} />
                <Line type="monotone" dataKey="inadimplente" name="Inadimplência" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* === TAB OBRIGAÇÕES === */}
      {tab === 'obrigacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <KPI label="Concluídas este mês" value={mesesData[mesesData.length-1]?.obConcluidas} color="#10b981" bg="#f0fdf4" border="#bbf7d0" />
            <KPI label="Atrasadas este mês" value={mesesData[mesesData.length-1]?.obAtrasadas} color="#ef4444" bg="#fef2f2" border="#fecaca" />
            <KPI label="Pendentes este mês" value={mesesData[mesesData.length-1]?.obPendentes} color="#f59e0b" bg="#fffbeb" border="#fde68a" />
            <KPI label="Próximas do prazo (7d)" value={proximasPrazo} color="#8b5cf6" bg="#f5f3ff" border="#ddd6fe" sub="Próximos 7 dias" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <Card title={`Concluídas vs Atrasadas — Últimos ${periodos} meses`}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mesesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={customTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="obConcluidas" name="Concluídas" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="obAtrasadas" name="Atrasadas" fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="obPendentes" name="Pendentes" fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Distribuição por Status">
              {pieObs.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieObs} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                        {pieObs.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {pieObs.map(p => (
                      <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'block' }} />
                          <span style={{ color: '#475569' }}>{p.name}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Sem dados</div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* === TAB CLIENTES === */}
      {tab === 'clientes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <KPI label="Clientes ativos" value={clientesAtivos} color="#10b981" bg="#f0fdf4" border="#bbf7d0" />
            <KPI label="Inativos" value={clientesInativos} color="#94a3b8" bg="#f8fafc" border="#e2e8f0" />
            <KPI label="Suspensos" value={clientesSuspensos} color="#ef4444" bg="#fef2f2" border="#fecaca" />
            <KPI label="Entradas este mês" value={mesesData[mesesData.length-1]?.entradas}
              sub={`${mesesData[mesesData.length-1]?.saidas} saída(s)`} color="#3b82f6" bg="#eff6ff" border="#bfdbfe" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <Card title={`Entradas e Saídas de Clientes — Últimos ${periodos} meses`}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mesesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip content={customTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Composição da Carteira">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {[
                  { label: 'Ativos', val: clientesAtivos, total: clientesAtivos + clientesInativos + clientesSuspensos, color: '#10b981' },
                  { label: 'Inativos', val: clientesInativos, total: clientesAtivos + clientesInativos + clientesSuspensos, color: '#94a3b8' },
                  { label: 'Suspensos', val: clientesSuspensos, total: clientesAtivos + clientesInativos + clientesSuspensos, color: '#ef4444' },
                ].map(({ label, val, total, color }) => {
                  const pct = total > 0 ? Math.round(val / total * 100) : 0
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>{label}</span>
                        <span style={{ color: '#1e293b', fontWeight: 700 }}>{val} ({pct}%)</span>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
