import { beforeEach, expect, it } from 'vitest';
import { staffDeviceCredential, withStaffDeviceHeader } from './staffDeviceCredential';

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'http://localhost:8080' } } });
});
it('creates a stable random browser credential, not an approval decision', () => {
  const first = staffDeviceCredential();
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(staffDeviceCredential()).toBe(first);
});
it('never sends the browser credential to another origin or Supabase authentication', () => {
  expect(withStaffDeviceHeader('https://example.com/rest/v1/customers')).toBeUndefined();
  expect(withStaffDeviceHeader('https://mzlpuxzwyrcyrgrongeb.supabase.co/auth/v1/token')).toBeUndefined();
});
it('attaches proof to CRM reads and the device service while retaining authorization', () => {
  const request = withStaffDeviceHeader('https://mzlpuxzwyrcyrgrongeb.supabase.co/rest/v1/sales_leads', { headers: { Authorization: 'Bearer test' } });
  expect(new Headers(request?.headers).get('x-staff-device')).toBe(staffDeviceCredential());
  expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer test');
});