import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { validGatewayPassword } from '../_shared/gateway-rules.ts';
import { notifyActiveStaff } from '../_shared/staff-security-notice.ts';
import { z } from 'https://esm.sh/zod@3.25.76';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }).strict(),
  z.object({ action: z.literal('change'), password: z.string().min(12).max(128), reason: z.enum(['scheduled', 'departure']).optional() }).strict(),
  z.object({ action: z.literal('remind') }).strict(),
  z.object({ action: z.literal('validate'), token: z.string().uuid() }).strict(),
  z.object({ action: z.literal('verify'), password: z.string().max(128) }).strict(),
]);

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Invalid request' }, 400);
    const body = parsed.data;
    if (body.action === 'status' || body.action === 'change' || body.action === 'remind') {
      const auth = await requireAdmin(req, { allowedRoles: ['admin', 'super_admin'] });
      if (!auth.ok) return auth.response;
      if (body.action === 'remind') return json(await notifyActiveStaff(auth.supabase, false));
      if (body.action === 'change' && !validGatewayPassword(body.password)) {
        return json({ error: 'Use a password between 12 and 128 characters' }, 400);
      }
      const { data, error } = await auth.supabase.rpc('login_gateway_manage', {
        p_user_id: auth.user.id, p_password: body.action === 'change' ? body.password : null,
      });
      if (error) return json({ error: error.message.includes('different gateway') ? 'Choose a different gateway password' : 'Unable to update gateway settings' }, 503);
      if (body.action === 'change') {
        try { return json({ ...data, notices: await notifyActiveStaff(auth.supabase, true) }); }
        catch { return json({ ...data, notices: { failed: true }, notice: 'Gateway changed. Email notices could not complete; please notify staff or resend reminders.' }); }
      }
      return json(data);
    }
    const service = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    if (body.action === 'validate') {
      if (typeof body.token !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.token)) return json({ valid: false });
      const { data, error } = await service.rpc('login_gateway_validate', { p_token: body.token });
      return error ? json({ error: 'Gateway temporarily unavailable' }, 503) : json({ valid: data === true });
    }
    if (body.action !== 'verify' || typeof body.password !== 'string' || body.password.length > 128) return json({ error: 'Invalid request' }, 400);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip');
    if (!ip) return json({ error: 'Gateway temporarily unavailable' }, 503);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    const sourceKey = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await service.rpc('login_gateway_verify', { p_password: body.password, p_source_key: sourceKey });
    return error ? json({ error: 'Gateway temporarily unavailable' }, 503) : json(data);
  } catch {
    return json({ error: 'Unable to check gateway access; please try again' }, 503);
  }
});