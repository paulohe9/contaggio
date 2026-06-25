import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const G = '#C9960A'

export default function AcessoEmail() {
  const { token } = useParams()
  const [state, setState] = useState('loading') // loading | ok | error
  const [data, setData] = useState(null)

  useEffect(() => {
    async function track() {
      try {
        const { data: result, error } = await supabase.functions.invoke('track-email-access', {
          body: {
            token,
            user_agent: navigator.userAgent,
          },
        })
        if (error || !result?.ok) { setState('error'); return }
        setData(result.data)
        setState('ok')
      } catch {
        setState('error')
      }
    }
    track()
  }, [token])

  if (state === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ fontWeight: 600 }}>Carregando...</div>
      </div>
    </div>
  )

  if (state === 'error') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b', marginBottom: 8 }}>Link inválido ou expirado</div>
        <div style={{ color: '#64748b', fontSize: 14 }}>Este link não existe ou foi removido. Entre em contato com a Aggio Contábil.</div>
      </div>
    </div>
  )

  const obl = data?.obligations
  const cli = data?.clients

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px' }}>
      {/* Header Aggio */}
      <div style={{ background: '#0a0b0d', borderRadius: 16, padding: '20px 36px', marginBottom: 24, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ color: G, fontSize: 24, fontWeight: 900, letterSpacing: '0.06em' }}>AGGIO</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Contábil</div>
      </div>

      {/* Card principal */}
      <div style={{ background: 'white', borderRadius: 20, padding: 36, maxWidth: 560, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${G}, #8a6500)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            📋
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 16 }}>{data?.subject}</div>
            {cli && <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>🏢 {cli.razao_social}</div>}
          </div>
        </div>

        {obl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Row label="Obrigação" value={obl.title} />
            {obl.description && <Row label="Descrição" value={obl.description} />}
            {obl.due_date && (
              <Row
                label="Data Limite"
                value={format(parseISO(obl.due_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                highlight
              />
            )}
            <Row
              label="Status"
              value={
                obl.status === 'pendente' ? '⏳ Pendente'
                : obl.status === 'em_andamento' ? '🔄 Em andamento'
                : obl.status === 'concluida' ? '✅ Concluída'
                : obl.status === 'atrasada' ? '🔴 Atrasada'
                : obl.status
              }
            />
          </div>
        )}

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#cbd5e1' }}>
            Em caso de dúvidas, entre em contato com a Aggio Contábil
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: '#cbd5e1' }}>© 2025 Aggio Contábil</div>
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '10px 14px', background: highlight ? '#fffbeb' : '#f8fafc', borderRadius: 10, border: `1px solid ${highlight ? '#fde68a' : '#f1f5f9'}` }}>
      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, color: highlight ? '#92400e' : '#1e293b', fontWeight: highlight ? 700 : 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
