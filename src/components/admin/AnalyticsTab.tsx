
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, CreditCard, PoundSterling } from 'lucide-react';
import { toast } from 'sonner';
import { ApiConnectivityTest } from './ApiConnectivityTest';

interface Customer {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  signup_date: string;
  status: string;
  final_amount: number | null;
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

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      console.log('Fetching analytics data...');
      
      // Match CustomersTab filtering exactly
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, plan_type, signup_date, status, final_amount')
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

  // Calculate metrics with safe defaults
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'Active').length;
  const totalRevenue = customers.reduce((sum, c) => sum + (Number(c.final_amount) || 0), 0);

  // Plan distribution data
  const planDistribution = customers.reduce((acc: Record<string, number>, customer) => {
    acc[customer.plan_type] = (acc[customer.plan_type] || 0) + 1;
    return acc;
  }, {});

  const planData = Object.entries(planDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  // Monthly signup data (last 6 months)
  const monthlySignups = React.useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        signups: 0
      };
    }).reverse();

    customers.forEach(customer => {
      const signupDate = new Date(customer.signup_date);
      const monthKey = signupDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const monthData = months.find(m => m.month === monthKey);
      if (monthData) {
        monthData.signups++;
      }
    });

    return months;
  }, [customers]);

  // Monthly revenue data (last 12 months)
  const monthlyRevenue = React.useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        revenue: 0
      };
    }).reverse();

    customers.forEach(customer => {
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
  }, [customers]);

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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        <p className="text-sm text-gray-600">Overview of your warranty business (excludes test orders)</p>
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
              From {customers.filter(c => c.final_amount).length} paid orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{customers.filter(c => c.final_amount).length > 0 
                ? Math.round(totalRevenue / customers.filter(c => c.final_amount).length)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Per warranty sale
            </p>
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
          {customers.length > 0 ? (
            <div className="space-y-4">
              {customers.slice(0, 5).map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-gray-600">{customer.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{customer.plan_type}</p>
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
              No customer activity yet
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
