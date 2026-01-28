import React, { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Plus, Minus, AlertTriangle, ClipboardList } from 'lucide-react';
import { Lead, LeadStatus } from '@/hooks/useLeads';
import { CallAttemptDialog } from './CallAttemptDialog';
import { CallOutcome, useLeadCallTracking } from '@/hooks/useLeadCallTracking';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CallCountCellProps {
  lead: Lead;
  onUpdateCallCount: (increment: number) => void;
  onUpdateStatus: (status: LeadStatus) => void;
  onScheduleFollowUp: (actionType: string, actionDate: string) => void;
  onLogActivity: (type: string, description: string) => void;
  agentId?: string;
  agentName?: string;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'follow_up', label: 'Follow Up Later' },
  { value: 'lost', label: 'Unreachable' },
];

export const CallCountCell: React.FC<CallCountCellProps> = memo(({
  lead,
  onUpdateCallCount,
  onUpdateStatus,
  onScheduleFollowUp,
  onLogActivity,
  agentId,
  agentName
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { settings, logCallAttempt } = useLeadCallTracking();

  const callCount = lead.call_count || 0;
  const isMaxReached = callCount >= settings.max_call_attempts;
  const isNearMax = callCount === settings.max_call_attempts - 1;

  const displayName = lead.first_name || lead.last_name 
    ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    : lead.full_name || lead.email;

  // Quick increment without dialog
  const handleQuickIncrement = async () => {
    if (isMaxReached) {
      toast.warning(`Max call attempts reached (${settings.max_call_attempts}). Move lead to next status.`);
      return;
    }
    
    const newAttemptNumber = callCount + 1;
    
    // Log the call attempt with default outcome
    const { success } = await logCallAttempt({
      leadId: lead.id,
      attemptNumber: newAttemptNumber,
      outcome: 'no_answer',
      notes: '',
      agentId,
      agentName
    });

    if (success) {
      onUpdateCallCount(1);
      onLogActivity('call_attempt', `Call attempt #${newAttemptNumber}: no answer`);
      toast.success(`Call Attempts: ${newAttemptNumber}`);
    }
  };

  // Open dialog for detailed logging
  const handleOpenDialog = () => {
    if (isMaxReached) {
      toast.warning(`Max call attempts reached (${settings.max_call_attempts}). Move lead to next status.`);
      return;
    }
    setDialogOpen(true);
  };

  const handleCallSubmit = async (outcome: CallOutcome, notes: string) => {
    const newAttemptNumber = callCount + 1;

    // Log the call attempt
    const { success, nextFollowUpDate } = await logCallAttempt({
      leadId: lead.id,
      attemptNumber: newAttemptNumber,
      outcome,
      notes,
      agentId,
      agentName
    });

    if (success) {
      // Increment the call count
      onUpdateCallCount(1);

      // Log activity
      onLogActivity('call_attempt', `Call attempt #${newAttemptNumber}: ${outcome.replace('_', ' ')}${notes ? ` - ${notes}` : ''}`);

      // Schedule follow-up if suggested
      if (nextFollowUpDate && (outcome === 'no_answer' || outcome === 'voicemail' || outcome === 'busy')) {
        onScheduleFollowUp('call', nextFollowUpDate.toISOString());
      }

      toast.success(`Call Attempts updated to ${newAttemptNumber}`, {
        description: outcome === 'connected' ? 'Great job!' : 'Follow-up scheduled'
      });
    }
  };

  const handleStatusChange = (status: LeadStatus) => {
    onUpdateStatus(status);
    onLogActivity('status_change', `Status changed to ${status} after ${callCount} call attempts`);
  };

  return (
    <>
      <div className="flex items-center justify-center gap-0.5">
        {/* Decrement button */}
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-50"
              onClick={() => onUpdateCallCount(-1)}
              disabled={callCount <= 0}
            >
              <Minus className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Decrease count</TooltipContent>
        </Tooltip>

        {/* Call count display */}
        <div className="relative">
          <span className={cn(
            "min-w-[24px] text-center text-sm font-medium inline-block",
            callCount === 0 && "text-muted-foreground",
            callCount > 0 && callCount < settings.max_call_attempts && "text-primary",
            isMaxReached && "text-red-600"
          )}>
            {callCount}
          </span>
          {isMaxReached && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <span className="absolute -top-1 -right-2">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-xs">
                Max call attempts reached ({settings.max_call_attempts}). Move lead to next status or schedule nurture.
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* +1 Call button or status change */}
        {isMaxReached ? (
          <Select onValueChange={(value) => handleStatusChange(value as LeadStatus)}>
            <SelectTrigger className="w-[90px] h-6 text-[10px] border-amber-300 bg-amber-50 text-amber-700">
              <SelectValue placeholder="Move to..." />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            {/* Quick +1 button (no dialog) */}
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 hover:bg-green-50",
                    isNearMax 
                      ? "text-amber-600 hover:text-amber-700" 
                      : "text-green-600 hover:text-green-700"
                  )}
                  onClick={handleQuickIncrement}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {isNearMax ? 'Last attempt before max' : 'Quick +1 call'}
              </TooltipContent>
            </Tooltip>
            
            {/* Detailed log button (opens dialog) */}
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={handleOpenDialog}
                >
                  <ClipboardList className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Log with details
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Call Attempt Dialog */}
      <CallAttemptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leadName={displayName}
        currentCallCount={callCount}
        maxCallAttempts={settings.max_call_attempts}
        followUpIntervals={settings.call_follow_up_intervals}
        onSubmit={handleCallSubmit}
      />
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.call_count === nextProps.lead.call_count &&
    prevProps.lead.status === nextProps.lead.status
  );
});

CallCountCell.displayName = 'CallCountCell';
