import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { filterEligibleAbandonedCarts, isEligibleCart } from './abandonedCartEligibility';

const cart = { id: 'cart-1', email: 'prospect@example.test', contact_status: 'not_contacted' };

describe('Abandoned cart exclusions', () => {
  beforeEach(() => rpc.mockReset());
  it('excludes a completed purchase recorded on the cart', () => {
    expect(isEligibleCart({ ...cart, is_converted: true }, new Set())).toBe(false);
    expect(isEligibleCart({ ...cart, converted_at: '2026-10-17T07:33:00Z' }, new Set())).toBe(false);
  });
  it('excludes anyone matched in Customer Management by the history check', async () => {
    rpc.mockResolvedValue({ data: [{ id: cart.id }], error: null });
    expect(await filterEligibleAbandonedCarts([cart])).toEqual([]);
    expect(rpc).toHaveBeenCalledWith('get_excluded_abandoned_cart_ids', { p_cart_ids: [cart.id] });
  });
  it('excludes cancelled carts regardless of casing', () => {
    expect(isEligibleCart({ ...cart, contact_status: ' Cancelled ' }, new Set())).toBe(false);
  });
  it('excludes refunded carts', () => {
    expect(isEligibleCart({ ...cart, contact_status: 'refunded' }, new Set())).toBe(false);
  });
  it('excludes carts marked as having made a claim', () => {
    expect(isEligibleCart({ ...cart, contact_status: 'claimed' }, new Set())).toBe(false);
  });
  it('keeps a genuine prospect when the history check finds no match', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await filterEligibleAbandonedCarts([cart])).toEqual([cart]);
  });
  it('blocks list and export candidates if the history check fails', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('History unavailable') });
    await expect(filterEligibleAbandonedCarts([cart])).rejects.toThrow('History unavailable');
  });
  it('checks every page including carts beyond the 1000-row limit', async () => {
    const carts = Array.from({ length: 1001 }, (_, i) => ({ ...cart, id: `cart-${i}` }));
    rpc.mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'cart-1000' }], error: null });
    const eligible = await filterEligibleAbandonedCarts(carts);
    expect(eligible).toHaveLength(1000);
    expect(eligible.some(c => c.id === 'cart-1000')).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});