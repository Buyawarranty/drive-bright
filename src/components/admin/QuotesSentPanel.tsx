import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Mail, Loader2 } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, addWeeks, subDays, subWeeks, format, isSameDay, isSameWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Mode = 'day' | 'week';

interface AgentRow {
  id: string;
  name: string;
  count: number;
}

interface QuotesSentPanelProps {
  currentAdminId?: string | null;
  currentUserRole?: string | null;
  className?: string;
}

const SALES_ROLES = new Set(['sales', 'sales_lead']);

/**
 * Compact panel showing quotes sent per agent, with day/week navigation.
 * Sales agents see the full board (their own row highlighted).
 * Managers see the same board — same data source, no restrictions.
 */
export const QuotesSentPanel: React.FC<QuotesSentPanelProps> = ({ currentAdminId, currentUserRole, className }) => {
  const [mode, setMode] = useState<Mode>('day');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to, label } = useMemo(() => {
    if (mode === 'day') {
      return {
        from: startOfDay(anchor),
        to: endOfDay(anchor),
        label: isSameDay(anchor, new Date()) ? `Today · ${format(anchor, 'd MMM')}` : format(anchor, 'EEE d MMM yyyy'),
      };
    }
    const ws = startOfWeek(anchor, { weekStartsOn: 1 });
    const we = endOfWeek(anchor, { weekStartsOn: 1 });
    const isCurrent = isSameWeek(anchor, new Date(), { weekStartsOn: 1 });
    return {
      from: ws,
      to: we,
      label: `${isCurrent ? 'This week · ' : ''}${format(ws, 'd MMM')} – ${format(we, 'd MMM')}`,
    };
  }, [mode, anchor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [quotesRes, usersRes] = await Promise.all([
        supabase
          .from('admin_sent_quotes')
          .select('sent_by, sent_at')
          .gte('sent_at', from.toISOString())
          .lte('sent_at', to.toISOString()),
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active'),
      ]);
      if (cancelled) return;
      const quotes = quotesRes.data || [];
      const users = usersRes.data || [];
      const counts = new Map<string, number>();
      for (const q of quotes as any[]) {
        if (!q.sent_by) continue;
        counts.set(q.sent_by, (counts.get(q.sent_by) || 0) + 1);
      }
      const displayable = users
        .filter((u: any) => u.is_active !== false)
        .map((u: any) => ({
          id: u.id,
          name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Unknown',
          count: counts.get(u.id) || 0,
        }))
        // Show agents with sends, or current viewer (so they always see themselves)
        .filter((r) => r.count > 0 || r.id === currentAdminId)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      // Include "unknown sender" bucket if any
      const orphan = quotes.filter((q: any) => q.sent_by && !users.find((u: any) => u.id === q.sent_by)).length;
      if (orphan > 0) displayable.push({ id: '__orphan__', name: 'Other / removed agents', count: orphan });

      setRows(displayable);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [from.getTime(), to.getTime(), currentAdminId]);

  const step = (dir: -1 | 1) => {
    setAnchor((d) => (mode === 'day' ? (dir === -1 ? subDays(d, 1) : addDays(d, 1)) : (dir === -1 ? subWeeks(d, 1) : addWeeks(d, 1))));
  };

  const total = rows.reduce((s, r) => s + r.count, 0);
  const isSalesOnly = SALES_ROLES.has(currentUserRole || '');

  return (
    <Card className={cn('border-blue-200 bg-blue-50/30', className)}>
      <CardContent className="p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-700" />
            <span className="font-semibold text-sm text-blue-900">Quotes sent</span>
            <Badge variant="secondary" className="ml-1">{total}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-md border bg-white overflow-hidden mr-1">
              <button
                type="button"
                onClick={() => { setMode('day'); setAnchor(new Date()); }}
                className={cn('px-2 py-1 text-xs font-medium', mode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50')}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => { setMode('week'); setAnchor(new Date()); }}
                className={cn('px-2 py-1 text-xs font-medium border-l', mode === 'week' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50')}
              >
                Week
              </button>
            </div>
            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => step(-1)} aria-label="Previous">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs font-medium min-w-[130px]"
              onClick={() => setAnchor(new Date())}
            >
              {label}
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => step(1)} aria-label="Next">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No quotes sent in this period.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {rows.map((r) => {
              const isMe = r.id === currentAdminId;
              return (
                <div
                  key={r.id}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-xs',
                    isMe && 'border-blue-500 bg-blue-100 font-semibold',
                    isSalesOnly && !isMe && 'opacity-80'
                  )}
                >
                  <span className="text-gray-800">{r.name}</span>
                  <Badge variant={r.count > 0 ? 'default' : 'outline'} className="h-5 min-w-[26px] justify-center px-1.5">
                    {r.count}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuotesSentPanel;
