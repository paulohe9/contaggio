// Padrões do funil comercial: etapas, requisitos e modelos de documento.
// Na primeira vez que um funil é aberto, estes padrões são gravados no banco
// e a partir daí tudo é editado pela tela "Configurar funil".

const r = (id, texto, tipo = 'check', campo) => ({ id, texto, tipo, ...(campo ? { campo } : {}) })

export const ETAPAS_PADRAO = {
  servicos: [
    { key: 'novo_lead', label: 'Novo lead', cor: '#64748b', dias_alerta: 2, tipo: 'normal', requisitos: [r('tel', 'WhatsApp / telefone informado', 'campo', 'telefone')] },
    { key: 'contato', label: 'Contato feito', cor: '#3b82f6', dias_alerta: 3, tipo: 'normal', requisitos: [r('nec', 'Entendi a necessidade do cliente')] },
    { key: 'reuniao', label: 'Reunião / Diagnóstico', cor: '#8b5cf6', dias_alerta: 5, tipo: 'normal', requisitos: [r('diag', 'Diagnóstico feito (regime, faturamento, funcionários)'), r('val', 'Valor do honorário definido', 'campo', 'valor_estimado')] },
    { key: 'proposta', label: 'Proposta enviada', cor: '#f59e0b', dias_alerta: 4, tipo: 'normal', requisitos: [r('prop', 'Proposta comercial gerada', 'proposta'), r('env', 'Proposta enviada ao cliente')] },
    { key: 'negociacao', label: 'Negociação', cor: '#f97316', dias_alerta: 7, tipo: 'normal', requisitos: [r('doc', 'CPF/CNPJ informado', 'campo', 'documento'), r('cont', 'Contrato gerado', 'contrato'), r('ass', 'Contrato assinado pelo cliente')] },
    { key: 'ganho', label: 'Fechado ✓', cor: '#10b981', dias_alerta: null, tipo: 'ganho', requisitos: [] },
    { key: 'perdido', label: 'Perdido', cor: '#ef4444', dias_alerta: null, tipo: 'perdido', requisitos: [] },
  ],
  obras: [
    { key: 'novo_lead', label: 'Novo lead', cor: '#64748b', dias_alerta: 2, tipo: 'normal', requisitos: [r('tel', 'WhatsApp / telefone informado', 'campo', 'telefone')] },
    { key: 'contato', label: 'Contato feito', cor: '#3b82f6', dias_alerta: 3, tipo: 'normal', requisitos: [r('sit', 'Entendi a situação da obra')] },
    { key: 'analise', label: 'Análise da obra', cor: '#8b5cf6', dias_alerta: 5, tipo: 'normal', requisitos: [r('area', 'Área da obra (m²) informada', 'campo', 'area_m2'), r('docs', 'Documentos analisados (projeto, alvará, ART/RRT)'), r('val', 'Valor do serviço definido', 'campo', 'valor_estimado')] },
    { key: 'proposta', label: 'Orçamento enviado', cor: '#f59e0b', dias_alerta: 4, tipo: 'normal', requisitos: [r('prop', 'Proposta comercial gerada', 'proposta'), r('env', 'Proposta enviada ao cliente')] },
    { key: 'negociacao', label: 'Negociação', cor: '#f97316', dias_alerta: 7, tipo: 'normal', requisitos: [r('doc', 'CPF/CNPJ informado', 'campo', 'documento'), r('cont', 'Contrato gerado', 'contrato'), r('ass', 'Contrato assinado pelo cliente')] },
    { key: 'ganho', label: 'Fechado ✓', cor: '#10b981', dias_alerta: null, tipo: 'ganho', requisitos: [] },
    { key: 'perdido', label: 'Perdido', cor: '#ef4444', dias_alerta: null, tipo: 'perdido', requisitos: [] },
  ],
}

// Campos que um requisito do tipo "campo" pode exigir
export const CAMPOS_REQUISITO = {
  telefone: 'WhatsApp / telefone',
  email: 'E-mail',
  valor_estimado: 'Valor',
  documento: 'CPF / CNPJ',
  endereco: 'Endereço',
  servico: 'Serviço',
  area_m2: 'Área da obra (m²)',
  municipio: 'Município da obra',
  comissionador_id: 'Comissionador / indicação',
}

