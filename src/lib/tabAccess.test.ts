import { describe, it, expect } from 'vitest';
import { isAnalyticsBlocked, canAccessSeoAudit, canAccessCallData, canAccessLeadsArchive } from './tabAccess';

describe('Leads data (archive) permission', () => {
  it('is always on for admin and super admin', () => {
    expect(canAccessLeadsArchive('admin', undefined)).toBe(true);
    expect(canAccessLeadsArchive('super_admin', false)).toBe(true);
  });
  it('is off by default for every other role', () => {
    for (const role of ['sales', 'sales_lead', 'sales_manager', 'performance_manager', 'lead_gen', 'accounts_manager']) {
      expect(canAccessLeadsArchive(role, undefined)).toBe(false);
      expect(canAccessLeadsArchive(role, false)).toBe(false);
    }
  });
  it('can be granted explicitly to any role', () => {
    expect(canAccessLeadsArchive('sales', true)).toBe(true);
    expect(canAccessLeadsArchive('sales_lead', true)).toBe(true);
    expect(canAccessLeadsArchive('performance_manager', true)).toBe(true);
  });
});

describe('Call data permission', () => {
  it('defaults off for every sales agent', () => {
    expect(canAccessCallData('sales')).toBe(false);
    expect(canAccessCallData('sales', {})).toBe(false);
    expect(canAccessCallData('sales', { 'tab_call-stats': true })).toBe(false);
  });
  it('defaults off for sales leads', () => {
    expect(canAccessCallData('sales_lead')).toBe(false);
    expect(canAccessCallData('sales_lead', {})).toBe(false);
  });
  it('allows an explicit grant and respects a revoke', () => {
    for (const role of ['sales', 'sales_lead', 'sales_manager', 'admin']) {
      expect(canAccessCallData(role, { tab_overview: true })).toBe(true);
      expect(canAccessCallData(role, { tab_overview: false })).toBe(false);
    }
    expect(canAccessCallData('super_admin', { tab_overview: false })).toBe(true);
    expect(canAccessCallData('sales_manager')).toBe(true);
  });
});

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
