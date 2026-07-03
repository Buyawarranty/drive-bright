import { useState, useMemo } from 'react';
import { LeadRoutingPanel } from './leads/LeadRoutingDialog';
import { AllocationMatrix } from './leads/AllocationMatrix';
import { SalesLeadVisibilityPanel } from './leads/SalesLeadVisibilityPanel';
import { BulkReassignDialog } from './leads/BulkReassignDialog';
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
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [visibilityOpen, setVisibilityOpen] = useState(false);

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

      {/* Default Lead Allocation + Sales Agents */}
      <AllocationMatrix
        canEdit={canEdit}
        isTeamScoped={isSalesLead && !salesLeadSeesAllTeams}
        hideSources={!canSeeSources}
      />



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
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted text-muted-foreground border border-border">
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

