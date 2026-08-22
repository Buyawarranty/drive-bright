import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { LifeBuoy, Loader2, Search, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';

interface CancellationRow {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  registration_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  plan_type: string | null;
  final_amount: number | null;
  status: string | null;
  updated_at: string | null;
  is_manual_entry: boolean | null;
}

interface Agent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

const agentName = (a: Agent) =>
  [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email;

/**
 * Lead Allocation → Cancellations.
 *
 * A website sale that wants to cancel can be sent to a specific agent as a
 * "SAVE CANCELLATION" lead. The lead is created assigned to that agent (so it
 * pops up for them in New Leads), tagged save_cancellation with a cash reward,
 * and must be phoned.
 */
export const CancellationsAllocationPanel: React.FC = () => {
  const currentAdminId = useCurrentAdminId();
  const [rows, setRows] = useState<CancellationRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [websiteOnly, setWebsiteOnly] = useState(true);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const [target, setTarget] = useState<CancellationRow | null>(null);
  const [agentId, setAgentId] = useState<string>('');
  const [reward, setReward] = useState('15');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [cust, staff] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, email, phone, registration_plate, vehicle_make, vehicle_model, plan_type, final_amount, status, updated_at, is_manual_entry')
          .or('status.ilike.cancelled,status.ilike.refunded')
          .order('updated_at', { ascending: false })
          .limit(200),
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active')
          .eq('is_active', true)
          .in('role', ['sales', 'sales_lead'])
          .order('first_name'),
      ]);
      setRows((cust.data as any) || []);
      setAgents((staff.data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (websiteOnly && r.is_manual_entry === true) return false;
      if ((r.final_amount || 0) < 20) return false;
      if (!term) return true;
      return [r.name, r.email, r.phone, r.registration_plate]
        .some((v) => v?.toLowerCase().includes(term));
    });
  }, [rows, search, websiteOnly]);

  const openSend = (row: CancellationRow) => {
    setTarget(row);
    setAgentId('');
    setReward('15');
    setMessage('');
  };

  const submit = async () => {
    if (!target) return;
    if (!agentId) {
      toast.error('Pick the agent who should try to save this cancellation.');
      return;
    }
    if (!target.email && !target.phone) {
      toast.error('This customer has no phone or email — cannot raise a save lead.');
      return;
    }
    const rewardValue = Number(reward);
    if (!Number.isFinite(rewardValue) || rewardValue < 0) {
      toast.error('Enter a valid reward amount.');
      return;
    }

    const parts = (target.name || '').trim().split(/\s+/);
    const reason = message.trim() || 'Website sale wants to cancel — call and save the policy.';
    const notes = [
      `SAVE CANCELLATION — £${rewardValue} reward for saving this policy.`,
      'Phone the customer (do not email). First contact should be a call.',
      target.registration_plate ? `Vehicle: ${target.registration_plate.toUpperCase()}` : null,
      target.plan_type ? `Plan: ${target.plan_type}` : null,
      typeof target.final_amount === 'number' ? `Paid: £${target.final_amount}` : null,
      `Manager note: ${reason}`,
    ].filter(Boolean).join('\n');

    setSubmitting(true);
    const { error } = await supabase.from('sales_leads').insert({
      first_name: parts[0] || null,
      last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
      email: target.email || `no-email+${(target.registration_plate || 'save').replace(/\s+/g, '')}@buyawarranty.co.uk`,
      phone: target.phone || null,
      vehicle_reg: target.registration_plate || null,
      vehicle_make: target.vehicle_make || null,
      vehicle_model: target.vehicle_model || null,
      lead_source: 'other',
      status: 'urgent_callback',
      priority: 'urgent',
      notes,
      manual_entry: true,
      assigned_to: agentId,
      save_cancellation: true,
      save_reward_amount: rewardValue,
      save_reason: reason,
      save_requested_by: currentAdminId || null,
      save_requested_at: new Date().toISOString(),
      save_source_customer_id: target.id,
    } as any);
    setSubmitting(false);

    if (error) {
      toast.error(`Could not send the save lead: ${error.message}`);
      return;
    }

    const agent = agents.find((a) => a.id === agentId);
    toast.success(`Save cancellation sent to ${agent ? agentName(agent) : 'the agent'} — £${rewardValue} reward.`);
    setSentIds((prev) => new Set(prev).add(target.id));
    setTarget(null);
  };

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <LifeBuoy className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Cancellations to save</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Send a cancelling website sale to a specific agent as an urgent save lead. It lands in their New
              Leads with a <span className="font-semibold">SAVE CANCELLATION</span> tag and a cash reward, and
              they must phone the customer.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, phone, reg"
              className="h-9 w-56 pl-8 text-sm"
            />
          </div>
          <Button
            variant={websiteOnly ? 'default' : 'outline'}
            size="sm"
            className="h-9"
            onClick={() => setWebsiteOnly((v) => !v)}
          >
            {websiteOnly ? 'Website sales only' : 'All cancellations'}
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {loading && (
          <div className="px-5 py-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading cancellations…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-5 py-6 text-sm text-muted-foreground">No cancellations to save right now.</div>
        )}

        {!loading && filtered.slice(0, 50).map((r) => (
          <div key={r.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground truncate">
                  {r.name || r.email || 'Customer'}
                </span>
                {r.registration_plate && (
                  <span className="font-mono text-xs uppercase px-1.5 py-0.5 rounded bg-muted">
                    {r.registration_plate}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px] capitalize">{r.status || 'cancelled'}</Badge>
                {sentIds.has(r.id) && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-900 border-amber-300">Save lead sent</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                <span>{r.phone || 'No phone'}</span>
                {typeof r.final_amount === 'number' && <span>£{Math.round(r.final_amount)}</span>}
                {r.updated_at && <span>{format(new Date(r.updated_at), 'd MMM yyyy')}</span>}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-amber-400 bg-amber-50 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              onClick={() => openSend(r)}
            >
              <Send className="h-3.5 w-3.5" />
              Send to agent
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-amber-600" />
              Send save cancellation to an agent
            </DialogTitle>
            <DialogDescription>
              Creates an urgent lead assigned to the chosen agent, tagged SAVE CANCELLATION. They get a pop-up in
              New Leads and must phone the customer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">{target?.name || target?.email || 'Customer'}</p>
              <p className="text-xs text-muted-foreground">{target?.phone || 'No phone on record'}</p>
              {target?.registration_plate && (
                <p className="mt-1 font-mono text-xs uppercase">{target.registration_plate}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Send to agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {agentName(a)} · {a.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="cx-save-reward">Reward for saving (£)</Label>
              <Input
                id="cx-save-reward"
                type="number"
                min={0}
                step={1}
                value={reward}
                onChange={(e) => setReward(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cx-save-message">Message to the agent</Label>
              <Textarea
                id="cx-save-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Cancelling over price — offer a better labour rate and keep the cover."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="gap-1">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Send as lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
