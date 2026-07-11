// Payment Assist webhook — updates transaction status.
// Configure the webhook URL in the Payment Assist merchant dashboard to:
//   https://<project-ref>.supabase.co/functions/v1/payment-assist-webhook
// Optional: set PAYMENT_ASSIST_WEBHOOK_SECRET and Payment Assist to send it
// as either X-Webhook-Secret or a Bearer token — either is accepted.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const jsonRes = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const expected = Deno.env.get('PAYMENT_ASSIST_WEBHOOK_SECRET')
    if (expected) {
      const provided =
        req.headers.get('x-webhook-secret') ||
        req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
        ''
      if (provided !== expected) return jsonRes(401, { error: 'invalid_signature' })
    }

    const rawText = await req.text()
    let body: any = rawText
    try { body = JSON.parse(rawText) } catch { /* keep string */ }

    const reference = body?.reference || body?.data?.reference
    const providerId = body?.id || body?.application_id || body?.data?.id
    const status = (body?.status || body?.event || body?.data?.status || '').toString().toLowerCase()

    const mapped =
      status.includes('approve') || status.includes('paid') || status.includes('complete') || status.includes('succeed')
        ? 'approved'
        : status.includes('decline') || status.includes('reject') || status.includes('fail')
        ? 'declined'
        : status.includes('cancel')
        ? 'cancelled'
        : status || 'updated'

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const match = providerId
      ? admin.from('payment_assist_transactions').update({
          status: mapped,
          last_event: status || 'webhook',
          raw_response: typeof body === 'string' ? { text: body } : body,
        }).eq('provider_application_id', providerId)
      : reference
      ? admin.from('payment_assist_transactions').update({
          status: mapped,
          last_event: status || 'webhook',
          raw_response: typeof body === 'string' ? { text: body } : body,
        }).eq('reference', reference)
      : null

    if (!match) return jsonRes(400, { error: 'missing reference/id' })
    const { error } = await match
    if (error) return jsonRes(500, { error: error.message })

    return jsonRes(200, { ok: true })
  } catch (err: any) {
    console.error('payment-assist-webhook error', err)
    return jsonRes(500, { error: 'internal_error', detail: String(err?.message ?? err) })
  }
})
