import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Zap, PauseCircle, Lock, User, Ban } from 'lucide-react';
import { PresenceBadge } from './PresenceBadge';
import { useLeadDistribution } from '@/hooks/useLeadDistribution';
import { useEnhancedPresence } from '@/hooks/useEnhancedPresence';
import { useAdminConfig } from '@/hooks/useAdminConfig';
import { supabase } from '@/integrations/supabase/client';

interface SalesExecutiveHeaderProps {
  onLeadClaimed?: (leadId: string) => void;
}

export const SalesExecutiveHeader: React.FC<SalesExecutiveHeaderProps> = ({
  onLeadClaimed
}) => {
  const {
    currentAgentCap,
    todayLeadCounts,
    claimNextLead,
    loading
  } = useLeadDistribution();

  const { value: allowSelfAssign } = useAdminConfig('allow_agent_self_assign');

  const { status, isActive, lastInteractionAt } = useEnhancedPresence();

  const [claiming, setClaiming] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // Fetch current user info for personalized greeting
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('first_name, email')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (adminUser) {
          const firstName = adminUser.first_name || adminUser.email?.split('@')[0] || '';
          setCurrentUserName(firstName);
          setCurrentUserEmail(adminUser.email);
        }
      }
    };
    fetchCurrentUser();
  }, []);

  const assignedToday = currentAgentCap ? (todayLeadCounts[currentAgentCap.admin_user_id] || 0) : 0;
  const dailyCap = currentAgentCap?.daily_cap; // NULL = unlimited
  const hasUnlimitedCap = dailyCap === null || dailyCap === undefined;
  const capReached = !hasUnlimitedCap && assignedToday >= dailyCap;
  const progressPercent = hasUnlimitedCap ? 0 : (dailyCap > 0 ? (assignedToday / dailyCap) * 100 : 0);
  
  // Use the paused status from agent_distribution_caps (set by admins)
  // This is the authoritative source that the RPC function checks
  const isPausedByAdmin = currentAgentCap?.paused ?? false;
  const isSelfAssignBlocked = allowSelfAssign === false;

  const canClaim = isActive && !capReached && !isPausedByAdmin && !isSelfAssignBlocked;

  const handleClaimLead = async () => {
    if (!canClaim) return;
    
    setClaiming(true);
    const leadId = await claimNextLead();
    setClaiming(false);

    if (leadId && onLeadClaimed) {
      onLeadClaimed(leadId);
    }
  };

  const getClaimButtonText = () => {
    if (isSelfAssignBlocked) return 'Self-assign disabled';
    if (capReached) return 'Daily cap reached';
    if (!isActive) return 'Become active to claim';
    if (isPausedByAdmin) return 'Paused by admin';
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
            {hasUnlimitedCap ? (
              <span className="text-muted-foreground text-xs ml-1">leads today (no limit)</span>
            ) : (
              <>
                <span className="text-muted-foreground"> of </span>
                <span className="font-semibold">{dailyCap}</span>
                <span className="text-muted-foreground text-xs ml-1">today</span>
              </>
            )}
          </div>
          {!hasUnlimitedCap && <Progress value={progressPercent} className="w-24 h-2" />}
          {capReached && (
            <Badge variant="secondary" className="text-xs">
              Cap reached
            </Badge>
          )}
        </div>
      </div>

      {/* Center: Personalized greeting with user identity */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full">
        <User className="h-3.5 w-3.5 text-primary" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            Hi {currentUserName}! Your assigned leads
          </span>
          {currentUserEmail && (
            <span className="text-[10px] text-muted-foreground leading-tight">
              {currentUserEmail}
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Self-assign blocked warning */}
        {isSelfAssignBlocked && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Ban className="h-3 w-3" />
            Self-assign disabled
          </Badge>
        )}
        {/* Paused by admin warning */}
        {isPausedByAdmin && !isSelfAssignBlocked && (
          <Badge variant="destructive" className="gap-1 text-xs">
            <PauseCircle className="h-3 w-3" />
            Paused by Admin
          </Badge>
        )}

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
