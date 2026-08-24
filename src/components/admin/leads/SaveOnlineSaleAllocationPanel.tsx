import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BadgePercent, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';

interface Agent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

interface Permission {
  admin_user_id: string;
  enabled: boolean;
  commission_pct: number;
  authorised_at: string | null;
}

const agentName = (a: Agent) =>
  [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email;

/**
 * Lead Allocation → Save online sale.
 *
 * Management authorise specific agents to receive "save online sale" leads.
 * Once authorised and switched on, the agent sees it on their My progress strip.
 * Managers then import a customer here and the lead lands with the chosen
 * authorised agent, stating they earn a percentage (default 4%) of the full
 * value of the sale.
 */
export const SaveOnlineSaleAllocationPanel: React.FC = () => {
  const currentAdminId = useCurrentAdminId();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [perms, setPerms] = useState<Record<string, Permission>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Import form
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [reg, setReg] = useState('');
  const [saleValue, setSaleValue] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [staff, permRows] = await Promise.all([
      supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead'])
        .order('first_name'),
      (supabase as any)
        .from('save_online_sale_agents')
        .select('admin_user_id, enabled, commission_pct, authorised_at'),
    ]);
    setAgents((staff.data as any) || []);
    const map: Record<string, Permission> = {};
    ((permRows.data as any[]) || []).forEach((p) => { map[p.admin_user_id] = p; });
    setPerms(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const authorised = useMemo(
    () => agents.filter((a) => perms[a.id]?.enabled),
    [agents, perms],
  );

  const togglePermission = async (agent: Agent, on: boolean) => {
    setSavingId(agent.id);
    const existing = perms[agent.id];
    const { error } = await (supabase as any)
      .from('save_online_sale_agents')
      .upsert(
        {
          admin_user_id: agent.id,
          enabled: on,
          commission_pct: existing?.commission_pct ?? 4,
          authorised_by: currentAdminId || null,
          authorised_at: new Date().toISOString(),
        },
        { onConflict: 'admin_user_id' },
      );
    setSavingId(null);
    if (error) {
      toast.error(`Could not update permission: ${error.message}`);
      return;
    }
    toast.success(on
      ? `${agentName(agent)} can now receive save online sale leads.`
      : `${agentName(agent)} will no longer receive save online sale leads.`);
    await load();
  };

  const updatePct = async (agent: Agent, pct: number) => {
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('Enter a percentage between 0 and 100.');
      return;
    }
    setSavingId(agent.id);
    const { error } = await (supabase as any)
      .from('save_online_sale_agents')
      .upsert(
        {
          admin_user_id: agent.id,
          enabled: perms[agent.id]?.enabled ?? true,
          commission_pct: pct,
          authorised_by: currentAdminId || null,
          authorised_at: new Date().toISOString(),
        },
        { onConflict: 'admin_user_id' },
      );
    setSavingId(null);
    if (error) {
      toast.error(`Could not update the percentage: ${error.message}`);
      return;
    }
    await load();
  };

  const submit = async () => {
    if (!agentId) {
      toast.error('Choose an authorised agent to receive this lead.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      toast.error('Add a phone number or email so the agent can contact them.');
      return;
    }
    const value = Number(saleValue);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter the full value of the sale.');
      return;
    }
    const pct = perms[agentId]?.commission_pct ?? 4;
    const commission = Math.round((value * pct) / 100 * 100) / 100;
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const reason = message.trim() || 'Imported online sale — call the customer and close it.';
    const plate = reg.trim().toUpperCase().replace(/\s+/g, '');

    const notes = [
      `SAVE ONLINE SALE — you earn ${pct}% of the full value of the sale.`,
      `Full sale value: £${value.toLocaleString('en-GB')} · your commission: £${commission.toLocaleString('en-GB')}`,
      'Phone the customer first — do not email.',
      plate ? `Vehicle: ${plate}` : null,
      `Manager note: ${reason}`,
    ].filter(Boolean).join('\n');

    setSubmitting(true);
    const { error } = await (supabase as any).from('sales_leads').insert({
      first_name: parts[0] || null,
      last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
      email: email.trim() || `no-email+${plate || 'onlinesale'}@buyawarranty.co.uk`,
      phone: phone.trim() || null,
      vehicle_reg: plate || null,
      lead_source: 'other',
      status: 'urgent_callback',
      priority: 'urgent',
      notes,
      manual_entry: true,
      assigned_to: agentId,
      save_online_sale: true,
      save_commission_pct: pct,
      save_sale_value: value,
      save_reason: reason,
      save_requested_by: currentAdminId || null,
      save_requested_at: new Date().toISOString(),
    });
    setSubmitting(false);

    if (error) {
      toast.error(`Could not import the lead: ${error.message}`);
      return;
    }

    const agent = agents.find((a) => a.id === agentId);
    toast.success(`Save online sale sent to ${agent ? agentName(agent) : 'the agent'} — ${pct}% of £${value.toLocaleString('en-GB')}.`);
    setName(''); setPhone(''); setEmail(''); setReg(''); setSaleValue(''); setMessage('');
  };

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-start gap-2">
        <BadgePercent className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">Save online sale</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Authorise specific agents to receive imported online sales. Once switched on, it shows on their
            My progress strip. Imported leads land with the chosen agent stating they earn a percentage
            (4% by default) of the full value of the sale.
          </p>
        </div>
      </div>

      {/* Who is allowed */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-sm font-semibold text-foreground">Who can receive these leads?</p>
        {loading ? (
          <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading agents…
          </div>
        ) : (
          <div className="mt-3 divide-y divide-border rounded-md border border-border">
            {agents.map((a) => {
              const p = perms[a.id];
              return (
                <div key={a.id} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{agentName(a)}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{a.role.replace('_', ' ')}</Badge>
                      {p?.enabled && (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300">
                          Authorised · {p.commission_pct}%
                        </Badge>
                      )}
                    </div>
                    {p?.enabled && p.authorised_at && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Turned on {format(new Date(p.authorised_at), 'd MMM yyyy')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        defaultValue={p?.commission_pct ?? 4}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (next !== (p?.commission_pct ?? 4)) updatePct(a, next);
                        }}
                        className="h-8 w-20 text-sm"
                        aria-label={`Commission percentage for ${agentName(a)}`}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    {savingId === a.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={!!p?.enabled}
                      onCheckedChange={(v) => togglePermission(a, v)}
                      aria-label={`Allow ${agentName(a)} to receive save online sale leads`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Import a lead */}
      <div className="px-5 py-4 bg-muted/30">
        <p className="text-sm font-semibold text-foreground">Import an online sale as a lead</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Only authorised agents appear in the list. The lead is created assigned to them, urgent, with the
          commission spelled out in the notes.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-3">
            <Label>Send to authorised agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={authorised.length ? 'Choose an agent' : 'No agents authorised yet'} />
              </SelectTrigger>
              <SelectContent>
                {authorised.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {agentName(a)} · {perms[a.id]?.commission_pct ?? 4}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sos-name" className="text-xs">Customer name</Label>
            <Input id="sos-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sos-phone" className="text-xs">Phone</Label>
            <Input id="sos-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sos-email" className="text-xs">Email</Label>
            <Input id="sos-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sos-reg" className="text-xs">Reg plate</Label>
            <Input id="sos-reg" value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} placeholder="AB12 CDE" className="h-9 font-mono uppercase" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sos-value" className="text-xs">Full value of the sale (£)</Label>
            <Input id="sos-value" type="number" min={0} step={1} value={saleValue} onChange={(e) => setSaleValue(e.target.value)} placeholder="899" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Agent earns</Label>
            <div className="h-9 flex items-center rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground">
              {agentId && Number(saleValue) > 0
                ? `£${(Math.round((Number(saleValue) * (perms[agentId]?.commission_pct ?? 4)) / 100 * 100) / 100).toLocaleString('en-GB')}`
                : '—'}
            </div>
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label htmlFor="sos-message" className="text-xs">Message to the agent</Label>
            <Textarea
              id="sos-message"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Paid deposit online but not completed — call and finish the sale."
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button size="sm" className="h-8 gap-1" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Import as lead
          </Button>
        </div>
      </div>
    </section>
  );
};
