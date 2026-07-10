import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { useAgentScoresForMonth } from '@/hooks/useAgentScoresForMonth';
import type { AgentScore } from '@/hooks/useScoreboardData';

interface ColumnProps {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  side: 'left' | 'right';
  allowedAgentIds?: Set<string> | null;
}

const MonthColumn: React.FC<ColumnProps> = ({ month, onPrev, onNext, allowedAgentIds }) => {
  const { agents: rawAgents, loading } = useAgentScoresForMonth(month);
  const agents = React.useMemo(() => {
    const filtered = allowedAgentIds ? rawAgents.filter(a => allowedAgentIds.has(a.id)) : rawAgents;
    return filtered
      .slice()
      .sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue)
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }, [rawAgents, allowedAgentIds]);
  const total = agents.reduce((s, a) => s + a.revenue, 0);
  const totalSales = agents.reduce((s, a) => s + a.salesCount, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" onClick={onPrev} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-yellow-500" />
            {format(month, 'MMMM yyyy')}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onNext} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
          <span>{totalSales} sales</span>
          <span className="font-semibold text-emerald-600">£{total.toLocaleString()}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : agents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No sales data.</div>
        ) : (
          <div className="divide-y">
            {agents.map((a: AgentScore) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <div className="w-7 text-center text-sm font-bold text-muted-foreground">#{a.rank}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.salesCount} sales · {a.conversionRate.toFixed(1)}% conv.</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-emerald-600">£{a.revenue.toLocaleString()}</div>
                  {a.cancelledCount > 0 && (
                    <div className="text-xs text-red-500">{a.cancelledCount} refund{a.cancelledCount === 1 ? '' : 's'}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface Props {
  allowedAgentIds?: string[] | null;
}

export const ScoreboardMonthCompare: React.FC<Props> = ({ allowedAgentIds }) => {
  const thisMonth = startOfMonth(new Date());
  const [leftMonth, setLeftMonth] = useState<Date>(subMonths(thisMonth, 1));
  const [rightMonth, setRightMonth] = useState<Date>(thisMonth);
  const allowedSet = React.useMemo(
    () => (allowedAgentIds ? new Set(allowedAgentIds) : null),
    [allowedAgentIds]
  );

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Compare any two months side by side. Use the arrows on each column to navigate.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthColumn
          month={leftMonth}
          side="left"
          allowedAgentIds={allowedSet}
          onPrev={() => setLeftMonth(m => subMonths(m, 1))}
          onNext={() => setLeftMonth(m => addMonths(m, 1))}
        />
        <MonthColumn
          month={rightMonth}
          side="right"
          allowedAgentIds={allowedSet}
          onPrev={() => setRightMonth(m => subMonths(m, 1))}
          onNext={() => setRightMonth(m => addMonths(m, 1))}
        />
      </div>
    </div>
  );
};
