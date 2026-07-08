import React, { useEffect, useState } from 'react';
import { Flame, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNewLeadAlert, formatElapsed } from '@/hooks/useNewLeadAlert';

const DISMISS_KEY = 'new-lead-alert-dismissed';

const readDismissed = (): string[] => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Top banner + floating popup for the current agent's freshest unactioned lead.
 * - Only shows to the agent the lead is assigned to (scoped in useNewLeadAlert).
 * - Auto-hides after 24h (enforced in the hook).
 * - Both banner and popup have an X so an agent can silence a specific lead
 *   without having to log a note/call just to clear the UI.
 */
export const NewLeadAlerts: React.FC = () => {
  const { lead, elapsedMs, dismissPopup, popupDismissed } = useNewLeadAlert();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>(readDismissed);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!lead) return null;
  if (dismissedIds.includes(lead.id)) return null;

  const firstName = (lead.first_name || 'AGENT').trim().toUpperCase();
  const clock = formatElapsed(elapsedMs);
  const urgent = elapsedMs > 5 * 60 * 1000;

  const openLead = () => {
    navigate(`/admin-dashboard/?tab=new-leads&leadId=${lead.id}`);
  };

  const dismissBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = Array.from(new Set([...dismissedIds, lead.id])).slice(-50);
    setDismissedIds(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch {}
  };

  return (
    <>
      {/* Permanent top banner */}
      <div
        className="fixed top-0 left-0 right-0 z-[95] w-full bg-[#0F1B34] text-white shadow-lg border-b-2 border-orange-500"
        role="alert"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2.5">
          <button
            onClick={openLead}
            aria-label={`Open new lead ${firstName}`}
            className="flex-1 flex items-center gap-3 text-left hover:opacity-90 transition-opacity"
          >
            <Flame className={`w-5 h-5 flex-shrink-0 ${urgent ? 'text-red-400 animate-pulse' : 'text-orange-400'}`} />
            <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
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
          </button>
          <button
            onClick={dismissBanner}
            aria-label="Dismiss new lead banner"
            className="flex-shrink-0 p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Dismiss for this lead"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating popup on scroll */}
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
