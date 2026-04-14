
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList, Line, ComposedChart } from 'recharts';
import { Users, CreditCard, PoundSterling, Globe, Phone, X, Calendar, TrendingUp, TrendingDown, Minus, Target, Facebook } from 'lucide-react';
import { toast } from 'sonner';
import { ApiConnectivityTest } from './ApiConnectivityTest';
import { SalesAgeMileageAnalytics } from './SalesAgeMileageAnalytics';
import { DateRangeFilter } from './DateRangeFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, subYears, isSameWeek, isSameMonth, isSameYear } from 'date-fns';

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
  updated_at: string | null;
  gclid: string | null;
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

export const AnalyticsTab = ({ userRole }: { userRole?: string | null }) => {
  const isSalesLead = userRole === 'sales_lead';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  // Default to "This Month"
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [comparisonPeriod, setComparisonPeriod] = useState<'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | 'last_30' | 'year' | null>('month');

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const customerSelect = 'id, name, email, plan_type, signup_date, status, final_amount, warranty_reference_number, purchase_source, is_manual_entry, vehicle_fuel_type, vehicle_year, mileage, assigned_to, updated_at, gclid';

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
    setLoading(true);

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
      setLoading(false);
    }
  };

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


  // Helper function to categorize customer by source - uses purchase_source and is_manual_entry
  const getCustomerSource = (customer: Customer): 'website' | 'staff_purchase' | 'sales_team' | 'unknown' => {
    const source = customer.purchase_source?.toLowerCase() || '';
    const isManual = customer.is_manual_entry === true;
    const warrantyNum = customer.warranty_reference_number || '';
    if (warrantyNum.startsWith('BAW-S-')) return 'staff_purchase';
    if (isManual || source === 'quote_link' || source === 'external' || source === 'admin_external') return 'sales_team';
    if (source === 'website' || source === 'stripe' || source === 'bumper' || source === 'bumper_portal' || source === 'google_ads' || source === 'facebook_ads' || source === '') return 'website';
    return 'unknown';
  };

  // Sub-categorize website sales by ad channel — check both purchase_source AND click IDs
  const getWebsiteChannel = (customer: Customer): 'google' | 'facebook' | 'pure' => {
    const source = customer.purchase_source?.toLowerCase() || '';
    const hasGclid = !!(customer.gclid && String(customer.gclid).trim() !== '');
    if (source === 'google_ads' || hasGclid) return 'google';
    if (source === 'facebook_ads') return 'facebook';
    return 'pure';
  };

  // Calculate metrics with safe defaults - EXCLUDING cancelled/refunded from revenue
  const totalCustomers = filteredCustomers.length;
  const activeCustomers = filteredCustomers.filter(c => c.status === 'Active').length;
  const cancelledRefundedCount = filteredCustomers.filter(c => isRevenueLost(c.status)).length;
  // Revenue only counts non-cancelled/refunded customers
  const totalRevenue = activeRevenueCustomers.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
  const paidOrders = activeRevenueCustomers.filter(c => c.final_amount && Number(c.final_amount) > 0);
  const overallAOV = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

  // Calculate AOV by source (using effectiveDateRange for both chart clicks and date picker)
  const sourceMetrics = useMemo(() => {
    // Filter by effective date range (includes selected month from chart click)
    const dateFilteredCustomers = customers.filter(customer => {
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
      return true;
    });

    // Exclude cancelled/refunded from revenue calculations
    const websiteCustomers = dateFilteredCustomers.filter(c => 
      getCustomerSource(c) === 'website' && 
      c.final_amount && 
      Number(c.final_amount) > 0 &&
      !isRevenueLost(c.status)
    );
    const salesTeamCustomers = dateFilteredCustomers.filter(c => 
      getCustomerSource(c) === 'sales_team' && 
      c.final_amount && 
      Number(c.final_amount) > 0 &&
      !isRevenueLost(c.status)
    );

    // Website channel breakdown
    const googleCustomers = websiteCustomers.filter(c => getWebsiteChannel(c) === 'google');
    const facebookCustomers = websiteCustomers.filter(c => getWebsiteChannel(c) === 'facebook');
    const pureWebsiteCustomers = websiteCustomers.filter(c => getWebsiteChannel(c) === 'pure');
    
    const calcStats = (custs: Customer[]) => {
      const revenue = custs.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
      return {
        count: custs.length,
        revenue,
        aov: custs.length > 0 ? Math.round(revenue / custs.length) : 0
      };
    };
    
    return {
      website: calcStats(websiteCustomers),
      salesTeam: calcStats(salesTeamCustomers),
      google: calcStats(googleCustomers),
      facebook: calcStats(facebookCustomers),
      pureWebsite: calcStats(pureWebsiteCustomers),
    };
  }, [customers, effectiveDateRange]);

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

  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  // Agent performance analytics
  const agentPerformance = useMemo(() => {
    const agentMap = new Map<string, { sales: number; revenue: number; cancelled: number; refunded: number }>();

    filteredCustomers.forEach(c => {
      const agentId = c.assigned_to;
      if (!agentId) return; // skip unassigned
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
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-sm text-gray-600">Overview of your warranty business (excludes test orders)</p>
        </div>
        
        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 items-end p-4 bg-muted/30 rounded-lg border">
          {/* Period Comparison Toggle */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Quick Period</Label>
            <ToggleGroup type="single" value={comparisonPeriod || ''} onValueChange={(val) => handlePeriodComparison(val as any)}>
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
          
          <DateRangeFilter 
            dateRange={dateRange} 
            onDateRangeChange={(range) => {
              setDateRange(range);
              setSelectedMonth(null);
              setComparisonPeriod(null);
            }}
            className="min-w-[280px]"
          />
          
          <div className="space-y-1 min-w-[200px]">
            <Label className="text-sm font-medium">Sales Source</Label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Website Sales Breakdown
          </CardTitle>
          <CardDescription>
            All website sales (Stripe &amp; Bumper) broken down by acquisition channel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* All Website Sales */}
            <div className="p-4 rounded-lg border-2 border-blue-300 bg-blue-50/40 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm text-blue-700">All Website Sales</span>
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

            {/* Website Google */}
            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-sm text-emerald-700">Website G (Google Ads)</span>
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

            {/* Website Facebook */}
            <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/30 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Facebook className="h-4 w-4 text-indigo-600" />
                <span className="font-semibold text-sm text-indigo-700">Website F (Facebook Ads)</span>
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

            {/* Pure Website (Organic) */}
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
        </CardContent>
      </Card>

      {/* Sales Team Card */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-orange-500" />
              Sales Team (ADM)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Orders</span>
                <span className="font-semibold">{sourceMetrics.salesTeam.count}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Revenue</span>
                <span className="font-semibold">£{sourceMetrics.salesTeam.revenue.toLocaleString('en-GB')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">AOV</span>
                <span className="text-xl font-bold text-orange-600">£{sourceMetrics.salesTeam.aov}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  const label = name === 'revenue' ? 'Revenue' : name === 'aov' ? 'Avg Order Value' : name;
                  return [`£${value.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`, label];
                }}
                labelStyle={{ fontWeight: 'bold' }}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend formatter={(value) => value === 'revenue' ? 'Revenue' : value === 'aov' ? 'Avg Order Value' : value} />
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
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {!isSalesLead && (
      <>
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

      {/* Agent Performance */}
      {agentPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Agent Sales Performance
            </CardTitle>
            <CardDescription>Sales breakdown by agent {effectiveDateRange?.from ? '(filtered period)' : '(all time)'}</CardDescription>
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
                      <td className="py-2 px-2">Total (Assigned)</td>
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

      {/* Sales by Vehicle Age & Mileage */}
      <SalesAgeMileageAnalytics customers={filteredCustomers} />

      {/* API Connectivity Test Section */}
      <div className="mt-8">
        <ApiConnectivityTest />
      </div>
      </>
      )}
    </div>
  );
};
