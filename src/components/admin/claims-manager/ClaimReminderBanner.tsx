import React, { useState } from 'react';
import { Bell, X, AlertTriangle } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { useDueReminders } from '@/hooks/useDueReminders';

/**
 * Top-of-page banner for CLAIM reminders that are due.
 * Shows a stacked, dismissible banner strip so the user cannot miss a
 * reminder while working the Claims workbench.
 */
export const ClaimReminderBanner: React.FC<{ onOpenClaim?: (claimId: string) => void }> = ({ onOpenClaim }) => {
  const { dueReminders, dismissReminder } = useDueReminders();
  const [collapsed, setCollapsed] = useState(false);

  const claimReminders = dueReminders.filter((r) => r.lead_id.startsWith('claim_'));
  if (claimReminders.length === 0) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="w-full flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <Bell className="h-3.5 w-3.5" />
          {claimReminders.length} claim reminder{claimReminders.length === 1 ? '' : 's'} due — click to expand
        </span>
        <span className="text-amber-600">▾</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-amber-200 px-3 py-1.5">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-800">
          <Bell className="h-4 w-4" />
          Claim reminders due ({claimReminders.length})
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-amber-700 hover:bg-amber-100"
          title="Collapse"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="divide-y divide-amber-100">
        {claimReminders.slice(0, 8).map((r) => {
          const claimId = r.lead_id.replace('claim_', '');
          const overdueMin = differenceInMinutes(new Date(), new Date(r.reminder_time));
          const isOverdue = overdueMin > 5;
          const name = [r.lead?.first_name, r.lead?.last_name].filter(Boolean).join(' ').trim()
            || r.lead?.vehicle_reg
            || r.lead?.email
            || 'Claim';
          return (
            <li key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              {isOverdue ? (
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <Bell className="h-4 w-4 text-amber-500 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onOpenClaim?.(claimId)}
                className="flex-1 text-left truncate hover:underline"
              >
                <span className="font-semibold text-slate-800">{name}</span>
                {r.lead?.vehicle_reg && <span className="ml-1.5 text-xs text-slate-500">· {r.lead.vehicle_reg}</span>}
                <span className="ml-1.5 text-xs text-slate-500">
                  · {r.label || 'Follow up'} · {format(new Date(r.reminder_time), 'h:mm a')}
                  {isOverdue && <span className="ml-1 font-semibold text-red-600">({overdueMin}m late)</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => dismissReminder(r.id)}
                className="rounded p-1 text-amber-600 hover:bg-amber-100"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ClaimReminderBanner;
