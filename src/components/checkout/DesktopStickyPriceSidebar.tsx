import React from 'react';
import { Shield, Check, Lock, Star, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DesktopStickyPriceSidebarProps {
  planName: string;
  vehicleReg: string;
  duration: string;
  claimLimit: number;
  labourRate: number;
  excess: number;
  monthlyPrice: number;
  fullPrice: number;
  originalPrice: number;
  selectedPayment: 'monthly' | 'full' | null;
  isLoading: boolean;
  isFormValid: boolean;
  onPayClick: () => void;
  onPaymentChange?: (payment: 'monthly' | 'full') => void;
}

const DesktopStickyPriceSidebar: React.FC<DesktopStickyPriceSidebarProps> = ({
  planName,
  vehicleReg,
  duration,
  claimLimit,
  labourRate,
  excess,
  monthlyPrice,
  fullPrice,
  originalPrice,
  selectedPayment,
  isLoading,
  isFormValid,
  onPayClick,
  onPaymentChange,
}) => {
  // Map claim limit display values
  const displayClaimLimit = () => {
    if (claimLimit === 750) return '£1,000';
    if (claimLimit === 1250) return '£2,000';
    if (claimLimit === 2000) return '£3,000';
    return `£${claimLimit.toLocaleString()}`;
  };

  const savings = originalPrice - fullPrice;

  return (
    <div className="sticky top-4">
      <Card className="border border-[#DADADA] shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="bg-white p-4 border-b border-[#DADADA]">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" style={{ color: '#0BA360' }} />
              <h3 className="font-bold text-foreground">Order Summary</h3>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Plan Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium text-foreground">{planName || 'Platinum'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vehicle</span>
                <span 
                  className="font-mono font-bold text-xs uppercase px-1.5 py-0.5 rounded border border-black"
                  style={{ backgroundColor: '#FCD34D' }}
                >
                  {vehicleReg}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium text-foreground">{duration}</span>
              </div>
            </div>

            <div className="h-px bg-[#DADADA]" />

            {/* Coverage */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Claim limit</span>
                <span className="font-medium text-foreground">{displayClaimLimit()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Labour rate</span>
                <span className="font-medium text-foreground">£{labourRate}/hr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Excess</span>
                <span className="font-medium text-foreground">£{excess}</span>
              </div>
            </div>

            <div className="h-px bg-[#DADADA]" />

            {/* Payment Option Selectors - Solid border when selected */}
            <div className="space-y-3">
              {/* Pay Monthly Option */}
              <button
                type="button"
                onClick={() => onPaymentChange?.('monthly')}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-150 ${
                  selectedPayment === 'monthly'
                    ? 'bg-orange-50 border-[#FF6B00]'
                    : 'bg-[#FFF8F5] border-[#FFD9BF] hover:border-[#FF9A4C]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">
                      Pay Monthly: £{monthlyPrice}/month
                    </p>
                    <p className="text-xs mt-0.5 text-[#1a1a1a]">
                      Total £{originalPrice} – 0% APR, 12 payments
                    </p>
                  </div>
                  {selectedPayment === 'monthly' && (
                    <Check className="w-5 h-5 flex-shrink-0" style={{ color: '#0BA360' }} />
                  )}
                </div>
              </button>

              {/* Pay in Full Option */}
              <button
                type="button"
                onClick={() => onPaymentChange?.('full')}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-150 ${
                  selectedPayment === 'full'
                    ? 'bg-green-50 border-[#0BA360]'
                    : 'bg-[#F0FDF4] border-[#C8F3D2] hover:border-[#7AD69D]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">
                      Pay in Full: £{fullPrice}
                    </p>
                    <p className="text-xs mt-0.5 text-[#1a1a1a]">
                      Save £{savings} (10% off)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ backgroundColor: '#0BA360', color: '#FFFFFF' }}
                    >
                      BEST VALUE
                    </span>
                    {selectedPayment === 'full' && (
                      <Check className="w-5 h-5 flex-shrink-0" style={{ color: '#0BA360' }} />
                    )}
                  </div>
                </div>
              </button>
            </div>

            {/* CTA Button - Orange for monthly, Green for full */}
            <Button
              onClick={onPayClick}
              disabled={isLoading || !selectedPayment}
              className="w-full py-5 text-base font-bold rounded-xl transition-all duration-150"
              style={{
                backgroundColor: !selectedPayment 
                  ? '#CCCCCC' 
                  : selectedPayment === 'monthly'
                    ? '#FF6B00'
                    : '#0BA360',
                color: '#FFFFFF',
                boxShadow: 'none',
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  {selectedPayment === 'monthly' 
                    ? `Pay £${monthlyPrice} today` 
                    : selectedPayment === 'full'
                    ? `Pay £${fullPrice} now`
                    : 'Select payment option'}
                </span>
              )}
            </Button>

            {/* Trust Elements */}
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" style={{ color: '#0BA360' }} />
                256-bit SSL encryption
              </p>
              <div className="flex items-center justify-center gap-2">
                <a 
                  href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-green-500 text-green-500" />
                    ))}
                  </div>
                  <span className="underline">Trustpilot</span>
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DesktopStickyPriceSidebar;
