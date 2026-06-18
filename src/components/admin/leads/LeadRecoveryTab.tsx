import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Phone, Mail, Gem, Loader2, CheckCircle2, AlertCircle, Trophy, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { CallCountCell } from './CallCountCell';
import { InlineQuickNote } from './InlineQuickNote';
import { RemindMePopover } from './RemindMePopover';
import type { LeadStatus } from '@/hooks/useLeads';

type SegmentId =
  | 'never_contacted'
  | 'quote_cold'
  | 'stalled'
  | 'abandoned_cart'
  | 'all_aged';

const SEGMENTS: { id: SegmentId; label: string; description: string }[] = [
  { id: 'never_contacted', label: 'Never Contacted', description: 'Created >30 days ago, 0 calls, 0 notes' },
  { id: 'quote_cold', label: 'Quote Sent, Cold', description: 'Quote sent but no reply in 14+ days' },
  { id: 'stalled', label: 'Contacted, Stalled', description: 'Last contact >30 days, status still active' },
  { id: 'abandoned_cart', label: 'Abandoned Cart', description: 'Cart >7 days old, no order' },
  { id: 'all_aged', label: 'All Aged', description: 'Master list, oldest first' },
];

const OUTCOMES = [
  { value: 'revived', label: 'Revived' },
  { value: 'still_trying', label: 'Still trying' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'mark_lost', label: 'Mark lost' },
  { value: 'not_interested', label: 'Not interested' },
];

const PAGE_SIZE = 100;
const UNASSIGNED = '__unassigned__';

