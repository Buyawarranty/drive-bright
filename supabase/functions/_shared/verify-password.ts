/**
 * Proves a password actually works on the Auth server before we show or email it.
 *
 * Root cause this guards against: a password can be generated/displayed while the
 * Auth update silently fails (or never ran), so staff are handed a value that
 * returns "Invalid login credentials".
 *
 * Second root cause (added later): a single check right after a password change can
 * hit a rate limit or a transient Auth error. Treating that as "wrong password"
 * made a saved password look broken. So we retry, and we only call it a failure
 * when Auth explicitly rejects the credentials.
 */
export type PasswordVerification = {
  /** Auth accepted the credentials. */
  ok: boolean;
  /** Auth explicitly said the credentials are wrong — a real failure. */
  rejected: boolean;
  detail: string;
};

export async function verifyPasswordDetailed(
  email: string,
  password: string,
  attempts = 3
): Promise<PasswordVerification> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url) return { ok: false, rejected: false, detail: "SUPABASE_URL missing" };

  let detail = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, attempt * 700));
    try {
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(email).trim().toLowerCase(), password }),
      });
      if (res.ok) return { ok: true, rejected: false, detail: "verified" };
      const body = await res.text();
      detail = `${res.status} ${body.slice(0, 200)}`;
      if (res.status === 400 && /invalid[_ ]grant|invalid login/i.test(body)) {
        return { ok: false, rejected: true, detail };
      }
    } catch (e: any) {
      detail = e?.message || "network error";
    }
  }
  return { ok: false, rejected: false, detail };
}

export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const result = await verifyPasswordDetailed(email, password);
  return result.ok;
}

export const PASSWORD_NOT_VERIFIED_MESSAGE =
  "The login server rejected this password. Please try setting it again.";

export const PASSWORD_SAVED_UNVERIFIED_NOTICE =
  "Password saved. The login check could not complete just now (login server busy), so ask the user to sign in once to confirm.";
