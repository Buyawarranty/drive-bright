// End-to-end self-test for the Open Lead Pool ("shark tank") Mode toggle.
//
// Runs as the CALLER (their JWT is forwarded) so the RPCs see the caller's
// auth.uid(). The caller must be an active management admin (admin / super_admin
// / sales_manager) — the same policy that protects shark_tank_settings.
//
// Verifies end-to-end that `enabled` + `dry_run` in shark_tank_settings correctly
// gate `shark_tank_take_next`:
//
//   1. enabled = false                  -> raises `shark_tank_disabled_for_team`
//   2. enabled = true,  dry_run = true  -> pool populates on INSERT (audit intact)
//                                          AND take_next raises `shark_tank_dry_run`
//                                          AND the queued lead is NOT stamped 'held'
//   3. enabled = true,  dry_run = false -> take_next locks the queued lead
//                                          (status='held', held_by = caller)
//
// The pre-existing settings row (id=1) is snapshotted and restored on exit, and
// all seeded rows (team, membership, lead, pool, audit) are cleaned up.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CheckResult = { name: string; passed: boolean; detail: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ ok: false, error: 'missing_bearer_token' }, 401);
  }

  // Admin client (service_role) for seeding + cleanup + settings restore.
  const admin = createClient(url, svc, { auth: { persistSession: false } });

  // Caller client (their JWT) — this is what actually invokes the RPC, so
  // auth.uid() inside the function resolves to the caller.
  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve the caller's admin_user row.
  const { data: userRes, error: userErr } = await caller.auth.getUser();
  if (userErr || !userRes?.user) {
    return json({ ok: false, error: `auth: ${userErr?.message ?? 'no user'}` }, 401);
  }
  const { data: adminRow, error: adminErr } = await admin
    .from('admin_users')
    .select('id, role, is_active')
    .eq('user_id', userRes.user.id)
    .maybeSingle();
  if (adminErr || !adminRow) {
    return json({ ok: false, error: `admin lookup: ${adminErr?.message ?? 'not_admin'}` }, 403);
  }
  if (!adminRow.is_active || !['admin', 'super_admin', 'sales_manager'].includes(adminRow.role as string)) {
    return json({ ok: false, error: 'caller must be active management' }, 403);
  }

  const results: CheckResult[] = [];
  const check = (name: string, passed: boolean, detail: string) => results.push({ name, passed, detail });

  // Snapshot settings so we can restore on exit.
  const { data: originalSettings, error: snapErr } = await admin
    .from('shark_tank_settings')
    .select('enabled, dry_run, team_ids')
    .eq('id', 1)
    .maybeSingle();
  if (snapErr || !originalSettings) {
    return json({ ok: false, error: `settings snapshot: ${snapErr?.message ?? 'missing'}` });
  }

  // Snapshot the caller's existing team membership (so we can restore it —
  // we're going to temporarily move them onto the throwaway team so the pool
  // gate resolves correctly).
  const { data: existingMembership } = await admin
    .from('lead_team_members')
    .select('id, team_id, workstream_new_leads, workstream_recontact, workstream_renewals')
    .eq('admin_user_id', adminRow.id)
    .maybeSingle();

  const suffix = crypto.randomUUID().slice(0, 8);
  let teamId: string | null = null;
  let leadId: string | null = null;

  const cleanup = async () => {
    // Restore settings first.
    await admin.from('shark_tank_settings').update({
      enabled: originalSettings.enabled,
      dry_run: originalSettings.dry_run,
      team_ids: originalSettings.team_ids,
    }).eq('id', 1);
    // Restore membership.
    if (existingMembership) {
      await admin.from('lead_team_members')
        .update({
          team_id: existingMembership.team_id,
          workstream_new_leads: existingMembership.workstream_new_leads,
          workstream_recontact: existingMembership.workstream_recontact,
          workstream_renewals: existingMembership.workstream_renewals,
        })
        .eq('admin_user_id', adminRow.id);
    } else {
      await admin.from('lead_team_members').delete().eq('admin_user_id', adminRow.id);
    }
    if (leadId) {
      await admin.from('shark_tank_pool').delete().eq('lead_id', leadId);
      await admin.from('shark_tank_audit').delete().eq('lead_id', leadId);
      await admin.from('sales_leads').delete().eq('id', leadId);
    }
    if (teamId) await admin.from('lead_teams').delete().eq('id', teamId);
  };

  try {
    // Seed team.
    const { data: teamIns, error: teamErr } = await admin
      .from('lead_teams')
      .insert({ name: `zzz-selftest-${suffix}`, color: '#64748b', is_active: true } as any)
      .select('id')
      .single();
    if (teamErr) throw new Error(`seed team: ${teamErr.message}`);
    teamId = teamIns.id;

    // Move caller onto that team.
    if (existingMembership) {
      const { error: mvErr } = await admin
        .from('lead_team_members')
        .update({ team_id: teamId, workstream_new_leads: true })
        .eq('admin_user_id', adminRow.id);
      if (mvErr) throw new Error(`membership move: ${mvErr.message}`);
    } else {
      const { error: insErr } = await admin
        .from('lead_team_members')
        .insert({ team_id: teamId, admin_user_id: adminRow.id, workstream_new_leads: true } as any);
      if (insErr) throw new Error(`membership insert: ${insErr.message}`);
    }

    // ─────────────────────── Check 1: enabled=false ───────────────────────
    await admin.from('shark_tank_settings')
      .update({ enabled: false, dry_run: true, team_ids: [teamId] })
      .eq('id', 1);

    const r1 = await (caller as any).rpc('shark_tank_take_next', { _team_id: teamId });
    check(
      'enabled=false: take_next raises shark_tank_disabled_for_team',
      !!r1.error && /shark_tank_disabled_for_team/.test(r1.error.message ?? ''),
      `error=${r1.error?.message ?? 'none'} data=${JSON.stringify(r1.data)}`,
    );

    // ─────────────────────── Check 2: dry_run ─────────────────────────────
    await admin.from('shark_tank_settings')
      .update({ enabled: true, dry_run: true, team_ids: [teamId] })
      .eq('id', 1);

    // Insert a fresh lead assigned to the caller so the enqueue trigger fires.
    const { data: leadIns, error: leadErr } = await admin
      .from('sales_leads')
      .insert({
        first_name: 'Selftest',
        last_name: suffix,
        phone: `07${Math.floor(100000000 + Math.random() * 899999999)}`,
        source: 'website',
        status: 'new',
        assigned_to: adminRow.id,
      } as any)
      .select('id')
      .single();
    if (leadErr) throw new Error(`seed lead: ${leadErr.message}`);
    leadId = leadIns.id;

    const { data: poolRow } = await admin
      .from('shark_tank_pool')
      .select('status, team_id')
      .eq('lead_id', leadId)
      .maybeSingle();
    check(
      'dry_run: enqueue trigger populates pool row (queued)',
      !!poolRow && poolRow.status === 'queued' && poolRow.team_id === teamId,
      `pool=${JSON.stringify(poolRow)}`,
    );

    const r2 = await (caller as any).rpc('shark_tank_take_next', { _team_id: teamId });
    check(
      'dry_run: take_next raises shark_tank_dry_run',
      !!r2.error && /shark_tank_dry_run/.test(r2.error.message ?? ''),
      `error=${r2.error?.message ?? 'none'}`,
    );

    const { data: poolAfterDry } = await admin
      .from('shark_tank_pool')
      .select('status, held_by')
      .eq('lead_id', leadId)
      .maybeSingle();
    check(
      'dry_run: lead remains queued (no lock stamped)',
      poolAfterDry?.status === 'queued' && !poolAfterDry?.held_by,
      `pool_after_dry=${JSON.stringify(poolAfterDry)}`,
    );

    const { count: dryAudits } = await admin
      .from('shark_tank_audit')
      .select('*', { count: 'exact', head: true })
      .eq('actor_id', adminRow.id)
      .eq('action', 'take_blocked_dry_run');
    check(
      'dry_run: blocked attempt writes audit row',
      (dryAudits ?? 0) >= 1,
      `blocked_audits=${dryAudits}`,
    );

    // ─────────────────────── Check 3: live ────────────────────────────────
    await admin.from('shark_tank_settings')
      .update({ enabled: true, dry_run: false, team_ids: [teamId] })
      .eq('id', 1);

    const r3 = await (caller as any).rpc('shark_tank_take_next', { _team_id: teamId });
    check(
      'live: take_next succeeds and returns the queued lead',
      !r3.error && r3.data?.[0]?.lead_id === leadId,
      `error=${r3.error?.message ?? 'none'} data=${JSON.stringify(r3.data)}`,
    );

    const { data: poolAfterLive } = await admin
      .from('shark_tank_pool')
      .select('status, held_by, held_until')
      .eq('lead_id', leadId)
      .maybeSingle();
    check(
      'live: pool row stamped held for the taker',
      poolAfterLive?.status === 'held'
        && poolAfterLive?.held_by === adminRow.id
        && !!poolAfterLive?.held_until,
      `pool_after_live=${JSON.stringify(poolAfterLive)}`,
    );

    // Audit trail should include a 'taken' event too.
    const { count: takenAudits } = await admin
      .from('shark_tank_audit')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('action', 'taken');
    check(
      'live: taken event written to audit',
      (takenAudits ?? 0) >= 1,
      `taken_audits=${takenAudits}`,
    );
  } catch (e: any) {
    check('unhandled_exception', false, e?.message ?? String(e));
  } finally {
    await cleanup();
  }

  const ok = results.every((r) => r.passed);
  return json({ ok, checks: results.length, passed: results.filter((r) => r.passed).length, results });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
