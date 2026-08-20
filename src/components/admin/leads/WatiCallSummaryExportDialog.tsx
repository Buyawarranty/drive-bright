import React, { useState } from 'react';
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
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDataExport } from '@/hooks/useDataExport';
import { toWatiNumber } from '@/lib/watiExport';
import { fetchByIdsInBatches } from '@/utils/batchedIn';

interface SummaryLead {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  status?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: SummaryLead[];
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * WATI call summary export — one row per unique lead phone number for a chosen day:
 * Name, Number, Call duration today (seconds), Total calls attempted, Agent name, Status.
 * Numbers that already exist as customers, or in the marketing contacts audience, are removed.
 */
export const WatiCallSummaryExportDialog: React.FC<Props> = ({ open, onOpenChange, leads }) => {
  const { exportToCSV } = useDataExport();
  const [targetDate, setTargetDate] = useState(() => isoDay(new Date()));
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      // Leads keyed by normalised phone
      const byPhone = new Map<string, SummaryLead>();
      for (const lead of leads) {
        const key = toWatiNumber(lead.phone);
        if (!key || byPhone.has(key)) continue;
        byPhone.set(key, lead);
      }
      if (byPhone.size === 0) {
        toast.error('No leads with a valid mobile number');
        return;
      }

      const leadIds = leads.map(l => l.id);
      const start = new Date(`${targetDate}T00:00:00`);
      const end = new Date(`${targetDate}T23:59:59.999`);

      const callLogs = await fetchByIdsInBatches<any>(
        leadIds,
        (chunk) =>
          supabase
            .from('lead_call_logs')
            .select('lead_id, agent_name, call_started_at, call_ended_at, created_at')
            .in('lead_id', chunk)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString()),
      );

      // Aggregate per lead id
      const agg = new Map<string, { seconds: number; attempts: number; agents: Set<string> }>();
      for (const log of callLogs) {
        const entry = agg.get(log.lead_id) || { seconds: 0, attempts: 0, agents: new Set<string>() };
        entry.attempts += 1;
        if (log.call_started_at && log.call_ended_at) {
          const secs = Math.max(
            0,
            Math.round((new Date(log.call_ended_at).getTime() - new Date(log.call_started_at).getTime()) / 1000),
          );
          entry.seconds += secs;
        }
        if (log.agent_name) entry.agents.add(log.agent_name);
        agg.set(log.lead_id, entry);
      }

      // Only leads that were actually called on the target date
      const matched = Array.from(byPhone.entries()).filter(([, lead]) => agg.has(lead.id));
      const initialMatches = matched.length;
      if (initialMatches === 0) {
        toast.error(`No calls logged against these leads on ${targetDate}`);
        return;
      }

      // Exclude existing customers and existing marketing contacts (normalised match)
      const [customers, contacts] = await Promise.all([
        supabase.from('customers').select('phone').not('phone', 'is', null).limit(20000),
        supabase.from('marketing_audience').select('phone').not('phone', 'is', null).limit(20000),
      ]);

      const customerSet = new Set(
        (customers.data || []).map(c => toWatiNumber(c.phone)).filter(Boolean) as string[],
      );
      const contactSet = new Set(
        (contacts.data || []).map(c => toWatiNumber(c.phone)).filter(Boolean) as string[],
      );

      let removedCustomers = 0;
      let removedContacts = 0;
      let missingStatus = 0;

      const rows = matched
        .filter(([key]) => {
          if (customerSet.has(key)) { removedCustomers += 1; return false; }
          if (contactSet.has(key)) { removedContacts += 1; return false; }
          return true;
        })
        .map(([key, lead]) => {
          const entry = agg.get(lead.id)!;
          const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || 'Customer';
          if (!lead.status) missingStatus += 1;
          return {
            Name: name,
            Number: lead.phone ? String(lead.phone).trim() : key,
            'Call duration today (seconds)': entry.seconds,
            'Total calls attempted': entry.attempts,
            'Agent name': Array.from(entry.agents).join(', '),
            Status: lead.status || '',
          };
        });

      if (rows.length === 0) {
        toast.error('Every matched number already exists in Customers or Contacts');
        return;
      }

      exportToCSV(rows, { filename: `final_call_summary_${targetDate}`, format: 'csv' });
      toast.success(
        `${initialMatches} matched · ${removedCustomers} in Customers · ${removedContacts} in Contacts · ${rows.length} exported${
          missingStatus > 0 ? ` · ${missingStatus} without status` : ''
        }`,
        { duration: 8000 },
      );
      onOpenChange(false);
    } catch (error) {
      console.error('WATI call summary export failed', error);
      toast.error('Export failed — please try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>WATI call summary</DialogTitle>
          <DialogDescription>
            One row per lead number called on the chosen day: name, number, total talk time in seconds,
            calls attempted, agents and lead status. Numbers already in Customers or Contacts are removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="wati-summary-date">Target date</Label>
          <Input
            id="wati-summary-date"
            type="date"
            value={targetDate}
            max={isoDay(new Date())}
            onChange={e => setTargetDate(e.target.value)}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {leads.length} lead{leads.length === 1 ? '' : 's'} in scope (ticked leads, otherwise everything shown).
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleExport} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WatiCallSummaryExportDialog;
