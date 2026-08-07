import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useDataExport } from '@/hooks/useDataExport';

interface ExportLead {
  id: string;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  priority?: string | null;
  lead_source?: string | null;
  vehicle_reg?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | number | null;
  plan_interest?: string | null;
  quote_amount?: number | string | null;
  call_count?: number | null;
  last_contacted_at?: string | null;
  last_activity_date?: string | null;
  notes?: string | null;
  assigned_user?: { email?: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: ExportLead[];
  /** Hide the lead source column for roles that can't see attribution. */
  sourceHidden?: boolean;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Manager export: every lead with its call attempts and full note history, over a chosen date range. */
export const LeadNotesExportDialog: React.FC<Props> = ({ open, onOpenChange, leads, sourceHidden }) => {
  const { exportToCSV } = useDataExport();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDay(d);
  });
  const [toDate, setToDate] = useState(() => isoDay(new Date()));

  const inRange = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T23:59:59`);
    return leads.filter(lead => {
      const created = new Date(lead.created_at);
      return created >= start && created <= end;
    });
  }, [leads, fromDate, toDate]);

  const handleExport = () => {
    if (inRange.length === 0) {
      toast.error('No leads in the selected date range');
      return;
    }

    const rows = inRange.map(lead => {
      const row: Record<string, any> = {
        'Enquiry Date': new Date(lead.created_at).toLocaleString('en-GB'),
        'First Name': lead.first_name || '',
        'Last Name': lead.last_name || '',
        'Email': lead.email || '',
        'Phone': lead.phone || '',
        'Vehicle Reg': (lead.vehicle_reg || '').toUpperCase(),
        'Vehicle': [lead.vehicle_make, lead.vehicle_model, lead.vehicle_year].filter(Boolean).join(' '),
        'Status': lead.status || '',
        'Priority': lead.priority || '',
        'Plan Interest': lead.plan_interest || '',
        'Quote Amount': lead.quote_amount ?? '',
        'Calls Attempted': lead.call_count ?? 0,
        'Last Contacted': lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleString('en-GB') : '',
        'Last Activity': lead.last_activity_date ? new Date(lead.last_activity_date).toLocaleString('en-GB') : '',
        'Assigned Agent': lead.assigned_user?.email || 'Awaiting Contact',
        'Notes': (lead.notes || '').replace(/\r?\n/g, ' | '),
      };
      if (!sourceHidden) row['Lead Source'] = lead.lead_source || '';
      return row;
    });

    exportToCSV(rows, { filename: `lead-with-notes_${fromDate}_to_${toDate}`, format: 'csv' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lead with notes</DialogTitle>
          <DialogDescription>
            Exports every lead in the range with calls attempted, note history, contact details, vehicle,
            status and assigned agent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="lead-notes-from">From</Label>
            <Input
              id="lead-notes-from"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-notes-to">To</Label>
            <Input
              id="lead-notes-to"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {inRange.length} lead{inRange.length === 1 ? '' : 's'} match this range.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadNotesExportDialog;
