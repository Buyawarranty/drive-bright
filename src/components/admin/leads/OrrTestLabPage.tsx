import React from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { OpenRoundRobinTestPanel } from './OpenRoundRobinTestPanel';
import { useViewAs } from '@/contexts/ViewAsContext';

interface OrrTestLabPageProps {
  onNavigateToTab?: (tab: string) => void;
}

/**
 * ORR Test Lab — full-page dry-run environment.
 * Same UI layout as the New Leads page (via OpenRoundRobinTestPanel's synthetic
 * lead mirror) but scoped exclusively to [ORR_TEST] leads so managers can
 * rehearse the Open Round Robin flow without touching real customers.
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
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              A dedicated sandbox to test the Open Round Robin flow. Synthetic leads
              (<code>TEST123</code>) appear below in the same layout as the New Leads page — same badges,
              same 2-minute countdown, same reassignment behaviour — without affecting real customers.
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
          <li>Click <em>Create test lead</em> — the real distribution engine assigns to the next eligible agent with a 2-minute deadline.</li>
          <li>Watch the row appear above with the live countdown, same as the New Leads tab.</li>
          <li>Click <em>Expire window</em> on a row to fast-forward its deadline into the past.</li>
          <li>Click <em>Run sweep</em> — reclaim/retry logic triggers and <em>Assigned to</em> flips to the next agent.</li>
          <li>Click <em>Delete all test leads</em> when finished. Scoreboards stay clean because all rows are tagged <code>[ORR_TEST]</code>.</li>
        </ol>
      </div>
    </div>
  );
};

export default OrrTestLabPage;
