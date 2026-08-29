import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Loader2, Search, Send, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FoundLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_reg: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string | null;
}

interface Agent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
}

const SALES_ROLES = ['sales', 'sales_lead', 'sales_manager'] as const;

const leadName = (l: FoundLead) =>
  [l.first_name, l.last_name].filter(Boolean).join(' ').trim() || l.email || l.phone || 'Unnamed lead';

const agentName = (a: Agent) =>
  [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email || 'Agent';

/**
 * Import an existing lead and send it into the normal lead flow for a chosen agent.
 *
 * Search by reg plate, name, email or phone, pick the agent, send. Assignment goes
 * through the same `assign_lead_to_agent` routine the rest of Lead Allocation uses,
 * so caps, audit trail and ownership rules all behave exactly as normal.
 */
export const ImportLeadToAgentPanel: React.FC<{
  title?: string;
  description?: string;
  /** Extra note prefix stamped on the lead, e.g. for save-cancellation jobs. */
  noteTag?: string;
  /** Mark the lead urgent when it lands with the agent. */
  markUrgent?: boolean;
  className?: string;
  onSent?: () => void;
}> = ({
  title = 'Import a lead',
  description = 'Find an existing lead by reg plate, name, email or phone, then send it into the lead flow for the agent you pick.',
  noteTag,
  markUrgent = false,
  className,
  onSent,
}) => {
  const [term, setTerm] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [results, setResults] = React.useState<FoundLead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [agentId, setAgentId] = React.useState<string>('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role')
        .eq('is_active', true)
        .is('archived_at', null)
        .in('role', SALES_ROLES)
        .order('first_name');
      if (cancelled) return;
      setAgents((data as Agent[]) || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const search = async () => {
    const q = term.trim();
    if (q.length < 2) {
      toast.error('Enter at least two characters to search.');
      return;
    }
    setSearching(true);
    setSelectedLeadId(null);
    try {
      const like = `%${q}%`;
      const bare = q.replace(/\s+/g, '');
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, email, phone, vehicle_reg, status, assigned_to, created_at')
        .or(
          [
            `vehicle_reg.ilike.${like}`,
            `vehicle_reg.ilike.%${bare}%`,
            `email.ilike.${like}`,
            `phone.ilike.${like}`,
            `first_name.ilike.${like}`,
            `last_name.ilike.${like}`,
          ].join(','),
        )
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      const rows = (data as FoundLead[]) || [];
      setResults(rows);
      if (rows.length === 1) setSelectedLeadId(rows[0].id);
      if (rows.length === 0) toast.info('No leads matched that search.');
    } catch (e: any) {
      toast.error(`Search failed: ${e?.message || 'unknown error'}`);
    } finally {
      setSearching(false);
    }
  };

  const send = async () => {
    const lead = results.find(r => r.id === selectedLeadId);
    const agent = agents.find(a => a.id === agentId);
    if (!lead) { toast.error('Pick the lead you want to send.'); return; }
    if (!agent) { toast.error('Pick the agent to send it to.'); return; }

    setSending(true);
    try {
      const { data, error } = await supabase.rpc('assign_lead_to_agent', {
        p_lead_id: lead.id,
        p_agent_id: agent.id,
        p_is_abandoned_cart: false,
        p_override_cap: true,
      } as any);
      if (error) throw error;
      const res = data as { success?: boolean; error?: string } | null;
      if (res && res.success === false) throw new Error(res.error || 'Assignment was refused.');

      if (noteTag || markUrgent) {
        const stamp = new Date().toLocaleString('en-GB');
        const note = `${noteTag ? `${noteTag} — ` : ''}Imported and sent to ${agentName(agent)} by a manager on ${stamp}.`;
        const update: Record<string, unknown> = {
          notes: lead.status ? undefined : undefined,
        };
        delete update.notes;
        if (markUrgent) {
          update.priority = 'urgent';
          update.status = 'urgent_callback';
        }
        await supabase.from('sales_leads').update(update as any).eq('id', lead.id);
        await supabase.from('lead_quick_notes').insert({ lead_id: lead.id, note } as any);
      }

      toast.success(`${leadName(lead)} sent to ${agentName(agent)} in the normal lead flow.`);
      setResults([]);
      setSelectedLeadId(null);
      setTerm('');
      onSent?.();
    } catch (e: any) {
      toast.error(`Could not send the lead: ${e?.message || 'unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={term}
          onChange={e => setTerm(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          placeholder="Reg plate, name, email or phone"
          className="bg-background"
        />
        <Button onClick={search} disabled={searching} variant="outline" className="shrink-0">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">Find lead</span>
        </Button>
      </div>

      {results.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y">
          {results.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedLeadId(l.id)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors',
                selectedLeadId === l.id && 'bg-primary/10',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{leadName(l)}</span>
                {l.vehicle_reg && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase">
                    {l.vehicle_reg}
                  </span>
                )}
                {l.status && (
                  <span className="text-[11px] text-muted-foreground">{l.status.replace(/_/g, ' ')}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {[l.phone, l.email].filter(Boolean).join(' · ') || 'No contact details'}
                {l.assigned_to ? ' · already owned by an agent' : ' · unassigned'}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label className="text-xs">Send to agent</Label>
          <select
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Choose an agent…</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{agentName(a)}</option>
            ))}
          </select>
        </div>
        <Button onClick={send} disabled={sending || !selectedLeadId || !agentId} className="shrink-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="ml-2">Send as a lead</span>
        </Button>
      </div>

      {!selectedLeadId && results.length > 0 && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" /> Pick a lead from the list above first.
        </p>
      )}
    </div>
  );
};

export default ImportLeadToAgentPanel;
