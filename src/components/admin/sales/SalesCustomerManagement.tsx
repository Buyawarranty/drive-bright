import React, { useState, useEffect, useMemo } from 'react';
import { WEBSITE_SALES_ACCOUNT_ID } from '@/constants/salesDefaults';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { EditCustomerDetailsDialog } from '../EditCustomerDetailsDialog';
import { InlineWarrantyUpgrade } from '../InlineWarrantyUpgrade';
import { InlineUpgradeCell } from '../InlineUpgradeCell';
import { 
  Search, RefreshCw, Plus, AlertCircle, Edit, ExternalLink, Sparkles, Send, CheckCircle, Clock, Mail, Phone
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PurchaseSourceBadge } from '../PurchaseSourceBadge';
import { DateRangeFilter } from '../DateRangeFilter';
import { DateRange } from 'react-day-picker';

interface CustomerTag {
  id: string;
  name: string;
  color: string;
  category: string;
}

interface AdminUserBasic {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface Customer {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  registration_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  plan_type: string;
  payment_type: string | null;
  status: string;
  signup_date: string;
  created_at: string;
  claim_limit: number | null;
  voluntary_excess: number | null;
  labour_rate: number | null;
  mileage: string | null;
  flat_number: string | null;
  building_name: string | null;
  building_number: string | null;
  street: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  assigned_to: string | null;
  // Purchase source tracking
  purchase_source?: string | null;
  bumper_order_id?: string | null;
  stripe_session_id?: string | null;
  // Add-ons
  tyre_cover?: boolean | null;
  wear_tear?: boolean | null;
  europe_cover?: boolean | null;
  transfer_cover?: boolean | null;
  breakdown_recovery?: boolean | null;
  vehicle_rental?: boolean | null;
  mot_fee?: boolean | null;
  mot_repair?: boolean | null;
  lost_key?: boolean | null;
  consequential?: boolean | null;
  // Policy info
  policy?: {
    id: string;
    policy_number: string;
    policy_start_date: string;
    policy_end_date: string;
    warranty_number: string | null;
    warranties_2000_status: string | null;
    email_sent_status: string | null;
    payment_amount: number | null;
    payment_verified: boolean | null;
    claim_limit: number | null;
  } | null;
  // Tags
  tags?: CustomerTag[];
}

interface SalesCustomerManagementProps {
  currentUserId?: string;
}

const SalesCustomerManagement: React.FC<SalesCustomerManagementProps> = ({ currentUserId: propUserId }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableTags, setAvailableTags] = useState<CustomerTag[]>([]);
  const [salesUsers, setSalesUsers] = useState<AdminUserBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterByPlan, setFilterByPlan] = useState('all');
  const [filterByStatus, setFilterByStatus] = useState('all');
  const [filterByTag, setFilterByTag] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('active');
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null);
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [emailSendingLoading, setEmailSendingLoading] = useState<Record<string, { email?: boolean; warranties2000?: boolean }>>({});
  
  const [editDetailsDialog, setEditDetailsDialog] = useState<{
    open: boolean;
    customer: Customer | null;
  }>({ open: false, customer: null });

  // Fetch current user's admin ID and auth user ID
  useEffect(() => {
    const fetchCurrentUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('[SalesCustomerManagement] Auth user:', user.id, user.email);
        setCurrentAuthUserId(user.id);
        
        if (propUserId) {
          console.log('[SalesCustomerManagement] Using prop userId:', propUserId);
          setCurrentUserId(propUserId);
          return;
        }
        
        const { data: adminUser, error: adminError } = await supabase
          .from('admin_users')
          .select('id, role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (adminError) {
          console.error('[SalesCustomerManagement] Error fetching admin user:', adminError);
        }
        
        if (adminUser) {
          console.log('[SalesCustomerManagement] Admin user found:', adminUser.id, 'role:', adminUser.role);
          setCurrentUserId(adminUser.id);
        } else {
          console.warn('[SalesCustomerManagement] No admin user found for auth user:', user.id);
          setLoading(false);
        }
      } else {
        console.warn('[SalesCustomerManagement] No authenticated user');
        setLoading(false);
      }
    };
    
    fetchCurrentUserId();
  }, [propUserId]);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchCustomers = async (adminUserId?: string, authUserId?: string) => {
    // Use passed parameters or fall back to state
    const userIdToUse = adminUserId || currentUserId;
    const authUserIdToUse = authUserId || currentAuthUserId;
    
    if (!userIdToUse || !authUserIdToUse) {
      console.warn('[SalesCustomerManagement] fetchCustomers called without valid IDs:', { userIdToUse, authUserIdToUse });
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('[SalesCustomerManagement] fetchCustomers called with adminUserId:', userIdToUse, 'authUserId:', authUserIdToUse);
      
      // Only fetch COMPLETED SALES - customers where this agent:
      // 1. Is assigned_to (deal owner)
      // 2. Confirmed the payment (payment_confirmed_by)
      // 3. Sent the original quote (quote_sent_by)
      // 4. Manually created the record (is_manual_entry)
      // We use .or() to combine these conditions
      const { data: customerData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          customer_tag_assignments (
            tag_id,
            customer_tags (id, name, color, category)
          )
        `)
        .eq('is_deleted', false)
        .or(`assigned_to.eq.${userIdToUse},payment_confirmed_by.eq.${userIdToUse},quote_sent_by.eq.${userIdToUse}`)
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;

      console.log('[SalesCustomerManagement] Customers (completed sales) result:', customerData?.length || 0, 'rows');

      // Get policies for customers if we have any
      let policies: any[] = [];
      if (customerData && customerData.length > 0) {
        const customerIds = customerData.map(c => c.id);
        const { data: policiesData, error: policiesError } = await supabase
          .from('customer_policies')
          .select('*')
          .in('customer_id', customerIds)
          .eq('is_deleted', false);

        if (policiesError) throw policiesError;
        policies = policiesData || [];
      }

      // Map customers with their policies and tags
      const customersWithData: Customer[] = (customerData || []).map(c => {
        const policy = policies.find(p => p.customer_id === c.id);
        const tags = c.customer_tag_assignments
          ?.map((ta: any) => ta.customer_tags)
          .filter(Boolean) || [];
        
        return {
          ...c,
          policy: policy ? {
            id: policy.id,
            policy_number: policy.policy_number,
            policy_start_date: policy.policy_start_date,
            policy_end_date: policy.policy_end_date,
            warranty_number: policy.warranty_number,
            warranties_2000_status: policy.warranties_2000_status,
            email_sent_status: policy.email_sent_status,
            payment_amount: policy.payment_amount,
            payment_verified: policy.payment_verified,
            claim_limit: policy.claim_limit,
          } : null,
          tags,
        };
      });

      // Sort by created_at descending
      customersWithData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setCustomers(customersWithData);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .eq('is_active', true)
        .order('first_name', { ascending: true });
      if (error) throw error;
      setSalesUsers(data || []);
    } catch (error) {
      console.error('Error fetching sales users:', error);
    }
  };

  const handleAssignCustomer = async (customerId: string, assignedTo: string | null) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ assigned_to: assignedTo })
        .eq('id', customerId);
      if (error) throw error;

      // Reverse sync: update matching sales_leads record by email
      const customer = customers.find(c => c.id === customerId);
      if (customer?.email) {
        const cleanEmail = customer.email.toLowerCase().trim();
        await supabase
          .from('sales_leads')
          .update({ 
            assigned_to: assignedTo, 
            assigned_at: assignedTo ? new Date().toISOString() : null,
            updated_at: new Date().toISOString() 
          })
          .eq('email', cleanEmail);
      }

      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, assigned_to: assignedTo } : c));
      toast.success('Customer assigned successfully');
    } catch (error: any) {
      console.error('Error assigning customer:', error);
      toast.error('Failed to assign customer');
    }
  };

  // Effect to fetch data when user IDs are available
  useEffect(() => {
    if (currentUserId && currentAuthUserId) {
      console.log('[SalesCustomerManagement] Fetching data for userId:', currentUserId, 'authUserId:', currentAuthUserId);
      fetchCustomers(currentUserId, currentAuthUserId);
      fetchTags();
      fetchSalesUsers();
    }
  }, [currentUserId, currentAuthUserId]);

  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Filter by active/archive tab
    if (activeTab === 'active') {
      // Active tab shows active, pending, and refunded (refunded customers should still be visible!)
      filtered = filtered.filter(c => {
        const status = c.status?.toLowerCase();
        return status !== 'cancelled' && status !== 'inactive';
      });
    } else {
      // Archive shows cancelled and inactive
      filtered = filtered.filter(c => {
        const status = c.status?.toLowerCase();
        return status === 'cancelled' || status === 'inactive';
      });
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.registration_plate?.toLowerCase().includes(term) ||
        c.vehicle_make?.toLowerCase().includes(term) ||
        c.vehicle_model?.toLowerCase().includes(term) ||
        c.postcode?.toLowerCase().includes(term) ||
        c.town?.toLowerCase().includes(term)
      );
    }

    // Plan filter
    if (filterByPlan !== 'all') {
      filtered = filtered.filter(c => 
        c.plan_type?.toLowerCase().includes(filterByPlan.toLowerCase())
      );
    }

    // Status filter
    if (filterByStatus !== 'all') {
      filtered = filtered.filter(c => c.status === filterByStatus);
    }

    // Tag filter
    if (filterByTag !== 'all') {
      filtered = filtered.filter(c => 
        c.tags?.some(t => t.id === filterByTag)
      );
    }

    // Date range filter
    if (dateRange?.from) {
      filtered = filtered.filter(c => {
        const signupDate = new Date(c.signup_date || c.created_at);
        const fromDate = new Date(dateRange.from!);
        fromDate.setHours(0, 0, 0, 0);
        
        if (dateRange.to) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          return signupDate >= fromDate && signupDate <= toDate;
        }
        return signupDate >= fromDate;
      });
    }

    // Sorting
    switch (sortBy) {
      case 'oldest':
        filtered = [...filtered].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case 'alphabetical':
        filtered = [...filtered].sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
        break;
      case 'newest':
      default:
        filtered = [...filtered].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
    }

    return filtered;
  }, [customers, searchTerm, sortBy, filterByPlan, filterByStatus, filterByTag, dateRange, activeTab]);

  const formatAddress = (customer: Customer) => {
    const parts = [
      customer.flat_number,
      customer.building_name,
      customer.building_number,
      customer.street,
      customer.town,
      customer.postcode
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  const getPaymentDuration = (paymentType: string | null) => {
    switch (paymentType) {
      case 'monthly': return '1M';
      case 'yearly': case '12months': return '12M';
      case '24months': case 'twoYear': return '24M';
      case '36months': case 'threeYear': return '36M';
      default: return paymentType || 'N/A';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-500 text-white">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'refunded':
        return <Badge className="bg-amber-500 text-white">💰 Refunded</Badge>;
      case 'lead':
        return <Badge className="bg-blue-500 text-white">📋 Lead</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWarrantyRegisterStatus = (status: string | null) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500 text-white text-xs"><CheckCircle className="w-3 h-3 mr-1" />Registered</Badge>;
      case 'scheduled':
        return <Badge variant="secondary" className="text-xs"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Not Sent</Badge>;
    }
  };

  const getEmailSentStatus = (status: string | null) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 text-xs"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 text-xs"><Clock className="w-3 h-3 mr-1" />Not Sent</Badge>;
    }
  };

  const handleSendWelcomeEmail = async (policyId: string, customerId: string) => {
    setEmailSendingLoading(prev => ({ ...prev, [customerId]: { ...prev[customerId], email: true } }));
    try {
      const { data, error } = await supabase.functions.invoke('send-welcome-email-manual', {
        body: { policyId, customerId }
      });
      if (error) throw error;
      toast.success('Welcome email sent successfully!');
      fetchCustomers();
    } catch (error: any) {
      console.error('Error sending welcome email:', error);
      toast.error(`Failed to send email: ${error.message}`);
    } finally {
      setEmailSendingLoading(prev => ({ ...prev, [customerId]: { ...prev[customerId], email: false } }));
    }
  };

  const handleSendToWarrantiesRegister = async (policyId: string, customerId: string) => {
    setEmailSendingLoading(prev => ({ ...prev, [customerId]: { ...prev[customerId], warranties2000: true } }));
    try {
      const { data, error } = await supabase.functions.invoke('send-to-warranties-2000', {
        body: { policyId, customerId, force: true }
      });
      if (error) throw error;
      toast.success('Successfully sent to Warranty Register!');
      fetchCustomers();
    } catch (error: any) {
      console.error('Error sending to Warranty Register:', error);
      toast.error(`Failed to send to Warranty Register: ${error.message}`);
    } finally {
      setEmailSendingLoading(prev => ({ ...prev, [customerId]: { ...prev[customerId], warranties2000: false } }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Customer Management</h2>
        <Button variant="outline" onClick={() => fetchCustomers()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="active" className="flex-1">Active Orders</TabsTrigger>
          <TabsTrigger value="archive" className="flex-1">Archive</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="bg-muted/30 p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, reg plate, vehicle, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Sort By</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Plan Type */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Plan Type</Label>
            <Select value={filterByPlan} onValueChange={setFilterByPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="electric">Electric</SelectItem>
                <SelectItem value="phev">PHEV</SelectItem>
                <SelectItem value="motorbike">Motorbike</SelectItem>
                <SelectItem value="van">Van</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Status</Label>
            <Select value={filterByStatus} onValueChange={setFilterByStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="lead">📋 Lead</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="claim_made">Claim Made</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tag Filter */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Filter by Tag</Label>
            <Select value={filterByTag} onValueChange={setFilterByTag}>
              <SelectTrigger>
                <SelectValue>
                  {filterByTag === 'all' ? (
                    'All Tags'
                  ) : (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: availableTags.find(t => t.id === filterByTag)?.color }}
                      />
                      <span>{availableTags.find(t => t.id === filterByTag)?.name || 'Select Tag'}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {Object.entries(
                  availableTags.reduce((acc: Record<string, CustomerTag[]>, tag) => {
                    if (!acc[tag.category]) acc[tag.category] = [];
                    acc[tag.category].push(tag);
                    return acc;
                  }, {})
                ).map(([category, tags]) => (
                  <React.Fragment key={category}>
                    <SelectItem value={`category-${category}`} disabled className="font-semibold text-xs uppercase text-muted-foreground">
                      {category}
                    </SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id} className="pl-6">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        {/* Results count and clear */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredCustomers.length} of {customers.length} customers
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setSortBy('newest');
              setFilterByPlan('all');
              setFilterByStatus('all');
              setFilterByTag('all');
              setDateRange(undefined);
            }}
            className="text-xs"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-background rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[1600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="bg-amber-50/50">Upgrade</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>RegNum</TableHead>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>RegDate</TableHead>
                <TableHead>WarType</TableHead>
                <TableHead>Dur.</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead className="bg-blue-50/50">Vol. Excess</TableHead>
                <TableHead className="bg-green-50/50">Claim Limit</TableHead>
                <TableHead className="bg-purple-50/50">Labour Rate</TableHead>
                <TableHead>Mileage</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="bg-purple-50">Source</TableHead>
                <TableHead>Customer Email</TableHead>
                <TableHead>Warranty Register</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={22} className="text-center py-8">
                    <div className="space-y-4">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                      <div>
                        <p className="text-muted-foreground text-lg">No customers found</p>
                        <p className="text-muted-foreground/70 text-sm mt-2">
                          Your assigned customers will appear here
                        </p>
                      </div>
                      <Button onClick={() => fetchCustomers()} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    {/* Upgrade Column */}
                    <TableCell className="bg-amber-50/30">
                      <InlineUpgradeCell
                        customerId={customer.id}
                        customerEmail={customer.email}
                        customerName={customer.name}
                        registrationPlate={customer.registration_plate || ''}
                        currentClaimLimit={customer.policy?.claim_limit || customer.claim_limit || 1250}
                        currentLabourRate={customer.labour_rate || 70}
                        currentExcess={customer.voluntary_excess || 100}
                        onUpdate={() => fetchCustomers()}
                        tyreCover={customer.tyre_cover || false}
                        wearTear={customer.wear_tear || false}
                        europeCover={customer.europe_cover || false}
                        transferCover={customer.transfer_cover || false}
                        breakdownRecovery={customer.breakdown_recovery || false}
                        vehicleRental={customer.vehicle_rental || false}
                        motFee={customer.mot_fee || false}
                        motRepair={customer.mot_repair || false}
                        lostKey={customer.lost_key || false}
                        consequential={customer.consequential || false}
                      />
                    </TableCell>

                    {/* Name with Edit Button */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditDetailsDialog({ open: true, customer })}
                          title="Edit Customer Details"
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <span className="whitespace-nowrap">{customer.name}</span>
                      </div>
                    </TableCell>

                    {/* Assigned To */}
                    <TableCell>
                      <Select
                        value={customer.assigned_to || WEBSITE_SALES_ACCOUNT_ID}
                        onValueChange={(val) => handleAssignCustomer(customer.id, val === 'unassigned' ? null : val)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          <SelectItem value={WEBSITE_SALES_ACCOUNT_ID}>Website</SelectItem>
                          {salesUsers.filter(u => u.id !== WEBSITE_SALES_ACCOUNT_ID).map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.first_name || ''} {u.last_name || u.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    {/* Purchase Date */}
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(customer.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    
                    {/* Email */}
                    <TableCell className="max-w-[200px] truncate" title={customer.email}>
                      {customer.email}
                    </TableCell>
                    
                    {/* Phone */}
                    <TableCell className="whitespace-nowrap">
                      {customer.phone ? (
                        <a href={`tel:${customer.phone}`} className="text-emerald-600 hover:underline flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </a>
                      ) : 'N/A'}
                    </TableCell>
                    
                    {/* RegNum */}
                    <TableCell>
                      {customer.registration_plate ? (
                        <div className="inline-flex items-center">
                          <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-l">
                            GB
                          </span>
                          <span className="bg-yellow-400 text-black font-bold px-2 py-0.5 rounded-r text-sm">
                            {customer.registration_plate}
                          </span>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    
                    {/* Make */}
                    <TableCell className="whitespace-nowrap">
                      {customer.vehicle_make || 'N/A'}
                    </TableCell>
                    
                    {/* Model */}
                    <TableCell className="whitespace-nowrap">
                      {customer.vehicle_model || 'N/A'}
                    </TableCell>
                    
                    {/* RegDate (Year) */}
                    <TableCell>
                      {customer.vehicle_year || 'N/A'}
                    </TableCell>
                    
                    {/* WarType (Plan Type) */}
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {customer.plan_type}
                      </Badge>
                    </TableCell>
                    
                    {/* Duration */}
                    <TableCell className="text-center">
                      {getPaymentDuration(customer.payment_type)}
                    </TableCell>
                    
                    {/* Start Date */}
                    <TableCell className="whitespace-nowrap">
                      {customer.policy?.policy_start_date 
                        ? format(new Date(customer.policy.policy_start_date), 'dd/MM/yyyy')
                        : 'N/A'}
                    </TableCell>
                    
                    {/* Expiry Date */}
                    <TableCell className="whitespace-nowrap">
                      {customer.policy?.policy_end_date 
                        ? format(new Date(customer.policy.policy_end_date), 'dd/MM/yyyy')
                        : 'N/A'}
                    </TableCell>
                    
                    {/* Voluntary Excess - Inline Editable */}
                    <TableCell className="bg-blue-50/30">
                      <InlineWarrantyUpgrade
                        customerId={customer.id}
                        customerEmail={customer.email}
                        customerName={customer.name}
                        registrationPlate={customer.registration_plate || ''}
                        field="excess"
                        currentValue={customer.voluntary_excess || 100}
                        onUpdate={() => fetchCustomers()}
                      />
                    </TableCell>
                    
                    {/* Claim Limit - Inline Editable */}
                    <TableCell className="bg-green-50/30">
                      <InlineWarrantyUpgrade
                        customerId={customer.id}
                        customerEmail={customer.email}
                        customerName={customer.name}
                        registrationPlate={customer.registration_plate || ''}
                        field="claim_limit"
                        currentValue={customer.policy?.claim_limit || customer.claim_limit || 1250}
                        onUpdate={() => fetchCustomers()}
                      />
                    </TableCell>
                    
                    {/* Labour Rate - Inline Editable */}
                    <TableCell className="bg-purple-50/30">
                      <InlineWarrantyUpgrade
                        customerId={customer.id}
                        customerEmail={customer.email}
                        customerName={customer.name}
                        registrationPlate={customer.registration_plate || ''}
                        field="labour_rate"
                        currentValue={customer.labour_rate || 70}
                        onUpdate={() => fetchCustomers()}
                      />
                    </TableCell>
                    
                    {/* Mileage */}
                    <TableCell className="text-center">
                      {customer.mileage || 'N/A'}
                    </TableCell>
                    
                    {/* Tags */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[120px]">
                        {customer.tags && customer.tags.length > 0 ? (
                          customer.tags.slice(0, 2).map((tag) => (
                            <Badge 
                              key={tag.id} 
                              className="text-xs"
                              style={{ backgroundColor: tag.color, color: 'white' }}
                            >
                              {tag.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                        {customer.tags && customer.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{customer.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Purchase Source */}
                    <TableCell className="bg-purple-50/30">
                      <PurchaseSourceBadge 
                        source={customer.purchase_source} 
                        bumperOrderId={customer.bumper_order_id}
                        stripeSessionId={customer.stripe_session_id}
                      />
                    </TableCell>
                    
                    {/* Customer Email Sent */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getEmailSentStatus(customer.policy?.email_sent_status || null)}
                        {customer.policy?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendWelcomeEmail(customer.policy!.id, customer.id)}
                            disabled={emailSendingLoading[customer.id]?.email}
                            title="Send Welcome Email"
                            className="hover:bg-blue-50 hover:text-blue-600 h-6 w-6 p-0"
                          >
                            {emailSendingLoading[customer.id]?.email ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Warranty Register */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getWarrantyRegisterStatus(customer.policy?.warranties_2000_status || null)}
                        {customer.policy?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendToWarrantiesRegister(customer.policy!.id, customer.id)}
                            disabled={emailSendingLoading[customer.id]?.warranties2000}
                            title="Send to Warranty Register"
                            className="hover:bg-purple-50 hover:text-purple-600 h-6 w-6 p-0"
                          >
                            {emailSendingLoading[customer.id]?.warranties2000 ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Status */}
                    <TableCell>
                      {getStatusBadge(customer.status)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Customer Details Dialog */}
      {editDetailsDialog.customer && (
        <EditCustomerDetailsDialog
          open={editDetailsDialog.open}
          onOpenChange={(open) => setEditDetailsDialog({ open, customer: open ? editDetailsDialog.customer : null })}
          customerId={editDetailsDialog.customer.id}
          currentEmail={editDetailsDialog.customer.email}
          currentPhone={editDetailsDialog.customer.phone}
          currentFirstName={editDetailsDialog.customer.first_name}
          currentLastName={editDetailsDialog.customer.last_name}
          currentName={editDetailsDialog.customer.name}
          onSaved={() => fetchCustomers()}
        />
      )}
    </div>
  );
};

export default SalesCustomerManagement;
