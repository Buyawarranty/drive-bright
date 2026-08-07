import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Percent, ShieldAlert } from 'lucide-react';
import { resolveWebPrice } from '@/lib/pricing/webPriceGap';
import {
  CODE_WEB_DISCOUNT_PCT,
  MAX_WEB_DISCOUNT_PCT,
} from '@/lib/pricing/pricingVersionConfig';
import type { PaymentPeriod } from '@/lib/pricingMatrix';

const TERMS: PaymentPeriod[] = ['12months', '24months', '36months'];

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export default function WebGapDraftPanel({ gridTotals }: { gridTotals?: Partial<Record<PaymentPeriod, number>> }) {
  const [gap, setGap] = useState(String(CODE_WEB_DISCOUNT_PCT));
  const [promo, setPromo] = useState('25');
  const [motorbike, setMotorbike] = useState(false);

  const defaults: Record<PaymentPeriod, number> = {
    '12months': gridTotals?.['12months'] ?? 460,
    '24months': gridTotals?.['24months'] ?? 780,
    '36months': gridTotals?.['36months'] ?? 1090,
  };

  const rows = useMemo(
    () =>
      TERMS.map((term) => ({
        term,
        gridTotal: defaults[term],
        result: resolveWebPrice({
          gridTotal: defaults[term],
          paymentPeriod: term,
          config: { web_discount_pct: Number(gap) || CODE_WEB_DISCOUNT_PCT },
          isMotorbike: motorbike,
          promoDiscount: Number(promo) || 0,
        }),
      })),
    [defaults['12months'], defaults['24months'], defaults['36months'], gap, promo, motorbike]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-4 w-4" /> Web price gap (draft)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="text-sm">
            The gap now lives on the pricing version as <code>web_discount_pct</code> (clamped 0–
            {MAX_WEB_DISCOUNT_PCT}%), so 5% or 7% can be tested without a code change. The floor
            binds on the <strong>web</strong> price, and a promo is trimmed rather than allowed to
            breach it. <strong>Draft only — live pages still use the fixed 10%.</strong>
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Web gap %</Label>
            <Input
              className="w-24"
              type="number"
              min={0}
              max={MAX_WEB_DISCOUNT_PCT}
              value={gap}
              onChange={(e) => setGap(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Promo on top (£)</Label>
            <Input
              className="w-28"
              type="number"
              min={0}
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch id="webgap-bike" checked={motorbike} onCheckedChange={setMotorbike} />
            <Label htmlFor="webgap-bike" className="text-xs">Motorbike floor (half)</Label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {rows.map(({ term, gridTotal, result }) => (
            <div key={term} className="rounded-md border p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{term.replace('months', ' months')}</span>
                {result.floorBinding && (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <ShieldAlert className="h-3 w-3" /> floor binds
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Quotes &amp; Orders {money(gridTotal)}
              </div>
              <div className="text-lg font-semibold">{money(result.webPrice)}</div>
              <div className="text-xs text-muted-foreground">
                −{result.gapPct}% = {money(result.rawWebPrice)} · floor {money(result.floor)}
              </div>
              <div className="text-xs text-muted-foreground">
                Promo applied {money(result.promoApplied)}
                {result.promoTrimmed ? ' (trimmed at floor)' : ''} · saving {money(result.saving)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
