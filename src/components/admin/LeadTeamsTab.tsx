import { useState, useMemo } from 'react';

import { OpenPoolManagerAlerts } from './leads/OpenPoolManagerAlerts';
import { OpenRoundRobinTestPanel } from './leads/OpenRoundRobinTestPanel';
import { OpenPoolActivityMonitor } from './leads/OpenPoolActivityMonitor';

import { RecontactAccessPanel } from './leads/RecontactAccessPanel';
import { RecontactAgentCapsPanel } from './leads/RecontactAgentCapsPanel';

import { AllocationMatrix } from './leads/AllocationMatrix';

import { BulkReassignDialog } from './leads/BulkReassignDialog';
import { RecentReassignmentsPanel } from './leads/RecentReassignmentsPanel';
import { AssignOpenPoolCard } from './leads/AssignOpenPoolCard';

import { WeekendRosterCard } from './leads/WeekendRosterCard';
import { LeadRecoveryPanel } from './leads/LeadRecoveryPanel';
import { AgentOffboardingPanel } from './leads/AgentOffboardingPanel';
import { ManagerOverrideAuditPanel } from './leads/ManagerOverrideAuditPanel';
import { QueueCapacityDashboard } from './leads/QueueCapacityDashboard';
import { DiscountCapManagerDialog } from './quote/DiscountCapManagerDialog';
import { Button } from '@/components/ui/button';
import { Percent } from 'lucide-react';
import { AgentLeadVisibilityPanel } from './leads/AgentLeadVisibilityPanel';
import { Switch } from '@/components/ui/switch';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useAgentTeams } from '@/hooks/useAgentTeams';
import { useSalesLeadTeamVisibility } from '@/hooks/useSalesLeadTeamVisibility';
import { useAdminConfig } from '@/hooks/useAdminConfig';
import { ArrowLeft, UserRoundCog } from 'lucide-react';



interface LeadTeamsTabProps {
  onNavigateToTab?: (tab: string) => void;
}

export const LeadTeamsTab = ({ onNavigateToTab }: LeadTeamsTabProps) => {
  const { effectiveRole } = useViewAs();
  const currentAdminId = useCurrentAdminId();
  const { allTeams, byAgent: agentTeamMap } = useAgentTeams();
  const { teamIds: grantedTeamIds } = useSalesLeadTeamVisibility(
    effectiveRole === 'sales_lead' ? currentAdminId : null,
  );
  const { value: salesLeadsCanReassignRaw, updateConfig: setSalesLeadsCanReassign } =
    useAdminConfig('sales_leads_can_reassign');
  const salesLeadsCanReassign = salesLeadsCanReassignRaw === true;
  const [discountCapOpen, setDiscountCapOpen] = useState(false);


  const isManagement =

    effectiveRole === 'super_admin' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'sales_manager' ||
    effectiveRole === 'performance_manager';

  const isLeadGen = effectiveRole === 'lead_gen';
  const isSalesLead = effectiveRole === 'sales_lead';

  // Sales lead: locked to own team unless management has granted "show all teams"
  // (i.e. visibility rows exist for every other team).
  const salesLeadSeesAllTeams = useMemo(() => {
    if (!isSalesLead || !currentAdminId) return false;
    const ownTeamId = agentTeamMap.get(currentAdminId)?.id ?? null;
    const others = allTeams.filter(t => t.id !== ownTeamId);
    if (others.length === 0) return false;
    return others.every(t => grantedTeamIds.includes(t.id));
  }, [isSalesLead, currentAdminId, agentTeamMap, allTeams, grantedTeamIds]);

  // Management and lead_gen get the full view (including source column).
  // sales_lead only sees source when management enabled "show all teams".
  const canSeeSources = isManagement || isLeadGen;
  const canEdit = isManagement || isLeadGen || isSalesLead;


  if (!isManagement && !isLeadGen && !isSalesLead) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Lead Allocation is restricted to managers, sales leads, and admins.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. WHO GETS THE LEADS? — daily allocation controls.
             Distribute one at a time, reset rotation, allocate next 5,
             per-agent caps, sources, RR/ORR toggle. This is the
             day-to-day tool managers use to hand out leads.
         ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="border-l-4 border-primary/60 pl-3">
          <h2 className="text-lg font-semibold text-foreground">Who gets the leads?</h2>
          <p className="text-xs text-muted-foreground">
            Distribute unassigned leads to agents, reset rotation, and tune per-agent caps and sources.
          </p>
        </div>
        <AllocationMatrix
          canEdit={canEdit}
          isTeamScoped={isSalesLead && !salesLeadSeesAllTeams}
          hideSources={!canSeeSources}
          isSalesLead={isSalesLead}
        />
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isSalesLead ? 'Team Allocation' : 'Lead Allocation'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {isSalesLead
              ? (salesLeadSeesAllTeams
                  ? 'View how leads are shared across all teams and agents.'
                  : 'View how leads are shared across your team. Ask management if you need visibility into other teams.')
              : 'Choose which agents receive leads, assign them to teams, and control how leads are shared.'}
          </p>
        </div>

        {onNavigateToTab && (
          <button
            type="button"
            onClick={() => onNavigateToTab('new-leads')}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Leads
          </button>
        )}
      </div>

      {isManagement && (
        <div className="space-y-4">
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
      )}



      {/* ─────────────────────────────────────────────────────────────
          3. RECONTACT LEADS — access + caps grouped together.
         ───────────────────────────────────────────────────────────── */}
      {isManagement && (
        <div className="space-y-4">
          <div className="border-l-4 border-primary/60 pl-3">
            <h2 className="text-lg font-semibold text-foreground">Recontact Leads</h2>
            <p className="text-xs text-muted-foreground">
              Who can work recontact leads and how many they can pick up per day.
            </p>
          </div>
          <RecontactAccessPanel />
          <RecontactAgentCapsPanel />
        </div>
      )}


      {/* ─────────────────────────────────────────────────────────────
          4. REBALANCE — bulk reassignment tools and recent activity.
         ───────────────────────────────────────────────────────────── */}
      {(isManagement || (isSalesLead && salesLeadsCanReassign)) && (
        <div className="space-y-4">
          <div className="border-l-4 border-primary/60 pl-3">
            <h2 className="text-lg font-semibold text-foreground">Rebalance &amp; Reassign</h2>
            <p className="text-xs text-muted-foreground">
              Move leads between agents and review recent reassignments.
            </p>
          </div>
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <UserRoundCog className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">Rebalance Leads</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Move leads between agents when workloads get uneven. Pull from one or more agents and share out to one or more agents in a single action.
                  </p>
                </div>
              </div>
              <BulkReassignDialog salesUsers={[]} onComplete={() => { /* page reloads via child hooks */ }} />
            </div>

            {/* Management-only toggle to share this tool with sales leads */}
            {isManagement && (
              <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">Share with sales leads</div>
                  <div className="text-xs text-muted-foreground">
                    When on, sales leads can also open the Reassign tool from this page.
                  </div>
                </div>
                <Switch
                  checked={salesLeadsCanReassign}
                  onCheckedChange={(v) => setSalesLeadsCanReassign(v)}
                />
              </div>
            )}
          </section>
          {isManagement && <AgentOffboardingPanel />}
          {isManagement && <LeadRecoveryPanel />}
          {isManagement && <RecentReassignmentsPanel />}
          {isManagement && <ManagerOverrideAuditPanel />}
        </div>
      )}

    </div>
  );
};

export default LeadTeamsTab;

