import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea, StatCard } from '../../components/ui'
import { Plus, Copy, MessageCircle, Download, Trash2, RefreshCw, Check, X } from 'lucide-react'
import { hojeISO, fmtData, waLink, inputBase } from '../../lib/util'

const STATUS = {
  pendente: { label: 'Pendente', cor: 'yellow' },
  enviado: { label: 'Enviado · revisar', cor: 'blue' },
  aprovado: { label: 'Aprovado', cor: 'green' },
  recusado: { label: 'Recusado · reenviar', cor: 'red' },
}

// Atalhos para montar a solicitação rapidinho
const MODELOS = {
  'Rotina mensal': ['Extrato bancário do mês', 'Notas fiscais de entrada (compras)', 'Notas fiscais de saída (vendas/serviços)', 'Comprovantes de pagamento de despesas', 'Folha de ponto / informações da folha'],
  'Abertura de empresa': ['RG e CPF dos sócios', 'Comprovante de endereço dos sócios', 'Comprovante de endereço da empresa', 'IPTU ou contrato de locação do imóvel', 'Título de eleitor / recibo do IRPF dos sócios'],
  'Regularização de obra': ['Documento de identificação do proprietário (RG/CPF ou contrato social)', 'Projeto arquitetônico aprovado / planta', 'Alvará de construção', 'ART ou RRT do responsável técnico', 'Habite-se (se já tiver)', 'Notas fiscais de material e mão de obra', 'Comprovante de endereço da obra / matrícula do imóvel'],
  'IRPF': ['Informe de rendimentos (empresa/INSS)', 'Informe de rendimentos bancários e de investimentos', 'Recibos médicos e odontológicos', 'Comprovantes de educação', 'Documentos de compra e venda de bens'],
}

