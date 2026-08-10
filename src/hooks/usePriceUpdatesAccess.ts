import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Roles allowed to see Price Updates: management + accounts only. */
export const PRICE_UPDATES_ROLES = [
  'admin',
  'super_admin',
  'sales_manager',
  'accounts',
  'accounts_manager',
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
        // Use a SECURITY DEFINER function so the check works even when the
        // direct admin_users read is blocked by RLS or row visibility rules.
        const { data, error } = await supabase.rpc('has_price_updates_access', { _user_id: uid });
        if (mounted) {
          setAllowed(error ? false : data === true);
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
