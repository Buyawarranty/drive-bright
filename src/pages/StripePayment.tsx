import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
// Force rebuild - cache fix
import { Shield, Check, Lock, Star, ArrowLeft, Car, Clock, CreditCard, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { StripePaymentForm } from '@/components/stripe/StripePaymentForm';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { toast } from 'sonner';

interface PaymentData {
  clientSecret: string;
  amount: number;
  originalAmount: number;
  vehicleReg: string;
  vehicleMake: string;
  vehicleModel: string;
  planName: string;
  duration: string;
  claimLimit: number;
  labourRate: number;
  excess: number;
  customerName: string;
  customerEmail: string;
  isMonthly?: boolean;
  monthlyPrice?: number;
}

const StripePayment: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check for redirect status from PayPal returns
  const redirectStatus = searchParams.get('redirect_status');
  const paymentIntentId = searchParams.get('payment_intent');
  
  // Handle redirect-based payment returns (PayPal, etc.)
  useEffect(() => {
    // If user is returning from a redirect-based payment
    if (redirectStatus) {
      if (redirectStatus === 'succeeded') {
        // Payment successful! Redirect to thank-you
        console.log('✅ Redirect payment succeeded, navigating to thank-you');
        localStorage.removeItem('stripe_payment_data');
        navigate('/thank-you?source=stripe', { replace: true });
        return;
      } else if (redirectStatus === 'failed') {
        // Payment failed
        console.log('❌ Redirect payment failed');
        toast.error('Payment failed. Please try again or use a different payment method.');
        // Clear the URL params but stay on page to retry
        navigate('/checkout/payment/', { replace: true });
      } else if (redirectStatus === 'pending') {
        // Payment is pending
        console.log('⏳ Redirect payment pending');
        toast.info('Your payment is being processed. Please wait...');
      }
    }
  }, [redirectStatus, navigate]);

  // Load payment data from location state or localStorage
  useEffect(() => {
    const stateData = location.state as PaymentData | undefined;
    
    if (stateData?.clientSecret) {
      setPaymentData(stateData);
      setIsLoading(false);
      // Cache in localStorage for page refreshes
      localStorage.setItem('stripe_payment_data', JSON.stringify(stateData));
    } else {
      // Try to restore from localStorage
      const cached = localStorage.getItem('stripe_payment_data');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.clientSecret) {
            setPaymentData(parsed);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached payment data');
        }
      }
      // No valid payment data, redirect back
      navigate('/?step=4');
    }
  }, [location.state, navigate]);

  const handlePaymentSuccess = () => {
    setPaymentStatus('success');
    // Clear cached payment data
    localStorage.removeItem('stripe_payment_data');
    // Redirect to thank you page after animation
    setTimeout(() => {
      navigate('/thank-you?source=stripe');
    }, 2500);
  };

  const handlePaymentError = (error: string) => {
    setPaymentStatus('error');
    console.error('Payment error:', error);
  };

  const handleBack = () => {
    navigate('/?step=4');
  };

  // Map claim limit display values
  const displayClaimLimit = (limit: number) => {
    if (limit === 750) return '£1,000';
    if (limit === 1250) return '£2,000';
    if (limit === 2000) return '£3,000';
    return `£${limit.toLocaleString()}`;
  };

  const savings = paymentData ? paymentData.originalAmount - paymentData.amount : 0;

  if (isLoading || !paymentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading secure checkout...</p>
        </div>
      </div>
    );
  }

  // Success state - full page celebration
  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50/30 flex items-center justify-center p-4">
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-scale-in">
            <CheckCircle className="w-14 h-14 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Payment Successful!</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Your {paymentData.planName} warranty is now active for your {paymentData.vehicleMake} {paymentData.vehicleModel}.
          </p>
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Shield className="w-4 h-4" />
            Protection starts immediately
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting to your confirmation...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <Helmet>
        <title>Secure Payment | BuyAWarranty</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-border sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to checkout</span>
              </button>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Secure checkout</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            
            {/* Left Column - Order Summary */}
            <div className="space-y-6">
              {/* Order Summary Card - matches Step 4 styling */}
              <Card className="bg-white border border-border shadow-sm overflow-hidden">
                <CardContent className="p-5 sm:p-6">
                  {/* Header - same size as Step 4 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <Shield className="w-7 h-7 text-orange-500 fill-orange-100" />
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                        Order Summary
                      </h2>
                    </div>
                  </div>

                  {/* 14-day guarantee banner */}
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5 flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-800">Cancel anytime within 14 days for a full refund</span>
                  </div>

                  {/* Plan Details */}
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground">Plan:</span>
                      <span className="font-semibold text-foreground">{paymentData.planName}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-semibold text-foreground">{paymentData.duration}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground">Vehicle:</span>
                      <span className="font-semibold text-foreground uppercase">
                        {paymentData.vehicleMake} {paymentData.vehicleModel}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground">Registration:</span>
                      <span 
                        className="font-mono font-bold text-xs uppercase px-2 py-1 rounded border-2 border-black tracking-wider"
                        style={{ backgroundColor: '#FCD34D' }}
                      >
                        {paymentData.vehicleReg}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground">Claim Limit:</span>
                      <span className="font-semibold text-foreground">{displayClaimLimit(paymentData.claimLimit)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground">Labour Rate:</span>
                      <span className="font-semibold text-foreground">£{paymentData.labourRate}/hour</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground">Excess:</span>
                      <span className="font-semibold text-foreground">£{paymentData.excess}</span>
                    </div>
                  </div>

                  {/* Payment Type & Price Summary */}
                  <div className="pt-4 border-t border-border space-y-3">
                    {/* Payment Type Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payment type:</span>
                      {paymentData.isMonthly ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                          <CreditCard className="w-3.5 h-3.5" />
                          Monthly (0% APR)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          <Check className="w-3.5 h-3.5" />
                          Pay in Full (Save 10%)
                        </span>
                      )}
                    </div>

                    {/* Monthly Payment Details */}
                    {paymentData.isMonthly && paymentData.monthlyPrice && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-orange-800 font-medium">First payment today</span>
                          <span className="text-xl font-bold text-orange-700">£{paymentData.monthlyPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-orange-600">
                          <span>Then 11 more payments of £{paymentData.monthlyPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-orange-200">
                          <span className="text-muted-foreground">Total (12 payments)</span>
                          <span className="font-semibold text-foreground">£{paymentData.originalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Pay in Full Details */}
                    {!paymentData.isMonthly && savings > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span>Original price</span>
                          <span className="line-through">£{paymentData.originalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-green-600 font-medium">10% discount</span>
                          <span className="text-green-600 font-medium">-£{savings.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Total to Pay */}
                    <div className="flex justify-between items-center pt-3 border-t border-dashed border-border">
                      <span className="text-lg font-bold text-foreground">
                        {paymentData.isMonthly ? 'Pay today' : 'Total to pay'}
                      </span>
                      <span className="text-2xl font-bold text-foreground">
                        £{paymentData.isMonthly && paymentData.monthlyPrice 
                          ? paymentData.monthlyPrice.toFixed(2) 
                          : paymentData.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trust Elements - Grey text */}
              <Card className="bg-white border border-[#DADADA]">
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Check className="w-4 h-4" />
                      <span>Instant cover</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Check className="w-4 h-4" />
                      <span>Easy claims</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Check className="w-4 h-4" />
                      <span>Any garage</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Check className="w-4 h-4" />
                      <span>UK support</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trustpilot */}
              <div className="flex items-center justify-center gap-3 py-4">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-green-500 text-green-500" />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  Excellent on{' '}
                  <a 
                    href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Trustpilot
                  </a>
                </span>
              </div>
            </div>

            {/* Right Column - Payment Form */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              {/* Flat minimal card - white bg, 1px grey border, no shadow */}
              <div className="bg-white border border-[#DADADA] rounded-xl overflow-hidden">
                {/* Flat Header - White bg, green accents */}
                <div className="px-6 py-4 border-b border-[#DADADA] bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Green lock icon - flat, no background */}
                      <Lock className="w-6 h-6" style={{ color: '#0BA360' }} />
                      <div>
                        <h2 className="font-semibold text-foreground text-base" style={{ color: '#0BA360' }}>
                          Secure Payment
                        </h2>
                        <p className="text-xs text-muted-foreground">256-bit SSL encryption</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Powered by</span>
                      <img 
                        src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" 
                        alt="Stripe" 
                        className="h-5"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Form Container */}
                <div className="p-6">
                  {paymentData.clientSecret ? (
                    <StripeProvider clientSecret={paymentData.clientSecret}>
                      <StripePaymentForm
                        amount={paymentData.isMonthly && paymentData.monthlyPrice 
                          ? paymentData.monthlyPrice 
                          : paymentData.amount}
                        isMonthly={paymentData.isMonthly}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        isProcessing={isProcessing}
                        setIsProcessing={setIsProcessing}
                      />
                    </StripeProvider>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#0BA360' }} />
                    </div>
                  )}

                  {/* Flat Green Trust Badges */}
                  <div className="mt-6 pt-5 border-t border-[#DADADA]">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Shield className="w-5 h-5" style={{ color: '#0BA360' }} strokeWidth={1.5} />
                        <span className="text-xs font-medium text-foreground">Instant cover</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="w-5 h-5" style={{ color: '#0BA360' }} strokeWidth={1.5} />
                        <span className="text-xs font-medium text-foreground">14-day refund</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <Lock className="w-5 h-5" style={{ color: '#0BA360' }} strokeWidth={1.5} />
                        <span className="text-xs font-medium text-foreground">Secure checkout</span>
                      </div>
                    </div>
                  </div>

                  {/* Policy Confirmation - Grey subtext */}
                  <div className="mt-4 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" style={{ color: '#0BA360' }} />
                      Your policy is emailed instantly
                    </p>
                  </div>

                  {/* Payment Logos - Greyscale */}
                  <div className="flex items-center justify-center gap-5 mt-5 pt-5 border-t border-[#DADADA]">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4 grayscale opacity-60" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-6 grayscale opacity-60" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-3.5 grayscale opacity-60" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple Pay" className="h-4 opacity-50" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </HelmetProvider>
  );
};

export default StripePayment;