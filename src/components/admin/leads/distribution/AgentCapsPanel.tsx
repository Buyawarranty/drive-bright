import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { PresenceBadge } from './PresenceBadge';
import { RefreshCw, Save, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  getAgentPresenceStatus: (adminUserId: string) => 'active' | 'idle' | 'offline';
  onInitializeCaps: () => Promise<void>;
}

export const AgentCapsPanel: React.FC<AgentCapsPanelProps> = ({
  agentCaps,
  agentPresences,
  salesUsers,
  onUpdateCap,
  onTogglePause,
  getAgentPresenceStatus,
  onInitializeCaps
}) => {
  const [editedCaps, setEditedCaps] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const handleCapChange = (adminUserId: string, value: string) => {
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

  // Find unconfigured agents
  const configuredAgentIds = new Set(agentCaps.map(c => c.admin_user_id));
  const unconfiguredAgents = salesUsers.filter(u => !configuredAgentIds.has(u.id));

  return (
    <div className="mt-6 space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Per-Agent Settings</h4>
        {unconfiguredAgents.length > 0 && (
          <Button variant="outline" size="sm" onClick={onInitializeCaps} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add {unconfiguredAgents.length} new agent(s)
          </Button>
        )}
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
            const progressPercent = cap.daily_cap > 0 ? (cap.assigned_today / cap.daily_cap) * 100 : 0;
            const editedCap = editedCaps[cap.admin_user_id];
            const hasChanges = editedCap !== undefined && editedCap !== cap.daily_cap;

            return (
              <div
                key={cap.id}
                className="p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Agent info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <PresenceBadge
                      status={status}
                      size="md"
                      lastInteractionAt={presence?.last_interaction_at}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {getAgentName(cap)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {cap.admin_user?.email}
                      </div>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2">
                    {cap.paused && (
                      <Badge variant="secondary" className="text-xs">Paused</Badge>
                    )}
                    {presence?.is_paused_receiving && (
                      <Badge variant="outline" className="text-xs">Not receiving</Badge>
                    )}
                  </div>

                  {/* Pause toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Paused</span>
                    <Switch
                      checked={cap.paused}
                      onCheckedChange={() => handleTogglePause(cap.admin_user_id)}
                      disabled={saving === cap.admin_user_id}
                    />
                  </div>
                </div>

                {/* Progress and cap controls */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Assigned today: <span className="font-medium text-foreground">{cap.assigned_today}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Cap: <span className="font-medium text-foreground">{cap.daily_cap}</span>
                    </span>
                  </div>

                  <Progress value={Math.min(progressPercent, 100)} className="h-1.5" />

                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Daily cap:</span>
                      <Input
                        type="number"
                        min={0}
                        value={editedCap ?? cap.daily_cap}
                        onChange={(e) => handleCapChange(cap.admin_user_id, e.target.value)}
                        className="w-20 h-7 text-xs"
                      />
                    </div>
                    {hasChanges && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 gap-1"
                        onClick={() => handleSaveCap(cap.admin_user_id)}
                        disabled={saving === cap.admin_user_id}
                      >
                        <Save className="h-3 w-3" />
                        Save
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      <Separator />
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Agents marked as <strong>Paused</strong> will not receive auto-assigned leads.</p>
        <p>• The overflow recipient can exceed their cap for overflow leads.</p>
        <p>• Caps reset automatically at midnight (server time).</p>
      </div>
    </div>
  );
};
