import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Btn, Modal, Input, Select, Textarea, StatCard } from '../../components/ui'
import { Plus, MessageCircle, Phone, Trash2 } from 'lucide-react'
import { fmtBRL, diasDesde, waLink, inputBase } from '../../lib/util'

// ─── Configuração dos dois funis ─────────────────────────────────────
// dias = quantos dias o lead pode ficar parado na etapa antes de alertar
const FUNIS = {
  servicos: {
    titulo: 'Funil Comercial · Serviços',
    subtitulo: 'Abertura de empresa, contabilidade mensal, alterações e serviços avulsos',
    etapas: [
      { key: 'novo_lead', label: 'Novo lead', cor: '#64748b', dias: 2 },
      { key: 'contato', label: 'Contato feito', cor: '#3b82f6', dias: 3 },
      { key: 'reuniao', label: 'Reunião / Diagnóstico', cor: '#8b5cf6', dias: 5 },
      { key: 'proposta', label: 'Proposta enviada', cor: '#f59e0b', dias: 4 },
      { key: 'negociacao', label: 'Negociação', cor: '#f97316', dias: 7 },
      { key: 'ganho', label: 'Fechado ✓', cor: '#10b981', final: true },
      { key: 'perdido', label: 'Perdido', cor: '#ef4444', final: true },
    ],
    servicos: ['Abertura de empresa', 'Contabilidade mensal', 'Alteração contratual', 'Baixa de empresa', 'Transferência de contabilidade', 'IRPF', 'Planejamento tributário', 'Regularização fiscal', 'Outro'],
  },
  obras: {
    titulo: 'Funil Comercial · Regularização de Obras (INSS)',
    subtitulo: 'CNO, aferição no SERO e CND de obra',
    etapas: [
      { key: 'novo_lead', label: 'Novo lead', cor: '#64748b', dias: 2 },
      { key: 'contato', label: 'Contato feito', cor: '#3b82f6', dias: 3 },
      { key: 'analise', label: 'Análise da obra', cor: '#8b5cf6', dias: 5 },
      { key: 'proposta', label: 'Orçamento enviado', cor: '#f59e0b', dias: 4 },
      { key: 'negociacao', label: 'Negociação', cor: '#f97316', dias: 7 },
      { key: 'ganho', label: 'Fechado ✓', cor: '#10b981', final: true },
      { key: 'perdido', label: 'Perdido', cor: '#ef4444', final: true },
    ],
    servicos: ['CND de obra (completa)', 'Inscrição de CNO', 'Aferição / SERO', 'Obra isenta (casa popular)', 'Retificação / Parcelamento', 'Outro'],
  },
}

const ORIGENS = ['Instagram', 'WhatsApp', 'Indicação', 'Site', 'Google', 'Parceiro (engenheiro/arquiteto)', 'Cliente da casa', 'Outro']
const TIPOS_OBRA = ['Residencial unifamiliar', 'Residencial multifamiliar', 'Comercial', 'Galpão / Industrial', 'Reforma / Ampliação', 'Outro']

const vazio = (funil) => ({
  nome: '', empresa: '', telefone: '', email: '', origem: '', servico: '',
  valor_estimado: '', observacoes: '', responsavel_id: '', stage: 'novo_lead',
  dados: funil === 'obras'
    ? { tipo_pessoa: 'PF', tipo_obra: '', area_m2: '', municipio: '', cno: '', situacao_obra: '' }
    : { tipo_valor: 'mensal', regime: '' },
})

