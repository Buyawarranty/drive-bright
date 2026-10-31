import React from 'react';
import { OrrSection } from '@/components/admin/leads/OrrSection';
import { WidgetErrorBoundary } from '@/components/admin/WidgetErrorBoundary';

export const canSwitchOrrView = (role?: string | null) =>
  role === 'sales_manager' || role === 'admin' || role === 'super_admin';

/**
 * Open Round Robin Sandbox — the Open Round Robin lead flow only.
 *
 * The current New Leads round-robin table, its filters and the live
 * "stuck on checkout" alert list are deliberately not shown here: they belong
 * to the live rotation, not Open Round Robin.
 */
const ORR_LOGIC_POINTS: string[] = [
  'New leads stay unowned — nobody keeps a lead until a real conversation happens.',
  'A 2-minute customer browsing window passes before any agent is offered the lead.',
  'The lead is offered to the agent furthest behind, then longest-waiting, then caps-page order — respecting on/off shift, breaks, leave and daily caps.',
  'The chosen agent gets a 2-minute reservation to start the call. If it lapses, the lead goes to the next agent and no attempt is counted.',
  'No answer / voicemail / busy / failed dial counts as one genuine attempt but is never contact; the lead returns to the pool — the agent never keeps it.',
  'Uncontacted leads are released four times a day — 9:00am, 12:00pm, 2:30pm and 5:00pm UK time — for 8 days: 32 releases maximum (managers can change the times and days).',
  'A release is an allocation opportunity, not permission to call; separate customer-level call safeguards and contact restrictions still apply.',
  'Before each release the lead must still be uncontacted, unconverted, eligible for allocation and legally callable.',
  'Every real call attempt across all agents is recorded; releases never reset those counts.',
  'Chasing stops at once on a genuine two-way conversation — the lead stays with that salesperson for normal CRM follow-up and any agreed callback.',
  'A refusal, request not to call again or other suppression stops chasing even without a conversation.',
  'Managers can block or allow individual staff from Open Round Robin; blocked staff are skipped by the rotation.',
  'Renewal leads enter Open Round Robin too: the original seller is preferred if they still work renewals, otherwise the lead is offered to ORR agents with the Renewals workstream ticked.',
  'When the releases finish, the lead shows "Chase complete" but is never auto-archived, closed or reassigned.',
  'The sandbox is practice only — nothing here changes real leads, figures or notifications.',
];

export const OrrSandboxTabView: React.FC<{
  onNavigateToTab?: (tab: string) => void;
  userRole?: string | null;
}> = ({ userRole }) => {
  const isManager = canSwitchOrrView(userRole);
  return (
    <div className="space-y-4">
      {isManager && (
        <div className="rounded-lg border border-border bg-card shadow-sm p-4">
          <h3 className="text-sm font-semibold text-foreground">How Open Round Robin works — test checklist</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Managers only. Use this list to check each rule behaves as expected.</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-foreground">
            {ORR_LOGIC_POINTS.map(point => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}
      <WidgetErrorBoundary label="Open Round Robin">
        <OrrSection isManagement sandboxTab showViewToggle={isManager} />
      </WidgetErrorBoundary>
    </div>
  );
};

export default OrrSandboxTabView;

