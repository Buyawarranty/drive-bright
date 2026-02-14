import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PaymentElement, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import type { StripeExpressCheckoutElementConfirmEvent, StripePaymentElementChangeEvent } from '@stripe/stripe-js';

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
  const [expressCheckoutAvailable, setExpressCheckoutAvailable] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const hasAutoSubmittedRef = useRef(false);

  // Auto-confirm payment for redirect-based methods (PayPal)
  const confirmPayment = useCallback(async () => {
    if (!stripe || !elements || isProcessing || hasAutoSubmittedRef.current) {
      return;
    }

    hasAutoSubmittedRef.current = true;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/?step=4&payment_return=true`,
        },
        redirect: 'if_required',
      });

      if (error) {
        const message = error.message || 'An error occurred while processing your payment.';
        setErrorMessage(message);
        onError(message);
        setIsProcessing(false);
        hasAutoSubmittedRef.current = false;
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        console.log('Payment requires additional authentication');
      } else {
        setErrorMessage('Payment processing. Please wait...');
        setIsProcessing(false);
        hasAutoSubmittedRef.current = false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMessage(message);
      onError(message);
      setIsProcessing(false);
      hasAutoSubmittedRef.current = false;
    }
  }, [stripe, elements, isProcessing, setIsProcessing, onSuccess, onError]);

  // Handle Express Checkout (Apple Pay / Google Pay) - triggers immediately on click
  const handleExpressCheckoutConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/?step=4&payment_return=true`,
        },
        redirect: 'if_required',
      });

      if (error) {
        const message = error.message || 'An error occurred while processing your payment.';
        setErrorMessage(message);
        onError(message);
        setIsProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        console.log('Payment requires additional authentication');
      } else {
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

  // Handle PaymentElement change - detect when user selects a payment method
  const handlePaymentElementChange = (event: StripePaymentElementChangeEvent) => {
    setSelectedPaymentMethod(event.value.type);
    setIsPaymentComplete(event.complete);
    
    // Reset auto-submit flag when payment method changes
    if (!event.complete) {
      hasAutoSubmittedRef.current = false;
    }
    
    // Auto-trigger for redirect-based methods (PayPal) when selected and ready
    // PayPal doesn't require additional input - clicking it should start payment
    if (event.complete && event.value.type === 'paypal') {
      console.log(`🚀 Auto-triggering PayPal payment`);
      // Small delay to ensure Stripe is ready
      setTimeout(() => {
        confirmPayment();
      }, 100);
    }
  };

  // Handle regular form submit (for Card)
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
          return_url: `${window.location.origin}/?step=4&payment_return=true`,
        },
        redirect: 'if_required',
      });

      if (error) {
        const message = error.message || 'An error occurred while processing your payment.';
        setErrorMessage(message);
        onError(message);
        setIsProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        console.log('Payment requires additional authentication');
      } else {
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

  // Determine if we should show the submit button (only for card payments)
  const showSubmitButton = selectedPaymentMethod === 'card' || selectedPaymentMethod === null;

  return (
    <div className="space-y-4">
      {/* Express Checkout Element - Apple Pay / Google Pay */}
      {/* These buttons trigger payment immediately when clicked - no extra CTA needed */}
      <div className="express-checkout-container">
        <ExpressCheckoutElement
          onReady={({ availablePaymentMethods }) => {
            // Check if any express payment methods are available
            if (availablePaymentMethods) {
              const hasWallets = availablePaymentMethods.applePay || availablePaymentMethods.googlePay;
              setExpressCheckoutAvailable(hasWallets);
            }
          }}
          onConfirm={handleExpressCheckoutConfirm}
          options={{
            buttonType: {
              applePay: 'buy',
              googlePay: 'buy',
            },
            buttonTheme: {
              applePay: 'black',
              googlePay: 'black',
            },
            buttonHeight: 48,
            layout: {
              maxRows: 1,
              maxColumns: 2,
            },
          }}
        />
      </div>

      {/* Divider - only show if express checkout is available */}
      {expressCheckoutAvailable && (
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#E5E5E5]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-muted-foreground">Or pay with card</span>
          </div>
        </div>
      )}

      {/* Regular Payment Form - Card / PayPal */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Payment Element - Primary methods only: Card and PayPal */}
        {/* Apple Pay / Google Pay handled by Express Checkout above */}
        <div className="bg-white rounded-lg">
          <PaymentElement 
            onReady={() => setIsReady(true)}
            onChange={handlePaymentElementChange}
            options={{
              layout: 'tabs',
              business: { name: 'BuyAWarranty' },
              // Primary payment methods: Card first, then PayPal
              // Apple/Google Pay handled by ExpressCheckoutElement above
              // Revolut Pay explicitly hidden via CSS for cleaner UX
              paymentMethodOrder: ['card', 'paypal'],
              wallets: {
                applePay: 'never',
                googlePay: 'never',
              },
              fields: {
                billingDetails: 'auto',
              },
              defaultValues: {
                billingDetails: {},
              },
            }}
          />
        </div>
        {/* CSS to hide Revolut Pay and darken Stripe input fields */}
        <style>{`
          /* Hide Revolut Pay tab in PaymentElement */
          [data-testid="revolut_pay-tab"],
          button[aria-label*="Revolut"],
          .p-TabButton:has(img[alt*="Revolut"]),
          .p-Tab:has([alt*="Revolut"]),
          [class*="revolut"],
          .TabButton:has([alt*="revolut" i]) {
            display: none !important;
          }
          /* Make Stripe input fields darker and more visible */
          .StripeElement input,
          .p-Input,
          .p-Input--text,
          .InputElement,
          .p-Field-input,
          .__PrivateStripeElement iframe {
            color: #000000 !important;
          }
          .p-Input {
            border-color: #999 !important;
            background-color: #FAFAFA !important;
          }
          .p-Input:focus-within,
          .p-Input--focused {
            border-color: #333 !important;
            box-shadow: 0 0 0 1px #333 !important;
          }
          .p-Input::placeholder {
            color: #666 !important;
          }
        `}</style>

        {/* Processing indicator for redirect-based methods */}
        {isProcessing && selectedPaymentMethod === 'paypal' && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting to PayPal...</span>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="flex items-start gap-3 p-4 bg-white border border-red-300 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Complete card details</p>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="flex items-center gap-2 text-xs justify-center py-2" style={{ color: '#0BA360' }}>
          <Lock className="w-3.5 h-3.5" style={{ color: '#0BA360' }} />
          <span>Secured by Stripe. Your card details are encrypted.</span>
        </div>

        {/* Submit Button - Only show for Card payments */}
        {showSubmitButton && (
          <Button
            type="submit"
            disabled={!stripe || !elements || isProcessing || !isReady}
            className="w-full h-14 text-lg font-bold rounded-lg border-0 transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: '#0BA360',
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
        )}
      </form>
    </div>
  );
};

export default StripePaymentForm;
