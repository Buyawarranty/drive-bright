import React from 'react';
import { MessageSquare, Clock } from 'lucide-react';
import { isTeamOpenNow, nextOpeningLabel, openingHoursLabel } from '@/lib/aiSandbox/openingHours';
import { useSandboxHandoverAlert } from '@/hooks/useSandboxHandoverAlert';

/**
 * Full-width bar across the top of the CRM telling every member of staff
 * (management, sales and claims alike) that website live chat is open right
 * now, and how many customers are waiting for a human specialist.
 */
export const LiveChatHoursBanner: React.FC = () => {
  // This banner only displays the queue count; it must never create audio.
  const { waiting } = useSandboxHandoverAlert({ audioEnabled: false });
  const [open, setOpen] = React.useState(() => isTeamOpenNow());

  React.useEffect(() => {
    const t = window.setInterval(() => setOpen(isTeamOpenNow()), 60000);
    return () => window.clearInterval(t);
  }, []);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/60 px-4 py-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Live chat is closed — specialists are back {nextOpeningLabel()}.</span>
        <span className="text-muted-foreground/70">Hours: {openingHoursLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b-2 border-emerald-500 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-900">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
      </span>
      <MessageSquare className="h-3.5 w-3.5" />
      <span>Live chat now — customers can ask to speak to a real person ({openingHoursLabel}).</span>
      {waiting.length > 0 && (
        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
          {waiting.length} waiting for a specialist
        </span>
      )}
    </div>
  );
};

export default LiveChatHoursBanner;
