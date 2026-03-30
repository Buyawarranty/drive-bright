import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Lightweight hook that returns the count of orphaned/recoverable leads.
 * Uses server-side count queries instead of fetching all rows for performance.
 */
export const useOrphanedLeadCount = () => {
  const { user, loading: authLoading } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (authLoading || !user?.id) return;

    try {
      // Use count queries instead of fetching all rows
      const [cartsCountRes, leadsCountRes] = await Promise.all([
        supabase
          .from('abandoned_carts')
          .select('id', { count: 'exact', head: true })
          .gte('step_abandoned', 2)
          .or('is_converted.is.null,is_converted.eq.false')
          .or('contact_status.is.null,contact_status.not.in.(contacted,follow_up,quote_sent,converted,lost,fake_lead,duplicate)'),
        supabase
          .from('sales_leads')
          .select('id', { count: 'exact', head: true })
      ]);

      // Approximate orphan count: carts that aren't yet in sales_leads
      // This is an approximation but avoids fetching 10k+ rows
      const totalCarts = cartsCountRes.count || 0;
      const totalLeads = leadsCountRes.count || 0;

      // Simple heuristic: orphans ≈ eligible carts minus a fraction already linked
      // For a more accurate count, we'd need a server-side function
      // But this is much faster than fetching all rows
      const estimatedOrphans = Math.max(0, totalCarts - Math.floor(totalLeads * 0.8));
      setCount(estimatedOrphans);
    } catch (err) {
      console.error('Error counting orphaned leads:', err);
    }
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    refresh();
    // Refresh every 5 minutes
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authLoading, user?.id, refresh]);

  return { count, refresh };
};
