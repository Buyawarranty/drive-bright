import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

const BUCKETS = [
  { label: '0–7 days', max: 7 },
  { label: '8–14 days', max: 14 },
  { label: '15–30 days', max: 30 },
  { label: '31–60 days', max: 60 },
  { label: '61–90 days', max: 90 },
  { label: '91–180 days', max: 180 },
  { label: '181–365 days', max: 365 },
  { label: 'Over a year', max: Infinity },
];

const normReg = (v?: string | null) => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normEmail = (v?: string | null) => (v || '').trim().toLowerCase();

interface Row {
  days: number;
  claimedBefore: boolean;
}

export const CancellationTimingPanel: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: cancelled }, { data: claims }] = await Promise.all([
        supabase
          .from('customers')
          .select('id, email, registration_plate, signup_date, status, deleted_at, cancellation_note_updated_at, updated_at')
          .in('status', ['Cancelled', 'cancelled', 'Refunded', 'refunded'])
          .limit(5000),
        supabase
          .from('claims_submissions')
          .select('vehicle_registration, email, created_at')
          .limit(5000),
      ]);
      if (!active) return;

      const claimsByReg = new Map<string, number[]>();
      const claimsByEmail = new Map<string, number[]>();
      (claims || []).forEach((c: any) => {
        const t = new Date(c.created_at).getTime();
        if (isNaN(t)) return;
        const reg = normReg(c.vehicle_registration);
        const em = normEmail(c.email);
        if (reg) claimsByReg.set(reg, [...(claimsByReg.get(reg) || []), t]);
        if (em) claimsByEmail.set(em, [...(claimsByEmail.get(em) || []), t]);
      });

      const out: Row[] = [];
      (cancelled || []).forEach((c: any) => {
        const start = new Date(c.signup_date).getTime();
        const endRaw = c.cancellation_note_updated_at || c.deleted_at || c.updated_at;
        const end = new Date(endRaw).getTime();
        if (isNaN(start) || isNaN(end)) return;
        const days = Math.floor((end - start) / 86400000);
        if (days < 0 || days > 365 * 6) return;
        const times = [
          ...(claimsByReg.get(normReg(c.registration_plate)) || []),
          ...(claimsByEmail.get(normEmail(c.email)) || []),
        ];
        const claimedBefore = times.some(t => t >= start && t <= end);
        out.push({ days, claimedBefore });
      });

      setRows(out);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const { data, total, claimedCount, claimedPct, medianDays, avgDays } = useMemo(() => {
    const buckets = BUCKETS.map(b => ({ label: b.label, cancellations: 0, claimedFirst: 0 }));
    rows.forEach(r => {
      const idx = BUCKETS.findIndex(b => r.days <= b.max);
      const bucket = buckets[idx === -1 ? buckets.length - 1 : idx];
      bucket.cancellations += 1;
      if (r.claimedBefore) bucket.claimedFirst += 1;
    });
    const sorted = [...rows].map(r => r.days).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const avg = sorted.length ? Math.round(sorted.reduce((s, d) => s + d, 0) / sorted.length) : 0;
    const claimed = rows.filter(r => r.claimedBefore).length;
    return {
      data: buckets,
      total: rows.length,
      claimedCount: claimed,
      claimedPct: rows.length ? Math.round((claimed / rows.length) * 1000) / 10 : 0,
      medianDays: median,
      avgDays: avg,
    };
  }, [rows]);

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader>
        <CardTitle>How long after buying do customers cancel?</CardTitle>
        <CardDescription className="mt-1">
          Days between the purchase date and the date the order was cancelled or refunded, plus how many of those
          customers made a claim before they cancelled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{total.toLocaleString('en-GB')} cancellations</Badge>
          <Badge variant="secondary">Median {medianDays} days</Badge>
          <Badge variant="secondary">Average {avgDays} days</Badge>
          <Badge variant="outline" className="border-red-300 text-red-700">
            {claimedPct}% claimed before cancelling ({claimedCount.toLocaleString('en-GB')})
          </Badge>
        </div>

        {loading ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">Loading…</div>
        ) : total === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">No cancellations found</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
              <YAxis allowDecimals={false} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  Number(value).toLocaleString('en-GB'),
                  name === 'cancellations' ? 'Cancellations' : 'Claimed first',
                ]}
                labelStyle={{ fontWeight: 'bold' }}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Bar dataKey="cancellations" fill="#ef4444" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill="#ef4444" />)}
              </Bar>
              <Bar dataKey="claimedFirst" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium mb-2">Claimed before cancelling</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
            {data.filter(d => d.cancellations > 0).map(d => (
              <div key={d.label} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-semibold">
                  {Math.round((d.claimedFirst / d.cancellations) * 100)}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            A claim counts as "before cancelling" when it was submitted between the purchase date and the cancellation
            date, matched on registration or email.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
