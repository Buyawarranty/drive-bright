import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Coffee, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface BreakLogSectionProps {
  currentMonth: Date;
  /** Auth user id of the staff member whose timesheet is being viewed. */
  viewingUserId?: string;
}

type LogRow = {
  id: string;
  status: string;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
  minutes: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  break: 'Break',
  lunch: 'Lunch',
  training: 'Training',
  meeting: 'Meeting',
  off: 'Off shift',
};

const STATUS_CHIP: Record<string, string> = {
  break: 'bg-amber-50 text-amber-800 border-amber-200',
  lunch: 'bg-orange-50 text-orange-800 border-orange-200',
  training: 'bg-sky-50 text-sky-800 border-sky-200',
  meeting: 'bg-violet-50 text-violet-800 border-violet-200',
  off: 'bg-muted text-muted-foreground border-border',
};

const fmtMins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

/**
 * Break log inside the timesheet — every lunch / break / training an agent logged
 * in New Leads is journalled here with its start, end and length for the month.
 */
export const BreakLogSection: React.FC<BreakLogSectionProps> = ({ currentMonth, viewingUserId }) => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let adminId: string | null = null;
      const authUserId = viewingUserId || (await supabase.auth.getUser()).data.user?.id || null;
      if (authUserId) {
        const { data } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', authUserId)
          .maybeSingle();
        adminId = (data as any)?.id ?? null;
      }
      if (!adminId) {
        setRows([]);
        return;
      }
      const from = startOfMonth(currentMonth).toISOString();
      const to = endOfMonth(currentMonth).toISOString();
      const { data } = await (supabase as any)
        .from('agent_break_log')
        .select('id, status, reason, started_at, ended_at, minutes')
        .eq('admin_user_id', adminId)
        .gte('started_at', from)
        .lte('started_at', to)
        .order('started_at', { ascending: false });
      setRows(((data as LogRow[]) || []).filter(Boolean));
    } finally {
      setLoading(false);
    }
  }, [currentMonth, viewingUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const totalMins = rows.reduce((sum, r) => sum + (r.minutes ?? 0), 0);
    const byType = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + (r.minutes ?? 0);
      return acc;
    }, {});
    return { totalMins, byType };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Coffee className="h-4 w-4 text-muted-foreground" />
            Break log
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {format(currentMonth, 'MMMM yyyy')} · {rows.length} entries · {fmtMins(totals.totalMins)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading break log…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No breaks logged this month. Breaks recorded with the Break status bar in New Leads appear here.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(totals.byType).map(([status, mins]) => (
                <span
                  key={status}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                    STATUS_CHIP[status] ?? STATUS_CHIP.off,
                  )}
                >
                  {STATUS_LABEL[status] ?? status} · {fmtMins(mins)}
                </span>
              ))}
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Start</th>
                    <th className="px-3 py-2 text-left font-medium">End</th>
                    <th className="px-3 py-2 text-right font-medium">Length</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{format(new Date(r.started_at), 'EEE d MMM')}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                            STATUS_CHIP[r.status] ?? STATUS_CHIP.off,
                          )}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                        {r.reason ? <span className="ml-2 text-xs text-muted-foreground">{r.reason}</span> : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{format(new Date(r.started_at), 'HH:mm')}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {r.ended_at ? (
                          format(new Date(r.ended_at), 'HH:mm')
                        ) : (
                          <span className="text-amber-700 font-medium">Still away</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.minutes != null ? fmtMins(r.minutes) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BreakLogSection;
