import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface TeamFilterChipsProps {
  value: string | null;
  onChange: (teamId: string | null) => void;
  className?: string;
}

/**
 * Compact chip row that filters the leads list by the assigned agent's team.
 * Defaults to "All" so the live view is unchanged unless a manager picks a team.
 */
export function TeamFilterChips({ value, onChange, className }: TeamFilterChipsProps) {
  const { allTeams } = useAgentTeams();
  if (allTeams.length === 0) return null;
  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
        Team
      </span>
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
      {allTeams.map((t) => {
        const c = TEAM_COLOR_CLASSES[t.color];
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(active ? null : t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors',
              active ? c.pill : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
            {t.name.replace(/^Formula\s+/i, '')}
            {active && <X className="h-2.5 w-2.5 opacity-70" />}
          </button>
        );
      })}
    </div>
  );
}
