import React, { useState, useEffect, useMemo } from 'react';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { AdminNotification } from '@/hooks/useAdminNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileDown, Plus, Download, Calendar as CalendarIcon, Bell, BarChart3 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { toast as sonnerToast } from 'sonner';
import { useToast } from '@/hooks/use-toast';
import { AddClaimDialog } from './claims/AddClaimDialog';
import { exportToCSV, exportToPDF, formatClaimForExport } from './claims/exportUtils';
import { ClaimUpdateNotifications } from './claims/ClaimUpdateNotifications';
import { ClaimRemindersBanner } from './claims/ClaimRemindersBanner';
import { ClaimRemindersPanel } from './claims/ClaimRemindersPanel';
import { useClaims } from '@/hooks/useClaims';
import { UrgencyBanner } from './claims-manager/UrgencyBanner';
import { ClaimsWorkbench, KpiStrip } from './claims-manager/ClaimsManagerDashboard';
import { PerformanceKpiStrip } from './claims-manager/PerformanceKpiStrip';
import { VehicleIntelligenceExplorer } from './claims/VehicleIntelligenceExplorer';
import { ClaimsAnalyticsPanel } from './claims/ClaimsAnalyticsPanel';
import { ClaimsAgeMileageAnalytics } from './claims/ClaimsAgeMileageAnalytics';

interface ClaimSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  vehicle_registration?: string;
  payment_amount?: number;
  approved_at?: string;
  rejected_at?: string;
  paid_at?: string;
}

interface ClaimsTabProps {
  notifications?: AdminNotification[];
  unreadCount?: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNavigateToTab?: (tab: string) => void;
  userRole?: string | null;
}

const MANAGER_EXPORT_ROLES = [
  'super_admin',
  'admin',
  'claims_manager',
  'sales_manager',
  'performance_manager',
  'accounts_manager',
  'accounts',
];

