import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SEOHead } from '@/components/SEOHead';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { useAdminBackNavigation } from '@/hooks/useAdminBackNavigation';
import { useUserPresence } from '@/hooks/useUserPresence';
import { ViewAsProvider, useViewAs } from '@/contexts/ViewAsContext';
import { ViewAsDropdown } from '@/components/admin/ViewAsDropdown';
import ReminderDuePopup from '@/components/admin/leads/ReminderDuePopup';
import { CheckoutStruggleAlertBar } from '@/components/admin/CheckoutStruggleAlertBar';

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
const DocumentMappingTab = lazy(() => import('@/components/admin/DocumentMappingTab').then(m => ({ default: m.DocumentMappingTab })));
const BulkPricingTab = lazy(() => import('@/components/admin/BulkPricingTab').then(m => ({ default: m.BulkPricingTab })));
const BlogWritingTab = lazy(() => import('@/components/admin/BlogWritingTab').then(m => ({ default: m.BlogWritingTab })));
const LandingPageBuilder = lazy(() => import('@/components/admin/LandingPageBuilder').then(m => ({ default: m.LandingPageBuilder })));
const ClickFraudTab = lazy(() => import('@/components/admin/ClickFraudTab').then(m => ({ default: m.ClickFraudTab })));

const TestingTabContent = lazy(() => import('@/components/admin/TestingTabContent').then(m => ({ default: m.TestingTabContent })));
const NewLeadsTab = lazy(() => import('@/components/admin/leads/NewLeadsTab').then(m => ({ default: m.NewLeadsTab })));
const GoldenLeadsTab = lazy(() => import('@/components/admin/leads/LeadRecoveryTab').then(m => ({ default: m.LeadRecoveryTab })));
const RetentionTab = lazy(() => import('@/components/admin/retention/RetentionTab').then(m => ({ default: m.RetentionTab })));
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
const MarketingAnalyticsTab = lazy(() => import('@/components/admin/MarketingAnalyticsTab').then(m => ({ default: m.MarketingAnalyticsTab })));
const LeadBackupRecoveryTab = lazy(() => import('@/components/admin/LeadBackupRecoveryTab'));
const DiscountsGivenTab = lazy(() => import('@/components/admin/DiscountsGivenTab'));
const CancellationsTab = lazy(() => import('@/components/admin/CancellationsTab').then(m => ({ default: m.CancellationsTab })));
const RefundsPaidTab = lazy(() => import('@/components/admin/RefundsPaidTab').then(m => ({ default: m.RefundsPaidTab })));
const GhlSyncLogTab = lazy(() => import('@/components/admin/GhlSyncLogTab').then(m => ({ default: m.GhlSyncLogTab })));
const AbTestingTab = lazy(() => import('@/components/admin/AbTestingTab'));
const UnsubscribeTab = lazy(() => import('@/components/admin/UnsubscribeTab').then(m => ({ default: m.UnsubscribeTab })));

const ADMIN_ROLES = ['super_admin', 'admin', 'member', 'viewer', 'guest', 'blog_writer', 'sales', 'sales_lead', 'sales_manager', 'dev_tester', 'accounts_manager', 'accounts_payroll', 'lead_gen', 'accounts', 'claims_agent', 'claims_manager'];
const ROLE_PRIORITY = ['super_admin', 'admin', 'claims_agent', 'claims_manager', 'member', 'sales_manager', 'sales_lead', 'lead_gen', 'viewer', 'guest', 'sales', 'blog_writer', 'dev_tester', 'accounts_manager', 'accounts_payroll', 'accounts'];
const CLAIMS_AGENT_TABS = ['claims', 'complaints', 'customers', 'discount-codes', 'discounts-given', 'cancellations', 'refunds-paid', 'staff-hub', 'unsubscribe', 'account'];
const CLAIMS_MANAGER_TABS = ['claims', 'complaints', 'staff-hub', 'unsubscribe', 'account'];
const SALES_TABS = ['new-leads', 'recontact-leads', 'get-quote', 'selling-tips', 'discount-codes', 'timesheets', 'staff-hub', 'unsubscribe', 'account'];
const SALES_LEAD_TABS = ['new-leads', 'recontact-leads', 'get-quote', 'sales-scoreboard', 'customers', 'analytics', 'selling-tips', 'discount-codes', 'timesheets', 'staff-hub', 'lead-teams', 'unsubscribe', 'account'];
const SALES_MANAGER_TABS = ['new-leads', 'recontact-leads', 'get-quote', 'sales-scoreboard', 'customers', 'analytics', 'selling-tips', 'discount-codes', 'timesheets', 'staff-hub', 'lead-teams', 'claims', 'unsubscribe', 'account'];

