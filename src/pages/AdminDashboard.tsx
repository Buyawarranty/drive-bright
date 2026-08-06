import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SEOHead } from '@/components/SEOHead';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { useAdminSidebarCollapsed } from '@/hooks/useAdminSidebarCollapsed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { useAdminBackNavigation } from '@/hooks/useAdminBackNavigation';
import { useUserPresence } from '@/hooks/useUserPresence';
import { useStaffLocationPing } from '@/hooks/useStaffLocationPing';
import { ViewAsProvider, useViewAs } from '@/contexts/ViewAsContext';
import { ViewAsDropdown } from '@/components/admin/ViewAsDropdown';
import ReminderDuePopup from '@/components/admin/leads/ReminderDuePopup';
import GlobalQuickReminderButton from '@/components/admin/GlobalQuickReminderButton';
import { PendingLeadsPill } from '@/components/admin/PendingLeadsPill';

import { CheckoutStruggleAlertBar } from '@/components/admin/CheckoutStruggleAlertBar';
import { IncomingCallBanner } from '@/components/admin/calls/IncomingCallBanner';
import { MissedCallAlertBar } from '@/components/admin/MissedCallAlertBar';
import { NewLeadAlerts } from '@/components/admin/leads/NewLeadAlerts';
import { NewLeadTopBanner } from '@/components/admin/leads/NewLeadTopBanner';

import { OpenPoolLeadAlert } from '@/components/admin/leads/OpenPoolLeadAlert';
import { MissedCallbackAlertBanner } from '@/components/admin/leads/MissedCallbackAlertBanner';
import { NewLeadsWaitingBanner } from '@/components/admin/leads/NewLeadsWaitingBanner';
import { FrequentTabsBar } from '@/components/admin/FrequentTabsBar';
import { recordTabVisit } from '@/hooks/useTabUsage';
import { initPhoneClickTracker } from '@/utils/phoneEventLogger';
import { WorkingWeekReminderBanner } from '@/components/admin/timesheets/WorkingWeekReminderBanner';
import { DiscountAuthBanner } from '@/components/admin/DiscountAuthBanner';
import { GlobalAutoDistributeBar } from '@/components/admin/leads/GlobalAutoDistributeBar';
import { QuickGrantAccessBar } from '@/components/admin/QuickGrantAccessBar';

const ManagerOverviewTab = lazy(() => import('@/components/admin/ManagerOverviewTab'));
const PriceUpdatesTab = lazy(() => import('@/components/admin/PriceUpdatesTab'));
const SmsTrackingTab = lazy(() => import('@/components/admin/SmsTrackingTab'));


// Lazy-load ALL tab components to drastically reduce initial bundle
const ClaimsTab = lazy(() => import('@/components/admin/ClaimsTab').then(m => ({ default: m.ClaimsTab })));
const ContactSubmissionsTab = lazy(() => import('@/components/admin/ContactSubmissionsTab'));
const ComplaintsTab = lazy(() => import('@/components/admin/ComplaintsTab'));
const AbandonedCartsTab = lazy(() => import('@/components/admin/AbandonedCartsTab').then(m => ({ default: m.AbandonedCartsTab })));
const GetQuoteTab = lazy(() => import('@/components/admin/GetQuoteTab').then(m => ({ default: m.GetQuoteTab })));
const CustomersTab = lazy(() => import('@/components/admin/CustomersTab').then(m => ({ default: m.CustomersTab })));
const TermsAndConditionsTab = lazy(() => import('@/components/admin/TermsAndConditionsTab'));
const SpecialVehiclePlansTab = lazy(() => import('@/components/admin/SpecialVehiclePlansTab'));
const DiscountCodesTab = lazy(() => import('@/components/admin/DiscountCodesTab').then(m => ({ default: m.DiscountCodesTab })));
const ReferralsTab = lazy(() => import('@/components/admin/ReferralsTab').then(m => ({ default: m.ReferralsTab })));
const AnalyticsTab = lazy(() => import('@/components/admin/AnalyticsTab').then(m => ({ default: m.AnalyticsTab })));
const UnifiedEmailHub = lazy(() => import('@/components/admin/UnifiedEmailHub'));
const AccountSettings = lazy(() => import('@/components/admin/AccountSettings'));
const AttributionSettingsTab = lazy(() => import('@/components/admin/AttributionSettingsTab'));
const FeatureFlagsTab = lazy(() => import('@/components/admin/FeatureFlagsTab'));
const ApiConnectivityTest = lazy(() => import('@/components/admin/ApiConnectivityTest').then(m => ({ default: m.ApiConnectivityTest })));
const UserPermissionsTab = lazy(() => import('@/components/admin/UserPermissionsTab').then(m => ({ default: m.UserPermissionsTab })));
const LeadTeamsTab = lazy(() => import('@/components/admin/LeadTeamsTab').then(m => ({ default: m.LeadTeamsTab })));
const OrrTestLabPage = lazy(() => import('@/components/admin/leads/OrrTestLabPage').then(m => ({ default: m.OrrTestLabPage })));
const DocumentMappingTab = lazy(() => import('@/components/admin/DocumentMappingTab').then(m => ({ default: m.DocumentMappingTab })));
const BulkPricingTab = lazy(() => import('@/components/admin/BulkPricingTab').then(m => ({ default: m.BulkPricingTab })));
const BlogWritingTab = lazy(() => import('@/components/admin/BlogWritingTab').then(m => ({ default: m.BlogWritingTab })));
const LandingPageBuilder = lazy(() => import('@/components/admin/LandingPageBuilder').then(m => ({ default: m.LandingPageBuilder })));
const ClickFraudTab = lazy(() => import('@/components/admin/ClickFraudTab').then(m => ({ default: m.ClickFraudTab })));

