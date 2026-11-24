import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { textoParaHtml } from '../../lib/funilPadrao'
import { CONTRATADA, camposIniciais, textoContrato } from '../../lib/contratoAggio'

const G = '#C9960A'
const btn = { background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600 }

const CAMPOS = [
  ['Contratante', [['contratante_nome', 'Nome / Razão social'], ['contratante_documento_tipo', 'Tipo (CPF/CNPJ)'], ['contratante_documento', 'CPF / CNPJ'], ['contratante_endereco', 'Endereço', 'wide'], ['contratante_representante', 'Representante (se PJ)', 'wide'], ['contratante_enquadramento', 'Enquadramento', 'wide']]],
  ['Serviços (um por linha)', [['lista_servicos', '', 'area']]],
  ['Honorários', [['valor_honorarios', 'Valor mensal (R$)'], ['dia_vencimento', 'Dia do vencimento'], ['multa_atraso_percentual', 'Multa por atraso (%)'], ['juros_atraso_percentual', 'Juros ao mês (%)'], ['mes_reajuste', 'Mês do reajuste'], ['dia_envio_folha', 'Dia limite folha']]],
  ['Vigência e rescisão', [['vigencia_inicio', 'Início', 'date'], ['vigencia_fim', 'Fim', 'date'], ['aviso_previo_dias', 'Aviso prévio (dias)'], ['inadimplencia_dias', 'Inadimplência (dias)'], ['multa_compensatoria', 'Multa rescisão sem motivo', 'wide'], ['multa_descumprimento', 'Multa por descumprimento', 'wide']]],
  ['Assinatura', [['cidade_assinatura', 'Cidade'], ['data_assinatura', 'Data (por extenso)']]],
]

