import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, Trash2, Zap, AlertCircle, Clock, Ban, Target } from 'lucide-react';
import { PresenceBadge } from './PresenceBadge';
import { cn } from '@/lib/utils';
import { DistributionMode } from '@/hooks/useLeadDistribution';

interface AgentCapData {
  id: string;
  admin_user_id: string;
  daily_cap: number;
  assigned_today: number;
  paused: boolean;
  percentage?: number;
}

interface AgentData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface AgentPresenceData {
  admin_user_id: string;
  status: string;
  last_interaction_at: string | null;
}

interface AgentStatusTableProps {
  mode: DistributionMode;
  agentCaps: AgentCapData[];
  agents: AgentData[];
  presences: AgentPresenceData[];
  getPresenceStatus: (adminUserId: string) => 'active' | 'idle' | 'offline';
  editedCaps: Record<string, number>;
  editedPercentages: Record<string, number>;
  onCapChange: (adminUserId: string, value: string) => void;
  onPercentageChange: (adminUserId: string, value: string) => void;
  onSaveCap: (adminUserId: string) => void;
  onSaveAllPercentages: () => void;
  onTogglePause: (adminUserId: string) => void;
  onDelete: (adminUserId: string) => void;
  saving: string | null;
  deleting: string | null;
  soloAgentId: string | null;
}

const getStatusExplanation = (
  cap: AgentCapData,
  status: 'active' | 'idle' | 'offline',
  mode: DistributionMode,
  isSoloAgent: boolean
): { text: string; color: string; icon: React.ReactNode } | null => {
  if (isSoloAgent && mode === 'solo') {
    return {
      text: 'Receiving all leads (solo mode)',
      color: 'text-green-600 bg-green-50',
      icon: <Target className="h-3 w-3" />,
    };
  }

  if (cap.paused) {
    return {
      text: 'Paused — not receiving leads',
      color: 'text-red-600 bg-red-50',
      icon: <Ban className="h-3 w-3" />,
    };
  }

  if (status === 'offline') {
    return {
      text: 'Offline — leads skip this agent',
      color: 'text-gray-600 bg-gray-50',
      icon: <Clock className="h-3 w-3" />,
    };
  }

  if (mode !== 'solo' && cap.assigned_today >= cap.daily_cap) {
    return {
      text: 'Daily cap reached',
      color: 'text-amber-600 bg-amber-50',
      icon: <AlertCircle className="h-3 w-3" />,
    };
  }

  if (status === 'active') {
    return {
      text: 'Active — receiving leads',
      color: 'text-green-600 bg-green-50',
      icon: <Zap className="h-3 w-3" />,
    };
  }

  if (status === 'idle') {
    return {
      text: 'Idle — browser open, not active',
      color: 'text-amber-600 bg-amber-50',
      icon: <Clock className="h-3 w-3" />,
    };
  }

  return null;
};

const getAgentName = (agent: AgentData | undefined) => {
  if (!agent) return 'Unknown';
  if (agent.first_name) {
    return `${agent.first_name} ${agent.last_name || ''}`.trim();
  }
  return agent.email;
};

