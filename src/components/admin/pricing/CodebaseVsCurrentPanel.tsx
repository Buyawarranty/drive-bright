import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GitCompare, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import {
  usePricingVersions,
  buildCodeAdminMatrix,
  PERIODS,
  EXCESSES,
  CLAIM_LIMITS,
} from '@/hooks/usePricingVersions';
import {
  applyCustomerJourneyUplift,
  deriveCustomerPriceFromAdmin,
  BASE_PRICING_MATRIX,
} from '@/lib/pricingMatrix';

/**
 * Read-only comparison: the pricing baked into the code base (July 2026 matrix)
 * versus whatever grid is currently live/published.
 * Pure presentation — never writes, publishes or changes any pricing.
 */

const money = (n: number) => `£${Math.round(n).toLocaleString()}`;

const TERM_LABEL: Record<string, string> = {
  '12months': '1 year',
  '24months': '2 years',
  '36months': '3 years',
};

const DiffBadge: React.FC<{ code: number; current: number }> = ({ code, current }) => {
  const diff = current - code;
  const pct = code ? (diff / code) * 100 : 0;
  if (Math.abs(diff) < 0.5) {
    return (
      <Badge variant="outline" className="gap-1 font-mono text-[11px]">
        <Minus className="h-3 w-3" /> same
      </Badge>
    );
  }
  const up = diff > 0;
  return (
    <Badge
      variant="outline"
      className={`gap-1 font-mono text-[11px] ${
        up
          ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
          : 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30'
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : '−'}
      {money(Math.abs(diff))} ({up ? '+' : '−'}
      {Math.abs(pct).toFixed(1)}%)
    </Badge>
  );
};

export default function CodebaseVsCurrentPanel() {
  const { versions, loading } = usePricingVersions();
  const [claimLimit, setClaimLimit] = useState<number>(1250);

  const liveVersion = useMemo(() => versions.find(v => v.status === 'live') ?? null, [versions]);

  const codeMatrix = useMemo(() => buildCodeAdminMatrix(), []);
  const currentMatrix = useMemo(
    () => (liveVersion?.admin_matrix as any) ?? codeMatrix,
    [liveVersion, codeMatrix]
  );
  const currentDiscountPct = liveVersion?.step3_discount_pct ?? 10;

  const rows = useMemo(() => {
    return PERIODS.flatMap(period =>
      EXCESSES.map(excess => {
        const code = Number(codeMatrix[period]?.[String(excess)]?.[String(claimLimit)] ?? 0);
        const current = Number(
          currentMatrix?.[period]?.[String(excess)]?.[String(claimLimit)] ?? code
        );
        const codeBase = Number(
          (BASE_PRICING_MATRIX as any)[period]?.[excess]?.[claimLimit] ?? 0
        );
        return {
          period,
          excess,
          code,
          current,
          codeWeb: applyCustomerJourneyUplift(codeBase, 'customer'),
          currentWeb: deriveCustomerPriceFromAdmin(current, currentDiscountPct),
        };
      })
    );
  }, [codeMatrix, currentMatrix, claimLimit, currentDiscountPct]);

  const summary = useMemo(() => {
    return PERIODS.map(period => {
      const set = rows.filter(r => r.period === period);
      const code = set.reduce((s, r) => s + r.code, 0) / (set.length || 1);
      const current = set.reduce((s, r) => s + r.current, 0) / (set.length || 1);
      return { period, code, current, pct: code ? ((current - code) / code) * 100 : 0 };
    });
  }, [rows]);

  return (
    <div className="space-y-4">
      <Alert className="border-indigo-300 bg-indigo-50 dark:bg-indigo-950/30">
        <GitCompare className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Comparison only — nothing is changed or published here.</strong> Left column is the
          pricing hard-coded in the code base (July 2026 matrix). Right column is the grid currently
          live{liveVersion ? <> — <strong>{liveVersion.label}</strong></> : ' (no published version yet, so it still matches the code base)'}.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-3">
        {summary.map(s => (
          <Card key={s.period}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{TERM_LABEL[s.period]}</CardTitle>
              <CardDescription>Average across all excess tiers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Code base 7/2026</span>
                <span className="font-mono">{money(s.code)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current live</span>
                <span className="font-mono font-semibold">{money(s.current)}</span>
              </div>
              <div className="pt-1">
                <DiffBadge code={s.code} current={s.current} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Grid-by-grid comparison</CardTitle>
          <CardDescription>
            Quotes &amp; Orders price, plus the website (Step 3/4) price each one produces. Website
            discount currently set to {currentDiscountPct || 10}%.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground mr-1">Claim limit:</span>
            {CLAIM_LIMITS.map(limit => (
              <Button
                key={limit}
                type="button"
                size="sm"
                variant={claimLimit === limit ? 'default' : 'outline'}
                onClick={() => setClaimLimit(limit)}
              >
                {money(limit)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading current live prices…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Term</th>
                    <th className="text-left py-2 px-3 font-medium">Excess</th>
                    <th className="text-right py-2 px-3 font-medium">Code base 7/2026</th>
                    <th className="text-right py-2 px-3 font-medium">Current live</th>
                    <th className="text-right py-2 px-3 font-medium">Difference</th>
                    <th className="text-right py-2 px-3 font-medium">Website: code → current</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={`${r.period}-${r.excess}`} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{TERM_LABEL[r.period]}</td>
                      <td className="py-2 px-3">{money(r.excess)}</td>
                      <td className="py-2 px-3 text-right font-mono">{money(r.code)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {money(r.current)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <DiffBadge code={r.code} current={r.current} />
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">
                        {money(r.codeWeb)} → {money(r.currentWeb)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Which one works better?</CardTitle>
          <CardDescription>How to read the numbers above.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            <strong className="text-foreground">Green (+)</strong> means the live grid charges more
            than the code base — higher margin per sale, but a harder close, especially on 2 and 3
            year terms where we already sit above the market.
          </p>
          <p>
            <strong className="text-foreground">Red (−)</strong> means the live grid is cheaper than
            the code base — easier conversion, so watch average order value and claim cost per
            policy over the same period.
          </p>
          <p>
            Compare each change against conversion in Analytics for the weeks either side of the
            publish date: the version with the higher revenue per quote wins, not the higher price.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
