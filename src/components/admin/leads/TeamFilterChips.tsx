import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface TeamFilterChipsProps {
  value: string | null;
  onChange: (teamId: string | null) => void;
  className?: string;
  /**
   * Optional whitelist of team ids that this viewer is allowed to filter by.
   * When provided, only those team chips render and the "All" chip is hidden
   * unless every team is in the whitelist. Use for sales_leads who have been
   * granted visibility into a subset of teams.
   */
  allowedTeamIds?: string[];
}

/**
 * Compact chip row that filters the leads list by the assigned agent's team.
 * Defaults to "All" so the live view is unchanged unless a manager picks a team.
 */
export function TeamFilterChips({ value, onChange, className, allowedTeamIds }: TeamFilterChipsProps) {
  const { allTeams, membersByTeam } = useAgentTeams();
  if (allTeams.length === 0) return null;
  const teams = allowedTeamIds && allowedTeamIds.length > 0
    ? allTeams.filter(t => allowedTeamIds.includes(t.id))
    : allTeams;
  const showAll = !allowedTeamIds || allowedTeamIds.length >= allTeams.length;
  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
        Team
      </span>
      {showAll && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors',
            value === null
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          All
        </button>
      )}
      {teams.map((t) => {
        const c = TEAM_COLOR_CLASSES[t.color];
        const active = value === t.id;
        const members = membersByTeam.get(t.id) ?? [];
        const names = members
          .map(m => (m.first_name?.trim() || m.email.split('@')[0]))
          .filter(Boolean);
        const namesLabel = names.length > 0 ? names.join(', ') : 'No members';
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(active ? null : t.id)}
            title={`${t.name} — ${namesLabel}`}
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors',
              active ? c.pill : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
            <span>{t.name.replace(/^Formula\s+/i, '')}</span>
            {names.length > 0 && (
              <span className={cn('opacity-70 font-normal', active ? '' : 'text-muted-foreground')}>
                · {names.join(', ')}
              </span>
            )}
            {active && <X className="h-2.5 w-2.5 opacity-70" />}
          </button>
        );
      })}
    </div>
  );
}

