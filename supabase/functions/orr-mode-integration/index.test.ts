// Deno integration test for the orr-mode-integration edge function.
//
// Calls the deployed endpoint and asserts every mode check passes. The caller
// must be an authenticated admin; when LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN is
// present it is used, otherwise the test is skipped so CI doesn't hard-fail
// without an authenticated session.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assert } from 'https://deno.land/std@0.224.0/assert/assert.ts';

const url = Deno.env.get('SUPABASE_URL');
const token = Deno.env.get('LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN')
  ?? Deno.env.get('SUPABASE_TEST_ACCESS_TOKEN');

Deno.test('orr-mode-integration: orr_agent_is_orr_mode only returns true for open_pool', async () => {
  if (!url || !token) {
    console.warn('skipping: SUPABASE_URL or access token not set');
    return;
  }

  const res = await fetch(`${url}/functions/v1/orr-mode-integration`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const body = await res.json();
  assertEquals(res.status, 200, `HTTP ${res.status}: ${JSON.stringify(body)}`);
  assert(body.ok === true, `integration test failed: ${JSON.stringify(body, null, 2)}`);
  assert(Array.isArray(body.results) && body.results.length >= 5, 'expected all 5+ checks to run');
  for (const r of body.results) {
    assert(r.passed, `check "${r.name}" failed: ${r.detail}`);
  }
});
