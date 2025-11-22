
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ApiConnectivityTest } from './ApiConnectivityTest';

interface Customer {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  signup_date: string;
  status: string;
  voluntary_excess: number;
}

interface Payment {
  id: string;
  amount: number;
  plan_type: string;
  payment_date: string;
}

export const AnalyticsTab = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      console.log('Fetching analytics data...');
      
      const [customersResponse, paymentsResponse] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('payments').select('*')
      ]);

      if (customersResponse.error) {
        console.error('Error fetching customers:', customersResponse.error);
        throw customersResponse.error;
      }

      if (paymentsResponse.error) {
        console.error('Error fetching payments:', paymentsResponse.error);
        throw paymentsResponse.error;
      }

      console.log('Customers data:', customersResponse.data);
      console.log('Payments data:', paymentsResponse.data);
      
      setCustomers(customersResponse.data || []);
      setPayments(paymentsResponse.data || []);
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
  const totalRevenue = payments.length > 0 ? payments.reduce((sum, payment) => sum + Number(payment.amount), 0) : 0;
  const averageExcess = customers.length > 0 && customers.some(c => c.voluntary_excess) 
    ? customers.filter(c => c.voluntary_excess).reduce((sum, customer) => sum + Number(customer.voluntary_excess), 0) / customers.filter(c => c.voluntary_excess).length 
    : 0;

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
        <p className="text-sm text-gray-600">Overview of your warranty business</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className="text-2xl font-bold">£{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From {payments.length} payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Excess</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{averageExcess.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              Customer voluntary excess
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Customer retention rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
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
                <Bar dataKey="signups" fill="#f97316" />
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
