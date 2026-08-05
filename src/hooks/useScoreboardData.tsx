import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

export type TimePeriod = 'today' | 'week' | '14days' | 'month' | 'all' | 'custom';

export interface AgentScore {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  salesCount: number;
  revenue: number;
  leadsAssigned: number;
  leadsConverted: number;
  conversionRate: number;
  avgOrderValue: number;
  rank: number;
  previousRank: number | null;
  trend: 'up' | 'down' | 'same' | 'new';
  monthlyTarget: number | null;
  /** Monthly revenue target (£) set by management; default 35000. */
  revenueTarget: number | null;
  manualLeadsCount: number | null;
  cancelledCount: number;
  cancelledRevenue: number;
  callsCount: number;
  /** Answered outbound calls (talk time > 0) from the Dial 9 sync. */
  connectedCalls: number;
  manualActualAttempts: number | null;
  avgDiscountPct: number;
}

export interface ScoreboardData {
  agents: AgentScore[];
  loading: boolean;
  period: TimePeriod;
  setPeriod: (p: TimePeriod) => void;
  dateRange: DateRange | undefined;
  setDateRange: (r: DateRange | undefined) => void;
  refresh: () => void;
  currentUserId: string | null;
  currentAdminUserId: string | null;
  currentUserRole: string | null;
}

