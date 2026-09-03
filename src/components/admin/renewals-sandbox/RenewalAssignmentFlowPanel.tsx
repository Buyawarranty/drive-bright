import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, GitBranch, Loader2, Lock, UserCheck, Users } from 'lucide-react';
import type { SandboxRow } from './types';
import { daysToExpiry } from './renewalPricing';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';

/**
 * RENEWALS SANDBOX — assignment order preview (seller-first, round robin fallback)
 * ---------------------------------------------------------------------------------
 * Shows, using the REAL sales agents and the renewals currently on screen, exactly
 * where each renewal lead would go when the engine runs:
 *
 *   1. ORIGINAL SELLER — the agent who sold / confirmed / quoted the warranty,
 *      but only when they are still active, in a sales role, on the New Leads
 *      workstream and not on leave.
 *   2. ROUND ROBIN — everyone else drops into the shared pool and is dealt one
 *      each, in turn, to the eligible agents.
 *
 * Preview only — nothing is written.
 */

interface AgentLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string | null;
}

const agentName = (a?: AgentLite | { first_name?: string | null; last_name?: string | null; email?: string | null } | null) =>
  a ? ([a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Unknown') : 'Unknown';

export const RenewalAssignmentFlowPanel: React.FC<{ rows: SandboxRow[]; live: boolean }> = ({ rows, live }) => {
  const adminMap = useAllAdminUsersMap();
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [newLeadWorkers, setNewLeadWorkers] = useState<Set<string>>(new Set());
  const [onLeave, setOnLeave] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [{ data: au }, { data: ws }, { data: leave }] = await Promise.all([
          (supabase.from('admin_users') as any)
            .select('id, first_name, last_name, email, role')
            .eq('is_active', true)
            .in('role', ['sales', 'sales_lead'])
            .order('first_name', { ascending: true }),
          (supabase.from('lead_team_members') as any)
            .select('admin_user_id, workstream_new_leads'),
          (supabase.from('agent_leave_periods') as any)
            .select('admin_user_id')
            .lte('start_date', today)
            .gte('end_date', today),
        ]);
        if (!mounted) return;
        setAgents((au as AgentLite[]) || []);
        setNewLeadWorkers(new Set(
          ((ws as any[]) || []).filter((r) => r.workstream_new_leads === true).map((r) => r.admin_user_id)
        ));
        setOnLeave(new Set(((leave as any[]) || []).map((r) => r.admin_user_id)));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /** Agents the round robin is allowed to deal to (sales, on New Leads, not on leave). */
  const eligibleAgents = useMemo(
    () => agents.filter((a) => newLeadWorkers.has(a.id) && !onLeave.has(a.id)),
    [agents, newLeadWorkers, onLeave]
  );

  /**
   * Mirror of the database rule (create_renewal_lead_for_policy):
   * payment_confirmed_by → quote_sent_by → current customer owner, first that is an
   * eligible sales agent wins; otherwise the renewal goes to the round robin pool.
   */
  const flows = useMemo(() => {
    const pool: { row: SandboxRow; sellerName: string | null; reason: string }[] = [];
    const direct: { row: SandboxRow; agent: AgentLite; via: string }[] = [];

    for (const row of rows) {
      const candidates: { id: string | null | undefined; via: string }[] = [
        { id: (row as any).payment_confirmed_by, via: 'confirmed the payment' },
        { id: (row as any).quote_sent_by, via: 'sent the quote' },
        { id: row.customers?.assigned_to, via: 'owns the customer' },
      ];
      let winner: { agent: AgentLite; via: string } | null = null;
      let sellerName: string | null = null;
      let skipReason = 'no seller on record';

      for (const c of candidates) {
        if (!c.id) continue;
        const rec = adminMap.get(c.id);
        if (!sellerName && rec) sellerName = agentName(rec);
        if (!rec) { skipReason = 'seller no longer on file'; continue; }
        if (rec.role !== 'sales' && rec.role !== 'sales_lead') { skipReason = `${agentName(rec)} is not in a sales role`; continue; }
        if (rec.is_active === false || rec.archived_at) { skipReason = `${agentName(rec)} is no longer active`; continue; }
        if (!newLeadWorkers.has(c.id)) { skipReason = `${agentName(rec)} is not on New Leads`; continue; }
        if (onLeave.has(c.id)) { skipReason = `${agentName(rec)} is on leave`; continue; }
        winner = { agent: agents.find((a) => a.id === c.id) || (rec as any), via: c.via };
        break;
      }

      if (winner) direct.push({ row, agent: winner.agent, via: winner.via });
      else pool.push({ row, sellerName, reason: skipReason });
    }

    // Deal the pool round robin over eligible agents, most urgent first.
    const sortedPool = [...pool].sort((a, b) => {
      const da = daysToExpiry(a.row.policy_end_date);
      const db = daysToExpiry(b.row.policy_end_date);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
    const rr: { row: SandboxRow; agent: AgentLite | null; sellerName: string | null; reason: string }[] =
      sortedPool.map((p, i) => ({
        row: p.row,
        agent: eligibleAgents.length ? eligibleAgents[i % eligibleAgents.length] : null,
        sellerName: p.sellerName,
        reason: p.reason,
      }));

    return { direct, rr };
  }, [rows, agents, adminMap, newLeadWorkers, onLeave, eligibleAgents]);

  const rowLabel = (r: SandboxRow) =>
    (r.customers?.registration_plate || r.policy_number || '—').toUpperCase();
  const rowName = (r: SandboxRow) =>
    [r.customers?.first_name, r.customers?.last_name].filter(Boolean).join(' ') ||
    (r.customers as any)?.name || r.customer_full_name || '—';
  const rowDays = (r: SandboxRow) => {
    const d = daysToExpiry(r.policy_end_date);
    if (d === null) return '';
    return d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`;
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Assignment flow preview — seller first, then round robin
            <Badge variant="secondary">{rows.length} renewals</Badge>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setShow((v) => !v)}>
            {show ? 'Hide' : 'Show'}
          </Button>
        </CardTitle>
      </CardHeader>
      {show && (
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Every renewal first goes to the agent who sold that warranty — as long as they are still active,
            on the New Leads workstream and not on leave. If they are not available, the renewal drops into
            the round robin and is dealt one each, in turn, to the agents below.
          </p>

          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Round robin order ({eligibleAgents.length} eligible agents)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {eligibleAgents.map((a, i) => (
                    <Badge key={a.id} variant="outline" className="text-xs gap-1">
                      <span className="text-muted-foreground">{i + 1}.</span> {agentName(a)}
                    </Badge>
                  ))}
                  {!eligibleAgents.length && (
                    <span className="text-sm text-muted-foreground">No eligible agents — nobody is on New Leads right now.</span>}
                  {agents.filter((a) => !eligibleAgents.includes(a)).map((a) => (
                    <Badge key={a.id} variant="secondary" className="text-xs opacity-60" title={onLeave.has(a.id) ? 'On leave' : 'Not on New Leads workstream'}>
                      {agentName(a)} ({onLeave.has(a.id) ? 'on leave' : 'not on New Leads'})
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> Goes straight to the original seller ({flows.direct.length})
                </div>
                {flows.direct.length ? (
                  <ul className="space-y-1 text-xs">
                    {flows.direct.slice(0, 10).map(({ row, agent, via }) => (
                      <li key={row.id} className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{rowName(row)}</span>
                        <span className="text-muted-foreground">({rowLabel(row)} · {rowDays(row)})</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs">{agentName(agent)}</Badge>
                        <span className="text-muted-foreground">— {via}</span>
                      </li>
                    ))}
                    {flows.direct.length > 10 && <li className="text-muted-foreground">+{flows.direct.length - 10} more</li>}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">None of the renewals on screen have an available original seller.</p>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Falls back to round robin ({flows.rr.length})
                </div>
                {flows.rr.length ? (
                  <ul className="space-y-1 text-xs">
                    {flows.rr.slice(0, 10).map(({ row, agent, sellerName, reason }) => (
                      <li key={row.id} className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{rowName(row)}</span>
                        <span className="text-muted-foreground">({rowLabel(row)} · {rowDays(row)})</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {agent
                          ? <Badge variant="secondary" className="text-xs">{agentName(agent)}</Badge>
                          : <Badge variant="secondary" className="text-xs">Unassigned pool</Badge>}
                        <span className="text-muted-foreground">— {reason}</span>
                      </li>
                    ))}
                    {flows.rr.length > 10 && <li className="text-muted-foreground">+{flows.rr.length - 10} more</li>}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Nothing needs the round robin — every renewal has its seller.</p>
                )}
              </div>
            </>
          )}

          {!live && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Sandbox preview — nothing is assigned while the engine is off.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default RenewalAssignmentFlowPanel;
