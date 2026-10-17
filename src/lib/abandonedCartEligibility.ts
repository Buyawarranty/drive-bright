import { supabase } from '@/integrations/supabase/client';

type CartCandidate = {
  id: string;
  email: string | null;
  is_converted?: boolean | null;
  converted_at?: string | null;
  contact_status?: string | null;
};

const excludedStatuses = new Set([
  'converted', 'purchased', 'cancelled', 'canceled', 'refunded', 'claim', 'claimed',
]);

export function isEligibleCart(cart: CartCandidate, excludedIds: ReadonlySet<string>): boolean {
  return Boolean(cart.email?.trim()) && !cart.is_converted && !cart.converted_at
    && !excludedStatuses.has(cart.contact_status?.trim().toLowerCase() ?? '')
    && !excludedIds.has(cart.id);
}

/** A failed history check rejects the whole operation, never returning unchecked carts. */
export async function filterEligibleAbandonedCarts<T extends CartCandidate>(carts: T[]): Promise<T[]> {
  const excludedIds = new Set<string>();
  for (let offset = 0; offset < carts.length; offset += 1000) {
    const { data, error } = await supabase.rpc('get_excluded_abandoned_cart_ids', {
      p_cart_ids: carts.slice(offset, offset + 1000).map(cart => cart.id),
    });
    if (error) throw error;
    if (!data) throw new Error('Customer history check returned no result');
    data.forEach(row => excludedIds.add(row.id));
  }
  return carts.filter(cart => isEligibleCart(cart, excludedIds));
}