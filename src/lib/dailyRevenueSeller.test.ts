import { describe, expect, it } from 'vitest';
import { dailyRevenueSeller, isDirectWebsiteRevenue } from './dailyRevenueSeller';

describe('daily agent revenue website grouping', () => {
  const resolveCredit = () => 'agent-1';
  it.each(['website', 'stripe', 'bumper', 'google_ads', 'facebook_ads', 'bing_ad', 'social_ad', 'tiktok', 'direct', 'paypal', 'payment_assist'])('groups self-serve %s sales under Website even with a credited agent', purchase_source => {
    expect(dailyRevenueSeller({ purchase_source, is_manual_entry: false }, resolveCredit)).toBe('website');
    expect(isDirectWebsiteRevenue({ purchase_source, is_manual_entry: false })).toBe(true);
  });
  it.each(['google_ads', 'facebook_ads', 'website'])('keeps agent-entered %s sales with the agent', purchase_source => {
    expect(dailyRevenueSeller({ purchase_source, is_manual_entry: true }, resolveCredit)).toBe('agent-1');
  });
  it.each(['quote_link', 'external', 'admin_external', 'manual', 'admin', 'phone'])('keeps %s sales with the agent', purchase_source => {
    expect(dailyRevenueSeller({ purchase_source }, resolveCredit)).toBe('agent-1');
    expect(isDirectWebsiteRevenue({ purchase_source })).toBe(false);
  });
  it('excludes staff-purchase policies from the direct website filter', () => {
    expect(isDirectWebsiteRevenue({ purchase_source: 'stripe', warranty_reference_number: 'BAW-S-123' })).toBe(false);
  });
});