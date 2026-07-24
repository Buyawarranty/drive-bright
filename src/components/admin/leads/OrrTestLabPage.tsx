import React from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { OpenRoundRobinTestPanel } from './OpenRoundRobinTestPanel';
import { useViewAs } from '@/contexts/ViewAsContext';

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
          <div className="rounded-md bg-rose-600 p-2">
            <FlaskConical className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">ORR Test Lab</h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
                Dry Run
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500 text-emerald-700 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
                Dummy data only
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              A dedicated sandbox to test the Open Round Robin experience with made-up leads only.
              Create a dummy lead, watch the 120-second countdown, expire it, run the dummy sweep,
              and see it pass to another dummy agent before anything is pushed to real sales agents.
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

      <OpenRoundRobinTestPanel />

      <div className="rounded-md border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
        <div><strong>How to use:</strong></div>
        <ol className="list-decimal ml-5 space-y-0.5">
          <li>Click <em>Create dummy lead</em> — a made-up Team Blue lead appears with a 2-minute deadline.</li>
          <li>Click <em>Expire window</em> on a row to fast-forward its deadline into the past.</li>
          <li>Click <em>Run dummy sweep</em> — the row moves to the next dummy agent.</li>
          <li>Switch the dummy sales agent dropdown to confirm the row appears/disappears per agent view.</li>
          <li>Click <em>Clear test panel</em> whenever you like to wipe the dummy rows. Nothing here ever touches Supabase, scoreboards, reports, or real sales agents — it's purely a UI sandbox.</li>
        </ol>
      </div>
    </div>
  );
};

export default OrrTestLabPage;
