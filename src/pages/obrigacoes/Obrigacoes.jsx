import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO, addMonths, setDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea, StatCard, TabBar } from '../../components/ui'
import { Plus, Settings, Zap, Mail, History, Paperclip, X, FileText, Upload } from 'lucide-react'

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
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('obrigacoes')
  const [filtroStatus, setFiltroStatus] = useState('ativas') // padrão: pendentes+em_andamento+atrasadas
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editandoTemplateId, setEditandoTemplateId] = useState(null)
  const [showGerarModal, setShowGerarModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showHistoricoModal, setShowHistoricoModal] = useState(false)
  const [emailTarget, setEmailTarget] = useState(null)
  const [emailForm, setEmailForm] = useState({ sent_to: '', subject: '', message: '' })
  const [emailLogs, setEmailLogs] = useState([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [anexos, setAnexos] = useState([]) // { file, name, size, uploading, url, error }
  const anexosRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [gerarTrib, setGerarTrib] = useState('simples_nacional')
  const [gerarCliente, setGerarCliente] = useState('')
  const [form, setForm] = useState({ client_id: '', title: '', description: '', due_date: '', status: 'pendente', periodicity: 'mensal', category: '', enviar_cliente: false, responsible_user_id: '' })
  const [tplForm, setTplForm] = useState({ name: '', description: '', tributacao: 'simples_nacional', periodicity: 'mensal', due_day: '15', category: '', enviar_cliente: false, email_subject: '', email_template: '', competencia_offset: 0, meses_competencia: [] })

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [oRes, tRes, cRes, uRes] = await Promise.all([
      supabase.from('obligations').select('*, clients(razao_social, tributacao), users!obligations_responsible_user_id_fkey(name)').order('due_date'),
      supabase.from('obligation_templates').select('*').order('tributacao, name'),
      supabase.from('clients').select('id, razao_social, tributacao, setores_responsaveis').eq('status', 'ativo').order('razao_social'),
      supabase.from('users').select('id, name').order('name'),
    ])
    setObrigacoes(oRes.data || [])
    setTemplates(tRes.data || [])
    setClientes(cRes.data || [])
    setUsuarios(uRes.data || [])
    setLoading(false)
  }

  const filtradas = obrigacoes.filter(o => {
    // Filtro de status
    if (filtroStatus === 'ativas') {
      if (['concluida', 'cancelada'].includes(o.status)) return false
    } else if (filtroStatus) {
      if (o.status !== filtroStatus) return false
    }
    // Filtro de mês (pelo due_date)
    if (filtroMes && o.due_date && o.due_date.slice(0,7) !== filtroMes) return false
    // Filtro de usuário responsável
    if (filtroUsuario && o.responsible_user_id !== filtroUsuario) return false
    // Busca texto
    if (filtroBusca) {
      const q = filtroBusca.toLowerCase()
      const matchTitle = o.title?.toLowerCase().includes(q)
      const matchCliente = o.clients?.razao_social?.toLowerCase().includes(q)
      if (!matchTitle && !matchCliente) return false
    }
    return true
  })

  async function salvarObrigacao(e) {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, responsible_user_id: form.responsible_user_id || null }
    await supabase.from('obligations').insert(payload)
    setSaving(false); setShowModal(false)
    setForm({ client_id: '', title: '', description: '', due_date: '', status: 'pendente', periodicity: 'mensal', category: '', enviar_cliente: false, responsible_user_id: '' })
    fetchTudo()
  }

  async function salvarTemplate(e) {
    e.preventDefault(); setSaving(true)
    const payload = { ...tplForm, due_day: Number(tplForm.due_day) }
    if (editandoTemplateId) {
      await supabase.from('obligation_templates').update(payload).eq('id', editandoTemplateId)
    } else {
      await supabase.from('obligation_templates').insert(payload)
    }
    setSaving(false); setShowTemplateModal(false); setEditandoTemplateId(null)
    setTplForm({ name: '', description: '', tributacao: 'simples_nacional', periodicity: 'mensal', due_day: '15', category: '', enviar_cliente: false, email_subject: '', email_template: '', competencia_offset: 0, meses_competencia: [] })
    fetchTudo()
  }

  function abrirEdicaoTemplate(t) {
    setTplForm({
      name: t.name || '',
      description: t.description || '',
      tributacao: t.tributacao || 'simples_nacional',
      periodicity: t.periodicity || 'mensal',
      due_day: String(t.due_day || '15'),
      category: t.category || '',
      enviar_cliente: t.enviar_cliente || false,
      email_subject: t.email_subject || '',
      email_template: t.email_template || '',
      competencia_offset: t.competencia_offset ?? 0,
      meses_competencia: t.meses_competencia || [],
    })
    setEditandoTemplateId(t.id)
    setShowTemplateModal(true)
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
        const sectorKey = sectorMap[tpl.category] || null
        const responsibleId = sectorKey && cli.setores_responsaveis ? cli.setores_responsaveis[sectorKey] || null : null

        // Determina em quais meses gerar. Para periocidades não-mensais, usa meses_competencia se definido.
        const meses = (tpl.periodicity !== 'mensal' && tpl.meses_competencia?.length)
          ? tpl.meses_competencia // array de números de mês (0-11)
          : [hoje.getMonth()]

        for (const mes of meses) {
          const anoBase = hoje.getFullYear()
          let dataVenc = new Date(anoBase, mes, dia)
          if (dataVenc < hoje) dataVenc = new Date(anoBase + 1, mes, dia)

          const offset = Number(tpl.competencia_offset || 0)
          const dataCompetencia = offset !== 0 ? addMonths(dataVenc, offset) : null

          registros.push({
            client_id: cli.id,
            title: tpl.name,
            description: tpl.description || '',
            due_date: format(dataVenc, 'yyyy-MM-dd'),
            status: 'pendente',
            periodicity: tpl.periodicity,
            category: tpl.category || '',
            responsible_id: responsibleId,
            enviar_cliente: tpl.enviar_cliente || false,
            ...(dataCompetencia ? { competencia: format(dataCompetencia, 'yyyy-MM-dd') } : {}),
          })
        }
      }
    }

    if (registros.length === 0) {
      setSaving(false)
      alert('Nenhuma obrigação para gerar. Verifique se há modelos e clientes cadastrados para o regime selecionado.')
      return
    }

    // Insere em lotes de 50 para evitar limite do Supabase
    const CHUNK = 50
    let totalInseridos = 0
    let erros = []
    for (let i = 0; i < registros.length; i += CHUNK) {
      const lote = registros.slice(i, i + CHUNK)
      const { error } = await supabase.from('obligations').insert(lote)
      if (error) {
        erros.push(error.message)
      } else {
        totalInseridos += lote.length
      }
    }

    setSaving(false); setShowGerarModal(false)
    fetchTudo()
    if (erros.length > 0) {
      alert(`${totalInseridos} gerada(s) com sucesso.\nErro em ${erros.length} lote(s): ${erros[0]}`)
    } else {
      alert(`${totalInseridos} obrigação(ões) gerada(s) com sucesso!`)
    }
  }

  async function abrirEmailModal(o) {
    setEmailTarget(o)
    // Busca e-mail do cliente e template do modelo (se houver)
    const [cliRes, tplRes] = await Promise.all([
      supabase.from('clients').select('email, razao_social').eq('id', o.client_id).single(),
      supabase.from('obligation_templates').select('email_subject, email_template').eq('name', o.title).maybeSingle(),
    ])
    const cli = cliRes.data
    const tpl = tplRes.data
    const dataLimite = o.due_date ? format(parseISO(o.due_date), "dd/MM/yyyy") : 'não definida'
    setEmailForm({
      sent_to: cli?.email || '',
      subject: tpl?.email_subject || `Obrigação: ${o.title}`,
      message: tpl?.email_template
        ? tpl.email_template
            .replace('{cliente}', cli?.razao_social || '')
            .replace('{obrigacao}', o.title)
            .replace('{data_limite}', dataLimite)
        : `Prezado(a),\n\nInformamos que há uma obrigação pendente referente a ${o.title}.\n\nData limite: ${dataLimite}.\n\nClique no botão abaixo para visualizar os detalhes.\n\nAtenciosamente,\nAggio Contábil`,
    })
    setAnexos([])
    setShowEmailModal(true)
  }

  // Extrai cliente e competência do nome do arquivo
  // Formatos suportados: "DAS - 05-2026 - EMPRESA LTDA - VENC 22-06-2026.pdf"
  // ou "EMPRESA LTDA - DAS - 05-2026.pdf" etc.
  function parsearNomeArquivo(filename) {
    const nome = filename.replace(/\.[^.]+$/, '') // remove extensão
    const info = { clienteDetectado: null, competenciaDetectada: null, vencimentoDetectado: null }

    // Competência: MM-YYYY ou MM/YYYY
    const compMatch = nome.match(/\b(0[1-9]|1[0-2])[-\/](20\d{2})\b/)
    if (compMatch) info.competenciaDetectada = `${compMatch[1]}/${compMatch[2]}`

    // Vencimento: DD-MM-YYYY ou DD/MM/YYYY (após VENC ou VEN ou VENCIMENTO)
    const vencMatch = nome.match(/(?:VENC(?:IMENTO)?[:\s-]*)(0[1-9]|[12]\d|3[01])[-\/](0[1-9]|1[0-2])[-\/](20\d{2})/i)
    if (vencMatch) info.vencimentoDetectado = `${vencMatch[3]}-${vencMatch[2]}-${vencMatch[1]}`

    // Tenta identificar cliente comparando partes do nome com clientes cadastrados
    const partes = nome.split(/\s*[-–]\s*/)
    for (const parte of partes) {
      const parteLimpa = parte.trim().toUpperCase()
      if (parteLimpa.length < 4) continue
      // Ignora partes que são datas ou palavras-chave
      if (/^\d|^(DAS|DARF|GFIP|SPED|ECF|DEFIS|PGDAS|VENC|GUIA|NFE|NF)/i.test(parteLimpa)) continue
      const clienteMatch = clientes.find(c =>
        c.razao_social.toUpperCase().includes(parteLimpa) ||
        parteLimpa.includes(c.razao_social.toUpperCase().split(' ').slice(0,2).join(' '))
      )
      if (clienteMatch) { info.clienteDetectado = clienteMatch; break }
    }

    return info
  }

  async function adicionarAnexos(files) {
    const novos = Array.from(files).map(f => {
      const info = parsearNomeArquivo(f.name)
      return { file: f, name: f.name, size: f.size, uploading: true, url: null, error: null, ...info }
    })
    setAnexos(prev => [...prev, ...novos])
    for (let i = 0; i < novos.length; i++) {
      const f = novos[i].file
      const path = `obrigacoes/${emailTarget.id}/${Date.now()}_${f.name}`
      const { data, error } = await supabase.storage.from('obligation-files').upload(path, f, { upsert: true })
      if (error) {
        setAnexos(prev => prev.map(a => a.name === f.name && a.uploading ? { ...a, uploading: false, error: error.message } : a))
      } else {
        const { data: urlData } = supabase.storage.from('obligation-files').getPublicUrl(path)
        setAnexos(prev => prev.map(a => a.name === f.name && a.uploading ? { ...a, uploading: false, url: urlData.publicUrl } : a))
      }
    }
  }

  function removerAnexo(idx) {
    setAnexos(prev => prev.filter((_, i) => i !== idx))
  }

  async function enviarEmail(e) {
    e.preventDefault()
    setSendingEmail(true)
    try {
      const uploadedUrls = anexos.filter(a => a.url).map(a => ({ name: a.name, url: a.url }))
      const { data, error } = await supabase.functions.invoke('send-obligation-email', {
        body: {
          obligation_id: emailTarget.id,
          client_id: emailTarget.client_id,
          sent_to: emailForm.sent_to,
          subject: emailForm.subject,
          message: emailForm.message,
          attachments: uploadedUrls,
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
    // Se concluída e marcada para enviar ao cliente → abre modal de e-mail automaticamente
    if (status === 'concluida') {
      const ob = obrigacoes.find(o => o.id === id)
      if (ob?.enviar_cliente) {
        setTimeout(() => abrirEmailModal({ ...ob, status: 'concluida' }), 300)
      }
    }
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
          {/* Filtros de status */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[['ativas', 'A Vencer'], ['', 'Todas'], ['pendente', 'Pendentes'], ['em_andamento', 'Em andamento'], ['atrasada', 'Atrasadas'], ['concluida', 'Concluídas']].map(([v, l]) => (
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
          {/* Filtros avançados */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }}>🔍</span>
              <input value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} placeholder="Buscar por nome ou cliente..."
                style={{ width: '100%', padding: '8px 10px 8px 30px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Mês:</label>
              <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
                style={{ padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: 'white', outline: 'none', cursor: 'pointer' }} />
            </div>
            <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: 'white', outline: 'none', cursor: 'pointer' }}>
              <option value="">Todos os responsáveis</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {(filtroBusca || filtroMes || filtroUsuario) && (
              <button onClick={() => { setFiltroBusca(''); setFiltroMes(''); setFiltroUsuario('') }}
                style={{ padding: '8px 12px', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 12, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Limpar
              </button>
            )}
            <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{filtradas.length} resultado(s)</span>
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
                  {o.users && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 1 }}>🙋 {o.users.name}</div>}
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
                  {/* Botões de e-mail — só para obrigações marcadas para enviar ao cliente */}
                  {o.enviar_cliente ? (
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
                  ) : (
                    <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      Interno
                    </span>
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
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => abrirEdicaoTemplate(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: 11, padding: '2px 6px', borderRadius: 4 }} title="Editar">✏️</button>
                        <button onClick={() => excluirTemplate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11, padding: 2, flexShrink: 0 }} title="Excluir">✕</button>
                      </div>
                    </div>
                    {t.description && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, lineHeight: 1.4 }}>{t.description}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="purple">{t.periodicity}</Badge>
                      <Badge color="blue">Dia {t.due_day}</Badge>
                      {t.category && <Badge color="slate">{t.category}</Badge>}
                      {t.enviar_cliente
                        ? <Badge color="green">📧 Envia ao cliente</Badge>
                        : <Badge color="slate">🔒 Interno</Badge>}
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
          <Select label="Responsável" value={form.responsible_user_id} onChange={e => setForm(f => ({ ...f, responsible_user_id: e.target.value }))}>
            <option value="">Sem responsável atribuído</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Textarea label="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          <ToggleEnviarCliente value={form.enviar_cliente} onChange={v => setForm(f => ({ ...f, enviar_cliente: v }))} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Novo/Editar Template */}
      <Modal open={showTemplateModal} onClose={() => { setShowTemplateModal(false); setEditandoTemplateId(null); setTplForm({ name: '', description: '', tributacao: 'simples_nacional', periodicity: 'mensal', due_day: '15', category: '', enviar_cliente: false, email_subject: '', email_template: '', competencia_offset: 0, meses_competencia: [] }) }} title={editandoTemplateId ? 'Editar Modelo de Obrigação' : 'Novo Modelo de Obrigação'} size="lg">
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Dia de vencimento (1-28)" type="number" min="1" max="28" value={tplForm.due_day} onChange={e => setTplForm(f => ({ ...f, due_day: e.target.value }))} placeholder="15" />
            <Select label="Competência" value={tplForm.competencia_offset} onChange={e => setTplForm(f => ({ ...f, competencia_offset: Number(e.target.value) }))}>
              <option value={0}>Mesmo mês</option>
              <option value={-1}>Mês anterior (-1)</option>
              <option value={-2}>2 meses antes (-2)</option>
              <option value={-3}>3 meses antes (-3)</option>
            </Select>
            <Input label="Categoria" value={tplForm.category} onChange={e => setTplForm(f => ({ ...f, category: e.target.value }))} placeholder="Fiscal, Trabalhista..." />
          </div>

          {tplForm.competencia_offset !== 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#92400e' }}>
              ℹ️ Competência <strong>{tplForm.competencia_offset}</strong> mês(es) em relação à data de entrega. Ex: entrega em fevereiro → competência de {tplForm.competencia_offset === -1 ? 'janeiro' : tplForm.competencia_offset === -2 ? 'dezembro' : 'novembro'}.
            </div>
          )}

          {tplForm.periodicity !== 'mensal' && tplForm.periodicity !== 'esporadica' && (
            <SeletorMeses
              periodicity={tplForm.periodicity}
              value={tplForm.meses_competencia}
              onChange={v => setTplForm(f => ({ ...f, meses_competencia: v }))}
            />
          )}

          <Textarea label="Descrição / Instrução" value={tplForm.description} onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Detalhes sobre a obrigação..." />
          <ToggleEnviarCliente value={tplForm.enviar_cliente} onChange={v => setTplForm(f => ({ ...f, enviar_cliente: v }))} />
          {tplForm.enviar_cliente && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>📧 Template de E-mail</div>
              <Input label="Assunto padrão" value={tplForm.email_subject} onChange={e => setTplForm(f => ({ ...f, email_subject: e.target.value }))} placeholder={`Obrigação: ${tplForm.name || 'Nome da obrigação'}`} />
              <Textarea label="Corpo da mensagem" value={tplForm.email_template} onChange={e => setTplForm(f => ({ ...f, email_template: e.target.value }))} rows={5} placeholder={`Prezado(a),\n\nInformamos que há uma obrigação pendente referente a {obrigacao}.\n\nData limite: {data_limite}.\n\nAtenciosamente,\nAggio Contábil`} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                Variáveis disponíveis: <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>{'{cliente}'}</code> <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>{'{obrigacao}'}</code> <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>{'{data_limite}'}</code>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => { setShowTemplateModal(false); setEditandoTemplateId(null) }}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : editandoTemplateId ? 'Salvar Alterações' : 'Salvar Modelo'}</Btn>
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
          {/* Área de Anexos */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <Paperclip size={12} style={{ display: 'inline', marginRight: 4 }} />Anexos
            </div>
            <div
              onClick={() => anexosRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6' }}
              onDragLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0' }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; adicionarAnexos(e.dataTransfer.files) }}
              style={{ border: '2px dashed #e2e8f0', borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.15s', marginBottom: anexos.length > 0 ? 10 : 0 }}
            >
              <Upload size={18} style={{ color: '#94a3b8', marginBottom: 4 }} />
              <div style={{ fontSize: 12, color: '#64748b' }}>Clique ou arraste arquivos aqui</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>PDF, Word, Excel, imagens...</div>
              <input ref={anexosRef} type="file" multiple style={{ display: 'none' }} onChange={e => adicionarAnexos(e.target.files)} />
            </div>
            {anexos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {anexos.map((a, idx) => (
                  <div key={idx} style={{ background: a.error ? '#fef2f2' : a.uploading ? '#f0f9ff' : '#f0fdf4', border: `1px solid ${a.error ? '#fecaca' : a.uploading ? '#bae6fd' : '#bbf7d0'}`, borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} style={{ color: a.error ? '#dc2626' : a.uploading ? '#0284c7' : '#16a34a', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          {a.uploading ? 'Enviando...' : a.error ? `Erro: ${a.error}` : `${(a.size / 1024).toFixed(0)} KB · Pronto`}
                        </div>
                      </div>
                      <button type="button" onClick={() => removerAnexo(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex', alignItems: 'center' }}>
                        <X size={14} />
                      </button>
                    </div>
                    {/* Informações detectadas automaticamente */}
                    {!a.uploading && !a.error && (a.clienteDetectado || a.competenciaDetectada || a.vencimentoDetectado) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, paddingTop: 6, borderTop: '1px solid #bbf7d0' }}>
                        {a.clienteDetectado && (
                          <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                            👤 {a.clienteDetectado.razao_social}
                          </span>
                        )}
                        {a.competenciaDetectada && (
                          <span style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                            📅 Competência: {a.competenciaDetectada}
                          </span>
                        )}
                        {a.vencimentoDetectado && (
                          <span style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                            ⚠️ Venc: {a.vencimentoDetectado.split('-').reverse().join('/')}
                          </span>
                        )}
                        {!a.clienteDetectado && !a.competenciaDetectada && <span style={{ fontSize: 10, color: '#94a3b8' }}>Não foi possível identificar dados automaticamente</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ background: '#fffbeb', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e', border: '1px solid #fde68a', marginBottom: 8 }}>
            💡 Um link de rastreamento será incluído automaticamente no e-mail. Você poderá ver quando o cliente acessar.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowEmailModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={sendingEmail || anexos.some(a => a.uploading)}><Mail size={13} /> {sendingEmail ? 'Enviando...' : 'Enviar E-mail'}</Btn>
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

function ToggleEnviarCliente({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: value ? '#f0fdf4' : '#f8fafc',
        border: `1.5px solid ${value ? '#bbf7d0' : '#e2e8f0'}`,
        borderRadius: 12, cursor: 'pointer', marginTop: 4, userSelect: 'none',
        transition: 'all 0.15s',
      }}
    >
      {/* Switch */}
      <div style={{
        width: 38, height: 22, borderRadius: 11, flexShrink: 0,
        background: value ? '#16a34a' : '#cbd5e1',
        position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: value ? 19 : 3,
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: value ? '#15803d' : '#475569' }}>
          {value ? '📧 Enviar ao cliente' : '🔒 Apenas registro interno'}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
          {value
            ? 'O botão de e-mail ficará disponível nesta obrigação'
            : 'Não aparecerá opção de enviar e-mail para esta obrigação'}
        </div>
      </div>
    </div>
  )
}

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const MESES_POR_PERIODICIDADE = {
  bimestral: { sugestao: [0, 2, 4, 6, 8, 10], label: 'Bimestral — selecione os 6 meses de entrega' },
  trimestral: { sugestao: [2, 5, 8, 11], label: 'Trimestral — selecione os 4 meses de entrega' },
  semestral: { sugestao: [5, 11], label: 'Semestral — selecione os 2 meses de entrega' },
  anual: { sugestao: [11], label: 'Anual — selecione o mês de entrega' },
}

function SeletorMeses({ periodicity, value, onChange }) {
  const info = MESES_POR_PERIODICIDADE[periodicity]
  if (!info) return null

  function toggle(m) {
    if (value.includes(m)) onChange(value.filter(x => x !== m))
    else onChange([...value, m].sort((a, b) => a - b))
  }

  return (
    <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 12, padding: '14px 16px', marginTop: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📅 {info.label}</span>
        {value.length === 0 && (
          <button type="button" onClick={() => onChange(info.sugestao)}
            style={{ fontSize: 11, color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
            Usar sugestão
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MESES_LABELS.map((label, i) => {
          const sel = value.includes(i)
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: sel ? '#0284c7' : 'white',
                color: sel ? 'white' : '#64748b',
                border: `1.5px solid ${sel ? '#0284c7' : '#e2e8f0'}`,
                transition: 'all 0.12s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
      {value.length > 0 && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
          Meses selecionados: {value.map(m => MESES_LABELS[m]).join(', ')}
        </div>
      )}
    </div>
  )
}
