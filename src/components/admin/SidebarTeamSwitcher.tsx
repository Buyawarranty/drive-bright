import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';
import { useGlobalTeamFilter } from '@/hooks/useGlobalTeamFilter';
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
    userRole === 'dev_tester';

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
    </div>
  );
}
