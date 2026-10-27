import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Btn, Modal, Input, Textarea } from '../../components/ui'
import { fmtBRL, fmtData } from '../../lib/util'

async function chamar(body) {
  const { data, error } = await supabase.functions.invoke('cobranca-whatsapp', { body })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* mantém */ }
    throw new Error(msg)
  }
  if (!data?.ok) throw new Error(data?.error || 'Erro na cobrança')
  return data
}

// ─── Enviar cobrança (um título ou vários) ──────────────────────────
export function CobrarModal({ open, titulos, onClose, onEnviado }) {
  const [previa, setPrevia] = useState([])
  const [mensagens, setMensagens] = useState({})
  const [marcados, setMarcados] = useState({})
  const [estado, setEstado] = useState('carregando') // carregando | pronto | enviando | feito | erro
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState(null)
  const [aberto, setAberto] = useState(null)

  useEffect(() => {
    if (!open || !titulos?.length) return
    setEstado('carregando'); setErro(''); setResultado(null); setAberto(titulos.length === 1 ? titulos[0].id : null)
    chamar({ modo: 'preview', titulos: titulos.map(t => t.id) })
      .then(r => {
        setPrevia(r.previa)
        setMensagens(Object.fromEntries(r.previa.map(p => [p.id, p.mensagem])))
        setMarcados(Object.fromEntries(r.previa.map(p => [p.id, !!p.telefone])))
        setEstado('pronto')
      })
      .catch(e => { setErro(e.message); setEstado('erro') })
  }, [open, titulos])

  const selecionados = previa.filter(p => marcados[p.id])
  const tituloDe = (id) => titulos.find(t => t.id === id) || {}

  async function enviar() {
    setEstado('enviando')
    try {
      const ids = selecionados.map(p => p.id)
      const msgs = Object.fromEntries(ids.map(id => [id, mensagens[id]]))
      const r = await chamar({ modo: 'manual', titulos: ids, mensagens: msgs })
      setResultado(r); setEstado('feito'); onEnviado && onEnviado(r)
    } catch (e) { setErro(e.message); setEstado('erro') }
  }

  return (
    <Modal open={open} onClose={onClose} title={titulos?.length > 1 ? `💬 Cobrar ${titulos.length} títulos pelo WhatsApp` : '💬 Cobrar pelo WhatsApp'} size="lg">
      {estado === 'carregando' && <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Montando as mensagens...</div>}
      {estado === 'erro' && (
        <div>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#991b1b' }}>{erro}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>Se for a primeira vez: confira se a função "cobranca-whatsapp" foi publicada e se os secrets do Z-API estão no Supabase.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><Btn variant="secondary" onClick={onClose}>Fechar</Btn></div>
        </div>
      )}
      {(estado === 'pronto' || estado === 'enviando') && (
        <div>
          <div style={{ maxHeight: 420, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {previa.map(p => {
              const t = tituloDe(p.id)
              const exp = aberto === p.id
              return (
                <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px', background: p.telefone ? 'white' : '#fef2f2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={!!marcados[p.id]} disabled={!p.telefone} onChange={e => setMarcados(m => ({ ...m, [p.id]: e.target.checked }))} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{p.cliente || 'Sem cliente'}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>
                        {t.description} · {fmtBRL(t.amount)} · venc. {fmtData(t.due_date)} · {p.telefone ? `📱 ${p.telefone}` : <span style={{ color: '#dc2626', fontWeight: 600 }}>sem WhatsApp no cadastro</span>}
                      </div>
                    </div>
                    {p.telefone && <button onClick={() => setAberto(exp ? null : p.id)} style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: 7, padding: '4px 9px', fontSize: 11.5, cursor: 'pointer', color: '#2563eb' }}>{exp ? 'Fechar' : 'Ver / editar mensagem'}</button>}
                  </div>
                  {exp && (
                    <textarea value={mensagens[p.id]} onChange={e => setMensagens(m => ({ ...m, [p.id]: e.target.value }))} rows={8}
                      style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', fontSize: 13, lineHeight: 1.5, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 10 }}>As mensagens saem do WhatsApp conectado no Z-API, com um intervalo entre uma e outra para evitar bloqueio. *texto* aparece em negrito no WhatsApp.</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <span style={{ fontSize: 13, color: '#475569' }}><b>{selecionados.length}</b> mensagem(ns) para enviar</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
              <Btn variant="success" onClick={enviar} disabled={estado === 'enviando' || !selecionados.length}>
                {estado === 'enviando' ? `Enviando... (~${Math.ceil(selecionados.length * 2.5)}s)` : `Enviar ${selecionados.length} cobrança(s)`}
              </Btn>
            </div>
          </div>
        </div>
      )}
      {estado === 'feito' && resultado && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: 36 }}>{resultado.erros?.length ? '⚠️' : '✅'}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>{resultado.enviados} cobrança(s) enviada(s)</div>
          {resultado.erros?.length > 0 && <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 8, textAlign: 'left' }}>{resultado.erros.map((e, i) => <div key={i}>• {e}</div>)}</div>}
          {resultado.sem_telefone?.length > 0 && <div style={{ fontSize: 12.5, color: '#b45309', marginTop: 8 }}>Sem WhatsApp no cadastro: {resultado.sem_telefone.join(', ')}</div>}
          <div style={{ marginTop: 14 }}><Btn onClick={onClose}>Fechar</Btn></div>
        </div>
      )}
    </Modal>
  )
}

// ─── Régua de cobrança automática ───────────────────────────────────
const listaDias = (s) => String(s || '').split(/[,;\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 90)

export function ReguaConfig({ open, onClose }) {
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [teste, setTeste] = useState('')

  useEffect(() => {
    if (!open) return
    setTeste('')
    supabase.from('cobranca_config').select('*').eq('id', 1).single().then(({ data, error }) => {
      if (error) { alert('Erro: ' + error.message + '\n\nVerifique se o SQL 06 foi executado no Supabase.'); return }
      setCfg({ ...data, dias_antes_txt: (data.dias_antes || []).join(', '), dias_depois_txt: (data.dias_depois || []).join(', ') })
    })
  }, [open])

  async function salvar() {
    setSaving(true)
    const { error } = await supabase.from('cobranca_config').update({
      ativa: cfg.ativa, no_dia: cfg.no_dia, chave_pix: cfg.chave_pix || null,
      dias_antes: listaDias(cfg.dias_antes_txt), dias_depois: listaDias(cfg.dias_depois_txt),
      modelo_a_vencer: cfg.modelo_a_vencer, modelo_vencido: cfg.modelo_vencido, updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    onClose()
  }

  async function simularHoje() {
    setTeste('Calculando...')
    try {
      const { data, error } = await supabase.functions.invoke('cobranca-whatsapp', { body: { modo: 'automatica', simular: true } })
      if (error) throw error
      setTeste(data?.motivo || `Hoje a régua enviaria ${data?.enviados ?? 0} mensagem(ns).`)
    } catch (e) { setTeste('Não foi possível simular: ' + e.message) }
  }

  if (!cfg) return <Modal open={open} onClose={onClose} title="⚙ Régua de cobrança"><div style={{ padding: 20, color: '#94a3b8' }}>Carregando...</div></Modal>

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }))
  return (
    <Modal open={open} onClose={onClose} title="⚙ Régua de cobrança pelo WhatsApp" size="xl">
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, cursor: 'pointer', marginBottom: 14,
        background: cfg.ativa ? '#f0fdf4' : '#f8fafc', border: `1px solid ${cfg.ativa ? '#bbf7d0' : '#e2e8f0'}` }}>
        <input type="checkbox" checked={cfg.ativa} onChange={e => set('ativa', e.target.checked)} style={{ width: 18, height: 18 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{cfg.ativa ? 'Régua automática LIGADA' : 'Régua automática desligada'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>De segunda a sexta, às 9h, o sistema manda as mensagens abaixo para os clientes com título em aberto. Cada etapa sai uma vez só por título.</div>
        </div>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Input label="Lembrete X dias ANTES (ex.: 3)" value={cfg.dias_antes_txt} onChange={e => set('dias_antes_txt', e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginTop: 18, cursor: 'pointer' }}>
          <input type="checkbox" checked={cfg.no_dia} onChange={e => set('no_dia', e.target.checked)} /> Avisar no dia do vencimento
        </label>
        <Input label="Cobrar X dias DEPOIS (ex.: 3, 7, 15)" value={cfg.dias_depois_txt} onChange={e => set('dias_depois_txt', e.target.value)} />
      </div>
      <Input label="Chave PIX (aparece no lugar de {pix})" value={cfg.chave_pix || ''} onChange={e => set('chave_pix', e.target.value)} placeholder="CNPJ, e-mail ou chave aleatória da Aggio" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Textarea label="Mensagem — antes / no dia" value={cfg.modelo_a_vencer} onChange={e => set('modelo_a_vencer', e.target.value)} rows={9} />
        <Textarea label="Mensagem — vencido" value={cfg.modelo_vencido} onChange={e => set('modelo_vencido', e.target.value)} rows={9} />
      </div>
      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: -4 }}>
        Campos: {'{cliente} {descricao} {valor} {vencimento} {dias} {quando} {pix}'} · *texto* fica em negrito no WhatsApp.
      </div>
      {teste && <div style={{ fontSize: 12.5, color: '#2563eb', marginTop: 10 }}>{teste}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <Btn variant="ghost" onClick={simularHoje}>Quantas sairiam hoje?</Btn>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar régua'}</Btn>
        </div>
      </div>
    </Modal>
  )
}
