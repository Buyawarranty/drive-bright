import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings2, Users, AlertCircle, UserCheck } from 'lucide-react';
import { useLeadDistribution } from '@/hooks/useLeadDistribution';
import { AgentCapsPanel } from './AgentCapsPanel';
import { PresenceBadge } from './PresenceBadge';

interface LeadDistributionControlBarProps {
  salesUsers: Array<{ id: string; email: string; first_name?: string | null; last_name?: string | null }>;
}

export const LeadDistributionControlBar: React.FC<LeadDistributionControlBarProps> = ({
  salesUsers
}) => {
  const {
    settings,
    agentCaps,
    agentPresences,
    overflowRecipients,
    todayLeadCounts,
    loading,
    updateSettings,
    updateAgentCap,
    toggleAgentPause,
    deleteAgentFromDistribution,
    getAgentPresenceStatus,
    initializeAgentCaps,
    addOverflowRecipient,
    removeOverflowRecipient
  } = useLeadDistribution();

  const [capsSheetOpen, setCapsSheetOpen] = useState(false);

  // Count active/idle/offline agents
  const agentCounts = React.useMemo(() => {
    const counts = { active: 0, idle: 0, offline: 0 };
    agentCaps.forEach(cap => {
      const status = getAgentPresenceStatus(cap.admin_user_id);
      counts[status]++;
    });
    return counts;
  }, [agentCaps, getAgentPresenceStatus]);

  // Get overflow recipient names
  const overflowNames = React.useMemo(() => {
    return overflowRecipients.map(r => {
      const user = salesUsers.find(u => u.id === r.admin_user_id);
      return user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email || 'Unknown';
    });
  }, [overflowRecipients, salesUsers]);

  // Get solo agent name
  const soloAgentName = React.useMemo(() => {
    if (!settings?.solo_agent_id) return null;
    const user = salesUsers.find(u => u.id === settings.solo_agent_id);
    if (!user) return null;
    return user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email;
  }, [settings?.solo_agent_id, salesUsers]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-4 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/30 border rounded-lg mb-4">
      {/* Left: Distribution Settings */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Lead Distribution</span>
        </div>

        {/* Active-only toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="active-only"
            checked={settings?.active_only_distribution ?? true}
            onCheckedChange={(checked) => updateSettings({ active_only_distribution: checked })}
          />
          <Label htmlFor="active-only" className="text-xs text-muted-foreground cursor-pointer">
            Active-only
          </Label>
          <Tooltip>
            <TooltipTrigger>
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              When enabled, leads are only auto-assigned to agents who are actively using the dashboard (interaction within 90 seconds).
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Solo mode toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="solo-mode"
            checked={settings?.solo_mode_enabled ?? false}
            onCheckedChange={(checked) => updateSettings({ solo_mode_enabled: checked })}
          />
          <Label htmlFor="solo-mode" className="text-xs text-muted-foreground cursor-pointer">
            Solo mode
          </Label>
        </div>

        {/* Solo agent selector (only if solo mode enabled) */}
        {settings?.solo_mode_enabled && (
          <Select
            value={settings?.solo_agent_id || ''}
            onValueChange={(value) => updateSettings({ solo_agent_id: value || null })}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Select solo agent" />
            </SelectTrigger>
            <SelectContent>
              {salesUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Overflow recipients count */}
        {!settings?.solo_mode_enabled && overflowRecipients.length > 0 && (
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground">Overflow:</Label>
            <Badge variant="secondary" className="text-xs">
              {overflowRecipients.length} recipient{overflowRecipients.length > 1 ? 's' : ''}
            </Badge>
          </div>
        )}
      </div>

      {/* Center: Presence summary */}
      <div className="flex items-center gap-3 px-4 border-l border-r">
        <div className="flex items-center gap-1.5">
          <PresenceBadge status="active" size="sm" />
          <span className="text-xs font-medium">{agentCounts.active}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <PresenceBadge status="idle" size="sm" />
          <span className="text-xs font-medium">{agentCounts.idle}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <PresenceBadge status="offline" size="sm" />
          <span className="text-xs font-medium">{agentCounts.offline}</span>
        </div>
      </div>

      {/* Right: Caps panel trigger */}
      <div className="flex items-center gap-2 ml-auto">
        {overflowNames.length > 0 && !settings?.solo_mode_enabled && (
          <Badge variant="secondary" className="text-xs">
            <UserCheck className="h-3 w-3 mr-1" />
            Overflow: {overflowNames.join(', ')}
          </Badge>
        )}

        {settings?.solo_mode_enabled && soloAgentName && (
          <Badge variant="outline" className="text-xs bg-primary/10">
            <UserCheck className="h-3 w-3 mr-1" />
            Solo: {soloAgentName}
          </Badge>
        )}

        <Sheet open={capsSheetOpen} onOpenChange={setCapsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Agent Caps</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Agent Distribution Caps</SheetTitle>
              <SheetDescription>
                Set daily lead caps and manage agent availability for round-robin distribution.
              </SheetDescription>
            </SheetHeader>
            <AgentCapsPanel
              agentCaps={agentCaps}
              agentPresences={agentPresences}
              salesUsers={salesUsers}
              onUpdateCap={updateAgentCap}
              onTogglePause={toggleAgentPause}
              onDeleteAgent={deleteAgentFromDistribution}
              getAgentPresenceStatus={getAgentPresenceStatus}
              onInitializeCaps={initializeAgentCaps}
              overflowRecipientId={settings?.overflow_recipient_id}
              onOverflowChange={(id) => updateSettings({ overflow_recipient_id: id })}
              todayLeadCounts={todayLeadCounts}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};
