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
  cancelledCount: number;
  cancelledRevenue: number;
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

      let customerQuery = supabase
        .from('customers')
        .select('id, assigned_to, final_amount, created_at, status')
        .eq('is_deleted', false)
        .ilike('status', 'active')
        .in('assigned_to', agentIds);

      if (period !== 'all') {
        customerQuery = customerQuery
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());
      }

      const { data: customers } = await customerQuery;

      // Fetch cancelled/refunded customers per agent (merged as one metric)
      let cancelledQuery = supabase
        .from('customers')
        .select('id, assigned_to, final_amount, updated_at')
        .eq('is_deleted', false)
        .or('status.ilike.cancelled,status.ilike.refunded')
        .in('assigned_to', agentIds);

      if (period !== 'all') {
        cancelledQuery = cancelledQuery
          .gte('updated_at', start.toISOString())
          .lte('updated_at', end.toISOString());
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

      // Fetch monthly targets
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      const { data: targets } = await supabase
        .from('sales_targets')
        .select('admin_user_id, target_amount, target_period')
        .in('admin_user_id', agentIds)
        .eq('target_period', 'monthly')
        .gte('start_date', monthStart.toISOString().split('T')[0])
        .lte('start_date', monthEnd.toISOString().split('T')[0]);

      const targetMap = new Map<string, number>();
      (targets || []).forEach(t => {
        targetMap.set(t.admin_user_id, t.target_amount);
      });

      const scores: AgentScore[] = adminUsers.map(u => {
        const userCustomers = (customers || []).filter(c => c.assigned_to === u.id);
        const userLeads = (leads || []).filter(l => l.assigned_to === u.id);
        const userConvertedLeads = userLeads.filter(l => l.is_paid === true);
        const userCancelled = (cancelledCustomers || []).filter(c => c.assigned_to === u.id);
        const userClaims = (approvedClaims || []).filter(c => c.agent_id === u.id);

        // Include approved commission claims in sales count & revenue
        const salesCount = userCustomers.length + userClaims.length;
        const claimsRevenue = userClaims.reduce((sum, c) => sum + (c.deal_value || 0), 0);
        const revenue = userCustomers.reduce((sum, c) => sum + (c.final_amount || 0), 0) + claimsRevenue;
        const leadsAssigned = userLeads.length;
        const leadsConverted = userConvertedLeads.length;
        const conversionRate = leadsAssigned > 0 ? (leadsConverted / leadsAssigned) * 100 : 0;
        const avgOrderValue = salesCount > 0 ? revenue / salesCount : 0;
        const cancelledCount = userCancelled.length;
        const cancelledRevenue = userCancelled.reduce((sum, c) => sum + (c.final_amount || 0), 0);

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
          cancelledCount,
          cancelledRevenue,
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
