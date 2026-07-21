import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BlockedPromo = '3months_free' | '6months_free';

/**
 * Returns the maximum discount % the currently signed-in staff member may
 * apply on Get Quote / manual orders (page 1), plus any promotional
 * features (e.g. free-month bonuses) that a manager has blocked for them.
 *
 * - `maxPct` is a whole number 0–100 (e.g. 15 means "up to 15% off").
 * - `blockedPromos` lists promo feature keys the agent MAY NOT apply.
 * - Admins / super_admins / sales_manager are never capped (return 100
 *   and empty blocked list) so managers can always give any promotion.
 * - Sales roles fall back to 20% cap if not explicitly set.
 */
export function useAgentDiscountCap() {
  const [maxPct, setMaxPct] = useState<number | null>(null);
  const [blockedPromos, setBlockedPromos] = useState<BlockedPromo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) { setMaxPct(20); setBlockedPromos([]); setLoading(false); } return; }
        const { data } = await supabase
          .from('admin_users')
          .select('role, max_discount_pct, blocked_promos')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        const role = (data?.role || '').toLowerCase();
        const isManagement = ['admin', 'super_admin', 'sales_manager'].includes(role);
        if (isManagement) {
          setMaxPct(100);
          setBlockedPromos([]);
          setLoading(false);
          return;
        }
        const raw = (data as any)?.max_discount_pct;
        const numeric = raw === null || raw === undefined ? 20 : Number(raw);
        setMaxPct(Number.isFinite(numeric) ? numeric : 20);
        const rawBlocked = ((data as any)?.blocked_promos || []) as string[];
        setBlockedPromos(rawBlocked.filter(v => v === '3months_free' || v === '6months_free') as BlockedPromo[]);
      } catch {
        if (!cancelled) { setMaxPct(20); setBlockedPromos([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return {
    maxPct: maxPct ?? 20,
    blockedPromos,
    isPromoBlocked: (key: BlockedPromo) => blockedPromos.includes(key),
    loading,
  };
}
