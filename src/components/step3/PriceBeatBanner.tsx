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
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
        <div className="w-9 h-9 rounded-full bg-[#FEF0EA] flex items-center justify-center flex-shrink-0">
          <Tag className="w-4 h-4 text-[#E8521A]" />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-sm font-bold text-[#161616]">Price Beat Guarantee</div>
          <div className="text-[13px] text-[#666]">Found a cheaper quote? We'll beat it.</div>
        </div>
        {!expanded && !success && (
          <button
            type="button"
            onClick={open}
            className="whitespace-nowrap rounded-lg bg-[#E8521A] hover:bg-[#d24717] text-white text-[13px] font-bold px-3.5 py-2 flex items-center gap-1.5"
          >
            Beat My Quote <ArrowRight className="w-3.5 h-3.5" />
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
          className="px-4 sm:px-5 pb-4 pt-1 border-t border-[#f5e4b0] bg-white/40 animate-fade-in"
        >
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#161616] mb-1">
                Their monthly price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">£</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={competitorPrice}
                  onChange={(e) => setCompetitorPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 45"
                  className="h-11 pl-7 rounded-lg text-sm font-semibold bg-white"
                  disabled={submitting}
                />
              </div>
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
            </div>
          </div>
          {phoneError && <p className="text-xs text-red-600 mt-1.5">{phoneError}</p>}

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
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
            <span className="text-[12px] text-[#4f4f4f] font-semibold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#E8521A]" /> Fast callback from our UK team
            </span>
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
