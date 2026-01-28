import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, PauseCircle, Lock } from 'lucide-react';
import { PresenceBadge } from './PresenceBadge';
import { useLeadDistribution } from '@/hooks/useLeadDistribution';
import { useEnhancedPresence } from '@/hooks/useEnhancedPresence';

interface SalesExecutiveHeaderProps {
  onLeadClaimed?: (leadId: string) => void;
}

export const SalesExecutiveHeader: React.FC<SalesExecutiveHeaderProps> = ({
  onLeadClaimed
}) => {
  const {
    currentAgentCap,
    claimNextLead,
    togglePauseReceiving,
    loading
  } = useLeadDistribution();

  const { status, isActive, lastInteractionAt } = useEnhancedPresence();

  const [claiming, setClaiming] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);

  const assignedToday = currentAgentCap?.assigned_today ?? 0;
  const dailyCap = currentAgentCap?.daily_cap ?? 20;
  const capReached = assignedToday >= dailyCap;
  const progressPercent = dailyCap > 0 ? (assignedToday / dailyCap) * 100 : 0;

  const canClaim = isActive && !capReached && !isPaused;

  const handleClaimLead = async () => {
    if (!canClaim) return;
    
    setClaiming(true);
    const leadId = await claimNextLead();
    setClaiming(false);

    if (leadId && onLeadClaimed) {
      onLeadClaimed(leadId);
    }
  };

  const handleTogglePause = async () => {
    const success = await togglePauseReceiving();
    if (success) {
      setIsPaused(!isPaused);
    }
  };

  const getClaimButtonText = () => {
    if (capReached) return 'Daily cap reached';
    if (!isActive) return 'Become active to claim';
    if (isPaused) return 'Resume to claim';
    return 'Get Next Lead';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-4 p-3 bg-muted/30 border rounded-lg mb-4 animate-pulse">
        <div className="h-6 w-24 bg-muted rounded" />
        <div className="h-6 w-32 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 bg-gradient-to-r from-primary/5 to-transparent border rounded-lg mb-4">
      {/* Left: Status and cap */}
      <div className="flex items-center gap-4">
        {/* Presence badge */}
        <div className="flex items-center gap-2">
          <PresenceBadge
            status={status}
            showLabel
            size="md"
            lastInteractionAt={lastInteractionAt}
          />
        </div>

        {/* Today's progress */}
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="font-semibold">{assignedToday}</span>
            <span className="text-muted-foreground"> of </span>
            <span className="font-semibold">{dailyCap}</span>
            <span className="text-muted-foreground text-xs ml-1">today</span>
          </div>
          <Progress value={progressPercent} className="w-24 h-2" />
          {capReached && (
            <Badge variant="secondary" className="text-xs">
              Cap reached
            </Badge>
          )}
        </div>
      </div>

      {/* Center: Locked filter indicator */}
      <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-full">
        <Lock className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Assigned to: Me</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Pause toggle */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Switch
                  id="pause-receiving"
                  checked={isPaused}
                  onCheckedChange={handleTogglePause}
                />
                <Label 
                  htmlFor="pause-receiving" 
                  className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  Pause receiving
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Temporarily stop receiving auto-assigned leads
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Get Next Lead button */}
        <Button
          onClick={handleClaimLead}
          disabled={!canClaim || claiming}
          className="gap-2"
          variant={canClaim ? 'default' : 'secondary'}
        >
          <Zap className={`h-4 w-4 ${claiming ? 'animate-pulse' : ''}`} />
          {claiming ? 'Claiming...' : getClaimButtonText()}
        </Button>
      </div>
    </div>
  );
};
