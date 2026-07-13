// Bumper — create hosted PayLater / PayNow application link for admin/sales quotes.
// Mirrors payment-assist-create-link so sales can text/email a link without going
// through the full customer checkout flow.
//
// Secrets: BUMPER_API_KEY, BUMPER_SECRET_KEY
// Endpoint: POST https://api.bumper.co/v2/apply/

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'

const BodySchema = z.object({
  amount_pounds: z.number().positive(),
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
  product_type: z.enum(['paylater', 'paynow']).optional(),
  send_sms: z.boolean().optional(),
  send_email: z.boolean().optional(),
})

// Bumper HMAC-SHA256: sort keys asc, UPPERCASE key, value as-is, join "KEY=value&"
// (excludes api_key, signature, product_description, preferred_product_type, additional_data)
async function generateSignature(payload: Record<string, unknown>, secret: string): Promise<string> {
  const excluded = new Set(['api_key', 'signature', 'product_description', 'preferred_product_type', 'additional_data'])
  const filtered: Record<string, string> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (excluded.has(k)) continue
    if (v === undefined || v === null) { filtered[k] = ''; continue }
    if (typeof v === 'boolean') { filtered[k] = v ? 'True' : 'False'; continue }
    filtered[k] = String(v)
  }
  const sorted = Object.keys(filtered).sort()
  let str = ''
  for (const k of sorted) str += `${k.toUpperCase()}=${filtered[k]}&`

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(str))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const jsonRes = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonRes(401, { error: 'Unauthorized' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authed = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
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

    const apiKey = Deno.env.get('BUMPER_API_KEY')
    const secretKey = Deno.env.get('BUMPER_SECRET_KEY')
    if (!apiKey) return jsonRes(500, { error: 'BUMPER_API_KEY not configured' })
    if (!secretKey) return jsonRes(500, { error: 'BUMPER_SECRET_KEY not configured' })

    const orderRef = b.reference || `BAW-BMP-${Date.now()}`
    const amountStr = b.amount_pounds.toFixed(2)

    const successUrl = `https://buyawarranty.co.uk/payment-received?ref=${encodeURIComponent(orderRef)}`
    const failureUrl = `https://buyawarranty.co.uk/payment-fallback?ref=${encodeURIComponent(orderRef)}`

    const postcode = (b.customer_postcode || 'SW1A 1AA').toUpperCase()
    const town = b.customer_address_city || 'London'
    const street = b.customer_address_line1 || 'TBC'

    const wantSms = b.send_sms !== false && !!b.customer_phone
    const wantEmail = b.send_email !== false && !!b.customer_email

    const signaturePayload: Record<string, unknown> = {
      amount: amountStr,
      success_url: successUrl,
      failure_url: failureUrl,
      currency: 'GBP',
      order_reference: orderRef,
      first_name: b.customer_first_name || 'Customer',
      last_name: b.customer_last_name || 'Customer',
      email: b.customer_email || '',
      mobile: b.customer_phone || '',
      vehicle_reg: b.vehicle_reg || '',
      flat_number: '',
      building_name: '',
      building_number: '1',
      street,
      town,
      county: '',
      postcode,
      country: 'UK',
      product_id: '4',
      send_sms: wantSms,
      send_email: wantEmail,
    }

    const signature = await generateSignature(signaturePayload, secretKey)

    const bumperBody = {
      ...signaturePayload,
      preferred_product_type: b.product_type || 'paylater',
      api_key: apiKey,
      signature,
      product_description: [{
        item: b.description || 'Vehicle warranty',
        quantity: '1',
        price: amountStr,
      }],
    }

    const upstream = await fetch('https://api.bumper.co/v2/apply/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bumperBody),
    })

    const rawText = await upstream.text()
    let raw: any = rawText
    try { raw = JSON.parse(rawText) } catch { /* keep text */ }

    if (!upstream.ok) {
      console.error('bumper upstream error', upstream.status, raw)
      return jsonRes(200, {
        error: raw?.message || raw?.msg || `Bumper HTTP ${upstream.status}`,
        upstream_status: upstream.status,
        body: raw,
      })
    }

    const applicationUrl = raw?.data?.redirect_url || raw?.data?.url || null
    const applicationToken = raw?.token || raw?.data?.token || null

    if (!applicationUrl) {
      return jsonRes(200, { error: 'No application URL returned', body: raw })
    }

    return jsonRes(200, {
      application_url: applicationUrl,
      token: applicationToken,
      reference: orderRef,
      raw,
    })
  } catch (err: any) {
    console.error('bumper-create-link error', err)
    return jsonRes(500, { error: 'internal_error', detail: String(err?.message ?? err) })
  }
})
