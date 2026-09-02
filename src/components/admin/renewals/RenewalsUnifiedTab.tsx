import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RenewalsQueueTab } from '@/components/admin/renewals/RenewalsQueueTab';
import { RenewalsSandboxTab } from '@/components/admin/renewals-sandbox/RenewalsSandboxTab';
import { RenewalsEngineLiveSwitch } from '@/components/admin/renewals-sandbox/RenewalsEngineLiveSwitch';
import { RenewalSummaryCards } from '@/components/admin/renewals-sandbox/RenewalSummaryCards';

interface Props {
  userRole?: string | null;
  onNavigateToTab?: (tab: string) => void;
}

/**
 * Single merged Renewals tab.
 * Top: master SANDBOX / LIVE switch + stats row (shared by both views).
 * Then two views of the same renewal population:
 *  - Queue: the working list agents use day to day.
 *  - Engine: pool distribution, SLA, priority, commission and audit controls.
 */
export const RenewalsUnifiedTab: React.FC<Props> = ({ userRole, onNavigateToTab }) => {
  const [view, setView] = useState<'queue' | 'engine'>('queue');

  return (
    <div className="space-y-4">
      <RenewalsEngineLiveSwitch userRole={userRole} />
      <RenewalSummaryCards />

      <Tabs value={view} onValueChange={(v) => setView(v as 'queue' | 'engine')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Renewals queue</TabsTrigger>
          <TabsTrigger value="engine">Engine &amp; settings</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-0">
          <RenewalsQueueTab userRole={userRole} onNavigateToTab={onNavigateToTab} />
        </TabsContent>

        <TabsContent value="engine" className="mt-0">
          <RenewalsSandboxTab userRole={userRole} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
