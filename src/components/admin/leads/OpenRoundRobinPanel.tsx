import React from 'react';
import { Repeat, AlertTriangle, ListChecks } from 'lucide-react';

/**
 * Open Round Robin — Team Blue Beta.
 *
 * Documentation/status panel that lives in the Lead Allocation page.
 * The distribution behaviour itself is unchanged — this component only
 * surfaces the rules and current live status to managers/leads so the
 * team is on the same page about how Team Blue's flow works.
 *
 * IMPORTANT: this is NOT an open lead pool. Leads are automatically
 * distributed one-at-a-time to available Team Blue agents (fair-fill
 * round robin). Team Red flow is untouched.
 */
export const OpenRoundRobinPanel: React.FC = () => {
  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50/40 shadow-sm">
      <div className="px-5 py-4 border-b border-blue-200 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Repeat className="h-4 w-4 text-blue-700 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground">
                Open Round Robin · Team Blue Beta
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-600 text-white">
                Beta
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              New enquiries are automatically assigned to available Team Blue
              agents one at a time. Start the first call within 2 minutes to
              keep the lead.
            </p>
          </div>
        </div>
      </div>

      {/* Live status banner */}
      <div className="px-5 py-3 border-b border-blue-200 bg-blue-100/60 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-blue-800 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-900">
          <strong>Open Round Robin is live for Team Blue only.</strong> If the
          first call is not started within 2 minutes, the lead returns to the
          queue and is assigned to the next available agent.
        </p>
      </div>

      {/* Rules panel */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Open Round Robin Rules
          </h3>
        </div>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-foreground/90">
          <li>
            <strong>First call window:</strong> 2 minutes
          </li>
          <li>
            <strong>If no call starts:</strong> lead is reassigned
          </li>
          <li>
            <strong>If no answer:</strong> 10-minute retry window
          </li>
          <li>
            <strong>If retry is missed:</strong> lead returns to the Open Round
            Robin queue
          </li>
          <li>
            <strong>After 7 contact attempts:</strong> lead becomes dormant
          </li>
        </ol>
        <p className="text-[11px] text-muted-foreground mt-3">
          Team Red flow is unchanged. This panel only documents how leads move
          through the Team Blue Open Round Robin queue.
        </p>
      </div>
    </section>
  );
};

export default OpenRoundRobinPanel;
