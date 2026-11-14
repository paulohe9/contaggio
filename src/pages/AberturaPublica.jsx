import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const G = '#C9960A'
const LIMITE_MB = 25
export const DOCS_ABERTURA = [
  { tipo: 'rg_cpf', titulo: 'RG e CPF ou CNH', obrigatorio: true },
  { tipo: 'comp_residencia', titulo: 'Comprovante de residência atualizado', obrigatorio: true },
  { tipo: 'titulo_irpf', titulo: 'Título de eleitor ou IRPF', obrigatorio: true },
  { tipo: 'certidao', titulo: 'Certidão de nascimento ou casamento', obrigatorio: true },
  { tipo: 'cert_digital', titulo: 'Certificado Digital Pessoa Física (se tiver)', obrigatorio: false },
  { tipo: 'iptu', titulo: 'IPTU de onde irá funcionar a empresa', obrigatorio: true },
]
const NATUREZAS = ['Sociedade Limitada (LTDA)', 'Sociedade Limitada Unipessoal (SLU)', 'Empresário Individual (EI)', 'MEI', 'Sociedade Simples', 'Outra']
const ESTADOS = ['Solteiro', 'Casado (total de bens)', 'Casado (parcial de bens)', 'Viúvo', 'Divorciado']
const socioVazio = () => ({ nome: '', estado_civil: '', percentual: '', telefone: '', email: '' })

async function chamar(body) {
  const { data, error } = await supabase.functions.invoke('abertura-publica', { body })
  if (error) throw new Error('Não foi possível conectar. Tente novamente.')
  if (!data?.ok) throw new Error(data?.error || 'Erro inesperado')
  return data
}

const inp = { width: '100%', padding: '11px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', background: 'white', outline: 'none', fontFamily: 'inherit' }

function Campo({ label, ajuda, obrig, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{obrig && <span style={{ color: '#dc2626' }}>* </span>}{label}</div>
      {ajuda && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 5 }}>{ajuda}</div>}
      <div style={{ marginTop: ajuda ? 0 : 5 }}>{children}</div>
    </div>
  )
}
function SimNao({ valor, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[['sim', 'Sim'], ['nao', 'Não']].map(([v, l]) => (
        <button type="button" key={v} onClick={() => onChange(v)} style={{
          flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
          border: `1.5px solid ${valor === v ? G : '#e2e8f0'}`, background: valor === v ? '#fef9e7' : 'white', color: valor === v ? '#7a5a00' : '#475569',
        }}>{l}</button>
      ))}
    </div>
  )
}

