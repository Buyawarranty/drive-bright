/**
 * Analytics access rule.
 *
 * Analytics is the company's revenue picture, so it belongs to management and
 * accounts — not to the people being measured by it. Sales agents, sales leads
 * and sales managers never get the Analytics section, and the rule sits ahead of
 * the per-user permission check in the dashboard, so a stray "tab_analytics"
 * tick in User Permissions can never reopen it for them.
 *
 * Page Analytics and Social Analytics are the same reporting family: agents and
 * sales leads never see them in their menu, so the direct links are closed too.
 * Sales managers keep Social Analytics (it is in their menu on purpose) but lose
 * the main Analytics section.
 */

const ANALYTICS_BLOCKED_ROLES = new Set(['sales', 'sales_lead', 'sales_manager']);
const ANALYTICS_TABS = new Set(['analytics', 'page-analytics']);

const SOCIAL_ANALYTICS_BLOCKED_ROLES = new Set(['sales', 'sales_lead']);

/** All bookmarks for Call data share the same per-user permission. */
export function canAccessCallData(role: string | null | undefined, permissions?: Record<string, boolean> | null): boolean {
  if (role === 'super_admin' || role === 'dev_tester') return true;
  if (permissions && 'tab_overview' in permissions) return permissions.tab_overview === true;
  if (role === 'sales' || role === 'sales_lead') return false;
  return role === 'admin' || role === 'sales_manager' || role === 'performance_manager';
}

/**
 * Leads data (archive): the management view of every lead ever received —
 * the lost/archived restore panel and its history. Admin and super admin
 * always have it; everyone else needs the explicit
 * 'tab_new-leads_leads-archive' grant in User Permissions. Sales roles can
 * only ever get it through that grant, never by default.
 */
export function canAccessLeadsArchive(
  role: string | null | undefined,
  granularGrant: boolean | undefined,
): boolean {
  if (role === 'super_admin' || role === 'admin') return true;
  return granularGrant === true;
}

/** SEO Audit reuses the existing assistant permission, not a separate grant. */
export function canAccessSeoAudit(role: string | null | undefined, permissions?: Record<string, boolean> | null): boolean {
  return role === 'super_admin' || permissions?.['tab_growth-agent'] === true || permissions?.['tab_seo-review'] === true;
}

/** True when this role must be denied this analytics-family tab. */
export function isAnalyticsBlocked(tab: string, role: string | null | undefined): boolean {
  if (!role) return false;
  if (ANALYTICS_BLOCKED_ROLES.has(role) && ANALYTICS_TABS.has(tab)) return true;
  if (SOCIAL_ANALYTICS_BLOCKED_ROLES.has(role) && tab === 'social-analytics') return true;
  return false;
}