const TestingTabContent = lazy(() => import('@/components/admin/TestingTabContent').then(m => ({ default: m.TestingTabContent })));
const NewLeadsTab = lazy(() => import('@/components/admin/leads/NewLeadsTab').then(m => ({ default: m.NewLeadsTab })));
const GoldenLeadsTab = lazy(() => import('@/components/admin/leads/LeadRecoveryTab').then(m => ({ default: m.LeadRecoveryTab })));
const RetentionTab = lazy(() => import('@/components/admin/retention/RetentionTab').then(m => ({ default: m.RetentionTab })));
const RenewalsQueueTab = lazy(() => import('@/components/admin/renewals/RenewalsQueueTab').then(m => ({ default: m.RenewalsQueueTab })));
const SellingTipsSection = lazy(() => import('@/components/admin/SellingTipsSection').then(m => ({ default: m.SellingTipsSection })));
const TimesheetsTab = lazy(() => import('@/components/admin/timesheets/TimesheetsTab').then(m => ({ default: m.TimesheetsTab })));
const StaffHubTab = lazy(() => import('@/components/admin/StaffHubTab').then(m => ({ default: m.StaffHubTab })));
const ReviewsTab = lazy(() => import('@/components/admin/ReviewsTab').then(m => ({ default: m.ReviewsTab })));
const MarketingAudienceTab = lazy(() => import('@/components/admin/marketing/MarketingAudienceTab').then(m => ({ default: m.MarketingAudienceTab })));
const SalesCustomerManagement = lazy(() => import('@/components/admin/sales/SalesCustomerManagement'));
const SalesLeadDashboard = lazy(() => import('@/components/admin/sales/SalesLeadDashboard').then(m => ({ default: m.SalesLeadDashboard })));
const PolicyDocumentsTab = lazy(() => import('@/components/admin/PolicyDocumentsTab').then(m => ({ default: m.PolicyDocumentsTab })));
const PageAnalyticsTab = lazy(() => import('@/components/admin/PageAnalyticsTab').then(m => ({ default: m.PageAnalyticsTab })));
const VehicleStatsTab = lazy(() => import('@/components/admin/VehicleStatsTab').then(m => ({ default: m.VehicleStatsTab })));
const SalesScoreboardTab = lazy(() => import('@/components/admin/scoreboard/SalesScoreboardTab'));
const OfflineCampaignsTab = lazy(() => import('@/components/admin/marketing/OfflineCampaignsTab').then(m => ({ default: m.OfflineCampaignsTab })));
const MarketingAnalyticsTab = lazy(() => import('@/components/admin/MarketingAnalyticsTab').then(m => ({ default: m.MarketingAnalyticsTab })));
const LeadBackupRecoveryTab = lazy(() => import('@/components/admin/LeadBackupRecoveryTab'));
const DiscountsGivenTab = lazy(() => import('@/components/admin/DiscountsGivenTab'));
const CancellationsTab = lazy(() => import('@/components/admin/CancellationsTab').then(m => ({ default: m.CancellationsTab })));
const RefundsPaidTab = lazy(() => import('@/components/admin/RefundsPaidTab').then(m => ({ default: m.RefundsPaidTab })));
const GhlSyncLogTab = lazy(() => import('@/components/admin/GhlSyncLogTab').then(m => ({ default: m.GhlSyncLogTab })));
const AbTestingTab = lazy(() => import('@/components/admin/AbTestingTab'));
const UnsubscribeTab = lazy(() => import('@/components/admin/UnsubscribeTab').then(m => ({ default: m.UnsubscribeTab })));
const AttendanceTab = lazy(() => import('@/components/admin/AttendanceTab').then(m => ({ default: m.AttendanceTab })));
const CallTrackingTab = lazy(() => import('@/components/admin/CallTrackingTab').then(m => ({ default: m.CallTrackingTab })));
const CallStatsTab = lazy(() => import('@/components/admin/CallStatsTab').then(m => ({ default: m.CallStatsTab })));
const HRTab = lazy(() => import('@/components/admin/hr/HRTab').then(m => ({ default: m.HRTab })));
const AgentFeedbackTab = lazy(() => import('@/components/admin/feedback/AgentFeedbackTab').then(m => ({ default: m.AgentFeedbackTab })));
const CollectPaymentsTab = lazy(() => import('@/components/admin/CollectPaymentsTab').then(m => ({ default: m.CollectPaymentsTab })));
import { CollectPaymentsBanner } from '@/components/admin/CollectPaymentsBanner';
import { readAdminAccessCache, writeAdminAccessCache, clearAdminAccessCache } from '@/lib/adminAccessCache';

const SalesAgentTargetsTab = lazy(() => import('@/components/admin/SalesAgentTargetsTab').then(m => ({ default: m.SalesAgentTargetsTab })));
const ConcessionsTab = lazy(() => import('@/components/admin/ConcessionsTab').then(m => ({ default: m.ConcessionsTab })));



