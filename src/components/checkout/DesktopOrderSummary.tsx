import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Check, Lock, Star } from 'lucide-react';
import TrustpilotHeader from '@/components/TrustpilotHeader';

interface DesktopOrderSummaryProps {
  planName: string;
  vehicleReg: string;
  duration: string;
  claimLimit: number;
  labourRate: number;
  excess: number;
  selectedPayment: 'monthly' | 'full';
  monthlyPrice: number;
  totalPrice: number;
  fullPrice: number;
  savings: number;
  isLoading: boolean;
  onPayClick: () => void;
}

const DesktopOrderSummary: React.FC<DesktopOrderSummaryProps> = ({
  planName,
  vehicleReg,
  duration,
  claimLimit,
  labourRate,
  excess,
  selectedPayment,
  monthlyPrice,
  totalPrice,
  fullPrice,
  savings,
  isLoading,
  onPayClick,
}) => {
  // Map claim limit display values
  const displayClaimLimit = (limit: number) => {
    if (limit === 750) return '£1,000';
    if (limit === 1250) return '£2,000';
    if (limit === 2000) return '£3,000';
    return `£${limit.toLocaleString()}`;
  };

  return (
    <div className="hidden lg:block w-[340px] flex-shrink-0">
      <div className="sticky top-4 pb-24">
        <Card className="border border-border bg-white rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-5">
            {/* Header - aligned with main content heading */}
            <h2 className="text-lg sm:text-xl font-bold text-[#1a1a1a] mb-4">Order Summary</h2>
            
            {/* Plan Details */}
            <div className="border-t border-border pt-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Plan</span>
                <span className="font-semibold text-[#1a1a1a] text-sm">Comprehensive</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Vehicle</span>
                <span 
                  className="font-mono font-bold text-xs uppercase px-2 py-0.5 rounded border-2 border-black tracking-wider"
                  style={{ backgroundColor: '#FCD34D' }}
                >
                  {vehicleReg}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Duration</span>
                <span className="font-semibold text-[#1a1a1a] text-sm">{duration}</span>
              </div>
            </div>
            
            {/* Cover Details */}
            <div className="border-t border-border mt-4 pt-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Claim limit</span>
                <span className="font-semibold text-[#1a1a1a] text-sm">{displayClaimLimit(claimLimit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Labour rate</span>
                <span className="font-semibold text-[#1a1a1a] text-sm">£{labourRate}/hr</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Excess</span>
                <span className="font-semibold text-[#1a1a1a] text-sm">£{excess}</span>
              </div>
            </div>
            
            {/* Payment Card */}
            <div className="mt-5">
              {selectedPayment === 'full' ? (
                <div className="border-2 border-[#0BA360] rounded-lg p-4 bg-[#F0FDF4]">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-[#1a1a1a] text-sm">Pay in Full</p>
                      <p className="text-2xl font-bold text-[#1a1a1a] mt-1">£{fullPrice}</p>
                      <p className="text-sm text-[#0BA360] font-medium mt-0.5">
                        Save £{savings} (10% off)
                      </p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#0BA360] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-[#FF6F00] rounded-lg p-4 bg-[#FFF8F3]">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-[#1a1a1a] text-sm">Pay Monthly</p>
                      <p className="text-2xl font-bold text-[#1a1a1a] mt-1">£{monthlyPrice}/mo</p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        12 payments · 0% APR
                      </p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#FF6F00] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* CTA Button */}
            <Button
              onClick={onPayClick}
              disabled={isLoading}
              className="w-full h-12 mt-4 text-base font-bold rounded-xl text-white"
              style={{ backgroundColor: '#0BA360' }}
            >
              <Lock className="w-4 h-4 mr-2" />
              {selectedPayment === 'full' 
                ? `Pay £${fullPrice} now`
                : `Pay £${monthlyPrice} today`
              }
            </Button>
            
            {/* Trust Signals */}
            <div className="grid grid-cols-2 gap-3 mt-5 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#0BA360]" strokeWidth={1.5} />
                <span>Instant cover</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#0BA360]" strokeWidth={1.5} />
                <span>14-day refund</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#0BA360]" strokeWidth={1.5} />
                <span>Easy claims</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#0BA360]" strokeWidth={1.5} />
                <span>UK-based team</span>
              </div>
            </div>
            
            {/* SSL Encryption */}
            <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-gray-500">
              <Lock className="w-3 h-3" />
              <span>256-bit SSL encryption</span>
            </div>
            
            {/* Trustpilot */}
            <div className="flex items-center justify-center mt-3">
              <a 
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <TrustpilotHeader className="scale-75" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DesktopOrderSummary;
