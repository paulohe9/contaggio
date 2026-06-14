import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PageHeader, Btn, Badge, Modal, Input, Select, StatCard } from '../components/ui'
import { Plus } from 'lucide-react'

const roleCor = { admin: 'red', gerente: 'blue', user: 'slate' }
const roleLabel = { admin: 'Administrador', gerente: 'Gerente', user: 'Usuário' }
const roleDesc = {
  admin: 'Acesso total ao sistema, incluindo criação de usuários e exclusão',
  gerente: 'Pode criar, editar e inativar registros, mas não excluir',
  user: 'Somente leitura e criação de tarefas básicas',
}

export default function Usuarios() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' })

  useEffect(() => {
    if (profile && profile.role !== 'admin') navigate('/')
  }, [profile])

  useEffect(() => { fetchUsuarios() }, [])

  async function fetchUsuarios() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('name')
    setUsuarios(data || [])
    setLoading(false)
  }

  async function criarUsuario(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_SERVICE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: form.email, password: form.password, email_confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erro ao criar usuário')

      await supabase.from('users').upsert({ id: data.id, email: form.email, name: form.name, role: form.role })
      setSaving(false); setShowModal(false)
      setForm({ name: '', email: '', password: '', role: 'user' })
      fetchUsuarios()
    } catch (err) {
      setError(err.message || 'Erro ao criar usuário')
      setSaving(false)
    }
  }

  async function alterarRole(id, role) {
    if (!confirm(`Alterar função para "${roleLabel[role]}"?`)) return
    await supabase.from('users').update({ role }).eq('id', id)
    setUsuarios(us => us.map(u => u.id === id ? { ...u, role } : u))
  }

  if (profile?.role !== 'admin') return null

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie os usuários e permissões de acesso ao sistema"
        actions={<Btn onClick={() => setShowModal(true)}><Plus size={14} /> Novo Usuário</Btn>}
      />

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total de Usuários" value={usuarios.length} icon="👥" color="#64748b" bg="#f8fafc" border="#e2e8f0" />
        <StatCard label="Administradores" value={usuarios.filter(u => u.role === 'admin').length} icon="🔐" color="#ef4444" bg="#fef2f2" border="#fecaca" />
        <StatCard label="Gerentes" value={usuarios.filter(u => u.role === 'gerente').length} icon="👤" color="#3b82f6" bg="#eff6ff" border="#bfdbfe" />
      </div>

      {/* Info de permissões */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14, marginBottom: 14 }}>Níveis de Permissão</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {Object.entries(roleDesc).map(([role, desc]) => (
            <div key={role} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ marginBottom: 6 }}><Badge color={roleCor[role]}>{roleLabel[role]}</Badge></div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Usuário', 'E-mail', 'Função', 'Alterar Função'].map(h => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
                <div style={{ fontWeight: 600, color: '#475569' }}>Nenhum usuário cadastrado</div>
              </td></tr>
            ) : usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{u.name || '—'}</div>
                      {u.id === profile?.id && <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>você</span>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 18px', color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>{u.email}</td>
                <td style={{ padding: '14px 18px' }}><Badge color={roleCor[u.role]}>{roleLabel[u.role]}</Badge></td>
                <td style={{ padding: '14px 18px' }}>
                  {u.id !== profile?.id ? (
                    <select value={u.role} onChange={e => alterarRole(u.id, e.target.value)}
                      style={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', background: 'white', color: '#374151' }}>
                      <option value="user">Usuário</option>
                      <option value="gerente">Gerente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Seu próprio usuário</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Usuário">
        <form onSubmit={criarUsuario}>
          <Input label="Nome completo *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="João Silva" required />
          <Input label="E-mail *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="joao@escritorio.com" required />
          <Input label="Senha inicial *" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" required minLength={6} />
          <Select label="Função *" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="user">Usuário — somente leitura e tarefas básicas</option>
            <option value="gerente">Gerente — criar, editar e inativar (sem excluir)</option>
            <option value="admin">Administrador — acesso total</option>
          </Select>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar Usuário'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
