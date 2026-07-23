import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOvernightQueue, formatReleaseLabel } from '@/hooks/useOvernightQueue';

interface OvernightBadgeProps {
  leadId: string;
  className?: string;
}

/**
 * Row-level chip: shown when a lead is parked in the overnight queue,
 * i.e. `intake_class = 'overnight'` and `eligible_at > now()`.
 * Reads from the shared `useOvernightQueue` cache — no per-row query.
 */
export const OvernightBadge: React.FC<OvernightBadgeProps> = ({ leadId, className }) => {
  const { data } = useOvernightQueue();
  if (!data || !data.ids.has(leadId)) return null;
  const releaseAt = data.releaseByLeadId.get(leadId);
  const label = formatReleaseLabel(releaseAt);
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 border-indigo-300 bg-indigo-50 text-indigo-800 text-[10px] px-1.5 py-0.5',
        'dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200',
        className,
      )}
      title={`Deferred — this lead was created outside working hours and will auto-release at ${label}.`}
    >
      <Moon className="h-3 w-3" />
      <span>Overnight – releases {label}</span>
    </Badge>
  );
};
