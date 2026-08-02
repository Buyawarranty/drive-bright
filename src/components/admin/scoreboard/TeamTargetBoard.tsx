import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Trophy, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface Row {
  team_id: string;
  team_name: string;
  team_sort: number;
  admin_user_id: string;
  agent_name: string;
  revenue: number;
  sales_count: number;
  pct_achieved: number | null;
  revenue_target: number | null;
  team_revenue: number;
  team_pct: number | null;
  is_self: boolean;
}

const gbp = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n || 0);

const teamAccent = (name: string) => {
  const n = (name || '').toLowerCase();
  if (n.includes('red')) return { pill: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-500' };
  if (n.includes('blue')) return { pill: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' };
  if (n.includes('green')) return { pill: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' };
  return { pill: 'bg-muted text-foreground border-border', dot: 'bg-muted-foreground' };
};

/**
 * Team scoreboard with the agreed visibility rules:
 *  - Actual sales £: visible to everyone on the same team
 *  - Progress vs target: shown as a % only
 *  - Exact £ monthly target: only for the agent themselves (and management)
 *  - Team target progress: visible to all agents on the team
 */
export const TeamTargetBoard: React.FC<{ monthDate?: Date }> = ({ monthDate }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const month = monthDate ?? new Date();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_team_scoreboard', {
        p_start: startOfMonth(month).toISOString(),
        p_end: endOfMonth(month).toISOString(),
      });
      if (cancelled) return;
      if (error) setError(error.message);
      else {
        setError(null);
        setRows((data || []) as unknown as Row[]);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [month.getFullYear(), month.getMonth()]);

  const teams = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sort: number; revenue: number; pct: number | null; members: Row[] }>();
    for (const r of rows) {
      const t = map.get(r.team_id) ?? {
        id: r.team_id, name: r.team_name, sort: r.team_sort ?? 0,
        revenue: Number(r.team_revenue) || 0, pct: r.team_pct, members: [],
      };
      t.members.push(r);
      map.set(r.team_id, t);
    }
    return Array.from(map.values()).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || a.sort - b.sort);
  }, [rows]);

  // Ranking across every visible agent
  const ranking = useMemo(
    () => rows.slice().sort((a, b) => Number(b.revenue) - Number(a.revenue)),
    [rows]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Team targets — {format(month, 'MMMM yyyy')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Everyone on your team sees each other's sales and progress as a percentage. The exact £ monthly target
            stays private to each agent and their manager.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && <p className="text-sm text-muted-foreground">Loading team figures…</p>}
          {!loading && error && <p className="text-sm text-destructive">Could not load team figures: {error}</p>}
          {!loading && !error && teams.length === 0 && (
            <p className="text-sm text-muted-foreground">You're not on a sales team yet, so there's nothing to show.</p>
          )}

          {teams.map(team => {
            const accent = teamAccent(team.name);
            return (
              <div key={team.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} />
                    <span className="font-semibold">{team.name}</span>
                    <Badge variant="outline" className={accent.pill}>
                      {team.pct != null ? `${team.pct}% of team target` : 'No team target set'}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">Team sales {gbp(team.revenue)}</span>
                </div>
                <Progress value={Math.min(team.pct ?? 0, 100)} className="h-2" />

                <div className="divide-y">
                  {team.members
                    .slice()
                    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
                    .map(m => (
                      <div key={m.admin_user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <span className={`text-sm ${m.is_self ? 'font-semibold' : ''}`}>{m.agent_name}</span>
                          {m.is_self && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="font-medium">{gbp(Number(m.revenue))} sales</span>
                          <span className="text-muted-foreground">{m.sales_count} deals</span>
                          <Badge
                            variant="outline"
                            className={
                              (m.pct_achieved ?? 0) >= 100
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : (m.pct_achieved ?? 0) >= 70
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-muted text-foreground'
                            }
                          >
                            {m.pct_achieved != null ? `${m.pct_achieved}% achieved` : 'No target'}
                          </Badge>
                          {m.revenue_target != null ? (
                            <span className="text-xs text-muted-foreground">target {gbp(Number(m.revenue_target))}</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" /> target private
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {ranking.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Ranking this month
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {ranking.map((r, i) => (
              <div key={r.admin_user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-sm text-muted-foreground">#{i + 1}</span>
                  <span className={`text-sm ${r.is_self ? 'font-semibold' : ''}`}>{r.agent_name}</span>
                  <Badge variant="outline" className={teamAccent(r.team_name).pill}>{r.team_name}</Badge>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium">{gbp(Number(r.revenue))}</span>
                  <span className="text-muted-foreground">
                    {r.pct_achieved != null ? `${r.pct_achieved}% of target` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
