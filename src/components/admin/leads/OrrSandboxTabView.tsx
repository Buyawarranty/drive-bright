import React from 'react';
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
      <WidgetErrorBoundary label="Open Round Robin">
        <OrrSection isManagement sandboxTab />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary label="Live customers stuck on checkout">
        <LiveStuckCustomersPanel />
      </WidgetErrorBoundary>
    </div>
  );
};

export default OrrSandboxTabView;
