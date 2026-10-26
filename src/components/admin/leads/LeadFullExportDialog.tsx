import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { supabase } from '@/integrations/supabase/client';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useDataExport } from '@/hooks/useDataExport';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import { toast } from 'sonner';

const PAGE_SIZE = 1000;

interface LeadExportRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  priority: string | null;
  lead_source: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  plan_interest: string | null;
  quote_amount: number | null;
  assigned_to: string | null;
  last_contacted_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  notes: string | null;
}

/**
 * Super-admin-only full lead export. Exports EVERY lead ever received
 * (any status, including lost, fake and archived) for a chosen date range,
 * defaulting to all time. Uses the same UnifiedDateFilter as Customer
 * Management so the date controls are identical.
 */
export function LeadFullExportDialog() {
  const { isSuperAdmin, loading: roleLoading } = useIsSuperAdmin();
  const { exportToCSV } = useDataExport();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  if (roleLoading || !isSuperAdmin) return null;

  const runExport = async () => {
    const range = period === 'custom' ? customRange : periodToRange(period);
    if (period === 'custom' && !range?.from) {
      toast.error('Pick a start and end date first');
      return;
    }

    setExporting(true);
    try {
      // Resolve agent names for the assigned_to column.
      const { data: admins, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id, first_name, last_name, email');
      if (adminError) throw adminError;
      const agentById = new Map(
        (admins || []).map(a => [a.user_id, [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || ''])
      );

      // Page through every lead in the range — no row cap, any status.
      const rows: LeadExportRow[] = [];
      let from = 0;
      for (;;) {
        let query = supabase
          .from('sales_leads')
          .select('id, created_at, updated_at, first_name, last_name, email, phone, status, priority, lead_source, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, plan_interest, quote_amount, assigned_to, last_contacted_at, lost_at, lost_reason, notes')
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (range?.from) query = query.gte('created_at', new Date(range.from.setHours(0, 0, 0, 0)).toISOString());
        if (range?.to) query = query.lte('created_at', new Date(range.to.setHours(23, 59, 59, 999)).toISOString());
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...((data || []) as unknown as LeadExportRow[]));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (rows.length === 0) {
        toast.error('No leads found in that date range');
        return;
      }

      const exportData = rows.map(lead => ({
        'Agent': lead.assigned_to ? (agentById.get(lead.assigned_to) || 'Awaiting Contact') : 'Awaiting Contact',
        'First Name': lead.first_name || '',
        'Last Name': lead.last_name || '',
        'Email': lead.email || '',
        'Phone': lead.phone || '',
        'Status': lead.status || '',
        'Priority': lead.priority || '',
        'Source': lead.lead_source || '',
        'Vehicle Reg': lead.vehicle_reg || '',
        'Vehicle': `${lead.vehicle_make || ''} ${lead.vehicle_model || ''} ${lead.vehicle_year || ''}`.trim(),
        'Plan Interest': lead.plan_interest || '',
        'Quote Amount': lead.quote_amount ?? '',
        'Last Contacted': lead.last_contacted_at || '',
        'Created At': lead.created_at,
        'Updated At': lead.updated_at || '',
        'Lost At': lead.lost_at || '',
        'Lost Reason': lead.lost_reason || '',
        'Notes': lead.notes || '',
      }));

      const rangeLabel = range?.from
        ? `${format(range.from, 'yyyy-MM-dd')}_to_${format(range.to ?? range.from, 'yyyy-MM-dd')}`
        : 'all-time';
      await exportToCSV(exportData, { filename: `all-leads-${rangeLabel}`, format: 'csv' });
      toast.success(`Exported ${rows.length.toLocaleString('en-GB')} leads`);
      setOpen(false);
    } catch (err) {
      console.error('Full lead export failed:', err);
      toast.error('Export failed — please try again');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export all leads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export all leads</DialogTitle>
          <DialogDescription>
            Downloads every lead ever received — including lost, fake and archived — for the
            dates you choose. Leave it on "All" to export from day one. Super admin only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <UnifiedDateFilter
            scope="signup"
            period={period}
            customRange={customRange}
            availableScopes={['signup']}
            onChange={({ period: p, customRange: r }) => { setPeriod(p); setCustomRange(r); }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>Cancel</Button>
            <Button onClick={runExport} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting ? 'Exporting…' : 'Download CSV'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
