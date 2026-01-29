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
      <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="bg-primary/10 p-4 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
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

            <div className="h-px bg-border" />

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

            <div className="h-px bg-border" />

            {/* Price Display */}
            <div className="space-y-3">
              {selectedPayment === 'monthly' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Monthly payments</p>
                  <p className="text-2xl font-bold text-foreground">£{monthlyPrice}/month</p>
                  <p className="text-xs text-muted-foreground">12 payments · 0% APR</p>
                </div>
              )}
              {selectedPayment === 'full' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Pay in full</p>
                  <p className="text-2xl font-bold text-foreground">£{fullPrice}</p>
                  <p className="text-xs text-muted-foreground line-through">Was £{originalPrice}</p>
                  <p className="text-xs font-medium text-green-600">Save £{savings} (10% off)</p>
                </div>
              )}
              {!selectedPayment && (
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">Select a payment option below</p>
                </div>
              )}
            </div>

            {/* CTA Button */}
            <Button
              onClick={onPayClick}
              disabled={isLoading || !selectedPayment}
              className="w-full py-5 text-base font-bold rounded-xl shadow-lg"
              style={{
                backgroundColor: !selectedPayment 
                  ? '#CCCCCC' 
                  : selectedPayment === 'monthly' 
                    ? '#FF6B00' 
                    : '#28A745',
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
                    ? 'Complete one-time payment'
                    : 'Select payment option'}
                </span>
              )}
            </Button>

            {/* Trust Elements */}
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" />
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
