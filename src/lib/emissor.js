// Conversa com o emissor de NFS-e que roda no computador do usuário (http://localhost:3333).
// O certificado A1 nunca sai daquele computador: o Contaggio só pede a emissão e guarda o resultado.
import { supabase } from './supabase'

const CHAVE = 'contaggio_emissor_nfse'
const CHAVE_PRESTADOR = 'contaggio_emissor_prestador'

export function configEmissor() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || null } catch { return null }
}
export function salvarConfigEmissor(cfg) {
  localStorage.setItem(CHAVE, JSON.stringify({ url: (cfg.url || 'http://localhost:3333').trim().replace(/\/$/, ''), token: (cfg.token || '').trim() }))
}
export const prestadorLembrado = () => localStorage.getItem(CHAVE_PRESTADOR) || ''
export const lembrarPrestador = (id) => localStorage.setItem(CHAVE_PRESTADOR, id)

export class ErroEmissor extends Error {
  constructor(tipo, mensagem, extra = {}) { super(mensagem); this.tipo = tipo; Object.assign(this, extra) }
}

export async function emissor(caminho, { method = 'GET', body, blob = false } = {}) {
  const cfg = configEmissor()
  if (!cfg?.url || !cfg?.token) throw new ErroEmissor('config', 'Configure o emissor neste computador (endereço e chave de pareamento).')
  let r
  try {
    r = await fetch(`${cfg.url}/api${caminho}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Contaggio-Token': cfg.token },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ErroEmissor('offline', 'Não consegui falar com o emissor de NFS-e neste computador. Abra o emissor (Iniciar.bat) e, se o navegador perguntar sobre acesso à rede local, clique em Permitir.')
  }
  if (blob && r.ok) return r.blob()
  const dados = await r.json().catch(() => null)
  if (!r.ok) throw new ErroEmissor(r.status === 401 ? 'chave' : 'api', dados?.erro || `Erro ${r.status} no emissor`, { status: r.status, dados })
  return dados
}

export const STATUS_NFSE = {
  enviando: { label: 'Enviando', cor: 'blue' },
  autorizada: { label: 'Autorizada', cor: 'green' },
  rejeitada: { label: 'Rejeitada', cor: 'red' },
  pendente_verificacao: { label: 'Pendente · conciliar', cor: 'orange' },
  nao_gerada: { label: 'Não gerada', cor: 'slate' },
  cancelada: { label: 'Cancelada', cor: 'slate' },
}

const digitos = (s) => String(s || '').replace(/\D/g, '')

/** Grava (ou atualiza) o registro da nota no Supabase a partir da resposta do emissor. */
export async function registrarNota(notaEmissor, extra = {}) {
  const n = notaEmissor || {}
  const linha = {
    id_dps: n.idDps,
    status: n.status,
    numero_nfse: n.numeroNfse || null,
    chave_acesso: n.chaveAcesso || null,
    ambiente: n.ambiente || null,
    prestador_cnpj: n.prestadorId || null,
    prestador_nome: n.prestadorNome || null,
    valor: n.servico?.valor ?? null,
    competencia: n.dataCompetencia || null,
    descricao: n.servico?.descricao || null,
    tomador_doc: digitos(n.tomador?.cpfCnpj) || null,
    tomador_nome: n.tomadorNome || n.tomador?.razaoSocial || null,
    erros: n.erros?.length ? n.erros : null,
    updated_at: new Date().toISOString(),
    ...extra,
  }
  const { data, error } = await supabase.from('nfse_notas').upsert(linha, { onConflict: 'id_dps' }).select().single()
  if (error) throw error
  return data
}

/** Baixa XML e DANFSe (PDF) do emissor e guarda no Storage (os XMLs precisam ser guardados por 5 anos). */
export async function guardarArquivos(registro) {
  if (!registro?.chave_acesso) return registro
  const pasta = `nfse/${registro.client_id || 'sem-cliente'}`
  const upd = {}
  try {
    const xml = await emissor(`/notas/${encodeURIComponent(registro.id_dps)}/xml`, { blob: true })
    const path = `${pasta}/NFSe-${registro.chave_acesso}.xml`
    const { error } = await supabase.storage.from('client-documents').upload(path, xml, { upsert: true, contentType: 'application/xml' })
    if (!error) upd.xml_path = path
  } catch { /* segue sem o XML; dá para tentar de novo pela lista */ }
  try {
    const pdf = await emissor(`/notas/${encodeURIComponent(registro.id_dps)}/pdf`, { blob: true })
    const path = `${pasta}/DANFSe-${registro.numero_nfse || registro.chave_acesso}.pdf`
    const { error } = await supabase.storage.from('client-documents').upload(path, pdf, { upsert: true, contentType: 'application/pdf' })
    if (!error) upd.pdf_path = path
  } catch { /* idem */ }
  if (!Object.keys(upd).length) return registro
  const { data } = await supabase.from('nfse_notas').update(upd).eq('id', registro.id).select().single()
  return data || { ...registro, ...upd }
}

export async function linkArquivo(path, dias = 7) {
  if (!path) return null
  const { data } = await supabase.storage.from('client-documents').createSignedUrl(path, dias * 86400)
  return data?.signedUrl || null
}

/** Endereço do tomador pela Receita (BrasilAPI), no formato que a NFS-e Nacional pede. */
export async function enderecoPelaReceita(cnpj) {
  const d = digitos(cnpj)
  if (d.length !== 14) return null
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`)
    if (!r.ok) return null
    const j = await r.json()
    const cMun = digitos(j.codigo_municipio_ibge)
    if (cMun.length !== 7 || !j.logradouro || !j.bairro || digitos(j.cep).length !== 8) return null
    return {
      endereco: {
        cep: digitos(j.cep), logradouro: [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(' '),
        numero: j.numero || 'S/N', complemento: j.complemento || undefined, bairro: j.bairro, cMun,
      },
      resumo: `${j.logradouro}, ${j.numero || 'S/N'} — ${j.bairro}, ${j.municipio}/${j.uf}`,
      razaoSocial: j.razao_social, email: j.email || '',
    }
  } catch { return null }
}
