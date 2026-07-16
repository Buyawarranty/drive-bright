import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Users, Sunrise } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AdminLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
}

/**
 * Prominent manager card for assigning Open Pool leads directly to a chosen
 * agent (bulk). Shown at the top of the allocation section so it's easy to
 * find when you just want to hand a batch of unassigned leads to someone.
 */
interface PoolCounts {
  morning: number;
  live: number;
  retry: number;
}

interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_reg: string | null;
  lead_source: string | null;
  queue: string | null;
  created_at: string;
  original_assigned_to: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  payment_date: string | null;
  last_activity_date: string | null;
  last_contacted_at: string | null;
  last_action_at: string | null;
}

export const AssignOpenPoolCard = () => {
  const [agents, setAgents] = useState<AdminLite[]>([]);
  const [targetId, setTargetId] = useState<string>('');
  const [count, setCount] = useState('5');
  const [windowMode, setWindowMode] = useState<'timer' | 'none'>('timer');
  const [minutes, setMinutes] = useState('30');
  const [busy, setBusy] = useState(false);
  const [draining, setDraining] = useState(false);
  const [counts, setCounts] = useState<PoolCounts | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const loadCounts = async () => {
    // Strict "fresh" definition — matches the agent-facing popup:
    //   status = 'new', never assigned, never contacted, never recycled.
    // Anything already worked (quote_sent / contacted / callback / lost /
    // converted / etc.) is excluded so the counter reflects genuinely new
    // leads only.
    const lockCutoff = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    const base = () =>
      supabase
        .from('sales_leads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new')
        .is('assigned_to', null)
        .is('owner_agent', null)
        .is('original_assigned_to', null)
        .is('last_contacted_at', null)
        .or('pool_status.is.null,pool_status.eq.new')
        .or('call_count.is.null,call_count.eq.0')
        .or('pool_recycle_count.is.null,pool_recycle_count.eq.0')
        .or(`locked_by.is.null,locked_at.lt.${lockCutoff}`);

    const [live, morning, retry] = await Promise.all([
      base().eq('queue', 'live_open_pool'),
      base().eq('queue', 'morning_call_queue'),
      base().eq('queue', 'retry_queue'),
    ]);
    setCounts({
      live: live.count ?? 0,
      morning: morning.count ?? 0,
      retry: retry.count ?? 0,
    });
  };

  const loadLeads = async () => {
    setLoadingLeads(true);
    const lockCutoff = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, email, phone, vehicle_reg, lead_source, queue, created_at, original_assigned_to, payment_method, payment_amount, payment_date, last_activity_date, last_contacted_at, last_action_at')
      .eq('status', 'new')
      .is('assigned_to', null)
      .is('owner_agent', null)
      .is('original_assigned_to', null)
      .is('last_contacted_at', null)
      .or('pool_status.is.null,pool_status.eq.new')
      .or('call_count.is.null,call_count.eq.0')
      .or('pool_recycle_count.is.null,pool_recycle_count.eq.0')
      .or(`locked_by.is.null,locked_at.lt.${lockCutoff}`)
      .in('queue', ['live_open_pool', 'morning_call_queue', 'retry_queue'])
      .order('created_at', { ascending: false })
      .limit(500);
    setLeads((data as LeadRow[]) || []);
    setLoadingLeads(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead', 'lead_gen'])
        .order('first_name', { ascending: true });
      setAgents((data as AdminLite[]) || []);
    })();
    loadCounts();
    loadLeads();
  }, []);

  const displayName = (a: AdminLite) =>
    `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;

  const target = useMemo(() => agents.find((a) => a.id === targetId), [agents, targetId]);

  const handleAssign = async () => {
    if (!target) {
      toast({ title: 'Pick an agent first', variant: 'destructive' });
      return;
    }
    const n = Math.max(1, Math.min(50, parseInt(count, 10) || 0));
    const w = windowMode === 'none'
      ? 0
      : Math.max(5, Math.min(240, parseInt(minutes, 10) || 30));
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        'open_pool_bulk_assign_to_agent',
        { _target_admin_id: target.id, _count: n, _window_minutes: w },
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const assigned = row?.assigned_count ?? 0;
      if (assigned === 0) {
        toast({
          title: 'No Open Pool leads available',
          description: 'The Open Pool is empty or every lead is already locked.',
        });
      } else {
        toast({
          title: `Assigned ${assigned} lead${assigned === 1 ? '' : 's'} to ${displayName(target)}`,
          description: windowMode === 'none'
            ? `They'll sit in ${displayName(target)}'s My Leads with no time limit until they log an outcome.`
            : `They'll appear in ${displayName(target)}'s My Leads with a ${w}-minute call window. Unworked leads auto-return to Open Pool.`,
        });
      }
    } catch (e: any) {
      toast({
        title: 'Could not assign leads',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
      loadCounts();
      loadLeads();
    }
  };

  const handleDrainMorningQueue = async () => {
    setDraining(true);
    try {
      const { data, error } = await (supabase as any).rpc('open_pool_drain_morning_queue', { _max_leads: 500 });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const rr = row?.assigned_rr ?? 0;
      const pool = row?.assigned_pool ?? 0;
      if (rr === 0 && pool === 0) {
        toast({ title: 'Morning queue already drained', description: 'No unassigned leads left in the morning call queue.' });
      } else {
        toast({
          title: `Released ${rr + pool} morning-queue lead${rr + pool === 1 ? '' : 's'}`,
          description: `${rr} to round-robin agents, ${pool} to the Open Pool (self-serve).`,
        });
      }
    } catch (e: any) {
      toast({ title: 'Could not release morning queue', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setDraining(false);
      loadCounts();
      loadLeads();
    }
  };


  const freshTotal = counts ? counts.morning + counts.live : 0;
  const grandTotal = counts ? freshTotal + counts.retry : 0;

  return (
    <section className="rounded-lg border-2 border-primary/30 bg-primary/5 shadow-sm">
      <div className="px-5 py-4 flex items-start gap-2">
        <Users className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">Assign Open Pool Leads</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Hand a batch of unassigned Open Pool leads straight to a specific agent — useful when
            an agent is quiet and you don't want them waiting for round-robin distribution.
          </p>
          {counts && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-background px-2.5 py-1 font-semibold text-foreground">
                {grandTotal} available to assign
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-muted-foreground">
                Morning call queue: <strong className="text-foreground">{counts.morning}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-muted-foreground">
                Live Open Pool: <strong className="text-foreground">{counts.live}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-muted-foreground">
                Retry queue: <strong className="text-foreground">{counts.retry}</strong>
              </span>
              <span className="text-muted-foreground">
                (fresh only, excl. retry: <strong className="text-foreground">{freshTotal}</strong>)
              </span>
              <button
                type="button"
                onClick={() => { loadCounts(); loadLeads(); }}
                className="ml-1 text-primary underline-offset-2 hover:underline"
              >
                Refresh
              </button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDrainMorningQueue}
              disabled={draining || (counts?.morning ?? 0) === 0}
              className="gap-1.5 h-8"
              title="Alternately assigns morning-queue leads to round-robin agents and the Open Pool. Runs automatically at 09:00 UK Mon–Sat."
            >
              <Sunrise className="h-3.5 w-3.5" />
              {draining
                ? 'Releasing…'
                : `Release morning queue now${counts?.morning ? ` (${counts.morning})` : ''}`}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Auto-runs 09:00 UK, Mon–Sat. Alternates round-robin ↔ Open Pool.
            </span>
          </div>
        </div>
      </div>

      {/* Preview of leads waiting to be assigned */}
      <div className="px-5 pb-4">
        <div className="rounded-md border bg-background overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between border-b bg-muted/40">
            <div className="text-xs font-semibold text-foreground">
              Leads waiting to be assigned
              {leads.length > 0 && (
                <span className="ml-1 text-muted-foreground font-normal">
                  ({leads.length} shown)
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              None of these have a current owner. Rows marked{' '}
              <span className="text-amber-700 font-semibold">Reassigned</span> were assigned to
              someone previously but have since been released.
            </div>
          </div>
          {loadingLeads ? (
            <div className="px-3 py-6 text-xs text-muted-foreground text-center">Loading…</div>
          ) : leads.length === 0 ? (
            <div className="px-3 py-6 text-xs text-muted-foreground text-center">
              No unassigned leads in the pool right now.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-3 py-1.5 font-medium">Name</th>
                      <th className="px-3 py-1.5 font-medium">Phone</th>
                      <th className="px-3 py-1.5 font-medium">Email</th>
                      <th className="px-3 py-1.5 font-medium">Reg</th>
                      <th className="px-3 py-1.5 font-medium">Payment</th>
                      <th className="px-3 py-1.5 font-medium">Paid Date</th>
                      <th className="px-3 py-1.5 font-medium">Activity</th>
                      <th className="px-3 py-1.5 font-medium">Lead Date</th>
                      <th className="px-3 py-1.5 font-medium">History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAll ? leads : leads.slice(0, 3)).map((l) => {
                      const name =
                        [l.first_name, l.last_name].filter(Boolean).join(' ').trim() ||
                        <span className="text-muted-foreground italic">No name</span>;
                      const fmtDate = (iso: string | null) =>
                        iso
                          ? new Date(iso).toLocaleString('en-GB', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })
                          : '—';
                      const activity = l.last_activity_date || l.last_contacted_at || l.last_action_at;
                      const paymentLabel = l.payment_method
                        ? `${l.payment_method}${l.payment_amount != null ? ` · £${Number(l.payment_amount).toFixed(0)}` : ''}`
                        : '—';
                      return (
                        <tr key={l.id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-medium text-foreground">{name}</td>
                          <td className="px-3 py-1.5 text-foreground">{l.phone || '—'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[220px]">
                            {l.email || '—'}
                          </td>
                          <td className="px-3 py-1.5 uppercase tracking-wide text-foreground">
                            {l.vehicle_reg || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">{paymentLabel}</td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                            {fmtDate(l.payment_date)}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                            {fmtDate(activity)}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                            {fmtDate(l.created_at)}
                          </td>
                          <td className="px-3 py-1.5">
                            {l.original_assigned_to ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
                                Reassigned
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">
                                Never assigned
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {leads.length > 3 && (
                <div className="border-t px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {showAll
                      ? `Show only first 3`
                      : `Show all ${leads.length} waiting leads`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 grid grid-cols-1 md:grid-cols-[1fr,110px,150px,130px,auto] gap-3 items-end">
        <label className="text-xs font-medium space-y-1">
          <span className="text-muted-foreground">Agent</span>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger className="h-9 bg-background">
              <SelectValue placeholder="Choose an agent…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {displayName(a)} <span className="text-muted-foreground">· {a.role}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs font-medium space-y-1">
          <span className="text-muted-foreground">How many</span>
          <Input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="h-9 bg-background"
          />
        </label>
        <label className="text-xs font-medium space-y-1">
          <span className="text-muted-foreground">Time limit</span>
          <Select value={windowMode} onValueChange={(v) => setWindowMode(v as 'timer' | 'none')}>
            <SelectTrigger className="h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timer">Call window (timer)</SelectItem>
              <SelectItem value="none">No time limit</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs font-medium space-y-1">
          <span className="text-muted-foreground">
            {windowMode === 'none' ? 'Minutes (n/a)' : 'Call window (min)'}
          </span>
          <Input
            type="number"
            min={5}
            max={240}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            disabled={windowMode === 'none'}
            className="h-9 bg-background"
          />
        </label>
        <Button onClick={handleAssign} disabled={busy || !targetId} className="gap-1.5 h-9">
          <Send className="h-3.5 w-3.5" />
          {busy ? 'Assigning…' : 'Assign now'}
        </Button>
      </div>
      <p className="px-5 pb-4 text-[11px] text-muted-foreground leading-snug">
        <strong>Call window</strong>: lead auto-returns to Open Pool if the agent hasn't logged an
        outcome in time. <strong>No time limit</strong>: lead stays with the agent until they log
        an outcome themselves. Each agent row below also has a <strong>Push</strong> button for the
        same actions.
      </p>
    </section>
  );
};

export default AssignOpenPoolCard;
