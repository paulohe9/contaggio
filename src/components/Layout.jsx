import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Users, Wallet, ClipboardList, Scale, UserCog,
  ChevronLeft, ChevronRight, LogOut, Building2, Inbox
} from 'lucide-react'

const G = '#C9960A'   // dourado Aggio
const G2 = '#E8B000'  // dourado claro hover
const DARK = '#0a0b0d'
const DARK2 = '#111318'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/financeiro', label: 'Financeiro', icon: Wallet },
  { path: '/obrigacoes', label: 'Obrigações', icon: ClipboardList },
  { path: '/solicitacoes', label: 'Solicitações', icon: Inbox },
  { path: '/legalizacao', label: 'Legalização', icon: Scale },
]

const roleLabel = { admin: 'Admin', gerente: 'Gerente', user: 'Usuário' }
const roleColor = { admin: '#ef4444', gerente: G, user: '#10b981' }

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const allNavItems = [
    ...navItems,
    ...(profile?.role === 'admin' ? [{ path: '/usuarios', label: 'Usuários', icon: UserCog }] : [])
  ]

  const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f1f5f9' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 68 : 240,
        minWidth: collapsed ? 68 : 240,
        background: DARK,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease, min-width 0.25s ease',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
        boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{
          padding: '18px 16px',
          borderBottom: `1px solid rgba(201,150,10,0.15)`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 68,
        }}>
          {/* Ícone com asa/símbolo da Aggio */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${G} 0%, #8a6500 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 14px rgba(201,150,10,0.4)`,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 20 C8 14, 14 10, 20 4" stroke="#0a0b0d" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M12 20 C14 15, 18 11, 20 4" stroke="#0a0b0d" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
              <path d="M20 4 L20 12 M20 4 L12 4" stroke="#0a0b0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: G, fontWeight: 800, fontSize: 17, lineHeight: 1.1, letterSpacing: '0.02em' }}>AGGIO</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Contábil</div>
            </div>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute', top: 80, right: -12,
            width: 24, height: 24, borderRadius: '50%',
            background: DARK2, border: `2px solid rgba(201,150,10,0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: G, cursor: 'pointer', zIndex: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
          {!collapsed && (
            <div style={{ color: 'rgba(201,150,10,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '0 8px', marginBottom: 8, textTransform: 'uppercase' }}>
              Menu
            </div>
          )}
          {allNavItems.map(item => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10, padding: collapsed ? '10px 14px' : '10px 12px',
                  borderRadius: 10, marginBottom: 2,
                  background: active ? `rgba(201,150,10,0.12)` : 'transparent',
                  color: active ? G2 : 'rgba(255,255,255,0.45)',
                  textDecoration: 'none', fontWeight: active ? 700 : 400,
                  fontSize: 13.5, transition: 'all 0.15s',
                  borderLeft: active ? `3px solid ${G}` : '3px solid transparent',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' } }}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 10px', borderTop: `1px solid rgba(201,150,10,0.12)` }}>
          {!collapsed && profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${G} 0%, #7a5800 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: DARK, fontWeight: 800, fontSize: 13,
              }}>
                {(profile.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.name}</div>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700, background: roleColor[profile.role] + '22', color: roleColor[profile.role], border: `1px solid ${roleColor[profile.role]}44` }}>
                  {roleLabel[profile.role]}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={async () => { await signOut(); navigate('/login') }}
            title="Sair"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: collapsed ? '10px 14px' : '8px 12px',
              borderRadius: 10, width: '100%', background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 13,
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
          >
            <LogOut size={16} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid #e8ecf0',
          padding: '0 28px', height: 58,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: G, marginRight: 4 }} />
            <span style={{ color: '#1e293b', fontSize: 14, fontWeight: 700 }}>
              {allNavItems.find(n => isActive(n.path))?.label || 'Dashboard'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {profile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>{profile.name}</span>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `linear-gradient(135deg, ${G} 0%, #7a5800 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: DARK, fontWeight: 800, fontSize: 12,
                }}>
                  {(profile.name || 'A').charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px', background: '#f4f6f9' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
