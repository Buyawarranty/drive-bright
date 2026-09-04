import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fairFillShares } from '@/lib/fairFillShares';

/**
 * Open Round Robin Sandbox — shadow allocations.
 *
 * Stores "who WOULD get this lead" in `orr_sandbox_allocations` only. Nothing in
 * here ever writes to `sales_leads`, `agent_distribution_caps` or any live table,
 * so no agent is assigned, notified or credited by a practice run.
 *
 * Candidate agents and their caps come from the SAME settings the live Lead
 * Allocation page owns (`agent_distribution_caps`, `lead_team_members`), so when
 * Open Round Robin goes live nothing has to be re-entered.
 */

export interface SandboxAllocation {
  leadId: string;
  agentId: string | null;
  simulatedAt: string;
  reason: string | null;
}

export interface SandboxCandidate {
  adminUserId: string;
  name: string;
  dailyCap: number;
  usedToday: number;
  sortOrder: number;
}

export const useOrrSandboxAllocations = (enabled: boolean) => {
  const [allocations, setAllocations] = useState<Record<string, SandboxAllocation>>({});
  const [candidates, setCandidates] = useState<SandboxCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: rows, error: rowsError }, { data: caps }] = await Promise.all([
        supabase
          .from('orr_sandbox_allocations')
          .select('lead_id, simulated_agent_id, simulated_at, reason')
          .order('simulated_at', { ascending: false })
          .limit(2000),
        supabase
          .from('agent_distribution_caps')
          .select('admin_user_id, daily_cap, assigned_today, paused, sort_order')
          .eq('paused', false),
      ]);
      if (rowsError) throw rowsError;

      const map: Record<string, SandboxAllocation> = {};
      (rows ?? []).forEach((r: Record<string, unknown>) => {
        map[r.lead_id as string] = {
          leadId: r.lead_id as string,
          agentId: (r.simulated_agent_id as string) ?? null,
          simulatedAt: r.simulated_at as string,
          reason: (r.reason as string) ?? null,
        };
      });
      setAllocations(map);

      const capRows = (caps ?? []) as Array<Record<string, unknown>>;
      const ids = capRows.map(c => c.admin_user_id as string).filter(Boolean);
      let namesById: Record<string, string> = {};
      if (ids.length) {
        const { data: users } = await supabase
          .from('admin_users')
          .select('id, name, email, role, is_active')
          .in('id', ids);
        namesById = Object.fromEntries(
          ((users ?? []) as Array<Record<string, unknown>>)
            .filter(u => u.is_active !== false)
            .map(u => [u.id as string, (u.name as string) || (u.email as string) || 'Agent']),
        );
      }
      setCandidates(
        capRows
          .filter(c => namesById[c.admin_user_id as string])
          .map(c => ({
            adminUserId: c.admin_user_id as string,
            name: namesById[c.admin_user_id as string],
            dailyCap: Number(c.daily_cap ?? 0) || 0,
            usedToday: Number(c.assigned_today ?? 0) || 0,
            sortOrder: Number(c.sort_order ?? 0) || 0,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load the practice allocations');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Re-computes the practice allocation for the given leads and stores it in
   * `orr_sandbox_allocations` (upsert on lead_id). Live data is untouched.
   */
  const simulate = useCallback(async (leadIds: string[]) => {
    if (!leadIds.length || !candidates.length) return { assigned: 0 };
    setRunning(true);
    setError(null);
    try {
      const runId = crypto.randomUUID();
      const shares = fairFillShares(
        candidates.map(c => ({
          id: c.adminUserId,
          usedToday: c.usedToday,
          remaining: Math.max(0, (c.dailyCap || 0) - c.usedToday) || (c.dailyCap ? 0 : 9999),
        })),
        leadIds.length,
      );

      // Expand the per-agent shares into a rotation order so the practice list
      // reads one-at-a-time, exactly like the live single-cursor round robin.
      const queue: string[] = [];
      const remaining = { ...shares };
      let guard = 0;
      while (Object.values(remaining).some(v => v > 0) && guard < leadIds.length * 4) {
        for (const c of candidates) {
          if ((remaining[c.adminUserId] ?? 0) > 0) {
            queue.push(c.adminUserId);
            remaining[c.adminUserId] -= 1;
          }
        }
        guard += 1;
      }

      const rows = leadIds.map((leadId, i) => ({
        lead_id: leadId,
        simulated_agent_id: queue[i] ?? null,
        reason: queue[i] ? 'Open Round Robin practice pass' : 'No capacity left in this practice pass',
        run_id: runId,
        simulated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabase
        .from('orr_sandbox_allocations')
        .upsert(rows, { onConflict: 'lead_id' });
      if (upsertError) throw upsertError;

      await load();
      return { assigned: rows.filter(r => r.simulated_agent_id).length };
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not run the practice pass');
      return { assigned: 0 };
    } finally {
      setRunning(false);
    }
  }, [candidates, load]);

  const clearAll = useCallback(async () => {
    setRunning(true);
    try {
      await supabase.from('orr_sandbox_allocations').delete().not('lead_id', 'is', null);
      await load();
    } finally {
      setRunning(false);
    }
  }, [load]);

  return { allocations, candidates, loading, running, error, refresh: load, simulate, clearAll };
};
