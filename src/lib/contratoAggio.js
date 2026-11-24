// Contrato padrão de prestação de serviços contábeis (Aggio) — gerado a partir do cadastro do cliente.
// Dados da contratada: edite aqui quando mudar (ex.: CRC da empresa).
import { preencherModelo, valorPorExtenso, dataExtenso } from './funilPadrao'

export const CONTRATADA = {
  razao: 'R K DOS S ARAUJO CONTABILIDADE',
  fantasia: 'AGGIO CONTÁBIL',
  cnpj: '65.137.472/0001-36',
  endereco: 'Rua Otilina Fernandes da Silva, nº 38, Bairro Nova Esperança, CEP 57.316-458, Arapiraca/AL',
  representante: 'RAYSSA KAWANNE DOS SANTOS',
  cpf: '065.627.044-64',
  crcResponsavel: 'CRC-AL nº 009643',
  crcEmpresa: '', // ex.: 'CRC-AL nº 000000/O' — preencher para constar no contrato
  whatsapp: '(82) 9.8726-9658',
  instagram: '@aggiocontabil',
  email: 'aggiocontabil@gmail.com',
}

const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
const ext = (n) => valorPorExtenso(Number(n) || 0).replace(/ reais?$/, '')

export const SERVICOS_PADRAO = [
  'Escrituração contábil e fiscal;',
  'Apuração de tributos e emissão das guias de recolhimento;',
  'Elaboração e entrega das obrigações acessórias e declarações;',
  'Departamento pessoal: folha de pagamento, admissões, rescisões e eSocial;',
  'Orientação e consultoria contábil, fiscal e trabalhista.',
].join('\n')

export function enquadramentoDe(c) {
  const m = { mei: 'Microempreendedor Individual – MEI', simples_nacional_comercio: 'Empresa optante pelo Simples Nacional – Comércio', simples_nacional_servico: 'Empresa optante pelo Simples Nacional – Serviços', lucro_presumido: 'Empresa tributada pelo Lucro Presumido', lucro_real: 'Empresa tributada pelo Lucro Real' }
  return m[c.tributacao] || 'Profissional liberal / Pessoa Física'
}

export function camposIniciais(c) {
  const hoje = new Date()
  const iso = (d) => d.toISOString().slice(0, 10)
  const ini = c.data_entrada || iso(hoje)
  const fim = new Date(ini + 'T12:00:00'); fim.setFullYear(fim.getFullYear() + 1)
  const dig = (c.cnpj || '').replace(/\D/g, '')
  return {
    contratante_nome: c.razao_social || '',
    contratante_documento_tipo: dig.length === 11 ? 'CPF' : 'CNPJ',
    contratante_documento: c.cnpj || '',
    contratante_endereco: c.endereco || '',
    contratante_representante: '',
    contratante_enquadramento: enquadramentoDe(c),
    lista_servicos: SERVICOS_PADRAO,
    valor_honorarios: c.honorario_valor ? String(c.honorario_valor) : '',
    dia_vencimento: String(c.honorario_dia || 5),
    dia_envio_folha: '20',
    multa_atraso_percentual: '2',
    juros_atraso_percentual: '1',
    mes_reajuste: 'janeiro',
    vigencia_inicio: ini,
    vigencia_fim: iso(fim),
    aviso_previo_dias: '30',
    inadimplencia_dias: '60',
    multa_compensatoria: '1 (um) honorário mensal',
    multa_descumprimento: '1 (um) honorário mensal',
    cidade_assinatura: 'Arapiraca/AL',
    data_assinatura: dataExtenso(),
  }
}

