import { describe, it, expect } from 'vitest';
import { isAnalyticsBlocked } from './tabAccess';

describe('Analytics visibility by role', () => {
  it('blocks the sales roles from Analytics', () => {
    expect(isAnalyticsBlocked('analytics', 'sales')).toBe(true);
    expect(isAnalyticsBlocked('analytics', 'sales_lead')).toBe(true);
    expect(isAnalyticsBlocked('analytics', 'sales_manager')).toBe(true);
  });

  it('blocks agents and sales leads from the page/social analytics pages', () => {
    expect(isAnalyticsBlocked('page-analytics', 'sales_lead')).toBe(true);
    expect(isAnalyticsBlocked('social-analytics', 'sales_lead')).toBe(true);
  });

  it('lets management and accounts through', () => {
    expect(isAnalyticsBlocked('analytics', 'admin')).toBe(false);
    expect(isAnalyticsBlocked('analytics', 'super_admin')).toBe(false);
    expect(isAnalyticsBlocked('analytics', 'accounts')).toBe(false);
    expect(isAnalyticsBlocked('analytics', 'lead_gen')).toBe(false);
  });

  it('keeps social analytics for sales managers and says nothing about other tabs', () => {
    expect(isAnalyticsBlocked('social-analytics', 'sales_manager')).toBe(false);
    expect(isAnalyticsBlocked('new-leads', 'sales_lead')).toBe(false);
    expect(isAnalyticsBlocked('analytics', null)).toBe(false);
  });
});
