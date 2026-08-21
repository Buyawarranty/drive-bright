import React from 'react';
import { Flame, Phone, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useNewLeadAlert, formatElapsed } from '@/hooks/useNewLeadAlert';
import { MuteAlertsMenu } from '@/components/admin/MuteAlertsMenu';
import { dialWithZoiper } from '@/utils/zoiperDial';

interface Props {
  /** Jump to the New Leads tab focused on this lead. */
  onGo: (leadId: string, focus?: string) => void;
}

const formatUKPhoneShort = (p: string) => {
  const d = p.replace(/[^\d+]/g, '');
  return d.startsWith('+44') ? '0' + d.slice(3) : d;
};

/**
 * Permanently docked stack of un-actioned new leads.
 *
 * Agents kept missing leads because the in-flow banner scrolled out of view on
 * long tabs. This dock is `position: fixed` in the bottom-left corner (in line
 * with the fixed admin sidebar), so it never moves however far the page is
 * scrolled. Every lead is listed, newest first, and each row is clickable —
 * it opens that lead in New Leads.
 */
export const NewLeadDock: React.FC<Props> = ({ onGo }) => {
  const { queue, dismissLead } = useNewLeadAlert();
  const [collapsed, setCollapsed] = React.useState(false);
  const [, tick] = React.useState(0);

  React.useEffect(() => {
    if (queue.length === 0) return;
    const t = window.setInterval(() => {
      if (!document.hidden) tick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [queue.length]);

  if (queue.length === 0) return null;

  return (
    <div className="fixed bottom-3 left-3 z-[120] w-[268px] max-w-[calc(100vw-1.5rem)]">
      <div className="rounded-lg border-2 border-emerald-500 bg-[#0F1B34] text-white shadow-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Flame className="h-4 w-4 shrink-0 animate-pulse text-emerald-300" />
          <span className="text-xs font-semibold truncate">
            {queue.length === 1 ? '1 new lead' : `${queue.length} new leads`} waiting
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <MuteAlertsMenu className="text-white hover:bg-white/20 rounded p-1" size={14} />
            <button
              type="button"
              aria-label={collapsed ? 'Show new leads' : 'Hide new leads'}
              onClick={() => setCollapsed((c) => !c)}
              className="rounded p-1 hover:bg-white/20"
            >
              {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="max-h-[46vh] overflow-y-auto divide-y divide-white/10 border-t border-white/10">
            {queue.map((lead) => {
              const name =
                [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'New lead';
              const elapsed = formatElapsed(Date.now() - new Date(lead.created_at).getTime());
              return (
                <div key={lead.id} className="px-2.5 py-2 hover:bg-white/10 transition-colors">
                  <button
                    type="button"
                    onClick={() => onGo(lead.id, lead.vehicle_reg || lead.phone || name)}
                    className="w-full text-left"
                    title="Open this lead in New Leads"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">{name}</span>
                      {lead.vehicle_reg && (
                        <span className="rounded bg-white/15 px-1 py-0.5 font-mono text-[10px]">
                          {lead.vehicle_reg}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/70">waiting {elapsed}</div>
                  </button>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {lead.phone && (
                      <button
                        type="button"
                        onClick={() => dialWithZoiper(lead.phone!, { leadId: lead.id })}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-400"
                      >
                        <Phone className="h-3 w-3" />
                        {formatUKPhoneShort(lead.phone)}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onGo(lead.id, lead.vehicle_reg || lead.phone || name)}
                      className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold hover:bg-white/25"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss this lead alert"
                      onClick={() => dismissLead(lead.id)}
                      className="ml-auto rounded p-1 hover:bg-white/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewLeadDock;