export function textoContrato(f) {
  const C = CONTRATADA
  const crcEmp = C.crcEmpresa ? `, registrada no ${C.crcEmpresa}` : ''
  const contratada = `**CONTRATADA:** **${C.razao}** (nome fantasia ${C.fantasia}), inscrita no CNPJ nº ${C.cnpj}${crcEmp}, com sede na ${C.endereco}, neste ato representada por sua titular ${C.representante}, CPF nº ${C.cpf}, registrada no ${C.crcResponsavel}.`
  const rep = f.contratante_representante ? `, neste ato representado(a) por ${f.contratante_representante}` : ''
  const contratante = `**CONTRATANTE:** **${f.contratante_nome}**, inscrito(a) no ${f.contratante_documento_tipo} nº ${f.contratante_documento}, com endereço em ${f.contratante_endereco}${rep}.`
  const servicos = (f.lista_servicos || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => '- ' + s).join('\n')
  const dados = {
    ...f,
    lista_servicos: servicos,
    valor_honorarios: f.valor_honorarios ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(f.valor_honorarios)) : '[valor]',
    valor_honorarios_extenso: f.valor_honorarios ? valorPorExtenso(f.valor_honorarios) : '[valor por extenso]',
    vigencia_inicio: dataBR(f.vigencia_inicio),
    vigencia_fim: dataBR(f.vigencia_fim),
    aviso_previo_dias_extenso: ext(f.aviso_previo_dias),
    inadimplencia_dias_extenso: ext(f.inadimplencia_dias),
    contratada_email: C.email,
  }
  const corpo = preencherModelo(CORPO, dados)
  const ass = `${f.cidade_assinatura}, ${f.data_assinatura}.

---

**${C.razao} (${C.fantasia})**
CNPJ: ${C.cnpj}
${C.representante} – ${C.crcResponsavel}
CONTRATADA

---

**${f.contratante_nome}**
${f.contratante_documento_tipo}: ${f.contratante_documento}
CONTRATANTE`
  return `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS CONTÁBEIS\n\n${contratada}\n\n${contratante}\n\n${corpo}\n\n${ass}`
}

