import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const hoje = new Date()
    const anoAtual = hoje.getFullYear()
    const mesAtual = hoje.getMonth() // 0-indexed
    const inicioMes = new Date(anoAtual, mesAtual, 1).toISOString().slice(0, 10)
    const fimMes = new Date(anoAtual, mesAtual + 1, 0).toISOString().slice(0, 10)

    const resultados: Record<string, unknown> = {}

    // ─── 1. TRANSAÇÕES FINANCEIRAS RECORRENTES ───────────────────────────────
    const { data: recorrentes } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('is_recurring', true)

    let finInserts = 0
    if (recorrentes && recorrentes.length > 0) {
      for (const t of recorrentes) {
        // Verifica se já existe uma transação com mesma description+type neste mês
        const { data: existente } = await supabase
          .from('financial_transactions')
          .select('id')
          .eq('description', t.description)
          .eq('type', t.type)
          .gte('due_date', inicioMes)
          .lte('due_date', fimMes)
          .limit(1)

        if (existente && existente.length > 0) continue

        // Calcula o dia de vencimento no mês atual
        const diaOriginal = t.due_date ? new Date(t.due_date + 'T00:00:00').getDate() : 1
        const dia = Math.min(diaOriginal, new Date(anoAtual, mesAtual + 1, 0).getDate())
        const novaData = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

        await supabase.from('financial_transactions').insert({
          type: t.type,
          description: t.description,
          amount: t.amount,
          due_date: novaData,
          status: 'pendente',
          category: t.category,
          client_id: t.client_id,
          notes: t.notes,
          is_recurring: true,
          bank_account_id: t.bank_account_id,
        })
        finInserts++
      }
    }
    resultados.financeiro = `${finInserts} transação(ões) gerada(s)`

    // ─── 2. OBRIGAÇÕES RECORRENTES (mensais) ─────────────────────────────────
    const { data: templates } = await supabase
      .from('obligation_templates')
      .select('*')

    const { data: clientes } = await supabase
      .from('clients')
      .select('id, tributacao, setores_responsaveis')
      .eq('status', 'ativo')

    const sectorMap: Record<string, string> = {
      'Fiscal': 'fiscal', 'Pessoal': 'pessoal', 'Contábil': 'contabil',
      'Societário': 'societario', 'DP': 'pessoal',
    }

    let oblInserts = 0
    if (templates && clientes) {
      for (const tpl of templates) {
        if (tpl.periodicity !== 'mensal') continue

        const tribs: string[] = Array.isArray(tpl.tributacao) ? tpl.tributacao : [tpl.tributacao]
        const clientesFiltrados = tribs.includes('todos')
          ? clientes
          : clientes.filter(c => tribs.includes(c.tributacao))

        const dia = Math.min(Number(tpl.due_day || 15), 28)

        for (const cli of clientesFiltrados) {
          // Verifica se já existe obrigação deste template para este cliente neste mês
          const { data: existente } = await supabase
            .from('obligations')
            .select('id')
            .eq('client_id', cli.id)
            .eq('title', tpl.name)
            .gte('due_date', inicioMes)
            .lte('due_date', fimMes)
            .limit(1)

          if (existente && existente.length > 0) continue

          const novaData = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

          const sectorKey = sectorMap[tpl.category] || null
          const responsibleId = sectorKey && cli.setores_responsaveis
            ? cli.setores_responsaveis[sectorKey] || null
            : null

          // Competência com offset
          const offset = Number(tpl.competencia_offset || 0)
          let competencia = null
          if (offset !== 0) {
            const compDate = new Date(anoAtual, mesAtual + offset, 1)
            competencia = compDate.toISOString().slice(0, 10)
          }

          await supabase.from('obligations').insert({
            client_id: cli.id,
            title: tpl.name,
            description: tpl.description || '',
            due_date: novaData,
            status: 'pendente',
            periodicity: 'mensal',
            category: tpl.category || '',
            responsible_id: responsibleId,
            enviar_cliente: tpl.enviar_cliente || false,
            ...(competencia ? { competencia } : {}),
          })
          oblInserts++
        }
      }
    }
    resultados.obrigacoes = `${oblInserts} obrigação(ões) gerada(s)`

    return new Response(JSON.stringify({ ok: true, mes: inicioMes, ...resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
