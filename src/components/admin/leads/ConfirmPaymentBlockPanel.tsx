import React from 'react';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck } from 'lucide-react';
import { useConfirmPaymentPriceBlock } from '@/hooks/useConfirmPaymentPriceBlock';
import { useToast } from '@/hooks/use-toast';

/**
 * Master switch for the price block on Confirm external payment in
 * Quotes & Orders. Off by default — nobody is stopped from confirming a
 * payment unless management deliberately turns the block on here.
 */
export const ConfirmPaymentBlockPanel: React.FC = () => {
  const { enabled, loading, setEnabled } = useConfirmPaymentPriceBlock();
  const { toast } = useToast();

  const onToggle = async (next: boolean) => {
    const ok = await setEnabled(next);
    if (!ok) {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    toast({
      title: next ? 'Confirm payment block on' : 'Confirm payment block off',
      description: next
        ? 'Agents now need management or evidence to confirm below the minimum price.'
        : 'Every agent can confirm external payments at any price.',
    });
  };

  return (
    <section id="confirm-payment-block" className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Confirm payment price block</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Controls Quotes &amp; Orders → Confirm external payment. When off (default), any agent can
              confirm a payment at any amount. When on, amounts past the 30% discount ceiling or under the
              minimum sellable price need management authorisation or a price-match proof.
            </p>
          </div>
        </div>
        <Switch checked={enabled} disabled={loading} onCheckedChange={onToggle} />
      </div>
    </section>
  );
};

export default ConfirmPaymentBlockPanel;
