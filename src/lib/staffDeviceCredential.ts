const KEY = 'baw_staff_device_credential';

// A bearer credential, not an authorization decision: only the server can approve it.
export function staffDeviceCredential(): string {
  const existing = localStorage.getItem(KEY);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const credential = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(KEY, credential);
  return credential;
}

export function withStaffDeviceHeader(input: RequestInfo | URL, init?: RequestInit): RequestInit | undefined {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const parsed = new URL(url, window.location.origin);
  if (parsed.hostname !== 'mzlpuxzwyrcyrgrongeb.supabase.co' || (!parsed.pathname.startsWith('/rest/v1/') && parsed.pathname !== '/functions/v1/staff-device-access')) return init;
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set('x-staff-device', staffDeviceCredential());
  return { ...init, headers };
}