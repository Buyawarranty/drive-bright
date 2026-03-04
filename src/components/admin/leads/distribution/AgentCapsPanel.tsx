import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PresenceBadge } from './PresenceBadge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, UserPlus, Trash2, Info, Zap, AlertCircle, UserCheck, RotateCcw } from 'lucide-react';
import { AgentSchedulePanel } from './AgentSchedulePanel';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface AgentCap {
  id: string;
  admin_user_id: string;
  daily_cap: number;
  assigned_today: number;
  last_assigned_at: string | null;
  paused: boolean;
  admin_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

interface AgentPresence {
  admin_user_id: string;
  status: string;
  last_interaction_at: string | null;
  last_seen_at: string | null;
  is_paused_receiving: boolean;
}

interface AgentCapsPanelProps {
  agentCaps: AgentCap[];
  agentPresences: AgentPresence[];
  salesUsers: Array<{ id: string; email: string; first_name?: string | null; last_name?: string | null }>;
  onUpdateCap: (adminUserId: string, updates: Partial<AgentCap>) => Promise<boolean>;
  onTogglePause: (adminUserId: string) => Promise<boolean>;
  onDeleteAgent: (adminUserId: string) => Promise<boolean>;
  getAgentPresenceStatus: (adminUserId: string) => 'active' | 'idle' | 'offline';
  onInitializeCaps: () => Promise<void>;
  overflowRecipientId?: string | null;
  onOverflowChange?: (recipientId: string | null) => void;
  todayLeadCounts?: Record<string, number>;
}

export const AgentCapsPanel: React.FC<AgentCapsPanelProps> = ({
  agentCaps,
  agentPresences,
  salesUsers,
  onUpdateCap,
  onTogglePause,
  onDeleteAgent,
  getAgentPresenceStatus,
  onInitializeCaps,
  overflowRecipientId,
  onOverflowChange,
  todayLeadCounts = {}
}) => {
  const [editedCaps, setEditedCaps] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resettingCaps, setResettingCaps] = useState(false);

  const handleResetAllCaps = async () => {
    setResettingCaps(true);
    try {
      const { error } = await supabase.rpc('reset_agent_caps_daily');
      if (error) throw error;
      toast({ title: 'Caps reset', description: 'All agent counters have been reset to 0.' });
      // Trigger a refresh by updating a cap with no changes (parent will refetch)
      if (agentCaps.length > 0) {
        await onUpdateCap(agentCaps[0].admin_user_id, { assigned_today: 0 });
      }
    } catch (error) {
      console.error('Error resetting caps:', error);
      toast({ title: 'Error', description: 'Failed to reset caps.', variant: 'destructive' });
    }
    setResettingCaps(false);
  };

  const handleCapChange = (adminUserId: string, value: string) => {
    // Empty value = null (unlimited)
    if (value === '' || value.trim() === '') {
      setEditedCaps(prev => ({ ...prev, [adminUserId]: null as any }));
      return;
    }
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditedCaps(prev => ({ ...prev, [adminUserId]: numValue }));
    }
  };

  const handleSaveCap = async (adminUserId: string) => {
    const newCap = editedCaps[adminUserId];
    if (newCap === undefined) return;

    setSaving(adminUserId);
    const success = await onUpdateCap(adminUserId, { daily_cap: newCap });
    if (success) {
      setEditedCaps(prev => {
        const { [adminUserId]: _, ...rest } = prev;
        return rest;
      });
    }
    setSaving(null);
  };

  const handleTogglePause = async (adminUserId: string) => {
    setSaving(adminUserId);
    await onTogglePause(adminUserId);
    setSaving(null);
  };

  const handleDeleteAgent = async (adminUserId: string) => {
    setDeleting(adminUserId);
    await onDeleteAgent(adminUserId);
    setDeleting(null);
  };

  // Get agent name
  const getAgentName = (cap: AgentCap) => {
    if (cap.admin_user?.first_name) {
      return `${cap.admin_user.first_name} ${cap.admin_user.last_name || ''}`.trim();
    }
    return cap.admin_user?.email || 'Unknown';
  };

  // Get presence for agent
  const getPresence = (adminUserId: string) => {
    return agentPresences.find(p => p.admin_user_id === adminUserId);
  };

  // Get activity description
  const getActivityDescription = (adminUserId: string) => {
    const presence = getPresence(adminUserId);
    const status = getAgentPresenceStatus(adminUserId);
    
    if (!presence?.last_interaction_at) {
      return 'No recent activity';
    }
    
    const lastInteraction = new Date(presence.last_interaction_at);
    const timeAgo = formatDistanceToNow(lastInteraction, { addSuffix: true });
    
    if (status === 'active') {
      return `Working on leads now (last action ${timeAgo})`;
    } else if (status === 'idle') {
      return `Idle - last action ${timeAgo}`;
    }
    return `Offline - last seen ${timeAgo}`;
  };

  // Find unconfigured agents
  const configuredAgentIds = new Set(agentCaps.map(c => c.admin_user_id));
  const unconfiguredAgents = salesUsers.filter(u => !configuredAgentIds.has(u.id));

  return (
    <div className="mt-6 space-y-4">
      {/* Overflow Recipient Selector */}
      {onOverflowChange && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-3">
            <UserCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Overflow Recipient</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                When all agents hit their daily cap, extra leads go to this person (ignoring their cap).
              </p>
            </div>
          </div>
          <Select
            value={overflowRecipientId || 'none'}
            onValueChange={(value) => onOverflowChange(value === 'none' ? null : value)}
          >
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder="Select overflow recipient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (leads stay unassigned)</SelectItem>
              {salesUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Active Status Explanation */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <p className="font-medium">What does "Active" mean?</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-300">
              <li><strong className="text-green-600">Active (green)</strong>: Agent clicked, scrolled or typed within the last 90 seconds — they're actively working leads</li>
              <li><strong className="text-yellow-600">Idle (yellow)</strong>: No interaction for 90 seconds to 5 minutes — browser open but not working</li>
              <li><strong className="text-gray-500">Offline (gray)</strong>: No interaction for 5+ minutes or tab closed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Agent Settings</h4>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetAllCaps} 
            disabled={resettingCaps}
            className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${resettingCaps ? 'animate-spin' : ''}`} />
            Reset Counters
          </Button>
          {unconfiguredAgents.length > 0 && (
            <Button variant="outline" size="sm" onClick={onInitializeCaps} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Unconfigured Agents ({unconfiguredAgents.length})
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Agent list */}
      <div className="space-y-3">
        {agentCaps.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No agent caps configured.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onInitializeCaps}>
              Initialize Agent Caps
            </Button>
          </div>
        ) : (
          agentCaps.map(cap => {
            const presence = getPresence(cap.admin_user_id);
            const status = getAgentPresenceStatus(cap.admin_user_id);
            const hasUnlimitedCap = cap.daily_cap === null;
            const actualToday = todayLeadCounts[cap.admin_user_id] || 0;
            const progressPercent = hasUnlimitedCap ? 0 : (cap.daily_cap > 0 ? (actualToday / cap.daily_cap) * 100 : 0);
            const editedCap = editedCaps[cap.admin_user_id];
            const hasChanges = editedCap !== undefined && editedCap !== cap.daily_cap;

            return (
              <div
                key={cap.id}
                className={`p-4 border rounded-lg transition-colors ${
                  cap.paused 
                    ? 'bg-muted/50 opacity-75' 
                    : status === 'active' 
                      ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                      : 'bg-card hover:bg-accent/5'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Agent info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5">
                      <PresenceBadge
                        status={status}
                        size="md"
                        lastInteractionAt={presence?.last_interaction_at}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {getAgentName(cap)}
                        </span>
                        {status === 'active' && !cap.paused && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600 hover:bg-green-600">
                            <Zap className="h-2.5 w-2.5 mr-0.5" />
                            LIVE
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {cap.admin_user?.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getActivityDescription(cap.admin_user_id)}
                      </div>
                    </div>
                  </div>

                  {/* On/Off Toggle */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${cap.paused ? 'text-red-600' : 'text-green-600'}`}>
                              {cap.paused ? 'OFF' : 'ON'}
                            </span>
                            <Switch
                              checked={!cap.paused}
                              onCheckedChange={() => handleTogglePause(cap.admin_user_id)}
                              disabled={saving === cap.admin_user_id}
                              className="data-[state=checked]:bg-green-600"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          {cap.paused 
                            ? 'Agent is switched OFF - will not receive leads' 
                            : 'Agent is switched ON - receiving leads'}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Delete button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          disabled={deleting === cap.admin_user_id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove agent from distribution?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove <strong>{getAgentName(cap)}</strong> from the lead distribution system. 
                            They will no longer receive auto-assigned leads. This can be undone by adding them back.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteAgent(cap.admin_user_id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remove Agent
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Progress and cap controls */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Assigned today: <span className="font-medium text-foreground">{todayLeadCounts[cap.admin_user_id] || 0}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Daily cap: <span className="font-medium text-foreground">
                        {cap.daily_cap === null ? 'Unlimited' : cap.daily_cap}
                      </span>
                    </span>
                  </div>

                  {!hasUnlimitedCap && (
                    <Progress 
                      value={Math.min(progressPercent, 100)} 
                      className={`h-2 ${progressPercent >= 100 ? '[&>div]:bg-red-500' : progressPercent >= 80 ? '[&>div]:bg-yellow-500' : ''}`}
                    />
                  )}

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Leads per day:</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="∞"
                        value={editedCap ?? (cap.daily_cap === null ? '' : cap.daily_cap)}
                        onChange={(e) => handleCapChange(cap.admin_user_id, e.target.value)}
                        className="w-20 h-8 text-sm"
                      />
                      <span className="text-[10px] text-muted-foreground">(blank = unlimited)</span>
                    </div>
                    {hasChanges && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 gap-1"
                        onClick={() => handleSaveCap(cap.admin_user_id)}
                        disabled={saving === cap.admin_user_id}
                      >
                        <Save className="h-3 w-3" />
                        Save
                      </Button>
                    )}
                  </div>
                </div>

                {/* Schedule & Availability */}
                <Separator className="my-2" />
                <AgentSchedulePanel
                  adminUserId={cap.admin_user_id}
                  agentName={getAgentName(cap)}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      <Separator />
      <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/30 p-3 rounded-lg">
        <p><strong>How it works:</strong></p>
        <p>• Agents switched <strong>OFF</strong> will not receive any auto-assigned leads.</p>
        <p>• <strong>Leads per day</strong> sets the maximum leads an agent can receive daily.</p>
        <p>• The overflow recipient can exceed their cap for overflow leads.</p>
        <p>• Caps reset automatically at midnight (server time).</p>
      </div>
    </div>
  );
};
