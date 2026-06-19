import { LeadRoutingPanel } from './leads/LeadRoutingDialog';
import { useViewAs } from '@/contexts/ViewAsContext';

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
          Lead Teams is restricted to managers and admins.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <LeadRoutingPanel canEdit={canEdit} />
    </div>
  );
};

export default LeadTeamsTab;
