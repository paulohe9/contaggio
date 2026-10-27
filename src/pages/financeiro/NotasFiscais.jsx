import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Btn, Badge, Modal, Select, Textarea, StatCard } from '../../components/ui'
import { emissor, configEmissor, registrarNota, guardarArquivos, linkArquivo, STATUS_NFSE } from '../../lib/emissor'
import { ConfigEmissor } from './EmitirNfse'
import { fmtBRL, fmtData, hojeISO, inputBase, waLink } from '../../lib/util'

export default function NotasFiscais() {
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [conexao, setConexao] = useState('verificando') // verificando | ok | offline | sem_config
  const [versao, setVersao] = useState('')
  const [configAberta, setConfigAberta] = useState(false)
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [cancelar, setCancelar] = useState(null) // { nota, motivoCodigo, motivo }
  const [trabalhando, setTrabalhando] = useState('')

  useEffect(() => { carregar(); verificarConexao() }, [])

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase.from('nfse_notas').select('*, clients(razao_social, telefone)').order('created_at', { ascending: false })
    if (error) alert('Erro ao carregar notas: ' + error.message + '\n\nVerifique se o SQL 05 foi executado no Supabase.')
    setNotas(data || [])
    setLoading(false)
  }

  async function verificarConexao() {
    if (!configEmissor()?.token) { setConexao('sem_config'); return }
    setConexao('verificando')
    try { const st = await emissor('/status'); setVersao(st.versao); setConexao('ok') } catch { setConexao('offline') }
  }

  const filtradas = notas.filter(n => {
    if (mes && (n.competencia || n.created_at || '').slice(0, 7) !== mes) return false
    if (filtroStatus && n.status !== filtroStatus) return false
    if (busca && !`${n.tomador_nome || ''} ${n.numero_nfse || ''} ${n.descricao || ''} ${n.clients?.razao_social || ''}`.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })
  const autorizadasMes = filtradas.filter(n => n.status === 'autorizada' && n.ambiente === 'producao')
  const pendentes = notas.filter(n => n.status === 'pendente_verificacao' || n.status === 'enviando')

  async function conciliar(n) {
    setTrabalhando(n.id)
    try {
      const r = await emissor(`/notas/${encodeURIComponent(n.id_dps)}/reconciliar`, { method: 'POST' })
      let reg = await registrarNota(r.nota, { transaction_id: n.transaction_id, client_id: n.client_id })
      if (reg.status === 'autorizada' && !reg.pdf_path) reg = await guardarArquivos(reg)
      alert(r.resultado || 'Nota conciliada com a Sefin.')
      carregar()
    } catch (e) { alert(e.message) }
    setTrabalhando('')
  }

  async function baixarArquivos(n) {
    setTrabalhando(n.id)
    try { await guardarArquivos(n); carregar() } catch (e) { alert(e.message) }
    setTrabalhando('')
  }

  async function abrir(path) {
    const url = await linkArquivo(path, 1)
    if (url) window.open(url, '_blank'); else alert('Arquivo não encontrado.')
  }

  async function whatsapp(n) {
    const pdf = await linkArquivo(n.pdf_path)
    const msg = `Olá! Segue a NFS-e nº ${n.numero_nfse} da Aggio Contábil, no valor de ${fmtBRL(n.valor)}.${pdf ? `\n\nNota (PDF): ${pdf}` : ''}\n\nChave de acesso: ${n.chave_acesso}`
    const link = waLink(n.clients?.telefone, msg)
    if (link) window.open(link, '_blank')
    else { try { await navigator.clipboard.writeText(msg) } catch { /* ignore */ } alert('Cliente sem telefone no cadastro. A mensagem foi copiada.') }
  }

  async function confirmarCancelamento(e) {
    e.preventDefault()
    const { nota, motivoCodigo, motivo } = cancelar
    if (motivo.trim().length < 15) { alert('O motivo precisa ter pelo menos 15 caracteres (exigência da Sefin).'); return }
    setTrabalhando(nota.id)
    try {
      const r = await emissor(`/notas/${encodeURIComponent(nota.id_dps)}/cancelar`, { method: 'POST', body: { motivoCodigo, motivo: motivo.trim() } })
      const reg = await registrarNota(r.nota, { transaction_id: nota.transaction_id, client_id: nota.client_id })
      await guardarArquivos(reg) // PDF com tarja de cancelada
      setCancelar(null); carregar()
    } catch (err) {
      const lista = (err.dados?.erros || []).map(x => `${x.codigo}: ${x.descricao || ''}${x.dica ? ` (${x.dica})` : ''}`).join('\n')
      alert(err.message + (lista ? '\n\n' + lista : ''))
    }
    setTrabalhando('')
  }

  const corConexao = { ok: '#059669', offline: '#dc2626', sem_config: '#b45309', verificando: '#64748b' }[conexao]
  const textoConexao = { ok: `Emissor conectado neste computador (v${versao})`, offline: 'Emissor fechado ou inacessível neste computador', sem_config: 'Emissor ainda não configurado neste computador', verificando: 'Verificando emissor...' }[conexao]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '10px 16px', marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: corConexao }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', flex: 1 }}>{textoConexao}</span>
        <Btn size="sm" variant="ghost" onClick={verificarConexao}>Testar</Btn>
        <Btn size="sm" variant="secondary" onClick={() => setConfigAberta(true)}>⚙ Configurar emissor</Btn>
      </div>

      {pendentes.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 14 }}>
          ⏳ {pendentes.length} nota(s) sem resposta da Sefin. <b>Não emita de novo</b>: clique em "Conciliar" na nota.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        <StatCard label="Autorizadas no mês (produção)" value={autorizadasMes.length} icon="🧾" bg="#f0fdf4" border="#bbf7d0" />
        <StatCard label="Faturado em notas no mês" value={fmtBRL(autorizadasMes.reduce((s, n) => s + Number(n.valor || 0), 0))} icon="💰" bg="#eff6ff" border="#bfdbfe" />
        <StatCard label="Rejeitadas / pendentes" value={filtradas.filter(n => ['rejeitada', 'pendente_verificacao'].includes(n.status)).length} icon="⚠️" bg="#fef2f2" border="#fecaca" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar tomador, número, descrição..." style={{ ...inputBase, flex: 1, minWidth: 200 }} />
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={inputBase} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={inputBase}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_NFSE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {mes && <button onClick={() => setMes('')} style={{ ...inputBase, cursor: 'pointer', color: '#2563eb' }}>Todos os meses</button>}
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Nº', 'Tomador', 'Competência', 'Valor', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Valor' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</td></tr>
                : filtradas.length === 0 ? <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Nenhuma nota neste filtro. Emita pelo botão 🧾 nos títulos do A Receber.</td></tr>
                : filtradas.map(n => {
                  const st = STATUS_NFSE[n.status] || { label: n.status, cor: 'slate' }
                  const ocupado = trabalhando === n.id
                  return (
                    <tr key={n.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>
                        {n.numero_nfse || '—'}
                        {n.ambiente !== 'producao' && <div style={{ fontSize: 10, color: '#2563eb', fontWeight: 700 }}>TESTE</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{n.tomador_nome || n.clients?.razao_social}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.descricao}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>{fmtData(n.competencia)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: n.status === 'cancelada' ? '#94a3b8' : '#059669', textDecoration: n.status === 'cancelada' ? 'line-through' : 'none' }}>{fmtBRL(n.valor)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <Badge color={st.cor}>{st.label}</Badge>
                        {n.status === 'rejeitada' && (n.erros || [])[0] && <div style={{ fontSize: 10.5, color: '#b91c1c', marginTop: 3 }} title={(n.erros || []).map(x => `${x.codigo}: ${x.descricao || ''}${x.dica ? ' — ' + x.dica : ''}`).join('\n')}>{n.erros[0].codigo}: {(n.erros[0].dica || n.erros[0].descricao || '').slice(0, 60)}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {n.pdf_path && <button onClick={() => abrir(n.pdf_path)} style={mini}>PDF</button>}
                          {n.xml_path && <button onClick={() => abrir(n.xml_path)} style={mini}>XML</button>}
                          {n.status === 'autorizada' && (!n.pdf_path || !n.xml_path) && <button disabled={ocupado} onClick={() => baixarArquivos(n)} style={mini}>Buscar arquivos</button>}
                          {n.status === 'autorizada' && <button onClick={() => whatsapp(n)} style={{ ...mini, color: '#16a34a' }}>WhatsApp</button>}
                          {['pendente_verificacao', 'enviando'].includes(n.status) && <button disabled={ocupado} onClick={() => conciliar(n)} style={{ ...mini, color: '#b45309', fontWeight: 700 }}>{ocupado ? '...' : 'Conciliar'}</button>}
                          {n.status === 'autorizada' && <button onClick={() => setCancelar({ nota: n, motivoCodigo: '1', motivo: '' })} style={{ ...mini, color: '#dc2626' }}>Cancelar</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={configAberta} onClose={() => setConfigAberta(false)} title="Configurar emissor de NFS-e">
        <ConfigEmissor onPronto={() => { setConfigAberta(false); verificarConexao() }} />
      </Modal>

      <Modal open={!!cancelar} onClose={() => setCancelar(null)} title="Cancelar NFS-e">
        {cancelar && (
          <form onSubmit={confirmarCancelamento}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
              NFS-e nº <b>{cancelar.nota.numero_nfse}</b> · {cancelar.nota.tomador_nome} · {fmtBRL(cancelar.nota.valor)}
              {cancelar.nota.ambiente === 'producao' && <div style={{ color: '#b91c1c', fontWeight: 600, marginTop: 4 }}>Esta nota é de PRODUÇÃO: o cancelamento tem efeito fiscal.</div>}
            </div>
            <Select label="Motivo" value={cancelar.motivoCodigo} onChange={e => setCancelar(c => ({ ...c, motivoCodigo: e.target.value }))}>
              <option value="1">Erro na emissão</option>
              <option value="2">Serviço não prestado</option>
              <option value="9">Outros</option>
            </Select>
            <Textarea label="Justificativa (mín. 15 caracteres)" value={cancelar.motivo} onChange={e => setCancelar(c => ({ ...c, motivo: e.target.value }))} rows={3} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setCancelar(null)}>Voltar</Btn>
              <Btn type="submit" variant="danger" disabled={trabalhando === cancelar.nota.id}>{trabalhando === cancelar.nota.id ? 'Cancelando...' : 'Cancelar nota'}</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

const mini = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: '#475569', fontSize: 11.5, fontWeight: 600 }