type Agent = {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function ageBadge(days: number | null) {
  if (days == null) return <Badge variant="outline">—</Badge>;
  if (days >= 60) return <Badge className="bg-red-100 text-red-800 border-red-200">{days}d</Badge>;
  if (days >= 30) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{days}d</Badge>;
  return <Badge variant="outline">{days}d</Badge>;
}

function agentLabel(a: Agent | undefined): string {
  if (!a) return 'Unassigned';
  const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
  return name || a.email || 'Agent';
}

export const LeadRecoveryTab: React.FC = () => {
  const [segment, setSegment] = useState<SegmentId>('never_contacted');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<SegmentId, number>>({} as any);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [myOnly, setMyOnly] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Record<string, { worked: number; converted: number }>>({});

  // Auth bootstrap
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        const { data: au } = await (supabase.from('admin_users') as any)
          .select('role')
          .eq('user_id', uid)
          .maybeSingle();
        setCurrentRole(au?.role ?? null);
      }
    })();
  }, []);

  // Agent list — sales-side roles + admin/super_admin so managers can be picked too
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from('admin_users') as any)
        .select('id, user_id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead', 'admin', 'super_admin'])
        .eq('is_active', true)
        .order('first_name');
      setAgents((data as Agent[]) || []);
    })();
  }, []);

  // Map admin_users.id <-> user_id (auth) for assignment writes / leaderboard reads
  const agentByAuthId = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents) if (a.user_id) m.set(a.user_id, a);
    return m;
  }, [agents]);

  const canReassignAny = currentRole === 'admin' || currentRole === 'super_admin' || currentRole === 'sales_lead';

  const buildBaseQuery = useCallback(() => {
    const select =
      'id, first_name, last_name, email, phone, lead_source, status, priority, priority_score, ' +
      'plan_interest, cart_value, quote_amount, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, ' +
      'vehicle_type, mileage, assigned_to, assigned_at, next_action_type, next_action_date, follow_up_status, ' +
      'last_activity_date, last_contacted_at, notes, converted_at, lost_at, lost_reason, abandoned_cart_id, ' +
      'created_at, updated_at, is_paid, payment_amount, payment_method, payment_date, step_two_completed_at, ' +
      'plan_name, payment_type, step_abandoned, contact_status, is_from_abandoned_cart, call_count, is_callback, ' +
      'cart_metadata, application_count, resubmission_count, last_resubmitted_at, recovery_worked_at, recovery_outcome';

    const q = (supabase.from('sales_leads') as any).select(select);

    return q
      .not('status', 'in', '(lost,converted,fake_lead,archived)')
      .or('is_paid.is.null,is_paid.eq.false');
  }, []);

  const applySegment = useCallback((q: any, id: SegmentId) => {
    const now = Date.now();
    const d30 = new Date(now - 30 * 86400000).toISOString();
    const d14 = new Date(now - 14 * 86400000).toISOString();
    const d7 = new Date(now - 7 * 86400000).toISOString();

    switch (id) {
      case 'never_contacted':
        return q.lt('created_at', d30).is('last_contacted_at', null);
      case 'quote_cold':
        return q.not('quote_amount', 'is', null)
          .or(`last_contacted_at.is.null,last_contacted_at.lt.${d14}`);
      case 'stalled':
        return q.lt('last_contacted_at', d30);
      case 'abandoned_cart':
        return q.not('abandoned_cart_id', 'is', null).lt('created_at', d7);
      case 'all_aged':
      default:
        return q.lt('created_at', d30);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let q = buildBaseQuery();
      q = applySegment(q, segment);
      q = q.order('recovery_worked_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true })
        .limit(PAGE_SIZE);
      const { data, error } = await q;
      if (error) throw error;
      setLeads((data as any) || []);
    } catch (e: any) {
      toast.error('Failed to load Goldmine leads', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [buildBaseQuery, applySegment, segment]);

  const fetchCounts = useCallback(async () => {
    const results = await Promise.all(
      SEGMENTS.map(async (s) => {
        try {
          let q: any = (supabase.from('sales_leads') as any)
            .select('id', { count: 'exact', head: true })
            .not('status', 'in', '(lost,converted,fake_lead,archived)')
            .or('is_paid.is.null,is_paid.eq.false');
          q = applySegment(q, s.id);
          const { count } = await q;
          return [s.id, count || 0] as const;
        } catch {
          return [s.id, 0] as const;
        }
      })
    );
    setCounts(Object.fromEntries(results) as any);
  }, [applySegment]);

  // Leaderboard — today's recovery_attempts + converted leads per agent
  const fetchLeaderboard = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [acts, conv] = await Promise.all([
      (supabase.from('lead_activities') as any)
        .select('performed_by')
        .eq('activity_type', 'recovery_attempt')
        .gte('created_at', startOfDay.toISOString())
        .limit(2000),
      (supabase.from('sales_leads') as any)
        .select('assigned_to, converted_at')
        .eq('status', 'converted')
        .gte('converted_at', startOfDay.toISOString())
        .limit(2000),
    ]);

    const board: Record<string, { worked: number; converted: number }> = {};
    for (const a of (acts.data as Array<{ performed_by: string | null }> | null) || []) {
      const k = a.performed_by ?? 'unknown';
      board[k] = board[k] || { worked: 0, converted: 0 };
      board[k].worked += 1;
    }
    for (const c of (conv.data as Array<{ assigned_to: string | null }> | null) || []) {
      const k = c.assigned_to ?? 'unknown';
      board[k] = board[k] || { worked: 0, converted: 0 };
      board[k].converted += 1;
    }
    setLeaderboard(board);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => {
    fetchLeaderboard();
    const t = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(t);
  }, [fetchLeaderboard]);

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (myOnly && currentUserId) {
      list = list.filter((l) => l.assigned_to === currentUserId);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((l) =>
        [l.first_name, l.last_name, l.email, l.phone, l.vehicle_reg, l.vehicle_make, l.vehicle_model]
          .some((v) => (v || '').toString().toLowerCase().includes(s))
      );
    }
    return list;
  }, [leads, search, myOnly, currentUserId]);

  const logActivity = useCallback(
    async (leadId: string, type: string, description: string) => {
      await (supabase.from('lead_activities') as any).insert({
        lead_id: leadId,
        activity_type: type,
        description,
        performed_by: currentUserId,
      });
    },
    [currentUserId]
  );

  const updateCallCount = useCallback(async (leadId: string, increment: number) => {
    const lead = leads.find((l) => l.id === leadId);
    const newCount = Math.max(0, (lead?.call_count || 0) + increment);
    const { error } = await (supabase.from('sales_leads') as any)
      .update({ call_count: newCount, last_contacted_at: new Date().toISOString() })
      .eq('id', leadId);
    if (error) { toast.error('Could not update calls', { description: error.message }); return; }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, call_count: newCount, last_contacted_at: new Date().toISOString() } as any : l)));
  }, [leads]);

  const updateLeadStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    const { error } = await (supabase.from('sales_leads') as any)
      .update({ status })
      .eq('id', leadId);
    if (error) { toast.error('Could not update status', { description: error.message }); return; }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } as any : l)));
  }, []);

  const scheduleFollowUp = useCallback(async (leadId: string, actionType: string, actionDate: string) => {
    const { error } = await (supabase.from('sales_leads') as any)
      .update({ next_action_type: actionType, next_action_date: actionDate, follow_up_status: 'scheduled' })
      .eq('id', leadId);
    if (error) { toast.error('Could not schedule follow-up', { description: error.message }); return; }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, next_action_type: actionType, next_action_date: actionDate } as any : l)));
    toast.success('Follow-up scheduled');
  }, []);


  const canReassign = useCallback(
    (lead: Lead) => canReassignAny || lead.assigned_to === currentUserId || !lead.assigned_to,
    [canReassignAny, currentUserId]
  );

  const reassign = useCallback(
    async (lead: Lead, newAuthId: string | null) => {
      try {
        const previous = lead.assigned_to ?? null;
        const { error } = await (supabase.from('sales_leads') as any)
          .update({ assigned_to: newAuthId, assigned_at: newAuthId ? new Date().toISOString() : null })
          .eq('id', lead.id);
        if (error) throw error;

        await (supabase.from('lead_assignment_audit') as any).insert({
          lead_id: lead.id,
          previous_assigned_to: previous,
          new_assigned_to: newAuthId,
          changed_by: currentUserId,
          source: 'goldmine_manual',
        }).then(() => {}, () => {});

        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, assigned_to: newAuthId } as any : l))
        );
        toast.success(newAuthId ? 'Reassigned' : 'Unassigned');
      } catch (e: any) {
        toast.error('Could not reassign', { description: e.message });
      }
    },
    [currentUserId]
  );

  const markWorked = useCallback(
    async (lead: Lead, outcome?: string) => {
      try {
        const updates: any = { recovery_worked_at: new Date().toISOString() };
        if (outcome) updates.recovery_outcome = outcome;
        const { error } = await (supabase.from('sales_leads') as any)
          .update(updates)
          .eq('id', lead.id);
        if (error) throw error;

        await logActivity(
          lead.id,
          'recovery_attempt',
          outcome ? `Goldmine attempt — outcome: ${outcome}` : 'Goldmine attempt logged'
        );

        if (outcome === 'mark_lost' || outcome === 'not_interested') {
          const reason = outcome === 'mark_lost' ? 'Goldmine: unable to revive' : 'Goldmine: not interested';
          await (supabase.from('sales_leads') as any)
            .update({ status: 'lost', lost_at: new Date().toISOString(), lost_reason: reason })
            .eq('id', lead.id);
        }

        toast.success('Worked', { description: outcome ? `Outcome: ${outcome}` : 'Logged Goldmine attempt' });
        fetchLeaderboard();
        setLeads((prev) =>
          outcome === 'mark_lost' || outcome === 'not_interested'
            ? prev.filter((l) => l.id !== lead.id)
            : prev.map((l) => (l.id === lead.id ? { ...l, recovery_worked_at: updates.recovery_worked_at } as any : l))
        );
      } catch (e: any) {
        toast.error('Could not mark as worked', { description: e.message });
      }
    },
    [logActivity, fetchLeaderboard]
  );

  // Sorted leaderboard rows
  const leaderboardRows = useMemo(() => {
    return agents
      .map((a) => {
        const stats = a.user_id ? leaderboard[a.user_id] : undefined;
        return {
          agent: a,
          worked: stats?.worked || 0,
          converted: stats?.converted || 0,
        };
      })
      .filter((r) => r.worked > 0 || r.converted > 0)
      .sort((a, b) => b.converted - a.converted || b.worked - a.worked)
      .slice(0, 8);
  }, [agents, leaderboard]);

  const myStats = useMemo(() => {
    if (!currentUserId) return { worked: 0, converted: 0 };
    return leaderboard[currentUserId] || { worked: 0, converted: 0 };
  }, [leaderboard, currentUserId]);

  const currentSegment = SEGMENTS.find((s) => s.id === segment)!;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Gem className="h-6 w-6 text-primary" />
            Goldmine Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            High-value aged leads — auto-assigned via round-robin from the live pipeline. Whole team can see them so the leaderboard stays honest.
          </p>
        </div>
        <Card className="border-primary/30">
          <CardContent className="py-3 px-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-xs text-muted-foreground">Worked today</div>
                <div className="text-xl font-semibold">{myStats.worked}</div>
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <div>
                <div className="text-xs text-muted-foreground">Converted today</div>
                <div className="text-xl font-semibold">{myStats.converted}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team leaderboard strip */}
      {leaderboardRows.length > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Team scoreboard — today</span>
              <span className="text-xs text-muted-foreground">refreshes every 30s</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {leaderboardRows.map((r, idx) => {
                const isMe = r.agent.user_id === currentUserId;
                return (
                  <div
                    key={r.agent.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs ${
                      isMe ? 'border-primary bg-primary/10 font-medium' : 'bg-muted/40'
                    }`}
                  >
                    {idx === 0 && <Trophy className="h-3 w-3 text-amber-500" />}
                    <span>{agentLabel(r.agent)}</span>
                    <Badge variant="secondary" className="h-5">{r.converted} won</Badge>
                    <Badge variant="outline" className="h-5">{r.worked} worked</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={segment} onValueChange={(v) => setSegment(v as SegmentId)}>
        <TabsList className="w-full justify-start flex-wrap h-auto">
          {SEGMENTS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="gap-2">
              {s.label}
              <Badge variant="secondary" className="ml-1">{counts[s.id] ?? '…'}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={segment} className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{currentSegment.description}</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="my-only" checked={myOnly} onCheckedChange={setMyOnly} />
                <Label htmlFor="my-only" className="text-sm cursor-pointer">My leads only</Label>
              </div>
              <Input
                placeholder="Search name, email, phone, reg…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading Goldmine leads…
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No leads in this segment right now.
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Lead</th>
                      <th className="text-left p-3">Contact</th>
                      <th className="text-left p-3">Vehicle</th>
                      <th className="text-left p-3">Cart / Quote</th>
                      <th className="text-left p-3">Source</th>
                      <th className="text-left p-3">Age</th>
                      <th className="text-left p-3">Last touched</th>
                      <th className="text-left p-3">Calls</th>
                      <th className="text-left p-3 min-w-[200px]">Quick note</th>
                      <th className="text-left p-3">Assigned</th>
                      <th className="text-left p-3">Last worked</th>
                      <th className="text-right p-3 min-w-[260px]">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLeads.map((lead) => {
                      const ageDays = daysSince(lead.created_at);
                      const lastTouchedDays = daysSince(lead.last_contacted_at);
                      const lastWorked = (lead as any).recovery_worked_at as string | null;
                      const assignedAgent = lead.assigned_to ? agentByAuthId.get(lead.assigned_to) : undefined;
                      const mayReassign = canReassign(lead);
                      return (
                        <tr key={lead.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(lead)}>
                          <td className="p-3">
                            <div className="font-medium">
                              {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {lead.status} · {lead.call_count || 0} calls
                            </div>
                          </td>
                          <td className="p-3 text-xs">
                            {lead.phone && (
                              <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</div>
                            )}
                            {lead.email && (
                              <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{lead.email}</div>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            <div>{[lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ') || '—'}</div>
                            <div className="text-muted-foreground">{lead.vehicle_reg || ''} {lead.vehicle_year ? `· ${lead.vehicle_year}` : ''}</div>
                          </td>
                          <td className="p-3 text-xs">
                            {lead.cart_value != null && (
                              <div className="font-medium">£{Number(lead.cart_value).toFixed(0)}</div>
                            )}
                            {lead.quote_amount != null && (
                              <div className="text-muted-foreground">Quote £{Number(lead.quote_amount).toFixed(0)}</div>
                            )}
                            {lead.plan_interest && (
                              <Badge variant="outline" className="text-[10px] mt-1">{lead.plan_interest}</Badge>
                            )}
                            {!lead.cart_value && !lead.quote_amount && !lead.plan_interest && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-xs">{lead.lead_source || '—'}</td>
                          <td className="p-3">{ageBadge(ageDays)}</td>
                          <td className="p-3">{ageBadge(lastTouchedDays)}</td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <CallCountCell
                              lead={lead}
                              onUpdateCallCount={(inc) => updateCallCount(lead.id, inc)}
                              onUpdateStatus={(s) => updateLeadStatus(lead.id, s)}
                              onScheduleFollowUp={(t, d) => scheduleFollowUp(lead.id, t, d)}
                              onLogActivity={(t, d) => logActivity(lead.id, t, d)}
                            />
                          </td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <InlineQuickNote leadId={lead.id} />
                          </td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            {mayReassign ? (
                              <Select
                                value={lead.assigned_to ?? UNASSIGNED}
                                onValueChange={(v) => reassign(lead, v === UNASSIGNED ? null : v)}
                              >
                                <SelectTrigger className="h-8 w-[160px]">
                                  <SelectValue placeholder="Assign…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                                  {agents.map((a) => (
                                    a.user_id ? (
                                      <SelectItem key={a.id} value={a.user_id}>
                                        {agentLabel(a)}
                                      </SelectItem>
                                    ) : null
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex items-center gap-1 text-xs">
                                <UserCircle2 className="h-3 w-3 text-muted-foreground" />
                                {agentLabel(assignedAgent)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {lastWorked ? formatDistanceToNow(new Date(lastWorked), { addSuffix: true }) : 'Never'}
                            {(lead as any).recovery_outcome && (
                              <div className="text-[10px] capitalize">{((lead as any).recovery_outcome as string).replace(/_/g, ' ')}</div>
                            )}
                          </td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <RemindMePopover leadId={lead.id} compact />
                              <Select onValueChange={(v) => markWorked(lead, v)}>
                                <SelectTrigger className="h-8 w-[140px]">
                                  <SelectValue placeholder="Outcome…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {OUTCOMES.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="outline" onClick={() => markWorked(lead)}>
                                Worked
                              </Button>
                            </div>
                          </td>
                        </tr>

                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected && (
                <span>
                  {[selected.first_name, selected.last_name].filter(Boolean).join(' ') || selected.email}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    Created {format(new Date(selected.created_at), 'd MMM yyyy')}
                  </span>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <LeadDetailsPanel
              lead={selected}
              onLogActivity={logActivity}
              onRefresh={() => { fetchLeads(); fetchCounts(); fetchLeaderboard(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadRecoveryTab;
