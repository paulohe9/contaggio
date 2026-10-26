import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Btn, Modal, Input, Select, Textarea, Badge } from '../../components/ui'
import { emissor, configEmissor, salvarConfigEmissor, prestadorLembrado, lembrarPrestador, registrarNota, guardarArquivos, linkArquivo, enderecoPelaReceita, STATUS_NFSE } from '../../lib/emissor'
import { fmtBRL, hojeISO, waLink } from '../../lib/util'

const digitos = (s) => String(s || '').replace(/\D/g, '')

// ─── Configuração do emissor neste computador ───────────────────────
export function ConfigEmissor({ onPronto }) {
  const atual = configEmissor() || {}
  const [url, setUrl] = useState(atual.url || 'http://localhost:3333')
  const [token, setToken] = useState(atual.token || '')
  const [status, setStatus] = useState('')
  const [testando, setTestando] = useState(false)

  async function testar() {
    setTestando(true); setStatus('Testando...')
    salvarConfigEmissor({ url, token })
    try {
      const st = await emissor('/status')
      setStatus(`✅ Conectado ao emissor v${st.versao} · ${st.prestadores} emitente(s) cadastrado(s)`)
      setTimeout(() => onPronto && onPronto(), 700)
    } catch (e) { setStatus('❌ ' + e.message) }
    setTestando(false)
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12, lineHeight: 1.55 }}>
        A nota é emitida pelo <b>emissor de NFS-e do seu computador</b> (o certificado digital fica só nele). Com o emissor aberto,
        copie a chave em <b>Início › Integração com o Contaggio</b> e cole aqui. Esta configuração vale só para este computador.
      </div>
      <Input label="Endereço do emissor" value={url} onChange={e => setUrl(e.target.value)} />
      <Input label="Chave de pareamento" value={token} onChange={e => setToken(e.target.value)} placeholder="cole a chave copiada do emissor" />
      {status && <div style={{ fontSize: 12.5, marginBottom: 10, color: status.startsWith('✅') ? '#059669' : status.startsWith('❌') ? '#dc2626' : '#475569' }}>{status}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={testar} disabled={testando || !token.trim()}>{testando ? 'Testando...' : 'Salvar e testar conexão'}</Btn>
      </div>
    </div>
  )
}

