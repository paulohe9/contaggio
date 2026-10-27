import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea, StatCard, TabBar } from '../../components/ui'
import { Plus, Landmark, PiggyBank, TrendingUp, Pencil, Undo2, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { hojeISO, isoDe, addMesesISO, fmtData, fmtBRL, inputBase } from '../../lib/util'
import EmitirNfse from './EmitirNfse'
import NotasFiscais from './NotasFiscais'

const PARCEIROS = ['rayssa', 'paulo', 'rilary']
const PARCEIRO_COR = { rayssa: '#8b5cf6', paulo: '#3b82f6', rilary: '#f59e0b' }
const PARCEIRO_LABEL = { rayssa: 'Rayssa', paulo: 'Paulo', rilary: 'Rilary' }

const tipoCores = { receber: 'green', pagar: 'red', transferencia: 'blue' }
const statusCores = { pendente: 'yellow', pago: 'green', cancelado: 'slate', atrasado: 'red' }
const tipoLabel = { receber: 'Receber', pagar: 'Pagar', transferencia: 'Transferência' }

// Categorias separadas por tipo — no "A Receber" só aparecem as de receita, no "A Pagar" só as de despesa
const CAT_RECEBER = [
  'Honorários', 'Regularização de Obra', 'Abertura / Legalização', 'Serviço Avulso',
  'Reembolso de Despesas', 'Receita Extraordinária', 'Outros',
]
const CAT_PAGAR = [
  'Imposto Federal', 'Imposto Estadual', 'Imposto Municipal', 'Simples Nacional', 'FGTS', 'INSS',
  'Folha de Pagamento', 'Pró-labore', 'Distribuição de Lucros', 'Reserva Financeira', 'Aluguel',
  'Energia / Água / Internet', 'Sistemas / Softwares', 'Fornecedor', 'Despesa Administrativa',
  'Marketing', 'Investimento', 'Comissão', 'Tarifas Bancárias', 'Multa / Juros', 'Outros',
]
const CATS = { receber: CAT_RECEBER, pagar: CAT_PAGAR }

const filtroInicial = {
  busca: '', situacao: 'abertos', categoria: '', cliente: '', conta: '', recorrencia: '',
  campoData: 'due_date', periodo: 'todos', ini: '', fim: '',
}

const tituloVazio = {
  description: '', amount: '', due_date: '', client_id: '', category: '', notes: '',
  is_recurring: false, parcelas: 1, pagoAgora: false, data_pagamento: '', bank_account_id: '',
}

export default function Financeiro() {
  const [transacoes, setTransacoes] = useState([])
  const [contas, setContas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('visao_geral')
  const [saving, setSaving] = useState(false)
  const [showContaModal, setShowContaModal] = useState(false)
  const [contaForm, setContaForm] = useState({ name: '', bank: '', balance: '0', type: 'corrente' })
  const [filtros, setFiltros] = useState({ receber: { ...filtroInicial }, pagar: { ...filtroInicial } })
  const [tituloModal, setTituloModal] = useState(null) // { id?, tipo, pago?, form }
  const [baixa, setBaixa] = useState(null)              // { t, data_pagamento, bank_account_id }
  const [nfseTitulo, setNfseTitulo] = useState(null)    // título a receber em emissão de NFS-e
  const [notasPorTitulo, setNotasPorTitulo] = useState({})
  // Reserva
  const [reservaMovements, setReservaMovements] = useState([])
  const [showReservaModal, setShowReservaModal] = useState(false)
  const [reservaForm, setReservaForm] = useState({ type: 'deposito', amount: '', date: hojeISO(), description: '', bank_account_id: '' })
  // Distribuição
  const [distributions, setDistributions] = useState([])
  const [showDistModal, setShowDistModal] = useState(false)
  const [distForm, setDistForm] = useState({ month: hojeISO().slice(0, 7), rayssa: '', paulo: '', rilary: '', notes: '', bank_account_id: '' })

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [tRes, cRes, clRes, rRes, dRes] = await Promise.all([
      supabase.from('financial_transactions').select('*, clients(razao_social)').order('due_date', { ascending: true }),
      supabase.from('bank_accounts').select('*').order('name'),
      supabase.from('clients').select('id, razao_social, telefone').order('razao_social'),
      supabase.from('reserva_movements').select('*').order('date', { ascending: false }),
      supabase.from('profit_distributions').select('*').order('month', { ascending: false }),
    ])
    setTransacoes(tRes.data || [])
    setContas(cRes.data || [])
    setClientes(clRes.data || [])
    setReservaMovements(rRes.data || [])
    setDistributions(dRes.data || [])
    setLoading(false)
    carregarNotas()
  }

  async function carregarNotas() {
    const { data } = await supabase.from('nfse_notas').select('transaction_id, numero_nfse, status, ambiente').not('transaction_id', 'is', null)
    const mapa = {}
    for (const n of data || []) {
      const atual = mapa[n.transaction_id]
      if (!atual || n.status === 'autorizada') mapa[n.transaction_id] = n
    }
    setNotasPorTitulo(mapa)
  }

  const fmt = fmtBRL
  const hoje = hojeISO()
  const em7dias = hojeISO(7)
  const mesAtual = hoje.slice(0, 7)
  const nomeConta = (id) => { const c = contas.find(x => x.id === id); return c ? c.name : '' }

  // ─── Situação de cada título ───
  function situacao(t) {
    if (t.status === 'pago') return 'pago'
    if (t.status === 'cancelado') return 'cancelado'
    if (t.due_date && t.due_date < hoje) return 'vencido'
    return 'aberto'
  }
  const diasEntre = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)

  function intervaloPeriodo(f) {
    const d = new Date()
    if (f.periodo === 'mes_atual') return [isoDe(new Date(d.getFullYear(), d.getMonth(), 1)), isoDe(new Date(d.getFullYear(), d.getMonth() + 1, 0))]
    if (f.periodo === 'mes_anterior') return [isoDe(new Date(d.getFullYear(), d.getMonth() - 1, 1)), isoDe(new Date(d.getFullYear(), d.getMonth(), 0))]
    if (f.periodo === 'proximo_mes') return [isoDe(new Date(d.getFullYear(), d.getMonth() + 1, 1)), isoDe(new Date(d.getFullYear(), d.getMonth() + 2, 0))]
    if (f.periodo === 'personalizado') return [f.ini || null, f.fim || null]
    return [null, null]
  }

  function titulosDo(tipo) {
    const f = filtros[tipo]
    const [ini, fim] = intervaloPeriodo(f)
    const q = f.busca.toLowerCase()
    const lista = transacoes.filter(t => {
      if (t.type !== tipo) return false
      const sit = situacao(t)
      if (f.situacao === 'abertos' && !['aberto', 'vencido'].includes(sit)) return false
      if (f.situacao === 'vencidos' && sit !== 'vencido') return false
      if (f.situacao === 'a_vencer_7' && !(sit === 'aberto' && t.due_date && t.due_date <= em7dias)) return false
      if (f.situacao === 'pagos' && sit !== 'pago') return false
      if (f.situacao === 'cancelados' && sit !== 'cancelado') return false
      if (q && !`${t.description || ''} ${t.clients?.razao_social || ''} ${t.category || ''} ${t.notes || ''}`.toLowerCase().includes(q)) return false
      if (f.categoria && t.category !== f.categoria) return false
      if (f.cliente && t.client_id !== f.cliente) return false
      if (f.conta && t.bank_account_id !== f.conta) return false
      if (f.recorrencia === 'sim' && !t.is_recurring) return false
      if (f.recorrencia === 'nao' && t.is_recurring) return false
      const dataRef = f.campoData === 'data_pagamento' ? t.data_pagamento : t.due_date
      if (ini && (!dataRef || dataRef < ini)) return false
      if (fim && (!dataRef || dataRef > fim)) return false
      return true
    })
    return lista.sort((a, b) => f.situacao === 'pagos'
      ? (b.data_pagamento || '').localeCompare(a.data_pagamento || '')
      : (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  }

  // ─── Indicadores ───
  const soma = (arr) => arr.reduce((s, t) => s + Number(t.amount || 0), 0)
  const doTipo = (tipo) => transacoes.filter(t => t.type === tipo)
  function indicadores(tipo) {
    const ts = doTipo(tipo)
    const abertos = ts.filter(t => ['aberto', 'vencido'].includes(situacao(t)))
    const vencidos = ts.filter(t => situacao(t) === 'vencido')
    const prox7 = ts.filter(t => situacao(t) === 'aberto' && t.due_date && t.due_date <= em7dias)
    const pagosMes = ts.filter(t => t.status === 'pago' && (t.data_pagamento || '').slice(0, 7) === mesAtual)
    return { abertos, vencidos, prox7, pagosMes }
  }
  const indR = indicadores('receber')
  const indP = indicadores('pagar')
  const saldoTotal = contas.reduce((s, c) => s + Number(c.balance), 0)
  const percInadimplencia = soma(indR.abertos) > 0 ? Math.round(soma(indR.vencidos) / soma(indR.abertos) * 100) : 0

  // ─── Saldo bancário ───
  async function ajustarSaldo(contaId, delta) {
    if (!contaId || !delta) return
    const { data: atual } = await supabase.from('bank_accounts').select('balance').eq('id', contaId).single()
    const novo = Number(atual?.balance || 0) + delta
    await supabase.from('bank_accounts').update({ balance: novo }).eq('id', contaId)
    setContas(cs => cs.map(c => c.id === contaId ? { ...c, balance: novo } : c))
  }

  // ─── Títulos ───
  function novoTitulo(tipo) {
    setTituloModal({ tipo, form: { ...tituloVazio, due_date: hoje, data_pagamento: hoje, bank_account_id: contas[0]?.id || '' } })
  }
  function editarTitulo(t) {
    setTituloModal({
      id: t.id, tipo: t.type, pago: t.status === 'pago',
      form: { ...tituloVazio, description: t.description || '', amount: t.amount ?? '', due_date: t.due_date || '', client_id: t.client_id || '', category: t.category || '', notes: t.notes || '', is_recurring: !!t.is_recurring },
    })
  }
  const setTF = (campo, valor) => setTituloModal(m => ({ ...m, form: { ...m.form, [campo]: valor } }))

  async function salvarTitulo(e) {
    e.preventDefault(); setSaving(true)
    const { id, tipo, form: f } = tituloModal
    const base = {
      type: tipo,
      description: f.description.trim(),
      amount: Number(f.amount),
      due_date: f.due_date || null,
      client_id: f.client_id || null,
      category: f.category || null,
      notes: f.notes || null,
      is_recurring: !!f.is_recurring,
    }
    let error
    if (id) {
      if (tituloModal.pago) delete base.amount // valor de título baixado só muda estornando
      ;({ error } = await supabase.from('financial_transactions').update({ ...base, updated_at: new Date().toISOString() }).eq('id', id))
    } else {
      const n = f.is_recurring ? 1 : Math.max(1, Math.min(60, Number(f.parcelas) || 1))
      const pagarJa = tipo === 'pagar' && f.pagoAgora && n === 1
      if (pagarJa && !f.bank_account_id) { setSaving(false); alert('Selecione a conta bancária do pagamento.'); return }
      const registros = Array.from({ length: n }, (_, i) => ({
        ...base,
        description: n > 1 ? `${base.description} (${i + 1}/${n})` : base.description,
        due_date: base.due_date ? addMesesISO(base.due_date, i) : null,
        status: pagarJa ? 'pago' : 'pendente',
        data_pagamento: pagarJa ? (f.data_pagamento || hoje) : null,
        bank_account_id: pagarJa ? f.bank_account_id : null,
      }))
      ;({ error } = await supabase.from('financial_transactions').insert(registros))
      if (!error && pagarJa) await ajustarSaldo(f.bank_account_id, -Number(f.amount))
    }
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setTituloModal(null)
    fetchTudo()
  }

  function abrirBaixa(t) {
    setBaixa({ t, data_pagamento: hoje, bank_account_id: contas[0]?.id || '' })
  }
  async function confirmarBaixa(e) {
    e.preventDefault(); setSaving(true)
    const { t, data_pagamento, bank_account_id } = baixa
    const { error } = await supabase.from('financial_transactions')
      .update({ status: 'pago', data_pagamento, bank_account_id, updated_at: new Date().toISOString() }).eq('id', t.id)
    if (error) { setSaving(false); alert('Erro na baixa: ' + error.message); return }
    await ajustarSaldo(bank_account_id, t.type === 'receber' ? Number(t.amount) : -Number(t.amount))
    setTransacoes(ts => ts.map(x => x.id === t.id ? { ...x, status: 'pago', data_pagamento, bank_account_id } : x))
    setSaving(false); setBaixa(null)
    if (t.type === 'receber') fetchTudo() // traz a comissão gerada automaticamente, se houver
  }
  async function estornar(t) {
    if (!confirm(`Estornar a baixa de "${t.description}"?\nO título volta para "em aberto"${t.bank_account_id ? ' e o saldo da conta é corrigido' : ''}.`)) return
    const { error } = await supabase.from('financial_transactions')
      .update({ status: 'pendente', data_pagamento: null, bank_account_id: null, updated_at: new Date().toISOString() }).eq('id', t.id)
    if (error) { alert('Erro: ' + error.message); return }
    await ajustarSaldo(t.bank_account_id, t.type === 'receber' ? -Number(t.amount) : Number(t.amount))
    setTransacoes(ts => ts.map(x => x.id === t.id ? { ...x, status: 'pendente', data_pagamento: null, bank_account_id: null } : x))
    if (t.type === 'receber') fetchTudo() // a comissão pendente é cancelada junto
  }
  async function mudarStatus(t, status) {
    await supabase.from('financial_transactions').update({ status, updated_at: new Date().toISOString() }).eq('id', t.id)
    setTransacoes(ts => ts.map(x => x.id === t.id ? { ...x, status } : x))
  }
  async function excluir(t) {
    if (!confirm(`Excluir o título "${t.description}"? Essa ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('financial_transactions').delete().eq('id', t.id)
    if (error) { alert('Erro: ' + error.message); return }
    setTransacoes(ts => ts.filter(x => x.id !== t.id))
  }

  async function salvarConta(e) {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('bank_accounts').insert({ ...contaForm, balance: Number(contaForm.balance) })
    if (error) { alert('Erro ao salvar conta: ' + error.message); setSaving(false); return }
    setSaving(false); setShowContaModal(false)
    setContaForm({ name: '', bank: '', balance: '0', type: 'corrente' })
    fetchTudo()
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

  // Import Asaas
  const [showImportModal, setShowImportModal] = useState(false)
  const [importLinhas, setImportLinhas] = useState([])
  const [importSelecionadas, setImportSelecionadas] = useState([])
  const [importando, setImportando] = useState(false)
  const [importContaId, setImportContaId] = useState('')

  function lerArquivoAsaas(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const linhas = text.split(/\r?\n/).filter(l => l.trim())
      if (linhas.length < 2) { alert('Arquivo vazio ou sem dados.'); return }
      const sep = linhas[0].includes(';') ? ';' : ','
      const headers = linhas[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase())

      const col = (row, names) => {
        for (const n of names) {
          const idx = headers.findIndex(h => h.includes(n))
          if (idx >= 0) return row[idx]?.replace(/"/g, '').trim() || ''
        }
        return ''
      }

      const rows = linhas.slice(1).map(linha => {
        const row = linha.split(sep)
        const valorRaw = col(row, ['valor', 'value', 'amount']).replace(/[^\d,.-]/g, '').replace(',', '.')
        const valor = parseFloat(valorRaw) || 0
        const statusRaw = col(row, ['status', 'situacao', 'situação']).toLowerCase()
        const tipoRaw = col(row, ['tipo', 'type', 'natureza']).toLowerCase()

        const status = statusRaw.includes('recebi') || statusRaw.includes('paid') || statusRaw.includes('pago') ? 'pago'
          : statusRaw.includes('cancel') ? 'cancelado' : 'pendente'

        const type = tipoRaw.includes('receiv') || tipoRaw.includes('entrada') || tipoRaw.includes('crédito') || tipoRaw.includes('credit') ? 'receber'
          : tipoRaw.includes('pay') || tipoRaw.includes('saída') || tipoRaw.includes('débito') || tipoRaw.includes('debit') ? 'pagar'
          : valor >= 0 ? 'receber' : 'pagar'

        const dueDateRaw = col(row, ['vencimento', 'due', 'duedate', 'data venc'])
        const payDateRaw = col(row, ['pagamento', 'payment', 'paydate', 'data pag'])

        const parseData = (raw) => {
          if (!raw) return ''
          const parts = raw.split(/[\/\-]/)
          if (parts.length === 3) {
            if (parts[0].length === 4) return raw.slice(0, 10)
            return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
          }
          return ''
        }

        return {
          description: col(row, ['descrição', 'descricao', 'description', 'historico', 'histórico']) || 'Importado Asaas',
          type,
          amount: Math.abs(valor),
          due_date: parseData(dueDateRaw),
          data_pagamento: parseData(payDateRaw),
          status,
          category: col(row, ['categoria', 'category']) || '',
          _raw: linha,
        }
      }).filter(r => r.amount > 0)
      setImportLinhas(rows)
      setImportSelecionadas(rows.map((_, i) => i))
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function confirmarImport() {
    if (!importSelecionadas.length) return
    setImportando(true)
    const registros = importSelecionadas.map(i => ({
      ...importLinhas[i],
      bank_account_id: importContaId || null,
      is_recurring: false,
      _raw: undefined,
    }))
    const { error } = await supabase.from('financial_transactions').insert(registros)
    if (error) { alert('Erro ao importar: ' + error.message); setImportando(false); return }
    setImportando(false)
    setShowImportModal(false)
    setImportLinhas([])
    setImportSelecionadas([])
    fetchTudo()
    alert(`${registros.length} transação(ões) importada(s) com sucesso!`)
  }

  function exportarCSV(tipo) {
    const lista = titulosDo(tipo)
    const cab = ['Descrição', 'Cliente', 'Categoria', 'Vencimento', 'Valor', 'Situação', 'Data pagamento', 'Conta', 'Recorrente', 'Observações']
    const q = (s) => `"${(s || '').toString().replace(/"/g, '""')}"`
    const linhas = lista.map(t => [
      q(t.description), q(t.clients?.razao_social), q(t.category), fmtData(t.due_date),
      Number(t.amount).toFixed(2).replace('.', ','), situacao(t), t.data_pagamento ? fmtData(t.data_pagamento) : '',
      q(nomeConta(t.bank_account_id)), t.is_recurring ? 'Sim' : 'Não', q(t.notes),
    ])
    const csv = [cab, ...linhas].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tipo === 'receber' ? 'contas_a_receber' : 'contas_a_pagar'}_${hoje}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { key: 'visao_geral', label: 'Visão Geral', icon: '📊' },
    { key: 'receber', label: `A Receber (${indR.abertos.length})`, icon: '📥' },
    { key: 'pagar', label: `A Pagar (${indP.abertos.length})`, icon: '📤' },
    { key: 'notas', label: 'Notas fiscais', icon: '🧾' },
    { key: 'contas', label: `Contas (${contas.length})`, icon: '🏦' },
    { key: 'reserva', label: 'Reserva', icon: '🐷' },
    { key: 'distribuicao', label: 'Distribuição', icon: '💰' },
  ]

  // ─── Pedaços de UI ───
  function situacaoCell(t) {
    const sit = situacao(t)
    if (sit === 'pago') return (
      <div>
        <Badge color="green">{t.type === 'receber' ? 'Recebido' : 'Pago'} {fmtData(t.data_pagamento)}</Badge>
        {t.bank_account_id && <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 3 }}>🏦 {nomeConta(t.bank_account_id)}</div>}
        {t.data_pagamento && t.due_date && t.data_pagamento > t.due_date && <div style={{ fontSize: 10.5, color: '#d97706', marginTop: 2 }}>pago com atraso</div>}
      </div>
    )
    if (sit === 'cancelado') return <Badge color="slate">Cancelado</Badge>
    if (sit === 'vencido') return <Badge color="red">Vencido há {diasEntre(t.due_date, hoje)}d</Badge>
    const d = t.due_date ? diasEntre(hoje, t.due_date) : null
    return <Badge color={d !== null && d <= 3 ? 'orange' : 'yellow'}>{d === 0 ? 'Vence hoje' : d === 1 ? 'Vence amanhã' : 'Em aberto'}</Badge>
  }

  const selStyle = { ...inputBase, cursor: 'pointer' }

  function barraFiltros(tipo) {
    const f = filtros[tipo]
    const set = (campo, valor) => setFiltros(fs => ({ ...fs, [tipo]: { ...fs[tipo], [campo]: valor } }))
    const alterado = JSON.stringify(f) !== JSON.stringify(filtroInicial)
    const situacoes = [
      ['abertos', 'Em aberto'], ['vencidos', 'Vencidos'], ['a_vencer_7', 'Vencem em 7 dias'],
      ['pagos', tipo === 'receber' ? 'Recebidos' : 'Pagos'], ['cancelados', 'Cancelados'], ['todos', 'Todos'],
    ]
    return (
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {situacoes.map(([v, l]) => (
            <button key={v} onClick={() => set('situacao', v)} style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
              border: f.situacao === v ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: f.situacao === v ? '#2563eb' : 'white', color: f.situacao === v ? 'white' : '#475569',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={f.busca} onChange={e => set('busca', e.target.value)} placeholder="🔍 Buscar descrição, cliente, observação..." style={{ ...inputBase, flex: 1, minWidth: 200 }} />
          <select value={f.categoria} onChange={e => set('categoria', e.target.value)} style={selStyle}>
            <option value="">Todas as categorias</option>
            {CATS[tipo].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {tipo === 'receber' && (
            <select value={f.cliente} onChange={e => set('cliente', e.target.value)} style={{ ...selStyle, maxWidth: 220 }}>
              <option value="">Todos os clientes</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
            </select>
          )}
          <select value={f.conta} onChange={e => set('conta', e.target.value)} style={selStyle}>
            <option value="">Todas as contas</option>
            {contas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={f.recorrencia} onChange={e => set('recorrencia', e.target.value)} style={selStyle}>
            <option value="">Recorrentes e avulsos</option>
            <option value="sim">Só recorrentes</option>
            <option value="nao">Só avulsos</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <select value={f.campoData} onChange={e => set('campoData', e.target.value)} style={selStyle}>
            <option value="due_date">Data de vencimento</option>
            <option value="data_pagamento">Data de {tipo === 'receber' ? 'recebimento' : 'pagamento'}</option>
          </select>
          <select value={f.periodo} onChange={e => set('periodo', e.target.value)} style={selStyle}>
            <option value="todos">Qualquer período</option>
            <option value="mes_atual">Este mês</option>
            <option value="mes_anterior">Mês passado</option>
            <option value="proximo_mes">Próximo mês</option>
            <option value="personalizado">Personalizado</option>
          </select>
          {f.periodo === 'personalizado' && <>
            <input type="date" value={f.ini} onChange={e => set('ini', e.target.value)} style={selStyle} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>até</span>
            <input type="date" value={f.fim} onChange={e => set('fim', e.target.value)} style={selStyle} />
          </>}
          {alterado && (
            <button onClick={() => setFiltros(fs => ({ ...fs, [tipo]: { ...filtroInicial } }))}
              style={{ padding: '8px 12px', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 12, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>
    )
  }

  function tabelaTitulos(tipo) {
    const lista = titulosDo(tipo)
    const cor = tipo === 'receber' ? '#059669' : '#dc2626'
    return (
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {[tipo === 'receber' ? 'Cliente / Descrição' : 'Descrição', 'Categoria', 'Vencimento', 'Valor', 'Situação', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: h === 'Valor' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>{tipo === 'receber' ? '📥' : '📤'}</div>
                  <div style={{ fontWeight: 600, color: '#475569' }}>Nenhum título encontrado com esses filtros</div>
                </td></tr>
              ) : lista.map(t => {
                const sit = situacao(t)
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', background: sit === 'vencido' ? '#fffbeb' : 'white' }}>
                    <td style={{ padding: '11px 16px', maxWidth: 320 }}>
                      {tipo === 'receber' && t.clients && <div style={{ fontWeight: 700, color: '#1e293b' }}>{t.clients.razao_social}</div>}
                      <div style={{ fontWeight: tipo === 'receber' && t.clients ? 400 : 600, color: tipo === 'receber' && t.clients ? '#64748b' : '#1e293b', fontSize: tipo === 'receber' && t.clients ? 12 : 13 }}>{t.description}</div>
                      {t.is_recurring && <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700 }}>↻ Recorrente</span>}
                      {t.notes && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.notes}</div>}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: '#64748b' }}>{t.category || '—'}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: sit === 'vencido' ? '#dc2626' : '#475569', fontWeight: sit === 'vencido' ? 700 : 400, whiteSpace: 'nowrap' }}>{fmtData(t.due_date)}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 800, color: sit === 'cancelado' ? '#94a3b8' : cor, fontFamily: 'monospace', whiteSpace: 'nowrap', textDecoration: sit === 'cancelado' ? 'line-through' : 'none' }}>{fmt(t.amount)}</td>
                    <td style={{ padding: '11px 16px' }}>
                      {situacaoCell(t)}
                      {tipo === 'receber' && notasPorTitulo[t.id] && (
                        <div style={{ fontSize: 10.5, marginTop: 3, fontWeight: 700, color: notasPorTitulo[t.id].status === 'autorizada' ? '#059669' : '#b45309' }}>
                          🧾 {notasPorTitulo[t.id].status === 'autorizada' ? `NFS-e nº ${notasPorTitulo[t.id].numero_nfse}${notasPorTitulo[t.id].ambiente !== 'producao' ? ' (teste)' : ''}` : `NFS-e ${notasPorTitulo[t.id].status.replace('_', ' ')}`}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {(sit === 'aberto' || sit === 'vencido') && (
                          <Btn size="sm" variant="success" onClick={() => abrirBaixa(t)}>✓ Baixar</Btn>
                        )}
                        {sit === 'pago' && (
                          <button title="Estornar baixa" onClick={() => estornar(t)} style={miniBtn}><Undo2 size={12} /> Estornar</button>
                        )}
                        {tipo === 'receber' && sit !== 'cancelado' && notasPorTitulo[t.id]?.status !== 'autorizada' && (
                          <button title="Emitir NFS-e" onClick={() => setNfseTitulo(t)} style={{ ...miniBtn, color: '#7c3aed', borderColor: '#ddd6fe', background: '#f5f3ff' }}>🧾 NFS-e</button>
                        )}
                        <button title="Editar" onClick={() => editarTitulo(t)} style={miniBtn}><Pencil size={12} /></button>
                        {(sit === 'aberto' || sit === 'vencido') && (
                          <button title="Cancelar título" onClick={() => mudarStatus(t, 'cancelado')} style={{ ...miniBtn, color: '#dc2626' }}>✕</button>
                        )}
                        {sit === 'cancelado' && (
                          <button title="Reativar" onClick={() => mudarStatus(t, 'pendente')} style={miniBtn}>↺</button>
                        )}
                        {sit !== 'pago' && (
                          <button title="Excluir" onClick={() => excluir(t)} style={{ ...miniBtn, color: '#dc2626' }}><Trash2 size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {lista.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  <td colSpan={3} style={{ padding: '11px 16px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{lista.length} título(s)</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 900, color: cor, fontFamily: 'monospace' }}>{fmt(soma(lista.filter(t => t.status !== 'cancelado')))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    )
  }

  function listaResumo(tipo, titulo, titulos) {
    return (
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{titulo}</div>
          <button onClick={() => setTab(tipo)} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver todos →</button>
        </div>
        {titulos.slice(0, 8).map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f1f5f9', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.clients?.razao_social || t.description}</div>
              <div style={{ fontSize: 11, color: situacao(t) === 'vencido' ? '#dc2626' : '#94a3b8', fontWeight: situacao(t) === 'vencido' ? 700 : 400 }}>
                {fmtData(t.due_date)}{situacao(t) === 'vencido' ? ' · vencido' : ''}
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: tipo === 'receber' ? '#059669' : '#dc2626', whiteSpace: 'nowrap' }}>{fmt(t.amount)}</div>
            <Btn size="sm" variant="success" onClick={() => abrirBaixa(t)}>✓</Btn>
          </div>
        ))}
        {titulos.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 13 }}>Nada pendente nos próximos 7 dias 🎉</div>}
      </div>
    )
  }

  const pendentesProximos = (ind) => [...ind.vencidos, ...ind.prox7].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))

  return (
    <div style={{ maxWidth: 1240 }}>
      <PageHeader
        title="Financeiro"
        subtitle="Lance os títulos e dê baixa quando o pagamento acontecer"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tab === 'visao_geral' && <>
              <Btn variant="secondary" onClick={() => novoTitulo('pagar')}><Plus size={14} /> A Pagar</Btn>
              <Btn onClick={() => novoTitulo('receber')}><Plus size={14} /> A Receber</Btn>
            </>}
            {tab === 'receber' && <>
              <Btn variant="secondary" onClick={() => exportarCSV('receber')}>⬇ Exportar CSV</Btn>
              <Btn variant="secondary" onClick={() => setShowImportModal(true)}>⬆ Importar Asaas</Btn>
              <Btn onClick={() => novoTitulo('receber')}><Plus size={14} /> Novo título a receber</Btn>
            </>}
            {tab === 'pagar' && <>
              <Btn variant="secondary" onClick={() => exportarCSV('pagar')}>⬇ Exportar CSV</Btn>
              <Btn onClick={() => novoTitulo('pagar')}><Plus size={14} /> Nova conta a pagar</Btn>
            </>}
            {tab === 'contas' && <Btn onClick={() => setShowContaModal(true)}><Landmark size={14} /> Nova Conta</Btn>}
            {tab === 'reserva' && <Btn onClick={() => setShowReservaModal(true)}><PiggyBank size={14} /> Movimentar Reserva</Btn>}
            {tab === 'distribuicao' && <Btn onClick={() => setShowDistModal(true)}><TrendingUp size={14} /> Registrar Distribuição</Btn>}
          </div>
        }
      />

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {/* ─── VISÃO GERAL ─── */}
      {tab === 'visao_geral' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 18 }}>
            <StatCard label="Saldo em contas" value={fmt(saldoTotal)} icon="🏦" bg="#eff6ff" border="#bfdbfe" />
            <StatCard label="A receber" value={fmt(soma(indR.abertos))} icon="📥" bg="#f0fdf4" border="#bbf7d0" />
            <StatCard label="A pagar" value={fmt(soma(indP.abertos))} icon="📤" bg="#fef2f2" border="#fecaca" />
            <StatCard label="Recebido no mês" value={fmt(soma(indR.pagosMes))} icon="📈" bg="#f0fdf4" border="#bbf7d0" />
            <StatCard label="Pago no mês" value={fmt(soma(indP.pagosMes))} icon="📉" bg="#f8fafc" border="#e2e8f0" />
            <StatCard label="Resultado do mês" value={fmt(soma(indR.pagosMes) - soma(indP.pagosMes))} icon="⚖️" bg="#fffbeb" border="#fde68a" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {listaResumo('receber', '📥 A receber · vencidos e próximos 7 dias', pendentesProximos(indR))}
            {listaResumo('pagar', '📤 A pagar · vencidos e próximos 7 dias', pendentesProximos(indP))}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 18 }}>
              <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 10, fontSize: 14 }}>🏦 Contas bancárias</div>
              {contas.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.bank}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: Number(c.balance) >= 0 ? '#059669' : '#dc2626' }}>{fmt(c.balance)}</div>
                </div>
              ))}
              {contas.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 16, fontSize: 13 }}>
                  Nenhuma conta cadastrada.
                  <div style={{ marginTop: 10 }}><Btn size="sm" onClick={() => setShowContaModal(true)}><Landmark size={13} /> Cadastrar conta</Btn></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── A RECEBER ─── */}
      {tab === 'receber' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
            <StatCard label="Em aberto" value={fmt(soma(indR.abertos))} icon="⏳" bg="#eff6ff" border="#bfdbfe" />
            <StatCard label={`Vencido (${indR.vencidos.length})`} value={fmt(soma(indR.vencidos))} icon="⚠️" bg="#fef2f2" border="#fecaca" />
            <StatCard label="Vence em 7 dias" value={fmt(soma(indR.prox7))} icon="📅" bg="#fffbeb" border="#fde68a" />
            <StatCard label="Recebido no mês" value={fmt(soma(indR.pagosMes))} icon="✅" bg="#f0fdf4" border="#bbf7d0" />
            <StatCard label="Inadimplência" value={`${percInadimplencia}%`} icon="📊"
              bg={percInadimplencia > 20 ? '#fef2f2' : percInadimplencia > 5 ? '#fffbeb' : '#f0fdf4'}
              border={percInadimplencia > 20 ? '#fecaca' : percInadimplencia > 5 ? '#fde68a' : '#bbf7d0'} />
          </div>
          {barraFiltros('receber')}
          {tabelaTitulos('receber')}
        </div>
      )}

      {/* ─── NOTAS FISCAIS ─── */}
      {tab === 'notas' && <NotasFiscais />}

      {/* ─── A PAGAR ─── */}
      {tab === 'pagar' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            <StatCard label="Em aberto" value={fmt(soma(indP.abertos))} icon="⏳" bg="#fef2f2" border="#fecaca" />
            <StatCard label={`Vencido (${indP.vencidos.length})`} value={fmt(soma(indP.vencidos))} icon="⚠️" bg="#fef2f2" border="#fecaca" />
            <StatCard label="Vence em 7 dias" value={fmt(soma(indP.prox7))} icon="📅" bg="#fffbeb" border="#fde68a" />
            <StatCard label="Pago no mês" value={fmt(soma(indP.pagosMes))} icon="✅" bg="#f8fafc" border="#e2e8f0" />
          </div>
          {barraFiltros('pagar')}
          {tabelaTitulos('pagar')}
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

      {/* ─── Modal: novo / editar título ─── */}
      <Modal open={!!tituloModal} onClose={() => setTituloModal(null)} size="lg"
        title={tituloModal ? `${tituloModal.id ? 'Editar' : 'Novo'} título ${tituloModal.tipo === 'receber' ? 'a receber' : 'a pagar'}` : ''}>
        {tituloModal && (() => {
          const { tipo, form: f, id, pago } = tituloModal
          return (
            <form onSubmit={salvarTitulo}>
              {tipo === 'receber' && (
                <Select label="Cliente" value={f.client_id} onChange={e => setTF('client_id', e.target.value)}>
                  <option value="">Sem cliente vinculado</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                </Select>
              )}
              <Input label={tipo === 'receber' ? 'Descrição *' : 'Descrição / Favorecido *'} value={f.description} onChange={e => setTF('description', e.target.value)}
                placeholder={tipo === 'receber' ? 'Ex: Honorários outubro/2026' : 'Ex: Aluguel da sala — Imobiliária X'} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Input label="Valor (R$) *" type="number" step="0.01" min="0.01" value={f.amount} onChange={e => setTF('amount', e.target.value)} required disabled={pago} />
                <Input label="Vencimento *" type="date" value={f.due_date} onChange={e => setTF('due_date', e.target.value)} required />
                <Select label="Categoria" value={f.category} onChange={e => setTF('category', e.target.value)}>
                  <option value="">Sem categoria</option>
                  {CATS[tipo].map(c => <option key={c} value={c}>{c}</option>)}
                  {f.category && !CATS[tipo].includes(f.category) && <option value={f.category}>{f.category}</option>}
                </Select>
              </div>
              {pago && <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 10px', marginTop: -4, marginBottom: 12 }}>Este título já foi baixado. Para alterar o valor, estorne a baixa primeiro.</div>}
              <Textarea label="Observações" value={f.notes} onChange={e => setTF('notes', e.target.value)} rows={2} />

              {!id && (
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', padding: '4px 0 10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.is_recurring} onChange={e => setTF('is_recurring', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} />
                    Recorrente (gera automaticamente todo mês)
                  </label>
                  {!f.is_recurring && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                      Repetir em
                      <input type="number" min="1" max="60" value={f.parcelas} onChange={e => setTF('parcelas', e.target.value)} style={{ ...inputBase, width: 64, padding: '6px 8px' }} />
                      parcela(s) mensais
                    </label>
                  )}
                </div>
              )}
              {id && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', paddingBottom: 10 }}>
                  <input type="checkbox" checked={f.is_recurring} onChange={e => setTF('is_recurring', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} />
                  Recorrente (gera automaticamente todo mês)
                </label>
              )}

              {!id && tipo === 'pagar' && Number(f.parcelas) <= 1 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', marginBottom: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.pagoAgora} onChange={e => setTF('pagoAgora', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#10b981' }} />
                    Já foi pago — dar baixa agora
                  </label>
                  {f.pagoAgora && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                      <Input label="Data do pagamento *" type="date" value={f.data_pagamento} onChange={e => setTF('data_pagamento', e.target.value)} required />
                      <Select label="Conta / Banco *" value={f.bank_account_id} onChange={e => setTF('bank_account_id', e.target.value)} required>
                        <option value="">Selecione</option>
                        {contas.map(c => <option key={c.id} value={c.id}>{c.name} — {c.bank}</option>)}
                      </Select>
                    </div>
                  )}
                </div>
              )}
              {!id && tipo === 'receber' && (
                <div style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>
                  💡 O título entra como <b>em aberto</b>. Quando o cliente pagar, use <b>✓ Baixar</b> para informar a data e o banco.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <Btn variant="secondary" onClick={() => setTituloModal(null)}>Cancelar</Btn>
                <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : id ? 'Salvar alterações' : Number(f.parcelas) > 1 && !f.is_recurring ? `Lançar ${f.parcelas} títulos` : 'Lançar título'}</Btn>
              </div>
            </form>
          )
        })()}
      </Modal>

      <EmitirNfse open={!!nfseTitulo} titulo={nfseTitulo} onClose={() => setNfseTitulo(null)} onEmitida={() => carregarNotas()} />

      {/* ─── Modal: baixa ─── */}
      <Modal open={!!baixa} onClose={() => setBaixa(null)} title={baixa?.t.type === 'receber' ? 'Baixar recebimento' : 'Baixar pagamento'}>
        {baixa && (
          <form onSubmit={confirmarBaixa}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              {baixa.t.clients && <div style={{ fontWeight: 700, color: '#1e293b' }}>{baixa.t.clients.razao_social}</div>}
              <div style={{ fontSize: 13, color: '#475569' }}>{baixa.t.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Vencimento: <b>{fmtData(baixa.t.due_date)}</b></span>
                <span style={{ fontWeight: 900, color: baixa.t.type === 'receber' ? '#059669' : '#dc2626' }}>{fmt(baixa.t.amount)}</span>
              </div>
            </div>
            <Input label={`Data do ${baixa.t.type === 'receber' ? 'recebimento' : 'pagamento'} *`} type="date" value={baixa.data_pagamento}
              onChange={e => setBaixa(b => ({ ...b, data_pagamento: e.target.value }))} required />
            {baixa.t.due_date && baixa.data_pagamento > baixa.t.due_date && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#92400e', marginTop: -6, marginBottom: 12 }}>
                ⚠️ Data posterior ao vencimento — ficará registrado como pago com atraso.
              </div>
            )}
            <Select label="Banco / Conta *" value={baixa.bank_account_id} onChange={e => setBaixa(b => ({ ...b, bank_account_id: e.target.value }))} required>
              <option value="">Selecione a conta</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.name} — {c.bank}</option>)}
            </Select>
            {contas.length === 0 && <div style={{ fontSize: 12, color: '#dc2626', marginTop: -6, marginBottom: 10 }}>Cadastre uma conta bancária na aba "Contas" primeiro.</div>}
            <div style={{ fontSize: 12, color: '#475569' }}>
              {baixa.t.type === 'receber' ? '📈 O saldo da conta será aumentado em ' : '📉 O saldo da conta será reduzido em '}<b>{fmt(baixa.t.amount)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <Btn variant="secondary" onClick={() => setBaixa(null)}>Cancelar</Btn>
              <Btn type="submit" variant="success" disabled={saving}>{saving ? 'Salvando...' : '✓ Confirmar baixa'}</Btn>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Importar Asaas */}
      <Modal open={showImportModal} onClose={() => { setShowImportModal(false); setImportLinhas([]); setImportSelecionadas([]) }} title="Importar Extrato Asaas" size="lg">
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1d4ed8', marginBottom: 14 }}>
            <strong>Como exportar do Asaas:</strong> Acesse Financeiro → Cobranças ou Lançamentos → Exportar → CSV. O sistema detecta automaticamente os campos.
          </div>
          {importLinhas.length === 0 ? (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Arquivo CSV do Asaas *</label>
                <input type="file" accept=".csv,.txt" onChange={lerArquivoAsaas}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px dashed #93c5fd', borderRadius: 10, fontSize: 13, background: '#f0f9ff', cursor: 'pointer', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Btn variant="secondary" onClick={() => setShowImportModal(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Vincular à conta bancária</label>
                  <select value={importContaId} onChange={e => setImportContaId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}>
                    <option value="">Sem conta vinculada</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.name} — {c.bank}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <button onClick={() => setImportSelecionadas(importLinhas.map((_, i) => i))}
                    style={{ padding: '8px 12px', border: '1.5px solid #bbf7d0', borderRadius: 8, background: '#f0fdf4', color: '#166534', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ✓ Selecionar tudo ({importLinhas.length})
                  </button>
                  <button onClick={() => setImportSelecionadas([])}
                    style={{ padding: '8px 12px', border: '1.5px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ✕ Desmarcar tudo
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                    <tr>
                      {['', 'Descrição', 'Tipo', 'Valor', 'Vencimento', 'Pgto', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importLinhas.map((linha, i) => {
                      const sel = importSelecionadas.includes(i)
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc', background: sel ? '#f0fdf4' : 'white', cursor: 'pointer' }}
                          onClick={() => setImportSelecionadas(s => sel ? s.filter(x => x !== i) : [...s, i])}>
                          <td style={{ padding: '8px 10px' }}>
                            <input type="checkbox" checked={sel} readOnly style={{ cursor: 'pointer' }} />
                          </td>
                          <td style={{ padding: '8px 10px', color: '#1e293b', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linha.description}</td>
                          <td style={{ padding: '8px 10px' }}><Badge color={tipoCores[linha.type]}>{tipoLabel[linha.type]}</Badge></td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: linha.type === 'receber' ? '#10b981' : '#ef4444' }}>{fmt(linha.amount)}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{linha.due_date || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{linha.data_pagamento || '—'}</td>
                          <td style={{ padding: '8px 10px' }}><Badge color={statusCores[linha.status]}>{linha.status}</Badge></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  <strong>{importSelecionadas.length}</strong> de {importLinhas.length} selecionadas
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="secondary" onClick={() => { setImportLinhas([]); setImportSelecionadas([]) }}>← Voltar</Btn>
                  <Btn onClick={confirmarImport} disabled={importando || !importSelecionadas.length}>
                    {importando ? 'Importando...' : `Importar ${importSelecionadas.length} lançamento(s)`}
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </div>
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

const miniBtn = {
  background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 8px', cursor: 'pointer',
  color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
}
