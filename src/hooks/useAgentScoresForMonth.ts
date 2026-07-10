import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth } from 'date-fns';
import type { AgentScore } from './useScoreboardData';

/**
 * Fetch agent scores for a specific month. Mirrors useScoreboardData logic
 * but scoped to one arbitrary month — used by the month-by-month comparison view.
 */
export const useAgentScoresForMonth = (month: Date) => {
  const [agents, setAgents] = useState<AgentScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const start = startOfMonth(month);
        const end = endOfMonth(month);

        const { data: adminUsers } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role')
          .eq('is_active', true)
          .in('role', ['sales', 'sales_lead']);

        if (!adminUsers?.length) {
          if (!cancelled) { setAgents([]); setLoading(false); }
          return;
        }
        const agentIds = adminUsers.map(u => u.id);

        const agentIdList = agentIds.join(',');
        const attributionFilter = `payment_confirmed_by.in.(${agentIdList}),and(payment_confirmed_by.is.null,assigned_to.in.(${agentIdList}))`;

        const [{ data: customers }, { data: cancelledCustomers }, { data: leads }, { data: approvedClaims }, { data: callLogs }] = await Promise.all([
          supabase.from('customers')
            .select('id, assigned_to, payment_confirmed_by, final_amount')
            .eq('is_deleted', false).ilike('status', 'active')
            .or(attributionFilter)
            .gte('signup_date', start.toISOString()).lte('signup_date', end.toISOString()),
          supabase.from('customers')
            .select('id, assigned_to, payment_confirmed_by, final_amount')
            .eq('is_deleted', false)
            .or('status.ilike.cancelled,status.ilike.refunded')
            .or(attributionFilter)
            .gte('signup_date', start.toISOString()).lte('signup_date', end.toISOString()),
          supabase.from('sales_leads')
            .select('id, assigned_to, is_paid')
            .in('assigned_to', agentIds)
            .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
          supabase.from('commission_claims')
            .select('id, agent_id, deal_value')
            .eq('status', 'approved')
            .in('agent_id', agentIds)
            .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
          supabase.from('lead_call_logs')
            .select('agent_id')
            .in('agent_id', agentIds)
            .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
        ]);
        const attributionOf = (c: any) => c.payment_confirmed_by || c.assigned_to;

        const callsMap = new Map<string, number>();
        (callLogs || []).forEach((c: any) => {
          if (c.agent_id) callsMap.set(c.agent_id, (callsMap.get(c.agent_id) || 0) + 1);
        });

        const scores: AgentScore[] = adminUsers.map(u => {
          const userCustomers = (customers || []).filter(c => c.assigned_to === u.id);
          const userLeads = (leads || []).filter(l => l.assigned_to === u.id);
          const userConverted = userLeads.filter(l => l.is_paid === true);
          const userCancelled = (cancelledCustomers || []).filter(c => c.assigned_to === u.id);
          const userClaims = (approvedClaims || []).filter(c => c.agent_id === u.id);

          const salesCount = userCustomers.length + userClaims.length;
          const claimsRevenue = userClaims.reduce((s, c) => s + (c.deal_value || 0), 0);
          const revenue = userCustomers.reduce((s, c) => s + (c.final_amount || 0), 0) + claimsRevenue;
          const leadsAssigned = userLeads.length;
          const leadsConverted = userConverted.length;

          return {
            id: u.id,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email.split('@')[0],
            email: u.email,
            role: u.role,
            salesCount,
            revenue,
            leadsAssigned,
            leadsConverted,
            conversionRate: leadsAssigned > 0 ? (leadsConverted / leadsAssigned) * 100 : 0,
            avgOrderValue: salesCount > 0 ? revenue / salesCount : 0,
            rank: 0,
            previousRank: null,
            trend: 'same' as const,
            monthlyTarget: null,
            manualLeadsCount: null,
            cancelledCount: userCancelled.length,
            cancelledRevenue: userCancelled.reduce((s, c) => s + (c.final_amount || 0), 0),
            callsCount: callsMap.get(u.id) || 0,
            manualActualAttempts: null,
            avgDiscountPct: 0,
          };
        });

        scores.sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount);
        scores.forEach((s, i) => { s.rank = i + 1; });

        if (!cancelled) setAgents(scores);
      } catch (e) {
        console.error('useAgentScoresForMonth error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [month.getFullYear(), month.getMonth()]);

  return { agents, loading };
};
