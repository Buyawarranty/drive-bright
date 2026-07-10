import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';

export type TimePeriod = 'today' | 'week' | 'month' | 'all' | 'custom';

export interface AgentScore {
  id: string;
  name: string;
  email: string;
  role: string;
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
  manualLeadsCount: number | null;
  cancelledCount: number;
  cancelledRevenue: number;
  callsCount: number;
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
  const [period, setPeriodInternal] = useState<TimePeriod>('month');
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
      setPeriodInternal('month');
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

      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead']);

      if (!adminUsers?.length) {
        setAgents([]);
        setLoading(false);
        return;
      }

      const { start, end } = getDateRange(period, dateRange);
      const agentIds = adminUsers.map(u => u.id);

      // Attribute sales to the agent who actually confirmed the payment
      // (payment_confirmed_by). Fall back to assigned_to only when
      // payment_confirmed_by is null (older rows). Filter by signup_date so
      // historical months don't shift when leads are later reassigned — this
      // matches the Customer Management view.
      let customerQuery = supabase
        .from('customers')
        .select('id, assigned_to, payment_confirmed_by, final_amount, original_amount, discount_amount, discount_code, signup_date, created_at, status')
        .eq('is_deleted', false)
        .ilike('status', 'active')
        .or(`payment_confirmed_by.in.(${agentIds.join(',')}),and(payment_confirmed_by.is.null,assigned_to.in.(${agentIds.join(',')}))`);

      if (period !== 'all') {
        customerQuery = customerQuery
          .gte('signup_date', start.toISOString())
          .lte('signup_date', end.toISOString());
      }

      const { data: customers } = await customerQuery;
      const attributionOf = (c: any) => c.payment_confirmed_by || c.assigned_to;

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
        .select('id, assigned_to, payment_confirmed_by, final_amount, signup_date')
        .eq('is_deleted', false)
        .or('status.ilike.cancelled,status.ilike.refunded')
        .or(`payment_confirmed_by.in.(${agentIds.join(',')}),and(payment_confirmed_by.is.null,assigned_to.in.(${agentIds.join(',')}))`);

      if (period !== 'all') {
        cancelledQuery = cancelledQuery
          .gte('signup_date', start.toISOString())
          .lte('signup_date', end.toISOString());
      }

      const { data: cancelledCustomers } = await cancelledQuery;

      let leadsQuery = supabase
        .from('sales_leads')
        .select('id, assigned_to, is_paid, status, created_at')
        .in('assigned_to', agentIds);

      if (period !== 'all') {
        leadsQuery = leadsQuery
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());
      }

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

      // Fetch call attempts per agent for the period
      let callsQuery = supabase
        .from('lead_call_logs')
        .select('agent_id, created_at')
        .in('agent_id', agentIds);
      if (period !== 'all') {
        callsQuery = callsQuery
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());
      }
      const { data: callLogs } = await callsQuery;
      const callsMap = new Map<string, number>();
      (callLogs || []).forEach((c: any) => {
        if (c.agent_id) callsMap.set(c.agent_id, (callsMap.get(c.agent_id) || 0) + 1);
      });

      // Fetch monthly targets
      const nowIso = new Date().toISOString();
      const { data: targets } = await supabase
        .from('sales_targets')
        .select('admin_user_id, target_amount, target_period, manual_leads_count')
        .in('admin_user_id', agentIds)
        .eq('target_period', 'monthly')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso);

      const targetMap = new Map<string, number>();
      const manualLeadsMap = new Map<string, number>();
      const actualAttemptsMap = new Map<string, number>();
      (targets || []).forEach((t: any) => {
        targetMap.set(t.admin_user_id, t.target_amount);
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

      const scores: AgentScore[] = adminUsers.map(u => {
        const userCustomers = (customers || []).filter(c => attributionOf(c) === u.id);
        const userLeads = (leads || []).filter(l => l.assigned_to === u.id);
        const userConvertedLeads = userLeads.filter(l => l.is_paid === true);
        const userCancelled = (cancelledCustomers || []).filter(c => attributionOf(c) === u.id);
        const userClaims = (approvedClaims || []).filter(c => c.agent_id === u.id);

        // Include approved commission claims in sales count & revenue
        const salesCount = userCustomers.length + userClaims.length;
        const claimsRevenue = userClaims.reduce((sum, c) => sum + (c.deal_value || 0), 0);
        const revenue = userCustomers.reduce((sum, c) => sum + (c.final_amount || 0), 0) + claimsRevenue;
        const mtdAssigned = mtdLeadsMap.get(u.id) || 0;
        const manualLeads = manualLeadsMap.get(u.id);
        // Prefer manually-set leads count (set per agent based on days worked), fall back to MTD assigned
        const leadsAssigned = manualLeads != null ? manualLeads : (mtdAssigned || userLeads.length);
        const leadsConverted = userConvertedLeads.length;
        const target = targetMap.get(u.id) || 0;
        const conversionRate = leadsAssigned > 0 ? (salesCount / leadsAssigned) * 100 : 0;

        const avgOrderValue = salesCount > 0 ? revenue / salesCount : 0;
        const cancelledCount = userCancelled.length;
        const cancelledRevenue = userCancelled.reduce((sum, c) => sum + (c.final_amount || 0), 0);

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
          manualLeadsCount: manualLeadsMap.get(u.id) ?? null,
          cancelledCount,
          cancelledRevenue,
          callsCount: callsMap.get(u.id) || 0,
          manualActualAttempts: actualAttemptsMap.get(u.id) ?? null,
          avgDiscountPct,
        };
      });

      scores.sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount);
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return { agents, loading, period, setPeriod, dateRange, setDateRange, refresh: fetchData, currentUserId, currentAdminUserId, currentUserRole };
};
