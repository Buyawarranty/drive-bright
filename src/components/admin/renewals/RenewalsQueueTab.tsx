import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import {
  Repeat, Phone, Mail, Loader2, CheckCircle2, AlertCircle, TrendingUp,
  Send, UserCheck, Play, Network, StickyNote, UserCircle2, Trophy,
  RefreshCw, ArrowRightLeft, CalendarClock, Zap, MailPlus,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';
import { BulkEmailDialog } from '@/components/admin/BulkEmailDialog';
import { RenewalPoolBar } from '@/components/admin/renewals/RenewalPoolBar';
import { useCustomerActivity } from '@/hooks/useCustomerActivity';
import { useLeadRoutingPermission } from '@/hooks/useLeadRoutingPermission';
import { CustomerActivityCell } from '@/components/admin/leads/CustomerActivityCell';
import {
  useRenewalReservation,
  useRenewalReservationCountdown,
  clearRenewalReservation,
} from '@/hooks/useRenewalPoolReservation';

type SegmentId =
  | 'due_today'
  | 'due_7'
  | 'due_30'
  | 'due_60'
  | 'renewal_window'
  | 'upsell'
  | 'lapsed'
  | 'all_renewals';

const SEGMENTS: { id: SegmentId; label: string; description: string }[] = [
  { id: 'due_today',      label: 'Due Today',       description: 'Policies expiring today — priority calls.' },
  { id: 'due_7',          label: 'Due in 7 days',   description: 'Policies expiring in the next 7 days.' },
  { id: 'due_30',         label: 'Due in 30 days',  description: 'Policies expiring in the next 30 days.' },
  { id: 'due_60',         label: 'Due in 60 days',  description: 'Policies expiring in the next 60 days.' },
  { id: 'renewal_window', label: 'Renewal Window',  description: 'Expires in 61–180 days — warm-up calls.' },
  { id: 'upsell',         label: 'Upsell',          description: 'Active policy with room to upgrade claim limit or add-ons.' },
  { id: 'lapsed',         label: 'Lapsed',          description: 'Expired 0–180 days ago, not yet renewed.' },
  { id: 'all_renewals',   label: 'All Renewals',    description: 'Every active renewal candidate including renewed customers.' },
];

const OUTCOMES = [
  { value: 'renewed',              label: 'Renewed' },
  { value: 'upgraded',             label: 'Upgraded' },
  { value: 'renewed_upgraded',     label: 'Renewed + Upgraded' },
  { value: 'still_considering',    label: 'Still considering' },
  { value: 'no_answer',            label: 'No answer' },
  { value: 'left_voicemail',       label: 'Left voicemail' },
  { value: 'wrong_number',         label: 'Wrong number' },
  { value: 'callback_booked',      label: 'Callback booked' },
  { value: 'declined',             label: 'Declined' },
  { value: 'cancelled_at_renewal', label: 'Cancelled at renewal' },
  { value: 'lost_to_competitor',   label: 'Lost to competitor' },
  { value: 'bought_elsewhere',     label: 'Bought elsewhere' },
  { value: 'vehicle_sold',         label: 'Vehicle sold' },
  { value: 'do_not_contact',       label: 'Do not contact' },
];

const RENEWED_OUTCOMES = new Set(['renewed', 'upgraded', 'renewed_upgraded']);

const EXCLUDED_STATUSES = "('cancelled','refunded','expired','voided','deleted')";
const PAGE_SIZE = 500;
const UNASSIGNED = '__unassigned__';

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
    created_at?: string | null;
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
  if (days < 0) return <Badge className="bg-red-100 text-red-800 border-red-200">Overdue {Math.abs(days)}d</Badge>;
  if (days === 0) return <Badge className="bg-red-100 text-red-800 border-red-200">Today</Badge>;
  if (days <= 14) return <Badge className="bg-red-100 text-red-800 border-red-200">{days}d</Badge>;
  if (days <= 30) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{days}d</Badge>;
  return <Badge variant="outline">{days}d</Badge>;
}

function planLengthLabel(row: PolicyRow): string {
  if (!row.policy_start_date || !row.policy_end_date) return '—';
  const months = Math.round(
    (new Date(row.policy_end_date).getTime() - new Date(row.policy_start_date).getTime()) / (30.44 * 86400000)
  );
  if (months <= 14) return '12mo';
  if (months <= 26) return '24mo';
  if (months <= 38) return '36mo';
  return `${months}mo`;
}

