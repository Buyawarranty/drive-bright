import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';

/**
 * Lightweight hook that returns the count of orphaned/recoverable leads.
 * Used by the Recovery pill in LeadsFilters for badge count.
 */
export const useOrphanedLeadCount = () => {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [cartsRes, leadsRes] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('abandoned_carts')
            .select('id, email, phone, is_converted, contact_status')
            .gte('step_abandoned', 2)
        ),
        fetchAllRows(() =>
          supabase
            .from('sales_leads')
            .select('id, email, phone, abandoned_cart_id, status')
        ),
      ]);

      const carts = cartsRes.data || [];
      const leads = leadsRes.data || [];

      const linkedCartIds = new Set(
        leads.filter((l: any) => l.abandoned_cart_id).map((l: any) => l.abandoned_cart_id)
      );
      const existingEmails = new Set(
        leads.map((l: any) => l.email?.toLowerCase()).filter(Boolean)
      );
      const existingPhones = new Set(
        leads.map((l: any) => l.phone?.replace(/[^0-9]/g, '')).filter((p: string) => p && p.length >= 10)
      );

      // Build terminal emails set from sales_leads
      const terminalEmails = new Set(
        leads.filter((l: any) => ['converted', 'lost', 'fake_lead'].includes(l.status))
          .map((l: any) => l.email?.toLowerCase()).filter(Boolean)
      );

      const orphanCount = carts.filter((cart: any) => {
        if (linkedCartIds.has(cart.id)) return false;
        const cartEmail = cart.email?.toLowerCase();
        if (cartEmail && existingEmails.has(cartEmail)) return false;
        if (cart.is_converted === true) return false;
        if (cartEmail && terminalEmails.has(cartEmail)) return false;
        const cartPhone = cart.phone?.replace(/[^0-9]/g, '') || '';
        if (cartPhone.length >= 10 && existingPhones.has(cartPhone)) return false;
        if (cart.contact_status && ['contacted', 'follow_up', 'quote_sent', 'converted', 'lost', 'fake_lead', 'duplicate'].includes(cart.contact_status)) return false;
        return true;
      }).length;

      setCount(orphanCount);
    } catch (err) {
      console.error('Error counting orphaned leads:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 5 minutes
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, refresh };
};
