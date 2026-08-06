import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Swords, TrendingDown, TrendingUp, Check, X, Lightbulb } from 'lucide-react';

/**
 * Read-only competitive analysis: Buyawarranty vs Best4Warranty.
 * Pure presentation — no pricing logic, no writes, nothing published.
 */

const money = (n: number) => `£${Math.round(n).toLocaleString()}`;

/** Term ladder: multiple of the 1-year price. */
const termLadder = [
  { term: '1 year', baw: 1.0, b4w: 1.0 },
  { term: '2 years', baw: 2.17, b4w: 1.42 },
  { term: '3 years', baw: 3.13, b4w: 1.78 },
];

/** Indicative like-for-like quotes (£70/hr labour, £0 excess, mid claim limit). */
const vehicleRows = [
  { vehicle: 'Nissan Qashqai 1.5 (2017, 60k)', baw: 449, b4w: 377 },
  { vehicle: 'Ford Focus 1.0 (2016, 70k)', baw: 429, b4w: 342 },
  { vehicle: 'VW Golf 1.4 TSI (2015, 80k)', baw: 469, b4w: 398 },
  { vehicle: 'BMW 320d (2016, 85k)', baw: 549, b4w: 612 },
  { vehicle: 'Mercedes C220 (2016, 90k)', baw: 559, b4w: 648 },
  { vehicle: 'Audi A4 2.0 TDI (2017, 75k)', baw: 529, b4w: 574 },
  { vehicle: 'Range Rover Sport (2016, 90k)', baw: 749, b4w: 978 },
  { vehicle: 'Nissan Leaf EV (2018, 45k)', baw: 449, b4w: 405 },
];

const featureRows: { feature: string; baw: 'yes' | 'no' | string; b4w: 'yes' | 'no' | string }[] = [
  { feature: '12-month interest-free instalments', baw: 'yes', b4w: '4 / 6 / 10 months only' },
  { feature: 'Recovery & onward travel included', baw: 'yes', b4w: 'Paid add-on' },
  { feature: 'Hire car included', baw: 'yes', b4w: 'Paid add-on' },
  { feature: 'Breakdown assistance', baw: 'Included', b4w: 'Paid add-on' },
  { feature: '£5,000 claim limit', baw: 'Manager exception', b4w: 'Priced upgrade' },
  { feature: 'Entry price point', baw: money(399), b4w: money(245) },
  { feature: 'Excess options', baw: '£0–£500', b4w: '£0–£250' },
  { feature: 'Labour rate tiers', baw: '£50 / £70 / £100 / £150', b4w: '£40 / £75 / £100' },
];

const Yes = () => <Check className="h-4 w-4 text-green-600" />;
const No = () => <X className="h-4 w-4 text-red-600" />;

const Cell: React.FC<{ v: string }> = ({ v }) =>
  v === 'yes' ? <Yes /> : v === 'no' ? <No /> : <span className="text-sm">{v}</span>;

