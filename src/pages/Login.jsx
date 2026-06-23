import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

const G = '#C9960A'
const G2 = '#E8B000'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('E-mail ou senha inválidos.')
    else navigate('/')
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Painel esquerdo — identidade Aggio */}
      <div style={{
        flex: 1,
        background: '#0a0b0d',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 72px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decoração dourada de fundo */}
        <div style={{ position: 'absolute', top: -120, right: -120, width: 480, height: 480, borderRadius: '50%', background: `radial-gradient(circle, rgba(201,150,10,0.12) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 360, height: 360, borderRadius: '50%', background: `radial-gradient(circle, rgba(201,150,10,0.07) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo Aggio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 60 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: `linear-gradient(135deg, ${G} 0%, #7a5800 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 32px rgba(201,150,10,0.45)`,
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M4 20 C8 14, 14 10, 20 4" stroke="#0a0b0d" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M12 20 C14 15, 18 11, 20 4" stroke="#0a0b0d" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                <path d="M20 4 L20 12 M20 4 L12 4" stroke="#0a0b0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ color: G2, fontWeight: 900, fontSize: 26, letterSpacing: '0.06em', lineHeight: 1 }}>AGGIO</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>Contábil</div>
            </div>
          </div>

          <h2 style={{ color: 'white', fontSize: 38, fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px' }}>
            Gestão contábil<br />
            <span style={{ color: G2 }}>inteligente</span> e<br />
            eficiente.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, lineHeight: 1.7, maxWidth: 380, margin: '0 0 48px' }}>
            Clientes, obrigações fiscais, financeiro e legalização — tudo integrado em um só sistema.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 380 }}>
            {[
              { icon: '👥', label: 'Clientes', desc: 'Cadastro completo com portais e histórico' },
              { icon: '📋', label: 'Obrigações', desc: 'Controle periódico de tarefas fiscais' },
              { icon: '💰', label: 'Financeiro', desc: 'Contas a pagar e receber integradas' },
              { icon: '⚖️', label: 'Legalização', desc: 'Abertura, baixa e alterações' },
            ].map(f => (
              <div key={f.label} style={{
                background: 'rgba(201,150,10,0.05)',
                border: '1px solid rgba(201,150,10,0.15)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{f.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div style={{
        width: 460, background: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48,
        boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          {/* Mini logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `linear-gradient(135deg, ${G} 0%, #7a5800 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px rgba(201,150,10,0.3)`,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 20 C8 14, 14 10, 20 4" stroke="#0a0b0d" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M12 20 C14 15, 18 11, 20 4" stroke="#0a0b0d" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                <path d="M20 4 L20 12 M20 4 L12 4" stroke="#0a0b0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ color: '#0a0b0d', fontWeight: 800, fontSize: 15, letterSpacing: '0.05em' }}>AGGIO CONTÁBIL</div>
              <div style={{ color: G, fontSize: 11, fontWeight: 600 }}>Acesso ao sistema</div>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Bem-vindo</h3>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Entre com suas credenciais de acesso</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>E-mail</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14,
                  border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box',
                  color: '#1e293b', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = G}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, fontSize: 14,
                    border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box',
                    color: '#1e293b', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = G}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
                ⚠ {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                background: loading ? `rgba(201,150,10,0.5)` : `linear-gradient(135deg, ${G} 0%, #8a6500 100%)`,
                color: loading ? 'rgba(255,255,255,0.6)' : '#0a0b0d',
                border: 'none', borderRadius: 10, padding: '13px', fontSize: 15,
                fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: loading ? 'none' : `0 4px 18px rgba(201,150,10,0.4)`,
                letterSpacing: '0.02em',
              }}
            >
              {loading ? (
                <><span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0a0b0d', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Entrando...</>
              ) : 'Entrar no sistema →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#cbd5e1', marginTop: 32 }}>
            © 2025 Aggio Contábil · Todos os direitos reservados
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
