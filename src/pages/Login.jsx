import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

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
      {/* Painel esquerdo */}
      <div style={{
        flex: 1, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 72px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Círculos decorativos */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(59,130,246,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'rgba(99,102,241,0.06)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 20,
              boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
            }}>C</div>
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 22 }}>Contaggio</div>
              <div style={{ color: '#60a5fa', fontSize: 12, marginTop: 1 }}>Sistema Contábil</div>
            </div>
          </div>

          <h2 style={{ color: 'white', fontSize: 36, fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px' }}>
            Gestão contábil<br />
            <span style={{ color: '#60a5fa' }}>inteligente</span> e<br />
            eficiente.
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.7, maxWidth: 380, margin: '0 0 48px' }}>
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
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{f.label}</div>
                <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito */}
      <div style={{
        width: 480, background: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ marginBottom: 36 }}>
            <h3 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Entrar no sistema</h3>
            <p style={{ color: '#64748b', fontSize: 14 }}>Use suas credenciais de acesso</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14,
                  border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box',
                  color: '#1e293b', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, fontSize: 14,
                    border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box',
                    color: '#1e293b', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
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
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#93c5fd' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: 'white', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15,
                fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
              }}
            >
              {loading ? (
                <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Entrando...</>
              ) : 'Entrar no sistema →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#cbd5e1', marginTop: 32 }}>
            © 2025 Contaggio · Todos os direitos reservados
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