export const ClaimsTab = ({
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
  userRole,
}: ClaimsTabProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { exportToCSV: exportRowsToCSV, exportToExcel } = useDataExport();
  const canExportClaims =
    MANAGER_EXPORT_ROLES.includes(userRole || '') ||
    (user?.email || '').toLowerCase().startsWith('accounts@');
  const [rangeExportOpen, setRangeExportOpen] = useState(false);
  const [rangeExportFrom, setRangeExportFrom] = useState('');
  const [rangeExportTo, setRangeExportTo] = useState('');
  const [claims, setClaims] = useState<ClaimSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddClaimDialog, setShowAddClaimDialog] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'claims' | 'reminders' | 'claims-data'>('claims');

  const { claims: managerClaims, loading: managerLoading, refetch: refetchManager } = useClaims();

  useEffect(() => { fetchClaims(); }, []);

  const fetchClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('claims_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        toast({ title: 'Error', description: 'Failed to fetch claims', variant: 'destructive' });
        return;
      }
      setClaims((data as any) || []);
    } finally {
      setLoading(false);
    }
  };

  const refetchAll = async () => {
    await Promise.all([fetchClaims(), refetchManager()]);
  };

  // Avg resolution time (real, from raw rows)
  const avgResolutionDays = useMemo(() => {
    const resolved = claims.filter(c => ['paid', 'resolved', 'rejected', 'closed', 'approved'].includes(c.status));
    if (resolved.length === 0) return 0;
    const total = resolved.reduce((sum, c) => {
      const end = c.paid_at || c.rejected_at || c.approved_at || c.updated_at;
      return sum + Math.floor((new Date(end).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.max(0, Math.round(total / resolved.length));
  }, [claims]);

  // Performance KPIs: avg payout, avg resolution, avg claims per month
  const perfKpis = useMemo(() => {
    const paid = managerClaims.filter((c: any) => (c.paidAmount ?? 0) > 0);
    const avgPayout = paid.length
      ? Math.round(paid.reduce((s: number, c: any) => s + (c.paidAmount || 0), 0) / paid.length)
      : 0;

    // Avg claims per month across the active date range of submissions
    const dates = managerClaims
      .map((c: any) => c.submittedAt ? new Date(c.submittedAt).getTime() : null)
      .filter((t): t is number => !!t);
    let avgPerMonth = 0;
    if (dates.length) {
      const min = Math.min(...dates);
      const max = Math.max(...dates);
      const months = Math.max(1, (max - min) / (1000 * 60 * 60 * 24 * 30.44));
      avgPerMonth = Math.round(managerClaims.length / months);
    }
    return { avgPayout, avgPerMonth };
  }, [managerClaims]);

  const totalCount = managerClaims.length;


  const handleExportCSV = () => {
    exportToCSV(claims.map(formatClaimForExport as any), 'claims_export');
    toast({ title: 'Success', description: 'Exported to CSV' });
  };

  const handleExportPDF = () => {
    exportToPDF(claims.map(formatClaimForExport as any), 'claims_report');
  };

  // Full-column export helpers (management + accounts only), mirroring the
  // Customer Management download menu.
  const flatten = (v: any) => {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  };

  const buildFullRows = (list: any[]) => {
    const keySet = new Set<string>();
    list.forEach(c => Object.keys(c || {}).forEach(k => keySet.add(k)));
    const keys = Array.from(keySet).sort();
    const rows = list.map(c => {
      const out: Record<string, any> = {};
      keys.forEach(k => { out[k] = flatten(c[k]); });
      return out;
    });
    return { rows, keys };
  };

  const handleExportFull = (fmt: 'csv' | 'xlsx') => {
    if (!canExportClaims) {
      sonnerToast.error('You do not have permission to export claims');
      return;
    }
    if (!claims.length) {
      sonnerToast.error('No claims to export');
      return;
    }
    const { rows, keys } = buildFullRows(claims);
    if (fmt === 'csv') exportRowsToCSV(rows, { filename: 'claims-full', format: 'csv' });
    else exportToExcel(rows, { filename: 'claims-full', format: 'xlsx' });
    sonnerToast.success(`Exported ${rows.length} claim(s) with ${keys.length} columns`);
  };

  // Server-side paginated export by submission date window.
  const exportForRange = async (start: Date, end: Date, label: string) => {
    if (!canExportClaims) {
      sonnerToast.error('You do not have permission to export claims');
      return;
    }
    const toastId = sonnerToast.loading(`Preparing claims export for ${label}...`);
    try {
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('claims_submissions')
          .select('*')
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      if (!all.length) {
        sonnerToast.error(`No claims found for ${label}`, { id: toastId });
        return;
      }
      const { rows, keys } = buildFullRows(all);
      exportRowsToCSV(rows, { filename: `claims-${label}`, format: 'csv' });
      sonnerToast.success(`Exported ${rows.length} claim(s) for ${label} (${keys.length} columns)`, { id: toastId });
    } catch (err: any) {
      console.error('Claims exportForRange failed:', err);
      sonnerToast.error(`Export failed: ${err?.message || 'unknown error'}`, { id: toastId });
    }
  };

  const quickRangeOptions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const add = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
    const tomorrow = add(startOfToday, 1);
    const dow = startOfToday.getUTCDay();
    const startOfThisWeek = add(startOfToday, -((dow + 6) % 7));
    const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return [
      { label: 'Today', filenameLabel: 'today', start: startOfToday, end: tomorrow },
      { label: 'Yesterday', filenameLabel: 'yesterday', start: add(startOfToday, -1), end: startOfToday },
      { label: 'Last 7 days', filenameLabel: 'last-7-days', start: add(startOfToday, -6), end: tomorrow },
      { label: 'This week (Mon–today)', filenameLabel: 'this-week', start: startOfThisWeek, end: tomorrow },
      { label: 'Last week', filenameLabel: 'last-week', start: add(startOfThisWeek, -7), end: startOfThisWeek },
      { label: 'This month', filenameLabel: 'this-month', start: startOfThisMonth, end: tomorrow },
      { label: 'Last month', filenameLabel: 'last-month', start: startOfLastMonth, end: startOfThisMonth },
      { label: 'Last 30 days', filenameLabel: 'last-30-days', start: add(startOfToday, -29), end: tomorrow },
      { label: 'Last 90 days', filenameLabel: 'last-90-days', start: add(startOfToday, -89), end: tomorrow },
      { label: 'Year to date', filenameLabel: 'year-to-date', start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), end: tomorrow },
      { label: 'All time', filenameLabel: 'all-time', start: new Date(Date.UTC(2020, 0, 1)), end: new Date(Date.UTC(now.getUTCFullYear() + 5, 0, 1)) },
    ];
  }, []);

  const monthExportOptions = useMemo(() => {
    const now = new Date();
    let earliest = Date.UTC(2025, 0, 1);
    for (const c of claims) {
      const t = c.created_at ? new Date(c.created_at).getTime() : NaN;
      if (Number.isFinite(t) && t < earliest) earliest = t;
    }
    const e = new Date(earliest);
    const total = (now.getUTCFullYear() - e.getUTCFullYear()) * 12 + (now.getUTCMonth() - e.getUTCMonth()) + 1;
    const opts: { label: string; filenameLabel: string; start: Date; end: Date }[] = [];
    for (let i = 0; i < Math.max(total, 1); i++) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      opts.push({
        label: start.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        filenameLabel: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        start, end,
      });
    }
    return opts;
  }, [claims]);

  const handleRangeExportSubmit = () => {
    if (!rangeExportFrom || !rangeExportTo) {
      sonnerToast.error('Pick a start and end date');
      return;
    }
    const start = new Date(`${rangeExportFrom}T00:00:00Z`);
    const end = new Date(new Date(`${rangeExportTo}T00:00:00Z`).getTime() + 86400000);
    if (end.getTime() <= start.getTime()) {
      sonnerToast.error('End date must be on or after start date');
      return;
    }
    exportForRange(start, end, `${rangeExportFrom}_to_${rangeExportTo}`);
    setRangeExportOpen(false);
  };

  if (loading || managerLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Due reminders — sticky banner across every claims sub-tab */}
      <ClaimRemindersBanner onManage={() => setActiveSubTab('reminders')} />

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Claims Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{totalCount} total claims</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(userRole === 'admin' || userRole === 'super_admin') && onMarkAsRead && onMarkAllAsRead && (
            <AdminNotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onNavigateToTab={onNavigateToTab}
            />
          )}
          <Button onClick={() => setShowAddClaimDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Claim
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
          {canExportClaims && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportFull('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  Full claims export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportFull('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Full claims export as Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Quick date export
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                    {quickRangeOptions.map(opt => (
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
                    {monthExportOptions.map(opt => (
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
              <DialogTitle>Export claims by date range</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Exports every claim submitted within the selected range (inclusive), with all columns.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="claims-range-from" className="text-xs">From</Label>
                  <Input id="claims-range-from" type="date" value={rangeExportFrom} onChange={(e) => setRangeExportFrom(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="claims-range-to" className="text-xs">To</Label>
                  <Input id="claims-range-to" type="date" value={rangeExportTo} onChange={(e) => setRangeExportTo(e.target.value)} />
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
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveSubTab('claims')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'claims' ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Claims List
        </button>
        <button
          onClick={() => setActiveSubTab('reminders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeSubTab === 'reminders' ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Bell className="h-3.5 w-3.5" /> Reminders
        </button>
        <button
          onClick={() => setActiveSubTab('claims-data')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeSubTab === 'claims-data' ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Claims data
        </button>
      </div>

      {/* Reminders Sub-tab */}
      {activeSubTab === 'reminders' && (
        <ClaimRemindersPanel claims={claims as any} />
      )}

      {/* Claims data Sub-tab — claim patterns by make, model, age and mileage */}
      {activeSubTab === 'claims-data' && (
        <div className="space-y-6">
          <VehicleIntelligenceExplorer claims={(claims || []).filter((c: any) => c.status !== 'fake_test') as any} />
          <div id="claims-analytics-section" className="scroll-mt-4 space-y-6">
            <ClaimsAnalyticsPanel claims={(claims || []).filter((c: any) => c.status !== 'fake_test') as any} />
            <ClaimsAgeMileageAnalytics claims={(claims || []).filter((c: any) => c.status !== 'fake_test') as any} />
          </div>
        </div>
      )}

      {/* Claims List Sub-tab — Workbench (queues + tabbed drawer) */}
      {activeSubTab === 'claims' && (
        <>
          <ClaimUpdateNotifications />
          <PerformanceKpiStrip
            avgPayout={perfKpis.avgPayout}
            avgResolutionDays={avgResolutionDays}
            avgClaimsPerMonth={perfKpis.avgPerMonth}
          />
          <ClaimsWorkbench showUrgencyBanner={false} />
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Operational overview</div>
            <UrgencyBanner claims={managerClaims} avgResolutionDays={avgResolutionDays} />
            <KpiStrip claims={managerClaims} avgResolutionDays={avgResolutionDays} />
          </div>
        </>
      )}

      <AddClaimDialog
        open={showAddClaimDialog}
        onOpenChange={setShowAddClaimDialog}
        onClaimAdded={refetchAll}
      />
    </div>
  );
};