export function valorDoCampo(lead, campo) {
  if (['telefone', 'email', 'valor_estimado', 'servico', 'comissionador_id'].includes(campo)) return lead[campo]
  return lead.dados?.[campo]
}

// Um requisito está cumprido?
export function requisitoOk(req, lead, docs = []) {
  if (req.tipo === 'campo') { const v = valorDoCampo(lead, req.campo); return v !== null && v !== undefined && String(v).trim() !== '' }
  if (req.tipo === 'proposta') return docs.some(d => d.lead_id === lead.id && d.tipo === 'proposta')
  if (req.tipo === 'contrato') return docs.some(d => d.lead_id === lead.id && d.tipo === 'contrato')
  return !!lead.requisitos_ok?.[req.id]
}

// ─── Placeholders dos modelos ───────────────────────────────────────
export const PLACEHOLDERS = [
  ['cliente_nome', 'Nome do contato'], ['cliente_empresa', 'Empresa / proprietário'], ['cliente_documento', 'CPF/CNPJ'],
  ['cliente_endereco', 'Endereço'], ['cliente_telefone', 'Telefone'], ['cliente_email', 'E-mail'],
  ['servico', 'Serviço'], ['valor', 'Valor (R$)'], ['valor_extenso', 'Valor por extenso'], ['dia_vencimento', 'Dia de vencimento'],
  ['obra_tipo', 'Tipo de obra'], ['obra_area', 'Área (m²)'], ['obra_municipio', 'Município da obra'], ['obra_cno', 'CNO'],
  ['prazo_execucao', 'Prazo de execução'], ['data_hoje', 'Data de hoje (por extenso)'], ['validade_proposta', 'Validade da proposta'],
  ['responsavel', 'Seu nome'],
]

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const dataExtenso = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`

// Valor por extenso em reais (até 999 milhões)
export function valorPorExtenso(valor) {
  const n = Math.round((Number(valor) || 0) * 100)
  const reais = Math.floor(n / 100), centavos = n % 100
  const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
  const ate999 = (x) => {
    if (x === 0) return ''
    if (x === 100) return 'cem'
    const c = Math.floor(x / 100), resto = x % 100, partes = []
    if (c) partes.push(C[c])
    if (resto < 20) { if (resto) partes.push(U[resto]) } else { partes.push(D[Math.floor(resto / 10)] + (resto % 10 ? ' e ' + U[resto % 10] : '')) }
    return partes.join(' e ')
  }
  const grupos = [[Math.floor(reais / 1e6) % 1000, 'milhão', 'milhões'], [Math.floor(reais / 1000) % 1000, 'mil', 'mil'], [reais % 1000, '', '']]
  const ativos = grupos.filter(([g]) => g)
  let out = ''
  ativos.forEach(([g, s, p], i) => {
    const t = (g === 1 && s === 'mil') ? 'mil' : `${ate999(g)}${s ? ' ' + (g === 1 ? s : p) : ''}`
    const ultimo = i === ativos.length - 1
    out += (i === 0 ? '' : (ultimo && (g < 100 || g % 100 === 0) ? ' e ' : ' ')) + t
  })
  if (reais) out += (reais % 1e6 === 0 && reais >= 1e6 ? ' de reais' : reais === 1 ? ' real' : ' reais')
  if (centavos) out += `${reais ? ' e ' : ''}${ate999(centavos)} centavo${centavos > 1 ? 's' : ''}`
  return out || 'zero reais'
}

export function dadosDoLead(lead, responsavel) {
  const d = lead.dados || {}
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
  const validade = new Date(); validade.setDate(validade.getDate() + 15)
  return {
    cliente_nome: lead.nome || '',
    cliente_empresa: lead.empresa || lead.nome || '',
    cliente_documento: d.documento || '[CPF/CNPJ]',
    cliente_endereco: d.endereco || '[endereço]',
    cliente_telefone: lead.telefone || '',
    cliente_email: lead.email || '',
    servico: lead.servico || '[serviço]',
    valor: lead.valor_estimado ? fmt(lead.valor_estimado) : '[valor]',
    valor_extenso: lead.valor_estimado ? valorPorExtenso(lead.valor_estimado) : '[valor por extenso]',
    dia_vencimento: d.dia_vencimento || '10',
    obra_tipo: d.tipo_obra || '[tipo de obra]',
    obra_area: d.area_m2 || '[área]',
    obra_municipio: d.municipio || '[município]',
    obra_cno: d.cno || 'a ser inscrito',
    prazo_execucao: d.prazo_execucao || '[prazo]',
    data_hoje: dataExtenso(),
    validade_proposta: dataExtenso(validade),
    responsavel: responsavel || '',
  }
}

export function preencherModelo(texto, dados) {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (k in dados ? String(dados[k]) : m))
}

// Texto simples → HTML ("# " título, "## " subtítulo, "---" linha de assinatura)
export function textoParaHtml(texto) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const negrito = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  return texto.split(/\n{2,}/).map(bloco => {
    const b = bloco.trim()
    if (!b) return ''
    if (b.startsWith('# ')) return `<h1>${negrito(b.slice(2))}</h1>`
    if (b.startsWith('## ')) return `<h2>${negrito(b.slice(3))}</h2>`
    if (b === '---') return '<hr/>'
    if (b.startsWith('- ')) return `<ul>${b.split('\n').map(l => `<li>${negrito(l.replace(/^- /, ''))}</li>`).join('')}</ul>`
    return `<p>${negrito(b).replace(/\n/g, '<br/>')}</p>`
  }).join('\n')
}

// ─── Modelos padrão ─────────────────────────────────────────────────
const ESCRITORIO = 'AGGIO CONTÁBIL, inscrita no CNPJ sob o nº [CNPJ DO ESCRITÓRIO], com sede em [ENDEREÇO DO ESCRITÓRIO]'

export const MODELOS_PADRAO = {
  servicos: {
    proposta: { nome: 'Proposta · Serviços contábeis', conteudo: `# PROPOSTA COMERCIAL

