import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Roles allowed to see Price Updates: management + accounts only. */
export const PRICE_UPDATES_ROLES = [
  'admin',
  'super_admin',
  'sales_manager',
  'accounts',
  'accounts_manager',
  'accounts_payroll',
] as const;

/**
 * Server-verified access check for the Price Updates tab.
 * Never trusts client-side role props or impersonation.
 * Returns null while loading (treat as "no access").
 */
export function usePriceUpdatesAccess() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (!uid) {
          if (mounted) setAllowed(false);
          return;
        }
        const { data, error } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', uid)
          .eq('is_active', true)
          .maybeSingle();
        if (mounted) {
          setAllowed(
            !error && !!data?.role && (PRICE_UPDATES_ROLES as readonly string[]).includes(data.role)
          );
        }
      } catch {
        if (mounted) setAllowed(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { allowed: allowed === true, loading: allowed === null };
}