export default function Documentos() {
  const { profile } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('abertos')
  const [novo, setNovo] = useState(null) // { client_id, competencia, prazo, itens: [], itemLivre, descricao }
  const [arquivos, setArquivos] = useState(null) // { pedido, files }
  const [recusa, setRecusa] = useState(null) // { pedido, motivo }
  const [saving, setSaving] = useState(false)
  const [copiado, setCopiado] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [pRes, cRes] = await Promise.all([
      supabase.from('document_requests').select('*, document_request_files(id, nome, path, tamanho, created_at)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, razao_social, telefone, email, portal_token').eq('status', 'ativo').order('razao_social'),
    ])
    if (pRes.error) alert('Erro ao carregar: ' + pRes.error.message + '\n\nVerifique se o SQL de melhorias foi executado no Supabase.')
    setPedidos(pRes.data || [])
    setClientes(cRes.data || [])
    setLoading(false)
  }

  const hoje = hojeISO()
  const atrasado = (p) => p.prazo && p.prazo < hoje && ['pendente', 'recusado'].includes(p.status)
  const clientePorId = useMemo(() => Object.fromEntries(clientes.map(c => [c.id, c])), [clientes])

  const filtrados = pedidos.filter(p => {
    if (filtroCliente && p.client_id !== filtroCliente) return false
    if (filtroStatus === 'abertos') return p.status !== 'aprovado'
    if (filtroStatus === 'atrasados') return atrasado(p)
    if (filtroStatus) return p.status === filtroStatus
    return true
  })
  const porCliente = filtrados.reduce((acc, p) => { (acc[p.client_id] ||= []).push(p); return acc }, {})

  const linkPortal = (c) => c?.portal_token ? `${window.location.origin}/portal/${c.portal_token}` : null

  async function copiarLink(c) {
    const link = linkPortal(c)
    if (!link) return
    try { await navigator.clipboard.writeText(link) } catch { prompt('Copie o link:', link) }
    setCopiado(c.id); setTimeout(() => setCopiado(null), 2000)
  }

  function mensagemWhats(c) {
    const pend = pedidos.filter(p => p.client_id === c.id && ['pendente', 'recusado'].includes(p.status))
    const lista = pend.slice(0, 10).map(p => `• ${p.titulo}${p.prazo ? ` (até ${fmtData(p.prazo)})` : ''}`).join('\n')
    return `Olá! Aqui é da Aggio Contábil 👋\n\nPrecisamos dos seguintes documentos:\n${lista}\n\nVocê pode enviar tudo por este link, direto do celular:\n${linkPortal(c)}\n\nQualquer dúvida, é só chamar!`
  }

  async function gerarNovoLink(c) {
    if (!confirm('Gerar um novo link? O link anterior deixa de funcionar imediatamente.')) return
    const token = crypto.randomUUID()
    const { error } = await supabase.from('clients').update({ portal_token: token }).eq('id', c.id)
    if (error) { alert('Erro: ' + error.message); return }
    setClientes(cs => cs.map(x => x.id === c.id ? { ...x, portal_token: token } : x))
  }

  // ─── Nova solicitação ───
  function toggleItem(item) {
    setNovo(n => ({ ...n, itens: n.itens.includes(item) ? n.itens.filter(i => i !== item) : [...n.itens, item] }))
  }
  function addItemLivre() {
    const v = (novo.itemLivre || '').trim()
    if (!v) return
    setNovo(n => ({ ...n, itens: n.itens.includes(v) ? n.itens : [...n.itens, v], itemLivre: '' }))
  }
  async function salvarNovo(e) {
    e.preventDefault()
    const itens = [...novo.itens]
    if (novo.itemLivre?.trim()) itens.push(novo.itemLivre.trim())
    if (!itens.length) { alert('Selecione ou digite pelo menos um documento.'); return }
    setSaving(true)
    const registros = itens.map(titulo => ({
      client_id: novo.client_id, titulo, descricao: novo.descricao || null,
      competencia: novo.competencia || null, prazo: novo.prazo || null, criado_por: profile?.name || 'Sistema',
    }))
    const { error } = await supabase.from('document_requests').insert(registros)
    setSaving(false)
    if (error) { alert('Erro: ' + error.message); return }
    setNovo(null)
    carregar()
  }

  // ─── Revisão ───
  async function verArquivos(p) {
    const files = await Promise.all((p.document_request_files || []).map(async f => {
      const { data } = await supabase.storage.from('client-documents').createSignedUrl(f.path, 60 * 60, { download: f.nome })
      return { ...f, url: data?.signedUrl }
    }))
    setArquivos({ pedido: p, files })
  }
  async function revisar(p, status, motivo = null) {
    const upd = { status, motivo_recusa: status === 'recusado' ? motivo : null, revisado_em: new Date().toISOString() }
    const { error } = await supabase.from('document_requests').update(upd).eq('id', p.id)
    if (error) { alert('Erro: ' + error.message); return }
    setPedidos(ps => ps.map(x => x.id === p.id ? { ...x, ...upd } : x))
    setArquivos(null); setRecusa(null)
  }
  async function excluir(p) {
    if (!confirm(`Excluir a solicitação "${p.titulo}"${p.document_request_files?.length ? ' e os arquivos enviados' : ''}?`)) return
    const paths = (p.document_request_files || []).map(f => f.path)
    if (paths.length) await supabase.storage.from('client-documents').remove(paths)
    await supabase.from('document_requests').delete().eq('id', p.id)
    setPedidos(ps => ps.filter(x => x.id !== p.id))
  }

  const conta = (fn) => pedidos.filter(fn).length

  return (
    <div style={{ maxWidth: 1150 }}>
      <PageHeader
        title="Documentos"
        subtitle="Peça documentos ao cliente e acompanhe o que já chegou — ele envia por um link, sem precisar de senha"
        actions={<Btn onClick={() => setNovo({ client_id: filtroCliente || '', competencia: '', prazo: hojeISO(5), itens: [], itemLivre: '', descricao: '' })}><Plus size={14} /> Solicitar documentos</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard label="Pendentes com cliente" value={conta(p => ['pendente', 'recusado'].includes(p.status))} icon="⏳" bg="#fffbeb" border="#fde68a" />
        <StatCard label="Chegaram · revisar" value={conta(p => p.status === 'enviado')} icon="📬" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Atrasados" value={conta(atrasado)} icon="⚠️" bg="#fef2f2" border="#fecaca" />
        <StatCard label="Aprovados" value={conta(p => p.status === 'aprovado')} icon="✅" bg="#f0fdf4" border="#bbf7d0" />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ ...inputBase, minWidth: 240 }}>
          <option value="">Todos os clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={inputBase}>
          <option value="abertos">Em aberto (não aprovados)</option>
          <option value="pendente">Pendentes com o cliente</option>
          <option value="enviado">Enviados · revisar</option>
          <option value="recusado">Recusados</option>
          <option value="atrasados">Atrasados</option>
          <option value="aprovado">Aprovados</option>
          <option value="">Todos</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Carregando...</div>
      ) : Object.keys(porCliente).length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 56, textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
          <div style={{ fontWeight: 600, color: '#475569' }}>Nenhuma solicitação de documento aqui</div>
        </div>
      ) : Object.entries(porCliente).map(([cid, lista]) => {
        const c = clientePorId[cid] || { id: cid, razao_social: 'Cliente inativo' }
        const pendentes = lista.filter(p => ['pendente', 'recusado'].includes(p.status)).length
        const wa = c.telefone ? waLink(c.telefone, mensagemWhats(c)) : null
        return (
          <div key={cid} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{c.razao_social}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{pendentes} pendente(s) com o cliente · {lista.length} no filtro</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {linkPortal(c) && <Btn size="sm" variant="secondary" onClick={() => copiarLink(c)}>{copiado === c.id ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar link do portal</>}</Btn>}
                {wa ? (
                  <a href={wa} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <Btn size="sm" variant="success"><MessageCircle size={13} /> Cobrar no WhatsApp</Btn>
                  </a>
                ) : <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>sem telefone no cadastro</span>}
                {linkPortal(c) && <button title="Gerar novo link (invalida o anterior)" onClick={() => gerarNovoLink(c)} style={miniBtn}><RefreshCw size={12} /></button>}
              </div>
            </div>
            {lista.map(p => {
              const st = STATUS[p.status] || STATUS.pendente
              const nArq = p.document_request_files?.length || 0
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13.5 }}>{p.titulo}</div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                      {p.competencia && <span>Competência {p.competencia.slice(5)}/{p.competencia.slice(0, 4)}</span>}
                      {p.prazo && <span style={{ color: atrasado(p) ? '#dc2626' : undefined, fontWeight: atrasado(p) ? 700 : 400 }}>Prazo {fmtData(p.prazo)}{atrasado(p) ? ' · atrasado' : ''}</span>}
                      {p.status === 'recusado' && p.motivo_recusa && <span style={{ color: '#b91c1c' }}>Motivo: {p.motivo_recusa}</span>}
                    </div>
                  </div>
                  <Badge color={st.cor}>{st.label}</Badge>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {nArq > 0 && <button onClick={() => verArquivos(p)} style={miniBtn}><Download size={12} /> {nArq} arquivo(s)</button>}
                    {p.status === 'enviado' && <>
                      <button onClick={() => revisar(p, 'aprovado')} style={{ ...miniBtn, color: '#059669', borderColor: '#bbf7d0', background: '#f0fdf4' }}><Check size={12} /> Aprovar</button>
                      <button onClick={() => setRecusa({ pedido: p, motivo: '' })} style={{ ...miniBtn, color: '#dc2626' }}><X size={12} /> Recusar</button>
                    </>}
                    {p.status === 'pendente' && <button title="Marcar como recebido por fora (e-mail, WhatsApp...)" onClick={() => revisar(p, 'aprovado')} style={miniBtn}>Recebi por fora</button>}
                    <button title="Excluir" onClick={() => excluir(p)} style={{ ...miniBtn, color: '#dc2626' }}><Trash2 size={12} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Nova solicitação */}
      <Modal open={!!novo} onClose={() => setNovo(null)} title="Solicitar documentos" size="xl">
        {novo && (
          <form onSubmit={salvarNovo}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <Select label="Cliente *" value={novo.client_id} onChange={e => setNovo(n => ({ ...n, client_id: e.target.value }))} required>
                <option value="">Selecione</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
              </Select>
              <Input label="Competência" type="month" value={novo.competencia} onChange={e => setNovo(n => ({ ...n, competencia: e.target.value }))} />
              <Input label="Prazo para envio" type="date" value={novo.prazo} onChange={e => setNovo(n => ({ ...n, prazo: e.target.value }))} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Documentos (clique para marcar)</div>
            {Object.entries(MODELOS).map(([grupo, itens]) => (
              <div key={grupo} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>{grupo}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {itens.map(item => {
                    const on = novo.itens.includes(item)
                    return (
                      <button type="button" key={item} onClick={() => toggleItem(item)} style={{
                        padding: '5px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                        border: on ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0', background: on ? '#eff6ff' : 'white', color: on ? '#1d4ed8' : '#475569', fontWeight: on ? 700 : 500,
                      }}>{on ? '✓ ' : ''}{item}</button>
                    )
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 6 }}>
              <div style={{ flex: 1 }}>
                <Input label="Outro documento" value={novo.itemLivre} onChange={e => setNovo(n => ({ ...n, itemLivre: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItemLivre() } }} placeholder="Digite e aperte Enter" />
              </div>
              <div style={{ marginBottom: 14 }}><Btn variant="secondary" onClick={addItemLivre}>Adicionar</Btn></div>
            </div>
            {novo.itens.filter(i => !Object.values(MODELOS).flat().includes(i)).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {novo.itens.filter(i => !Object.values(MODELOS).flat().includes(i)).map(i => (
                  <span key={i} onClick={() => toggleItem(i)} style={{ padding: '5px 10px', borderRadius: 999, fontSize: 12, background: '#eff6ff', color: '#1d4ed8', border: '1.5px solid #2563eb', fontWeight: 700, cursor: 'pointer' }}>✓ {i} ✕</span>
                ))}
              </div>
            )}
            <Textarea label="Recado para o cliente (aparece no portal)" value={novo.descricao} onChange={e => setNovo(n => ({ ...n, descricao: e.target.value }))} rows={2}
              placeholder="Ex.: Pode mandar foto legível ou PDF." />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>{novo.itens.length} documento(s) selecionado(s)</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" onClick={() => setNovo(null)}>Cancelar</Btn>
                <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Criar solicitação'}</Btn>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Arquivos enviados */}
      <Modal open={!!arquivos} onClose={() => setArquivos(null)} title={arquivos?.pedido.titulo || ''} size="lg">
        {arquivos && (
          <div>
            {arquivos.files.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 10, marginBottom: 8, gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {f.nome}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.tamanho ? `${(f.tamanho / 1024 / 1024).toFixed(2)} MB · ` : ''}{new Date(f.created_at).toLocaleString('pt-BR')}</div>
                </div>
                {f.url && <a href={f.url} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: 'none' }}><Download size={12} /> Baixar</a>}
              </div>
            ))}
            {arquivos.pedido.status === 'enviado' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Btn variant="danger" onClick={() => setRecusa({ pedido: arquivos.pedido, motivo: '' })}><X size={13} /> Recusar</Btn>
                <Btn variant="success" onClick={() => revisar(arquivos.pedido, 'aprovado')}><Check size={13} /> Aprovar</Btn>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Recusa */}
      <Modal open={!!recusa} onClose={() => setRecusa(null)} title="Recusar documento" size="sm">
        {recusa && (
          <form onSubmit={e => { e.preventDefault(); revisar(recusa.pedido, 'recusado', recusa.motivo || 'Documento ilegível ou incorreto') }}>
            <Textarea label="Motivo (o cliente vai ver)" value={recusa.motivo} onChange={e => setRecusa(r => ({ ...r, motivo: e.target.value }))} rows={3} placeholder="Ex.: Extrato veio sem o período completo." autoFocus />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setRecusa(null)}>Cancelar</Btn>
              <Btn type="submit" variant="danger">Recusar e pedir reenvio</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

const miniBtn = {
  background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 9px', cursor: 'pointer',
  color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600,
}
