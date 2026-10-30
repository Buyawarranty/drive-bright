import { describe, expect, it } from 'vitest';
import { safeDepartureFilters, departureTime } from './staffDepartureView';
describe('departure view safeguards', () => {
  it('never copies credentials or free-text searches', () => {
    expect(safeDepartureFilters({ status: 'new', password: 'secret', search: 'customer@example.com', token: 'secret', search_omitted: true }))
      .toEqual({ status: 'new', search_omitted: true });
  });
  it('rejects arbitrary URLs and nested filter payloads', () => {
    expect(safeDepartureFilters({ view: 'https://example.com?token=secret', status: { token: 'secret' }, sort: 'newest' })).toEqual({ sort: 'newest' });
  });
  it('labels missing timestamps honestly and includes UTC equivalents', () => {
    expect(departureTime(null)).toBe('Not recorded');
    expect(departureTime('2026-10-30T09:00:00Z')).toContain('2026-10-30T09:00:00.000Z UTC');
  });
});