import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ManualAddLeadDialog } from './leads/ManualAddLeadDialog';
import type { AdminUser } from '@/hooks/useLeads';

import { OpenPoolManagerAlerts } from './leads/OpenPoolManagerAlerts';
import { OpenRoundRobinTestPanel } from './leads/OpenRoundRobinTestPanel';
import MorningQueuePracticePanel from './leads/MorningQueuePracticePanel';
import { OpenPoolActivityMonitor } from './leads/OpenPoolActivityMonitor';

import { RecontactAccessPanel } from './leads/RecontactAccessPanel';
import { RecontactAgentCapsPanel } from './leads/RecontactAgentCapsPanel';

import { AllocationMatrix } from './leads/AllocationMatrix';
import { BulkReassignDialog } from './leads/BulkReassignDialog';
import { NewSince6pmBadge } from './leads/NewSince6pmBadge';
import { RebalanceWindowPicker } from './leads/RebalanceWindowPicker';
import { AgentOffboardingPanel } from './leads/AgentOffboardingPanel';
import { QuickReassignPanel } from './leads/QuickReassignPanel';
import { Switch } from '@/components/ui/switch';
import { useAdminConfig } from '@/hooks/useAdminConfig';


import { RecentReassignmentsPanel } from './leads/RecentReassignmentsPanel';
import { AssignOpenPoolCard } from './leads/AssignOpenPoolCard';


import { LeadRecoveryPanel } from './leads/LeadRecoveryPanel';
import { WorkedLeadsRecoveryPanel } from './leads/WorkedLeadsRecoveryPanel';

import { StaffLeadAccessPanel } from './leads/StaffLeadAccessPanel';

import { ManagerOverrideAuditPanel } from './leads/ManagerOverrideAuditPanel';
import { QueueCapacityDashboard } from './leads/QueueCapacityDashboard';
import { DiscountCapManagerDialog } from './quote/DiscountCapManagerDialog';
import { Button } from '@/components/ui/button';
import { Percent } from 'lucide-react';
import { AgentLeadVisibilityPanel } from './leads/AgentLeadVisibilityPanel';
import { ScoreboardTargetsSection } from './leads/ScoreboardTargetsSection';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useAgentTeams } from '@/hooks/useAgentTeams';
import { useSalesLeadTeamVisibility } from '@/hooks/useSalesLeadTeamVisibility';
import { ArrowLeft, UserRoundCog } from 'lucide-react';

const QUICK_LINKS = [
  { id: 'new-leads', label: 'New leads', className: 'bg-sky-300/50 text-sky-900 border-sky-200/50 hover:bg-sky-400/50' },
  { id: 'who-gets-leads', label: 'Who gets the leads?', className: 'bg-blue-300/50 text-blue-900 border-blue-200/50 hover:bg-blue-400/50' },
  { id: 'rebalance-reassign', label: 'Rebalance Leads', className: 'bg-orange-300/50 text-orange-900 border-orange-200/50 hover:bg-orange-400/50' },
  { id: 'staff-lead-access', label: 'Staff Lead Access', className: 'bg-indigo-300/50 text-indigo-900 border-indigo-200/50 hover:bg-indigo-400/50' },
  { id: 'scoreboard-targets', label: 'Scoreboard targets', className: 'bg-emerald-300/50 text-emerald-900 border-emerald-200/50 hover:bg-emerald-400/50' },
  { id: 'open-round-robin', label: 'Open Round Robin', className: 'bg-violet-300/50 text-violet-900 border-violet-200/50 hover:bg-violet-400/50' },
  { id: 'morning-leads', label: 'Morning leads', className: 'bg-amber-200/50 text-amber-900 border-amber-100/50 hover:bg-amber-300/50' },
  { id: 'recontact-leads', label: 'Recontact leads', className: 'bg-rose-300/50 text-rose-900 border-rose-200/50 hover:bg-rose-400/50' },
  { id: 'recovery-audit', label: 'Recovery & audit', className: 'bg-cyan-300/50 text-cyan-900 border-cyan-200/50 hover:bg-cyan-400/50' },
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
      <QuickLinksBar />

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

        {(isManagement || (isSalesLead && salesLeadsCanReassign)) && <QuickReassignPanel />}
        {isManagement && <AgentOffboardingPanel />}
      </div>


      {/* ─────────────────────────────────────────────────────────────
          STAFF LEAD ACCESS — who can assign leads to other agents,
          and the single toggle that grants it to sales leads.
         ───────────────────────────────────────────────────────────── */}
      {isManagement && <StaffLeadAccessPanel />}


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

      {isManagement && (
        <div id="open-round-robin" className="space-y-4">
          <div className="border-l-4 border-primary/60 pl-3">
            <h2 className="text-lg font-semibold text-foreground">Open Round Robin — Queue &amp; Capacity</h2>
            <p className="text-xs text-muted-foreground">
              Live view of every Open Round Robin agent (all teams) — queues, capacity, warnings, and agent activity audit.
            </p>
          </div>
          <QueueCapacityDashboard />
          <OpenPoolActivityMonitor />
          <OpenPoolManagerAlerts />

          {/* ─────────────────────────────────────────────────────────
              PRACTICE MODE — browser-only rehearsal leads for ORR.
              These do not create Supabase rows or touch live lead flow.
             ───────────────────────────────────────────────────────── */}
          <div className="border-l-4 border-primary/40 pl-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                Practice mode
              </span>
              <h3 className="text-base font-semibold text-foreground">Try Open Round Robin risk-free</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
              A private practice space for managers. Nothing here is a real customer, no agent is contacted, and no
              performance figures change. Use practice leads (reg <code>TEST123</code>) to get comfortable with the
              120-second window, pass-on, phone column, click-to-dial, and copy button.
            </p>
            <ul className="text-xs text-muted-foreground list-disc ml-5 mt-1 space-y-0.5">
              <li><strong>Practice leads only</strong> — they exist in this browser tab and disappear when you clear them.</li>
              <li><strong>Nothing counts</strong> — scoreboards, targets, reports and commissions are untouched.</li>
              <li><strong>Agent preview</strong> — switch agents to see exactly what a colleague would see.</li>
              <li><strong>No live agent is called or notified</strong> at any point.</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-1">
              Prefer a full page? Open <strong>ORR Test Lab</strong> in the sidebar.
            </p>
          </div>

          <OpenRoundRobinTestPanel team="blue" />




          <div className="border-l-4 border-rose-500 pl-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">Open Round Robin practice — Team Red</h2>
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 text-rose-800 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                Second test panel
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              A second, independent practice queue in red. Run it alongside Team Blue to watch a lead expire, skip and
              roll on to the next dummy agent.
            </p>
          </div>
          <OpenRoundRobinTestPanel team="red" />
        </div>
      )}


      {/* ─────────────────────────────────────────────────────────────
          MORNING LEADS — separate practice section so it can be
          tested at the same time as Open Round Robin.
         ───────────────────────────────────────────────────────────── */}
      {isManagement && (
        <div id="morning-leads" className="space-y-4">
          <div className="border-l-4 border-primary/60 pl-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">Morning leads — 9:00 am batch</h2>
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                Practice mode
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Runs independently of the Open Round Robin practice above, so both can be tested at the same time.
              Overnight leads are shared out at 9:00 am on a rolling round robin with a 30-minute ownership window.
            </p>
          </div>
          <MorningQueuePracticePanel />
        </div>
      )}





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


    </div>
  );
};

export default LeadTeamsTab;