export default function AberturaPublica() {
  const { token } = useParams() // com token = reenvio/complemento; sem token = novo pedido
  const [estado, setEstado] = useState(token ? 'loading' : 'form') // loading | form | enviando | pronto | erro
  const [f, setF] = useState({ nome_solicitante: '', email: '', telefone: '', natureza_juridica: '', capital_social: '', razao_social: '', nome_fantasia: '', mais_de_um_socio: '', socio_funcionario_publico: '', socio_outra_empresa: '', atividades: '', website: '' })
  const [socios, setSocios] = useState([socioVazio()])
  const [arquivos, setArquivos] = useState({}) // { tipo: File[] }
  const [enviados, setEnviados] = useState([]) // já no servidor (reenvio)
  const [tk, setTk] = useState(token || null)
  const [erro, setErro] = useState('')
  const [progresso, setProgresso] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  useEffect(() => {
    if (!token) return
    chamar({ action: 'get', token }).then(r => {
      const a = r.abertura
      setF(s => ({ ...s, ...Object.fromEntries(Object.keys(s).filter(k => a[k] != null && k !== 'website').map(k => [k, typeof a[k] === 'boolean' ? (a[k] ? 'sim' : 'nao') : a[k]])) }))
      setSocios(a.socios?.length ? a.socios : [socioVazio()])
      setEnviados(r.arquivos)
      setEstado('form')
    }).catch(() => setEstado('erro'))
  }, [token])

  function addArq(tipo, lista) {
    const novos = Array.from(lista || [])
    const grande = novos.find(x => x.size > LIMITE_MB * 1024 * 1024)
    if (grande) { setErro(`"${grande.name}" passa de ${LIMITE_MB} MB.`); return }
    setErro('')
    setArquivos(a => ({ ...a, [tipo]: [...(a[tipo] || []), ...novos] }))
  }
  const rmArq = (tipo, i) => setArquivos(a => ({ ...a, [tipo]: a[tipo].filter((_, j) => j !== i) }))

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    const falta = []
    if (!f.razao_social.trim()) falta.push('Razão social')
    if (!socios[0].nome.trim()) falta.push('Nome do sócio 1')
    if (!socios[0].estado_civil) falta.push('Estado civil')
    if (!socios[0].percentual.trim()) falta.push('Percentual do capital')
    if (!f.mais_de_um_socio) falta.push('Possui mais de um sócio?')
    if (!f.atividades.trim()) falta.push('Descrição de atividades')
    if (!f.socio_funcionario_publico) falta.push('Algum dos sócios é funcionário público?')
    if (!f.socio_outra_empresa) falta.push('Sócio tem participação em outra empresa?')
    const total = Object.values(arquivos).flat().length + enviados.length
    if (!total) falta.push('Documentos anexados')
    if (falta.length) { setErro('Preencha: ' + falta.join(', ') + '.'); return }

    setEstado('enviando')
    try {
      const dados = { ...f, socios: f.mais_de_um_socio === 'sim' ? socios : socios.slice(0, 1) }
      delete dados.website
      let t = tk
      if (!t) {
        const r = await chamar({ action: 'criar', dados, website: f.website })
        t = r.token; setTk(t)
      } else {
        await chamar({ action: 'atualizar', token: t, dados })
      }
      const lista = Object.entries(arquivos).flatMap(([tipo, fs]) => fs.map(file => ({ tipo, file })))
      for (let i = 0; i < lista.length; i++) {
        const { tipo, file } = lista[i]
        setProgresso(`Enviando arquivo ${i + 1} de ${lista.length}...`)
        const up = await chamar({ action: 'upload-url', token: t, tipo, filename: file.name })
        const { error } = await supabase.storage.from('client-documents').uploadToSignedUrl(up.path, up.token, file, { contentType: file.type || 'application/octet-stream' })
        if (error) throw new Error(error.message)
        await chamar({ action: 'confirm', token: t, tipo, path: up.path, nome: file.name, tamanho: file.size })
      }
      setProgresso(''); setEstado('pronto')
    } catch (err) {
      setProgresso(''); setErro(err.message || 'Não foi possível enviar.'); setEstado('form')
    }
  }

  const linkReenvio = tk ? `${window.location.origin}/abertura/${tk}` : ''

  if (estado === 'loading') return <Tela><div style={{ textAlign: 'center', color: '#94a3b8', padding: 60 }}>Carregando...</div></Tela>
  if (estado === 'erro') return <Tela><div style={{ textAlign: 'center', padding: '50px 20px' }}><div style={{ fontSize: 44 }}>🔒</div><div style={{ fontWeight: 800, fontSize: 18, color: '#1e293b', marginTop: 10 }}>Link inválido</div><div style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>Peça um novo link à Aggio Contábil.</div></div></Tela>
  if (estado === 'pronto') return (
    <Tela>
      <div style={{ textAlign: 'center', padding: '44px 22px' }}>
        <div style={{ fontSize: 50 }}>✅</div>
        <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a', marginTop: 8 }}>Recebemos sua solicitação!</div>
        <div style={{ color: '#475569', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>Vamos analisar os dados e os documentos e entrar em contato. Se faltar algum documento, você pode enviar depois pelo mesmo link:</div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#f1f5f9', borderRadius: 10, fontSize: 12, wordBreak: 'break-all', color: '#334155' }}>{linkReenvio}</div>
        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>Guarde este link.</div>
      </div>
    </Tela>
  )

  const ocupado = estado === 'enviando'
  return (
    <Tela>
      <form onSubmit={enviar} style={{ padding: '22px 22px 26px' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>Abertura de Empresas</div>
        <div style={{ fontSize: 13, color: '#64748b', margin: '4px 0 18px' }}>Preencha os dados e anexe os documentos. Os campos com * são obrigatórios.</div>

        <Campo label="Nome do Solicitante" ajuda="Nome completo do cliente"><input style={inp} value={f.nome_solicitante} onChange={e => set('nome_solicitante', e.target.value)} /></Campo>
        <Campo label="Email do Cliente" ajuda="Email para contato"><input style={inp} type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Campo>
        <Campo label="Telefone do Cliente" ajuda="Telefone para contato (com DDD)"><input style={inp} inputMode="tel" placeholder="(99) 99999-9999" value={f.telefone} onChange={e => set('telefone', e.target.value)} /></Campo>
        <Campo label="Natureza Jurídica" ajuda="Tipo de empresa a ser aberta">
          <select style={inp} value={f.natureza_juridica} onChange={e => set('natureza_juridica', e.target.value)}>
            <option value="">Escolha uma opção</option>{NATUREZAS.map(n => <option key={n}>{n}</option>)}
          </select>
        </Campo>
        <Campo label="Capital Social" ajuda="Valor de aporte na empresa"><input style={inp} inputMode="decimal" placeholder="R$ 0,00" value={f.capital_social} onChange={e => set('capital_social', e.target.value)} /></Campo>
        <Campo label="Razão Social" obrig><input style={inp} value={f.razao_social} onChange={e => set('razao_social', e.target.value)} /></Campo>
        <Campo label="Nome Fantasia"><input style={inp} value={f.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} /></Campo>

        <SecTitulo>Sócio 1</SecTitulo>
        <BlocoSocio s={socios[0]} onChange={v => setSocios(l => l.map((x, i) => i === 0 ? v : x))} obrig />
        <Campo label="Possui mais de um sócio?" obrig><SimNao valor={f.mais_de_um_socio} onChange={v => set('mais_de_um_socio', v)} /></Campo>
        {f.mais_de_um_socio === 'sim' && (
          <>
            {socios.slice(1).map((s, k) => (
              <div key={k}>
                <SecTitulo>Sócio {k + 2}{' '}<button type="button" onClick={() => setSocios(l => l.filter((_, i) => i !== k + 1))} style={{ marginLeft: 8, fontSize: 11, border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}>remover</button></SecTitulo>
                <BlocoSocio s={s} onChange={v => setSocios(l => l.map((x, i) => i === k + 1 ? v : x))} />
              </div>
            ))}
            <button type="button" onClick={() => setSocios(l => [...l, socioVazio()])} style={{ marginBottom: 16, padding: '9px 14px', borderRadius: 10, border: '1.5px dashed #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>+ Adicionar sócio</button>
          </>
        )}

        <Campo label="Descrição de Atividades" ajuda="Quais atividades a empresa irá exercer." obrig><textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }} value={f.atividades} onChange={e => set('atividades', e.target.value)} /></Campo>
        <Campo label="Algum dos sócios é funcionário público?" obrig><SimNao valor={f.socio_funcionario_publico} onChange={v => set('socio_funcionario_publico', v)} /></Campo>
        <Campo label="Sócio tem participação em outra empresa?" obrig><SimNao valor={f.socio_outra_empresa} onChange={v => set('socio_outra_empresa', v)} /></Campo>

        <SecTitulo>Documentos anexados</SecTitulo>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 10 }}>Documentos necessários para abertura. Se houver mais de um sócio, envie os de todos.</div>
        {DOCS_ABERTURA.map(d => (
          <DocUpload key={d.tipo} d={d} lista={arquivos[d.tipo] || []} jaEnviados={enviados.filter(x => x.tipo === d.tipo)} onAdd={l => addArq(d.tipo, l)} onRemove={i => rmArq(d.tipo, i)} />
        ))}

        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={e => set('website', e.target.value)} style={{ position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true" />
        {erro && <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>{erro}</div>}
        <button disabled={ocupado} type="submit" style={{ width: '100%', padding: 15, borderRadius: 12, border: 'none', cursor: ocupado ? 'wait' : 'pointer', background: ocupado ? '#e2e8f0' : `linear-gradient(135deg, ${G}, #8a6500)`, color: ocupado ? '#475569' : 'white', fontWeight: 800, fontSize: 15 }}>
          {ocupado ? (progresso || 'Enviando...') : (tk ? 'Salvar e enviar documentos' : 'Criar novo card')}
        </button>
      </form>
    </Tela>
  )
}

function BlocoSocio({ s, onChange, obrig }) {
  const u = (k, v) => onChange({ ...s, [k]: v })
  return (
    <>
      <Campo label="Nome do Sócio" obrig={obrig}><input style={inp} value={s.nome} onChange={e => u('nome', e.target.value)} /></Campo>
      <Campo label="Estado civil" obrig={obrig}>
        <select style={inp} value={s.estado_civil} onChange={e => u('estado_civil', e.target.value)}>
          <option value="">Escolha uma opção</option>{ESTADOS.map(n => <option key={n}>{n}</option>)}
        </select>
      </Campo>
      <Campo label="Percentual do capital (%)" obrig={obrig}><input style={inp} inputMode="decimal" value={s.percentual} onChange={e => u('percentual', e.target.value)} /></Campo>
      <Campo label="Número de Telefone do Sócio"><input style={inp} inputMode="tel" value={s.telefone} onChange={e => u('telefone', e.target.value)} /></Campo>
      <Campo label="E-mail do Sócio"><input style={inp} type="email" value={s.email} onChange={e => u('email', e.target.value)} /></Campo>
    </>
  )
}

function DocUpload({ d, lista, jaEnviados, onAdd, onRemove }) {
  const ref = useRef(null)
  const ok = lista.length + jaEnviados.length > 0
  return (
    <div style={{ padding: 12, border: `1.5px solid ${ok ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 12, marginBottom: 9, background: ok ? '#f0fdf4' : 'white' }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{ok ? '✅ ' : '📄 '}{d.titulo}{!d.obrigatorio && <span style={{ color: '#94a3b8', fontWeight: 500 }}> · opcional</span>}</div>
      {jaEnviados.map(a => (
        <div key={a.id} style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
          {a.nome} · <b>{a.status === 'aprovado' ? 'conferido' : a.status === 'recusado' ? 'precisa reenviar' : 'em análise'}</b>
          {a.status === 'recusado' && a.motivo_recusa && <span style={{ color: '#b91c1c' }}> — {a.motivo_recusa}</span>}
        </div>
      ))}
      {lista.map((x, i) => (
        <div key={i} style={{ fontSize: 12, color: '#334155', marginTop: 4, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {x.name}</span>
          <button type="button" onClick={() => onRemove(i)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>remover</button>
        </div>
      ))}
      <input ref={ref} type="file" multiple accept="image/*,application/pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { onAdd(e.target.files); e.target.value = '' }} />
      <button type="button" onClick={() => ref.current?.click()} style={{ marginTop: 8, padding: '8px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#475569' }}>
        {ok ? '+ Adicionar outro arquivo' : 'Adicionar arquivo'}
      </button>
    </div>
  )
}

function SecTitulo({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '20px 0 10px', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>{children}</div>
}

function Tela({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', justifyContent: 'center', padding: '24px 12px', position: 'relative' }}>
      <div style={{ width: '100%', maxWidth: 580 }}>
        <div style={{ background: '#0a0b0d', borderRadius: '18px 18px 0 0', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: G, fontSize: 22, fontWeight: 900, letterSpacing: '0.06em' }}>AGGIO</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Contábil · Abertura de empresa</div>
        </div>
        <div style={{ background: 'white', borderRadius: '0 0 18px 18px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>{children}</div>
      </div>
    </div>
  )
}
