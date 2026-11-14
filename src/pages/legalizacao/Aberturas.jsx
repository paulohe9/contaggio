import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Btn, Badge, Modal, StatCard } from '../../components/ui'
import { fmtData, waLink, inputBase } from '../../lib/util'
import { DOCS_ABERTURA } from '../AberturaPublica'

const STATUS = { novo: ['Novo', 'blue'], em_analise: ['Em análise', 'yellow'], concluido: ['Concluído', 'green'] }
const SIM = v => v === true ? 'Sim' : v === false ? 'Não' : '—'
const miniBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#475569', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto) } catch { prompt('Copie o link:', texto) }
}
const linkPublico = () => `${window.location.origin}/abertura`
const linkReenvio = a => `${window.location.origin}/abertura/${a.token}`

function statusDoc(arqs) {
  if (!arqs.length) return 'pendente'
  if (arqs.every(x => x.status === 'aprovado')) return 'aprovado'
  if (arqs.some(x => x.status === 'recusado') && !arqs.some(x => x.status === 'enviado')) return 'recusado'
  return 'enviado'
}
const DOC_ROTULO = { pendente: ['Pendente', 'slate'], enviado: ['Enviado · revisar', 'blue'], aprovado: ['Aprovado', 'green'], recusado: ['Recusado', 'red'] }

