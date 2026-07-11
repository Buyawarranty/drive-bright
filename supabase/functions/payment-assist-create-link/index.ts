// Payment Assist — create hosted finance application link
// Docs: https://www.payment-assist.co.uk/ (merchant API)
// The exact endpoint & payload shape can be tuned by setting the env vars:
//   PAYMENT_ASSIST_API_URL   (full URL, e.g. https://api.payassi.st/v1/applications)
//   PAYMENT_ASSIST_ENV       ("sandbox" | "live")   — default "sandbox"
//   PAYMENT_ASSIST_API_KEY   (already stored)
//   PAYMENT_ASSIST_SECRET_KEY (already stored — sent as X-Secret-Key if present)

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'

const BodySchema = z.object({
  amount_pence: z.number().int().positive(),
  description: z.string().max(255).optional(),
  reference: z.string().max(64).optional(),
  sales_lead_id: z.string().uuid().nullable().optional(),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().max(32).optional(),
  customer_first_name: z.string().max(120).optional(),
  customer_last_name: z.string().max(120).optional(),
  customer_postcode: z.string().max(16).optional(),
  customer_address_line1: z.string().max(255).optional(),
  customer_address_city: z.string().max(120).optional(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const jsonRes = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonRes(401, { error: 'Unauthorized' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsErr } = await authed.auth.getClaims(token)
    if (claimsErr || !claims?.claims) return jsonRes(401, { error: 'Unauthorized' })
    const userId = claims.claims.sub as string

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: allowed, error: roleErr } = await admin.rpc('is_admin_or_sales', { _user_id: userId })
    if (roleErr || !allowed) return jsonRes(403, { error: 'Forbidden' })

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return jsonRes(400, { error: parsed.error.flatten().fieldErrors })
    const b = parsed.data

    const apiUrl = Deno.env.get('PAYMENT_ASSIST_API_URL') || 'https://api.payassi.st/v1/applications'
    const apiKey = Deno.env.get('PAYMENT_ASSIST_API_KEY')
    const secretKey = Deno.env.get('PAYMENT_ASSIST_SECRET_KEY')
    const env = (Deno.env.get('PAYMENT_ASSIST_ENV') || 'sandbox').toLowerCase()

    if (!apiKey) return jsonRes(500, { error: 'PAYMENT_ASSIST_API_KEY not configured' })

    const reference = b.reference || `BAW-${Date.now()}`
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0]
    const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/payment-assist-webhook`

    // Insert pending row first so we can always audit the attempt.
    const { data: row, error: insertErr } = await admin
      .from('payment_assist_transactions')
      .insert({
        admin_user_id: userId,
        sales_lead_id: b.sales_lead_id ?? null,
        customer_email: b.customer_email ?? null,
        customer_phone: b.customer_phone ?? null,
        customer_first_name: b.customer_first_name ?? null,
        customer_last_name: b.customer_last_name ?? null,
        amount_pence: b.amount_pence,
        currency: 'GBP',
        description: b.description ?? null,
        reference,
        environment: env,
        status: 'pending',
      })
      .select()
      .single()

    if (insertErr) return jsonRes(500, { error: 'db_insert_failed', detail: insertErr.message })

    const payload = {
      reference,
      amount: b.amount_pence,
      currency: 'GBP',
      description: b.description ?? 'Vehicle warranty',
      customer: {
        email: b.customer_email,
        phone: b.customer_phone,
        first_name: b.customer_first_name,
        last_name: b.customer_last_name,
        address: {
          line1: b.customer_address_line1,
          city: b.customer_address_city,
          postcode: b.customer_postcode,
        },
      },
      redirect_url: `https://buyawarranty.co.uk/payment-received?ref=${encodeURIComponent(reference)}`,
      webhook_url: webhookUrl,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Api-Key': apiKey,
    }
    if (secretKey) headers['X-Secret-Key'] = secretKey

    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const rawText = await upstream.text()
    let raw: unknown = rawText
    try { raw = JSON.parse(rawText) } catch { /* keep as text */ }

    if (!upstream.ok) {
      await admin
        .from('payment_assist_transactions')
        .update({
          status: 'failed',
          last_error: `HTTP ${upstream.status}`,
          raw_response: typeof raw === 'string' ? { text: raw } : (raw as object),
        })
        .eq('id', row.id)
      return jsonRes(502, { error: 'payment_assist_upstream_error', status: upstream.status, body: raw })
    }

    // Tolerant response parsing — Payment Assist responses vary.
    const r = (raw && typeof raw === 'object' ? (raw as any) : {})
    const applicationUrl =
      r.application_url || r.url || r.redirect_url || r.data?.application_url || r.data?.url || null
    const applicationId =
      r.id || r.application_id || r.reference || r.data?.id || null

    await admin
      .from('payment_assist_transactions')
      .update({
        status: applicationUrl ? 'link_created' : 'unknown_response',
        provider_application_id: applicationId,
        application_url: applicationUrl,
        last_event: 'created',
        raw_response: typeof raw === 'string' ? { text: raw } : (raw as object),
      })
      .eq('id', row.id)

    return jsonRes(200, {
      id: row.id,
      application_id: applicationId,
      application_url: applicationUrl,
      reference,
      raw,
    })
  } catch (err: any) {
    console.error('payment-assist-create-link error', err)
    return jsonRes(500, { error: 'internal_error', detail: String(err?.message ?? err) })
  }
})
