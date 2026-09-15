import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Permission key managed in User Permissions → "Chatbot Pop-up". */
export const CHATBOT_POPUP_PERMISSION = 'tab_chatbot-popup';

/** Roles that get the chatbot pop-up by default. */
export const CHATBOT_POPUP_DEFAULT_ROLES = [
  'admin',
  'super_admin',
  'claims_agent',
  'claims_manager',
] as const;

/**
 * Sales never see the website chat pop-up — not by default, and not even if
 * the permission is switched on by mistake. Handovers are a claims/management
 * job; sales agents work leads. Includes sales managers and sales leads.
 */
export const CHATBOT_POPUP_BLOCKED_ROLES = ['sales', 'sales_lead', 'sales_manager'] as const;

/**
 * Who may see the "Customer waiting for a specialist" chatbot pop-up.
 *
 * Admin, super admin and claims staff get it by default. Everyone else (sales,
 * sales leads, accounts, etc.) only sees it when the "Chatbot Pop-up"
 * permission is explicitly switched on in User Permissions. An explicit `false`
 * always wins, even for the default roles.
 */
export function useChatbotPopupAccess() {
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
          .select('role, permissions')
          .eq('user_id', uid)
          .maybeSingle();
        if (!mounted) return;
        if (error || !data) {
          setAllowed(false);
          return;
        }
        if ((CHATBOT_POPUP_BLOCKED_ROLES as readonly string[]).includes(String(data.role))) {
          setAllowed(false);
          return;
        }
        const perms = (data.permissions as Record<string, boolean> | null) ?? {};
        if (CHATBOT_POPUP_PERMISSION in perms) {
          setAllowed(perms[CHATBOT_POPUP_PERMISSION] === true);
          return;
        }
        // Anyone given the Chatbot Data tab also gets the pop-up, so the two
        // never disagree and nothing shows up empty for them.
        if (perms['tab_chatbot-data'] === true) {
          setAllowed(true);
          return;
        }
        setAllowed(
          (CHATBOT_POPUP_DEFAULT_ROLES as readonly string[]).includes(String(data.role)),
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
