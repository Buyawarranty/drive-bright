import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ManualAddLeadDialog } from './leads/ManualAddLeadDialog';
import type { AdminUser } from '@/hooks/useLeads';

import { OpenPoolManagerAlerts } from './leads/OpenPoolManagerAlerts';
import { OpenPoolActivityMonitor } from './leads/OpenPoolActivityMonitor';

import { RecontactAccessPanel } from './leads/RecontactAccessPanel';
import { RecontactAgentCapsPanel } from './leads/RecontactAgentCapsPanel';

import { AllocationMatrix } from './leads/AllocationMatrix';
import { BulkReassignDialog } from './leads/BulkReassignDialog';
import { NewSince6pmBadge } from './leads/NewSince6pmBadge';
import { RebalanceWindowPicker } from './leads/RebalanceWindowPicker';
import { AgentOffboardingPanel } from './leads/AgentOffboardingPanel';
import { AgentActiveStatusPanel } from './leads/AgentActiveStatusPanel';
import { QuickReassignPanel } from './leads/QuickReassignPanel';
import { ReassignRequestsPanel } from './leads/ReassignRequestsPanel';
import { Switch } from '@/components/ui/switch';
import { useAdminConfig } from '@/hooks/useAdminConfig';


import { RecentReassignmentsPanel } from './leads/RecentReassignmentsPanel';
import { AssignOpenPoolCard } from './leads/AssignOpenPoolCard';


import { LeadRecoveryPanel } from './leads/LeadRecoveryPanel';
import { WorkedLeadsRecoveryPanel } from './leads/WorkedLeadsRecoveryPanel';

import { StaffLeadAccessPanel } from './leads/StaffLeadAccessPanel';
import { ConfirmPaymentBlockPanel } from './leads/ConfirmPaymentBlockPanel';

import { ManagerOverrideAuditPanel } from './leads/ManagerOverrideAuditPanel';
import { QueueCapacityDashboard } from './leads/QueueCapacityDashboard';
import { DiscountCapManagerDialog } from './quote/DiscountCapManagerDialog';
import { Button } from '@/components/ui/button';
import { Percent, BellRing } from 'lucide-react';
import { triggerTestLeadAlert } from '@/hooks/useNewLeadAlert';
import { AgentLeadVisibilityPanel } from './leads/AgentLeadVisibilityPanel';
import { PausedAgentsOverrideBar } from './leads/PausedAgentsOverrideBar';
import { CancellationsAllocationPanel } from './leads/CancellationsAllocationPanel';
import { SaveOnlineSaleAllocationPanel } from './leads/SaveOnlineSaleAllocationPanel';


import { ScoreboardTargetsSection } from './leads/ScoreboardTargetsSection';
import { OrrSection } from './leads/OrrSection';
import { ImportLeadToAgentPanel } from './leads/ImportLeadToAgentPanel';

import { useViewAs } from '@/contexts/ViewAsContext';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useAgentTeams } from '@/hooks/useAgentTeams';
import { useSalesLeadTeamVisibility } from '@/hooks/useSalesLeadTeamVisibility';
import { ArrowLeft, UserRoundCog } from 'lucide-react';

const QUICK_LINKS = [
  { id: 'new-leads', label: 'New leads', className: 'bg-sky-300/50 text-sky-900 border-sky-200/50 hover:bg-sky-400/50' },
  { id: 'who-gets-leads', label: 'Who gets the leads?', className: 'bg-blue-300/50 text-blue-900 border-blue-200/50 hover:bg-blue-400/50' },
  { id: 'rebalance-reassign', label: 'Rebalance Leads', className: 'bg-orange-300/50 text-orange-900 border-orange-200/50 hover:bg-orange-400/50' },
  { id: 'handover-requests', label: 'Handover requests', className: 'bg-purple-300/50 text-purple-900 border-purple-200/50 hover:bg-purple-400/50' },
  { id: 'offboard-agent', label: 'Offboard an agent', className: 'bg-amber-300/50 text-amber-900 border-amber-200/50 hover:bg-amber-400/50' },

  { id: 'cancellations', label: 'Cancellations', className: 'bg-red-300/50 text-red-900 border-red-200/50 hover:bg-red-400/50' },
  { id: 'save-online-sale', label: 'Save online sale', className: 'bg-emerald-300/50 text-emerald-900 border-emerald-200/50 hover:bg-emerald-400/50' },

  { id: 'lead-freeze', label: 'Leads on / off', className: 'bg-teal-300/50 text-teal-900 border-teal-200/50 hover:bg-teal-400/50' },

  { id: 'staff-lead-access', label: 'Staff Lead Access', className: 'bg-indigo-300/50 text-indigo-900 border-indigo-200/50 hover:bg-indigo-400/50' },
  { id: 'scoreboard-targets', label: 'Scoreboard targets', className: 'bg-emerald-300/50 text-emerald-900 border-emerald-200/50 hover:bg-emerald-400/50' },
  { id: 'open-round-robin', label: 'Open Round Robin', className: 'bg-violet-300/50 text-violet-900 border-violet-200/50 hover:bg-violet-400/50' },
  { id: 'recontact-leads', label: 'Recontact leads', className: 'bg-rose-300/50 text-rose-900 border-rose-200/50 hover:bg-rose-400/50' },
  { id: 'recovery-audit', label: 'Recover leads', className: 'bg-cyan-300/50 text-cyan-900 border-cyan-200/50 hover:bg-cyan-400/50' },
];

