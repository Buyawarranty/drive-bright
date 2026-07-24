import React from 'react';
import { useViewAs } from '@/contexts/ViewAsContext';
import { UserCheck, X, ExternalLink } from 'lucide-react';

/**
 * ORR Test Lab — agent simulator bar.
 * Reuses the existing ViewAs impersonation overlay (client-only) so a manager
 * can render the whole admin dashboard as a specific sales agent and watch
 * synthetic test leads land in that agent's New Leads view exactly as they
 * would in production. Nothing is written server-side.
 *
 * Restricted to super_admin because ViewAsContext gates impersonation to
 * super_admin only.
 */
export const AgentSimulatorBar: React.FC = () => {
  const {
    viewAsAgent,
    setViewAsAgent,
    availableAgents,
    loadingAgents,
    isImpersonating,
    effectiveRole,
  } = useViewAs();

  // The context returns a no-op setter for non-super_admins. Detect that by
  // checking if the available-agents list is populated: for non-super_admins
  // it stays empty because the fetch is skipped.
  const canSimulate = availableAgents.length > 0 || loadingAgents;

  const salesAgents = React.useMemo(
    () =>
      availableAgents.filter(
        (a) => a.role === 'sales' || a.role === 'sales_lead',
      ),
    [availableAgents],
  );

  if (!canSimulate) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Agent simulation is only available to super admins. Ask a super admin
        to run the ORR walkthrough, or sign in as super admin.
      </div>
    );
  }

  return (
    <div
      className={
        isImpersonating
          ? 'rounded-md border-2 border-amber-500 bg-amber-100 px-4 py-3'
          : 'rounded-md border border-border bg-card px-4 py-3'
      }
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck
            className={
              isImpersonating ? 'h-4 w-4 text-amber-800' : 'h-4 w-4 text-muted-foreground'
            }
          />
          <div className="min-w-0">
            {isImpersonating && viewAsAgent ? (
              <>
                <div className="text-sm font-semibold text-amber-900">
                  Simulating {viewAsAgent.firstName} {viewAsAgent.lastName}
                  <span className="ml-2 text-xs font-normal text-amber-800">
                    ({effectiveRole})
                  </span>
                </div>
                <div className="text-xs text-amber-800">
                  The dashboard is now rendering exactly what this agent sees —
                  New Leads, alerts, countdowns, and buttons.
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-foreground">
                  Simulate a sales agent
                </div>
                <div className="text-xs text-muted-foreground">
                  Pick an agent below to render the CRM as if you were them.
                  Nothing is written server-side.
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={viewAsAgent?.id ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                setViewAsAgent(null);
                return;
              }
              const agent = salesAgents.find((a) => a.id === id) ?? null;
              setViewAsAgent(agent);
            }}
            disabled={loadingAgents}
          >
            <option value="">
              {loadingAgents ? 'Loading agents…' : '— Simulate as… —'}
            </option>
            {salesAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName} ({a.role})
              </option>
            ))}
          </select>

          {isImpersonating && (
            <button
              type="button"
              onClick={() => setViewAsAgent(null)}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <X className="h-4 w-4" />
              Stop simulating
            </button>
          )}

          <a
            href="/admin-dashboard/?tab=new-leads"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open New Leads in new tab
          </a>
        </div>
      </div>

      {isImpersonating && (
        <div className="mt-3 text-xs text-amber-900 border-t border-amber-300 pt-2">
          <strong>Recommended flow:</strong> keep this tab as the simulated agent,
          open a second window as yourself (manager) and run <em>Create test
          lead</em> / <em>Expire window</em> / <em>Run sweep</em> from there.
          You&apos;ll see the pop-up alert, beep, and 2-minute countdown fire in
          this tab exactly as the agent experiences it.
        </div>
      )}
    </div>
  );
};

export default AgentSimulatorBar;
