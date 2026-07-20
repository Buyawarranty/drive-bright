import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the maximum discount % the currently signed-in staff member may
 * apply on Get Quote / manual orders (page 1).
 *
 * - Value is a whole number 0–100 (e.g. 15 means "up to 15% off").
 * - `null` means "not loaded yet" — treat as no cap while loading.
 * - Admins / super_admins / sales_manager are never capped (return 100).
 * - Sales roles fall back to 20 (system default) if not explicitly set.
 */
export function useAgentDiscountCap() {
  const [maxPct, setMaxPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) { setMaxPct(20); setLoading(false); } return; }
        const { data } = await supabase
          .from('admin_users')
          .select('role, max_discount_pct')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        const role = (data?.role || '').toLowerCase();
        const isManagement = ['admin', 'super_admin', 'sales_manager'].includes(role);
        if (isManagement) { setMaxPct(100); setLoading(false); return; }
        const raw = (data as any)?.max_discount_pct;
        const numeric = raw === null || raw === undefined ? 20 : Number(raw);
        setMaxPct(Number.isFinite(numeric) ? numeric : 20);
      } catch {
        if (!cancelled) setMaxPct(20);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { maxPct: maxPct ?? 20, loading };
}
