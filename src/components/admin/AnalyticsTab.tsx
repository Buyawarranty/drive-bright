
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, CreditCard, PoundSterling, Globe, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { ApiConnectivityTest } from './ApiConnectivityTest';
import { DateRangeFilter } from './DateRangeFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DateRange } from 'react-day-picker';

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

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      console.log('Fetching analytics data...');
      
      // Match CustomersTab filtering exactly
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, plan_type, signup_date, status, final_amount, warranty_reference_number, purchase_source')
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

  // Filter customers based on date range and source
  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      // Date filter
      if (dateRange?.from) {
        const signupDate = new Date(customer.signup_date);
        if (signupDate < dateRange.from) return false;
        if (dateRange.to && signupDate > dateRange.to) return false;
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
  }, [customers, dateRange, sourceFilter]);

  // Helper function to categorize customer by source
  const getCustomerSource = (customer: Customer): 'website' | 'sales_team' | 'unknown' => {
    const ref = customer.warranty_reference_number?.toUpperCase() || '';
    const source = customer.purchase_source?.toLowerCase() || '';
    if (ref.startsWith('BAW-') || source === 'website') return 'website';
    if (ref.startsWith('ADM-') || source === 'quote_link' || source === 'external') return 'sales_team';
    return 'unknown';
  };

  // Calculate metrics with safe defaults
  const totalCustomers = filteredCustomers.length;
  const activeCustomers = filteredCustomers.filter(c => c.status === 'Active').length;
  const totalRevenue = filteredCustomers.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);
  const paidOrders = filteredCustomers.filter(c => c.final_amount && Number(c.final_amount) > 0);
  const overallAOV = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

  // Calculate AOV by source (using all customers, respecting date filter only)
  const sourceMetrics = useMemo(() => {
    // Filter by date only for source breakdown
    const dateFilteredCustomers = customers.filter(customer => {
      if (dateRange?.from) {
        const signupDate = new Date(customer.signup_date);
        if (signupDate < dateRange.from) return false;
        if (dateRange.to && signupDate > dateRange.to) return false;
      }
      return true;
    });

    const websiteCustomers = dateFilteredCustomers.filter(c => getCustomerSource(c) === 'website' && c.final_amount && Number(c.final_amount) > 0);
    const salesTeamCustomers = dateFilteredCustomers.filter(c => getCustomerSource(c) === 'sales_team' && c.final_amount && Number(c.final_amount) > 0);
    
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
  }, [customers, dateRange]);

  // Plan distribution data
  const planDistribution = filteredCustomers.reduce((acc: Record<string, number>, customer) => {
    acc[customer.plan_type] = (acc[customer.plan_type] || 0) + 1;
    return acc;
  }, {});

  const planData = Object.entries(planDistribution).map(([name, value]) => ({
    name,
    value,
  }));

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

  // Monthly revenue data (last 12 months)
  const monthlyRevenue = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        revenue: 0
      };
    }).reverse();

    filteredCustomers.forEach(customer => {
      if (customer.final_amount && customer.signup_date) {
        const signupDate = new Date(customer.signup_date);
        const monthKey = `${signupDate.getFullYear()}-${String(signupDate.getMonth() + 1).padStart(2, '0')}`;
        const monthData = months.find(m => m.monthKey === monthKey);
        if (monthData) {
          monthData.revenue += Number(customer.final_amount) || 0;
        }
      }
    });

    return months;
  }, [filteredCustomers]);

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
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Range</Label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDateRange(undefined)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  !dateRange ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-input'
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const to = new Date(now.getFullYear(), now.getMonth(), 0);
                  setDateRange({ from, to });
                }}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  dateRange?.from && dateRange?.to && 
                  dateRange.from.getMonth() === new Date().getMonth() - 1 &&
                  dateRange.to.getDate() === new Date(new Date().getFullYear(), new Date().getMonth(), 0).getDate()
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-background hover:bg-muted border-input'
                }`}
              >
                Last Month
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                  setDateRange({ from, to: now });
                }}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors bg-background hover:bg-muted border-input`}
              >
                1 Year
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const from = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
                  setDateRange({ from, to: now });
                }}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors bg-background hover:bg-muted border-input`}
              >
                2 Year
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const from = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
                  setDateRange({ from, to: now });
                }}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors bg-background hover:bg-muted border-input`}
              >
                3 Year
              </button>
            </div>
            <DateRangeFilter 
              dateRange={dateRange} 
              onDateRangeChange={setDateRange}
              className="min-w-[280px]"
            />
          </div>
          
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
          
          {(dateRange || sourceFilter !== 'all') && (
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

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Total Revenue by Month (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `£${value.toLocaleString()}`} />
              <Tooltip 
                formatter={(value: number) => [`£${value.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`, 'Revenue']}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
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
            <CardTitle>Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {planData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={planData}
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
                    {planData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No plan data available
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
                    {customer.final_amount && (
                      <p className="text-xs font-semibold text-green-600">
                        £{Number(customer.final_amount).toLocaleString()}
                      </p>
                    )}
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
