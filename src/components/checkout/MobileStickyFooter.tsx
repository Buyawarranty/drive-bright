import React, { useEffect, useState } from 'react';
import { Lock, Shield, ArrowRight, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileStickyFooterProps {
  selectedPayment: 'monthly' | 'full' | null;
  monthlyPrice: number;
  totalPrice?: number;
  fullPrice: number;
  originalPrice?: number;
  paymentType?: '12months' | '24months' | '36months';
  isLoading: boolean;
  isFormValid: boolean;
  onPayClick: () => void;
  onPaymentChange?: (payment: 'monthly' | 'full') => void;
  minimised?: boolean;
  trustStripOnly?: boolean;
}

const MobileStickyFooter: React.FC<MobileStickyFooterProps> = ({
  selectedPayment,
  monthlyPrice,
  fullPrice,
  paymentType = '12months',
  isLoading,
  onPayClick,
  onPaymentChange,
  minimised = false,
  trustStripOnly = false,
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const [prevPrice, setPrevPrice] = useState(monthlyPrice);

  useEffect(() => {
    if (monthlyPrice !== prevPrice) {
      setIsPulsing(true);
      setPrevPrice(monthlyPrice);
      const t = setTimeout(() => setIsPulsing(false), 600);
      return () => clearTimeout(t);
    }
  }, [monthlyPrice, prevPrice]);

  if (minimised && !trustStripOnly) return null;

  if (trustStripOnly) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] lg:hidden">
        <div className="px-4 py-2.5 pb-[env(safe-area-inset-bottom,8px)]">
          <div className="flex items-center justify-center gap-3 text-[11px] text-gray-600">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-[#0BA360]" />Instant cover</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-[#0BA360]" />Secure</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-[#0BA360]" />14-day refund</span>
          </div>
        </div>
      </div>
    );
  }

  const baseTotal = monthlyPrice * 12;
  const pencePerDay = baseTotal > 0 ? Math.round((baseTotal * 100) / 365) : 0;
  const dayLabel = pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}` : `${pencePerDay}p`;
  const computedSavings = Math.max(0, baseTotal - fullPrice);
  const displaySavings = computedSavings > 0 ? computedSavings : Math.round(baseTotal * 0.1);
  const discountedFull = computedSavings > 0 ? fullPrice : fullPrice - displaySavings;

  const yearWord = paymentType === '12months' ? '1-Year' : paymentType === '24months' ? '2-Year' : '3-Year';
  const planLabel = `${yearWord} Platinum Cover`;

  const selected: 'monthly' | 'full' = selectedPayment ?? 'monthly';

  const Card = ({
    type,
    title,
    children,
  }: {
    type: 'monthly' | 'full';
    title: string;
    children: React.ReactNode;
  }) => {
    const isSelected = selected === type;
    return (
      <button
        type="button"
        onClick={() => onPaymentChange?.(type)}
        className={cn(
          'relative text-left rounded-2xl border-2 transition-all flex-1 px-3 py-2.5',
          isSelected
            ? 'bg-[#FFE9D6] border-[#FF6B00]'
            : 'bg-[#D9DEE3] border-transparent'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold text-gray-900">{title}</span>
          <span
            className={cn(
              'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
              isSelected ? 'border-[#FF6B00]' : 'border-gray-400 bg-white'
            )}
          >
            {isSelected && <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />}
          </span>
        </div>
        {children}
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] lg:hidden">
      <div className="px-4 pt-3 pb-[env(safe-area-inset-bottom,8px)]">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold text-gray-500 tracking-wider uppercase">Your cover</span>
            <span className="text-sm font-bold text-gray-900 mt-0.5">{planLabel}</span>
          </div>
          <a
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:opacity-80 flex-shrink-0"
          >
            <span className="text-xs font-bold text-gray-900">Excellent</span>
            <div className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map(i => (
                <span key={i} className="inline-flex w-3.5 h-3.5 bg-[#00B67A] items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
              ))}
            </div>
            <span className="text-[10px] text-gray-500 ml-1">Trustpilot</span>
          </a>
        </div>

        {/* Two payment cards */}
        <div className={cn('flex gap-2 mb-2.5', isPulsing && 'animate-pulse')}>
          <Card type="monthly" title="Pay Monthly">
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-gray-900">£{monthlyPrice}</span>
              <span className="text-xs text-gray-700">/ month</span>
            </div>
            <p className="text-[12px] font-semibold text-gray-900 mt-0.5">Paid over 12 months</p>
            <p className="text-[10px] text-gray-600">Equal to {dayLabel}/day</p>
          </Card>

          <Card type="full" title="Pay in Full">
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-[#0BA360]">£{discountedFull}</span>
            </div>
            <p className="text-[12px] font-semibold text-gray-900 mt-0.5">One simple payment</p>
            {displaySavings > 0 && (
              <p className="text-[10px] text-[#0BA360] font-bold flex items-center gap-1 mt-0.5">
                <Tag className="w-3 h-3" />
                Save £{displaySavings}
              </p>
            )}
          </Card>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onPayClick}
          disabled={isLoading || !selectedPayment}
          aria-label={selectedPayment ? 'Continue to checkout' : 'Select payment option'}
          className="w-full bg-[#FF6B00] hover:bg-[#e55f00] disabled:bg-[#CCCCCC] text-white font-bold py-5 rounded-xl text-base gap-2 shadow-lg animate-breathing"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Continue to checkout
              <ArrowRight className="w-5 h-5" strokeWidth={3} />
            </span>
          )}
        </Button>

        <p className="text-center text-[11px] text-gray-700 mt-1.5">
          *14-day cooling-off period <span className="text-gray-400">|</span> For your peace of mind
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-0.5 text-[10px] text-gray-500">
          <Lock className="w-3 h-3" />
          <span>Secure checkout</span>
        </div>
      </div>
    </div>
  );
};

export default MobileStickyFooter;