const getFirstPermittedTab = (role: string | null, permissions?: Record<string, boolean> | null) => {
  const preferredOrder = role === 'claims_agent' || role === 'claims_manager'
    ? ['claims', 'customers', 'discount-codes', 'discounts-given', 'cancellations', 'refunds-paid', 'staff-hub', 'account']
    : ['customers', 'new-leads', 'get-quote', 'claims', 'discount-codes', 'timesheets', 'staff-hub', 'account'];

  if (role === 'blog_writer') return 'blog-writing';
  if (role === 'sales' || role === 'sales_lead' || role === 'sales_manager' || role === 'lead_gen') return 'new-leads';
  if (role === 'claims_agent' || role === 'claims_manager') return 'claims';

  if (permissions) {
    const firstPreferred = preferredOrder.find(tab => permissions[`tab_${tab}`] === true);
    if (firstPreferred) return firstPreferred;
    const firstAllowed = Object.keys(permissions).find(key => key.startsWith('tab_') && permissions[key]);
    if (firstAllowed) return firstAllowed.replace('tab_', '');
  }

  return 'customers';
};

// Tabs that are restricted to super_admin / dev_tester by default.
// Other roles only see them when explicitly granted via tab_<id> = true in permissions.
const SUPER_ADMIN_ONLY_TABS = new Set<string>(['plans']);

const isTabAllowedForRole = (tab: string, role: string | null, permissions?: Record<string, boolean> | null) => {
  const permKey = `tab_${tab}`;
  if (tab === 'account') return true;
  if (tab === 'unsubscribe') return true;
  if (role === 'super_admin' || role === 'dev_tester') return true;
  if (SUPER_ADMIN_ONLY_TABS.has(tab)) {
    return permissions?.[permKey] === true;
  }
  if (role === 'admin') return permissions?.[permKey] !== false;
  if (role === 'claims_agent') return permissions ? permissions[permKey] === true : CLAIMS_AGENT_TABS.includes(tab);
  if (role === 'claims_manager') return permissions?.[permKey] === true || CLAIMS_MANAGER_TABS.includes(tab);
  if (role === 'sales_lead') return SALES_LEAD_TABS.includes(tab);
  if (role === 'sales_manager') return SALES_MANAGER_TABS.includes(tab) || permissions?.[permKey] === true;
  if (role === 'sales') return SALES_TABS.includes(tab) || permissions?.[permKey] === true;
  if (tab === 'claims') {
    return permissions?.[permKey] === true;
  }
  if (permissions && Object.keys(permissions).length > 0) return permissions[permKey] === true;
  return true;
};

