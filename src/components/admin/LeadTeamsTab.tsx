import { useState } from 'react';
import { LeadRoutingPanel } from './leads/LeadRoutingDialog';
import { AllocationMatrix } from './leads/AllocationMatrix';
import { useViewAs } from '@/contexts/ViewAsContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Settings2 } from 'lucide-react';

export const LeadTeamsTab = () => {
  const { effectiveRole } = useViewAs();
  const canEdit =
    effectiveRole === 'super_admin' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'sales_manager' ||
    effectiveRole === 'sales_lead';

  const [tab, setTab] = useState<'allocation' | 'routing'>('allocation');

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
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="allocation" className="gap-1.5">
            <Users className="h-4 w-4" /> Allocation
          </TabsTrigger>
          <TabsTrigger value="routing" className="gap-1.5">
            <Settings2 className="h-4 w-4" /> Lead Routing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="allocation" className="mt-4">
          <AllocationMatrix canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="routing" className="mt-4">
          <LeadRoutingPanel canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LeadTeamsTab;
