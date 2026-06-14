import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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
    if (data) {
      setForm({ ...data, portal_credentials: data.portal_credentials || [] })
    }
    setLoading(false)
  }

  function handleChange(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function addPortal() {
    setForm(f => ({ ...f, portal_credentials: [...f.portal_credentials, { ...emptyPortal }] }))
  }

  function updatePortal(i, field, value) {
    setForm(f => {
      const portals = [...f.portal_credentials]
      portals[i] = { ...portals[i], [field]: value }
      return { ...f, portal_credentials: portals }
    })
  }

  function removePortal(i) {
    setForm(f => ({ ...f, portal_credentials: f.portal_credentials.filter((_, idx) => idx !== i) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }

    if (isEdit) {
      await supabase.from('clients').update(payload).eq('id', id)
    } else {
      await supabase.from('clients').insert(payload)
    }
    setSaving(false)
    navigate('/clientes')
  }

  if (loading) return <div className="p-6 text-slate-500">Carregando...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="text-slate-500 hover:text-slate-700">← Voltar</button>
        <h2 className="text-2xl font-bold text-slate-800">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados principais */}
        <Section title="Dados da Empresa">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CNPJ *" required>
              <input className={input} value={form.cnpj} onChange={e => handleChange('cnpj', e.target.value)} placeholder="00.000.000/0000-00" required />
            </Field>
            <Field label="Razão Social *" required>
              <input className={input} value={form.razao_social} onChange={e => handleChange('razao_social', e.target.value)} required />
            </Field>
            <Field label="Nome Fantasia">
              <input className={input} value={form.nome_fantasia} onChange={e => handleChange('nome_fantasia', e.target.value)} />
            </Field>
            <Field label="Inscrição Municipal">
              <input className={input} value={form.inscricao_municipal} onChange={e => handleChange('inscricao_municipal', e.target.value)} />
            </Field>
            <Field label="Inscrição Estadual">
              <input className={input} value={form.inscricao_estadual} onChange={e => handleChange('inscricao_estadual', e.target.value)} />
            </Field>
            <Field label="Regime Tributário">
              <select className={input} value={form.tributacao} onChange={e => handleChange('tributacao', e.target.value)}>
                <option value="">Selecione...</option>
                <option value="simples_nacional">Simples Nacional</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
                <option value="mei">MEI</option>
              </select>
            </Field>
            <Field label="E-mail">
              <input className={input} type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} />
            </Field>
            <Field label="Telefone">
              <input className={input} value={form.telefone} onChange={e => handleChange('telefone', e.target.value)} />
            </Field>
            <Field label="Endereço" className="md:col-span-2">
              <input className={input} value={form.endereco} onChange={e => handleChange('endereco', e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* Informações do escritório */}
        <Section title="Informações do Escritório">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Data de Entrada">
              <input className={input} type="date" value={form.data_entrada} onChange={e => handleChange('data_entrada', e.target.value)} />
            </Field>
            <Field label="Aberto pelo Escritório">
              <select className={input} value={form.aberto_pelo_escritorio} onChange={e => handleChange('aberto_pelo_escritorio', e.target.value)}>
                <option value="">Selecione...</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
                <option value="transformado_mei">Transformado do MEI</option>
              </select>
            </Field>
            <Field label="Status">
              <select className={input} value={form.status} onChange={e => handleChange('status', e.target.value)}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="suspenso">Suspenso</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* Portais */}
        <Section title="Senhas de Portais">
          <div className="space-y-3">
            {form.portal_credentials.map((p, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <input className={input} placeholder="Nome do portal" value={p.portal_name} onChange={e => updatePortal(i, 'portal_name', e.target.value)} />
                <input className={input} placeholder="Login" value={p.login} onChange={e => updatePortal(i, 'login', e.target.value)} />
                <input className={input} placeholder="Senha" type="password" value={p.senha} onChange={e => updatePortal(i, 'senha', e.target.value)} />
                <div className="flex gap-2">
                  <input className={`${input} flex-1`} placeholder="Link" value={p.link} onChange={e => updatePortal(i, 'link', e.target.value)} />
                  <button type="button" onClick={() => removePortal(i)} className="text-red-500 hover:text-red-700 px-2">✕</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addPortal} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              + Adicionar portal
            </button>
          </div>
        </Section>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/clientes')} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}

const input = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-slate-700 border-b border-slate-100 pb-2">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