// ─── Emissão a partir de um título a receber ────────────────────────
export default function EmitirNfse({ open, titulo, onClose, onEmitida }) {
  const { profile } = useAuth()
  const [etapa, setEtapa] = useState('carregando') // carregando | config | offline | form | resultado
  const [erroConexao, setErroConexao] = useState('')
  const [prestadores, setPrestadores] = useState([])
  const [prestadorId, setPrestadorId] = useState('')
  const [cliente, setCliente] = useState(null)
  const [tomadorCadastrado, setTomadorCadastrado] = useState(null)
  const [tomador, setTomador] = useState({ cpfCnpj: '', razaoSocial: '', email: '', endereco: null, resumoEndereco: '' })
  const [servicoId, setServicoId] = useState('')
  const [f, setF] = useState({ valor: '', competencia: hojeISO(), descricao: '' })
  const [conferencia, setConferencia] = useState(null)
  const [confirmaProducao, setConfirmaProducao] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [resultado, setResultado] = useState(null) // registro salvo

  useEffect(() => { if (open && titulo) iniciar() }, [open, titulo?.id])

  const prestador = prestadores.find(p => p.id === prestadorId)
  const producao = prestador?.ambiente === 'producao'
  const servicosDoPrestador = prestador?.servicos || []

  async function iniciar() {
    setErro(null); setConferencia(null); setResultado(null); setConfirmaProducao(false)
    setF({ valor: titulo.amount ?? '', competencia: hojeISO(), descricao: '' })
    if (!configEmissor()?.token) { setEtapa('config'); return }
    setEtapa('carregando')
    try {
      const lista = await emissor('/prestadores')
      setPrestadores(lista)
      if (!lista.length) { setErroConexao('O emissor não tem nenhum emitente cadastrado. Cadastre a Aggio (certificado A1) em Clientes no painel do emissor.'); setEtapa('offline'); return }
      const pid = lista.some(p => p.id === prestadorLembrado()) ? prestadorLembrado() : lista[0].id
      setPrestadorId(pid)
      const { data: cli } = titulo.client_id ? await supabase.from('clients').select('id, razao_social, cnpj, email, telefone').eq('id', titulo.client_id).single() : { data: null }
      setCliente(cli)
      await prepararTomador(pid, cli, lista)
      setEtapa('form')
    } catch (e) {
      if (e.tipo === 'config' || e.tipo === 'chave') { setEtapa('config'); return }
      setErroConexao(e.message); setEtapa('offline')
    }
  }

  async function prepararTomador(pid, cli, lista = prestadores) {
    setConferencia(null)
    const p = lista.find(x => x.id === pid)
    setServicoId(p?.servicoPadraoId || p?.servicos?.[0]?.id || '')
    const doc = digitos(cli?.cnpj)
    let achado = null
    if (doc) {
      try { achado = (await emissor(`/tomadores?prestador=${encodeURIComponent(pid)}`)).find(t => digitos(t.cpfCnpj) === doc) || null } catch { achado = null }
    }
    setTomadorCadastrado(achado)
    const base = { cpfCnpj: cli?.cnpj || '', razaoSocial: cli?.razao_social || '', email: cli?.email || '', endereco: null, resumoEndereco: '' }
    if (!achado && doc.length === 14) {
      const rec = await enderecoPelaReceita(doc)
      if (rec) { base.endereco = rec.endereco; base.resumoEndereco = rec.resumo; if (!base.email && rec.email) base.email = rec.email.toLowerCase() }
    }
    setTomador(base)
    const sv = (p?.servicos || []).find(s => s.id === (p?.servicoPadraoId || p?.servicos?.[0]?.id))
    setF(x => ({ ...x, descricao: x.descricao || sv?.descricao || titulo.description || '' }))
  }

  function corpoDaNota() {
    const base = { dataCompetencia: f.competencia }
    if (tomadorCadastrado) {
      return { ...base, tomadorId: tomadorCadastrado.id, valor: Number(f.valor), descricao: f.descricao || undefined, servicoId: servicoId || undefined }
    }
    const sv = servicosDoPrestador.find(s => s.id === servicoId) || servicosDoPrestador[0]
    if (!sv) throw new Error('O emitente não tem serviço cadastrado no emissor (Clientes › Serviços).')
    return {
      ...base,
      tomador: {
        cpfCnpj: digitos(tomador.cpfCnpj), razaoSocial: tomador.razaoSocial.trim(),
        email: tomador.email.trim() || undefined, fone: digitos(cliente?.telefone) || undefined,
        ...(tomador.endereco ? { endereco: tomador.endereco } : {}),
      },
      servico: {
        codigoTributacaoNacional: sv.codigoTributacaoNacional, codigoTributacaoMunicipal: sv.codigoTributacaoMunicipal || undefined,
        nbs: sv.nbs || undefined, descricao: f.descricao || sv.descricao, valor: Number(f.valor),
        retencaoIss: Boolean(sv.retencaoIss), ibscbs: sv.ibscbs,
      },
    }
  }

  async function conferir() {
    setErro(null); setConferencia(null); setEnviando(true)
    try {
      const r = await emissor(`/prestadores/${encodeURIComponent(prestadorId)}/notas/simular`, { method: 'POST', body: corpoDaNota() })
      setConferencia(r)
    } catch (e) { setErro({ mensagem: e.message, detalhes: e.dados?.detalhes }) }
    setEnviando(false)
  }

  async function emitir() {
    setErro(null); setEnviando(true)
    lembrarPrestador(prestadorId)
    const extra = { transaction_id: titulo.id, client_id: titulo.client_id || null, emitida_por: profile?.name || null }
    try {
      const nota = await emissor(`/prestadores/${encodeURIComponent(prestadorId)}/notas`, { method: 'POST', body: { ...corpoDaNota(), confirmarProducao: producao ? confirmaProducao : undefined } })
      let reg = await registrarNota(nota, extra)
      if (reg.status === 'autorizada') reg = await guardarArquivos(reg)
      setResultado(reg); setEtapa('resultado'); onEmitida && onEmitida(reg)
    } catch (e) {
      // 422 rejeitada / 502 pendente vêm com a nota no corpo: registramos mesmo assim
      const nota = e.dados?.nota || (e.dados?.idDps ? e.dados : null)
      if (nota?.idDps) {
        try {
          const reg = await registrarNota(nota, extra)
          setResultado({ ...reg, mensagem: e.message }); setEtapa('resultado'); onEmitida && onEmitida(reg)
        } catch (e2) { setErro({ mensagem: e.message + ' (e não consegui registrar no Contaggio: ' + e2.message + ')' }) }
      } else setErro({ mensagem: e.message, detalhes: e.dados?.detalhes })
    }
    setEnviando(false)
  }

  async function whatsapp() {
    const pdf = await linkArquivo(resultado.pdf_path)
    const msg = `Olá! Segue a NFS-e nº ${resultado.numero_nfse} da Aggio Contábil, no valor de ${fmtBRL(resultado.valor)}.${pdf ? `\n\nNota (PDF): ${pdf}` : ''}\n\nChave de acesso: ${resultado.chave_acesso}`
    const link = waLink(cliente?.telefone, msg)
    if (link) window.open(link, '_blank')
    else { try { await navigator.clipboard.writeText(msg) } catch { /* ignore */ } alert('Cliente sem telefone no cadastro. A mensagem foi copiada.') }
  }

  const titulo_ = etapa === 'config' ? 'Configurar emissor de NFS-e' : '🧾 Emitir NFS-e'

  return (
    <Modal open={open} onClose={onClose} title={titulo_} size="lg">
      {etapa === 'config' && <ConfigEmissor onPronto={iniciar} />}

      {etapa === 'carregando' && <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Conectando ao emissor...</div>}

      {etapa === 'offline' && (
        <div>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#991b1b' }}>{erroConexao}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => setEtapa('config')}>Configurar conexão</Btn>
            <Btn onClick={iniciar}>Tentar de novo</Btn>
          </div>
        </div>
      )}

      {etapa === 'form' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'end' }}>
            <Select label="Emitente (prestador)" value={prestadorId} onChange={e => { setPrestadorId(e.target.value); prepararTomador(e.target.value, cliente) }}>
              {prestadores.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.id}</option>)}
            </Select>
            <div style={{ marginBottom: 14 }}>
              {producao ? <Badge color="red">PRODUÇÃO · vale fiscalmente</Badge> : <Badge color="blue">Teste · sem validade fiscal</Badge>}
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tomador (cliente)</div>
            {tomadorCadastrado ? (
              <div style={{ fontSize: 13 }}>
                <b>{tomadorCadastrado.nome}</b> · {tomadorCadastrado.cpfCnpj}
                <div style={{ fontSize: 11.5, color: '#059669' }}>✓ Cadastrado no emissor — usa endereço, serviço e ajustes de lá</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                  <Input label="CPF / CNPJ" value={tomador.cpfCnpj} onChange={e => setTomador(t => ({ ...t, cpfCnpj: e.target.value }))} />
                  <Input label="Razão social / Nome" value={tomador.razaoSocial} onChange={e => setTomador(t => ({ ...t, razaoSocial: e.target.value }))} />
                </div>
                <Input label="E-mail (opcional)" value={tomador.email} onChange={e => setTomador(t => ({ ...t, email: e.target.value }))} />
                <div style={{ fontSize: 11.5, color: tomador.endereco ? '#475569' : '#94a3b8', marginTop: -6 }}>
                  {tomador.endereco ? `📍 Endereço pela Receita: ${tomador.resumoEndereco}` : 'Sem endereço (opcional, exceto com ISS retido).'}
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <Select label="Serviço" value={servicoId} onChange={e => { setServicoId(e.target.value); const sv = servicosDoPrestador.find(s => s.id === e.target.value); if (sv?.descricao) setF(x => ({ ...x, descricao: sv.descricao })) }}>
              {servicosDoPrestador.map(s => <option key={s.id} value={s.id}>{s.apelido || s.descricao?.slice(0, 50) || s.codigoTributacaoNacional} ({s.codigoTributacaoNacional})</option>)}
            </Select>
            <Input label="Valor (R$)" type="number" step="0.01" min="0.01" value={f.valor} onChange={e => setF(x => ({ ...x, valor: e.target.value }))} />
            <Input label="Competência" type="date" value={f.competencia} onChange={e => setF(x => ({ ...x, competencia: e.target.value }))} />
          </div>
          <Textarea label="Descrição do serviço (sai na nota)" value={f.descricao} onChange={e => setF(x => ({ ...x, descricao: e.target.value }))} rows={3} />

          {conferencia && (
            <div style={{ borderRadius: 10, padding: '9px 12px', fontSize: 12.5, marginBottom: 10, background: conferencia.valida ? '#f0fdf4' : '#fef2f2', color: conferencia.valida ? '#065f46' : '#991b1b', border: `1px solid ${conferencia.valida ? '#bbf7d0' : '#fecaca'}` }}>
              {conferencia.valida ? `✅ Nota conferida: montada, assinada e válida no esquema oficial${conferencia.xsdPulado ? ' (validação de esquema indisponível neste PC)' : ''}. Nada foi enviado ainda.` : '❌ A nota não passou na validação:'}
              {!conferencia.valida && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{(conferencia.errosXsd || []).slice(0, 6).map((x, i) => <li key={i}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>)}</ul>}
            </div>
          )}
          {erro && (
            <div style={{ borderRadius: 10, padding: '9px 12px', fontSize: 12.5, marginBottom: 10, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
              {erro.mensagem}
              {Array.isArray(erro.detalhes) && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{erro.detalhes.slice(0, 8).map((x, i) => <li key={i}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>)}</ul>}
            </div>
          )}
          {producao && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#991b1b', background: '#fef2f2', borderRadius: 10, padding: '8px 12px', marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={confirmaProducao} onChange={e => setConfirmaProducao(e.target.checked)} />
              Confirmo a emissão em PRODUÇÃO de {fmtBRL(f.valor)} para {tomadorCadastrado?.nome || tomador.razaoSocial}
            </label>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={conferir} disabled={enviando}>Conferir (não envia)</Btn>
              <Btn variant="success" onClick={emitir} disabled={enviando || !(Number(f.valor) > 0) || (producao && !confirmaProducao)}>{enviando ? 'Enviando à Sefin...' : '🧾 Emitir nota'}</Btn>
            </div>
          </div>
        </div>
      )}

      {etapa === 'resultado' && resultado && (() => {
        const st = STATUS_NFSE[resultado.status] || { label: resultado.status, cor: 'slate' }
        const ok = resultado.status === 'autorizada'
        return (
          <div>
            <div style={{ textAlign: 'center', padding: '6px 0 14px' }}>
              <div style={{ fontSize: 38 }}>{ok ? '✅' : resultado.status === 'pendente_verificacao' ? '⏳' : '⚠️'}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{ok ? `NFS-e nº ${resultado.numero_nfse} autorizada` : 'Nota não autorizada'}</div>
              <div style={{ marginTop: 6 }}><Badge color={st.cor}>{st.label}</Badge></div>
              {resultado.mensagem && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 8 }}>{resultado.mensagem}</div>}
            </div>
            {(resultado.erros || []).length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#991b1b', marginBottom: 12 }}>
                {resultado.erros.map((x, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <b>{x.codigo || x.Codigo}</b> — {x.descricao || x.Descricao}
                    {x.dica && <div style={{ color: '#7f1d1d' }}>O que fazer: {x.dica}</div>}
                  </div>
                ))}
              </div>
            )}
            {ok && <div style={{ fontSize: 12, color: '#64748b', wordBreak: 'break-all', textAlign: 'center', marginBottom: 12 }}>Chave: {resultado.chave_acesso}</div>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {ok && resultado.pdf_path && <Btn variant="secondary" onClick={async () => window.open(await linkArquivo(resultado.pdf_path, 1), '_blank')}>📄 Abrir PDF</Btn>}
              {ok && <Btn variant="success" onClick={whatsapp}>Enviar no WhatsApp</Btn>}
              <Btn onClick={onClose}>Fechar</Btn>
            </div>
            {resultado.status === 'pendente_verificacao' && (
              <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>
                A Sefin não respondeu. <b>Não emita de novo</b>: use "Conciliar" em Financeiro › Notas fiscais para descobrir se a nota saiu.
              </div>
            )}
          </div>
        )
      })()}
    </Modal>
  )
}
