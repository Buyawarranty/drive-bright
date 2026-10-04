import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock, Shield, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DesktopStickyBarProps {
  selectedPayment: 'monthly' | 'full';
  monthlyPrice: number;
  totalPrice: number;
  originalPrice?: number;
  fullPrice: number;
  savings: number;
  duration: string;
  paymentType: '12months' | '24months' | '36months';
  isLoading: boolean;
  hasPromoDiscount?: boolean;
  onPayClick: () => void;
  onPaymentChange?: (payment: 'monthly' | 'full') => void;
  ctaLabel?: string;
  isVisible?: boolean;
  minimised?: boolean;
  trustStripOnly?: boolean;
  validationError?: string;
}

const DesktopStickyBar: React.FC<DesktopStickyBarProps> = ({
  selectedPayment,
  monthlyPrice,
  fullPrice,
  savings,
  duration,
  paymentType,
  isLoading,
  onPayClick,
  onPaymentChange,
  ctaLabel = 'Continue to checkout',
  isVisible = true,
  minimised = false,
  trustStripOnly = false,
  validationError,
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

  if (!isVisible) return null;
  if (minimised && !trustStripOnly) return null;

  // Trust strip only mode
  if (trustStripOnly) {
    return (
      <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#0BA360]" />
              Instant cover
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#0BA360]" />
              Secure checkout
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#0BA360]" />
              14-day cooling-off
            </span>
          </div>
        </div>
      </div>
    );
  }

  const pencePerDay = Math.round((monthlyPrice * 12 * 100) / 365);
  const dayLabel = pencePerDay >= 100 ? `£${(pencePerDay / 100).toFixed(2)}` : `${pencePerDay}p`;

  const yearWord = paymentType === '12months' ? '1-Year' : paymentType === '24months' ? '2-Year' : '3-Year';
  const planLabel = duration || `${yearWord} Platinum Cover`;

  const Card = ({
    type,
    title,
    children,
  }: {
    type: 'monthly' | 'full';
    title: string;
    children: React.ReactNode;
  }) => {
    const isSelected = selectedPayment === type;
    const accent = type === 'monthly' ? '#FF6B00' : '#0BA360';
    const selectedBg = type === 'monthly' ? '#FFE9D6' : '#E6F7EF';
    return (
      <button
        type="button"
        onClick={() => onPaymentChange?.(type)}
        className={cn(
          'relative text-left rounded-xl border-2 transition-all flex-1 px-3 py-2',
          isSelected ? '' : 'bg-white border-gray-200'
        )}
        style={isSelected ? { backgroundColor: selectedBg, borderColor: accent } : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold text-gray-900">{title}</span>
          <span
            className={cn(
              'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
              isSelected ? '' : 'border-gray-400 bg-white'
            )}
            style={isSelected ? { borderColor: accent } : undefined}
          >
            {isSelected && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />}
          </span>
        </div>
        {children}
      </button>
    );
  };

  return (
    <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] border-t border-gray-200 z-50">
      <div className="max-w-2xl mx-auto px-4 py-2.5">
        {validationError && (
          <div
            role="alert"
            className="mb-1.5 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
          >
            <span aria-hidden>⚠</span>
            <span>{validationError}</span>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-baseline gap-2 leading-tight">
            <span className="text-[10px] font-bold text-gray-500 tracking-wider uppercase">Your cover</span>
            <span className="text-sm font-bold text-black">{planLabel}</span>
          </div>
          <a
            href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <span className="text-xs font-bold text-gray-900">Excellent</span>
            <div className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map(i => (
                <span key={i} className="inline-flex w-3 h-3 bg-[#00B67A] items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-2 h-2 fill-white">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
              ))}
            </div>
            <span className="text-[10px] text-gray-500 ml-0.5">Trustpilot</span>
          </a>
        </div>

        {/* Two payment cards */}
        <div className={cn('flex gap-2 mb-2', isPulsing && 'animate-pulse')}>
          <Card type="full" title="Pay in Full">
            <div className="mt-0.5">
              <span className="text-xl font-extrabold text-[#0BA360]">£{fullPrice}</span>
            </div>
            <p className="text-xs font-semibold text-gray-900 mt-0.5">Pay in full</p>
            {savings > 0 && (
              <p className="text-[11px] text-gray-700 flex items-center gap-1 mt-0.5">
                <Tag className="w-3 h-3" />
                Save £{savings}
              </p>
            )}
          </Card>

          <Card type="monthly" title="Pay Monthly">
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-extrabold text-gray-900">£{monthlyPrice}</span>
              <span className="text-xs text-gray-700">/ month</span>
            </div>
            <p className="text-xs font-semibold text-gray-900 mt-0.5">Paid over 12 months</p>
            <p className="text-[11px] text-gray-600">Equal to {dayLabel}/day</p>
          </Card>
        </div>

        {/* CTA */}
        <Button
          onClick={onPayClick}
          disabled={isLoading}
          aria-label={ctaLabel}
          className="w-full bg-[#FF6B00] hover:bg-[#e55f00] text-white font-bold py-3 rounded-xl text-sm gap-2 animate-breathing"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <>{ctaLabel} <ArrowRight className="w-4 h-4" strokeWidth={3} /></>
          )}
        </Button>

        {/* Reassurance */}
        <p className="text-center text-[11px] text-gray-600 mt-1.5">
          *14-day cooling-off <span className="text-gray-400">|</span> For your peace of mind <span className="text-gray-400">|</span> <Lock className="w-3 h-3 inline -mt-0.5" /> Secure checkout
        </p>
      </div>
    </div>
  );
};

export default DesktopStickyBar;
