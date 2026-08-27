import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * RENEWALS SANDBOX — management summary cards (Stage 7, Step 20)
 * Lightweight head-only count queries. No customer detail or history is loaded.
 */

const EXCLUDED = "('cancelled','refunded','expired','voided','deleted')";

const dayIso = (offset: number) => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

interface Metric { label: string; value: number | null; hint: string; }

export const RenewalSummaryCards: React.FC = () => {
  const [metrics, setMetrics] = useState<Metric[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const count = async (build: (q: any) => any) => {
      try {
        const q = build(
          (supabase.from('customer_policies') as any)
            .select('id', { count: 'exact', head: true })
            .not('status', 'in', EXCLUDED)
            .or('is_deleted.is.null,is_deleted.eq.false'),
        );
        const { count: c } = await q;
        return c || 0;
      } catch { return 0; }
    };

    (async () => {
      const [active, next12, due60, worked] = await Promise.all([
        count((q) => q.gte('policy_end_date', dayIso(0))),
        count((q) => q.gte('policy_end_date', dayIso(0)).lte('policy_end_date', dayIso(365))),
        count((q) => q.gte('policy_end_date', dayIso(0)).lte('policy_end_date', dayIso(60))),
        count((q) => q.gte('updated_at', dayIso(0))),
      ]);
      if (cancelled) return;
      setMetrics([
        { label: 'Active policies', value: active, hint: 'Cover still in date.' },
        { label: 'Renewals next 12 months', value: next12, hint: 'Expiring within a year.' },
        { label: 'Worked today', value: worked, hint: 'Policy records touched today.' },
        { label: 'Due in next 60 days', value: due60, hint: 'The active renewal window.' },
      ]);
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(metrics || [
        { label: 'Active policies', value: null, hint: '' },
        { label: 'Renewals next 12 months', value: null, hint: '' },
        { label: 'Worked today', value: null, hint: '' },
        { label: 'Due in next 60 days', value: null, hint: '' },
      ]).map((m) => (
        <Card key={m.label}>
          <CardContent className="p-3" title={m.hint}>
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="mt-1 text-xl font-semibold">
              {m.value === null ? <Loader2 className="h-4 w-4 animate-spin" /> : m.value.toLocaleString('en-GB')}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default RenewalSummaryCards;
