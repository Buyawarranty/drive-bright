import React from 'react';
import { Moon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOvernightQueue, formatReleaseLabel } from '@/hooks/useOvernightQueue';

interface OvernightQueueBannerProps {
  className?: string;
  /** Compact single-line variant (for headers). Default is the full card. */
  compact?: boolean;
}

/**
 * Manager-facing summary of the overnight ORR backlog. Renders nothing when
 * the queue is empty so it never adds noise on quiet days.
 */
export const OvernightQueueBanner: React.FC<OvernightQueueBannerProps> = ({
  className,
  compact = false,
}) => {
  const { data } = useOvernightQueue();
  const count = data?.count ?? 0;
  if (count === 0) return null;
  const label = formatReleaseLabel(data?.nextReleaseAt);

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800',
          'dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
          className,
        )}
      >
        <Moon className="h-3.5 w-3.5" />
        <span>
          {count} {count === 1 ? 'lead' : 'leads'} queued for {label} release
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border-2 border-indigo-200 bg-indigo-50/70 p-3',
        'dark:border-indigo-800 dark:bg-indigo-950/50',
        className,
      )}
      role="status"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
        <Moon className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
            {count} {count === 1 ? 'lead' : 'leads'} queued for {label} release
          </span>
        </div>
        <p className="mt-0.5 text-xs text-indigo-800/80 dark:text-indigo-200/80">
          These enquiries arrived outside working hours (or on a closed weekend/bank holiday). Open Round Robin will auto-distribute them at the next business open — the 2-minute claim timer starts then, not now.
        </p>
      </div>
      <div className="flex items-center gap-1 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
        <Clock className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
    </div>
  );
};
