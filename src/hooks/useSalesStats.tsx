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

export const useSalesStats = (userId?: string) => {
  const [personalStats, setPersonalStats] = useState<SalespersonStats | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [userBadges, setUserBadges] = useState<Badge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
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
      // Use is_paid for converted/revenue calculations
      const convertedLeads = leadsData.filter(l => l.is_paid === true).length;
      const lostLeads = leadsData.filter(l => l.status === 'lost').length;
      const totalRevenue = leadsData
        .filter(l => l.is_paid === true)
        .reduce((sum, l) => sum + (l.payment_amount || l.cart_value || l.quote_amount || 0), 0);

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
        avgResponseTimeHours: null, // Would need activity tracking to calculate
        followUpsDue,
        followUpsOverdue
      };

      return stats;
    } catch (error) {
      console.error('Error fetching personal stats:', error);
      return null;
    }
  }, []);

  const fetchTeamStats = useCallback(async () => {
    try {
      // Get all leads
      const { data: leads } = await supabase
        .from('sales_leads')
        .select('*');

      const leadsData = leads || [];

      // Get all sales users
      const { data: users } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .eq('is_active', true);

      // Calculate leaderboard
      const leaderboard: SalespersonStats[] = await Promise.all(
        (users || []).map(async (user) => {
          const userLeads = leadsData.filter(l => l.assigned_to === user.id);
          // Use is_paid for converted/revenue calculations
          const converted = userLeads.filter(l => l.is_paid === true).length;
          const revenue = userLeads
            .filter(l => l.is_paid === true)
            .reduce((sum, l) => sum + (l.payment_amount || l.cart_value || l.quote_amount || 0), 0);

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
            avgResponseTimeHours: null,
            followUpsDue: 0,
            followUpsOverdue: 0
          };
        })
      );

      // Sort by revenue
      leaderboard.sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Calculate totals
      // Use is_paid for converted/revenue calculations
      const totalConverted = leadsData.filter(l => l.is_paid === true).length;
      const totalLost = leadsData.filter(l => l.status === 'lost').length;
      const totalRevenue = leadsData
        .filter(l => l.is_paid === true)
        .reduce((sum, l) => sum + (l.payment_amount || l.cart_value || l.quote_amount || 0), 0);

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

      const team = await fetchTeamStats();
      setTeamStats(team);
      
      setLoading(false);
    };

    loadData();
  }, [userId, fetchPersonalStats, fetchTeamStats, fetchBadges, checkAndAwardBadges]);

  return {
    personalStats,
    teamStats,
    userBadges,
    allBadges,
    loading,
    refreshStats: async () => {
      setLoading(true);
      if (userId) {
        const stats = await fetchPersonalStats(userId);
        setPersonalStats(stats);
      }
      const team = await fetchTeamStats();
      setTeamStats(team);
      setLoading(false);
    }
  };
};
