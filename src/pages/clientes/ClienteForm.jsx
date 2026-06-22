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
  setores_responsaveis: {}, honorario_valor: '', honorario_dia: '5',
}

const SETORES = [
  { key: 'fiscal', label: 'Fiscal' },
  { key: 'pessoal', label: 'Pessoal (DP)' },
  { key: 'contabil', label: 'Contábil' },
  { key: 'societario', label: 'Societário' },
]

export default function ClienteForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id && id !== 'novo')

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [usuarios, setUsuarios] = useState([])

  useEffect(() => {
    fetchUsuarios()
    if (isEdit) fetchCliente()
  }, [id])

  async function fetchUsuarios() {
    const { data } = await supabase.from('users').select('id, name').order('name')
    setUsuarios(data || [])
  }

  async function fetchCliente() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').eq('id', id).single()
    if (data) setForm({
      ...emptyForm,
      ...data,
      portal_credentials: data.portal_credentials || [],
      setores_responsaveis: data.setores_responsaveis || {},
      honorario_valor: data.honorario_valor || '',
      honorario_dia: data.honorario_dia || '5',
    })
    setLoading(false)
  }

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }
  function setSetor(key, value) {
    setForm(f => ({ ...f, setores_responsaveis: { ...f.setores_responsaveis, [key]: value || null } }))
  }

  function addPortal() { setForm(f => ({ ...f, portal_credentials: [...f.portal_credentials, { ...emptyPortal }] })) }
  function updatePortal(i, field, value) {
    setForm(f => { const p = [...f.portal_credentials]; p[i] = { ...p[i], [field]: value }; return { ...f, portal_credentials: p } })
  }
  function removePortal(i) { setForm(f => ({ ...f, portal_credentials: f.portal_credentials.filter((_, idx) => idx !== i) })) }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)

    const payload = {
      ...form,
      honorario_valor: form.honorario_valor ? Number(form.honorario_valor) : null,
      honorario_dia: form.honorario_dia ? Number(form.honorario_dia) : 5,
    }

    let clienteId = id
    if (isEdit) {
      await supabase.from('clients').update(payload).eq('id', id)
    } else {
      const { data } = await supabase.from('clients').insert(payload).select('id').single()
      clienteId = data?.id
    }

    // Sincronizar honorário como transação recorrente
    if (clienteId && Number(form.honorario_valor) > 0) {
      const hoje = new Date()
      const ano = hoje.getFullYear()
      const mes = String(hoje.getMonth() + 1).padStart(2, '0')
      const dia = String(Number(form.honorario_dia) || 5).padStart(2, '0')
      const dueDate = `${ano}-${mes}-${dia}`

      // Verifica se já existe honorário recorrente para esse cliente
      const { data: existing } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('client_id', clienteId)
        .eq('is_recurring', true)
        .eq('category', 'Honorários')
        .maybeSingle()

      if (existing) {
        await supabase.from('financial_transactions')
          .update({ amount: Number(form.honorario_valor), due_date: dueDate })
          .eq('id', existing.id)
      } else {
        await supabase.from('financial_transactions').insert({
          type: 'receita',
          description: `Honorários`,
          amount: Number(form.honorario_valor),
          due_date: dueDate,
          status: 'pendente',
          category: 'Honorários',
          client_id: clienteId,
          is_recurring: true,
        })
      }
    }

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

        {/* Honorários */}
        <Section title="Honorários">
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1e40af' }}>
            O valor será gerado automaticamente como receita recorrente no financeiro todo mês no dia informado.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Valor do Honorário (R$)" type="number" step="0.01" min="0" value={form.honorario_valor} onChange={e => set('honorario_valor', e.target.value)} placeholder="0,00" />
            <Input label="Dia de vencimento (1-28)" type="number" min="1" max="28" value={form.honorario_dia} onChange={e => set('honorario_dia', e.target.value)} placeholder="5" />
          </div>
        </Section>

        {/* Setores Responsáveis */}
        <Section title="Responsáveis por Setor">
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#64748b' }}>
            Defina quem é o responsável de cada setor para este cliente. Ao gerar obrigações, elas serão vinculadas ao responsável do setor correspondente.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {SETORES.map(s => (
              <Select
                key={s.key}
                label={`Responsável — ${s.label}`}
                value={form.setores_responsaveis?.[s.key] || ''}
                onChange={e => setSetor(s.key, e.target.value)}
              >
                <option value="">Não definido</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            ))}
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
