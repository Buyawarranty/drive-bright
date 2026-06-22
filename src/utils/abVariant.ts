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

/** Parse a raw `step` query value like "2", "3" into its parts. */
export const parseStepParam = (raw: string | null | undefined): {
  step: number | null;
  variant: AbVariant;
} => {
  if (!raw) return { step: null, variant: null };
  const m = String(raw).trim().match(/^(\d+)([a-zA-Z])?$/);
  if (!m) return { step: null, variant: null };
  const step = parseInt(m[1], 10);
  return { step: Number.isFinite(step) ? step : null, variant: null };
};

/**
 * Returns the active variant. Resolution order:
 *   1. Current URL step suffix (always wins, so links between A and B work).
 *   2. sessionStorage (so reloads / Stripe returns keep the variant).
 */
export const getAbVariant = (): AbVariant => {
  return null;
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
 * (B variant is disabled — always returns without action.)
 */
export const captureAbVariantFromUrl = (): void => {
  // B variant disabled — no-op.
};

/**
 * Ensure the visitor is assigned to an A/B bucket for the given experiment.
 * Sticky across sessions via localStorage. URL variant always wins.
 *
 * Rollout: `bWeight` of all NEW visitors get 'b' (default 25%), the rest get 'a'.
 * Returns the resolved variant ('a' or 'b').
 *
 * NOTE: B variant is currently disabled. All visitors get 'a'.
 */
export const ensureAbVariantAssigned = (
  _experimentKey: string,
  _bWeight = 0.25
): 'a' | 'b' => {
  return 'a';
};


/**
 * Format a step number for the URL. B variant suffix is disabled.
 * `formatStepParam(3)` → `"3"`.
 */
export const formatStepParam = (step: number | string): string => {
  return String(step);
};

/** Numeric step from a raw param value, ignoring variant suffix. */
export const stepNumber = (raw: string | null | undefined): number | null =>
  parseStepParam(raw).step;

/**
 * Record a single A/B variant landing in `ab_variant_visits`. Deduped per
 * (experiment, session) on both the client (sessionStorage flag) and the
 * server (unique index). Safe to call repeatedly.
 */
export const trackAbVariantVisit = async (
  experimentKey: string,
  variant: 'a' | 'b'
): Promise<void> => {
  if (typeof window === 'undefined' || !variant) return;
  const s = safeSession();
  if (!s) return;
  const flagKey = `baw_ab_visit_${experimentKey}`;
  try {
    if (s.getItem(flagKey)) return;
    s.setItem(flagKey, '1');
  } catch {
    /* still try to record */
  }

  const sessionId = (() => {
    try {
      let id = s.getItem('baw_session_id');
      if (!id) {
        id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
        s.setItem('baw_session_id', id);
      }
      return id;
    } catch {
      return null;
    }
  })();

  const visitorId = (() => {
    try {
      let id = localStorage.getItem('baw_visitor_id');
      if (!id) {
        id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
        localStorage.setItem('baw_visitor_id', id);
      }
      return id;
    } catch {
      return null;
    }
  })();

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    await supabase.from('ab_variant_visits').insert({
      experiment_key: experimentKey,
      variant,
      session_id: sessionId,
      visitor_id: visitorId,
      page_path: window.location.pathname + window.location.search,
      source: document.referrer || null,
    });
  } catch (e) {
    // Non-blocking — analytics only.
    // eslint-disable-next-line no-console
    console.warn('[ab] visit insert failed', e);
  }
};

