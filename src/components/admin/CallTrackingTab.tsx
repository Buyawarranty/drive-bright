import React from 'react';
import { CallRailTrackerAssignments } from './leads/CallRailTrackerAssignments';
import { CallRailAnalyticsPanel } from './leads/CallRailAnalyticsPanel';

interface CallTrackingTabProps {
  userRole: string | null;
}

const ALLOWED_ROLES = new Set([
  'super_admin',
  'admin',
  'sales_manager',
  'performance_manager',
  'sales_lead',
  'lead_gen',
]);

export const CallTrackingTab: React.FC<CallTrackingTabProps> = ({ userRole }) => {
  if (!userRole || !ALLOWED_ROLES.has(userRole)) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Call Tracking is restricted to management and Lead Gen users.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Call Tracking</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CallRail tracker assignments, banner routing and inbound-call analytics for management and Lead Gen.
        </p>
      </div>
      <CallRailTrackerAssignments />
      <CallRailAnalyticsPanel />
    </div>
  );
};

export default CallTrackingTab;
