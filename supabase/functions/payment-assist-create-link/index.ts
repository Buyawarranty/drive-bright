// Payment Assist — create hosted finance application link
// Docs: https://api-docs.payment-assist.co.uk
// Endpoint: POST {base_url}/begin
// Auth: HMAC-SHA256 signature over sorted+uppercased params using PAYMENT_ASSIST_SECRET_KEY.
// Secrets used:
//   PAYMENT_ASSIST_API_URL     Base URL, e.g. https://api.v1.payment-assist.co.uk
//   PAYMENT_ASSIST_API_KEY     Your api_key
//   PAYMENT_ASSIST_SECRET_KEY  Your secret (prod_… or demo_…) — used for HMAC

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
  vehicle_reg: z.string().max(16).optional(),
})

// Payment Assist HMAC-SHA256 signature:
// Sort keys ascending, uppercase keys, stringify values (booleans → "true"/"false"),
// concatenate as "KEY=value&" and HMAC-SHA256 with the secret, lowercase hex.
async function generateSignature(
  params: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const filtered: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (k === 'signature' || k === 'api_key') continue
    if (v === undefined || v === null || v === '') continue
    let val: string
    if (typeof v === 'boolean') val = v ? 'true' : 'false'
    else if (typeof v === 'object') val = ''
    else val = String(v)
    filtered[k] = val
  }
  const sortedKeys = Object.keys(filtered).sort()
  let pre = ''
  for (const k of sortedKeys) pre += `${k.toUpperCase()}=${filtered[k]}&`

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(pre))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

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

    const rawBase = (Deno.env.get('PAYMENT_ASSIST_API_URL') || 'https://api.v1.payment-assist.co.uk').trim()
    // Strip any legacy path so we always POST to `<base>/begin`
    const base = rawBase.replace(/\/+$/, '').replace(/\/(v1\/applications|begin)$/i, '')
    const beginUrl = `${base}/begin`

    const apiKey = Deno.env.get('PAYMENT_ASSIST_API_KEY')
    const secretKey = Deno.env.get('PAYMENT_ASSIST_SECRET_KEY')
    if (!apiKey) return jsonRes(500, { error: 'PAYMENT_ASSIST_API_KEY not configured' })
    if (!secretKey) return jsonRes(500, { error: 'PAYMENT_ASSIST_SECRET_KEY not configured' })

    const env = secretKey.startsWith('prod_') ? 'live' : 'sandbox'
    const orderId = b.reference || `BAW-${Date.now()}`
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0]
    const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/payment-assist-webhook`

    // Insert pending row so every attempt is auditable.
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
        reference: orderId,
        environment: env,
        status: 'pending',
      })
      .select()
      .single()

    if (insertErr) return jsonRes(500, { error: 'db_insert_failed', detail: insertErr.message })

    // Build the signed payload per Payment Assist docs.
    const payload: Record<string, unknown> = {
      order_id: orderId,
      amount: b.amount_pence,
      f_name: b.customer_first_name || 'Customer',
      s_name: b.customer_last_name || 'Customer',
      addr1: b.customer_address_line1 || 'Not provided',
      postcode: (b.customer_postcode || '').toUpperCase().replace(/\s+/g, ''),
      email: b.customer_email,
      telephone: b.customer_phone,
      town: b.customer_address_city,
      reg_no: b.vehicle_reg,
      description: b.description ?? 'Vehicle warranty',
      success_url: `https://buyawarranty.co.uk/payment-received?ref=${encodeURIComponent(orderId)}`,
      failure_url: `https://buyawarranty.co.uk/payment-fallback?ref=${encodeURIComponent(orderId)}`,
      webhook_url: webhookUrl,
      send_email: Boolean(b.customer_email),
      send_sms: Boolean(b.customer_phone),
      auto_capture: true,
    }

    // Remove undefined/empty before signing so signature matches transmitted body.
    for (const k of Object.keys(payload)) {
      const v = payload[k]
      if (v === undefined || v === null || v === '') delete payload[k]
    }

    const signature = await generateSignature(payload, secretKey)
    const finalBody = { api_key: apiKey, signature, ...payload }

    const upstream = await fetch(beginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(finalBody),
    })

    const rawText = await upstream.text()
    let raw: unknown = rawText
    try { raw = JSON.parse(rawText) } catch { /* keep text */ }

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

    const r = (raw && typeof raw === 'object' ? (raw as any) : {})
    if (r.status && r.status !== 'ok') {
      await admin
        .from('payment_assist_transactions')
        .update({
          status: 'failed',
          last_error: r.msg || 'upstream_error',
          raw_response: r,
        })
        .eq('id', row.id)
      return jsonRes(400, { error: 'payment_assist_error', body: r })
    }

    const applicationUrl = r?.data?.url || null
    const applicationId = r?.data?.token || null

    await admin
      .from('payment_assist_transactions')
      .update({
        status: applicationUrl ? 'link_created' : 'unknown_response',
        provider_application_id: applicationId,
        application_url: applicationUrl,
        last_event: 'created',
        raw_response: r,
      })
      .eq('id', row.id)

    return jsonRes(200, {
      id: row.id,
      application_id: applicationId,
      application_url: applicationUrl,
      reference: orderId,
      raw: r,
    })
  } catch (err: any) {
    console.error('payment-assist-create-link error', err)
    return jsonRes(500, { error: 'internal_error', detail: String(err?.message ?? err) })
  }
})
