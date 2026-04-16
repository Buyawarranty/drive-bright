import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Shield, TrendingUp } from 'lucide-react';

interface DealerStatsCardsProps {
  totalQuotes: number;
  activeWarranties: number;
  conversionRate: number;
}

export const DealerStatsCards: React.FC<DealerStatsCardsProps> = ({
  totalQuotes,
  activeWarranties,
  conversionRate,
}) => {
  const stats = [
    { label: 'Total Quotes', value: totalQuotes, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Warranties', value: activeWarranties, icon: Shield, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-full ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
