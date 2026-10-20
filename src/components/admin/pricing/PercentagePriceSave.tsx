import { useState } from 'react';
import { ArrowDown, ArrowUp, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adjustPriceMatrix } from '@/lib/pricing/percentageAdjustment';
import type { PricingMatrixShape } from '@/lib/pricingMatrix';

export default function PercentagePriceSave({ matrix, busy, onSave }: { matrix: PricingMatrixShape; busy: boolean; onSave: (matrix: PricingMatrixShape) => Promise<boolean> }) {
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  async function save() {
    try {
      const next = adjustPriceMatrix(matrix, Number(amount) * (direction === 'increase' ? 1 : -1));
      setError('');
      if (!window.confirm(`${direction === 'increase' ? 'Increase' : 'Decrease'} every price in this test draft by ${amount}% and save?\n\nPrices are rounded to whole pounds. Live prices stay unchanged until you separately confirm Push live. Existing minimum-price rules and the website discount stay unchanged.`)) return;
      if (await onSave(next)) setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the adjustment.');
    }
  }
  return <section className="border-y border-border py-4 space-y-3">
    <h3 className="font-semibold">Save a percentage price change</h3>
    <p className="text-sm text-muted-foreground">Adjust every price in the selected test draft, across all three terms. Saving keeps live prices unchanged; use the separate Push live action after checking the draft.</p>
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex gap-1" role="group" aria-label="Price change direction">
        <Button variant={direction === 'increase' ? 'secondary' : 'outline'} disabled={busy} aria-pressed={direction === 'increase'} onClick={() => setDirection('increase')}><ArrowUp className="mr-1 h-4 w-4" />Increase</Button>
        <Button variant={direction === 'decrease' ? 'secondary' : 'outline'} disabled={busy} aria-pressed={direction === 'decrease'} onClick={() => setDirection('decrease')}><ArrowDown className="mr-1 h-4 w-4" />Decrease</Button>
      </div>
      <div className="space-y-1"><Label htmlFor="price-change-percentage">Percentage (%)</Label><Input id="price-change-percentage" type="number" min="0" max={direction === 'increase' ? 200 : 99.99} step="0.01" className="w-32" disabled={busy} value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} /></div>
      <Button disabled={busy || !amount || Number(amount) <= 0} onClick={save}><Save className="mr-1 h-4 w-4" />{busy ? 'Saving…' : 'Save percentage change (test only)'}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}