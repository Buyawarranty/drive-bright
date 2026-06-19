import { supabase } from '@/integrations/supabase/client';

export type LoginEventType =
  | 'login_success'
  | 'login_failed'
  | 'password_reset_requested'
  | 'credentials_resent'
  | 'admin_password_reset'
  | 'admin_impersonate'
  | 'admin_magic_link'
  | 'admin_details_edited';

interface LogArgs {
  email: string;
  event_type: LoginEventType;
  success?: boolean;
  failure_reason?: string;
  customer_id?: string | null;
  triggered_by_admin_id?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget login attempt logger.
 * Never throws — login UX must never be blocked by logging.
 */
export const logLoginAttempt = (args: LogArgs): void => {
  try {
    void supabase.functions
      .invoke('log-login-attempt', { body: args })
      .catch((e) => console.warn('logLoginAttempt failed', e));
  } catch (e) {
    console.warn('logLoginAttempt threw', e);
  }
};
