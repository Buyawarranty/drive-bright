import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award } from 'lucide-react';

interface SalesBadge {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
  earned: boolean;
  description?: string;
}

interface SalesBadgesProps {
  warrantyCount: number;
  monthlyWarrantyCount: number;
  trustpilotReviews: number;
}

export const SalesBadges: React.FC<SalesBadgesProps> = ({
  warrantyCount,
  monthlyWarrantyCount,
  trustpilotReviews
}) => {
  // Define all badges based on the spec
  const badges: SalesBadge[] = [
    // Warranty Sales Badges
    {
      id: 'rising_achiever',
      name: 'Rising Achiever',
      emoji: '🟦',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100 border-blue-300',
      earned: warrantyCount >= 20,
      description: 'First 20 warranties sold'
    },
    {
      id: 'target_smasher',
      name: 'Target Smasher',
      emoji: '🎯',
      color: 'text-red-700',
      bgColor: 'bg-red-100 border-red-300',
      earned: monthlyWarrantyCount >= 40,
      description: 'Monthly target of 40 warranties reached'
    },
    {
      id: 'conversion_pro',
      name: 'Conversion Pro',
      emoji: '📈',
      color: 'text-purple-700',
      bgColor: 'bg-purple-100 border-purple-300',
      earned: monthlyWarrantyCount >= 70,
      description: '70 warranties in a month'
    },
    {
      id: 'elite_closer',
      name: 'Elite Closer',
      emoji: '🏆',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100 border-yellow-400',
      earned: monthlyWarrantyCount >= 100,
      description: '100 warranties in a month - Top Tier!'
    },
    // Trustpilot Review Badges
    {
      id: 'customer_favourite',
      name: 'Customer Favourite',
      emoji: '💬',
      color: 'text-teal-700',
      bgColor: 'bg-teal-100 border-teal-300',
      earned: trustpilotReviews >= 10,
      description: '10 Trustpilot reviews'
    },
    {
      id: 'customer_champion',
      name: 'Customer Champion',
      emoji: '⭐',
      color: 'text-amber-700',
      bgColor: 'bg-amber-100 border-amber-400',
      earned: trustpilotReviews >= 20,
      description: '20 Trustpilot reviews'
    }
  ];

  const earnedBadges = badges.filter(b => b.earned);

  if (earnedBadges.length === 0) {
    return null; // Don't show section if no badges earned
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Award className="h-5 w-5 text-amber-500" />
          My Badges
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {earnedBadges.map((badge) => (
            <div
              key={badge.id}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${badge.bgColor} ${badge.color} font-medium text-sm`}
              title={badge.description}
            >
              <span className="text-lg">{badge.emoji}</span>
              {badge.name}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
