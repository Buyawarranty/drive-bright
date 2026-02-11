import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Phone, Mail, Car, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RenewalPolicy {
  id: string;
  customer_id: string | null;
  email: string;
  customer_full_name: string | null;
  plan_type: string;
  payment_type: string;
  policy_start_date: string;
  policy_end_date: string;
  status: string;
  policy_number: string;
  claim_limit: number | null;
}

interface CustomerInfo {
  id: string;
  phone: string | null;
  registration_plate: string | null;
  mileage: string | null;
  name: string;
}

export const RenewalsTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  const { data: renewals, isLoading } = useQuery({
    queryKey: ['renewal-policies', searchTerm, urgencyFilter],
    queryFn: async () => {
      // Get policies that are expiring or recently expired
      let query = supabase
        .from('customer_policies')
        .select('id, customer_id, email, customer_full_name, plan_type, payment_type, policy_start_date, policy_end_date, status, policy_number, claim_limit')
        .in('status', ['active', 'expired'])
        .order('policy_end_date', { ascending: true })
        .limit(500);

      if (searchTerm) {
        query = query.or(`email.ilike.%${searchTerm}%,customer_full_name.ilike.%${searchTerm}%,policy_number.ilike.%${searchTerm}%`);
      }

      const { data: policies, error } = await query;
      if (error) throw error;

      // Get customer details for phone/reg
      const customerIds = [...new Set((policies || []).map(p => p.customer_id).filter(Boolean))];
      let customers: CustomerInfo[] = [];
      if (customerIds.length > 0) {
        const { data: custData } = await supabase
          .from('customers')
          .select('id, phone, registration_plate, mileage, name')
          .in('id', customerIds);
        customers = (custData || []) as CustomerInfo[];
      }

      const customerMap = new Map(customers.map(c => [c.id, c]));
      const now = new Date();

      const enriched = (policies || []).map(p => {
        const endDate = new Date(p.policy_end_date);
        const daysUntilExpiry = differenceInDays(endDate, now);
        const expired = isPast(endDate);
        const customer = p.customer_id ? customerMap.get(p.customer_id) : null;

        let urgency: 'expired' | 'critical' | 'upcoming' | 'future';
        if (expired) urgency = 'expired';
        else if (daysUntilExpiry <= 30) urgency = 'critical';
        else if (daysUntilExpiry <= 90) urgency = 'upcoming';
        else urgency = 'future';

        return {
          ...p,
          daysUntilExpiry,
          expired,
          urgency,
          phone: customer?.phone || null,
          registration_plate: customer?.registration_plate || null,
          mileage: customer?.mileage || null,
          customerName: p.customer_full_name || customer?.name || null,
        };
      });

      // Filter by urgency
      if (urgencyFilter === 'expired') return enriched.filter(e => e.urgency === 'expired');
      if (urgencyFilter === 'critical') return enriched.filter(e => e.urgency === 'critical');
      if (urgencyFilter === 'upcoming') return enriched.filter(e => e.urgency === 'upcoming' || e.urgency === 'critical');
      return enriched;
    }
  });

  const stats = {
    expired: renewals?.filter(r => r.urgency === 'expired').length || 0,
    critical: renewals?.filter(r => r.urgency === 'critical').length || 0,
    upcoming: renewals?.filter(r => r.urgency === 'upcoming').length || 0,
    total: renewals?.length || 0,
  };

  const getUrgencyBadge = (urgency: string, days: number) => {
    switch (urgency) {
      case 'expired':
        return <Badge variant="destructive" className="text-xs">Expired {Math.abs(days)}d ago</Badge>;
      case 'critical':
        return <Badge className="bg-orange-500 text-white text-xs">{days}d left</Badge>;
      case 'upcoming':
        return <Badge variant="secondary" className="text-xs">{days}d left</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{days}d left</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expired - Need Renewal</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expiring in 30 days</p>
                <p className="text-2xl font-bold text-orange-600">{stats.critical}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expiring in 90 days</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.upcoming}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or policy number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Renewals</SelectItem>
                <SelectItem value="expired">Expired Only</SelectItem>
                <SelectItem value="critical">Within 30 Days</SelectItem>
                <SelectItem value="upcoming">Within 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Urgency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading renewals...</TableCell>
                </TableRow>
              ) : renewals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No renewals found</TableCell>
                </TableRow>
              ) : (
                renewals?.map((r) => (
                  <TableRow key={r.id} className={r.urgency === 'expired' ? 'bg-red-50' : r.urgency === 'critical' ? 'bg-orange-50' : ''}>
                    <TableCell>
                      <div className="space-y-1">
                        {r.customerName && <p className="font-medium text-sm">{r.customerName}</p>}
                        {r.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />{r.email}
                          </div>
                        )}
                        {r.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />{r.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.registration_plate && (
                        <div className="flex items-center gap-1">
                          <Car className="h-3 w-3" />
                          <span className="font-mono text-sm">{r.registration_plate}</span>
                        </div>
                      )}
                      {r.mileage && <p className="text-xs text-muted-foreground">{r.mileage} miles</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.plan_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.payment_type}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(r.policy_end_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      {getUrgencyBadge(r.urgency, r.daysUntilExpiry)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
