import React, { useMemo, useState } from 'react';
import { UserCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRepeatCustomers } from '@/hooks/useRepeatCustomers';

interface BannerLead {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  vehicle_reg?: string | null;
  assigned_to?: string | null;
  status?: string | null;
}

interface RepeatCustomerBannerProps {
  leads: BannerLead[];
  /** The signed-in agent — used to show "your" repeat customers first. */
  currentAdminId?: string | null;
  /** Managers see repeat customers across the whole visible list. */
  isManager?: boolean;
  /** Resolves an agent id to a display name (managers only). */
  agentNameById?: (id: string) => string | undefined;
  onSelectLead?: (leadId: string) => void;
}

const leadName = (l: BannerLead) =>
  (l.full_name || [l.first_name, l.last_name].filter(Boolean).join(' ')).trim() ||
  l.email ||
  l.vehicle_reg ||
  'Unnamed lead';

/**
 * Top-of-page banner telling the agent, by name, which of the leads in front of
 * them are returning customers — pairs with the REPEAT tag on each row.
 */
export const RepeatCustomerBanner: React.FC<RepeatCustomerBannerProps> = ({
  leads,
  currentAdminId,
  isManager = false,
  agentNameById,
  onSelectLead,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { repeatByLeadId } = useRepeatCustomers(
    leads.map(l => ({ id: l.id, email: l.email, vehicle_reg: l.vehicle_reg, created_at: (l as any).created_at }))
  );

  const matches = useMemo(() => {
    const rows = leads
      .filter(l => repeatByLeadId[l.id])
      .filter(l => (isManager ? true : !l.assigned_to || l.assigned_to === currentAdminId));
    // Mine first, then everyone else.
    return rows.sort((a, b) => {
      const aMine = a.assigned_to === currentAdminId ? 0 : 1;
      const bMine = b.assigned_to === currentAdminId ? 0 : 1;
      return aMine - bMine;
    });
  }, [leads, repeatByLeadId, isManager, currentAdminId]);

  if (matches.length === 0) return null;

  const visible = expanded ? matches : matches.slice(0, 3);

  return (
    <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <UserCheck className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            {matches.length === 1
              ? '1 repeat customer in your leads'
              : `${matches.length} repeat customers in your leads`}
            <span className="font-normal"> — they have bought from us before, so they stay with their original agent.</span>
          </div>

          <ul className="mt-2 space-y-1">
            {visible.map(l => {
              const info = repeatByLeadId[l.id];
              const owner = l.assigned_to === currentAdminId
                ? 'you'
                : (l.assigned_to ? (agentNameById?.(l.assigned_to) || 'another agent') : 'unassigned');
              return (
                <li key={l.id} className="flex items-center gap-2 flex-wrap text-xs text-emerald-900 dark:text-emerald-100">
                  <Badge className="bg-emerald-600 text-white border-0 text-[10px] px-1.5 py-0.5">REPEAT</Badge>
                  <button
                    type="button"
                    className="font-semibold underline-offset-2 hover:underline"
                    onClick={() => onSelectLead?.(l.id)}
                  >
                    {leadName(l)}
                  </button>
                  {l.vehicle_reg && <span className="font-mono uppercase">{l.vehicle_reg}</span>}
                  <span className="opacity-80">
                    {info.policyCount > 1 ? `${info.policyCount} previous policies` : '1 previous policy'}
                    {info.lastPurchaseAt ? ` · last bought ${format(new Date(info.lastPurchaseAt), 'dd/MM/yyyy')}` : ''}
                    {info.lastPlanType ? ` · ${info.lastPlanType}` : ''}
                  </span>
                  <span className="opacity-70">· with {owner}</span>
                </li>
              );
            })}
          </ul>

          {matches.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-7 px-2 text-xs text-emerald-800 dark:text-emerald-200"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {expanded ? 'Show fewer' : `Show all ${matches.length}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
