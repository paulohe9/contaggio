import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { Btn, Badge, Modal, Input, Select, Textarea, TabBar } from '../../components/ui'
import { ArrowLeft, Edit2, UserMinus, Plus, Eye, EyeOff, Phone, Mail, User } from 'lucide-react'

const tribLabel = { simples_nacional: 'Simples Nacional', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', mei: 'MEI' }
const statusCor = { ativo: 'green', inativo: 'slate', suspenso: 'red' }
const reqStatusCor = { aberta: 'yellow', em_andamento: 'blue', concluida: 'green', cancelada: 'slate' }
const obStatusCor = { pendente: 'yellow', em_andamento: 'blue', concluida: 'green', atrasada: 'red' }

export default function ClienteDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [cliente, setCliente] = useState(null)
  const [observacoes, setObservacoes] = useState([])
  const [obrigacoes, setObrigacoes] = useState([])
  const [contatos, setContatos] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [senhas, setSenhas] = useState({})
  const [novaObs, setNovaObs] = useState('')
  const [showContatoModal, setShowContatoModal] = useState(false)
  const [showSolicModal, setShowSolicModal] = useState(false)
  const [contatoForm, setContatoForm] = useState({ name: '', role: '', phone: '', email: '', notes: '' })
  const [solicForm, setSolicForm] = useState({ title: '', description: '', status: 'aberta' })
  const [saving, setSaving] = useState(false)

  const canEdit = profile?.role === 'admin' || profile?.role === 'gerente'

  useEffect(() => { fetchTudo() }, [id])

  async function fetchTudo() {
    setLoading(true)
    const [cRes, obsRes, obRes, contRes, solRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('client_observations').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('obligations').select('*').eq('client_id', id).order('due_date'),
      supabase.from('crm_contacts').select('*').eq('client_id', id).order('name'),
      supabase.from('client_requests').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ])
    setCliente(cRes.data)
    setObservacoes(obsRes.data || [])
    setObrigacoes(obRes.data || [])
    setContatos(contRes.data || [])
    setSolicitacoes(solRes.data || [])
    setLoading(false)
  }

  async function salvarObs() {
    if (!novaObs.trim()) return
    await supabase.from('client_observations').insert({ client_id: id, text: novaObs, author: profile?.name || 'Sistema' })
    setNovaObs('')
    const { data } = await supabase.from('client_observations').select('*').eq('client_id', id).order('created_at', { ascending: false })
    setObservacoes(data || [])
  }

  async function salvarContato(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('crm_contacts').insert({ ...contatoForm, client_id: id })
    setSaving(false); setShowContatoModal(false)
    setContatoForm({ name: '', role: '', phone: '', email: '', notes: '' })
    const { data } = await supabase.from('crm_contacts').select('*').eq('client_id', id).order('name')
    setContatos(data || [])
    // Log no histórico
    await supabase.from('client_observations').insert({ client_id: id, text: `Contato adicionado: ${contatoForm.name} (${contatoForm.role || 'sem cargo'})`, author: profile?.name || 'Sistema' })
  }

  async function removerContato(cid, nome) {
    if (!confirm(`Remover contato ${nome}?`)) return
    await supabase.from('crm_contacts').delete().eq('id', cid)
    setContatos(c => c.filter(x => x.id !== cid))
    await supabase.from('client_observations').insert({ client_id: id, text: `Contato removido: ${nome}`, author: profile?.name || 'Sistema' })
  }

  async function salvarSolic(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('client_requests').insert({ ...solicForm, client_id: id, author: profile?.name || 'Sistema' })
    setSaving(false); setShowSolicModal(false)
    setSolicForm({ title: '', description: '', status: 'aberta' })
    const { data } = await supabase.from('client_requests').select('*').eq('client_id', id).order('created_at', { ascending: false })
    setSolicitacoes(data || [])
    await supabase.from('client_observations').insert({ client_id: id, text: `Solicitação registrada: ${solicForm.title}`, author: profile?.name || 'Sistema' })
  }

  async function atualizarStatusSolic(sid, status) {
    await supabase.from('client_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', sid)
    setSolicitacoes(s => s.map(x => x.id === sid ? { ...x, status } : x))
  }

  async function inativar() {
    if (!confirm('Inativar este cliente?')) return
    await supabase.from('clients').update({ status: 'inativo' }).eq('id', id)
    setCliente(c => ({ ...c, status: 'inativo' }))
    await supabase.from('client_observations').insert({ client_id: id, text: 'Cliente inativado.', author: profile?.name || 'Sistema' })
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
  if (!cliente) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cliente não encontrado.</div>

  const tabs = [
    { key: 'info', label: 'Informações', icon: '📋' },
    { key: 'portais', label: 'Portais', icon: '🔐' },
    { key: 'crm', label: `CRM (${contatos.length})`, icon: '👤' },
    { key: 'solicitacoes', label: `Solicitações (${solicitacoes.length})`, icon: '📝' },
    { key: 'historico', label: `Histórico (${observacoes.length + obrigacoes.length})`, icon: '🕐' },
  ]

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/clientes')} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 20 }}>
            {cliente.razao_social.charAt(0)}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>{cliente.razao_social}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
              <Badge color={statusCor[cliente.status]}>{cliente.status}</Badge>
              {cliente.tributacao && <Badge color="blue">{tribLabel[cliente.tributacao]}</Badge>}
              {cliente.aberto_pelo_escritorio === 'sim' && <Badge color="purple">Aberto pelo escritório</Badge>}
              {cliente.aberto_pelo_escritorio === 'transformado_mei' && <Badge color="orange">Transformado do MEI</Badge>}
            </div>
          </div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={`/clientes/${id}/editar`}><Btn variant="secondary" size="sm"><Edit2 size={13} /> Editar</Btn></Link>
            {cliente.status === 'ativo' && <Btn variant="danger" size="sm" onClick={inativar}><UserMinus size={13} /> Inativar</Btn>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {/* Info */}
      {tab === 'info' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[
              ['Razão Social', cliente.razao_social], ['Nome Fantasia', cliente.nome_fantasia],
              ['CNPJ', cliente.cnpj], ['Inscrição Municipal', cliente.inscricao_municipal],
              ['Inscrição Estadual', cliente.inscricao_estadual], ['Regime Tributário', tribLabel[cliente.tributacao]],
              ['E-mail', cliente.email], ['Telefone', cliente.telefone],
            ].map(([l, v]) => (
              <InfoRow key={l} label={l} value={v} />
            ))}
            <div style={{ gridColumn: '1/-1' }}><InfoRow label="Endereço" value={cliente.endereco} /></div>
            <InfoRow label="Data de Entrada" value={cliente.data_entrada ? new Date(cliente.data_entrada).toLocaleDateString('pt-BR') : null} />
            <InfoRow label="Abertura" value={cliente.aberto_pelo_escritorio === 'sim' ? 'Pelo escritório' : cliente.aberto_pelo_escritorio === 'transformado_mei' ? 'Transformado do MEI' : 'Não'} />
          </div>
        </div>
      )}

      {/* Portais */}
      {tab === 'portais' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(!cliente.portal_credentials || cliente.portal_credentials.length === 0) ? (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 48, textAlign: 'center', color: '#94a3b8' }}>Nenhum portal cadastrado.</div>
          ) : cliente.portal_credentials.map((p, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>🔗 {p.portal_name || `Portal ${i + 1}`}</div>
                {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>Abrir portal ↗</a>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <InfoRow label="Login" value={p.login} mono />
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Senha</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#1e293b' }}>{senhas[i] ? p.senha : '••••••••'}</span>
                    <button onClick={() => setSenhas(s => ({ ...s, [i]: !s[i] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center' }}>
                      {senhas[i] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CRM */}
      {tab === 'crm' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            {canEdit && <Btn onClick={() => setShowContatoModal(true)}><Plus size={14} /> Novo Contato</Btn>}
          </div>
          {contatos.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
              <div style={{ fontWeight: 600, color: '#475569' }}>Nenhum contato cadastrado</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Adicione pessoas de contato deste cliente</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {contatos.map(c => (
                <div key={c.id} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, flexShrink: 0 }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{c.name}</div>
                        {c.role && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{c.role}</div>}
                      </div>
                    </div>
                    {canEdit && (
                      <button onClick={() => removerContato(c.id, c.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, padding: 4 }}>✕</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {c.phone && <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: '#64748b' }}><Phone size={12} />{c.phone}</div>}
                    {c.email && <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: '#64748b' }}><Mail size={12} />{c.email}</div>}
                    {c.notes && <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 4, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>{c.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Solicitações */}
      {tab === 'solicitacoes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <Btn onClick={() => setShowSolicModal(true)}><Plus size={14} /> Nova Solicitação</Btn>
          </div>
          {solicitacoes.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
              <div style={{ fontWeight: 600, color: '#475569' }}>Nenhuma solicitação registrada</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {solicitacoes.map(s => (
                <div key={s.id} style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{s.title}</span>
                      <Badge color={reqStatusCor[s.status]}>{s.status.replace('_', ' ')}</Badge>
                    </div>
                    {s.description && <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{s.description}</p>}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                      {s.author} · {format(parseISO(s.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  {s.status !== 'concluida' && canEdit && (
                    <select value={s.status} onChange={e => atualizarStatusSolic(s.id, e.target.value)}
                      style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', background: 'white', flexShrink: 0 }}>
                      <option value="aberta">Aberta</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      {tab === 'historico' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nova observação */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 10, fontSize: 14 }}>Nova Anotação</div>
            <textarea value={novaObs} onChange={e => setNovaObs(e.target.value)} rows={3} placeholder="Digite uma observação, anotação ou registro..."
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 13px', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <Btn size="sm" onClick={salvarObs}>Salvar anotação</Btn>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Observações */}
            {observacoes.map(obs => (
              <div key={obs.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 18px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{obs.text}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>💬 {obs.author} · {format(parseISO(obs.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
              </div>
            ))}
            {/* Tarefas */}
            {obrigacoes.map(o => (
              <div key={o.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 18px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{o.title}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>Vence: {format(parseISO(o.due_date), 'dd/MM/yyyy')}</span>
                  </div>
                  <Badge color={obStatusCor[o.status]}>{o.status}</Badge>
                </div>
              </div>
            ))}
            {observacoes.length + obrigacoes.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>Nenhum histórico registrado.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal Contato */}
      <Modal open={showContatoModal} onClose={() => setShowContatoModal(false)} title="Novo Contato">
        <form onSubmit={salvarContato}>
          <Input label="Nome *" value={contatoForm.name} onChange={e => setContatoForm(f => ({ ...f, name: e.target.value }))} placeholder="João Silva" required />
          <Input label="Cargo / Função" value={contatoForm.role} onChange={e => setContatoForm(f => ({ ...f, role: e.target.value }))} placeholder="Sócio, Contador, Financeiro..." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Telefone" value={contatoForm.phone} onChange={e => setContatoForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            <Input label="E-mail" type="email" value={contatoForm.email} onChange={e => setContatoForm(f => ({ ...f, email: e.target.value }))} placeholder="joao@empresa.com" />
          </div>
          <Textarea label="Observações" value={contatoForm.notes} onChange={e => setContatoForm(f => ({ ...f, notes: e.target.value }))} placeholder="Informações adicionais..." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowContatoModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Contato'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Solicitação */}
      <Modal open={showSolicModal} onClose={() => setShowSolicModal(false)} title="Nova Solicitação">
        <form onSubmit={salvarSolic}>
          <Input label="Título *" value={solicForm.title} onChange={e => setSolicForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Certidão negativa, parcelamento..." required />
          <Textarea label="Descrição" value={solicForm.description} onChange={e => setSolicForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes da solicitação..." rows={4} />
          <Select label="Status inicial" value={solicForm.status} onChange={e => setSolicForm(f => ({ ...f, status: e.target.value }))}>
            <option value="aberta">Aberta</option>
            <option value="em_andamento">Em andamento</option>
          </Select>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowSolicModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar Solicitação'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: value ? '#1e293b' : '#cbd5e1', fontFamily: mono ? 'monospace' : 'inherit' }}>{value || '—'}</div>
    </div>
  )
}
