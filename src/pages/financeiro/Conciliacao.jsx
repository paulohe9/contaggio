import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Btn, Badge, Modal, Input, Select, StatCard } from '../../components/ui'
import { fmtData, fmtBRL, inputBase } from '../../lib/util'

const SOCIOS = [['rayssa', 'Rayssa'], ['paulo', 'Paulo'], ['rilary', 'Rilary']]
const CAT_RECEBER = ['Honorários', 'Regularização de Obra', 'Abertura / Legalização', 'Serviço Avulso', 'Reembolso de Despesas', 'Receita Extraordinária', 'Outros']
const CAT_PAGAR = [
  'Imposto Federal', 'Imposto Estadual', 'Imposto Municipal', 'Simples Nacional', 'FGTS', 'INSS', 'Folha de Pagamento', 'Pró-labore',
  'Aluguel', 'Energia / Água / Internet', 'Sistemas / Softwares', 'Fornecedor', 'Despesa Administrativa', 'Marketing', 'Investimento',
  'Comissão', 'Tarifas Bancárias', 'Multa / Juros', 'Outros',
]
const TIPO_LABEL = {
  PAYMENT_RECEIVED: 'Cobrança recebida', TRANSFER: 'Pix / transferência', BILL_PAYMENT: 'Pagamento de conta',
  INVOICE_FEE: 'Taxa de nota fiscal', PAYMENT_FEE: 'Taxa de cobrança', TRANSFER_FEE: 'Taxa de transferência',
}
const miniBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: 8,
  background: 'white', color: '#475569', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
}

async function ajustarSaldo(contaId, delta) {
  if (!contaId || !delta) return
  const { data } = await supabase.from('bank_accounts').select('balance').eq('id', contaId).single()
  await supabase.from('bank_accounts').update({ balance: Math.round((Number(data?.balance || 0) + delta) * 100) / 100 }).eq('id', contaId)
}

