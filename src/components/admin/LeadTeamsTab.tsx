import { LeadRoutingPanel } from './leads/LeadRoutingDialog';
import { AllocationMatrix } from './leads/AllocationMatrix';
import { useViewAs } from '@/contexts/ViewAsContext';
import { Sliders } from 'lucide-react';

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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="border-b pb-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sliders className="h-6 w-6" />
          Master Allocation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          One page for everything: which percentage of each lead source goes to each team, who's on each team, and which queues each agent works (New, Recontact, Renewals).
        </p>
      </div>

      {/* 1. Master switch + Source → Team % split + Routing tester */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Where leads go (Team routing)</h2>
        <LeadRoutingPanel canEdit={canEdit} />
      </section>

      {/* 2. Who's on each team + per-agent queue toggles */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Who works the leads (Agent allocation)</h2>
        <AllocationMatrix canEdit={canEdit} />
      </section>
    </div>
  );
};

export default LeadTeamsTab;
