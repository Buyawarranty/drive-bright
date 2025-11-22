import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp, Users, DollarSign, Award } from 'lucide-react';
import { toast } from 'sonner';

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  final_amount: number;
  signup_date: string;
  assigned_to?: string;
  status: string;
}

interface SalesStats {
  totalSales: number;
  totalCustomers: number;
  averageOrderValue: number;
  monthlyGrowth: number;
}

export const SalesTrackingTab: React.FC = () => {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesStats, setSalesStats] = useState<SalesStats>({
    totalSales: 0,
    totalCustomers: 0,
    averageOrderValue: 0,
    monthlyGrowth: 0
  });
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAdminUsers(),
        fetchCustomers(),
        fetchSalesStats()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    setAdminUsers(data || []);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('signup_date', { ascending: false });
    
    if (error) throw error;
    setCustomers(data || []);
  };

  const fetchSalesStats = async () => {
    // Calculate basic stats from customers data
    const { data: customersData, error } = await supabase
      .from('customers')
      .select('final_amount, signup_date');
    
    if (error) throw error;
    
    const totalSales = customersData?.reduce((sum, customer) => sum + (customer.final_amount || 0), 0) || 0;
    const totalCustomers = customersData?.length || 0;
    const averageOrderValue = totalCustomers > 0 ? totalSales / totalCustomers : 0;
    
    // Calculate monthly growth (simplified)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentMonthCustomers = customersData?.filter(c => {
      const date = new Date(c.signup_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length || 0;
    
    const lastMonthCustomers = customersData?.filter(c => {
      const date = new Date(c.signup_date);
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const year = currentMonth === 0 ? currentYear - 1 : currentYear;
      return date.getMonth() === lastMonth && date.getFullYear() === year;
    }).length || 0;
    
    const monthlyGrowth = lastMonthCustomers > 0 ? 
      ((currentMonthCustomers - lastMonthCustomers) / lastMonthCustomers) * 100 : 0;
    
    setSalesStats({
      totalSales,
      totalCustomers,
      averageOrderValue,
      monthlyGrowth
    });
  };

  const assignCustomerToUser = async (customerId: string, adminUserId: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ assigned_to: adminUserId || null } as any)
        .eq('id', customerId);
      
      if (error) {
        console.error('Assignment error:', error);
        toast.error('Failed to assign customer');
        return;
      }
      
      toast.success('Customer assigned successfully');
      fetchCustomers();
      setAssignDialogOpen(false);
    } catch (error) {
      console.error('Assignment error:', error);
      toast.error('Failed to assign customer');
    }
  };

  const getUserName = (userId: string) => {
    const user = adminUsers.find(u => u.id === userId);
    return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Tracking</h1>
          <p className="text-muted-foreground">Monitor sales performance and manage team assignments</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Users className="h-4 w-4 mr-2" />
                Assign Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Customer</DialogTitle>
                <DialogDescription>Assign a customer to a sales team member</DialogDescription>
              </DialogHeader>
              <CustomerAssignForm 
                customers={customers.filter(c => !c.assigned_to)}
                adminUsers={adminUsers}
                onAssign={assignCustomerToUser}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sales Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{salesStats.totalSales.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats.totalCustomers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{salesStats.averageOrderValue.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {salesStats.monthlyGrowth > 0 ? '+' : ''}{salesStats.monthlyGrowth.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments">Customer Assignments</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>Customer Assignments</CardTitle>
              <CardDescription>View and manage customer assignments to sales team</CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerAssignmentsTable 
                customers={customers} 
                adminUsers={adminUsers}
                onReassign={(customerId, newUserId) => assignCustomerToUser(customerId, newUserId)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Sales Performance</CardTitle>
              <CardDescription>Individual sales team member performance</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesPerformanceTable 
                adminUsers={adminUsers} 
                customers={customers}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Helper Components
const CustomerAssignForm: React.FC<{
  customers: Customer[];
  adminUsers: AdminUser[];
  onAssign: (customerId: string, adminUserId: string) => void;
}> = ({ customers, adminUsers, onAssign }) => {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedUser, setSelectedUser] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomer && selectedUser) {
      onAssign(selectedCustomer, selectedUser);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Customer</Label>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger>
            <SelectValue placeholder="Select customer" />
          </SelectTrigger>
          <SelectContent>
            {customers.map(customer => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name} ({customer.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Sales Team Member</Label>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger>
            <SelectValue placeholder="Select team member" />
          </SelectTrigger>
          <SelectContent>
            {adminUsers.map(user => (
              <SelectItem key={user.id} value={user.id}>
                {user.first_name} {user.last_name} ({user.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="submit">Assign Customer</Button>
      </DialogFooter>
    </form>
  );
};

const CustomerAssignmentsTable: React.FC<{
  customers: Customer[];
  adminUsers: AdminUser[];
  onReassign: (customerId: string, newUserId: string) => void;
}> = ({ customers, adminUsers, onReassign }) => {
  const getUserName = (userId: string) => {
    const user = adminUsers.find(u => u.id === userId);
    return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Unassigned';
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map(customer => (
          <TableRow key={customer.id}>
            <TableCell>{customer.name}</TableCell>
            <TableCell>{customer.email}</TableCell>
            <TableCell>
              <Badge variant="secondary">{customer.plan_type}</Badge>
            </TableCell>
            <TableCell>£{customer.final_amount?.toLocaleString() || '0'}</TableCell>
            <TableCell>{getUserName(customer.assigned_to || '')}</TableCell>
            <TableCell>
              <Select 
                value={customer.assigned_to || ''} 
                onValueChange={(value) => onReassign(customer.id, value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Assign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {adminUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const SalesPerformanceTable: React.FC<{
  adminUsers: AdminUser[];
  customers: Customer[];
}> = ({ adminUsers, customers }) => {
  const getPerformanceData = (userId: string) => {
    const userCustomers = customers.filter(c => c.assigned_to === userId);
    const totalSales = userCustomers.reduce((sum, c) => sum + (c.final_amount || 0), 0);
    const customerCount = userCustomers.length;
    const avgOrderValue = customerCount > 0 ? totalSales / customerCount : 0;
    
    return {
      totalSales,
      customerCount,
      avgOrderValue
    };
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sales Person</TableHead>
          <TableHead>Customers</TableHead>
          <TableHead>Total Sales</TableHead>
          <TableHead>Avg Order Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {adminUsers.map(user => {
          const performance = getPerformanceData(user.id);
          return (
            <TableRow key={user.id}>
              <TableCell>
                {user.first_name} {user.last_name}
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </TableCell>
              <TableCell>{performance.customerCount}</TableCell>
              <TableCell>£{performance.totalSales.toLocaleString()}</TableCell>
              <TableCell>£{performance.avgOrderValue.toFixed(2)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};