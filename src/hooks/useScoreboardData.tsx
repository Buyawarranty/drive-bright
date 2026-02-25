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
}

export interface ScoreboardData {
  agents: AgentScore[];
  loading: boolean;
  period: TimePeriod;
  setPeriod: (p: TimePeriod) => void;
  refresh: () => void;
  currentUserId: string | null;
  currentAdminUserId: string | null;
}

export const useScoreboardData = (): ScoreboardData => {
  const [agents, setAgents] = useState<AgentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);

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

      // Get admin user ID for current user
      let myAdminId: string | null = null;
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        myAdminId = adminUser?.id || null;
        setCurrentAdminUserId(myAdminId);
      }

      // Fetch all sales-related admin users
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

      // Fetch customers (actual paid sales) with date filtering
      const { data: customers } = await supabase
        .from('customers')
        .select('id, assigned_to, final_amount, signup_date, status')
        .eq('is_deleted', false)
        .eq('status', 'active')
        .gte('signup_date', start.toISOString())
        .lte('signup_date', end.toISOString());

      // Fetch leads assigned in period
      const { data: leads } = await supabase
        .from('sales_leads')
        .select('id, assigned_to, is_paid, status, created_at, payment_amount, cart_value, quote_amount');

      const leadsInPeriod = (leads || []).filter(l => {
        const d = new Date(l.created_at);
        return d >= start && d <= end;
      });

      // Build agent scores
      const scores: AgentScore[] = adminUsers.map(user => {
        const userCustomers = (customers || []).filter(c => c.assigned_to === user.id);
        const userLeads = leadsInPeriod.filter(l => l.assigned_to === user.id);
        const userConvertedLeads = (leads || []).filter(l => l.assigned_to === user.id && l.is_paid === true);

        const salesCount = userCustomers.length;
        const revenue = userCustomers.reduce((sum, c) => sum + (c.final_amount || 0), 0);
        const leadsAssigned = userLeads.length;
        const leadsConverted = userConvertedLeads.length;
        const conversionRate = leadsAssigned > 0 ? (leadsConverted / leadsAssigned) * 100 : 0;
        const avgOrderValue = salesCount > 0 ? revenue / salesCount : 0;

        return {
          id: user.id,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0],
          email: user.email,
          role: user.role,
          salesCount,
          revenue,
          leadsAssigned,
          leadsConverted,
          conversionRate,
          avgOrderValue,
          rank: 0,
          previousRank: null,
          trend: 'same' as const,
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

  return { agents, loading, period, setPeriod, refresh: fetchData, currentUserId, currentAdminUserId };
};
