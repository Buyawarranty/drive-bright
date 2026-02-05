
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { Users, CreditCard, PoundSterling, Globe, Phone, X, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { ApiConnectivityTest } from './ApiConnectivityTest';
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
  vehicle_fuel_type: string | null;
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

export const AnalyticsTab = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [comparisonPeriod, setComparisonPeriod] = useState<'week' | 'month' | 'last_month' | 'year' | null>(null);


  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      console.log('Fetching analytics data...');
      
      // Match CustomersTab filtering exactly
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, plan_type, signup_date, status, final_amount, warranty_reference_number, purchase_source, vehicle_fuel_type')
        .not('email', 'ilike', '%@test.com%')
        .not('email', 'ilike', '%testuser%')
        .not('email', 'ilike', '%guest@%')
        .not('name', 'eq', 'Test Customer')
        .not('name', 'eq', 'Guest Customer')
        .eq('is_deleted', false);

      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }

      // Also filter out specific test names not caught by DB query
      const realCustomers = (data || []).filter(c => !isTestOrder(c.name, c.email));
      console.log('Real customers (matching Customer Dashboard):', realCustomers.length);
      
      setCustomers(realCustomers);
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
  const handlePeriodComparison = useCallback((period: 'week' | 'month' | 'last_month' | 'year' | null) => {
    if (comparisonPeriod === period) {
      setComparisonPeriod(null);
      setDateRange(undefined);
    } else {
      setComparisonPeriod(period);
      setSelectedMonth(null);
      
      const now = new Date();
      let from: Date, to: Date;
      
      switch (period) {
        case 'week':
          from = startOfWeek(now, { weekStartsOn: 1 });
          to = endOfWeek(now, { weekStartsOn: 1 });
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
  
  // Helper function to check if status is specifically a refund
  const isRefunded = (status: string): boolean => {
    return status?.toLowerCase() === 'refunded';
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

      // Source filter
      if (sourceFilter !== 'all') {
        const ref = customer.warranty_reference_number?.toUpperCase() || '';
        const source = customer.purchase_source?.toLowerCase() || '';
        
        if (sourceFilter === 'website') {
          // Website sales: BAW reference OR purchase_source is 'website'
          const isWebsite = ref.startsWith('BAW-') || source === 'website';
          if (!isWebsite) return false;
        } else if (sourceFilter === 'sales_team') {
          // Sales team: ADM reference OR purchase_source is 'quote_link' or 'external'
          const isSalesTeam = ref.startsWith('ADM-') || source === 'quote_link' || source === 'external';
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


  // Helper function to categorize customer by source
  const getCustomerSource = (customer: Customer): 'website' | 'sales_team' | 'unknown' => {
    const ref = customer.warranty_reference_number?.toUpperCase() || '';
    const source = customer.purchase_source?.toLowerCase() || '';
    if (ref.startsWith('BAW-') || source === 'website') return 'website';
    if (ref.startsWith('ADM-') || source === 'quote_link' || source === 'external') return 'sales_team';
    return 'unknown';
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
    
    const websiteRevenue = websiteCustomers.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
    const salesTeamRevenue = salesTeamCustomers.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
    
    return {
      website: {
        count: websiteCustomers.length,
        revenue: websiteRevenue,
        aov: websiteCustomers.length > 0 ? Math.round(websiteRevenue / websiteCustomers.length) : 0
      },
      salesTeam: {
        count: salesTeamCustomers.length,
        revenue: salesTeamRevenue,
        aov: salesTeamCustomers.length > 0 ? Math.round(salesTeamRevenue / salesTeamCustomers.length) : 0
      }
    };
  }, [customers, effectiveDateRange]);

  // Refund metrics calculation
  const refundMetrics = useMemo(() => {
    const refundedCustomers = filteredCustomers.filter(c => isRefunded(c.status));
    const totalRefundAmount = refundedCustomers.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
    return {
      count: refundedCustomers.length,
      totalAmount: totalRefundAmount
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
      if (isRefunded(customer.status) && customer.final_amount && customer.signup_date) {
        const signupDate = new Date(customer.signup_date);
        const monthKey = `${signupDate.getFullYear()}-${String(signupDate.getMonth() + 1).padStart(2, '0')}`;
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

  // Monthly revenue data (last 12 months) - uses ALL customers (not filtered) for chart display
  const monthlyRevenue = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        revenue: 0,
        isSelected: false
      };
    }).reverse();

    // Use all customers for chart display (not filtered customers) - EXCLUDING cancelled/refunded
    customers.forEach(customer => {
      // Skip cancelled/refunded orders from revenue chart
      if (isRevenueLost(customer.status)) return;
      
      if (customer.final_amount && customer.signup_date) {
        const signupDate = new Date(customer.signup_date);
        const monthKey = `${signupDate.getFullYear()}-${String(signupDate.getMonth() + 1).padStart(2, '0')}`;
        const monthData = months.find(m => m.monthKey === monthKey);
        if (monthData) {
          monthData.revenue += Number(customer.final_amount) || 0;
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

    return months;
  }, [customers, selectedMonth]);

  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

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
            <ToggleGroup type="single" value={comparisonPeriod || ''} onValueChange={(val) => handlePeriodComparison(val as 'week' | 'month' | 'last_month' | 'year' | null)}>
              <ToggleGroupItem value="week" aria-label="This Week" className="px-3">
                This Week
              </ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label="This Month" className="px-3">
                This Month
              </ToggleGroupItem>
              <ToggleGroupItem value="last_month" aria-label="Last Month" className="px-3">
                Last Month
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

      {/* AOV Breakdown by Source */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              Website Sales (BAW)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Orders</span>
                <span className="font-semibold">{sourceMetrics.website.count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Revenue</span>
                <span className="font-semibold">£{sourceMetrics.website.revenue.toLocaleString('en-GB')}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Average Order Value</span>
                <span className="text-xl font-bold text-blue-600">£{sourceMetrics.website.aov}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-orange-500" />
              Sales Team (ADM)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Orders</span>
                <span className="font-semibold">{sourceMetrics.salesTeam.count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Revenue</span>
                <span className="font-semibold">£{sourceMetrics.salesTeam.revenue.toLocaleString('en-GB')}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Average Order Value</span>
                <span className="text-xl font-bold text-orange-600">£{sourceMetrics.salesTeam.aov}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refunds Section */}
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Refunds {selectedMonth ? `(${format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1), 'MMMM yyyy')})` : effectiveDateRange?.from ? '(Filtered Period)' : '(All Time)'}
            </CardTitle>
            <CardDescription className="mt-1">
              Money refunded to customers
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Total Refunds</span>
              <p className="text-2xl font-bold text-red-600">
                £{refundMetrics.totalAmount.toLocaleString('en-GB')}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Refund Count</span>
              <p className="text-2xl font-bold">{refundMetrics.count}</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Avg Refund</span>
              <p className="text-2xl font-bold text-red-600">
                £{refundMetrics.count > 0 ? Math.round(refundMetrics.totalAmount / refundMetrics.count) : 0}
              </p>
            </div>
          </div>
          
          {/* Monthly refunds breakdown */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">Monthly Refunds (Last 12 Months)</p>
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
                  <p className="text-xs text-muted-foreground">{month.refundCount} refunds</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Total Revenue by Month (Last 12 Months)</CardTitle>
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
            <BarChart 
              data={monthlyRevenue} 
              onClick={handleBarClick}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `£${value.toLocaleString()}`} />
              <Tooltip 
                formatter={(value: number) => [`£${value.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`, 'Revenue']}
                labelStyle={{ fontWeight: 'bold' }}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Bar 
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
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
                      {customer.warranty_reference_number?.startsWith('BAW-') && (
                        <Globe className="h-3 w-3 text-blue-500" />
                      )}
                      {customer.warranty_reference_number?.startsWith('ADM-') && (
                        <Phone className="h-3 w-3 text-orange-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(customer.signup_date).toLocaleDateString()}
                    </p>
                    {/* Only show amount for active customers - hide for cancelled/refunded/test */}
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
      
      {/* API Connectivity Test Section */}
      <div className="mt-8">
        <ApiConnectivityTest />
      </div>
    </div>
  );
};
