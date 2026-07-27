import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Phone, Mail, Car, AlertTriangle, Clock, CheckCircle, Download, FileSpreadsheet, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDataExport } from '@/hooks/useDataExport';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
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

const MANAGER_EXPORT_ROLES = [
  'super_admin',
  'admin',
  'sales_manager',
  'performance_manager',
  'accounts_manager',
  'accounts',
];

export const RenewalsTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const { userRole, user } = useAuth();
  const { exportToCSV, exportToExcel } = useDataExport();

  const canExportRenewals =
    MANAGER_EXPORT_ROLES.includes(userRole || '') ||
    (user?.email || '').toLowerCase().startsWith('accounts@');

  const [rangeExportOpen, setRangeExportOpen] = useState(false);
  const [rangeExportFrom, setRangeExportFrom] = useState('');
  const [rangeExportTo, setRangeExportTo] = useState('');

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

  const formatRows = (rows: any[]) =>
    rows.map((r) => ({
      'Policy Number': r.policy_number || '',
      'Customer Name': r.customerName || r.customer_full_name || '',
      'Email': r.email || '',
      'Phone': r.phone || '',
      'Registration Plate': r.registration_plate || '',
      'Mileage': r.mileage || '',
      'Plan Type': r.plan_type || '',
      'Payment Type': r.payment_type || '',
      'Claim Limit': r.claim_limit ?? '',
      'Policy Start Date': r.policy_start_date ? format(new Date(r.policy_start_date), 'dd/MM/yyyy') : '',
      'Policy End Date': r.policy_end_date ? format(new Date(r.policy_end_date), 'dd/MM/yyyy') : '',
      'Days Until Expiry': typeof r.daysUntilExpiry === 'number' ? r.daysUntilExpiry : '',
      'Urgency': r.urgency || '',
      'Status': r.status || '',
    }));

  const handleExportVisible = (fmt: 'csv' | 'xlsx') => {
    if (!canExportRenewals) {
      toast.error('You do not have permission to export renewals');
      return;
    }
    const rows = formatRows(renewals || []);
    if (!rows.length) {
      toast.error('No renewals to export');
      return;
    }
    if (fmt === 'csv') exportToCSV(rows, { filename: 'renewals', format: 'csv' });
    else exportToExcel(rows, { filename: 'renewals', format: 'xlsx' });
  };

  // Server-side paginated export by policy expiry window (not capped by the visible list).
  const exportForRange = async (start: Date, end: Date, label: string) => {
    if (!canExportRenewals) {
      toast.error('You do not have permission to export renewals');
      return;
    }
    const toastId = toast.loading(`Preparing renewals export for ${label}...`);
    try {
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('customer_policies')
          .select('id, customer_id, email, customer_full_name, plan_type, payment_type, policy_start_date, policy_end_date, status, policy_number, claim_limit')
          .gte('policy_end_date', start.toISOString())
          .lt('policy_end_date', end.toISOString())
          .order('policy_end_date', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }

      const ids = [...new Set(all.map((p) => p.customer_id).filter(Boolean))];
      const customerMap = new Map<string, CustomerInfo>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: custData } = await supabase
          .from('customers')
          .select('id, phone, registration_plate, mileage, name')
          .in('id', ids.slice(i, i + 200));
        (custData || []).forEach((c: any) => customerMap.set(c.id, c));
      }

      const now = new Date();
      const enriched = all.map((p) => {
        const c = p.customer_id ? customerMap.get(p.customer_id) : null;
        const endDate = new Date(p.policy_end_date);
        const days = differenceInDays(endDate, now);
        return {
          ...p,
          phone: c?.phone || null,
          registration_plate: c?.registration_plate || null,
          mileage: c?.mileage || null,
          customerName: p.customer_full_name || c?.name || null,
          daysUntilExpiry: days,
          urgency: isPast(endDate) ? 'expired' : days <= 30 ? 'critical' : days <= 90 ? 'upcoming' : 'future',
        };
      });

      const rows = formatRows(enriched);
      if (!rows.length) {
        toast.error(`No renewals found for ${label}`, { id: toastId });
        return;
      }
      exportToCSV(rows, { filename: `renewals-${label}`, format: 'csv' });
      toast.success(`Exported ${rows.length} renewal(s) for ${label}`, { id: toastId });
    } catch (err: any) {
      console.error('Renewals exportForRange failed:', err);
      toast.error(`Export failed: ${err?.message || 'unknown error'}`, { id: toastId });
    }
  };

  const quickRangeOptions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const add = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
    const tomorrow = add(startOfToday, 1);
    const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return [
      { label: 'Expired (all)', filenameLabel: 'expired', start: new Date(Date.UTC(2020, 0, 1)), end: startOfToday },
      { label: 'Expiring next 7 days', filenameLabel: 'next-7-days', start: startOfToday, end: add(startOfToday, 7) },
      { label: 'Expiring next 30 days', filenameLabel: 'next-30-days', start: startOfToday, end: add(startOfToday, 30) },
      { label: 'Expiring next 90 days', filenameLabel: 'next-90-days', start: startOfToday, end: add(startOfToday, 90) },
      { label: 'This month', filenameLabel: 'this-month', start: startOfThisMonth, end: startOfNextMonth },
      { label: 'Next month', filenameLabel: 'next-month', start: startOfNextMonth, end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1)) },
      { label: 'This year', filenameLabel: 'this-year', start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), end: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)) },
      { label: 'All time', filenameLabel: 'all-time', start: new Date(Date.UTC(2020, 0, 1)), end: new Date(Date.UTC(now.getUTCFullYear() + 5, 0, 1)) },
    ];
  }, []);

  const monthExportOptions = useMemo(() => {
    const now = new Date();
    const opts: { label: string; filenameLabel: string; start: Date; end: Date }[] = [];
    // 12 months back through 12 months forward, since renewals look both ways.
    for (let i = -12; i <= 12; i++) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i + 1, 1));
      opts.push({
        label: start.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        filenameLabel: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        start,
        end,
      });
    }
    return opts;
  }, []);

  const handleRangeExportSubmit = () => {
    if (!rangeExportFrom || !rangeExportTo) {
      toast.error('Pick a start and end date');
      return;
    }
    const start = new Date(`${rangeExportFrom}T00:00:00Z`);
    const end = new Date(new Date(`${rangeExportTo}T00:00:00Z`).getTime() + 86400000);
    if (end.getTime() <= start.getTime()) {
      toast.error('End date must be on or after start date');
      return;
    }
    exportForRange(start, end, `${rangeExportFrom}_to_${rangeExportTo}`);
    setRangeExportOpen(false);
  };

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

            {canExportRenewals && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <span>Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExportVisible('csv')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export as CSV (visible rows)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportVisible('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as Excel (visible rows)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Quick date export
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                      {quickRangeOptions.map((opt) => (
                        <DropdownMenuItem key={opt.filenameLabel} onClick={() => exportForRange(opt.start, opt.end, opt.filenameLabel)}>
                          {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Export by month
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                      {monthExportOptions.map((opt) => (
                        <DropdownMenuItem key={opt.filenameLabel} onClick={() => exportForRange(opt.start, opt.end, opt.filenameLabel)}>
                          {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setRangeExportOpen(true); }}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Custom date range…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <Dialog open={rangeExportOpen} onOpenChange={setRangeExportOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Export renewals by date range</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Exports every policy whose expiry date falls within the selected range (inclusive).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="renewal-range-from" className="text-xs">From</Label>
                    <Input id="renewal-range-from" type="date" value={rangeExportFrom} onChange={(e) => setRangeExportFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="renewal-range-to" className="text-xs">To</Label>
                    <Input id="renewal-range-to" type="date" value={rangeExportTo} onChange={(e) => setRangeExportTo(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setRangeExportOpen(false)}>Cancel</Button>
                  <Button onClick={handleRangeExportSubmit}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
