import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RetryCountdownBadgeProps {
  /** ISO date string of when the retry window ends (typically `lead.next_action_date`). */
  nextActionDate?: string | null;
  /** Only show if the lead's follow_up_status is 'pending' (or omit to always show when future). */
  followUpStatus?: string | null;
  /** Only render when the retry falls within this many minutes from now. Defaults to 60. */
  windowMinutes?: number;
  className?: string;
}

/**
 * Small live countdown pill shown on a lead row after the agent logs a
 * "no answer / voicemail / line busy" outcome. Reads `next_action_date`
 * from the lead and ticks down every second so the agent always knows how
 * long until the same lead is ready to be retried.
 */
export const RetryCountdownBadge: React.FC<RetryCountdownBadgeProps> = ({
  nextActionDate,
  followUpStatus,
  windowMinutes = 60,
  className,
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!nextActionDate) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [nextActionDate]);

  if (!nextActionDate) return null;
  if (followUpStatus && followUpStatus !== 'pending') return null;

  const target = new Date(nextActionDate).getTime();
  if (Number.isNaN(target)) return null;

  const diffMs = target - now;
  const diffMin = diffMs / 60000;
  // Only display for near-term retries so we don't clutter rows with days-out follow-ups.
  if (diffMin > windowMinutes) return null;
  if (diffMs <= 0) return null;

  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, '0');
  const warn = totalSec <= 60;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        warn
          ? 'border-amber-400 bg-amber-50 text-amber-900 animate-pulse'
          : 'border-amber-300 bg-amber-50 text-amber-800',
        className,
      )}
      title="Time until this lead is ready to retry"
    >
      <Clock className="h-3 w-3" />
      Retry in {mm}:{ss}
    </span>
  );
};
