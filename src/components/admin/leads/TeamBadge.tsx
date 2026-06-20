import { useAgentTeams, TEAM_COLOR_CLASSES } from '@/hooks/useAgentTeams';
import { cn } from '@/lib/utils';

interface TeamBadgeProps {
  userId: string | null | undefined;
  variant?: 'dot' | 'pill';
  className?: string;
}

/**
 * Tiny visual marker showing which lead-team an agent belongs to.
 * Renders nothing when the agent is not on any team — keeps existing
 * layouts untouched for the live agent pool.
 */
export function TeamBadge({ userId, variant = 'dot', className }: TeamBadgeProps) {
  const { byAgent } = useAgentTeams();
  if (!userId) return null;
  const team = byAgent.get(userId);
  if (!team) return null;
  const c = TEAM_COLOR_CLASSES[team.color];

  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-semibold',
          c.pill,
          className,
        )}
        title={`Team: ${team.name}`}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
        {team.name.replace(/^Formula\s+/i, '')}
      </span>
    );
  }
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full opacity-50', c.dot, className)}
      title={`Team: ${team.name}`}
      aria-label={`Team ${team.name}`}
    />
  );
}
