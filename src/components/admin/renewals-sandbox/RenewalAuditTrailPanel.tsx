import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, Download, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  AUDIT_ACTION_LABEL,
  auditTrailCsv,
  clearAuditTrail,
  getAuditTrail,
  subscribeAuditTrail,
  type RenewalAuditEntry,
} from './renewalAudit';
import { downloadCsv } from './renewalAnalytics';

/**
 * RENEWALS SANDBOX — audit trail (Stage 8, Step 23)
 * Local, capped record of every sandbox decision. Nothing is written to the database.
 */

export const RenewalAuditTrailPanel: React.FC = () => {
  const [entries, setEntries] = useState<RenewalAuditEntry[]>(() => getAuditTrail());

  useEffect(() => subscribeAuditTrail(() => setEntries([...getAuditTrail()])), []);

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4" /> Audit trail
          <Badge variant="secondary">Sandbox</Badge>
          <span className="text-xs text-muted-foreground">{entries.length} entries</span>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={!entries.length}
              onClick={() => downloadCsv(`renewals-audit-${format(new Date(), 'yyyy-MM-dd')}.csv`, auditTrailCsv(entries))}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" variant="ghost" disabled={!entries.length} onClick={clearAuditTrail}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No sandbox activity recorded yet. Opening a renewal, offering a price, requesting a discount or running the
            completion checks will appear here.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/70 text-left">
                <tr>
                  <th className="px-2 py-1 font-medium">When</th>
                  <th className="px-2 py-1 font-medium">Action</th>
                  <th className="px-2 py-1 font-medium">Renewal</th>
                  <th className="px-2 py-1 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 60).map((e) => (
                  <tr key={e.id} className="border-t align-top">
                    <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                      {format(new Date(e.at), 'd MMM HH:mm')}
                    </td>
                    <td className="px-2 py-1">{AUDIT_ACTION_LABEL[e.action] || e.action}</td>
                    <td className="px-2 py-1">
                      <div>{e.customerName || '—'}</div>
                      <div className="text-muted-foreground">{e.policyNumber || ''}</div>
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {e.detail}
                      {typeof e.amount === 'number' ? ` · £${e.amount.toLocaleString('en-GB')}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Entries are held on this device only. When the engine goes live these same fields become permanent rows against
          the renewal, so history is never lost.
        </p>
      </CardContent>
    </Card>
  );
};

export default RenewalAuditTrailPanel;
