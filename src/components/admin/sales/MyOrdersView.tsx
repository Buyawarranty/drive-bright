import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { OrderCommunicationTimeline } from './OrderCommunicationTimeline';
import { SendToAlternateEmailDialog } from '../SendToAlternateEmailDialog';
import { 
  Search, ChevronDown, ChevronUp, Phone, Mail, 
  FileText, RotateCcw, Upload, MessageSquare,
  CheckCircle, Clock, AlertCircle, DollarSign, Forward
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Order {
  id: string;
  policy_number: string;
  customer_full_name: string | null;
  email: string;
  plan_type: string;
  payment_amount: number | null;
  payment_type: string;
  payment_verified: boolean | null;
  status: string;
  created_at: string;
  policy_start_date: string;
  policy_end_date: string;
  email_sent_status: string | null;
  email_sent_at: string | null;
  warranties_2000_status: string | null;
  warranties_2000_sent_at: string | null;
  is_manual_entry: boolean | null;
  customer_id: string | null;
}

interface MyOrdersViewProps {
  currentUserId: string;
}

export const MyOrdersView: React.FC<MyOrdersViewProps> = ({ currentUserId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [alternateEmailDialog, setAlternateEmailDialog] = useState<{
    open: boolean;
    order: Order | null;
  }>({ open: false, order: null });

  useEffect(() => {
    fetchMyOrders();
  }, [currentUserId]);

  const fetchMyOrders = async () => {
    try {
      setLoading(true);
      
      // Get customers assigned to this user
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id')
        .eq('assigned_to', currentUserId);

      if (customersError) throw customersError;

      if (!customers || customers.length === 0) {
        setOrders([]);
        return;
      }

      const customerIds = customers.map(c => c.id);

      // Get policies for those customers
      const { data: policies, error: policiesError } = await supabase
        .from('customer_policies')
        .select('*')
        .in('customer_id', customerIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (policiesError) throw policiesError;

      setOrders(policies || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(order => 
      order.policy_number.toLowerCase().includes(term) ||
      order.customer_full_name?.toLowerCase().includes(term) ||
      order.email.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const getStatusBadge = (order: Order) => {
    if (order.status === 'cancelled') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (order.payment_verified) {
      return <Badge className="bg-green-500">Paid</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const getRegistrationStatus = (order: Order) => {
    switch (order.warranties_2000_status) {
      case 'sent':
        return { label: 'Registered', variant: 'default' as const, icon: CheckCircle };
      case 'scheduled':
        return { label: 'Scheduled', variant: 'secondary' as const, icon: Clock };
      case 'pending':
        return { label: 'Pending', variant: 'outline' as const, icon: Clock };
      case 'failed':
        return { label: 'Failed', variant: 'destructive' as const, icon: AlertCircle };
      default:
        return { label: 'Not Sent', variant: 'outline' as const, icon: AlertCircle };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search orders by name, email, or policy number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No orders found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Orders from your converted leads will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const regStatus = getRegistrationStatus(order);
            const RegIcon = regStatus.icon;
            
            return (
              <Collapsible
                key={order.id}
                open={expandedOrder === order.id}
                onOpenChange={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <CardTitle className="text-base">
                              {order.customer_full_name || order.email}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <span>{order.policy_number}</span>
                              <span>•</span>
                              <span>{order.plan_type}</span>
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(order)}
                          <Badge variant={regStatus.variant} className="gap-1">
                            <RegIcon className="h-3 w-3" />
                            {regStatus.label}
                          </Badge>
                          {expandedOrder === order.id ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {/* Order Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground">Order Date</p>
                          <p className="font-medium">{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="font-medium">£{order.payment_amount?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Payment Type</p>
                          <p className="font-medium capitalize">{order.payment_type}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Source</p>
                          <p className="font-medium">{order.is_manual_entry ? 'Manual' : 'Online'}</p>
                        </div>
                      </div>

                      {/* Communication Timeline */}
                      <OrderCommunicationTimeline order={order} />

                      {/* Action Buttons - Only for assigned orders */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button size="sm" variant="outline" className="gap-2">
                          <Mail className="h-4 w-4" />
                          Resend Invoice
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlternateEmailDialog({ open: true, order });
                          }}
                        >
                          <Forward className="h-4 w-4" />
                          Send to Different Email
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2">
                          <RotateCcw className="h-4 w-4" />
                          Resend Payment Link
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Phone className="h-4 w-4" />
                          Call Customer
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Add Note
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Upload className="h-4 w-4" />
                          Upload Document
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Send to Alternate Email Dialog */}
      {alternateEmailDialog.order && (
        <SendToAlternateEmailDialog
          open={alternateEmailDialog.open}
          onOpenChange={(open) => setAlternateEmailDialog({ open, order: open ? alternateEmailDialog.order : null })}
          policyId={alternateEmailDialog.order.id}
          customerId={alternateEmailDialog.order.customer_id || ''}
          customerEmail={alternateEmailDialog.order.email}
          customerName={alternateEmailDialog.order.customer_full_name || ''}
          policyNumber={alternateEmailDialog.order.policy_number}
          onEmailSent={fetchMyOrders}
        />
      )}
    </div>
  );
};
