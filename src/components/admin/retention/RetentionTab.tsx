import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Repeat, Phone, Mail, Loader2, CheckCircle2, AlertCircle, TrendingUp,
  Send, UserCheck, Play, Network, StickyNote, UserCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';


interface CampaignTouch {
  policy_id: string;
  milestone_days: number;
  template_key: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  discount_code: string | null;
  assigned_agent_id: string | null;
}

type SegmentId = 'due_soon' | 'renewal_window' | 'upsell' | 'lapsed';

const SEGMENTS: { id: SegmentId; label: string; description: string }[] = [
  { id: 'due_soon', label: 'Renewal Due Soon', description: 'Policy expires in the next 0–60 days — priority calls' },
  { id: 'renewal_window', label: 'Renewal Window', description: 'Expires in 61–180 days — warm-up calls' },
  { id: 'upsell', label: 'Upsell Opportunities', description: 'Active policy with room to upgrade claim limit or add-ons' },
  { id: 'lapsed', label: 'Lapsed (Win-Back)', description: 'Expired 0–180 days ago, not yet renewed' },
];

const OUTCOMES = [
  { value: 'renewed', label: 'Renewed' },
  { value: 'upgraded', label: 'Upgraded' },
  { value: 'renewed_upgraded', label: 'Renewed + Upgraded' },
  { value: 'still_considering', label: 'Still considering' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled_at_renewal', label: 'Cancelled at renewal' },
  { value: 'lost_to_competitor', label: 'Lost to competitor' },
];

// Statuses that mean "do not contact for retention"
const EXCLUDED_STATUSES = "('cancelled','refunded','expired','voided','deleted')";
const PAGE_SIZE = 100;

interface PolicyRow {
  id: string;
  customer_id: string | null;
  policy_number: string | null;
  warranty_number: string | null;
  plan_type: string | null;
  payment_type: string | null;
  status: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  claim_limit: number | null;
  tyre_cover: boolean | null;
  wear_tear: boolean | null;
  breakdown_recovery: boolean | null;
  vehicle_rental: boolean | null;
  europe_cover: boolean | null;
  mot_repair: boolean | null;
  retention_worked_at: string | null;
  retention_outcome: string | null;
  customer_full_name: string | null;
  email: string | null;
  customers?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    registration_plate: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    status: string | null;
    assigned_to: string | null;
  } | null;
}

type Agent = {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
};

const UNASSIGNED = '__unassigned__';

function agentLabel(a: Agent | undefined): string {
  if (!a) return 'Unassigned';
  const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
  return name || a.email || 'Agent';
}


function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function expiryBadge(days: number | null) {
  if (days == null) return <Badge variant="outline">—</Badge>;
  if (days < 0) return <Badge className="bg-red-100 text-red-800 border-red-200">Expired {Math.abs(days)}d</Badge>;
  if (days <= 14) return <Badge className="bg-red-100 text-red-800 border-red-200">{days}d</Badge>;
  if (days <= 30) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{days}d</Badge>;
  return <Badge variant="outline">{days}d</Badge>;
}

function upsellPotential(p: PolicyRow): string[] {
  const opts: string[] = [];
  if ((p.claim_limit ?? 0) < 2000) opts.push('Higher claim limit');
  if (!p.tyre_cover) opts.push('Tyre cover');
  if (!p.wear_tear) opts.push('Wear & tear');
  if (!p.breakdown_recovery) opts.push('Breakdown');
  if (!p.vehicle_rental) opts.push('Vehicle rental');
  if (!p.europe_cover) opts.push('Europe');
  if (!p.mot_repair) opts.push('MOT repair');
  return opts;
}

