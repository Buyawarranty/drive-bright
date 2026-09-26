import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Lock, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { SandboxRow } from './types';
import type { RenewalQuote } from './renewalPricing';
import { useIsManagement } from '@/hooks/useIsManagement';
import { estimateCommission, SALE_KIND_LABEL } from './renewalCommission';
import { recordRenewalAudit } from './renewalAudit';

/**
 * RENEWALS SANDBOX — Renew Now completion checks (Stage 6, Step 18)
 * Runs every pre-completion validation and shows what WOULD be recorded on a
 * successful renewal. Sandbox: nothing is written, no policy is created and the
 * historic renewal opportunity is never deleted.
 */

interface Props {
  row: SandboxRow;
  quote: RenewalQuote | null;
  live: boolean;
}

const money = (n: number | null | undefined) =>
  typeof n === 'number' ? `£${n.toLocaleString('en-GB')}` : '—';

const PAYMENT_METHODS = ['Card (Stripe)', 'Bumper', 'Klarna', 'iVendi', 'Zopa', 'Payl8r', 'Bank transfer'];

export const RenewalCompletionPanel: React.FC<Props> = ({ row, quote, live }) => {
  const { isManagement } = useIsManagement();
  const [finalPrice, setFinalPrice] = useState<string>(() =>
    quote ? String(quote.loyaltyPrice) : '',
  );
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);

  const c = row.customers || null;
  const price = Number(finalPrice);

  const checks = useMemo(() => {
    const name = [c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.name || row.customer_full_name;
    const list = [
      { label: 'Customer verified (name + contact)', ok: !!name && !!(c?.phone || c?.email || row.email) },
      { label: 'Vehicle verified (reg + make/model)', ok: !!c?.registration_plate && !!c?.vehicle_make },
      { label: 'Cover selected (plan, claim limit, excess)', ok: !!row.plan_type && row.claim_limit != null },
      { label: 'Final price entered', ok: Number.isFinite(price) && price > 0 },
      {
        label: 'Price at or above the absolute minimum',
        ok: !!quote && Number.isFinite(price) && price >= quote.netFloor,
      },
      {
        label: quote && price < quote.agentFloorPrice
          ? 'Discount authority — manager approval required'
          : 'Discount authority — within agent range',
        ok: !!quote && (price >= quote.agentFloorPrice || isManagement),
      },
      { label: 'Payment method chosen', ok: !!method },
      { label: 'Pricing engine has not blocked this vehicle', ok: !!quote && !quote.blocked },
    ];
    return list;
  }, [c, row, price, quote, method, isManagement]);

  const allOk = checks.every((k) => k.ok);

  const auditName =
    [c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.name || row.customer_full_name || null;

  const onRenew = () => {
    if (!allOk) {
      recordRenewalAudit({
        action: 'completion_checked',
        policyId: row.id,
        policyNumber: row.policy_number,
        customerName: auditName,
        detail: `Completion blocked — ${checks.filter((k) => !k.ok).length} check(s) outstanding`,
        amount: Number.isFinite(price) ? price : null,
      });
      toast.error('Renewal cannot complete yet', { description: 'Clear every validation check first.' });
      return;
    }
    recordRenewalAudit({
      action: 'completion_checked',
      policyId: row.id,
      policyNumber: row.policy_number,
      customerName: auditName,
      detail: `All checks passed — would renew via ${method}`,
      amount: price,
    });
    toast.success('Sandbox only — nothing was saved', {
      description: `Would mark this opportunity RENEWED at ${money(price)} and open a new policy.`,
    });
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center gap-2 font-medium">
        <BadgeCheck className="h-4 w-4" /> Renew now
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Final agreed price</Label>
          <Input
            type="number"
            min={0}
            value={finalPrice}
            onChange={(e) => setFinalPrice(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Payment method</Label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <ul className="space-y-1 text-xs">
        {checks.map((k) => (
          <li key={k.label} className="flex items-start gap-2">
            {k.ok
              ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />}
            <span className={k.ok ? 'text-muted-foreground' : 'text-red-700'}>{k.label}</span>
          </li>
        ))}
      </ul>

      {(() => {
        const est = estimateCommission(row, price);
        return (
          <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            On success we would record: status <Badge variant="secondary">RENEWED</Badge>, final price {money(price)},
            closing agent, commission basis ({SALE_KIND_LABEL[est.kind]} at {est.pct}% ={' '}
            {money(est.amount)}{est.incremental !== null ? `, ${money(est.incremental)} vs last year` : ''}),
            and create the new policy. The original opportunity, original selling agent and full activity history
            are kept, and it drops out of the actionable queues.
          </div>
        );
      })()}


      <Button size="sm" onClick={onRenew} disabled={!allOk}>
        {live ? 'Renew now' : (<><Lock className="mr-1 h-3.5 w-3.5" /> Renew now (sandbox)</>)}
      </Button>
    </div>
  );
};

export default RenewalCompletionPanel;
