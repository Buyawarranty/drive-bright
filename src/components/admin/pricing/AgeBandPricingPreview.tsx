import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, PhoneCall } from 'lucide-react';
import { formatGBP } from '@/lib/pricingMatrix';

export type AgeBand = {
  key: string;
  label: string;
  oneYear: number | null;
  treatment: string;
};

/**
 * Proposed age-based pricing model (Aug 2026).
 * Replaces the old mileage split (under/over 120k) as the primary driver.
 * PREVIEW ONLY — nothing here touches Quotes & Orders or live Step 3/4 pricing.
 */
export const PROPOSED_AGE_BANDS: AgeBand[] = [
  { key: '1-3', label: '1–3 years', oneYear: 399, treatment: 'Lowest base tier' },
  { key: '4-5', label: '4–5 years', oneYear: 449, treatment: 'Low-risk age band' },
  { key: '6-7', label: '6–7 years', oneYear: 499, treatment: 'Medium-low age band' },
  { key: '8-9', label: '8–9 years', oneYear: 549, treatment: 'Medium age band' },
  { key: '10-11', label: '10–11 years', oneYear: 649, treatment: 'Higher-age band' },
  { key: '12', label: '12 years', oneYear: 699, treatment: 'High age band' },
  { key: '13', label: '13 years', oneYear: 799, treatment: 'Provisional; tighter term rules' },
  { key: '14', label: '14 years', oneYear: 849, treatment: 'Provisional; tighter term rules' },
  { key: '15', label: '15 years', oneYear: 899, treatment: 'Provisional; tighter term rules' },
  { key: '15+', label: 'Over 15 years', oneYear: null, treatment: 'Decline or manual referral' },
];

export type MileageBand = {
  key: string;
  label: string;
  min: number;
  max: number | null;
  factor: number | null;
  customerLabel: string;
};

/** Mileage factors (Aug 2026 proposal) — applied on top of the age band base price. */
export const PROPOSED_MILEAGE_BANDS: MileageBand[] = [
  { key: '0-40k', label: '0–40,000', min: 0, max: 40000, factor: 1.0, customerLabel: 'Lower mileage' },
  { key: '40-60k', label: '40,001–60,000', min: 40001, max: 60000, factor: 1.0, customerLabel: 'Lower mileage' },
  { key: '60-80k', label: '60,001–80,000', min: 60001, max: 80000, factor: 1.05, customerLabel: 'Typical mileage' },
  { key: '80-100k', label: '80,001–100,000', min: 80001, max: 100000, factor: 1.1, customerLabel: 'Higher mileage' },
  { key: '100-120k', label: '100,001–120,000', min: 100001, max: 120000, factor: 1.15, customerLabel: 'Higher mileage' },
  { key: '120-150k', label: '120,001–150,000', min: 120001, max: 150000, factor: 1.25, customerLabel: 'High mileage' },
  { key: '150k+', label: 'Over 150,000', min: 150001, max: null, factor: null, customerLabel: 'Decline or manual referral' },
];

export const MANUAL_REFERRAL_MESSAGE =
  'We can still help with this vehicle, but it needs a quick manual review. Please call our sales line on 0330 229 5040 or request a callback and one of the team will come straight back to you.';

export const OVER_15_REFERRAL_MESSAGE =
  'We can still help with this vehicle, but it needs a quick manual review. Please call our sales line on 0330 229 5040 or request a callback and one of the team will come straight back to you.';

