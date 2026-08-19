import { supabase } from '@/integrations/supabase/client';

/**
 * Invoke an edge function that requires a signed-in staff session.
 *
 * Long admin sessions (an agent leaving Quotes & Orders open all morning) can hit
 * the gateway with an access token that has just expired, which surfaces as an
 * opaque "Email failed / non-2xx" error even though the function itself is fine.
 * This helper refreshes the session when it is close to expiry and retries once
 * on an auth failure, then returns the real error text so the toast is useful.
 */
export async function invokeWithFreshSession<T = any>(
  fn: string,
  body: unknown
): Promise<{ data: T | null; error: Error | null }> {
  // A stalled auth call (long-open admin tab, flaky network) must never hang the
  // caller — bound getSession/refreshSession and carry on with what we have.
  const bounded = async <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  };

  const ensureSession = async (forceRefresh = false) => {
    const { data } = await bounded(supabase.auth.getSession(), 4000, { data: { session: null } } as any);
    const session = data?.session;
    if (!session) return null;
    const expiresAt = (session.expires_at ?? 0) * 1000;
    const expiringSoon = expiresAt > 0 && expiresAt - Date.now() < 90_000;
    if (forceRefresh || expiringSoon) {
      const { data: refreshed } = await bounded(
        supabase.auth.refreshSession(),
        4000,
        { data: { session: null } } as any
      );
      return refreshed?.session ?? session;
    }
    return session;
  };

  const isAuthError = (err: any) => {
    const msg = `${err?.message || ''} ${err?.status || ''}`.toLowerCase();
    return (
      err?.status === 401 ||
      msg.includes('401') ||
      msg.includes('jwt') ||
      msg.includes('unauthor')
    );
  };

  const readError = async (err: any): Promise<Error> => {
    // FunctionsHttpError carries the real body on err.context (a Response)
    try {
      const ctx = err?.context;
      if (ctx && typeof ctx.text === 'function') {
        const text = await ctx.text();
        if (text) return new Error(`${err.message}: ${text.slice(0, 300)}`);
      }
    } catch {
      /* ignore body read failures */
    }
    return new Error(err?.message || 'Request failed');
  };

  const session = await ensureSession();
  if (!session) {
    return {
      data: null,
      error: new Error('Your staff session has expired. Please sign in again and resend.'),
    };
  }

  const call = async (token: string) =>
    supabase.functions.invoke(fn, {
      body: body as any,
      headers: { Authorization: `Bearer ${token}` },
    });

  let { data, error } = await call(session.access_token);

  if (error && isAuthError(error)) {
    const refreshed = await ensureSession(true);
    if (refreshed) {
      const retry = await call(refreshed.access_token);
      data = retry.data;
      error = retry.error;
    }
  }

  if (error) return { data: null, error: await readError(error) };
  return { data: data as T, error: null };
}
