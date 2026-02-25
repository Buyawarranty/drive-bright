import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export type TimePeriod = 'today' | 'week' | 'month' | 'all';

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
}

export interface ScoreboardData {
  agents: AgentScore[];
  loading: boolean;
  period: TimePeriod;
  setPeriod: (p: TimePeriod) => void;
  refresh: () => void;
  currentUserId: string | null;
  currentAdminUserId: string | null;
  currentUserRole: string | null;
}

export const useScoreboardData = (): ScoreboardData => {
  const [agents, setAgents] = useState<AgentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const getDateRange = useCallback((p: TimePeriod) => {
    const now = new Date();
    switch (p) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'all':
        return { start: new Date('2020-01-01'), end: now };
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Get admin user ID and role for current user
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

      // Only fetch sales and sales_lead users — NOT admin/super_admin
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

      const { start, end } = getDateRange(period);
      const agentIds = adminUsers.map(u => u.id);

      // Fetch customers assigned to these agents within the period
      // Using created_at as the sale date, filtering by status = 'active' (paid)
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

      // Fetch leads assigned in period for conversion rate
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

      // Fetch monthly targets for current month
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

      // Build agent scores
      const scores: AgentScore[] = adminUsers.map(u => {
        const userCustomers = (customers || []).filter(c => c.assigned_to === u.id);
        const userLeads = (leads || []).filter(l => l.assigned_to === u.id);
        const userConvertedLeads = userLeads.filter(l => l.is_paid === true);

        const salesCount = userCustomers.length;
        const revenue = userCustomers.reduce((sum, c) => sum + (c.final_amount || 0), 0);
        const leadsAssigned = userLeads.length;
        const leadsConverted = userConvertedLeads.length;
        const conversionRate = leadsAssigned > 0 ? (leadsConverted / leadsAssigned) * 100 : 0;
        const avgOrderValue = salesCount > 0 ? revenue / salesCount : 0;

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
        };
      });

      // Sort by revenue, then by sales count
      scores.sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount);
      scores.forEach((s, i) => { s.rank = i + 1; });

      setAgents(scores);
    } catch (error) {
      console.error('Error fetching scoreboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [period, getDateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('scoreboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_leads' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return { agents, loading, period, setPeriod, refresh: fetchData, currentUserId, currentAdminUserId, currentUserRole };
};
