import { useCallback, useEffect, useState } from 'react';
import { Sunrise } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSince6pmYesterdayRange } from '@/lib/leadFeedDate';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * Shows how many leads have come in since 6pm the previous evening,
 * so managers know how big the overnight batch is before splitting it
 * equally between agents.
 */
export function NewSince6pmBadge({ className }: Props) {
  const [count, setCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { from, to } = getSince6pmYesterdayRange();
    if (!from) return;
    const { count: c } = await supabase
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', from.toISOString())
      .lte('created_at', (to ?? new Date()).toISOString())
      .not('status', 'in', '(lost,converted,fake_lead)');
    setCount(c ?? 0);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (count === null) return null;

  return (
    <span
      title="Leads received since 6pm yesterday — split these equally between agents"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        count > 0
          ? 'bg-amber-50 text-amber-900 border-amber-300'
          : 'bg-muted text-muted-foreground border-border',
        className,
      )}
    >
      <Sunrise className="h-3.5 w-3.5" />
      {count} new since 6pm yesterday
    </span>
  );
}

export default NewSince6pmBadge;
