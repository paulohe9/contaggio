import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Btn, Modal } from '../../components/ui'
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react'
import { CAMPOS_REQUISITO } from '../../lib/funilPadrao'
import { inputBase } from '../../lib/util'

const TIPOS_REQ = [
  ['check', '☑️ Marcar como feito'],
  ['campo', '✏️ Campo preenchido'],
  ['proposta', '📄 Proposta gerada'],
  ['contrato', '📝 Contrato gerado'],
]
const novoId = () => Math.random().toString(36).slice(2, 8)
const slug = (t) => (t || 'etapa').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'etapa'

export default function ConfigFunil({ open, funil, etapas, leads, onClose, onSaved }) {
  const [lista, setLista] = useState([])
  const [aberta, setAberta] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setLista(etapas.map(e => ({ ...e, requisitos: [...(e.requisitos || [])] }))); setAberta(null) }
  }, [open, etapas])

  const set = (i, campo, valor) => setLista(l => l.map((e, idx) => idx === i ? { ...e, [campo]: valor } : e))
  const setReq = (i, j, campo, valor) => setLista(l => l.map((e, idx) => idx !== i ? e : { ...e, requisitos: e.requisitos.map((r, k) => k === j ? { ...r, [campo]: valor } : r) }))
  const addReq = (i) => setLista(l => l.map((e, idx) => idx !== i ? e : { ...e, requisitos: [...e.requisitos, { id: novoId(), texto: '', tipo: 'check' }] }))
  const delReq = (i, j) => setLista(l => l.map((e, idx) => idx !== i ? e : { ...e, requisitos: e.requisitos.filter((_, k) => k !== j) }))

  function mover(i, dir) {
    const j = i + dir
    if (j < 0 || j >= lista.length) return
    if (lista[i].tipo !== 'normal' || lista[j].tipo !== 'normal') return // Fechado/Perdido ficam no fim
    setLista(l => { const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c })
    setAberta(a => a === i ? j : a === j ? i : a)
  }
  function remover(i) {
    const e = lista[i]
    const qtd = leads.filter(l => l.stage === e.key).length
    if (qtd) { alert(`Existem ${qtd} lead(s) em "${e.label}". Mova-os para outra etapa antes de excluir.`); return }
    if (!confirm(`Excluir a etapa "${e.label}"?`)) return
    setLista(l => l.filter((_, idx) => idx !== i))
    setAberta(null)
  }
  function adicionar() {
    const idxGanho = lista.findIndex(e => e.tipo !== 'normal')
    const pos = idxGanho < 0 ? lista.length : idxGanho
    const nova = { key: null, label: 'Nova etapa', cor: '#0ea5e9', dias_alerta: 3, tipo: 'normal', requisitos: [] }
    setLista(l => [...l.slice(0, pos), nova, ...l.slice(pos)])
    setAberta(pos)
  }

  async function salvar() {
    for (const e of lista) {
      if (!e.label.trim()) { alert('Toda etapa precisa de um nome.'); return }
      for (const r of e.requisitos) {
        if (!r.texto.trim()) { alert(`Há um requisito sem descrição na etapa "${e.label}".`); return }
        if (r.tipo === 'campo' && !r.campo) { alert(`Escolha o campo do requisito "${r.texto}".`); return }
      }
    }
    setSaving(true)
    try {
      const usadas = new Set(lista.filter(e => e.key).map(e => e.key))
      const registros = lista.map((e, i) => {
        let key = e.key
        if (!key) { key = slug(e.label); while (usadas.has(key)) key = key + '_' + novoId().slice(0, 2); usadas.add(key) }
        return {
          ...(e.id ? { id: e.id } : {}), funil, key, label: e.label.trim(), cor: e.cor, ordem: i,
          dias_alerta: e.tipo === 'normal' && e.dias_alerta ? Number(e.dias_alerta) : null, tipo: e.tipo,
          requisitos: e.requisitos.map(r => ({ id: r.id, texto: r.texto.trim(), tipo: r.tipo, ...(r.tipo === 'campo' ? { campo: r.campo } : {}) })),
        }
      })
      const removidas = etapas.filter(e => !lista.some(x => x.id === e.id)).map(e => e.id)
      if (removidas.length) {
        const { error } = await supabase.from('crm_etapas').delete().in('id', removidas)
        if (error) throw error
      }
      const existentes = registros.filter(r => r.id)
      const novas = registros.filter(r => !r.id)
      if (existentes.length) { const { error } = await supabase.from('crm_etapas').upsert(existentes); if (error) throw error }
      if (novas.length) { const { error } = await supabase.from('crm_etapas').insert(novas); if (error) throw error }
      onSaved()
    } catch (err) {
      alert('Erro ao salvar: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="⚙️ Configurar etapas do funil" size="xl">
      <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
        Defina o passo a passo e o que precisa estar pronto em cada etapa. O lead só avança quando os requisitos da etapa estão cumpridos.
      </div>
      {lista.map((e, i) => {
        const qtd = leads.filter(l => l.stage === e.key).length
        const exp = aberta === i
        return (
          <div key={e.id || 'nova' + i} style={{ border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 8, background: exp ? '#f8fafc' : 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
              <input type="color" value={e.cor} onChange={ev => set(i, 'cor', ev.target.value)} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              <input value={e.label} onChange={ev => set(i, 'label', ev.target.value)} style={{ ...inputBase, flex: 1, fontWeight: 600 }} />
              {e.tipo === 'normal' ? (
                <label style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  alerta após
                  <input type="number" min="1" value={e.dias_alerta || ''} onChange={ev => set(i, 'dias_alerta', ev.target.value)} style={{ ...inputBase, width: 52, padding: '6px' }} /> dias
                </label>
              ) : <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{e.tipo === 'ganho' ? 'etapa de fechamento' : 'etapa de perda'}</span>}
              <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{qtd} lead(s)</span>
              {e.tipo === 'normal' && <>
                <button onClick={() => mover(i, -1)} style={mini} title="Subir"><ArrowUp size={13} /></button>
                <button onClick={() => mover(i, 1)} style={mini} title="Descer"><ArrowDown size={13} /></button>
              </>}
              <button onClick={() => setAberta(exp ? null : i)} style={{ ...mini, color: '#2563eb', fontWeight: 700 }}>
                📋 {e.requisitos.length}
              </button>
              {e.tipo === 'normal' && <button onClick={() => remover(i)} style={{ ...mini, color: '#dc2626' }} title="Excluir"><Trash2 size={13} /></button>}
            </div>
            {exp && (
              <div style={{ padding: '4px 12px 12px 46px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Requisitos para sair desta etapa</div>
                {e.requisitos.map((r, j) => (
                  <div key={r.id} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input value={r.texto} onChange={ev => setReq(i, j, 'texto', ev.target.value)} placeholder="Ex.: Proposta aprovada pelo cliente" style={{ ...inputBase, flex: 1 }} />
                    <select value={r.tipo} onChange={ev => setReq(i, j, 'tipo', ev.target.value)} style={inputBase}>
                      {TIPOS_REQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {r.tipo === 'campo' && (
                      <select value={r.campo || ''} onChange={ev => setReq(i, j, 'campo', ev.target.value)} style={inputBase}>
                        <option value="">Qual campo?</option>
                        {Object.entries(CAMPOS_REQUISITO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    )}
                    <button onClick={() => delReq(i, j)} style={{ ...mini, color: '#dc2626' }}><Trash2 size={13} /></button>
                  </div>
                ))}
                <button onClick={() => addReq(i)} style={{ ...mini, color: '#2563eb' }}><Plus size={12} /> Adicionar requisito</button>
              </div>
            )}
          </div>
        )
      })}
      <button onClick={adicionar} style={{ width: '100%', border: '1.5px dashed #cbd5e1', background: 'transparent', borderRadius: 12, padding: 10, fontSize: 13, color: '#64748b', cursor: 'pointer', marginTop: 4 }}>
        + Nova etapa
      </button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar funil'}</Btn>
      </div>
    </Modal>
  )
}

const mini = {
  background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 8px', cursor: 'pointer',
  color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
}
