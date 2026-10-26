import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Btn, Modal, Input, Select, Textarea, StatCard } from '../../components/ui'
import { Plus, MessageCircle, Phone, Trash2, Settings, FileText } from 'lucide-react'
import { fmtBRL, diasDesde, waLink, inputBase, hojeISO } from '../../lib/util'
import { ETAPAS_PADRAO, MODELOS_PADRAO, CAMPOS_REQUISITO, requisitoOk, dadosDoLead, preencherModelo } from '../../lib/funilPadrao'
import ConfigFunil from './ConfigFunil'
import ModelosDocs from './ModelosDocs'

const TITULOS = {
  servicos: ['Funil Comercial · Serviços', 'Abertura de empresa, contabilidade mensal, alterações e serviços avulsos'],
  obras: ['Funil Comercial · Regularização de Obras (INSS)', 'CNO, aferição no SERO e CND de obra'],
}
const SERVICOS = {
  servicos: ['Abertura de empresa', 'Contabilidade mensal', 'Alteração contratual', 'Baixa de empresa', 'Transferência de contabilidade', 'IRPF', 'Planejamento tributário', 'Regularização fiscal', 'Outro'],
  obras: ['CND de obra (completa)', 'Inscrição de CNO', 'Aferição / SERO', 'Obra isenta (casa popular)', 'Retificação / Parcelamento', 'Outro'],
}
const ORIGENS = ['Instagram', 'WhatsApp', 'Indicação', 'Site', 'Google', 'Parceiro (engenheiro/arquiteto)', 'Cliente da casa', 'Outro']
const TIPOS_OBRA = ['Residencial unifamiliar', 'Residencial multifamiliar', 'Comercial', 'Galpão / Industrial', 'Reforma / Ampliação', 'Outro']

const vazio = (funil) => ({
  nome: '', empresa: '', telefone: '', email: '', origem: '', servico: '', comissionador_id: '',
  valor_estimado: '', observacoes: '', responsavel_id: '', stage: '',
  dados: funil === 'obras'
    ? { tipo_pessoa: 'PF', tipo_obra: '', area_m2: '', municipio: '', cno: '', situacao_obra: '', documento: '', endereco: '', prazo_execucao: '60 dias' }
    : { tipo_valor: 'mensal', regime: '', documento: '', endereco: '', dia_vencimento: '10' },
})

