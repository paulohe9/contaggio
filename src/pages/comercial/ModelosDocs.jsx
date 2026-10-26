import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Btn, Modal, Input, Select } from '../../components/ui'
import { PLACEHOLDERS, MODELOS_PADRAO, textoParaHtml } from '../../lib/funilPadrao'
import { inputBase } from '../../lib/util'

export default function ModelosDocs({ open, funil, modelos, onClose, onSaved }) {
  const [sel, setSel] = useState(null) // modelo em edição
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const txtRef = useRef(null)

  useEffect(() => { if (open) { setSel(modelos[0] ? { ...modelos[0] } : null); setPreview(false) } }, [open])

  function inserir(ph) {
    const el = txtRef.current
    const tag = `{{${ph}}}`
    if (!el) return
    const ini = el.selectionStart, fim = el.selectionEnd
    const novo = sel.conteudo.slice(0, ini) + tag + sel.conteudo.slice(fim)
    setSel(s => ({ ...s, conteudo: novo }))
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = ini + tag.length }, 0)
  }

  async function salvar() {
    if (!sel.nome.trim()) { alert('Dê um nome ao modelo.'); return }
    setSaving(true)
    const payload = { funil, tipo: sel.tipo, nome: sel.nome.trim(), conteudo: sel.conteudo, updated_at: new Date().toISOString() }
    const res = sel.id
      ? await supabase.from('crm_modelos').update(payload).eq('id', sel.id).select().single()
      : await supabase.from('crm_modelos').insert(payload).select().single()
    setSaving(false)
    if (res.error) { alert('Erro: ' + res.error.message); return }
    setSel({ ...res.data })
    onSaved()
  }

  async function excluir() {
    if (!sel?.id || !confirm(`Excluir o modelo "${sel.nome}"?`)) return
    await supabase.from('crm_modelos').delete().eq('id', sel.id)
    setSel(null)
    onSaved()
  }

  function restaurarPadrao() {
    const p = MODELOS_PADRAO[funil][sel.tipo]
    if (confirm('Substituir o texto pelo modelo padrão do sistema? (só é gravado ao clicar em Salvar)')) setSel(s => ({ ...s, conteudo: p.conteudo }))
  }

  return (
    <Modal open={open} onClose={onClose} title="📄 Modelos de proposta e contrato" size="xl">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {modelos.map(m => (
          <button key={m.id} onClick={() => { setSel({ ...m }); setPreview(false) }} style={{
            padding: '6px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600,
            border: sel?.id === m.id ? '1px solid #2563eb' : '1px solid #e2e8f0', background: sel?.id === m.id ? '#eff6ff' : 'white', color: sel?.id === m.id ? '#1d4ed8' : '#475569',
          }}>{m.tipo === 'proposta' ? '📄' : '📝'} {m.nome}</button>
        ))}
        <button onClick={() => setSel({ tipo: 'proposta', nome: 'Novo modelo', conteudo: MODELOS_PADRAO[funil].proposta.conteudo })}
          style={{ padding: '6px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1.5px dashed #cbd5e1', background: 'white', color: '#64748b' }}>+ Novo modelo</button>
      </div>

      {sel ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Input label="Nome do modelo" value={sel.nome} onChange={e => setSel(s => ({ ...s, nome: e.target.value }))} />
            <Select label="Tipo" value={sel.tipo} onChange={e => setSel(s => ({ ...s, tipo: e.target.value }))}>
              <option value="proposta">Proposta comercial</option>
              <option value="contrato">Contrato</option>
            </Select>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Campos automáticos (clique para inserir)</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {PLACEHOLDERS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => inserir(k)} title={`{{${k}}}`} style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, cursor: 'pointer', border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca' }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button onClick={() => setPreview(false)} style={{ ...aba, ...(preview ? {} : abaOn) }}>✏️ Texto</button>
            <button onClick={() => setPreview(true)} style={{ ...aba, ...(preview ? abaOn : {}) }}>👁 Pré-visualizar</button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}># título · ## seção · **negrito** · - lista · --- linha de assinatura</span>
          </div>
          {preview ? (
            <div className="doc-contaggio" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 26px', maxHeight: 380, overflow: 'auto', fontSize: 13, lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: textoParaHtml(sel.conteudo) }} />
          ) : (
            <textarea ref={txtRef} value={sel.conteudo} onChange={e => setSel(s => ({ ...s, conteudo: e.target.value }))}
              style={{ ...inputBase, width: '100%', minHeight: 360, fontFamily: 'ui-monospace, monospace', fontSize: 12.5, lineHeight: 1.55, resize: 'vertical' }} />
          )}
          <div style={{ fontSize: 11.5, color: '#92400e', background: '#fffbeb', borderRadius: 8, padding: '7px 10px', marginTop: 8 }}>
            Troque os trechos entre colchetes (ex.: [CNPJ DO ESCRITÓRIO], [CIDADE/UF]) pelos dados do escritório uma vez e salve. Vale revisar o contrato com o seu jurídico.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {sel.id && <Btn variant="danger" size="sm" onClick={excluir}>Excluir</Btn>}
              <Btn variant="ghost" size="sm" onClick={restaurarPadrao}>Restaurar padrão</Btn>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar modelo'}</Btn>
            </div>
          </div>
        </>
      ) : <div style={{ color: '#94a3b8', fontSize: 13, padding: 20, textAlign: 'center' }}>Escolha ou crie um modelo.</div>}
    </Modal>
  )
}

const aba = { padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer', border: '1px solid #e2e8f0', background: 'white', color: '#475569' }
const abaOn = { background: '#0f172a', color: 'white', borderColor: '#0f172a' }
