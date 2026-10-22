import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';

// Exercise the deployed data boundary without credentials or any price rows.
Deno.test('bulk pricing rejects an unsigned request before parsing prices', async () => {
  const response = await fetch('https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/bulk-update-pricing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not valid json',
  });
  await response.text();
  assertEquals(response.status, 401);
});

Deno.test('bulk pricing rejects an invalid caller token', async () => {
  const response = await fetch('https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/bulk-update-pricing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid-test-token' },
    body: JSON.stringify({ pricingData: [] }),
  });
  await response.text();
  assertEquals(response.status, 401);
});