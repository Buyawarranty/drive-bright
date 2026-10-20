import { beforeEach, expect, it, vi } from 'vitest';
const { rows, calls } = vi.hoisted(() => ({ rows: { value: [] as any[] }, calls: [] as any[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const query: any = {};
  for (const method of ['select', 'eq', 'gt', 'ilike', 'gte', 'lte', 'order']) {
    query[method] = (...args: any[]) => { calls.push([method, ...args]); return query; };
  }
  return query;
} } }));
vi.mock('@/utils/supabaseBatchFetch', () => ({ fetchAllRows: async (build: () => any) => {
  build(); return { data: rows.value, error: null };
} }));
import { fetchPayLaterAnniversaries } from './payLaterRevenueData';
beforeEach(() => { calls.length = 0; rows.value = []; });
it('loads only collected later years in their collection period, preserving seller ownership', async () => {
  rows.value = [{ customer_id: 'sale', year_number: 2, amount: 502, paid_amount: 502, status: 'paid', paid_at: '2027-10-20T12:00:00Z', customers: { sale_credit_admin_user_id: 'original-agent' } }];
  const start = new Date('2027-10-01T00:00:00Z');
  const end = new Date('2027-10-31T23:59:59Z');
  const result = await fetchPayLaterAnniversaries(start, end);
  expect(calls).toContainEqual(['gt', 'year_number', 1]);
  expect(calls).toContainEqual(['eq', 'status', 'paid']);
  expect(calls).toContainEqual(['gte', 'paid_at', start.toISOString()]);
  expect(calls).toContainEqual(['lte', 'paid_at', end.toISOString()]);
  expect(calls).toContainEqual(['eq', 'customers.is_deleted', false]);
  expect(calls).toContainEqual(['ilike', 'customers.status', 'active']);
  expect(result[0].revenue).toBe(502);
  expect(result[0].customers.sale_credit_admin_user_id).toBe('original-agent');
});