export default function AgeBandPricingPreview() {
  const [bands, setBands] = useState<AgeBand[]>(PROPOSED_AGE_BANDS);
  const [twoYearMult, setTwoYearMult] = useState(2.2);
  const [threeYearMult, setThreeYearMult] = useState(3.1);
  const [websiteDiscountPct, setWebsiteDiscountPct] = useState(10);
  const [mileageBands, setMileageBands] = useState<MileageBand[]>(PROPOSED_MILEAGE_BANDS);

  function setMileageFactor(key: string, value: string) {
    const n = Math.max(0, Number(value) || 0);
    setMileageBands(prev => prev.map(b => (b.key === key ? { ...b, factor: n } : b)));
  }

  function setOneYear(key: string, value: string) {
    const n = Math.max(0, Math.round(Number(value.replace(/[^0-9]/g, '')) || 0));
    setBands(prev => prev.map(b => (b.key === key ? { ...b, oneYear: n } : b)));
  }

  const rows = useMemo(
    () =>
      bands.map(b => {
        if (b.oneYear === null) return { ...b, twoYear: null, threeYear: null, web1: null };
        const web = (v: number) => Math.round(v * (1 - websiteDiscountPct / 100));
        const twoYear = Math.round(b.oneYear * twoYearMult);
        const threeYear = Math.round(b.oneYear * threeYearMult);
        return {
          ...b,
          twoYear,
          threeYear,
          web1: web(b.oneYear),
          web2: web(twoYear),
          web3: web(threeYear),
        } as any;
      }),
    [bands, twoYearMult, threeYearMult, websiteDiscountPct]
  );

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Proposed age-based pricing</CardTitle>
            <CardDescription>
              New model: an age band sets the base price, then a mileage factor is applied on top.
              This replaces the old under/over 120,000 mile split.
            </CardDescription>
          </div>
          <Badge variant="secondary">Preview only — nothing is live</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This preview sits inside Price updates only. Quotes &amp; Orders and the live customer
            journey (Steps 3 and 4) keep using today's prices until you build a draft from this and
            press Push live.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label>2 year multiplier (of 1 year price)</Label>
            <Input
              type="number"
              step="0.05"
              value={twoYearMult}
              onChange={e => setTwoYearMult(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>3 year multiplier (of 1 year price)</Label>
            <Input
              type="number"
              step="0.05"
              value={threeYearMult}
              onChange={e => setThreeYearMult(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>Website price is this much less (%)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={websiteDiscountPct}
              onChange={e => setWebsiteDiscountPct(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3 font-semibold">Vehicle age at policy start</th>
                <th className="p-3 font-semibold">1 year (Quotes &amp; Orders)</th>
                <th className="p-3 font-semibold">2 years</th>
                <th className="p-3 font-semibold">3 years</th>
                <th className="p-3 font-semibold">Website 1 / 2 / 3 year</th>
                <th className="p-3 font-semibold">Launch treatment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.key} className="border-t">
                  <td className="p-3 font-medium">{r.label}</td>
                  {r.oneYear === null ? (
                    <td className="p-3 text-muted-foreground" colSpan={4}>
                      No automatic quote — manual referral
                    </td>
                  ) : (
                    <>
                      <td className="p-2">
                        <Input
                          className="h-9 w-24"
                          value={r.oneYear}
                          onChange={e => setOneYear(r.key, e.target.value)}
                        />
                      </td>
                      <td className="p-3">{formatGBP(r.twoYear)}</td>
                      <td className="p-3">{formatGBP(r.threeYear)}</td>
                      <td className="p-3 text-muted-foreground">
                        {formatGBP(r.web1)} / {formatGBP(r.web2)} / {formatGBP(r.web3)}
                      </td>
                    </>
                  )}
                  <td className="p-3 text-muted-foreground">{r.treatment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Mileage factors</p>
          <p className="text-xs text-muted-foreground">
            Applied on top of the age band price: age base price × mileage factor, rounded to the
            nearest whole pound.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Exact mileage</th>
                  <th className="p-3 font-semibold">Factor</th>
                  <th className="p-3 font-semibold">Customer-facing label</th>
                </tr>
              </thead>
              <tbody>
                {mileageBands.map(m => (
                  <tr key={m.key} className="border-t">
                    <td className="p-3 font-medium">{m.label}</td>
                    <td className="p-2">
                      {m.factor === null ? (
                        <span className="text-muted-foreground">No automatic quote</span>
                      ) : (
                        <Input
                          className="h-9 w-24"
                          type="number"
                          step="0.05"
                          value={m.factor}
                          onChange={e => setMileageFactor(m.key, e.target.value)}
                        />
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{m.customerLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Combined 1 year price — age × mileage</p>
          <p className="text-xs text-muted-foreground">
            Quotes &amp; Orders price. The website price is {websiteDiscountPct}% lower, rounded.
            Blank cells need a manual referral.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="p-2 text-left font-semibold">Age \ mileage</th>
                  {mileageBands.map(m => (
                    <th key={m.key} className="p-2 text-left font-semibold whitespace-nowrap">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bands.map(b => (
                  <tr key={b.key} className="border-t">
                    <td className="p-2 font-medium whitespace-nowrap">{b.label}</td>
                    {mileageBands.map(m => {
                      const refer = b.oneYear === null || m.factor === null;
                      return (
                        <td
                          key={m.key}
                          className={refer ? 'p-2 text-muted-foreground' : 'p-2 tabular-nums'}
                        >
                          {refer ? 'Refer' : formatGBP(Math.round((b.oneYear as number) * (m.factor as number)))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-4">
          <p className="mb-2 text-sm font-semibold">
            Over 15 years or over 150,000 miles — what the customer would see
          </p>
          <p className="text-sm text-muted-foreground">{MANUAL_REFERRAL_MESSAGE}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled>
              <PhoneCall className="mr-1 h-4 w-4" /> Call 0330 229 5040
            </Button>
            <Button size="sm" disabled>
              Request a callback
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Buttons shown for layout only in this preview.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
