import React from 'react';
import { Shield, Car, Calendar, CreditCard, Wrench, AlertCircle, ArrowRight } from 'lucide-react';
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
  // Format plan name for display
  const formatPlanName = (name: string) => {
    return name
      .replace(/vehicle/gi, '')
      .replace(/car/gi, '')
      .replace(/bike/gi, '')
      .replace(/plan/gi, '')
      .replace(/premium/gi, 'Platinum')
      .trim() || 'Platinum Comprehensive';
  };

  // Map claim limit display values
  const displayClaimLimit = () => {
    if (claimLimit === 750) return '£1,000';
    if (claimLimit === 1250) return '£2,000';
    if (claimLimit === 2000) return '£3,000';
    return `£${claimLimit.toLocaleString()}`;
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-lg overflow-hidden">
      <CardContent className="p-0">
        {/* Header with Plan Name */}
        <div className="bg-primary/10 px-4 py-3 sm:px-5 sm:py-4 border-b border-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  {formatPlanName(planName)} Plan
                </h2>
                <p className="text-xs text-muted-foreground">Comprehensive Warranty Cover</p>
              </div>
            </div>
            <button
              onClick={onChangePlan}
              className="text-sm text-primary hover:text-primary/80 font-medium underline underline-offset-2 flex items-center gap-1"
            >
              Change plan
            </button>
          </div>
        </div>

        {/* Summary Grid */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Vehicle & Duration Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Car className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Vehicle</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span 
                    className="font-mono font-bold text-sm uppercase tracking-wide px-2 py-0.5 rounded border-2 border-black"
                    style={{ backgroundColor: '#FCD34D' }}
                  >
                    {vehicleReg}
                  </span>
                  {(vehicleMake || vehicleModel) && (
                    <span className="text-sm text-foreground">
                      {vehicleMake} {vehicleModel}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-semibold text-foreground">{duration}</p>
            </div>
          </div>

          {/* Coverage Details Grid */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/50">
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-0.5">Claim Limit</p>
              <p className="text-sm font-bold text-foreground">{displayClaimLimit()}</p>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-0.5">Labour Rate</p>
              <p className="text-sm font-bold text-foreground">£{labourRate}/hr</p>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-0.5">Excess</p>
              <p className="text-sm font-bold text-foreground">£{excess}</p>
            </div>
          </div>

          {/* Pricing Selection Indicator */}
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Payment option:</span>
              </div>
              <div className="text-right">
                {selectedPayment === 'monthly' ? (
                  <span className="text-sm font-semibold text-foreground">
                    £{monthlyPrice}/month <span className="text-xs text-muted-foreground">(12 payments)</span>
                  </span>
                ) : selectedPayment === 'full' ? (
                  <span className="text-sm font-semibold text-foreground">
                    £{totalPrice} <span className="text-xs text-muted-foreground">(one-time)</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Select below</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlanSummaryCard;