export const useScoreboardData = (): ScoreboardData => {
  const [agents, setAgents] = useState<AgentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriodInternal] = useState<TimePeriod>('14days');
  const [dateRange, setDateRangeInternal] = useState<DateRange | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // When a preset period is selected, clear custom date range
  const setPeriod = useCallback((p: TimePeriod) => {
    setPeriodInternal(p);
    if (p !== 'custom') setDateRangeInternal(undefined);
  }, []);

  // When a custom date range is selected, switch to custom period
  const setDateRange = useCallback((r: DateRange | undefined) => {
    setDateRangeInternal(r);
    if (r?.from) {
      setPeriodInternal('custom');
    } else {
      setPeriodInternal('14days');
    }
  }, []);

  const getDateRange = useCallback((p: TimePeriod, customRange?: DateRange) => {
    if (p === 'custom' && customRange?.from) {
      return {
        start: startOfDay(customRange.from),
        end: customRange.to ? endOfDay(customRange.to) : endOfDay(customRange.from),
      };
    }
    const now = new Date();
    switch (p) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case '14days':
        return { start: startOfDay(subDays(now, 13)), end: endOfDay(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'all':
      default:
        return { start: new Date('2020-01-01'), end: now };
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      let myAdminId: string | null = null;
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id, role')
          .eq('user_id', user.id)
          .maybeSingle();
        myAdminId = adminUser?.id || null;
        setCurrentAdminUserId(myAdminId);
        setCurrentUserRole(adminUser?.role || null);
      }

      // Only active, non-archived agents appear on the scoreboard.
      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active, sip_extension')
        .in('role', ['sales', 'sales_lead'])
        .eq('is_active', true)
        .is('archived_at', null);

      if (!adminUsers?.length) {
        setAgents([]);
        setLoading(false);
        return;
      }

      const { start, end } = getDateRange(period, dateRange);
      const agentIds = adminUsers.map(u => u.id);

      // Attribute sales to the agent who actually did the sale:
      // manager override (sale_credit_admin_user_id) first, then payment_confirmed_by,
      // then quote_sent_by, and only fall back to assigned_to for older rows with
      // no other sales marker. Filter by signup_date so historical months don't
      // shift when leads are later reassigned.
      const agentIdList = agentIds.join(',');
      const attributionFilter = `sale_credit_admin_user_id.in.(${agentIdList}),and(sale_credit_admin_user_id.is.null,payment_confirmed_by.in.(${agentIdList})),and(sale_credit_admin_user_id.is.null,payment_confirmed_by.is.null,quote_sent_by.in.(${agentIdList})),and(sale_credit_admin_user_id.is.null,payment_confirmed_by.is.null,quote_sent_by.is.null,assigned_to.in.(${agentIdList}))`;
      let customerQuery = supabase
        .from('customers')
        .select('id, assigned_to, payment_confirmed_by, quote_sent_by, sale_credit_admin_user_id, final_amount, original_amount, discount_amount, discount_code, signup_date, created_at, status')
        .eq('is_deleted', false)
        .ilike('status', 'active')
        .or(attributionFilter);

      if (period !== 'all') {
        customerQuery = customerQuery
          .gte('signup_date', start.toISOString())
          .lte('signup_date', end.toISOString());
      }

      const { data: customers } = await customerQuery;
      const attributionOf = (c: any) => c.sale_credit_admin_user_id || c.payment_confirmed_by || c.quote_sent_by || c.assigned_to;



      // Build a lookup of discount codes referenced by these sales so we can compute
      // discount % even when original_amount / discount_amount weren't persisted on the row.
      const referencedCodes = Array.from(new Set(
        (customers || [])
          .map((c: any) => (c.discount_code || '').toString().trim().toUpperCase())
          .filter(Boolean)
      ));
      const codeMap = new Map<string, { type: string; value: number }>();
      if (referencedCodes.length > 0) {
        const { data: codeRows } = await supabase
          .from('discount_codes')
          .select('code, type, value')
          .in('code', referencedCodes);
        (codeRows || []).forEach((r: any) => {
          codeMap.set(String(r.code).toUpperCase(), { type: r.type, value: Number(r.value) || 0 });
        });
      }


      // Fetch cancelled/refunded customers per agent (merged as one metric).
      // Filter by signup_date within the period rather than updated_at, because
      // updated_at is bumped by unrelated bulk maintenance jobs (re-assignments,
      // migrations, etc.) which was inflating the Refunds count on the scoreboard.
      // Attributing refunds to the period the sale was made in also aligns Refunds
      // with the Revenue/Sales figures shown on the same row.
      let cancelledQuery = supabase
        .from('customers')
        .select('id, assigned_to, payment_confirmed_by, quote_sent_by, sale_credit_admin_user_id, final_amount, signup_date')
        .eq('is_deleted', false)
        .or('status.ilike.cancelled,status.ilike.refunded')
        .or(attributionFilter);


      if (period !== 'all') {
        cancelledQuery = cancelledQuery
          .gte('signup_date', start.toISOString())
          .lte('signup_date', end.toISOString());
      }

      const { data: cancelledCustomers } = await cancelledQuery;

      // Active workload only: leads currently assigned to the agent that are
      // NOT terminal (lost, fake_lead, converted, not_interested, dormant, archived)
      // and NOT already paid. This is the count of leads the agent is actively
      // working — matches what they've selected/claimed and haven't killed off.
      // Note: this is a live workload count, so we intentionally do NOT filter by
      // the scoreboard period — an agent's open pipeline is what it is today.
      const DEAD_STATUSES = ['lost', 'fake_lead', 'converted', 'not_interested', 'dormant', 'archived'];
      let leadsQuery = supabase
        .from('sales_leads')
        .select('id, assigned_to, is_paid, status, created_at')
        .in('assigned_to', agentIds)
        .eq('is_paid', false)
        .not('status', 'in', `(${DEAD_STATUSES.join(',')})`);

      const { data: leads } = await leadsQuery;

      // Fetch approved commission claims per agent
      let claimsQuery = supabase
        .from('commission_claims')
        .select('id, agent_id, deal_value, created_at, status')
        .eq('status', 'approved')
        .in('agent_id', agentIds);

      if (period !== 'all') {
        claimsQuery = claimsQuery
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());
      }

      const { data: approvedClaims } = await claimsQuery;

      // Live call data straight from the Dial 9 / Zoiper API sync (zoiper_call_events).
      // This is the authoritative dial count — lead_call_logs only records calls that
      // were matched to a lead, so it undercounts real dialling activity.
      const extToAgent = new Map<string, string>();
      (adminUsers as any[]).forEach(u => {
        if ((u as any).sip_extension) extToAgent.set(String((u as any).sip_extension), u.id);
      });
      let dialQuery = supabase
        .from('zoiper_call_events')
        .select('agent_user_id, agent_extension, direction, talk_seconds, started_at')
        .eq('direction', 'outbound');
      if (period !== 'all') {
        dialQuery = dialQuery
          .gte('started_at', start.toISOString())
          .lte('started_at', end.toISOString());
      }
      const { data: dialEvents, error: dialErr } = await dialQuery.limit(50000);
      if (dialErr) console.error('zoiper_call_events error', dialErr);
      const callsMap = new Map<string, number>();
      const connectedMap = new Map<string, number>();
      (dialEvents || []).forEach((c: any) => {
        // Fall back to the SIP extension when the sync didn't resolve the agent id.
        const agentId = c.agent_user_id || (c.agent_extension ? extToAgent.get(String(c.agent_extension)) : null);
        if (!agentId) return;
        callsMap.set(agentId, (callsMap.get(agentId) || 0) + 1);
        if ((Number(c.talk_seconds) || 0) > 0) connectedMap.set(agentId, (connectedMap.get(agentId) || 0) + 1);
      });

      // Fetch monthly targets
      const nowIso = new Date().toISOString();
      const { data: targets } = await supabase
        .from('sales_targets')
        .select('admin_user_id, target_amount, target_period, manual_leads_count, revenue_target')
        .in('admin_user_id', agentIds)
        .eq('target_period', 'monthly')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso);

      const targetMap = new Map<string, number>();
      const revenueTargetMap = new Map<string, number>();
      const manualLeadsMap = new Map<string, number>();
      const actualAttemptsMap = new Map<string, number>();
      (targets || []).forEach((t: any) => {
        targetMap.set(t.admin_user_id, t.target_amount);
        if (t.revenue_target != null) revenueTargetMap.set(t.admin_user_id, Number(t.revenue_target));
        if (t.manual_leads_count != null) manualLeadsMap.set(t.admin_user_id, t.manual_leads_count);
        if (t.manual_actual_attempts != null) actualAttemptsMap.set(t.admin_user_id, t.manual_actual_attempts);
      });

      // Fetch month-to-date leads assigned per agent (for conv. rate vs target)
      // Uses a SECURITY DEFINER RPC so sales agents (who can't read other agents' leads via RLS)
      // still see aggregate counts on the scoreboard.
      const mtdLeadsMap = new Map<string, number>();
      const { data: mtdRows, error: mtdErr } = await supabase
        .rpc('get_mtd_leads_per_agent', { _agent_ids: agentIds });
      if (mtdErr) console.error('get_mtd_leads_per_agent error', mtdErr);
      (mtdRows || []).forEach((r: any) => {
        if (r.assigned_to) mtdLeadsMap.set(r.assigned_to, Number(r.lead_count) || 0);
      });

      // Clean leads for the selected period: every lead handed to the agent EXCEPT the ones
      // marked as fake / wrong number / do-not-contact. This is the only lead figure we trust,
      // so it's what the scoreboard shows (no manual overrides, no workload fallbacks).
      const cleanLeadsMap = new Map<string, number>();
      const cleanConvertedMap = new Map<string, number>();
      const { data: cleanRows, error: cleanErr } = await supabase
        .rpc('get_clean_leads_per_agent', {
          _agent_ids: agentIds,
          _start: (period !== 'all' ? start : new Date('2020-01-01')).toISOString(),
          _end: end.toISOString(),
        });
      if (cleanErr) console.error('get_clean_leads_per_agent error', cleanErr);
      (cleanRows || []).forEach((r: any) => {
        if (!r.assigned_to) return;
        cleanLeadsMap.set(r.assigned_to, Number(r.clean_leads) || 0);
        cleanConvertedMap.set(r.assigned_to, Number(r.clean_converted) || 0);
      });

      const scores: AgentScore[] = adminUsers.map(u => {
        const userCustomers = (customers || []).filter(c => attributionOf(c) === u.id);
        const userLeads = (leads || []).filter(l => l.assigned_to === u.id);
        const userConvertedLeads = userLeads.filter(l => l.is_paid === true);
        const userCancelled = (cancelledCustomers || []).filter(c => attributionOf(c) === u.id);
        const userClaims = (approvedClaims || []).filter(c => c.agent_id === u.id);

        // Include approved commission claims in sales count & revenue
        const salesCount = userCustomers.length + userClaims.length;
        const claimsRevenue = userClaims.reduce((sum, c) => sum + (c.deal_value || 0), 0);
        const grossRevenue = userCustomers.reduce((sum, c) => sum + (c.final_amount || 0), 0) + claimsRevenue;
        const cancelledCount = userCancelled.length;
        const cancelledRevenue = userCancelled.reduce((sum, c) => sum + (c.final_amount || 0), 0);
        // Net revenue reflects refunds/cancellations against the agent's revenue.
        const revenue = grossRevenue - cancelledRevenue;


        // Clean leads only — fake / wrong number / do-not-contact leads are excluded,
        // so conversion is measured against genuine enquiries the agent accepted.
        const leadsAssigned = cleanLeadsMap.get(u.id) ?? 0;
        const leadsConverted = cleanConvertedMap.get(u.id) ?? userConvertedLeads.length;
        const conversionRate = leadsAssigned > 0 ? (salesCount / leadsAssigned) * 100 : 0;

        const avgOrderValue = salesCount > 0 ? revenue / salesCount : 0;

        // Average discount % across this agent's sales. We use the best signal available
        // per row, in priority order:
        //   1. original_amount + (discount_amount | final_amount delta) — most accurate
        //   2. discount_code lookup — percentage codes use their %, fixed codes are
        //      converted to a % of the implied gross (final + fixed value)
        const discountPctRows: number[] = [];
        userCustomers.forEach((c: any) => {
          const orig = Number(c.original_amount) || 0;
          const final = Number(c.final_amount) || 0;
          if (orig > 0) {
            const disc = Number(c.discount_amount) || Math.max(orig - final, 0);
            discountPctRows.push((disc / orig) * 100);
            return;
          }
          const code = (c.discount_code || '').toString().trim().toUpperCase();
          if (!code) return;
          const meta = codeMap.get(code);
          if (!meta) return;
          if (meta.type === 'percentage') {
            discountPctRows.push(meta.value);
          } else if (meta.value > 0 && final > 0) {
            const impliedGross = final + meta.value;
            discountPctRows.push((meta.value / impliedGross) * 100);
          }
        });
        const avgDiscountPct = discountPctRows.length > 0
          ? discountPctRows.reduce((a, b) => a + b, 0) / discountPctRows.length
          : 0;


        return {
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email.split('@')[0],
          email: u.email,
          role: u.role,
          isActive: (u as any).is_active !== false,
          salesCount,
          revenue,
          leadsAssigned,
          leadsConverted,
          conversionRate,
          avgOrderValue,
          rank: 0,
          previousRank: null,
          trend: 'same' as const,
          monthlyTarget: targetMap.get(u.id) || null,
          revenueTarget: revenueTargetMap.get(u.id) ?? 35000,
          manualLeadsCount: manualLeadsMap.get(u.id) ?? null,
          cancelledCount,
          cancelledRevenue,
          callsCount: callsMap.get(u.id) || 0,
          connectedCalls: connectedMap.get(u.id) || 0,
          manualActualAttempts: actualAttemptsMap.get(u.id) ?? null,
          avgDiscountPct,
        };
      });

      scores.sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue);
      scores.forEach((s, i) => { s.rank = i + 1; });

      setAgents(scores);
    } catch (error) {
      console.error('Error fetching scoreboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [period, dateRange, getDateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel('scoreboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_leads' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commission_claims' }, () => fetchData())
      // Monthly revenue targets: when a manager changes an agent's target the agent's
      // scoreboard must pick it up without a hard refresh.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_targets' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Refetch when the tab regains focus so a stale open tab never shows an old target.
  useEffect(() => {
    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchData]);


  return { agents, loading, period, setPeriod, dateRange, setDateRange, refresh: fetchData, currentUserId, currentAdminUserId, currentUserRole };
};