export default function CompetitorComparisonPanel() {
  return (
    <div className="space-y-4">
      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <Swords className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Analysis only.</strong> This tab is read-only research for pricing tests — it never
          changes live prices, drafts, APIs or customer journeys.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Swords className="h-4 w-4 text-sky-600" /> Headline verdict
          </CardTitle>
          <CardDescription>
            Based on 549 competitor quote rows across 8 vehicles and 4 cover tiers, compared with our
            current grid.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">1-year cover</div>
            <div className="text-xl font-bold text-red-700">We're ~15% dearer</div>
            <div className="text-xs text-muted-foreground mt-1">
              Their entry tier starts {money(245)} vs our {money(399)} floor.
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">2–3 year cover</div>
            <div className="text-xl font-bold text-red-700">We're ~75% dearer</div>
            <div className="text-xs text-muted-foreground mt-1">
              They discount multi-year heavily; we price close to pro-rata.
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Value &amp; payments</div>
            <div className="text-xl font-bold text-green-700">We win clearly</div>
            <div className="text-xs text-muted-foreground mt-1">
              12-month instalments plus recovery and hire car included as standard.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Term ladder — the biggest gap</CardTitle>
          <CardDescription>Price as a multiple of the same vehicle's 1-year price.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Term</th>
                <th className="text-right py-2 px-3 font-medium">Buyawarranty</th>
                <th className="text-right py-2 px-3 font-medium">Best4Warranty</th>
                <th className="text-right py-2 px-3 font-medium">Gap</th>
              </tr>
            </thead>
            <tbody>
              {termLadder.map(r => {
                const gap = ((r.baw - r.b4w) / r.b4w) * 100;
                return (
                  <tr key={r.term} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{r.term}</td>
                    <td className="py-2 px-3 text-right">{r.baw.toFixed(2)}×</td>
                    <td className="py-2 px-3 text-right">{r.b4w.toFixed(2)}×</td>
                    <td className="py-2 px-3 text-right">
                      <Badge
                        variant="outline"
                        className={`gap-1 text-xs ${gap > 0 ? 'text-red-700 border-red-300' : 'text-green-700 border-green-300'}`}
                      >
                        {gap > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {gap > 0 ? '+' : ''}
                        {gap.toFixed(0)}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Like-for-like 1-year quotes</CardTitle>
          <CardDescription>
            £70/hr labour, no excess, mid claim limit. They price risk far more granularly per model.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Vehicle</th>
                <th className="text-right py-2 px-3 font-medium">Ours</th>
                <th className="text-right py-2 px-3 font-medium">Theirs</th>
                <th className="text-right py-2 px-3 font-medium">Difference</th>
              </tr>
            </thead>
            <tbody>
              {vehicleRows.map(r => {
                const diff = r.baw - r.b4w;
                const pct = (diff / r.b4w) * 100;
                return (
                  <tr key={r.vehicle} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{r.vehicle}</td>
                    <td className="py-2 px-3 text-right">{money(r.baw)}</td>
                    <td className="py-2 px-3 text-right">{money(r.b4w)}</td>
                    <td className="py-2 px-3 text-right">
                      <Badge
                        variant="outline"
                        className={`gap-1 text-xs ${diff > 0 ? 'text-red-700 border-red-300' : 'text-green-700 border-green-300'}`}
                      >
                        {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {diff > 0 ? '+' : '-'}
                        {money(Math.abs(diff))} ({pct > 0 ? '+' : ''}
                        {pct.toFixed(0)}%)
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What's in the box</CardTitle>
          <CardDescription>Where our proposition is stronger than the headline price suggests.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Feature</th>
                <th className="text-left py-2 px-3 font-medium">Buyawarranty</th>
                <th className="text-left py-2 px-3 font-medium">Best4Warranty</th>
              </tr>
            </thead>
            <tbody>
              {featureRows.map(r => (
                <tr key={r.feature} className="border-b hover:bg-muted/50">
                  <td className="py-2 px-3 font-medium">{r.feature}</td>
                  <td className="py-2 px-3">
                    <Cell v={r.baw} />
                  </td>
                  <td className="py-2 px-3">
                    <Cell v={r.b4w} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" /> Recommendations for testing
          </CardTitle>
          <CardDescription>Model these as a draft version — nothing goes live until published.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>
              <strong>Fix the term ladder.</strong> Target 2 years ≈ 1.7× and 3 years ≈ 2.4× the 1-year
              price so multi-year cover reads as a saving, not a penalty.
            </li>
            <li>
              <strong>Sharpen low-risk vehicles.</strong> Qashqai / Focus / Golf class cars need to sit
              under their entry tier to win price-shoppers.
            </li>
            <li>
              <strong>Hold firm on premium marques.</strong> We already undercut them on BMW, Mercedes,
              Audi and Range Rover — keep those surcharges.
            </li>
            <li>
              <strong>Price the £5,000 claim limit</strong> as a +12–15% upgrade instead of a manager
              exception, protecting margin and removing authorisation friction.
            </li>
            <li>
              <strong>Lead with 12-month instalments</strong> and included recovery / hire car in every
              quote conversation — that's our clearest advantage.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