**Para:** {{cliente_empresa}}
**A/C:** {{cliente_nome}}
**Data:** {{data_hoje}}

Agradecemos a oportunidade de apresentar nossa proposta. A Aggio Contábil cuida da rotina contábil, fiscal e trabalhista da sua empresa para que você foque no que importa: o seu negócio.

## O que está incluso

- {{servico}}
- Escrituração contábil e fiscal mensal
- Apuração e emissão das guias de impostos
- Entrega das obrigações acessórias exigidas pela legislação
- Atendimento e orientação por WhatsApp e e-mail

## Investimento

**{{valor}}** ({{valor_extenso}}), com vencimento todo dia {{dia_vencimento}}.

Serviços extraordinários (alterações contratuais, certidões avulsas, declarações fora da rotina) são orçados à parte.

## Validade

Esta proposta é válida até {{validade_proposta}}.

## Próximos passos

Aprovando a proposta, enviamos o contrato de prestação de serviços e a lista de documentos para iniciarmos.

Atenciosamente,

{{responsavel}}
Aggio Contábil` },
    contrato: { nome: 'Contrato · Prestação de serviços contábeis', conteudo: `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS

**CONTRATANTE:** {{cliente_empresa}}, inscrito(a) no CPF/CNPJ sob o nº {{cliente_documento}}, com endereço em {{cliente_endereco}}, neste ato representado(a) por {{cliente_nome}}.

**CONTRATADA:** ${ESCRITORIO}.

As partes acima identificadas têm entre si justo e contratado o seguinte:

## CLÁUSULA 1ª – DO OBJETO

A CONTRATADA prestará à CONTRATANTE os serviços de {{servico}}, compreendendo a escrituração contábil e fiscal, a apuração de tributos e a entrega das obrigações acessórias inerentes ao regime tributário da CONTRATANTE.

## CLÁUSULA 2ª – DAS OBRIGAÇÕES DA CONTRATANTE

A CONTRATANTE se obriga a entregar mensalmente, até o dia 05 do mês subsequente, todos os documentos necessários à execução dos serviços, responsabilizando-se pela veracidade e integridade das informações e documentos fornecidos.

## CLÁUSULA 3ª – DAS OBRIGAÇÕES DA CONTRATADA

A CONTRATADA se obriga a executar os serviços com zelo e diligência, observando a legislação vigente e as normas profissionais aplicáveis, e a guardar sigilo sobre as informações a que tiver acesso.

## CLÁUSULA 4ª – DOS HONORÁRIOS