export const RetentionTab: React.FC<{ userRole?: string | null; onNavigateToTab?: (tab: string) => void }> = ({ userRole, onNavigateToTab }) => {
  const canSeeSource = userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager' || userRole === 'lead_gen';
  const [segment, setSegment] = useState<SegmentId>('due_soon');
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<SegmentId, number>>({} as any);
  const [search, setSearch] = useState('');
  const [workedToday, setWorkedToday] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [totalActive, setTotalActive] = useState<number | null>(null);
  const [renewals12mo, setRenewals12mo] = useState<number | null>(null);
  const [touches, setTouches] = useState<Record<string, CampaignTouch[]>>({});
  const [runningCron, setRunningCron] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [callCountsByEmail, setCallCountsByEmail] = useState<Record<string, number>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  // Agents: prefer those flagged with the Renewals workstream; fallback to all sales-side roles.
  useEffect(() => {
    (async () => {
      const [{ data: au }, { data: ws }] = await Promise.all([
        (supabase.from('admin_users') as any)
          .select('id, user_id, first_name, last_name, email, role, is_active')
          .in('role', ['sales', 'sales_lead', 'admin', 'super_admin'])
          .eq('is_active', true)
          .order('first_name'),
        (supabase.from('lead_team_members') as any)
          .select('admin_user_id, workstream_renewals'),
      ]);
      const renewSet = new Set<string>(
        ((ws as any[]) || [])
          .filter((r: any) => r.workstream_renewals === true)
          .map((r: any) => r.admin_user_id)
      );
      const all = (au as Agent[]) || [];
      const hasAnyFlagged = renewSet.size > 0;
      const filtered = all.filter(a => {
        if (a.role === 'admin' || a.role === 'super_admin') return true;
        if (!hasAnyFlagged) return true;
        return renewSet.has(a.id);
      });
      setAgents(filtered);
    })();
  }, []);

  const agentByAuthId = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents) if (a.user_id) m.set(a.user_id, a);
    return m;
  }, [agents]);

  const applySegment = useCallback((q: any, id: SegmentId) => {
    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 86400000).toISOString();
    const in61 = new Date(now.getTime() + 61 * 86400000).toISOString();
    const in180 = new Date(now.getTime() + 180 * 86400000).toISOString();
    const ago180 = new Date(now.getTime() - 180 * 86400000).toISOString();
    const nowIso = now.toISOString();

    switch (id) {
      case 'due_soon':
        return q.gte('policy_end_date', nowIso).lte('policy_end_date', in60);
      case 'renewal_window':
        return q.gte('policy_end_date', in61).lte('policy_end_date', in180);
      case 'upsell':
        // Active policies still well within their term, with claim limit under top tier
        return q.gt('policy_end_date', in180).lt('claim_limit', 2000);
      case 'lapsed':
        return q.gte('policy_end_date', ago180).lt('policy_end_date', nowIso);
      default:
        return q;
    }
  }, []);

  const baseSelect =
    'id, customer_id, policy_number, warranty_number, plan_type, payment_type, status, ' +
    'policy_start_date, policy_end_date, claim_limit, tyre_cover, wear_tear, ' +
    'breakdown_recovery, vehicle_rental, europe_cover, mot_repair, ' +
    'retention_worked_at, retention_outcome, customer_full_name, email, ' +
    'customers!fk_customer_policies_customer_id ( id, first_name, last_name, name, email, phone, registration_plate, vehicle_make, vehicle_model, status, assigned_to )';


  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      let q: any = (supabase.from('customer_policies') as any)
        .select(baseSelect)
        .not('status', 'in', EXCLUDED_STATUSES)
        .or('is_deleted.is.null,is_deleted.eq.false');
      q = applySegment(q, segment);
      q = q
        .order('retention_worked_at', { ascending: true, nullsFirst: true })
        .order('policy_end_date', { ascending: true })
        .limit(PAGE_SIZE);
      const { data, error } = await q;
      if (error) throw error;
      // Filter out policies whose linked customer is cancelled/refunded
      const filtered = ((data as any) || []).filter((r: PolicyRow) => {
        const cs = (r.customers?.status || '').toLowerCase();
        return !['cancelled', 'refunded', 'deleted'].includes(cs);
      });
      setRows(filtered);
    } catch (e: any) {
      toast.error('Failed to load retention list', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [applySegment, segment]);

  const fetchCounts = useCallback(async () => {
    const results = await Promise.all(
      SEGMENTS.map(async (s) => {
        try {
          let q: any = (supabase.from('customer_policies') as any)
            .select('id', { count: 'exact', head: true })
            .not('status', 'in', EXCLUDED_STATUSES)
            .or('is_deleted.is.null,is_deleted.eq.false');
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

  const fetchWorkedToday = useCallback(async () => {
    if (!currentUserId) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    // Worked today = policies whose retention_worked_at is today by this user (we approximate via timestamp + admin_notes)
    const { count } = await (supabase.from('customer_policies') as any)
      .select('id', { count: 'exact', head: true })
      .gte('retention_worked_at', startOfDay.toISOString());
    setWorkedToday(count || 0);
  }, [currentUserId]);

  const fetchTotals = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();
      const in12mo = new Date(Date.now() + 365 * 86400000).toISOString();
      const baseFilter = (q: any) => q
        .not('status', 'in', EXCLUDED_STATUSES)
        .or('is_deleted.is.null,is_deleted.eq.false');
      const totalQ = baseFilter((supabase.from('customer_policies') as any).select('id', { count: 'exact', head: true }));
      const renewQ = baseFilter((supabase.from('customer_policies') as any).select('id', { count: 'exact', head: true }))
        .gte('policy_end_date', nowIso)
        .lte('policy_end_date', in12mo);
      const [{ count: total }, { count: renew12 }] = await Promise.all([totalQ, renewQ]);
      setTotalActive(total || 0);
      setRenewals12mo(renew12 || 0);
    } catch {
      // non-fatal
    }
  }, []);

  const fetchTouches = useCallback(async (policyIds: string[]) => {
    if (policyIds.length === 0) { setTouches({}); return; }
    const { data } = await (supabase.from('renewal_campaign_log') as any)
      .select('policy_id, milestone_days, template_key, status, sent_at, opened_at, clicked_at, discount_code, assigned_agent_id')
      .in('policy_id', policyIds)
      .order('milestone_days', { ascending: false });
    const map: Record<string, CampaignTouch[]> = {};
    ((data as CampaignTouch[]) || []).forEach((t) => {
      (map[t.policy_id] ||= []).push(t);
    });
    setTouches(map);
  }, []);

  const triggerCron = useCallback(async () => {
    try {
      setRunningCron(true);
      const { data, error } = await supabase.functions.invoke('process-renewal-campaigns', { body: {} });
      if (error) throw error;
      const queued = (data as any)?.totalQueued ?? 0;
      const skipped = (data as any)?.totalSkipped ?? 0;
      toast.success('Renewal cron complete', { description: `${queued} queued, ${skipped} skipped` });
      fetchRows();
    } catch (e: any) {
      toast.error('Cron failed', { description: e.message });
    } finally {
      setRunningCron(false);
    }
  }, []);

  // Show how many call attempts have been made against this customer across all
  // sales_leads that share their email — gives renewal agents the same call-count
  // signal they see on the New Leads tab.
  const fetchCallCounts = useCallback(async (emails: string[]) => {
    const clean = Array.from(new Set(emails.filter(Boolean).map((e) => e.toLowerCase())));
    if (clean.length === 0) { setCallCountsByEmail({}); return; }
    const { data } = await (supabase.from('sales_leads') as any)
      .select('email, call_count')
      .in('email', clean)
      .limit(5000);
    const map: Record<string, number> = {};
    ((data as any[]) || []).forEach((r) => {
      const k = (r.email || '').toLowerCase();
      if (!k) return;
      map[k] = (map[k] || 0) + (Number(r.call_count) || 0);
    });
    setCallCountsByEmail(map);
  }, []);


  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchWorkedToday(); }, [fetchWorkedToday]);
  useEffect(() => { fetchTotals(); }, [fetchTotals]);
  useEffect(() => { fetchTouches(rows.map((r) => r.id)); }, [rows, fetchTouches]);
  useEffect(() => {
    fetchCallCounts(rows.map((r) => (r.customers?.email || r.email || '')));
  }, [rows, fetchCallCounts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      [
        r.customer_full_name,
        r.email,
        r.customers?.email,
        r.customers?.phone,
        r.customers?.first_name,
        r.customers?.last_name,
        r.customers?.registration_plate,
        r.policy_number,
        r.warranty_number,
      ]
        .some((v) => (v || '').toString().toLowerCase().includes(s))
    );
  }, [rows, search]);

  const markWorked = useCallback(
    async (row: PolicyRow, outcome?: string) => {
      try {
        const updates: any = { retention_worked_at: new Date().toISOString() };
        if (outcome) updates.retention_outcome = outcome;
        const { error } = await (supabase.from('customer_policies') as any)
          .update(updates)
          .eq('id', row.id);
        if (error) throw error;

        toast.success('Worked', {
          description: outcome ? `Outcome: ${outcome.replace(/_/g, ' ')}` : 'Logged retention attempt',
        });
        setWorkedToday((n) => n + 1);
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updates } : r)));
      } catch (e: any) {
        toast.error('Could not mark as worked', { description: e.message });
      }
    },
    []
  );

  const reassignCustomer = useCallback(async (row: PolicyRow, newAuthId: string | null) => {
    if (!row.customer_id) {
      toast.error('No linked customer record to assign');
      return;
    }
    const { error } = await (supabase.from('customers') as any)
      .update({ assigned_to: newAuthId })
      .eq('id', row.customer_id);
    if (error) { toast.error('Could not reassign', { description: error.message }); return; }
    setRows((prev) => prev.map((r) =>
      r.id === row.id && r.customers
        ? { ...r, customers: { ...r.customers, assigned_to: newAuthId } }
        : r
    ));
    toast.success(newAuthId ? 'Reassigned' : 'Unassigned');
  }, []);

  // Log an attempted call as a pinned customer note + bump the local Calls counter
  // so the agent sees their action reflected immediately.
  const logCustomerCall = useCallback(async (row: PolicyRow) => {
    const email = (row.customers?.email || row.email || '').toLowerCase();
    if (!row.customer_id) { toast.error('No linked customer record'); return; }
    const stamp = format(new Date(), 'd MMM yyyy HH:mm');
    const { error } = await (supabase.from('customer_notes') as any).insert({
      customer_id: row.customer_id,
      note_text: `Renewal call attempt logged at ${stamp}`,
      created_by: currentUserId,
    });
    if (error) { toast.error('Could not log call', { description: error.message }); return; }
    if (email) setCallCountsByEmail((prev) => ({ ...prev, [email]: (prev[email] || 0) + 1 }));
  }, [currentUserId]);

  const saveCustomerNote = useCallback(async (row: PolicyRow) => {
    const text = (noteDraft[row.id] || '').trim();
    if (!text) return;
    if (!row.customer_id) { toast.error('No linked customer record'); return; }
    const { error } = await (supabase.from('customer_notes') as any).insert({
      customer_id: row.customer_id,
      note_text: text,
      created_by: currentUserId,
    });
    if (error) { toast.error('Could not save note', { description: error.message }); return; }
    setNoteDraft((prev) => ({ ...prev, [row.id]: '' }));
    toast.success('Note saved');
  }, [noteDraft, currentUserId]);


  const srcBadge = (id: SegmentId) => {
    switch (id) {
      case 'due_soon':       return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">Due</Badge>;
      case 'renewal_window': return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">Renewal</Badge>;
      case 'upsell':         return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">Upsell</Badge>;
      case 'lapsed':         return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">Lapsed</Badge>;
      default:               return <Badge variant="outline" className="text-[10px]">—</Badge>;
    }
  };


  const currentSegment = SEGMENTS.find((s) => s.id === segment)!;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Sticky header — title, search, refresh, cron stay in view while scrolling the table */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <Repeat className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              Renewals
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground max-w-3xl">
              Active customers up for renewal or upsell. Auto-cadence emails run daily; call milestones (30/14/7d) auto-assign.
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Input
              placeholder="Search name, email, phone, reg, policy…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-[220px] md:w-[280px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => { fetchRows(); fetchCounts(); fetchWorkedToday(); fetchTotals(); }}
              className="shrink-0"
            >
              <Loader2 className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : 'hidden'}`} />
              Refresh
            </Button>
            <Button size="sm" variant="outline" className="gap-1" disabled={runningCron} onClick={triggerCron}>
              {runningCron ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Run cron
            </Button>
            {onNavigateToTab && (userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager') && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onNavigateToTab('lead-teams')}
                className="shrink-0 font-semibold gap-1"
                title="Assign agents to teams and pick the queues they work — New Leads, Recontact, Renewals"
              >
                <Network className="h-4 w-4" /> Allocate Agents
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Active policies</div>
              <div className="text-xl font-semibold">{totalActive ?? '…'}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-xs text-muted-foreground">Renewals next 12 mo</div>
              <div className="text-xl font-semibold">{renewals12mo ?? '…'}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-xs text-muted-foreground">Worked today</div>
              <div className="text-xl font-semibold">{workedToday}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Send className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-xs text-muted-foreground">Due in next 60 days</div>
              <div className="text-xl font-semibold">{counts['due_soon'] ?? '…'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

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
          <p className="text-sm text-muted-foreground">{currentSegment.description}</p>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading renewals…
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No customers in this segment right now. Try another tab or clear your search.
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left p-2 w-[140px]">Agent</th>
                      {canSeeSource && <th className="text-left p-2 w-[70px]">Src</th>}
                      <th className="text-left p-2 w-[120px]">Status</th>
                      <th className="text-center p-2 w-[44px]">CB</th>
                      <th className="text-center p-2 w-[60px]">Calls</th>
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
                    {filtered.map((r) => {
                      const name =
                        [r.customers?.first_name, r.customers?.last_name].filter(Boolean).join(' ') ||
                        r.customers?.name ||
                        r.customer_full_name ||
                        '—';
                      const email = (r.customers?.email || r.email || '').toLowerCase();
                      const phone = r.customers?.phone || '';
                      const callCount = email ? (callCountsByEmail[email] || 0) : 0;
                      const assignedAuthId = r.customers?.assigned_to ?? null;
                      const assignedAgent = assignedAuthId ? agentByAuthId.get(assignedAuthId) : undefined;
                      const paidDate = r.policy_start_date;
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/30 align-top">
                          {/* Agent */}
                          <td className="p-2">
                            <Select
                              value={assignedAuthId ?? UNASSIGNED}
                              onValueChange={(v) => reassignCustomer(r, v === UNASSIGNED ? null : v)}
                            >
                              <SelectTrigger className="h-7 w-[130px] text-xs">
                                <SelectValue placeholder="Assign…">
                                  {assignedAgent ? (
                                    <span className="flex items-center gap-1">
                                      <UserCircle2 className="h-3 w-3 text-muted-foreground" />
                                      {agentLabel(assignedAgent)}
                                    </span>
                                  ) : 'Unassigned'}
                                </SelectValue>
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
                          </td>

                          {/* Src */}
                          {canSeeSource && <td className="p-2">{srcBadge(segment)}</td>}

                          {/* Status */}
                          <td className="p-2">
                            <Select
                              value={r.retention_outcome ?? ''}
                              onValueChange={(v) => markWorked(r, v)}
                            >
                              <SelectTrigger className="h-7 w-[110px] text-xs">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {OUTCOMES.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>

                          {/* CB — callbacks for renewals aren't wired to lead_reminders yet; show a static placeholder */}
                          <td className="p-2 text-center text-muted-foreground text-xs">—</td>

                          {/* Calls */}
                          <td className="p-2 text-center">
                            <Badge variant={callCount > 0 ? 'secondary' : 'outline'} className="text-[11px] tabular-nums">
                              {callCount}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {phone && (
                                <Button
                                  asChild
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7"
                                  title="Call"
                                  onClick={() => logCustomerCall(r)}
                                >
                                  <a href={`tel:${phone}`}><Phone className="h-3 w-3" /></a>
                                </Button>
                              )}
                              {email && (
                                <Button asChild size="icon" variant="outline" className="h-7 w-7" title="Email">
                                  <a href={`mailto:${email}`}><Mail className="h-3 w-3" /></a>
                                </Button>
                              )}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button size="icon" variant="outline" className="h-7 w-7" title="Add note">
                                    <StickyNote className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-3" align="start">
                                  <div className="text-xs font-medium mb-2">Note for {name}</div>
                                  <Textarea
                                    rows={3}
                                    placeholder="Quick note…"
                                    value={noteDraft[r.id] || ''}
                                    onChange={(e) => setNoteDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                                  />
                                  <div className="flex justify-end mt-2">
                                    <Button size="sm" onClick={() => saveCustomerNote(r)}>Save note</Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => markWorked(r)}>
                                Worked
                              </Button>
                            </div>
                          </td>

                          {/* Name */}
                          <td className="p-2">
                            <div className="font-medium text-sm leading-tight">{name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {r.policy_number || r.warranty_number || ''}
                            </div>
                            {r.retention_worked_at && (
                              <div className="text-[10px] text-muted-foreground">
                                worked {formatDistanceToNow(new Date(r.retention_worked_at), { addSuffix: true })}
                              </div>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="p-2 text-xs">{phone || '—'}</td>

                          {/* Email */}
                          <td className="p-2 text-xs truncate max-w-[180px]" title={email}>{email || '—'}</td>

                          {/* Reg */}
                          <td className="p-2 text-xs uppercase">{r.customers?.registration_plate || '—'}</td>

                          {/* Payment */}
                          <td className="p-2 text-xs">
                            {r.payment_type ? (
                              <Badge variant="outline" className="text-[10px]">{r.payment_type}</Badge>
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

    </div>
  );
};

export default RetentionTab;