export default function Funil({ funil }) {
  const cfg = FUNIS[funil]
  const { profile } = useAuth()
  const [leads, setLeads] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [somenteParados, setSomenteParados] = useState(false)
  const [modal, setModal] = useState(null) // { id?, form }
  const [saving, setSaving] = useState(false)
  const [perdaModal, setPerdaModal] = useState(null) // { lead, motivo }
  const [dragId, setDragId] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  useEffect(() => { carregar() }, [funil])

  async function carregar() {
    setLoading(true)
    const [lRes, uRes] = await Promise.all([
      supabase.from('crm_leads').select('*').eq('funil', funil).order('updated_at', { ascending: false }),
      supabase.from('users').select('id, name').order('name'),
    ])
    if (lRes.error) alert('Erro ao carregar o funil: ' + lRes.error.message + '\n\nVerifique se o SQL de melhorias foi executado no Supabase.')
    setLeads(lRes.data || [])
    setUsuarios(uRes.data || [])
    setLoading(false)
  }

  const etapaPorKey = Object.fromEntries(cfg.etapas.map(e => [e.key, e]))

  function diasParado(l) {
    const ref = [l.stage_changed_at, l.ultimo_contato_at].filter(Boolean).sort().pop()
    return diasDesde(ref)
  }
  function nivelAlerta(l) {
    const et = etapaPorKey[l.stage]
    if (!et || et.final || !et.dias) return null
    const d = diasParado(l)
    if (d >= et.dias * 2) return 'critico'
    if (d >= et.dias) return 'atencao'
    return null
  }

  const filtrados = useMemo(() => leads.filter(l => {
    const q = busca.toLowerCase()
    if (q && !`${l.nome} ${l.empresa || ''} ${l.telefone || ''} ${l.servico || ''}`.toLowerCase().includes(q)) return false
    if (filtroResp && l.responsavel_id !== filtroResp) return false
    if (filtroOrigem && l.origem !== filtroOrigem) return false
    if (somenteParados && !nivelAlerta(l)) return false
    return true
  }), [leads, busca, filtroResp, filtroOrigem, somenteParados])

  // ─── Indicadores ───
  const mesAtual = new Date().toISOString().slice(0, 7)
  const ativos = leads.filter(l => !etapaPorKey[l.stage]?.final)
  const valorFunil = ativos.reduce((s, l) => s + Number(l.valor_estimado || 0), 0)
  const ganhosMes = leads.filter(l => l.stage === 'ganho' && (l.stage_changed_at || '').slice(0, 7) === mesAtual)
  const fechados = leads.filter(l => l.stage === 'ganho' || l.stage === 'perdido')
  const conversao = fechados.length ? Math.round(leads.filter(l => l.stage === 'ganho').length / fechados.length * 100) : 0
  const parados = ativos.filter(l => nivelAlerta(l)).length

  // ─── CRUD ───
  function abrirNovo(stage = 'novo_lead') {
    setModal({ form: { ...vazio(funil), stage, responsavel_id: profile?.id || '' } })
  }
  function abrirEdicao(l) {
    setModal({ id: l.id, form: { ...vazio(funil), ...l, valor_estimado: l.valor_estimado ?? '', responsavel_id: l.responsavel_id || '', dados: { ...vazio(funil).dados, ...(l.dados || {}) } } })
  }
  const setF = (campo, valor) => setModal(m => ({ ...m, form: { ...m.form, [campo]: valor } }))
  const setD = (campo, valor) => setModal(m => ({ ...m, form: { ...m.form, dados: { ...m.form.dados, [campo]: valor } } }))

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const f = modal.form
    const original = modal.id ? leads.find(l => l.id === modal.id) : null
    const payload = {
      funil,
      nome: f.nome.trim(),
      empresa: f.empresa || null,
      telefone: f.telefone || null,
      email: f.email || null,
      origem: f.origem || null,
      servico: f.servico || null,
      valor_estimado: f.valor_estimado === '' ? null : Number(f.valor_estimado),
      observacoes: f.observacoes || null,
      responsavel_id: f.responsavel_id || null,
      stage: f.stage,
      dados: f.dados,
      motivo_perda: f.stage === 'perdido' ? (f.motivo_perda || null) : null,
      updated_at: new Date().toISOString(),
    }
    if (!original || original.stage !== f.stage) payload.stage_changed_at = new Date().toISOString()
    const { error } = modal.id
      ? await supabase.from('crm_leads').update(payload).eq('id', modal.id)
      : await supabase.from('crm_leads').insert(payload)
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setModal(null)
    carregar()
  }

  async function excluir(id) {
    if (!confirm('Excluir este lead? Essa ação não pode ser desfeita.')) return
    await supabase.from('crm_leads').delete().eq('id', id)
    setModal(null)
    setLeads(ls => ls.filter(l => l.id !== id))
  }

  async function moverPara(lead, stage, extra = {}) {
    if (lead.stage === stage) return
    if (stage === 'perdido' && !extra.motivo_perda) { setPerdaModal({ lead, motivo: '' }); return }
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

  function mensagemWhats(l) {
    const primeiroNome = (l.nome || '').split(' ')[0]
    if (funil === 'obras') return `Olá, ${primeiroNome}! Aqui é ${profile?.name?.split(' ')[0] || 'da'} da Aggio Contábil. Estou entrando em contato sobre a regularização da sua obra${l.dados?.municipio ? ` em ${l.dados.municipio}` : ''}. Podemos conversar?`
    return `Olá, ${primeiroNome}! Aqui é ${profile?.name?.split(' ')[0] || 'da'} da Aggio Contábil. Estou entrando em contato sobre ${l.servico ? l.servico.toLowerCase() : 'o serviço que você solicitou'}. Podemos conversar?`
  }

  const nomeUsuario = (id) => usuarios.find(u => u.id === id)?.name?.split(' ')[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <PageHeader
        title={cfg.titulo}
        subtitle={cfg.subtitulo}
        actions={<Btn onClick={() => abrirNovo()}><Plus size={14} /> Novo lead</Btn>}
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
          <input type="checkbox" checked={somenteParados} onChange={e => setSomenteParados(e.target.checked)} style={{ accentColor: '#ef4444' }} />
          Só parados
        </label>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, flex: 1, alignItems: 'flex-start' }}>
          {cfg.etapas.map(et => {
            const doEstagio = filtrados.filter(l => l.stage === et.key)
            const soma = doEstagio.reduce((s, l) => s + Number(l.valor_estimado || 0), 0)
            const over = dragOver === et.key
            return (
              <div key={et.key}
                onDragOver={e => { e.preventDefault(); setDragOver(et.key) }}
                onDragLeave={() => setDragOver(d => d === et.key ? null : d)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(null)
                  const lead = leads.find(l => l.id === dragId)
                  if (lead) moverPara(lead, et.key)
                  setDragId(null)
                }}
                style={{
                  minWidth: 250, width: 250, flexShrink: 0, background: over ? '#eef2ff' : '#eef1f5',
                  borderRadius: 14, padding: 10, border: over ? '2px dashed #6366f1' : '2px solid transparent',
                  transition: 'background 0.15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 10px' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: et.cor }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', flex: 1 }}>{et.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: 'white', borderRadius: 10, padding: '1px 8px' }}>{doEstagio.length}</span>
                </div>
                {soma > 0 && <div style={{ fontSize: 11, color: '#64748b', padding: '0 6px 8px', fontWeight: 600 }}>{fmtBRL(soma)}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
                  {doEstagio.map(l => {
                    const alerta = nivelAlerta(l)
                    const dias = diasParado(l)
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
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {[l.dados.area_m2 && `${l.dados.area_m2} m²`, l.dados.municipio].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{l.valor_estimado ? fmtBRL(l.valor_estimado) : ''}</span>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {!et.final && (
                              <span title="Dias sem movimentação" style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                                background: alerta === 'critico' ? '#fee2e2' : alerta === 'atencao' ? '#fef3c7' : '#f1f5f9',
                                color: alerta === 'critico' ? '#b91c1c' : alerta === 'atencao' ? '#92400e' : '#64748b' }}>
                                {dias}d
                              </span>
                            )}
                            {!et.final && (
                              <button title="Registrar contato (zera o alerta)" onClick={e => { e.stopPropagation(); registrarContato(l) }}
                                style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: 6, padding: '3px 5px', cursor: 'pointer', color: '#64748b', display: 'flex' }}>
                                <Phone size={12} />
                              </button>
                            )}
                            {wa && (
                              <a href={wa} target="_blank" rel="noreferrer" title="Abrir WhatsApp" onClick={e => e.stopPropagation()}
                                style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 6, padding: '3px 5px', color: '#16a34a', display: 'flex' }}>
                                <MessageCircle size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                        {l.responsavel_id && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>👤 {nomeUsuario(l.responsavel_id)}</div>}
                        {l.stage === 'perdido' && l.motivo_perda && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 5 }}>Motivo: {l.motivo_perda}</div>}
                      </div>
                    )
                  })}
                  {!et.final && (
                    <button onClick={() => abrirNovo(et.key)}
                      style={{ border: '1.5px dashed #cbd5e1', background: 'transparent', borderRadius: 10, padding: 8, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
                      + Adicionar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal lead */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Editar lead' : 'Novo lead'} size="lg">
        {modal && (
          <form onSubmit={salvar}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Nome do contato *" value={modal.form.nome} onChange={e => setF('nome', e.target.value)} required />
              <Input label={funil === 'obras' ? 'Proprietário / Construtora' : 'Empresa'} value={modal.form.empresa || ''} onChange={e => setF('empresa', e.target.value)} />
              <Input label="WhatsApp / Telefone" value={modal.form.telefone || ''} onChange={e => setF('telefone', e.target.value)} placeholder="(82) 99999-9999" />
              <Input label="E-mail" type="email" value={modal.form.email || ''} onChange={e => setF('email', e.target.value)} />
              <Select label="Serviço" value={modal.form.servico || ''} onChange={e => setF('servico', e.target.value)}>
                <option value="">Selecione</option>
                {cfg.servicos.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select label="Origem" value={modal.form.origem || ''} onChange={e => setF('origem', e.target.value)}>
                <option value="">Selecione</option>
                {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
              </Select>
            </div>

            {funil === 'obras' ? (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px 2px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>🏗️ Dados da obra</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <Select label="Tipo de pessoa" value={modal.form.dados.tipo_pessoa} onChange={e => setD('tipo_pessoa', e.target.value)}>
                    <option value="PF">Pessoa Física</option>
                    <option value="PJ">Pessoa Jurídica</option>
                  </Select>
                  <Select label="Tipo de obra" value={modal.form.dados.tipo_obra} onChange={e => setD('tipo_obra', e.target.value)}>
                    <option value="">Selecione</option>
                    {TIPOS_OBRA.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <Input label="Área (m²)" type="number" step="0.01" value={modal.form.dados.area_m2} onChange={e => setD('area_m2', e.target.value)} />
                  <Input label="Município / UF" value={modal.form.dados.municipio} onChange={e => setD('municipio', e.target.value)} placeholder="Arapiraca/AL" />
                  <Input label="CNO (se já tiver)" value={modal.form.dados.cno} onChange={e => setD('cno', e.target.value)} />
                  <Select label="Situação da obra" value={modal.form.dados.situacao_obra} onChange={e => setD('situacao_obra', e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Concluída">Concluída</option>
                    <option value="Não iniciada">Não iniciada</option>
                  </Select>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Select label="Tipo de valor" value={modal.form.dados.tipo_valor} onChange={e => setD('tipo_valor', e.target.value)}>
                  <option value="mensal">Honorário mensal</option>
                  <option value="unico">Serviço único</option>
                </Select>
                <Select label="Regime (se souber)" value={modal.form.dados.regime} onChange={e => setD('regime', e.target.value)}>
                  <option value="">—</option>
                  <option value="MEI">MEI</option>
                  <option value="Simples Nacional">Simples Nacional</option>
                  <option value="Lucro Presumido">Lucro Presumido</option>
                  <option value="Lucro Real">Lucro Real</option>
                </Select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Input label={funil === 'servicos' && modal.form.dados.tipo_valor === 'mensal' ? 'Valor mensal (R$)' : 'Valor estimado (R$)'} type="number" step="0.01" min="0" value={modal.form.valor_estimado} onChange={e => setF('valor_estimado', e.target.value)} />
              <Select label="Etapa" value={modal.form.stage} onChange={e => setF('stage', e.target.value)}>
                {cfg.etapas.map(et => <option key={et.key} value={et.key}>{et.label}</option>)}
              </Select>
              <Select label="Responsável" value={modal.form.responsavel_id} onChange={e => setF('responsavel_id', e.target.value)}>
                <option value="">—</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </div>
            {modal.form.stage === 'perdido' && (
              <Input label="Motivo da perda" value={modal.form.motivo_perda || ''} onChange={e => setF('motivo_perda', e.target.value)} />
            )}
            <Textarea label="Observações" value={modal.form.observacoes || ''} onChange={e => setF('observacoes', e.target.value)} rows={3} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div>
                {modal.id && <Btn variant="danger" size="sm" onClick={() => excluir(modal.id)}><Trash2 size={13} /> Excluir</Btn>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
                <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Btn>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal motivo de perda */}
      <Modal open={!!perdaModal} onClose={() => setPerdaModal(null)} title="Por que o lead foi perdido?" size="sm">
        {perdaModal && (
          <form onSubmit={e => { e.preventDefault(); moverPara(perdaModal.lead, 'perdido', { motivo_perda: perdaModal.motivo || 'Não informado' }); setPerdaModal(null) }}>
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
    </div>
  )
}
