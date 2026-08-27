import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, ShieldAlert, Lock } from 'lucide-react';
import { useIsManagement } from '@/hooks/useIsManagement';
import type { RenewalQuote } from './renewalPricing';
import { recordRenewalAudit } from './renewalAudit';

/**
 * RENEWALS SANDBOX — negotiation + manager approval (Stage 4, Step 10)
 * Agents may agree anything down to the agent floor. Below that a manager
 * approval is required, and nothing may ever go below the absolute minimum.
 * In sandbox the approval request is simulated locally — no writes.
 */

type Verdict = 'ok' | 'needs_approval' | 'below_minimum' | 'empty';

export const RenewalNegotiationPanel: React.FC<{ quote: RenewalQuote; live: boolean }> = ({ quote, live }) => {
  const { isManagement } = useIsManagement();
  const [value, setValue] = useState('');
  const [requested, setRequested] = useState(false);

  const price = Number(value);
  const verdict: Verdict = useMemo(() => {
    if (!value.trim() || !Number.isFinite(price) || price <= 0) return 'empty';
    if (price < quote.netFloor) return 'below_minimum';
    if (price < quote.agentFloorPrice) return 'needs_approval';
    return 'ok';
  }, [value, price, quote.agentFloorPrice, quote.netFloor]);

  const discountPct = useMemo(() => {
    if (verdict === 'empty' || !quote.standardPrice) return null;
    return Math.round(((quote.standardPrice - price) / quote.standardPrice) * 100);
  }, [verdict, price, quote.standardPrice]);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Agree a renewal price</span>
        {discountPct !== null && (
          <Badge variant="secondary">{discountPct}% off like-for-like</Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">£</span>
        <Input
          inputMode="numeric"
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/[^0-9.]/g, '')); setRequested(false); }}
          placeholder={String(quote.loyaltyPrice)}
          className="h-9 w-32"
        />
        <Button size="sm" variant="outline" onClick={() => setValue(String(quote.loyaltyPrice))}>
          Loyalty
        </Button>
        <Button size="sm" variant="outline" onClick={() => setValue(String(quote.agentFloorPrice))}>
          Agent floor
        </Button>
      </div>

      {verdict === 'ok' && (
        <p className="flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Within your authority — no approval needed.
        </p>
      )}

      {verdict === 'needs_approval' && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50/60 p-2 text-xs text-amber-900">
          <p className="flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5" />
            Below the agent floor of £{quote.agentFloorPrice.toLocaleString('en-GB')} — a manager must approve this price.
          </p>
          {isManagement ? (
            <p className="font-medium">You are management, so you can approve this yourself once the engine is live.</p>
          ) : requested ? (
            <p className="font-medium">Approval request simulated — nothing was sent from the sandbox.</p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRequested(true);
                recordRenewalAudit({
                  action: 'discount_requested',
                  policyId: null,
                  policyNumber: null,
                  customerName: null,
                  detail: `Requested approval below the agent floor of £${quote.agentFloorPrice}`,
                  amount: price,
                });
              }}
            >
              Request manager approval
            </Button>
          )}
        </div>
      )}

      {verdict === 'below_minimum' && (
        <p className="flex items-center gap-1 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          Blocked: below the absolute minimum of £{quote.netFloor.toLocaleString('en-GB')}. Not sellable by anyone.
        </p>
      )}

      {!live && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Sandbox — agreed prices are not saved and no approval is sent.
        </p>
      )}
    </div>
  );
};

export default RenewalNegotiationPanel;
