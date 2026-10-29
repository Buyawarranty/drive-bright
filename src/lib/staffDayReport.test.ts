import { describe, it, expect } from 'vitest';
import { travelFlags, computerCount, offlineGaps, type DayLocation } from './staffDayReport';

const loc = (id: string, lat: number, lon: number, from: string, to: string, ua = 'Mac Chrome'): DayLocation => ({
  id, admin_user_id: 'a', first_seen_at: from, last_seen_at: to, city: id, country: null, country_code: null,
  isp: null, ip_address: id, is_vpn: false, device_type: 'Desktop', user_agent: ua, latitude: lat, longitude: lon,
});
const phuket = loc('phuket', 7.89, 98.40, '2026-10-29T01:21:00Z', '2026-10-29T15:35:00Z');
const london = loc('london', 51.51, -0.13, '2026-10-29T15:45:00Z', '2026-10-29T16:36:00Z');

describe('staff day report', () => {
  it('flags Phuket then London 10 minutes later as impossible travel', () => {
    const flags = travelFlags([london, phuket]);
    expect(flags).toHaveLength(1);
    expect(flags[0].kind).toBe('impossible_travel');
    expect(flags[0].km).toBeGreaterThan(9000);
  });
  it('flags overlapping far-apart places as same time', () => {
    const uk = loc('uk', 51.5, -0.1, '2026-10-29T10:00:00Z', '2026-10-29T12:00:00Z');
    expect(travelFlags([phuket, uk])[0].kind).toBe('same_time');
  });
  it('ignores nearby places under 300 km', () => {
    const near = loc('near', 51.75, -1.25, '2026-10-29T15:40:00Z', '2026-10-29T16:00:00Z');
    expect(travelFlags([london, near])).toHaveLength(0);
  });
  it('counts same browser as one computer', () => {
    expect(computerCount([phuket, london])).toBe(1);
    expect(computerCount([phuket, loc('x', 0, 0, phuket.first_seen_at, phuket.first_seen_at, 'Windows Edge')])).toBe(2);
  });
  it('reports gaps of 30 minutes or more', () => {
    const s = (id: string, a: string, b: string) => ({ id, admin_user_id: 'a', started_at: a, last_seen_at: b, ended_at: null, end_reason: null });
    const gaps = offlineGaps([s('1', '2026-10-29T09:00:00Z', '2026-10-29T10:00:00Z'), s('2', '2026-10-29T10:20:00Z', '2026-10-29T11:00:00Z'), s('3', '2026-10-29T12:00:00Z', '2026-10-29T13:00:00Z')]);
    expect(gaps).toEqual([{ from: '2026-10-29T11:00:00Z', to: '2026-10-29T12:00:00Z', minutes: 60 }]);
  });
});
