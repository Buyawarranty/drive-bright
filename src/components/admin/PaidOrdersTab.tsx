import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Eye, RefreshCw, CreditCard, Users, Accessibility, Flag, KeyRound, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { PaidOrderEditDialog } from './PaidOrderEditDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import CustomerLoginDebugTool from './CustomerLoginDebugTool';

interface PaidOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  vehicle_reg: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_mileage: string;
  claim_limit: number;
  labour_rate: number;
  excess_amount: number;
  boost_addon: boolean;
  monthly_price: number;
  upfront_price: number;
  breakdown_included: boolean;
  rental_included: boolean;
  additional_notes: string;
  paid_at: string;
  payment_method: string;
  payment_source: string;
  policy_number: string;
  status: string;
  duration_months: number;
  bonus_months: number;
  // Agent tracking
  created_by: string;
  created_by_name: string;
  payment_confirmed_by: string;
  payment_confirmed_by_name?: string;
  // Related customer/policy data
  customer_id?: string;
  policy_id?: string;
  customer_status?: string;
  policy_status?: string;
  customer_address?: {
    street?: string;
    town?: string;
    county?: string;
    postcode?: string;
    building_number?: string;
  };
}

interface PaidOrdersTabProps {
  onRefresh?: () => void;
}

// Collapsible Customer Login Debug Section
const CustomerLoginDebugSection = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-6 pt-6 border-t">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              <span>Customer Login Debug Tool</span>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <CustomerLoginDebugTool />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export const PaidOrdersTab: React.FC<PaidOrdersTabProps> = ({ onRefresh }) => {
  const [paidOrders, setPaidOrders] = useState<PaidOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PaidOrder | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [allAdminUsers, setAllAdminUsers] = useState<Array<{ id: string; user_id: string; name: string }>>([]);

  const fetchPaidOrders = async () => {
    setIsLoading(true);
    try {
      // Fetch all sales agents/admin users for the dropdown
      const { data: allAdmins } = await supabase
        .from('admin_users')
        .select('id, user_id, first_name, last_name, email, role')
        .eq('is_active', true);
      
      if (allAdmins) {
        setAllAdminUsers(allAdmins.map(admin => ({
          id: admin.id,           // admin_users.id - for FK references
          user_id: admin.user_id || '',  // auth.users.id
          name: [admin.first_name, admin.last_name].filter(Boolean).join(' ') || admin.email?.split('@')[0] || 'Unknown'
        })).filter(a => a.id));
      }

      // Fetch paid quotes from live_quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from('live_quotes')
        .select('*')
        .in('status', ['paid', 'paid_externally'])
        .order('paid_at', { ascending: false });

      if (quotesError) throw quotesError;

      // Collect unique admin user IDs for batch lookup
      const adminUserIds = new Set<string>();
      (quotesData || []).forEach(quote => {
        if (quote.created_by) adminUserIds.add(quote.created_by);
        if (quote.payment_confirmed_by) adminUserIds.add(quote.payment_confirmed_by);
      });

      // Fetch admin user names in batch
      let adminUsersMap: Record<string, string> = {};
      if (adminUserIds.size > 0) {
        const { data: adminUsers } = await supabase
          .from('admin_users')
          .select('user_id, first_name, last_name, email')
          .in('user_id', Array.from(adminUserIds));
        
        if (adminUsers) {
          adminUsers.forEach(admin => {
            const name = [admin.first_name, admin.last_name].filter(Boolean).join(' ') || admin.email?.split('@')[0] || 'Unknown';
            adminUsersMap[admin.user_id] = name;
          });
        }
      }

      // For each paid quote, try to fetch associated customer and policy data
      const ordersWithDetails = await Promise.all(
        (quotesData || []).map(async (quote) => {
          let customerData = null;
          let policyData = null;

          // Try to find customer by email
          if (quote.customer_email) {
            const { data: customer } = await supabase
              .from('customers')
              .select('id, status, street, town, county, postcode, building_number, phone')
              .ilike('email', quote.customer_email)
              .maybeSingle();
            customerData = customer;
          }

          // Try to find policy by policy_number
          if (quote.policy_number) {
            const { data: policy } = await supabase
              .from('customer_policies')
              .select('id, status, email')
              .eq('policy_number', quote.policy_number)
              .maybeSingle();
            policyData = policy;
          }

          return {
            ...quote,
            customer_id: customerData?.id,
            customer_status: customerData?.status,
            policy_id: policyData?.id,
            policy_status: policyData?.status,
            customer_address: customerData ? {
              street: customerData.street,
              town: customerData.town,
              county: customerData.county,
              postcode: customerData.postcode,
              building_number: customerData.building_number,
            } : undefined,
            customer_phone: quote.customer_phone || customerData?.phone || '',
            // Add agent names
            payment_confirmed_by_name: quote.payment_confirmed_by ? adminUsersMap[quote.payment_confirmed_by] : undefined,
          };
        })
      );

      setPaidOrders(ordersWithDetails);
    } catch (error) {
      console.error('Error fetching paid orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaidOrders();
  }, []);

  const handleRefresh = () => {
    fetchPaidOrders();
    onRefresh?.();
  };

  const handleEditComplete = () => {
    setIsEditDialogOpen(false);
    setSelectedOrder(null);
    fetchPaidOrders();
  };

  const filteredOrders = useMemo(() => {
    let orders = paidOrders;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      orders = orders.filter(order => 
        order.customer_name?.toLowerCase().includes(term) ||
        order.customer_email?.toLowerCase().includes(term) ||
        order.vehicle_reg?.toLowerCase().includes(term) ||
        order.policy_number?.toLowerCase().includes(term)
      );
    }
    
    // Sort: unprocessed orders (no policy_number) first
    return orders.sort((a, b) => {
      const aNeeds = !a.policy_number ? 0 : 1;
      const bNeeds = !b.policy_number ? 0 : 1;
      if (aNeeds !== bNeeds) return aNeeds - bNeeds;
      // Within same group, sort by date descending
      return new Date(b.paid_at || 0).getTime() - new Date(a.paid_at || 0).getTime();
    });
  }, [paidOrders, searchTerm]);

  const getPaymentMethodBadge = (order: PaidOrder) => {
    const method = order.payment_method || order.payment_source || 'Unknown';
    if (method.toLowerCase().includes('stripe')) {
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Stripe</Badge>;
    }
    if (method.toLowerCase().includes('bumper')) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Bumper</Badge>;
    }
    return <Badge variant="outline">{method}</Badge>;
  };

  const getStatusBadge = (order: PaidOrder) => {
    // If paid but no policy created yet — needs processing
    if (!order.policy_number && !order.policy_id) {
      return <Badge className="bg-amber-500 text-white animate-pulse">⚠️ Needs Processing</Badge>;
    }
    
    const status = order.policy_status || order.customer_status || order.status || 'active';
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'pending':
      case 'awaiting_docs':
        return <Badge className="bg-yellow-500">Awaiting Docs</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500">Scheduled</Badge>;
      case 'paid':
      case 'paid_externally':
        return <Badge className="bg-green-500">Paid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatAddons = (order: PaidOrder) => {
    const addons = [];
    if (order.boost_addon) addons.push('Boost');
    if (order.breakdown_included) addons.push('Breakdown');
    if (order.rental_included) addons.push('Rental');
    return addons.length > 0 ? addons.join(', ') : 'None';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Paid Orders
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Accessibility className="h-4 w-4" />
              View and edit orders for customers needing assistance
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, reg, or order ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No orders match your search' : 'No paid orders from quote links yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Customer</TableHead>
                  <TableHead className="min-w-[100px]">Vehicle</TableHead>
                  <TableHead className="hidden md:table-cell">Warranty</TableHead>
                  <TableHead className="hidden lg:table-cell">Add-ons</TableHead>
                  <TableHead className="min-w-[80px]">Total</TableHead>
                  <TableHead className="hidden sm:table-cell">Payment</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className={!order.policy_number ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}>
                    <TableCell>
                      <div className="text-sm font-medium">{order.customer_name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">{order.customer_email}</div>
                      {order.customer_phone && (
                        <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
                      )}
                      {!order.policy_number && (
                        <Badge variant="outline" className="mt-1 text-[10px] bg-amber-100 text-amber-800 border-amber-300 animate-pulse">
                          Action Required
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{order.vehicle_reg}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.vehicle_make} {order.vehicle_model}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">£{order.claim_limit} limit</div>
                      <div className="text-xs text-muted-foreground">
                        £{order.labour_rate}/hr • £{order.excess_amount} excess
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-xs">{formatAddons(order)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">£{order.upfront_price || (order.monthly_price * 12)}</div>
                      <div className="text-xs text-muted-foreground">
                        £{order.monthly_price}/mo
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {getPaymentMethodBadge(order)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {order.paid_at && (
                        <div className="text-sm">{format(new Date(order.paid_at), 'dd/MM/yy')}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {(order.payment_confirmed_by_name || order.created_by_name) ? (
                        <div>
                          <div className="text-sm font-medium">{order.payment_confirmed_by_name || order.created_by_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.payment_confirmed_by_name ? 'Confirmed' : 'Created'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order)}
                    </TableCell>
                    <TableCell className="text-right">
                      {!order.policy_number ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsEditDialogOpen(true);
                          }}
                          className="gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <AlertCircle className="h-3 w-3" />
                          <span className="hidden sm:inline">Review & Confirm</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsEditDialogOpen(true);
                          }}
                          className="gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          <span className="hidden sm:inline">View & Edit</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Stats summary */}
        {!isLoading && paidOrders.length > 0 && (
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Total: {paidOrders.length} orders</span>
            <span>•</span>
            <span>Stripe: {paidOrders.filter(o => (o.payment_method || o.payment_source || '').toLowerCase().includes('stripe')).length}</span>
            <span>•</span>
            <span>Bumper: {paidOrders.filter(o => (o.payment_method || o.payment_source || '').toLowerCase().includes('bumper')).length}</span>
          </div>
        )}

        {/* Customer Login Debug Tool */}
        <CustomerLoginDebugSection />
      </CardContent>

      {/* Edit Dialog */}
      <PaidOrderEditDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onSave={handleEditComplete}
        adminUsers={allAdminUsers}
      />
    </Card>
  );
};
