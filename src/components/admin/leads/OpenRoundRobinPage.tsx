import React from 'react';
import { ArrowLeft, Repeat, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { QueueCapacityDashboard } from './QueueCapacityDashboard';
import { OpenPoolActivityMonitor } from './OpenPoolActivityMonitor';
import { OpenPoolManagerAlerts } from './OpenPoolManagerAlerts';
import { RollingRoundRobinLivePanel } from './RollingRoundRobinLivePanel';
import { useViewAs } from '@/contexts/ViewAsContext';


interface OpenRoundRobinPageProps {
  onNavigateToTab?: (tab: string) => void;
}

const JUMP_LINKS = [
  { id: 'orr-queue-capacity', label: 'Queue & capacity', className: 'bg-violet-300/50 text-violet-900 border-violet-200/50 hover:bg-violet-400/50' },
  { id: 'orr-live-distribution', label: 'Live distribution', className: 'bg-teal-300/50 text-teal-900 border-teal-200/50 hover:bg-teal-400/50' },
  { id: 'orr-activity', label: 'Activity & alerts', className: 'bg-amber-200/50 text-amber-900 border-amber-100/50 hover:bg-amber-300/50' },
];

/**
 * Open Round Robin — dedicated management section.
 * Holds the live queue, distribution controls, capacity and activity views.
 * Dummy simulations remain isolated in the separate ORR Test Lab.
 */
export const OpenRoundRobinPage: React.FC<OpenRoundRobinPageProps> = ({ onNavigateToTab }) => {
  const { effectiveRole } = useViewAs();
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
          Open Round Robin management is restricted to managers and admins.
        </p>
      </div>
    );
  }

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Repeat className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Open Round Robin</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Live queues, fair distribution, capacity, agent activity and manager alerts across all teams.
            </p>
          </div>
        </div>

        {onNavigateToTab && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateToTab('lead-teams')}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Lead Allocation
            </button>
            <button
              type="button"
              onClick={() => onNavigateToTab('orr-test-lab')}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              ORR Test Lab
            </button>
          </div>
        )}
      </div>

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

      <div id="orr-queue-capacity" className="space-y-4">
        <div className="border-l-4 border-primary/60 pl-3">
          <h2 className="text-lg font-semibold text-foreground">Open Round Robin — Queue &amp; Capacity</h2>
          <p className="text-xs text-muted-foreground">
            Live view of every Open Round Robin agent (all teams) — queues, capacity, warnings, and agent activity audit.
          </p>
        </div>
        <QueueCapacityDashboard />
      </div>

      <div id="orr-live-distribution" className="space-y-4">
        <div className="border-l-4 border-teal-500/60 pl-3">
          <h2 className="text-lg font-semibold text-foreground">Live lead distribution</h2>
          <p className="text-xs text-muted-foreground">
            Run the real rolling distribution for waiting customer leads. Actions here update live CRM assignments.
          </p>
        </div>
        <RollingRoundRobinLivePanel canEdit={isManagement} />
      </div>

      <div id="orr-activity" className="space-y-4">
        <div className="border-l-4 border-amber-500/60 pl-3">
          <h2 className="text-lg font-semibold text-foreground">Activity &amp; manager alerts</h2>
          <p className="text-xs text-muted-foreground">
            Live audit activity, missed windows and routing warnings requiring attention.
          </p>
        </div>
        <OpenPoolActivityMonitor />
        <OpenPoolManagerAlerts />
      </div>
    </div>
  );
};

export default OpenRoundRobinPage;
