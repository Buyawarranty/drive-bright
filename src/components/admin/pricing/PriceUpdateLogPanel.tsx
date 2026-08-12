import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { History, RotateCcw, Check, StickyNote, Loader2 } from 'lucide-react';
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

function whenLabel(v: PricingVersion): string {
  const iso = v.published_at || v.updated_at || v.created_at;
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, 'dd/MM/yyyy HH:mm') : '—';
}

export default function PriceUpdateLogPanel({
  versions,
  busy,
  onRevert,
}: {
  versions: PricingVersion[];
  busy?: boolean;
  onRevert: (v: PricingVersion) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const sorted = [...versions].sort((a, b) => {
      const ta = new Date(a.published_at || a.updated_at || a.created_at).getTime() || 0;
      const tb = new Date(b.published_at || b.updated_at || b.created_at).getTime() || 0;
      return tb - ta;
    });
    return showAll ? sorted : sorted.slice(0, 8);
  }, [versions, showAll]);

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
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No price models recorded yet.</p>
        )}

        {rows.map(v => {
          const isLive = v.status === 'live';
          const sample = sampleGridPrice(v);
          return (
            <div
              key={v.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                isLive ? 'border-primary bg-primary/5' : 'bg-card'
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold truncate">{v.label}</span>
                  {isLive ? (
                    <Badge className="gap-1">
                      <Check className="h-3 w-3" /> Live now
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="capitalize">
                      {v.status}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {v.published_at ? 'Pushed live' : 'Saved'} {whenLabel(v)}
                  {sample !== null && <> · 2yr £100 excess / £2,000 limit: £{sample}</>}
                  {' · website −'}
                  {Math.round(Number(v.step3_discount_pct) > 0 ? Number(v.step3_discount_pct) : 10)}%
                </div>
                {v.notes && (
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{v.notes}</div>
                )}
              </div>

              <div className="shrink-0">
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
