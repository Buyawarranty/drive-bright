import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tag, ChevronUp, ChevronDown, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AppliedDiscount {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  discountAmount: number;
  stripeCouponId?: string;
  stripePromoCodeId?: string;
}

interface PromoCodeSectionProps {
  orderAmount: number;
  customerEmail?: string;
  appliedDiscounts: AppliedDiscount[];
  onApplyDiscount: (discount: AppliedDiscount) => void;
  onRemoveDiscount: (code: string) => void;
  className?: string;
  variant?: 'default' | 'compact';
}

export function PromoCodeSection({
  orderAmount,
  customerEmail,
  appliedDiscounts,
  onApplyDiscount,
  onRemoveDiscount,
  className = '',
  variant = 'default'
}: PromoCodeSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoCodeError, setPromoCodeError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const totalDiscountAmount = appliedDiscounts.reduce((sum, d) => sum + d.discountAmount, 0);
  const hasDiscounts = appliedDiscounts.length > 0;

  const applyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;

    setIsValidating(true);
    setPromoCodeError('');

    try {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: {
          code: promoCodeInput.trim().toUpperCase(),
          customerEmail,
          orderAmount
        }
      });

      if (error) throw error;

      if (!data.valid) {
        setPromoCodeError(data.error || 'Invalid promo code');
        return;
      }

      // Check if already applied
      if (appliedDiscounts.some(d => d.code === data.discountCode.code)) {
        setPromoCodeError('This code has already been applied');
        return;
      }

      const newDiscount: AppliedDiscount = {
        code: data.discountCode.code,
        type: data.discountCode.type,
        value: data.discountCode.value,
        discountAmount: data.discountAmount,
        stripeCouponId: data.discountCode.stripe_coupon_id,
        stripePromoCodeId: data.discountCode.stripe_promo_code_id
      };

      onApplyDiscount(newDiscount);
      setPromoCodeInput('');
      toast.success(`Promo code "${newDiscount.code}" applied!`);
    } catch (err: any) {
      console.error('Promo code validation error:', err);
      setPromoCodeError('Failed to validate promo code. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyPromoCode();
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`space-y-3 ${className}`}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <Tag className="w-4 h-4" />
            <span>Have a promo code?</span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {hasDiscounts ? (
              <div className="space-y-2">
                {appliedDiscounts.map(discount => (
                  <div key={discount.code} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-green-700 text-sm">{discount.code}</span>
                      <span className="text-xs text-green-600">
                        {discount.type === 'percentage' ? `${discount.value}% OFF` : `£${discount.value} OFF`}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemoveDiscount(discount.code)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={promoCodeInput}
                  onChange={(e) => {
                    setPromoCodeInput(e.target.value.toUpperCase());
                    setPromoCodeError('');
                  }}
                  onKeyDown={handleKeyDown}
                  className="flex-1 h-10"
                  disabled={isValidating}
                />
                <Button
                  onClick={applyPromoCode}
                  variant="outline"
                  size="sm"
                  disabled={!promoCodeInput.trim() || isValidating}
                  className="h-10 px-4 bg-[#DFF5E3] border-[#6BBF7B] text-[#1a4d24] font-semibold hover:bg-[#c8ebd0]"
                >
                  {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
            )}
            {promoCodeError && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {promoCodeError}
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Discount Applied Banner (when collapsed) */}
        {hasDiscounts && !isOpen && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-gray-700">Discount Applied:</span>
              <span className="font-bold text-green-700">-£{Math.floor(totalDiscountAmount)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default variant - Card style for customer quote page
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-orange-500" />
            <span>Have a promo code?</span>
          </div>
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          {hasDiscounts ? (
            <div className="space-y-2">
              {appliedDiscounts.map(discount => (
                <div key={discount.code} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 rounded-full p-1.5">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <span className="font-bold text-green-700">{discount.code}</span>
                      <span className="text-sm text-green-600 ml-2">
                        {discount.type === 'percentage' ? `${discount.value}% OFF` : `£${discount.value} OFF`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveDiscount(discount.code)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <p className="text-center text-sm text-green-700 font-medium pt-2">
                You're saving £{Math.floor(totalDiscountAmount)}!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter your promo code"
                  value={promoCodeInput}
                  onChange={(e) => {
                    setPromoCodeInput(e.target.value.toUpperCase());
                    setPromoCodeError('');
                  }}
                  onKeyDown={handleKeyDown}
                  className="flex-1 h-12 text-base"
                  disabled={isValidating}
                />
                <Button
                  onClick={applyPromoCode}
                  disabled={!promoCodeInput.trim() || isValidating}
                  className="h-12 px-6 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  {isValidating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </Button>
              </div>
              {promoCodeError && (
                <p className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {promoCodeError}
                </p>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Discount Applied Banner (when collapsed) */}
      {hasDiscounts && !isOpen && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700">Discount Applied:</span>
            <span className="font-bold text-green-600 text-lg">-£{Math.floor(totalDiscountAmount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