export default function ContratoCliente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [cliente, setCliente] = useState(null)
  const [f, setF] = useState(null)
  const [manual, setManual] = useState(null) // texto editado à mão
  const [status, setStatus] = useState('')
  const mexeu = useRef(false)

  useEffect(() => {
    supabase.from('clients').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) { setStatus('Cliente não encontrado.'); return }
      setCliente(data); setF(camposIniciais(data))
    })
  }, [id])

  const gerado = useMemo(() => (f ? textoContrato(f) : ''), [f])
  const texto = manual ?? gerado
  const html = useMemo(() => textoParaHtml(texto), [texto])
  const nomeArquivo = `Contrato - ${(cliente?.razao_social || 'cliente').replace(/[^\w\s-]/g, '').trim()}`

  async function registrar(acao) {
    await supabase.from('client_observations').insert({ client_id: id, text: `Contrato de prestação de serviços gerado (${acao}). Honorário: R$ ${f.valor_honorarios || '—'}.`, author: profile?.name || 'Sistema' })
  }
  function imprimir() { registrar('PDF/impressão'); const t = document.title; document.title = nomeArquivo; window.print(); setTimeout(() => { document.title = t }, 800) }
  function baixarWord() {
    registrar('Word')
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>
      @page { size: 21cm 29.7cm; margin: 4.2cm 2.4cm 3cm 2.4cm }
      body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.25 } p { margin: 0 0 8pt; text-align: justify } h1 { font-size: 11pt; text-align: center } h2 { font-size: 11pt; font-weight: normal; margin: 10pt 0 4pt }
      ul { margin: 0 0 8pt } hr { width: 55%; margin: 34pt 0 2pt; text-align: left }
    </style></head><body><div style="text-align:center;font-family:Georgia,serif"><div style="font-size:30pt;letter-spacing:6pt;color:#111">AGGIO</div><div style="font-size:8pt;letter-spacing:7pt;color:#555">CONTÁBIL</div><div style="height:2pt;background:#C9960A;margin:6pt auto 14pt;width:70%"></div></div>${html}
    <p style="text-align:center;font-size:8pt;color:#555">${CONTRATADA.fantasia} | CNPJ ${CONTRATADA.cnpj} | WhatsApp ${CONTRATADA.whatsapp} | ${CONTRATADA.instagram} | ${CONTRATADA.email}</p></body></html>`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿', doc], { type: 'application/msword' }))
    a.download = nomeArquivo + '.doc'; a.click()
  }

  if (!f) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{status || 'Carregando...'}</div>
  const inp = { width: '100%', padding: '7px 9px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100vh', background: '#e5e7eb' }}>
      <style>{`
        .ct-doc h1 { font-size: 14px; text-align: center; margin: 0 0 16px }
        .ct-doc h2 { font-size: 13px; font-weight: 400; margin: 12px 0 4px }
        .ct-doc p { margin: 0 0 8px; text-align: justify }
        .ct-doc ul { margin: 0 0 8px; padding-left: 22px }
        .ct-doc hr { border: none; border-top: 1px solid #111; width: 55%; margin: 38px 0 3px }
        .ct-head { position: absolute; top: 12mm; left: 0; right: 0; text-align: center }
        .ct-foot { position: absolute; bottom: 10mm; left: 18mm; right: 18mm; font: 9px Arial, sans-serif; color: #333; border-top: 1px dotted ${G}; padding-top: 6px }
        @page { size: A4; margin: 46mm 22mm 28mm 22mm }
        @media print {
          body { background: white !important }
          .no-print { display: none !important }
          .tela { padding: 0 !important; background: white !important }
          .ct-folha { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; min-height: 0 !important; background: none !important }
          .ct-head { position: fixed; top: -40mm }
          .ct-foot { position: fixed; bottom: -24mm; left: 0; right: 0 }
          .ct-bg { display: block !important }
        }
        .ct-bg { display: none; position: fixed; top: -46mm; left: -22mm; width: 210mm; height: 297mm; z-index: -1; background: linear-gradient(160deg,#fff8e6 0%,#fffdf7 35%,#fff 60%,#fff9ea 100%); -webkit-print-color-adjust: exact; print-color-adjust: exact }
      `}</style>

      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0f172a', color: 'white', padding: '10px 18px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => navigate(`/clientes/${id}`)} style={btn}>← Voltar ao cliente</button>
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 200 }}>Contrato · {cliente.razao_social}</div>
        {manual !== null && <button onClick={() => setManual(null)} style={btn}>↺ Voltar ao texto automático</button>}
        <button onClick={baixarWord} style={btn}>⬇ Word</button>
        <button onClick={imprimir} style={{ ...btn, background: G, borderColor: G }}>🖨 Imprimir / Salvar PDF</button>
      </div>

      <div className="tela" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '18px 12px 60px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div className="no-print" style={{ width: 340, maxWidth: '100%', background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Os campos vêm do cadastro do cliente. Ajuste o que precisar — o contrato ao lado atualiza na hora.</div>
          {CAMPOS.map(([titulo, campos]) => (
            <div key={titulo} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{titulo}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {campos.map(([k, label, tipo]) => (
                  <div key={k} style={{ gridColumn: tipo === 'wide' || tipo === 'area' ? '1 / -1' : 'auto' }}>
                    {label && <label style={{ display: 'block', fontSize: 10.5, color: '#64748b', marginBottom: 2 }}>{label}</label>}
                    {tipo === 'area'
                      ? <textarea rows={6} value={f[k]} onChange={e => setF(s => ({ ...s, [k]: e.target.value }))} style={inp} />
                      : <input type={tipo === 'date' ? 'date' : 'text'} value={f[k]} onChange={e => setF(s => ({ ...s, [k]: e.target.value }))} style={inp} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Quer mexer numa cláusula? Clique no texto do contrato e edite direto (ao editar, o texto deixa de seguir os campos).</div>
        </div>

        <div className="ct-folha" style={{ position: 'relative', background: 'white', width: '210mm', maxWidth: '100%', minHeight: '297mm', padding: '46mm 22mm 30mm', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, lineHeight: 1.45, color: '#111' }}>
          <div className="ct-bg" />
          <div className="ct-head"><div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 34, letterSpacing: 9, color: '#111', lineHeight: 1 }}>AGGIO</div><div style={{ fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: 9, color: '#555', marginTop: 4 }}>CONTÁBIL</div><div style={{ height: 2, background: G, width: '60%', margin: '10px auto 0' }} /></div>
          <div className="ct-foot">
            <b style={{ fontSize: 11 }}>{CONTRATADA.fantasia}</b> &nbsp;|&nbsp; CNPJ: {CONTRATADA.cnpj}{CONTRATADA.crcEmpresa ? ` | ${CONTRATADA.crcEmpresa}` : ''}<br />
            WhatsApp {CONTRATADA.whatsapp} &nbsp;&nbsp; {CONTRATADA.instagram} &nbsp;&nbsp; {CONTRATADA.email}
          </div>
          <div className="ct-doc" contentEditable suppressContentEditableWarning
            onInput={() => { mexeu.current = true }}
            onBlur={e => { if (mexeu.current) { mexeu.current = false; setManual(htmlParaTexto(e.currentTarget)) } }}
            dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  )
}

// Converte o HTML editado de volta para o texto-base (mantém títulos, negrito, listas e linhas de assinatura)
const inl = (n) => {
  const d = document.createElement('div'); d.innerHTML = n.innerHTML
  return d.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<(b|strong)>(.*?)<\/\1>/gi, '**$2**').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
}
function htmlParaTexto(el) {
  const out = []
  el.childNodes.forEach(n => {
    const t = inl(n)
    if (n.nodeName === 'H1') out.push('# ' + t)
    else if (n.nodeName === 'H2') out.push('## ' + t)
    else if (n.nodeName === 'HR') out.push('---')
    else if (n.nodeName === 'UL') out.push([...n.querySelectorAll('li')].map(li => '- ' + inl(li)).join('\n'))
    else if (t) out.push(t)
  })
  return out.join('\n\n')
}
