import React from 'react';
import { Check } from 'lucide-react';

interface PaymentMethodSelectorProps {
  selectedPayment: 'monthly' | 'full' | null;
  onPaymentChange: (payment: 'monthly' | 'full') => void;
  monthlyPrice: number;
  totalPrice: number;
  originalPrice?: number;
  fullPrice?: number;
  savings?: number;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedPayment,
  onPaymentChange,
  monthlyPrice,
  totalPrice,
  originalPrice,
  fullPrice: fullPriceProp,
  savings: savingsProp,
}) => {
  const strikethroughPrice = originalPrice ?? totalPrice;
  // Use props from StreamlinedCheckout (source of truth) or fallback to Step 3's formula
  const stripeSavings = savingsProp ?? Math.floor(totalPrice * 0.10);
  const discountedPrice = fullPriceProp ?? (totalPrice - stripeSavings);
  const savings = savingsProp ?? stripeSavings;

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 sm:p-6">
      {/* Header - same size as Plan Summary */}
      <div className="mb-5">
        <h2 className="text-lg sm:text-xl font-bold text-[#1a1a1a]">
          Choose how you want to pay
        </h2>
      </div>

      {/* Payment Cards */}
      <div className="space-y-3">
        {/* Pay Monthly Card - Light orange background */}
        <button
          onClick={() => onPaymentChange('monthly')}
          className={`w-full text-left rounded-xl p-4 sm:p-5 border-2 transition-all ${
            selectedPayment === 'monthly'
              ? 'border-[#0BA360] bg-[#FFF8F3]'
              : 'border-[#E5E5E5] bg-[#FFF8F3] hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Radio/Check indicator */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedPayment === 'monthly'
                    ? 'bg-[#0BA360] border-[#0BA360]'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {selectedPayment === 'monthly' && (
                  <Check className="w-4 h-4 text-white" />
                )}
              </div>

              {/* Content */}
              <div>
                <p className="text-lg sm:text-xl font-bold text-[#1a1a1a]">
                  Pay Monthly: £{monthlyPrice}/month
                </p>
                <p className="text-sm text-[#1a1a1a] mt-0.5">
                  <span className="font-bold">Total £{totalPrice}</span> – 0% APR, 12 payments
                </p>
              </div>
            </div>
          </div>
        </button>

        {/* Pay in Full Card - Light green background */}
        <div className="relative">
          {/* Best Value Badge - positioned at top right corner */}
          <div className="absolute -top-3 right-4 z-10">
            <span className="bg-[#0BA360] text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap">
              BEST VALUE
            </span>
          </div>
          
          <button
            onClick={() => onPaymentChange('full')}
            className={`w-full text-left rounded-xl p-4 sm:p-5 border-2 transition-all ${
              selectedPayment === 'full'
                ? 'border-[#0BA360] bg-[#F0FDF4]'
                : 'border-[#E5E5E5] bg-[#F0FDF4] hover:border-gray-300'
            }`}
          >
            <div className="flex items-center">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Radio/Check indicator */}
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedPayment === 'full'
                      ? 'bg-[#0BA360] border-[#0BA360]'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {selectedPayment === 'full' && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Content */}
                <div>
                  <p className="text-lg sm:text-xl font-bold text-[#1a1a1a]">
                    Pay in Full: £{discountedPrice}
                  </p>
                  <p className="text-sm text-[#1a1a1a] mt-0.5">
                    <span className="font-bold text-red-500 line-through">Was £{strikethroughPrice}</span> <span className="font-bold text-green-600">Save £{savings}</span> <span className="text-gray-500">(10% off)</span>
                  </p>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Helper Text */}
      {!selectedPayment && (
        <p className="text-sm text-gray-600 mt-4 text-center">
          Select a payment option to continue.
        </p>
      )}
    </div>
  );
};

export default PaymentMethodSelector;
