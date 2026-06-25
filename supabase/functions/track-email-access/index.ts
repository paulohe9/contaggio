import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token, ip, user_agent } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Busca o log pelo token
    const { data: log, error: findErr } = await supabase
      .from('obligation_email_logs')
      .select('id, access_count, first_accessed_at')
      .eq('token', token)
      .single()

    if (findErr || !log) {
      return new Response(JSON.stringify({ ok: false, error: 'Token inválido' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()

    // Registra o acesso individual
    await supabase.from('obligation_email_access_logs').insert({
      token,
      ip_address: ip || null,
      user_agent: user_agent || null,
    })

    // Atualiza contadores no log principal
    await supabase.from('obligation_email_logs').update({
      access_count: log.access_count + 1,
      first_accessed_at: log.first_accessed_at || now,
      last_accessed_at: now,
    }).eq('token', token)

    // Retorna dados da obrigação para exibir na página
    const { data: full } = await supabase
      .from('obligation_email_logs')
      .select('subject, obligation_id, obligations(title, description, due_date, status), clients(razao_social)')
      .eq('token', token)
      .single()

    return new Response(JSON.stringify({ ok: true, data: full }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