export const AgentStatusTable: React.FC<AgentStatusTableProps> = ({
  mode,
  agentCaps,
  agents,
  presences,
  getPresenceStatus,
  editedCaps,
  editedPercentages,
  onCapChange,
  onPercentageChange,
  onSaveCap,
  onSaveAllPercentages,
  onTogglePause,
  onDelete,
  saving,
  deleting,
  soloAgentId,
}) => {
  // Calculate total percentage
  const totalPercentage = agentCaps.reduce((sum, cap) => {
    const editedPct = editedPercentages[cap.admin_user_id];
    return sum + (editedPct ?? cap.percentage ?? 0);
  }, 0);

  const percentageWarning = mode === 'percentage' && totalPercentage !== 100;
  
  // Check if there are unsaved percentage changes
  const hasUnsavedPercentages = mode === 'percentage' && Object.keys(editedPercentages).length > 0;

  return (
    <div className="space-y-3">
      {/* Percentage warning */}
      {percentageWarning && (
        <div className="flex items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>
              <strong>Warning:</strong> Percentages total {totalPercentage}% — should equal 100%.
            </span>
          </div>
          {hasUnsavedPercentages && totalPercentage === 100 && (
            <Button 
              size="sm" 
              onClick={onSaveAllPercentages}
              disabled={saving === 'bulk'}
            >
              <Save className="h-4 w-4 mr-1" />
              {saving === 'bulk' ? 'Saving...' : 'Save All'}
            </Button>
          )}
        </div>
      )}
      
      {/* Save all button when percentages are valid and have changes */}
      {mode === 'percentage' && hasUnsavedPercentages && !percentageWarning && (
        <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <div className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            <span>You have unsaved percentage changes (total: {totalPercentage}%)</span>
          </div>
          <Button 
            size="sm" 
            onClick={onSaveAllPercentages}
            disabled={saving === 'bulk'}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving === 'bulk' ? 'Saving...' : 'Save All Percentages'}
          </Button>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[220px]">Agent</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[200px]">Why / Status</TableHead>
              {mode === 'percentage' ? (
                <TableHead className="w-[120px]">Percentage (%)</TableHead>
              ) : mode !== 'solo' ? (
                <TableHead className="w-[120px]">Daily Cap</TableHead>
              ) : null}
              {mode !== 'solo' && (
                <TableHead className="w-[100px]">Today</TableHead>
              )}
              <TableHead className="w-[100px]">Receiving</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agentCaps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No agents configured for lead distribution.
                </TableCell>
              </TableRow>
            ) : (
              agentCaps.map(cap => {
                const agent = agents.find(a => a.id === cap.admin_user_id);
                const status = getPresenceStatus(cap.admin_user_id);
                const presence = presences.find(p => p.admin_user_id === cap.admin_user_id);
                const isSoloAgent = soloAgentId === cap.admin_user_id;
                const statusExplanation = getStatusExplanation(cap, status, mode, isSoloAgent);
                
                const editedCap = editedCaps[cap.admin_user_id];
                const hasCapChanges = editedCap !== undefined && editedCap !== cap.daily_cap;
                const editedPct = editedPercentages[cap.admin_user_id];

                return (
                  <TableRow
                    key={cap.id}
                    className={cn(
                      cap.paused ? 'opacity-60 bg-muted/30' : '',
                      isSoloAgent && mode === 'solo' ? 'bg-primary/5 border-l-4 border-l-primary' : '',
                      status === 'active' && !cap.paused ? 'bg-green-50/50 dark:bg-green-950/20' : ''
                    )}
                  >
                    {/* Agent */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                          {agent?.first_name?.[0]?.toUpperCase() || agent?.email[0].toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {getAgentName(agent)}
                            {isSoloAgent && mode === 'solo' && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-primary">
                                SOLO
                              </Badge>
                            )}
                            {status === 'active' && !cap.paused && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-green-600">
                                <Zap className="h-2.5 w-2.5 mr-0.5" />
                                LIVE
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{agent?.email}</div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Presence Status */}
                    <TableCell>
                      <PresenceBadge
                        status={status}
                        size="md"
                        showLabel
                        lastInteractionAt={presence?.last_interaction_at}
                      />
                    </TableCell>

                    {/* Why / Explanation */}
                    <TableCell>
                      {statusExplanation && (
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium w-fit",
                          statusExplanation.color
                        )}>
                          {statusExplanation.icon}
                          {statusExplanation.text}
                        </div>
                      )}
                    </TableCell>

                    {/* Cap / Percentage Input */}
                    {mode === 'percentage' ? (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={editedPct ?? cap.percentage ?? 0}
                            onChange={(e) => onPercentageChange(cap.admin_user_id, e.target.value)}
                            className="w-16 h-8 text-sm"
                          />
                          <span className="text-muted-foreground">%</span>
                          {(editedPct !== undefined && editedPct !== (cap.percentage ?? 0)) && (
                            <Button
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => onSaveCap(cap.admin_user_id)}
                              disabled={saving === cap.admin_user_id}
                            >
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    ) : mode !== 'solo' ? (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            value={editedCap ?? cap.daily_cap}
                            onChange={(e) => onCapChange(cap.admin_user_id, e.target.value)}
                            className="w-20 h-8 text-sm"
                          />
                          {hasCapChanges && (
                            <Button
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => onSaveCap(cap.admin_user_id)}
                              disabled={saving === cap.admin_user_id}
                            >
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    ) : null}

                    {/* Today's Count */}
                    {mode !== 'solo' && (
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "font-medium",
                            cap.assigned_today >= cap.daily_cap ? "text-amber-600" : ""
                          )}>
                            {cap.assigned_today}
                          </span>
                          <span className="text-muted-foreground text-xs">/ {cap.daily_cap}</span>
                        </div>
                      </TableCell>
                    )}

                    {/* Receiving Toggle */}
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!cap.paused}
                              onCheckedChange={() => onTogglePause(cap.admin_user_id)}
                              disabled={saving === cap.admin_user_id}
                              className="data-[state=checked]:bg-green-600"
                            />
                            <span className={cn(
                              "text-xs font-semibold",
                              cap.paused ? 'text-red-600' : 'text-green-600'
                            )}>
                              {cap.paused ? 'OFF' : 'ON'}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {cap.paused
                            ? 'Agent is OFF — will not receive leads'
                            : 'Agent is ON — receiving leads'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {/* Delete */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                        disabled={deleting === cap.admin_user_id}
                        onClick={() => onDelete(cap.admin_user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
