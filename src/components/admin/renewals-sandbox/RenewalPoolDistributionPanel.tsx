import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Lock, Loader2 } from 'lucide-react';
import type { SandboxRow } from './types';
import { evaluateOwnership } from './renewalOwnership';
import { daysToExpiry } from './renewalPricing';

/**
 * RENEWALS SANDBOX — Open Pool auto-distribution preview (Stage 5, Step 15)
 * ---------------------------------------------------------------------------
 * We do NOT build a second allocation engine. This only previews how the
 * existing Open Pool round robin would share out the renewals that are actually
 * eligible for reassignment (unowned, or owned but past their SLA), ordered by
 * renewal urgency. Nothing is assigned and nothing is written.
 */

interface AgentLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

const agentName = (a: AgentLite) =>
  [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email;

export const RenewalPoolDistributionPanel: React.FC<{ rows: SandboxRow[]; live: boolean }> = ({ rows, live }) => {
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await (supabase.from('admin_users') as any)
          .select('id, first_name, last_name, email, role, is_active')
          .eq('is_active', true)
          .in('role', ['sales', 'sales_lead'])
          .order('first_name', { ascending: true });
        if (mounted) setAgents(((data as AgentLite[]) || []));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /** Only renewals eligible for reassignment enter the pool, most urgent first. */
  const eligible = useMemo(() => {
    return rows
      .filter((r) => evaluateOwnership(r).poolEligible)
      .sort((a, b) => {
        const da = daysToExpiry(a.policy_end_date);
        const db = daysToExpiry(b.policy_end_date);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
  }, [rows]);

  /** Existing round robin: one each, in turn, until the pool is empty. */
  const plan = useMemo(() => {
    const map = new Map<string, SandboxRow[]>();
    agents.forEach((a) => map.set(a.id, []));
    if (!agents.length) return map;
    eligible.forEach((row, i) => {
      const agent = agents[i % agents.length];
      map.get(agent.id)!.push(row);
    });
    return map;
  }, [agents, eligible]);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Open Pool auto-distribution preview
            <Badge variant="secondary">{eligible.length} eligible</Badge>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setShow((v) => !v)}>
            {show ? 'Hide' : 'Show'}
          </Button>
        </CardTitle>
      </CardHeader>
      {show && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Uses the existing round robin — one renewal each, in turn, over the sales agents who are switched on.
            Owned renewals still inside their SLA, and renewals protected by a booked callback, never enter the pool.
          </p>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : !agents.length ? (
            <p className="text-sm text-muted-foreground">No active sales agents to distribute to.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => {
                const list = plan.get(a.id) || [];
                return (
                  <div key={a.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{agentName(a)}</span>
                      <Badge variant="outline">{list.length}</Badge>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {list.slice(0, 4).map((r) => {
                        const d = daysToExpiry(r.policy_end_date);
                        return (
                          <li key={r.id} className="truncate">
                            {(r.customers?.registration_plate || r.policy_number || '—').toUpperCase()}
                            {d !== null && <span> · {d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}</span>}
                          </li>
                        );
                      })}
                      {list.length > 4 && <li>+{list.length - 4} more</li>}
                      {!list.length && <li>Nothing queued</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          {!live && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Preview only — no renewal is allocated while the engine is off.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default RenewalPoolDistributionPanel;
