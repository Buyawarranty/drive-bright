import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDataExport } from '@/hooks/useDataExport';

interface LeadsFullExportMenuProps {
  userRole?: string | null;
  /** Rows currently visible in the table (already filtered) */
  visibleLeads: any[];
  /** Extra permission override from the parent tab */
  allowed?: boolean;
  /** Parent's simple export (respects selected rows) */
  onSimpleExport?: (format: 'csv' | 'xlsx') => void;
  selectedCount?: number;
}

const MANAGER_EXPORT_ROLES = [
  'super_admin',
  'admin',
  'sales_manager',
  'performance_manager',
  'accounts_manager',
  'accounts',
  'lead_gen',
];

const buildFullRows = (list: any[]) => {
  const keySet = new Set<string>();
  list.forEach(row => Object.keys(row || {}).forEach(k => keySet.add(k)));
  const keys = Array.from(keySet);
  const rows = list.map(row => {
    const out: Record<string, any> = {};
    keys.forEach(k => {
      const v = (row as any)[k];
      if (v === null || v === undefined) out[k] = '';
      else if (v instanceof Date) out[k] = v.toISOString();
      else if (typeof v === 'object') out[k] = JSON.stringify(v);
      else out[k] = v;
    });
    return out;
  });
  return { rows, keys };
};

/**
 * Full-column New Leads export (CSV / Excel) with date filters.
 * Mirrors the Customers tab export menu. Managers, accounts and lead gen only.
 */
export const LeadsFullExportMenu: React.FC<LeadsFullExportMenuProps> = ({ userRole, visibleLeads, allowed, onSimpleExport, selectedCount = 0 }) => {
  const { exportToCSV, exportToExcel } = useDataExport();
  const [email, setEmail] = useState('');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail((data.user?.email || '').toLowerCase()));
  }, []);

  const canExportFull =
    allowed === true || MANAGER_EXPORT_ROLES.includes(userRole || '') || email.startsWith('accounts@');

  const quickRangeOptions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
    const dow = startOfToday.getUTCDay();
    const startOfThisWeek = addDays(startOfToday, -((dow + 6) % 7));
    const startOfLastWeek = addDays(startOfThisWeek, -7);
    const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const startOfThisYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const tomorrow = addDays(startOfToday, 1);
    return [
      { label: 'Today', filenameLabel: 'today', start: startOfToday, end: tomorrow },
      { label: 'Yesterday', filenameLabel: 'yesterday', start: addDays(startOfToday, -1), end: startOfToday },
      { label: 'Last 7 days', filenameLabel: 'last-7-days', start: addDays(startOfToday, -6), end: tomorrow },
      { label: 'This week (Mon–today)', filenameLabel: 'this-week', start: startOfThisWeek, end: tomorrow },
      { label: 'Last week', filenameLabel: 'last-week', start: startOfLastWeek, end: startOfThisWeek },
      { label: 'This month', filenameLabel: 'this-month', start: startOfThisMonth, end: tomorrow },
      { label: 'Last month', filenameLabel: 'last-month', start: startOfLastMonth, end: startOfThisMonth },
      { label: 'Last 30 days', filenameLabel: 'last-30-days', start: addDays(startOfToday, -29), end: tomorrow },
      { label: 'Last 90 days', filenameLabel: 'last-90-days', start: addDays(startOfToday, -89), end: tomorrow },
      { label: 'Year to date', filenameLabel: 'year-to-date', start: startOfThisYear, end: tomorrow },
      {
        label: 'All time',
        filenameLabel: 'all-time',
        start: new Date(Date.UTC(2020, 0, 1)),
        end: new Date(Date.UTC(now.getUTCFullYear() + 5, 0, 1)),
      },
    ];
  }, []);

  const monthExportOptions = useMemo(() => {
    const now = new Date();
    const opts: { label: string; filenameLabel: string; start: Date; end: Date }[] = [];
    const earliest = new Date(Date.UTC(2025, 0, 1));
    const totalMonths =
      (now.getUTCFullYear() - earliest.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - earliest.getUTCMonth()) + 1;
    for (let i = 0; i < Math.max(totalMonths, 1); i++) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      opts.push({
        label: start.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        filenameLabel: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        start,
        end,
      });
    }
    return opts;
  }, []);

  const exportVisible = (format: 'csv' | 'xlsx') => {
    if (!canExportFull) {
      toast.error('You do not have permission to export the full leads dataset');
      return;
    }
    if (!visibleLeads.length) {
      toast.error('No leads to export');
      return;
    }
    const { rows, keys } = buildFullRows(visibleLeads);
    const filename = `leads-full-${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') exportToCSV(rows, { filename, format: 'csv' });
    else exportToExcel(rows, { filename, format: 'xlsx' });
    toast.success(`Exported ${rows.length} lead(s) with ${keys.length} columns`);
  };

  // Server-side paginated export by created_at so results are never truncated.
  const exportForRange = async (start: Date, end: Date, label: string) => {
    if (!canExportFull) {
      toast.error('You do not have permission to export');
      return;
    }
    const toastId = toast.loading(`Preparing export for ${label}...`);
    try {
      const pageSize = 1000;
      let from = 0;
      const collected: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('sales_leads')
          .select('*')
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        collected.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      if (!collected.length) {
        toast.error(`No leads found for ${label}`, { id: toastId });
        return;
      }

      const { rows, keys } = buildFullRows(collected);
      exportToCSV(rows, { filename: `leads-${label}`, format: 'csv' });
      toast.success(`Exported ${rows.length} lead(s) for ${label} (${keys.length} columns)`, { id: toastId });
    } catch (err: any) {
      console.error('Leads exportForRange failed:', err);
      toast.error(`Export failed: ${err?.message || 'unknown error'}`, { id: toastId });
    }
  };

  const handleRangeSubmit = () => {
    if (!rangeFrom || !rangeTo) {
      toast.error('Pick a start and end date');
      return;
    }
    const start = new Date(`${rangeFrom}T00:00:00Z`);
    const end = new Date(new Date(`${rangeTo}T00:00:00Z`).getTime() + 86400000);
    if (end.getTime() <= start.getTime()) {
      toast.error('End date must be on or after start date');
      return;
    }
    exportForRange(start, end, `${rangeFrom}_to_${rangeTo}`);
    setRangeOpen(false);
  };

  if (!canExportFull) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50 bg-popover">
          {onSimpleExport && (
            <>
              <DropdownMenuItem onClick={() => onSimpleExport('csv')}>
                <Download className="h-4 w-4 mr-2" />
                Export {selectedCount > 0 ? `${selectedCount} selected` : 'all'} as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSimpleExport('xlsx')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export {selectedCount > 0 ? `${selectedCount} selected` : 'all'} as Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => exportVisible('csv')}>
            <Download className="h-4 w-4 mr-2" />
            All columns — visible rows (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportVisible('xlsx')}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            All columns — visible rows (Excel)
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
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setRangeOpen(true); }}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            Custom date range…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export leads by date range</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Exports every column for all leads created within the selected range (inclusive).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="leads-range-from" className="text-xs">From</Label>
                <Input id="leads-range-from" type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="leads-range-to" className="text-xs">To</Label>
                <Input id="leads-range-to" type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRangeOpen(false)}>Cancel</Button>
              <Button onClick={handleRangeSubmit}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
