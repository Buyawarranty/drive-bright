import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { NewLeadsTab } from '@/components/admin/leads/NewLeadsTab';
import { OrrSandboxProvider } from '@/components/admin/leads/OrrSandboxContext';
import { OrrSandboxPassPanel } from '@/components/admin/leads/OrrSandboxPassPanel';
import { OrrSection } from '@/components/admin/leads/OrrSection';
import { WidgetErrorBoundary } from '@/components/admin/WidgetErrorBoundary';

/**
 * Open Round Robin Sandbox — an exact copy of the New Leads page showing the
 * genuine live leads, with allocation worked out by Open Round Robin instead of
 * the live rotation.
 *
 * Read-only against real data: every mutating action inside `NewLeadsTab` is
 * neutralised by `OrrSandboxProvider`.
 */
export const OrrSandboxTabView: React.FC<{
  onNavigateToTab?: (tab: string) => void;
  userRole?: string | null;
}> = ({ onNavigateToTab, userRole }) => {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50/70 p-5">
        <div className="flex items-start gap-3">
          <TriangleAlert className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-900">
                Open Round Robin Sandbox
              </h2>
              <span className="inline-flex items-center rounded-md bg-amber-200 text-amber-900 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5">
                Sandbox — not live
              </span>
            </div>
            <p className="text-sm text-amber-900/90">
              These are your genuine live leads. Nothing on this page assigns, calls, re-statuses or notifies
              anybody, and no figures change — it only shows what the New Leads page would look like if Open
              Round Robin were switched on. The real settings stay on the Lead Allocation page.
            </p>
            <p className="text-sm font-medium text-amber-900">
              Always in step with Lead Allocation: teams, caps, who's switched on and the Flow split are read
              live from that page, so any change you make there shows here straight away — and the very same
              settings are the ones that start acting for real the moment you switch Open Round Robin live.
            </p>

          </div>
        </div>
      </div>

      <WidgetErrorBoundary label="Open Round Robin">
        <OrrSection isManagement />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary label="Open Round Robin practice pass">
        <OrrSandboxPassPanel />
      </WidgetErrorBoundary>

      <OrrSandboxProvider>
        <NewLeadsTab sandboxMode onNavigateToTab={onNavigateToTab} userRole={userRole} />
      </OrrSandboxProvider>
    </div>
  );
};

export default OrrSandboxTabView;
