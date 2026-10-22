import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, Clock, FlaskConical, Repeat, Wallet } from 'lucide-react';
import {
  sandboxAllTerms,
  tweaksAreLive,
  type SandboxOptions,
  type SandboxTermPrice,
  type SandboxTerm,
  type SandboxTweaks,
} from '@/lib/pricing/sandboxStep3Pricing';
import {
  computePaymentMethods,
  paymentSettingsAreLive,
  type SandboxPaymentQuote,
  type SandboxPaymentSettings,
} from '@/lib/pricing/sandboxPaymentMethods';
import type { WebsiteQuoteVehicle } from '@/lib/pricing/websiteQuotePrice';

const CLAIM_LIMITS = [1000, 2000, 3000];
const EXCESSES = [0, 50, 100, 150, 250, 500];
const LABOUR_RATES = [50, 70, 100, 150];

const TERM_TITLES: Record<SandboxTerm, string> = {
  '12months': '1-Year Cover',
  '24months': '2-Year Cover',
  '36months': '3-Year Cover',
};

const METHOD_ICONS: Record<string, typeof Clock> = {
  instalments12: Clock,
  bawPayLater: Repeat,
  klarna: Wallet,
  zopa: Wallet,
  payInFull: Check,
};

const UNIT_LABEL: Record<SandboxPaymentQuote['unit'], string> = {
  mo: '/mo',
  yr: '/yr',
  once: '',
  payment: ' each',
};

export interface SandboxSelection {
  paymentType: SandboxTerm;
  planName: string;
  pricingData: {
    totalPrice: number;
    monthlyPrice: number;
    voluntaryExcess: number;
    claimLimit: number;
    labourRate: number;
  };
}

interface SandboxStep3PricingProps {
  vehicle: WebsiteQuoteVehicle;
  options: SandboxOptions;
  onOptionsChange: (options: SandboxOptions) => void;
  onSelect: (selection: SandboxSelection) => void;
  /** Sandbox-only price tweaks — change the preview, never the live prices. */
  tweaks?: SandboxTweaks;
  /** Which ways to pay are shown, and their variables. */
  paymentSettings?: SandboxPaymentSettings;
}

/**
 * NEW STEP 3 DESIGN (sandbox only — never rendered on the live website).
 *
 * Each term tile leads with ONE clear price: the 12-instalment monthly figure,
 * framed as the money-saving choice. Every other enabled way to pay (BAW
 * PayLater, Klarna, Zopa, pay in full) appears as a secondary block so
 * customers see the choices without two equally-sized prices competing.
 *
 * All figures come from the shared pricing engine, so they match the real
 * Step 3 and Step 4 exactly.
 */
export default function SandboxStep3Pricing({
  vehicle,
  options,
  onOptionsChange,
  onSelect,
  tweaks,
  paymentSettings,
}: SandboxStep3PricingProps) {
  const [selectedTerm, setSelectedTerm] = useState<SandboxTerm | null>(null);
  const { claimLimit, voluntaryExcess, labourRate } = options;

  const terms = useMemo(
    () => sandboxAllTerms(vehicle, options, tweaks),
    [vehicle, options, tweaks],
  );
  const tweaked = !tweaksAreLive(tweaks) || !paymentSettingsAreLive(paymentSettings);

  const handleSelect = (t: SandboxTermPrice) => {
    setSelectedTerm(t.term);
    onSelect({
      paymentType: t.term,
      planName: TERM_TITLES[t.term],
      pricingData: {
        totalPrice: t.total,
        monthlyPrice: t.monthly,
        voluntaryExcess,
        claimLimit,
        labourRate,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Cover options — same choices as the real step 3 */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Claim limit</Label>
          <Select
            value={String(claimLimit)}
            onValueChange={v => onOptionsChange({ ...options, claimLimit: Number(v) })}
          >
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLAIM_LIMITS.map(l => (
                <SelectItem key={l} value={String(l)}>£{l.toLocaleString()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Voluntary excess</Label>
          <Select
            value={String(voluntaryExcess)}
            onValueChange={v => onOptionsChange({ ...options, voluntaryExcess: Number(v) })}
          >
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXCESSES.map(e => (
                <SelectItem key={e} value={String(e)}>£{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Labour rate</Label>
          <Select
            value={String(labourRate)}
            onValueChange={v => onOptionsChange({ ...options, labourRate: Number(v) })}
          >
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LABOUR_RATES.map(r => (
                <SelectItem key={r} value={String(r)}>£{r}/hr</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Term tiles — new design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {terms.map(t => {
          const isSelected = selectedTerm === t.term;
          const methods = paymentSettings ? computePaymentMethods(t, paymentSettings) : null;
          const lead = methods?.find(m => m.id === 'instalments12');
          const secondary = methods?.filter(m => m.id !== 'instalments12' && m.id !== 'payInFull') ?? [];
          const payInFull = methods?.find(m => m.id === 'payInFull');
          return (
            <Card
              key={t.term}
              className={`transition-all ${
                isSelected ? 'border-primary ring-2 ring-primary/30' : 'hover:border-muted-foreground/40'
              }`}
            >
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{TERM_TITLES[t.term]}</h3>
                  {isSelected && <Check className="h-5 w-5 text-primary" />}
                </div>

                {/* Lead price: 12 instalments — the money-saving choice */}
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {lead?.label ?? '12 monthly payments'}
                    </span>
                  </div>
                  <p className="text-3xl font-bold mt-1">
                    £{(lead?.amount ?? t.monthly).toLocaleString()}
                    <span className="text-base font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    £{t.total.toLocaleString()} total ·{' '}
                    <span className="font-semibold text-foreground">
                      {lead?.note ?? 'pay over 12 months and save'}
                    </span>
                  </p>
                </div>

                {/* Secondary ways to pay — PayLater, Klarna, Zopa… */}
                {secondary.map(q => {
                  const Icon = METHOD_ICONS[q.id] ?? Wallet;
                  return (
                    <div key={q.id} className="rounded-md border border-dashed p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {q.label}
                        </span>
                        {q.experimental && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                            <FlaskConical className="h-3 w-3" />
                            experiment
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-bold">
                        £{q.amount.toLocaleString()}
                        <span className="text-sm font-normal text-muted-foreground">
                          {UNIT_LABEL[q.unit]}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{q.note}</p>
                    </div>
                  );
                })}

                {/* Pay in full */}
                <p className="text-xs text-muted-foreground">
                  Or pay in full today:{' '}
                  <span className="font-semibold text-foreground">
                    £{(payInFull?.amount ?? t.payInFull).toLocaleString()}
                  </span>
                  {t.payInFullSaving > 0 && <> (save £{t.payInFullSaving.toLocaleString()})</>}
                </p>

                <Button
                  className="w-full"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => handleSelect(t)}
                >
                  {isSelected ? 'Selected — see step 4' : 'Preview in step 4'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Sandbox preview — prices come from the same engine as the live step 3, so step 4 shows
        identical figures. Nothing here reaches customers.
        {tweaked && (
          <span className="block mt-1 font-semibold text-foreground">
            Price tweaks or experimental payment options are on — these are not the live prices.
          </span>
        )}
      </p>
    </div>
  );
}
