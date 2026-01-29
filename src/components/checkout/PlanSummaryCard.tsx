import React from 'react';
import { Shield, Check, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PlanSummaryCardProps {
  planName: string;
  vehicleReg: string;
  vehicleMake?: string;
  vehicleModel?: string;
  duration: string;
  claimLimit: number;
  labourRate: number;
  excess: number;
  selectedPayment: 'monthly' | 'full' | null;
  monthlyPrice: number;
  totalPrice: number;
  onChangePlan: () => void;
}

const PlanSummaryCard: React.FC<PlanSummaryCardProps> = ({
  planName,
  vehicleReg,
  vehicleMake,
  vehicleModel,
  duration,
  claimLimit,
  labourRate,
  excess,
  selectedPayment,
  monthlyPrice,
  totalPrice,
  onChangePlan,
}) => {
  // Map claim limit display values
  const displayClaimLimit = () => {
    if (claimLimit === 750) return '£1,000';
    if (claimLimit === 1250) return '£2,000';
    if (claimLimit === 2000) return '£3,000';
    return `£${claimLimit.toLocaleString()}`;
  };

  const vehicleDisplay = [vehicleMake, vehicleModel].filter(Boolean).join(' ') || vehicleReg;
  const originalPrice = totalPrice;
  const discountedPrice = Math.round(totalPrice * 0.9);

  return (
    <Card className="bg-white border border-border shadow-sm overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <Shield className="w-7 h-7 text-orange-500 fill-orange-100" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Your platinum vehicle plan is ready
            </h2>
          </div>
          <button
            onClick={onChangePlan}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Change
          </button>
        </div>

        {/* 14-day guarantee banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-sm text-green-800">Cancel anytime within 14 days for a full refund</span>
        </div>

        {/* Plan Details List */}
        <div className="space-y-3 mb-5">
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Plan:</span>
            <span className="font-semibold text-foreground">Platinum</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-semibold text-foreground">{duration}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Vehicle:</span>
            <span className="font-semibold text-foreground uppercase">{vehicleDisplay}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Claim Limit:</span>
            <span className="font-semibold text-foreground">{displayClaimLimit()}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Labour Rate:</span>
            <span className="font-semibold text-foreground">£{labourRate}/hour</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Excess:</span>
            <span className="font-semibold text-foreground">£{excess}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Registration:</span>
            <span className="font-semibold text-foreground uppercase tracking-wide">{vehicleReg}</span>
          </div>
        </div>

        {/* Pricing Options */}
        <div className="space-y-3 pt-4 border-t border-border">
          {/* Monthly Option */}
          <div 
            className={`rounded-lg px-4 py-3 ${
              selectedPayment === 'monthly' 
                ? 'bg-orange-50 border-2 border-orange-300' 
                : 'bg-orange-50/50 border border-orange-100'
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-bold text-foreground">Pay Monthly: £{monthlyPrice}/month</span>
              <span className="text-muted-foreground text-sm">
                Total £{totalPrice} – 0% APR, 12 payments
              </span>
            </div>
          </div>

          {/* Pay in Full Option */}
          <div 
            className={`rounded-lg px-4 py-3 relative ${
              selectedPayment === 'full' 
                ? 'bg-green-50 border-2 border-green-300' 
                : 'bg-green-50/50 border border-green-100'
            }`}
          >
            <div className="absolute top-2 right-2">
              <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                BEST VALUE
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 pr-20">
              <span className="font-bold text-foreground">Pay in Full: £{discountedPrice}</span>
              <span className="text-muted-foreground text-sm">
                (Was £{totalPrice}, Now £{discountedPrice} with extra 10% off)
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlanSummaryCard;
