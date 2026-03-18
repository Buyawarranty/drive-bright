import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Search, CalendarIcon, RefreshCw, Download, Ban } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { usePagination } from '@/hooks/usePagination';
import { usePermissions } from '@/hooks/usePermissions';
import { useDataExport } from '@/hooks/useDataExport';

interface CancellationRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  registration_plate?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  plan_type: string;
  payment_type?: string;
  status: string;
  final_amount?: number;
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  warranty_number?: string;
}

interface AdminUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const CancellationsTab: React.FC<{
  adminUsers: AdminUser[];
  currentAdminUser: AdminUser | null;
}> = ({ adminUsers, currentAdminUser }) => {
  const { canExportTab } = usePermissions();
  const { exportToCSV: exportDataToCSV } = useDataExport();
  const canExport = canExportTab('customers');
  const isFinancialRole = currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'admin';

  const [records, setRecords] = useState<CancellationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterByAgent, setFilterByAgent] = useState('all');
  const [filterByStatus, setFilterByStatus] = useState('all');

  // Default to current month
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  }, []);

  const fetchCancellations = useCallback(async () => {
    try {
      if (!initialLoadDone) setLoading(true);

      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, registration_plate, vehicle_make, vehicle_model, plan_type, payment_type, status, final_amount, created_at, updated_at, assigned_to, warranty_number')
        .eq('is_deleted', false)
        .or('status.ilike.cancelled,status.ilike.refunded')
        .order('updated_at', { ascending: false })
        .limit(3000);

      if (error) throw error;
      setRecords(data || []);
      setInitialLoadDone(true);
    } catch (err) {
      console.error('Error fetching cancellations:', err);
    } finally {
      setLoading(false);
    }
  }, [initialLoadDone]);

  useEffect(() => {
    fetchCancellations();
  }, []);

  const handleMonthSelect = (monthIdx: string) => {
    setSelectedMonth(monthIdx);
    const year = selectedYear ? parseInt(selectedYear) : new Date().getFullYear();
    const monthDate = new Date(year, parseInt(monthIdx), 1);
    setDateRange({ from: startOfMonth(monthDate), to: endOfMonth(monthDate) });
  };

  const handleYearSelect = (year: string) => {
    setSelectedYear(year);
    if (selectedMonth) {
      const monthDate = new Date(parseInt(year), parseInt(selectedMonth), 1);
      setDateRange({ from: startOfMonth(monthDate), to: endOfMonth(monthDate) });
    }
  };

  // Sync month/year selectors from dateRange
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      const from = dateRange.from;
      const to = dateRange.to;
      const ms = startOfMonth(from);
      const me = endOfMonth(from);
      if (
        format(from, 'yyyy-MM-dd') === format(ms, 'yyyy-MM-dd') &&
        format(to, 'yyyy-MM-dd') === format(me, 'yyyy-MM-dd')
      ) {
        setSelectedMonth(String(from.getMonth()));
        setSelectedYear(String(from.getFullYear()));
      } else {
        setSelectedMonth('');
      }
    }
  }, [dateRange]);

  // Filter records
  const filteredRecords = useMemo(() => {
    let filtered = [...records];

    // Date range filter (using updated_at — when the cancellation occurred)
    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => {
        const updatedAt = new Date(r.updated_at);
        return updatedAt >= from && updatedAt <= to;
      });
    }

    if (filterByStatus !== 'all') {
      filtered = filtered.filter(r => r.status?.toLowerCase() === filterByStatus);
    }

    if (filterByAgent !== 'all') {
      if (filterByAgent === 'unassigned') {
        filtered = filtered.filter(r => !r.assigned_to);
      } else {
        filtered = filtered.filter(r => r.assigned_to === filterByAgent);
      }
    }

    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter(r =>
        r.name?.toLowerCase().includes(term) ||
        r.email?.toLowerCase().includes(term) ||
        r.phone?.toLowerCase().includes(term) ||
        r.registration_plate?.toLowerCase().includes(term) ||
        r.warranty_number?.toLowerCase().includes(term) ||
        r.vehicle_make?.toLowerCase().includes(term) ||
        r.vehicle_model?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [records, dateRange, filterByStatus, filterByAgent, debouncedSearch]);

  const pagination = usePagination(filteredRecords, { initialPageSize: 50 });

  const getAgentName = (agentId?: string) => {
    if (!agentId) return 'Unassigned';
    const agent = adminUsers.find(u => u.id === agentId);
    if (!agent) return 'Unknown';
    return [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email;
  };

  const totalCancelled = filteredRecords.filter(r => r.status?.toLowerCase() === 'cancelled').length;
  const totalRefunded = filteredRecords.filter(r => r.status?.toLowerCase() === 'refunded').length;
  const totalValue = isFinancialRole ? filteredRecords.reduce((sum, r) => sum + (r.final_amount || 0), 0) : 0;

  const displayDateLabel = useMemo(() => {
    if (!dateRange?.from) return 'All time';
    if (dateRange.to && format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) {
      return format(dateRange.from, 'MMM d, yyyy');
    }
    if (dateRange.to) return `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d, yyyy')}`;
    return format(dateRange.from, 'MMM d, yyyy');
  }, [dateRange]);

  const handleExport = () => {
    if (!canExport) return;
    const exportData = filteredRecords.map(r => ({
      Name: r.name,
      Email: r.email,
      Phone: r.phone || '',
      'Reg Plate': r.registration_plate || '',
      Vehicle: [r.vehicle_make, r.vehicle_model].filter(Boolean).join(' '),
      Plan: r.plan_type,
      Status: r.status,
      Amount: isFinancialRole ? (r.final_amount || 0) : 'N/A',
      'Cancelled/Refunded Date': format(new Date(r.updated_at), 'dd/MM/yyyy'),
      Agent: getAgentName(r.assigned_to),
    }));
    exportDataToCSV(exportData, { filename: `cancellations-${format(new Date(), 'yyyy-MM-dd')}`, format: 'csv' });
  };

  const agentOptions = useMemo(() => {
    const salesRoles = ['sales', 'sales_lead', 'sales_manager', 'super_admin', 'admin'];
    return adminUsers
      .filter(u => salesRoles.includes(u.role))
      .sort((a, b) => {
        const nameA = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email;
        const nameB = [b.first_name, b.last_name].filter(Boolean).join(' ') || b.email;
        return nameA.localeCompare(nameB);
      });
  }, [adminUsers]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className={cn('grid gap-3', isFinancialRole ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3')}>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{filteredRecords.length}</p>
        </Card>
        <Card className="p-3 border-orange-200">
          <p className="text-xs text-muted-foreground">Cancelled</p>
          <p className="text-2xl font-bold text-destructive">{totalCancelled}</p>
        </Card>
        <Card className="p-3 border-red-200">
          <p className="text-xs text-muted-foreground">Refunded</p>
          <p className="text-2xl font-bold text-destructive">{totalRefunded}</p>
        </Card>
        {isFinancialRole && (
          <Card className="p-3 border-red-200">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold text-destructive">£{totalValue.toFixed(2)}</p>
          </Card>
        )}
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-sm font-medium">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, reg, warranty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Status</Label>
            <Select value={filterByStatus} onValueChange={setFilterByStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (Cancelled & Refunded)</SelectItem>
                <SelectItem value="cancelled">Cancelled Only</SelectItem>
                <SelectItem value="refunded">Refunded Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Sales Agent</Label>
            <Select value={filterByAgent} onValueChange={setFilterByAgent}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {agentOptions.map(agent => {
                  const name = [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email;
                  return <SelectItem key={agent.id} value={agent.id}>{name}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">&nbsp;</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchCancellations} className="h-10">
                <RefreshCw className="h-4 w-4" />
              </Button>
              {canExport && (
                <Button variant="outline" size="sm" onClick={handleExport} className="h-10">
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Date selectors row */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">By Month</Label>
            <Select value={selectedMonth} onValueChange={handleMonthSelect}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Select month" /></SelectTrigger>
              <SelectContent>
                {monthNames.map((month, i) => (
                  <SelectItem key={i} value={String(i)}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Year</Label>
            <Select value={selectedYear} onValueChange={handleYearSelect}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Custom Date Range</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 min-w-[200px] justify-start font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span className="text-sm truncate">{displayDateLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 z-50" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from || subMonths(new Date(), 1)}
                  selected={dateRange}
                  onSelect={(range) => setDateRange(range)}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => {
              const now = new Date();
              setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
              setFilterByAgent('all');
              setFilterByStatus('all');
              setSearchTerm('');
            }}
          >
            Reset to This Month
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            Showing {pagination.startIndex + 1}–{pagination.endIndex} of {filteredRecords.length} records · {displayDateLabel}
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Customer</TableHead>
                  <TableHead>Reg Plate</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  {isFinancialRole && <TableHead>Amount</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead>Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isFinancialRole ? 8 : 7} className="text-center py-8 text-muted-foreground">
                      <Ban className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No cancellations found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.paginatedData.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{record.name}</p>
                          <p className="text-xs text-muted-foreground">{record.email}</p>
                          {record.phone && <p className="text-xs text-muted-foreground">{record.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.registration_plate ? (
                          <div className="inline-flex items-center border-2 border-foreground rounded-sm overflow-hidden font-mono text-xs font-bold shadow-sm">
                            <div className="bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-normal">GB</div>
                            <div className="bg-accent text-accent-foreground px-2 py-0.5 tracking-wider">{record.registration_plate.toUpperCase()}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {[record.vehicle_make, record.vehicle_model].filter(Boolean).join(' ') || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{record.plan_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs">
                          {record.status}
                        </Badge>
                      </TableCell>
                      {isFinancialRole && (
                        <TableCell className="text-sm font-medium">
                          £{(record.final_amount || 0).toFixed(2)}
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(record.updated_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getAgentName(record.assigned_to)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            onPageChange={pagination.goToPage}
            onPageSizeChange={pagination.setPageSize}
            canGoNext={pagination.canGoNext}
            canGoPrev={pagination.canGoPrev}
          />
        </>
      )}
    </div>
  );
};
