import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ListOrdered, RotateCcw, Lock } from 'lucide-react';
import { useIsManagement } from '@/hooks/useIsManagement';
import {
  getPriorityWeights,
  resetPriorityWeights,
  setPriorityWeights,
  subscribePriorityWeights,
  type RenewalPriorityWeights,
} from './renewalPriority';

/**
 * RENEWALS SANDBOX — queue priority weights (Stage 6, Step 16)
 * The ordering is configurable so it can be re-tuned from conversion results,
 * instead of being hard-coded in the table. Saved on this device only.
 */

const FIELDS: { key: keyof RenewalPriorityWeights; label: string }[] = [
  { key: 'liveInbound', label: 'Live inbound customer' },
  { key: 'callbackDueNow', label: 'Callback due now' },
  { key: 'renewal0to7', label: 'Renewal 0–7 days' },
  { key: 'hotEnquiry', label: 'Hot new enquiry' },
  { key: 'renewal8to14', label: 'Renewal 8–14 days' },
  { key: 'standardOpportunity', label: 'Standard new opportunity' },
  { key: 'renewal15to30', label: 'Renewal 15–30 days' },
  { key: 'renewalLater', label: 'Renewal 31+ days' },
  { key: 'lapsed', label: 'Lapsed / win-back' },
  { key: 'slaBreachBonus', label: 'Bonus — SLA missed' },
  { key: 'customerRespondedBonus', label: 'Bonus — customer responded' },
];

export const RenewalPriorityConfigPanel: React.FC = () => {
  const { isManagement } = useIsManagement();
  const [w, setW] = useState<RenewalPriorityWeights>(() => getPriorityWeights());
  const [open, setOpen] = useState(false);

  useEffect(() => subscribePriorityWeights(() => setW(getPriorityWeights())), []);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4" /> Queue priority weights
          </span>
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Show'}
          </Button>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            The queue is ordered by these scores, not by when a record was created. Higher scores are worked
            first. Change a number here and the sandbox re-orders straight away.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={w[f.key]}
                  disabled={!isManagement}
                  onChange={(e) =>
                    setPriorityWeights({ [f.key]: Number(e.target.value) || 0 } as Partial<RenewalPriorityWeights>)
                  }
                  className="h-8"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={resetPriorityWeights} disabled={!isManagement}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to defaults
            </Button>
            {!isManagement && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Management can change these.
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default RenewalPriorityConfigPanel;
