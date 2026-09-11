import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Who gets the top-left website-chat pop-ups.
 *
 * Deliberately a short, named list: the ads/lead-gen person, Abdul Nafay,
 * support@, info@, super admins and managers. Nobody else is alerted, so the
 * people responsible for chats know an unanswered pop-up is theirs.
 */
export const CHAT_ALERT_EMAILS = [
  'support@buyawarranty.co.uk',
  'info@buyawarranty.co.uk',
  'abdulnafay2702@gmail.com',
  'masokdigital482@gmail.com',
] as const;

export const CHAT_ALERT_ROLES = [
  'super_admin',
  'sales_manager',
  'claims_manager',
  'performance_manager',
  'accounts_manager',
  'lead_gen',
] as const;

export function useChatAlertRecipient() {
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
        const { data } = await supabase
          .from('admin_users')
          .select('role, email')
          .eq('user_id', uid)
          .maybeSingle();
        if (!mounted) return;
        const email = String(data?.email ?? '').trim().toLowerCase();
        const role = String(data?.role ?? '');
        setAllowed(
          (CHAT_ALERT_EMAILS as readonly string[]).includes(email) ||
            (CHAT_ALERT_ROLES as readonly string[]).includes(role),
        );
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
