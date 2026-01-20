import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clock, Send, RefreshCw, AlertCircle, CheckCircle, Calendar, Car, User } from "lucide-react";
import { format, parseISO, isToday, isPast } from "date-fns";

interface ScheduledPolicy {
  id: string;
  customer_id: string;
  email: string;
  warranty_number: string;
  plan_type: string;
  policy_start_date: string;
  warranties_2000_status: string;
  warranties_2000_scheduled_for: string;
  customer_full_name: string;
  customers?: {
    name: string;
    registration_plate: string;
    vehicle_make: string;
    vehicle_model: string;
  };
}

export const PendingW2000Tab = () => {
  const [scheduledPolicies, setScheduledPolicies] = useState<ScheduledPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchScheduledPolicies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_policies')
        .select(`
          id,
          customer_id,
          email,
          warranty_number,
          plan_type,
          policy_start_date,
          warranties_2000_status,
          warranties_2000_scheduled_for,
          customer_full_name,
          customers (
            name,
            registration_plate,
            vehicle_make,
            vehicle_model
          )
        `)
        .in('warranties_2000_status', ['scheduled', 'processing', 'failed'])
        .order('warranties_2000_scheduled_for', { ascending: true });

      if (error) throw error;
      setScheduledPolicies(data || []);
    } catch (error) {
      console.error('Error fetching scheduled policies:', error);
      toast.error('Failed to load scheduled policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduledPolicies();
  }, []);

  const handleProcessAll = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-scheduled-w2000');
      
      if (error) throw error;
      
      toast.success(`Processed ${data.processedCount} policies (${data.failedCount} failed)`);
      fetchScheduledPolicies();
    } catch (error) {
      console.error('Error processing scheduled policies:', error);
      toast.error('Failed to process scheduled policies');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendNow = async (policyId: string, customerId: string) => {
    setSendingId(policyId);
    try {
      const { data, error } = await supabase.functions.invoke('send-to-warranties-2000', {
        body: { policyId, customerId, force: true }
      });
      
      if (error) throw error;
      
      toast.success('Successfully sent to Warranties Register');
      fetchScheduledPolicies();
    } catch (error) {
      console.error('Error sending to Register:', error);
      toast.error('Failed to send to Warranties Register');
    } finally {
      setSendingId(null);
    }
  };

  const getStatusBadge = (status: string, scheduledDate: string) => {
    const date = parseISO(scheduledDate);
    const isDue = isPast(date) || isToday(date);
    
    switch (status) {
      case 'scheduled':
        return isDue ? (
          <Badge className="bg-amber-500 text-white">
            <Clock className="w-3 h-3 mr-1" />
            Due Today
          </Badge>
        ) : (
          <Badge variant="outline" className="border-blue-500 text-blue-500">
            <Calendar className="w-3 h-3 mr-1" />
            Scheduled
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-blue-500 text-white animate-pulse">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Sent
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const scheduledCount = scheduledPolicies.filter(p => p.warranties_2000_status === 'scheduled').length;
  const dueCount = scheduledPolicies.filter(p => {
    const date = parseISO(p.warranties_2000_scheduled_for);
    return p.warranties_2000_status === 'scheduled' && (isPast(date) || isToday(date));
  }).length;
  const failedCount = scheduledPolicies.filter(p => p.warranties_2000_status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pending</p>
                <p className="text-2xl font-bold">{scheduledPolicies.length}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due Today</p>
                <p className="text-2xl font-bold text-amber-500">{dueCount}</p>
              </div>
              <Calendar className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold text-blue-500">{scheduledCount}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-500">{failedCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Pending W2000 Submissions
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={fetchScheduledPolicies}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {dueCount > 0 && (
              <Button 
                onClick={handleProcessAll}
                disabled={processing}
                className="bg-green-600 hover:bg-green-700"
              >
                {processing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Process All Due ({dueCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : scheduledPolicies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending W2000 submissions
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warranty #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledPolicies.map((policy) => {
                  const customer = policy.customers;
                  const scheduledDate = parseISO(policy.warranties_2000_scheduled_for);
                  const isDue = isPast(scheduledDate) || isToday(scheduledDate);
                  
                  return (
                    <TableRow key={policy.id} className={isDue && policy.warranties_2000_status === 'scheduled' ? 'bg-amber-50' : ''}>
                      <TableCell className="font-mono text-sm">
                        {policy.warranty_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{policy.customer_full_name || customer?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{policy.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{customer?.registration_plate || '-'}</p>
                            <p className="text-xs text-muted-foreground">
                              {customer?.vehicle_make} {customer?.vehicle_model}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(policy.policy_start_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(scheduledDate, 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(policy.warranties_2000_status, policy.warranties_2000_scheduled_for)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={isDue ? "default" : "outline"}
                          onClick={() => handleSendNow(policy.id, policy.customer_id)}
                          disabled={sendingId === policy.id || policy.warranties_2000_status === 'processing'}
                        >
                          {sendingId === policy.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          <span className="ml-1">Send Now</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
