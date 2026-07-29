import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead, AdminUser, LeadTag, LeadPriority } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Trophy, CalendarClock, TrendingUp, Database, Network, Download, ArrowUpDown, HandCoins, ArrowRightLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { RecontactAccessPanel } from './RecontactAccessPanel';
import { LeadsTable } from './LeadsTable';
import { CallbackBanner } from './CallbackBanner';
import { NonSalesAssigneeBanner } from './NonSalesAssigneeBanner';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';
import type { LeadStatus } from '@/hooks/useLeads';
import { useLeadRoutingPermission } from '@/hooks/useLeadRoutingPermission';

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
const BULK_CLAIM_MAX_PER_DAY = 400;

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

export const LeadRecoveryTab: React.FC<{ userRole?: string | null; onNavigateToTab?: (tab: string, leadData?: any) => void }> = ({ userRole, onNavigateToTab }) => {
  // Source column intentionally hidden on Recontact page for all roles per product decision.
  const [segment, setSegment] = useState<SegmentId>('all_leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<SegmentId, number>>({} as any);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Raw auth.uid — kept alongside admin_users.id because sales_leads.assigned_to
  // historically stores EITHER value depending on which flow claimed the lead.
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [myOnly, setMyOnly] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Record<string, { worked: number; converted: number }>>({});
  const [customerEmails, setCustomerEmails] = useState<Set<string>>(new Set());
  const [customerRegs, setCustomerRegs] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'lost' | 'contacted'>('all');
  const [tags, setTags] = useState<LeadTag[]>([]);
  // Map of lead_id -> assigned tag IDs so we can filter by tags in the pill strip.
  const [leadTagMap, setLeadTagMap] = useState<Record<string, string[]>>({});
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [datePeriod, setDatePeriod] = useState<PeriodKey>('all');
  const [dateCustomRange, setDateCustomRange] = useState<DateRange | undefined>(undefined);
  const [claimedToday, setClaimedToday] = useState(0);
  const [claiming, setClaiming] = useState(false);
  // Per-agent management cap for the current signed-in agent (server-controlled).
  const [myCap, setMyCap] = useState<{ daily_cap: number | null; total_cap: number | null; blocked: boolean; taken_total: number } | null>(null);
  // Manager-only: which agent the bulk claim assigns to. '__me__' = self.
  const [assignTargetId, setAssignTargetId] = useState<string>('__me__');
  // Manager-only: bulk reassign dialog state.
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignFromId, setReassignFromId] = useState<string>('');
  const [reassignToId, setReassignToId] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignCount, setReassignCount] = useState<number | null>(null);
  // Manager-only: agent workload dialog + per-agent filter for the leads table.
  const [workloadOpen, setWorkloadOpen] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string>('all'); // admin_users.id or 'all' or '__unassigned__'
  // Status pill filter for the recontact page (mirrors New Leads UX).
  // Multi-select: leads pass if they match ANY selected pill. Empty set = 'all'.
  // 'all' pill clears every other selection.
  const [statusPillSet, setStatusPillSet] = useState<Set<string>>(() => new Set(['all']));
  const toggleStatusPill = useCallback((value: string) => {
    setStatusPillSet(prev => {
      const next = new Set(prev);
      if (value === 'all') return new Set(['all']);
      next.delete('all');
      if (next.has(value)) {
        next.delete(value);
        if (next.size === 0) next.add('all');
      } else {
        next.add(value);
      }
      return next;
    });
  }, []);

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
        setCurrentAuthUserId(uid);
        setCurrentRole(au?.role ?? null);
        // Sales agents (not sales_lead / manager / admin) may only see recontact
        // leads assigned to them — no shared pool visibility. Force "My leads only"
        // ON at mount so they don't briefly see other agents' leads.
        if (au?.role === 'sales') setMyOnly(true);
      } else {
        setCurrentUserId(null);
        setCurrentAuthUserId(null);
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
      .eq('assigned_by', currentUserId)
      .eq('assignment_type', 'recontact_bulk_claim')
      .gte('created_at', startOfDay.toISOString());
    setClaimedToday(count || 0);
  }, [currentUserId]);

  useEffect(() => { refreshClaimedToday(); }, [refreshClaimedToday]);

  // Load management-set cap/block for the current signed-in agent.
  useEffect(() => {
    if (!currentUserId) { setMyCap(null); return; }
    (async () => {
        const { data: au } = await (supabase.from('admin_users') as any)
          .select('id').eq('id', currentUserId).maybeSingle();
      const myAdminId = au?.id;
      if (!myAdminId) { setMyCap(null); return; }
      const [{ data: cap }, { data: stats }] = await Promise.all([
        (supabase.from('recontact_agent_caps') as any)
          .select('daily_cap, total_cap, blocked').eq('admin_user_id', myAdminId).maybeSingle(),
        (supabase.rpc as any)('recontact_agent_stats'),
      ]);
      const me = (stats as any[] | null)?.find((s: any) => s.admin_user_id === myAdminId);
      setMyCap({
        daily_cap: cap?.daily_cap ?? null,
        total_cap: cap?.total_cap ?? null,
        blocked: cap?.blocked ?? false,
        taken_total: Number(me?.taken_total ?? 0),
      });
    })();
  }, [currentUserId, claimedToday]);

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
      // Only include admins/super_admins if they've explicitly opted into the
      // Recontact workstream on the Lead Teams page. Prevents managers like
      // info@ (super_admin, non-sales) from appearing in the assignee pool.
      const filtered = all.filter(a => {
        if (a.role === 'admin' || a.role === 'super_admin') {
          return recontactSet.has(a.id);
        }
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

  // Recontact leads are worked by the whole sales floor — anyone granted lead
  // reassign access (per-agent "Staff Lead Access" control) can grab a lead.
  // Managers and office staff always pass; sales/sales_lead pass when their cap
  // flag is on.
  const { canReassign: canReassignAny, scope: reassignScope, teammateAdminUserIds } = useLeadRoutingPermission();
  const canExportCsv =
    (currentRole === 'admin' || currentRole === 'super_admin' || currentRole === 'sales_manager') &&
    (userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager');

  const buildBaseQuery = useCallback(() => {
    const select =
      'id, first_name, last_name, email, phone, lead_source, status, priority, priority_score, ' +
      'plan_interest, cart_value, quote_amount, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, ' +
      'vehicle_type, mileage, assigned_to, assigned_at, next_action_type, next_action_date, follow_up_status, ' +
      'last_activity_date, last_contacted_at, notes, converted_at, lost_at, lost_reason, abandoned_cart_id, ' +
      'created_at, updated_at, is_paid, payment_amount, payment_method, payment_date, step_two_completed_at, ' +
      'call_count, resubmission_count, last_resubmitted_at, is_callback, recovery_worked_at, recovery_outcome, ' +
      'claim_count, last_claimed_at';

    const q = (supabase.from('sales_leads') as any).select(select);

    // Recontact eligibility rule:
    //   Lead must be at least 30 days old (never surface last-month leads here —
    //   fresh leads belong to the New Leads flow with their original agent).
    //   AND not converted / fake / archived / already 'new'.
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString();

    // Terminal statuses (lost, not_interested, converted, fake_lead, archived)
    // are excluded from Recontact — there's nothing left to recover. Status
    // 'new' normally belongs to the New Leads flow, BUT a lead that was just
    // claimed from the Recontact pool is reset to 'new' — those must remain
    // visible here, so we allow status='new' when last_claimed_at is set.
    return q
      .not('step_two_completed_at', 'is', null)
      .not('status', 'in', '(converted,fake_lead,archived,lost,not_interested)')
      .or('status.neq.new,last_claimed_at.not.is.null')
      .or('is_paid.is.null,is_paid.eq.false')
      .lt('created_at', d30);
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
      // Sales agents can work the whole recontact pool: their own assigned
      // leads PLUS anything unassigned that's up for grabs. The client-side
      // collision safeguard (see filteredLeads) still hides leads another
      // agent has actively touched in the last 48h so two agents don't
      // double-work the same record.
      // NOTE: sales_leads.assigned_to historically holds EITHER admin_users.id
      // OR auth.uid depending on which flow assigned it. Match both so agents
      // don't lose visibility of leads they actually own.
      if (currentRole === 'sales' && currentUserId) {
        const ids = [currentUserId, currentAuthUserId].filter(Boolean) as string[];
        const orClause = ids.map(id => `assigned_to.eq.${id}`).join(',') + ',assigned_to.is.null';
        q = q.or(orClause);
      }

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
      const fetched = (data as any) || [];
      setLeads(fetched);

      // Load tag assignments for the fetched leads so the pill strip can
      // filter by tags such as "Not spoken to".
      if (fetched.length > 0) {
        const leadIds = fetched.map((l: any) => l.id);
        const { data: tagData, error: tagError } = await (supabase.from('lead_tag_assignments') as any)
          .select('lead_id, tag_id')
          .in('lead_id', leadIds);
        if (!tagError && tagData) {
          const map: Record<string, string[]> = {};
          for (const assignment of tagData as Array<{ lead_id: string; tag_id: string }>) {
            if (!map[assignment.lead_id]) map[assignment.lead_id] = [];
            map[assignment.lead_id].push(assignment.tag_id);
          }
          setLeadTagMap(map);
        }
      } else {
        setLeadTagMap({});
      }
    } catch (e: any) {
      toast.error('Failed to load recontact leads', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [buildBaseQuery, applySegment, segment, currentRole, currentUserId, currentAuthUserId]);

  const fetchCounts = useCallback(async () => {
    const results = await Promise.all(
      SEGMENTS.map(async (s) => {
        try {
          const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
          let q: any = (supabase.from('sales_leads') as any)
            .select('id', { count: 'exact', head: true })
            .not('step_two_completed_at', 'is', null)
            .not('status', 'in', '(new,converted,fake_lead,archived,lost,not_interested)')
            .or('is_paid.is.null,is_paid.eq.false')
            .lt('created_at', d30);
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
    // Collision safeguard: hide leads that are assigned to another agent
    // AND have been touched in the last 48h. Prevents two agents working the
    // same lead across New Leads + Recontact. Skipped when management is
    // explicitly filtering by a specific agent (they want to see that work)
    // or when "My leads only" is on (already restricts to self).
    if (!myOnly && agentFilter === 'all') {
      const mineIds = new Set([currentUserId, currentAuthUserId].filter(Boolean) as string[]);
      const cutoff = Date.now() - 48 * 3600 * 1000;
      list = list.filter((l: any) => {
        if (!l.assigned_to) return true;
        if (mineIds.has(l.assigned_to)) return true;
        const touched = l.updated_at || l.last_activity_date || l.assigned_at;
        if (!touched) return true;
        return new Date(touched).getTime() < cutoff;
      });
    }
    if (myOnly && (currentUserId || currentAuthUserId)) {
      // sales_leads.assigned_to may store either the admin_users.id OR the raw
      // auth uid depending on which flow assigned it. Match BOTH — using
      // `agents.find(a => a.user_id === currentUserId)` fails because
      // currentUserId is admin_users.id, not the auth uid, so we'd hide
      // every lead assigned via the auth-uid path.
      const mineIds = new Set([currentUserId, currentAuthUserId].filter(Boolean) as string[]);
      list = list.filter((l) => l.assigned_to && mineIds.has(l.assigned_to));
    }
    if (agentFilter !== 'all') {
      if (agentFilter === '__unassigned__') {
        list = list.filter((l) => !l.assigned_to);
      } else {
        const a = agents.find(x => x.id === agentFilter);
        const authId = a?.user_id ?? null;
        list = list.filter((l) => l.assigned_to === agentFilter || (authId && l.assigned_to === authId));
      }
    }
    if (!statusPillSet.has('all') && statusPillSet.size > 0) {
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      const t1 = new Date(); t1.setHours(23, 59, 59, 999);
      const notSpokenTag = tags.find((t) => t.name.toLowerCase() === 'not spoken to');
      const matchesPill = (l: any, pill: string): boolean => {
        switch (pill) {
          case 'due_today':
            return !!l.next_action_date && new Date(l.next_action_date) >= t0 && new Date(l.next_action_date) <= t1;
          case 'reminders':
            return !!l.next_action_date;
          case 'never_contacted':
            return !l.last_contacted_at && !l.recovery_worked_at;
          case 'no_answer':
            return l.recovery_outcome === 'no_answer';
          case 'interested':
            return l.recovery_outcome === 'interested' || l.recovery_outcome === 'needs_callback';
          case 'high_priority':
            return l.priority === 'high' || l.priority === 'urgent';
          case 'quote_sent':
            return l.status === 'quote_sent' || l.quote_amount != null;
          case 'tag_not_spoken_to':
            return !!(notSpokenTag && leadTagMap[l.id]?.includes(notSpokenTag.id));
          case 'newly_claimed':
            return !!l.last_claimed_at && (Date.now() - new Date(l.last_claimed_at).getTime()) < 3 * 24 * 3600 * 1000;
          default:
            return (l.status || 'new') === pill;
        }
      };
      // Union across all selected pills — a lead passes if it matches ANY pill.
      list = list.filter((l: any) => {
        for (const pill of statusPillSet) {
          if (matchesPill(l, pill)) return true;
        }
        return false;
      });
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
  }, [leads, search, myOnly, currentUserId, currentAuthUserId, agents, statusFilter, customerEmails, customerRegs, sortOrder, datePeriod, dateCustomRange, agentFilter, statusPillSet, tags, leadTagMap]);

  const claimSourceLeads = useMemo(() => {
    let list = leads;
    if (customerEmails.size > 0 || customerRegs.size > 0) {
      list = list.filter((l: any) => {
        const e = (l.email || '').trim().toLowerCase();
        const r = (l.vehicle_reg || '').replace(/\s+/g, '').toUpperCase();
        if (e && customerEmails.has(e)) return false;
        if (r && customerRegs.has(r)) return false;
        return true;
      });
    }
    if (agentFilter !== 'all') {
      if (agentFilter === '__unassigned__') {
        list = list.filter((l) => !l.assigned_to);
      } else {
        const a = agents.find(x => x.id === agentFilter);
        const authId = a?.user_id ?? null;
        list = list.filter((l) => l.assigned_to === agentFilter || (authId && l.assigned_to === authId));
      }
    }
    if (!statusPillSet.has('all') && statusPillSet.size > 0) {
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      const t1 = new Date(); t1.setHours(23, 59, 59, 999);
      const notSpokenTag = tags.find((t) => t.name.toLowerCase() === 'not spoken to');
      const matchesPill = (l: any, pill: string): boolean => {
        switch (pill) {
          case 'due_today':
            return !!l.next_action_date && new Date(l.next_action_date) >= t0 && new Date(l.next_action_date) <= t1;
          case 'reminders':
            return !!l.next_action_date;
          case 'never_contacted':
            return !l.last_contacted_at && !l.recovery_worked_at;
          case 'no_answer':
            return l.recovery_outcome === 'no_answer';
          case 'interested':
            return l.recovery_outcome === 'interested' || l.recovery_outcome === 'needs_callback';
          case 'high_priority':
            return l.priority === 'high' || l.priority === 'urgent';
          case 'quote_sent':
            return l.status === 'quote_sent' || l.quote_amount != null;
          case 'tag_not_spoken_to':
            return !!(notSpokenTag && leadTagMap[l.id]?.includes(notSpokenTag.id));
          case 'newly_claimed':
            return !!l.last_claimed_at && (Date.now() - new Date(l.last_claimed_at).getTime()) < 3 * 24 * 3600 * 1000;
          default:
            return (l.status || 'new') === pill;
        }
      };
      list = list.filter((l: any) => {
        for (const pill of statusPillSet) {
          if (matchesPill(l, pill)) return true;
        }
        return false;
      });
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
    return list;
  }, [leads, search, agents, statusFilter, customerEmails, customerRegs, datePeriod, dateCustomRange, agentFilter, statusPillSet, tags, leadTagMap]);

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

  // Bulk self-claim — grabs up to BULK_CLAIM_MAX_PER_CLICK oldest leads from
  // the *current filtered view* and assigns them to the logged-in agent.
  // - Respects the daily cap so no single agent hoovers the queue.
  // - FIFO ordering (oldest created_at first).
  // - Skips leads already assigned to the current agent.
  // - Writes one lead_assignment_audit row per claim with source 'recontact_bulk_claim'.
  // Management gate — must be satisfied by BOTH the parent-passed userRole prop
  // and the freshly-fetched admin_users.role. Prevents a stale/lagging prop from
  // briefly exposing manager-only buttons (Reassign / Agent workload / Export CSV)
  // to sales agents.
  const MGMT_ROLES = new Set(['admin', 'super_admin', 'sales_manager']);
  const isManager = MGMT_ROLES.has(currentRole || '') && MGMT_ROLES.has(userRole || '');
  const assignTargetAdminId = assignTargetId === '__me__' ? currentUserId : assignTargetId;
  const assigningToSelf = assignTargetAdminId === currentUserId;
  // Effective daily/total ceilings: management-set caps override the default guardrail (if lower).
  const effectiveDailyCap = assigningToSelf
    ? Math.min(BULK_CLAIM_MAX_PER_DAY, myCap?.daily_cap ?? Infinity)
    : Infinity;
  const remainingFromDaily = assigningToSelf
    ? Math.max(0, effectiveDailyCap - claimedToday)
    : BULK_CLAIM_MAX_PER_CLICK;
  const remainingFromTotal = assigningToSelf && myCap?.total_cap != null
    ? Math.max(0, myCap.total_cap - (myCap.taken_total || 0))
    : Infinity;
  const isBlocked = assigningToSelf && !!myCap?.blocked;
  const remainingToday = isBlocked ? 0 : Math.min(remainingFromDaily, remainingFromTotal);
  const targetAgent = agents.find(a => a.id === assignTargetAdminId);
  const targetLabel = assigningToSelf ? 'me' : (targetAgent ? agentLabel(targetAgent) : 'agent');

  // Per-agent workload snapshot across the currently-loaded recontact leads
  // (customers already excluded upstream). Used by the manager "Agent workload"
  // dialog so managers can see who has what and jump straight into an agent's
  // pipeline.
  const agentWorkload = useMemo(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const t0 = startOfToday.getTime();
    const t1 = endOfToday.getTime();
    // Base list: exclude customers (bought/cancelled/refunded).
    const base = leads.filter((l: any) => {
      const e = (l.email || '').trim().toLowerCase();
      const r = (l.vehicle_reg || '').replace(/\s+/g, '').toUpperCase();
      if (e && customerEmails.has(e)) return false;
      if (r && customerRegs.has(r)) return false;
      return true;
    });
    // Map assigned_to -> admin_users.id (may be either user_id or admin id).
    const authIdToAdmin = new Map<string, string>();
    agents.forEach(a => { if (a.user_id) authIdToAdmin.set(a.user_id, a.id); });
    const buckets = new Map<string, {
      adminId: string | null; total: number; dueToday: number; interested: number;
      quoteSent: number; noAnswer: number; neverContacted: number; workedToday: number;
    }>();
    const bucketFor = (id: string | null) => {
      const key = id ?? '__unassigned__';
      let b = buckets.get(key);
      if (!b) { b = { adminId: id, total: 0, dueToday: 0, interested: 0, quoteSent: 0, noAnswer: 0, neverContacted: 0, workedToday: 0 }; buckets.set(key, b); }
      return b;
    };
    for (const l of base as any[]) {
      const raw = l.assigned_to ?? null;
      const adminId = raw ? (authIdToAdmin.get(raw) ?? raw) : null;
      const b = bucketFor(adminId);
      b.total++;
      if (l.next_action_date) {
        const t = new Date(l.next_action_date).getTime();
        if (t >= t0 && t <= t1) b.dueToday++;
      }
      if (l.recovery_outcome === 'interested' || l.recovery_outcome === 'needs_callback') b.interested++;
      if (l.quote_amount != null) b.quoteSent++;
      if (l.recovery_outcome === 'no_answer') b.noAnswer++;
      if (!l.last_contacted_at && !l.recovery_worked_at) b.neverContacted++;
      const worked = l.recovery_worked_at || l.last_contacted_at;
      if (worked) {
        const t = new Date(worked).getTime();
        if (t >= t0 && t <= t1) b.workedToday++;
      }
    }
    return Array.from(buckets.values())
      .map(b => ({ ...b, agent: b.adminId ? agents.find(a => a.id === b.adminId) : undefined }))
      .sort((a, b) => b.total - a.total);
  }, [leads, agents, customerEmails, customerRegs]);

  // Status pill counts — computed over the same base pool the table uses
  // (customer exclusion + agent + myOnly), so each pill's number tracks what
  // clicking it will actually show.
  const pillCounts = useMemo(() => {
    let base = leads.filter((l: any) => {
      const e = (l.email || '').trim().toLowerCase();
      const r = (l.vehicle_reg || '').replace(/\s+/g, '').toUpperCase();
      if (e && customerEmails.has(e)) return false;
      if (r && customerRegs.has(r)) return false;
      return true;
    });
    if (myOnly && (currentUserId || currentAuthUserId)) {
      const mineIds = new Set([currentUserId, currentAuthUserId].filter(Boolean) as string[]);
      base = base.filter((l: any) => l.assigned_to && mineIds.has(l.assigned_to));
    }
    if (agentFilter !== 'all') {
      if (agentFilter === '__unassigned__') base = base.filter((l: any) => !l.assigned_to);
      else {
        const a = agents.find(x => x.id === agentFilter);
        const authId = a?.user_id ?? null;
        base = base.filter((l: any) => l.assigned_to === agentFilter || (authId && l.assigned_to === authId));
      }
    }
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const t1 = new Date(); t1.setHours(23, 59, 59, 999);
    const c = {
      all: base.length, new: 0, contacted: 0, follow_up: 0, quote_sent: 0, paid: 0,
      converted: 0, lost: 0, fake_lead: 0, high_priority: 0,
      no_answer: 0, interested: 0, never_contacted: 0, due_today: 0, reminders: 0,
      not_spoken_to: 0, newly_claimed: 0,
    };
    const newlyCutoff = Date.now() - 3 * 24 * 3600 * 1000;
    const notSpokenTag = tags.find((t) => t.name.toLowerCase() === 'not spoken to');
    for (const l of base as any[]) {
      const s = (l.status || 'new');
      if (s in c) (c as any)[s]++;
      if (l.priority === 'high' || l.priority === 'urgent') c.high_priority++;
      if (l.recovery_outcome === 'no_answer') c.no_answer++;
      if (l.recovery_outcome === 'interested' || l.recovery_outcome === 'needs_callback') c.interested++;
      if (l.quote_amount != null && s !== 'quote_sent') c.quote_sent++;
      if (!l.last_contacted_at && !l.recovery_worked_at) c.never_contacted++;
      if (l.next_action_date) {
        c.reminders++;
        const t = new Date(l.next_action_date).getTime();
        if (t >= t0.getTime() && t <= t1.getTime()) c.due_today++;
      }
      if (notSpokenTag && leadTagMap[l.id]?.includes(notSpokenTag.id)) c.not_spoken_to++;
      if (l.last_claimed_at && new Date(l.last_claimed_at).getTime() >= newlyCutoff) c.newly_claimed++;
    }
    return c;
  }, [leads, agents, customerEmails, customerRegs, myOnly, currentUserId, agentFilter, tags, leadTagMap]);


  // Preview how many leads currently belong to the "from" agent when the
  // reassign dialog is open, so the manager sees the impact before confirming.
  useEffect(() => {
    if (!reassignOpen || !reassignFromId) { setReassignCount(null); return; }
    let cancelled = false;
    (async () => {
      const { count } = await (supabase.from('sales_leads') as any)
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', reassignFromId);
      if (!cancelled) setReassignCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [reassignOpen, reassignFromId]);

  const reassignAll = useCallback(async () => {
    if (!currentUserId) { toast.error('Not signed in'); return; }
    if (!reassignFromId || !reassignToId) { toast.error('Pick both agents'); return; }
    if (reassignFromId === reassignToId) { toast.error('Pick two different agents'); return; }
    setReassigning(true);
    try {
      const now = new Date().toISOString();
      const { data: updated, error } = await (supabase.from('sales_leads') as any)
        .update({ assigned_to: reassignToId, assigned_at: now })
        .eq('assigned_to', reassignFromId)
        .select('id');
      if (error) throw error;
      const ids = ((updated as any[]) || []).map(r => r.id);
      if (ids.length) {
        const auditRows = ids.map(id => ({
          lead_id: id,
          assigned_to_id: reassignToId,
          assigned_by: currentUserId,
          assignment_type: 'manager_bulk_reassign',
          reason: `Bulk reassign from ${agentLabel(agents.find(a => a.id === reassignFromId))} to ${agentLabel(agents.find(a => a.id === reassignToId))}`,
        }));
        await (supabase.from('lead_assignment_audit') as any).insert(auditRows).then(() => {}, () => {});
      }
      const idSet = new Set(ids);
      setLeads(prev => prev.map(l => idSet.has(l.id) ? ({ ...l, assigned_to: reassignToId, assigned_at: now } as any) : l));
      toast.success(`Reassigned ${ids.length} lead${ids.length === 1 ? '' : 's'}`);
      setReassignOpen(false);
      setReassignFromId('');
      setReassignToId('');
      setReassignCount(null);
    } catch (e: any) {
      toast.error('Reassign failed', { description: e.message });
    } finally {
      setReassigning(false);
    }
  }, [currentUserId, reassignFromId, reassignToId, agents]);

  const claimBulk = useCallback(async () => {
    if (!currentUserId) { toast.error('Not signed in'); return; }
    if (!assignTargetAdminId) { toast.error('Pick an agent to assign to'); return; }
    if (isBlocked) {
      toast.error('Blocked by management', { description: 'A manager has paused your access to the recontact pool.' });
      return;
    }
    if (assigningToSelf && remainingToday <= 0) {
      const reason = myCap?.total_cap != null && (myCap.taken_total || 0) >= myCap.total_cap
        ? `You've hit your total allowance (${myCap.total_cap}).`
        : `You've already claimed ${claimedToday} today.`;
      toast.error('Claim limit reached', { description: reason });
      return;
    }
    // Candidate pool:
    //  - Self-claim normally honours the current view (filteredLeads), including
    //    the 48h collision safeguard so two agents don't fight over the same lead.
    //  - Sales agents are loaded with "My leads only" on by default. That view
    //    intentionally contains only leads they already own, and the claim step
    //    skips already-owned leads. When that switch is on, ignore only that
    //    display restriction for claiming so Freddie / sales@ can still take
    //    unassigned recontact leads from the shared pool.
    //  - Manager assigning to another agent: this IS an explicit override, so
    //    we pull from the raw `leads` list with only the customer-exclusion
    //    filter applied. Otherwise the collision safeguard silently hides
    //    leads that were touched recently and the agent gets far fewer than
    //    the requested batch (e.g. "Assign 100" only assigning 38).
    const targetAuthId = agents.find(a => a.id === assignTargetAdminId)?.user_id ?? null;
    const shouldIgnoreMyOnlyForClaim = assigningToSelf && myOnly && currentRole === 'sales';
    const basePool = assigningToSelf
      ? (shouldIgnoreMyOnlyForClaim ? claimSourceLeads : filteredLeads)
      : leads.filter((l: any) => {
          const e = (l.email || '').trim().toLowerCase();
          const r = (l.vehicle_reg || '').replace(/\s+/g, '').toUpperCase();
          if (e && customerEmails.has(e)) return false;
          if (r && customerRegs.has(r)) return false;
          return true;
        });
    const candidates = [...basePool]
      .filter(l => l.assigned_to !== assignTargetAdminId && (!targetAuthId || l.assigned_to !== targetAuthId))
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      .slice(0, Math.min(BULK_CLAIM_MAX_PER_CLICK, remainingToday));
    if (!candidates.length) {
      toast.error('Nothing to claim', { description: 'No claimable leads available to assign.' });
      return;
    }
    setClaiming(true);
    try {
      const now = new Date().toISOString();
      let claimedIds: string[] = [];

      if (assigningToSelf) {
        // Server-side atomic self-claim. Avoids the fragile multi-request client
        // update loop that was intermittently failing with "Failed to fetch"
        // for sales agents (sales@, freddie). Runs one round-trip, writes audit
        // rows server-side with the correct columns.
        //
        // Batched into chunks of 25 with a retry — some sales users (freddie)
        // were still hitting a browser-level "TypeError: Failed to fetch" when
        // the single request took too long or was cut off by a flaky
        // connection. Small chunks + retry recovers cleanly.
        const ids = candidates.map(l => l.id);
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 25) chunks.push(ids.slice(i, i + 25));

        const callRpc = async (chunk: string[]) => {
          let lastErr: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const { data: rows, error } = await (supabase.rpc as any)(
                'claim_recontact_leads_self',
                { _lead_ids: chunk },
              );
              if (error) throw error;
              return ((rows as any[]) || []).map(r => r.claimed_id).filter(Boolean);
            } catch (err: any) {
              lastErr = err;
              const msg = String(err?.message || '');
              // Only retry on transient network failures.
              if (!/Failed to fetch|NetworkError|network|timeout/i.test(msg)) throw err;
              await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
            }
          }
          throw lastErr;
        };

        for (const chunk of chunks) {
          const got = await callRpc(chunk);
          claimedIds.push(...got);
        }
      } else {
        // Manager assigning to another agent — keep the existing per-owner
        // optimistic path so we don't overwrite leads that changed hands.
        const groups = new Map<string | null, string[]>();
        candidates.forEach(l => {
          const key = l.assigned_to ?? null;
          const arr = groups.get(key) || [];
          arr.push(l.id);
          groups.set(key, arr);
        });
        for (const [prevOwner, ids] of groups.entries()) {
          let q = (supabase.from('sales_leads') as any)
            // Reset status to 'new' (displayed as "Not spoken to") so the new
            // agent starts on a clean slate rather than inheriting a stale
            // status the previous owner left weeks/months ago. Stamp
            // last_claimed_at so the lead stays visible in Recontact (the
            // base query keeps status='new' leads that have last_claimed_at).
            .update({ assigned_to: assignTargetAdminId, assigned_at: now, status: 'new', last_claimed_at: now })
            .in('id', ids);
          q = prevOwner == null ? q.is('assigned_to', null) : q.eq('assigned_to', prevOwner);
          const { data: updated, error } = await q.select('id');
          if (error) throw error;
          (updated || []).forEach((r: any) => claimedIds.push(r.id));
        }
        const claimedSet = new Set(claimedIds);
        const claimedCandidates = candidates.filter(l => claimedSet.has(l.id));
        const auditRows = claimedCandidates.map(l => ({
          lead_id: l.id,
          assigned_to_id: assignTargetAdminId,
          assigned_by: currentUserId,
          assignment_type: 'recontact_bulk_assign',
          reason: `Bulk assign to ${targetLabel}`,
        }));
        await (supabase.from('lead_assignment_audit') as any).insert(auditRows).then(() => {}, () => {});
      }

      const stolenCount = candidates.length - claimedIds.length;
      if (!claimedIds.length) {
        toast.error('Nothing claimed', {
          description: 'Another agent claimed these leads just now. Refresh to see the latest.',
        });
        return;
      }

      const claimedSet = new Set(claimedIds);
      setLeads(prev => prev.map(l => claimedSet.has(l.id) ? ({ ...l, assigned_to: assignTargetAdminId, assigned_at: now, status: 'new' } as any) : l));
      if (assigningToSelf) setClaimedToday(c => c + claimedIds.length);
      const descParts: string[] = [];
      if (assigningToSelf) descParts.push(`${Math.max(0, remainingToday - claimedIds.length)} remaining today.`);
      if (stolenCount > 0) descParts.unshift(`${stolenCount} skipped (claimed by another agent).`);
      toast.success(
        assigningToSelf
          ? `Claimed ${claimedIds.length} lead${claimedIds.length === 1 ? '' : 's'}`
          : `Assigned ${claimedIds.length} lead${claimedIds.length === 1 ? '' : 's'} to ${targetLabel}`,
        { description: descParts.join(' ') || undefined },
      );
    } catch (e: any) {
      toast.error('Bulk claim failed', { description: e.message });
    } finally {
      setClaiming(false);
    }
  }, [currentUserId, currentRole, filteredLeads, claimSourceLeads, leads, agents, customerEmails, customerRegs, assignTargetAdminId, assigningToSelf, remainingToday, claimedToday, targetLabel, isBlocked, myCap, myOnly]);

  const exportCsv = useCallback(() => {
    if (!filteredLeads.length) {
      toast.error('Nothing to export', { description: 'There are no leads in the current view.' });
      return;
    }
    const headers = [
      'First name','Last name','Email','Phone','Status','Source','Plan interest',
      'Vehicle reg','Vehicle make','Vehicle model','Vehicle year','Mileage',
      'Cart value','Quote amount','Calls','Last contacted','Last worked','Recovery outcome',
      'Assigned to','Assigned at','Date added','Created at',
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
        l.assigned_at, l.last_claimed_at, l.created_at,
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
    { label: 'Worked today',         value: myStats.worked,    icon: CheckCircle2,  tint: 'text-green-600' },
    { label: 'Follow-ups due today', value: dueTodayCount,     icon: CalendarClock, tint: 'text-blue-600' },
    { label: 'Converted today',      value: myStats.converted, icon: Trophy,        tint: 'text-amber-500' },
  ];


  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Sticky header — page title, refresh, my-leads + search stay in view while scrolling */}
      <div className="-mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              Recontact Leads
              <Badge
                variant="secondary"
                className="text-base px-2.5 py-0.5 font-bold tabular-nums"
                title="Total recontact leads in this view"
              >
                {totalCount.toLocaleString()}
              </Badge>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground max-w-3xl">
              Past enquiries that didn't purchase. Call the lead and log the outcome.
            </p>
            {agentFilter !== 'all' && (
              <div className="pt-1">
                <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5">
                  Filtered to: {agentFilter === '__unassigned__' ? 'Unassigned' : agentLabel(agents.find(a => a.id === agentFilter))}
                  <button
                    type="button"
                    className="ml-1 text-primary hover:text-primary/70"
                    onClick={() => setAgentFilter('all')}
                    title="Clear agent filter"
                  >
                    ×
                  </button>
                </Badge>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto justify-end">
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
                <SelectItem value="contacted">Spoken to</SelectItem>
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
            {(() => {
              const hasFilters =
                search.trim() !== '' ||
                myOnly ||
                agentFilter !== 'all' ||
                statusFilter !== 'all' ||
                datePeriod !== 'all' ||
                segment !== 'all_leads' ||
                !(statusPillSet.size === 1 && statusPillSet.has('all'));
              if (!hasFilters) return null;
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setMyOnly(false);
                    setAgentFilter('all');
                    setStatusFilter('all');
                    setDatePeriod('all');
                    setDateCustomRange(undefined);
                    setSegment('all_leads');
                    setStatusPillSet(new Set(['all']));
                  }}
                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Clear all filters so you can see every lead in your view"
                >
                  <X className="h-4 w-4 mr-1" /> Clear filters
                </Button>
              );
            })()}
            <div className="hidden md:flex items-center gap-1 pr-2 mr-1 border-r">
              {STAT_CARDS.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs"
                  title={s.label}
                >
                  <s.icon className={`h-3.5 w-3.5 ${s.tint}`} />
                  <span className="text-muted-foreground whitespace-nowrap">{s.label}</span>
                  <span className="font-semibold tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
            {isManager && (
              <Select value={assignTargetId} onValueChange={setAssignTargetId}>
                <SelectTrigger className="h-9 w-[170px] text-sm shrink-0" title="Assign the claimed leads to this agent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__me__">Assign to me</SelectItem>
                  {agents
                    .filter(a => a.role === 'sales' || a.role === 'sales_lead')
                    .map(a => (
                      <SelectItem key={a.id} value={a.id}>{agentLabel(a)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={claimBulk}
              disabled={claiming || remainingToday <= 0 || !assignTargetAdminId}
              className="shrink-0"
              title={assigningToSelf
                ? `Assign up to ${BULK_CLAIM_MAX_PER_CLICK} of the oldest leads in this view to yourself. Daily cap ${BULK_CLAIM_MAX_PER_DAY}.`
                : `Assign up to ${BULK_CLAIM_MAX_PER_CLICK} of the oldest leads in this view to ${targetLabel}.`}
            >
              {claiming
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <HandCoins className="h-4 w-4 mr-1" />}
              {assigningToSelf ? 'Claim' : 'Assign'} {Math.min(BULK_CLAIM_MAX_PER_CLICK, remainingToday)}
              {assigningToSelf && (
                <span className="ml-1 text-xs text-muted-foreground">({remainingToday} left today)</span>
              )}
            </Button>
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReassignOpen(true)}
                className="shrink-0"
                title="Move every lead currently assigned to one agent over to another agent"
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" /> Reassign
              </Button>
            )}
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWorkloadOpen(true)}
                className="shrink-0"
                title="See every agent's recontact lead pipeline at a glance"
              >
                <Network className="h-4 w-4 mr-1" /> Agent workload
              </Button>
            )}



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


      {(currentRole === 'admin' || currentRole === 'super_admin' || currentRole === 'sales_manager') && (
        <RecontactAccessPanel />
      )}

      {/* Status pill strip — mirrors New Leads UX. Click a pill to filter the
          table to that status. Counts reflect the current agent/myOnly scope. */}
      {(() => {
        const PILLS: { value: string; label: string; icon?: string; color: string; count: number }[] = [
          { value: 'all',            label: 'Total',           icon: '📋', color: 'bg-foreground text-background',       count: pillCounts.all },
          { value: 'due_today',      label: 'Due Today',       icon: '🔔', color: 'bg-orange-500 text-white',            count: pillCounts.due_today },
          { value: 'reminders',      label: 'Reminders',       icon: '⏰', color: 'bg-amber-600 text-white',             count: pillCounts.reminders },
          { value: 'never_contacted',label: 'Never contacted', icon: '🆕', color: 'bg-slate-600 text-white',             count: pillCounts.never_contacted },
          { value: 'newly_claimed',  label: 'Newly claimed',   icon: '✨', color: 'bg-emerald-500 text-white',           count: pillCounts.newly_claimed },
          { value: 'tag_not_spoken_to', label: 'Not spoken to', icon: '🤐', color: 'bg-cyan-700 text-white',             count: pillCounts.not_spoken_to },
          { value: 'contacted',      label: 'Spoken to',                  color: 'bg-yellow-500 text-white',             count: pillCounts.contacted },
          { value: 'follow_up',      label: 'Follow-up',                  color: 'bg-purple-600 text-white',             count: pillCounts.follow_up },
          { value: 'no_answer',      label: 'No Answer',       icon: '📵', color: 'bg-zinc-500 text-white',              count: pillCounts.no_answer },
          { value: 'interested',     label: 'Interested',      icon: '🎯', color: 'bg-blue-600 text-white',              count: pillCounts.interested },
          { value: 'quote_sent',     label: 'Quoted',                     color: 'bg-indigo-600 text-white',             count: pillCounts.quote_sent },
          { value: 'high_priority',  label: 'Hot',             icon: '🔥', color: 'bg-orange-600 text-white',            count: pillCounts.high_priority },
          // Terminal statuses (lost / fake / won) are excluded from Recontact
          // by design — this view is for leads still worth chasing.
        ];
        return (
          <div className="flex flex-wrap gap-1 p-1 bg-muted/40 border border-border rounded-lg">
            {PILLS.map((p) => {
              const active = statusPillSet.has(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => toggleStatusPill(p.value)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                    active
                      ? p.color
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  }`}
                  title={p.value === 'all' ? 'Show all — clears other selections' : `Toggle ${p.label.toLowerCase()} (combine with others)`}
                >
                  {p.icon && <span className="text-[10px]">{p.icon}</span>}
                  <span>{p.label}</span>
                  <span className={`inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold tabular-nums ${
                    active ? 'bg-white/25 text-inherit' : p.count > 0 ? 'bg-muted text-muted-foreground' : 'bg-muted/50 text-muted-foreground/60'
                  }`}>
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })()}








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

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          {/* Red warning — recontact leads stuck on non-sales accounts (management only) */}
          <NonSalesAssigneeBanner
            agents={agents}
            currentRole={currentRole}
            onReassigned={() => { fetchLeads(); }}
          />

          {/* Callback requests banner — any agent can see and call */}
          {!loading && filteredLeads.length > 0 && (
            <CallbackBanner leads={filteredLeads} />
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading recontact leads…
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No recontact leads match your filters. Try clearing your filters, or switch off &quot;My leads only&quot;.
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
              onSendQuote={onNavigateToTab ? (lead) => onNavigateToTab('get-quote', {
                id: lead.id,
                first_name: lead.first_name,
                last_name: lead.last_name,
                email: lead.email,
                phone: lead.phone,
                vehicle_reg: lead.vehicle_reg,
                vehicle_make: lead.vehicle_make,
                vehicle_model: lead.vehicle_model,
                vehicle_year: lead.vehicle_year,
                mileage: lead.mileage,
                plan_interest: lead.plan_interest,
              }) : undefined}
              showSourceColumn={false}
              userRole={userRole}
              hideNewStatus
              recontactMode
              currentAdminId={currentUserId}
            />
          )}
        </div>


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
              hidePoolOutcome
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Manager-only: bulk reassign every lead from one agent to another. */}
      <Dialog open={reassignOpen} onOpenChange={(o) => { setReassignOpen(o); if (!o) { setReassignFromId(''); setReassignToId(''); setReassignCount(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Reassign all leads
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Move every lead currently owned by one agent to another. This runs across all recontact leads, not just the current filter.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">From agent</Label>
              <Select value={reassignFromId} onValueChange={setReassignFromId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Pick source agent…" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{agentLabel(a)} · {a.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reassignFromId && reassignCount != null && (
                <p className="text-xs text-muted-foreground">
                  {reassignCount} lead{reassignCount === 1 ? '' : 's'} currently assigned.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">
                To agent
                {reassignScope === 'own_team' && (
                  <span className="ml-2 text-muted-foreground font-normal">
                    (own team only)
                  </span>
                )}
              </Label>
              <Select value={reassignToId} onValueChange={setReassignToId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Pick destination agent…" />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter(a => a.id !== reassignFromId)
                    .filter(a =>
                      reassignScope !== 'own_team' ||
                      teammateAdminUserIds.size === 0 ||
                      teammateAdminUserIds.has(a.id)
                    )
                    .map(a => (
                      <SelectItem key={a.id} value={a.id}>{agentLabel(a)} · {a.role}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setReassignOpen(false)} disabled={reassigning}>Cancel</Button>
              <Button
                size="sm"
                onClick={reassignAll}
                disabled={reassigning || !reassignFromId || !reassignToId || reassignFromId === reassignToId || reassignCount === 0}
              >
                {reassigning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-1" />}
                Reassign{reassignCount ? ` ${reassignCount}` : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manager-only: per-agent recontact pipeline snapshot */}
      <Dialog open={workloadOpen} onOpenChange={setWorkloadOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" /> Agent workload — Recontact leads
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Snapshot across the currently loaded recontact leads. Click <strong>View leads</strong> to filter the table to that agent.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Agent</th>
                  <th className="py-2 px-2 font-medium text-right">Total</th>
                  <th className="py-2 px-2 font-medium text-right">Due today</th>
                  <th className="py-2 px-2 font-medium text-right">Interested</th>
                  <th className="py-2 px-2 font-medium text-right">Quote sent</th>
                  <th className="py-2 px-2 font-medium text-right">No answer</th>
                  <th className="py-2 px-2 font-medium text-right">Never contacted</th>
                  <th className="py-2 px-2 font-medium text-right">Worked today</th>
                  <th className="py-2 pl-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {agentWorkload.length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No leads loaded yet.</td></tr>
                )}
                {agentWorkload.map((row) => {
                  const key = row.adminId ?? '__unassigned__';
                  const label = row.agent ? agentLabel(row.agent) : 'Unassigned';
                  return (
                    <tr key={key} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-foreground">{label}</div>
                        {row.agent && <div className="text-xs text-muted-foreground">{row.agent.email} · {row.agent.role}</div>}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold">{row.total}</td>
                      <td className="py-2 px-2 text-right">{row.dueToday || '—'}</td>
                      <td className="py-2 px-2 text-right">{row.interested || '—'}</td>
                      <td className="py-2 px-2 text-right">{row.quoteSent || '—'}</td>
                      <td className="py-2 px-2 text-right">{row.noAnswer || '—'}</td>
                      <td className="py-2 px-2 text-right">{row.neverContacted || '—'}</td>
                      <td className="py-2 px-2 text-right">{row.workedToday || '—'}</td>
                      <td className="py-2 pl-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setAgentFilter(key);
                            setMyOnly(false);
                            setWorkloadOpen(false);
                            toast.success(`Filtered to ${label}`);
                          }}
                        >
                          View leads
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadRecoveryTab;
