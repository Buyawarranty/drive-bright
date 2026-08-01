import React, { useEffect, useRef, useState } from 'react';
import { Flame, Phone, X, ChevronRight } from 'lucide-react';
import { useNewLeadAlert, formatElapsed, playNewLeadBeep } from '@/hooks/useNewLeadAlert';
import { MuteAlertsMenu } from '@/components/admin/MuteAlertsMenu';
import { dialWithZoiper } from '@/utils/zoiperDial';
import { isAgentOnCall, subscribeAgentOnCall } from '@/lib/agentCallState';
import { useAdminSidebarCollapsed } from '@/hooks/useAdminSidebarCollapsed';

const formatUKPhoneShort = (p: string) => {
  const d = p.replace(/[^\d+]/g, '');
  if (d.startsWith('+44')) return '0' + d.slice(3);
  return d;
};

interface Props {
  /** Jump to the New Leads tab (optionally focused on a lead). */
  onGo: (leadId: string) => void;
}

/**
 * Always-visible full-width banner for un-actioned leads assigned to the
 * current agent. Agents were missing the small floating pop-up stack (and
 * keeping a second tab open to watch for leads), so this bar sits at the very
 * top of every admin tab, stays until dismissed, beeps every 10s and carries
 * the shared mute control.
 *
 * The beep for new leads lives here (single source) so it can't double-chime
 * with the floating stack.
 */
export const NewLeadTopBanner: React.FC<Props> = ({ onGo }) => {
  const { queue, dismissLead } = useNewLeadAlert();
  const [onCall, setOnCall] = useState(() => isAgentOnCall());
  const lastCountRef = useRef(0);
  const { collapsed: sidebarCollapsed } = useAdminSidebarCollapsed();

  useEffect(() => subscribeAgentOnCall(() => setOnCall(isAgentOnCall())), []);

  // Beep on arrival + every 10s while any lead is waiting. Silenced while the
  // agent is on a live call, and by the global mute (handled inside the beep).
  useEffect(() => {
    if (queue.length === 0) {
      lastCountRef.current = 0;
      return;
    }
    if (onCall) {
      lastCountRef.current = queue.length;
      return;
    }
    if (queue.length > lastCountRef.current) playNewLeadBeep();
    lastCountRef.current = queue.length;
    const t = setInterval(() => playNewLeadBeep(), 10000);
    return () => clearInterval(t);
  }, [queue, onCall]);

  if (queue.length === 0) return null;

  const lead = queue[0];
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'New lead';
  const elapsed = formatElapsed(Date.now() - new Date(lead.created_at).getTime());

  return (
    <div
      className={`sticky top-0 z-[95] ${
        sidebarCollapsed ? 'lg:ml-14' : 'lg:ml-64'
      } bg-emerald-600 text-white shadow-md rounded-md transition-[margin] duration-300`}
    >
      <div className="flex items-center gap-3 px-4 py-2 flex-wrap">

        <Flame className="w-4 h-4 shrink-0 animate-pulse" />
        <span className="text-sm font-semibold">
          {queue.length === 1 ? 'New lead waiting' : `${queue.length} new leads waiting`}
        </span>
        <span className="text-sm font-medium truncate max-w-[220px]">{name}</span>
        {lead.vehicle_reg && (
          <span className="text-xs font-mono bg-white/15 rounded px-1.5 py-0.5">{lead.vehicle_reg}</span>
        )}
        <span className="text-xs bg-white/15 rounded px-1.5 py-0.5" title="Time since the lead came in">
          {elapsed}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {lead.phone && (
            <button
              type="button"
              onClick={() => dialWithZoiper(lead.phone!, { leadId: lead.id })}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-white text-emerald-700 hover:bg-emerald-50 rounded-full px-3 py-1"
            >
              <Phone className="w-3.5 h-3.5" />
              Call {formatUKPhoneShort(lead.phone)}
            </button>
          )}
          <button
            type="button"
            onClick={() => onGo(lead.id)}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-full px-3 py-1"
          >
            Open lead
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <MuteAlertsMenu className="text-white hover:bg-white/20 rounded-full p-1.5" size={16} />
          <button
            type="button"
            onClick={() => dismissLead(lead.id)}
            title="Dismiss this lead alert"
            className="hover:bg-white/20 rounded-full p-1.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
