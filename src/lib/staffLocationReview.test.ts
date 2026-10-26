import { describe, expect, it } from 'vitest';
import { staffLocationReview, type LocationEvidence } from './staffLocationReview';
const row: LocationEvidence = { admin_user_id: 'agent', ip_address: '192.0.2.1', city: 'London', region: null, country: 'UK', device_type: 'Laptop' };
describe('staff multiple-destination evidence', () => {
  it('flags the same login recorded from two destinations', () => {
    expect(staffLocationReview([row, { ...row, ip_address: '192.0.2.2', city: 'Manchester' }]).get('agent')).toEqual({ ips: 2, locations: 2, deviceTypes: 1, review: true });
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
    expect(staffLocationReview([{ ...row, ip_address: null, city: null, country: null, device_type: null }]).get('agent')).toEqual({ ips: 0, locations: 0, deviceTypes: 0, review: false });
  });
});