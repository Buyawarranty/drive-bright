
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList, Line, ComposedChart } from 'recharts';
import { Users, CreditCard, PoundSterling, Globe, Phone, X, Calendar, TrendingUp, TrendingDown, Minus, Target, Facebook } from 'lucide-react';
import { toast } from 'sonner';
import { ApiConnectivityTest } from './ApiConnectivityTest';
import { SalesAgeMileageAnalytics } from './SalesAgeMileageAnalytics';
import { DateRangeFilter } from './DateRangeFilter';
import { CostEfficiencyPanel } from './scoreboard/CostEfficiencyPanel';
import { CoverOptionsMixPanel } from './analytics/CoverOptionsMixPanel';
import { DailyRevenueTrendPanel } from './analytics/DailyRevenueTrendPanel';
import { CustomerDemographicsPanel } from './analytics/CustomerDemographicsPanel';

import { QuickMonthFilter } from './QuickMonthFilter';
import { QuickWeekFilter } from './QuickWeekFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, subYears, isSameWeek, isSameMonth, isSameYear } from 'date-fns';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  signup_date: string;
  status: string;
  final_amount: number | null;
  warranty_reference_number: string | null;
  purchase_source: string | null;
  is_manual_entry: boolean | null;
  vehicle_fuel_type: string | null;
  vehicle_year: string | null;
  mileage: string | null;
  assigned_to: string | null;
  sale_credit_admin_user_id: string | null;
  payment_confirmed_by: string | null;
  quote_sent_by: string | null;
  payment_collected_by: string | null;
  updated_at: string | null;
  gclid: string | null;
  acquisition_source: string | null;
  payment_type: string | null;
}

interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

// Test names to exclude from analytics (matching CustomersTab filtering)
const TEST_NAMES = ['kamran qureshi', 'prajwal chauhan', 'accepttest'];

const isTestOrder = (name: string, email: string): boolean => {
  const lowerName = name?.toLowerCase() || '';
  const lowerEmail = email?.toLowerCase() || '';
  
  // Match CustomersTab exclusions
  if (lowerEmail.includes('@test.com')) return true;
  if (lowerEmail.includes('testuser')) return true;
  if (lowerEmail.includes('guest@')) return true;
  if (lowerName === 'test customer') return true;
  if (lowerName === 'guest customer') return true;
  
  // Also exclude specific test names
  return TEST_NAMES.some(testName => lowerName.includes(testName));
};


/**
 * Quick links + section headings for the Analytics dashboard, matching the
 * "Jump to" pattern used on Lead Allocation so managers can hop straight to
 * the block they need instead of scrolling the whole page.
 */
const ANALYTICS_QUICK_LINKS = [
  { id: 'revenue-monthly', label: 'Revenue & AOV', className: 'bg-emerald-300/50 text-emerald-900 border-emerald-200/50 hover:bg-emerald-400/50' },
  { id: 'revenue-daily', label: 'Daily revenue', className: 'bg-teal-300/50 text-teal-900 border-teal-200/50 hover:bg-teal-400/50' },
  { id: 'month-projection', label: 'Month projection', className: 'bg-lime-300/50 text-lime-900 border-lime-200/50 hover:bg-lime-400/50' },
  { id: 'duration-mix', label: 'Duration mix', className: 'bg-sky-300/50 text-sky-900 border-sky-200/50 hover:bg-sky-400/50' },
  { id: 'per-year-value', label: 'Per-year value', className: 'bg-blue-300/50 text-blue-900 border-blue-200/50 hover:bg-blue-400/50' },
  { id: 'aov-by-term', label: 'AOV by term', className: 'bg-indigo-300/50 text-indigo-900 border-indigo-200/50 hover:bg-indigo-400/50' },
  { id: 'daily-breakdown', label: 'Per-day breakdown', className: 'bg-violet-300/50 text-violet-900 border-violet-200/50 hover:bg-violet-400/50' },
  { id: 'cover-options', label: 'Cover options mix', className: 'bg-purple-300/50 text-purple-900 border-purple-200/50 hover:bg-purple-400/50' },
  { id: 'demographics', label: 'Age & UK demographics', className: 'bg-fuchsia-300/50 text-fuchsia-900 border-fuchsia-200/50 hover:bg-fuchsia-400/50' },

  { id: 'filters', label: 'Price analysis per day', className: 'bg-slate-300/50 text-slate-900 border-slate-200/50 hover:bg-slate-400/50' },
  { id: 'key-metrics', label: 'Key metrics', className: 'bg-amber-200/50 text-amber-900 border-amber-100/50 hover:bg-amber-300/50' },
  { id: 'sales-by-source', label: 'Sales by source', className: 'bg-orange-300/50 text-orange-900 border-orange-200/50 hover:bg-orange-400/50' },
  { id: 'price-metrics', label: 'Price metrics', className: 'bg-yellow-300/50 text-yellow-900 border-yellow-200/50 hover:bg-yellow-400/50' },
  { id: 'refunds-cancellations', label: 'Refunds & cancellations', className: 'bg-red-300/50 text-red-900 border-red-200/50 hover:bg-red-400/50' },
  { id: 'signups-vehicles', label: 'Signups & vehicles', className: 'bg-cyan-300/50 text-cyan-900 border-cyan-200/50 hover:bg-cyan-400/50' },
  { id: 'agent-performance', label: 'Agent performance', className: 'bg-rose-300/50 text-rose-900 border-rose-200/50 hover:bg-rose-400/50' },
  { id: 'recent-activity', label: 'Recent activity', className: 'bg-stone-300/50 text-stone-900 border-stone-200/50 hover:bg-stone-400/50' },
  { id: 'api-connectivity', label: 'API connectivity', className: 'bg-gray-300/50 text-gray-900 border-gray-200/50 hover:bg-gray-400/50' },
];

