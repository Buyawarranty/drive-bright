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
import { Search, CalendarIcon, RefreshCw, Download, Banknote, Pencil, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { usePagination } from '@/hooks/usePagination';
import { usePermissions } from '@/hooks/usePermissions';
import { useDataExport } from '@/hooks/useDataExport';
import { useAuth } from '@/hooks/useAuth';

const FULL_VIEW_ROLES = new Set(['super_admin', 'admin', 'sales_lead', 'accounts', 'accounts_manager', 'accounts_payroll']);

// Test purchase threshold – anything below this is treated as a test/dev transaction
const TEST_PURCHASE_THRESHOLD = 20;

type QuickRange = 'today' | 'yesterday' | 'this_month' | 'last_month' | 'last_7' | 'last_30' | 'all' | 'custom';

const computeQuickRange = (key: QuickRange): DateRange | undefined => {
  const now = new Date();
  switch (key) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case 'this_month': return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month': { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
    case 'last_7': return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'last_30': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'all': return undefined;
    default: return undefined;
  }
};

interface RefundRecord {
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
  cancellation_note?: string | null;
  cancellation_note_updated_at?: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  user_id?: string;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const RefundsPaidTab: React.FC<{
  adminUsers?: AdminUser[];
  currentAdminUser?: AdminUser | null;
}> = ({ adminUsers: adminUsersProp, currentAdminUser: currentAdminUserProp }) => {
  const { canExportTab } = usePermissions();
  const { exportToCSV: exportDataToCSV } = useDataExport();
  const { user, userRole } = useAuth();
  const canExport = canExportTab('customers');

  const [loadedAdminUsers, setLoadedAdminUsers] = useState<AdminUser[]>([]);
  const adminUsers = adminUsersProp ?? loadedAdminUsers;
  const currentAdminUser = useMemo(() => {
    if (currentAdminUserProp !== undefined && currentAdminUserProp !== null) return currentAdminUserProp;
    if (!user?.id) return null;
    return (adminUsers as any[]).find((u: any) => u.user_id === user.id) || null;
  }, [currentAdminUserProp, user?.id, adminUsers]);

  const isFinancialRole = userRole === 'super_admin' || userRole === 'admin'
    || currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'admin';
  const canSeeAll = !!userRole && FULL_VIEW_ROLES.has(userRole);

  const [records, setRecords] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const startEditNote = (record: RefundRecord) => {
    setEditingNoteId(record.id);
    setEditingNoteText(record.cancellation_note || '');
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const saveNote = async (recordId: string) => {
    setSavingNoteId(recordId);
    try {
      const trimmed = editingNoteText.trim();
      const nowIso = new Date().toISOString();
      const { data: authData } = await supabase.auth.getUser();
      const updaterId = authData?.user?.id ?? null;

      const { error } = await supabase
        .from('customers')
        .update({
          cancellation_note: trimmed || null,
          cancellation_note_updated_at: nowIso,
          cancellation_note_updated_by: updaterId,
        })
        .eq('id', recordId);

      if (error) throw error;

      setRecords(prev => prev.map(r =>
        r.id === recordId
          ? { ...r, cancellation_note: trimmed || null, cancellation_note_updated_at: nowIso }
          : r
      ));
      toast.success('Note saved');
      cancelEditNote();
    } catch (err) {
      console.error('Error saving note:', err);
      toast.error('Failed to save note');
    } finally {
      setSavingNoteId(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterByAgent, setFilterByAgent] = useState('all');
  const [quickRange, setQuickRange] = useState<QuickRange>('this_month');

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (adminUsersProp) return;
    supabase.from('admin_users')
      .select('id, user_id, email, first_name, last_name, role')
      .eq('is_active', true)
      .then(({ data }) => setLoadedAdminUsers((data || []) as any));
  }, [adminUsersProp]);

  const handleQuickRange = (key: QuickRange) => {
    setQuickRange(key);
    setDateRange(computeQuickRange(key));
  };

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  }, []);

  const fetchRefunds = useCallback(async () => {
    try {
      if (!initialLoadDone) setLoading(true);

      // Only fetch refunded customers (status = 'refunded' / 'Refunded')
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, registration_plate, vehicle_make, vehicle_model, plan_type, payment_type, status, final_amount, created_at, updated_at, assigned_to, warranty_number, cancellation_note, cancellation_note_updated_at')
        .ilike('status', 'refunded')
        .order('updated_at', { ascending: false })
        .limit(3000);

      if (error) throw error;
      setRecords(data || []);
      setInitialLoadDone(true);
    } catch (err) {
      console.error('Error fetching refunds:', err);
    } finally {
      setLoading(false);
    }
  }, [initialLoadDone]);

