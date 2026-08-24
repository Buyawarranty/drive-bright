import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  signup_date?: string | null;
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

const isAlreadyCancelled = (status?: string | null) =>
  !!status && /cancel|refund/i.test(status);

/**
 * Lead Allocation → Cancellations (save the deal).
 *
 * This is a lookup, not a list of past cancellations: a customer rings or emails
 * wanting to cancel, you find their live policy by reg plate, email or phone,
 * then send it to one or more agents as an urgent SAVE CANCELLATION lead with a
 * cash reward. Policies that are already cancelled or refunded are excluded —
 * there is nothing left to save.
 */
export const CancellationsAllocationPanel: React.FC = () => {
  const currentAdminId = useCurrentAdminId();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CancellationRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const [target, setTarget] = useState<CancellationRow | null>(null);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [reward, setReward] = useState('15');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [manualReg, setManualReg] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead'])
        .order('first_name');
      setAgents((data as any) || []);
    })();
  }, []);

  const runSearch = async () => {
    const term = search.trim();
    if (term.length < 3) {
      toast.error('Enter at least 3 characters — reg plate, email or phone.');
      return;
    }
    setSearching(true);
    setHasSearched(true);
    const like = `%${term}%`;
    const regLike = `%${term.replace(/\s+/g, '')}%`;
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, phone, registration_plate, vehicle_make, vehicle_model, plan_type, final_amount, status, signup_date, updated_at, is_manual_entry')
      .eq('is_deleted', false)
      .or(`registration_plate.ilike.${regLike},email.ilike.${like},phone.ilike.${like},name.ilike.${like}`)
      .order('signup_date', { ascending: false })
      .limit(50);
    setSearching(false);
    if (error) {
      toast.error(`Search failed: ${error.message}`);
      return;
    }
    // Never surface deals that are already cancelled or refunded.
    setRows(((data as any[]) || []).filter((r) => !isAlreadyCancelled(r.status)) as CancellationRow[]);
  };

  const results = useMemo(() => rows, [rows]);

  const openSend = (row: CancellationRow) => {
    setTarget(row);
    setAgentIds([]);
    setReward('15');
    setMessage('');
  };

  const openManual = () => {
    const reg = manualReg.trim().toUpperCase();
    const name = manualName.trim();
    if (!reg && !name) {
      toast.error('Enter a reg plate or a customer name.');
      return;
    }
    if (!manualPhone.trim() && !manualEmail.trim()) {
      toast.error('Add a phone number or email so the agent can call them.');
      return;
    }
    const match = rows.find((r) =>
      (reg && r.registration_plate?.replace(/\s+/g, '').toUpperCase() === reg.replace(/\s+/g, '')) ||
      (name && r.name?.toLowerCase() === name.toLowerCase())
    );
    openSend({
      id: match?.id ?? null,
      name: name || match?.name || null,
      email: manualEmail.trim() || match?.email || null,
      phone: manualPhone.trim() || match?.phone || null,
      registration_plate: reg || match?.registration_plate || null,
      vehicle_make: match?.vehicle_make ?? null,
      vehicle_model: match?.vehicle_model ?? null,
      plan_type: match?.plan_type ?? null,
      final_amount: match?.final_amount ?? null,
      status: match?.status ?? null,
      updated_at: null,
      is_manual_entry: true,
    });
  };

  const toggleAgent = (id: string) =>
    setAgentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!target) return;
    if (agentIds.length === 0) {
      toast.error('Pick at least one agent to try and save this deal.');
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
    const reason = message.trim() || 'Customer wants to cancel — call and save the policy.';
    const notes = [
      `SAVE CANCELLATION — £${rewardValue} reward for saving this policy.`,
      'Phone the customer (do not email). First contact should be a call.',
      target.registration_plate ? `Vehicle: ${target.registration_plate.toUpperCase()}` : null,
      target.plan_type ? `Plan: ${target.plan_type}` : null,
      typeof target.final_amount === 'number' ? `Paid: £${target.final_amount}` : null,
      `Manager note: ${reason}`,
    ].filter(Boolean).join('\n');

    const base = {
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
      save_cancellation: true,
      save_reward_amount: rewardValue,
      save_reason: reason,
      save_requested_by: currentAdminId || null,
      save_requested_at: new Date().toISOString(),
      save_source_customer_id: target.id || null,
    };

    setSubmitting(true);
    const { error } = await supabase
      .from('sales_leads')
      .insert(agentIds.map((id) => ({ ...base, assigned_to: id })) as any);
    setSubmitting(false);

    if (error) {
      toast.error(`Could not send the save lead: ${error.message}`);
      return;
    }

    const names = agentIds
      .map((id) => agents.find((a) => a.id === id))
      .filter(Boolean)
      .map((a) => agentName(a as Agent))
      .join(', ');
    toast.success(`Save cancellation sent to ${names || 'the agents'} — £${rewardValue} reward.`);
    if (target.id) setSentIds((prev) => new Set(prev).add(target.id!));
    setManualReg(''); setManualName(''); setManualPhone(''); setManualEmail('');
    setTarget(null);
  };

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start gap-2 min-w-0">
          <LifeBuoy className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Save a cancellation</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Someone wants to cancel? Find them by reg plate, email or phone, then send them to one or more
              agents as an urgent <span className="font-semibold">SAVE CANCELLATION</span> lead with a cash
              reward. Policies already cancelled or refunded are excluded — there's nothing left to save.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              placeholder="Reg plate, email, phone or name"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Button size="sm" className="h-9 gap-1" onClick={runSearch} disabled={searching}>
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Find customer
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {!hasSearched && (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Search for the customer who wants to cancel to get started.
          </div>
        )}

        {hasSearched && !searching && results.length === 0 && (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            No live policy found for that search. Use the manual form below if they're not in our records.
          </div>
        )}

        {results.map((r) => (
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
                {r.status && <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>}
                {r.id && sentIds.has(r.id) && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-900 border-amber-300">Save lead sent</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                <span>{r.phone || 'No phone'}</span>
                <span>{r.email || 'No email'}</span>
                {typeof r.final_amount === 'number' && <span>£{Math.round(r.final_amount)}</span>}
                {(r.signup_date || r.updated_at) && (
                  <span>{format(new Date((r.signup_date || r.updated_at) as string), 'd MMM yyyy')}</span>
                )}
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

      <div className="px-5 py-4 border-t border-border bg-muted/30">
        <p className="text-sm font-semibold text-foreground">Not in our records? Create a save lead manually</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter the reg plate or the customer name, plus a phone or email, and we'll raise the save lead.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="cx-manual-reg" className="text-xs">Reg plate</Label>
            <Input
              id="cx-manual-reg"
              value={manualReg}
              onChange={(e) => setManualReg(e.target.value.toUpperCase())}
              placeholder="AB12 CDE"
              className="h-9 font-mono uppercase"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cx-manual-name" className="text-xs">Customer name</Label>
            <Input
              id="cx-manual-name"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Jane Smith"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cx-manual-phone" className="text-xs">Phone</Label>
            <Input
              id="cx-manual-phone"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="07…"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cx-manual-email" className="text-xs">Email</Label>
            <Input
              id="cx-manual-email"
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="name@email.com"
              className="h-9"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" className="h-8 gap-1" onClick={openManual}>
            <Send className="h-3.5 w-3.5" />
            Create save cancellation lead
          </Button>
        </div>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-amber-600" />
              Send save cancellation to agents
            </DialogTitle>
            <DialogDescription>
              Creates an urgent lead for each agent you pick, tagged SAVE CANCELLATION. They get a pop-up in
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

            <div className="space-y-2">
              <Label>Send to agent(s)</Label>
              <div className="rounded-md border border-border divide-y divide-border max-h-44 overflow-y-auto">
                {agents.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={agentIds.includes(a.id)}
                      onCheckedChange={() => toggleAgent(a.id)}
                    />
                    <span className="truncate">{agentName(a)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{a.role}</span>
                  </label>
                ))}
              </div>
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
