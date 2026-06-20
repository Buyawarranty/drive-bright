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
import { Phone, Mail, RefreshCw, Loader2, CheckCircle2, AlertCircle, Trophy, UserCircle2, CalendarClock, TrendingUp, Database, Network, Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { CallCountCell } from './CallCountCell';
import { InlineQuickNote } from './InlineQuickNote';
import { RemindMePopover } from './RemindMePopover';
import type { LeadStatus } from '@/hooks/useLeads';

type SegmentId =
  | 'due_today'
  | 'new_to_recontact'
  | 'no_answer'
  | 'interested'
  | 'quote_sent'
  | 'abandoned_checkout'
  | 'not_interested'
  | 'all_leads';

const SEGMENTS: { id: SegmentId; label: string; description: string }[] = [
  { id: 'due_today',          label: 'Due Today',          description: 'Callbacks scheduled for today — work these first.' },
  { id: 'new_to_recontact',   label: 'New to Recontact',   description: 'Old enquiries (30+ days) that have never been worked.' },
  { id: 'no_answer',          label: 'No Answer',          description: 'Previously called but no response yet.' },
  { id: 'interested',         label: 'Interested',         description: 'Customer showed interest — needs follow-up.' },
  { id: 'quote_sent',         label: 'Quote Sent',         description: 'Price/quote already sent — needs chasing.' },
  { id: 'abandoned_checkout', label: 'Abandoned Checkout', description: 'Started an order/cart but did not pay.' },
  { id: 'not_interested',     label: 'Not Interested',     description: 'Kept for record — not active.' },
  { id: 'all_leads',          label: 'All Leads',          description: 'Full recontact database, oldest first.' },
];

const OUTCOMES = [
  { value: 'no_answer',         label: 'No answer' },
  { value: 'left_voicemail',    label: 'Left voicemail' },
  { value: 'wrong_number',      label: 'Wrong number' },
  { value: 'interested',        label: 'Interested' },
  { value: 'needs_callback',    label: 'Needs callback' },
  { value: 'quote_sent',        label: 'Quote sent' },
  { value: 'converted',         label: 'Converted' },
  { value: 'not_interested',    label: 'Not interested' },
  { value: 'bought_elsewhere',  label: 'Bought elsewhere' },
  { value: 'vehicle_sold',      label: 'Vehicle sold' },
  { value: 'do_not_contact',    label: 'Do not contact' },
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

export const LeadRecoveryTab: React.FC<{ userRole?: string | null; onNavigateToTab?: (tab: string) => void }> = ({ userRole, onNavigateToTab }) => {
  const canSeeSource = userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager' || userRole === 'lead_gen';
  const [segment, setSegment] = useState<SegmentId>('due_today');
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

  // Agent list — sales-side roles + admin/super_admin so managers can be picked too.
  // Prefer agents flagged with the "Recontact" workstream on the Lead Teams page.
  // Fallback: if no agents have been opted into the workstream yet, show all
  // sales/sales_lead agents so the page stays usable (admins/super_admins always pass).
  useEffect(() => {
    (async () => {
      const [{ data: au }, { data: ws }] = await Promise.all([
        (supabase.from('admin_users') as any)
          .select('id, user_id, first_name, last_name, email, role, is_active')
          .in('role', ['sales', 'sales_lead', 'admin', 'super_admin'])
          .eq('is_active', true)
          .order('first_name'),
        (supabase.from('lead_team_members') as any)
          .select('admin_user_id, workstream_recontact'),
      ]);
      const recontactSet = new Set<string>(
        ((ws as any[]) || [])
          .filter((r: any) => r.workstream_recontact === true)
          .map((r: any) => r.admin_user_id)
      );
      const all = (au as Agent[]) || [];
      const hasAnyFlagged = recontactSet.size > 0;
      const filtered = all.filter(a => {
        if (a.role === 'admin' || a.role === 'super_admin') return true;
        if (!hasAnyFlagged) return true; // fallback while workstreams are unconfigured
        return recontactSet.has(a.id);
      });
      setAgents(filtered);
    })();
  }, []);


  // Map admin_users.id <-> user_id (auth) for assignment writes / leaderboard reads
  const agentByAuthId = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents) if (a.user_id) m.set(a.user_id, a);
    return m;
  }, [agents]);

  const canReassignAny = currentRole === 'admin' || currentRole === 'super_admin' || currentRole === 'sales_lead';
  const canExportCsv = currentRole === 'admin' || currentRole === 'super_admin' || currentRole === 'sales_lead' || currentRole === 'sales_manager';

  const buildBaseQuery = useCallback(() => {
    const select =
      'id, first_name, last_name, email, phone, lead_source, status, priority, priority_score, ' +
      'plan_interest, cart_value, quote_amount, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, ' +
      'vehicle_type, mileage, assigned_to, assigned_at, next_action_type, next_action_date, follow_up_status, ' +
      'last_activity_date, last_contacted_at, notes, converted_at, lost_at, lost_reason, abandoned_cart_id, ' +
      'created_at, updated_at, is_paid, payment_amount, payment_method, payment_date, step_two_completed_at, ' +
      'call_count, resubmission_count, last_resubmitted_at, is_callback, recovery_worked_at, recovery_outcome';

    const q = (supabase.from('sales_leads') as any).select(select);

    return q
      .not('step_two_completed_at', 'is', null)
      .not('status', 'in', '(converted,fake_lead,archived)')
      .or('is_paid.is.null,is_paid.eq.false');
  }, []);

  const applySegment = useCallback((q: any, id: SegmentId) => {
    const now = Date.now();
    const d30 = new Date(now - 30 * 86400000).toISOString();
    const d14 = new Date(now - 14 * 86400000).toISOString();
    const d7 = new Date(now - 7 * 86400000).toISOString();
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

    switch (id) {
      case 'due_today':
        return q
          .gte('next_action_date', startOfToday.toISOString())
          .lte('next_action_date', endOfToday.toISOString());
      case 'new_to_recontact':
        return q.lt('created_at', d30).is('last_contacted_at', null);
      case 'no_answer':
        return q.eq('recovery_outcome', 'no_answer');
      case 'interested':
        return q.in('recovery_outcome', ['interested', 'needs_callback']);
      case 'quote_sent':
        return q.not('quote_amount', 'is', null)
          .or(`last_contacted_at.is.null,last_contacted_at.lt.${d14}`);
      case 'abandoned_checkout':
        return q.not('abandoned_cart_id', 'is', null).lt('created_at', d7);
      case 'not_interested':
        return q.in('recovery_outcome', ['not_interested', 'bought_elsewhere', 'vehicle_sold']);
      case 'all_leads':
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
      toast.error('Failed to load recontact leads', { description: e.message });
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
            .not('step_two_completed_at', 'is', null)
            .not('status', 'in', '(converted,fake_lead,archived)')
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
          outcome ? `Recontact attempt — outcome: ${outcome}` : 'Recontact attempt logged'
        );

        if (outcome === 'mark_lost' || outcome === 'not_interested') {
          const reason = outcome === 'mark_lost' ? 'Recontact: unable to revive' : 'Recontact: not interested';
          await (supabase.from('sales_leads') as any)
            .update({ status: 'lost', lost_at: new Date().toISOString(), lost_reason: reason })
            .eq('id', lead.id);
        }

        toast.success('Worked', { description: outcome ? `Outcome: ${outcome}` : 'Logged recontact attempt' });
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

  const exportCsv = useCallback(() => {
    if (!filteredLeads.length) {
      toast.error('Nothing to export', { description: 'There are no leads in the current view.' });
      return;
    }
    const headers = [
      'First name','Last name','Email','Phone','Status','Source','Plan interest',
      'Vehicle reg','Vehicle make','Vehicle model','Vehicle year','Mileage',
      'Cart value','Quote amount','Calls','Last contacted','Last worked','Recovery outcome',
      'Assigned to','Assigned at','Created at',
    ];
    const esc = (v: any) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = filteredLeads.map((l: any) => {
      const a = l.assigned_to ? agentByAuthId.get(l.assigned_to) : undefined;
      return [
        l.first_name, l.last_name, l.email, l.phone, l.status, l.lead_source, l.plan_interest,
        l.vehicle_reg, l.vehicle_make, l.vehicle_model, l.vehicle_year, l.mileage,
        l.cart_value, l.quote_amount, l.call_count || 0,
        l.last_contacted_at, l.recovery_worked_at, l.recovery_outcome,
        a ? agentLabel(a) : (l.assigned_to ? 'Unknown' : 'Unassigned'),
        l.assigned_at, l.created_at,
      ].map(esc).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recontact-leads_${segment}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} leads`);
  }, [filteredLeads, agentByAuthId, segment]);


  const dueTodayCount = counts['due_today'] ?? 0;
  const totalCount = counts['all_leads'] ?? 0;
  const conversionRate = myStats.worked > 0 ? Math.round((myStats.converted / myStats.worked) * 100) : 0;

  const STAT_CARDS = [
    { label: 'Worked today',         value: myStats.worked,       icon: CheckCircle2, tint: 'text-green-600' },
    { label: 'Follow-ups due today', value: dueTodayCount,        icon: CalendarClock, tint: 'text-blue-600' },
    { label: 'Converted today',      value: myStats.converted,    icon: Trophy,        tint: 'text-amber-500' },
    { label: 'My conversion rate',   value: `${conversionRate}%`, icon: TrendingUp,    tint: 'text-primary' },
    { label: 'Total recontact leads',value: totalCount.toLocaleString(), icon: Database, tint: 'text-muted-foreground' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Sticky header — page title, refresh, my-leads + search stay in view while scrolling */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              Recontact Leads
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground max-w-3xl">
              Past enquiries that didn't purchase. Pick a segment, call the lead, log the outcome.
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden md:flex items-center gap-2 pr-2 border-r">
              <Switch id="my-only" checked={myOnly} onCheckedChange={setMyOnly} />
              <Label htmlFor="my-only" className="text-sm cursor-pointer whitespace-nowrap">My leads only</Label>
            </div>
            <Input
              placeholder="Search name, email, phone, reg…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-[220px] md:w-[280px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => { fetchLeads(); fetchCounts(); fetchLeaderboard(); }}
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            {canExportCsv && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                className="shrink-0"
                title="Download the current segment as a CSV file"
              >
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            )}
            {onNavigateToTab && (userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager') && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onNavigateToTab('lead-teams')}
                className="shrink-0 font-semibold"
                title="Assign agents to teams and pick the queues they work — New Leads, Recontact, Renewals"
              >
                <Network className="h-4 w-4 mr-1" /> Allocate Agents
              </Button>
            )}
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.tint}`} />
              <div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-xl font-semibold">{s.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
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
        <div className="sticky top-[68px] z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-background/95 backdrop-blur border-b">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            {SEGMENTS.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="gap-2">
                {s.label}
                <Badge variant="secondary" className="ml-1">{counts[s.id] ?? '…'}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={segment} className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{currentSegment.description}</p>
            <div className="flex md:hidden items-center gap-2">
              <Switch id="my-only-m" checked={myOnly} onCheckedChange={setMyOnly} />
              <Label htmlFor="my-only-m" className="text-sm cursor-pointer">My leads only</Label>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading recontact leads…
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No recontact leads in this segment. Try another tab, clear your filters, or switch off &quot;My leads only&quot;.
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left p-2 w-[140px]">Agent</th>
                      {canSeeSource && <th className="text-left p-2 w-[60px]">Src</th>}
                      <th className="text-left p-2 w-[110px]">Status</th>
                      <th className="text-center p-2 w-[44px]">CB</th>
                      <th className="text-center p-2 w-[80px]">Calls</th>
                      <th className="text-left p-2 w-[260px]">Actions</th>
                      <th className="text-left p-2 w-[140px]">Name</th>
                      <th className="text-left p-2 w-[130px]">Phone</th>
                      <th className="text-left p-2 w-[180px]">Email</th>
                      <th className="text-left p-2 w-[90px]">Reg</th>
                      <th className="text-left p-2 w-[100px]">Payment</th>
                      <th className="text-left p-2 w-[110px]">Paid Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLeads.map((lead) => {
                      const assignedAgent = lead.assigned_to ? agentByAuthId.get(lead.assigned_to) : undefined;
                      const mayReassign = canReassign(lead);
                      const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—';
                      const paidDate = (lead as any).payment_date || (lead as any).step_two_completed_at;
                      return (
                        <tr key={lead.id} className="border-t hover:bg-muted/30 cursor-pointer align-top" onClick={() => setSelected(lead)}>
                          {/* Agent */}
                          <td className="p-2" onClick={(e) => e.stopPropagation()}>
                            {mayReassign ? (
                              <Select
                                value={lead.assigned_to ?? UNASSIGNED}
                                onValueChange={(v) => reassign(lead, v === UNASSIGNED ? null : v)}
                              >
                                <SelectTrigger className="h-7 w-[130px] text-xs">
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

                          {/* Src */}
                          {canSeeSource && (
                            <td className="p-2">
                              {lead.lead_source ? (
                                <Badge variant="outline" className="text-[10px] uppercase">{lead.lead_source}</Badge>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                          )}

                          {/* Status */}
                          <td className="p-2" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={lead.status ?? ''}
                              onValueChange={(v) => updateLeadStatus(lead.id, v as LeadStatus)}
                            >
                              <SelectTrigger className="h-7 w-[100px] text-xs">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {['new','contacted','interested','quote_sent','negotiating','follow_up','lost','converted'].map((s) => (
                                  <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>

                          {/* CB (callback popover) */}
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <RemindMePopover leadId={lead.id} compact />
                          </td>

                          {/* Calls */}
                          <td className="p-2" onClick={(e) => e.stopPropagation()}>
                            <CallCountCell
                              lead={lead}
                              onUpdateCallCount={(inc) => updateCallCount(lead.id, inc)}
                              onUpdateStatus={(s) => updateLeadStatus(lead.id, s)}
                              onScheduleFollowUp={(t, d) => scheduleFollowUp(lead.id, t, d)}
                              onLogActivity={(t, d) => logActivity(lead.id, t, d)}
                            />
                          </td>

                          {/* Actions */}
                          <td className="p-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {lead.phone && (
                                <Button asChild size="icon" variant="outline" className="h-7 w-7" title="Call">
                                  <a href={`tel:${lead.phone}`}><Phone className="h-3 w-3" /></a>
                                </Button>
                              )}
                              {lead.email && (
                                <Button asChild size="icon" variant="outline" className="h-7 w-7" title="Email">
                                  <a href={`mailto:${lead.email}`}><Mail className="h-3 w-3" /></a>
                                </Button>
                              )}
                              <InlineQuickNote leadId={lead.id} />
                              <Select onValueChange={(v) => markWorked(lead, v)}>
                                <SelectTrigger className="h-7 w-[110px] text-xs">
                                  <SelectValue placeholder="Outcome…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {OUTCOMES.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </td>

                          {/* Name */}
                          <td className="p-2">
                            <div className="font-medium text-sm leading-tight">{fullName}</div>
                            {(lead as any).recovery_outcome && (
                              <div className="text-[10px] capitalize text-muted-foreground">{((lead as any).recovery_outcome as string).replace(/_/g, ' ')}</div>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="p-2 text-xs">{lead.phone || '—'}</td>

                          {/* Email */}
                          <td className="p-2 text-xs truncate max-w-[180px]" title={lead.email || ''}>{lead.email || '—'}</td>

                          {/* Reg */}
                          <td className="p-2 text-xs uppercase">{lead.vehicle_reg || '—'}</td>

                          {/* Payment */}
                          <td className="p-2 text-xs">
                            {(lead as any).payment_method ? (
                              <Badge variant="outline" className="text-[10px]">{(lead as any).payment_method}</Badge>
                            ) : lead.is_paid ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Paid</Badge>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>

                          {/* Paid Date */}
                          <td className="p-2 text-xs text-muted-foreground">
                            {paidDate ? format(new Date(paidDate), 'd MMM yy') : '—'}
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
