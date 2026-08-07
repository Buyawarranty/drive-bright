import React from 'react';
import { CallRailTrackerAssignments } from './leads/CallRailTrackerAssignments';
import { CallRailAnalyticsPanel } from './leads/CallRailAnalyticsPanel';
import { CallRailReconciliationPanel } from './leads/CallRailReconciliationPanel';


interface CallTrackingTabProps {
  userRole: string | null;
  userPermissions?: Record<string, boolean> | null;
}

const ALLOWED_ROLES = new Set([
  'super_admin',
  'admin',
  'sales_manager',
  'performance_manager',
  'sales_lead',
  'lead_gen',
]);

export const CallTrackingTab: React.FC<CallTrackingTabProps> = ({ userRole, userPermissions }) => {
  const roleAllowed = !!userRole && ALLOWED_ROLES.has(userRole);
  const permissionGranted = userPermissions?.['tab_call-tracking'] === true;
  if (!roleAllowed && !permissionGranted) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Call rail is restricted to management and Lead Gen users. Ask an admin to grant you access.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Call rail</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inbound call tracking, assignments and analytics for management and Lead Gen.
        </p>
      </div>
      <CallRailAnalyticsPanel />
      <CallRailReconciliationPanel />
      <CallRailTrackerAssignments />

    </div>
  );
};

export default CallTrackingTab;
