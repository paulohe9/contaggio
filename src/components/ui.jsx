// Componentes UI com inline styles para evitar conflitos com Tailwind

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}

export function Btn({ children, variant = 'primary', size = 'md', onClick, type = 'button', disabled, style = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600,
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s', borderRadius: 10, fontSize: 13,
  }
  const variants = {
    primary: { background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: 'white', padding: size === 'sm' ? '7px 14px' : '10px 18px', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' },
    secondary: { background: 'white', color: '#374151', border: '1px solid #e2e8f0', padding: size === 'sm' ? '7px 14px' : '10px 18px' },
    danger: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: size === 'sm' ? '7px 14px' : '10px 18px' },
    ghost: { background: 'transparent', color: '#64748b', padding: size === 'sm' ? '6px 10px' : '8px 12px' },
    success: { background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', padding: size === 'sm' ? '7px 14px' : '10px 18px' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

export function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'white', borderRadius: 16, border: '1px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 20,
      cursor: onClick ? 'pointer' : 'default', ...style,
    }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, icon, color = '#3b82f6', bg = '#eff6ff', border = '#bfdbfe' }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  )
}

export function Badge({ children, color = 'slate' }) {
  const colors = {
    blue: { bg: '#dbeafe', text: '#1e40af' },
    green: { bg: '#d1fae5', text: '#065f46' },
    yellow: { bg: '#fef9c3', text: '#854d0e' },
    red: { bg: '#fee2e2', text: '#991b1b' },
    purple: { bg: '#ede9fe', text: '#5b21b6' },
    orange: { bg: '#ffedd5', text: '#c2410c' },
    slate: { bg: '#f1f5f9', text: '#475569' },
    emerald: { bg: '#d1fae5', text: '#065f46' },
  }
  const c = colors[color] || colors.slate
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
      {children}
    </span>
  )
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const widths = { sm: 400, md: 480, lg: 600, xl: 760 }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'white', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: widths[size], maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f8fafc', cursor: 'pointer', color: '#64748b', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</label>}
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 10,
  fontSize: 13, color: '#1e293b', background: 'white', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

export function Input({ label, ...props }) {
  return (
    <Field label={label}>
      <input style={inputStyle} {...props}
        onFocus={e => e.target.style.borderColor = '#3b82f6'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
      />
    </Field>
  )
}

export function Select({ label, children, ...props }) {
  return (
    <Field label={label}>
      <select style={{ ...inputStyle, background: 'white' }} {...props}
        onFocus={e => e.target.style.borderColor = '#3b82f6'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
      >
        {children}
      </select>
    </Field>
  )
}

export function Textarea({ label, ...props }) {
  return (
    <Field label={label}>
      <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} {...props}
        onFocus={e => e.target.style.borderColor = '#3b82f6'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
      />
    </Field>
  )
}

export function Table({ headers, children, loading }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={headers.length} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Carregando...
              </div>
            </td></tr>
          ) : children}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '52px 24px', textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13, marginBottom: 20 }}>{description}</div>}
      {action}
    </div>
  )
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: '10px 18px', fontSize: 13, fontWeight: active === t.key ? 600 : 400,
          color: active === t.key ? '#2563eb' : '#64748b', background: 'none', border: 'none',
          borderBottom: active === t.key ? '2px solid #2563eb' : '2px solid transparent',
          cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {t.icon && <span>{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  )
}
