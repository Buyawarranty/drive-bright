import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Crown, Star, Flame } from 'lucide-react';
import { AgentScore, TimePeriod } from '@/hooks/useScoreboardData';
import confetti from 'canvas-confetti';

interface Props {
  agents: AgentScore[];
  currentAdminUserId: string | null;
  period: TimePeriod;
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  today: "Today's",
  week: "This Week's",
  month: "This Month's",
  all: 'All-Time',
  custom: 'Custom Period',
};

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1: return { bg: 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400', icon: <Crown className="h-6 w-6 text-yellow-500 drop-shadow" />, label: 'bg-yellow-500 text-white', ring: 'ring-2 ring-yellow-400/50' };
    case 2: return { bg: 'bg-gradient-to-r from-gray-50 to-slate-100 border-gray-300', icon: <Medal className="h-5 w-5 text-gray-400" />, label: 'bg-gray-400 text-white', ring: '' };
    case 3: return { bg: 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300', icon: <Medal className="h-5 w-5 text-orange-600" />, label: 'bg-orange-600 text-white', ring: '' };
    default: return { bg: 'border-border', icon: null, label: 'bg-muted text-muted-foreground', ring: '' };
  }
};

/**
 * Performance badges are now target-driven:
 * - 🔥 On Fire: exceeded target (100%+) or 15+ sales if no target
 * - ⚡ Crushing It: 75-99% of target or 10+ sales
 * - ✅ On Target: 50-74% of target or 5+ sales
 * - 📊 Building: 25-49% of target or 2+ sales
 * - 🚀 Getting Started: <25% with at least 1 sale
 * - ❄️ Cold Start: 0 sales
 */
const getPerformanceBadge = (agent: AgentScore) => {
  const { salesCount, monthlyTarget } = agent;

  if (monthlyTarget && monthlyTarget > 0) {
    const pct = (salesCount / monthlyTarget) * 100;
    if (pct >= 100) return { text: '🔥 On Fire', className: 'bg-red-100 text-red-700 border-red-300', tooltip: `${pct.toFixed(0)}% of target` };
    if (pct >= 75) return { text: '⚡ Crushing It', className: 'bg-purple-100 text-purple-700 border-purple-300', tooltip: `${pct.toFixed(0)}% of target` };
    if (pct >= 50) return { text: '✅ On Target', className: 'bg-green-100 text-green-700 border-green-300', tooltip: `${pct.toFixed(0)}% of target` };
    if (pct >= 25) return { text: '📊 Building', className: 'bg-amber-100 text-amber-700 border-amber-300', tooltip: `${pct.toFixed(0)}% of target` };
    if (salesCount > 0) return { text: '🚀 Getting Started', className: 'bg-sky-100 text-sky-700 border-sky-300', tooltip: `${pct.toFixed(0)}% of target` };
    return { text: '❄️ Cold Start', className: 'bg-gray-100 text-gray-500 border-gray-300', tooltip: '0 sales' };
  }

  // Fallback when no target is set — absolute thresholds
  if (salesCount >= 15) return { text: '🔥 On Fire', className: 'bg-red-100 text-red-700 border-red-300', tooltip: `${salesCount} sales` };
  if (salesCount >= 10) return { text: '⚡ Crushing It', className: 'bg-purple-100 text-purple-700 border-purple-300', tooltip: `${salesCount} sales` };
  if (salesCount >= 5) return { text: '✅ On Target', className: 'bg-green-100 text-green-700 border-green-300', tooltip: `${salesCount} sales` };
  if (salesCount >= 2) return { text: '📊 Building', className: 'bg-amber-100 text-amber-700 border-amber-300', tooltip: `${salesCount} sales` };
  if (salesCount >= 1) return { text: '🚀 Getting Started', className: 'bg-sky-100 text-sky-700 border-sky-300', tooltip: `${salesCount} sale` };
  return null;
};

export const ScoreboardRankingTable: React.FC<Props> = ({ agents, currentAdminUserId, period }) => {
  const prevFirstRef = useRef<string | null>(null);

  useEffect(() => {
    if (agents.length > 0) {
      const firstId = agents[0].id;
      if (prevFirstRef.current && prevFirstRef.current !== firstId) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.3 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#7B68EE'],
        });
      }
      prevFirstRef.current = firstId;
    }
  }, [agents]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Trophy className="h-6 w-6 text-yellow-500" />
          {PERIOD_LABELS[period]} Leaderboard
          <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {agents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No sales data for this period yet.</div>
        ) : (
          <div className="divide-y">
            {agents.map((agent) => {
              const style = getRankStyle(agent.rank);
              const isMe = agent.id === currentAdminUserId;
              const perfBadge = getPerformanceBadge(agent);

              return (
                <div
                  key={agent.id}
                  className={`flex items-center gap-4 px-4 py-4 md:px-6 transition-all hover:bg-muted/30 ${style.bg} ${style.ring} ${isMe ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-12 text-center">
                    {style.icon ? (
                      <div className="flex items-center justify-center">{style.icon}</div>
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">#{agent.rank}</span>
                    )}
                  </div>

                  {/* Avatar & Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${agent.rank === 1 ? 'bg-yellow-500 text-white' : agent.rank === 2 ? 'bg-gray-400 text-white' : agent.rank === 3 ? 'bg-orange-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate flex items-center gap-2">
                          {agent.name}
                          {isMe && <Badge variant="outline" className="text-xs px-1.5 py-0 border-primary text-primary">You</Badge>}
                          {agent.rank === 1 && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{agent.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-lg">{agent.salesCount}</div>
                      <div className="text-xs text-muted-foreground">Sales</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-lg text-emerald-600">£{agent.revenue.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Revenue</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{agent.conversionRate.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">Conv.</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">£{agent.avgOrderValue.toFixed(0)}</div>
                      <div className="text-xs text-muted-foreground">AOV</div>
                    </div>
                    {agent.cancelledCount > 0 && (
                      <div className="text-center">
                        <div className="font-bold text-red-600">{agent.cancelledCount}</div>
                        <div className="text-xs text-red-500">Refunds</div>
                      </div>
                    )}
                  </div>

                  {/* Mobile stats */}
                  <div className="md:hidden text-right">
                    <div className="font-bold text-emerald-600">£{agent.revenue.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{agent.salesCount} sales{agent.cancelledCount > 0 ? ` · ${agent.cancelledCount} refunds` : ''}</div>
                  </div>

                  {/* Performance badge */}
                  {perfBadge && (
                    <Badge variant="outline" className={`hidden lg:inline-flex text-xs ${perfBadge.className}`} title={perfBadge.tooltip}>
                      {perfBadge.text}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
