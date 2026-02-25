import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Crown, Flame, Target, Zap, Star, Trophy, Medal } from 'lucide-react';
import { AgentScore } from '@/hooks/useScoreboardData';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  agents: AgentScore[];
  currentAdminUserId: string | null;
}

interface HallOfFameEntry {
  name: string;
  period: string;
  revenue: number;
  salesCount: number;
}

const AWARD_DEFINITIONS = [
  { id: 'top_seller', name: 'Top Seller', emoji: '🏆', description: 'Highest revenue this period', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { id: 'most_sales', name: 'Most Sales', emoji: '🎯', description: 'Most deals closed', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'best_conversion', name: 'Best Conversion', emoji: '📈', description: 'Highest conversion rate (min 5 leads)', color: 'bg-green-100 text-green-800 border-green-300' },
  { id: 'highest_aov', name: 'Highest AOV', emoji: '💎', description: 'Highest average order value (min 3 sales)', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'consistency', name: 'Consistency King', emoji: '👑', description: 'Sales every day this week', color: 'bg-amber-100 text-amber-800 border-amber-300' },
];

export const ScoreboardAwards: React.FC<Props> = ({ agents, currentAdminUserId }) => {
  const [earnedBadges, setEarnedBadges] = useState<{ badge_id: string; name: string; icon: string; color: string; earned_at: string }[]>([]);

  useEffect(() => {
    if (!currentAdminUserId) return;
    const fetchBadges = async () => {
      const { data } = await supabase
        .from('user_badges')
        .select('badge_id, earned_at, sales_badges(name, icon, color)')
        .eq('user_id', currentAdminUserId);
      
      if (data) {
        setEarnedBadges(data.map((d: any) => ({
          badge_id: d.badge_id,
          name: d.sales_badges?.name || '',
          icon: d.sales_badges?.icon || '🏅',
          color: d.sales_badges?.color || 'blue',
          earned_at: d.earned_at,
        })));
      }
    };
    fetchBadges();
  }, [currentAdminUserId]);

  // Calculate current awards
  const getAwardWinners = () => {
    const winners: { award: typeof AWARD_DEFINITIONS[0]; agent: AgentScore }[] = [];
    if (agents.length === 0) return winners;

    // Top Seller (highest revenue)
    const topRevenue = [...agents].sort((a, b) => b.revenue - a.revenue)[0];
    if (topRevenue.revenue > 0) winners.push({ award: AWARD_DEFINITIONS[0], agent: topRevenue });

    // Most Sales
    const mostSales = [...agents].sort((a, b) => b.salesCount - a.salesCount)[0];
    if (mostSales.salesCount > 0) winners.push({ award: AWARD_DEFINITIONS[1], agent: mostSales });

    // Best Conversion (min 5 leads)
    const eligibleConversion = agents.filter(a => a.leadsAssigned >= 5);
    if (eligibleConversion.length > 0) {
      const best = [...eligibleConversion].sort((a, b) => b.conversionRate - a.conversionRate)[0];
      winners.push({ award: AWARD_DEFINITIONS[2], agent: best });
    }

    // Highest AOV (min 3 sales)
    const eligibleAov = agents.filter(a => a.salesCount >= 3);
    if (eligibleAov.length > 0) {
      const best = [...eligibleAov].sort((a, b) => b.avgOrderValue - a.avgOrderValue)[0];
      winners.push({ award: AWARD_DEFINITIONS[3], agent: best });
    }

    return winners;
  };

  const winners = getAwardWinners();

  return (
    <div className="space-y-4">
      {/* Current Period Awards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-amber-500" />
            Awards & Recognition
          </CardTitle>
        </CardHeader>
        <CardContent>
          {winners.length === 0 ? (
            <p className="text-muted-foreground text-sm">No awards to give yet — start selling!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {winners.map(({ award, agent }) => {
                const isMe = agent.id === currentAdminUserId;
                return (
                  <div
                    key={award.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${award.color} ${isMe ? 'ring-2 ring-primary/30' : ''} transition-all hover:scale-[1.02]`}
                  >
                    <span className="text-3xl">{award.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{award.name}</div>
                      <div className="text-xs opacity-80">{award.description}</div>
                      <div className="font-bold mt-1 flex items-center gap-1">
                        {agent.name}
                        {isMe && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Earned Badges */}
      {earnedBadges.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Medal className="h-5 w-5 text-amber-500" />
              My Badges ({earnedBadges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {earnedBadges.map((badge) => (
                <Badge
                  key={badge.badge_id}
                  variant="outline"
                  className="px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300"
                >
                  <span className="mr-1">{badge.icon}</span>
                  {badge.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
