import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowRight } from 'lucide-react';
import { AdminUser } from '@/hooks/useLeads';
import { getInitials, getDisplayName } from './AgentSelector';
import { ReassignMode } from './ModeSelector';

interface ConfirmationStepProps {
  fromUsers: AdminUser[];
  toUsers: AdminUser[];
  leadCount: number;
  mode: ReassignMode;
  percentage?: number;
  moveCount?: number;
  requestedPerAgent?: number;
  leadsOnlyCount?: number;
  customersCount?: number;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  fromUsers,
  toUsers,
  leadCount,
  mode,
  percentage,
  moveCount,
  requestedPerAgent,
  leadsOnlyCount,
  customersCount,
}) => {
  const countModeRequestedTotal = mode === 'count'
    ? (requestedPerAgent || 0) * Math.max(1, toUsers.length)
    : 0;

  const actualMoving = mode === 'percentage'
    ? Math.ceil((leadCount * (percentage || 50)) / 100)
    : mode === 'count'
      ? Math.min(countModeRequestedTotal || moveCount || 0, leadCount)
      : leadCount;

  const showBreakdown = mode === 'all' && (customersCount || 0) > 0 && typeof leadsOnlyCount === 'number';

  const actualPerAgent = mode === 'count' && toUsers.length > 0
    ? Math.floor(actualMoving / toUsers.length)
    : 0;
  const requestedEach = requestedPerAgent || actualPerAgent;
  const countModeShortfall = mode === 'count' && countModeRequestedTotal > leadCount;

  const description = mode === 'all'
    ? `record${leadCount !== 1 ? 's' : ''} (leads + customers) will be transferred${toUsers.length > 1 ? ' (split evenly)' : ''}`
    : mode === 'cherry_pick'
      ? `selected lead${leadCount !== 1 ? 's' : ''} will be transferred${toUsers.length > 1 ? ' (split evenly)' : ''}`
      : mode === 'percentage'
        ? `of ${leadCount} total leads (${percentage}%) will be transferred${toUsers.length > 1 ? ' — split evenly, ' : ' — '}newest first`
        : countModeShortfall
          ? `only ${leadCount} lead${leadCount !== 1 ? 's are' : ' is'} available in the selected filters — requested ${requestedEach} each for ${toUsers.length} agent${toUsers.length !== 1 ? 's' : ''}`
          : `newest leads will be transferred — ${requestedEach} each to ${toUsers.length} agent${toUsers.length !== 1 ? 's' : ''} (${leadCount} available)`;


  const AvatarStack = ({ users, tone }: { users: AdminUser[]; tone: 'from' | 'to' }) => (
    <div className="flex flex-wrap gap-2 justify-center">
      {users.map(u => (
        <div key={u.id} className="text-center">
          <Avatar className="h-12 w-12 mx-auto mb-2">
            <AvatarFallback
              className={
                tone === 'from'
                  ? 'bg-destructive/10 text-destructive font-semibold'
                  : 'bg-green-100 text-green-700 font-semibold'
              }
            >
              {getInitials(u)}
            </AvatarFallback>
          </Avatar>
          <p className="text-xs font-medium max-w-[100px] truncate">{getDisplayName(u)}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-center gap-4 py-4 flex-wrap">
        <AvatarStack users={fromUsers} tone="from" />
        <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
        <AvatarStack users={toUsers} tone="to" />
      </div>
      <div className="bg-muted/50 rounded-lg p-4 text-center border-2 border-border">
        <p className="text-2xl font-bold text-foreground">{actualMoving}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {showBreakdown && (
          <p className="text-xs text-muted-foreground mt-2">
            = <strong>{leadsOnlyCount}</strong> lead{leadsOnlyCount !== 1 ? 's' : ''} + <strong>{customersCount}</strong> customer{customersCount !== 1 ? 's' : ''}
            <br />
            <span className="text-[11px]">The agent card shows leads only. Customers (paid policies) are transferred too in "All" mode.</span>
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        ⚠️ This will only change the assigned agent. All statuses, notes, call counts, and other data remain untouched.
      </p>
    </div>
  );
};
