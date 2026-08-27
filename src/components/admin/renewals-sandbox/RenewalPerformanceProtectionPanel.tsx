import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import type { SandboxRow } from './types';
import { PERFORMANCE_PROTECTION_RULES, splitRenewalPerformance } from './renewalPerformance';

/**
 * RENEWALS SANDBOX — performance protection (Stage 8, Step 22)
 * Shows how renewal activity is kept out of new-business figures.
 */

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

export const RenewalPerformanceProtectionPanel: React.FC<{ rows: SandboxRow[] }> = ({ rows }) => {
  const split = useMemo(() => splitRenewalPerformance(rows), [rows]);

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" /> Performance protection
          <Badge variant="secondary">Sandbox</Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Renewal opportunities', value: split.opportunities.toLocaleString('en-GB') },
            { label: 'Renewal revenue at stake', value: money(split.revenueAtStake) },
            { label: 'Win-back at stake', value: money(split.winBackAtStake) },
            { label: 'Commission if all renewed', value: money(split.commissionIfAllRenewed) },
          ].map((m) => (
            <div key={m.label} className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <div className="mt-0.5 font-semibold">{m.value}</div>
            </div>
          ))}
        </div>

        {split.byKind.length > 0 && (
          <div className="rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-2 py-1 font-medium">Counted as</th>
                  <th className="px-2 py-1 font-medium">Renewals</th>
                  <th className="px-2 py-1 font-medium">Revenue</th>
                  <th className="px-2 py-1 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {split.byKind.map((k) => (
                  <tr key={k.kind} className="border-t">
                    <td className="px-2 py-1">{k.label}</td>
                    <td className="px-2 py-1">{k.count}</td>
                    <td className="px-2 py-1">{money(k.revenue)}</td>
                    <td className="px-2 py-1">{money(k.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ul className="space-y-1 text-xs text-muted-foreground">
          {PERFORMANCE_PROTECTION_RULES.map((r) => (
            <li key={r.rule}>
              <span className="font-medium text-foreground">{r.rule}:</span> {r.detail}
            </li>
          ))}
        </ul>

        {split.needsReview > 0 && (
          <p className="text-xs text-amber-800">
            {split.needsReview} renewal{split.needsReview === 1 ? '' : 's'} in view need a manager decision before a price
            can be offered, so they are excluded from the figures above.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default RenewalPerformanceProtectionPanel;