  useEffect(() => {
    fetchRefunds();
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

  const filteredRecords = useMemo(() => {
    let filtered = [...records];

    // Exclude test purchases (< £20) – these are admin/dev test transactions, not real refunds
    filtered = filtered.filter(r => (r.final_amount || 0) >= TEST_PURCHASE_THRESHOLD);

    // Role-based visibility: non-full-view users only see their own
    if (!canSeeAll) {
      const myId = currentAdminUser?.id;
      filtered = myId ? filtered.filter(r => r.assigned_to === myId) : [];
    }

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
        r.vehicle_model?.toLowerCase().includes(term) ||
        r.cancellation_note?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [records, dateRange, filterByAgent, debouncedSearch, canSeeAll, currentAdminUser?.id]);

  const pagination = usePagination(filteredRecords, { initialPageSize: 50 });

  const getAgentName = (agentId?: string) => {
    if (!agentId) return 'Unassigned';
    const agent = adminUsers.find(u => u.id === agentId);
    if (!agent) return 'Unknown';
    return [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email;
  };

  const totalRefunded = filteredRecords.length;
  const totalValue = isFinancialRole ? filteredRecords.reduce((sum, r) => sum + (r.final_amount || 0), 0) : 0;
  const excludedTestCount = useMemo(
    () => records.filter(r => (r.final_amount || 0) < TEST_PURCHASE_THRESHOLD).length,
    [records]
  );

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
      'Refund Amount': isFinancialRole ? (r.final_amount || 0) : 'N/A',
      'Refund Date': format(new Date(r.updated_at), 'dd/MM/yyyy'),
      'Purchase Date': format(new Date(r.created_at), 'dd/MM/yyyy'),
      Agent: getAgentName(r.assigned_to),
      Note: r.cancellation_note || '',
    }));
    exportDataToCSV(exportData, { filename: `refunds-paid-${format(new Date(), 'yyyy-MM-dd')}`, format: 'csv' });
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
      <div>
        <h1 className="text-2xl font-bold">Refunds Paid</h1>
        <p className="text-muted-foreground text-sm">
          {canSeeAll
            ? 'All refunds issued to customers — used for commission reconciliation'
            : 'Your refunded customers'}
          {' · '}
          <span className="text-xs">Test purchases under £{TEST_PURCHASE_THRESHOLD} are excluded automatically</span>
          {excludedTestCount > 0 && (
            <span className="text-xs"> ({excludedTestCount} test record{excludedTestCount === 1 ? '' : 's'} hidden)</span>
          )}
        </p>
      </div>

      {/* Quick Date Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'today', label: 'Today' },
          { key: 'yesterday', label: 'Yesterday' },
          { key: 'this_month', label: 'This Month' },
          { key: 'last_month', label: 'Last Month' },
          { key: 'last_7', label: 'Last 7 Days' },
          { key: 'last_30', label: 'Last 30 Days' },
          { key: 'all', label: 'All Time' },
        ] as { key: QuickRange; label: string }[]).map(t => (
          <Button
            key={t.key}
            size="sm"
            variant={quickRange === t.key ? 'default' : 'outline'}
            onClick={() => handleQuickRange(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className={cn('grid gap-3', isFinancialRole ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2')}>
        <Card className="p-3 border-red-200">
          <p className="text-xs text-muted-foreground">Total Refunds</p>
          <p className="text-2xl font-bold text-destructive">{totalRefunded}</p>
        </Card>
        {isFinancialRole && (
          <Card className="p-3 border-red-200">
            <p className="text-xs text-muted-foreground">Total Refunded Value</p>
            <p className="text-2xl font-bold text-destructive">£{totalValue.toFixed(2)}</p>
          </Card>
        )}
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Period</p>
          <p className="text-sm font-medium">{displayDateLabel}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {canSeeAll && (
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
          )}

          <div className="space-y-1">
            <Label className="text-sm font-medium">&nbsp;</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchRefunds} className="h-10">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.startIndex + 1}–{pagination.endIndex} of {filteredRecords.length} refunds · {displayDateLabel}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium">Colour key:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded border bg-yellow-50" />
                Within 30 days
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded border bg-pink-50" />
                Within 60 days
              </span>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Customer</TableHead>
                  <TableHead>Reg Plate</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Plan</TableHead>
                  {isFinancialRole && <TableHead>Refund Amount</TableHead>}
                  <TableHead>Refund Date</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead className="min-w-[260px]">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isFinancialRole ? 8 : 7} className="text-center py-8 text-muted-foreground">
                      <Banknote className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No refunds found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.paginatedData.map(record => {
                    const daysHeld = Math.floor(
                      (new Date(record.updated_at).getTime() - new Date(record.created_at).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    const rowHighlight =
                      daysHeld <= 30
                        ? 'bg-yellow-50 hover:bg-yellow-100'
                        : daysHeld <= 60
                          ? 'bg-pink-50 hover:bg-pink-100'
                          : '';
                    return (
                      <TableRow key={record.id} className={rowHighlight}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{record.name}</p>
                            <p className="text-xs text-muted-foreground">{record.email}</p>
                            {record.phone && <p className="text-xs text-muted-foreground">{record.phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.registration_plate ? (
                            <span className="inline-flex items-center bg-yellow-400 text-black font-bold px-2 py-0.5 rounded text-sm font-mono tracking-wider border border-yellow-500">
                              {record.registration_plate.toUpperCase()}
                            </span>
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
                        {isFinancialRole && (
                          <TableCell className="text-sm font-medium text-destructive">
                            £{(record.final_amount || 0).toFixed(2)}
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-muted-foreground">
                          <div>{format(new Date(record.updated_at), 'dd MMM yyyy')}</div>
                          <div className="text-xs">{daysHeld} day{daysHeld === 1 ? '' : 's'} after purchase</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {getAgentName(record.assigned_to)}
                        </TableCell>
                        <TableCell className="text-sm align-top">
                          {editingNoteId === record.id ? (
                            <div className="space-y-1">
                              <Textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                rows={2}
                                className="text-sm min-w-[240px]"
                                placeholder="Add refund note…"
                                autoFocus
                              />
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 px-2"
                                  onClick={() => saveNote(record.id)}
                                  disabled={savingNoteId === record.id}
                                >
                                  <Check className="h-3 w-3 mr-1" /> Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={cancelEditNote}
                                  disabled={savingNoteId === record.id}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditNote(record)}
                              className="group flex items-start gap-2 text-left w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                            >
                              <span className={cn('flex-1 whitespace-pre-wrap', !record.cancellation_note && 'italic text-muted-foreground')}>
                                {record.cancellation_note || 'Add note…'}
                              </span>
                              <Pencil className="h-3 w-3 mt-1 opacity-0 group-hover:opacity-60 shrink-0" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
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

export default RefundsPaidTab;
