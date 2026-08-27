import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, RotateCcw, Lock } from 'lucide-react';
import { useIsManagement } from '@/hooks/useIsManagement';
import {
  getRenewalSlaConfig,
  resetRenewalSlaConfig,
  setRenewalSlaConfig,
  subscribeRenewalSlaConfig,
  type RenewalSlaConfig,
} from './renewalSlaConfig';

/**
 * RENEWALS SANDBOX — configurable ownership SLA (Stage 5, Step 14)
 * The SLA lives in one place instead of being hard-coded in each component.
 * Sandbox-only: values are stored locally and nothing is written to the database.
 */

const FIELDS: { key: keyof RenewalSlaConfig; label: string; hint: string }[] = [
  { key: 'slaHotHours', label: 'Hot 0–7 days', hint: 'Hours to first qualifying activity' },
  { key: 'slaDue8to14Hours', label: 'Due 8–14 days', hint: 'Hours to first qualifying activity' },
  { key: 'slaDue15to30Hours', label: 'Due 15–30 days', hint: 'Hours to first qualifying activity' },
  { key: 'slaLaterHours', label: 'Due 31+ days', hint: 'Hours to first qualifying activity' },
  { key: 'slaLapsedHours', label: 'Lapsed policies', hint: 'Hours to first qualifying activity' },
  { key: 'callbackProtectionHours', label: 'Callback protection', hint: 'Hours ownership is held past a booked callback' },
  { key: 'originalAgentFirstOpportunityHours', label: 'Original agent first refusal', hint: 'Hours before others may take it' },
  { key: 'retentionOverridesOwnershipDays', label: 'Retention beats ownership', hint: 'Days to expiry where retention wins' },
];

export const RenewalSlaConfigPanel: React.FC = () => {
  const { isManagement } = useIsManagement();
  const [cfg, setCfg] = useState<RenewalSlaConfig>(() => getRenewalSlaConfig());
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeRenewalSlaConfig(() => setCfg(getRenewalSlaConfig())), []);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" /> Ownership SLA settings
          </span>
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Show'}
          </Button>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Every renewal badge, queue and drawer reads these numbers, so changing them here changes the
            whole sandbox at once. Sandbox settings are saved on this device only.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={cfg[f.key]}
                  disabled={!isManagement}
                  onChange={(e) => setRenewalSlaConfig({ [f.key]: Number(e.target.value) || 0 } as Partial<RenewalSlaConfig>)}
                  className="h-8"
                />
                <p className="text-[11px] text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={resetRenewalSlaConfig} disabled={!isManagement}>
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

export default RenewalSlaConfigPanel;
