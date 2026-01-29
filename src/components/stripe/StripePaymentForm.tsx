import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, AlertCircle } from 'lucide-react';

interface StripePaymentFormProps {
  amount: number;
  isMonthly?: boolean;
  onSuccess: () => void;
  onError: (error: string) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

export const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  amount,
  isMonthly = false,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/thank-you`,
        },
        redirect: 'if_required',
      });

      if (error) {
        // Show error to customer (e.g., insufficient funds, card declined)
        const message = error.message || 'An error occurred while processing your payment.';
        setErrorMessage(message);
        onError(message);
        setIsProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded!
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        // Card requires authentication - Stripe.js will handle this automatically
        console.log('Payment requires additional authentication');
      } else {
        // Unexpected state
        setErrorMessage('Payment processing. Please wait...');
        setIsProcessing(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMessage(message);
      onError(message);
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Payment Element - Stripe handles wallet buttons internally */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <PaymentElement 
          onReady={() => setIsReady(true)}
          options={{
            layout: 'tabs',
            business: { name: 'BuyAWarranty' },
            paymentMethodOrder: ['apple_pay', 'google_pay', 'card'],
          }}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Payment failed</p>
            <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-2">
        <Lock className="w-3.5 h-3.5 text-green-600" />
        <span>Secured by Stripe. Your card details are encrypted.</span>
      </div>

      {/* Submit Button - Brand Orange */}
      <Button
        type="submit"
        disabled={!stripe || !elements || isProcessing || !isReady}
        className="w-full h-14 text-lg font-bold rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl"
        style={{
          backgroundColor: '#E65100',
        }}
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2 text-white">
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing payment...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2 text-white">
            <Lock className="w-5 h-5" />
            {isMonthly ? `Pay £${amount.toFixed(2)} today` : `Pay £${amount.toFixed(2)} now`}
          </span>
        )}
      </Button>
    </form>
  );
};

export default StripePaymentForm;
