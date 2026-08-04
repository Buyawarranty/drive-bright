import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Mail, Loader2 } from 'lucide-react';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, addWeeks, subDays, subWeeks,
  format, isSameDay, isSameWeek,
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Mode = 'day' | 'week' | 'yesterday' | 'last_7' | 'last_30';

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

// Managers see every agent; sales agents see their own team.
const MANAGER_ROLES = new Set(['admin', 'super_admin', 'sales_manager']);

const QUICK_FILTERS: { key: Mode; label: string }[] = [
  { key: 'day', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'last_7', label: '7 days' },
  { key: 'last_30', label: '30 days' },
];

/**
 * Compact panel showing quotes sent per agent, with quick date filters.
 * Managers see all agents; agents see their own team's agents.
 *
 * NOTE: admin_sent_quotes.sent_by stores the *auth* user id, so agents are
 * matched on admin_users.user_id (with admin_users.id as a fallback).
 */
export const QuotesSentPanel: React.FC<QuotesSentPanelProps> = ({ currentAdminId, currentUserRole, className }) => {
  const [mode, setMode] = useState<Mode>('day');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isManager = MANAGER_ROLES.has(currentUserRole || '');

  const { from, to, label, navigable } = useMemo(() => {
    if (mode === 'day' || mode === 'yesterday') {
      const base = mode === 'yesterday' ? subDays(anchor, 1) : anchor;
      return {
        from: startOfDay(base),
        to: endOfDay(base),
        label: isSameDay(base, new Date()) ? `Today · ${format(base, 'd MMM')}` : format(base, 'EEE d MMM yyyy'),
        navigable: true,
      };
    }
    if (mode === 'week') {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = endOfWeek(anchor, { weekStartsOn: 1 });
      const isCurrent = isSameWeek(anchor, new Date(), { weekStartsOn: 1 });
      return {
        from: ws,
        to: we,
        label: `${isCurrent ? 'This week · ' : ''}${format(ws, 'd MMM')} – ${format(we, 'd MMM')}`,
        navigable: true,
      };
    }
    const days = mode === 'last_7' ? 7 : 30;
    const start = startOfDay(subDays(new Date(), days - 1));
    const end = endOfDay(new Date());
    return {
      from: start,
      to: end,
      label: `Last ${days} days · ${format(start, 'd MMM')} – ${format(end, 'd MMM')}`,
      navigable: false,
    };
  }, [mode, anchor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [quotesRes, usersRes, membersRes] = await Promise.all([
        supabase
          .from('admin_sent_quotes')
          .select('sent_by, sent_at')
          .gte('sent_at', from.toISOString())
          .lte('sent_at', to.toISOString()),
        supabase
          .from('admin_users')
          .select('id, user_id, first_name, last_name, email, role, is_active'),
        (supabase.from('lead_team_members') as any).select('admin_user_id, team_id'),
      ]);
      if (cancelled) return;
      const quotes = (quotesRes.data || []) as any[];
      const users = (usersRes.data || []) as any[];
      const members = (membersRes.data || []) as any[];

      // Agents only see their own team; managers see everyone.
      const teamOf = new Map<string, string | null>();
      members.forEach((m) => teamOf.set(m.admin_user_id, m.team_id ?? null));
      const myTeam = currentAdminId ? teamOf.get(currentAdminId) ?? null : null;

      const counts = new Map<string, number>();
      for (const q of quotes) {
        if (!q.sent_by) continue;
        counts.set(q.sent_by, (counts.get(q.sent_by) || 0) + 1);
      }

      const matched = new Set<string>();
      const displayable: AgentRow[] = users
        .filter((u) => u.is_active !== false)
        .map((u) => {
          // sent_by holds the auth user id; older rows may hold admin_users.id
          const byAuth = u.user_id ? counts.get(u.user_id) || 0 : 0;
          const byAdminId = counts.get(u.id) || 0;
          if (byAuth && u.user_id) matched.add(u.user_id);
          if (byAdminId) matched.add(u.id);
          return {
            id: u.id,
            name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Unknown',
            count: byAuth + byAdminId,
          };
        })
        .filter((r) => {
          if (isManager) return r.count > 0 || r.id === currentAdminId;
          if (r.id === currentAdminId) return true;
          // same-team agents only
          return myTeam != null && teamOf.get(r.id) === myTeam;
        })
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      if (isManager) {
        const orphan = quotes.filter((q) => q.sent_by && !matched.has(q.sent_by)).length;
        if (orphan > 0) displayable.push({ id: '__orphan__', name: 'Other / removed agents', count: orphan });
      }

      setRows(displayable);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [from.getTime(), to.getTime(), currentAdminId, isManager]);


  const step = (dir: -1 | 1) => {
    setAnchor((d) => (mode === 'week'
      ? (dir === -1 ? subWeeks(d, 1) : addWeeks(d, 1))
      : (dir === -1 ? subDays(d, 1) : addDays(d, 1))));
    if (mode === 'yesterday') setMode('day');
  };

  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <Card className={cn('border-blue-200 bg-blue-50/30', className)}>
      <CardContent className="p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-700" />
            <span className="font-semibold text-sm text-blue-900">Quotes sent per agent</span>
            <Badge variant="secondary" className="ml-1">{total}</Badge>
            <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-800">
              {isManager ? 'All agents' : 'Your team'}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-md border bg-white overflow-hidden mr-1">
              {QUICK_FILTERS.map((f, i) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => { setMode(f.key); setAnchor(new Date()); }}
                  className={cn(
                    'px-2 py-1 text-xs font-medium',
                    i > 0 && 'border-l',
                    mode === f.key ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {navigable && (
              <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => step(-1)} aria-label="Previous">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs font-medium min-w-[130px]"
              onClick={() => { setMode('day'); setAnchor(new Date()); }}
            >
              {label}
            </Button>
            {navigable && (
              <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => step(1)} aria-label="Next">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
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
                    isMe && 'border-blue-500 bg-blue-100 font-semibold'
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
