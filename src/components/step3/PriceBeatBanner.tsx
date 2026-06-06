import React, { useState } from 'react';
import { Tag, ArrowRight, Loader2, Check, Zap, X, Lock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/utils/analytics';

interface PriceBeatBannerProps {
  currentMonthlyPrice?: number;
  currentExcess?: number | null;
  currentClaimLimit?: number | null;
  currentLabourRate?: number;
  className?: string;
}

const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s\-]/g, '');
  return /^(07\d{9}|(\+44|0044)7\d{9}|0[1-9]\d{8,9})$/.test(cleaned);
};

const PriceBeatBanner: React.FC<PriceBeatBannerProps> = ({
  currentMonthlyPrice,
  currentExcess,
  currentClaimLimit,
  currentLabourRate,
  className,
}) => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [priceMode, setPriceMode] = useState<'monthly' | 'total'>('monthly');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const open = () => {
    setExpanded(true);
    trackEvent('price_beat_banner_opened');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !validatePhone(phone)) {
      setPhoneError('Please enter a valid UK mobile (e.g., 07123 456789)');
      return;
    }
    setPhoneError('');
    setSubmitting(true);
    try {
      const vehicleData = JSON.parse(localStorage.getItem('vehicleData') || '{}');
      const quoteRef = localStorage.getItem('quoteReference') || `QR-${Date.now()}`;

      const { error } = await supabase.from('abandoned_carts').insert({
        email: `callback-${Date.now()}@price-match.temp`,
        phone: phone.trim(),
        step_abandoned: 3,
        contact_status: 'new',
        contact_notes: `PRICE MATCH REQUEST. ${competitorPrice ? `Price to beat: £${competitorPrice} (${priceMode}).` : ''} Source: Price Beat Banner.`,
        full_name: 'Price Match Request',
        vehicle_reg: vehicleData?.registration || null,
        vehicle_make: vehicleData?.make || null,
        vehicle_model: vehicleData?.model || null,
        vehicle_year: vehicleData?.year || null,
        cart_metadata: {
          competitorPrice: competitorPrice || null,
          competitorPriceMode: priceMode,
          currentExcess, currentClaimLimit, currentLabourRate, currentMonthlyPrice,
          quoteReference: quoteRef,
          source: 'price_beat_banner',
          priority: 'high',
          request_type: 'urgent_callback',
          leadType: 'price_match',
          timestamp: new Date().toISOString(),
        }
      });
      if (error) throw error;
      trackEvent('price_beat_callback_submitted', { competitorPrice });
      setSuccess(true);
    } catch (err) {
      console.error('Price beat submit error:', err);
      toast({
        title: 'Something went wrong',
        description: 'Please try again or call 0330 229 5040',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-[#f5e4b0] bg-[#fffbf0] overflow-hidden',
        className
      )}
    >
      {/* Banner row */}
      <div className="flex items-center gap-2.5 sm:gap-4 px-3 sm:px-5 py-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#FEF0EA] flex items-center justify-center flex-shrink-0">
          <Tag className="w-4 h-4 text-[#E8521A]" />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[13px] sm:text-sm font-bold text-[#161616]">Price Beat Guarantee</div>
          <div className="text-[11.5px] sm:text-[13px] text-[#666]">Found a cheaper quote? We'll beat it.</div>
        </div>
        {!expanded && !success && (
          <button
            type="button"
            onClick={open}
            className="whitespace-nowrap rounded-lg bg-[#E8521A] hover:bg-[#d24717] text-white text-[12px] sm:text-[13px] font-bold px-3 sm:px-3.5 py-2 flex items-center gap-1 sm:gap-1.5 flex-shrink-0"
          >
            <span className="hidden sm:inline">Beat My Quote</span>
            <span className="sm:hidden">Beat it</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        {expanded && !success && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-[#666]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Inline expansion */}
      {expanded && !success && (
        <form
          onSubmit={handleSubmit}
          className="px-4 sm:px-5 pb-4 pt-1 border-t border-[#f5e4b0] animate-fade-in"
        >
          <div className="grid gap-4 sm:grid-cols-2 mt-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#161616] mb-1">
                Competitor quote
              </label>
              <div className="flex items-stretch rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#E8521A]/30 focus-within:border-[#E8521A]">
                <span className="flex items-center pl-3 pr-1 text-gray-500 font-bold">£</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={competitorPrice}
                  onChange={(e) => setCompetitorPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 45"
                  className="h-11 flex-1 border-0 rounded-none text-sm font-semibold bg-white focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                  disabled={submitting}
                />
                <div className="relative border-l border-gray-200">
                  <select
                    value={priceMode}
                    onChange={(e) => setPriceMode(e.target.value as 'monthly' | 'total')}
                    disabled={submitting}
                    className="h-11 appearance-none bg-gray-50 pl-3 pr-8 text-[13px] font-semibold text-[#161616] focus:outline-none cursor-pointer"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="total">Total</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              <p className="text-[11.5px] text-[#666] mt-1.5">
                Use the dropdown if the quote is a total policy price.
              </p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#161616] mb-1">
                Mobile number
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(''); }}
                placeholder="07900 000000"
                className="h-11 rounded-lg text-sm font-semibold bg-white"
                autoComplete="tel"
                disabled={submitting}
              />
              {phoneError && <p className="text-xs text-red-600 mt-1.5">{phoneError}</p>}
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 px-5 bg-[#E8521A] hover:bg-[#d24717] text-white font-bold rounded-lg text-sm w-full sm:w-auto"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
              ) : (
                <>Get my better price <ArrowRight className="w-4 h-4 ml-1.5" /></>
              )}
            </Button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#4f4f4f]">
              <a
                href="tel:+443302295040"
                className="inline-flex items-center gap-1.5 font-semibold text-[#161616] hover:text-[#E8521A] underline-offset-2 hover:underline"
              >
                <Zap className="w-3.5 h-3.5 text-[#E8521A] flex-shrink-0" />
                Prefer to talk? Call us on 0330 229 5040
              </a>
              <span className="inline-flex items-center gap-1 text-[#666] font-normal">
                <Lock className="w-3 h-3" /> We never share your details.
              </span>
            </div>

          </div>
        </form>
      )}

      {/* Success state */}
      {success && (
        <div className="px-4 sm:px-5 pb-4 pt-3 border-t border-[#f5e4b0] flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} />
          </div>
          <div className="text-sm text-[#161616]">
            <strong>You're all set.</strong> Our UK team will call you back shortly with a better price.
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceBeatBanner;
