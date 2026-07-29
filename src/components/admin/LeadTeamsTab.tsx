import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

import { OpenPoolManagerAlerts } from './leads/OpenPoolManagerAlerts';
import { OpenRoundRobinTestPanel } from './leads/OpenRoundRobinTestPanel';
import MorningQueuePracticePanel from './leads/MorningQueuePracticePanel';
import { OpenPoolActivityMonitor } from './leads/OpenPoolActivityMonitor';

import { RecontactAccessPanel } from './leads/RecontactAccessPanel';
import { RecontactAgentCapsPanel } from './leads/RecontactAgentCapsPanel';

import { AllocationMatrix } from './leads/AllocationMatrix';


import { RecentReassignmentsPanel } from './leads/RecentReassignmentsPanel';
import { AssignOpenPoolCard } from './leads/AssignOpenPoolCard';

import { WeekendRosterCard } from './leads/WeekendRosterCard';
import { LeadRecoveryPanel } from './leads/LeadRecoveryPanel';

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
import { ArrowLeft } from 'lucide-react';

const QUICK_LINKS = [
  { id: 'who-gets-leads', label: 'Who gets the leads?', className: 'bg-blue-600 text-white border-transparent hover:bg-blue-700' },
  { id: 'scoreboard-targets', label: 'Scoreboard targets', className: 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700' },
  { id: 'open-round-robin', label: 'Open Round Robin', className: 'bg-violet-600 text-white border-transparent hover:bg-violet-700' },
  { id: 'morning-leads', label: 'Morning leads', className: 'bg-amber-500 text-white border-transparent hover:bg-amber-600' },
  { id: 'recontact-leads', label: 'Recontact leads', className: 'bg-rose-600 text-white border-transparent hover:bg-rose-700' },
  { id: 'recovery-audit', label: 'Recovery & audit', className: 'bg-cyan-600 text-white border-transparent hover:bg-cyan-700' },
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

  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-xs font-semibold text-foreground shrink-0">Jump to:</span>
        {QUICK_LINKS.map((link) => (
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
        ))}
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

      </div>

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
          <LeadRecoveryPanel />
          <RecentReassignmentsPanel />
          <ManagerOverrideAuditPanel />
        </div>
      )}


    </div>
  );
};

export default LeadTeamsTab;