function AnalyticsQuickLinksBar() {
  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  const half = Math.ceil(ANALYTICS_QUICK_LINKS.length / 2);
  const rows = [ANALYTICS_QUICK_LINKS.slice(0, half), ANALYTICS_QUICK_LINKS.slice(half)];

  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex flex-col gap-1.5">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {idx === 0 && <span className="text-xs font-semibold text-foreground shrink-0">Jump to:</span>}
            {row.map(link => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleClick(link.id)}
                className={cn(
                  'shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border hover:shadow-md transition-colors',
                  link.className,
                )}
              >
                {link.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsSectionHeading({
  id,
  title,
  description,
  accent = 'border-primary/60',
  size = 'default',
  controls,
}: {
  id: string;
  title: string;
  description?: string;
  accent?: string;
  size?: 'default' | 'lg';
  controls?: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        'scroll-mt-28 border-l-4 pl-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between',
        accent
      )}
    >
      <div>
        <h2
          className={cn(
            'font-semibold text-foreground',
            size === 'lg' ? 'text-2xl md:text-3xl font-bold tracking-tight' : 'text-lg'
          )}
        >
          {title}
        </h2>
        {description && (
          <p className={cn('text-muted-foreground', size === 'lg' ? 'text-sm' : 'text-xs')}>{description}</p>
        )}
      </div>
      {controls && <div className="shrink-0">{controls}</div>}
    </div>
  );
}


export const AnalyticsTab = ({ userRole }: { userRole?: string | null }) => {
  const isSalesLead = userRole === 'sales_lead';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  // Keeps the current section in view when filters change and panels resize.
  const filtersSectionRef = useRef<HTMLDivElement>(null);
  // Default to "This Month"
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [perYearScope, setPerYearScope] = useState<string>('last12');
  const [comparisonPeriod, setComparisonPeriod] = useState<'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | 'last_30' | 'year' | null>('month');

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const customerSelect = 'id, name, email, plan_type, signup_date, status, final_amount, warranty_reference_number, purchase_source, is_manual_entry, vehicle_fuel_type, vehicle_year, mileage, assigned_to, sale_credit_admin_user_id, payment_confirmed_by, quote_sent_by, payment_collected_by, updated_at, gclid, acquisition_source, payment_type';

  // Refetch data whenever the component mounts or becomes visible
  useEffect(() => {
    fetchAnalyticsData();
    
    // Also refetch when tab becomes visible (user switches back to analytics)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAnalyticsData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchAnalyticsData = async () => {
    if (hasLoadedOnceRef.current) setRefreshing(true);
    else setLoading(true);

    try {
      console.log('Fetching analytics data...');

      let customersData: Customer[] = [];

      // Primary path: batch fetch for full dataset beyond the 1000-row limit
      const { data, error } = await fetchAllRows(() =>
        supabase
          .from('customers')
          .select(customerSelect)
          .not('email', 'ilike', '%@test.com%')
          .not('email', 'ilike', '%testuser%')
          .not('email', 'ilike', '%guest@%')
          .not('name', 'eq', 'Test Customer')
          .not('name', 'eq', 'Guest Customer')
          .eq('is_deleted', false)
          .order('signup_date', { ascending: false })
          .order('id', { ascending: false })
      );

      if (error) {
        console.error('Error fetching customers via batch query:', error);

        // Fallback path: use a direct query so analytics still loads if the batch query breaks
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('customers')
          .select(customerSelect)
          .not('email', 'ilike', '%@test.com%')
          .not('email', 'ilike', '%testuser%')
          .not('email', 'ilike', '%guest@%')
          .not('name', 'eq', 'Test Customer')
          .not('name', 'eq', 'Guest Customer')
          .eq('is_deleted', false)
          .order('updated_at', { ascending: false })
          .limit(3000);

        if (fallbackError) {
          console.error('Fallback analytics customer query failed:', fallbackError);
          throw fallbackError;
        }

        customersData = fallbackData || [];
      } else {
        customersData = data || [];
      }

      // Also filter out specific test names not caught by DB query
      const realCustomers = customersData.filter(c => !isTestOrder(c.name, c.email));
      console.log('Real customers (matching Customer Dashboard):', realCustomers.length);
      
      setCustomers(realCustomers);

      // Fetch admin users separately so a permissions issue here does not blank the whole analytics tab
      const { data: usersData, error: usersError } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .eq('is_active', true);

      if (usersError) {
        console.error('Error fetching admin users for analytics:', usersError);
        setAdminUsers([]);
      } else {
        setAdminUsers(usersData || []);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Applies a filter change without the page jumping: the filters block is
   * pinned to its current viewport position after panels re-render.
   */
  const applyFilterChange = useCallback((change: () => void) => {
    const el = filtersSectionRef.current;
    const before = el?.getBoundingClientRect().top ?? null;
    change();
    if (before === null || !el) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const after = el.getBoundingClientRect().top;
        const delta = after - before;
        if (Math.abs(delta) < 2) return;
        let node: HTMLElement | null = el.parentElement;
        while (node) {
          const style = window.getComputedStyle(node);
          if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
            node.scrollTop += delta;
            return;
          }
          node = node.parentElement;
        }
        window.scrollBy({ top: delta });
      })
    );
  }, []);

  /**
   * Compact per-section date controls (quick month stepper + full date range).
   * They drive the same page-level period as the main filters block.
   */
  const setPeriod = useCallback((range: DateRange | undefined) => {
    applyFilterChange(() => {
      setDateRange(range);
      setSelectedMonth(null);
      setComparisonPeriod(null);
    });
  }, [applyFilterChange]);

  const sectionFilters = (
    <div className="flex flex-wrap items-center gap-2">
      <QuickMonthFilter dateRange={dateRange} onDateRangeChange={setPeriod} />
      <DateRangeFilter dateRange={dateRange} onDateRangeChange={setPeriod} />
    </div>
  );



  // Handle bar chart click - filter to selected month
  const handleBarClick = useCallback((data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedData = data.activePayload[0].payload;
      if (selectedMonth === clickedData.monthKey) {
        // If clicking the same month, clear the selection
        setSelectedMonth(null);
      } else {
        setSelectedMonth(clickedData.monthKey);
        // Clear date range when selecting a specific month from chart
        setDateRange(undefined);
      }
    }
  }, [selectedMonth]);

  // Clear selected month
  const clearSelectedMonth = useCallback(() => {
    setSelectedMonth(null);
  }, []);

  // Handle period comparison selection
  const handlePeriodComparison = useCallback((period: 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | 'last_30' | 'year' | null) => {
    if (comparisonPeriod === period) {
      setComparisonPeriod(null);
      setDateRange(undefined);
    } else {
      setComparisonPeriod(period);
      setSelectedMonth(null);
      
      const now = new Date();
      let from: Date, to: Date;
      
      switch (period) {
        case 'today':
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          break;
        case 'yesterday':
          const yest = new Date(now);
          yest.setDate(yest.getDate() - 1);
          from = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate());
          to = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
          break;
        case 'week':
          from = startOfWeek(now, { weekStartsOn: 1 });
          to = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'last_week':
          const lastWeekDate = new Date(now);
          lastWeekDate.setDate(lastWeekDate.getDate() - 7);
          from = startOfWeek(lastWeekDate, { weekStartsOn: 1 });
          to = endOfWeek(lastWeekDate, { weekStartsOn: 1 });
          break;
        case 'month':
          from = startOfMonth(now);
          to = endOfMonth(now);
          break;
        case 'last_month':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          from = startOfMonth(lastMonth);
          to = endOfMonth(lastMonth);
          break;
        case 'last_30':
          from = new Date(now);
          from.setDate(from.getDate() - 30);
          to = now;
          break;
        case 'year':
          from = startOfYear(now);
          to = endOfYear(now);
          break;
        default:
          return;
      }
      
      setDateRange({ from, to });
    }
  }, [comparisonPeriod]);

  // Get the effective date filter (combining dateRange, selectedMonth, and comparison period)
  const effectiveDateRange = useMemo(() => {
    if (selectedMonth) {
      // Parse the monthKey (format: "YYYY-MM")
      const [year, month] = selectedMonth.split('-').map(Number);
      const from = new Date(year, month - 1, 1);
      const to = endOfMonth(from);
      return { from, to };
    }
    return dateRange;
  }, [selectedMonth, dateRange]);

  // Helper function to check if customer is cancelled/refunded (excluded from revenue)
  const isRevenueLost = (status: string): boolean => {
    const lowerStatus = status?.toLowerCase() || '';
    return lowerStatus === 'cancelled' || lowerStatus === 'refunded' || lowerStatus === 'test purchase';
  };
  
  // Helper function to check if status is specifically a refund/cancellation
  const isRefunded = (status: string): boolean => {
    const lower = status?.toLowerCase() || '';
    return lower === 'refunded' || lower === 'cancelled';
  };

  // Filter customers based on date range and source
  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      // Date filter
      if (effectiveDateRange?.from) {
        const signupDate = new Date(customer.signup_date);
        const fromStart = new Date(effectiveDateRange.from);
        fromStart.setHours(0, 0, 0, 0);
        if (signupDate < fromStart) return false;
        
        if (effectiveDateRange.to) {
          const toEnd = new Date(effectiveDateRange.to);
          toEnd.setHours(23, 59, 59, 999);
          if (signupDate > toEnd) return false;
        }
      }

      // Source filter - uses purchase_source and is_manual_entry (not warranty number prefix)
      if (sourceFilter !== 'all') {
        const source = customer.purchase_source?.toLowerCase() || '';
        const isManual = customer.is_manual_entry === true;
        const warrantyNum = customer.warranty_reference_number || '';
        
        if (sourceFilter === 'website') {
          // Website sales: BAW- prefix (not BAW-S-) OR legacy: not manual AND purchase_source is website/stripe/bumper/bumper_portal/google_ads/facebook_ads or empty
          const isBawS = warrantyNum.startsWith('BAW-S-');
          const isWebsite = !isBawS && !isManual && (source === 'website' || source === 'stripe' || source === 'bumper' || source === 'bumper_portal' || source === 'google_ads' || source === 'facebook_ads' || source === '');
          if (!isWebsite) return false;
        } else if (sourceFilter === 'staff_purchase') {
          // Staff purchase: BAW-S- prefix (assigned by staff from website purchase)
          if (!warrantyNum.startsWith('BAW-S-')) return false;
        } else if (sourceFilter === 'sales_team') {
          // Sales team: manual entry OR purchase_source is quote_link/external/admin_external
          const isSalesTeam = isManual || source === 'quote_link' || source === 'external' || source === 'admin_external';
          if (!isSalesTeam) return false;
        }
      }

      return true;
    });
  }, [customers, effectiveDateRange, sourceFilter]);

  // Active customers for revenue (excluding cancelled/refunded)
  const activeRevenueCustomers = useMemo(() => {
    return filteredCustomers.filter(c => !isRevenueLost(c.status));
  }, [filteredCustomers]);


  // Helper function to categorize customer by source.
  // Rule (exhaustive — never returns 'unknown' so buckets always reconcile to total):
  //   1. BAW-S- warranty prefix → staff purchase
  //   2. is_manual_entry = true → sales team (admin/back-office entered)
  //   3. otherwise → website (self-serve checkout via Stripe / Bumper / etc.)
  const getCustomerSource = (customer: Customer): 'website' | 'staff_purchase' | 'sales_team' => {
    const warrantyNum = customer.warranty_reference_number || '';
    if (warrantyNum.startsWith('BAW-S-')) return 'staff_purchase';
    if (customer.is_manual_entry === true) return 'sales_team';
    return 'website';
  };

  // Sub-categorize website sales by ad channel — check both purchase_source AND click IDs
  const getWebsiteChannel = (customer: Customer): 'google' | 'facebook' | 'pure' => {
    const source = customer.purchase_source?.toLowerCase() || '';
    const hasGclid = !!(customer.gclid && String(customer.gclid).trim() !== '');
    if (source === 'google_ads' || hasGclid) return 'google';
    if (source === 'facebook_ads') return 'facebook';
    return 'pure';
  };

  // Sub-categorize Sales Team (ADM) sales by the lead's original acquisition source.
  // Sales team sales are admin-entered, so purchase_source is quote_link/external —
  // attribution lives on acquisition_source (copied from the originating lead).
  const getSalesTeamLeadSource = (customer: Customer): 'google' | 'facebook' | 'organic' => {
    const acq = customer.acquisition_source?.toLowerCase() || '';
    const hasGclid = !!(customer.gclid && String(customer.gclid).trim() !== '');
    if (acq === 'google_ads' || hasGclid) return 'google';
    if (acq === 'facebook_ads') return 'facebook';
    return 'organic';
  };

  // Calculate metrics with safe defaults - EXCLUDING cancelled/refunded from revenue
  const totalCustomers = filteredCustomers.length;
  const activeCustomers = filteredCustomers.filter(c => c.status === 'Active').length;
  const cancelledRefundedCount = filteredCustomers.filter(c => isRevenueLost(c.status)).length;
  // Revenue only counts non-cancelled/refunded customers
  const totalRevenue = activeRevenueCustomers.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
  const paidOrders = activeRevenueCustomers.filter(c => c.final_amount && Number(c.final_amount) > 0);
  const overallAOV = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

  // Calculate AOV by source — based on activeRevenueCustomers so it stays
  // in sync with the top KPI cards (same date filter, same source filter,
  // same cancelled/refunded exclusion). Sum of website + staffPurchase +
  // salesTeam buckets equals the "Total Revenue" / "paid orders" cards.
  const sourceMetrics = useMemo(() => {
    const paid = activeRevenueCustomers.filter(c => c.final_amount && Number(c.final_amount) > 0);

    const websiteCustomers = paid.filter(c => getCustomerSource(c) === 'website');
    const staffPurchaseCustomers = paid.filter(c => getCustomerSource(c) === 'staff_purchase');
    const salesTeamCustomers = paid.filter(c => getCustomerSource(c) === 'sales_team');

    // Website channel breakdown
    const googleCustomers = websiteCustomers.filter(c => getWebsiteChannel(c) === 'google');
    const facebookCustomers = websiteCustomers.filter(c => getWebsiteChannel(c) === 'facebook');
    const pureWebsiteCustomers = websiteCustomers.filter(c => getWebsiteChannel(c) === 'pure');

    // Sales Team lead-source breakdown
    const salesGoogle = salesTeamCustomers.filter(c => getSalesTeamLeadSource(c) === 'google');
    const salesFacebook = salesTeamCustomers.filter(c => getSalesTeamLeadSource(c) === 'facebook');
    const salesOrganic = salesTeamCustomers.filter(c => getSalesTeamLeadSource(c) === 'organic');

    const calcStats = (custs: Customer[]) => {
      const revenue = custs.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
      return {
        count: custs.length,
        revenue,
        aov: custs.length > 0 ? Math.round(revenue / custs.length) : 0
      };
    };

    return {
      allSources: calcStats(paid),
      website: calcStats(websiteCustomers),
      staffPurchase: calcStats(staffPurchaseCustomers),
      salesTeam: calcStats(salesTeamCustomers),
      google: calcStats(googleCustomers),
      facebook: calcStats(facebookCustomers),
      pureWebsite: calcStats(pureWebsiteCustomers),
      salesGoogle: calcStats(salesGoogle),
      salesFacebook: calcStats(salesFacebook),
      salesOrganic: calcStats(salesOrganic),
    };
  }, [activeRevenueCustomers]);

  // Price metrics by source: lowest, highest, average — respects both date AND source filter
  const priceMetrics = useMemo(() => {
    const calcMetrics = (custs: Customer[]) => {
      const paid = custs.filter(c => c.final_amount && Number(c.final_amount) > 0 && !isRevenueLost(c.status));
      if (paid.length === 0) return { lowest: 0, highest: 0, average: 0, count: 0 };
      const amounts = paid.map(c => Number(c.final_amount));
      return {
        lowest: Math.min(...amounts),
        highest: Math.max(...amounts),
        average: Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length),
        count: paid.length
      };
    };

    // Use filteredCustomers which already has date + source filters applied
    const websiteCusts = filteredCustomers.filter(c => getCustomerSource(c) === 'website');
    const salesCusts = filteredCustomers.filter(c => getCustomerSource(c) === 'sales_team');

    return {
      combined: calcMetrics(filteredCustomers),
      website: calcMetrics(websiteCusts),
      salesTeam: calcMetrics(salesCusts),
    };
  }, [filteredCustomers]);

  // Refund/cancellation metrics calculation
  const refundMetrics = useMemo(() => {
    const refundedCustomers = filteredCustomers.filter(c => isRefunded(c.status));
    const totalRefundAmount = refundedCustomers.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
    const totalSalesCount = filteredCustomers.length;
    const totalSalesRevenue = filteredCustomers.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
    const percentOfSales = totalSalesCount > 0 ? ((refundedCustomers.length / totalSalesCount) * 100) : 0;
    const percentOfRevenue = totalSalesRevenue > 0 ? ((totalRefundAmount / totalSalesRevenue) * 100) : 0;
    return {
      count: refundedCustomers.length,
      totalAmount: totalRefundAmount,
      percentOfSales: percentOfSales.toFixed(1),
      percentOfRevenue: percentOfRevenue.toFixed(1),
    };
  }, [filteredCustomers]);

  // Monthly refund data (last 12 months)
  const monthlyRefunds = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        refundAmount: 0,
        refundCount: 0
      };
    }).reverse();

    customers.forEach(customer => {
      if (isRefunded(customer.status) && customer.final_amount) {
        // Use updated_at as cancellation date (when status changed), fall back to signup_date
        const cancelDate = new Date(customer.updated_at || customer.signup_date);
        const monthKey = `${cancelDate.getFullYear()}-${String(cancelDate.getMonth() + 1).padStart(2, '0')}`;
        const monthData = months.find(m => m.monthKey === monthKey);
        if (monthData) {
          monthData.refundAmount += Number(customer.final_amount) || 0;
          monthData.refundCount += 1;
        }
      }
    });

    return months;
  }, [customers]);

  // Normalize and categorize vehicle fuel types
  const normalizeVehicleType = (fuelType: string | null): string => {
    if (!fuelType) return 'Unknown';
    const lower = fuelType.toLowerCase().trim();
    
    // Electric
    if (lower.includes('electric') || lower === 'electricity' || lower === 'ev') {
      if (lower.includes('hybrid')) return 'Hybrid';
      return 'Electric';
    }
    // Hybrid
    if (lower.includes('hybrid')) return 'Hybrid';
    // Diesel
    if (lower.includes('diesel')) return 'Diesel';
    // Petrol
    if (lower.includes('petrol') || lower === 'ss') return 'Petrol';
    
    return fuelType; // Return original if no match
  };

  // Vehicle type distribution data (replaces plan distribution)
  const vehicleTypeDistribution = useMemo(() => {
    const distribution = filteredCustomers.reduce((acc: Record<string, number>, customer) => {
      const vehicleType = normalizeVehicleType(customer.vehicle_fuel_type);
      acc[vehicleType] = (acc[vehicleType] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort by count descending
  }, [filteredCustomers]);

  // Monthly signup data (last 6 months)
  const monthlySignups = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        signups: 0
      };
    }).reverse();

    filteredCustomers.forEach(customer => {
      const signupDate = new Date(customer.signup_date);
      const monthKey = signupDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const monthData = months.find(m => m.month === monthKey);
      if (monthData) {
        monthData.signups++;
      }
    });

    return months;
  }, [filteredCustomers]);

  // Monthly revenue data (last 12 months) - respects source filter to match agent table
  const monthlyRevenue = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setDate(1); // Use 1st of month to avoid month-skip bugs (e.g. Mar 30 - 1 month = Mar 2)
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        revenue: 0,
        salesCount: 0,
        aov: 0,
        isSelected: false
      };
    }).reverse();

    // Apply source filter but NOT date filter (chart always shows 12 months)
    const sourceFilteredCustomers = customers.filter(customer => {
      if (sourceFilter === 'all') return true;
      const source = customer.purchase_source?.toLowerCase() || '';
      const isManual = customer.is_manual_entry === true;
      const warrantyNum = customer.warranty_reference_number || '';
      if (sourceFilter === 'website') {
        const isBawS = warrantyNum.startsWith('BAW-S-');
        return !isBawS && !isManual && (source === 'website' || source === 'stripe' || source === 'bumper' || source === 'bumper_portal' || source === 'google_ads' || source === 'facebook_ads' || source === '');
      } else if (sourceFilter === 'staff_purchase') {
        return warrantyNum.startsWith('BAW-S-');
      } else if (sourceFilter === 'sales_team') {
        return isManual || source === 'quote_link' || source === 'external' || source === 'admin_external';
      }
      return true;
    });

    // EXCLUDING cancelled/refunded from revenue
    sourceFilteredCustomers.forEach(customer => {
      if (isRevenueLost(customer.status)) return;
      
      if (customer.final_amount && customer.signup_date) {
        const signupDate = new Date(customer.signup_date);
        const monthKey = `${signupDate.getFullYear()}-${String(signupDate.getMonth() + 1).padStart(2, '0')}`;
        const monthData = months.find(m => m.monthKey === monthKey);
        if (monthData) {
          monthData.revenue += Number(customer.final_amount) || 0;
          monthData.salesCount += 1;
        }
      }
    });

    // Mark selected month
    if (selectedMonth) {
      const selected = months.find(m => m.monthKey === selectedMonth);
      if (selected) {
        selected.isSelected = true;
      }
    }

    // Calculate AOV for each month
    months.forEach(m => {
      m.aov = m.salesCount > 0 ? Math.round(m.revenue / m.salesCount) : 0;
    });

    return months;
  }, [customers, selectedMonth, sourceFilter]);

  // Duration mix per month (1yr / 2yr / 3yr) — percentages and avg revenue per year of cover
  const durationByMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        count1: 0, count2: 0, count3: 0,
        rev1: 0, rev2: 0, rev3: 0,
        pct1: 0, pct2: 0, pct3: 0,
        avgPerYear1: 0, avgPerYear2: 0, avgPerYear3: 0,
        aov1: 0, aov2: 0, aov3: 0,

      };
    }).reverse();

    const sourceFilteredCustomers = customers.filter(customer => {
      if (sourceFilter === 'all') return true;
      const source = customer.purchase_source?.toLowerCase() || '';
      const isManual = customer.is_manual_entry === true;
      const warrantyNum = customer.warranty_reference_number || '';
      if (sourceFilter === 'website') {
        const isBawS = warrantyNum.startsWith('BAW-S-');
        return !isBawS && !isManual && (source === 'website' || source === 'stripe' || source === 'bumper' || source === 'bumper_portal' || source === 'google_ads' || source === 'facebook_ads' || source === '');
      } else if (sourceFilter === 'staff_purchase') {
        return warrantyNum.startsWith('BAW-S-');
      } else if (sourceFilter === 'sales_team') {
        return isManual || source === 'quote_link' || source === 'external' || source === 'admin_external';
      }
      return true;
    });

    sourceFilteredCustomers.forEach(customer => {
      if (isRevenueLost(customer.status)) return;
      if (!customer.signup_date) return;
      const signupDate = new Date(customer.signup_date);
      const monthKey = `${signupDate.getFullYear()}-${String(signupDate.getMonth() + 1).padStart(2, '0')}`;
      const monthData = months.find(m => m.monthKey === monthKey);
      if (!monthData) return;

      const durationMonths = getWarrantyDurationInMonths(customer.payment_type || '');
      const years = Math.max(1, Math.round(durationMonths / 12));
      const amount = Number(customer.final_amount) || 0;

      if (years === 1) { monthData.count1 += 1; monthData.rev1 += amount; }
      else if (years === 2) { monthData.count2 += 1; monthData.rev2 += amount; }
      else if (years >= 3) { monthData.count3 += 1; monthData.rev3 += amount; }
    });

    months.forEach(m => {
      const total = m.count1 + m.count2 + m.count3;
      if (total > 0) {
        m.pct1 = Math.round((m.count1 / total) * 100);
        m.pct2 = Math.round((m.count2 / total) * 100);
        m.pct3 = 100 - m.pct1 - m.pct2;
      }
      m.avgPerYear1 = m.count1 > 0 ? Math.round(m.rev1 / m.count1) : 0;
      m.avgPerYear2 = m.count2 > 0 ? Math.round(m.rev2 / m.count2 / 2) : 0;
      m.avgPerYear3 = m.count3 > 0 ? Math.round(m.rev3 / m.count3 / 3) : 0;
      m.aov1 = m.count1 > 0 ? Math.round(m.rev1 / m.count1) : 0;
      m.aov2 = m.count2 > 0 ? Math.round(m.rev2 / m.count2) : 0;
      m.aov3 = m.count3 > 0 ? Math.round(m.rev3 / m.count3) : 0;

    });

    return months;
  }, [customers, sourceFilter]);

  // Per-year equivalent summary — scope is either the trailing 12 months or a single month
  const buildPerYearSummary = useCallback((rows: typeof durationByMonth) => {
    const agg = [
      { key: '1yr', label: '1 Year', years: 1, count: 0, revenue: 0, colour: '#f97316' },
      { key: '2yr', label: '2 Year', years: 2, count: 0, revenue: 0, colour: '#3b82f6' },
      { key: '3yr', label: '3 Year', years: 3, count: 0, revenue: 0, colour: '#10b981' },
    ];
    rows.forEach(m => {
      agg[0].count += m.count1; agg[0].revenue += m.rev1;
      agg[1].count += m.count2; agg[1].revenue += m.rev2;
      agg[2].count += m.count3; agg[2].revenue += m.rev3;
    });
    const totalCount = agg.reduce((s, a) => s + a.count, 0);
    return agg.map(a => ({
      ...a,
      avgOrder: a.count > 0 ? Math.round(a.revenue / a.count) : 0,
      avgPerYear: a.count > 0 ? Math.round(a.revenue / a.count / a.years) : 0,
      annualisedRevenue: Math.round(a.revenue / a.years),
      share: totalCount > 0 ? Math.round((a.count / totalCount) * 100) : 0,
    }));
  }, []);

  const perYearMonthOptions = useMemo(
    () => durationByMonth.map(m => ({ monthKey: m.monthKey, label: m.month })).reverse(),
    [durationByMonth]
  );

  const perYearScopeRows = useMemo(() => {
    if (perYearScope === 'last12') return durationByMonth;
    return durationByMonth.filter(m => m.monthKey === perYearScope);
  }, [durationByMonth, perYearScope]);

  const perYearPrevRows = useMemo(() => {
    if (perYearScope === 'last12') return [];
    const idx = durationByMonth.findIndex(m => m.monthKey === perYearScope);
    return idx > 0 ? [durationByMonth[idx - 1]] : [];
  }, [durationByMonth, perYearScope]);

  const perYearSummary = useMemo(() => buildPerYearSummary(perYearScopeRows), [buildPerYearSummary, perYearScopeRows]);
  const perYearPrevSummary = useMemo(
    () => (perYearPrevRows.length > 0 ? buildPerYearSummary(perYearPrevRows) : null),
    [buildPerYearSummary, perYearPrevRows]
  );

  const perYearScopeLabel = useMemo(() => {
    if (perYearScope === 'last12') return 'last 12 months';
    return durationByMonth.find(m => m.monthKey === perYearScope)?.month ?? perYearScope;
  }, [durationByMonth, perYearScope]);

  const perYearPrevLabel = useMemo(
    () => (perYearPrevRows.length > 0 ? perYearPrevRows[0].month : null),
    [perYearPrevRows]
  );






  // Current-month pace projection: extrapolate end-of-month revenue/sales from days elapsed
  const monthProjection = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyRevenue.find(m => m.monthKey === currentKey);
    if (!current) return null;

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);
    // Treat partial day as full day so a single sale on day 1 doesn't divide by zero
    const elapsed = Math.max(1, dayOfMonth);
    const paceMultiplier = daysInMonth / elapsed;

    const projectedRevenue = Math.round(current.revenue * paceMultiplier);
    const projectedSales = Math.round(current.salesCount * paceMultiplier);
    const projectedAov = projectedSales > 0 ? Math.round(projectedRevenue / projectedSales) : current.aov;
    const dailyRunRate = Math.round(current.revenue / elapsed);
    const dailySalesRate = Math.round((current.salesCount / elapsed) * 10) / 10;
    const remainingRevenue = Math.max(0, projectedRevenue - current.revenue);
    const remainingSales = Math.max(0, projectedSales - current.salesCount);

    // Prior month for comparison
    const prior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const priorKey = `${prior.getFullYear()}-${String(prior.getMonth() + 1).padStart(2, '0')}`;
    const priorMonth = monthlyRevenue.find(m => m.monthKey === priorKey);
    const revenueDeltaPct = priorMonth && priorMonth.revenue > 0
      ? Math.round(((projectedRevenue - priorMonth.revenue) / priorMonth.revenue) * 100)
      : null;

    // Year-over-year: same calendar month, prior year. Computed directly from customers
    // because monthlyRevenue only covers the last 12 months.
    const yoyYear = now.getFullYear() - 1;
    const yoyMonth = now.getMonth();
    let yoyRevenue = 0;
    let yoySales = 0;
    customers.forEach(c => {
      if (sourceFilter !== 'all') {
        const source = c.purchase_source?.toLowerCase() || '';
        const isManual = c.is_manual_entry === true;
        const warrantyNum = c.warranty_reference_number || '';
        if (sourceFilter === 'website') {
          const isBawS = warrantyNum.startsWith('BAW-S-');
          if (!(!isBawS && !isManual && (source === 'website' || source === 'stripe' || source === 'bumper' || source === 'bumper_portal' || source === 'google_ads' || source === 'facebook_ads' || source === ''))) return;
        } else if (sourceFilter === 'staff_purchase') {
          if (!warrantyNum.startsWith('BAW-S-')) return;
        } else if (sourceFilter === 'sales_team') {
          if (!(isManual || source === 'quote_link' || source === 'external' || source === 'admin_external')) return;
        }
      }
      if (isRevenueLost(c.status)) return;
      if (!c.final_amount || !c.signup_date) return;
      const d = new Date(c.signup_date);
      if (d.getFullYear() === yoyYear && d.getMonth() === yoyMonth) {
        yoyRevenue += Number(c.final_amount) || 0;
        yoySales += 1;
      }
    });
    const hasYoY = yoySales > 0;
    const yoyRevenueDeltaPct = hasYoY && yoyRevenue > 0
      ? Math.round(((projectedRevenue - yoyRevenue) / yoyRevenue) * 100)
      : null;

    return {
      monthLabel: current.month,
      daysInMonth,
      dayOfMonth,
      daysRemaining,
      actualRevenue: current.revenue,
      actualSales: current.salesCount,
      actualAov: current.aov,
      projectedRevenue,
      projectedSales,
      projectedAov,
      dailyRunRate,
      dailySalesRate,
      remainingRevenue,
      remainingSales,
      priorRevenue: priorMonth?.revenue ?? null,
      priorSales: priorMonth?.salesCount ?? null,
      revenueDeltaPct,
      hasYoY,
      yoyRevenue: hasYoY ? Math.round(yoyRevenue) : null,
      yoySales: hasYoY ? yoySales : null,
      yoyRevenueDeltaPct,
    };
  }, [monthlyRevenue, customers, sourceFilter]);

  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  // Per-day breakdown for the currently filtered period (defaults to last 30 days)
  const dailyBreakdown = useMemo(() => {
    let fromDate: Date;
    let toDate: Date;
    if (effectiveDateRange?.from) {
      fromDate = new Date(effectiveDateRange.from);
      toDate = effectiveDateRange.to ? new Date(effectiveDateRange.to) : new Date();
    } else {
      toDate = new Date();
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 29);
    }
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const dayMap = new Map<string, { date: Date; deals: number; revenue: number; cancelled: number; refunded: number }>();
    const cursor = new Date(fromDate);
    while (cursor <= toDate) {
      const key = format(cursor, 'yyyy-MM-dd');
      dayMap.set(key, { date: new Date(cursor), deals: 0, revenue: 0, cancelled: 0, refunded: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    filteredCustomers.forEach(c => {
      if (!c.signup_date) return;
      const d = new Date(c.signup_date);
      if (d < fromDate || d > toDate) return;
      const key = format(d, 'yyyy-MM-dd');
      const entry = dayMap.get(key);
      if (!entry) return;
      if (isRevenueLost(c.status)) {
        if (isRefunded(c.status)) entry.refunded++;
        else entry.cancelled++;
      } else {
        entry.deals++;
        entry.revenue += Number(c.final_amount) || 0;
      }
    });

    return Array.from(dayMap.values())
      .map(d => ({
        dateKey: format(d.date, 'yyyy-MM-dd'),
        dateLabel: format(d.date, 'EEE dd MMM'),
        shortLabel: format(d.date, 'EEEEE dd MMM'),
        deals: d.deals,
        revenue: Math.round(d.revenue * 100) / 100,
        aov: d.deals > 0 ? Math.round(d.revenue / d.deals) : 0,
        cancelled: d.cancelled,
        refunded: d.refunded,
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredCustomers, effectiveDateRange]);

  const dailyTotals = useMemo(() => {
    const deals = dailyBreakdown.reduce((s, d) => s + d.deals, 0);
    const revenue = dailyBreakdown.reduce((s, d) => s + d.revenue, 0);
    const cancelled = dailyBreakdown.reduce((s, d) => s + d.cancelled, 0);
    const refunded = dailyBreakdown.reduce((s, d) => s + d.refunded, 0);
    return {
      deals,
      revenue: Math.round(revenue * 100) / 100,
      aov: deals > 0 ? Math.round(revenue / deals) : 0,
      cancelled,
      refunded,
    };
  }, [dailyBreakdown]);

  // Agent performance analytics
  const agentPerformance = useMemo(() => {
    const agentMap = new Map<string, { sales: number; revenue: number; cancelled: number; refunded: number }>();

    filteredCustomers.forEach(c => {
      // Credit the sale to whoever actually closed it, not simply the lead owner.
      // Priority: explicit sale credit > payment confirmed > quote sent > payment
      // collected > lead owner. Leads reassigned after the sale used to hand the
      // revenue to the new owner, which understated the real closer.
      const agentId =
        c.sale_credit_admin_user_id ||
        c.payment_confirmed_by ||
        c.quote_sent_by ||
        c.payment_collected_by ||
        c.assigned_to;
      if (!agentId) return; // skip unattributed (pure website sales)
      if (!agentMap.has(agentId)) agentMap.set(agentId, { sales: 0, revenue: 0, cancelled: 0, refunded: 0 });
      const entry = agentMap.get(agentId)!;
      entry.sales++;
      if (isRevenueLost(c.status)) {
        if (isRefunded(c.status)) entry.refunded++;
        else entry.cancelled++;
      } else {
        entry.revenue += Number(c.final_amount) || 0;
      }
    });

    return Array.from(agentMap.entries())
      .map(([agentId, stats]) => {
        const user = adminUsers.find(u => u.id === agentId);
        const name = user
          ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
          : 'Unknown Agent';
        const activeSales = stats.sales - stats.cancelled - stats.refunded;
        return {
          agentId,
          name,
          sales: stats.sales,
          activeSales,
          revenue: Math.round(stats.revenue * 100) / 100,
          aov: activeSales > 0 ? Math.round(stats.revenue / activeSales) : 0,
          cancelled: stats.cancelled,
          refunded: stats.refunded,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredCustomers, adminUsers]);

  // Chart data for agent performance
  const agentChartData = useMemo(() =>
    agentPerformance.map(a => ({
      name: a.name.split(' ')[0] || a.name, // first name for chart
      fullName: a.name,
      sales: a.activeSales,
      revenue: a.revenue,
    })),
  [agentPerformance]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsQuickLinksBar />

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-sm text-gray-600">Overview of your warranty business (excludes test orders)</p>
        </div>

        <AnalyticsSectionHeading id="revenue-monthly" title="Revenue & AOV by month" description="Monthly revenue, order volume and average order value across the last 12 months." accent="border-emerald-500/60" />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Total Revenue & AOV by Month (Last 12 Months)</CardTitle>
              <CardDescription className="mt-1">
                Click on any bar to filter all data by that month
              </CardDescription>
            </div>
            {selectedMonth && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelectedMonth}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear selection
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart
                data={monthlyRevenue}
                onClick={handleBarClick}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tickFormatter={(value) => `£${value.toLocaleString()}`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `£${value}`} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'salesCount') {
                      return [value.toLocaleString('en-GB'), 'Warranties Sold'];
                    }
                    const label = name === 'revenue' ? 'Revenue' : name === 'aov' ? 'Avg Order Value' : name;
                    return [`£${value.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`, label];
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend formatter={(value) => value === 'revenue' ? 'Revenue' : value === 'aov' ? 'Avg Order Value' : value === 'salesCount' ? 'Warranties Sold' : value} />
                <Bar
                  yAxisId="left"
                  dataKey="revenue"
                  radius={[4, 4, 0, 0]}
                  fill="#10b981"
                >
                  {monthlyRevenue.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isSelected ? '#059669' : '#10b981'}
                      stroke={entry.isSelected ? '#047857' : 'transparent'}
                      strokeWidth={entry.isSelected ? 2 : 0}
                      style={{
                        cursor: 'pointer',
                        filter: entry.isSelected ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : 'none'
                      }}
                    />
                  ))}
                  <LabelList
                    dataKey="salesCount"
                    position="top"
                    formatter={(value: number) => value > 0 ? `${value} ${value === 1 ? 'deal' : 'deals'}` : ''}
                    style={{ fill: '#065f46', fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="aov"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ fill: '#f59e0b', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="salesCount"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6, fill: '#2563eb' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <AnalyticsSectionHeading id="revenue-daily" title="Daily revenue trend" description="Day-by-day revenue, AOV and sales count within a 30-day window." accent="border-teal-500/60" />

        <DailyRevenueTrendPanel customers={customers} sourceFilter={sourceFilter} />



        {monthProjection && (
          <AnalyticsSectionHeading id="month-projection" title="This month's projection" description="Run-rate forecast for the current month based on sales so far." accent="border-lime-500/60" controls={sectionFilters} />

        )}

        {monthProjection && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                {monthProjection.monthLabel} — Current Pace Projection
              </CardTitle>
              <CardDescription>
                You're on day {monthProjection.dayOfMonth} of {monthProjection.daysInMonth} with{' '}
                <strong>{monthProjection.actualSales} {monthProjection.actualSales === 1 ? 'sale' : 'sales'}</strong>{' '}
                (£{monthProjection.actualRevenue.toLocaleString('en-GB')}). At this rate
                (~{monthProjection.dailySalesRate} sales / £{monthProjection.dailyRunRate.toLocaleString('en-GB')} per day),
                you'll finish {monthProjection.monthLabel} at approximately{' '}
                <strong className="text-primary">£{monthProjection.projectedRevenue.toLocaleString('en-GB')}</strong>{' '}
                from <strong className="text-primary">{monthProjection.projectedSales} warranties</strong>.
                {monthProjection.daysRemaining > 0 && (
                  <> That's another £{monthProjection.remainingRevenue.toLocaleString('en-GB')} /{' '}
                  {monthProjection.remainingSales} sales over the next {monthProjection.daysRemaining} day{monthProjection.daysRemaining === 1 ? '' : 's'}.</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">So far this month</span>
                  <p className="text-2xl font-bold">£{monthProjection.actualRevenue.toLocaleString('en-GB')}</p>
                  <p className="text-xs text-muted-foreground">{monthProjection.actualSales} warranties</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Projected revenue</span>
                  <p className="text-2xl font-bold text-primary">£{monthProjection.projectedRevenue.toLocaleString('en-GB')}</p>
                  {monthProjection.revenueDeltaPct !== null && (
                    <p className={`text-xs flex items-center gap-1 ${monthProjection.revenueDeltaPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {monthProjection.revenueDeltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {monthProjection.revenueDeltaPct >= 0 ? '+' : ''}{monthProjection.revenueDeltaPct}% vs last month
                    </p>
                  )}
                  {monthProjection.hasYoY && monthProjection.yoyRevenueDeltaPct !== null && (
                    <p className={`text-xs flex items-center gap-1 ${monthProjection.yoyRevenueDeltaPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {monthProjection.yoyRevenueDeltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {monthProjection.yoyRevenueDeltaPct >= 0 ? '+' : ''}{monthProjection.yoyRevenueDeltaPct}% vs same month last year (£{monthProjection.yoyRevenue!.toLocaleString('en-GB')})
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Projected warranties</span>
                  <p className="text-2xl font-bold text-primary">{monthProjection.projectedSales}</p>
                  {monthProjection.priorSales !== null && (
                    <p className="text-xs text-muted-foreground">Last month: {monthProjection.priorSales}</p>
                  )}
                  {monthProjection.hasYoY && (
                    <p className="text-xs text-muted-foreground">
                      Same month {new Date().getFullYear() - 1}: {monthProjection.yoySales}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Projected AOV</span>
                  <p className="text-2xl font-bold">£{monthProjection.projectedAov.toLocaleString('en-GB')}</p>
                  <p className="text-xs text-muted-foreground">Current: £{monthProjection.actualAov.toLocaleString('en-GB')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <AnalyticsSectionHeading id="duration-mix" title="Warranty duration mix" description="Split of 1-year, 2-year and 3-year policies sold each month." accent="border-sky-500/60" />

        {/* Warranty duration mix per month (1yr / 2yr / 3yr) */}
        <Card>
          <CardHeader>
            <CardTitle>Warranty Duration Mix by Month</CardTitle>
            <CardDescription className="mt-1">
              Share of 1-year, 2-year and 3-year policies sold each month (last 12 months)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={durationByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number, name: string, props: any) => {
                    const key = props?.dataKey as string;
                    const count = key === 'pct1' ? props.payload.count1 : key === 'pct2' ? props.payload.count2 : props.payload.count3;
                    const label = key === 'pct1' ? '1 Year' : key === 'pct2' ? '2 Year' : '3 Year';
                    return [`${value}% (${count} ${count === 1 ? 'sale' : 'sales'})`, label];
                  }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend formatter={(v) => v === 'pct1' ? '1 Year' : v === 'pct2' ? '2 Year' : '3 Year'} />
                <Bar dataKey="pct1" stackId="dur" fill="#f97316" />
                <Bar dataKey="pct2" stackId="dur" fill="#3b82f6" />
                <Bar dataKey="pct3" stackId="dur" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <AnalyticsSectionHeading id="per-year-value" title="Per-year equivalent value" description="Compares what each duration is worth per year of cover." accent="border-blue-500/60" />

        {/* Per-year equivalent value comparison */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Per-Year Equivalent Value ({perYearScopeLabel})</CardTitle>
                <CardDescription className="mt-1">
                  Every policy divided by its years of cover, so 1-year, 2-year and 3-year sales can be compared like for like
                  (e.g. £800 over 2 years = £400/yr, £1,000 over 3 years = £333/yr)
                  {perYearPrevLabel && <> — change shown vs {perYearPrevLabel}</>}
                </CardDescription>
              </div>
              <Select value={perYearScope} onValueChange={setPerYearScope}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last12">Last 12 months</SelectItem>
                  {perYearMonthOptions.map(opt => (
                    <SelectItem key={opt.monthKey} value={opt.monthKey}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {perYearSummary.map((row, idx) => {
                const prev = perYearPrevSummary?.[idx];
                const delta = (curr: number, before?: number) => {
                  if (before === undefined || before === 0 || curr === 0) return null;
                  const pct = Math.round(((curr - before) / before) * 100);
                  if (pct === 0) return { text: 'No change', tone: 'text-muted-foreground' };
                  return {
                    text: `${pct > 0 ? '+' : ''}${pct}% MoM`,
                    tone: pct > 0 ? 'text-emerald-600' : 'text-red-600',
                  };
                };
                const perYearDelta = delta(row.avgPerYear, prev?.avgPerYear);
                const countDelta = delta(row.count, prev?.count);
                return (
                  <div key={row.key} className="rounded-lg border p-4" style={{ borderColor: row.colour }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: row.colour }}>{row.label}</span>
                      <span className="text-xs text-muted-foreground">{row.share}% of sales</span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold">£{row.avgPerYear.toLocaleString('en-GB')}<span className="text-sm font-medium text-muted-foreground">/yr</span></span>
                      {perYearDelta && <span className={`text-xs font-semibold ${perYearDelta.tone}`}>{perYearDelta.text}</span>}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      <div>Avg order value: <strong>£{row.avgOrder.toLocaleString('en-GB')}</strong></div>
                      <div>
                        Policies sold: <strong>{row.count.toLocaleString('en-GB')}</strong>
                        {countDelta && <span className={`ml-1 font-semibold ${countDelta.tone}`}>({countDelta.text})</span>}
                      </div>
                      <div>Total revenue: <strong>£{row.revenue.toLocaleString('en-GB')}</strong></div>
                      <div>Annualised revenue: <strong>£{row.annualisedRevenue.toLocaleString('en-GB')}</strong></div>
                      {prev && (
                        <div className="pt-1 text-[11px]">
                          {perYearPrevLabel}: £{prev.avgPerYear.toLocaleString('en-GB')}/yr · {prev.count.toLocaleString('en-GB')} sold
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={perYearSummary} margin={{ top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `£${Number(value).toLocaleString('en-GB')}`,
                    name === 'avgOrder' ? 'Avg order value' : 'Per-year equivalent',
                  ]}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend formatter={(v) => (v === 'avgOrder' ? 'Avg order value' : 'Per-year equivalent')} />
                <Bar dataKey="avgOrder" fill="#cbd5e1" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="avgOrder" position="top" formatter={(v: number) => (v > 0 ? `£${v.toLocaleString('en-GB')}` : '')} style={{ fontSize: 11, fill: '#475569' }} />
                </Bar>
                <Bar dataKey="avgPerYear" fill="#10b981" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="avgPerYear" position="top" formatter={(v: number) => (v > 0 ? `£${v.toLocaleString('en-GB')}/yr` : '')} style={{ fontSize: 11, fontWeight: 600, fill: '#065f46' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average revenue per year of cover, by duration */}

        <Card>
          <CardHeader>
            <CardTitle>Avg Revenue per Year of Cover by Duration</CardTitle>
            <CardDescription className="mt-1">
              For each month: order value ÷ years of cover, split by 1-year, 2-year and 3-year policies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={durationByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const label = name === 'avgPerYear1' ? '1 Year (avg/yr)' : name === 'avgPerYear2' ? '2 Year (avg/yr)' : '3 Year (avg/yr)';
                    return [`£${Number(value).toLocaleString('en-GB')}`, label];
                  }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend formatter={(v) => v === 'avgPerYear1' ? '1 Year' : v === 'avgPerYear2' ? '2 Year' : '3 Year'} />
                <Bar dataKey="avgPerYear1" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgPerYear2" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgPerYear3" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <AnalyticsSectionHeading id="aov-by-term" title="AOV by warranty term" description="Average order value per term, per month, plus total received." accent="border-indigo-500/60" />

        {/* AOV by warranty term per month + total received */}
        <Card>
          <CardHeader>
            <CardTitle>Average Order Value by Warranty Term (per month)</CardTitle>
            <CardDescription className="mt-1">
              Average order value and total amount received for 1-year, 2-year and 3-year warranties, month by month (last 12 months)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={durationByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const label = name === 'aov1' ? '1 Year AOV' : name === 'aov2' ? '2 Year AOV' : '3 Year AOV';
                    return [`£${Number(value).toLocaleString('en-GB')}`, label];
                  }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend formatter={(v) => (v === 'aov1' ? '1 Year' : v === 'aov2' ? '2 Year' : '3 Year')} />
                <Bar dataKey="aov1" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="aov2" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="aov3" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-semibold">Month</th>
                    <th className="py-2 px-3 text-right font-semibold" style={{ color: '#f97316' }}>1yr AOV</th>
                    <th className="py-2 px-3 text-right font-semibold" style={{ color: '#f97316' }}>1yr received</th>
                    <th className="py-2 px-3 text-right font-semibold" style={{ color: '#3b82f6' }}>2yr AOV</th>
                    <th className="py-2 px-3 text-right font-semibold" style={{ color: '#3b82f6' }}>2yr received</th>
                    <th className="py-2 px-3 text-right font-semibold" style={{ color: '#10b981' }}>3yr AOV</th>
                    <th className="py-2 px-3 text-right font-semibold" style={{ color: '#10b981' }}>3yr received</th>
                    <th className="py-2 pl-3 text-right font-semibold">Total received</th>
                  </tr>
                </thead>
                <tbody>
                  {[...durationByMonth].reverse().map((m) => (
                    <tr key={m.monthKey} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{m.month}</td>
                      <td className="py-2 px-3 text-right">{m.count1 > 0 ? `£${m.aov1.toLocaleString('en-GB')}` : '—'}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">£{Math.round(m.rev1).toLocaleString('en-GB')} <span className="text-xs">({m.count1})</span></td>
                      <td className="py-2 px-3 text-right">{m.count2 > 0 ? `£${m.aov2.toLocaleString('en-GB')}` : '—'}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">£{Math.round(m.rev2).toLocaleString('en-GB')} <span className="text-xs">({m.count2})</span></td>
                      <td className="py-2 px-3 text-right">{m.count3 > 0 ? `£${m.aov3.toLocaleString('en-GB')}` : '—'}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">£{Math.round(m.rev3).toLocaleString('en-GB')} <span className="text-xs">({m.count3})</span></td>
                      <td className="py-2 pl-3 text-right font-semibold">£{Math.round(m.rev1 + m.rev2 + m.rev3).toLocaleString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>



        <AnalyticsSectionHeading id="daily-breakdown" title="Per-day breakdown" description="Deals, revenue, AOV, cancellations and refunds for each day." accent="border-violet-500/60" controls={sectionFilters} />

        {/* Per-day breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Per Day Breakdown
            </CardTitle>
            <CardDescription>
              Deals, sale value & AOV per day {effectiveDateRange?.from
                ? `(${format(effectiveDateRange.from, 'dd MMM yyyy')}${effectiveDateRange.to ? ` – ${format(effectiveDateRange.to, 'dd MMM yyyy')}` : ''})`
                : '(last 30 days)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={[...dailyBreakdown].reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tickFormatter={(v) => `£${v.toLocaleString()}`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [`£${value.toLocaleString('en-GB')}`, 'Revenue'];
                    if (name === 'aov') return [`£${value.toLocaleString('en-GB')}`, 'AOV'];
                    if (name === 'deals') return [value, 'Deals'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="deals" stroke="#3b82f6" strokeWidth={2} name="Deals" dot={{ r: 3 }} />
                <Line yAxisId="left" type="monotone" dataKey="aov" stroke="#f59e0b" strokeWidth={2} name="AOV" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>



          </CardContent>
        </Card>

        <AnalyticsSectionHeading id="cover-options" title="Cover options mix" description="Most commonly bought labour rate, claim limit and excess." accent="border-purple-500/60" controls={sectionFilters} />

        {/* Cover options mix: labour rate / claim limit / excess */}
        <CoverOptionsMixPanel dateRange={effectiveDateRange} />

        <AnalyticsSectionHeading id="demographics" title="Customer age & UK demographics" description="Age profile of buyers plus where our customers are across the UK by postcode area." accent="border-fuchsia-500/60" />

        <CustomerDemographicsPanel dateRange={effectiveDateRange} />







        {/* Cost Efficiency (super-admin only) */}
        <CostEfficiencyPanel
          currentUserRole={userRole ?? null}
          referenceDate={effectiveDateRange?.from || dateRange?.from || new Date()}
        />


        
        <AnalyticsSectionHeading id="filters" title="Price analysis per day" description="Choose a period, month, week or custom date range — every panel on this page follows this selection." accent="border-slate-500/60" size="lg" />

        {/* Filters Row */}
        <div ref={filtersSectionRef} className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold">
                Filter this dashboard
                {refreshing && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Updating…</span>
                )}
              </h4>
              <p className="text-xs text-muted-foreground">
                Currently showing:{' '}
                <span className="font-medium text-foreground">
                  {effectiveDateRange?.from
                    ? `${format(effectiveDateRange.from, 'dd MMM yyyy')} – ${effectiveDateRange.to ? format(effectiveDateRange.to, 'dd MMM yyyy') : 'select end date'}`
                    : 'All time'}
                </span>
                {sourceFilter !== 'all' ? ` · ${sourceFilter.replace('_', ' ')}` : ''}
              </p>
            </div>
            {(effectiveDateRange || sourceFilter !== 'all' || comparisonPeriod) && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setDateRange(undefined);
                  setSelectedMonth(null);
                  setComparisonPeriod(null);
                  setSourceFilter('all');
                }}
              >
                <X className="h-3 w-3 mr-1" /> Reset filters
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-4 items-end">
          {/* Period Comparison Toggle */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Quick Period</Label>
            <ToggleGroup type="single" value={comparisonPeriod || ''} onValueChange={(val) => applyFilterChange(() => handlePeriodComparison(val as any))}>
              <ToggleGroupItem value="today" aria-label="Today" className="px-3">
                Today
              </ToggleGroupItem>
              <ToggleGroupItem value="yesterday" aria-label="Yesterday" className="px-3">
                Yesterday
              </ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="This Week" className="px-3">
                This Week
              </ToggleGroupItem>
              <ToggleGroupItem value="last_week" aria-label="Last Week" className="px-3">
                Last Week
              </ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label="This Month" className="px-3">
                This Month
              </ToggleGroupItem>
              <ToggleGroupItem value="last_month" aria-label="Last Month" className="px-3">
                Last Month
              </ToggleGroupItem>
              <ToggleGroupItem value="last_30" aria-label="Last 30 Days" className="px-3">
                Last 30 Days
              </ToggleGroupItem>
              <ToggleGroupItem value="year" aria-label="This Year" className="px-3">
                This Year
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          
          <div className="space-y-1">
            <Label className="text-sm font-medium">Custom date range</Label>
            <DateRangeFilter 
              dateRange={dateRange} 
              onDateRangeChange={(range) => {
                applyFilterChange(() => {
                  setDateRange(range);
                  setSelectedMonth(null);
                  setComparisonPeriod(null);
                });
              }}
              className="min-w-[280px]"
            />
          </div>


          {(userRole === 'super_admin' || userRole === 'admin') && (
            <div className="space-y-1">
              <Label className="text-sm font-medium">Quick month</Label>
              <QuickMonthFilter
                dateRange={dateRange}
                onDateRangeChange={(range) => {
                  applyFilterChange(() => {
                    setDateRange(range);
                    setSelectedMonth(null);
                    setComparisonPeriod(null);
                  });
                }}
              />
            </div>
          )}

          {(userRole === 'super_admin' || userRole === 'admin') && (
            <div className="space-y-1">
              <Label className="text-sm font-medium">Quick week</Label>
              <QuickWeekFilter
                dateRange={dateRange}
                onDateRangeChange={(range) => {
                  applyFilterChange(() => {
                    setDateRange(range);
                    setSelectedMonth(null);
                    setComparisonPeriod(null);
                  });
                }}
              />
            </div>
          )}
          
          <div className="space-y-1 min-w-[200px]">
            <Label className="text-sm font-medium">Sales Source</Label>
            <Select value={sourceFilter} onValueChange={(v) => applyFilterChange(() => setSourceFilter(v))}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">All Sources</span>
                </SelectItem>
                <SelectItem value="website">
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    Website (BAW)
                  </span>
                </SelectItem>
                <SelectItem value="staff_purchase">
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-green-500" />
                    Staff Purchase (BAW-S)
                  </span>
                </SelectItem>
                <SelectItem value="sales_team">
                  <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-orange-500" />
                    Sales Team (ADM)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Selected Month Indicator */}
          {selectedMonth && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 gap-1 py-1.5">
                <Calendar className="h-3 w-3" />
                {format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1), 'MMMM yyyy')}
                <button 
                  onClick={clearSelectedMonth}
                  className="ml-1 hover:bg-emerald-200 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
          
          {(effectiveDateRange || sourceFilter !== 'all') && (
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredCustomers.length}</span> of {customers.length} customers
            </div>
          )}
          </div>
        </div>

      </div>

      <AnalyticsSectionHeading id="key-metrics" title="Key metrics" description="Headline customer, order and revenue totals for the selected period." accent="border-amber-500/60" controls={sectionFilters} />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {activeCustomers} active customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground">
              From {paidOrders.length} paid orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{overallAOV}</div>
            <p className="text-xs text-muted-foreground">
              Per warranty sale {dateRange ? '(filtered)' : '(all time)'}
            </p>
          </CardContent>
        </Card>
      </div>

      {!isSalesLead && (
      <>
      <AnalyticsSectionHeading id="sales-by-source" title="Sales by source" description="Website, staff purchase and sales-team revenue, reconciled to total revenue." accent="border-orange-500/60" controls={sectionFilters} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Sales Breakdown by Source
          </CardTitle>
          <CardDescription>
            Reconciles with the Total Revenue card above — All Sources = Website + Staff Purchase + Sales Team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Reconciliation total — should equal Total Revenue card */}
          <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">All Sources (Total)</span>
                <Badge variant="secondary" className="text-[10px]">matches Total Revenue</Badge>
              </div>
              <div className="flex gap-6">
                <div className="text-sm"><span className="text-muted-foreground">Orders </span><span className="font-bold">{sourceMetrics.allSources.count}</span></div>
                <div className="text-sm"><span className="text-muted-foreground">Revenue </span><span className="font-bold text-primary">£{sourceMetrics.allSources.revenue.toLocaleString('en-GB')}</span></div>
                <div className="text-sm"><span className="text-muted-foreground">AOV </span><span className="font-bold">£{sourceMetrics.allSources.aov}</span></div>
              </div>
            </div>
          </div>

          {/* Top-level source split */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border-2 border-blue-300 bg-blue-50/40 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm text-blue-700">Website (BAW)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Orders</span>
                <span className="font-bold text-lg">{sourceMetrics.website.count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Revenue</span>
                <span className="font-bold text-lg text-blue-600">£{sourceMetrics.website.revenue.toLocaleString('en-GB')}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                <span className="text-xs font-medium">AOV</span>
                <span className="font-bold text-blue-700">£{sourceMetrics.website.aov}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg border-2 border-green-300 bg-green-50/40 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-sm text-green-700">Staff Purchase (BAW-S)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Orders</span>
                <span className="font-bold text-lg">{sourceMetrics.staffPurchase.count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Revenue</span>
                <span className="font-bold text-lg text-green-600">£{sourceMetrics.staffPurchase.revenue.toLocaleString('en-GB')}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-green-200">
                <span className="text-xs font-medium">AOV</span>
                <span className="font-bold text-green-700">£{sourceMetrics.staffPurchase.aov}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg border-2 border-orange-300 bg-orange-50/40 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="h-4 w-4 text-orange-600" />
                <span className="font-semibold text-sm text-orange-700">Sales Team (ADM)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Orders</span>
                <span className="font-bold text-lg">{sourceMetrics.salesTeam.count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Revenue</span>
                <span className="font-bold text-lg text-orange-600">£{sourceMetrics.salesTeam.revenue.toLocaleString('en-GB')}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-orange-200">
                <span className="text-xs font-medium">AOV</span>
                <span className="font-bold text-orange-700">£{sourceMetrics.salesTeam.aov}</span>
              </div>
            </div>
          </div>

          {/* Website channel sub-breakdown */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 mt-2">
              Website (BAW) acquisition channels — sum equals Website tile above
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold text-sm text-emerald-700">Google Ads</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Orders</span>
                  <span className="font-bold text-lg">{sourceMetrics.google.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Revenue</span>
                  <span className="font-bold text-lg text-emerald-600">£{sourceMetrics.google.revenue.toLocaleString('en-GB')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                  <span className="text-xs font-medium">AOV</span>
                  <span className="font-bold text-emerald-700">£{sourceMetrics.google.aov}</span>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/30 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Facebook className="h-4 w-4 text-indigo-600" />
                  <span className="font-semibold text-sm text-indigo-700">Facebook Ads</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Orders</span>
                  <span className="font-bold text-lg">{sourceMetrics.facebook.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Revenue</span>
                  <span className="font-bold text-lg text-indigo-600">£{sourceMetrics.facebook.revenue.toLocaleString('en-GB')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-indigo-200">
                  <span className="text-xs font-medium">AOV</span>
                  <span className="font-bold text-indigo-700">£{sourceMetrics.facebook.aov}</span>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-sky-200 bg-sky-50/30 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-sky-600" />
                  <span className="font-semibold text-sm text-sky-700">Pure Website (Organic)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Orders</span>
                  <span className="font-bold text-lg">{sourceMetrics.pureWebsite.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Revenue</span>
                  <span className="font-bold text-lg text-sky-600">£{sourceMetrics.pureWebsite.revenue.toLocaleString('en-GB')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-sky-200">
                  <span className="text-xs font-medium">AOV</span>
                  <span className="font-bold text-sky-700">£{sourceMetrics.pureWebsite.aov}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Team lead-source sub-breakdown */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 mt-2">
              Sales Team (ADM) lead source — where the converted lead originally came from (sum equals Sales Team tile above)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold text-sm text-emerald-700">Google Ads lead</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Orders</span>
                  <span className="font-bold text-lg">{sourceMetrics.salesGoogle.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Revenue</span>
                  <span className="font-bold text-lg text-emerald-600">£{sourceMetrics.salesGoogle.revenue.toLocaleString('en-GB')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                  <span className="text-xs font-medium">AOV</span>
                  <span className="font-bold text-emerald-700">£{sourceMetrics.salesGoogle.aov}</span>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/30 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Facebook className="h-4 w-4 text-indigo-600" />
                  <span className="font-semibold text-sm text-indigo-700">Facebook Ads lead</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Orders</span>
                  <span className="font-bold text-lg">{sourceMetrics.salesFacebook.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Revenue</span>
                  <span className="font-bold text-lg text-indigo-600">£{sourceMetrics.salesFacebook.revenue.toLocaleString('en-GB')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-indigo-200">
                  <span className="text-xs font-medium">AOV</span>
                  <span className="font-bold text-indigo-700">£{sourceMetrics.salesFacebook.aov}</span>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-sky-200 bg-sky-50/30 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-sky-600" />
                  <span className="font-semibold text-sm text-sky-700">Organic / Website lead</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Orders</span>
                  <span className="font-bold text-lg">{sourceMetrics.salesOrganic.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Revenue</span>
                  <span className="font-bold text-lg text-sky-600">£{sourceMetrics.salesOrganic.revenue.toLocaleString('en-GB')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-sky-200">
                  <span className="text-xs font-medium">AOV</span>
                  <span className="font-bold text-sky-700">£{sourceMetrics.salesOrganic.aov}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      <AnalyticsSectionHeading id="price-metrics" title="Price metrics" description="Lowest, highest and average order values, broken down by source." accent="border-yellow-500/60" controls={sectionFilters} />

      {/* Price Metrics: Lowest, Highest, Average - by Source */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PoundSterling className="h-5 w-5 text-primary" />
            Price Analytics
          </CardTitle>
          <CardDescription>
            Lowest, highest &amp; average sale price {effectiveDateRange?.from ? '(filtered period)' : '(all time)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Combined */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">All Sources Combined</span>
                <Badge variant="secondary" className="ml-auto text-xs">{priceMetrics.combined.count} sales</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Lowest Price</span>
                <span className="font-bold text-lg">{priceMetrics.combined.count > 0 ? `£${priceMetrics.combined.lowest.toLocaleString('en-GB')}` : '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Highest Price</span>
                <span className="font-bold text-lg">{priceMetrics.combined.count > 0 ? `£${priceMetrics.combined.highest.toLocaleString('en-GB')}` : '-'}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Average Price</span>
                <span className="text-xl font-bold text-primary">{priceMetrics.combined.count > 0 ? `£${priceMetrics.combined.average.toLocaleString('en-GB')}` : '-'}</span>
              </div>
            </div>

            {/* Website */}
            <div className="space-y-3 p-4 rounded-lg border border-blue-200 bg-blue-50/30">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-sm">Website Only (BAW)</span>
                <Badge variant="secondary" className="ml-auto text-xs">{priceMetrics.website.count} sales</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Lowest Price</span>
                <span className="font-bold text-lg">{priceMetrics.website.count > 0 ? `£${priceMetrics.website.lowest.toLocaleString('en-GB')}` : '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Highest Price</span>
                <span className="font-bold text-lg">{priceMetrics.website.count > 0 ? `£${priceMetrics.website.highest.toLocaleString('en-GB')}` : '-'}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                <span className="text-sm font-medium">Average Price</span>
                <span className="text-xl font-bold text-blue-600">{priceMetrics.website.count > 0 ? `£${priceMetrics.website.average.toLocaleString('en-GB')}` : '-'}</span>
              </div>
            </div>

            {/* Sales Team */}
            <div className="space-y-3 p-4 rounded-lg border border-orange-200 bg-orange-50/30">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-orange-500" />
                <span className="font-semibold text-sm">Sales Team Only (ADM)</span>
                <Badge variant="secondary" className="ml-auto text-xs">{priceMetrics.salesTeam.count} sales</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Lowest Price</span>
                <span className="font-bold text-lg">{priceMetrics.salesTeam.count > 0 ? `£${priceMetrics.salesTeam.lowest.toLocaleString('en-GB')}` : '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Highest Price</span>
                <span className="font-bold text-lg">{priceMetrics.salesTeam.count > 0 ? `£${priceMetrics.salesTeam.highest.toLocaleString('en-GB')}` : '-'}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-orange-200">
                <span className="text-sm font-medium">Average Price</span>
                <span className="text-xl font-bold text-orange-600">{priceMetrics.salesTeam.count > 0 ? `£${priceMetrics.salesTeam.average.toLocaleString('en-GB')}` : '-'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AnalyticsSectionHeading id="refunds-cancellations" title="Refunds & cancellations" description="Money lost to refunds and cancellations in the selected period." accent="border-red-500/60" controls={sectionFilters} />

      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Refunds &amp; Cancellations {selectedMonth ? `(${format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1), 'MMMM yyyy')})` : effectiveDateRange?.from ? '(Filtered Period)' : '(All Time)'}
            </CardTitle>
            <CardDescription className="mt-1">
              Money lost to refunds &amp; cancellations
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Total Lost</span>
              <p className="text-2xl font-bold text-red-600">
                £{refundMetrics.totalAmount.toLocaleString('en-GB')}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Count</span>
              <p className="text-2xl font-bold">{refundMetrics.count}</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Avg Amount</span>
              <p className="text-2xl font-bold text-red-600">
                £{refundMetrics.count > 0 ? Math.round(refundMetrics.totalAmount / refundMetrics.count) : 0}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">% of Orders</span>
              <p className="text-2xl font-bold text-red-600">{refundMetrics.percentOfSales}%</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">% of Revenue</span>
              <p className="text-2xl font-bold text-red-600">{refundMetrics.percentOfRevenue}%</p>
            </div>
          </div>
          
          {/* Monthly breakdown */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">Monthly Refunds &amp; Cancellations (Last 12 Months)</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {monthlyRefunds.map((month) => (
                <div 
                  key={month.monthKey}
                  className="flex-shrink-0 min-w-[80px] text-center p-2 bg-muted/30 rounded"
                >
                  <p className="text-xs text-muted-foreground">{month.month}</p>
                  <p className="text-sm font-semibold text-red-600">
                    £{month.refundAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{month.refundCount} cancelled</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      </>
      )}




      {!isSalesLead && (
      <>
      <AnalyticsSectionHeading id="signups-vehicles" title="Signups & vehicle mix" description="Monthly signups alongside the fuel-type split of vehicles covered." accent="border-cyan-500/60" controls={sectionFilters} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlySignups}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="signups" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Type Distribution</CardTitle>
            <CardDescription>
              Breakdown by fuel type (Petrol, Diesel, Electric, Hybrid)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vehicleTypeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={vehicleTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => {
                      const { name, percent } = props;
                      return `${name} ${(Number(percent || 0) * 100).toFixed(0)}%`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {vehicleTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No vehicle type data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AnalyticsSectionHeading id="agent-performance" title="Agent sales performance" description="Sales credited to the agent who closed them, with revenue, AOV and unwinds." accent="border-rose-500/60" controls={sectionFilters} />

      {/* Agent Performance */}
      {agentPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Agent Sales Performance
            </CardTitle>
            <CardDescription>Credited to the agent who closed the sale (sale credit, then payment confirmed, quote sent or payment collected) {effectiveDateRange?.from ? '— filtered period' : '— all time'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Agent revenue bar chart */}
              <ResponsiveContainer width="100%" height={Math.max(250, agentChartData.length * 40)}>
                <BarChart data={agentChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `£${v.toLocaleString()}`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'revenue' ? [`£${value.toLocaleString('en-GB')}`, 'Revenue'] : [value, 'Sales']
                    }
                    labelFormatter={(label) => {
                      const agent = agentChartData.find(a => a.name === label);
                      return agent?.fullName || label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#10b981" name="Revenue (£)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="sales" fill="#3b82f6" name="Sales" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Agent details table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Agent</th>
                      <th className="text-right py-2 px-2 font-medium">Sales</th>
                      <th className="text-right py-2 px-2 font-medium">Revenue</th>
                      <th className="text-right py-2 px-2 font-medium">AOV</th>
                      <th className="text-right py-2 px-2 font-medium">Cancelled</th>
                      <th className="text-right py-2 px-2 font-medium">Refunded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPerformance.map((agent, i) => (
                      <tr key={agent.agentId} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">🏆</Badge>}
                            {agent.name}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">{agent.activeSales}</td>
                        <td className="py-2 px-2 text-right font-semibold text-green-600">
                          £{agent.revenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2 px-2 text-right">£{agent.aov}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{agent.cancelled || '-'}</td>
                        <td className="py-2 px-2 text-right">
                          {agent.refunded > 0 ? (
                            <Badge variant="destructive" className="text-xs">{agent.refunded}</Badge>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 px-2">Total (Credited)</td>
                      <td className="py-2 px-2 text-right">{agentPerformance.reduce((s, a) => s + a.activeSales, 0)}</td>
                      <td className="py-2 px-2 text-right text-green-600">
                        £{agentPerformance.reduce((s, a) => s + a.revenue, 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2 px-2 text-right">-</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{agentPerformance.reduce((s, a) => s + a.cancelled, 0)}</td>
                      <td className="py-2 px-2 text-right">{agentPerformance.reduce((s, a) => s + a.refunded, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AnalyticsSectionHeading id="recent-activity" title="Recent activity" description="The latest orders and status changes across the business." accent="border-stone-500/60" controls={sectionFilters} />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Customer Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length > 0 ? (
            <div className="space-y-4">
              {filteredCustomers.slice(0, 5).map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-gray-600">{customer.email}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <p className="text-sm font-medium">{customer.plan_type}</p>
                      {getCustomerSource(customer) === 'website' && (
                        <Globe className="h-3 w-3 text-blue-500" />
                      )}
                      {getCustomerSource(customer) === 'sales_team' && (
                        <Phone className="h-3 w-3 text-orange-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(customer.signup_date).toLocaleDateString()}
                    </p>
                    {customer.final_amount && !isRevenueLost(customer.status) ? (
                      <p className="text-xs font-semibold text-green-600">
                        £{Number(customer.final_amount).toLocaleString()}
                      </p>
                    ) : isRevenueLost(customer.status) ? (
                      <Badge variant="outline" className="text-xs mt-1 text-red-600 border-red-200">
                        {customer.status}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {customers.length > 0 ? 'No customers match the current filters' : 'No customer activity yet'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales by Vehicle Age & Mileage moved to Vehicle Intelligence tab */}


      <AnalyticsSectionHeading id="api-connectivity" title="API connectivity" description="Health checks for the external services this dashboard depends on." accent="border-gray-500/60" />

      {/* API Connectivity Test Section */}
      <div className="mt-8">
        <ApiConnectivityTest />
      </div>
      </>
      )}
    </div>
  );
};
