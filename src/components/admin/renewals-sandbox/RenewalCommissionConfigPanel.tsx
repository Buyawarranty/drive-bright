import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Percent, RotateCcw } from 'lucide-react';
import { useIsManagement } from '@/hooks/useIsManagement';
import {
  getCommissionRates,
  setCommissionRates,
  resetCommissionRates,
  subscribeCommissionRates,
  type RenewalCommissionRates,
} from './renewalCommission';

/**
 * RENEWALS SANDBOX — commission rules (Stage 7, Step 19)
 * Management-only editor. Percentages are configurable, not embedded in code.
 * Sandbox: stored locally, nothing is paid or written.
 */

const FIELDS: { key: keyof RenewalCommissionRates; label: string; hint: string }[] = [
  { key: 'newSalePct', label: 'New sale', hint: 'Normal new-business rate.' },
  { key: 'standardRenewalPct', label: 'Standard renewal', hint: 'Renewed before expiry.' },
  { key: 'winBackPct', label: 'Lapsed / win-back', hint: 'Recovered after expiry.' },
  { key: 'upsellPct', label: 'Upsell / additional', hint: 'Applied to qualifying incremental business.' },
];

export const RenewalCommissionConfigPanel: React.FC = () => {
  const { isManagement } = useIsManagement();
  const [rates, setRates] = useState<RenewalCommissionRates>(() => getCommissionRates());

  useEffect(() => subscribeCommissionRates(() => setRates({ ...getCommissionRates() })), []);

  const update = (key: keyof RenewalCommissionRates, value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    setCommissionRates({ [key]: n } as Partial<RenewalCommissionRates>);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Percent className="h-4 w-4" /> Commission rules
          <Badge variant="secondary">Sandbox</Badge>
          {!isManagement && <span className="text-xs text-muted-foreground">Read only</span>}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={resetCommissionRates}
            disabled={!isManagement}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs" title={f.hint}>{f.label} (%)</Label>
              <Input
                type="number"
                min={0}
                step={0.25}
                value={rates[f.key]}
                disabled={!isManagement}
                onChange={(e) => update(f.key, e.target.value)}
                className="h-8"
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Commission is credited to the agent who closes the renewal. The original selling agent is kept
          separately for reporting, never overwritten.
        </p>
      </CardContent>
    </Card>
  );
};

export default RenewalCommissionConfigPanel;
