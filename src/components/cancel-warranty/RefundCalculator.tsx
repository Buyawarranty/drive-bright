import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calculator, CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface CalculatorInputs {
  policyStartDate: string;
  termMonths: number;
  monthlyPrice: number;
  paymentType: 'pay_in_full' | 'pay_monthly' | '';
  claimSubmitted: 'yes' | 'no' | '';
}

interface RefundResult {
  eligible: boolean;
  refundAmount: number;
  timeline: string;
  message: string;
  type: 'cooling_off' | 'pro_rata' | 'finance' | 'no_refund';
  details?: string;
}

const RefundCalculator: React.FC = () => {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    policyStartDate: '',
    termMonths: 12,
    monthlyPrice: 0,
    paymentType: '',
    claimSubmitted: ''
  });
  const [showResult, setShowResult] = useState(false);

  const calculateRefund = useMemo((): RefundResult | null => {
    if (!inputs.policyStartDate || !inputs.paymentType || !inputs.claimSubmitted || inputs.monthlyPrice <= 0) {
      return null;
    }

    const policyStart = new Date(inputs.policyStartDate);
    const today = new Date();
    const daysSinceStart = Math.floor((today.getTime() - policyStart.getTime()) / (1000 * 60 * 60 * 24));
    const monthsUsed = Math.max(0, Math.ceil(daysSinceStart / 30));
    const withinCoolingOff = daysSinceStart <= 14;

    // Rule 1: Claim submitted = no refund
    if (inputs.claimSubmitted === 'yes') {
      return {
        eligible: false,
        refundAmount: 0,
        timeline: '',
        message: "A claim has been submitted, so refunds do not apply.",
        type: 'no_refund',
        details: "Your warranty remains active and valid for the rest of the term. If your situation is exceptional, please share details in the cancellation form and we'll request a discretionary review."
      };
    }

    // Rule 2: Within cooling-off period
    if (withinCoolingOff) {
      const totalPremium = inputs.termMonths * inputs.monthlyPrice;
      return {
        eligible: true,
        refundAmount: totalPremium,
        timeline: 'within 5 working days',
        message: "You're within the 14-day cooling-off period with no claim on record.",
        type: 'cooling_off',
        details: "You're eligible for a full refund. We'll process this within 5 working days."
      };
    }

    // Rule 3: After 14 days - pay in full
    if (inputs.paymentType === 'pay_in_full') {
      const unusedFullMonths = Math.max(0, inputs.termMonths - monthsUsed);
      const gross = unusedFullMonths * inputs.monthlyPrice;
      const fee = 40;
      const minimumRetained = 2 * inputs.monthlyPrice;
      const refund = Math.max(0, gross - fee - minimumRetained);
      
      return {
        eligible: refund > 0,
        refundAmount: Math.round(refund * 100) / 100,
        timeline: 'within 7 working days',
        message: "You're eligible for a pro-rata refund of unused full months.",
        type: 'pro_rata',
        details: `A £40 fair usage fee applies. We retain a minimum of two months' equivalent payment (£${(minimumRetained).toFixed(2)}). Your estimated refund is £${refund.toFixed(2)}. We'll process this within 7 working days.`
      };
    }

    // Rule 4: After 14 days - pay monthly (finance)
    if (inputs.paymentType === 'pay_monthly') {
      const fee = 40;
      const minimumDue = (2 * inputs.monthlyPrice) + fee;
      const totalPaid = monthsUsed * inputs.monthlyPrice;
      const contractValue = inputs.termMonths * inputs.monthlyPrice;
      const eligibleBalance = Math.max(0, contractValue - totalPaid - minimumDue);
      
      return {
        eligible: eligibleBalance > 0,
        refundAmount: Math.round(eligibleBalance * 100) / 100,
        timeline: 'typically 7 working days after provider confirmation',
        message: "We'll help you process any eligible pro-rata refund via your finance provider.",
        type: 'finance',
        details: `A minimum of two months' equivalent payment plus a £40 fee applies. Your estimated refund is £${eligibleBalance.toFixed(2)}. We'll guide you step by step.`
      };
    }

    return null;
  }, [inputs]);

  const handleCalculate = () => {
    setShowResult(true);
  };

  const isFormComplete = inputs.policyStartDate && inputs.paymentType && inputs.claimSubmitted && inputs.monthlyPrice > 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <Calculator className="w-6 h-6 text-white" />
          <h3 className="text-xl font-bold text-white">Refund Calculator</h3>
        </div>
        <p className="text-orange-100 text-sm mt-1">Get an instant estimate of your potential refund</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Policy Start Date */}
        <div>
          <Label htmlFor="policyStartDate" className="text-gray-700 font-medium flex items-center gap-2">
            📅 When did your policy start?
          </Label>
          <Input
            id="policyStartDate"
            type="date"
            value={inputs.policyStartDate}
            onChange={(e) => setInputs({ ...inputs, policyStartDate: e.target.value })}
            className="mt-2 h-11"
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Monthly Price */}
        <div>
          <Label htmlFor="monthlyPrice" className="text-gray-700 font-medium flex items-center gap-2">
            💷 What is your monthly price?
          </Label>
          <div className="relative mt-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
            <Input
              id="monthlyPrice"
              type="number"
              min="0"
              step="0.01"
              value={inputs.monthlyPrice || ''}
              onChange={(e) => setInputs({ ...inputs, monthlyPrice: parseFloat(e.target.value) || 0 })}
              className="h-11 pl-8"
              placeholder="e.g., 35.00"
            />
          </div>
        </div>

        {/* Term Length */}
        <div>
          <Label className="text-gray-700 font-medium flex items-center gap-2">
            📆 Policy term length
          </Label>
          <RadioGroup
            value={inputs.termMonths.toString()}
            onValueChange={(value) => setInputs({ ...inputs, termMonths: parseInt(value) })}
            className="flex gap-4 mt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="12" id="term-12" />
              <Label htmlFor="term-12" className="text-gray-600 cursor-pointer">12 months</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="24" id="term-24" />
              <Label htmlFor="term-24" className="text-gray-600 cursor-pointer">24 months</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Payment Type */}
        <div>
          <Label className="text-gray-700 font-medium flex items-center gap-2">
            💳 How did you pay?
          </Label>
          <RadioGroup
            value={inputs.paymentType}
            onValueChange={(value: 'pay_in_full' | 'pay_monthly') => setInputs({ ...inputs, paymentType: value })}
            className="mt-2 space-y-2"
          >
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="pay_in_full" id="pay-full" />
              <Label htmlFor="pay-full" className="text-gray-600 cursor-pointer flex-1">Paid in full (one-time payment)</Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="pay_monthly" id="pay-monthly" />
              <Label htmlFor="pay-monthly" className="text-gray-600 cursor-pointer flex-1">Pay monthly (finance)</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Claim Submitted */}
        <div>
          <Label className="text-gray-700 font-medium flex items-center gap-2">
            📋 Have you submitted any claims?
          </Label>
          <RadioGroup
            value={inputs.claimSubmitted}
            onValueChange={(value: 'yes' | 'no') => setInputs({ ...inputs, claimSubmitted: value })}
            className="flex gap-4 mt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="claim-no" />
              <Label htmlFor="claim-no" className="text-gray-600 cursor-pointer">No claims</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="claim-yes" />
              <Label htmlFor="claim-yes" className="text-gray-600 cursor-pointer">Yes, I've made a claim</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Calculate Button */}
        <Button
          onClick={handleCalculate}
          disabled={!isFormComplete}
          className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-lg"
        >
          Calculate My Refund
        </Button>

        {/* Result Display */}
        {showResult && calculateRefund && (
          <div 
            role="region" 
            aria-live="polite"
            className={`mt-6 p-6 rounded-xl border-2 ${
              calculateRefund.eligible 
                ? 'bg-green-50 border-green-400' 
                : 'bg-amber-50 border-amber-400'
            }`}
          >
            <div className="flex items-start gap-3">
              {calculateRefund.eligible ? (
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              ) : calculateRefund.type === 'no_refund' ? (
                <XCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className={`font-bold text-lg ${calculateRefund.eligible ? 'text-green-800' : 'text-amber-800'}`}>
                  {calculateRefund.message}
                </h4>
                {calculateRefund.eligible && (
                  <div className="mt-3 bg-white rounded-lg p-4 border">
                    <div className="text-3xl font-bold text-green-700">
                      £{calculateRefund.refundAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Estimated refund • Processed {calculateRefund.timeline}
                    </div>
                  </div>
                )}
                {calculateRefund.details && (
                  <p className={`mt-3 ${calculateRefund.eligible ? 'text-green-700' : 'text-amber-700'}`}>
                    {calculateRefund.details}
                  </p>
                )}
                {calculateRefund.type === 'finance' && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800">
                      <HelpCircle className="w-4 h-4" />
                      <span className="font-medium text-sm">Important note about finance</span>
                    </div>
                    <p className="text-blue-700 text-sm mt-1">
                      Cancelling your warranty does not cancel your finance agreement. Don't worry – we will guide you and process everything with your finance provider to make it quick and hassle-free.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RefundCalculator;
