/**
 * Proves a password actually works on the Auth server before we show or email it.
 *
 * Root cause this guards against: a password can be generated/displayed while the
 * Auth update silently fails (or never ran), so staff are handed a value that
 * returns "Invalid login credentials". Never report success or send credentials
 * unless verifyPassword() resolves true.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!url) return false;

    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(email).trim().toLowerCase(), password }),
    });
    return res.ok;
  } catch (_e) {
    return false;
  }
}

export const PASSWORD_NOT_VERIFIED_MESSAGE =
  "The password was set but could not be verified on the login server, so it was not shared. Please try again.";
