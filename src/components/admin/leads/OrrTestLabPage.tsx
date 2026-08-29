import React from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { QueueCapacityDashboard } from './QueueCapacityDashboard';
import { OpenPoolActivityMonitor } from './OpenPoolActivityMonitor';
import { OpenPoolManagerAlerts } from './OpenPoolManagerAlerts';
import { OrrGoLiveSwitch } from './OrrGoLiveSwitch';
import { OrrTeamSelectionPanel } from './OrrTeamSelectionPanel';
import { OpenRoundRobinTestPanel } from './OpenRoundRobinTestPanel';
import { RollingRoundRobinLivePanel } from './RollingRoundRobinLivePanel';
import { OrrGlanceStrip } from './OrrGlanceStrip';
import { OrrAgentRotationPanel } from './OrrAgentRotationPanel';
import { OrrQueuePanels } from './OrrQueuePanels';
import { OrrMorningReleasePanel } from './OrrMorningReleasePanel';
import { OrrPerformancePanel } from './OrrPerformancePanel';
import { OrrLeadFreezePanel } from './OrrLeadFreezePanel';
import { WidgetErrorBoundary } from '@/components/admin/WidgetErrorBoundary';
import { useViewAs } from '@/contexts/ViewAsContext';

const JUMP_LINKS = [
  { id: 'orr-practice', label: 'Practice lab', className: 'bg-primary/20 text-primary border-primary/20 hover:bg-primary/30' },
  { id: 'orr-queue-capacity', label: 'Queue & capacity', className: 'bg-violet-300/50 text-violet-900 border-violet-200/50 hover:bg-violet-400/50' },
  { id: 'orr-live-distribution', label: 'Live distribution', className: 'bg-teal-300/50 text-teal-900 border-teal-200/50 hover:bg-teal-400/50' },
  { id: 'orr-activity', label: 'Activity & alerts', className: 'bg-amber-200/50 text-amber-900 border-amber-100/50 hover:bg-amber-300/50' },
];

interface OrrTestLabPageProps {
  onNavigateToTab?: (tab: string) => void;
}

/**
 * ORR Test Lab — full-page dummy dry-run environment.
 * Same UI layout as the New Leads page, but all data is browser-memory only.
 * It does not create Supabase rows, run RPCs, or touch real lead flow.
 */
export const OrrTestLabPage: React.FC<OrrTestLabPageProps> = ({ onNavigateToTab }) => {
  const { effectiveRole } = useViewAs();
  const [orrLive, setOrrLive] = React.useState<boolean | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
  const [teamNamesById, setTeamNamesById] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: settings }, { data: teams }] = await Promise.all([
        supabase.from('lead_distribution_settings').select('team_id, open_round_robin_enabled'),
        supabase.from('lead_teams').select('id, name'),
      ]);
      if (cancelled) return;
      const enabledTeamIds = (settings || [])
        .filter(r => r.open_round_robin_enabled === true && r.team_id)
        .map(r => r.team_id as string);
      setOrrLive(enabledTeamIds.length > 0);
      setSelectedTeamIds(enabledTeamIds);
      setTeamNamesById(Object.fromEntries(((teams as { id: string; name: string }[]) || []).map(t => [t.id, t.name])));
    })();
    return () => { cancelled = true; };
  }, []);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  const isManagement =
    effectiveRole === 'super_admin' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'sales_manager' ||
    effectiveRole === 'performance_manager';

  if (!isManagement) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The ORR Test Lab is restricted to managers and admins.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">ORR Test Lab</h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                Practice mode
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500 text-emerald-700 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                Nothing counts
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              A calm space to get comfortable with Open Round Robin. Add a practice lead, watch the 120-second window,
              pass it on, and see how it moves between agents. Every name here is made up — no customer is called, no
              agent is notified, and nobody's figures change.
            </p>
          </div>
        </div>


        {onNavigateToTab && (
          <button
            type="button"
            onClick={() => onNavigateToTab('lead-teams')}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lead Allocation
          </button>
        )}
      </div>

      <OrrGoLiveSwitch live={orrLive} canEdit={isManagement} onChange={setOrrLive} />

      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-semibold text-foreground shrink-0">Jump to:</span>
          {JUMP_LINKS.map(link => (
            <button
              key={link.id}
              type="button"
              onClick={() => jumpTo(link.id)}
              className={cn(
                'shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border hover:shadow-md transition-colors',
                link.className,
              )}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>

      <div id="orr-practice" />

      <WidgetErrorBoundary label="At a glance">
        <OrrGlanceStrip teamLabel="Open Round Robin" />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary label="Agent availability & rotation">
        <OrrAgentRotationPanel />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary label="Morning lead release">
        <OrrMorningReleasePanel />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary label="Lead queues">
        <OrrQueuePanels />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary label="Today's performance & alerts">
        <OrrPerformancePanel />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary label="Auto block & unblock leads">
        <OrrLeadFreezePanel />
      </WidgetErrorBoundary>


      <OpenRoundRobinTestPanel />


      <div id="orr-queue-capacity" className="space-y-4">
        <div className="border-l-4 border-primary/60 pl-3">
          <h2 className="text-lg font-semibold text-foreground">Open Round Robin — Queue &amp; Capacity</h2>
          <p className="text-xs text-muted-foreground">
            Live view of every Open Round Robin agent (all teams) — queues, capacity, warnings, and agent activity audit.
          </p>
        </div>
        <WidgetErrorBoundary label="Queue & capacity">
          <QueueCapacityDashboard />
        </WidgetErrorBoundary>
      </div>

      <div id="orr-live-distribution" className="space-y-4">
        <div className="border-l-4 border-teal-500/60 pl-3">
          <h2 className="text-lg font-semibold text-foreground">Live lead distribution</h2>
          <p className="text-xs text-muted-foreground">
            {orrLive === true
              ? 'Running a pass here updates real CRM assignments.'
              : 'Read-only while Open Round Robin is in practice mode — no real lead is handed out or pulled back.'}
          </p>
        </div>
        <WidgetErrorBoundary label="Live lead distribution">
          <RollingRoundRobinLivePanel canEdit={isManagement && orrLive === true} readOnly={orrLive !== true} />
        </WidgetErrorBoundary>
      </div>

      <div id="orr-activity" className="space-y-4">
        <div className="border-l-4 border-amber-500/60 pl-3">
          <h2 className="text-lg font-semibold text-foreground">Activity &amp; manager alerts</h2>
          <p className="text-xs text-muted-foreground">
            Live audit activity, missed windows and routing warnings requiring attention.
          </p>
        </div>
        <WidgetErrorBoundary label="Activity monitor">
          <OpenPoolActivityMonitor />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary label="Manager alerts">
          <OpenPoolManagerAlerts />
        </WidgetErrorBoundary>
      </div>

      <div className="rounded-md border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
        <div><strong className="text-foreground">How to use:</strong></div>
        <ol className="list-decimal ml-5 space-y-0.5">
          <li>Click <em>Add practice lead</em> — a made-up Team Blue lead appears with a 2-minute window.</li>
          <li>Click <em>Skip window</em> on a row to fast-forward the countdown.</li>
          <li>Click <em>Pass on now</em> — the lead moves to the next agent in the rotation.</li>
          <li>Use <em>Agent preview</em> to see what each colleague would see.</li>
          <li>Click <em>Clear practice leads</em> whenever you like. Nothing here touches real leads, scoreboards, targets, reports or live agents.</li>
        </ol>
      </div>

    </div>
  );
};

export default OrrTestLabPage;