// Tab loading spinner
const TabFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Error boundary for lazy-loaded tab chunks
class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void },
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
    console.error('[TabErrorBoundary] Chunk load error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-destructive font-medium">Failed to load this tab.</p>
          <p className="text-sm text-muted-foreground">This can happen due to a network issue or a new deployment.</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onRetry();
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90"
          >
            Reload Tab
          </button>
        </div>
      );
    }
    return this.props.children;
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
  };
  const urlTab = rawUrlTab ? (TAB_ALIASES[rawUrlTab] ?? rawUrlTab) : null;
  const [activeTab, setActiveTab] = useState<string>(urlTab || 'customers');
  // Rewrite legacy tab in URL once on mount
  useEffect(() => {
    if (rawUrlTab && TAB_ALIASES[rawUrlTab]) {
      setSearchParams({ tab: TAB_ALIASES[rawUrlTab] }, { replace: true });
    }
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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useAdminNotifications(userRole);
  
  // Track user presence with current tab - only after access confirmed
  useUserPresence({ currentTab: activeTab });

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
    setSearchParams({ tab: newTab }, { replace: true });
  }, [setSearchParams]);

  // Back navigation within the dashboard
  const handleBackToTab = useCallback((previousTab: string, updatedHistory: string[]) => {
    setActiveTab(previousTab);
    setTabHistory(updatedHistory);
    setSearchParams({ tab: previousTab }, { replace: true });
  }, [setSearchParams]);

  // Ensure the current tab is always in the history stack
  useEffect(() => {
    if (tabHistory.length === 0) {
      setTabHistory([activeTab]);
    }
  }, [activeTab, tabHistory.length]);

  // Guard the back button so it can't return to the referrer
  useAdminBackNavigation({
    activeTab,
    tabHistory,
    onBackToTab: handleBackToTab,
    enabled: hasAdminAccess && !isCheckingRole,
  });


  // Track if we've already checked access to prevent multiple redirects
  const hasCheckedAccessRef = React.useRef(false);

  useEffect(() => {
    // Only run check when auth is done loading AND we haven't already confirmed access
    if (!authLoading && !hasCheckedAccessRef.current && !hasAdminAccess) {
      checkAdminAccess();
      
      // Safety timeout: if access check hangs for 10s, force stop loading
      if (accessCheckTimeoutRef.current) clearTimeout(accessCheckTimeoutRef.current);
      accessCheckTimeoutRef.current = setTimeout(() => {
        if (!hasCheckedAccessRef.current) {
          console.warn('[AdminDashboard] Access check safety timeout triggered after 10s');
          hasCheckedAccessRef.current = true;
          setIsCheckingRole(false);
          // Don't redirect - let the guard condition handle it
        }
      }, 10000);
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

  const checkAdminAccess = async () => {
    try {
      // Always use server-verified getUser() to avoid stale session issues
      const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();

      let currentUser = verifiedUser;
      if (userError || !currentUser) {
        // Fallback: try getSession as last resort  
        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
        if (!fallbackSession?.user) {
          hasCheckedAccessRef.current = true;
          setIsCheckingRole(false);
          navigate('/auth', { replace: true });
          return;
        }
        currentUser = fallbackSession.user;
      }

      // Parallel fetch: roles and permissions at the same time for speed
      const [rolesResult, permissionsResult] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', currentUser.id),
        supabase.from('admin_users').select('id, permissions').eq('user_id', currentUser.id).maybeSingle()
      ]);

      const { data, error } = rolesResult;
      const adminUserData = permissionsResult.data;

      const userAdminRoles = data?.filter(r => ADMIN_ROLES.includes(r.role)) || [];
      
      if (error || userAdminRoles.length === 0) {
        hasCheckedAccessRef.current = true;
        setIsCheckingRole(false);
        navigate('/auth', { replace: true });
        return;
      }

      const primaryRole = ROLE_PRIORITY.find(role => userAdminRoles.some(r => r.role === role)) || userAdminRoles[0].role;
      
      setUserRole(primaryRole);
      setHasAdminAccess(true);
      hasCheckedAccessRef.current = true;
      
      if (adminUserData?.id) {
        setAdminUserId(adminUserData.id);
      }
      
      if (adminUserData?.permissions) {
        setUserPermissions(adminUserData.permissions as Record<string, boolean>);
      }
      
      // Set default tab based on role (only if no URL tab param was provided)
      if (!hasSetInitialTab) {
        setHasSetInitialTab(true);
        
        const defaultTab = getFirstPermittedTab(primaryRole, adminUserData?.permissions as Record<string, boolean> | null);
        
        setActiveTab(defaultTab);
        setTabHistory([defaultTab]);
        setSearchParams({ tab: defaultTab }, { replace: true });
      }
      
      setIsCheckingRole(false);
    } catch (error) {
      console.error('Error checking admin access:', error);
      hasCheckedAccessRef.current = true;
      setIsCheckingRole(false);
      navigate('/auth', { replace: true });
    }
  };

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
        if (!['admin', 'super_admin', 'lead_gen'].includes(effectiveUserRole)) {
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
      case 'vehicle-stats':
        return <VehicleStatsTab />;
      case 'security':
        return <ClickFraudTab />;
      case 'user-permissions':
        return <UserPermissionsTab />;
      case 'lead-teams':
        if (
          effectiveUserRole !== 'super_admin' &&
          effectiveUserRole !== 'admin' &&
          effectiveUserRole !== 'sales_manager' &&
          effectiveUserRole !== 'sales_lead'
        ) {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">Lead Allocation is restricted to managers, sales leads, and admins.</p>
            </div>
          );
        }
        return <LeadTeamsTab onNavigateToTab={handleTabChange} />;
      case 'document-mapping':
        return <DocumentMappingTab />;
      case 'policy-documents':
        return <PolicyDocumentsTab />;
      case 'blog-writing':
        return <BlogWritingTab />;
      case 'landing-pages':
        return <LandingPageBuilder />;
      case 'get-quote':
        return <GetQuoteTab prePopulatedLead={selectedLeadForQuote} />;
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
        return <GoldenLeadsTab userRole={effectiveUserRole} onNavigateToTab={handleTabChange} />;
      case 'renewals':
        return <RetentionTab userRole={effectiveUserRole} onNavigateToTab={handleTabChange} />;
      case 'selling-tips':
        return <SellingTipsSection />;
      case 'timesheets':
        return <TimesheetsTab />;
      case 'sales-scoreboard':
        if (
          effectiveUserRole !== 'super_admin' &&
          effectiveUserRole !== 'admin' &&
          effectiveUserRole !== 'sales_lead' &&
          effectiveUserRole !== 'sales' &&
          effectiveUserRole !== 'sales_agent'
        ) {
          return (
            <div className="p-6">
              <h2 className="text-xl font-semibold">Access denied</h2>
              <p className="text-sm text-muted-foreground mt-1">The Sales Scoreboard is restricted to sales team members and admins.</p>
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
}> = ({ activeTab, handleTabChange, userRole, userPermissions, isMobileMenuOpen, setIsMobileMenuOpen, navigateToQuoteForm, renderContent, navigate }) => {
  const { effectiveRole, effectivePermissions, isImpersonating, viewAsAgent } = useViewAs();
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

      {/* Checkout struggle alert bar — admin & super_admin only */}
      <CheckoutStruggleAlertBar userRole={userRole} />

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

      <div className="flex-1 flex flex-col lg:flex-row">
        <AdminSidebar activeTab={activeTab} onTabChange={handleTabChange} userRole={displayRole} userPermissions={displayPermissions} />
        
        <div className="flex-1 lg:ml-64 overflow-hidden">
          <main className="p-4 lg:p-6 overflow-y-auto h-[calc(100vh-104px)]">
            <TabErrorBoundary onRetry={() => window.location.reload()}>
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
