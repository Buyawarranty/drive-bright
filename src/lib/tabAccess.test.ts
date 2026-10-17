import { describe, it, expect } from 'vitest';
import { isAnalyticsBlocked, canAccessSeoAudit } from './tabAccess';

describe('SEO Audit assistant access', () => {
  it('uses the existing assistant grant for staff and always allows super admins', () => {
    expect(canAccessSeoAudit('super_admin')).toBe(true);
    expect(canAccessSeoAudit('admin')).toBe(false);
    expect(canAccessSeoAudit('admin', { 'tab_growth-agent': true })).toBe(true);
    expect(canAccessSeoAudit('sales', { 'tab_seo-audit': true })).toBe(false);
    expect(canAccessSeoAudit(null)).toBe(false);
    expect(canAccessSeoAudit('lead_gen', { 'tab_seo-review': true })).toBe(true);
  });
});

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
