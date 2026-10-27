import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Modal } from './ui'
import { inputBase } from '../lib/util'

const VOZES = [
  ['pt-BR-Neural2-B', 'Masculina (Neural2-B)'],
  ['pt-BR-Neural2-A', 'Feminina (Neural2-A)'],
  ['pt-BR-Neural2-C', 'Feminina (Neural2-C)'],
  ['pt-BR-Wavenet-B', 'Masculina (Wavenet-B)'],
]
const URL_WEBHOOK = 'https://yooxnlvqzpnevsuxntei.supabase.co/functions/v1/whatsapp-webhook?k='

async function chamar(body) {
  const { data, error } = await supabase.functions.invoke('alertas-whatsapp', { body })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* mantém */ }
    throw new Error(msg)
  }
  if (!data?.ok) throw new Error(data?.error || 'Erro')
  return data
}

export default function WhatsAppCentral({ open, onClose }) {
  const [aba, setAba] = useState('resumo')
  const [cfg, setCfg] = useState(null)
  const [grupos, setGrupos] = useState([])
  const [erroGrupos, setErroGrupos] = useState('')
  const [previa, setPrevia] = useState(null)
  const [audioSrc, setAudioSrc] = useState('')
  const [status, setStatus] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [comandos, setComandos] = useState([])

  useEffect(() => {
    if (!open) return
    setStatus(''); setAudioSrc(''); setPrevia(null)
    supabase.from('whatsapp_config').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) { setStatus('Rode o SQL 08 no Supabase para ativar a Central do WhatsApp. (' + error.message + ')'); return }
      setCfg({ ...data, numeros_txt: (data?.numeros_autorizados || []).join(', ') })
    })
    chamar({ acao: 'grupos' }).then(r => setGrupos(r.grupos)).catch(e => setErroGrupos(e.message))
    chamar({ acao: 'preview' }).then(setPrevia).catch(e => setStatus('Não foi possível montar o resumo: ' + e.message))
    supabase.from('whatsapp_comandos').select('*').order('created_at', { ascending: false }).limit(15).then(({ data }) => setComandos(data || []))
  }, [open])

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }))
  const nomeGrupo = (id) => grupos.find(g => g.id === id)?.nome || ''

  async function salvar(extra = {}) {
    const numeros = String(cfg.numeros_txt || '').split(/[,;\s]+/).map(n => n.replace(/\D/g, '')).filter(n => n.length >= 12)
    const { error } = await supabase.from('whatsapp_config').update({
      grupo_resumo: cfg.grupo_resumo || null, grupo_resumo_nome: nomeGrupo(cfg.grupo_resumo) || null,
      enviar_audio: !!cfg.enviar_audio, voz: cfg.voz,
      comandos_ativos: !!cfg.comandos_ativos, grupo_comandos: cfg.grupo_comandos || null, grupo_comandos_nome: nomeGrupo(cfg.grupo_comandos) || null,
      numeros_autorizados: numeros, updated_at: new Date().toISOString(), ...extra,
    }).eq('id', 1)
    if (error) { setStatus('Erro ao salvar: ' + error.message); return false }
    setStatus('✅ Configuração salva'); return true
  }

  async function ouvir() {
    setOcupado(true); setStatus('Gerando o áudio...'); setAudioSrc('')
    try {
      const r = await chamar({ acao: 'preview', ouvir: true, voz: cfg.voz })
      if (r.audio) { setAudioSrc(`data:audio/mpeg;base64,${r.audio}`); setStatus('') } else setStatus('⚠️ ' + (r.erroAudio || 'Áudio indisponível'))
    } catch (e) { setStatus('⚠️ ' + e.message) }
    setOcupado(false)
  }

  async function enviar() {
    if (!cfg.grupo_resumo) { setStatus('Escolha o grupo que vai receber o resumo.'); return }
    if (!confirm(`Enviar agora o resumo para "${nomeGrupo(cfg.grupo_resumo) || cfg.grupo_resumo}"${cfg.enviar_audio ? ' com áudio' : ''}?`)) return
    setOcupado(true); setStatus('Enviando...')
    try {
      await salvar()
      const r = await chamar({ acao: 'enviar', destino: cfg.grupo_resumo, audio: !!cfg.enviar_audio, voz: cfg.voz })
      setStatus(`✅ Enviado para ${nomeGrupo(cfg.grupo_resumo) || 'o grupo'}${r.audio ? ' (texto + áudio)' : ' (texto)'}${r.avisos?.length ? ' · ⚠️ ' + r.avisos.join(' | ') : ''}`)
    } catch (e) { setStatus('⚠️ ' + e.message) }
    setOcupado(false)
  }

  const selGrupo = (valor, onChange) => (
    <select value={valor || ''} onChange={e => onChange(e.target.value)} style={{ ...inputBase, width: '100%' }}>
      <option value="">{grupos.length ? 'Escolha o grupo...' : 'Carregando grupos...'}</option>
      {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
    </select>
  )

  return (
    <Modal open={open} onClose={onClose} title="📲 Central do WhatsApp" size="xl">
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['resumo', '📊 Resumo do dia'], ['comandos', '🤖 Lançar pelo WhatsApp']].map(([v, l]) => (
          <button key={v} onClick={() => setAba(v)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: aba === v ? '1px solid #16a34a' : '1px solid #e2e8f0', background: aba === v ? '#16a34a' : 'white', color: aba === v ? 'white' : '#475569',
          }}>{l}</button>
        ))}
      </div>
      {erroGrupos && <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>Não consegui listar os grupos do WhatsApp: {erroGrupos}</div>}
      {!cfg ? <div style={{ padding: 20, color: '#94a3b8' }}>{status || 'Carregando...'}</div> : aba === 'resumo' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={rot}>Grupo que recebe o resumo</div>
              {selGrupo(cfg.grupo_resumo, v => set('grupo_resumo', v))}
            </div>
            <div>
              <div style={rot}>Voz do áudio</div>
              <select value={cfg.voz} onChange={e => set('voz', e.target.value)} style={{ ...inputBase, width: '100%' }}>
                {VOZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
            <input type="checkbox" checked={!!cfg.enviar_audio} onChange={e => set('enviar_audio', e.target.checked)} disabled={previa && !previa.audioDisponivel} />
            Mandar também em <b>áudio</b> (o sistema "fala" o resumo)
            {previa && !previa.audioDisponivel && <span style={{ color: '#b45309', fontSize: 12 }}> — falta configurar a voz (GOOGLE_TTS_API_KEY no Supabase)</span>}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={rot}>Mensagem escrita</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12, margin: 0, maxHeight: 300, overflow: 'auto', color: '#1e293b' }}>{previa?.texto || 'Montando...'}</pre>
            </div>
            <div>
              <div style={rot}>O que o áudio vai falar</div>
              <div style={{ fontSize: 12.5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, maxHeight: 230, overflow: 'auto', color: '#334155', lineHeight: 1.55 }}>{previa?.falado || '...'}</div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Btn size="sm" variant="secondary" onClick={ouvir} disabled={ocupado || !previa?.audioDisponivel}>🔊 Ouvir prévia</Btn>
                {audioSrc && <audio controls autoPlay src={audioSrc} style={{ height: 32, flex: 1 }} />}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 10 }}>Nada é enviado sozinho: o resumo só sai quando você clicar em "Enviar agora". O envio automático diário fica desligado até você pedir.</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 10 }}>
            <span style={{ fontSize: 12.5, color: status.startsWith('✅') ? '#059669' : status.startsWith('⚠️') ? '#b91c1c' : '#475569' }}>{status}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => salvar()}>Salvar escolhas</Btn>
              <Btn variant="success" onClick={enviar} disabled={ocupado}>{ocupado ? 'Aguarde...' : '📤 Enviar agora'}</Btn>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, cursor: 'pointer', marginBottom: 12,
            background: cfg.comandos_ativos ? '#f0fdf4' : '#f8fafc', border: `1px solid ${cfg.comandos_ativos ? '#bbf7d0' : '#e2e8f0'}` }}>
            <input type="checkbox" checked={!!cfg.comandos_ativos} onChange={e => set('comandos_ativos', e.target.checked)} style={{ width: 18, height: 18 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{cfg.comandos_ativos ? 'Comandos LIGADOS' : 'Comandos desligados'}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Mensagens que começam com / no grupo escolhido viram lançamentos no Contaggio. O resto da conversa é ignorado.</div>
            </div>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={rot}>Grupo de onde os comandos são aceitos</div>
              {selGrupo(cfg.grupo_comandos, v => set('grupo_comandos', v))}
            </div>
            <div>
              <div style={rot}>Números autorizados no privado (opcional)</div>
              <input value={cfg.numeros_txt || ''} onChange={e => set('numeros_txt', e.target.value)} placeholder="5582999998888, 5582988887777" style={{ ...inputBase, width: '100%' }} />
            </div>
          </div>
          <div style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 12.5, marginTop: 12, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: 'white', marginBottom: 4 }}>Comandos</div>
            <div><b>/solicitar</b> Padaria Sol: certidão negativa até 30/10 <span style={{ color: '#94a3b8' }}>→ cria a solicitação do cliente</span></div>
            <div><b>/lead</b> João Silva 82999998888: abertura de empresa <span style={{ color: '#94a3b8' }}>→ lead no funil de Serviços</span></div>
            <div><b>/obra</b> Maria 82988887777: casa de 120 m² <span style={{ color: '#94a3b8' }}>→ lead no funil de Obras</span></div>
            <div><b>/resumo</b> <span style={{ color: '#94a3b8' }}>→ resumo do dia na hora</span> · <b>/ajuda</b> <span style={{ color: '#94a3b8' }}>→ lista de comandos</span></div>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: '#78350f', marginTop: 12, lineHeight: 1.6 }}>
            <b>Ligação com o Z-API (uma vez só):</b> no Z-API, abra a instância → <b>Webhooks e configurações gerais</b> → campo <b>Ao receber</b> e cole:
            <div style={{ fontFamily: 'ui-monospace, monospace', background: 'white', borderRadius: 8, padding: '6px 8px', margin: '6px 0', wordBreak: 'break-all', color: '#0f172a' }}>{URL_WEBHOOK}<span style={{ color: '#dc2626' }}>SUA_SENHA_DO_CRON_SECRET</span></div>
            Troque o final pela mesma senha que você colocou no <b>CRON_SECRET</b>. Se o número conectado for o seu e você também quiser mandar comandos, ligue a opção <b>"Notificar as enviadas por mim também"</b>.
          </div>
          {comandos.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={rot}>Últimos comandos recebidos</div>
              <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                {comandos.map(c => (
                  <div key={c.id} style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                    <span style={{ color: c.ok ? '#059669' : '#b45309' }}>{c.ok ? '✅' : '⚠️'}</span> <b>{c.de_nome}</b> · {new Date(c.created_at).toLocaleString('pt-BR')} — <span style={{ color: '#475569' }}>{c.texto}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <span style={{ fontSize: 12.5, color: status.startsWith('✅') ? '#059669' : '#b91c1c' }}>{status}</span>
            <Btn onClick={() => salvar()}>Salvar</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

const rot = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }
