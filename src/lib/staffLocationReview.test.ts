import { describe, expect, it } from 'vitest';
import { staffLocationReview, computersByEmail, type LocationEvidence } from './staffLocationReview';
const row: LocationEvidence = { admin_user_id: 'agent', ip_address: '192.0.2.1', city: 'London', region: null, country: 'UK', device_type: 'Laptop' };
describe('staff multiple-destination evidence', () => {
  it('flags overlapping use from two different places as simultaneous', () => {
    const a = { ...row, first_seen_at: '2026-10-28T09:00:00Z', last_seen_at: '2026-10-28T11:00:00Z' };
    const r = staffLocationReview([a, { ...a, ip_address: '192.0.2.9', city: 'Leeds', first_seen_at: '2026-10-28T10:00:00Z', last_seen_at: '2026-10-28T12:00:00Z' }]).get('agent');
    expect(r?.simultaneous).toHaveLength(1);
    expect(r?.simultaneous[0].overlapStart).toBe('2026-10-28T10:00:00.000Z');
  });
  it('does not call back-to-back places simultaneous', () => {
    const a = { ...row, first_seen_at: '2026-10-28T09:00:00Z', last_seen_at: '2026-10-28T10:00:00Z' };
    expect(staffLocationReview([a, { ...a, ip_address: '192.0.2.9', first_seen_at: '2026-10-28T11:00:00Z', last_seen_at: '2026-10-28T12:00:00Z' }]).get('agent')?.simultaneous).toHaveLength(0);
  });
  it('counts VPN destinations and computers per account', () => {
    expect(staffLocationReview([{ ...row, is_vpn: true }, { ...row, ip_address: '192.0.2.2' }]).get('agent')?.vpnDestinations).toBe(1);
    expect(computersByEmail([{ email: 'A@x.com', status: 'approved' }, { email: 'a@x.com', status: 'pending' }, { email: 'a@x.com', status: 'revoked' }]).get('a@x.com')).toBe(2);
  });
  it('flags the same login recorded from two destinations', () => {
    expect(staffLocationReview([row, { ...row, ip_address: '192.0.2.2', city: 'Manchester' }]).get('agent')).toMatchObject({ ips: 2, locations: 2, deviceTypes: 1, review: true });
  });
  it('does not treat repeated visits or case differences as different destinations', () => {
    expect(staffLocationReview([row, { ...row, city: ' london ', device_type: 'laptop' }]).get('agent')?.review).toBe(false);
  });
  it('keeps different accounts separate', () => {
    const result = staffLocationReview([row, { ...row, admin_user_id: 'other', ip_address: '192.0.2.2' }]);
    expect(result.get('agent')?.review).toBe(false);
    expect(result.get('other')?.review).toBe(false);
  });
  it('does not count unknown locations as destinations', () => {
    expect(staffLocationReview([{ ...row, ip_address: null, city: null, country: null, device_type: null }]).get('agent')).toMatchObject({ ips: 0, locations: 0, deviceTypes: 0, review: false });
  });
});