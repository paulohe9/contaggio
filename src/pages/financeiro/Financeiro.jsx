import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea, StatCard, TabBar } from '../../components/ui'
import { Plus, Landmark, Pencil, PiggyBank, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

const PARCEIROS = ['rayssa', 'paulo', 'rilary']
const PARCEIRO_COR = { rayssa: '#8b5cf6', paulo: '#3b82f6', rilary: '#f59e0b' }
const PARCEIRO_LABEL = { rayssa: 'Rayssa', paulo: 'Paulo', rilary: 'Rilary' }

const tipoCores = { receber: 'green', pagar: 'red', transferencia: 'blue' }
const statusCores = { pendente: 'yellow', pago: 'green', cancelado: 'slate', atrasado: 'red' }
const tipoLabel = { receber: 'Receber', pagar: 'Pagar', transferencia: 'Transferência' }

export default function Financeiro() {
  const [transacoes, setTransacoes] = useState([])
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('visao_geral')
  const [showModal, setShowModal] = useState(false)
  const [showContaModal, setShowContaModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: 'receber', description: '', amount: '', due_date: '', data_pagamento: '', status: 'pendente', category: '', client_id: '', notes: '', is_recurring: false })
  const [pagamentoModal, setPagamentoModal] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [contaForm, setContaForm] = useState({ name: '', bank: '', balance: '0', type: 'corrente' })
  const [clientes, setClientes] = useState([])
  // Reserva
  const [reservaMovements, setReservaMovements] = useState([])
  const [showReservaModal, setShowReservaModal] = useState(false)
  const [reservaForm, setReservaForm] = useState({ type: 'deposito', amount: '', date: new Date().toISOString().slice(0,10), description: '', bank_account_id: '' })
  // Distribuição
  const [distributions, setDistributions] = useState([])
  const [showDistModal, setShowDistModal] = useState(false)
  const [distForm, setDistForm] = useState({ month: new Date().toISOString().slice(0,7), rayssa: '', paulo: '', rilary: '', notes: '', bank_account_id: '' })

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [tRes, cRes, clRes, rRes, dRes] = await Promise.all([
      supabase.from('financial_transactions').select('*, clients(razao_social)').order('due_date', { ascending: false }),
      supabase.from('bank_accounts').select('*').order('name'),
      supabase.from('clients').select('id, razao_social').order('razao_social'),
      supabase.from('reserva_movements').select('*').order('date', { ascending: false }),
      supabase.from('profit_distributions').select('*').order('month', { ascending: false }),
    ])
    setTransacoes(tRes.data || [])
    setContas(cRes.data || [])
    setClientes(clRes.data || [])
    setReservaMovements(rRes.data || [])
    setDistributions(dRes.data || [])
    setLoading(false)
  }

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

  // Receber (entrada)
  const recebidoMes = transacoes.filter(t =>
    t.type === 'receber' && t.status === 'pago' &&
    t.data_pagamento && new Date(t.data_pagamento) >= inicioMes && new Date(t.data_pagamento) <= fimMes
  ).reduce((s, t) => s + Number(t.amount), 0)

  const aReceber = transacoes.filter(t =>
    t.type === 'receber' && t.status === 'pendente'
  ).reduce((s, t) => s + Number(t.amount), 0)

  const vencidosNaoPagos = transacoes.filter(t =>
    t.type === 'receber' && t.status === 'pendente' && t.due_date && new Date(t.due_date) < hoje
  ).reduce((s, t) => s + Number(t.amount), 0)

  const totalAReceber = aReceber || 1
  const percInadimplencia = Math.round((vencidosNaoPagos / totalAReceber) * 100)

  // Pagar (saída)
  const aPagar = transacoes.filter(t =>
    t.type === 'pagar' && t.status === 'pendente'
  ).reduce((s, t) => s + Number(t.amount), 0)

  const pagosMes = transacoes.filter(t =>
    t.type === 'pagar' && t.status === 'pago' &&
    t.data_pagamento && new Date(t.data_pagamento) >= inicioMes && new Date(t.data_pagamento) <= fimMes
  ).reduce((s, t) => s + Number(t.amount), 0)

  const saldoTotal = contas.reduce((s, c) => s + Number(c.balance), 0)

  function abrirEdicao(t) {
    setEditandoId(t.id)
    setForm({
      type: t.type || 'receber',
      description: t.description || '',
      amount: t.amount || '',
      due_date: t.due_date || '',
      data_pagamento: t.data_pagamento || '',
      status: t.status || 'pendente',
      category: t.category || '',
      client_id: t.client_id || '',
      notes: t.notes || '',
      is_recurring: t.is_recurring || false,
      bank_account_id: t.bank_account_id || '',
    })
    setShowModal(true)
  }

  async function salvarTransacao(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      type: form.type,
      description: form.description,
      amount: Number(form.amount),
      client_id: form.client_id || null,
      due_date: form.due_date || null,
      data_pagamento: form.data_pagamento || null,
      status: form.status,
      category: form.category || null,
      notes: form.notes || null,
      is_recurring: form.is_recurring,
      bank_account_id: form.bank_account_id || null,
    }
    let error
    if (editandoId) {
      ;({ error } = await supabase.from('financial_transactions').update(payload).eq('id', editandoId))
    } else {
      ;({ error } = await supabase.from('financial_transactions').insert(payload))
    }
    if (error) { alert('Erro ao salvar: ' + error.message); setSaving(false); return }
    setSaving(false); setShowModal(false); setEditandoId(null)
    setForm({ type: 'receber', description: '', amount: '', due_date: '', data_pagamento: '', status: 'pendente', category: '', client_id: '', notes: '', is_recurring: false, bank_account_id: '' })
    fetchTudo()
  }

  async function salvarConta(e) {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('bank_accounts').insert({ ...contaForm, balance: Number(contaForm.balance) })
    if (error) { alert('Erro ao salvar conta: ' + error.message); setSaving(false); return }
    setSaving(false); setShowContaModal(false)
    setContaForm({ name: '', bank: '', balance: '0', type: 'corrente' })
    fetchTudo()
  }

  async function alterarStatus(id, status, data_pagamento, bank_account_id) {
    const upd = { status, updated_at: new Date().toISOString() }
    if (data_pagamento) upd.data_pagamento = data_pagamento
    if (bank_account_id) upd.bank_account_id = bank_account_id
    await supabase.from('financial_transactions').update(upd).eq('id', id)
    setTransacoes(ts => ts.map(t => t.id === id ? { ...t, status, data_pagamento: data_pagamento || t.data_pagamento, bank_account_id: bank_account_id || t.bank_account_id } : t))
    setPagamentoModal(null)
  }

  async function confirmarPagamento(e) {
    e.preventDefault()
    const { id, data_pagamento, status, bank_account_id, amount, tipo } = pagamentoModal
    await alterarStatus(id, status, data_pagamento || new Date().toISOString().slice(0, 10), bank_account_id)
    // Atualizar saldo da conta bancária
    if (bank_account_id) {
      const conta = contas.find(c => c.id === bank_account_id)
      if (conta) {
        const delta = tipo === 'receber' ? Number(amount) : -Number(amount)
        const novoSaldo = Number(conta.balance) + delta
        await supabase.from('bank_accounts').update({ balance: novoSaldo }).eq('id', bank_account_id)
        setContas(cs => cs.map(c => c.id === bank_account_id ? { ...c, balance: novoSaldo } : c))
      }
    }
  }

  async function salvarReserva(e) {
    e.preventDefault(); setSaving(true)
    const { bank_account_id, ...resto } = reservaForm
    const { error } = await supabase.from('reserva_movements').insert({ ...resto, amount: Number(reservaForm.amount) })
    if (error) { alert('Erro: ' + error.message); setSaving(false); return }
    // Baixa/credita na conta bancária de origem
    if (bank_account_id) {
      const conta = contas.find(c => c.id === bank_account_id)
      if (conta) {
        const delta = reservaForm.type === 'deposito' ? -Number(reservaForm.amount) : Number(reservaForm.amount)
        const novoSaldo = Number(conta.balance) + delta
        await supabase.from('bank_accounts').update({ balance: novoSaldo }).eq('id', bank_account_id)
        setContas(cs => cs.map(c => c.id === bank_account_id ? { ...c, balance: novoSaldo } : c))
      }
    }
    setSaving(false); setShowReservaModal(false)
    setReservaForm({ type: 'deposito', amount: '', date: new Date().toISOString().slice(0,10), description: '', bank_account_id: '' })
    fetchTudo()
  }

  async function salvarDistribuicao(e) {
    e.preventDefault(); setSaving(true)
    const monthDate = distForm.month + '-01'
    const upserts = PARCEIROS.filter(p => distForm[p]).map(p => ({
      month: monthDate, partner: p, amount: Number(distForm[p]), notes: distForm.notes || null
    }))
    for (const u of upserts) {
      const { error } = await supabase.from('profit_distributions').upsert(u, { onConflict: 'month,partner' })
      if (error) { alert('Erro: ' + error.message); setSaving(false); return }
    }
    // Baixa total da conta bancária de origem
    if (distForm.bank_account_id) {
      const conta = contas.find(c => c.id === distForm.bank_account_id)
      if (conta) {
        const total = upserts.reduce((s, u) => s + u.amount, 0)
        const novoSaldo = Number(conta.balance) - total
        await supabase.from('bank_accounts').update({ balance: novoSaldo }).eq('id', distForm.bank_account_id)
        setContas(cs => cs.map(c => c.id === distForm.bank_account_id ? { ...c, balance: novoSaldo } : c))
      }
    }
    setSaving(false); setShowDistModal(false)
    setDistForm({ month: new Date().toISOString().slice(0,7), rayssa: '', paulo: '', rilary: '', notes: '', bank_account_id: '' })
    fetchTudo()
  }

  // Reserva: saldo atual e histórico mensal
  const reservaSaldo = reservaMovements.reduce((s, m) => m.type === 'deposito' ? s + Number(m.amount) : s - Number(m.amount), 0)
  const reservaHistorico = (() => {
    const meses = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i)
      return format(startOfMonth(d), 'yyyy-MM')
    })
    let acum = 0
    const movByMonth = {}
    ;[...reservaMovements].reverse().forEach(m => {
      const k = m.date.slice(0, 7)
      if (!movByMonth[k]) movByMonth[k] = 0
      movByMonth[k] += m.type === 'deposito' ? Number(m.amount) : -Number(m.amount)
    })
    return meses.map(m => {
      acum += (movByMonth[m] || 0)
      return { mes: m.slice(5) + '/' + m.slice(0,4), saldo: acum }
    })
  })()

  // Distribuição: histórico por parceiro (últimos 12 meses)
  const distHistorico = (() => {
    const meses = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i)
      return format(startOfMonth(d), 'yyyy-MM')
    })
    return meses.map(m => {
      const row = { mes: m.slice(5) + '/' + m.slice(0,4) }
      PARCEIROS.forEach(p => {
        const dist = distributions.find(d => d.month.slice(0,7) === m && d.partner === p)
        row[p] = dist ? Number(dist.amount) : 0
      })
      return row
    })
  })()

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus2, setFiltroStatus2] = useState('')
  const [filtroDataIni, setFiltroDataIni] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')

  const transacoesFiltradas = transacoes.filter(t => {
    const q = busca.toLowerCase()
    const matchBusca = !busca || t.description?.toLowerCase().includes(q) || t.clients?.razao_social?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q)
    const matchTipo = !filtroTipo || t.type === filtroTipo
    const matchStatus = !filtroStatus2 || t.status === filtroStatus2
    const matchIni = !filtroDataIni || (t.due_date && t.due_date >= filtroDataIni)
    const matchFim = !filtroDataFim || (t.due_date && t.due_date <= filtroDataFim)
    return matchBusca && matchTipo && matchStatus && matchIni && matchFim
  })

  const tabs = [
    { key: 'visao_geral', label: 'Visão Geral', icon: '📊' },
    { key: 'contas', label: `Contas (${contas.length})`, icon: '🏦' },
    { key: 'transacoes', label: `Movimentações (${transacoesFiltradas.length})`, icon: '💳' },
    { key: 'reserva', label: 'Reserva', icon: '🐷' },
    { key: 'distribuicao', label: 'Distribuição', icon: '💰' },
  ]

  return (
    <div style={{ maxWidth: 1200 }}>
      <PageHeader
        title="Financeiro"
        subtitle="Controle de entradas, saídas e contas bancárias"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {tab === 'reserva' && <Btn onClick={() => setShowReservaModal(true)}><PiggyBank size={14} /> Movimentar Reserva</Btn>}
            {tab === 'distribuicao' && <Btn onClick={() => setShowDistModal(true)}><TrendingUp size={14} /> Registrar Distribuição</Btn>}
            {(tab === 'visao_geral' || tab === 'contas' || tab === 'transacoes') && <>
              <Btn variant="secondary" onClick={() => setShowContaModal(true)}><Landmark size={14} /> Nova Conta</Btn>
              <Btn onClick={() => setShowModal(true)}><Plus size={14} /> Nova Movimentação</Btn>
            </>}
          </div>
        }
      />

      {/* Cards Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Recebido no Mês" value={fmt(recebidoMes)} icon="📈" color="#10b981" bg="#f0fdf4" border="#bbf7d0" />
        <StatCard label="A Receber" value={fmt(aReceber)} icon="⏳" color="#3b82f6" bg="#eff6ff" border="#bfdbfe" />
        <StatCard
          label="Inadimplência"
          value={`${aReceber > 0 ? percInadimplencia : 0}%`}
          icon="⚠️"
          color={percInadimplencia > 20 ? '#ef4444' : percInadimplencia > 5 ? '#f59e0b' : '#10b981'}
          bg={percInadimplencia > 20 ? '#fef2f2' : percInadimplencia > 5 ? '#fffbeb' : '#f0fdf4'}
          border={percInadimplencia > 20 ? '#fecaca' : percInadimplencia > 5 ? '#fde68a' : '#bbf7d0'}
        />
        <StatCard label="A Pagar" value={fmt(aPagar)} icon="📉" color="#ef4444" bg="#fef2f2" border="#fecaca" />
        <StatCard label="Pagos no Mês" value={fmt(pagosMes)} icon="✅" color="#64748b" bg="#f8fafc" border="#e2e8f0" />
        <StatCard label="Reserva" value={fmt(reservaSaldo)} icon="🐷" color="#8b5cf6" bg="#f5f3ff" border="#ddd6fe" />
        <StatCard label="Dist. Total Mês" value={fmt(distributions.filter(d => d.month.slice(0,7) === new Date().toISOString().slice(0,7)).reduce((s,d) => s + Number(d.amount), 0))} icon="💰" color="#f59e0b" bg="#fffbeb" border="#fde68a" />
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {/* Filtros globais */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, marginTop: 4 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }}>🔍</span>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por descrição, cliente, categoria..."
            style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }} />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: 'white', outline: 'none', cursor: 'pointer' }}>
          <option value="">Todos os tipos</option>
          <option value="receber">A Receber</option>
          <option value="pagar">A Pagar</option>
          <option value="transferencia">Transferência</option>
        </select>
        <select value={filtroStatus2} onChange={e => setFiltroStatus2(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: 'white', outline: 'none', cursor: 'pointer' }}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <input type="date" value={filtroDataIni} onChange={e => setFiltroDataIni(e.target.value)} title="Vencimento de"
          style={{ padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: 'white', outline: 'none', cursor: 'pointer' }} />
        <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} title="Vencimento até"
          style={{ padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: 'white', outline: 'none', cursor: 'pointer' }} />
        {(busca || filtroTipo || filtroStatus2 || filtroDataIni || filtroDataFim) && (
          <button onClick={() => { setBusca(''); setFiltroTipo(''); setFiltroStatus2(''); setFiltroDataIni(''); setFiltroDataFim('') }}
            style={{ padding: '8px 14px', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 12, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* Visão Geral */}
      {tab === 'visao_geral' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 14, fontSize: 14 }}>Últimas Movimentações</div>
            {transacoesFiltradas.slice(0, 8).map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy') : '—'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.type === 'receber' ? '#10b981' : '#ef4444' }}>
                    {t.type === 'receber' ? '+' : '-'}{fmt(t.amount)}
                  </div>
                  <Badge color={statusCores[t.status]}>{t.status}</Badge>
                </div>
              </div>
            ))}
            {transacoesFiltradas.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Nenhuma movimentação encontrada.</div>}
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 14, fontSize: 14 }}>Contas Bancárias</div>
            {contas.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏦</div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.bank} · {c.type}</div>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: Number(c.balance) >= 0 ? '#10b981' : '#ef4444' }}>{fmt(c.balance)}</div>
              </div>
            ))}
            {contas.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Nenhuma conta cadastrada.</div>}
          </div>
        </div>
      )}

      {/* Contas */}
      {tab === 'contas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {contas.map(c => (
            <div key={c.id} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏦</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{c.bank}</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Saldo</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: Number(c.balance) >= 0 ? '#10b981' : '#ef4444' }}>{fmt(c.balance)}</div>
              </div>
              <div style={{ marginTop: 8 }}><Badge color="blue">{c.type}</Badge></div>
            </div>
          ))}
          {contas.length === 0 && (
            <div style={{ gridColumn: '1/-1', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏦</div>
              <div style={{ fontWeight: 600, color: '#475569' }}>Nenhuma conta cadastrada</div>
              <div style={{ marginTop: 14 }}><Btn onClick={() => setShowContaModal(true)}><Plus size={14} /> Adicionar Conta</Btn></div>
            </div>
          )}
        </div>
      )}

      {/* Transações */}
      {tab === 'transacoes' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Descrição', 'Tipo', 'Valor', 'Vencimento', 'Pgto', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</td></tr>
              ) : transacoes.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>💳</div>
                  <div style={{ fontWeight: 600, color: '#475569' }}>Nenhuma movimentação registrada</div>
                </td></tr>
              ) : transacoesFiltradas.map(t => {
                const atrasado = t.status === 'pendente' && t.due_date && new Date(t.due_date) < hoje
                const pgtoAtrasado = t.data_pagamento && t.due_date && new Date(t.data_pagamento) > new Date(t.due_date)
                return (
                <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc', background: atrasado ? '#fffbeb' : 'white' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = atrasado ? '#fffbeb' : 'white'}>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{t.description}</div>
                    {t.clients && <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.clients.razao_social}</div>}
                    {t.is_recurring && <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>↻ Recorrente</div>}
                  </td>
                  <td style={{ padding: '12px 18px' }}><Badge color={tipoCores[t.type]}>{tipoLabel[t.type] || t.type}</Badge></td>
                  <td style={{ padding: '12px 18px', fontWeight: 700, color: t.type === 'receber' ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                    {t.type === 'receber' ? '+' : '-'}{fmt(t.amount)}
                  </td>
                  <td style={{ padding: '12px 18px', color: atrasado ? '#f59e0b' : '#64748b', fontSize: 12, fontWeight: atrasado ? 700 : 400 }}>
                    {t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy') : '—'}
                    {atrasado && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>VENCIDO</div>}
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12 }}>
                    {t.data_pagamento ? (
                      <span style={{ color: pgtoAtrasado ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                        {format(parseISO(t.data_pagamento), 'dd/MM/yyyy')}
                        {pgtoAtrasado && <div style={{ fontSize: 10, color: '#f59e0b' }}>Em atraso</div>}
                      </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 18px' }}><Badge color={statusCores[t.status]}>{t.status}</Badge></td>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {t.status === 'pendente' && (
                        <>
                          <Btn size="sm" variant="success" onClick={() => setPagamentoModal({ id: t.id, status: 'pago', data_pagamento: new Date().toISOString().slice(0,10), tipo: t.type, amount: t.amount, due_date: t.due_date, bank_account_id: contas[0]?.id || '' })}>✓ {t.type === 'receber' ? 'Recebido' : 'Pago'}</Btn>
                          <Btn size="sm" variant="danger" onClick={() => alterarStatus(t.id, 'cancelado')}>✕</Btn>
                        </>
                      )}
                      <button onClick={() => abrirEdicao(t)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <Pencil size={11} /> Editar
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Aba Reserva */}
      {tab === 'reserva' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', borderRadius: 16, padding: 20, color: 'white', gridColumn: '1/2' }}>
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Saldo da Reserva</div>
              <div style={{ fontSize: 32, fontWeight: 900 }}>{fmt(reservaSaldo)}</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{reservaMovements.length} movimentações registradas</div>
            </div>
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total Depositado</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed' }}>{fmt(reservaMovements.filter(m => m.type === 'deposito').reduce((s,m) => s + Number(m.amount), 0))}</div>
            </div>
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total Retirado</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{fmt(reservaMovements.filter(m => m.type === 'retirada').reduce((s,m) => s + Number(m.amount), 0))}</div>
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14, marginBottom: 14 }}>📈 Evolução da Reserva (12 meses)</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={reservaHistorico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => 'R$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => fmt(v)} />
                <Line type="monotone" dataKey="saldo" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4 }} name="Saldo" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#1e293b', fontSize: 14 }}>Histórico de Movimentações</div>
            {reservaMovements.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🐷</div>
                <div style={{ fontWeight: 600, color: '#475569' }}>Nenhuma movimentação na reserva</div>
                <div style={{ marginTop: 14 }}><Btn onClick={() => setShowReservaModal(true)}><PiggyBank size={14} /> Primeiro Depósito</Btn></div>
              </div>
            ) : reservaMovements.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: m.type === 'deposito' ? '#f5f3ff' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    {m.type === 'deposito' ? '⬆️' : '⬇️'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{m.description || (m.type === 'deposito' ? 'Depósito' : 'Retirada')}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.date ? format(parseISO(m.date), 'dd/MM/yyyy') : '—'}</div>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: m.type === 'deposito' ? '#7c3aed' : '#ef4444' }}>
                  {m.type === 'deposito' ? '+' : '-'}{fmt(m.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aba Distribuição */}
      {tab === 'distribuicao' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {PARCEIROS.map(p => {
              const total = distributions.filter(d => d.partner === p).reduce((s,d) => s + Number(d.amount), 0)
              const mesMes = distributions.find(d => d.partner === p && d.month.slice(0,7) === new Date().toISOString().slice(0,7))
              return (
                <div key={p} style={{ background: 'white', borderRadius: 16, border: `2px solid ${PARCEIRO_COR[p]}33`, padding: 20 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: PARCEIRO_COR[p] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: PARCEIRO_COR[p] }}>
                      {PARCEIRO_LABEL[p].charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{PARCEIRO_LABEL[p]}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Sócio</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Total Acumulado</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: PARCEIRO_COR[p] }}>{fmt(total)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Este Mês</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{mesMes ? fmt(mesMes.amount) : '—'}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14, marginBottom: 14 }}>📈 Crescimento por Sócio (12 meses)</div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={distHistorico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => 'R$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                {PARCEIROS.map(p => <Line key={p} type="monotone" dataKey={p} stroke={PARCEIRO_COR[p]} strokeWidth={2.5} dot={{ r: 4 }} name={PARCEIRO_LABEL[p]} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#1e293b', fontSize: 14 }}>Histórico de Distribuições</div>
            {distributions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>💰</div>
                <div style={{ fontWeight: 600, color: '#475569' }}>Nenhuma distribuição registrada</div>
                <div style={{ marginTop: 14 }}><Btn onClick={() => setShowDistModal(true)}><TrendingUp size={14} /> Registrar Primeira Distribuição</Btn></div>
              </div>
            ) : (() => {
              const mesesUnicos = [...new Set(distributions.map(d => d.month.slice(0,7)))].sort().reverse()
              return mesesUnicos.map(mes => {
                const distMes = distributions.filter(d => d.month.slice(0,7) === mes)
                const totalMes = distMes.reduce((s,d) => s + Number(d.amount), 0)
                return (
                  <div key={mes} style={{ borderBottom: '1px solid #f8fafc', padding: '12px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                        {format(parseISO(mes + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}
                      </div>
                      <div style={{ fontWeight: 800, color: '#f59e0b' }}>Total: {fmt(totalMes)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {PARCEIROS.map(p => {
                        const d = distMes.find(x => x.partner === p)
                        return d ? (
                          <div key={p} style={{ background: PARCEIRO_COR[p] + '11', border: `1px solid ${PARCEIRO_COR[p]}33`, borderRadius: 8, padding: '6px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: PARCEIRO_COR[p], fontSize: 12 }}>{PARCEIRO_LABEL[p]}</span>
                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: 13 }}>{fmt(Number(d.amount))}</span>
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {/* Modal Reserva */}
      <Modal open={showReservaModal} onClose={() => setShowReservaModal(false)} title="Movimentar Reserva">
        <form onSubmit={salvarReserva}>
          <Select label="Tipo *" value={reservaForm.type} onChange={e => setReservaForm(f => ({ ...f, type: e.target.value }))}>
            <option value="deposito">⬆️ Depósito (transferir para reserva)</option>
            <option value="retirada">⬇️ Retirada (transferir da reserva)</option>
          </Select>
          <Select label="Conta de origem *" value={reservaForm.bank_account_id} onChange={e => setReservaForm(f => ({ ...f, bank_account_id: e.target.value }))} required>
            <option value="">Selecione a conta</option>
            {contas.map(c => <option key={c.id} value={c.id}>{c.name} — {c.bank} ({fmt(Number(c.balance))})</option>)}
          </Select>
          <Input label="Valor (R$) *" type="number" step="0.01" min="0" value={reservaForm.amount} onChange={e => setReservaForm(f => ({ ...f, amount: e.target.value }))} required />
          <Input label="Data *" type="date" value={reservaForm.date} onChange={e => setReservaForm(f => ({ ...f, date: e.target.value }))} required />
          <Input label="Descrição" value={reservaForm.description} onChange={e => setReservaForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Reserva de março..." />
          {reservaForm.bank_account_id && reservaForm.amount && (
            <div style={{ background: reservaForm.type === 'deposito' ? '#fef3c7' : '#f0fdf4', border: `1px solid ${reservaForm.type === 'deposito' ? '#fde68a' : '#bbf7d0'}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: reservaForm.type === 'deposito' ? '#92400e' : '#166534' }}>
              {reservaForm.type === 'deposito' ? '📉 Saldo da conta será reduzido em ' : '📈 Saldo da conta será aumentado em '}
              <strong>{fmt(Number(reservaForm.amount))}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowReservaModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar Transferência'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Distribuição */}
      <Modal open={showDistModal} onClose={() => setShowDistModal(false)} title="Registrar Distribuição de Lucros">
        <form onSubmit={salvarDistribuicao}>
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Mês/Ano *</label>
            <input type="month" value={distForm.month} onChange={e => setDistForm(f => ({ ...f, month: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} required />
          </div>
          <Select label="Conta de origem (débito) *" value={distForm.bank_account_id} onChange={e => setDistForm(f => ({ ...f, bank_account_id: e.target.value }))} required>
            <option value="">Selecione a conta</option>
            {contas.map(c => <option key={c.id} value={c.id}>{c.name} — {c.bank} ({fmt(Number(c.balance))})</option>)}
          </Select>
          {PARCEIROS.map(p => (
            <Input key={p} label={`${PARCEIRO_LABEL[p]} (R$)`} type="number" step="0.01" min="0"
              value={distForm[p]} onChange={e => setDistForm(f => ({ ...f, [p]: e.target.value }))} placeholder="0,00" />
          ))}
          {distForm.bank_account_id && PARCEIROS.some(p => distForm[p]) && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e' }}>
              📉 Total debitado da conta: <strong>{fmt(PARCEIROS.reduce((s,p) => s + (Number(distForm[p]) || 0), 0))}</strong>
            </div>
          )}
          <Textarea label="Observações" value={distForm.notes} onChange={e => setDistForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowDistModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Distribuição'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Transação */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditandoId(null) }} title={editandoId ? 'Editar Movimentação' : 'Nova Movimentação'} size="lg">
        <form onSubmit={salvarTransacao}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select label="Tipo *" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="receber">A Receber (entrada)</option>
              <option value="pagar">A Pagar (saída)</option>
              <option value="transferencia">Transferência</option>
            </Select>
            <Input label="Valor (R$) *" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" required />
          </div>
          <Input label="Descrição *" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Honorários - Janeiro" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Vencimento" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            <Input label="Data Pagamento" type="date" value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} />
            <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago/Recebido</option>
              <option value="cancelado">Cancelado</option>
            </Select>
          </div>
          <Select label="Cliente (opcional)" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
            <option value="">Sem cliente vinculado</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </Select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Categoria" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: Honorários, Aluguel..." />
            <Select label="Conta bancária" value={form.bank_account_id || ''} onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}>
              <option value="">Sem conta vinculada</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.name} — {c.bank}</option>)}
            </Select>
          </div>
          <Textarea label="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', marginTop: 4 }}>
            <input type="checkbox" id="is_recurring" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#3b82f6' }} />
            <label htmlFor="is_recurring" style={{ fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
              Honorário recorrente — gerar automaticamente todo dia 01
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Salvar Movimentação'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmar Pagamento */}
      <Modal open={!!pagamentoModal} onClose={() => setPagamentoModal(null)} title={pagamentoModal?.tipo === 'receber' ? 'Confirmar Recebimento' : 'Confirmar Pagamento'}>
        {pagamentoModal && (
          <form onSubmit={confirmarPagamento}>
            <Input
              label="Data do pagamento *"
              type="date"
              value={pagamentoModal.data_pagamento}
              onChange={e => setPagamentoModal(p => ({ ...p, data_pagamento: e.target.value }))}
              required
            />
            {pagamentoModal.data_pagamento && pagamentoModal.due_date && new Date(pagamentoModal.data_pagamento) > new Date(pagamentoModal.due_date) && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginTop: 4 }}>
                ⚠️ Pagamento após o vencimento — será marcado como pago em atraso.
              </div>
            )}
            <Select
              label="Conta bancária *"
              value={pagamentoModal.bank_account_id}
              onChange={e => setPagamentoModal(p => ({ ...p, bank_account_id: e.target.value }))}
              required
            >
              <option value="">Selecione a conta</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.name} — {c.bank}</option>)}
            </Select>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#475569', marginTop: 2 }}>
              {pagamentoModal.tipo === 'receber' ? '📈 Saldo da conta será aumentado em ' : '📉 Saldo da conta será reduzido em '}
              <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pagamentoModal.amount)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Btn variant="secondary" onClick={() => setPagamentoModal(null)}>Cancelar</Btn>
              <Btn type="submit">{pagamentoModal?.tipo === 'receber' ? '✓ Confirmar Recebimento' : '✓ Confirmar Pagamento'}</Btn>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Conta */}
      <Modal open={showContaModal} onClose={() => setShowContaModal(false)} title="Nova Conta Bancária">
        <form onSubmit={salvarConta}>
          <Input label="Nome da Conta *" value={contaForm.name} onChange={e => setContaForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Conta Principal" required />
          <Input label="Banco" value={contaForm.bank} onChange={e => setContaForm(f => ({ ...f, bank: e.target.value }))} placeholder="Ex: Itaú, Bradesco, Nubank..." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Saldo inicial (R$)" type="number" step="0.01" value={contaForm.balance} onChange={e => setContaForm(f => ({ ...f, balance: e.target.value }))} />
            <Select label="Tipo de Conta" value={contaForm.type} onChange={e => setContaForm(f => ({ ...f, type: e.target.value }))}>
              <option value="corrente">Conta Corrente</option>
              <option value="poupanca">Poupança</option>
              <option value="investimento">Investimento</option>
              <option value="outro">Outro</option>
            </Select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowContaModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Conta'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