export default function Aberturas({ onContar }) {
  const [lista, setLista] = useState([])
  const [arq, setArq] = useState([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState(null)
  const [filtro, setFiltro] = useState('abertos')
  const [recusa, setRecusa] = useState(null) // { abertura, tipo }
  const [motivo, setMotivo] = useState('')
  const [msg, setMsg] = useState('')

  async function carregar() {
    const [a, f] = await Promise.all([
      supabase.from('aberturas').select('*').order('created_at', { ascending: false }),
      supabase.from('abertura_arquivos').select('*').order('created_at'),
    ])
    setLista(a.data || []); setArq(f.data || []); setLoading(false)
    onContar?.((a.data || []).filter(x => x.status === 'novo').length)
  }
  useEffect(() => { carregar() }, [])

  const porAb = useMemo(() => {
    const m = {}
    for (const x of arq) (m[x.abertura_id] ||= []).push(x)
    return m
  }, [arq])

  const visiveis = lista.filter(a => filtro === 'todos' ? true : filtro === 'abertos' ? a.status !== 'concluido' : a.status === 'concluido')
  const cont = s => lista.filter(a => a.status === s).length

  async function mudarStatus(a, status) {
    await supabase.from('aberturas').update({ status, updated_at: new Date().toISOString() }).eq('id', a.id)
    carregar()
  }
  async function abrirArquivo(x) {
    const { data } = await supabase.storage.from('client-documents').createSignedUrl(x.path, 3600, { download: false })
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
    else setMsg('Não foi possível abrir o arquivo.')
  }
  async function aprovar(a, tipo) {
    await supabase.from('abertura_arquivos').update({ status: 'aprovado', motivo_recusa: null }).eq('abertura_id', a.id).eq('tipo', tipo)
    carregar()
  }
  async function recusar() {
    if (!recusa) return
    await supabase.from('abertura_arquivos').update({ status: 'recusado', motivo_recusa: motivo.trim() || 'arquivo com problema' }).eq('abertura_id', recusa.abertura.id).eq('tipo', recusa.tipo)
    setRecusa(null); setMotivo(''); carregar()
  }
  async function novaSolicitacao() {
    const { data, error } = await supabase.from('aberturas').insert({ status: 'novo', nome_solicitante: 'Aguardando preenchimento' }).select('token').single()
    if (error) { setMsg('Não foi possível criar: ' + error.message); return }
    await copiar(`${window.location.origin}/abertura/${data.token}`)
    setMsg('Link individual criado e copiado. Envie ao cliente.')
    carregar()
  }
  function cobrarWhats(a) {
    const faltam = DOCS_ABERTURA.filter(d => d.obrigatorio && !(porAb[a.id] || []).some(x => x.tipo === d.tipo && x.status !== 'recusado')).map(d => `• ${d.titulo}`)
    const texto = `Olá${a.nome_solicitante ? ', ' + a.nome_solicitante.split(' ')[0] : ''}! Aqui é da Aggio Contábil, sobre a abertura da sua empresa.` +
      (faltam.length ? `\n\nAinda precisamos destes documentos:\n${faltam.join('\n')}` : '\n\nPrecisamos conferir alguns dados.') +
      `\n\nVocê pode enviar por aqui: ${linkReenvio(a)}`
    const l = waLink(a.telefone, texto)
    if (l) window.open(l, '_blank', 'noopener'); else setMsg('Esta solicitação não tem telefone.')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Novas" value={cont('novo')} icon="🆕" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Em análise" value={cont('em_analise')} icon="🔎" bg="#fffbeb" border="#fde68a" />
        <StatCard label="Concluídas" value={cont('concluido')} icon="✅" bg="#f0fdf4" border="#bbf7d0" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Btn onClick={() => copiar(linkPublico()).then(() => setMsg('Link do formulário copiado.'))}>🔗 Copiar link do formulário</Btn>
        <Btn variant="secondary" onClick={novaSolicitacao}>➕ Gerar link individual</Btn>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...inputBase, marginLeft: 'auto' }}>
          <option value="abertos">Em andamento</option><option value="concluidos">Concluídas</option><option value="todos">Todas</option>
        </select>
      </div>
      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{msg}</div>}

      {visiveis.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: 40 }}>📨</div>
          <div style={{ fontWeight: 700, color: '#475569', marginTop: 6 }}>Nenhuma solicitação por aqui</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Copie o link do formulário e mande para o cliente.</div>
        </div>
      )}

      {visiveis.map(a => {
        const arqs = porAb[a.id] || []
        const abre = aberto === a.id
        const obrig = DOCS_ABERTURA.filter(d => d.obrigatorio)
        const feitos = obrig.filter(d => statusDoc(arqs.filter(x => x.tipo === d.tipo)) !== 'pendente').length
        const [rot, cor] = STATUS[a.status] || STATUS.novo
        return (
          <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: 'white', marginBottom: 10, overflow: 'hidden' }}>
            <div onClick={() => setAberto(abre ? null : a.id)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '13px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14.5 }}>{a.razao_social || 'Sem razão social'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{a.nome_solicitante || '—'} · recebido em {fmtData(a.created_at)} · {a.natureza_juridica || 'natureza não informada'}</div>
              </div>
              <span style={{ fontSize: 12, color: '#475569' }}>📎 {feitos}/{obrig.length} docs</span>
              <Badge color={cor}>{rot}</Badge>
              <span style={{ color: '#94a3b8' }}>{abre ? '▲' : '▼'}</span>
            </div>

            {abre && (
              <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 16px', background: '#fcfcfd' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '6px 18px', fontSize: 13, color: '#334155', marginBottom: 12 }}>
                  <div><b>Nome fantasia:</b> {a.nome_fantasia || '—'}</div>
                  <div><b>Capital social:</b> {a.capital_social || '—'}</div>
                  <div><b>E-mail:</b> {a.email || '—'}</div>
                  <div><b>Telefone:</b> {a.telefone || '—'}</div>
                  <div><b>Mais de um sócio:</b> {SIM(a.mais_de_um_socio)}</div>
                  <div><b>Sócio funcionário público:</b> {SIM(a.socio_funcionario_publico)}</div>
                  <div><b>Sócio em outra empresa:</b> {SIM(a.socio_outra_empresa)}</div>
                </div>
                {(a.socios || []).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Sócios</div>
                    {a.socios.map((s, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#334155' }}>{i + 1}. <b>{s.nome || '—'}</b> · {s.estado_civil || '—'} · {s.percentual ? s.percentual + '%' : '—'} · {s.telefone || 'sem telefone'} · {s.email || 'sem e-mail'}</div>
                    ))}
                  </div>
                )}
                {a.atividades && <div style={{ fontSize: 13, color: '#334155', marginBottom: 12 }}><b>Atividades:</b> {a.atividades}</div>}

                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Documentos</div>
                {DOCS_ABERTURA.map(d => {
                  const fs = arqs.filter(x => x.tipo === d.tipo)
                  const st = statusDoc(fs)
                  const [r, c] = DOC_ROTULO[st]
                  return (
                    <div key={d.tipo} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: '#1e293b' }}>{d.titulo}{!d.obrigatorio && <span style={{ color: '#94a3b8', fontWeight: 400 }}> · opcional</span>}</div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          {fs.map(x => <button key={x.id} onClick={() => abrirArquivo(x)} style={{ ...miniBtn, marginRight: 6, marginBottom: 3 }}>📎 {x.nome}</button>)}
                          {fs.find(x => x.status === 'recusado')?.motivo_recusa && <span style={{ color: '#b91c1c' }}> Motivo: {fs.find(x => x.status === 'recusado').motivo_recusa}</span>}
                        </div>
                      </div>
                      <Badge color={c}>{r}</Badge>
                      {fs.length > 0 && st !== 'aprovado' && <button style={miniBtn} onClick={() => aprovar(a, d.tipo)}>✅ Aprovar</button>}
                      {fs.length > 0 && st !== 'recusado' && <button style={miniBtn} onClick={() => { setRecusa({ abertura: a, tipo: d.tipo }); setMotivo('') }}>↩️ Recusar</button>}
                    </div>
                  )
                })}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
                  <button style={miniBtn} onClick={() => copiar(linkReenvio(a)).then(() => setMsg('Link da solicitação copiado.'))}>🔗 Copiar link de reenvio</button>
                  <button style={miniBtn} onClick={() => cobrarWhats(a)}>💬 Cobrar no WhatsApp</button>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>Situação:</span>
                  <select value={a.status} onChange={e => mudarStatus(a, e.target.value)} style={inputBase}>
                    <option value="novo">Novo</option><option value="em_analise">Em análise</option><option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <Modal open={!!recusa} onClose={() => setRecusa(null)} title="Recusar documento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#475569' }}>Diga ao cliente o que precisa ser corrigido (ele vê esse texto ao abrir o link).</div>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: foto cortada, envie o verso também" style={{ ...inputBase, width: '100%', minHeight: 80 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="secondary" onClick={() => setRecusa(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={recusar}>Recusar</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
