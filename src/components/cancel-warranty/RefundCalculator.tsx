import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle2 } from 'lucide-react';

const RefundCalculator: React.FC = () => {
  const [claimSubmitted, setClaimSubmitted] = useState<'yes' | 'no' | ''>('');
  const [showResult, setShowResult] = useState(false);

  const handleCalculate = () => {
    setShowResult(true);
  };

  return (
    <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
      <div className="p-6 space-y-6">
        {/* Claim Submitted */}
        <div>
          <Label className="text-foreground font-medium flex items-center gap-2 text-lg">
            📋 Have you submitted any claims?
          </Label>
          <RadioGroup
            value={claimSubmitted}
            onValueChange={(value: 'yes' | 'no') => {
              setClaimSubmitted(value);
              setShowResult(false);
            }}
            className="flex gap-4 mt-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="claim-no" />
              <Label htmlFor="claim-no" className="text-muted-foreground cursor-pointer">No claims</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="claim-yes" />
              <Label htmlFor="claim-yes" className="text-muted-foreground cursor-pointer">Yes, I've made a claim</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Calculate Button */}
        <Button
          onClick={handleCalculate}
          disabled={!claimSubmitted}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg"
        >
          Calculate My Refund
        </Button>

        {/* Result Display - Only shows when claim was submitted */}
        {showResult && claimSubmitted === 'yes' && (
          <div 
            role="region" 
            aria-live="polite"
            className="mt-6 p-6 rounded-xl border-2 bg-secondary border-muted-foreground/30"
          >
            <p className="text-foreground font-medium">
              A claim has been submitted, so refunds do not apply.
            </p>
            
            {/* Green success box */}
            <div className="mt-4 p-4 rounded-lg bg-success/20 border border-success">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <p className="text-success font-medium">
                  Your warranty remains active and valid for the rest of the term. If your situation is exceptional, please share details in the cancellation form and we'll request a discretionary review.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Result Display - No claims */}
        {showResult && claimSubmitted === 'no' && (
          <div 
            role="region" 
            aria-live="polite"
            className="mt-6 p-6 rounded-xl border-2 bg-success/10 border-success"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-success font-bold text-lg">
                  Good news! You may be eligible for a refund.
                </p>
                <p className="text-success mt-2">
                  Please complete the cancellation form below and our team will calculate your exact refund amount based on your policy details.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RefundCalculator;
