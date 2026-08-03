import React from 'react';
import { format } from 'date-fns';
import {
  LeadResponseTime,
  formatResponseTime,
  getResponseSourceLabel,
  responseTone,
} from '@/hooks/useLeadResponseTime';

interface Props {
  response?: LeadResponseTime;
}

/**
 * "Time to contact" — gap between the lead arriving and the agent's first
 * action on it (call logged, note written, status changed). Target is 120s.
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

  return (
    <div className="flex flex-col leading-tight">
      <span
        className={`text-xs font-semibold ${responseTone(response.seconds)}`}
        title={`${label} at ${format(new Date(response.firstActionAt), 'MMM d, yyyy HH:mm')} — ${
          withinTarget ? 'within the 120s target' : 'outside the 120s target'
        }`}
      >
        {formatResponseTime(response.seconds)}
      </span>
      <span className="text-[10px] text-muted-foreground/80 truncate max-w-[130px]" title={label}>
        {label}
      </span>
    </div>
  );
};

export default TimeToContactCell;