export default function Conciliacao({ contas, clientes, transacoes, onMudou }) {
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [ver, setVer] = useState('pendentes')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [sync, setSync] = useState({ rodando: false, msg: '' })
  const [ultimo, setUltimo] = useState(null)
  const [saldoAsaas, setSaldoAsaas] = useState(null)
  const [contaId, setContaId] = useState('')
  const [modal, setModal] = useState(null) // { modo, mov }
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!contaId && contas.length) setContaId((contas.find(c => /asaas/i.test(`${c.name} ${c.bank}`)) || contas[0]).id)
  }, [contas, contaId])

  useEffect(() => { carregar(); carregarSaldo() }, [])

  async function carregar() {
    setLoading(true)
    const [m, l] = await Promise.all([
      supabase.from('asaas_movimentos').select('*').order('data', { ascending: false }).order('created_at', { ascending: false }).limit(1500),
      supabase.from('asaas_sync_log').select('*').order('executado_em', { ascending: false }).limit(1),
    ])
    setMovs(m.data || [])
    setUltimo((l.data || [])[0] || null)
    setLoading(false)
  }

  async function carregarSaldo() {
    const { data, error } = await supabase.functions.invoke('asaas-extrato', { body: { acao: 'saldo' } })
    if (!error && data && data.saldo != null) setSaldoAsaas(Number(data.saldo))
  }

  async function sincronizar() {
    setSync({ rodando: true, msg: '' })
    const { data, error } = await supabase.functions.invoke('asaas-sync', { body: { dias: 45 } })
    if (error || !data || data.erro) {
      setSync({ rodando: false, msg: '⚠️ Não foi possível sincronizar agora. ' + (data?.detalhe || error?.message || '') })
      return
    }
    setSync({ rodando: false, msg: `✅ ${data.novos} novo(s) · ${data.baixas_automaticas} baixa(s) automática(s) · ${data.pendentes} pendente(s)` })
    await Promise.all([carregar(), carregarSaldo()])
    onMudou && onMudou()
  }

  const pend = useMemo(() => movs.filter(m => ['novo', 'pendente'].includes(m.status)), [movs])
  const soma = (arr) => arr.reduce((s, m) => s + Number(m.valor), 0)
  const entradasPend = pend.filter(m => m.valor > 0)
  const saidasPend = pend.filter(m => m.valor < 0)
  const contaSel = contas.find(c => c.id === contaId)
  const saldoSistema = contaSel ? Number(contaSel.balance) : null
  const diferenca = saldoAsaas != null && saldoSistema != null ? Math.round((saldoAsaas - saldoSistema) * 100) / 100 : null

  const lista = useMemo(() => {
    const q = busca.toLowerCase()
    const base = movs.filter(m => (ver === 'pendentes' ? ['novo', 'pendente'].includes(m.status) : ver === 'conciliados' ? m.status === 'conciliado' : m.status === 'ignorado'))
    return base.filter(m => {
      if (filtroTipo === 'entrada' && !(m.valor > 0)) return false
      if (filtroTipo === 'saida' && !(m.valor < 0)) return false
      if (q && !`${m.descricao || ''} ${TIPO_LABEL[m.tipo] || m.tipo}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [movs, ver, filtroTipo, busca])

  const tituloDe = (id) => transacoes.find(t => t.id === id)

  // ── ações ──────────────────────────────────────────────────
  function abrir(modo, mov) {
    const v = Math.abs(Number(mov.valor))
    if (modo === 'novo') setForm({ description: (mov.descricao || '').replace(/^Cobrança recebida - fatura nr\. \d+ ?/, ''), category: '', client_id: '', notes: '' })
    else if (modo === 'distribuicao') setForm({ socio: '', valorDist: v.toFixed(2), descResto: 'Plano telefônico', catResto: 'Despesa Administrativa' })
    else setForm({ busca: '', titulo: '' })
    setModal({ modo, mov })
  }

  async function finalizar(mov, extra) {
    const { error } = await supabase.from('asaas_movimentos').update({ status: 'conciliado', baixa_automatica: false, updated_at: new Date().toISOString(), ...extra }).eq('id', mov.id)
    if (error) throw new Error(error.message)
  }

  async function confirmarBaixa() {
    const { mov } = modal
    const t = tituloDe(form.titulo)
    if (!t) { alert('Escolha um título.'); return }
    const v = Math.abs(Number(mov.valor))
    if (Math.abs(Number(t.amount) - v) > 0.005 && !confirm(`O título é de ${fmtBRL(t.amount)} e o extrato mostra ${fmtBRL(v)}. Baixar mesmo assim?`)) return
    setSaving(true)
    try {
      const { error } = await supabase.from('financial_transactions').update({
        status: 'pago', data_pagamento: mov.data, payment_date: mov.data, bank_account_id: contaId, updated_at: new Date().toISOString(),
      }).eq('id', t.id)
      if (error) throw new Error(error.message)
      await ajustarSaldo(contaId, t.type === 'receber' ? Number(t.amount) : -Number(t.amount))
      await finalizar(mov, { transacao_id: t.id, motivo: 'Conciliado manualmente' })
      setModal(null); await carregar(); onMudou && onMudou()
    } catch (e) { alert('Erro: ' + e.message) }
    setSaving(false)
  }

  async function confirmarNovo() {
    const { mov } = modal
    const entrada = mov.valor > 0
    if (!form.description?.trim()) { alert('Informe uma descrição.'); return }
    setSaving(true)
    try {
      const v = Math.abs(Number(mov.valor))
      const { data, error } = await supabase.from('financial_transactions').insert({
        type: entrada ? 'receber' : 'pagar', description: form.description.trim(), amount: v, due_date: mov.data, status: 'pago',
        data_pagamento: mov.data, payment_date: mov.data, bank_account_id: contaId, category: form.category || null,
        client_id: entrada ? (form.client_id || null) : null, notes: form.notes || null, is_recurring: false,
      }).select('id').single()
      if (error) throw new Error(error.message)
      await ajustarSaldo(contaId, entrada ? v : -v)
      await finalizar(mov, { transacao_id: data.id, motivo: 'Lançado a partir do extrato' })
      setModal(null); await carregar(); onMudou && onMudou()
    } catch (e) { alert('Erro: ' + e.message) }
    setSaving(false)
  }

  async function confirmarDistribuicao() {
    const { mov } = modal
    const total = Math.abs(Number(mov.valor))
    const vd = Math.round(Number(String(form.valorDist).replace(',', '.')) * 100) / 100
    if (!form.socio) { alert('Escolha o sócio.'); return }
    if (!(vd > 0) || vd > total + 0.005) { alert('Valor da distribuição inválido.'); return }
    const resto = Math.round((total - vd) * 100) / 100
    if (resto > 0.004 && !form.descResto?.trim()) { alert('Informe a descrição do restante (despesa).'); return }
    setSaving(true)
    try {
      const { data: d, error } = await supabase.from('profit_distributions').insert({
        month: mov.data.slice(0, 7) + '-01', partner: form.socio, amount: vd, notes: `Pix Asaas ${fmtData(mov.data)}`, paid_on: mov.data,
      }).select('id').single()
      if (error) throw new Error(error.message.includes('duplicate') ? 'O banco ainda bloqueia mais de uma distribuição por sócio no mês. Peça o ajuste da tabela.' : error.message)
      let transacaoId = null
      if (resto > 0.004) {
        const { data: t, error: e2 } = await supabase.from('financial_transactions').insert({
          type: 'pagar', description: form.descResto.trim(), amount: resto, due_date: mov.data, status: 'pago', data_pagamento: mov.data,
          payment_date: mov.data, bank_account_id: contaId, category: form.catResto || null, is_recurring: false,
          notes: `Parte do Pix de ${fmtBRL(total)} (Asaas ${fmtData(mov.data)})`,
        }).select('id').single()
        if (e2) throw new Error(e2.message)
        transacaoId = t.id
      }
      await ajustarSaldo(contaId, -total)
      await finalizar(mov, { distribuicao_id: d.id, transacao_id: transacaoId, motivo: resto > 0.004 ? `Distribuição ${fmtBRL(vd)} + despesa ${fmtBRL(resto)}` : 'Distribuição de lucros' })
      setModal(null); await carregar(); onMudou && onMudou()
    } catch (e) { alert('Erro: ' + e.message) }
    setSaving(false)
  }

  async function ignorar(mov) {
    if (!confirm('Ignorar este movimento? Ele sai da fila e nada é lançado no sistema.')) return
    const { error } = await supabase.from('asaas_movimentos').update({ status: 'ignorado', motivo: 'Ignorado manualmente', updated_at: new Date().toISOString() }).eq('id', mov.id)
    if (error) { alert('Erro: ' + error.message); return }
    carregar(); onMudou && onMudou()
  }
  async function reabrir(mov) {
    await supabase.from('asaas_movimentos').update({ status: 'pendente', motivo: 'Reaberto', updated_at: new Date().toISOString() }).eq('id', mov.id)
    carregar(); onMudou && onMudou()
  }

  // ── telas ──────────────────────────────────────────────────
  const candidatos = useMemo(() => {
    if (!modal || modal.modo !== 'baixar') return []
    const entrada = modal.mov.valor > 0
    const v = Math.abs(Number(modal.mov.valor))
    const q = (form.busca || '').toLowerCase()
    return transacoes
      .filter(t => t.type === (entrada ? 'receber' : 'pagar') && t.status === 'pendente')
      .filter(t => !q || `${t.description || ''} ${t.clients?.razao_social || ''}`.toLowerCase().includes(q))
      .map(t => ({ t, igual: Math.abs(Number(t.amount) - v) < 0.005 }))
      .sort((a, b) => Number(b.igual) - Number(a.igual) || (a.t.due_date || '').localeCompare(b.t.due_date || ''))
      .slice(0, 60)
  }, [modal, form.busca, transacoes])

  const abas = [['pendentes', `Falta conciliar (${pend.length})`], ['conciliados', 'Conciliados'], ['ignorados', 'Ignorados']]
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const mov = modal?.mov
  const entrada = mov ? mov.valor > 0 : false

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
        <StatCard label="Saldo no Asaas" value={saldoAsaas != null ? fmtBRL(saldoAsaas) : '…'} icon="🏦" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Saldo no sistema" value={saldoSistema != null ? fmtBRL(saldoSistema) : '—'} icon="🧮" bg="#f8fafc" border="#e2e8f0" />
        <StatCard label="Diferença" value={diferenca != null ? fmtBRL(diferenca) : '—'} icon="⚖️"
          bg={diferenca != null && Math.abs(diferenca) < 0.01 ? '#f0fdf4' : '#fffbeb'} border={diferenca != null && Math.abs(diferenca) < 0.01 ? '#bbf7d0' : '#fde68a'} />
        <StatCard label={`Entrou e falta conciliar (${entradasPend.length})`} value={fmtBRL(soma(entradasPend))} icon="📥" bg="#f0fdf4" border="#bbf7d0" />
        <StatCard label={`Saiu e falta conciliar (${saidasPend.length})`} value={fmtBRL(Math.abs(soma(saidasPend)))} icon="📤" bg="#fef2f2" border="#fecaca" />
      </div>

      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          {abas.map(([k, l]) => (
            <button key={k} onClick={() => setVer(k)} style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
              border: ver === k ? '1px solid #2563eb' : '1px solid #e2e8f0', background: ver === k ? '#2563eb' : 'white', color: ver === k ? 'white' : '#475569',
            }}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <Btn onClick={sincronizar} disabled={sync.rodando}>{sync.rodando ? 'Sincronizando…' : '🔄 Sincronizar com o Asaas'}</Btn>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome ou descrição..." style={{ ...inputBase, flex: 1, minWidth: 200 }} />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
            <option value="todos">Entradas e saídas</option>
            <option value="entrada">Só o que entrou</option>
            <option value="saida">Só o que saiu</option>
          </select>
          <select value={contaId} onChange={e => setContaId(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }} title="Conta do sistema que representa o Asaas">
            {contas.map(c => <option key={c.id} value={c.id}>Conta: {c.name}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8 }}>
          {sync.msg || (ultimo ? `Última sincronização: ${new Date(ultimo.executado_em).toLocaleString('pt-BR')}${ultimo.erro ? ' (com erro)' : ''} · roda sozinha todo dia às 7h.` : 'Ainda não sincronizado.')}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Data', 'Movimento no Asaas', 'Valor', ver === 'pendentes' ? 'Por que está na fila' : 'Situação', ver === 'pendentes' ? 'Ações' : ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: h === 'Valor' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>{ver === 'pendentes' ? '🎉' : '📭'}</div>
                  <div style={{ fontWeight: 600, color: '#475569' }}>{ver === 'pendentes' ? 'Tudo conciliado por aqui' : 'Nada para mostrar'}</div>
                </td></tr>
              ) : lista.map(m => {
                const t = m.transacao_id ? tituloDe(m.transacao_id) : null
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '11px 16px', whiteSpace: 'nowrap', color: '#475569', fontSize: 12 }}>{fmtData(m.data)}</td>
                    <td style={{ padding: '11px 16px', maxWidth: 380 }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 12.5 }}>{TIPO_LABEL[m.tipo] || m.tipo}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{(m.descricao || '').replace(/^Cobrança recebida - /, '')}</div>
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', whiteSpace: 'nowrap', color: m.valor > 0 ? '#059669' : '#dc2626' }}>{fmtBRL(m.valor)}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: '#64748b', maxWidth: 260 }}>
                      {ver === 'conciliados' && <Badge color={m.baixa_automatica ? 'green' : 'blue'}>{m.baixa_automatica ? 'Baixa automática' : 'Conciliado'}</Badge>}
                      {ver === 'ignorados' && <Badge color="slate">Ignorado</Badge>}
                      <div style={{ marginTop: ver === 'pendentes' ? 0 : 4 }}>{t ? `${t.clients?.razao_social || t.description}` : ''}{m.motivo ? `${t ? ' · ' : ''}${m.motivo}` : ''}</div>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      {ver === 'pendentes' && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button style={{ ...miniBtn, color: '#059669', borderColor: '#bbf7d0', background: '#f0fdf4' }} onClick={() => abrir('baixar', m)}>{m.valor > 0 ? '✓ Baixar título' : '✓ Vincular a pagar'}</button>
                          <button style={miniBtn} onClick={() => abrir('novo', m)}>{m.valor > 0 ? '＋ Lançar recebimento' : '＋ Lançar despesa'}</button>
                          {m.valor < 0 && <button style={{ ...miniBtn, color: '#b45309', borderColor: '#fde68a', background: '#fffbeb' }} onClick={() => abrir('distribuicao', m)}>💰 Distribuição</button>}
                          <button style={{ ...miniBtn, color: '#94a3b8' }} onClick={() => ignorar(m)}>Ignorar</button>
                        </div>
                      )}
                      {ver === 'ignorados' && <button style={miniBtn} onClick={() => reabrir(m)}>Reabrir</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Baixar / vincular a título existente */}
      <Modal open={modal?.modo === 'baixar'} onClose={() => setModal(null)} title={entrada ? 'Baixar título a receber' : 'Vincular a conta a pagar'} size="lg">
        {mov && (
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, marginBottom: 12 }}>
              <strong>{fmtBRL(mov.valor)}</strong> em {fmtData(mov.data)} · {(mov.descricao || '').replace(/^Cobrança recebida - /, '')}
            </div>
            <input value={form.busca || ''} onChange={e => set('busca', e.target.value)} placeholder="🔍 Buscar título ou cliente..." style={{ ...inputBase, width: '100%', marginBottom: 10 }} />
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              {candidatos.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Nenhum título em aberto. Use “Lançar” para criar um já baixado.</div>}
              {candidatos.map(({ t, igual }) => (
                <label key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: form.titulo === t.id ? '#eff6ff' : 'white' }}>
                  <input type="radio" name="tit" checked={form.titulo === t.id} onChange={() => set('titulo', t.id)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12.5, color: '#1e293b' }}>{t.clients?.razao_social || t.description}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.description} · vence {fmtData(t.due_date)}</div>
                  </div>
                  {igual && <Badge color="green">mesmo valor</Badge>}
                  <div style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 13 }}>{fmtBRL(t.amount)}</div>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn variant="success" onClick={confirmarBaixa} disabled={saving || !form.titulo}>{saving ? 'Salvando…' : 'Baixar e conciliar'}</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Lançar novo (já baixado) */}
      <Modal open={modal?.modo === 'novo'} onClose={() => setModal(null)} title={entrada ? 'Lançar recebimento' : 'Lançar despesa'}>
        {mov && (
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, marginBottom: 12 }}>
              <strong>{fmtBRL(mov.valor)}</strong> em {fmtData(mov.data)} · {(mov.descricao || '').slice(0, 80)}
            </div>
            <Input label="Descrição *" value={form.description || ''} onChange={e => set('description', e.target.value)} />
            <Select label="Categoria" value={form.category || ''} onChange={e => set('category', e.target.value)}>
              <option value="">Sem categoria</option>
              {(entrada ? CAT_RECEBER : CAT_PAGAR).map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            {entrada && (
              <Select label="Cliente" value={form.client_id || ''} onChange={e => set('client_id', e.target.value)}>
                <option value="">Sem cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
              </Select>
            )}
            <Input label="Observações" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
            <div style={{ fontSize: 11.5, color: '#64748b', margin: '4px 0 12px' }}>Já entra como {entrada ? 'recebido' : 'pago'} em {fmtData(mov.data)} na conta “{contaSel?.name}”.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={confirmarNovo} disabled={saving}>{saving ? 'Salvando…' : 'Lançar e conciliar'}</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Distribuição de lucros */}
      <Modal open={modal?.modo === 'distribuicao'} onClose={() => setModal(null)} title="Distribuição de lucros">
        {mov && (
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, marginBottom: 12 }}>
              Pix de <strong>{fmtBRL(Math.abs(mov.valor))}</strong> em {fmtData(mov.data)} · {(mov.descricao || '').slice(0, 80)}
            </div>
            <Select label="Sócio *" value={form.socio || ''} onChange={e => set('socio', e.target.value)}>
              <option value="">Selecione</option>
              {SOCIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Input label="Parte que é distribuição (R$)" type="number" step="0.01" min="0" value={form.valorDist ?? ''} onChange={e => set('valorDist', e.target.value)} />
            {Number(form.valorDist) > 0 && Math.abs(mov.valor) - Number(form.valorDist) > 0.004 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#92400e', marginBottom: 8 }}>O restante, <strong>{fmtBRL(Math.abs(mov.valor) - Number(form.valorDist))}</strong>, vira uma despesa:</div>
                <Input label="Descrição da despesa" value={form.descResto || ''} onChange={e => set('descResto', e.target.value)} />
                <Select label="Categoria" value={form.catResto || ''} onChange={e => set('catResto', e.target.value)}>
                  {CAT_PAGAR.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={confirmarDistribuicao} disabled={saving}>{saving ? 'Salvando…' : 'Registrar e conciliar'}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
