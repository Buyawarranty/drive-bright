import React from 'react';
import { History, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useCustomerAssignmentHistory } from '@/hooks/useCustomerAssignmentHistory';
import { cn } from '@/lib/utils';

interface Props {
  email?: string | null;
  phone?: string | null;
}

const fmt = (iso: string) => format(new Date(iso), 'dd MMM yyyy · HH:mm');

/**
 * Read-only ownership trail for commission reconciliation:
 * who was originally given this customer's lead, when, and every handover since.
 */
export const CustomerAssignmentHistoryPanel: React.FC<Props> = ({ email, phone }) => {
  const { entries, loading, refresh, original } = useCustomerAssignmentHistory(email, phone);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Lead ownership history</h3>
          <span className="text-xs font-semibold text-muted-foreground">({entries.length})</span>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="text-[11px] font-medium text-muted-foreground">Originally given to</div>
          <div className="text-sm font-semibold text-foreground mt-0.5">
            {original ? original.assignedToName : loading ? 'Loading…' : 'No assignment record found'}
          </div>
          {original && (
            <div className="text-xs text-muted-foreground mt-0.5">{fmt(original.at)}</div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-semibold px-3 py-2">#</th>
                <th className="text-left font-semibold px-3 py-2">Date &amp; time given</th>
                <th className="text-left font-semibold px-3 py-2">Given to</th>
                <th className="text-left font-semibold px-3 py-2">Taken from</th>
                <th className="text-left font-semibold px-3 py-2">How</th>
                <th className="text-left font-semibold px-3 py-2">Reason</th>
                <th className="text-left font-semibold px-3 py-2">Worked</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {loading
                      ? 'Loading ownership history…'
                      : 'No lead assignment records match this customer yet.'}
                  </td>
                </tr>
              )}
              {entries.map((e, i) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmt(e.at)}</td>
                  <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{e.assignedToName}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {e.previousAssignedToName || '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground capitalize whitespace-nowrap">
                    {(e.assignmentType || 'assignment').replace(/_/g, ' ')}
                    {e.assignedBy ? ` · ${e.assignedBy}` : ''}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.reason || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.wasWorked == null ? '—' : e.wasWorked ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Kept for commission reconciliation. The first row is the agent the lead was originally given to;
          each later row is a handover with the exact date and time.
        </p>
      </div>
    </div>
  );
};

export default CustomerAssignmentHistoryPanel;
