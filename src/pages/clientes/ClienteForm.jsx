import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { Btn, Input, Select } from '../../components/ui'

const emptyPortal = { portal_name: '', login: '', senha: '', link: '' }
const emptyForm = {
  cnpj: '', razao_social: '', nome_fantasia: '', inscricao_municipal: '',
  inscricao_estadual: '', tributacao: '', data_entrada: '', aberto_pelo_escritorio: '',
  status: 'ativo', email: '', telefone: '', endereco: '', portal_credentials: [],
}

export default function ClienteForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id && id !== 'novo')

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) fetchCliente()
  }, [id])

  async function fetchCliente() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').eq('id', id).single()
    if (data) setForm({ ...data, portal_credentials: data.portal_credentials || [] })
    setLoading(false)
  }

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function addPortal() { setForm(f => ({ ...f, portal_credentials: [...f.portal_credentials, { ...emptyPortal }] })) }
  function updatePortal(i, field, value) {
    setForm(f => { const p = [...f.portal_credentials]; p[i] = { ...p[i], [field]: value }; return { ...f, portal_credentials: p } })
  }
  function removePortal(i) { setForm(f => ({ ...f, portal_credentials: f.portal_credentials.filter((_, idx) => idx !== i) })) }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)
    if (isEdit) await supabase.from('clients').update(form).eq('id', id)
    else await supabase.from('clients').insert(form)
    setSaving(false)
    navigate('/clientes')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>

  return (
    <div style={{ maxWidth: 860, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <button onClick={() => navigate('/clientes')} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: '3px 0 0' }}>{isEdit ? 'Atualize as informações do cliente' : 'Preencha os dados para cadastrar um novo cliente'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Dados da Empresa */}
        <Section title="Dados da Empresa">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="CNPJ *" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" required />
            <Input label="Razão Social *" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} required />
            <Input label="Nome Fantasia" value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} />
            <Input label="Inscrição Municipal" value={form.inscricao_municipal} onChange={e => set('inscricao_municipal', e.target.value)} />
            <Input label="Inscrição Estadual" value={form.inscricao_estadual} onChange={e => set('inscricao_estadual', e.target.value)} />
            <Select label="Regime Tributário" value={form.tributacao} onChange={e => set('tributacao', e.target.value)}>
              <option value="">Selecione...</option>
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
              <option value="mei">MEI</option>
            </Select>
            <Input label="E-mail" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            <Input label="Telefone" value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(11) 99999-9999" />
            <div style={{ gridColumn: '1 / -1' }}>
              <Input label="Endereço" value={form.endereco} onChange={e => set('endereco', e.target.value)} />
            </div>
          </div>
        </Section>

        {/* Informações do Escritório */}
        <Section title="Informações do Escritório">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Input label="Data de Entrada" type="date" value={form.data_entrada} onChange={e => set('data_entrada', e.target.value)} />
            <Select label="Aberto pelo Escritório" value={form.aberto_pelo_escritorio} onChange={e => set('aberto_pelo_escritorio', e.target.value)}>
              <option value="">Selecione...</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
              <option value="transformado_mei">Transformado do MEI</option>
            </Select>
            <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="suspenso">Suspenso</option>
            </Select>
          </div>
        </Section>

        {/* Portais */}
        <Section title="Senhas de Portais">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {form.portal_credentials.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10, padding: '14px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', alignItems: 'end' }}>
                <Input label="Nome do Portal" value={p.portal_name} onChange={e => updatePortal(i, 'portal_name', e.target.value)} placeholder="e.g. e-CAC, Prefeitura..." />
                <Input label="Login" value={p.login} onChange={e => updatePortal(i, 'login', e.target.value)} placeholder="usuário ou CPF" />
                <Input label="Senha" type="password" value={p.senha} onChange={e => updatePortal(i, 'senha', e.target.value)} placeholder="••••••••" />
                <Input label="Link" value={p.link} onChange={e => updatePortal(i, 'link', e.target.value)} placeholder="https://..." />
                <div style={{ paddingBottom: 14 }}>
                  <button type="button" onClick={() => removePortal(i)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addPortal} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px dashed #cbd5e1', borderRadius: 10, padding: '10px 16px', color: '#3b82f6', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Plus size={14} /> Adicionar portal
            </button>
          </div>
        </Section>

        {/* Botões */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <Btn variant="secondary" onClick={() => navigate('/clientes')}>Cancelar</Btn>
          <Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}</Btn>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>{title}</div>
      {children}
    </div>
  )
}