function QuickLinksBar() {
  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL hash without jumping
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  // Split the links across two rows so the bar stays compact.
  const half = Math.ceil(QUICK_LINKS.length / 2);
  const rowOne = QUICK_LINKS.slice(0, half);
  const rowTwo = QUICK_LINKS.slice(half);

  const renderPills = (links: typeof QUICK_LINKS) =>
    links.map((link) => (
      <button
        key={link.id}
        type="button"
        onClick={() => handleClick(link.id)}
        className={cn(
          'shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border hover:shadow-md transition-colors',
          link.className
        )}
      >
        {link.label}
      </button>
    ));

  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-semibold text-foreground shrink-0">Jump to:</span>
          {renderPills(rowOne)}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {renderPills(rowTwo)}
        </div>
      </div>
    </div>
  );
}




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
  const [salesUsers, setSalesUsers] = useState<AdminUser[]>([]);

  // Lightweight fetch of active sales-floor users for the manual add-lead dialog.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, user_id, first_name, last_name, email, is_active, role')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead', 'admin', 'super_admin'])
        .order('first_name');
      if (data) setSalesUsers(data as AdminUser[]);
    })();
  }, []);

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


  const isSales = effectiveRole === 'sales';

  if (!isManagement && !isLeadGen && !isSalesLead && !isSales) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Lead Allocation is restricted to managers, sales leads, and admins.
        </p>
      </div>
    );
  }

  // Sales agents only get to see their own scoreboard target here.
  if (isSales && !isManagement && !isLeadGen && !isSalesLead) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Scoreboard Target</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your monthly goal and how much revenue is left to close it. Only you and your managers can see this.
          </p>
        </div>
        <ScoreboardTargetsSection isManagement={false} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {isManagement && <PausedAgentsOverrideBar canEdit={canEdit} />}

      <QuickLinksBar />

      {/* Preview the agent new-lead pop-up. Local only — no lead is created,
          assigned or notified; the card disappears when dismissed. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-violet-300 bg-violet-50/60 px-3 py-2">
        <BellRing className="h-4 w-4 text-violet-600" />
        <span className="text-xs text-violet-800">
          Test the agent new-lead pop-up — shows a sample card bottom-left. Nothing is saved or sent.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto border-violet-400 text-violet-700 hover:bg-violet-100"
          onClick={() => triggerTestLeadAlert()}
        >
          Test pop-up
        </Button>
      </div>



      {/* ─────────────────────────────────────────────────────────────
          NEW LEADS — manually add a lead straight from Lead Allocation.
         ───────────────────────────────────────────────────────────── */}
      <div id="new-leads" className="space-y-4">
        <div className="border-l-4 border-sky-500/60 pl-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">New leads</h2>
              <p className="text-xs text-muted-foreground">
                Manually add a new lead and assign it to an agent in one step. The lead sticks to the chosen agent,
                bypassing auto-distribution and daily caps.
              </p>
            </div>
            <ManualAddLeadDialog
              salesUsers={salesUsers}
              currentAdminId={currentAdminId}
              canAssignToOthers={canEdit}
              onCreated={() => {}}
            />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. WHO GETS THE LEADS? — daily allocation controls.

             Distribute one at a time, reset rotation, allocate next 5,
             per-agent caps, sources, RR/ORR toggle. This is the
             day-to-day tool managers use to hand out leads.
         ───────────────────────────────────────────────────────────── */}
      <div id="who-gets-leads" className="space-y-4">
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

        {/* Rebalance & Reassign — sits alongside allocation controls */}
        {(isManagement || (isSalesLead && salesLeadsCanReassign)) && (
          <section id="rebalance-reassign" className="rounded-lg border border-border bg-card shadow-sm">
            <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <UserRoundCog className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">Rebalance Leads</h3>
                    <NewSince6pmBadge />
                    <RebalanceWindowPicker />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Move leads between agents when workloads get uneven. Pull from one or more agents and share out to one or more agents in a single action.
                  </p>
                </div>
              </div>
              <BulkReassignDialog salesUsers={[]} onComplete={() => { /* page reloads via child hooks */ }} />
            </div>

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
        )}

        {isManagement && <ReassignRequestsPanel />}
        {(isManagement || (isSalesLead && salesLeadsCanReassign)) && <QuickReassignPanel />}
        {isManagement && <AgentActiveStatusPanel />}
        {isManagement && <div id="agent-offboarding"><AgentOffboardingPanel /></div>}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CANCELLATIONS — send a cancelling website sale to a specific
          agent as a SAVE CANCELLATION lead.
         ───────────────────────────────────────────────────────────── */}
      {isManagement && (
        <div id="cancellations" className="space-y-4">
          <div className="border-l-4 border-red-500/60 pl-3">
            <h2 className="text-lg font-semibold text-foreground">Cancellations</h2>
            <p className="text-xs text-muted-foreground">
              Website sales asking to cancel. Pick an agent and send it to them as an urgent save lead.
            </p>
          </div>
          <ImportLeadToAgentPanel
            title="Import a lead and send it to an agent"
            description="Already have the lead in the system? Find them by reg plate, name, email or phone, pick the agent, and it goes to them as an urgent save cancellation lead."
            noteTag="SAVE CANCELLATION"
            markUrgent
          />
          <CancellationsAllocationPanel />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SAVE ONLINE SALE — authorise agents, then import an online
          sale as a lead paying them a % of the full sale value.
         ───────────────────────────────────────────────────────────── */}
      {isManagement && (
        <div id="save-online-sale" className="space-y-4">
          <div className="border-l-4 border-emerald-500/60 pl-3">
            <h2 className="text-lg font-semibold text-foreground">Save online sale</h2>
            <p className="text-xs text-muted-foreground">
              Give chosen agents permission to receive imported online sales, then import the lead — it goes to
              them stating they earn 4% of the full value of the sale.
            </p>
          </div>
          <SaveOnlineSaleAllocationPanel />
        </div>
      )}



      {/* ─────────────────────────────────────────────────────────────
          STAFF LEAD ACCESS — who can assign leads to other agents,
          and the single toggle that grants it to sales leads.
         ───────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────
          LEADS ON / OFF — per-agent switch plus the automatic
          two-day no-sales freeze (pro-rata on-target agents exempt).
         ───────────────────────────────────────────────────────────── */}
      {isManagement && (
        <div id="lead-freeze" className="space-y-4">
          <div className="border-l-4 border-teal-500/60 pl-3">
            <h2 className="text-lg font-semibold text-foreground">Leads on / off</h2>
            <p className="text-xs text-muted-foreground">
              Switch each agent's leads on or off manually. Nothing pauses leads automatically.
            </p>
          </div>
        </div>
      )}

      {isManagement && <StaffLeadAccessPanel />}

      {/* Quotes & Orders — Confirm external payment price block master switch */}
      {isManagement && <ConfirmPaymentBlockPanel />}


      {/* ─────────────────────────────────────────────────────────────
          SCOREBOARD TARGETS — set each agent's monthly goal.
          Managers see the editor + team progress grid. Agents (when
          this tab is opened by them directly) see only their own card.
         ───────────────────────────────────────────────────────────── */}
      {(isManagement || isSalesLead) && (
        <div id="scoreboard-targets" className="space-y-4">
          <ScoreboardTargetsSection isManagement={isManagement} />
        </div>
      )}


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

      {/* Open Round Robin now lives at the very bottom of this page. */}








      {/* ─────────────────────────────────────────────────────────────
          3. RECONTACT LEADS — access + caps grouped together.
         ───────────────────────────────────────────────────────────── */}
      {isManagement && (
        <div id="recontact-leads" className="space-y-4">
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
          4. RECOVERY & AUDIT — history only (manual rebalance tools removed).
         ───────────────────────────────────────────────────────────── */}
      {isManagement && (
        <div id="recovery-audit" className="space-y-4">
          <div className="border-l-4 border-primary/60 pl-3">
            <h2 className="text-lg font-semibold text-foreground">Recovery &amp; audit</h2>
            <p className="text-xs text-muted-foreground">
              Recover leads and review recent reassignment history.
            </p>
          </div>
          <WorkedLeadsRecoveryPanel />
          <LeadRecoveryPanel />
          <RecentReassignmentsPanel />
          <ManagerOverrideAuditPanel />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          OPEN ROUND ROBIN — last section on the page so it can never
          interfere with the live Round Robin controls above.
         ───────────────────────────────────────────────────────────── */}
      <OrrSection isManagement={isManagement} />




    </div>
  );
};

export default LeadTeamsTab;

