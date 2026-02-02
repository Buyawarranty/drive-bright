import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, RotateCcw, Gauge, Percent, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DistributionMode } from '@/hooks/useLeadDistribution';

interface AgentOption {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
}

interface DistributionModeSelectorProps {
  selectedMode: DistributionMode;
  onModeChange: (mode: DistributionMode) => void;
  soloAgentId: string | null;
  onSoloAgentChange: (agentId: string) => void;
  agents: AgentOption[];
  overflowAgentId: string | null;
  onOverflowAgentChange: (agentId: string) => void;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  saving: boolean;
}

const modeOptions: { mode: DistributionMode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    mode: 'solo',
    label: 'All Leads to One Agent',
    description: 'All leads go to a single selected agent with no cap restrictions',
    icon: <User className="h-5 w-5" />,
  },
  {
    mode: 'round_robin',
    label: 'Round Robin',
    description: 'Leads distributed evenly in rotation to online agents',
    icon: <RotateCcw className="h-5 w-5" />,
  },
  {
    mode: 'fixed_caps',
    label: 'Fixed Daily Caps',
    description: 'Each agent has a hard daily limit, leads assigned until cap reached',
    icon: <Gauge className="h-5 w-5" />,
  },
  {
    mode: 'percentage',
    label: 'Percentage Split',
    description: 'Distribute leads based on percentage allocation per agent',
    icon: <Percent className="h-5 w-5" />,
  },
];

export const DistributionModeSelector: React.FC<DistributionModeSelectorProps> = ({
  selectedMode,
  onModeChange,
  soloAgentId,
  onSoloAgentChange,
  agents,
  overflowAgentId,
  onOverflowAgentChange,
  hasUnsavedChanges,
  onSave,
  saving,
}) => {
  const selectedSoloAgent = agents.find(a => a.id === soloAgentId);
  const selectedOverflowAgent = agents.find(a => a.id === overflowAgentId);

  return (
    <div className="space-y-4">
      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {modeOptions.map(({ mode, label, description, icon }) => (
          <Card
            key={mode}
            className={cn(
              "p-4 cursor-pointer transition-all border-2 hover:shadow-md",
              selectedMode === mode
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/50"
            )}
            onClick={() => onModeChange(mode)}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                selectedMode === mode ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{label}</h4>
                  {selectedMode === mode && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Mode-specific settings */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-4">
        {/* Solo Mode: Select Agent */}
        {selectedMode === 'solo' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Select Solo Agent</span>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                No Cap Limit
              </Badge>
            </div>
            <Select value={soloAgentId || ''} onValueChange={onSoloAgentChange}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Choose agent to receive all leads" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        agent.isOnline ? "bg-green-500" : "bg-gray-400"
                      )} />
                      {agent.name}
                      {!agent.isOnline && (
                        <span className="text-xs text-muted-foreground">(offline)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSoloAgent && !selectedSoloAgent.isOnline && (
              <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded">
                <AlertTriangle className="h-4 w-4" />
                Selected agent is offline. Leads will queue until they come online.
              </div>
            )}
          </div>
        )}

        {/* Overflow Agent (for all modes except solo) */}
        {selectedMode !== 'solo' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Overflow Recipient</span>
              <span className="text-xs text-muted-foreground">(when all agents hit their caps)</span>
            </div>
            <Select value={overflowAgentId || 'none'} onValueChange={(v) => onOverflowAgentChange(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select overflow agent (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No overflow — leads stay unassigned</span>
                </SelectItem>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        agent.isOnline ? "bg-green-500" : "bg-gray-400"
                      )} />
                      {agent.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Mode explanation */}
        <div className="text-xs text-muted-foreground bg-background p-3 rounded border">
          {selectedMode === 'solo' && (
            <p><strong>Solo Mode:</strong> All incoming leads go directly to the selected agent. Daily caps are ignored. The agent receives unlimited leads until you switch modes.</p>
          )}
          {selectedMode === 'round_robin' && (
            <p><strong>Round Robin:</strong> Leads are distributed evenly among online agents. Each agent receives one lead before the cycle repeats. Daily caps still apply.</p>
          )}
          {selectedMode === 'fixed_caps' && (
            <p><strong>Fixed Caps:</strong> Each agent has a maximum daily limit. Leads are assigned until the cap is reached. When all caps are full, leads go to overflow or stay unassigned.</p>
          )}
          {selectedMode === 'percentage' && (
            <p><strong>Percentage Split:</strong> Leads are distributed based on assigned percentages. Ensure percentages total 100%. Daily caps still apply as a safety limit.</p>
          )}
        </div>
      </div>

      {/* Save Button */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span className="text-sm text-amber-800 flex-1">You have unsaved changes to the distribution settings.</span>
          <Button onClick={onSave} disabled={saving} className="bg-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
};
