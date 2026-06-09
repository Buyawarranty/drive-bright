/**
 * A/B variant helper.
 *
 * URL pattern: `?step=2b` / `?step=3b` / `?step=4b` triggers the "B" variant.
 * The variant is persisted in sessionStorage so it survives reloads, Stripe
 * cancel-redirects, and any code path that rewrites the step param.
 *
 * Behavioural differences are kept intentionally tiny — currently only:
 *   - phone is NOT required on step 2 in the B variant.
 *
 * All APIs (quote, cart, Stripe, webhooks, emails, Warranties 2000) are
 * unchanged.
 */

export type AbVariant = 'b' | null;

const SESSION_KEY = 'baw_ab_variant';

const safeSession = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

/** Parse a raw `step` query value like "2", "2b", "3B" into its parts. */
export const parseStepParam = (raw: string | null | undefined): {
  step: number | null;
  variant: AbVariant;
} => {
  if (!raw) return { step: null, variant: null };
  const m = String(raw).trim().match(/^(\d+)([a-zA-Z])?$/);
  if (!m) return { step: null, variant: null };
  const step = parseInt(m[1], 10);
  const suffix = (m[2] || '').toLowerCase();
  const variant: AbVariant = suffix === 'b' ? 'b' : null;
  return { step: Number.isFinite(step) ? step : null, variant };
};

/**
 * Returns the active variant. Resolution order:
 *   1. Current URL step suffix (always wins, so links between A and B work).
 *   2. sessionStorage (so reloads / Stripe returns keep the variant).
 */
export const getAbVariant = (): AbVariant => {
  if (typeof window === 'undefined') return null;
  try {
    const urlVariant = parseStepParam(
      new URLSearchParams(window.location.search).get('step')
    ).variant;
    if (urlVariant) return urlVariant;
  } catch {
    /* noop */
  }
  const s = safeSession();
  if (!s) return null;
  const stored = s.getItem(SESSION_KEY);
  return stored === 'b' ? 'b' : null;
};

/** Persist (or clear) the variant in sessionStorage. */
export const setAbVariant = (variant: AbVariant): void => {
  const s = safeSession();
  if (!s) return;
  try {
    if (variant === 'b') s.setItem(SESSION_KEY, 'b');
    else s.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
};

/**
 * Capture the variant from the current URL into sessionStorage so it
 * survives later navigations. Safe to call on every route change.
 */
export const captureAbVariantFromUrl = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const { variant } = parseStepParam(
      new URLSearchParams(window.location.search).get('step')
    );
    if (variant === 'b') setAbVariant('b');
  } catch {
    /* noop */
  }
};

/**
 * Format a step number for the URL, appending the variant suffix when active.
 * `formatStepParam(3)` → `"3b"` if variant is B, otherwise `"3"`.
 */
export const formatStepParam = (step: number | string): string => {
  const base = String(step);
  return getAbVariant() === 'b' ? `${base}b` : base;
};

/** Numeric step from a raw param value, ignoring variant suffix. */
export const stepNumber = (raw: string | null | undefined): number | null =>
  parseStepParam(raw).step;