Pelos serviços, a CONTRATANTE pagará à CONTRATADA o valor mensal de **{{valor}}** ({{valor_extenso}}), com vencimento todo dia {{dia_vencimento}}. O valor será reajustado anualmente, e serviços extraordinários serão cobrados à parte, mediante orçamento prévio.

## CLÁUSULA 5ª – DA VIGÊNCIA E RESCISÃO

Este contrato vigora por prazo indeterminado a partir da data de sua assinatura, podendo ser rescindido por qualquer das partes mediante aviso prévio por escrito de 30 (trinta) dias.

## CLÁUSULA 6ª – DO FORO

Fica eleito o foro da comarca de [CIDADE/UF] para dirimir quaisquer dúvidas oriundas deste contrato.

E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor.

[CIDADE/UF], {{data_hoje}}.

---

{{cliente_nome}} — CONTRATANTE

---

AGGIO CONTÁBIL — CONTRATADA` },
  },
  obras: {
    proposta: { nome: 'Proposta · Regularização de obra', conteudo: `# PROPOSTA DE REGULARIZAÇÃO DE OBRA

**Para:** {{cliente_empresa}}
**A/C:** {{cliente_nome}}
**Data:** {{data_hoje}}

## A obra

- Tipo: {{obra_tipo}}
- Área: {{obra_area}} m²
- Local: {{obra_municipio}}
- CNO: {{obra_cno}}

## O que fazemos

- {{servico}}
- Inscrição/regularização do CNO junto à Receita Federal
- Aferição da obra no SERO e apuração da contribuição previdenciária
- Acompanhamento até a emissão da CND de obra, necessária para a averbação no cartório

## Investimento

**{{valor}}** ({{valor_extenso}}).

Os tributos eventualmente apurados sobre a obra não estão incluídos nos honorários e são de responsabilidade do proprietário.

## Prazo

Prazo estimado de {{prazo_execucao}} após a entrega completa da documentação.

## Validade

Proposta válida até {{validade_proposta}}.

Atenciosamente,

{{responsavel}}
Aggio Contábil` },
    contrato: { nome: 'Contrato · Regularização de obra', conteudo: `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS – REGULARIZAÇÃO DE OBRA

**CONTRATANTE:** {{cliente_empresa}}, inscrito(a) no CPF/CNPJ sob o nº {{cliente_documento}}, com endereço em {{cliente_endereco}}.

**CONTRATADA:** ${ESCRITORIO}.

## CLÁUSULA 1ª – DO OBJETO

A CONTRATADA prestará os serviços de {{servico}}, referentes à obra do tipo {{obra_tipo}}, com área de {{obra_area}} m², localizada em {{obra_municipio}}, compreendendo a regularização do CNO, a aferição da obra no SERO e o acompanhamento até a emissão da Certidão Negativa de Débitos (CND) da obra.

## CLÁUSULA 2ª – DAS OBRIGAÇÕES DA CONTRATANTE

A CONTRATANTE fornecerá os documentos necessários, tais como documento de identificação, projeto aprovado, alvará de construção, ART/RRT do responsável técnico, habite-se (quando houver) e notas fiscais de material e mão de obra, responsabilizando-se pela veracidade das informações.

## CLÁUSULA 3ª – DOS HONORÁRIOS

Pelos serviços, a CONTRATANTE pagará à CONTRATADA o valor de **{{valor}}** ({{valor_extenso}}), na forma acordada entre as partes. Os tributos apurados sobre a obra não integram os honorários e são de responsabilidade exclusiva da CONTRATANTE.

## CLÁUSULA 4ª – DO PRAZO

O prazo estimado para conclusão é de {{prazo_execucao}}, contado da entrega completa da documentação, podendo variar conforme exigências dos órgãos públicos.

## CLÁUSULA 5ª – DA RESCISÃO

O contrato poderá ser rescindido por qualquer das partes mediante comunicação por escrito, sendo devidos os honorários proporcionais aos serviços já executados.

## CLÁUSULA 6ª – DO FORO

Fica eleito o foro da comarca de [CIDADE/UF].

[CIDADE/UF], {{data_hoje}}.

---

{{cliente_nome}} — CONTRATANTE

---

AGGIO CONTÁBIL — CONTRATADA` },
  },
}
