// Test/QA promo codes (e.g. 99% off) used for checkout-flow testing.
// Anyone who knows a test code can use it; the display floor drops to £1 for
// those codes. The server-side floor in supabase/functions/_shared/price-floor.ts
// matches this behaviour so a test code cannot be blocked by the public £120 floor.

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
    // Manager roles, plus anyone individually switched on in manager_discount_access.
    const { data: granted } = await supabase.rpc('has_manager_discount_access' as any, { _user_id: userId });
    if (granted === true) {
      writeManagerFlag(true);
      return true;
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
 * Test/QA bypass codes drop the floor to £1 for anyone; all other codes keep
 * at least the standard £120 public floor — and never below the term net sell
 * floor (£399 / £769 / £1,099 for 12/24/36mo, halved for motorbikes) when the
 * caller passes it. 13 Sep 2026: promo codes may no longer take a sale below
 * the net floor (a SAVE25 on a £480 quote produced a £360 Stripe sale).
 */
export function minimumPriceForCodes(codes: Array<{ code: string }> = [], termFloorGBP?: number): number {
  if (codes.some((c) => isTestBypassCode(c?.code))) return TEST_MINIMUM_PRICE;
  const termFloor = Number.isFinite(termFloorGBP) && (termFloorGBP ?? 0) > 0 ? Math.ceil(termFloorGBP as number) : 0;
  return Math.max(STANDARD_MINIMUM_PRICE, termFloor);
}
