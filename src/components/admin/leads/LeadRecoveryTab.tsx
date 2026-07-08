import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead, AdminUser, LeadTag, LeadPriority } from '@/hooks/useLeads';
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
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Trophy, CalendarClock, TrendingUp, Database, Network, Download, ArrowUpDown, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { RecontactAccessPanel } from './RecontactAccessPanel';
import { LeadsTable } from './LeadsTable';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';
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
  { id: 'all_leads',          label: 'All Leads',          description: 'Every customer that completed step 2 of the lead form, excluding anyone who has bought, cancelled or refunded a warranty.' },
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

const PAGE_SIZE = 500;
const UNASSIGNED = '__unassigned__';

// Bulk self-claim guardrails for recontact leads.
// - Max per click: keeps agents from vacuuming the queue in one action.
// - Max per day: spreads the pool across the sales floor.
// - FIFO: oldest first so nothing rots at the bottom.
// - Any lead (assigned or not) is claimable — recontact leads are shared,
//   previously worked leads can move between agents. Terminal statuses and
//   leads already owned by the current agent are skipped.
const BULK_CLAIM_MAX_PER_CLICK = 100;
const BULK_CLAIM_MAX_PER_DAY = 200;

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
  // Source column intentionally hidden on Recontact page for all roles per product decision.
  const [segment, setSegment] = useState<SegmentId>('all_leads');
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
  const [customerEmails, setCustomerEmails] = useState<Set<string>>(new Set());
  const [customerRegs, setCustomerRegs] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'lost' | 'contacted'>('all');
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [datePeriod, setDatePeriod] = useState<PeriodKey>('all');
  const [dateCustomRange, setDateCustomRange] = useState<DateRange | undefined>(undefined);
  const [claimedToday, setClaimedToday] = useState(0);
  const [claiming, setClaiming] = useState(false);

  // Load lead tags once so the LeadsTable row tag picker works.
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from('lead_tags') as any).select('id, name, color, description');
      if (data) setTags(data as LeadTag[]);
    })();
  }, []);

  // Load every customer email + registration once. Anyone in this set has
  // bought, cancelled or refunded a warranty and must be removed from the
  // recontact list regardless of their sales_leads.is_paid flag.
  useEffect(() => {
    (async () => {
      const emails = new Set<string>();
      const regs = new Set<string>();
      const pageSize = 1000;
      for (let from = 0; from < 200000; from += pageSize) {
        const { data, error } = await (supabase.from('customers') as any)
          .select('email, registration_plate')
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        for (const r of data as Array<{ email: string | null; registration_plate: string | null }>) {
          if (r.email) emails.add(r.email.trim().toLowerCase());
          if (r.registration_plate) regs.add(r.registration_plate.replace(/\s+/g, '').toUpperCase());
        }
        if (data.length < pageSize) break;
      }
      setCustomerEmails(emails);
      setCustomerRegs(regs);
    })();
  }, []);

  // Auth bootstrap.
  // IMPORTANT: `currentUserId` stores the admin_users.id (NOT auth.uid).
  // sales_leads.assigned_to, lead_activities.performed_by and
  // lead_assignment_audit.changed_by/new_assigned_to all reference
  // admin_users.id, and the RLS policies on those tables gate writes on
  // `performed_by IN (SELECT id FROM admin_users WHERE user_id = auth.uid())`.
  // Passing the raw auth uid silently fails RLS — that's why notes/activity
  // "don't save" on this tab. Keep this as admin_users.id everywhere.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (uid) {
        const { data: au } = await (supabase.from('admin_users') as any)
          .select('id, role')
          .eq('user_id', uid)
          .maybeSingle();
        setCurrentUserId(au?.id ?? null);
        setCurrentRole(au?.role ?? null);
        // Sales agents default to "My leads only" so they land on their own
        // workload first. Managers keep the full team view.
        if (au?.role === 'sales') setMyOnly(true);
      } else {
        setCurrentUserId(null);
      }
    })();
  }, []);

  // Count today's self-claims for the current agent so the bulk-claim button
  // can enforce the daily quota and show remaining capacity.
  const refreshClaimedToday = useCallback(async () => {
    if (!currentUserId) { setClaimedToday(0); return; }
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { count } = await (supabase.from('lead_assignment_audit') as any)
      .select('id', { count: 'exact', head: true })
      .eq('changed_by', currentUserId)
      .eq('source', 'recontact_bulk_claim')
      .gte('created_at', startOfDay.toISOString());
    setClaimedToday(count || 0);
  }, [currentUserId]);

  useEffect(() => { refreshClaimedToday(); }, [refreshClaimedToday]);

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

  // Recontact leads are worked by the whole sales floor — anyone with a sales
  // seat here can grab a lead (assign it to themselves or a teammate). Managers
  // and sales_leads keep full reassignment powers as before.
  const canReassignAny = currentRole === 'admin' || currentRole === 'super_admin' || currentRole === 'sales_lead' || currentRole === 'sales_manager' || currentRole === 'sales';
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
        return q;
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let q = buildBaseQuery();
      q = applySegment(q, segment);
      // Sort so leads the agent is actively working (most recently touched / contacted)
      // bubble to the top — otherwise an agent can't find "their" leads in thousands.
      // Untouched leads fall to the bottom but remain reachable via "New to Recontact".
      q = q.order('last_contacted_at', { ascending: false, nullsFirst: false })
        .order('recovery_worked_at', { ascending: false, nullsFirst: false })
        .order('next_action_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
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
    // Exclude anyone who has bought / cancelled / refunded a warranty —
    // their email or vehicle reg appears in the customers table.
    if (customerEmails.size > 0 || customerRegs.size > 0) {
      list = list.filter((l: any) => {
        const e = (l.email || '').trim().toLowerCase();
        const r = (l.vehicle_reg || '').replace(/\s+/g, '').toUpperCase();
        if (e && customerEmails.has(e)) return false;
        if (r && customerRegs.has(r)) return false;
        return true;
      });
    }
    if (myOnly && currentUserId) {
      // sales_leads.assigned_to may store either auth user_id or admin_users.id
      // depending on which flow assigned it — match both so agents always see their leads.
      const myAdminId = agents.find(a => a.user_id === currentUserId)?.id;
      list = list.filter((l) => l.assigned_to === currentUserId || (myAdminId && l.assigned_to === myAdminId));
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'lost') {
        list = list.filter((l) => l.status === 'lost');
      } else if (statusFilter === 'contacted') {
        list = list.filter((l) => !!l.last_contacted_at || !!(l as any).recovery_worked_at);
      }
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((l) =>
        [l.first_name, l.last_name, l.email, l.phone, l.vehicle_reg, l.vehicle_make, l.vehicle_model]
          .some((v) => (v || '').toString().toLowerCase().includes(s))
      );
    }
    if (datePeriod !== 'all') {
      const range = datePeriod === 'custom' ? dateCustomRange : periodToRange(datePeriod);
      const fromT = range?.from ? new Date(range.from).setHours(0, 0, 0, 0) : null;
      const toT = range?.to ? new Date(range.to).setHours(23, 59, 59, 999) : (range?.from ? new Date(range.from).setHours(23, 59, 59, 999) : null);
      if (fromT != null || toT != null) {
        list = list.filter((l) => {
          const t = new Date(l.created_at || 0).getTime();
          if (fromT != null && t < fromT) return false;
          if (toT != null && t > toT) return false;
          return true;
        });
      }
    }
    list = [...list].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });
    return list;
  }, [leads, search, myOnly, currentUserId, agents, statusFilter, customerEmails, customerRegs, sortOrder, datePeriod, dateCustomRange]);

  // When an agent actively works a recontact lead (calls, logs an outcome, sets
  // a callback, changes status, adds a note), auto-file it under their "My leads
  // only" bucket so they can find it again. Managers/admins spot-checking are
  // excluded so they don't accidentally steal leads from sales agents.
  const takeOwnershipIfWorking = useCallback(async (leadId: string) => {
    if (!currentUserId) return;
    const isManagerRole = currentRole === 'admin' || currentRole === 'super_admin' || currentRole === 'sales_manager';
    if (isManagerRole) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (lead.assigned_to === currentUserId) return;
    const previous = lead.assigned_to ?? null;
    const { error } = await (supabase.from('sales_leads') as any)
      .update({ assigned_to: currentUserId, assigned_at: new Date().toISOString() })
      .eq('id', leadId);
    if (error) return; // silent — don't block the primary action
    await (supabase.from('lead_assignment_audit') as any).insert({
      lead_id: leadId,
      previous_assigned_to: previous,
      new_assigned_to: currentUserId,
      changed_by: currentUserId,
      source: 'recontact_auto_take',
    }).then(() => {}, () => {});
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, assigned_to: currentUserId } as any : l)));
  }, [currentUserId, currentRole, leads]);

  const logActivity = useCallback(
    async (leadId: string, type: string, description: string) => {
      await (supabase.from('lead_activities') as any).insert({
        lead_id: leadId,
        activity_type: type,
        description,
        performed_by: currentUserId,
      });
      void takeOwnershipIfWorking(leadId);
    },
    [currentUserId, takeOwnershipIfWorking]
  );

  const updateCallCount = useCallback(async (leadId: string, increment: number) => {
    const lead = leads.find((l) => l.id === leadId);
    const newCount = Math.max(0, (lead?.call_count || 0) + increment);
    const { error } = await (supabase.from('sales_leads') as any)
      .update({ call_count: newCount, last_contacted_at: new Date().toISOString() })
      .eq('id', leadId);
    if (error) { toast.error('Could not update calls', { description: error.message }); return; }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, call_count: newCount, last_contacted_at: new Date().toISOString() } as any : l)));
    void takeOwnershipIfWorking(leadId);
  }, [leads, takeOwnershipIfWorking]);

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

  // Handlers required by <LeadsTable> — same behaviour as New Leads flow.
  const assignLead = useCallback(async (leadId: string, userId: string | null) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    try {
      const previous = lead.assigned_to ?? null;
      const { error } = await (supabase.from('sales_leads') as any)
        .update({ assigned_to: userId, assigned_at: userId ? new Date().toISOString() : null })
        .eq('id', leadId);
      if (error) throw error;
      await (supabase.from('lead_assignment_audit') as any).insert({
        lead_id: leadId, previous_assigned_to: previous, new_assigned_to: userId,
        changed_by: currentUserId, source: 'recontact_manual',
      }).then(() => {}, () => {});
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, assigned_to: userId } as any : l)));
      toast.success(userId ? 'Reassigned' : 'Unassigned');
    } catch (e: any) {
      toast.error('Could not reassign', { description: e.message });
    }
  }, [leads, currentUserId]);

  const autoAssignLead = useCallback(async (leadId: string) => {
    try {
      const { error } = await (supabase.rpc as any)('auto_assign_lead', { p_lead_id: leadId });
      if (error) throw error;
      toast.success('Auto-assigned');
      // Refresh will be triggered by parent effect
    } catch (e: any) {
      toast.error('Auto-assign failed', { description: e.message });
    }
  }, []);

  const updateLeadPriority = useCallback(async (leadId: string, priority: LeadPriority) => {
    const { error } = await (supabase.from('sales_leads') as any)
      .update({ priority }).eq('id', leadId);
    if (error) { toast.error('Could not update priority', { description: error.message }); return; }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, priority } as any : l)));
  }, []);

  const addTagToLead = useCallback(async (leadId: string, tagId: string) => {
    const { error } = await (supabase.from('lead_tag_assignments') as any)
      .insert({ lead_id: leadId, tag_id: tagId });
    if (error) toast.error('Could not add tag', { description: error.message });
  }, []);

  const removeTagFromLead = useCallback(async (leadId: string, tagId: string) => {
    const { error } = await (supabase.from('lead_tag_assignments') as any)
      .delete().eq('lead_id', leadId).eq('tag_id', tagId);
    if (error) toast.error('Could not remove tag', { description: error.message });
  }, []);

  const updateLeadNotes = useCallback(async (leadId: string, notes: string, replaceAll?: boolean) => {
    const current = leads.find((l) => l.id === leadId);
    const nextNotes = replaceAll ? notes : [current?.notes, notes].filter(Boolean).join('\n');
    const { error } = await (supabase.from('sales_leads') as any)
      .update({ notes: nextNotes }).eq('id', leadId);
    if (error) { toast.error('Could not save note', { description: error.message }); return; }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, notes: nextNotes } as any : l)));
  }, [leads]);

  const markContactedAt = useCallback(async (leadId: string) => {
    const now = new Date().toISOString();
    const { error } = await (supabase.from('sales_leads') as any)
      .update({ last_contacted_at: now }).eq('id', leadId);
    if (error) { toast.error('Could not mark contacted', { description: error.message }); return; }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, last_contacted_at: now } as any : l)));
  }, []);

  const handleSelectLead = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId); else next.add(leadId);
      return next;
    });
  }, []);
  const handleSelectAll = useCallback(() => {
    setSelectedLeadIds((prev) => (prev.size > 0 ? new Set() : new Set(leads.map((l) => l.id))));
  }, [leads]);



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

  // Bulk self-claim — grabs up to BULK_CLAIM_MAX_PER_CLICK oldest leads from
  // the *current filtered view* and assigns them to the logged-in agent.
  // - Respects the daily cap so no single agent hoovers the queue.
  // - FIFO ordering (oldest created_at first).
  // - Skips leads already assigned to the current agent.
  // - Writes one lead_assignment_audit row per claim with source 'recontact_bulk_claim'.
  const remainingToday = Math.max(0, BULK_CLAIM_MAX_PER_DAY - claimedToday);
  const claimBulk = useCallback(async () => {
    if (!currentUserId) { toast.error('Not signed in'); return; }
    if (remainingToday <= 0) {
      toast.error('Daily claim limit reached', { description: `You've already claimed ${claimedToday} today.` });
      return;
    }
    const myAdminId = agents.find(a => a.user_id === currentUserId)?.id;
    // Oldest first, skip anything already owned by me.
    const candidates = [...filteredLeads]
      .filter(l => l.assigned_to !== currentUserId && (!myAdminId || l.assigned_to !== myAdminId))
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      .slice(0, Math.min(BULK_CLAIM_MAX_PER_CLICK, remainingToday));
    if (!candidates.length) {
      toast.error('Nothing to claim', { description: 'No claimable leads in the current view.' });
      return;
    }
    setClaiming(true);
    try {
      const now = new Date().toISOString();
      // Optimistic guard: only claim rows whose owner still matches what we
      // saw when the list rendered. If another agent claimed a lead a moment
      // ago, our UPDATE will not match and we won't steal it.
      // Group candidate ids by their previously-observed assigned_to so each
      // UPDATE can carry the correct .eq / .is null guard.
      const groups = new Map<string | null, string[]>();
      candidates.forEach(l => {
        const key = l.assigned_to ?? null;
        const arr = groups.get(key) || [];
        arr.push(l.id);
        groups.set(key, arr);
      });

      const claimedIds: string[] = [];
      for (const [prevOwner, ids] of groups.entries()) {
        let q = (supabase.from('sales_leads') as any)
          .update({ assigned_to: currentUserId, assigned_at: now })
          .in('id', ids);
        q = prevOwner == null ? q.is('assigned_to', null) : q.eq('assigned_to', prevOwner);
        const { data: updated, error } = await q.select('id');
        if (error) throw error;
        (updated || []).forEach((r: any) => claimedIds.push(r.id));
      }

      const stolenCount = candidates.length - claimedIds.length;
      if (!claimedIds.length) {
        toast.error('Nothing claimed', {
          description: 'Another agent claimed these leads just now. Refresh to see the latest.',
        });
        return;
      }

      const claimedSet = new Set(claimedIds);
      const claimedCandidates = candidates.filter(l => claimedSet.has(l.id));
      const auditRows = claimedCandidates.map(l => ({
        lead_id: l.id,
        previous_assigned_to: l.assigned_to ?? null,
        new_assigned_to: currentUserId,
        changed_by: currentUserId,
        source: 'recontact_bulk_claim',
      }));
      await (supabase.from('lead_assignment_audit') as any).insert(auditRows).then(() => {}, () => {});
      setLeads(prev => prev.map(l => claimedSet.has(l.id) ? ({ ...l, assigned_to: currentUserId, assigned_at: now } as any) : l));
      setClaimedToday(c => c + claimedIds.length);
      const descParts = [`${Math.max(0, remainingToday - claimedIds.length)} remaining today.`];
      if (stolenCount > 0) descParts.unshift(`${stolenCount} skipped (claimed by another agent).`);
      toast.success(`Claimed ${claimedIds.length} lead${claimedIds.length === 1 ? '' : 's'}`, {
        description: descParts.join(' '),
      });
    } catch (e: any) {
      toast.error('Bulk claim failed', { description: e.message });
    } finally {
      setClaiming(false);
    }
  }, [currentUserId, filteredLeads, agents, remainingToday, claimedToday]);

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
            <label
              className="hidden md:flex items-center gap-2 pr-2 border-r cursor-pointer select-none"
              onClick={(e) => {
                // Prevent the label default from double-firing on the underlying Radix button
                if ((e.target as HTMLElement).closest('[role="switch"]')) return;
                e.preventDefault();
                setMyOnly((v) => !v);
              }}
            >
              <Switch checked={myOnly} onCheckedChange={setMyOnly} />
              <span className="text-sm whitespace-nowrap">My leads only</span>
            </label>
            <div className="flex items-center gap-1.5">
              <UnifiedDateFilter
                scope="signup"
                period={datePeriod}
                customRange={dateCustomRange}
                availableScopes={['signup']}
                onChange={({ period, customRange }) => {
                  setDatePeriod(period);
                  setDateCustomRange(customRange);
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortOrder} onValueChange={(v: 'newest' | 'oldest') => setSortOrder(v)}>
                <SelectTrigger className="h-9 w-[140px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={statusFilter} onValueChange={(v: 'all' | 'lost' | 'contacted') => setStatusFilter(v)}>
              <SelectTrigger className="h-9 w-[140px] text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
              </SelectContent>
            </Select>
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
            <Button
              variant="secondary"
              size="sm"
              onClick={claimBulk}
              disabled={claiming || remainingToday <= 0}
              className="shrink-0"
              title={`Assign up to ${BULK_CLAIM_MAX_PER_CLICK} of the oldest leads in this view to yourself. Daily cap ${BULK_CLAIM_MAX_PER_DAY}.`}
            >
              {claiming
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <HandCoins className="h-4 w-4 mr-1" />}
              Claim {Math.min(BULK_CLAIM_MAX_PER_CLICK, remainingToday)}
              <span className="ml-1 text-xs text-muted-foreground">({remainingToday} left today)</span>
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


      {(currentRole === 'admin' || currentRole === 'super_admin' || currentRole === 'sales_manager' || currentRole === 'sales_lead') && (
        <RecontactAccessPanel />
      )}

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
                const isMe = r.agent.id === currentUserId;
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
            <label
              className="flex md:hidden items-center gap-2 cursor-pointer select-none"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[role="switch"]')) return;
                e.preventDefault();
                setMyOnly((v) => !v);
              }}
            >
              <Switch checked={myOnly} onCheckedChange={setMyOnly} />
              <span className="text-sm">My leads only</span>
            </label>
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
            <LeadsTable
              leads={filteredLeads}
              tags={tags}
              salesUsers={agents as unknown as AdminUser[]}
              assignableSalesUsers={agents as unknown as AdminUser[]}
              canAssignLeads={canReassignAny}
              selectedLeads={selectedLeadIds}
              onSelectLead={handleSelectLead}
              onSelectAll={handleSelectAll}
              onUpdateStatus={updateLeadStatus}
              onAssign={assignLead}
              onAutoAssign={autoAssignLead}
              onUpdatePriority={updateLeadPriority}
              onScheduleFollowUp={scheduleFollowUp}
              onAddTag={addTagToLead}
              onRemoveTag={removeTagFromLead}
              onUpdateNotes={updateLeadNotes}
              onMarkContacted={markContactedAt}
              onLogActivity={logActivity}
              onUpdateCallCount={updateCallCount}
              onRefresh={() => { fetchLeads(); fetchCounts(); fetchLeaderboard(); }}
              showSourceColumn={false}
              userRole={userRole}
            />
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
