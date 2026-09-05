import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { OrrSandboxPassPanel } from '@/components/admin/leads/OrrSandboxPassPanel';
import { OrrSection } from '@/components/admin/leads/OrrSection';
import { LiveStuckCustomersPanel } from '@/components/admin/leads/LiveStuckCustomersPanel';
import { WidgetErrorBoundary } from '@/components/admin/WidgetErrorBoundary';

/**
 * Open Round Robin Sandbox — the Open Round Robin lead flow only.
 *
 * The current New Leads round-robin table and its filters are deliberately not
 * shown here: they belong to the live rotation, not Open Round Robin.
 */
export const OrrSandboxTabView: React.FC<{
  onNavigateToTab?: (tab: string) => void;
  userRole?: string | null;
}> = () => {
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
            <ul className="text-sm text-amber-900/90 list-disc pl-4 space-y-1">
              <li>This is a safe rehearsal space — nothing here assigns, calls or changes any lead.</li>
              <li>The leads shown are real, but every action is practice-only.</li>
              <li>What you see matches the live Lead Allocation settings, so it previews what agents will experience once Open Round Robin goes live.</li>
            </ul>

          </div>
        </div>
      </div>

      <WidgetErrorBoundary label="Live customers stuck on checkout">
        <LiveStuckCustomersPanel />
      </WidgetErrorBoundary>


      <WidgetErrorBoundary label="Open Round Robin">
        <OrrSection isManagement />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary label="Open Round Robin practice pass">
        <OrrSandboxPassPanel />
      </WidgetErrorBoundary>
    </div>
  );
};

export default OrrSandboxTabView;
