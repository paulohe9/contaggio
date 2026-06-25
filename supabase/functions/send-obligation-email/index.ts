import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { obligation_id, client_id, sent_to, subject, message } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Gera token e salva log
    const { data: log, error: logError } = await supabase
      .from('obligation_email_logs')
      .insert({ obligation_id, client_id, sent_to, subject })
      .select()
      .single()

    if (logError) throw logError

    const trackingUrl = `https://contaggio.vercel.app/acesso/${log.token}`

    const emailBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:#0a0b0d;padding:28px 36px;text-align:center">
            <div style="color:#C9960A;font-size:22px;font-weight:900;letter-spacing:0.06em">AGGIO</div>
            <div style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-top:2px">Contábil</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px">
            <p style="color:#1e293b;font-size:16px;font-weight:700;margin:0 0 16px">${subject}</p>
            <div style="color:#475569;font-size:14px;line-height:1.7;white-space:pre-wrap">${message}</div>
            <!-- CTA -->
            <div style="text-align:center;margin:32px 0">
              <a href="${trackingUrl}"
                style="display:inline-block;background:linear-gradient(135deg,#C9960A,#8a6500);color:#0a0b0d;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:800;font-size:15px;letter-spacing:0.02em">
                Visualizar Detalhes →
              </a>
            </div>
            <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">
              Este e-mail foi enviado pela Aggio Contábil. Em caso de dúvidas, entre em contato conosco.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0">
            <p style="color:#cbd5e1;font-size:11px;text-align:center;margin:0">© 2025 Aggio Contábil · Todos os direitos reservados</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    // Envia via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Aggio Contábil <onboarding@resend.dev>',
        to: [sent_to],
        subject,
        html: emailBody,
      }),
    })

    const resendData = await resendRes.json()
    if (!resendRes.ok) throw new Error(resendData.message || 'Erro ao enviar e-mail')

    return new Response(JSON.stringify({ ok: true, token: log.token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
