import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea, StatCard, TabBar } from '../../components/ui'
import { Plus, Landmark } from 'lucide-react'

const catCores = { receita: 'green', despesa: 'red', transferencia: 'blue' }
const statusCores = { pendente: 'yellow', pago: 'green', cancelado: 'slate', atrasado: 'red' }

export default function Financeiro() {
  const [transacoes, setTransacoes] = useState([])
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('visao_geral')
  const [showModal, setShowModal] = useState(false)
  const [showContaModal, setShowContaModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: 'receita', description: '', amount: '', due_date: '', status: 'pendente', category: '', client_id: '', notes: '' })
  const [contaForm, setContaForm] = useState({ name: '', bank: '', balance: '0', account_type: 'corrente' })
  const [clientes, setClientes] = useState([])

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [tRes, cRes, clRes] = await Promise.all([
      supabase.from('transactions').select('*, clients(razao_social)').order('due_date', { ascending: false }),
      supabase.from('bank_accounts').select('*').order('name'),
      supabase.from('clients').select('id, razao_social').order('razao_social'),
    ])
    setTransacoes(tRes.data || [])
    setContas(cRes.data || [])
    setClientes(clRes.data || [])
    setLoading(false)
  }

  const totalEntradas = transacoes.filter(t => t.type === 'receita' && t.status === 'pago').reduce((s, t) => s + Number(t.amount), 0)
  const totalSaidas = transacoes.filter(t => t.type === 'despesa' && t.status === 'pago').reduce((s, t) => s + Number(t.amount), 0)
  const saldoTotal = contas.reduce((s, c) => s + Number(c.balance), 0)
  const pendentes = transacoes.filter(t => t.status === 'pendente').reduce((s, t) => s + Number(t.amount), 0)

  async function salvarTransacao(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('transactions').insert({ ...form, amount: Number(form.amount) })
    setSaving(false); setShowModal(false)
    setForm({ type: 'receita', description: '', amount: '', due_date: '', status: 'pendente', category: '', client_id: '', notes: '' })
    fetchTudo()
  }

  async function salvarConta(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('bank_accounts').insert({ ...contaForm, balance: Number(contaForm.balance) })
    setSaving(false); setShowContaModal(false)
    setContaForm({ name: '', bank: '', balance: '0', account_type: 'corrente' })
    fetchTudo()
  }

  async function alterarStatus(id, status) {
    await supabase.from('transactions').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setTransacoes(ts => ts.map(t => t.id === id ? { ...t, status } : t))
  }

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const tabs = [
    { key: 'visao_geral', label: 'Visão Geral', icon: '📊' },
    { key: 'contas', label: `Contas (${contas.length})`, icon: '🏦' },
    { key: 'transacoes', label: `Movimentações (${transacoes.length})`, icon: '💳' },
  ]

  return (
    <div style={{ maxWidth: 1200 }}>
      <PageHeader
        title="Financeiro"
        subtitle="Controle de entradas, saídas e contas bancárias"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={() => setShowContaModal(true)}><Landmark size={14} /> Nova Conta</Btn>
            <Btn onClick={() => setShowModal(true)}><Plus size={14} /> Nova Movimentação</Btn>
          </div>
        }
      />

      {/* Cards Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Saldo Total" value={fmt(saldoTotal)} icon="🏦" color="#10b981" bg="#f0fdf4" border="#bbf7d0" />
        <StatCard label="Entradas (pagas)" value={fmt(totalEntradas)} icon="📈" color="#3b82f6" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Saídas (pagas)" value={fmt(totalSaidas)} icon="📉" color="#ef4444" bg="#fef2f2" border="#fecaca" />
        <StatCard label="Pendentes" value={fmt(pendentes)} icon="⏳" color="#f59e0b" bg="#fffbeb" border="#fde68a" />
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {/* Visão Geral */}
      {tab === 'visao_geral' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 14, fontSize: 14 }}>Últimas Movimentações</div>
            {transacoes.slice(0, 8).map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy') : '—'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.type === 'receita' ? '#10b981' : '#ef4444' }}>
                    {t.type === 'receita' ? '+' : '-'}{fmt(t.amount)}
                  </div>
                  <Badge color={statusCores[t.status]}>{t.status}</Badge>
                </div>
              </div>
            ))}
            {transacoes.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Nenhuma movimentação registrada.</div>}
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 14, fontSize: 14 }}>Contas Bancárias</div>
            {contas.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏦</div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.bank} · {c.account_type}</div>
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
              <div style={{ marginTop: 8 }}><Badge color="blue">{c.account_type}</Badge></div>
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
                {['Descrição', 'Tipo', 'Valor', 'Vencimento', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</td></tr>
              ) : transacoes.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>💳</div>
                  <div style={{ fontWeight: 600, color: '#475569' }}>Nenhuma movimentação registrada</div>
                </td></tr>
              ) : transacoes.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{t.description}</div>
                    {t.clients && <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.clients.razao_social}</div>}
                  </td>
                  <td style={{ padding: '12px 18px' }}><Badge color={catCores[t.type]}>{t.type}</Badge></td>
                  <td style={{ padding: '12px 18px', fontWeight: 700, color: t.type === 'receita' ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                    {t.type === 'receita' ? '+' : '-'}{fmt(t.amount)}
                  </td>
                  <td style={{ padding: '12px 18px', color: '#64748b', fontSize: 12 }}>
                    {t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td style={{ padding: '12px 18px' }}><Badge color={statusCores[t.status]}>{t.status}</Badge></td>
                  <td style={{ padding: '12px 18px' }}>
                    {t.status === 'pendente' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn size="sm" variant="success" onClick={() => alterarStatus(t.id, 'pago')}>✓ Pago</Btn>
                        <Btn size="sm" variant="danger" onClick={() => alterarStatus(t.id, 'cancelado')}>✕</Btn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Transação */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Movimentação" size="lg">
        <form onSubmit={salvarTransacao}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select label="Tipo *" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="receita">Receita (entrada)</option>
              <option value="despesa">Despesa (saída)</option>
              <option value="transferencia">Transferência</option>
            </Select>
            <Input label="Valor (R$) *" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" required />
          </div>
          <Input label="Descrição *" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Honorários - Janeiro" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Vencimento" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </Select>
          </div>
          <Select label="Cliente (opcional)" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
            <option value="">Sem cliente vinculado</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </Select>
          <Input label="Categoria" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: Honorários, Aluguel, Impostos..." />
          <Textarea label="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Movimentação'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Conta */}
      <Modal open={showContaModal} onClose={() => setShowContaModal(false)} title="Nova Conta Bancária">
        <form onSubmit={salvarConta}>
          <Input label="Nome da Conta *" value={contaForm.name} onChange={e => setContaForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Conta Principal" required />
          <Input label="Banco" value={contaForm.bank} onChange={e => setContaForm(f => ({ ...f, bank: e.target.value }))} placeholder="Ex: Itaú, Bradesco, Nubank..." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Saldo inicial (R$)" type="number" step="0.01" value={contaForm.balance} onChange={e => setContaForm(f => ({ ...f, balance: e.target.value }))} />
            <Select label="Tipo de Conta" value={contaForm.account_type} onChange={e => setContaForm(f => ({ ...f, account_type: e.target.value }))}>
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
