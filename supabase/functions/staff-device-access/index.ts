import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders as sdkCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'https://esm.sh/zod@3.25.76';
import { hashStaffDevice, staffDeviceAllowed } from '../_shared/staff-device.ts';

const headers = { ...sdkCorsHeaders, 'Access-Control-Allow-Headers': `${sdkCorsHeaders['Access-Control-Allow-Headers']}, x-staff-device`, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('request'), label: z.string().min(1).max(100) }).strict(),
  z.object({ action: z.literal('check') }).strict(),
  z.object({ action: z.literal('report'), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), offset: z.number().int().min(0).max(100000).default(0) }).strict(),
  z.object({ action: z.literal('decide'), device: z.string().uuid(), approve: z.boolean() }).strict(),
  z.object({ action: z.literal('acknowledge'), attempt: z.string().uuid() }).strict(),
  z.object({ action: z.literal('signin'), email: z.string().email().max(254), password: z.string().min(1).max(128), label: z.string().min(1).max(100) }).strict(),
]);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Invalid access request' }, 400);
    const body = parsed.data;
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const hash = await hashStaffDevice(req.headers.get('x-staff-device') || '');
    if (!hash) return json({ error: 'This browser cannot store its device credential. Enable browser storage and retry.' }, 400);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || null;
    const email = body.action === 'signin' ? body.email.trim().toLowerCase() : null;
    let session: unknown;
    let userId: string | undefined;
    if (body.action === 'signin') {
      // Bound automated attempts before verifying a password. Unknown account responses remain generic.
      const { data: locked, error: lockError } = await db.rpc('check_login_lockout', { p_email: email });
      if (lockError) return json({ error: 'Sign-in check temporarily unavailable' }, 503);
      if (locked?.locked) return json({ error: 'Account temporarily locked. Please try again later.' }, 429);
      const anon = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false } });
      const signed = await anon.auth.signInWithPassword({ email: email || '', password: body.password });
      userId = signed.data.user?.id;
      if (signed.error || !userId) {
        const { data: staff } = await db.from('admin_users').select('user_id').eq('email', email).maybeSingle();
        if (staff) {
          const { error: logError } = await db.rpc('staff_access_log_attempt', { p_user_id: staff.user_id, p_email: email, p_hash: hash, p_outcome: 'invalid_credentials', p_ip: ip, p_label: body.label });
          if (logError) return json({ error: 'Sign-in temporarily unavailable' }, 503);
        }
        return json({ error: 'Invalid email or password.' }, 401);
      }
      session = signed.data.session;
    } else {
      const bearer = req.headers.get('Authorization');
      if (!bearer?.startsWith('Bearer ')) return json({ error: 'Sign in first' }, 401);
      const result = await db.auth.getUser(bearer.slice(7));
      if (result.error || !result.data.user) return json({ error: 'Sign in first' }, 401);
      userId = result.data.user.id;
    }
    if (!userId) return json({ error: 'Sign in first' }, 401);
    const { data: staff, error: staffError } = await db.from('admin_users').select('user_id,email,is_active,archived_at,access_expires_at').eq('user_id', userId).maybeSingle();
    if (staffError) return json({ error: 'Unable to check staff access' }, 503);
    if (!staff) return body.action === 'signin' ? json({ error: 'Invalid staff credentials' }, 403) : json({ allowed: true, is_staff: false });
    const active = staff.is_active && !staff.archived_at && (!staff.access_expires_at || Date.parse(staff.access_expires_at) > Date.now());
    if (body.action === 'signin' || body.action === 'request') {
      if (active) {
        const { data: existing } = await db.from('staff_approved_devices').select('id').eq('user_id', userId).eq('credential_hash', hash).maybeSingle();
        if (!existing) {
          const { error: insertError } = await db.from('staff_approved_devices').upsert({ user_id: userId, credential_hash: hash, device_label: body.label, status: 'pending' }, { onConflict: 'user_id,credential_hash', ignoreDuplicates: true });
          if (insertError) return json({ error: 'Unable to request device approval' }, 503);
        }
      }
      const { data: access, error: accessError } = await db.rpc('staff_device_access', { p_user_id: userId, p_hash: hash });
      if (accessError) return json({ error: 'Unable to check device approval' }, 503);
      const outcome = !active ? 'inactive_account' : access.allowed ? 'signin_allowed' : 'device_blocked';
      const { error: logError } = await db.rpc('staff_access_log_attempt', { p_user_id: userId, p_email: staff.email, p_hash: hash, p_outcome: outcome, p_ip: ip, p_label: body.label });
      if (logError) return json({ error: 'Unable to record access attempt' }, 503);
      if (!access.allowed) return json({ error: 'This device needs administrator approval before accessing the CRM.', approval_required: true }, 403);
      return json({ ...access, session: body.action === 'signin' ? session : undefined });
    }
    if (body.action === 'check') {
      const { data, error } = await db.rpc('staff_device_access', { p_user_id: userId, p_hash: hash });
      return error ? json({ error: 'Unable to check device approval' }, 503) : json(data);
    }
    if (!active || !await staffDeviceAllowed(db, req, userId)) return json({ error: 'Device approval required' }, 403);
    const { data: roles, error: rolesError } = await db.from('user_roles').select('role').eq('user_id', userId).in('role', ['admin', 'super_admin']);
    if (rolesError || !roles?.length) return json({ error: 'Administrator access required' }, 403);
    if (body.action === 'decide') {
      const { error } = await db.rpc('staff_device_decide', { p_caller: userId, p_device: body.device, p_approve: body.approve });
      return error ? json({ error: 'Unable to update device approval' }, 400) : json({ saved: true });
    }
    if (body.action === 'acknowledge') {
      const { error } = await db.from('staff_access_attempts').update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId }).eq('id', body.attempt);
      return error ? json({ error: 'Unable to acknowledge alert' }, 400) : json({ saved: true });
    }
    const { data, error } = await db.rpc('staff_device_report', { p_caller: userId, p_from: body.from, p_to: body.to, p_offset: body.offset });
    return error ? json({ error: 'Unable to load staff access log' }, 400) : json(data);
  } catch { return json({ error: 'Staff access service temporarily unavailable' }, 503); }
});