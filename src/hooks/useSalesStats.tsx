import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SalespersonStats {
  userId: string;
  userName: string;
  userEmail: string;
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  totalRevenue: number;
  conversionRate: number;
  avgResponseTimeHours: number | null;
  followUpsDue: number;
  followUpsOverdue: number;
  // Real-time performance metrics
  totalCalls: number;
  avgPolicyValue: number;
  avgSpeedToLeadHours: number | null;
}

export interface TeamStats {
  totalLeads: number;
  totalConverted: number;
  totalLost: number;
  totalRevenue: number;
  overallConversionRate: number;
  unassignedLeads: number;
  avgConversionTime: number | null;
  leaderboard: SalespersonStats[];
  leadsBySource: { source: string; count: number }[];
  leadsByStatus: { status: string; count: number }[];
  tagDistribution: { tag: string; count: number; color: string }[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  criteria_type: string;
  criteria_value: number;
  earned_at?: string;
}

interface TeamFilters {
  dateFrom?: Date;
  dateTo?: Date;
  agentId?: string; // 'all' or specific agent id
}

export const useSalesStats = (userId?: string, teamFilters?: TeamFilters) => {
  const [personalStats, setPersonalStats] = useState<SalespersonStats | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [userBadges, setUserBadges] = useState<Badge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [salesUsers, setSalesUsers] = useState<{ id: string; first_name: string | null; last_name: string | null; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPersonalStats = useCallback(async (adminUserId: string) => {
    try {
      // Get user info
      const { data: userData } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .eq('id', adminUserId)
        .maybeSingle();

      if (!userData) return null;

      // Get leads assigned to this user
      const { data: leads } = await supabase
        .from('sales_leads')
        .select('*')
        .eq('assigned_to', adminUserId);

      const leadsData = leads || [];
      
      const newLeads = leadsData.filter(l => l.status === 'new').length;
      const contactedLeads = leadsData.filter(l => l.status === 'contacted').length;
      const lostLeads = leadsData.filter(l => l.status === 'lost').length;

      // Use customers table for real deal/revenue data (source of truth)
      const { data: customerDeals } = await supabase
        .from('customers')
        .select('id, final_amount, status')
        .eq('assigned_to', adminUserId)
        .eq('is_deleted', false);

      const activeDeals = (customerDeals || []).filter(c => 
        !['cancelled', 'refunded'].includes((c.status || '').toLowerCase())
      );
      const convertedLeads = activeDeals.length;
      const totalRevenue = activeDeals.reduce((sum, c) => sum + (c.final_amount || 0), 0);

      // Total calls made
      const totalCalls = leadsData.reduce((sum, l) => sum + (l.call_count || 0), 0);

      // Avg policy value
      const avgPolicyValue = convertedLeads > 0 ? totalRevenue / convertedLeads : 0;

      // Speed-to-lead: avg hours between created_at and last_contacted_at
      const speedToLeadValues = leadsData
        .filter(l => l.last_contacted_at && l.created_at)
        .map(l => {
          const created = new Date(l.created_at).getTime();
          const contacted = new Date(l.last_contacted_at!).getTime();
          return Math.max(0, (contacted - created) / (1000 * 60 * 60));
        });
      const avgSpeedToLeadHours = speedToLeadValues.length > 0
        ? speedToLeadValues.reduce((a, b) => a + b, 0) / speedToLeadValues.length
        : null;

      // Calculate follow-ups
      const now = new Date();
      const followUpsDue = leadsData.filter(l => 
        l.next_action_date && 
        new Date(l.next_action_date) <= now &&
        l.follow_up_status === 'pending'
      ).length;

      const followUpsOverdue = leadsData.filter(l =>
        l.next_action_date &&
        new Date(l.next_action_date) < now &&
        l.follow_up_status === 'pending'
      ).length;

      const stats: SalespersonStats = {
        userId: adminUserId,
        userName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email,
        userEmail: userData.email,
        totalLeads: leadsData.length,
        newLeads,
        contactedLeads,
        convertedLeads,
        lostLeads,
        totalRevenue,
        conversionRate: leadsData.length > 0 ? (convertedLeads / leadsData.length) * 100 : 0,
        avgResponseTimeHours: avgSpeedToLeadHours,
        followUpsDue,
        followUpsOverdue,
        totalCalls,
        avgPolicyValue,
        avgSpeedToLeadHours,
      };

      return stats;
    } catch (error) {
      console.error('Error fetching personal stats:', error);
      return null;
    }
  }, []);

  const fetchTeamStats = useCallback(async (filters?: TeamFilters) => {
    try {
      // Get all leads (for lead counts, status breakdowns, tags)
      let leadsQuery = supabase.from('sales_leads').select('id, status, assigned_to, call_count, last_contacted_at, created_at, priority, lead_source, converted_at, lost_at, lost_reason').limit(10000);
      
      // Apply date filter to leads
      if (filters?.dateFrom) {
        const fromISO = new Date(filters.dateFrom);
        fromISO.setHours(0, 0, 0, 0);
        leadsQuery = leadsQuery.gte('created_at', fromISO.toISOString());
      }
      if (filters?.dateTo) {
        const toISO = new Date(filters.dateTo);
        toISO.setHours(23, 59, 59, 999);
        leadsQuery = leadsQuery.lte('created_at', toISO.toISOString());
      }
      // Apply agent filter to leads
      if (filters?.agentId && filters.agentId !== 'all') {
        if (filters.agentId === 'unassigned') {
          leadsQuery = leadsQuery.is('assigned_to', null);
        } else {
          leadsQuery = leadsQuery.eq('assigned_to', filters.agentId);
        }
      }

      const { data: leads } = await leadsQuery;
      const leadsData = leads || [];

      // Get only sales-role users (sales agents and sales leads) — same as scoreboard
      const { data: users } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead']);

      setSalesUsers(users || []);
      const userIds = (users || []).map(u => u.id);

      // Fetch customers data (same source as scoreboard for revenue/deals)
      let customersQuery = supabase
        .from('customers')
        .select('id, assigned_to, final_amount, created_at, status')
        .eq('is_deleted', false)
        .ilike('status', 'active')
        .in('assigned_to', userIds);

      // Apply date filter to customers
      if (filters?.dateFrom) {
        const fromISO = new Date(filters.dateFrom);
        fromISO.setHours(0, 0, 0, 0);
        customersQuery = customersQuery.gte('created_at', fromISO.toISOString());
      }
      if (filters?.dateTo) {
        const toISO = new Date(filters.dateTo);
        toISO.setHours(23, 59, 59, 999);
        customersQuery = customersQuery.lte('created_at', toISO.toISOString());
      }
      // Apply agent filter to customers
      if (filters?.agentId && filters.agentId !== 'all' && filters.agentId !== 'unassigned') {
        customersQuery = customersQuery.eq('assigned_to', filters.agentId);
      }

      const { data: customers } = await customersQuery;
      const customersData = (filters?.agentId === 'unassigned') ? [] : (customers || []);

      // Calculate leaderboard using customers for revenue/deals (matches scoreboard)
      const leaderboard: SalespersonStats[] = (users || []).map((user) => {
        const userLeads = leadsData.filter(l => l.assigned_to === user.id);
        const userCustomers = customersData.filter(c => c.assigned_to === user.id);
        
        const converted = userCustomers.length;
        const revenue = userCustomers.reduce((sum, c) => sum + (c.final_amount || 0), 0);

        // Calls made per agent
        const totalCalls = userLeads.reduce((sum, l) => sum + (l.call_count || 0), 0);

        // Avg policy value
        const avgPolicyValue = converted > 0 ? revenue / converted : 0;

        // Speed-to-lead per agent
        const stlValues = userLeads
          .filter(l => l.last_contacted_at && l.created_at)
          .map(l => {
            const created = new Date(l.created_at).getTime();
            const contacted = new Date(l.last_contacted_at!).getTime();
            return Math.max(0, (contacted - created) / (1000 * 60 * 60));
          });
        const avgSpeedToLeadHours = stlValues.length > 0
          ? stlValues.reduce((a, b) => a + b, 0) / stlValues.length
          : null;

        return {
          userId: user.id,
          userName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
          userEmail: user.email,
          totalLeads: userLeads.length,
          newLeads: userLeads.filter(l => l.status === 'new').length,
          contactedLeads: userLeads.filter(l => l.status === 'contacted').length,
          convertedLeads: converted,
          lostLeads: userLeads.filter(l => l.status === 'lost').length,
          totalRevenue: revenue,
          conversionRate: userLeads.length > 0 ? (converted / userLeads.length) * 100 : 0,
          avgResponseTimeHours: avgSpeedToLeadHours,
          followUpsDue: 0,
          followUpsOverdue: 0,
          totalCalls,
          avgPolicyValue,
          avgSpeedToLeadHours,
        };
      });

      // Sort by revenue (same as scoreboard)
      leaderboard.sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Calculate totals using customers table (matches scoreboard)
      const totalConverted = customersData.length;
      const totalLost = leadsData.filter(l => l.status === 'lost').length;
      const totalRevenue = customersData.reduce((sum, c) => sum + (c.final_amount || 0), 0);

      // Leads by source
      const sourceMap = new Map<string, number>();
      leadsData.forEach(l => {
        const source = l.lead_source || 'unknown';
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
      });
      const leadsBySource = Array.from(sourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      // Leads by status
      const statusMap = new Map<string, number>();
      leadsData.forEach(l => {
        const status = l.status || 'new';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      });
      const leadsByStatus = Array.from(statusMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      // Tag distribution
      const { data: tagAssignments } = await supabase
        .from('lead_tag_assignments')
        .select('tag_id, lead_tags(name, color)');

      const tagMap = new Map<string, { count: number; color: string }>();
      (tagAssignments || []).forEach((t: any) => {
        if (t.lead_tags) {
          const existing = tagMap.get(t.lead_tags.name);
          tagMap.set(t.lead_tags.name, {
            count: (existing?.count || 0) + 1,
            color: t.lead_tags.color
          });
        }
      });
      const tagDistribution = Array.from(tagMap.entries())
        .map(([tag, data]) => ({ tag, ...data }))
        .sort((a, b) => b.count - a.count);

      const stats: TeamStats = {
        totalLeads: leadsData.length,
        totalConverted,
        totalLost,
        totalRevenue,
        overallConversionRate: leadsData.length > 0 ? (totalConverted / leadsData.length) * 100 : 0,
        unassignedLeads: leadsData.filter(l => !l.assigned_to).length,
        avgConversionTime: null,
        leaderboard,
        leadsBySource,
        leadsByStatus,
        tagDistribution
      };

      return stats;
    } catch (error) {
      console.error('Error fetching team stats:', error);
      return null;
    }
  }, []);

  const fetchBadges = useCallback(async (adminUserId?: string) => {
    try {
      // Get all badges
      const { data: badges } = await supabase
        .from('sales_badges')
        .select('*');

      setAllBadges(badges || []);

      if (adminUserId) {
        // Get user's earned badges
        const { data: earned } = await supabase
          .from('user_badges')
          .select('badge_id, earned_at, sales_badges(*)')
          .eq('user_id', adminUserId);

        const userBadgeList = (earned || []).map((e: any) => ({
          ...e.sales_badges,
          earned_at: e.earned_at
        }));

        setUserBadges(userBadgeList);
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
    }
  }, []);

  const checkAndAwardBadges = useCallback(async (adminUserId: string) => {
    try {
      const stats = await fetchPersonalStats(adminUserId);
      if (!stats) return;

      const { data: badges } = await supabase
        .from('sales_badges')
        .select('*');

      const { data: earnedBadges } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', adminUserId);

      const earnedIds = new Set((earnedBadges || []).map(e => e.badge_id));

      for (const badge of badges || []) {
        if (earnedIds.has(badge.id)) continue;

        let shouldAward = false;

        switch (badge.criteria_type) {
          case 'deals_closed':
            shouldAward = stats.convertedLeads >= badge.criteria_value;
            break;
          case 'revenue':
            shouldAward = stats.totalRevenue >= badge.criteria_value;
            break;
          case 'conversion_rate':
            shouldAward = stats.conversionRate >= badge.criteria_value;
            break;
        }

        if (shouldAward) {
          await supabase
            .from('user_badges')
            .insert({
              user_id: adminUserId,
              badge_id: badge.id
            });
        }
      }
    } catch (error) {
      console.error('Error checking badges:', error);
    }
  }, [fetchPersonalStats]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      if (userId) {
        const stats = await fetchPersonalStats(userId);
        setPersonalStats(stats);
        await fetchBadges(userId);
        await checkAndAwardBadges(userId);
      }

      const team = await fetchTeamStats(teamFilters);
      setTeamStats(team);
      
      setLoading(false);
    };

    loadData();
  }, [userId, teamFilters?.dateFrom?.getTime(), teamFilters?.dateTo?.getTime(), teamFilters?.agentId, fetchPersonalStats, fetchTeamStats, fetchBadges, checkAndAwardBadges]);

  return {
    personalStats,
    teamStats,
    userBadges,
    allBadges,
    salesUsers,
    loading,
    refreshStats: async () => {
      setLoading(true);
      if (userId) {
        const stats = await fetchPersonalStats(userId);
        setPersonalStats(stats);
      }
      const team = await fetchTeamStats(teamFilters);
      setTeamStats(team);
      setLoading(false);
    }
  };
};
