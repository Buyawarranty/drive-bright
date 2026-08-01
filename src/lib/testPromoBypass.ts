// Manager-only test promo codes (e.g. 99% off) used for QA of the checkout flow.
// The public checkout can NEVER price below £120: the lowered display floor only
// applies to signed-in managers, and the server independently gates the real
// bypass to a manager JWT in supabase/functions/_shared/price-floor.ts.

import { supabase } from '@/integrations/supabase/client';

const TEST_BYPASS_CODES = new Set(['SAVE99GOLDEN']);

/** £1 floor for manager test codes (Stripe minimum is £0.30). */
export const TEST_MINIMUM_PRICE = 1;

/** Standard hard floor mirroring ABSOLUTE_MIN_GBP on the server. Public customers can never go below this. */
export const STANDARD_MINIMUM_PRICE = 120;

const MANAGER_FLAG_KEY = 'baw_manager_price_bypass';
const MANAGER_ROLES = new Set(['admin', 'super_admin', 'sales_manager']);

let managerFlag: boolean | null = null;

function readCachedManagerFlag(): boolean {
  if (managerFlag !== null) return managerFlag;
  try {
    managerFlag = sessionStorage.getItem(MANAGER_FLAG_KEY) === '1';
  } catch {
    managerFlag = false;
  }
  return managerFlag;
}

function writeManagerFlag(value: boolean) {
  managerFlag = value;
  try {
    sessionStorage.setItem(MANAGER_FLAG_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** True only when the current session belongs to a manager (cached, sync). */
export function isManagerPriceBypassAllowed(): boolean {
  return readCachedManagerFlag();
}

/**
 * Refresh the manager flag from Supabase. Safe to call on app mount and after
 * auth state changes; public/anonymous visitors always resolve to false.
 */
export async function refreshManagerPriceBypass(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) {
      writeManagerFlag(false);
      return false;
    }
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    const allowed = Array.isArray(roles) && roles.some((r: any) => MANAGER_ROLES.has(r?.role));
    writeManagerFlag(!!allowed);
    return !!allowed;
  } catch {
    writeManagerFlag(false);
    return false;
  }
}

export function isTestBypassCode(code?: string | null): boolean {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  if (!c) return false;
  return c.startsWith('TEST') || TEST_BYPASS_CODES.has(c);
}

/**
 * Returns the price floor to apply given the currently applied promo codes.
 * Public customers are always clamped at £120; only signed-in managers using a
 * TEST bypass code can go lower.
 */
export function minimumPriceForCodes(codes: Array<{ code: string }> = []): number {
  if (!isManagerPriceBypassAllowed()) return STANDARD_MINIMUM_PRICE;
  return codes.some((c) => isTestBypassCode(c?.code)) ? TEST_MINIMUM_PRICE : STANDARD_MINIMUM_PRICE;
}
