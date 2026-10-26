import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { textoParaHtml } from '../../lib/funilPadrao'
import { waLink } from '../../lib/util'

const G = '#C9960A'

export default function DocumentoComercial() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState(null)
  const [lead, setLead] = useState(null)
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    const { data } = await supabase.from('crm_documentos').select('*').eq('id', id).single()
    if (!data) { setStatus('Documento não encontrado.'); return }
    setDoc(data); setTexto(data.conteudo)
    const { data: l } = await supabase.from('crm_leads').select('id, nome, telefone, funil').eq('id', data.lead_id).single()
    setLead(l)
  }

  async function salvar() {
    setStatus('Salvando...')
    const { error } = await supabase.from('crm_documentos').update({ conteudo: texto }).eq('id', id)
    if (error) { setStatus('Erro: ' + error.message); return }
    setDoc(d => ({ ...d, conteudo: texto })); setEditando(false); setStatus('✅ Salvo')
    setTimeout(() => setStatus(''), 2000)
  }

  const voltar = () => navigate(lead ? `/comercial/${lead.funil}` : '/')
  const nomeTipo = doc?.tipo === 'contrato' ? 'o contrato' : 'a proposta'
  const wa = lead?.telefone ? waLink(lead.telefone, `Olá, ${(lead.nome || '').split(' ')[0]}! Segue ${nomeTipo} da Aggio Contábil. Qualquer dúvida, estou à disposição.`) : null

  if (!doc) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{status || 'Carregando...'}</div>

  return (
    <div style={{ minHeight: '100vh', background: '#e5e7eb' }}>
      <style>{`
        .doc-contaggio h1 { font-size: 19px; text-align: center; margin: 0 0 18px; letter-spacing: 0.02em; }
        .doc-contaggio h2 { font-size: 14px; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: 0.03em; }
        .doc-contaggio p { margin: 0 0 10px; text-align: justify; }
        .doc-contaggio ul { margin: 0 0 10px; padding-left: 22px; }
        .doc-contaggio hr { border: none; border-top: 1px solid #111; width: 60%; margin: 46px auto 4px; }
        .doc-contaggio hr + p { text-align: center; }
        @page { size: A4; margin: 18mm 16mm; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .folha { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; min-height: 0 !important; }
          .tela { background: white !important; padding: 0 !important; }
        }
      `}</style>

      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0f172a', color: 'white', padding: '10px 18px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={voltar} style={btn}>← Voltar ao funil</button>
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 200 }}>{doc.titulo}</div>
        {status && <span style={{ fontSize: 12, color: '#a7f3d0' }}>{status}</span>}
        {editando ? (
          <>
            <button onClick={() => { setTexto(doc.conteudo); setEditando(false) }} style={btn}>Cancelar</button>
            <button onClick={salvar} style={{ ...btn, background: '#10b981', borderColor: '#10b981' }}>Salvar texto</button>
          </>
        ) : <button onClick={() => setEditando(true)} style={btn}>✏️ Ajustar texto</button>}
        <button onClick={() => window.print()} style={{ ...btn, background: G, borderColor: G }}>🖨 Imprimir / Salvar PDF</button>
        {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ ...btn, background: '#16a34a', borderColor: '#16a34a', textDecoration: 'none' }}>WhatsApp</a>}
      </div>

      {editando && (
        <div className="no-print" style={{ maxWidth: 820, margin: '16px auto 0', padding: '0 12px' }}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)}
            style={{ width: '100%', minHeight: 300, padding: 14, borderRadius: 12, border: '1px solid #cbd5e1', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, lineHeight: 1.55, boxSizing: 'border-box' }} />
        </div>
      )}

      <div className="tela" style={{ padding: '24px 12px 60px' }}>
        <div className="folha" style={{ background: 'white', width: '210mm', maxWidth: '100%', minHeight: '297mm', margin: '0 auto', padding: '20mm 18mm', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 13, lineHeight: 1.6, color: '#111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${G}`, paddingBottom: 10, marginBottom: 24 }}>
            <div style={{ fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: G, letterSpacing: '0.08em' }}>AGGIO</div>
              <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#555' }}>CONTÁBIL</div>
            </div>
            <div style={{ fontSize: 10, color: '#666', fontFamily: 'system-ui, sans-serif', textAlign: 'right' }}>
              {doc.tipo === 'contrato' ? 'Contrato de prestação de serviços' : 'Proposta comercial'}
            </div>
          </div>
          <div className="doc-contaggio" dangerouslySetInnerHTML={{ __html: textoParaHtml(editando ? texto : doc.conteudo) }} />
        </div>
      </div>
    </div>
  )
}

const btn = { background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600 }
