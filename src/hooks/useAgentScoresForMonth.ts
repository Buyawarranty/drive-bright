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

        // Only active, non-archived agents appear on the scoreboard.
        const { data: adminUsers } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active, sip_extension')
          .in('role', ['sales', 'sales_lead'])
          .eq('is_active', true)
          .is('archived_at', null);

        if (!adminUsers?.length) {
          if (!cancelled) { setAgents([]); setLoading(false); }
          return;
        }
        const agentIds = adminUsers.map(u => u.id);

        const agentIdList = agentIds.join(',');
        // Manager override (sale_credit_admin_user_id) wins; otherwise payment_confirmed_by,
        // then quote_sent_by, then assigned_to.
        const attributionFilter = `sale_credit_admin_user_id.in.(${agentIdList}),and(sale_credit_admin_user_id.is.null,payment_confirmed_by.in.(${agentIdList})),and(sale_credit_admin_user_id.is.null,payment_confirmed_by.is.null,quote_sent_by.in.(${agentIdList})),and(sale_credit_admin_user_id.is.null,payment_confirmed_by.is.null,quote_sent_by.is.null,assigned_to.in.(${agentIdList}))`;

        const [{ data: customers }, { data: cancelledCustomers }, { data: leads }, { data: approvedClaims }, { data: dialEvents }, { data: cleanRows }] = await Promise.all([
          supabase.from('customers')
            .select('id, assigned_to, payment_confirmed_by, quote_sent_by, sale_credit_admin_user_id, final_amount')
            .eq('is_deleted', false).ilike('status', 'active')
            .or(attributionFilter)
            .gte('signup_date', start.toISOString()).lte('signup_date', end.toISOString()),
          supabase.from('customers')
            .select('id, assigned_to, payment_confirmed_by, quote_sent_by, sale_credit_admin_user_id, final_amount')
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
          // Live Dial 9 / Zoiper call data
          supabase.from('zoiper_call_events')
            .select('agent_user_id, agent_extension, talk_seconds')
            .eq('direction', 'outbound')
            .gte('started_at', start.toISOString()).lte('started_at', end.toISOString())
            .limit(50000),
          // Clean leads only (fake / wrong number / do-not-contact excluded)
          supabase.rpc('get_clean_leads_per_agent', {
            _agent_ids: agentIds,
            _start: start.toISOString(),
            _end: end.toISOString(),
          }),
        ]);
        const attributionOf = (c: any) => c.sale_credit_admin_user_id || c.payment_confirmed_by || c.quote_sent_by || c.assigned_to;

        const extToAgent = new Map<string, string>();
        (adminUsers as any[]).forEach(u => {
          if (u.sip_extension) extToAgent.set(String(u.sip_extension), u.id);
        });
        const callsMap = new Map<string, number>();
        const connectedMap = new Map<string, number>();
        (dialEvents || []).forEach((c: any) => {
          const agentId = c.agent_user_id || (c.agent_extension ? extToAgent.get(String(c.agent_extension)) : null);
          if (!agentId) return;
          callsMap.set(agentId, (callsMap.get(agentId) || 0) + 1);
          if ((Number(c.talk_seconds) || 0) > 0) connectedMap.set(agentId, (connectedMap.get(agentId) || 0) + 1);
        });
        const cleanLeadsMap = new Map<string, number>();
        const cleanConvertedMap = new Map<string, number>();
        ((cleanRows as any[]) || []).forEach((r: any) => {
          if (!r.assigned_to) return;
          cleanLeadsMap.set(r.assigned_to, Number(r.clean_leads) || 0);
          cleanConvertedMap.set(r.assigned_to, Number(r.clean_converted) || 0);
        });

        const scores: AgentScore[] = adminUsers.map(u => {
          const userCustomers = (customers || []).filter(c => attributionOf(c) === u.id);
          const userLeads = (leads || []).filter(l => l.assigned_to === u.id);
          const userConverted = userLeads.filter(l => l.is_paid === true);
          const userCancelled = (cancelledCustomers || []).filter(c => attributionOf(c) === u.id);
          const userClaims = (approvedClaims || []).filter(c => c.agent_id === u.id);

          const salesCount = userCustomers.length + userClaims.length;
          const claimsRevenue = userClaims.reduce((s, c) => s + (c.deal_value || 0), 0);
          const grossRevenue = userCustomers.reduce((s, c) => s + (c.final_amount || 0), 0) + claimsRevenue;
          const cancelledRevenue = userCancelled.reduce((s, c) => s + (c.final_amount || 0), 0);
          // Net revenue reflects refunds/cancellations against the agent's revenue.
          const revenue = grossRevenue - cancelledRevenue;
          const leadsAssigned = cleanLeadsMap.get(u.id) ?? 0;
          const leadsConverted = cleanConvertedMap.get(u.id) ?? userConverted.length;

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
            conversionRate: leadsAssigned > 0 ? (leadsConverted / leadsAssigned) * 100 : 0,
            avgOrderValue: salesCount > 0 ? revenue / salesCount : 0,
            rank: 0,
            previousRank: null,
            trend: 'same' as const,
            monthlyTarget: null,
            revenueTarget: null,
            manualLeadsCount: null,
            cancelledCount: userCancelled.length,
            cancelledRevenue: userCancelled.reduce((s, c) => s + (c.final_amount || 0), 0),
            callsCount: callsMap.get(u.id) || 0,
            connectedCalls: connectedMap.get(u.id) || 0,
            manualActualAttempts: null,
            avgDiscountPct: 0,
          };
        });

        scores.sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue);
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
