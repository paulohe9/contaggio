import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Btn, Modal } from '../../components/ui'
import { fmtBRL, inputBase } from '../../lib/util'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const linhaVazia = () => ({ id: Math.random().toString(36).slice(2), incluir: true, client_id: '', description: '', amount: '', due_date: '', category: 'Honorários', is_recurring: false })
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// "1.234,56" | "1234.56" | "R$ 850" -> número
function numeroBR(v) {
  const s = String(v || '').replace(/[^\d,.-]/g, '')
  if (!s) return ''
  if (s.includes(',')) return String(Number(s.replace(/\./g, '').replace(',', '.')) || '')
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return String(Number(s.replace(/\./g, ''))) // "2.000" = dois mil
  return String(Number(s) || '')
}
// "10/11/2026" | "2026-11-10" -> ISO
function dataBR(v) {
  const s = String(v || '').trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) { const ano = m[3].length === 2 ? '20' + m[3] : m[3]; return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? s : ''
}

export default function LancamentoLote({ open, onClose, onLancado, categorias }) {
  const [modo, setModo] = useState('honorarios') // honorarios | livre
  const [clientes, setClientes] = useState([])
  const [mes, setMes] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7) })
  const [recorrente, setRecorrente] = useState(false)
  const [linhas, setLinhas] = useState([])
  const [jaLancados, setJaLancados] = useState({})
  const [colar, setColar] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setMsg(''); setColar('')
    supabase.from('clients').select('id, razao_social, cnpj, honorario_valor, honorario_dia, status').order('razao_social')
      .then(({ data }) => setClientes(data || []))
  }, [open])

  useEffect(() => { if (open && modo === 'honorarios') montarHonorarios() }, [open, modo, mes, clientes])
  useEffect(() => { if (open && modo === 'livre') setLinhas([linhaVazia(), linhaVazia(), linhaVazia()]) }, [open, modo])

  async function montarHonorarios() {
    const [ano, m] = mes.split('-').map(Number)
    const ultimoDia = new Date(ano, m, 0).getDate()
    const nomeMes = `${MESES[m - 1]}/${ano}`
    // Títulos de receber que já existem no mês (para não lançar em dobro)
    const ini = `${mes}-01`, fim = `${mes}-${String(ultimoDia).padStart(2, '0')}`
    const { data: existentes } = await supabase.from('financial_transactions').select('client_id').eq('type', 'receber').gte('due_date', ini).lte('due_date', fim).neq('status', 'cancelado')
    const ja = {}
    for (const t of existentes || []) if (t.client_id) ja[t.client_id] = (ja[t.client_id] || 0) + 1
    setJaLancados(ja)
    setLinhas(clientes.filter(c => c.status === 'ativo' && Number(c.honorario_valor) > 0).map(c => ({
      ...linhaVazia(), client_id: c.id, incluir: !ja[c.id],
      description: `Honorários ${nomeMes}`, amount: String(c.honorario_valor),
      due_date: `${mes}-${String(Math.min(Number(c.honorario_dia) || 5, ultimoDia)).padStart(2, '0')}`,
    })))
  }

  const set = (id, campo, valor) => setLinhas(ls => ls.map(l => l.id === id ? { ...l, [campo]: valor } : l))
  const remover = (id) => setLinhas(ls => ls.filter(l => l.id !== id))

  function importarColado() {
    // Aceita colar do Excel/Sheets: Cliente | Descrição | Valor | Vencimento [| Categoria]
    const novas = []
    const naoAchados = []
    for (const bruta of colar.split(/\r?\n/)) {
      if (!bruta.trim()) continue
      const cols = bruta.split(/\t|;/).map(c => c.trim())
      if (cols.length < 3) continue
      const [nomeOuDoc, descricao, valor, venc, cat] = cols
      if (/^cliente$/i.test(nomeOuDoc)) continue // cabeçalho
      const dig = nomeOuDoc.replace(/\D/g, '')
      const cli = clientes.find(c => (dig.length >= 11 && String(c.cnpj || '').replace(/\D/g, '') === dig))
        || clientes.find(c => norm(c.razao_social) === norm(nomeOuDoc))
        || clientes.find(c => norm(c.razao_social).startsWith(norm(nomeOuDoc)) && norm(nomeOuDoc).length >= 4)
      if (!cli) naoAchados.push(nomeOuDoc)
      novas.push({ ...linhaVazia(), client_id: cli?.id || '', description: descricao || '', amount: numeroBR(valor), due_date: dataBR(venc) || '', category: categorias.includes(cat) ? cat : 'Honorários' })
    }
    if (!novas.length) { setMsg('Não reconheci nenhuma linha. Cole as colunas: Cliente, Descrição, Valor, Vencimento.'); return }
    setLinhas(ls => [...ls.filter(l => l.client_id || l.description || l.amount), ...novas])
    setColar('')
    setMsg(`${novas.length} linha(s) importada(s).${naoAchados.length ? ` Cliente não encontrado: ${naoAchados.slice(0, 5).join(', ')}${naoAchados.length > 5 ? '…' : ''} (escolha na lista).` : ''}`)
  }

  const selecionadas = linhas.filter(l => l.incluir)
  const validas = selecionadas.filter(l => l.description.trim() && Number(l.amount) > 0 && l.due_date)
  const invalidas = selecionadas.length - validas.length
  const total = useMemo(() => validas.reduce((s, l) => s + Number(l.amount), 0), [validas])

  async function lancar() {
    if (!validas.length) return
    if (invalidas && !confirm(`${invalidas} linha(s) marcada(s) estão incompletas (descrição, valor ou vencimento) e serão ignoradas. Continuar?`)) return
    setSaving(true)
    const nomeCli = (id) => clientes.find(c => c.id === id)?.razao_social
    const registros = validas.map(l => ({
      type: 'receber', status: 'pendente', client_id: l.client_id || null,
      description: modo === 'honorarios' && recorrente ? `Honorários mensais — ${nomeCli(l.client_id) || ''}`.trim() : l.description.trim(),
      amount: Number(l.amount), due_date: l.due_date, category: l.category || null,
      is_recurring: modo === 'honorarios' ? recorrente : !!l.is_recurring,
    }))
    const { error } = await supabase.from('financial_transactions').insert(registros)
    setSaving(false)
    if (error) { alert('Erro ao lançar: ' + error.message); return }
    onLancado(registros.length, total)
  }

  const th = { padding: '7px 6px', fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }
  const cel = { ...inputBase, padding: '6px 8px', fontSize: 12.5, width: '100%' }

  return (
    <Modal open={open} onClose={onClose} title="📥 Lançar a receber em lote" size="xl">
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['honorarios', '🔁 Honorários do mês'], ['livre', '📋 Planilha livre / colar do Excel']].map(([v, l]) => (
          <button key={v} onClick={() => setModo(v)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: modo === v ? '1px solid #2563eb' : '1px solid #e2e8f0', background: modo === v ? '#2563eb' : 'white', color: modo === v ? 'white' : '#475569',
          }}>{l}</button>
        ))}
      </div>

      {modo === 'honorarios' ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, fontSize: 13, color: '#475569' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Mês de vencimento
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ ...inputBase, padding: '6px 8px' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} />
            Marcar como recorrente (o sistema repete nos próximos meses)
          </label>
          <span style={{ fontSize: 11.5, color: '#94a3b8', flexBasis: '100%' }}>
            Vêm os clientes ativos com honorário no cadastro, com o valor e o dia de vencimento de lá. Quem já tem título neste mês vem desmarcado.
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <textarea value={colar} onChange={e => setColar(e.target.value)} rows={3}
            placeholder={'Cole aqui do Excel (uma linha por título): Cliente ou CNPJ | Descrição | Valor | Vencimento | Categoria (opcional)\nEx.: Padaria Sol	Honorários outubro/2026	850,00	10/11/2026'}
            style={{ ...inputBase, width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: msg.includes('não') || msg.includes('Não') ? '#b45309' : '#059669' }}>{msg}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn size="sm" variant="secondary" onClick={importarColado} disabled={!colar.trim()}>Importar linhas coladas</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setLinhas(ls => [...ls, linhaVazia()])}>+ Linha</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'auto', maxHeight: 360 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
            <tr>
              <th style={{ ...th, width: 28 }}>
                <input type="checkbox" checked={linhas.length > 0 && linhas.every(l => l.incluir)} onChange={e => setLinhas(ls => ls.map(l => ({ ...l, incluir: e.target.checked })))} />
              </th>
              <th style={{ ...th, minWidth: 190 }}>Cliente</th>
              <th style={{ ...th, minWidth: 180 }}>Descrição</th>
              <th style={{ ...th, width: 105 }}>Valor (R$)</th>
              <th style={{ ...th, width: 135 }}>Vencimento</th>
              <th style={{ ...th, width: 150 }}>Categoria</th>
              <th style={{ ...th, width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => {
              const incompleta = l.incluir && !(l.description.trim() && Number(l.amount) > 0 && l.due_date)
              return (
                <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9', background: !l.incluir ? '#f8fafc' : incompleta ? '#fff7ed' : 'white', opacity: l.incluir ? 1 : 0.55 }}>
                  <td style={{ padding: '4px 6px' }}><input type="checkbox" checked={l.incluir} onChange={e => set(l.id, 'incluir', e.target.checked)} /></td>
                  <td style={{ padding: '4px 6px' }}>
                    <select value={l.client_id} onChange={e => set(l.id, 'client_id', e.target.value)} style={cel}>
                      <option value="">Sem cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                    </select>
                    {modo === 'honorarios' && jaLancados[l.client_id] && <div style={{ fontSize: 10.5, color: '#b45309', marginTop: 2 }}>já tem {jaLancados[l.client_id]} título(s) neste mês</div>}
                  </td>
                  <td style={{ padding: '4px 6px' }}><input value={l.description} onChange={e => set(l.id, 'description', e.target.value)} style={cel} /></td>
                  <td style={{ padding: '4px 6px' }}><input type="number" step="0.01" min="0" value={l.amount} onChange={e => set(l.id, 'amount', e.target.value)} style={cel} /></td>
                  <td style={{ padding: '4px 6px' }}><input type="date" value={l.due_date} onChange={e => set(l.id, 'due_date', e.target.value)} style={cel} /></td>
                  <td style={{ padding: '4px 6px' }}>
                    <select value={l.category} onChange={e => set(l.id, 'category', e.target.value)} style={cel}>
                      {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '4px 6px' }}><button onClick={() => remover(l.id)} title="Remover linha" style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}>✕</button></td>
                </tr>
              )
            })}
            {linhas.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                {modo === 'honorarios' ? 'Nenhum cliente ativo com honorário cadastrado. Preencha o honorário no cadastro do cliente ou use a planilha livre.' : 'Adicione linhas ou cole do Excel.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: '#475569' }}>
          <b>{validas.length}</b> título(s) · <b style={{ color: '#059669' }}>{fmtBRL(total)}</b>
          {invalidas > 0 && <span style={{ color: '#c2410c' }}> · {invalidas} incompleta(s)</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={lancar} disabled={saving || !validas.length}>{saving ? 'Lançando...' : `Lançar ${validas.length} título(s)`}</Btn>
        </div>
      </div>
    </Modal>
  )
}
