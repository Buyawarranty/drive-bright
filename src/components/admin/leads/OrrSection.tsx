import React from 'react';
import { ChevronDown, FlaskConical, Rocket, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

import { WidgetErrorBoundary } from '@/components/admin/WidgetErrorBoundary';
import { OrrTeamSelectionPanel } from './OrrTeamSelectionPanel';
import { OrrGoLiveSwitch } from './OrrGoLiveSwitch';
import { RollingRoundRobinLivePanel } from './RollingRoundRobinLivePanel';
import { OpenRoundRobinTestPanel } from './OpenRoundRobinTestPanel';
import { ImportLeadToAgentPanel } from './ImportLeadToAgentPanel';
import { useOrrLiveSettings } from '@/hooks/useOrrLiveSettings';



/**
 * Open Round Robin — the single, simplified home for ORR inside Lead Allocation.
 *
 * Three parts only:
 *   1. Setup      — pick the team(s), then the go-live switch.
 *   2. Live status — the rolling first-call window panel (read-only until live).
 *   3. Sandbox    — practice lab, collapsed, clearly labelled TESTING ONLY.
 *
 * This component adds a section; it changes no existing Lead Allocation
 * behaviour, queries or settings beyond the ORR go-live switch it already owned.
 */
export const OrrSection: React.FC<{ isManagement: boolean; sandboxTab?: boolean }> = ({ isManagement, sandboxTab = false }) => {
  // Live settings, shared with the Lead Allocation page and kept in step by
  // realtime — a change there shows here (and in the sandbox) without a reload.
  const { orrLive: liveOrrLive, enabledTeamIds, teamNamesById, refresh } = useOrrLiveSettings(isManagement);
  const [orrLiveOverride, setOrrLiveOverride] = React.useState<boolean | null>(null);
  const [teamSelectionOverride, setTeamSelectionOverride] = React.useState<string[] | null>(null);
  const [sandboxOpen, setSandboxOpen] = React.useState(true);

  const orrLive = orrLiveOverride ?? liveOrrLive;
  const selectedTeamIds = teamSelectionOverride ?? enabledTeamIds;

  // Once the shared settings catch up, drop the local optimistic values.
  React.useEffect(() => {
    setOrrLiveOverride(null);
    setTeamSelectionOverride(null);
  }, [liveOrrLive, enabledTeamIds.join(',')]);

  const setOrrLive = (next: boolean | null) => {
    setOrrLiveOverride(next);
    refresh();
  };


  // Arriving via the "Open Round Robin" jump pill (or a #open-round-robin link)
  // scrolls here and opens the practice lab, so "take lead" is never hidden.
  React.useEffect(() => {
    if (!isManagement) return;
    const openIfTargeted = () => {
      if (window.location.hash !== '#open-round-robin') return;
      setSandboxOpen(true);
      requestAnimationFrame(() => {
        document.getElementById('open-round-robin')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    openIfTargeted();
    window.addEventListener('hashchange', openIfTargeted);
    return () => window.removeEventListener('hashchange', openIfTargeted);
  }, [isManagement]);

  if (!isManagement) return null;

  return (
    <div id="open-round-robin" className="space-y-4 scroll-mt-28">

      {/* Big, unmistakable section header — Open Round Robin is NOT live Round Robin. */}
      {sandboxTab ? (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50/70 p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-amber-900">
                  Sandbox
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md text-xs font-bold uppercase tracking-wide px-2.5 py-1 border',
                    orrLive === true
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-200 text-amber-900 border-amber-300',
                  )}
                >
                  {orrLive === true ? 'Live' : 'Sandbox — not live'}
                </span>
              </div>
              {orrLive !== true && (
                <ul className="text-sm text-amber-900/90 list-disc pl-4 space-y-1 mt-1">
                  <li>This is a safe rehearsal space — nothing here assigns, calls or changes any lead.</li>
                  <li>The leads shown are real, but every action is practice-only.</li>
                  <li>What you see matches the live Lead Allocation settings, so it previews what agents will experience once Open Round Robin goes live.</li>
                </ul>
              )}
            </div>
            {orrLive !== true && (
              <div className="shrink-0 rounded-lg bg-amber-100 border border-amber-300 px-3 py-2">
                <p className="text-xs font-semibold text-amber-900">TESTING ONLY</p>
                <p className="text-[10px] text-amber-900/80">No real leads move here unless this is switched live.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-violet-300 bg-gradient-to-r from-violet-50 to-background p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-violet-900">
                  Open Round Robin
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md text-xs font-bold uppercase tracking-wide px-2.5 py-1 border',
                    orrLive === true
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-muted text-muted-foreground border-border',
                  )}
                >
                  {orrLive === true ? 'Live' : 'Not live'}
                </span>
              </div>
              <ul className="text-sm text-violet-800/90 list-disc pl-4 space-y-1 mt-1">
                <li>This area is for testing only — no real leads move unless Open Round Robin is switched live.</li>
                <li>Agents take leads from the Open Pool themselves instead of being sent one.</li>
                <li>The normal Round Robin still runs; the Flow split decides how new leads are shared between the two.</li>
              </ul>
            </div>
            <div className="shrink-0 rounded-lg bg-amber-100 border border-amber-300 px-3 py-2">
              <p className="text-xs font-semibold text-amber-900">
                TESTING ONLY
              </p>
              <p className="text-[10px] text-amber-900/80">
                No real leads move here unless this is switched live.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 1. Setup ------------------------------------------------------- */}
      <div className="rounded-lg border border-border bg-card shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Open Round Robin setup</h3>
        </div>
        <OrrTeamSelectionPanel
          selectedTeamIds={selectedTeamIds}
          onChange={setTeamSelectionOverride}
          disabled={orrLive === true}
        />
        <OrrGoLiveSwitch
          live={orrLive}
          canEdit={isManagement}
          selectedTeamIds={selectedTeamIds}
          teamNamesById={teamNamesById}
          onChange={setOrrLive}
        />
      </div>

      {/* Import a lead and send it to a chosen agent ------------------- */}
      <ImportLeadToAgentPanel
        title="Import a lead and send it to an agent"
        description="Find any existing lead by reg plate, name, email or phone, pick the agent, and it goes to them through the normal lead flow. Round Robin above is untouched."
      />


      {/* 2. Live status ------------------------------------------------- */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Open Round Robin pool status</h3>
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
          {orrLive === true ? (
            <>
              <li>Live figures — running a pass here updates real CRM assignments.</li>
              <li>Only use this when you are ready to hand out leads for real.</li>
            </>
          ) : (
            <>
              <li>Read-only while Open Round Robin is not live.</li>
              <li>No real lead is handed out or pulled back.</li>
            </>
          )}
        </ul>
        <WidgetErrorBoundary label="Open Round Robin pool status">
          <RollingRoundRobinLivePanel
            canEdit={isManagement && orrLive === true}
            readOnly={orrLive !== true}
          />
        </WidgetErrorBoundary>
      </div>

      {/* 3. Sandbox ----------------------------------------------------- */}
      <div className="rounded-lg border-2 border-amber-400 bg-amber-50/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setSandboxOpen(o => !o)}
          className="w-full flex items-start gap-3 text-left px-4 py-3 hover:bg-amber-100/60 transition-colors"
        >
          <TriangleAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wide text-amber-900">
                Sandbox — testing only
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-200 text-amber-900 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                Not live
              </span>
            </div>
            <ul className="text-xs text-amber-900/90 list-disc pl-4 mt-1 space-y-0.5">
              <li>Practice only — no real leads move, no customer is called and no figures change.</li>
              <li>Every name inside is made up.</li>
            </ul>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-amber-700 shrink-0 mt-1 transition-transform',
              sandboxOpen && 'rotate-180',
            )}
          />
        </button>

        {sandboxOpen && (
          <div className="border-t-2 border-amber-400 bg-background p-4 space-y-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <FlaskConical className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Add a practice lead and watch the 2-minute first-call window.</li>
                <li>See how an unworked lead passes to the next agent.</li>
                <li>Switch the agent preview to see the page as each colleague would see it.</li>
                <li>Clear the practice run whenever you like.</li>
              </ul>
            </div>
            <WidgetErrorBoundary label="Sandbox — testing only">
              <OpenRoundRobinTestPanel />
            </WidgetErrorBoundary>

          </div>
        )}
      </div>
    </div>
  );
};

export default OrrSection;
