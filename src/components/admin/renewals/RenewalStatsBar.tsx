import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Renewal performance statistics.
 * Renewal leads are generated with original_source 'renewal' on sales_leads,
 * so conversion and contact stats come from there; approval holds come from
 * renewal_reviews.
 */

interface Stats {
  total: number;
  converted: number;
  notContacted: number;
  inProgress: number;
  awaitingApproval: number;
  doNotRenew: number;
}

export const RenewalStatsBar: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;

    const leadCount = async (build?: (q: any) => any) => {
      try {
        let q = (supabase.from('sales_leads') as any)
          .select('id', { count: 'exact', head: true })
          .eq('original_source', 'renewal');
        if (build) q = build(q);
        const { count } = await q;
        return count || 0;
      } catch {
        return 0;
      }
    };

    const reviewCount = async (status: string) => {
      try {
        const { count } = await (supabase.from('renewal_reviews') as any)
          .select('id', { count: 'exact', head: true })
          .eq('status', status);
        return count || 0;
      } catch {
        return 0;
      }
    };

    (async () => {
      const [total, converted, notContacted, lostOrClosed, awaitingApproval, doNotRenew] = await Promise.all([
        leadCount(),
        leadCount((q) => q.in('status', ['converted', 'upgraded'])),
        // Due and never touched: no calls logged and never contacted.
        leadCount((q) => q.eq('call_count', 0).is('last_contacted_at', null)
          .not('status', 'in', "('converted','upgraded','lost','fake_lead','do_not_contact','not_interested','bought_elsewhere','archived')")),
        leadCount((q) => q.in('status', ['lost', 'do_not_contact', 'not_interested', 'bought_elsewhere', 'fake_lead', 'archived'])),
        reviewCount('pending'),
        reviewCount('do_not_renew'),
      ]);
      if (cancelled) return;
      setStats({
        total,
        converted,
        notContacted,
        inProgress: Math.max(0, total - converted - notContacted - lostOrClosed),
        awaitingApproval,
        doNotRenew,
      });
    })();

    return () => { cancelled = true; };
  }, []);

  const rate = stats && stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : null;

  const cards = [
    { label: 'Renewal leads created', value: stats?.total ?? null, hint: 'Every renewal that flowed into New Leads.' },
    { label: 'Converted', value: stats?.converted ?? null, hint: 'Renewal leads marked converted or upgraded.', extra: rate !== null ? `${rate}% of all renewal leads` : undefined },
    { label: 'Due — not contacted yet', value: stats?.notContacted ?? null, hint: 'Renewal leads with no calls and never contacted.' },
    { label: 'Contacted — still open', value: stats?.inProgress ?? null, hint: 'Being worked but not yet converted or closed.' },
    { label: 'Awaiting manager approval', value: stats?.awaitingApproval ?? null, hint: 'Claim-history renewals waiting in Renewal approval.' },
    { label: 'Do not renew', value: stats?.doNotRenew ?? null, hint: 'Cancelled, refunded or declined by a manager.' },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-3" title={c.hint}>
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-xl font-semibold">
              {c.value === null || c.value === undefined ? <Loader2 className="h-4 w-4 animate-spin" /> : c.value.toLocaleString('en-GB')}
            </div>
            {c.extra && <div className="text-[11px] text-muted-foreground mt-0.5">{c.extra}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default RenewalStatsBar;
