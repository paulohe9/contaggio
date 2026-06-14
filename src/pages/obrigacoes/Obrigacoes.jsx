import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO, addMonths, setDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea, StatCard, TabBar } from '../../components/ui'
import { Plus, Settings, Zap } from 'lucide-react'

const statusCor = { pendente: 'yellow', em_andamento: 'blue', concluida: 'green', atrasada: 'red', cancelada: 'slate' }
const tribLabel = { simples_nacional: 'Simples Nacional', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', mei: 'MEI', todos: 'Todos os regimes' }

const PERIODICIDADES = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'esporadica', label: 'Esporádica' },
]

export default function Obrigacoes() {
  const [obrigacoes, setObrigacoes] = useState([])
  const [templates, setTemplates] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('obrigacoes')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showGerarModal, setShowGerarModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gerarTrib, setGerarTrib] = useState('simples_nacional')
  const [gerarCliente, setGerarCliente] = useState('')
  const [form, setForm] = useState({ client_id: '', title: '', description: '', due_date: '', status: 'pendente', periodicity: 'mensal', category: '' })
  const [tplForm, setTplForm] = useState({ name: '', description: '', tributacao: 'simples_nacional', periodicity: 'mensal', due_day: '15', category: '' })

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [oRes, tRes, cRes] = await Promise.all([
      supabase.from('obligations').select('*, clients(razao_social, tributacao)').order('due_date'),
      supabase.from('obligation_templates').select('*').order('tributacao, name'),
      supabase.from('clients').select('id, razao_social, tributacao').eq('status', 'ativo').order('razao_social'),
    ])
    setObrigacoes(oRes.data || [])
    setTemplates(tRes.data || [])
    setClientes(cRes.data || [])
    setLoading(false)
  }

  const filtradas = filtroStatus ? obrigacoes.filter(o => o.status === filtroStatus) : obrigacoes

  async function salvarObrigacao(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('obligations').insert(form)
    setSaving(false); setShowModal(false)
    setForm({ client_id: '', title: '', description: '', due_date: '', status: 'pendente', periodicity: 'mensal', category: '' })
    fetchTudo()
  }

  async function salvarTemplate(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('obligation_templates').insert({ ...tplForm, due_day: Number(tplForm.due_day) })
    setSaving(false); setShowTemplateModal(false)
    setTplForm({ name: '', description: '', tributacao: 'simples_nacional', periodicity: 'mensal', due_day: '15', category: '' })
    fetchTudo()
  }

  async function excluirTemplate(id) {
    if (!confirm('Excluir este modelo?')) return
    await supabase.from('obligation_templates').delete().eq('id', id)
    setTemplates(ts => ts.filter(t => t.id !== id))
  }

  async function gerarObrigacoes(e) {
    e.preventDefault(); setSaving(true)
    const tplsFiltrados = templates.filter(t => t.tributacao === gerarTrib || t.tributacao === 'todos')
    const clientesFiltrados = gerarCliente
      ? clientes.filter(c => c.id === gerarCliente)
      : clientes.filter(c => c.tributacao === gerarTrib)
    const hoje = new Date()
    const registros = []

    for (const cli of clientesFiltrados) {
      for (const tpl of tplsFiltrados) {
        const dia = Math.min(Number(tpl.due_day || 15), 28)
        let dataVenc = setDate(hoje, dia)
        if (dataVenc < hoje) dataVenc = addMonths(dataVenc, 1)
        registros.push({
          client_id: cli.id,
          title: tpl.name,
          description: tpl.description || '',
          due_date: format(dataVenc, 'yyyy-MM-dd'),
          status: 'pendente',
          periodicity: tpl.periodicity,
          category: tpl.category || '',
        })
      }
    }

    if (registros.length > 0) {
      await supabase.from('obligations').insert(registros)
    }
    setSaving(false); setShowGerarModal(false)
    fetchTudo()
    alert(`${registros.length} obrigação(ões) gerada(s) com sucesso!`)
  }

  async function alterarStatus(id, status) {
    await supabase.from('obligations').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setObrigacoes(os => os.map(o => o.id === id ? { ...o, status } : o))
  }

  const tabs = [
    { key: 'obrigacoes', label: `Obrigações (${obrigacoes.length})`, icon: '📋' },
    { key: 'modelos', label: `Modelos (${templates.length})`, icon: '⚙️' },
  ]

  const tribGrouped = templates.reduce((acc, t) => {
    if (!acc[t.tributacao]) acc[t.tributacao] = []
    acc[t.tributacao].push(t)
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 1200 }}>
      <PageHeader
        title="Obrigações"
        subtitle="Controle de tarefas fiscais e periódicas"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {tab === 'modelos' && (
              <>
                <Btn variant="secondary" onClick={() => setShowTemplateModal(true)}><Settings size={14} /> Novo Modelo</Btn>
                <Btn variant="success" onClick={() => setShowGerarModal(true)}><Zap size={14} /> Gerar Obrigações</Btn>
              </>
            )}
            {tab === 'obrigacoes' && (
              <Btn onClick={() => setShowModal(true)}><Plus size={14} /> Nova Obrigação</Btn>
            )}
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total" value={obrigacoes.length} icon="📋" color="#64748b" bg="#f8fafc" border="#e2e8f0" />
        <StatCard label="Pendentes" value={obrigacoes.filter(o => o.status === 'pendente').length} icon="⏳" color="#f59e0b" bg="#fffbeb" border="#fde68a" />
        <StatCard label="Em andamento" value={obrigacoes.filter(o => o.status === 'em_andamento').length} icon="🔄" color="#3b82f6" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Concluídas" value={obrigacoes.filter(o => o.status === 'concluida').length} icon="✅" color="#10b981" bg="#f0fdf4" border="#bbf7d0" />
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'obrigacoes' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[['', 'Todas'], ['pendente', 'Pendentes'], ['em_andamento', 'Em andamento'], ['concluida', 'Concluídas'], ['atrasada', 'Atrasadas']].map(([v, l]) => (
              <button key={v} onClick={() => setFiltroStatus(v)}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: '1.5px solid', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                  borderColor: filtroStatus === v ? '#2563eb' : '#e2e8f0',
                  background: filtroStatus === v ? '#eff6ff' : 'white',
                  color: filtroStatus === v ? '#2563eb' : '#64748b',
                }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Carregando...</div>
            ) : filtradas.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                <div style={{ fontWeight: 600, color: '#475569' }}>Nenhuma obrigação encontrada</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Crie manualmente ou gere a partir dos modelos na aba Modelos</div>
              </div>
            ) : filtradas.map(o => (
              <div key={o.id} style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{o.title}</span>
                    <Badge color={statusCor[o.status]}>{o.status.replace('_', ' ')}</Badge>
                    {o.periodicity && <Badge color="purple">{o.periodicity}</Badge>}
                  </div>
                  {o.clients && <div style={{ fontSize: 12, color: '#64748b' }}>👤 {o.clients.razao_social}</div>}
                  {o.description && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{o.description}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {o.due_date && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Vencimento</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{format(parseISO(o.due_date), 'dd/MM/yyyy')}</div>
                    </div>
                  )}
                  {o.status !== 'concluida' && o.status !== 'cancelada' && (
                    <select value={o.status} onChange={e => alterarStatus(o.id, e.target.value)}
                      style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', background: 'white' }}>
                      <option value="pendente">Pendente</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="concluida">Concluída</option>
                      <option value="atrasada">Atrasada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'modelos' && (
        <div>
          {Object.keys(tribGrouped).length === 0 ? (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚙️</div>
              <div style={{ fontWeight: 600, color: '#475569', fontSize: 16 }}>Nenhum modelo configurado</div>
              <div style={{ fontSize: 13, marginTop: 4, marginBottom: 20 }}>Crie modelos por regime tributário e gere obrigações automaticamente para todos os clientes</div>
              <Btn onClick={() => setShowTemplateModal(true)}><Plus size={14} /> Criar Primeiro Modelo</Btn>
            </div>
          ) : Object.entries(tribGrouped).map(([trib, items]) => (
            <div key={trib} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f8fafc', padding: '3px 12px', borderRadius: 20, border: '1px solid #e2e8f0' }}>
                  {tribLabel[trib] || trib}
                </span>
                <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {items.map(t => (
                  <div key={t.id} style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{t.name}</div>
                      <button onClick={() => excluirTemplate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11, padding: 2, flexShrink: 0 }}>✕</button>
                    </div>
                    {t.description && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, lineHeight: 1.4 }}>{t.description}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="purple">{t.periodicity}</Badge>
                      <Badge color="blue">Dia {t.due_day}</Badge>
                      {t.category && <Badge color="slate">{t.category}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Obrigação */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Obrigação" size="lg">
        <form onSubmit={salvarObrigacao}>
          <Select label="Cliente *" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required>
            <option value="">Selecione o cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </Select>
          <Input label="Título *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: DAS Simples Nacional" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Vencimento" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            <Select label="Periodicidade" value={form.periodicity} onChange={e => setForm(f => ({ ...f, periodicity: e.target.value }))}>
              {PERIODICIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Categoria" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Fiscal, Trabalhista..." />
            <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em andamento</option>
            </Select>
          </div>
          <Textarea label="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Novo Template */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title="Novo Modelo de Obrigação" size="lg">
        <form onSubmit={salvarTemplate}>
          <Input label="Nome da obrigação *" value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: DAS Simples Nacional, DCTF, eSocial..." required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select label="Regime tributário *" value={tplForm.tributacao} onChange={e => setTplForm(f => ({ ...f, tributacao: e.target.value }))}>
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
              <option value="mei">MEI</option>
              <option value="todos">Todos os regimes</option>
            </Select>
            <Select label="Periodicidade" value={tplForm.periodicity} onChange={e => setTplForm(f => ({ ...f, periodicity: e.target.value }))}>
              {PERIODICIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Dia de vencimento (1-28)" type="number" min="1" max="28" value={tplForm.due_day} onChange={e => setTplForm(f => ({ ...f, due_day: e.target.value }))} placeholder="15" />
            <Input label="Categoria" value={tplForm.category} onChange={e => setTplForm(f => ({ ...f, category: e.target.value }))} placeholder="Fiscal, Trabalhista, Previdenciário..." />
          </div>
          <Textarea label="Descrição / Instrução" value={tplForm.description} onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Detalhes sobre a obrigação..." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowTemplateModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Modelo'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Gerar Obrigações */}
      <Modal open={showGerarModal} onClose={() => setShowGerarModal(false)} title="Gerar Obrigações por Tributação">
        <form onSubmit={gerarObrigacoes}>
          <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#1e40af', border: '1px solid #bfdbfe' }}>
            Serão geradas obrigações para os clientes do regime selecionado, com base nos modelos cadastrados. O vencimento é calculado a partir do dia definido em cada modelo.
          </div>
          <Select label="Regime Tributário *" value={gerarTrib} onChange={e => setGerarTrib(e.target.value)}>
            <option value="simples_nacional">Simples Nacional</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="lucro_real">Lucro Real</option>
            <option value="mei">MEI</option>
          </Select>
          <Select label="Cliente específico (opcional)" value={gerarCliente} onChange={e => setGerarCliente(e.target.value)}>
            <option value="">Todos os clientes do regime</option>
            {clientes.filter(c => c.tributacao === gerarTrib).map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </Select>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
            {templates.filter(t => t.tributacao === gerarTrib || t.tributacao === 'todos').length} modelo(s) · {gerarCliente ? 1 : clientes.filter(c => c.tributacao === gerarTrib).length} cliente(s)
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Btn variant="secondary" onClick={() => setShowGerarModal(false)}>Cancelar</Btn>
            <Btn variant="success" type="submit" disabled={saving}><Zap size={13} /> {saving ? 'Gerando...' : 'Gerar Agora'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
