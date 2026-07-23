import { useState, useMemo } from 'react';
import { LeadRoutingPanel } from './leads/LeadRoutingDialog';
import { SharkTankPanel } from './leads/SharkTankPanel';
import { OpenPoolManagerAlerts } from './leads/OpenPoolManagerAlerts';
import { OpenPoolActivityMonitor } from './leads/OpenPoolActivityMonitor';
import { OpenPoolAgentCapsPanel } from './leads/OpenPoolAgentCapsPanel';
import { RecontactAccessPanel } from './leads/RecontactAccessPanel';
import { RecontactAgentCapsPanel } from './leads/RecontactAgentCapsPanel';

import { AllocationMatrix } from './leads/AllocationMatrix';
import { SalesLeadVisibilityPanel } from './leads/SalesLeadVisibilityPanel';
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
import { ArrowLeft, ChevronDown, ChevronUp, Settings2, Info, Eye, UserRoundCog } from 'lucide-react';



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
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
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
            <h2 className="text-lg font-semibold text-foreground">Queue &amp; Capacity Dashboard</h2>
            <p className="text-xs text-muted-foreground">
              Live view of Team Blue queues, agent capacity, and warnings.
            </p>
          </div>
          <QueueCapacityDashboard />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. WHO GETS THE LEADS — primary allocation matrix, pinned to top.
         ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="border-l-4 border-primary/60 pl-3">
          <h2 className="text-lg font-semibold text-foreground">Default Allocation</h2>
          <p className="text-xs text-muted-foreground">
            For each agent, pick the team they're on, turn lead receiving on or off, set how big a slice of leads they get, cap how many leads they get per day, and tick which lead sources (Facebook, Google, etc.) they're allowed to handle.
          </p>
        </div>
        <AllocationMatrix
          canEdit={canEdit}
          isTeamScoped={isSalesLead && !salesLeadSeesAllTeams}
          hideSources={!canSeeSources}
          isSalesLead={isSalesLead}
        />
        
        {(isManagement || isLeadGen) && <AssignOpenPoolCard />}
        {isManagement && <WeekendRosterCard />}
        {isManagement && <AgentLeadVisibilityPanel />}
        {isManagement && (
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Percent className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">Discount caps per agent</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Set the maximum discount each sales agent can apply on the Get Quote page (Step 2 — Quotes &amp; Orders). Leave blank for the default 20%, or set 0 to block any discount.
                  </p>
                </div>
              </div>
              <Button onClick={() => setDiscountCapOpen(true)} className="shrink-0">
                Manage discount caps
              </Button>
            </div>
          </section>
        )}
        <DiscountCapManagerDialog open={discountCapOpen} onOpenChange={setDiscountCapOpen} />
      </div>



      {/* ─────────────────────────────────────────────────────────────
          2. OPEN LEAD POOL — all pool config lives together.
         ───────────────────────────────────────────────────────────── */}
      {isManagement && (
        <div className="space-y-4">
          <div className="border-l-4 border-primary/60 pl-3">
            <h2 className="text-lg font-semibold text-foreground">Open Lead Pool</h2>
            <p className="text-xs text-muted-foreground">
              First-come-first-serve pool. Configure the pool, per-agent caps, and alerts.
            </p>
          </div>
          <SharkTankPanel />
          <OpenPoolAgentCapsPanel />
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

      {/* ─────────────────────────────────────────────────────────────
          5. OPTIONAL / ADVANCED — visibility grants and source rules.
         ───────────────────────────────────────────────────────────── */}
      {isManagement && (
        <div className="border-l-4 border-muted pl-3">
          <h2 className="text-lg font-semibold text-foreground">Optional / Advanced</h2>
          <p className="text-xs text-muted-foreground">
            Extra controls most teams won't need day-to-day.
          </p>
        </div>
      )}

      {isManagement && (
        <section className="rounded-lg border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() => setVisibilityOpen(o => !o)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">Sales Lead Team Visibility</h2>
                  <span className="text-xs font-medium text-muted-foreground">(Optional)</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Grant individual sales leads access to view other teams' lead flows (e.g. Red, Blue, Green) on the Leads page.
                </p>
              </div>
            </div>
            {visibilityOpen
              ? <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />}
          </button>
          {visibilityOpen && (
            <div className="border-t border-border">
              <SalesLeadVisibilityPanel />
            </div>
          )}
        </section>
      )}

      {/* Advanced Source Rules — management only, collapsed by default */}
      {isManagement && (
        <section className="rounded-lg border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() => setAdvancedOpen(o => !o)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">Advanced Source Rules</h2>
                  <span className="text-xs font-medium text-muted-foreground">(Optional)</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Only use this if a specific lead source needs to be routed differently from the default allocation above.
                </p>
              </div>
            </div>
            {advancedOpen
              ? <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />}
          </button>

          {advancedOpen && (
            <div className="px-5 pb-5 border-t border-border pt-4 space-y-3">
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted text-muted-foreground border border-border">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-xs space-y-1">
                  <p>If no source-specific rule is added, leads are shared between active agents using their lead share percentage from the section above.</p>
                  <p><strong className="text-foreground">Precedence:</strong> when <em>Team routing</em> is ON, a new lead first picks a <strong>team</strong> using the source rules below; then, inside that team, the <strong>agent</strong> is chosen using the slice % and daily caps from "Who gets the leads?". Team routing OFF = source rules are ignored and only per-agent allocation applies.</p>
                </div>
              </div>

              <LeadRoutingPanel canEdit={canEdit} />
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default LeadTeamsTab;

