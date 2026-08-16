import React from 'react';
import { ArrowLeft, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueueCapacityDashboard } from './QueueCapacityDashboard';
import { OpenPoolActivityMonitor } from './OpenPoolActivityMonitor';
import { OpenPoolManagerAlerts } from './OpenPoolManagerAlerts';
import { OpenRoundRobinTestPanel } from './OpenRoundRobinTestPanel';
import MorningQueuePracticePanel from './MorningQueuePracticePanel';
import { useViewAs } from '@/contexts/ViewAsContext';

interface OpenRoundRobinPageProps {
  onNavigateToTab?: (tab: string) => void;
}

const JUMP_LINKS = [
  { id: 'orr-queue-capacity', label: 'Queue & capacity', className: 'bg-violet-300/50 text-violet-900 border-violet-200/50 hover:bg-violet-400/50' },
  { id: 'orr-practice-blue', label: 'Practice — Team Blue', className: 'bg-sky-300/50 text-sky-900 border-sky-200/50 hover:bg-sky-400/50' },
  { id: 'orr-practice-red', label: 'Practice — Team Red', className: 'bg-rose-300/50 text-rose-900 border-rose-200/50 hover:bg-rose-400/50' },
  { id: 'orr-morning-leads', label: 'Morning leads', className: 'bg-amber-200/50 text-amber-900 border-amber-100/50 hover:bg-amber-300/50' },
];

/**
 * Open Round Robin — dedicated management section.
 * Holds the live queue/capacity view plus the practice panels that used to
 * live inside the Lead Allocation page.
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
              Everything for the open rotation in one place — live queues and capacity across all teams, agent activity,
              manager alerts, and the practice panels for rehearsing the 2-minute window.
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
        <OpenPoolActivityMonitor />
        <OpenPoolManagerAlerts />
      </div>

      {/* ─────────────────────────────────────────────────────────
          PRACTICE MODE — browser-only rehearsal leads for ORR.
          These do not create Supabase rows or touch live lead flow.
         ───────────────────────────────────────────────────────── */}
      <div id="orr-practice-blue" className="space-y-4">
        <div className="border-l-4 border-primary/40 pl-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
              Practice mode
            </span>
            <h3 className="text-base font-semibold text-foreground">Try Open Round Robin risk-free</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
            A private practice space for managers. Nothing here is a real customer, no agent is contacted, and no
            performance figures change. Use practice leads (reg <code>TEST123</code>) to get comfortable with the
            120-second window, pass-on, phone column, click-to-dial, and copy button.
          </p>
          <ul className="text-xs text-muted-foreground list-disc ml-5 mt-1 space-y-0.5">
            <li><strong>Practice leads only</strong> — they exist in this browser tab and disappear when you clear them.</li>
            <li><strong>Nothing counts</strong> — scoreboards, targets, reports and commissions are untouched.</li>
            <li><strong>Agent preview</strong> — switch agents to see exactly what a colleague would see.</li>
            <li><strong>No live agent is called or notified</strong> at any point.</li>
          </ul>
        </div>

        <OpenRoundRobinTestPanel team="blue" />
      </div>

      <div id="orr-practice-red" className="space-y-4">
        <div className="border-l-4 border-rose-500 pl-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">Open Round Robin practice — Team Red</h2>
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 text-rose-800 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
              Second test panel
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            A second, independent practice queue in red. Run it alongside Team Blue to watch a lead expire, skip and
            roll on to the next dummy agent.
          </p>
        </div>
        <OpenRoundRobinTestPanel team="red" />
      </div>

      {/* MORNING LEADS — separate practice section, runs alongside ORR. */}
      <div id="orr-morning-leads" className="space-y-4">
        <div className="border-l-4 border-primary/60 pl-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">Morning leads — 9:00 am batch</h2>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
              Practice mode
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Runs independently of the Open Round Robin practice above, so both can be tested at the same time.
            Overnight leads are shared out at 9:00 am on a rolling round robin with a 30-minute ownership window.
          </p>
        </div>
        <MorningQueuePracticePanel />
      </div>
    </div>
  );
};

export default OpenRoundRobinPage;