export default function Funil({ funil }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [titulo, subtitulo] = TITULOS[funil]
  const [etapas, setEtapas] = useState([])
  const [leads, setLeads] = useState([])
  const [docs, setDocs] = useState([])
  const [modelos, setModelos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [comissionadores, setComissionadores] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [somenteParados, setSomenteParados] = useState(false)
  const [modal, setModal] = useState(null)          // { id?, form }
  const [saving, setSaving] = useState(false)
  const [pendModal, setPendModal] = useState(null)  // { lead, alvo, itens }
  const [perdaModal, setPerdaModal] = useState(null)
  const [fech, setFech] = useState(null)            // fechamento (ganho)
  const [escolhaModelo, setEscolhaModelo] = useState(null) // { lead, tipo, lista }
  const [configAberta, setConfigAberta] = useState(false)
  const [modelosAbertos, setModelosAbertos] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  useEffect(() => { carregar() }, [funil])

  async function garantirPadroes() {
    const { data: et } = await supabase.from('crm_etapas').select('id').eq('funil', funil).limit(1)
    if (et && et.length === 0) {
      await supabase.from('crm_etapas').insert(ETAPAS_PADRAO[funil].map((e, i) => ({ ...e, funil, ordem: i })))
    }
    const { data: md } = await supabase.from('crm_modelos').select('id').eq('funil', funil).limit(1)
    if (md && md.length === 0) {
      const p = MODELOS_PADRAO[funil]
      await supabase.from('crm_modelos').insert([{ funil, tipo: 'proposta', ...p.proposta }, { funil, tipo: 'contrato', ...p.contrato }])
    }
  }

  async function carregar() {
    setLoading(true)
    await garantirPadroes()
    const [eRes, lRes, uRes, cRes, clRes, mRes] = await Promise.all([
      supabase.from('crm_etapas').select('*').eq('funil', funil).order('ordem'),
      supabase.from('crm_leads').select('*').eq('funil', funil).order('updated_at', { ascending: false }),
      supabase.from('users').select('id, name').order('name'),
      supabase.from('comissionadores').select('id, nome, percentual, ativo').order('nome'),
      supabase.from('clients').select('id, razao_social, cnpj').eq('status', 'ativo').order('razao_social'),
      supabase.from('crm_modelos').select('*').eq('funil', funil).order('nome'),
    ])
    if (lRes.error || eRes.error) alert('Erro ao carregar o funil: ' + (lRes.error || eRes.error).message + '\n\nVerifique se o SQL 04 foi executado no Supabase.')
    const ls = lRes.data || []
    setEtapas(eRes.data || [])
    setLeads(ls)
    setUsuarios(uRes.data || [])
    setComissionadores(cRes.data || [])
    setClientes(clRes.data || [])
    setModelos(mRes.data || [])
    if (ls.length) {
      const { data: d } = await supabase.from('crm_documentos').select('id, lead_id, tipo, titulo, created_at').in('lead_id', ls.map(l => l.id)).order('created_at', { ascending: false })
      setDocs(d || [])
    } else setDocs([])
    setLoading(false)
  }

  const etapaPorKey = useMemo(() => Object.fromEntries(etapas.map(e => [e.key, e])), [etapas])
  const etapasAtivas = etapas.filter(e => e.tipo !== 'perdido')
  const primeiraEtapa = etapasAtivas[0]?.key || 'novo_lead'

  // ─── Alertas de lead parado ───
  function diasParado(l) {
    const ref = [l.stage_changed_at, l.ultimo_contato_at].filter(Boolean).sort().pop()
    return diasDesde(ref)
  }
  function nivelAlerta(l) {
    const et = etapaPorKey[l.stage]
    if (!et || et.tipo !== 'normal' || !et.dias_alerta) return null
    const d = diasParado(l)
    if (d >= et.dias_alerta * 2) return 'critico'
    if (d >= et.dias_alerta) return 'atencao'
    return null
  }

  // ─── Requisitos ───
  function progressoEtapa(l) {
    const reqs = etapaPorKey[l.stage]?.requisitos || []
    return { ok: reqs.filter(r => requisitoOk(r, l, docs)).length, total: reqs.length }
  }
  function pendencias(l, alvo) {
    const alvoEt = etapaPorKey[alvo]
    if (!alvoEt || alvoEt.tipo === 'perdido') return []
    const idxAlvo = etapasAtivas.findIndex(e => e.key === alvo)
    let idxAtual = etapasAtivas.findIndex(e => e.key === l.stage)
    if (idxAtual < 0) idxAtual = 0
    if (idxAlvo <= idxAtual) return []
    const itens = []
    etapasAtivas.slice(idxAtual, idxAlvo).forEach(et => (et.requisitos || []).forEach(r => {
      if (!requisitoOk(r, l, docs)) itens.push({ ...r, etapa: et.label })
    }))
    return itens
  }

  const filtrados = useMemo(() => leads.filter(l => {
    const q = busca.toLowerCase()
    if (q && !`${l.nome} ${l.empresa || ''} ${l.telefone || ''} ${l.servico || ''}`.toLowerCase().includes(q)) return false
    if (filtroResp && l.responsavel_id !== filtroResp) return false
    if (filtroOrigem && l.origem !== filtroOrigem) return false
    if (somenteParados && !nivelAlerta(l)) return false
    return true
  }), [leads, busca, filtroResp, filtroOrigem, somenteParados, etapaPorKey])

  // ─── Indicadores ───
  const mesAtual = hojeISO().slice(0, 7)
  const ehFinal = (k) => ['ganho', 'perdido'].includes(etapaPorKey[k]?.tipo)
  const ativos = leads.filter(l => !ehFinal(l.stage))
  const valorFunil = ativos.reduce((s, l) => s + Number(l.valor_estimado || 0), 0)
  const ganhos = leads.filter(l => etapaPorKey[l.stage]?.tipo === 'ganho')
  const ganhosMes = ganhos.filter(l => (l.stage_changed_at || '').slice(0, 7) === mesAtual)
  const fechados = leads.filter(l => ehFinal(l.stage))
  const conversao = fechados.length ? Math.round(ganhos.length / fechados.length * 100) : 0
  const parados = ativos.filter(l => nivelAlerta(l)).length

  // ─── CRUD ───
  function abrirNovo(stage) {
    setModal({ form: { ...vazio(funil), stage: stage || primeiraEtapa, responsavel_id: profile?.id || '' } })
  }
  function abrirEdicao(l) {
    setModal({ id: l.id, form: { ...vazio(funil), ...l, valor_estimado: l.valor_estimado ?? '', responsavel_id: l.responsavel_id || '', comissionador_id: l.comissionador_id || '', dados: { ...vazio(funil).dados, ...(l.dados || {}) } } })
  }
  const setF = (campo, valor) => setModal(m => ({ ...m, form: { ...m.form, [campo]: valor } }))
  const setD = (campo, valor) => setModal(m => ({ ...m, form: { ...m.form, dados: { ...m.form.dados, [campo]: valor } } }))

  function payloadDoForm(f) {
    return {
      funil, nome: f.nome.trim(), empresa: f.empresa || null, telefone: f.telefone || null, email: f.email || null,
      origem: f.origem || null, servico: f.servico || null, comissionador_id: f.comissionador_id || null,
      valor_estimado: f.valor_estimado === '' ? null : Number(f.valor_estimado),
      observacoes: f.observacoes || null, responsavel_id: f.responsavel_id || null, dados: f.dados,
      updated_at: new Date().toISOString(),
    }
  }

  async function salvar(e) {
    e?.preventDefault(); setSaving(true)
    const f = modal.form
    const payload = payloadDoForm(f)
    let res
    if (modal.id) res = await supabase.from('crm_leads').update(payload).eq('id', modal.id).select().single()
    else res = await supabase.from('crm_leads').insert({ ...payload, stage: f.stage, stage_changed_at: new Date().toISOString() }).select().single()
    setSaving(false)
    if (res.error) { alert('Erro ao salvar: ' + res.error.message); return null }
    setLeads(ls => modal.id ? ls.map(l => l.id === modal.id ? res.data : l) : [res.data, ...ls])
    setModal(null)
    return res.data
  }

  async function excluir(id) {
    if (!confirm('Excluir este lead? Essa ação não pode ser desfeita.')) return
    await supabase.from('crm_leads').delete().eq('id', id)
    setModal(null)
    setLeads(ls => ls.filter(l => l.id !== id))
  }

  async function toggleRequisito(lead, reqId, valor) {
    const novo = { ...(lead.requisitos_ok || {}), [reqId]: valor }
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, requisitos_ok: novo } : l))
    setModal(m => m && m.id === lead.id ? { ...m, form: { ...m.form, requisitos_ok: novo } } : m)
    setPendModal(p => p && p.lead.id === lead.id ? { ...p, lead: { ...p.lead, requisitos_ok: novo } } : p)
    await supabase.from('crm_leads').update({ requisitos_ok: novo }).eq('id', lead.id)
  }

  // Toda mudança de etapa passa por aqui
  function tentarMover(lead, alvo) {
    if (lead.stage === alvo) return
    const et = etapaPorKey[alvo]
    const pend = pendencias(lead, alvo)
    if (pend.length) { setPendModal({ lead, alvo }); return }
    if (et?.tipo === 'perdido') { setPerdaModal({ lead, motivo: '' }); return }
    if (et?.tipo === 'ganho') { abrirFechamento(lead, alvo); return }
    gravarEtapa(lead, alvo)
  }

  async function gravarEtapa(lead, stage, extra = {}) {
    const agora = new Date().toISOString()
    const upd = { stage, stage_changed_at: agora, updated_at: agora, ...extra }
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, ...upd } : l))
    const { error } = await supabase.from('crm_leads').update(upd).eq('id', lead.id)
    if (error) { alert('Erro ao mover: ' + error.message); carregar() }
  }

  async function registrarContato(lead) {
    const agora = new Date().toISOString()
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, ultimo_contato_at: agora } : l))
    await supabase.from('crm_leads').update({ ultimo_contato_at: agora }).eq('id', lead.id)
  }

  // ─── Fechamento (ganho) ───
  function abrirFechamento(lead, alvo) {
    const mensal = funil === 'servicos' && (lead.dados?.tipo_valor || 'mensal') === 'mensal'
    const venc = new Date(); venc.setDate(Number(lead.dados?.dia_vencimento) || 10); if (venc < new Date()) venc.setMonth(venc.getMonth() + 1)
    setFech({
      lead, alvo, modo: lead.client_id ? 'existente' : 'novo', client_id: lead.client_id || '',
      razao_social: lead.empresa || lead.nome, cnpj: lead.dados?.documento || '',
      honorario_valor: mensal ? (lead.valor_estimado ?? '') : '', honorario_dia: lead.dados?.dia_vencimento || '10',
      lancar: true, recorrente: mensal, valor: lead.valor_estimado ?? '',
      vencimento: `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, '0')}-${String(venc.getDate()).padStart(2, '0')}`,
    })
  }

  async function confirmarFechamento(e) {
    e.preventDefault(); setSaving(true)
    const { lead } = fech
    let clientId = fech.client_id
    try {
      if (fech.modo === 'novo') {
        const { data, error } = await supabase.from('clients').insert({
          razao_social: fech.razao_social, cnpj: fech.cnpj, nome_fantasia: null,
          telefone: lead.telefone || null, email: lead.email || null, endereco: lead.dados?.endereco || null,
          status: 'ativo', data_entrada: hojeISO(), portal_credentials: [], setores_responsaveis: {},
          honorario_valor: fech.honorario_valor ? Number(fech.honorario_valor) : null, honorario_dia: Number(fech.honorario_dia) || 5,
          comissionador_id: lead.comissionador_id || null,
        }).select('id').single()
        if (error) throw error
        clientId = data.id
      } else {
        if (!clientId) throw new Error('Selecione o cliente.')
        if (lead.comissionador_id) {
          await supabase.from('clients').update({ comissionador_id: lead.comissionador_id }).eq('id', clientId).is('comissionador_id', null)
        }
      }
      if (fech.lancar && Number(fech.valor) > 0) {
        const nomeCli = fech.modo === 'novo' ? fech.razao_social : (clientes.find(c => c.id === clientId)?.razao_social || lead.empresa || lead.nome)
        const { error } = await supabase.from('financial_transactions').insert({
          type: 'receber', amount: Number(fech.valor), due_date: fech.vencimento, client_id: clientId, status: 'pendente',
          description: fech.recorrente ? `Honorários mensais — ${nomeCli}` : `${lead.servico || 'Serviço'} — ${nomeCli} (1ª parcela)`,
          is_recurring: !!fech.recorrente,
          category: funil === 'obras' ? 'Regularização de Obra' : 'Honorários',
        })
        if (error) throw error
      }
      await gravarEtapa(lead, fech.alvo, { client_id: clientId })
      setFech(null)
      const { data: cl } = await supabase.from('clients').select('id, razao_social, cnpj').eq('status', 'ativo').order('razao_social')
      setClientes(cl || [])
    } catch (err) {
      alert('Não foi possível concluir: ' + err.message)
    }
    setSaving(false)
  }

  // ─── Documentos ───
  function gerarDocumento(lead, tipo) {
    const lista = modelos.filter(m => m.tipo === tipo)
    if (!lista.length) { alert('Nenhum modelo de ' + tipo + ' cadastrado. Crie em "Modelos".'); return }
    if (lista.length > 1) { setEscolhaModelo({ lead, tipo, lista }); return }
    criarDocumento(lead, lista[0])
  }
  async function criarDocumento(lead, modelo) {
    const conteudo = preencherModelo(modelo.conteudo, dadosDoLead(lead, profile?.name))
    const { data, error } = await supabase.from('crm_documentos').insert({
      lead_id: lead.id, tipo: modelo.tipo, titulo: `${modelo.nome} — ${lead.empresa || lead.nome}`, conteudo, criado_por: profile?.name || null,
    }).select('id').single()
    if (error) { alert('Erro ao gerar: ' + error.message); return }
    navigate(`/comercial/documento/${data.id}`)
  }

  function mensagemWhats(l) {
    const primeiroNome = (l.nome || '').split(' ')[0]
    const eu = profile?.name?.split(' ')[0] || 'a equipe'
    if (funil === 'obras') return `Olá, ${primeiroNome}! Aqui é ${eu} da Aggio Contábil. Estou entrando em contato sobre a regularização da sua obra${l.dados?.municipio ? ` em ${l.dados.municipio}` : ''}. Podemos conversar?`
    return `Olá, ${primeiroNome}! Aqui é ${eu} da Aggio Contábil. Estou entrando em contato sobre ${l.servico ? l.servico.toLowerCase() : 'o serviço que você solicitou'}. Podemos conversar?`
  }
  const nomeUsuario = (id) => usuarios.find(u => u.id === id)?.name?.split(' ')[0]
  const nomeComissionador = (id) => comissionadores.find(c => c.id === id)?.nome

  // ─── Requisitos (lista reutilizada no modal do lead e no de pendências) ───
  function listaRequisitos(lead, itens, comEtapa = false) {
    return itens.map(r => {
      const ok = requisitoOk(r, lead, docs)
      return (
        <div key={(r.etapa || '') + r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: ok ? '#f0fdf4' : '#fff7ed', marginBottom: 6, fontSize: 13 }}>
          {r.tipo === 'check' ? (
            <input type="checkbox" checked={ok} onChange={e => toggleRequisito(lead, r.id, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#10b981', cursor: 'pointer' }} />
          ) : <span style={{ width: 16, textAlign: 'center' }}>{ok ? '✅' : '⬜'}</span>}
          <span style={{ flex: 1, color: '#1e293b' }}>
            {r.texto}{comEtapa && <span style={{ color: '#94a3b8', fontSize: 11 }}> · {r.etapa}</span>}
            {!ok && r.tipo === 'campo' && <span style={{ color: '#c2410c', fontSize: 11 }}> — preencha "{CAMPOS_REQUISITO[r.campo] || r.campo}" no lead</span>}
          </span>
          {!ok && r.tipo === 'proposta' && <Btn size="sm" variant="secondary" onClick={() => gerarDocumento(lead, 'proposta')}>Gerar</Btn>}
          {!ok && r.tipo === 'contrato' && <Btn size="sm" variant="secondary" onClick={() => gerarDocumento(lead, 'contrato')}>Gerar</Btn>}
        </div>
      )
    })
  }

  const leadDoModal = modal?.id ? leads.find(l => l.id === modal.id) : null
  const docsDoLead = leadDoModal ? docs.filter(d => d.lead_id === leadDoModal.id) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <PageHeader
        title={titulo}
        subtitle={subtitulo}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={() => setModelosAbertos(true)}><FileText size={14} /> Modelos</Btn>
            <Btn variant="secondary" onClick={() => setConfigAberta(true)}><Settings size={14} /> Configurar funil</Btn>
            <Btn onClick={() => abrirNovo()}><Plus size={14} /> Novo lead</Btn>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard label="Leads ativos" value={ativos.length} icon="🎯" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Valor no funil" value={fmtBRL(valorFunil)} icon="💼" bg="#f5f3ff" border="#ddd6fe" />
        <StatCard label="Fechados no mês" value={ganhosMes.length} icon="✅" bg="#f0fdf4" border="#bbf7d0" />
        <StatCard label="Conversão" value={`${conversao}%`} icon="📈" bg="#fffbeb" border="#fde68a" />
        <StatCard label="Parados" value={parados} icon="⏰" bg={parados ? '#fef2f2' : '#f8fafc'} border={parados ? '#fecaca' : '#e2e8f0'} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar nome, empresa, telefone..." style={{ ...inputBase, flex: 1, minWidth: 220 }} />
        <select value={filtroResp} onChange={e => setFiltroResp(e.target.value)} style={inputBase}>
          <option value="">Todos os responsáveis</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)} style={inputBase}>
          <option value="">Todas as origens</option>
          {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
          <input type="checkbox" checked={somenteParados} onChange={e => setSomenteParados(e.target.checked)} style={{ accentColor: '#ef4444' }} /> Só parados
        </label>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, flex: 1, alignItems: 'flex-start' }}>
          {etapas.map(et => {
            const doEstagio = filtrados.filter(l => l.stage === et.key || (et.key === primeiraEtapa && !etapaPorKey[l.stage]))
            const soma = doEstagio.reduce((s, l) => s + Number(l.valor_estimado || 0), 0)
            const over = dragOver === et.key
            const final = et.tipo !== 'normal'
            return (
              <div key={et.key}
                onDragOver={e => { e.preventDefault(); setDragOver(et.key) }}
                onDragLeave={() => setDragOver(d => d === et.key ? null : d)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(null)
                  const lead = leads.find(l => l.id === dragId)
                  if (lead) tentarMover(lead, et.key)
                  setDragId(null)
                }}
                style={{ minWidth: 255, width: 255, flexShrink: 0, background: over ? '#eef2ff' : '#eef1f5', borderRadius: 14, padding: 10, border: over ? '2px dashed #6366f1' : '2px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 6px' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: et.cor }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', flex: 1 }}>{et.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: 'white', borderRadius: 10, padding: '1px 8px' }}>{doEstagio.length}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', padding: '0 6px 8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{soma > 0 ? fmtBRL(soma) : ''}</span>
                  {(et.requisitos || []).length > 0 && <span title={(et.requisitos || []).map(r => '• ' + r.texto).join('\n')}>📋 {et.requisitos.length} requisito(s)</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
                  {doEstagio.map(l => {
                    const alerta = nivelAlerta(l)
                    const prog = progressoEtapa(l)
                    const wa = waLink(l.telefone, mensagemWhats(l))
                    return (
                      <div key={l.id} draggable
                        onDragStart={() => setDragId(l.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null) }}
                        onClick={() => abrirEdicao(l)}
                        style={{
                          background: 'white', borderRadius: 10, padding: '10px 12px', cursor: 'grab',
                          border: `1px solid ${alerta === 'critico' ? '#fca5a5' : alerta === 'atencao' ? '#fcd34d' : '#e2e8f0'}`,
                          borderLeft: `4px solid ${alerta === 'critico' ? '#ef4444' : alerta === 'atencao' ? '#f59e0b' : et.cor}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', opacity: dragId === l.id ? 0.5 : 1,
                        }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{l.nome}</div>
                        {l.empresa && <div style={{ fontSize: 11.5, color: '#64748b' }}>{l.empresa}</div>}
                        {l.servico && <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginTop: 3 }}>{l.servico}</div>}
                        {funil === 'obras' && (l.dados?.area_m2 || l.dados?.municipio) && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{[l.dados.area_m2 && `${l.dados.area_m2} m²`, l.dados.municipio].filter(Boolean).join(' · ')}</div>
                        )}
                        {l.comissionador_id && <div style={{ fontSize: 11, color: '#b45309', marginTop: 3 }}>🤝 {nomeComissionador(l.comissionador_id)}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{l.valor_estimado ? fmtBRL(l.valor_estimado) : ''}</span>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {!final && prog.total > 0 && (
                              <span title="Requisitos da etapa" style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: prog.ok === prog.total ? '#dcfce7' : '#f1f5f9', color: prog.ok === prog.total ? '#166534' : '#64748b' }}>
                                ✓ {prog.ok}/{prog.total}
                              </span>
                            )}
                            {!final && (
                              <span title="Dias sem movimentação" style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                                background: alerta === 'critico' ? '#fee2e2' : alerta === 'atencao' ? '#fef3c7' : '#f1f5f9',
                                color: alerta === 'critico' ? '#b91c1c' : alerta === 'atencao' ? '#92400e' : '#64748b' }}>{diasParado(l)}d</span>
                            )}
                            {!final && (
                              <button title="Registrar contato (zera o alerta)" onClick={e => { e.stopPropagation(); registrarContato(l) }}
                                style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: 6, padding: '3px 5px', cursor: 'pointer', color: '#64748b', display: 'flex' }}><Phone size={12} /></button>
                            )}
                            {wa && (
                              <a href={wa} target="_blank" rel="noreferrer" title="Abrir WhatsApp" onClick={e => e.stopPropagation()}
                                style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 6, padding: '3px 5px', color: '#16a34a', display: 'flex' }}><MessageCircle size={12} /></a>
                            )}
                          </div>
                        </div>
                        {l.responsavel_id && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>👤 {nomeUsuario(l.responsavel_id)}</div>}
                        {et.tipo === 'perdido' && l.motivo_perda && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 5 }}>Motivo: {l.motivo_perda}</div>}
                      </div>
                    )
                  })}
                  {!final && (
                    <button onClick={() => abrirNovo(et.key)} style={{ border: '1.5px dashed #cbd5e1', background: 'transparent', borderRadius: 10, padding: 8, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>+ Adicionar</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Modal do lead ─── */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Lead' : 'Novo lead'} size="xl">
        {modal && (
          <form onSubmit={salvar}>
            {leadDoModal && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Etapa:</span>
                  <b style={{ color: etapaPorKey[leadDoModal.stage]?.cor }}>{etapaPorKey[leadDoModal.stage]?.label || leadDoModal.stage}</b>
                  <div style={{ flex: 1 }} />
                  <select value="" onChange={e => { if (e.target.value) { const alvo = e.target.value; setModal(null); tentarMover(leadDoModal, alvo) } }} style={{ ...inputBase, padding: '6px 10px' }}>
                    <option value="">Mover para...</option>
                    {etapas.filter(x => x.key !== leadDoModal.stage).map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                  </select>
                </div>
                {(etapaPorKey[leadDoModal.stage]?.requisitos || []).length > 0 ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 6px' }}>Requisitos para avançar</div>
                    {listaRequisitos(leadDoModal, etapaPorKey[leadDoModal.stage].requisitos)}
                  </>
                ) : <div style={{ fontSize: 12, color: '#94a3b8' }}>Esta etapa não tem requisitos.</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                  <Btn size="sm" variant="secondary" onClick={() => gerarDocumento(leadDoModal, 'proposta')}>📄 Gerar proposta</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => gerarDocumento(leadDoModal, 'contrato')}>📝 Gerar contrato</Btn>
                  {docsDoLead.map(d => (
                    <button type="button" key={d.id} onClick={() => navigate(`/comercial/documento/${d.id}`)}
                      style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: 8, padding: '4px 9px', fontSize: 11.5, cursor: 'pointer', color: '#2563eb' }}>
                      {d.tipo === 'proposta' ? '📄' : '📝'} {new Date(d.created_at).toLocaleDateString('pt-BR')}
                    </button>
                  ))}
                </div>
                {leadDoModal.client_id && <div style={{ fontSize: 12, color: '#059669', marginTop: 8 }}>✅ Virou cliente — <a href={`/clientes/${leadDoModal.client_id}`} onClick={e => { e.preventDefault(); navigate(`/clientes/${leadDoModal.client_id}`) }}>abrir cadastro</a></div>}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Input label="Nome do contato *" value={modal.form.nome} onChange={e => setF('nome', e.target.value)} required />
              <Input label={funil === 'obras' ? 'Proprietário / Construtora' : 'Empresa'} value={modal.form.empresa || ''} onChange={e => setF('empresa', e.target.value)} />
              <Input label="CPF / CNPJ" value={modal.form.dados.documento || ''} onChange={e => setD('documento', e.target.value)} />
              <Input label="WhatsApp / Telefone" value={modal.form.telefone || ''} onChange={e => setF('telefone', e.target.value)} placeholder="(82) 99999-9999" />
              <Input label="E-mail" type="email" value={modal.form.email || ''} onChange={e => setF('email', e.target.value)} />
              <Input label="Endereço" value={modal.form.dados.endereco || ''} onChange={e => setD('endereco', e.target.value)} />
              <Select label="Serviço" value={modal.form.servico || ''} onChange={e => setF('servico', e.target.value)}>
                <option value="">Selecione</option>
                {SERVICOS[funil].map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select label="Origem" value={modal.form.origem || ''} onChange={e => setF('origem', e.target.value)}>
                <option value="">Selecione</option>
                {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
              </Select>
              <Select label="Comissionador (quem indicou)" value={modal.form.comissionador_id || ''} onChange={e => setF('comissionador_id', e.target.value)}>
                <option value="">Sem comissão</option>
                {comissionadores.filter(c => c.ativo || c.id === modal.form.comissionador_id).map(c => <option key={c.id} value={c.id}>{c.nome} ({Number(c.percentual)}%)</option>)}
              </Select>
            </div>

            {funil === 'obras' ? (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px 2px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>🏗️ Dados da obra</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <Select label="Tipo de pessoa" value={modal.form.dados.tipo_pessoa} onChange={e => setD('tipo_pessoa', e.target.value)}>
                    <option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option>
                  </Select>
                  <Select label="Tipo de obra" value={modal.form.dados.tipo_obra} onChange={e => setD('tipo_obra', e.target.value)}>
                    <option value="">Selecione</option>
                    {TIPOS_OBRA.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <Input label="Área (m²)" type="number" step="0.01" value={modal.form.dados.area_m2} onChange={e => setD('area_m2', e.target.value)} />
                  <Input label="Município / UF" value={modal.form.dados.municipio} onChange={e => setD('municipio', e.target.value)} />
                  <Input label="CNO (se já tiver)" value={modal.form.dados.cno} onChange={e => setD('cno', e.target.value)} />
                  <Input label="Prazo de execução" value={modal.form.dados.prazo_execucao} onChange={e => setD('prazo_execucao', e.target.value)} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Select label="Tipo de valor" value={modal.form.dados.tipo_valor} onChange={e => setD('tipo_valor', e.target.value)}>
                  <option value="mensal">Honorário mensal</option><option value="unico">Serviço único</option>
                </Select>
                <Select label="Regime (se souber)" value={modal.form.dados.regime} onChange={e => setD('regime', e.target.value)}>
                  <option value="">—</option><option value="MEI">MEI</option><option value="Simples Nacional">Simples Nacional</option>
                  <option value="Lucro Presumido">Lucro Presumido</option><option value="Lucro Real">Lucro Real</option>
                </Select>
                <Input label="Dia de vencimento" type="number" min="1" max="31" value={modal.form.dados.dia_vencimento} onChange={e => setD('dia_vencimento', e.target.value)} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Input label={funil === 'servicos' && modal.form.dados.tipo_valor === 'mensal' ? 'Valor mensal (R$)' : 'Valor (R$)'} type="number" step="0.01" min="0" value={modal.form.valor_estimado} onChange={e => setF('valor_estimado', e.target.value)} />
              {!modal.id ? (
                <Select label="Etapa inicial" value={modal.form.stage} onChange={e => setF('stage', e.target.value)}>
                  {etapas.filter(x => x.tipo === 'normal').map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                </Select>
              ) : <div />}
              <Select label="Responsável" value={modal.form.responsavel_id} onChange={e => setF('responsavel_id', e.target.value)}>
                <option value="">—</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </div>
            <Textarea label="Observações" value={modal.form.observacoes || ''} onChange={e => setF('observacoes', e.target.value)} rows={3} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div>{modal.id && <Btn variant="danger" size="sm" onClick={() => excluir(modal.id)}><Trash2 size={13} /> Excluir</Btn>}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
                <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Btn>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Pendências para avançar ─── */}
      <Modal open={!!pendModal} onClose={() => setPendModal(null)} title="Faltam requisitos para avançar">
        {pendModal && (() => {
          const lead = leads.find(l => l.id === pendModal.lead.id) || pendModal.lead
          const itens = pendencias(lead, pendModal.alvo)
          return (
            <div>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                Para levar <b>{lead.nome}</b> até <b>{etapaPorKey[pendModal.alvo]?.label}</b>, conclua:
              </div>
              {itens.length ? listaRequisitos(lead, itens, true) : <div style={{ color: '#059669', fontWeight: 600, fontSize: 13 }}>✅ Tudo cumprido!</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <Btn variant="secondary" onClick={() => { setPendModal(null); abrirEdicao(lead) }}>Abrir lead</Btn>
                <Btn disabled={itens.length > 0} onClick={() => { setPendModal(null); tentarMover(lead, pendModal.alvo) }}>Avançar</Btn>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ─── Fechamento ─── */}
      <Modal open={!!fech} onClose={() => setFech(null)} title="🎉 Fechamento — virar cliente" size="lg">
        {fech && (
          <form onSubmit={confirmarFechamento}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[['novo', 'Cadastrar cliente novo'], ['existente', 'Já é cliente']].map(([v, l]) => (
                <button type="button" key={v} onClick={() => setFech(f => ({ ...f, modo: v }))} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: fech.modo === v ? '1px solid #2563eb' : '1px solid #e2e8f0', background: fech.modo === v ? '#2563eb' : 'white', color: fech.modo === v ? 'white' : '#475569',
                }}>{l}</button>
              ))}
            </div>
            {fech.modo === 'novo' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Input label="Razão social / Nome *" value={fech.razao_social} onChange={e => setFech(f => ({ ...f, razao_social: e.target.value }))} required />
                <Input label="CNPJ / CPF *" value={fech.cnpj} onChange={e => setFech(f => ({ ...f, cnpj: e.target.value }))} required />
                {funil === 'servicos' && <Input label="Honorário mensal (R$)" type="number" step="0.01" value={fech.honorario_valor} onChange={e => setFech(f => ({ ...f, honorario_valor: e.target.value }))} />}
                {funil === 'servicos' && <Input label="Dia de vencimento" type="number" min="1" max="31" value={fech.honorario_dia} onChange={e => setFech(f => ({ ...f, honorario_dia: e.target.value }))} />}
              </div>
            ) : (
              <Select label="Cliente *" value={fech.client_id} onChange={e => setFech(f => ({ ...f, client_id: e.target.value }))} required>
                <option value="">Selecione</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
              </Select>
            )}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={fech.lancar} onChange={e => setFech(f => ({ ...f, lancar: e.target.checked }))} style={{ width: 16, height: 16 }} />
                Lançar a 1ª parcela no A Receber
              </label>
              {fech.lancar && funil === 'servicos' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#475569', cursor: 'pointer', marginTop: 6, marginLeft: 24 }}>
                  <input type="checkbox" checked={fech.recorrente} onChange={e => setFech(f => ({ ...f, recorrente: e.target.checked }))} />
                  Honorário mensal: repetir automaticamente todo mês
                </label>
              )}
              {fech.lancar && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                  <Input label="Valor (R$)" type="number" step="0.01" value={fech.valor} onChange={e => setFech(f => ({ ...f, valor: e.target.value }))} />
                  <Input label="Vencimento" type="date" value={fech.vencimento} onChange={e => setFech(f => ({ ...f, vencimento: e.target.value }))} />
                </div>
              )}
            </div>
            {fech.lead.comissionador_id ? (
              <div style={{ fontSize: 12.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '9px 12px' }}>
                🤝 Indicação de <b>{nomeComissionador(fech.lead.comissionador_id)}</b>. Quando a 1ª parcela for baixada no Financeiro, a comissão de{' '}
                <b>{Number(comissionadores.find(c => c.id === fech.lead.comissionador_id)?.percentual || 50)}%</b> entra sozinha no A Pagar.
              </div>
            ) : <div style={{ fontSize: 12, color: '#94a3b8' }}>Lead sem comissionador — não gera comissão.</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <Btn variant="secondary" onClick={() => setFech(null)}>Cancelar</Btn>
              <Btn type="submit" variant="success" disabled={saving}>{saving ? 'Salvando...' : '✓ Confirmar fechamento'}</Btn>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Motivo de perda ─── */}
      <Modal open={!!perdaModal} onClose={() => setPerdaModal(null)} title="Por que o lead foi perdido?" size="sm">
        {perdaModal && (
          <form onSubmit={e => {
            e.preventDefault()
            const alvo = etapas.find(x => x.tipo === 'perdido')?.key || 'perdido'
            gravarEtapa(perdaModal.lead, alvo, { motivo_perda: perdaModal.motivo || 'Não informado' }); setPerdaModal(null)
          }}>
            <Select label="Motivo" value={perdaModal.motivo} onChange={e => setPerdaModal(p => ({ ...p, motivo: e.target.value }))}>
              <option value="">Selecione</option>
              {['Preço', 'Fechou com concorrente', 'Sem resposta', 'Desistiu do serviço', 'Não era o perfil', 'Adiou para depois', 'Outro'].map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setPerdaModal(null)}>Cancelar</Btn>
              <Btn type="submit" variant="danger">Marcar como perdido</Btn>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Escolha de modelo ─── */}
      <Modal open={!!escolhaModelo} onClose={() => setEscolhaModelo(null)} title="Qual modelo usar?" size="sm">
        {escolhaModelo && escolhaModelo.lista.map(m => (
          <button key={m.id} onClick={() => { setEscolhaModelo(null); criarDocumento(escolhaModelo.lead, m) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, border: '1px solid #e2e8f0', borderRadius: 10, background: 'white', cursor: 'pointer', fontSize: 13 }}>
            {m.nome}
          </button>
        ))}
      </Modal>

      <ConfigFunil open={configAberta} funil={funil} etapas={etapas} leads={leads}
        onClose={() => setConfigAberta(false)} onSaved={() => { setConfigAberta(false); carregar() }} />
      <ModelosDocs open={modelosAbertos} funil={funil} modelos={modelos}
        onClose={() => setModelosAbertos(false)} onSaved={async () => {
          const { data } = await supabase.from('crm_modelos').select('*').eq('funil', funil).order('nome'); setModelos(data || [])
        }} />
    </div>
  )
}
