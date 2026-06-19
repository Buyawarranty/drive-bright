import { useState } from 'react';
import { LeadRoutingPanel } from './leads/LeadRoutingDialog';
import { AllocationMatrix } from './leads/AllocationMatrix';
import { useViewAs } from '@/contexts/ViewAsContext';
import { Users, ChevronDown, ChevronRight, Settings2, ArrowLeft } from 'lucide-react';

interface LeadTeamsTabProps {
  onNavigateToTab?: (tab: string) => void;
}

export const LeadTeamsTab = ({ onNavigateToTab }: LeadTeamsTabProps) => {
  const { effectiveRole } = useViewAs();
  const canEdit =
    effectiveRole === 'super_admin' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'sales_manager' ||
    effectiveRole === 'sales_lead';

  const [showAdvanced, setShowAdvanced] = useState(false);

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
      <div className="border-b-2 border-foreground pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight uppercase">Master Allocation</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              One list. Set each agent's team tag, turn lead receiving on/off, and weight their share. New leads round-robin across whoever is on.
            </p>
          </div>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('new-leads')}
              className="inline-flex items-center gap-2 px-3 py-2 border-2 border-foreground bg-background text-sm font-bold uppercase tracking-wide hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Leads
            </button>
          )}
        </div>
      </div>

      {/* Single primary section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4" />
          <h2 className="text-base font-bold uppercase tracking-wide">Agents</h2>
        </div>
        <AllocationMatrix canEdit={canEdit} />
      </section>

      {/* Collapsible advanced — source overrides */}
      <section className="border-2 border-foreground/30">
        <button
          type="button"
          onClick={() => setShowAdvanced(s => !s)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-muted hover:bg-muted/80 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <Settings2 className="h-4 w-4" />
            Advanced: source overrides
          </span>
          {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {showAdvanced && (
          <div className="p-4 border-t-2 border-foreground/30 space-y-3">
            <div className="border-l-4 border-amber-500 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-900">
                <strong>Most teams don't need this.</strong> Leave the matrix empty and leads round-robin across all receiving agents above. Only fill it in when a specific source (e.g. Google Ads) needs to bias toward a specific team.
              </p>
            </div>
            <LeadRoutingPanel canEdit={canEdit} />
          </div>
        )}
      </section>
    </div>
  );
};

export default LeadTeamsTab;
