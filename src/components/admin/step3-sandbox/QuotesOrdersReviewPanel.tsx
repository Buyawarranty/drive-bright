import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  sandboxAllTerms,
  quotesOrdersTotal,
  type SandboxOptions,
  type SandboxTweaks,
} from '@/lib/pricing/sandboxStep3Pricing';
import type { WebsiteQuoteVehicle } from '@/lib/pricing/websiteQuotePrice';

interface QuotesOrdersReviewPanelProps {
  vehicle: WebsiteQuoteVehicle;
  options: SandboxOptions;
  /** The live web gap in percent (10 today). */
  gapPct: number;
}

/**
 * Side-by-side check: what the SAME cover costs on the website versus in
 * Quotes & Orders (always the website price + the gap). Lets you review both
 * surfaces at once before anything is pushed live.
 */
export default function QuotesOrdersReviewPanel({ vehicle, options, gapPct }: QuotesOrdersReviewPanelProps) {
  const rows = useMemo(() => {
    return sandboxAllTerms(vehicle, options).map(t => ({
      term: t.term,
      years: t.years,
      webTotal: t.total,
      qoTotal: quotesOrdersTotal(t.total, gapPct),
    }));
  }, [vehicle, options, gapPct]);

  const TERM_LABELS: Record<string, string> = {
    '12months': '1-Year Cover',
    '24months': '2-Year Cover',
    '36months': '3-Year Cover',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quotes & Orders review</CardTitle>
        <CardDescription>
          The same cover priced for Quotes & Orders — always {gapPct}% above the website price.
          Check both surfaces here before pushing anything live.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Cover</th>
                <th className="py-2 pr-4 font-semibold">Website (step 3/4)</th>
                <th className="py-2 pr-4 font-semibold">Quotes & Orders</th>
                <th className="py-2 font-semibold">Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.term} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{TERM_LABELS[r.term]}</td>
                  <td className="py-2 pr-4">£{r.webTotal.toLocaleString()}</td>
                  <td className="py-2 pr-4 font-semibold">£{r.qoTotal.toLocaleString()}</td>
                  <td className="py-2 text-muted-foreground">+{gapPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
