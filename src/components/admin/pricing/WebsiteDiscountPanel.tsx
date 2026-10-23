import { useEffect, useState } from 'react';
import { Percent, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { discountedWebsiteTotal, readWebsiteDiscountDraft, saveWebsiteDiscountDraft, normalizeWebsiteDiscount, WEBSITE_DISCOUNT_CHANGED_EVENT } from '@/lib/pricing/websiteDiscount';

export default function WebsiteDiscountPanel({ onSave, busy, plans, selectedPlanId, planName, onSelectPlan, canSave }: {
  onSave: (pct: number) => Promise<void>;
  busy: boolean;
  plans: { id: string; label: string }[];
  selectedPlanId: string;
  planName: string;
  onSelectPlan: (id: string) => void;
  canSave: boolean;
}) {
  const [pct, setPct] = useState(readWebsiteDiscountDraft);
  useEffect(() => {
    const sync = () => setPct(readWebsiteDiscountDraft());
    window.addEventListener(WEBSITE_DISCOUNT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(WEBSITE_DISCOUNT_CHANGED_EVENT, sync);
  }, []);
  return (
    <section id="website-discount" className="website-discount-theme rounded-lg border-2 border-primary bg-primary/10 p-5 scroll-mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-primary"><Percent className="h-5 w-5" /> Website direct-sales discount</h2>
        <Badge className="bg-primary text-primary-foreground">{pct}% cheaper · draft</Badge>
      </div>
      <p className="mt-2 text-sm text-foreground">One discount for 1-, 2- and 3-year cover on Steps 3 and 4, compared with the same cover in Quotes &amp; Orders. No extra multi-year discount.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-80 min-w-0 space-y-2">
          <Label htmlFor="website-discount-plan">Pricing plan to update</Label>
          <Select value={selectedPlanId} onValueChange={onSelectPlan} disabled={busy}>
            <SelectTrigger id="website-discount-plan" className="bg-background"><SelectValue placeholder="Choose a test plan" /></SelectTrigger>
            <SelectContent>
              {selectedPlanId === 'new-plan' && <SelectItem value="new-plan">{planName} (not saved yet)</SelectItem>}
              {plans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="website-discount-pct">Website price reduction (%)</Label>
          <Input id="website-discount-pct" className="w-32 bg-background text-lg font-semibold" type="number" min={0} max={50} step={0.5} value={pct} onChange={e => {
            const next = normalizeWebsiteDiscount(e.target.value);
            setPct(next);
            saveWebsiteDiscountDraft(next);
          }} />
        </div>
        <Button disabled={busy || !canSave} onClick={() => void onSave(pct)}><Save className="mr-2 h-4 w-4" /> Save discount to selected plan</Button>
      </div>
      <p className="mt-3 text-sm font-semibold break-words">{canSave ? <>Discount applies to: “{planName}” · test only</> : 'Choose a test plan before saving a discount.'}</p>
      <p className="mt-3 text-sm text-foreground">£1,000 in Quotes &amp; Orders → £{discountedWebsiteTotal(1000, pct, 0).toLocaleString('en-GB')} on the website before minimum prices and payment rounding.</p>
      <p className="mt-2 text-xs text-muted-foreground">Quotes &amp; Orders prices, minimum prices and the separate pay-in-full saving stay unchanged. Saving updates only the selected test plan’s discount; live prices change only when you choose Push live.</p>
    </section>
  );
}