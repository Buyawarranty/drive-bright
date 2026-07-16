import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, Users, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';

/**
 * Live Open Pool banner for managers. Shows the current unclaimed pool count,
 * lets a manager auto-distribute leads to active round-robin / open-pool agents
 * according to their remaining daily caps, and offers manual reallocation.
 */

interface AgentOption {
  admin_user_id: string;
  name: string;
  mode: 'round_robin' | 'open_pool' | null;
  paused: boolean;
  daily_cap: number | null;
  assigned_today: number;
  remaining: number;
}

const THRESHOLD = 20;
const REASSIGN_WINDOW_MINUTES = 60 * 24 * 90; // 90 days
const AUTO_SWEEP_KEY = 'open_pool_auto_distribute';
const AUTO_SWEEP_INTERVAL_MS = 30_000;

interface Props {
  canEdit: boolean;
  admins: Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>;
  caps: Array<{
    admin_user_id: string;
    paused: boolean;
    assignment_mode?: 'round_robin' | 'open_pool' | null;
    daily_cap?: number | null;
    assigned_today?: number | null;
  }>;
}


export const OpenPoolBacklogBanner = ({ canEdit, admins, caps }: Props) => {
  const [poolCount, setPoolCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [countToMove, setCountToMove] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  const loadCount = useCallback(async () => {
    setLoading(true);
    const { count } = await (supabase as any)
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .eq('queue', 'live_open_pool')
      .is('assigned_to', null)
      .is('owner_agent', null)
      .not('status', 'in', '(lost,converted,fake_lead,archived)');
    setPoolCount(count ?? 0);
    setLoading(false);
  }, []);

  const loadRows = useCallback(async () => {
    setRowsLoading(true);
    const { data } = await (supabase as any)
      .from('sales_leads')
      .select('id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, lead_source, status, call_count, last_contacted_at, last_activity_date, created_at, notes, quote_amount, cart_value, pool_recycle_count')
      .eq('queue', 'live_open_pool')
      .is('assigned_to', null)
      .is('owner_agent', null)
      .not('status', 'in', '(lost,converted,fake_lead,archived)')
      .order('created_at', { ascending: false })
      .limit(500);

    const baseRows = data || [];
    const normalize = (s: string | null | undefined) => (s || '').replace(/\D/g, '').replace(/^0+/, '');
    const leadIds = baseRows.map((r: any) => r.id);
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString();

    const [zoiperRes, phoneEvRes, callLogRes, quickNoteRes] = await Promise.all([
      (supabase as any)
        .from('zoiper_call_events')
        .select('dialed_number, started_at, talk_seconds, status, agent_email')
        .gte('started_at', since)
        .limit(5000),
      (supabase as any)
        .from('phone_events')
        .select('phone_number, event_type, selected_outcome, agent_name, created_at')
        .gte('created_at', since)
        .limit(5000),
      leadIds.length
        ? (supabase as any)
            .from('lead_call_logs')
            .select('lead_id, outcome, notes, agent_name, created_at')
            .in('lead_id', leadIds)
        : Promise.resolve({ data: [] }),
      leadIds.length
        ? (supabase as any)
            .from('lead_quick_notes')
            .select('lead_id, note, author_name, created_at')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const zoiperByPhone: Record<string, any[]> = {};
    (zoiperRes.data || []).forEach((z: any) => {
      const k = normalize(z.dialed_number);
      if (k) (zoiperByPhone[k] ||= []).push(z);
    });
    const phoneEvByPhone: Record<string, any[]> = {};
    (phoneEvRes.data || []).forEach((p: any) => {
      const k = normalize(p.phone_number);
      if (k) (phoneEvByPhone[k] ||= []).push(p);
    });
    const callLogsByLead: Record<string, any[]> = {};
    (callLogRes.data || []).forEach((c: any) => {
      (callLogsByLead[c.lead_id] ||= []).push(c);
    });
    const quickNotesByLead: Record<string, any[]> = {};
    (quickNoteRes.data || []).forEach((n: any) => {
      (quickNotesByLead[n.lead_id] ||= []).push(n);
    });

    const matchPhone = (leadKey: string, bucket: Record<string, any[]>) => {
      if (!leadKey) return [];
      const hits: any[] = [];
      for (const k of Object.keys(bucket)) {
        if (k === leadKey || k.endsWith(leadKey) || leadKey.endsWith(k)) hits.push(...bucket[k]);
      }
      return hits;
    };

    const enriched = baseRows.map((r: any) => {
      const key = normalize(r.phone);
      const zs = matchPhone(key, zoiperByPhone);
      const talked = zs.filter(z => (z.talk_seconds ?? 0) > 0);
      const lastZ = zs.reduce((m: any, z: any) => (!m || new Date(z.started_at) > new Date(m.started_at) ? z : m), null);
      const pes = matchPhone(key, phoneEvByPhone);
      const cls = callLogsByLead[r.id] || [];
      const qns = quickNotesByLead[r.id] || [];
      const agentNoteParts = [
        ...qns.map((n: any) => `${n.author_name || 'Agent'}: ${n.note}`),
        ...cls.filter((c: any) => c.notes).map((c: any) => `${c.agent_name || 'Agent'} (${c.outcome}): ${c.notes}`),
      ];
      return {
        ...r,
        _zoiperCalls: zs.length,
        _zoiperTalked: talked.length,
        _lastZoiperAt: lastZ?.started_at || null,
        _phoneEvents: pes.length,
        _callLogs: cls.length,
        _agentNotes: agentNoteParts.join(' • '),
      };
    });

    setRows(enriched);
    setRowsLoading(false);
  }, []);

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 30_000);
    return () => clearInterval(t);
  }, [loadCount]);

  useEffect(() => {
    if (expanded) loadRows();
  }, [expanded, loadRows, poolCount]);

  // Realtime — refresh whenever a pool row moves.
  useEffect(() => {
    const ch = supabase
      .channel('open-pool-backlog-banner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_leads', filter: 'queue=eq.live_open_pool' },
        () => loadCount(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadCount]);

  const agentOptions = useMemo<AgentOption[]>(() => {
    const byId = new Map(admins.map(a => [a.id, a]));
    return caps
      .filter(c => !c.paused && (c.assignment_mode === 'round_robin' || c.assignment_mode === 'open_pool'))
      .map(c => {
        const a = byId.get(c.admin_user_id);
        const name = a ? ([a.first_name, a.last_name].filter(Boolean).join(' ') || a.email) : 'Unknown agent';
        const daily_cap = (c.daily_cap ?? null) as number | null;
        const assigned_today = c.assigned_today ?? 0;
        const remaining = daily_cap == null ? Number.POSITIVE_INFINITY : Math.max(0, daily_cap - assigned_today);
        return {
          admin_user_id: c.admin_user_id,
          name,
          mode: (c.assignment_mode ?? null) as AgentOption['mode'],
          paused: c.paused,
          daily_cap,
          assigned_today,
          remaining,
        };
      })
      .filter(o => !!byId.get(o.admin_user_id))
      .sort((a, b) => {
        if (a.mode !== b.mode) return a.mode === 'round_robin' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [admins, caps]);


  const openDialog = () => {
    setCountToMove(poolCount);
    setTargetAgentId(agentOptions[0]?.admin_user_id ?? '');
    setOpen(true);
  };

  const reassign = async () => {
    if (!targetAgentId || countToMove <= 0) return;
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('open_pool_bulk_assign_to_agent', {
        _target_admin_id: targetAgentId,
        _count: countToMove,
        _window_minutes: REASSIGN_WINDOW_MINUTES,
      });
      if (error) throw error;
      const assigned = Array.isArray(data) ? (data[0]?.assigned_count ?? 0) : 0;
      const target = agentOptions.find(a => a.admin_user_id === targetAgentId);
      toast({
        title: 'Leads reassigned',
        description: `${assigned} lead${assigned === 1 ? '' : 's'} moved to ${target?.name ?? 'agent'}.`,
      });
      setOpen(false);
      loadCount();
    } catch (e: any) {
      toast({
        title: 'Reassignment failed',
        description: e?.message ?? 'Could not reassign pool leads.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canEdit) return null;
  if (poolCount < THRESHOLD) return null;

  const fmt = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <>
      <div className="rounded-lg border-2 border-amber-500 bg-amber-50 shadow-sm">
        <div className="p-4 flex items-start gap-3">
          <div className="mt-0.5">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-amber-900">
                {poolCount} leads sitting in the Open Pool
              </h3>
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-200 px-2 py-0.5 rounded">
                Action needed
              </span>
            </div>
            <p className="text-sm text-amber-900/90 mt-1">
              These leads are unclaimed and going cold. Reallocate them to a round-robin agent or an active open-pool agent before you lose them.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(v => !v)}
              className="h-9 border-amber-300 bg-white hover:bg-amber-100 gap-1"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? 'Hide leads' : 'View all leads'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { loadCount(); if (expanded) loadRows(); }}
              disabled={loading}
              className="h-9 border-amber-300 bg-white hover:bg-amber-100"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="sm"
              onClick={openDialog}
              className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              <Users className="h-4 w-4" /> Reallocate leads
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-amber-300 bg-white rounded-b-lg">
            {rowsLoading ? (
              <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading pool leads…
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No leads to display.</div>
            ) : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-amber-100/70 sticky top-0 z-10">
                    <tr className="text-left text-amber-900">
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Phone</th>
                      <th className="px-3 py-2 font-semibold">Vehicle</th>
                      <th className="px-3 py-2 font-semibold">Source</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold text-center" title="Zoiper calls / talked (last 60 days)">Rung?</th>
                      <th className="px-3 py-2 font-semibold">Last Zoiper call</th>
                      <th className="px-3 py-2 font-semibold text-center">Calls</th>
                      <th className="px-3 py-2 font-semibold text-center">Recycles</th>
                      <th className="px-3 py-2 font-semibold">Last contact</th>
                      <th className="px-3 py-2 font-semibold">Last activity</th>
                      <th className="px-3 py-2 font-semibold">Created</th>
                      <th className="px-3 py-2 font-semibold text-right">Quote</th>
                      <th className="px-3 py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || '—';
                      const vehicle = [r.vehicle_reg, [r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '—';
                      const quote = r.quote_amount ?? r.cart_value;
                      const rung = r._zoiperCalls > 0;
                      const spoke = r._zoiperTalked > 0;
                      const combinedNotes = [r.notes, r._agentNotes].filter(Boolean).join(' • ');
                      return (
                        <tr key={r.id} className={i % 2 ? 'bg-amber-50/40' : 'bg-white'}>
                          <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{name}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.email || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.phone || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{vehicle}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.lead_source || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.status || '—'}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {rung ? (
                              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${spoke ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                                {spoke ? '✅ Spoke' : '📞 Tried'} · {r._zoiperCalls}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(r._lastZoiperAt)}</td>
                          <td className="px-3 py-2 text-center">{r.call_count ?? 0}</td>
                          <td className="px-3 py-2 text-center">{r.pool_recycle_count ?? 0}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(r.last_contacted_at)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(r.last_activity_date)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmt(r.created_at)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{quote != null ? `£${Number(quote).toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 max-w-xs truncate" title={combinedNotes || ''}>{combinedNotes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-xs text-muted-foreground border-t border-amber-200">
                  Showing {rows.length} of {poolCount} pool lead{poolCount === 1 ? '' : 's'}{rows.length >= 500 ? ' (capped at 500)' : ''}.
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reallocate Open Pool leads</DialogTitle>
            <DialogDescription>
              Move unclaimed pool leads directly to an agent. Round-robin agents get them as normal assignments; open-pool agents receive them as personal reservations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Target agent</label>
              <Select value={targetAgentId} onValueChange={setTargetAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agentOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No active round-robin or open-pool agents found.
                    </div>
                  ) : (
                    agentOptions.map(a => (
                      <SelectItem key={a.admin_user_id} value={a.admin_user_id}>
                        {a.name} · {a.mode === 'round_robin' ? 'Round Robin' : 'Open Pool'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">How many leads?</label>
              <Input
                type="number"
                min={1}
                max={poolCount}
                value={countToMove}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(poolCount, Number(e.target.value) || 0));
                  setCountToMove(n);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {poolCount} lead{poolCount === 1 ? '' : 's'} available in the pool.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={reassign} disabled={submitting || !targetAgentId || countToMove <= 0}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Reassigning…</>
              ) : (
                <>Move {countToMove} lead{countToMove === 1 ? '' : 's'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OpenPoolBacklogBanner;