const ADMIN_ROLES = ['super_admin', 'admin', 'member', 'viewer', 'guest', 'blog_writer', 'sales', 'sales_lead', 'sales_manager', 'performance_manager', 'dev_tester', 'accounts_manager', 'accounts_payroll', 'lead_gen', 'accounts', 'claims_agent', 'claims_manager'];
const ROLE_PRIORITY = ['super_admin', 'admin', 'claims_agent', 'claims_manager', 'member', 'performance_manager', 'sales_manager', 'sales_lead', 'lead_gen', 'accounts_manager', 'accounts_payroll', 'accounts', 'viewer', 'guest', 'sales', 'blog_writer', 'dev_tester'];
const CLAIMS_AGENT_TABS = ['claims', 'complaints', 'customers', 'discount-codes', 'discounts-given', 'cancellations', 'refunds-paid', 'staff-hub', 'agent-feedback', 'unsubscribe', 'account'];
const CLAIMS_MANAGER_TABS = ['claims', 'complaints', 'attendance', 'hr', 'staff-hub', 'agent-feedback', 'unsubscribe', 'account'];
const SALES_TABS = ['overview', 'new-leads', 'recontact-leads', 'get-quote', 'selling-tips', 'discount-codes', 'timesheets', 'staff-hub', 'agent-feedback', 'unsubscribe', 'account'];
const SALES_LEAD_TABS = ['overview', 'new-leads', 'call-tracking', 'recontact-leads', 'get-quote', 'sales-scoreboard', 'customers', 'collect-payments', 'analytics', 'selling-tips', 'discount-codes', 'timesheets', 'attendance', 'staff-hub', 'lead-teams', 'agent-feedback', 'unsubscribe', 'account'];
const SALES_MANAGER_TABS = ['overview', 'concessions', 'new-leads', 'call-tracking', 'call-stats', 'recontact-leads', 'get-quote', 'sales-scoreboard', 'sales-agent-targets', 'customers', 'collect-payments', 'analytics', 'selling-tips', 'discount-codes', 'timesheets', 'attendance', 'hr', 'staff-hub', 'lead-teams', 'agent-feedback', 'orr-test-lab', 'price-updates', 'vehicle-stats', 'banners-billboards', 'sms-tracking', 'user-permissions', 'claims', 'unsubscribe', 'account'];
const PERFORMANCE_MANAGER_TABS = SALES_MANAGER_TABS;

const hasExplicitTopLevelTabPermissions = (permissions?: Record<string, boolean> | null) => {
  return !!permissions && Object.keys(permissions).some(key => /^tab_[^_]+$/.test(key));
};

const isExplicitlyPermittedTab = (tab: string, permissions?: Record<string, boolean> | null) => {
  if (tab === 'account' || tab === 'unsubscribe') return true;
  return permissions?.[`tab_${tab}`] === true;
};

const getFirstPermittedTab = (role: string | null, permissions?: Record<string, boolean> | null) => {
  const preferredOrder = role === 'claims_agent' || role === 'claims_manager'
    ? ['claims', 'customers', 'discount-codes', 'discounts-given', 'cancellations', 'refunds-paid', 'staff-hub', 'account']
    : ['get-quote', 'customers', 'new-leads', 'claims', 'discount-codes', 'timesheets', 'staff-hub', 'account'];

  if (permissions) {
    const firstPreferred = preferredOrder.find(tab => permissions[`tab_${tab}`] === true);
    if (firstPreferred) return firstPreferred;
    const firstAllowed = Object.keys(permissions).find(key => key.startsWith('tab_') && permissions[key]);
    if (firstAllowed) return firstAllowed.replace('tab_', '');
  }

  return 'get-quote';
};

// Tabs that are restricted to super_admin / dev_tester by default.
// Other roles only see them when explicitly granted via tab_<id> = true in permissions.
const SUPER_ADMIN_ONLY_TABS = new Set<string>(['plans']);

// Tab ids that are really the same screen as 'overview' (Live Calls Data).
// Old bookmarks (?tab=call-stats) and the public slug must never be treated as
// a different, un-permitted tab — that used to bounce agents to Quotes & Orders.
const LIVE_CALLS_TAB_IDS = new Set(['overview', 'call-stats', 'live-calls-data']);
const canonicalTabId = (tab: string) => (LIVE_CALLS_TAB_IDS.has(tab) ? 'overview' : tab);

// Roles that always keep access to Live Calls Data. What they can actually see
// inside is governed by lead_team_members.call_data_scope (off / own / team / all).
const LIVE_CALLS_ALWAYS_ALLOWED_ROLES = new Set(['sales', 'sales_lead', 'sales_manager', 'performance_manager', 'admin']);

const isTabAllowedForRole = (rawTab: string, role: string | null, permissions?: Record<string, boolean> | null) => {
  const tab = canonicalTabId(rawTab);
  const permKey = `tab_${tab}`;
  if (tab === 'account') return true;
  if (tab === 'unsubscribe') return true;
  if (role === 'super_admin' || role === 'dev_tester') return true;
  if (tab === 'overview' && role && LIVE_CALLS_ALWAYS_ALLOWED_ROLES.has(role)) return true;
  if (SUPER_ADMIN_ONLY_TABS.has(tab)) {
    return permissions?.[permKey] === true;
  }
  // Explicit per-user grant from User Permissions always wins for non-super-admin roles.
  // This lets management toggle any tab (e.g. recontact-leads) on/off for any user.
  if (permissions && permKey in permissions) {
    return permissions[permKey] === true;
  }

  if (role === 'admin') return true;
  if (role === 'claims_agent') return CLAIMS_AGENT_TABS.includes(tab);
  if (role === 'claims_manager') return CLAIMS_MANAGER_TABS.includes(tab);
  if (role === 'sales_lead') return SALES_LEAD_TABS.includes(tab);
  if (role === 'sales_manager') {
    return hasExplicitTopLevelTabPermissions(permissions)
      ? isExplicitlyPermittedTab(tab, permissions)
      : SALES_MANAGER_TABS.includes(tab);
  }
  if (role === 'performance_manager') {
    return hasExplicitTopLevelTabPermissions(permissions)
      ? isExplicitlyPermittedTab(tab, permissions)
      : PERFORMANCE_MANAGER_TABS.includes(tab);
  }
  if (role === 'sales') return SALES_TABS.includes(tab);
  if (tab === 'claims') return false;
  if (permissions && Object.keys(permissions).length > 0) return false;
  return true;
};

