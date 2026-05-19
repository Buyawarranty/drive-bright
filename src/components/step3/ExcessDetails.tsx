import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Star, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ExcessDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedExcess: number | null;
  onConfirm: (excess: number) => void;
}

interface ExcessOption {
  value: number;
  label: string;
  title: string;
  description: string;
  badge?: { text: string; tone: 'popular' | 'saving' };
}

const OPTIONS: ExcessOption[] = [
  { value: 0, label: '£0', title: 'No excess', description: 'Nothing to pay at claim — highest premium' },
  { value: 50, label: '£50', title: 'Low excess', description: 'Small contribution, modest saving' },
  { value: 100, label: '£100', title: 'Balanced', description: 'Moderate excess with steady savings' },
  { value: 150, label: '£150', title: 'Best balance', description: 'Best balance of price vs claim cost', badge: { text: 'Recommended', tone: 'popular' } },
];

const ExcessDetails: React.FC<ExcessDetailsProps> = ({
  open,
  onOpenChange,
  selectedExcess,
  onConfirm,
}) => {
  const [tempSelected, setTempSelected] = useState<number>(selectedExcess ?? 100);

  useEffect(() => {
    if (open) setTempSelected(selectedExcess ?? 100);
  }, [open, selectedExcess]);

  const handleConfirm = () => {
    onConfirm(tempSelected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100%-1rem)] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-8 rounded-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 mb-2">
          <Star className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <DialogTitle className="text-2xl font-bold text-foreground">
              Understanding your excess
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              The fixed amount you pay towards each repair. We cover everything above it, up to your claim limit.
            </DialogDescription>
          </div>
        </div>

        {/* Highlight callout */}
        <div className="bg-orange-50 border-l-4 border-orange-400 rounded-r-lg px-4 py-3 my-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            <span className="font-bold">A higher excess lowers your monthly premium.</span>{' '}
            Most customers choose £100 — it's low enough not to sting on a real claim, but saves meaningfully on the annual price.
          </p>
        </div>

        {/* Choose your excess */}
        <h3 className="font-semibold text-foreground mb-3">Choose your excess:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {OPTIONS.map((opt) => {
            const isSelected = tempSelected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTempSelected(opt.value)}
                className={cn(
                  'relative rounded-xl border-2 p-4 text-left transition-all',
                  isSelected
                    ? 'border-orange-500 bg-orange-50/50'
                    : 'border-border bg-card hover:border-orange-300'
                )}
              >
                {opt.badge && (
                  <span
                    className={cn(
                      'absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap',
                      opt.badge.tone === 'popular'
                        ? 'bg-orange-500 text-white'
                        : 'bg-green-100 text-green-700 border border-green-300'
                    )}
                  >
                    {opt.badge.text}
                  </span>
                )}
                <div className="flex items-start justify-between mb-1">
                  <span className="text-2xl font-bold text-foreground">{opt.label}</span>
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                      isSelected ? 'border-orange-500' : 'border-gray-300'
                    )}
                  >
                    {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{opt.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{opt.description}</p>
              </button>
            );
          })}
        </div>

        {/* Saving callout */}
        {tempSelected === 100 && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-foreground">
              Saves approx. £40–£60/yr vs £0 excess — the sweet spot chosen by most customers
            </p>
          </div>
        )}

        {/* Real claim examples */}
        <h3 className="font-semibold text-foreground mb-3">What you'd pay on a real claim:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {[
            { title: 'Clutch replacement', bill: 900 },
            { title: 'Gearbox repair', bill: 2200 },
          ].map((ex) => {
            const excess = tempSelected;
            const wePay = ex.bill - excess;
            return (
              <div key={ex.title} className="bg-muted/40 rounded-lg p-4">
                <p className="text-sm font-semibold text-foreground mb-2">
                  {ex.title} — £{ex.bill.toLocaleString()} bill
                </p>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground">Repair cost</span>
                  <span className="font-medium text-foreground">£{ex.bill.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground">Your excess</span>
                  <span className="font-medium text-orange-600">£{excess}</span>
                </div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground">We pay</span>
                  <span className="font-bold text-green-600">£{wePay.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
          {[
            { title: 'Once per claim', sub: 'Not per repair visit' },
            { title: 'Paid at the garage', sub: 'Simple, no admin' },
            { title: 'Fixed amount', sub: 'Never a surprise' },
          ].map((p) => (
            <div key={p.title} className="border border-border rounded-lg px-3 py-2.5 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-lg border-2 border-border bg-card hover:bg-muted transition-colors font-semibold text-foreground"
        >
          Confirm £{tempSelected} excess
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default ExcessDetails;
