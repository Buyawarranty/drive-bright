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
      // For redirect-based payments (PayPal), Stripe will redirect to return_url
      // with query params: payment_intent, payment_intent_client_secret, redirect_status
      // redirect_status will be 'succeeded', 'failed', or 'pending'
      // We redirect back to step 4 to handle the status properly
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/?step=4&payment_return=true`,
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Payment Element - Flat design with grey border */}
      {/* Apple Pay/Google Pay will show first when available, then Card, then PayPal */}
      {/* Revolut shows as fallback when wallets aren't available (handled by Stripe automatically) */}
      <div className="bg-white rounded-lg border border-[#DADADA]">
        <PaymentElement 
          onReady={() => setIsReady(true)}
          options={{
            layout: 'tabs',
            business: { name: 'BuyAWarranty' },
            // Wallet methods (Apple Pay, Google Pay) are shown first automatically when available
            // Card shows next, then alternative payment methods
            paymentMethodOrder: ['apple_pay', 'google_pay', 'card', 'paypal'],
            wallets: {
              applePay: 'auto',
              googlePay: 'auto',
            },
          }}
        />
      </div>

      {/* Error Message - Flat design */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 bg-white border border-red-300 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Payment failed</p>
            <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Security Notice - Green text */}
      <div className="flex items-center gap-2 text-xs justify-center py-2" style={{ color: '#0BA360' }}>
        <Lock className="w-3.5 h-3.5" style={{ color: '#0BA360' }} />
        <span>Secured by Stripe. Your card details are encrypted.</span>
      </div>

      {/* Submit Button - Flat Brand Orange, no shadow */}
      <Button
        type="submit"
        disabled={!stripe || !elements || isProcessing || !isReady}
        className="w-full h-14 text-lg font-bold rounded-lg border-0 transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
        style={{
          backgroundColor: '#FF6F00',
          boxShadow: 'none',
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
