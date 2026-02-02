import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, User, ArrowRight, AlertTriangle } from 'lucide-react';
import { DistributionMode } from '@/hooks/useLeadDistribution';
import { cn } from '@/lib/utils';

interface AgentSimData {
  id: string;
  name: string;
  dailyCap: number;
  assignedToday: number;
  percentage: number;
  isOnline: boolean;
  isPaused: boolean;
}

interface DistributionSimulatorProps {
  mode: DistributionMode;
  agents: AgentSimData[];
  soloAgentId: string | null;
  overflowAgentId: string | null;
  leadsToSimulate?: number;
}

interface SimulationResult {
  agentId: string;
  agentName: string;
  leadsReceived: number;
  reason: string;
}

export const DistributionSimulator: React.FC<DistributionSimulatorProps> = ({
  mode,
  agents,
  soloAgentId,
  overflowAgentId,
  leadsToSimulate = 10,
}) => {
  const [showSimulation, setShowSimulation] = React.useState(false);

  const simulationResults = useMemo((): SimulationResult[] => {
    if (!showSimulation) return [];

    const results: Record<string, SimulationResult> = {};
    const agentState = agents.map(a => ({
      ...a,
      remaining: a.dailyCap - a.assignedToday,
    }));

    // Initialize results
    agents.forEach(a => {
      results[a.id] = {
        agentId: a.id,
        agentName: a.name,
        leadsReceived: 0,
        reason: '',
      };
    });

    // Simulate distribution
    for (let i = 0; i < leadsToSimulate; i++) {
      let assignedTo: string | null = null;

      if (mode === 'solo') {
        if (soloAgentId) {
          const agent = agentState.find(a => a.id === soloAgentId);
          if (agent && !agent.isPaused) {
            assignedTo = soloAgentId;
          }
        }
      } else if (mode === 'round_robin') {
        // Find next eligible agent in rotation
        const eligible = agentState.filter(a => 
          a.isOnline && !a.isPaused && a.remaining > 0
        );
        if (eligible.length > 0) {
          // Simple round robin - find agent with least assigned
          const sorted = eligible.sort((a, b) => 
            (results[a.id].leadsReceived) - (results[b.id].leadsReceived)
          );
          assignedTo = sorted[0].id;
        }
      } else if (mode === 'fixed_caps') {
        // Assign to first available agent under cap
        const eligible = agentState.filter(a => 
          a.isOnline && !a.isPaused && a.remaining > 0
        );
        if (eligible.length > 0) {
          assignedTo = eligible[0].id;
        }
      } else if (mode === 'percentage') {
        // Weighted random based on percentage
        const eligible = agentState.filter(a => 
          a.isOnline && !a.isPaused && a.remaining > 0 && a.percentage > 0
        );
        if (eligible.length > 0) {
          const totalPct = eligible.reduce((sum, a) => sum + a.percentage, 0);
          const rand = Math.random() * totalPct;
          let cumulative = 0;
          for (const agent of eligible) {
            cumulative += agent.percentage;
            if (rand <= cumulative) {
              assignedTo = agent.id;
              break;
            }
          }
        }
      }

      // Check overflow
      if (!assignedTo && overflowAgentId) {
        const overflow = agentState.find(a => a.id === overflowAgentId);
        if (overflow && !overflow.isPaused) {
          assignedTo = overflowAgentId;
        }
      }

      // Update state
      if (assignedTo) {
        results[assignedTo].leadsReceived++;
        const agent = agentState.find(a => a.id === assignedTo);
        if (agent) {
          agent.remaining--;
        }
      }
    }

    // Add reasons
    agents.forEach(a => {
      const result = results[a.id];
      if (a.isPaused) {
        result.reason = 'Paused';
      } else if (!a.isOnline) {
        result.reason = 'Offline';
      } else if (mode === 'solo' && a.id !== soloAgentId) {
        result.reason = 'Not solo agent';
      } else if (a.dailyCap - a.assignedToday <= 0) {
        result.reason = 'Cap reached';
      } else if (result.leadsReceived === 0) {
        result.reason = 'No leads in simulation';
      } else {
        result.reason = 'Receiving';
      }
    });

    return Object.values(results).sort((a, b) => b.leadsReceived - a.leadsReceived);
  }, [showSimulation, mode, agents, soloAgentId, overflowAgentId, leadsToSimulate]);

  const totalSimulated = simulationResults.reduce((sum, r) => sum + r.leadsReceived, 0);
  const unassignedCount = leadsToSimulate - totalSimulated;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Distribution Simulator</span>
          <span className="text-xs text-muted-foreground">
            Preview how {leadsToSimulate} leads would be distributed
          </span>
        </div>
        <Button
          variant={showSimulation ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowSimulation(!showSimulation)}
        >
          {showSimulation ? 'Hide Simulation' : 'Run Simulation'}
        </Button>
      </div>

      {showSimulation && (
        <Card className="p-4 bg-muted/30">
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline">
                Simulating {leadsToSimulate} leads
              </Badge>
              <Badge variant={unassignedCount > 0 ? "destructive" : "secondary"}>
                {unassignedCount} would stay unassigned
              </Badge>
            </div>

            {/* Results */}
            <div className="space-y-2">
              {simulationResults.map(result => {
                const percentage = (result.leadsReceived / leadsToSimulate) * 100;
                const isReceiving = result.reason === 'Receiving';

                return (
                  <div key={result.agentId} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-medium truncate">
                      {result.agentName}
                    </div>
                    <div className="flex-1">
                      <Progress 
                        value={percentage} 
                        className={cn(
                          "h-6",
                          isReceiving ? "" : "opacity-50"
                        )}
                      />
                    </div>
                    <div className="w-16 text-right font-medium">
                      {result.leadsReceived}
                    </div>
                    <Badge 
                      variant={isReceiving ? "default" : "secondary"}
                      className={cn(
                        "w-28 justify-center text-xs",
                        !isReceiving && "bg-muted text-muted-foreground"
                      )}
                    >
                      {result.reason}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {unassignedCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded">
                <AlertTriangle className="h-4 w-4" />
                {unassignedCount} leads would remain unassigned. Consider adjusting caps or enabling an overflow agent.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
