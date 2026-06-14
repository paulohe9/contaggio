import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Users, Wallet, ClipboardList, Scale, UserCog,
  ChevronLeft, ChevronRight, LogOut, Building2
} from 'lucide-react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/financeiro', label: 'Financeiro', icon: Wallet },
  { path: '/obrigacoes', label: 'Obrigações', icon: ClipboardList },
  { path: '/legalizacao', label: 'Legalização', icon: Scale },
]

const roleBadge = {
  admin: 'bg-red-500 text-white',
  gerente: 'bg-amber-500 text-white',
  user: 'bg-emerald-500 text-white',
}
const roleLabel = { admin: 'Admin', gerente: 'Gerente', user: 'Usuário' }

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
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease, min-width 0.25s ease',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
        boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 68,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 16, flexShrink: 0,
            boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
          }}>C</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>Contaggio</div>
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 1 }}>Sistema Contábil</div>
            </div>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute', top: 80, right: -12,
            width: 24, height: 24, borderRadius: '50%',
            background: '#334155', border: '2px solid #1e293b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#94a3b8', cursor: 'pointer', zIndex: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{ marginBottom: 4 }}>
            {!collapsed && <div style={{ color: '#475569', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', padding: '0 8px', marginBottom: 6, textTransform: 'uppercase' }}>Menu</div>}
          </div>
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
                  background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: active ? '#60a5fa' : '#94a3b8',
                  textDecoration: 'none', fontWeight: active ? 600 : 400,
                  fontSize: 14, transition: 'all 0.15s',
                  borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#cbd5e1' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' } }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {!collapsed && profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: 13,
              }}>
                {(profile.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.name}</div>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }} className={roleBadge[profile.role]}>
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
              color: '#64748b', cursor: 'pointer', fontSize: 13,
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}
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
          background: 'white', borderBottom: '1px solid #e2e8f0',
          padding: '0 24px', height: 60, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={16} style={{ color: '#94a3b8' }} />
            <span style={{ color: '#64748b', fontSize: 13 }}>
              {allNavItems.find(n => isActive(n.path))?.label || 'Dashboard'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {profile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>{profile.name}</span>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 12,
                }}>
                  {(profile.name || 'A').charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
