import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Btn, Badge, Modal, Input, Select, Textarea, StatCard } from '../../components/ui'
import { Plus, MessageCircle, Phone, Pencil } from 'lucide-react'
import { fmtBRL, fmtData, diasDesde, waLink, inputBase } from '../../lib/util'

const TIPOS = ['Engenheiro', 'Arquiteto', 'Contador parceiro', 'Corretor de imóveis', 'Cliente', 'Construtora', 'Outro']
const vazio = { nome: '', tipo: '', telefone: '', email: '', pix: '', percentual: 50, observacoes: '', ativo: true }

function temperatura(dias) {
  if (dias === null) return { label: '🧊 Nunca indicou', cor: 'slate', nivel: 3 }
  if (dias <= 30) return { label: '🔥 Quente', cor: 'red', nivel: 0 }
  if (dias <= 60) return { label: '🌤 Morno', cor: 'yellow', nivel: 1 }
  return { label: '🧊 Esfriando', cor: 'blue', nivel: 2 }
}

export default function Comissionadores() {
  const { profile } = useAuth()
  const [lista, setLista] = useState([])
  const [leads, setLeads] = useState([])
  const [etapas, setEtapas] = useState([])
  const [comissoes, setComissoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [aberto, setAberto] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroTemp, setFiltroTemp] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [cRes, lRes, eRes, kRes] = await Promise.all([
      supabase.from('comissionadores').select('*').order('nome'),
      supabase.from('crm_leads').select('id, nome, empresa, funil, stage, valor_estimado, comissionador_id, created_at').not('comissionador_id', 'is', null),
      supabase.from('crm_etapas').select('funil, key, tipo'),
      supabase.from('comissoes').select('*, clients(razao_social), pagar:financial_transactions!comissoes_titulo_pagar_id_fkey(status, data_pagamento, due_date)').order('created_at', { ascending: false }),
    ])
    if (cRes.error) alert('Erro: ' + cRes.error.message + '\n\nVerifique se o SQL 04 foi executado no Supabase.')
    setLista(cRes.data || []); setLeads(lRes.data || []); setEtapas(eRes.data || []); setComissoes(kRes.data || [])
    setLoading(false)
  }

  const tipoEtapa = (l) => etapas.find(e => e.funil === l.funil && e.key === l.stage)?.tipo

  const ranking = useMemo(() => lista.map(c => {
    const ls = leads.filter(l => l.comissionador_id === c.id)
    const fechados = ls.filter(l => tipoEtapa(l) === 'ganho')
    const perdidos = ls.filter(l => tipoEtapa(l) === 'perdido')
    const ks = comissoes.filter(k => k.comissionador_id === c.id && k.status === 'gerada')
    const pago = ks.filter(k => k.pagar?.status === 'pago').reduce((s, k) => s + Number(k.valor), 0)
    const aPagar = ks.filter(k => k.pagar?.status !== 'pago' && k.pagar?.status !== 'cancelado').reduce((s, k) => s + Number(k.valor), 0)
    const ultima = ls.map(l => l.created_at).sort().pop() || null
    const diasUltima = ultima ? diasDesde(ultima) : null
    return {
      ...c, leads: ls, indicacoes: ls.length, fechados: fechados.length,
      conversao: (fechados.length + perdidos.length) ? Math.round(fechados.length / (fechados.length + perdidos.length) * 100) : null,
      gerado: pago + aPagar, pago, aPagar, ultima, diasUltima, temp: temperatura(diasUltima), comissoes: ks,
    }
  }).sort((a, b) => b.gerado - a.gerado || b.indicacoes - a.indicacoes), [lista, leads, comissoes, etapas])

  const filtrados = ranking.filter(c => {
    if (busca && !`${c.nome} ${c.tipo || ''}`.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroTemp === 'esfriando' && c.temp.nivel < 2) return false
    if (filtroTemp === 'quentes' && c.temp.nivel !== 0) return false
    if (filtroTemp === 'inativos' && c.ativo) return false
    if (filtroTemp !== 'inativos' && !c.ativo) return false
    return true
  })

  const totalAPagar = ranking.reduce((s, c) => s + c.aPagar, 0)
  const totalPago = ranking.reduce((s, c) => s + c.pago, 0)
  const esfriando = ranking.filter(c => c.ativo && c.temp.nivel >= 2).length

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const f = modal.form
    const payload = { nome: f.nome.trim(), tipo: f.tipo || null, telefone: f.telefone || null, email: f.email || null, pix: f.pix || null, percentual: Number(f.percentual) || 50, observacoes: f.observacoes || null, ativo: !!f.ativo }
    const { error } = modal.id ? await supabase.from('comissionadores').update(payload).eq('id', modal.id) : await supabase.from('comissionadores').insert(payload)
    setSaving(false)
    if (error) { alert('Erro: ' + error.message); return }
    setModal(null); carregar()
  }

  async function registrarContato(c) {
    const agora = new Date().toISOString()
    setLista(ls => ls.map(x => x.id === c.id ? { ...x, ultimo_contato_at: agora } : x))
    await supabase.from('comissionadores').update({ ultimo_contato_at: agora }).eq('id', c.id)
  }

  function msgAquecer(c) {
    const nome = c.nome.split(' ')[0]
    const eu = profile?.name?.split(' ')[0] || 'a equipe'
    if (c.fechados > 0) return `Oi, ${nome}! Aqui é ${eu} da Aggio Contábil. Passando pra agradecer de novo pelas indicações — a parceria tem dado muito certo! Se tiver alguém precisando de contabilidade ou de regularização de obra, conta com a gente. A comissão continua de ${Number(c.percentual)}% do primeiro honorário. 🤝`
    return `Oi, ${nome}! Aqui é ${eu} da Aggio Contábil. Tudo bem? Lembrando da nossa parceria: indicando um cliente que feche com a gente, você recebe ${Number(c.percentual)}% do primeiro honorário. Se surgir alguém precisando de contabilidade ou de regularização de obra (CND/INSS), é só me chamar!`
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <PageHeader title="Comissionadores" subtitle="Quem indica clientes, quanto já gerou e quem precisa ser aquecido"
        actions={<Btn onClick={() => setModal({ form: { ...vazio } })}><Plus size={14} /> Novo comissionador</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard label="Comissionadores ativos" value={ranking.filter(c => c.ativo).length} icon="🤝" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Comissão a pagar" value={fmtBRL(totalAPagar)} icon="⏳" bg="#fffbeb" border="#fde68a" />
        <StatCard label="Comissão já paga" value={fmtBRL(totalPago)} icon="✅" bg="#f0fdf4" border="#bbf7d0" />
        <StatCard label="Esfriando (aquecer)" value={esfriando} icon="🧊" bg={esfriando ? '#eff6ff' : '#f8fafc'} border={esfriando ? '#93c5fd' : '#e2e8f0'} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar..." style={{ ...inputBase, flex: 1, minWidth: 200 }} />
        <select value={filtroTemp} onChange={e => setFiltroTemp(e.target.value)} style={inputBase}>
          <option value="">Todos os ativos</option>
          <option value="quentes">🔥 Só quentes</option>
          <option value="esfriando">🧊 Esfriando / nunca indicaram</option>
          <option value="inativos">Inativos</option>
        </select>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['#', 'Comissionador', 'Temperatura', 'Indicações', 'Fechados', 'Conversão', 'Comissão gerada', 'A pagar', 'Última indicação', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</td></tr>
                : filtrados.length === 0 ? <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Nenhum comissionador. Cadastre quem indica clientes para você.</td></tr>
                : filtrados.map((c, i) => {
                  const wa = waLink(c.telefone, msgAquecer(c))
                  const exp = aberto === c.id
                  return [
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: exp ? '#f8fafc' : 'white' }} onClick={() => setAberto(exp ? null : c.id)}>
                      <td style={{ padding: '11px 14px', fontWeight: 800, color: i < 3 ? '#C9960A' : '#94a3b8' }}>{i + 1}º</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{[c.tipo, `${Number(c.percentual)}%`].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td style={{ padding: '11px 14px' }}><Badge color={c.temp.cor}>{c.temp.label}</Badge></td>
                      <td style={{ padding: '11px 14px', fontWeight: 700 }}>{c.indicacoes}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: '#059669' }}>{c.fechados}</td>
                      <td style={{ padding: '11px 14px' }}>{c.conversao === null ? '—' : `${c.conversao}%`}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 800 }}>{fmtBRL(c.gerado)}</td>
                      <td style={{ padding: '11px 14px', color: c.aPagar ? '#b45309' : '#94a3b8', fontWeight: 700 }}>{fmtBRL(c.aPagar)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>
                        {c.ultima ? `${fmtData(c.ultima)} (${c.diasUltima}d)` : '—'}
                        {c.ultimo_contato_at && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>contato há {diasDesde(c.ultimo_contato_at)}d</div>}
                      </td>
                      <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {wa && <a href={wa} target="_blank" rel="noreferrer" onClick={() => registrarContato(c)} title="Aquecer pelo WhatsApp" style={{ ...mini, color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}><MessageCircle size={13} /></a>}
                          <button onClick={() => registrarContato(c)} title="Registrar contato" style={mini}><Phone size={13} /></button>
                          <button onClick={() => setModal({ id: c.id, form: { ...vazio, ...c } })} title="Editar" style={mini}><Pencil size={13} /></button>
                        </div>
                      </td>
                    </tr>,
                    exp && (
                      <tr key={c.id + '-det'}><td colSpan={10} style={{ background: '#f8fafc', padding: '6px 20px 16px 52px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                          <div>
                            <div style={tit}>Indicações</div>
                            {c.leads.length ? c.leads.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(l => (
                              <div key={l.id} style={linha}>
                                <span>{l.empresa || l.nome} <span style={{ color: '#94a3b8', fontSize: 11 }}>· {l.funil === 'obras' ? 'Obra' : 'Serviço'} · {fmtData(l.created_at)}</span></span>
                                <Badge color={tipoEtapa(l) === 'ganho' ? 'green' : tipoEtapa(l) === 'perdido' ? 'red' : 'blue'}>{tipoEtapa(l) === 'ganho' ? 'Fechou' : tipoEtapa(l) === 'perdido' ? 'Perdido' : 'Em negociação'}</Badge>
                              </div>
                            )) : <div style={{ fontSize: 12, color: '#94a3b8' }}>Nenhuma indicação ainda.</div>}
                          </div>
                          <div>
                            <div style={tit}>Comissões</div>
                            {c.comissoes.length ? c.comissoes.map(k => (
                              <div key={k.id} style={linha}>
                                <span>{k.clients?.razao_social} <span style={{ color: '#94a3b8', fontSize: 11 }}>· {Number(k.percentual)}% de {fmtBRL(k.valor_base)}</span></span>
                                <span style={{ fontWeight: 700 }}>{fmtBRL(k.valor)} <Badge color={k.pagar?.status === 'pago' ? 'green' : 'yellow'}>{k.pagar?.status === 'pago' ? `Paga ${fmtData(k.pagar.data_pagamento)}` : `A pagar ${fmtData(k.pagar?.due_date)}`}</Badge></span>
                              </div>
                            )) : <div style={{ fontSize: 12, color: '#94a3b8' }}>Nenhuma comissão gerada ainda.</div>}
                            {c.pix && <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>PIX: <b>{c.pix}</b></div>}
                            {c.observacoes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{c.observacoes}</div>}
                          </div>
                        </div>
                      </td></tr>
                    ),
                  ]
                })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
        Regra: quando a 1ª parcela de um cliente indicado é baixada no Financeiro, o sistema lança sozinho a comissão no A Pagar (vencimento em 5 dias). Se a baixa for estornada, a comissão é cancelada.
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Editar comissionador' : 'Novo comissionador'} size="lg">
        {modal && (
          <form onSubmit={salvar}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Input label="Nome *" value={modal.form.nome} onChange={e => setModal(m => ({ ...m, form: { ...m.form, nome: e.target.value } }))} required />
              <Select label="Tipo" value={modal.form.tipo || ''} onChange={e => setModal(m => ({ ...m, form: { ...m.form, tipo: e.target.value } }))}>
                <option value="">—</option>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Input label="WhatsApp" value={modal.form.telefone || ''} onChange={e => setModal(m => ({ ...m, form: { ...m.form, telefone: e.target.value } }))} />
              <Input label="Comissão (%)" type="number" step="0.5" min="0" max="100" value={modal.form.percentual} onChange={e => setModal(m => ({ ...m, form: { ...m.form, percentual: e.target.value } }))} />
              <Input label="E-mail" value={modal.form.email || ''} onChange={e => setModal(m => ({ ...m, form: { ...m.form, email: e.target.value } }))} />
              <Input label="Chave PIX" value={modal.form.pix || ''} onChange={e => setModal(m => ({ ...m, form: { ...m.form, pix: e.target.value } }))} />
            </div>
            <Textarea label="Observações" value={modal.form.observacoes || ''} onChange={e => setModal(m => ({ ...m, form: { ...m.form, observacoes: e.target.value } }))} rows={2} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!modal.form.ativo} onChange={e => setModal(m => ({ ...m, form: { ...m.form, ativo: e.target.checked } }))} /> Ativo
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

const mini = { background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center' }
const tit = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '8px 0 6px' }
const linha = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: 12.5 }
