import { LeadRoutingPanel } from './leads/LeadRoutingDialog';
import { AllocationMatrix } from './leads/AllocationMatrix';
import { useViewAs } from '@/contexts/ViewAsContext';
import { Users, GitBranch } from 'lucide-react';

export const LeadTeamsTab = () => {
  const { effectiveRole } = useViewAs();
  const canEdit =
    effectiveRole === 'super_admin' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'sales_manager' ||
    effectiveRole === 'sales_lead';

  if (
    effectiveRole !== 'super_admin' &&
    effectiveRole !== 'admin' &&
    effectiveRole !== 'sales_manager'
  ) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Master Allocation is restricted to managers and admins.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page title — sharp, no rounded box */}
      <div className="border-b-2 border-foreground pb-3">
        <h1 className="text-2xl font-bold tracking-tight uppercase">Master Allocation</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Decide who works which queue, then decide which lead sources flow to which team. Top section is the day-to-day. Bottom section is set once and rarely touched.
        </p>
      </div>

      {/* 1. AGENTS — the day-to-day, comes first */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center justify-center h-8 w-8 bg-foreground text-background text-sm font-bold">1</span>
          <div>
            <h2 className="text-base font-bold uppercase tracking-wide flex items-center gap-2">
              <Users className="h-4 w-4" /> Agents &amp; Teams
            </h2>
            <p className="text-xs text-muted-foreground">Who's on which team, and which queues they work.</p>
          </div>
        </div>
        <AllocationMatrix canEdit={canEdit} />
      </section>

      {/* 2. SOURCE ROUTING — set once */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center justify-center h-8 w-8 bg-foreground text-background text-sm font-bold">2</span>
          <div>
            <h2 className="text-base font-bold uppercase tracking-wide flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Source Routing
            </h2>
            <p className="text-xs text-muted-foreground">What percentage of each lead source goes to each team.</p>
          </div>
        </div>
        <LeadRoutingPanel canEdit={canEdit} />
      </section>
    </div>
  );
};

export default LeadTeamsTab;
