import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO, addMonths, setDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea, StatCard, TabBar } from '../../components/ui'
import { Plus, Settings, Zap, Mail, History } from 'lucide-react'

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
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showHistoricoModal, setShowHistoricoModal] = useState(false)
  const [emailTarget, setEmailTarget] = useState(null)
  const [emailForm, setEmailForm] = useState({ sent_to: '', subject: '', message: '' })
  const [emailLogs, setEmailLogs] = useState([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gerarTrib, setGerarTrib] = useState('simples_nacional')
  const [gerarCliente, setGerarCliente] = useState('')
  const [form, setForm] = useState({ client_id: '', title: '', description: '', due_date: '', data_meta: '', status: 'pendente', periodicity: 'mensal', category: '' })
  const [tplForm, setTplForm] = useState({ name: '', description: '', tributacao: 'simples_nacional', periodicity: 'mensal', due_day: '15', category: '' })

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [oRes, tRes, cRes] = await Promise.all([
      supabase.from('obligations').select('*, clients(razao_social, tributacao)').order('due_date'),
      supabase.from('obligation_templates').select('*').order('tributacao, name'),
      supabase.from('clients').select('id, razao_social, tributacao, setores_responsaveis').eq('status', 'ativo').order('razao_social'),
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
    setForm({ client_id: '', title: '', description: '', due_date: '', data_meta: '', status: 'pendente', periodicity: 'mensal', category: '' })
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

    const sectorMap = { 'Fiscal': 'fiscal', 'Pessoal': 'pessoal', 'Contábil': 'contabil', 'Societário': 'societario', 'DP': 'pessoal' }

    for (const cli of clientesFiltrados) {
      for (const tpl of tplsFiltrados) {
        const dia = Math.min(Number(tpl.due_day || 15), 28)
        let dataVenc = setDate(hoje, dia)
        if (dataVenc < hoje) dataVenc = addMonths(dataVenc, 1)
        // data_meta = 3 dias antes do vencimento como sugestão
        const dataMeta = addMonths(dataVenc, 0)
        dataMeta.setDate(dataMeta.getDate() - 3)
        // responsável pelo setor desta obrigação
        const sectorKey = sectorMap[tpl.category] || null
        const responsibleId = sectorKey && cli.setores_responsaveis ? cli.setores_responsaveis[sectorKey] || null : null
        registros.push({
          client_id: cli.id,
          title: tpl.name,
          description: tpl.description || '',
          due_date: format(dataVenc, 'yyyy-MM-dd'),
          data_meta: format(dataMeta, 'yyyy-MM-dd'),
          status: 'pendente',
          periodicity: tpl.periodicity,
          category: tpl.category || '',
          responsible_id: responsibleId,
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

  async function abrirEmailModal(o) {
    setEmailTarget(o)
    // Pré-busca e-mail do cliente
    const { data: cli } = await supabase.from('clients').select('email, razao_social').eq('id', o.client_id).single()
    setEmailForm({
      sent_to: cli?.email || '',
      subject: `Obrigação: ${o.title}`,
      message: `Prezado(a),\n\nInformamos que há uma obrigação pendente referente a ${o.title}.\n\nData limite: ${o.due_date ? format(parseISO(o.due_date), "dd/MM/yyyy") : 'não definida'}.\n\nClique no botão abaixo para visualizar os detalhes.\n\nAtenciosamente,\nAggio Contábil`,
    })
    setShowEmailModal(true)
  }

  async function enviarEmail(e) {
    e.preventDefault()
    setSendingEmail(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-obligation-email', {
        body: {
          obligation_id: emailTarget.id,
          client_id: emailTarget.client_id,
          sent_to: emailForm.sent_to,
          subject: emailForm.subject,
          message: emailForm.message,
        },
      })
      if (error || !data?.ok) throw new Error(data?.error || 'Erro ao enviar')
      alert('E-mail enviado com sucesso!')
      setShowEmailModal(false)
    } catch (err) {
      alert('Erro ao enviar e-mail: ' + err.message)
    }
    setSendingEmail(false)
  }

  async function abrirHistorico(o) {
    setEmailTarget(o)
    const { data } = await supabase
      .from('obligation_email_logs')
      .select('*')
      .eq('obligation_id', o.id)
      .order('sent_at', { ascending: false })
    setEmailLogs(data || [])
    setShowHistoricoModal(true)
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  {o.data_meta && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>Meta</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>{format(parseISO(o.data_meta), 'dd/MM/yyyy')}</div>
                    </div>
                  )}
                  {o.due_date && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Limite</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{format(parseISO(o.due_date), 'dd/MM/yyyy')}</div>
                    </div>
                  )}
                  {/* Botões de e-mail */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => abrirEmailModal(o)} title="Enviar e-mail"
                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                      <Mail size={13} />
                    </button>
                    <button onClick={() => abrirHistorico(o)} title="Histórico de e-mails"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      <History size={13} />
                    </button>
                  </div>
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
            <Input label="Data Meta (entregar até)" type="date" value={form.data_meta} onChange={e => setForm(f => ({ ...f, data_meta: e.target.value }))} />
            <Input label="Data Limite (prazo máximo)" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Select label="Periodicidade" value={form.periodicity} onChange={e => setForm(f => ({ ...f, periodicity: e.target.value }))}>
              {PERIODICIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
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

      {/* Modal Enviar E-mail */}
      <Modal open={showEmailModal} onClose={() => setShowEmailModal(false)} title="Enviar E-mail ao Cliente" size="lg">
        <form onSubmit={enviarEmail}>
          {emailTarget && (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#475569', border: '1px solid #e2e8f0' }}>
              📋 <strong>{emailTarget.title}</strong> · {emailTarget.clients?.razao_social}
            </div>
          )}
          <Input label="Destinatário (e-mail) *" type="email" value={emailForm.sent_to} onChange={e => setEmailForm(f => ({ ...f, sent_to: e.target.value }))} placeholder="cliente@email.com" required />
          <Input label="Assunto *" value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} required />
          <Textarea label="Mensagem *" value={emailForm.message} onChange={e => setEmailForm(f => ({ ...f, message: e.target.value }))} rows={6} required />
          <div style={{ background: '#fffbeb', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e', border: '1px solid #fde68a', marginBottom: 8 }}>
            💡 Um link de rastreamento será incluído automaticamente no e-mail. Você poderá ver quando o cliente acessar.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowEmailModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={sendingEmail}><Mail size={13} /> {sendingEmail ? 'Enviando...' : 'Enviar E-mail'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Histórico de E-mails */}
      <Modal open={showHistoricoModal} onClose={() => setShowHistoricoModal(false)} title="Histórico de E-mails" size="lg">
        {emailTarget && (
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#475569', border: '1px solid #e2e8f0' }}>
            📋 <strong>{emailTarget.title}</strong> · {emailTarget.clients?.razao_social}
          </div>
        )}
        {emailLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
            <Mail size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontWeight: 600 }}>Nenhum e-mail enviado ainda</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {emailLogs.map(log => (
              <div key={log.id} style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{log.subject}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Para: {log.sent_to}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Enviado em</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                      {format(parseISO(log.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {log.access_count === 0 ? (
                    <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                      ✉️ Não visualizado
                    </span>
                  ) : (
                    <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                      ✅ Visualizado {log.access_count}x
                    </span>
                  )}
                  {log.first_accessed_at && (
                    <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                      🕐 1º acesso: {format(parseISO(log.first_accessed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  {log.last_accessed_at && log.access_count > 1 && (
                    <span style={{ background: '#fafaf9', color: '#78716c', border: '1px solid #e7e5e4', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                      Último: {format(parseISO(log.last_accessed_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="secondary" onClick={() => setShowHistoricoModal(false)}>Fechar</Btn>
        </div>
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
