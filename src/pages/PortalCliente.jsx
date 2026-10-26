import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const G = '#C9960A'
const LIMITE_MB = 25

function fmtData(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function chamar(body) {
  const { data, error } = await supabase.functions.invoke('portal-cliente', { body })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error || 'Erro inesperado')
  return data
}

export default function PortalCliente() {
  const { token } = useParams()
  const [estado, setEstado] = useState('loading') // loading | ok | erro
  const [cliente, setCliente] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [enviando, setEnviando] = useState({}) // { [pedidoId]: 'texto de progresso' }
  const [erroEnvio, setErroEnvio] = useState({})

  useEffect(() => { carregar() }, [token])

  async function carregar() {
    try {
      const r = await chamar({ action: 'get', token })
      setCliente(r.cliente)
      setPedidos(r.pedidos)
      setEstado('ok')
    } catch {
      setEstado('erro')
    }
  }

  async function enviarArquivos(pedido, fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const grande = files.find(f => f.size > LIMITE_MB * 1024 * 1024)
    if (grande) { setErroEnvio(e => ({ ...e, [pedido.id]: `"${grande.name}" passa de ${LIMITE_MB} MB.` })); return }
    setErroEnvio(e => ({ ...e, [pedido.id]: null }))
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        setEnviando(s => ({ ...s, [pedido.id]: `Enviando ${i + 1} de ${files.length}...` }))
        const up = await chamar({ action: 'upload-url', token, request_id: pedido.id, filename: f.name })
        const { error } = await supabase.storage.from('client-documents').uploadToSignedUrl(up.path, up.token, f, { contentType: f.type || 'application/octet-stream' })
        if (error) throw new Error(error.message)
        await chamar({ action: 'confirm', token, request_id: pedido.id, path: up.path, nome: f.name, tamanho: f.size })
      }
      await carregar()
    } catch (err) {
      setErroEnvio(e => ({ ...e, [pedido.id]: 'Não foi possível enviar: ' + err.message }))
    } finally {
      setEnviando(s => ({ ...s, [pedido.id]: null }))
    }
  }

  if (estado === 'loading') return <Tela><div style={{ textAlign: 'center', color: '#94a3b8', padding: 60 }}>Carregando...</div></Tela>
  if (estado === 'erro') return (
    <Tela>
      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ fontSize: 44 }}>🔒</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#1e293b', marginTop: 10 }}>Link inválido ou expirado</div>
        <div style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>Peça um novo link à Aggio Contábil.</div>
      </div>
    </Tela>
  )

  const hoje = hojeISO()
  const aFazer = pedidos.filter(p => p.status === 'pendente' || p.status === 'recusado')
  const entregues = pedidos.filter(p => p.status === 'enviado' || p.status === 'aprovado')
  const total = pedidos.length
  const pct = total ? Math.round(entregues.length / total * 100) : 100

  return (
    <Tela>
      <div style={{ padding: '22px 22px 6px' }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>Olá,</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{cliente?.razao_social}</div>
        <div style={{ marginTop: 14, background: '#f1f5f9', borderRadius: 99, height: 10, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${G}, #E8B000)`, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 12.5, color: '#475569', marginTop: 6 }}>
          {aFazer.length === 0 ? '🎉 Tudo entregue! Obrigado.' : <><b>{aFazer.length}</b> documento(s) pendente(s) · {entregues.length} de {total} entregues</>}
        </div>
      </div>

      {aFazer.length > 0 && (
        <Secao titulo="📌 Pendentes">
          {aFazer.map(p => (
            <ItemPendente key={p.id} p={p} hoje={hoje} progresso={enviando[p.id]} erro={erroEnvio[p.id]} onFiles={files => enviarArquivos(p, files)} />
          ))}
        </Secao>
      )}

      {entregues.length > 0 && (
        <Secao titulo="✅ Entregues">
          {entregues.map(p => (
            <div key={p.id} style={{ padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{p.titulo}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.arquivos.length} arquivo(s) enviado(s)</div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', background: p.status === 'aprovado' ? '#dcfce7' : '#dbeafe', color: p.status === 'aprovado' ? '#166534' : '#1e40af' }}>
                {p.status === 'aprovado' ? 'Conferido' : 'Em análise'}
              </span>
            </div>
          ))}
        </Secao>
      )}

      <div style={{ textAlign: 'center', fontSize: 11.5, color: '#94a3b8', padding: '10px 20px 26px' }}>
        Os arquivos vão direto e com segurança para a Aggio Contábil. Dúvidas? Fale com a gente no WhatsApp.
      </div>
    </Tela>
  )
}

function ItemPendente({ p, hoje, progresso, erro, onFiles }) {
  const ref = useRef(null)
  const atrasado = p.prazo && p.prazo < hoje
  return (
    <div style={{ padding: '14px', border: `1.5px solid ${p.status === 'recusado' ? '#fecaca' : '#e2e8f0'}`, borderRadius: 14, marginBottom: 10, background: 'white' }}>
      <div style={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a' }}>{p.titulo}</div>
      <div style={{ fontSize: 12, color: atrasado ? '#dc2626' : '#64748b', marginTop: 2, fontWeight: atrasado ? 700 : 400 }}>
        {p.competencia && `Referente a ${p.competencia.slice(5)}/${p.competencia.slice(0, 4)} · `}
        {p.prazo && `Enviar até ${fmtData(p.prazo)}${atrasado ? ' (atrasado)' : ''}`}
      </div>
      {p.descricao && <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>{p.descricao}</div>}
      {p.status === 'recusado' && (
        <div style={{ fontSize: 12.5, color: '#b91c1c', background: '#fef2f2', borderRadius: 8, padding: '7px 10px', marginTop: 8 }}>
          ⚠️ Precisamos que envie de novo: {p.motivo_recusa || 'arquivo com problema'}
        </div>
      )}
      <input ref={ref} type="file" multiple style={{ display: 'none' }} onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
      <button disabled={!!progresso} onClick={() => ref.current?.click()} style={{
        marginTop: 10, width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: progresso ? 'wait' : 'pointer',
        background: progresso ? '#e2e8f0' : `linear-gradient(135deg, ${G}, #8a6500)`, color: progresso ? '#475569' : 'white', fontWeight: 800, fontSize: 14,
      }}>
        {progresso || '📎 Enviar arquivo(s)'}
      </button>
      {p.arquivos.length > 0 && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>Já enviados: {p.arquivos.map(a => a.nome).join(', ')}</div>}
      {erro && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{erro}</div>}
    </div>
  )
}

function Secao({ titulo, children }) {
  return (
    <div style={{ padding: '14px 18px 4px' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{titulo}</div>
      {children}
    </div>
  )
}

function Tela({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', justifyContent: 'center', padding: '24px 12px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ background: '#0a0b0d', borderRadius: '18px 18px 0 0', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: G, fontSize: 22, fontWeight: 900, letterSpacing: '0.06em' }}>AGGIO</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Contábil · Portal de documentos</div>
        </div>
        <div style={{ background: 'white', borderRadius: '0 0 18px 18px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
