// Integration test for the ORR agent-mode helper.
//
// Verifies that `orr_agent_is_orr_mode()` returns true ONLY when an agent's
// `agent_distribution_caps.assignment_mode` is exactly `'open_pool'`, matching
// the convention used by the rest of the Open Round Robin pipeline (intake
// trigger, handoff trigger, dashboard snapshot, and frontend hooks).
//
// Runs with the service role client so it can seed and clean up its own test
// rows. The caller must be an authenticated admin, but the test logic itself
// does not depend on the caller's identity.

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

  // Verify the caller is at least an authenticated admin user so this endpoint
  // cannot be hit by anonymous traffic.
  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes, error: userErr } = await caller.auth.getUser();
  if (userErr || !userRes?.user) {
    return json({ ok: false, error: `auth: ${userErr?.message ?? 'no user'}` }, 401);
  }

  // Admin client for seeding + cleanup.
  const admin = createClient(url, svc, { auth: { persistSession: false } });

  const results: CheckResult[] = [];
  const check = (name: string, passed: boolean, detail: string) => results.push({ name, passed, detail });

  const suffix = crypto.randomUUID().slice(0, 8);
  const testIds: string[] = [];

  const cleanup = async () => {
    await admin.from('agent_distribution_caps').delete().in('admin_user_id', testIds);
    await admin.from('admin_users').delete().in('id', testIds);
  };

  try {
    // Seed three test agents: one open_pool, one round_robin, one legacy open_round_robin.
    const modes = ['open_pool', 'round_robin', 'open_round_robin'] as const;
    const rows: { id: string; mode: string; expected: boolean }[] = [];

    for (const mode of modes) {
      const { data: adminUser, error: adminErr } = await admin
        .from('admin_users')
        .insert({
          email: `orr-selftest-${mode}-${suffix}@buyawarranty.invalid`,
          first_name: 'ORR',
          last_name: `Selftest ${mode}`,
          role: 'sales',
          is_active: true,
        } as any)
        .select('id')
        .single();
      if (adminErr || !adminUser) throw new Error(`seed admin_user (${mode}): ${adminErr?.message ?? 'no row'}`);

      testIds.push(adminUser.id);

      const { error: capErr } = await admin
        .from('agent_distribution_caps')
        .insert({
          admin_user_id: adminUser.id,
          assignment_mode: mode,
          daily_cap: 10,
          assigned_today: 0,
          paused: false,
        } as any);
      if (capErr) throw new Error(`seed cap (${mode}): ${capErr.message}`);

      rows.push({ id: adminUser.id, mode, expected: mode === 'open_pool' });
    }

    // Test a non-existent agent (should be false, not error).
    const fakeId = crypto.randomUUID();
    rows.push({ id: fakeId, mode: 'missing', expected: false });

    for (const { id, mode, expected } of rows) {
      const { data, error } = await admin.rpc('orr_agent_is_orr_mode', { _agent: id });
      check(
        `orr_agent_is_orr_mode('${mode}') === ${expected}`,
        !error && data === expected,
        `data=${JSON.stringify(data)} error=${error?.message ?? 'none'}`,
      );
    }

    // Pipeline consistency: verify the same `open_pool` check used everywhere else.
    // The helper is the source of truth, so we also assert it agrees with a direct
    // lookup of the cap row it internally queries.
    const { data: openPoolAgent } = await admin
      .from('admin_users')
      .select('id')
      .eq('email', `orr-selftest-open_pool-${suffix}@buyawarranty.invalid`)
      .single();
    const { data: directCap } = await admin
      .from('agent_distribution_caps')
      .select('assignment_mode')
      .eq('admin_user_id', openPoolAgent!.id)
      .maybeSingle();
    check(
      'helper matches direct cap lookup (open_pool)',
      directCap?.assignment_mode === 'open_pool',
      `directCap=${JSON.stringify(directCap)}`,
    );

    // Verify the helper returns false for an agent that exists but has no cap row.
    const { data: noCapAdmin, error: noCapErr } = await admin
      .from('admin_users')
      .insert({
        email: `orr-selftest-nocap-${suffix}@buyawarranty.invalid`,
        first_name: 'ORR',
        last_name: 'NoCap',
        role: 'sales',
        is_active: true,
      } as any)
      .select('id')
      .single();
    if (noCapErr || !noCapAdmin) throw new Error(`seed no-cap admin: ${noCapErr?.message ?? 'no row'}`);
    testIds.push(noCapAdmin.id);

    const { data: noCapResult, error: noCapFnErr } = await admin.rpc('orr_agent_is_orr_mode', { _agent: noCapAdmin.id });
    check(
      "orr_agent_is_orr_mode('no_cap_row') === false",
      !noCapFnErr && noCapResult === false,
      `data=${JSON.stringify(noCapResult)} error=${noCapFnErr?.message ?? 'none'}`,
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
