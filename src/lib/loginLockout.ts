import { supabase } from '@/integrations/supabase/client';

/**
 * Brute-force protection for every password sign-in surface
 * (customer /auth, sales login, dealer portal).
 *
 * The database function check_login_lockout counts 'login_failed' events in
 * customer_login_attempts over a sliding 15-minute window, ignoring anything
 * before the most recent successful sign-in. At 5 failures the account is
 * locked until the oldest relevant failure ages out.
 */
export const LOCKOUT_MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MINUTES = 15;

export interface LockoutStatus {
  locked: boolean;
  failedCount: number;
  retryAfterSeconds: number;
}

const OPEN: LockoutStatus = { locked: false, failedCount: 0, retryAfterSeconds: 0 };

/**
 * Fail-open by design: if the check itself is unavailable, a legitimate user
 * must never be blocked from signing in. Supabase Auth's own throttling still
 * applies underneath.
 */
export const checkLoginLockout = async (email: string): Promise<LockoutStatus> => {
  try {
    const rpc = supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: { locked?: boolean; failed_count?: number; retry_after_seconds?: number } | null; error: unknown }>;
    const { data, error } = await rpc('check_login_lockout', {
      p_email: email.trim().toLowerCase(),
    });
    if (error || !data) return OPEN;
    return {
      locked: !!data.locked,
      failedCount: Number(data.failed_count) || 0,
      retryAfterSeconds: Number(data.retry_after_seconds) || 0,
    };
  } catch {
    return OPEN;
  }
};

export const lockoutMessage = (retryAfterSeconds: number): string => {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many unsuccessful sign-in attempts. This account is locked for about ${minutes} minute${minutes === 1 ? '' : 's'} — please try again later or use "Forgot your password?".`;
};
