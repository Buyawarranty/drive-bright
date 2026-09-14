import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { History, RotateCcw, Check, StickyNote, Loader2, BarChart3, Trophy, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { PricingVersion } from '@/hooks/usePricingVersions';


/**
 * PRICE UPDATE LOG
 * -------------------------------------------------------------------------
 * A plain, chronological record of every price model that has been saved or
 * pushed live, newest first, with a one-click "Revert price" back to any of
 * them. Reverting republishes that stored version exactly as it was — it never
 * re-values historic sales.
 */

/** A representative cell so each row shows a comparable headline figure. */
function sampleGridPrice(v: PricingVersion): number | null {
  const m: any = v.admin_matrix;
  const cell = m?.['24months']?.['100']?.['2000'] ?? m?.['24months']?.['100']?.['1000'];
  const n = Number(cell);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Average of every Quotes & Orders cell, so the percentage move is the whole
 *  curve rather than one sample cell. */
function averageGridPrice(v: PricingVersion): number | null {
  const m: any = v.admin_matrix;
  if (!m) return null;
  const values: number[] = [];
  for (const term of Object.values(m) as any[]) {
    if (!term || typeof term !== 'object') continue;
    for (const excess of Object.values(term) as any[]) {
      if (!excess || typeof excess !== 'object') continue;
      for (const cell of Object.values(excess) as any[]) {
        const n = Number(cell);
        if (Number.isFinite(n) && n > 0) values.push(n);
      }
    }
  }
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Percentage move of this price model against the one saved before it. */
function pctVsPrevious(current: PricingVersion, previous?: PricingVersion): number | null {
  if (!previous) return null;
  const a = averageGridPrice(previous);
  const b = averageGridPrice(current);
  if (!a || !b) return null;
  return Math.round(((b - a) / a) * 1000) / 10;
}

function whenLabel(v: PricingVersion): string {
  const iso = v.published_at || v.updated_at || v.created_at;
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, 'dd/MM/yyyy HH:mm') : '—';
}

type DayStat = { date: string; revenue: number; orders: number };

/**
 * Sales taken each day, so every log entry can show what the money did while
 * that price model was live. Cancelled and refunded orders are left out and
 * signup_date is the date of the sale.
 */
function useDailySales(fromISO: string | null) {
  const [days, setDays] = useState<Record<string, DayStat>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fromISO) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const map: Record<string, DayStat> = {};
        let offset = 0;
        // Paginate so we never silently stop at the 1,000-row default.
        for (let page = 0; page < 20; page++) {
          const { data, error } = await supabase
            .from('customers')
            .select('id, final_amount, signup_date, status')
            .gte('signup_date', fromISO)
            .order('signup_date', { ascending: true })
            .range(offset, offset + 999);
          if (error) throw error;
          (data || []).forEach((c: any) => {
            const status = (c.status || '').toLowerCase();
            if (status.includes('cancelled') || status.includes('refunded')) return;
            if (!c.signup_date) return;
            const key = format(new Date(c.signup_date), 'yyyy-MM-dd');
            const bucket = (map[key] ||= { date: key, revenue: 0, orders: 0 });
            bucket.revenue += Number(c.final_amount) || 0;
            bucket.orders += 1;
          });
          if (!data || data.length < 1000) break;
          offset += 1000;
        }
        if (!cancelled) setDays(map);
      } catch {
        // leave the panel showing prices only
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromISO]);

  return { days, loading };
}

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export default function PriceUpdateLogPanel({
  versions,
  busy,
  onRevert,
  onSaveNote,
}: {
  versions: PricingVersion[];
  busy?: boolean;
  onRevert: (v: PricingVersion) => void;
  /** Save the performance note against this price model. */
  onSaveNote?: (id: string, notes: string) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  // Earliest date in the log — everything we need sales for.
  const earliestISO = useMemo(() => {
    const times = versions
      .map(v => new Date(v.published_at || v.updated_at || v.created_at).getTime())
      .filter(t => Number.isFinite(t) && t > 0);
    if (!times.length) return null;
    return new Date(Math.min(...times)).toISOString();
  }, [versions]);

  const { days: salesByDay, loading: salesLoading } = useDailySales(earliestISO);

  /** Sales for the window this price model was in use (until the next entry). */
  const windowStats = (v: PricingVersion, newer?: PricingVersion) => {
    const startISO = v.published_at || v.updated_at || v.created_at;
    const start = new Date(startISO);
    if (!Number.isFinite(start.getTime())) return null;
    const endRaw = newer ? new Date(newer.published_at || newer.updated_at || newer.created_at) : new Date();
    const end = Number.isFinite(endRaw.getTime()) ? endRaw : new Date();
    const startKey = format(start, 'yyyy-MM-dd');
    const endKey = format(end, 'yyyy-MM-dd');
    const list = Object.values(salesByDay)
      .filter(d => d.date >= startKey && d.date <= endKey)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const revenue = list.reduce((s, d) => s + d.revenue, 0);
    const orders = list.reduce((s, d) => s + d.orders, 0);
    return { list, revenue, orders, aov: orders ? revenue / orders : 0, startKey, endKey };
  };


  const saveNote = async (id: string, current: string) => {
    if (!onSaveNote) return;
    setSavingId(id);
    try {
      await onSaveNote(id, (drafts[id] ?? current ?? '').trim());
      toast.success('Note saved');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the note');
    } finally {
      setSavingId(null);
    }
  };


  const rows = useMemo(() => {
    const sorted = [...versions].sort((a, b) => {
      const ta = new Date(a.published_at || a.updated_at || a.created_at).getTime() || 0;
      const tb = new Date(b.published_at || b.updated_at || b.created_at).getTime() || 0;
      return tb - ta;
    });
    return showAll ? sorted : sorted.slice(0, 8);
  }, [versions, showAll]);

  // Sales-per-day for every row, so we can name the best performer and
  // compare every other row against it — not just against the previous one.
  const statsById = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number; aov: number; daysLive: number; salesPerDay: number }> = {};
    rows.forEach((v, i) => {
      const s = windowStats(v, rows[i - 1]);
      if (!s) return;
      const daysLive = Math.max(1, s.list.length);
      map[v.id] = {
        revenue: s.revenue,
        orders: s.orders,
        aov: s.aov,
        daysLive,
        salesPerDay: s.orders / daysLive,
      };
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, salesByDay]);

  /** The best-performing price model: highest sales per day, requiring at
   *  least 2 days live and 3 sales so one lucky afternoon can't win. */
  const bestId = useMemo(() => {
    let best: string | null = null;
    let bestRate = -1;
    for (const [id, s] of Object.entries(statsById)) {
      if (s.daysLive < 2 || s.orders < 3) continue;
      if (s.salesPerDay > bestRate) {
        bestRate = s.salesPerDay;
        best = id;
      }
    }
    return best;
  }, [statsById]);

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <History className="h-5 w-5 text-primary" />
          Price update log
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Every price model saved or pushed live, newest first. Press{' '}
          <strong>Revert price</strong> on any row to make those exact Quotes &amp; Orders prices
          live again — the website price follows at its published gap. Sales already taken keep the
          price they were sold at.
        </p>
        <p className="text-xs text-muted-foreground">
          The green model converted best while live. Price changes are shown separately and do not
          decide the winner. A model needs at least 2 days and 3 sales to be ranked.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No price models recorded yet.</p>
        )}

        {(() => {
          const bestVersion = bestId ? rows.find(row => row.id === bestId) : null;
          const bestStats = bestId ? statsById[bestId] : null;
          if (!bestVersion || !bestStats) return null;
          const bestIsLive = bestVersion.status === 'live';
          return (
            <div className="rounded-lg border-2 border-success bg-success/10 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                <Trophy className="h-4 w-4 shrink-0 text-success" />
                <span>Most successful price model so far: {bestVersion.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    bestIsLive ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {bestIsLive ? 'Live now' : 'Not live now'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
                <span className="font-semibold">{bestStats.salesPerDay.toFixed(1)} sales/day</span>
                <span className="font-semibold">{bestStats.orders} sales over {bestStats.daysLive} days</span>
                <span className="font-semibold">{money(bestStats.revenue)} revenue</span>
                <span className="font-semibold">AOV {money(bestStats.aov)}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                {bestIsLive
                  ? 'Recommended: keep this model live — it converts better than every other model tried.'
                  : `Recommended: press “Revert price” on the ${bestVersion.label} row below to make these prices live again.`}
              </p>
            </div>
          );
        })()}

        {rows.map((v, i) => {
          const isLive = v.status === 'live';
          const sample = sampleGridPrice(v);
          const move = pctVsPrevious(v, rows[i + 1]);
          const stats = windowStats(v, rows[i - 1]);
          const isBest = bestId === v.id;
          const bestVersion = bestId ? rows.find(row => row.id === bestId) : null;
          const bestStats = bestId ? statsById[bestId] : null;
          const currentStats = statsById[v.id];
          const salesGap = !isBest && currentStats && bestStats && bestStats.salesPerDay > 0
            ? Math.round(((currentStats.salesPerDay - bestStats.salesPerDay) / bestStats.salesPerDay) * 100)
            : null;
          return (
            <div
              key={v.id}
              className={`overflow-hidden rounded-lg border-2 p-3 ${
                isBest
                  ? 'border-success bg-success/5 shadow-sm'
                  : isLive
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
              }`}
            >
              {isBest && (
                <div className="-mx-3 -mt-3 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 bg-success px-3 py-2 text-sm font-bold text-success-foreground">
                  <Trophy className="h-4 w-4 shrink-0" />
                  {isLive ? (
                    <span>Best converting — and it is live now</span>
                  ) : (
                    <>
                      <span>Best converting — but NOT live now</span>
                      <span className="font-medium opacity-90">
                        Press “Revert price” to make these prices live again
                      </span>
                    </>
                  )}
                </div>
              )}
              {isLive && !isBest && salesGap !== null && (
                <div className="-mx-3 -mt-3 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b-2 border-primary bg-primary/10 px-3 py-2 text-sm font-bold text-foreground">
                  <Radio className="h-4 w-4 shrink-0 text-primary" />
                  <span>Live now — converting {Math.abs(salesGap)}% below the best model</span>
                  {bestVersion && (
                    <span className="font-medium text-muted-foreground">Best: {bestVersion.label}</span>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold truncate">{v.label}</span>
                    {isLive ? (
                      <Badge className="gap-1">
                        <Check className="h-3 w-3" /> Live now
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                        Not live now
                      </Badge>
                    )}
                    {move !== null && (
                      <Badge
                        variant="outline"
                        title="How the average Quotes & Orders price moved compared with the price model saved before this one"
                        className="border-border bg-muted text-muted-foreground"
                      >
                        Price change only: {move === 0 ? 'same as previous' : `${Math.abs(move)}% ${move > 0 ? 'higher' : 'lower'} than previous`}
                      </Badge>
                    )}
                    {isBest && (
                      <Badge className="gap-1 bg-success text-success-foreground hover:bg-success">
                        <Trophy className="h-3 w-3" /> Best conversion rate
                      </Badge>
                    )}
                    {salesGap !== null && bestVersion && bestStats && currentStats && (
                      <Badge
                        variant="outline"
                        title={`${v.label} made ${currentStats.salesPerDay.toFixed(1)} sales/day. The best-performing model, ${bestVersion.label}, made ${bestStats.salesPerDay.toFixed(1)} sales/day.`}
                        className="border-primary/40 bg-primary/10 text-foreground"
                      >
                        {Math.abs(salesGap)}% fewer sales/day than the best model: {bestVersion.label}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {v.published_at ? 'Pushed live' : 'Saved'} {whenLabel(v)}
                    {sample !== null && <> · 2yr £100 excess / £2,000 limit: £{sample}</>}
                    {' · website −'}
                    {Math.round(Number(v.step3_discount_pct) > 0 ? Number(v.step3_discount_pct) : 10)}%
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpenNotes(s => ({ ...s, [v.id]: !s[v.id] }))}
                  >
                    <StickyNote className="mr-1 h-4 w-4" />
                    {openNotes[v.id] ? 'Hide note' : v.notes ? 'Edit note' : 'Add note'}
                  </Button>
                  {isLive ? (
                    <span className="text-xs font-medium text-primary">Currently live</span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => onRevert(v)}
                    >
                      <RotateCcw className="mr-1 h-4 w-4" />
                      Revert price
                    </Button>
                  )}
                </div>
              </div>

              {/* What the money did while this price model was in use. */}
              {stats && (
                <div className="mt-2 rounded-md border bg-muted/30 p-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold">
                      {money(stats.revenue)} revenue
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-semibold">AOV {money(stats.aov)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {stats.orders} {stats.orders === 1 ? 'sale' : 'sales'} over{' '}
                      {stats.list.length || 0} {stats.list.length === 1 ? 'day' : 'days'}
                    </span>
                    {salesLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    {stats.list.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-6 px-2 text-xs"
                        onClick={() => setOpenDays(s => ({ ...s, [v.id]: !s[v.id] }))}
                      >
                        {openDays[v.id] ? 'Hide daily figures' : 'Daily revenue & AOV'}
                      </Button>
                    )}
                  </div>

                  {openDays[v.id] && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-1 pr-3 font-medium">Day</th>
                            <th className="py-1 pr-3 font-medium text-right">Sales</th>
                            <th className="py-1 pr-3 font-medium text-right">Revenue</th>
                            <th className="py-1 font-medium text-right">AOV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.list.map(d => (
                            <tr key={d.date} className="border-t">
                              <td className="py-1 pr-3">{format(new Date(d.date), 'EEE dd/MM/yyyy')}</td>
                              <td className="py-1 pr-3 text-right">{d.orders}</td>
                              <td className="py-1 pr-3 text-right font-medium">{money(d.revenue)}</td>
                              <td className="py-1 text-right">{money(d.orders ? d.revenue / d.orders : 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Performance notes — what this price model did, in plain words. */}
              {v.notes && !openNotes[v.id] && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 whitespace-pre-wrap">
                  {v.notes}
                </div>
              )}

              {openNotes[v.id] && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    rows={3}
                    placeholder="How did this price perform? e.g. 12 sales in 4 days, average order £512, conversion held at 8% — kept the 2yr uplift."
                    value={drafts[v.id] ?? v.notes ?? ''}
                    onChange={e => setDrafts(s => ({ ...s, [v.id]: e.target.value }))}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingId === v.id || !onSaveNote}
                      onClick={() => saveNote(v.id, v.notes ?? '')}
                    >
                      {savingId === v.id && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                      Save note
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDrafts(s => ({ ...s, [v.id]: v.notes ?? '' }));
                        setOpenNotes(s => ({ ...s, [v.id]: false }));
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

          );
        })}

        {versions.length > 8 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(s => !s)}>
            {showAll ? 'Show fewer' : `Show all ${versions.length} entries`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
