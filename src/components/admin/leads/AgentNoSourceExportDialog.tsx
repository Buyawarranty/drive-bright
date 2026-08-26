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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useDataExport } from '@/hooks/useDataExport';
import { Lead } from '@/hooks/useLeads';
import { useAgentActivity } from '@/hooks/useAgentActivity';
import { useAllAdminUsersMap, AdminUserLite } from '@/hooks/useAllAdminUsersMap';
import { useCustomerActivity, getCustomerActivityLabel } from '@/hooks/useCustomerActivity.tsx';
import { useLeadResponseTime, formatResponseTime, getResponseSourceLabel } from '@/hooks/useLeadResponseTime';
import { formatLeadDateUK } from '@/lib/leadFeedDate';
import { format, formatDistanceToNow } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  format: 'csv' | 'xlsx';
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const UNASSIGNED = '__unassigned__';

const agentLabel = (lead: Lead) =>
  [lead.assigned_user?.first_name, lead.assigned_user?.last_name].filter(Boolean).join(' ') ||
  lead.assigned_user?.email ||
  '';

const statusLabels: Record<string, string> = {
  new: 'Not spoken to',
  contacted: 'Spoken to',
  follow_up: 'Follow-up',
  quote_sent: 'Quote sent',
  negotiating: 'Negotiating',
  converted: 'Converted',
  lost: 'Lost',
  not_interested: 'Not interested',
  fake_lead: 'Fake / 404',
  urgent_callback: 'Urgent call-back',
  no_answer: 'No answer',
  left_voicemail: 'Left voicemail',
  wrong_number: 'Wrong number',
  callback_booked: 'Callback booked',
  bought_elsewhere: 'Bought elsewhere',
  vehicle_sold: 'Vehicle sold',
  do_not_contact: 'Do not contact',
  not_eligible: 'Not eligible',
  unsubscribed: 'Unsubscribed',
};

const formatUKPhone = (phone: string): string => {
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.startsWith('+44') && cleaned.length >= 12) {
    const withoutCode = cleaned.slice(3);
    return `+44 ${withoutCode.slice(0, 4)} ${withoutCode.slice(4, 7)} ${withoutCode.slice(7)}`;
  }
  return phone;
};

const displayName = (lead: Lead): string => {
  if (lead.first_name || lead.last_name) {
    return `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
  }
  if (lead.full_name && !lead.full_name.includes('@')) return lead.full_name;
  if (lead.email) return lead.email.split('@')[0];
  return '';
};

/** Manager export using the same columns as the New Leads table rows, but never including the Source column. */
export const AgentNoSourceExportDialog: React.FC<Props> = ({ open, onOpenChange, leads, format: exportFormat }) => {
  const { exportToCSV, exportToExcel } = useDataExport();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDay(d);
  });
  const [toDate, setToDate] = useState(() => isoDay(new Date()));
  const [agent, setAgent] = useState<string>('all');

  const agents = useMemo(() => {
    const map = new Map<string, string>();
    let hasUnassigned = false;
    leads.forEach(lead => {
      if (!lead.assigned_to) {
        hasUnassigned = true;
        return;
      }
      const label = agentLabel(lead) || 'Unknown agent';
      if (!map.has(lead.assigned_to)) map.set(lead.assigned_to, label);
    });
    const list = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (hasUnassigned) list.push({ value: UNASSIGNED, label: 'Awaiting Contact (unassigned)' });
    return list;
  }, [leads]);

  const inRange = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T23:59:59`);
    return leads.filter(lead => {
      const created = new Date(lead.created_at);
      if (created < start || created > end) return false;
      if (agent === 'all') return true;
      if (agent === UNASSIGNED) return !lead.assigned_to;
      return lead.assigned_to === agent;
    });
  }, [leads, fromDate, toDate, agent]);

  const leadIds = useMemo(() => inRange.map(l => l.id), [inRange]);
  const emails = useMemo(() => inRange.map(l => l.email).filter(Boolean), [inRange]);
  const leadInputs = useMemo(() => inRange.map(l => ({ id: l.id, created_at: l.created_at })), [inRange]);

  const { activityByLead } = useAgentActivity(leadIds);
  const { activityByEmail } = useCustomerActivity(emails);
  const { responseByLead } = useLeadResponseTime(leadInputs);

  const handleExport = () => {
    if (inRange.length === 0) {
      toast.error('No leads match the selected filters');
      return;
    }

    const rows = inRange.map(lead => {
      const assigned = agentLabel(lead) || 'Awaiting Contact';
      const status = statusLabels[lead.status || ''] || lead.status || '';
      const calls = lead.call_count ?? 0;
      const name = displayName(lead);
      const phone = lead.phone ? formatUKPhone(lead.phone) : '';
      const reg = (lead.vehicle_reg || '').toUpperCase();
      const paymentStatus = lead.is_paid
        ? `Paid (£${lead.payment_amount?.toFixed(2) || 'N/A'})`
        : 'Unpaid';
      const paidDate = lead.payment_date
        ? format(new Date(lead.payment_date), 'MMM d, yyyy HH:mm')
        : '';

      const agentActivity = activityByLead[lead.id];
      const lastAgentTouch = lead.last_contacted_at || agentActivity?.lastAt;
      const agentActivityText = lastAgentTouch
        ? `${formatDistanceToNow(new Date(lastAgentTouch), { addSuffix: true })}${
            agentActivity?.lastAt ? ` · ${agentActivity.source === 'note' ? 'note' : agentActivity.source === 'call' ? 'call' : agentActivity.source === 'dial' ? 'dialled' : 'status change'}` : ''
          }`
        : 'No agent activity';

      const customerActivity = lead.email ? activityByEmail[lead.email.toLowerCase()] : undefined;
      const customerActivityText = customerActivity
        ? `${formatDistanceToNow(new Date(customerActivity.lastAt), { addSuffix: true })} · ${getCustomerActivityLabel(customerActivity.source)}`
        : 'No customer activity';

      const response = responseByLead[lead.id];
      const timeToContactText = response
        ? `${formatResponseTime(response.seconds)} · ${getResponseSourceLabel(response.source)}`
        : 'Not contacted';

      return {
        'Agent': assigned,
        'Status': status,
        'Calls Attempted': calls,
        'Name': name,
        'Phone': phone,
        'Email': lead.email || '',
        'Vehicle Reg': reg,
        'Payment Status': paymentStatus,
        'Paid Date': paidDate,
        'Agent Activity': agentActivityText,
        'Lead Date': formatLeadDateUK(lead.created_at),
        'Customer Activity': customerActivityText,
        'Time to Contact': timeToContactText,
      };
    });

    const agentSlug =
      agent === 'all'
        ? 'all-agents'
        : (agents.find(a => a.value === agent)?.label || 'agent').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const filename = `leads-by-agent-no-source_${agentSlug}_${fromDate}_to_${toDate}`;
    if (exportFormat === 'csv') {
      exportToCSV(rows, { filename, format: 'csv' });
    } else {
      exportToExcel(rows, { filename, format: 'xlsx' });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export by agent (no source)</DialogTitle>
          <DialogDescription>
            Exports the same columns shown in the New Leads table rows for a chosen agent and date range. The Source column is never included.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="agent-export-from">From</Label>
            <Input
              id="agent-export-from"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agent-export-to">To</Label>
            <Input
              id="agent-export-to"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Agent</Label>
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger>
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map(a => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">
          {inRange.length} lead{inRange.length === 1 ? '' : 's'} match these filters.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            Export {exportFormat === 'csv' ? 'CSV' : 'Excel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgentNoSourceExportDialog;
