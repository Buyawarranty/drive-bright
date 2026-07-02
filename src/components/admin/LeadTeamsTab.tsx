import { useState } from 'react';
import { LeadRoutingPanel } from './leads/LeadRoutingDialog';
import { AllocationMatrix } from './leads/AllocationMatrix';
import { DistributionModeCard } from './leads/DistributionModeCard';
import { SalesLeadVisibilityPanel } from './leads/SalesLeadVisibilityPanel';
import { useViewAs } from '@/contexts/ViewAsContext';
import { ArrowLeft, ChevronDown, ChevronUp, Settings2, Info, Eye } from 'lucide-react';

interface LeadTeamsTabProps {
  onNavigateToTab?: (tab: string) => void;
}

export const LeadTeamsTab = ({ onNavigateToTab }: LeadTeamsTabProps) => {
  const { effectiveRole } = useViewAs();
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [visibilityOpen, setVisibilityOpen] = useState(false);

  const isManagement =
    effectiveRole === 'super_admin' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'sales_manager' ||
    effectiveRole === 'performance_manager';

  const isSalesLead = effectiveRole === 'sales_lead';

  const canEdit = isManagement || isSalesLead;

  if (!isManagement && !isSalesLead) {
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
            {isSalesLead ? 'My Team Allocation' : 'Lead Allocation'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {isSalesLead
              ? 'Adjust how leads are shared between agents in your team.'
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

      {/* Distribution mode — moved from New Leads tab so all controls live in one place */}
      {isManagement && <DistributionModeCard canEdit={canEdit} />}

      {/* Default Lead Allocation + Sales Agents */}
      <AllocationMatrix canEdit={canEdit} isTeamScoped={isSalesLead} />

      {/* Sales Lead Team Visibility — management only */}
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
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-50 text-blue-900 border border-blue-100">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  If no source-specific rule is added, leads are shared between active agents using their lead share percentage from the section above.
                </p>
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