const CORPO = `Resolvem as Partes acima qualificadas celebrar o presente Contrato, o qual deverá ser lido e interpretado de acordo com a legislação vigente.

## 1. - DO OBJETO

O objeto do presente Contrato consiste na prestação pela CONTRATADA à CONTRATANTE dos seguintes serviços profissionais, para {{contratante_enquadramento}}:

{{lista_servicos}}

**PARÁGRAFO PRIMEIRO – DA OBRIGAÇÃO DE MEIO:** Os serviços prestados constituem obrigação de meio, comprometendo-se a CONTRATADA a atuar com diligência técnica e profissional, sem garantia de resultado específico. Assim, a CONTRATADA atuará com técnica e observância da legislação, mas não garante resultados econômicos, tributários ou financeiros, nem a ausência absoluta de autuações fiscais.

**PARÁGRAFO SEGUNDO:** Para a execução dos serviços há compartilhamento de dados pessoais entre as Partes, sendo necessária a definição de regras sobre o tratamento desses dados. Assim, ao celebrar o presente Contrato, as Partes concordam com o que está aqui definido e se comprometem a cumprir todo o seu texto, sob pena de rescisão contratual.

**PARÁGRAFO TERCEIRO:** A CONTRATADA, na condição de OPERADORA, ciente da necessidade de proteger direitos fundamentais de liberdade e de privacidade e o livre desenvolvimento da personalidade da pessoa natural, assume o compromisso de implementar as disposições previstas na Lei nº 13.709/2018 – Lei Geral de Proteção de Dados Pessoais (LGPD) e demais normativas aplicáveis sobre proteção de dados pessoais, sempre na observância do princípio da boa-fé, exigindo também que todos os seus parceiros e colaboradores façam o mesmo, com o compromisso de que esses dados serão tratados de forma sigilosa e confidencial, mantidos em ambiente seguro e não utilizados para qualquer fim que não os descritos neste instrumento.

**PARÁGRAFO QUARTO:** À OPERADORA é permitido manter e utilizar os dados pessoais enviados pela CONTRATANTE, na condição de CONTROLADORA, durante todo o período contratualmente firmado, para as finalidades relacionadas neste Contrato, respeitando os requisitos de tratamento de dados dispostos na Lei e mantendo a anonimização dos dados, nos termos do art. 16 da Lei nº 13.709/2018.

**PARÁGRAFO QUINTO:** A CONTRATADA não está obrigada a fornecer informações ou documentos após o encerramento do vínculo contratual, sendo esta responsabilidade inteiramente da CONTRATANTE.

**PARÁGRAFO SEXTO:** O compartilhamento de dados mencionado no Parágrafo Segundo desta Cláusula não alcança o compartilhamento no âmbito internacional.

## 2. - DAS CONDIÇÕES DE EXECUÇÃO DOS SERVIÇOS

Os serviços serão executados nas dependências da CONTRATADA, em obediência às seguintes condições:

2.1. A documentação indispensável para o desempenho dos serviços arrolados na Cláusula 1ª será fornecida pela CONTRATANTE através da plataforma digital a ser informada pela CONTRATADA, consistindo, basicamente, em:

2.1.1. Recibos de pagamento de salário, guias do INSS, FGTS, dos tributos federais e estaduais, duplicatas, contas de água, luz e telefone;

2.1.2. Extratos de todas as contas correntes bancárias, cópias de cheques, cobrança de juros de cartões de crédito e taxas administrativas, cédulas de crédito e seguros, bem como o arquivo enviado por e-mail em formato OFX e em PDF;

2.1.3. Notas fiscais de compra, serviços tomados e certificado digital A1;

2.1.4. Controle de frequência dos empregados, comunicação para concessão de férias, admissão ou demissão, afastamentos, exames ocupacionais, bem como correções salariais, mudanças de funções e afins.

2.2. A documentação deverá ser enviada pela CONTRATANTE nos seguintes prazos:

2.2.1. Diariamente ou semanalmente, sendo que, para a folha de pagamento, as informações deverão ser enviadas até o dia {{dia_envio_folha}} do mês;

2.2.2. No mínimo 72 (setenta e duas) horas antes, a comunicação para aviso de férias e aviso prévio de rescisão contratual de empregados, acompanhada de toda a documentação pertinente.

2.3. A CONTRATADA compromete-se a cumprir todos os prazos estabelecidos na legislação de regência quanto aos serviços contratados, especificando-se, porém, os prazos abaixo:

2.3.1. A entrega das guias de recolhimento de tributos e encargos trabalhistas à CONTRATANTE far-se-á com antecedência mínima de 2 (dois) dias do vencimento da obrigação, após o recebimento dos documentos;

2.3.2. A entrega da folha de pagamento, dos recibos de pagamento salarial, de férias e das demais obrigações trabalhistas far-se-á no mínimo até 2 (dois) dias após o recebimento dos documentos.

**PARÁGRAFO ÚNICO:** Os documentos mencionados nos itens 2.3.1 e 2.3.2 serão enviados para o e-mail {{contratada_email}}, respeitando os prazos.

## 3. - DOS DEVERES DA CONTRATADA

3.1. A CONTRATADA desempenhará os serviços enumerados na Cláusula 1ª com todo zelo, diligência e honestidade, observada a legislação vigente, resguardando os interesses da CONTRATANTE, sem prejuízo da dignidade e independência profissionais, sujeitando-se às normas do Código de Ética Profissional do Contador – CEPC, NBC PG 01/2019 do Conselho Federal de Contabilidade. Compromete-se, ainda, a guardar sigilo dos dados compartilhados em razão da execução do Contrato, observando durante todo o tratamento de dados os princípios e fundamentos da Lei nº 13.709/2018 (LGPD) e agindo de acordo com o orientado pela CONTRATANTE, em razão de sua figura como Operadora.

3.2. A CONTRATANTE responsabiliza-se por todos os documentos originais, mantendo a guarda de 5 (cinco) anos para os documentos fiscais (arts. 173 e 174 do CTN) e de 30 (trinta) anos para os documentos pessoais (art. 8º da Portaria MTE nº 269/2015; art. 2º, § 1º, da Portaria MTE nº 1.129/2014), os quais serão entregues virtualmente à CONTRATADA, sendo esta responsável pela guarda das cópias recebidas durante a vigência deste instrumento.

3.3. A CONTRATADA não assume nenhuma responsabilidade pelas consequências de informações, declarações ou documentação inidôneas ou incompletas que lhe forem apresentadas, bem como por omissões próprias da CONTRATANTE ou decorrentes do desrespeito à orientação prestada.

## 4. - DOS DEVERES DA CONTRATANTE, HONORÁRIOS E REEMBOLSOS

4.1. Obriga-se a CONTRATANTE a fornecer à CONTRATADA todos os dados, documentos e informações necessários ao bom desempenho dos serviços ora contratados, em tempo hábil, nenhuma responsabilidade cabendo à CONTRATADA caso sejam recebidos intempestivamente. A CONTRATANTE deverá, inclusive, entregar anualmente à CONTRATADA a Carta de Responsabilidade da Administração de que trata a Resolução CFC nº 1.457/13, para o encerramento do exercício contábil. Todos os tratamentos de dados estão justificados por uma base legal trazida pela LGPD, comprometendo-se a CONTRATANTE a orientar o tratamento de forma lícita e a compartilhar os dados para o atendimento das finalidades contratadas, conforme a Cláusula 3ª.

4.1.1. A CONTRATADA não responderá por multas, penalidades ou prejuízos decorrentes da entrega intempestiva, incorreta ou incompleta de documentos pela CONTRATANTE. Do mesmo modo, documentos enviados fora do prazo, informações falsas, omissões, dados incompletos e falhas operacionais da CONTRATANTE não geram responsabilidade para a CONTRATADA, inclusive quanto a multas fiscais, atrasos em obrigações acessórias, autuações e encargos trabalhistas ou tributários deles decorrentes.

4.2. Para a execução dos serviços constantes da Cláusula 1ª, a CONTRATANTE pagará à CONTRATADA honorários profissionais no valor mensal de {{valor_honorarios}} ({{valor_honorarios_extenso}}), até o dia {{dia_vencimento}} de cada mês, por meio de PIX, transferência ou boleto bancário.

4.2.1. Os honorários pagos após a data avençada no item 4.2 acarretarão à CONTRATANTE o acréscimo de multa de {{multa_atraso_percentual}}% e de juros de {{juros_atraso_percentual}}% ao mês.

4.2.2. Os honorários serão reajustados anualmente, mediante negociação, no mês de {{mes_reajuste}}.

4.2.3. Os parâmetros de fixação para o reajuste terão como base:

- quantidade de funcionários;
- quantidade de notas fiscais (entrada/saída);
- quantidade de lançamentos contábeis;
- tributação;
- salário-mínimo.

4.3. Todos os serviços extraordinários ou paracontábeis que forem necessários ou solicitados pela CONTRATANTE serão cobrados pela CONTRATADA à parte, com valores convencionados entre as Partes.

4.3.1. São considerados serviços extraordinários ou paracontábeis, exemplificativamente:

- constituição de empresa, abertura de filial ou alteração contratual;
- declaração do Imposto de Renda Pessoa Física;
- certidões da JUCEAL e judiciais, entre outras que se fizerem necessárias;
- registro, encadernação e autenticação de livros;
- preenchimento de fichas cadastrais/IBGE, quando for o caso;
- cadastro IBAMA, quando for o caso;
- recálculos (vários consecutivos);
- revisão de tributação, bem como solicitação de restituição e compensação de tributos;
- cálculos periciais.

4.4. Em caso de inadimplência, será enviada Carta de Cobrança à CONTRATANTE, pela qual será realizado o pedido de quitação de qualquer dívida com a CONTRATADA em relação aos serviços aqui mencionados. Não havendo a quitação, a CONTRATANTE fica ciente de que a carta é apresentada também como aviso extrajudicial de protesto junto ao Cartório competente.

**PARÁGRAFO ÚNICO:** A CONTRATANTE tem ciência da Lei nº 9.613/98, alterada pela Lei nº 12.683/2012, especificamente no que trata da lavagem de dinheiro, regulamentada pela Resolução COAF nº 36, de 10 de março de 2021.

## 5. - DA VIGÊNCIA E RESCISÃO

5.1. O presente Contrato vigorará de {{vigencia_inicio}} a {{vigencia_fim}}, considerando-se renovado automaticamente por igual período caso não haja manifestação de distrato entre as Partes.

5.2. O presente Contrato poderá ser rescindido por qualquer das Partes, mediante comunicação prévia e escrita, observando-se as disposições abaixo:

I – **Rescisão imotivada:** qualquer das Partes poderá rescindir o presente Contrato sem necessidade de justificativa, desde que comunique a outra Parte por escrito com antecedência mínima de {{aviso_previo_dias}} ({{aviso_previo_dias_extenso}}) dias, a título de aviso prévio.

II – **Rescisão motivada:** constituem hipóteses de rescisão motivada, independentemente de aviso prévio:

a) descumprimento de quaisquer obrigações contratuais previstas neste instrumento;

b) prática de ato que comprometa a confiança, a boa-fé ou a imagem da outra Parte;

c) atraso injustificado no cumprimento das obrigações assumidas;

d) inadimplemento financeiro superior a {{inadimplencia_dias}} ({{inadimplencia_dias_extenso}}) dias;

e) violação de normas legais, regulatórias ou éticas relacionadas ao objeto do Contrato.

III – **Da multa rescisória compensatória (rescisão imotivada):** será devida nas hipóteses de rescisão imotivada promovida por qualquer das Partes, correspondendo ao valor de {{multa_compensatoria}}, vigente à época da rescisão.

IV – **Da multa por descumprimento contratual (rescisão motivada):** na hipótese de rescisão motivada causada por infração contratual de uma das Partes, a Parte infratora ficará sujeita ao pagamento de multa contratual correspondente a {{multa_descumprimento}}, sem prejuízo de perdas e danos eventualmente comprovados.

V – **Isenção de penalidade:** não haverá incidência de multa:

a) quando a rescisão ocorrer de comum acordo;

b) quando não houver infração contratual.

VI – **Forma da comunicação:** toda comunicação de rescisão deverá ocorrer por escrito, mediante e-mail, notificação extrajudicial, aplicativo de mensagens previamente utilizado entre as Partes ou qualquer meio idôneo que permita comprovação do recebimento.

VII – **Das obrigações pendentes:** a rescisão do Contrato não afasta a obrigação das Partes quanto ao pagamento de valores eventualmente devidos até a data do efetivo encerramento da relação contratual.

5.3. Ocorrendo a transferência dos serviços para outra empresa contábil, a CONTRATANTE deverá informar à CONTRATADA, por escrito, o nome do responsável técnico, CPF, endereço e número da inscrição junto ao Conselho Regional de Contabilidade, sem o que não será possível à CONTRATADA cumprir as formalidades ético-profissionais, inclusive a transmissão de dados e informações necessárias à continuidade dos serviços, em relação às quais, diante de eventual inércia da CONTRATANTE, estará desobrigada de cumprimento, conforme o disposto no Código de Ética do Contador – NBC PG 01/2019.

5.4. A falta de pagamento de qualquer parcela de honorários faculta à CONTRATADA suspender a execução dos serviços ora pactuados, sem prejuízo do disposto no item 5.2, inciso II, alínea "d".

## 6. - DO FORO

Fica eleito o Foro da Comarca de Arapiraca/AL, com expressa renúncia a qualquer outro, por mais privilegiado que seja, para dirimir as questões oriundas da interpretação e execução do presente Contrato.

E, por estarem justas e contratadas, as Partes assinam o presente instrumento em 2 (duas) vias de igual teor, para um só efeito.`
