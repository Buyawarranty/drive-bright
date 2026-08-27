import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Lock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import type { SandboxRow } from './types';
import type { RenewalQuote } from './renewalPricing';
import { buildRenewalQuotePrefill, missingPrefillFields } from './renewalQuoteContext';

/**
 * RENEWALS SANDBOX — context-aware Quote action (Stage 6, Step 17)
 * Shows exactly what the existing Quote workflow would open pre-filled with for
 * a RENEWAL. Sandbox: nothing is opened, created or saved.
 */

interface Props {
  row: SandboxRow;
  quote: RenewalQuote | null;
  live: boolean;
}

const money = (n: number | null | undefined) =>
  typeof n === 'number' ? `£${n.toLocaleString('en-GB')}` : '—';

export const RenewalQuoteHandoffPanel: React.FC<Props> = ({ row, quote, live }) => {
  const [open, setOpen] = useState(false);
  const prefill = useMemo(() => buildRenewalQuotePrefill(row, quote), [row, quote]);
  const gaps = useMemo(() => missingPrefillFields(prefill), [prefill]);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4" /> Quote (renewal context)
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide prefill' : 'Show prefill'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The normal Quote button is reused. Because this is a renewal, it opens with the customer, vehicle,
        existing cover and approved negotiation range already filled in.
      </p>

      {open && (
        <div className="grid grid-cols-2 gap-y-1 text-xs">
          <span className="text-muted-foreground">Type</span>
          <span><Badge variant="secondary">RENEWAL</Badge></span>
          <span className="text-muted-foreground">Customer</span><span>{prefill.customerName || '—'}</span>
          <span className="text-muted-foreground">Contact</span><span className="break-all">{prefill.phone || prefill.email || '—'}</span>
          <span className="text-muted-foreground">Vehicle</span><span>{prefill.vehicle || '—'}</span>
          <span className="text-muted-foreground">Reg</span><span className="uppercase">{prefill.registration || '—'}</span>
          <span className="text-muted-foreground">Mileage</span><span>{prefill.mileage || '—'}</span>
          <span className="text-muted-foreground">Existing policy</span><span>{prefill.existingPolicyNumber || '—'}</span>
          <span className="text-muted-foreground">Existing cover</span>
          <span>{prefill.existingPlan || '—'} · {money(prefill.existingClaimLimit)} limit · {money(prefill.existingExcess)} excess</span>
          <span className="text-muted-foreground">Expires</span>
          <span>
            {prefill.existingExpiry ? format(new Date(prefill.existingExpiry), 'd MMM yyyy') : '—'}
            {prefill.daysRemaining !== null ? ` (${prefill.daysRemaining}d)` : ''}
          </span>
          <span className="text-muted-foreground">Paid last time</span><span>{money(prefill.previousPrice)}</span>
          <span className="text-muted-foreground">Recommended</span><span className="font-semibold">{money(prefill.recommendedPrice)}</span>
          <span className="text-muted-foreground">Negotiation range</span>
          <span>{money(prefill.negotiationFrom)} – {money(prefill.negotiationTo)}</span>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50/60 p-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Agent would still need to enter: {gaps.join(', ')}.
        </div>
      )}

      <Button size="sm" disabled={!live} className="w-full sm:w-auto">
        {live ? 'Open renewal quote' : (<><Lock className="mr-1 h-3.5 w-3.5" /> Open renewal quote</>)}
      </Button>
    </div>
  );
};

export default RenewalQuoteHandoffPanel;
