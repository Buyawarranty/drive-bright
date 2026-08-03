import { useCallback, useEffect, useState } from 'react';
import { Sunrise, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchLeadsSince6pm, tallyByAgent } from '@/lib/since6pmLeadCounts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useRebalanceWindow } from '@/lib/rebalanceWindow';

interface Props {
  className?: string;
}

interface AgentRow {
  id: string;
  name: string;
  count: number;
}

/**
 * Shows how many leads have come in since 6pm the previous evening,
 * plus a per-agent breakdown so managers know who has already been fed
 * before splitting the overnight batch.
 */
export function NewSince6pmBadge({ className }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [unassigned, setUnassigned] = useState(0);
  const { from, to, label } = useRebalanceWindow();

  const load = useCallback(async () => {
    const [leads, { data: admins }] = await Promise.all([
      fetchLeadsSince6pm(from, to),
      supabase.from('admin_users').select('id, first_name, last_name, email'),
    ]);

    const nameById = new Map<string, string>();
    (admins || []).forEach((a: any) => {
      nameById.set(
        a.id,
        `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown',
      );
    });

    const { tally, unassigned: none, total } = tallyByAgent(leads);

    setRows(
      Array.from(tally.entries())
        .map(([id, c]) => ({ id, name: nameById.get(id) || id.slice(0, 8), count: c }))
        .sort((a, b) => b.count - a.count),
    );
    setUnassigned(none);
    setCount(total);
  }, [from, to]);


  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (count === null) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`Leads received since ${label} — click to see who they went to`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
            count > 0
              ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              : 'bg-muted text-muted-foreground border-border hover:bg-muted/70',
            className,
          )}
        >
          <Sunrise className="h-3.5 w-3.5" />
          {count} new since {label}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Who got them</p>
          <p className="text-xs text-muted-foreground">Since {label} · {count} lead{count === 1 ? '' : 's'}</p>
        </div>
        <ul className="max-h-64 overflow-y-auto divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate text-foreground">{r.name}</span>
              <span className="font-semibold tabular-nums text-foreground">{r.count}</span>
            </li>
          ))}
          {unassigned > 0 && (
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-muted-foreground italic">Unassigned</span>
              <span className="font-semibold tabular-nums text-muted-foreground">{unassigned}</span>
            </li>
          )}
          {rows.length === 0 && unassigned === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">No leads in this window.</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export default NewSince6pmBadge;
