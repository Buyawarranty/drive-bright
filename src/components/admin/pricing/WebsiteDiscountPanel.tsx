import { useEffect, useState } from 'react';
import { Percent, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { discountedWebsiteTotal, readWebsiteDiscountDraft, saveWebsiteDiscountDraft, normalizeWebsiteDiscount, WEBSITE_DISCOUNT_CHANGED_EVENT } from '@/lib/pricing/websiteDiscount';

export default function WebsiteDiscountPanel({ onSave, busy }: { onSave: (pct: number) => Promise<void>; busy: boolean }) {
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
        <div className="space-y-2">
          <Label htmlFor="website-discount-pct">Website price reduction (%)</Label>
          <Input id="website-discount-pct" className="w-32 bg-background text-lg font-semibold" type="number" min={0} max={50} step={0.5} value={pct} onChange={e => {
            const next = normalizeWebsiteDiscount(e.target.value);
            setPct(next);
            saveWebsiteDiscountDraft(next);
          }} />
        </div>
        <Button disabled={busy} onClick={() => void onSave(pct)}><Save className="mr-2 h-4 w-4" /> Save discount as test draft</Button>
      </div>
      <p className="mt-3 text-sm text-foreground">£1,000 in Quotes &amp; Orders → £{discountedWebsiteTotal(1000, pct, 0).toLocaleString('en-GB')} on the website before minimum prices and payment rounding.</p>
      <p className="mt-2 text-xs text-muted-foreground">Quotes &amp; Orders prices, minimum prices and the separate pay-in-full saving stay unchanged. Saving creates a test draft; live prices change only when you choose Push live.</p>
    </section>
  );
}