// Tab loading spinner
const TabFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Error boundary for lazy-loaded tab chunks. Keyed by `tabKey` in the
// consumer so switching tabs auto-resets the error state — a broken tab
// never traps the user; they can navigate away and keep working.
class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void; tabKey?: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error('[TabErrorBoundary] Tab error:', error);

    // Auto-recover from stale chunks after a deployment: hard-reload once
    // per session so staff don't need to know what "ChunkLoadError" means.
    const msg = String(error?.message || '');
    const isChunk =
      /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
        msg,
      );
    if (isChunk) {
      try {
        const flag = 'baw_admin_chunk_reload_at';
        const last = Number(sessionStorage.getItem(flag) || '0');
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(flag, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* noop */
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
          <p className="text-destructive font-medium">This section didn't open properly.</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Everything else is still working — pick another tab from the sidebar
            to carry on. This usually sorts itself out with a quick refresh, or
            happens right after we've pushed an update.
          </p>
          <p className="text-xs text-muted-foreground max-w-md">
            Try the buttons below. If it keeps happening, let the team know.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onRetry();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90"
            >
              Try this tab again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border rounded-md text-sm hover:bg-accent"
            >
              Refresh the page
            </button>
          </div>
        </div>

      );
    }
    return this.props.children;
  }
  componentDidUpdate(prev: { tabKey?: string }) {
    // Switching tabs clears any prior error so users are never trapped.
    if (this.state.hasError && prev.tabKey !== this.props.tabKey) {
      this.setState({ hasError: false, error: null });
    }
  }
}

// Lead data type for passing to GetQuoteTab
interface LeadForQuote {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  mileage: string | null;
  plan_interest: string | null;
}

const AdminDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize with URL tab param if present, otherwise default to 'customers'
  const rawUrlTab = searchParams.get('tab');
  // Legacy URL aliases — keep old links working after rename
  const TAB_ALIASES: Record<string, string> = {
    'golden-leads': 'recontact-leads',
    'goldmine-leads': 'recontact-leads',
    'retention': 'renewals',
    'leads-per-agent': 'new-leads',
    'blog-writing': 'blogs-data',
    // 'overview' internal id is exposed publicly as 'live-calls-data'
    'live-calls-data': 'overview',
    // Call Stats was merged into Live Calls Data — keep old bookmarks working
    'call-stats': 'overview',

  };
  const urlTab = rawUrlTab ? (TAB_ALIASES[rawUrlTab] ?? rawUrlTab) : null;
  const [activeTab, setActiveTab] = useState<string>(urlTab || 'get-quote');
  const { collapsed: sidebarCollapsed } = useAdminSidebarCollapsed();
  // Public slug used in the URL bar (reverse map for tab ids that were renamed)
  const publicSlugFor = (id: string) => (id === 'overview' ? 'live-calls-data' : id);
  // Rewrite legacy tab in URL once on mount
  useEffect(() => {
    if (rawUrlTab && (TAB_ALIASES[rawUrlTab] || rawUrlTab === 'overview')) {
      const canonical = TAB_ALIASES[rawUrlTab] ?? rawUrlTab;
      setSearchParams({ tab: publicSlugFor(canonical) }, { replace: true });
    }
    // Attach global phone-click tracker (a[href^="tel:"] + [data-phone-click])
    initPhoneClickTracker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const accessCheckTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean> | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [hasSetInitialTab, setHasSetInitialTab] = useState(!!urlTab);
  const [selectedLeadForQuote, setSelectedLeadForQuote] = useState<LeadForQuote | null>(null);
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  
  // Admin notifications - only fetch after access is confirmed
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useAdminNotifications(userRole, adminUserId);
  
  // Track user presence with current tab - only after access confirmed
  useUserPresence({ currentTab: activeTab });
  useStaffLocationPing();

  // Track tab history for back navigation
  const [tabHistory, setTabHistory] = useState<string[]>([]);

  // Handle tab changes and update history + URL
  const handleTabChange = useCallback((newTab: string, leadData?: LeadForQuote) => {
    setTabHistory(prev => {
      // Don't add duplicate consecutive tabs
      if (prev[prev.length - 1] === newTab) return prev;
      return [...prev, newTab];
    });
    // Clear lead data when navigating away from get-quote, or set new lead data
    if (newTab === 'get-quote' && leadData) {
      setSelectedLeadForQuote(leadData);
    } else if (newTab !== 'get-quote') {
      setSelectedLeadForQuote(null);
    }
    setActiveTab(newTab);
    // Persist tab to URL so refresh maintains state
    setSearchParams({ tab: publicSlugFor(newTab) }, { replace: true });
    // Track per-user tab visits so the shortcuts bar can surface favourites
    recordTabVisit(session?.user?.id ?? null, newTab);
  }, [setSearchParams, session?.user?.id]);

  // Back navigation within the dashboard
  const handleBackToTab = useCallback((previousTab: string, updatedHistory: string[]) => {
    setActiveTab(previousTab);
    setTabHistory(updatedHistory);
    setSearchParams({ tab: publicSlugFor(previousTab) }, { replace: true });
  }, [setSearchParams]);

  // Ensure the current tab is always in the history stack
  useEffect(() => {
    if (tabHistory.length === 0) {
      setTabHistory([activeTab]);
    }
  }, [activeTab, tabHistory.length]);

  // Record the initial tab visit (e.g. when landing via URL) so the
  // shortcuts bar reflects genuine usage even without a click.
  useEffect(() => {
    if (session?.user?.id && activeTab) {
      recordTabVisit(session.user.id, activeTab);
    }
    // Only fire on mount / when the signed-in user becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Guard the back button so it can't return to the referrer
  useAdminBackNavigation({
    activeTab,
    tabHistory,
    onBackToTab: handleBackToTab,
    enabled: hasAdminAccess && !isCheckingRole,
  });


  // Track if we've already checked access to prevent multiple redirects
  const hasCheckedAccessRef = React.useRef(false);
  const accessAttemptsRef = React.useRef(0);
  const [accessCheckStalled, setAccessCheckStalled] = useState(false);
  // True while we're showing the shell from cached (last-known) access and the
  // server verification hasn't come back yet.
  const [accessFromCache, setAccessFromCache] = useState(false);
  const hydratedFromCacheRef = React.useRef(false);

  // Graceful partial load: paint the CRM shell instantly from last-known access
  // so staff aren't watching a spinner while we re-verify in the background.
  useEffect(() => {
    if (authLoading) return;
    if (hydratedFromCacheRef.current || hasCheckedAccessRef.current || hasAdminAccess) return;
    const cached = readAdminAccessCache(session?.user?.id);
    if (!cached) return;
    hydratedFromCacheRef.current = true;
    setUserRole(cached.role);
    setUserPermissions(cached.permissions ?? null);
    if (cached.adminUserId) setAdminUserId(cached.adminUserId);
    setHasAdminAccess(true);
    setAccessFromCache(true);
    setIsCheckingRole(false);
    if (!hasSetInitialTab) {
      setHasSetInitialTab(true);
      const defaultTab = getFirstPermittedTab(cached.role, cached.permissions ?? null);
      setActiveTab(defaultTab);
      setTabHistory([defaultTab]);
      setSearchParams({ tab: publicSlugFor(defaultTab) }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session?.user?.id]);

  useEffect(() => {
    // Only run check when auth is done loading AND we haven't already confirmed access
    if (!authLoading && !hasCheckedAccessRef.current) {
      checkAdminAccess();

      // Safety net: if the access check hangs (slow/failed DB round-trip), retry it
      // instead of leaving the user stuck on an endless spinner.
      if (accessCheckTimeoutRef.current) clearTimeout(accessCheckTimeoutRef.current);
      accessCheckTimeoutRef.current = setTimeout(() => {
        if (hasCheckedAccessRef.current) return;
        console.warn('[AdminDashboard] Access check timed out — retrying');
        if (accessAttemptsRef.current < 5) {
          setIsCheckingRole(true);
          checkAdminAccess();
        } else {
          setIsCheckingRole(false);
          setAccessCheckStalled(true);
        }
      }, 15000);

    }

    return () => {
      if (accessCheckTimeoutRef.current) clearTimeout(accessCheckTimeoutRef.current);
    };
  }, [session, authLoading]);



  // Handle page visibility changes (returning from another tab/page)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && hasAdminAccess) {
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        if (!refreshedSession?.user) {
          navigate('/auth', { replace: true });
        }
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        supabase.auth.getSession().then(({ data: { session: refreshedSession } }) => {
          if (!refreshedSession?.user && !isCheckingRole) {
            navigate('/auth', { replace: true });
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [hasAdminAccess, isCheckingRole, navigate]);

  const MAX_ACCESS_ATTEMPTS = 5;

  const scheduleAccessRetry = (attempt: number) => {
    if (hasCheckedAccessRef.current) return;
    // When the shell is already up from cached access, never fall back to the
    // spinner or the error page — keep working and reconcile quietly.
    const showingCachedShell = hydratedFromCacheRef.current;
    if (attempt >= MAX_ACCESS_ATTEMPTS) {
      setIsCheckingRole(false);
      if (!showingCachedShell) setAccessCheckStalled(true);
      return;
    }
    if (!showingCachedShell) {
      setIsCheckingRole(true);
      setAccessCheckStalled(false);
    }
    if (accessCheckTimeoutRef.current) clearTimeout(accessCheckTimeoutRef.current);
    // Backoff: 1s, 2s, 3s, 4s — keeps retrying instead of stranding the CRM.
    accessCheckTimeoutRef.current = setTimeout(() => {
      if (hasCheckedAccessRef.current) return;
      checkAdminAccess();
    }, Math.min(attempt * 1000, 4000));
  };


  const checkAdminAccess = async () => {
    accessAttemptsRef.current += 1;
    const attempt = accessAttemptsRef.current;
    // Bound each round-trip so a slow/stalled request can't hang the gate forever
    const withTimeout = <T,>(p: PromiseLike<T>, ms = 12000): Promise<T | null> =>
      Promise.race([
        Promise.resolve(p) as Promise<T>,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);

    try {
      // Always use server-verified getUser() to avoid stale session issues
      const verified = await withTimeout(supabase.auth.getUser());
      let currentUser = verified?.data?.user ?? null;

      if (!currentUser) {
        // Fallback: try getSession as last resort
        const fallback = await withTimeout(supabase.auth.getSession(), 5000);
        const fallbackUser = fallback?.data?.session?.user ?? null;
        if (!fallbackUser) {
          // Only bounce to login when we're sure there is no session; a timed-out
          // request should be retried, not treated as "logged out".
          if (fallback === null || verified === null) {
            scheduleAccessRetry(attempt);
            return;
          }
          hasCheckedAccessRef.current = true;
          setIsCheckingRole(false);
          navigate('/auth', { replace: true });
          return;
        }
        currentUser = fallbackUser;
      }

      // Roles are the gate — fetch them on their own so a slow permissions read
      // can never block sign-in to the CRM.
      const rolesResult = await withTimeout(
        supabase.from('user_roles').select('role').eq('user_id', currentUser.id),
        12000
      );

      if (!rolesResult) {
        // Timed out — keep the session, retry.
        scheduleAccessRetry(attempt);
        return;
      }

      const { data, error } = rolesResult;
      const userAdminRoles = data?.filter(r => ADMIN_ROLES.includes(r.role)) || [];

      if (error) {
        // Transient read failure — retry rather than logging the user out.
        console.error('[AdminDashboard] Role lookup failed:', error);
        scheduleAccessRetry(attempt);
        return;
      }

      if (userAdminRoles.length === 0) {
        hasCheckedAccessRef.current = true;
        setIsCheckingRole(false);
        setAccessFromCache(false);
        clearAdminAccessCache();
        navigate('/auth', { replace: true });
        return;
      }

      const primaryRole = ROLE_PRIORITY.find(role => userAdminRoles.some(r => r.role === role)) || userAdminRoles[0].role;

      setUserRole(primaryRole);
      setHasAdminAccess(true);
      hasCheckedAccessRef.current = true;
      setAccessCheckStalled(false);
      setAccessFromCache(false);
      if (accessCheckTimeoutRef.current) {
        clearTimeout(accessCheckTimeoutRef.current);
        accessCheckTimeoutRef.current = null;
      }
      setIsCheckingRole(false);

      // Permissions load in the background — the shell is already usable.
      const permissionsResult = await withTimeout(
        supabase.from('admin_users').select('id, permissions').eq('user_id', currentUser.id).maybeSingle(),
        12000
      );
      const adminUserData = permissionsResult?.data ?? null;

      if (adminUserData?.id) {
        setAdminUserId(adminUserData.id);
      }

      if (adminUserData?.permissions) {
        setUserPermissions(adminUserData.permissions as Record<string, boolean>);
      }

      // Remember this verified access so the next load paints instantly.
      // UI-only cache — RLS still enforces every read/write server-side.
      if (permissionsResult) {
        writeAdminAccessCache({
          userId: currentUser.id,
          role: primaryRole,
          permissions: (adminUserData?.permissions as Record<string, boolean> | null) ?? null,
          adminUserId: adminUserData?.id ?? null,
        });
      }

      // Set default tab based on role (only if no URL tab param was provided)
      if (!hasSetInitialTab) {
        setHasSetInitialTab(true);

        const defaultTab = getFirstPermittedTab(primaryRole, adminUserData?.permissions as Record<string, boolean> | null);

        setActiveTab(defaultTab);
        setTabHistory([defaultTab]);
        setSearchParams({ tab: publicSlugFor(defaultTab) }, { replace: true });
      }

    } catch (error) {
      console.error('Error checking admin access:', error);
      scheduleAccessRetry(attempt);
    }
  };


  // Access check couldn't complete (slow or failing connection) — offer a retry
  // instead of an endless spinner.
  if (!hasAdminAccess && accessCheckStalled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-gray-900 font-semibold mb-2">Couldn't load the dashboard</p>
          <p className="text-gray-600 text-sm mb-4">
            Your connection to the CRM timed out. You're still signed in — try again.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              onClick={() => {
                accessAttemptsRef.current = 0;
                setAccessCheckStalled(false);
                setIsCheckingRole(true);
                checkAdminAccess();
              }}
            >
              Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading only during essential checks - removed activeTab check since we now have default
  if (authLoading || isCheckingRole || !hasAdminAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }


  const renderContent = (effectiveUserRole: string | null, effectiveUserPermissions: Record<string, boolean> | null) => {
    switch (activeTab) {
      case 'overview':
      case 'call-stats':
        return <ManagerOverviewTab onNavigateToTab={handleTabChange} userRole={effectiveUserRole} />;
      case 'customers':
        return (
          <CustomersTab
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onNavigateToTab={handleTabChange}
            userRole={effectiveUserRole}
          />
        );
      case 'collect-payments':
        return <CollectPaymentsTab userRole={effectiveUserRole} onNavigateToTab={handleTabChange} />;
      case 'plans':
        return <TermsAndConditionsTab />;
      case 'bulk-pricing':
        return <BulkPricingTab />;
      case 'special-plans':
        return <SpecialVehiclePlansTab />;
      case 'discount-codes':
        return <DiscountCodesTab />;
      case 'referrals':
        return <ReferralsTab />;
      case 'claims':
        if (!isTabAllowedForRole('claims', effectiveUserRole, effectiveUserPermissions)) {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">The Claims tab is restricted to management and claims agents only.</p>
            </div>
          );
        }
        return (
          <ClaimsTab
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onNavigateToTab={handleTabChange}
            userRole={effectiveUserRole}
          />
        );
      case 'reviews':
        return <ReviewsTab />;
      case 'contact':
        return <ContactSubmissionsTab />;
      case 'complaints':
        if (!isTabAllowedForRole('complaints', effectiveUserRole, effectiveUserPermissions)) {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">The Complaints tab is restricted to admins and claims agents.</p>
            </div>
          );
        }
        return <ComplaintsTab />;
      case 'abandoned-carts':
        return <AbandonedCartsTab />;
      case 'marketing-audience':
        return <MarketingAudienceTab />;
      case 'emails':
        if (!['admin', 'super_admin', 'lead_gen', 'accounts', 'accounts_manager', 'accounts_payroll', 'sales_manager', 'performance_manager'].includes(effectiveUserRole) && effectiveUserPermissions?.tab_analytics !== true) {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">The Emails tab is restricted to admins and lead generation users.</p>
            </div>
          );
        }
        return <UnifiedEmailHub />;
      case 'analytics':
        return <AnalyticsTab userRole={effectiveUserRole} />;
      case 'page-analytics':
        return <PageAnalyticsTab />;
      case 'google-ads':
        return <MarketingAnalyticsTab />;
      case 'lead-backup':
        return <LeadBackupRecoveryTab />;
      case 'banners-billboards':
        return <OfflineCampaignsTab />;
      case 'vehicle-stats':
        return <VehicleStatsTab />;
      case 'security':
        return <ClickFraudTab />;
      case 'user-permissions':
        return <UserPermissionsTab />;
      case 'lead-teams':
        if (
          !isTabAllowedForRole('lead-teams', effectiveUserRole, effectiveUserPermissions)
        ) {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">Lead Allocation is restricted to managers, sales leads, and admins.</p>
            </div>
          );
        }
        return <LeadTeamsTab onNavigateToTab={handleTabChange} />;
      case 'orr-test-lab':
        return <OrrTestLabPage onNavigateToTab={handleTabChange} />;
      case 'price-updates':
        return <PriceUpdatesTab />;
      case 'sms-tracking':
        return <SmsTrackingTab />;

      case 'document-mapping':
        return <DocumentMappingTab />;
      case 'policy-documents':
        return <PolicyDocumentsTab />;
      case 'blogs-data':
        return <BlogWritingTab />;
      case 'landing-pages':
        return <LandingPageBuilder />;
      case 'get-quote':
        return <GetQuoteTab prePopulatedLead={selectedLeadForQuote} onNavigateToTab={handleTabChange} userRole={effectiveUserRole} userPermissions={effectiveUserPermissions} />;
      case 'concessions':
        return <ConcessionsTab />;

      case 'call-tracking':
        return <CallTrackingTab userRole={effectiveUserRole} userPermissions={effectiveUserPermissions} />;
      case 'new-leads':
        return (
          <NewLeadsTab 
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onNavigateToTab={handleTabChange}
            userRole={effectiveUserRole}
          />
        );
      case 'recontact-leads':
      case 'goldmine-leads':
        return (
          <GoldenLeadsTab
            userRole={effectiveUserRole}
            onNavigateToTab={handleTabChange}
          />
        );
      case 'renewals':
        return <RenewalsQueueTab userRole={effectiveUserRole} onNavigateToTab={handleTabChange} />;
      case 'selling-tips':
        return <SellingTipsSection />;
      case 'timesheets':
        return <TimesheetsTab onNavigateToTab={handleTabChange} />;
      case 'sales-agent-targets': {
        const canSetTargets = ['admin', 'super_admin', 'sales_manager', 'performance_manager'].includes(effectiveUserRole);
        if (!canSetTargets) {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">Sales agent monthly targets are set by management.</p>
            </div>
          );
        }
        return <SalesAgentTargetsTab />;
      }
      case 'sales-scoreboard':
        if (!ADMIN_ROLES.includes(effectiveUserRole)) {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">The Sales Scoreboard is restricted to staff members.</p>
            </div>
          );
        }
        return <SalesScoreboardTab />;
      case 'testing':
        return <TestingTabContent />;
      case 'ab-testing':
        return <AbTestingTab />;
      case 'discounts-given':
        return <DiscountsGivenTab />;
      case 'cancellations':
        return <CancellationsTab />;
      case 'refunds-paid':
        return <RefundsPaidTab />;
      case 'ghl-sync-log':
        if (effectiveUserRole !== 'super_admin' && effectiveUserRole !== 'admin') {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">GHL sync log is restricted to administrators.</p>
            </div>
          );
        }
        return <GhlSyncLogTab />;
      case 'unsubscribe':
        return <UnsubscribeTab />;
      case 'attendance':
        return <AttendanceTab />;
      case 'hr':
        return <HRTab userRole={effectiveUserRole} />;
      case 'account':
        return <AccountSettings />;
      case 'attribution-settings':
        if (effectiveUserRole !== 'super_admin' && effectiveUserRole !== 'admin') {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">Attribution Settings is restricted to administrators.</p>
            </div>
          );
        }
        return <AttributionSettingsTab />;
      case 'feature-flags':
        if (effectiveUserRole !== 'super_admin' && effectiveUserRole !== 'admin') {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">Feature Flags is restricted to administrators.</p>
            </div>
          );
        }
        return <FeatureFlagsTab userRole={effectiveUserRole} />;
      case 'staff-hub':
        return <StaffHubTab />;
      case 'agent-feedback':
        return <AgentFeedbackTab userRole={effectiveUserRole} />;
      default:
        return <CustomersTab />;
    }
  };

  const navigateToQuoteForm = () => {
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <ViewAsProvider realRole={userRole} realPermissions={userPermissions} realAdminUserId={adminUserId}>
      <AdminDashboardInner
        activeTab={activeTab}
        handleTabChange={handleTabChange}
        userRole={userRole}
        userPermissions={userPermissions}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        navigateToQuoteForm={() => {
          navigate('/');
          setTimeout(() => {
            const element = document.getElementById('quote-form');
            if (element) element.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }}
        renderContent={renderContent}
        accessFromCache={accessFromCache}

        navigate={navigate}
      />
    </ViewAsProvider>
  );
};

/** Inner component that reads ViewAs context */
const AdminDashboardInner: React.FC<{
  activeTab: string;
  handleTabChange: (tab: string) => void;
  userRole: string | null;
  userPermissions: Record<string, boolean> | null;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  navigateToQuoteForm: () => void;
  renderContent: (role: string | null, perms: Record<string, boolean> | null) => React.ReactNode;
  navigate: (path: string, options?: any) => void;
  accessFromCache?: boolean;
}> = ({ activeTab, handleTabChange, userRole, userPermissions, isMobileMenuOpen, setIsMobileMenuOpen, navigateToQuoteForm, renderContent, navigate, accessFromCache }) => {

  const { effectiveRole, effectivePermissions, isImpersonating, viewAsAgent } = useViewAs();
  const { collapsed: sidebarCollapsed } = useAdminSidebarCollapsed();
  const { session } = useAuth();
  const isSuperAdmin = userRole === 'super_admin';

  // Use effective (impersonated) role for sidebar and content
  const displayRole = isImpersonating ? effectiveRole : userRole;
  const displayPermissions = isImpersonating ? effectivePermissions : userPermissions;

  useEffect(() => {
    if (!isTabAllowedForRole(activeTab, displayRole, displayPermissions)) {
      handleTabChange(getFirstPermittedTab(displayRole, displayPermissions));
    }
  }, [activeTab, displayRole, displayPermissions, handleTabChange]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SEOHead 
        title="Admin Dashboard | BuyAWarranty Management"
        description="Administrative dashboard for managing warranties, customers, and business operations."
        keywords="admin, dashboard, warranty management"
      />
      {accessFromCache && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-900">
          Showing your last known access — reconnecting to the CRM…
        </div>
      )}
      <WorkingWeekReminderBanner userRole={displayRole} />
      <DiscountAuthBanner userRole={displayRole} />

      
      
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-6 sm:h-8 w-auto" />
              </Link>
            </div>
            
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              <Link to="/what-is-covered/" className="text-gray-700 hover:text-gray-900 font-medium text-sm">What's Covered</Link>
              <Link to="/make-a-claim/" className="text-gray-700 hover:text-gray-900 font-medium text-sm">Make a Claim</Link>
              <Link to="/faq/" className="text-gray-700 hover:text-gray-900 font-medium text-sm">FAQs</Link>
              <Link to="/contact-us/" className="text-gray-700 hover:text-gray-900 font-medium text-sm">Contact Us</Link>
            </nav>

            <div className="hidden lg:flex items-center space-x-3">
              <GlobalQuickReminderButton />
              {/* View As dropdown - super_admin only */}
              {isSuperAdmin && <ViewAsDropdown />}

              
              <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600 px-3 text-sm"
                >
                  WhatsApp Us
                </Button>
              </a>
              <Button 
                size="sm"
                onClick={navigateToQuoteForm}
                className="bg-orange-500 text-white hover:bg-orange-600 px-3 text-sm"
              >
                Get my quote
              </Button>
            </div>

            <div className="lg:hidden flex items-center space-x-2">
              
              <GlobalQuickReminderButton />
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>

                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Menu className="h-8 w-8" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between pb-6">
                      <Link to="/" className="hover:opacity-80 transition-opacity">
                        <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-8 w-auto" />
                      </Link>
                    </div>
                    <nav className="flex flex-col space-y-6 flex-1">
                      <Link to="/what-is-covered/" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200" onClick={() => setIsMobileMenuOpen(false)}>What's Covered</Link>
                      <Link to="/make-a-claim/" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200" onClick={() => setIsMobileMenuOpen(false)}>Make a Claim</Link>
                      <Link to="/faq/" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200" onClick={() => setIsMobileMenuOpen(false)}>FAQs</Link>
                      <Link to="/contact-us" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200" onClick={() => setIsMobileMenuOpen(false)}>Contact Us</Link>
                      <Link to="/customer-dashboard" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200" onClick={() => setIsMobileMenuOpen(false)}>Customer Dashboard</Link>
                      <span className="text-orange-500 font-semibold text-sm py-2 border-b border-gray-200">Admin Dashboard</span>
                    </nav>
                    <div className="space-y-4 pt-6 mt-auto">
                      <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="w-full bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600 text-lg py-3" onClick={() => setIsMobileMenuOpen(false)}>WhatsApp Us</Button>
                      </a>
                      <Button className="w-full bg-orange-500 text-white hover:bg-orange-600 text-lg py-3" onClick={() => { setIsMobileMenuOpen(false); navigateToQuoteForm(); }}>Get my quote</Button>
                      <button onClick={async () => { await supabase.auth.signOut(); navigate('/auth'); setIsMobileMenuOpen(false); }} className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors text-lg">Sign Out</button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
        </div>
      </div>
      </header>



      {/* Global auto-distribute control + backlog warning — visible on every admin page */}
      <GlobalAutoDistributeBar
        userRole={displayRole}
        onGoToPool={() => handleTabChange('new-leads')}
      />

      {/* Quick-grant access bar for admins — hand out newly-added sections without opening User Permissions */}
      <QuickGrantAccessBar userRole={displayRole} />

      {/* Checkout struggle alert bar — admin & super_admin only */}
      <CheckoutStruggleAlertBar userRole={userRole} />

      {/* Payments to collect — management only */}
      <CollectPaymentsBanner userRole={userRole} onNavigate={handleTabChange} />


      {/* Real-time incoming CallRail call banner */}
      <IncomingCallBanner />

      {/* Global missed inbound call bar — visible on every admin tab */}
      <MissedCallAlertBar
        userRole={userRole}
        onOpenLead={(leadId) => navigate(`/admin-dashboard/?tab=new-leads&leadId=${leadId}`)}
      />


      {/* Full-width top banner (beep + mute lives here) so agents can't miss a lead */}
      <NewLeadTopBanner
        onGo={(leadId) => navigate(`/admin-dashboard/?tab=new-leads&leadId=${leadId}`)}
      />

      {/* Fresh-lead top banner + floating popup for the current agent */}
      <NewLeadAlerts />


      {/* Persistent "Take lead" popup for agents on Open Pool mode */}
      <OpenPoolLeadAlert />

      {/* Missed callback banner — prominent red bar, dismissible with live overdue timer */}
      <MissedCallbackAlertBanner
        onNavigate={(leadId, type) => {
          if (type === 'customer') handleTabChange('customers');
          else handleTabChange('new-leads');
        }}
      />

      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-white text-center py-1.5 text-sm font-medium shadow-md z-40">
          👁️ Viewing dashboard as <strong>{viewAsAgent?.firstName} {viewAsAgent?.lastName}</strong> ({effectiveRole?.replace('_', ' ')}) — This is read-only simulation mode
        </div>
      )}
      
      <ReminderDuePopup activeTab={activeTab} onNavigate={(leadId, type) => {
        if (type === 'customer') {
          handleTabChange('customers');
        } else {
          handleTabChange('new-leads');
        }
      }} />

      <NewLeadsWaitingBanner
        activeTab={activeTab}
        onGo={() => handleTabChange('new-leads')}
      />


      <div className="flex-1 flex flex-col lg:flex-row">
        <AdminSidebar activeTab={activeTab} onTabChange={handleTabChange} userRole={displayRole} userPermissions={displayPermissions} />
        
        <div className={`flex-1 ${sidebarCollapsed ? 'lg:ml-14' : 'lg:ml-64'} overflow-hidden transition-[margin] duration-300`}>
          <FrequentTabsBar
            userId={session?.user?.id ?? null}
            activeTab={activeTab}
            onSelect={handleTabChange}
          />
          <main className="p-4 lg:p-6 overflow-y-auto h-[calc(100vh-104px)]">
            <TabErrorBoundary tabKey={activeTab} onRetry={() => window.location.reload()}>
              <Suspense fallback={<TabFallback />}>
                {renderContent(displayRole, displayPermissions)}
              </Suspense>
            </TabErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