export const RenewalsQueueTab: React.FC<{ userRole?: string | null; onNavigateToTab?: (tab: string, leadData?: any) => void }> = ({ userRole, onNavigateToTab }) => {
  const canSeeSource = userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager' || userRole === 'lead_gen';
  // Per-agent "Staff Lead Access" control: managers/office staff always pass;
  // sales/sales_lead pass when their cap flag is on.
  const { canReassign: canReassignAny } = useLeadRoutingPermission();

  const [segment, setSegment] = useState<SegmentId>('all_renewals');
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<SegmentId, number>>({} as any);
  const [search, setSearch] = useState('');
  const [workedToday, setWorkedToday] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // auth uid
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [totalActive, setTotalActive] = useState<number | null>(null);
  const [renewals12mo, setRenewals12mo] = useState<number | null>(null);
  const [runningCron, setRunningCron] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [callCountsByEmail, setCallCountsByEmail] = useState<Record<string, number>>({});
  const [claimEmails, setClaimEmails] = useState<Set<string>>(new Set());
  const [claimRegs, setClaimRegs] = useState<Set<string>>(new Set());
  const [latestNoteByCustomer, setLatestNoteByCustomer] = useState<Record<string, { text: string; at: string }>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [myOnly, setMyOnly] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  type SortKey = 'due_next' | 'due_latest' | 'newest' | 'oldest' | 'name_az' | 'name_za';
  const [sortKey, setSortKey] = useState<SortKey>('due_next');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [datePeriod, setDatePeriod] = useState<PeriodKey>('all');
  const [dateCustomRange, setDateCustomRange] = useState<DateRange | undefined>(undefined);
  const [leaderboard, setLeaderboard] = useState<Record<string, { worked: number; renewed: number }>>({});
  const [bulkAssignTo, setBulkAssignTo] = useState<string>('');
  const [pinnedRow, setPinnedRow] = useState<PolicyRow | null>(null);

  // Renewal Pool reservation → pin the reserved policy at the top with a mint highlight.
  const renewalReservation = useRenewalReservation();
  const renewalRemaining = useRenewalReservationCountdown(renewalReservation);
  useEffect(() => {
    if (!renewalReservation) { setPinnedRow(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from('customer_policies') as any)
        .select(baseSelect)
        .eq('id', renewalReservation.policyId)
        .maybeSingle();
      if (!cancelled) setPinnedRow((data as PolicyRow) ?? null);
    })();
    return () => { cancelled = true; };
    // baseSelect is a stable string constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renewalReservation?.policyId]);

  const stampRenewalOwnership = useCallback(async (policyId: string) => {
    if (!currentAdminId) return;
    if (renewalReservation?.policyId !== policyId) return;
    try {
      await (supabase as any).rpc('renewal_pool_stamp_ownership', {
        _policy: policyId, _agent: currentAdminId,
      });
      clearRenewalReservation();
    } catch { /* non-fatal */ }
  }, [currentAdminId, renewalReservation?.policyId]);

  // Auth bootstrap — collect auth uid + admin_users.id
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        const { data: au } = await (supabase.from('admin_users') as any)
          .select('id').eq('user_id', uid).maybeSingle();
        setCurrentAdminId(au?.id ?? null);
      }
    })();
  }, []);

  // Agents (prefer workstream_renewals opt-ins; fallback to all sales-side)
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
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const in7   = new Date(now.getTime() + 7   * 86400000).toISOString();
    const in30  = new Date(now.getTime() + 30  * 86400000).toISOString();
    const in60  = new Date(now.getTime() + 60  * 86400000).toISOString();
    const in61  = new Date(now.getTime() + 61  * 86400000).toISOString();
    const in180 = new Date(now.getTime() + 180 * 86400000).toISOString();
    const ago180 = new Date(now.getTime() - 180 * 86400000).toISOString();
    const nowIso = now.toISOString();

    switch (id) {
      case 'due_today':
        return q
          .gte('policy_end_date', startOfToday.toISOString())
          .lte('policy_end_date', endOfToday.toISOString());
      case 'due_7':
        return q.gte('policy_end_date', nowIso).lte('policy_end_date', in7);
      case 'due_30':
        return q.gte('policy_end_date', nowIso).lte('policy_end_date', in30);
      case 'due_60':
        return q.gte('policy_end_date', nowIso).lte('policy_end_date', in60);
      case 'renewal_window':
        return q.gte('policy_end_date', in61).lte('policy_end_date', in180);
      case 'upsell':
        return q.gt('policy_end_date', in180).lt('claim_limit', 2000);
      case 'lapsed':
        return q.gte('policy_end_date', ago180).lt('policy_end_date', nowIso);
      case 'all_renewals':
      default:
        return q.gte('policy_end_date', ago180);
    }
  }, []);

  const baseSelect =
    'id, customer_id, policy_number, warranty_number, plan_type, payment_type, status, ' +
    'policy_start_date, policy_end_date, claim_limit, tyre_cover, wear_tear, ' +
    'breakdown_recovery, vehicle_rental, europe_cover, mot_repair, ' +
    'retention_worked_at, retention_outcome, customer_full_name, email, ' +
    'customers!fk_customer_policies_customer_id ( id, first_name, last_name, name, email, phone, registration_plate, vehicle_make, vehicle_model, status, assigned_to, created_at )';

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      let q: any = (supabase.from('customer_policies') as any)
        .select(baseSelect)
        .not('status', 'in', EXCLUDED_STATUSES)
        .or('is_deleted.is.null,is_deleted.eq.false');
      q = applySegment(q, segment);

      // Optional date filter — narrows by policy_end_date window on top of segment
      if (datePeriod !== 'all') {
        const range = datePeriod === 'custom' ? dateCustomRange : periodToRange(datePeriod);
        if (range?.from) {
          const from = new Date(range.from); from.setHours(0, 0, 0, 0);
          q = q.gte('policy_end_date', from.toISOString());
        }
        if (range?.to) {
          const to = new Date(range.to); to.setHours(23, 59, 59, 999);
          q = q.lte('policy_end_date', to.toISOString());
        }
      }

      // Soonest expiry first
      q = q.order('policy_end_date', { ascending: true, nullsFirst: false }).limit(PAGE_SIZE);
      const { data, error } = await q;
      if (error) throw error;

      let list: PolicyRow[] = ((data as any) || []).filter((r: PolicyRow) => {
        const cs = (r.customers?.status || '').toLowerCase();
        return !['cancelled', 'refunded', 'deleted'].includes(cs);
      });

      // Hide renewed customers from active queue, except when "All Renewals" is selected
      if (segment !== 'all_renewals') {
        list = list.filter(r => !RENEWED_OUTCOMES.has(r.retention_outcome || ''));
      }

      // Agent filters
      if (myOnly && currentUserId) {
        list = list.filter(r => r.customers?.assigned_to === currentUserId);
      } else if (agentFilter !== 'all') {
        if (agentFilter === UNASSIGNED) list = list.filter(r => !r.customers?.assigned_to);
        else list = list.filter(r => r.customers?.assigned_to === agentFilter);
      }

      // Pin overdue-not-renewed above future expiries
      const now = Date.now();
      list.sort((a, b) => {
        const ae = a.policy_end_date ? new Date(a.policy_end_date).getTime() : Infinity;
        const be = b.policy_end_date ? new Date(b.policy_end_date).getTime() : Infinity;
        const aOverdue = ae < now && !RENEWED_OUTCOMES.has(a.retention_outcome || '');
        const bOverdue = be < now && !RENEWED_OUTCOMES.has(b.retention_outcome || '');
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return ae - be;
      });

      setRows(list);
    } catch (e: any) {
      toast.error('Failed to load renewals', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [applySegment, segment, datePeriod, dateCustomRange, myOnly, agentFilter, currentUserId]);

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
        } catch { return [s.id, 0] as const; }
      })
    );
    setCounts(Object.fromEntries(results) as any);
  }, [applySegment]);

  const fetchWorkedToday = useCallback(async () => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { count } = await (supabase.from('customer_policies') as any)
      .select('id', { count: 'exact', head: true })
      .gte('retention_worked_at', startOfDay.toISOString());
    setWorkedToday(count || 0);
  }, []);

  const fetchTotals = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();
      const in12mo = new Date(Date.now() + 365 * 86400000).toISOString();
      const baseFilter = (q: any) => q
        .not('status', 'in', EXCLUDED_STATUSES)
        .or('is_deleted.is.null,is_deleted.eq.false');
      const totalQ = baseFilter((supabase.from('customer_policies') as any).select('id', { count: 'exact', head: true }));
      const renewQ = baseFilter((supabase.from('customer_policies') as any).select('id', { count: 'exact', head: true }))
        .gte('policy_end_date', nowIso).lte('policy_end_date', in12mo);
      const [{ count: total }, { count: renew12 }] = await Promise.all([totalQ, renewQ]);
      setTotalActive(total || 0);
      setRenewals12mo(renew12 || 0);
    } catch { /* non-fatal */ }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    // Approximate: policies worked today grouped by their customer's assigned agent
    const { data } = await (supabase.from('customer_policies') as any)
      .select('retention_outcome, customers!fk_customer_policies_customer_id(assigned_to)')
      .gte('retention_worked_at', startOfDay.toISOString())
      .limit(2000);
    const acc: Record<string, { worked: number; renewed: number }> = {};
    ((data as any[]) || []).forEach((r: any) => {
      const uid: string | null = r.customers?.assigned_to || null;
      if (!uid) return;
      const b = (acc[uid] ||= { worked: 0, renewed: 0 });
      b.worked += 1;
      if (RENEWED_OUTCOMES.has(r.retention_outcome || '')) b.renewed += 1;
    });
    setLeaderboard(acc);
  }, []);

  const fetchCallCounts = useCallback(async (emails: string[]) => {
    const clean = Array.from(new Set(emails.filter(Boolean).map((e) => e.toLowerCase())));
    if (clean.length === 0) { setCallCountsByEmail({}); return; }
    const { data } = await (supabase.from('sales_leads') as any)
      .select('email, call_count').in('email', clean).limit(5000);
    const map: Record<string, number> = {};
    ((data as any[]) || []).forEach((r) => {
      const k = (r.email || '').toLowerCase(); if (!k) return;
      map[k] = (map[k] || 0) + (Number(r.call_count) || 0);
    });
    setCallCountsByEmail(map);
  }, []);

  const fetchClaimFlags = useCallback(async (emails: string[], regs: string[]) => {
    const cleanEmails = Array.from(new Set(emails.filter(Boolean).map((e) => e.toLowerCase())));
    const cleanRegs = Array.from(new Set(regs.filter(Boolean).map((r) => r.replace(/\s+/g, '').toUpperCase())));
    if (cleanEmails.length === 0 && cleanRegs.length === 0) {
      setClaimEmails(new Set()); setClaimRegs(new Set()); return;
    }
    const eSet = new Set<string>();
    const rSet = new Set<string>();
    if (cleanEmails.length) {
      const { data } = await (supabase.from('claims_submissions') as any)
        .select('email').in('email', cleanEmails).limit(5000);
      ((data as any[]) || []).forEach((r) => {
        const k = (r.email || '').toLowerCase(); if (k) eSet.add(k);
      });
    }
    if (cleanRegs.length) {
      const { data } = await (supabase.from('claims_submissions') as any)
        .select('vehicle_registration').in('vehicle_registration', cleanRegs).limit(5000);
      ((data as any[]) || []).forEach((r) => {
        const k = (r.vehicle_registration || '').replace(/\s+/g, '').toUpperCase();
        if (k) rSet.add(k);
      });
    }
    setClaimEmails(eSet); setClaimRegs(rSet);
  }, []);

  const fetchLatestNotes = useCallback(async (customerIds: string[]) => {
    const clean = Array.from(new Set(customerIds.filter(Boolean)));
    if (clean.length === 0) { setLatestNoteByCustomer({}); return; }
    const { data } = await (supabase.from('customer_notes') as any)
      .select('customer_id, note_text, created_at')
      .in('customer_id', clean)
      .order('created_at', { ascending: false })
      .limit(5000);
    const map: Record<string, { text: string; at: string }> = {};
    ((data as any[]) || []).forEach((r) => {
      if (!map[r.customer_id]) map[r.customer_id] = { text: r.note_text || '', at: r.created_at };
    });
    setLatestNoteByCustomer(map);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchWorkedToday(); }, [fetchWorkedToday]);
  useEffect(() => { fetchTotals(); }, [fetchTotals]);
  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);
  useEffect(() => {
    fetchCallCounts(rows.map((r) => (r.customers?.email || r.email || '')));
    fetchLatestNotes(rows.map((r) => r.customer_id || '').filter(Boolean) as string[]);
    fetchClaimFlags(
      rows.map((r) => (r.customers?.email || r.email || '')),
      rows.map((r) => (r.customers?.registration_plate || '')),
    );
  }, [rows, fetchCallCounts, fetchLatestNotes, fetchClaimFlags]);

  const filtered = useMemo(() => {
    const base = rows;
    const searched = !search.trim() ? base : base.filter((r) =>
      [r.customer_full_name, r.email, r.customers?.email, r.customers?.phone,
       r.customers?.first_name, r.customers?.last_name, r.customers?.registration_plate,
       r.policy_number, r.warranty_number]
        .some((v) => (v || '').toString().toLowerCase().includes(search.toLowerCase()))
    );
    // Apply user-selected sort
    const sorted = [...searched];
    const ts = (v: any) => (v ? new Date(v).getTime() : 0);
    const nameOf = (r: any) => (r.customer_full_name || [r.customers?.first_name, r.customers?.last_name].filter(Boolean).join(' ') || r.customers?.email || '').toLowerCase();
    if (sortKey === 'due_next') {
      const now = Date.now();
      sorted.sort((a, b) => {
        const ae = a.policy_end_date ? new Date(a.policy_end_date).getTime() : Infinity;
        const be = b.policy_end_date ? new Date(b.policy_end_date).getTime() : Infinity;
        const aOverdue = ae < now && !RENEWED_OUTCOMES.has(a.retention_outcome || '');
        const bOverdue = be < now && !RENEWED_OUTCOMES.has(b.retention_outcome || '');
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return ae - be;
      });
    } else if (sortKey === 'due_latest') {
      sorted.sort((a, b) => ts(b.policy_end_date) - ts(a.policy_end_date));
    } else if (sortKey === 'newest') {
      sorted.sort((a, b) => ts((b as any).created_at || b.policy_start_date) - ts((a as any).created_at || a.policy_start_date));
    } else if (sortKey === 'oldest') {
      sorted.sort((a, b) => ts((a as any).created_at || a.policy_start_date) - ts((b as any).created_at || b.policy_start_date));
    } else if (sortKey === 'name_az') {
      sorted.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    } else if (sortKey === 'name_za') {
      sorted.sort((a, b) => nameOf(b).localeCompare(nameOf(a)));
    }
    // Pin Renewal Pool reservation as first row.
    if (!pinnedRow) return sorted;
    const withoutPinned = sorted.filter((r) => r.id !== pinnedRow.id);
    return [pinnedRow, ...withoutPinned];
  }, [rows, search, pinnedRow, sortKey]);

  // Pagination: 200 rows per page.
  const RENEWALS_PAGE_SIZE = 200;
  const [renewalsPage, setRenewalsPage] = useState(1);
  const renewalsTotal = filtered.length;
  const renewalsTotalPages = Math.max(1, Math.ceil(renewalsTotal / RENEWALS_PAGE_SIZE));
  useEffect(() => { if (renewalsPage > renewalsTotalPages) setRenewalsPage(1); }, [renewalsTotalPages, renewalsPage]);
  useEffect(() => { setRenewalsPage(1); }, [search, rows.length]);
  const renewalsPageStart = (renewalsPage - 1) * RENEWALS_PAGE_SIZE;
  const renewalsPageEnd = Math.min(renewalsPageStart + RENEWALS_PAGE_SIZE, renewalsTotal);
  const pagedRenewals = useMemo(
    () => filtered.slice(renewalsPageStart, renewalsPageEnd),
    [filtered, renewalsPageStart, renewalsPageEnd],
  );

  const renewalEmails = useMemo(
    () => pagedRenewals.map((r: any) => (r.customers?.email || r.email || '').toLowerCase()).filter(Boolean),
    [pagedRenewals],
  );
  const { activityByEmail: renewalActivityByEmail } = useCustomerActivity(renewalEmails);


  const markWorked = useCallback(async (row: PolicyRow, outcome?: string) => {
    try {
      const updates: any = { retention_worked_at: new Date().toISOString() };
      if (outcome) updates.retention_outcome = outcome;
      const { error } = await (supabase.from('customer_policies') as any).update(updates).eq('id', row.id);
      if (error) throw error;
      toast.success('Worked', {
        description: outcome ? `Outcome: ${outcome.replace(/_/g, ' ')}` : 'Logged renewal attempt',
      });
      setWorkedToday((n) => n + 1);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updates } : r)));
      stampRenewalOwnership(row.id);
    } catch (e: any) {
      toast.error('Could not mark as worked', { description: e.message });
    }
  }, [stampRenewalOwnership]);

  const reassignCustomer = useCallback(async (row: PolicyRow, newAuthId: string | null) => {
    if (!row.customer_id) { toast.error('No linked customer record to assign'); return; }
    const { error } = await (supabase.from('customers') as any)
      .update({ assigned_to: newAuthId }).eq('id', row.customer_id);
    if (error) { toast.error('Could not reassign', { description: error.message }); return; }
    setRows((prev) => prev.map((r) =>
      r.id === row.id && r.customers ? { ...r, customers: { ...r.customers, assigned_to: newAuthId } } : r
    ));
    toast.success(newAuthId ? 'Reassigned' : 'Unassigned');
  }, []);

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
    stampRenewalOwnership(row.id);
  }, [currentUserId, stampRenewalOwnership]);

  const saveCustomerNote = useCallback(async (row: PolicyRow) => {
    const text = (noteDraft[row.id] || '').trim();
    if (!text) return;
    if (!row.customer_id) { toast.error('No linked customer record'); return; }
    const { error } = await (supabase.from('customer_notes') as any).insert({
      customer_id: row.customer_id, note_text: text, created_by: currentUserId,
    });
    if (error) { toast.error('Could not save note', { description: error.message }); return; }
    setNoteDraft((prev) => ({ ...prev, [row.id]: '' }));
    setLatestNoteByCustomer((prev) => ({ ...prev, [row.customer_id!]: { text, at: new Date().toISOString() } }));
    toast.success('Note saved');
  }, [noteDraft, currentUserId]);

  const triggerCron = useCallback(async () => {
    try {
      setRunningCron(true);
      const { data, error } = await supabase.functions.invoke('process-renewal-campaigns', { body: {} });
      if (error) throw error;
      const queued = (data as any)?.totalQueued ?? 0;
      const skipped = (data as any)?.totalSkipped ?? 0;
      toast.success('Renewal cron complete', { description: `${queued} queued, ${skipped} skipped` });
      fetchRows();
    } catch (e: any) { toast.error('Cron failed', { description: e.message }); }
    finally { setRunningCron(false); }
  }, [fetchRows]);

  // Bulk selection helpers
  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAllVisible = () => {
    setSelectedIds(prev => {
      if (prev.size >= filtered.length) return new Set();
      return new Set(filtered.map(r => r.id));
    });
  };

  const bulkMarkOutcome = async (outcome: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const updates = { retention_worked_at: new Date().toISOString(), retention_outcome: outcome };
    const { error } = await (supabase.from('customer_policies') as any).update(updates).in('id', ids);
    if (error) { toast.error('Bulk update failed', { description: error.message }); return; }
    toast.success(`${ids.length} marked as ${outcome.replace(/_/g, ' ')}`);
    setRows(prev => prev.map(r => ids.includes(r.id) ? { ...r, ...updates } : r));
    setSelectedIds(new Set());
    fetchLeaderboard(); fetchWorkedToday();
  };

  const bulkReassign = async () => {
    if (selectedIds.size === 0 || !bulkAssignTo) return;
    const rowsSel = rows.filter(r => selectedIds.has(r.id) && r.customer_id);
    const customerIds = rowsSel.map(r => r.customer_id!) as string[];
    const newAuthId = bulkAssignTo === UNASSIGNED ? null : bulkAssignTo;
    const { error } = await (supabase.from('customers') as any)
      .update({ assigned_to: newAuthId }).in('id', customerIds);
    if (error) { toast.error('Bulk reassign failed', { description: error.message }); return; }
    toast.success(`${rowsSel.length} customers ${newAuthId ? 'reassigned' : 'unassigned'}`);
    setRows(prev => prev.map(r => selectedIds.has(r.id) && r.customers
      ? { ...r, customers: { ...r.customers, assigned_to: newAuthId } } : r));
    setSelectedIds(new Set());
    setBulkAssignTo('');
  };

  const srcBadge = (id: SegmentId) => {
    const map: Record<SegmentId, string> = {
      due_today: 'bg-red-100 text-red-800 border-red-200',
      due_7: 'bg-red-100 text-red-800 border-red-200',
      due_30: 'bg-amber-100 text-amber-800 border-amber-200',
      due_60: 'bg-amber-100 text-amber-800 border-amber-200',
      renewal_window: 'bg-blue-100 text-blue-800 border-blue-200',
      upsell: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      lapsed: 'bg-red-100 text-red-800 border-red-200',
      all_renewals: 'bg-slate-100 text-slate-800 border-slate-200',
    };
    const label: Record<SegmentId, string> = {
      due_today: 'Today', due_7: '7d', due_30: '30d', due_60: '60d',
      renewal_window: 'Window', upsell: 'Upsell', lapsed: 'Lapsed', all_renewals: 'All',
    };
    return <Badge className={`${map[id]} text-[10px]`}>{label[id]}</Badge>;
  };

  const currentSegment = SEGMENTS.find((s) => s.id === segment)!;
  const allSelected = filtered.length > 0 && selectedIds.size >= filtered.length;
  const leaderboardEntries = useMemo(() => {
    return Object.entries(leaderboard)
      .map(([uid, v]) => ({ agent: agentByAuthId.get(uid), uid, ...v }))
      .filter(e => e.agent)
      .sort((a, b) => b.renewed - a.renewed || b.worked - a.worked)
      .slice(0, 8);
  }, [leaderboard, agentByAuthId]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <Repeat className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              Renewals
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground max-w-3xl">
              Customers whose warranty is due for renewal. Soonest first, overdue-not-renewed pinned at the top.
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <UnifiedDateFilter
              scope="renewal_due"
              period={datePeriod}
              customRange={dateCustomRange}
              onChange={(n) => { setDatePeriod(n.period); setDateCustomRange(n.customRange); }}
              availableScopes={['renewal_due']}
              showLabel={false}
            />
            <Input
              placeholder="Search name, email, phone, reg, policy…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-[220px] md:w-[260px]"
            />
            <div className="flex items-center gap-1 text-xs">
              <Switch id="my-only" checked={myOnly} onCheckedChange={setMyOnly} />
              <Label htmlFor="my-only" className="text-xs cursor-pointer">My renewals</Label>
            </div>
            {canReassignAny && (
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="h-9 w-[150px] text-xs">
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {agents.map(a => a.user_id ? (
                    <SelectItem key={a.id} value={a.user_id}>{agentLabel(a)}</SelectItem>
                  ) : null)}
                </SelectContent>
              </Select>
            )}
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-9 w-[180px] text-xs" title="Sort renewals">
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <SelectValue placeholder="Sort" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_next"><span className="inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Due next (soonest)</span></SelectItem>
                <SelectItem value="due_latest"><span className="inline-flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Due latest</span></SelectItem>
                <SelectItem value="newest"><span className="inline-flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Newest first</span></SelectItem>
                <SelectItem value="oldest"><span className="inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Oldest first</span></SelectItem>
                <SelectItem value="name_az"><span className="inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Name A–Z</span></SelectItem>
                <SelectItem value="name_za"><span className="inline-flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Name Z–A</span></SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm" className="shrink-0"
              onClick={() => { fetchRows(); fetchCounts(); fetchWorkedToday(); fetchTotals(); fetchLeaderboard(); }}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" variant="outline" className="gap-1" disabled={runningCron} onClick={triggerCron}>
              {runningCron ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Run cron
            </Button>
            {onNavigateToTab && ['admin', 'super_admin', 'sales_manager'].includes(userRole || '') && (
              <Button variant="default" size="sm" onClick={() => onNavigateToTab('lead-teams')}
                className="shrink-0 font-semibold gap-1"
                title="Assign agents to teams and pick the queues they work">
                <Network className="h-4 w-4" /> Allocate Agents
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-3 px-4 flex items-center gap-3">
          <UserCheck className="h-5 w-5 text-primary" />
          <div><div className="text-xs text-muted-foreground">Active policies</div>
            <div className="text-xl font-semibold">{totalActive ?? '…'}</div></div>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <div><div className="text-xs text-muted-foreground">Renewals next 12 mo</div>
            <div className="text-xl font-semibold">{renewals12mo ?? '…'}</div></div>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div><div className="text-xs text-muted-foreground">Worked today</div>
            <div className="text-xl font-semibold">{workedToday}</div></div>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4 flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-amber-500" />
          <div><div className="text-xs text-muted-foreground">Due in next 60 days</div>
            <div className="text-xl font-semibold">{counts['due_60'] ?? '…'}</div></div>
        </CardContent></Card>
      </div>

      {/* Leaderboard */}
      {leaderboardEntries.length > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Today's Renewal Leaderboard</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {leaderboardEntries.map((e, i) => (
                <div key={e.uid} className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/30 text-xs">
                  <span className="font-semibold text-muted-foreground">#{i + 1}</span>
                  <UserCircle2 className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{agentLabel(e.agent)}</span>
                  <Badge variant="secondary" className="text-[10px]">{e.renewed} renewed</Badge>
                  <Badge variant="outline" className="text-[10px]">{e.worked} worked</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Segment pills */}
      <div className="sticky top-[68px] z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-background/95 backdrop-blur border-b">
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map((s) => (
            <button key={s.id} onClick={() => setSegment(s.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                segment === s.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              }`}>
              {s.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                segment === s.id ? 'bg-primary-foreground/20' : 'bg-muted'
              }`}>{counts[s.id] ?? '…'}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{currentSegment.description}</p>

      {/* RenewalPoolBar removed — renewals aren't a live pool; agents pick from the list themselves */}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-2 px-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Select onValueChange={(v) => bulkMarkOutcome(v)}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Bulk mark outcome…" /></SelectTrigger>
              <SelectContent>
                {OUTCOMES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {canReassignAny && (
              <>
                <Select value={bulkAssignTo} onValueChange={setBulkAssignTo}>
                  <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {agents.map(a => a.user_id ? (
                      <SelectItem key={a.id} value={a.user_id}>{agentLabel(a)}</SelectItem>
                    ) : null)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!bulkAssignTo} onClick={bulkReassign}>
                  <ArrowRightLeft className="h-3 w-3" /> Reassign
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading renewals…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No customers in this segment right now. Try another tab or clear your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-center p-2 w-[44px] text-[11px] font-semibold uppercase tracking-wider">#</th>
                  <th className="p-2 w-[36px]">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAllVisible} />
                  </th>
                  <th className="text-left p-2 w-[140px]">Agent</th>
                  {canSeeSource && <th className="text-left p-2 w-[70px]">Src</th>}
                  <th className="text-left p-2 w-[120px]">Outcome</th>
                  <th className="text-left p-2 w-[100px]">Renews in</th>
                  <th className="text-left p-2 w-[70px]">Plan</th>
                  <th className="text-center p-2 w-[90px]">Calls</th>
                  <th className="text-left p-2 w-[110px]">Last contacted</th>
                  <th className="text-left p-2 w-[240px]">Latest note</th>
                  <th className="text-left p-2 w-[380px]">Actions</th>
                  <th className="text-left p-2 w-[140px]">Name</th>
                  <th className="text-left p-2 w-[130px]">Phone</th>
                  <th className="text-left p-2 w-[180px]">Email</th>
                  <th className="text-left p-2 w-[90px]">Reg</th>
                  <th className="text-left p-2 w-[110px]">Date added</th>
                  <th className="text-left p-2 w-[110px]">Expiry</th>
                  <th className="text-left p-2 w-[140px]" title="Last time the customer themselves did something — asked for another quote, filled step 2, or logged into the portal.">Customer activity</th>
                </tr>
              </thead>
              <tbody>
                {pagedRenewals.map((r, i) => {
                  const rowNumber = renewalsPageStart + i + 1;
                  const name =
                    [r.customers?.first_name, r.customers?.last_name].filter(Boolean).join(' ') ||
                    r.customers?.name || r.customer_full_name || '—';
                  const email = (r.customers?.email || r.email || '').toLowerCase();
                  const phone = r.customers?.phone || '';
                  const callCount = email ? (callCountsByEmail[email] || 0) : 0;
                  const assignedAuthId = r.customers?.assigned_to ?? null;
                  const assignedAgent = assignedAuthId ? agentByAuthId.get(assignedAuthId) : undefined;
                  const days = daysUntil(r.policy_end_date);
                  const isSelected = selectedIds.has(r.id);
                  const isUrgent = days !== null && days <= 7; // overdue or ≤7d
                  const sendQuotePrefill = {
                    id: r.customer_id || r.id,
                    first_name: r.customers?.first_name || '',
                    last_name: r.customers?.last_name || '',
                    email: email,
                    phone: phone,
                    vehicle_reg: r.customers?.registration_plate || '',
                    vehicle_make: r.customers?.vehicle_make || '',
                    vehicle_model: r.customers?.vehicle_model || '',
                  };
                  const isPinned = pinnedRow?.id === r.id;
                  return (
                    <tr key={r.id} className={`border-t hover:bg-muted/30 align-top ${isSelected ? 'bg-primary/5' : ''} ${isUrgent ? 'border-l-4 border-l-red-500' : ''} ${isPinned ? 'bg-emerald-50/70 ring-1 ring-emerald-300' : ''}`}>
                      <td className="p-2 text-center text-xs tabular-nums text-muted-foreground font-medium">{rowNumber}</td>
                      <td className="p-2">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(r.id)} />
                      </td>
                      <td className="p-2">
                        <Select value={assignedAuthId ?? UNASSIGNED}
                          onValueChange={(v) => reassignCustomer(r, v === UNASSIGNED ? null : v)}>
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
                            {agents.map((a) => a.user_id ? (
                              <SelectItem key={a.id} value={a.user_id}>{agentLabel(a)}</SelectItem>
                            ) : null)}
                          </SelectContent>
                        </Select>
                      </td>
                      {canSeeSource && <td className="p-2">{srcBadge(segment)}</td>}
                      <td className="p-2">
                        <Select value={r.retention_outcome ?? ''} onValueChange={(v) => markWorked(r, v)}>
                          <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {OUTCOMES.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          {expiryBadge(days)}
                          {isUrgent && (
                            <Badge className="bg-[#FF385C] text-white border-[#FF385C] text-[10px] px-1.5 py-0 h-4 gap-0.5">
                              <Zap className="h-2.5 w-2.5" /> NOW
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-xs">
                        <Badge variant="outline" className="text-[10px]">{planLengthLabel(r)}</Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          <Badge variant={callCount > 0 ? 'secondary' : 'outline'} className="text-[11px] tabular-nums min-w-[24px] justify-center">
                            {callCount}
                          </Badge>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 p-0"
                            title="Log +1 call"
                            onClick={() => logCustomerCall(r)}
                          >
                            +
                          </Button>
                        </div>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {r.retention_worked_at
                          ? formatDistanceToNow(new Date(r.retention_worked_at), { addSuffix: true })
                          : <span className="text-muted-foreground/60">Never</span>}
                      </td>
                      <td className="p-2 text-xs">
                        {r.customer_id && latestNoteByCustomer[r.customer_id] ? (
                          <div className="max-w-[230px]">
                            <div className="line-clamp-2 text-foreground" title={latestNoteByCustomer[r.customer_id].text}>
                              {latestNoteByCustomer[r.customer_id].text}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDistanceToNow(new Date(latestNoteByCustomer[r.customer_id].at), { addSuffix: true })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          {phone && (
                            <Button asChild size="icon" variant="outline" className="h-7 w-7" title="Call"
                              onClick={() => logCustomerCall(r)}>
                              <a href={`tel:${phone}`}><Phone className="h-3 w-3" /></a>
                            </Button>
                          )}
                          {email && (
                            <Button asChild size="icon" variant="outline" className="h-7 w-7" title="Quick email">
                              <a href={`mailto:${email}`}><Mail className="h-3 w-3" /></a>
                            </Button>
                          )}
                          {r.customer_id && (
                            <div title="Send marketing email (template)">
                              <BulkEmailDialog
                                selectedCustomerIds={[r.customer_id]}
                                onComplete={() => toast.success('Marketing email sent')}
                              />
                            </div>
                          )}
                          {onNavigateToTab && (
                            <Button size="sm" variant="default" className="h-7 px-2 text-xs gap-1"
                              onClick={() => onNavigateToTab('get-quote', sendQuotePrefill)}
                              title="Generate renewal quote">
                              <Send className="h-3 w-3" /> Quote
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
                              <Textarea rows={3} placeholder="Quick note…"
                                value={noteDraft[r.id] || ''}
                                onChange={(e) => setNoteDraft((p) => ({ ...p, [r.id]: e.target.value }))} />
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
                      <td className="p-2">
                        <div className="font-medium text-sm leading-tight flex items-center gap-1 flex-wrap">
                          <span>{name}</span>
                          {(() => {
                            const regKey = (r.customers?.registration_plate || '').replace(/\s+/g, '').toUpperCase();
                            const hasClaim = (email && claimEmails.has(email)) || (regKey && claimRegs.has(regKey));
                            return hasClaim ? (
                              <Badge
                                variant="outline"
                                className="h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide border-amber-500 text-amber-700 bg-amber-50"
                                title="This customer has submitted a claim"
                              >
                                Claim made
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.policy_number || r.warranty_number || ''}
                        </div>
                        {r.retention_worked_at && (
                          <div className="text-[10px] text-muted-foreground">
                            worked {formatDistanceToNow(new Date(r.retention_worked_at), { addSuffix: true })}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-xs">{phone || '—'}</td>
                      <td className="p-2 text-xs truncate max-w-[180px]" title={email}>{email || '—'}</td>
                      <td className="p-2 text-xs uppercase">{r.customers?.registration_plate || '—'}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {r.customers?.created_at
                          ? format(new Date(r.customers.created_at), 'd MMM yy')
                          : (r.policy_start_date ? format(new Date(r.policy_start_date), 'd MMM yy') : '—')}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {r.policy_end_date ? format(new Date(r.policy_end_date), 'd MMM yy') : '—'}
                      </td>
                      <td className="p-2">
                        <CustomerActivityCell activity={email ? renewalActivityByEmail[email] : undefined} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {renewalsTotal > RENEWALS_PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border-t bg-muted/20 text-xs">
              <div className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground tabular-nums">{renewalsPageStart + 1}</span>–
                <span className="font-semibold text-foreground tabular-nums">{renewalsPageEnd}</span> of{' '}
                <span className="font-semibold text-foreground tabular-nums">{renewalsTotal}</span> renewals
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setRenewalsPage(1)} disabled={renewalsPage === 1} aria-label="First page">
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setRenewalsPage(p => Math.max(1, p - 1))} disabled={renewalsPage === 1} aria-label="Previous page">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 tabular-nums">
                  Page <span className="font-semibold text-foreground">{renewalsPage}</span> / <span className="font-semibold text-foreground">{renewalsTotalPages}</span>
                </span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setRenewalsPage(p => Math.min(renewalsTotalPages, p + 1))} disabled={renewalsPage === renewalsTotalPages} aria-label="Next page">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setRenewalsPage(renewalsTotalPages)} disabled={renewalsPage === renewalsTotalPages} aria-label="Last page">
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RenewalsQueueTab;
