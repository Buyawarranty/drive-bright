import { useEffect, useState } from 'react';
import { Repeat, RotateCw } from 'lucide-react';
import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';
import { useGlobalTeamFilter } from '@/hooks/useGlobalTeamFilter';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  userRole?: string | null;
}

/**
 * Always-visible team switcher chips in the admin sidebar.
 * Selection is shared globally (localStorage + custom event) so that the
 * Red/Blue/Green pick applies to every lead view that reads `useGlobalTeamFilter`.
 *
 * Sales agents / sales_leads are locked to their own team elsewhere, so the
 * switcher only renders for management roles that can actually change teams.
 */
export function SidebarTeamSwitcher({ userRole }: Props) {
  const [teamId, setTeamId] = useGlobalTeamFilter();
  const { allTeams } = useAgentTeams();

  const canSwitch =
    userRole === 'super_admin' ||
    userRole === 'admin' ||
    userRole === 'sales_manager' ||
    userRole === 'performance_manager' ||
    userRole === 'dev_tester';

  const [methodMap, setMethodMap] = useState<Record<string, 'orr' | 'rr'>>({});

  useEffect(() => {
    if (!canSwitch) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('lead_distribution_settings')
        .select('team_id, open_round_robin_enabled')
        .not('team_id', 'is', null);
      if (!active || !data) return;
      const map: Record<string, 'orr' | 'rr'> = {};
      for (const row of data as any[]) {
        if (row.team_id) map[row.team_id] = row.open_round_robin_enabled ? 'orr' : 'rr';
      }
      setMethodMap(map);
    })();
    return () => { active = false; };
  }, [canSwitch]);


  if (!canSwitch || allTeams.length === 0) return null;

  return (
    <div className="pt-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        Team filter
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTeamId(null)}
          className={cn(
            'px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors',
            teamId === null
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          All
        </button>
        {allTeams.map((t) => {
          const c = TEAM_COLOR_CLASSES[t.color];
          const active = teamId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeamId(active ? null : t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors',
                active ? c.pill : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
              {t.name.replace(/^Formula\s+/i, '')}
            </button>
          );
        })}
      </div>
      {teamId && (() => {
        const team = allTeams.find(t => t.id === teamId);
        const method = methodMap[teamId] ?? 'rr';
        const isOrr = method === 'orr';
        return (
          <div
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide',
              isOrr
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            )}
            title={`Distribution method active for ${team?.name ?? 'this team'}`}
          >
            {isOrr ? <Repeat className="h-3 w-3" /> : <RotateCw className="h-3 w-3" />}
            {isOrr ? 'Open Round Robin' : 'Round Robin'}
          </div>
        );
      })()}
    </div>
  );

}
