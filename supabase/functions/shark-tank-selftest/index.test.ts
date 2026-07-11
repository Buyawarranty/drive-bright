// Deno test that invokes the shark-tank-selftest edge function end-to-end.
//
// Runs against the deployed function and asserts every internal check passes.
// The caller must have an active management admin session; when
// LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN is present it is used, otherwise the
// test is skipped so CI doesn't hard-fail without an authenticated session.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assert } from 'https://deno.land/std@0.224.0/assert/assert.ts';

const url = Deno.env.get('SUPABASE_URL');
const token = Deno.env.get('LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN')
  ?? Deno.env.get('SUPABASE_TEST_ACCESS_TOKEN');

Deno.test('shark-tank-selftest: all mode gates behave correctly end-to-end', async () => {
  if (!url || !token) {
    console.warn('skipping: SUPABASE_URL or access token not set');
    return;
  }

  const res = await fetch(`${url}/functions/v1/shark-tank-selftest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const body = await res.json();
  assertEquals(res.status, 200, `HTTP ${res.status}: ${JSON.stringify(body)}`);
  assert(body.ok === true, `selftest failed: ${JSON.stringify(body, null, 2)}`);
  assert(Array.isArray(body.results) && body.results.length >= 7, 'expected all 7+ checks to run');
  for (const r of body.results) {
    assert(r.passed, `check "${r.name}" failed: ${r.detail}`);
  }
});
