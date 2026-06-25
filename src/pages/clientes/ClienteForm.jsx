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
  data_saida: '', motivo_saida: '',
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
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjMsg, setCnpjMsg] = useState('')

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
      data_saida: data.data_saida || '',
      motivo_saida: data.motivo_saida || '',
    })
    setLoading(false)
  }

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }
  function setSetor(key, value) {
    setForm(f => ({ ...f, setores_responsaveis: { ...f.setores_responsaveis, [key]: value || null } }))
  }

  async function buscarCNPJ(cnpj) {
    const digits = cnpj.replace(/\D/g, '')
    if (digits.length !== 14) return
    setCnpjLoading(true)
    setCnpjMsg('')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!res.ok) throw new Error('CNPJ não encontrado')
      const d = await res.json()
      const endereco = [d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf, d.cep]
        .filter(Boolean).join(', ')
      setForm(f => ({
        ...f,
        razao_social: d.razao_social || f.razao_social,
        nome_fantasia: d.nome_fantasia || f.nome_fantasia,
        email: d.email || f.email,
        telefone: d.ddd_telefone_1 ? d.ddd_telefone_1.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') : f.telefone,
        endereco: endereco || f.endereco,
      }))
      setCnpjMsg('✅ Dados preenchidos automaticamente')
    } catch {
      setCnpjMsg('⚠️ CNPJ não encontrado na Receita Federal')
    }
    setCnpjLoading(false)
  }

  function addPortal() { setForm(f => ({ ...f, portal_credentials: [...f.portal_credentials, { ...emptyPortal }] })) }
  function updatePortal(i, field, value) {
    setForm(f => { const p = [...f.portal_credentials]; p[i] = { ...p[i], [field]: value }; return { ...f, portal_credentials: p } })
  }
  function removePortal(i) { setForm(f => ({ ...f, portal_credentials: f.portal_credentials.filter((_, idx) => idx !== i) })) }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)

    const payload = {
      cnpj: form.cnpj,
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia || null,
      inscricao_municipal: form.inscricao_municipal || null,
      inscricao_estadual: form.inscricao_estadual || null,
      tributacao: form.tributacao || null,
      email: form.email || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      data_entrada: form.data_entrada || null,
      aberto_pelo_escritorio: form.aberto_pelo_escritorio || null,
      status: form.status,
      data_saida: form.status !== 'ativo' ? (form.data_saida || null) : null,
      motivo_saida: form.status !== 'ativo' ? (form.motivo_saida || null) : null,
      portal_credentials: form.portal_credentials,
      setores_responsaveis: form.setores_responsaveis,
      honorario_valor: form.honorario_valor ? Number(form.honorario_valor) : null,
      honorario_dia: form.honorario_dia ? Number(form.honorario_dia) : 5,
    }

    if (isEdit) {
      const { error } = await supabase.from('clients').update(payload).eq('id', id)
      if (error) { alert('Erro ao salvar cliente: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('clients').insert(payload)
      if (error) { alert('Erro ao cadastrar cliente: ' + error.message); setSaving(false); return }
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
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>CNPJ *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={form.cnpj}
                  onChange={e => { set('cnpj', e.target.value); setCnpjMsg('') }}
                  onBlur={e => buscarCNPJ(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  required
                  style={{ flex: 1, padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', color: '#1e293b', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => buscarCNPJ(form.cnpj)} disabled={cnpjLoading}
                  style={{ padding: '0 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: cnpjLoading ? '#f8fafc' : 'white', cursor: cnpjLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {cnpjLoading ? '...' : '🔍 Buscar'}
                </button>
              </div>
              {cnpjMsg && <div style={{ fontSize: 11, marginTop: 5, color: cnpjMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{cnpjMsg}</div>}
            </div>
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
          {form.status !== 'ativo' && (
            <div style={{ marginTop: 14, background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 12 }}>⚠️ Cliente Inativo / Suspenso — Dados de Saída</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Data de Saída</label>
                  <input type="date" value={form.data_saida} onChange={e => set('data_saida', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #fca5a5', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'white' }} />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Obrigações serão geradas somente até esta data</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Motivo da Saída</label>
                  <input value={form.motivo_saida} onChange={e => set('motivo_saida', e.target.value)}
                    placeholder="Ex: Encerramento da empresa, mudança de escritório..."
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #fca5a5', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'white' }} />
                </div>
              </div>
            </div>
          )}
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
