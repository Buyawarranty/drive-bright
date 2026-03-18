import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowRight } from 'lucide-react';
import { AdminUser } from '@/hooks/useLeads';
import { getInitials, getDisplayName } from './AgentSelector';
import { ReassignMode } from './ModeSelector';

interface ConfirmationStepProps {
  fromUser: AdminUser;
  toUsers: AdminUser[];
  leadCount: number;
  mode: ReassignMode;
  percentage?: number;
  moveCount?: number;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  fromUser,
  toUsers,
  leadCount,
  mode,
  percentage,
  moveCount,
}) => {
  const actualMoving = mode === 'percentage'
    ? Math.ceil((leadCount * (percentage || 50)) / 100)
    : mode === 'count'
      ? Math.min(moveCount || 0, leadCount)
      : leadCount;

  const description = mode === 'all'
    ? `record${leadCount !== 1 ? 's' : ''} (leads + customers) will be transferred`
    : mode === 'cherry_pick'
      ? `selected lead${leadCount !== 1 ? 's' : ''} will be transferred${toUsers.length > 1 ? ' (split evenly)' : ''}`
      : mode === 'percentage'
        ? `of ${leadCount} total leads (${percentage}%) will be transferred — newest first`
        : `of ${leadCount} total leads will be transferred — newest first`;

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-center gap-4 py-4">
        <div className="text-center">
          <Avatar className="h-12 w-12 mx-auto mb-2">
            <AvatarFallback className="bg-destructive/10 text-destructive font-semibold">
              {getInitials(fromUser)}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium">{getDisplayName(fromUser)}</p>
        </div>
        <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
        <div className="text-center flex gap-2">
          {toUsers.map(u => (
            <div key={u.id} className="text-center">
              <Avatar className="h-12 w-12 mx-auto mb-2">
                <AvatarFallback className="bg-green-100 text-green-700 font-semibold">
                  {getInitials(u)}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium">{getDisplayName(u)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-muted/50 rounded-lg p-4 text-center border-2 border-border">
        <p className="text-2xl font-bold text-foreground">{actualMoving}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        ⚠️ This will only change the assigned agent. All statuses, notes, call counts, and other data remain untouched.
      </p>
    </div>
  );
};
