import React, { useEffect, useState } from 'react';
import { Flame, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNewLeadAlert, formatElapsed } from '@/hooks/useNewLeadAlert';

/**
 * Renders two things when the current agent has an unactioned newest lead:
 *  - A permanent dark navy banner pinned to the top of the viewport with a live clock
 *  - A floating bottom-right popup (dismissible per lead) that appears once the user scrolls
 *
 * "Actioned" = the agent adds a note or logs a call on that lead.
 */
export const NewLeadAlerts: React.FC = () => {
  const { lead, elapsedMs, dismissPopup, popupDismissed } = useNewLeadAlert();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!lead) return null;

  const firstName = (lead.first_name || 'AGENT').trim().toUpperCase();
  const clock = formatElapsed(elapsedMs);
  const urgent = elapsedMs > 5 * 60 * 1000; // > 5min = amber accent

  const openLead = () => {
    navigate(`/admin-dashboard/?tab=new-leads&leadId=${lead.id}`);
  };

  return (
    <>
      {/* Permanent top banner — dark navy, cannot be dismissed */}
      <button
        onClick={openLead}
        className="fixed top-0 left-0 right-0 z-[95] w-full bg-[#0F1B34] hover:bg-[#152238] text-white shadow-lg border-b-2 border-orange-500 transition-colors"
        aria-label={`Open new lead ${firstName}`}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2.5">
          <Flame className={`w-5 h-5 flex-shrink-0 ${urgent ? 'text-red-400 animate-pulse' : 'text-orange-400'}`} />
          <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-left">
            <span className="font-extrabold text-base sm:text-lg tracking-wide text-orange-300">
              🔥 {firstName}
            </span>
            <span className="text-sm sm:text-base font-medium">
              — new lead just landed! Call now before it goes cold.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline text-xs uppercase tracking-wider text-white/60">Waiting</span>
            <span
              className={`font-mono font-bold text-base sm:text-lg px-2.5 py-1 rounded ${
                urgent ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
              }`}
            >
              ⏱ {clock}
            </span>
            <ArrowRight className="w-4 h-4 hidden sm:block" />
          </div>
        </div>
      </button>

      {/* Floating popup — appears on scroll, dismissible per lead */}
      {scrolled && !popupDismissed && (
        <div className="fixed bottom-6 right-6 z-[96] w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border-2 border-orange-500 bg-white shadow-2xl animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#0F1B34] text-white rounded-t-xl">
            <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
            <span className="font-semibold text-sm uppercase tracking-wide">Fresh lead</span>
            <button
              onClick={(e) => { e.stopPropagation(); dismissPopup(); }}
              className="ml-auto p-1 hover:bg-white/20 rounded"
              aria-label="Dismiss popup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={openLead}
            className="w-full text-left p-4 space-y-2 hover:bg-orange-50 transition-colors rounded-b-xl"
          >
            <div className="text-xl font-extrabold text-slate-900 tracking-wide">
              🚨 {firstName}, this one's yours!
            </div>
            <div className="text-sm text-slate-600">
              New lead waiting — strike while it's hot 🔥
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs uppercase tracking-wider text-slate-500">Waiting</span>
              <span
                className={`font-mono font-bold text-base px-2.5 py-1 rounded ${
                  urgent ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                }`}
              >
                ⏱ {clock}
              </span>
            </div>
          </button>
        </div>
      )}
    </>
  );
};
