import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Download } from 'lucide-react';
import { format } from 'date-fns';
import type { SandboxRow } from './types';
import { analyseRenewals, downloadCsv, renewalsReportCsv } from './renewalAnalytics';

/**
 * RENEWALS SANDBOX — reporting groundwork (Stage 8, Step 24)
 * Segments the rows in view and exports the row-level shape the live report will use.
 */

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

export const RenewalAnalyticsPanel: React.FC<{ rows: SandboxRow[] }> = ({ rows }) => {
  const a = useMemo(() => analyseRenewals(rows), [rows]);

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4" /> Renewal reporting
          <Badge variant="secondary">Sandbox</Badge>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={!rows.length}
            onClick={() => downloadCsv(`renewals-report-${format(new Date(), 'yyyy-MM-dd')}.csv`, renewalsReportCsv(rows))}
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Export rows
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {a.segments.map((s) => (
            <div key={s.id} className="rounded-md border p-2" title={s.hint}>
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 font-semibold">{s.count.toLocaleString('en-GB')}</div>
              <div className="text-xs text-muted-foreground">{money(s.value)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>Total value in view: <span className="font-medium text-foreground">{money(a.totalValue)}</span></span>
          <span>Average offer: <span className="font-medium text-foreground">{money(a.averageOffer)}</span></span>
          <span>SLA missed: <span className="font-medium text-foreground">{a.slaBreached}</span></span>
          <span>No owner: <span className="font-medium text-foreground">{a.unowned}</span></span>
          <span>Callback protected: <span className="font-medium text-foreground">{a.callbackProtected}</span></span>
        </div>

        <p className="text-xs text-muted-foreground">
          Figures cover the renewals currently loaded in the band above, priced by the live quote engine. Nothing is
          written; the export is the same column set the live renewals report will use.
        </p>
      </CardContent>
    </Card>
  );
};

export default RenewalAnalyticsPanel;
