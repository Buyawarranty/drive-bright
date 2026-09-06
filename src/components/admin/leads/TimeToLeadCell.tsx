import React, { useEffect, useMemo, useState } from 'react';
import { Lead } from '@/hooks/useLeads';
import { format } from 'date-fns';

interface Props {
  lead: Lead;
}

function formatElapsed(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * "Time to Lead" — how long the lead has been waiting since it arrived or was
 * handed to the current agent. Counts up live so agents see queue urgency at
 * a glance.
 */
export const TimeToLeadCell: React.FC<Props> = ({ lead }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const { startAt, startLabel, subLabel } = useMemo(() => {
    const assigned = lead.assigned_at ? new Date(lead.assigned_at).getTime() : 0;
    const created = lead.created_at ? new Date(lead.created_at).getTime() : 0;
    const handed = assigned > created;
    return {
      startAt: handed ? assigned : created,
      startLabel: handed ? 'handed to agent' : 'lead arrived',
      subLabel: handed ? 'with agent' : 'in queue',
    };
  }, [lead.assigned_at, lead.created_at]);

  const seconds = useMemo(
    () => Math.max(0, Math.floor((now - startAt) / 1000)),
    [now, startAt]
  );

  return (
    <div className="flex flex-col leading-tight">
      <span
        className="text-xs font-semibold text-foreground"
        title={`${startLabel} at ${format(new Date(startAt), 'MMM d, yyyy HH:mm')}`}
      >
        {formatElapsed(seconds)}
      </span>
      <span className="text-[10px] text-muted-foreground/80 truncate max-w-[130px]">
        {subLabel}
      </span>
    </div>
  );
};

export default TimeToLeadCell;
