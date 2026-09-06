import React from 'react';
import { format } from 'date-fns';
import {
  CLOCK_START_LABEL,
  LeadResponseTime,
  formatResponseTime,
  getResponseSourceLabel,
  responseTone,
} from '@/hooks/useLeadResponseTime';

interface Props {
  response?: LeadResponseTime;
}

/**
 * "Time to contact" — gap between the agent's first chance to act on the lead
 * (handed to them, or 09:00 if it arrived out of hours) and their first action
 * on it (call logged, note written, status changed). Target is 120s.
 */
export const TimeToContactCell: React.FC<Props> = ({ response }) => {
  if (!response) {
    return (
      <span
        className="text-xs text-muted-foreground italic"
        title="No agent action recorded yet — the response clock is still running"
      >
        Not contacted
      </span>
    );
  }

  const label = getResponseSourceLabel(response.source);
  const withinTarget = response.seconds <= 120;
  const startedLabel = CLOCK_START_LABEL[response.clockStart];

  return (
    <div className="flex flex-col leading-tight">
      <span
        className={`text-xs font-semibold ${responseTone(response.seconds)}`}
        title={[
          `${label} at ${format(new Date(response.firstActionAt), 'MMM d, yyyy HH:mm')}`,
          `Clock started ${format(new Date(response.clockStartedAt), 'MMM d, yyyy HH:mm')} — ${startedLabel}`,
          withinTarget ? 'Within the 120s target' : 'Outside the 120s target',
        ].join('\n')}
      >
        {formatResponseTime(response.seconds)}
      </span>
      <span
        className="text-[10px] text-muted-foreground/80 truncate max-w-[130px]"
        title={`${label} · clock started ${startedLabel}`}
      >
        {label}
        {response.clockStart !== 'arrival' ? ' · from handover' : ''}
      </span>
    </div>
  );
};

export default TimeToContactCell;
