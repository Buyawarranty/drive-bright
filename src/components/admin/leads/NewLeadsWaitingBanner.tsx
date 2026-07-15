import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ArrowRight, X } from 'lucide-react';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useAgentTeams } from '@/hooks/useAgentTeams';
import { useSharkTankCounts, useSharkTankSettings } from '@/hooks/useSharkTank';
import { isAlertsMuted } from '@/lib/alertSoundPreference';

interface Props {
  activeTab: string;
  onGo: () => void;
}

/**
 * Sticky yellow banner shown to agents who work multiple workstreams
 * (New Leads + Recontact and/or Renewals). When they're on a non–New Leads
 * tab and unclaimed leads pile up in the Open Pool, this banner nudges
 * them to switch over. Dismissible; re-appears when the count grows again.
 */
export function NewLeadsWaitingBanner({ activeTab, onGo }: Props) {
  const adminId = useCurrentAdminId();
  const { workstreamsByAgent } = useAgentTeams();
  const { settings } = useSharkTankSettings();
  const counts = useSharkTankCounts();
  const [dismissedAt, setDismissedAt] = useState<number>(0);
  const beepedForRef = useRef<number>(0);

  const ws = adminId ? workstreamsByAgent.get(adminId) : undefined;
  const eligible = useMemo(
    () => !!ws && ws.new_leads && (ws.recontact || ws.renewals),
    [ws]
  );

  const available = counts.queued;
  const onNewLeadsTab = activeTab === 'new-leads';
  const enabled = settings.enabled === true;

  // Soft beep on first arrival (best-effort, respects autoplay policy).
  useEffect(() => {
    if (!eligible || !enabled || onNewLeadsTab) return;
    if (available > beepedForRef.current && available > dismissedAt) {
      beepedForRef.current = available;
      if (!isAlertsMuted()) {
        try {
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AC) {
            const ctx = new AC();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = 880;
            g.gain.value = 0.05;
            o.connect(g); g.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.16);
            setTimeout(() => ctx.close().catch(() => {}), 400);
          }
        } catch {}
      }
    }
  }, [available, dismissedAt, eligible, enabled, onNewLeadsTab]);

  if (!eligible || !enabled || onNewLeadsTab) return null;
  if (available <= 0) return null;
  // Hidden until the count grows past the last dismissed value.
  if (available <= dismissedAt) return null;

  return (
    <div className="bg-amber-400 text-amber-950 border-b border-amber-500 shadow-sm z-40">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bell className="h-4 w-4 shrink-0 animate-pulse" />
          <span className="text-sm font-semibold">
            🔔 {available} new {available === 1 ? 'lead' : 'leads'} in New Leads
          </span>
          <span className="text-sm text-amber-900/80 hidden sm:inline">
            — waiting in the Open Pool
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onGo}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors"
          >
            Go to New Leads
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDismissedAt(available)}
            aria-label="Dismiss"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-amber-950 hover:bg-amber-500/40 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
