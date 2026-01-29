import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Check, Lock, Star, ArrowLeft, Car, Clock, CreditCard, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { StripePaymentForm } from '@/components/stripe/StripePaymentForm';
import { HelmetProvider, Helmet } from 'react-helmet-async';

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
}

const StripePayment: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
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
              {/* Plan Header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Complete Your Purchase</h1>
                  <p className="text-muted-foreground">Secure one-time payment</p>
                </div>
              </div>

              {/* Order Summary Card */}
              <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 to-orange-50 px-6 py-4 border-b border-border">
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Order Summary
                  </h2>
                </div>
                <CardContent className="p-6 space-y-5">
                  {/* Vehicle Info */}
                  <div className="flex items-center gap-4 pb-5 border-b border-border">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Car className="w-6 h-6 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground text-lg">
                        {paymentData.vehicleMake} {paymentData.vehicleModel}
                      </p>
                      <span 
                        className="inline-block font-mono font-bold text-xs uppercase tracking-wider px-2 py-1 rounded border-2 border-black mt-1"
                        style={{ backgroundColor: '#FCD34D' }}
                      >
                        {paymentData.vehicleReg}
                      </span>
                    </div>
                  </div>

                  {/* Plan Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-semibold text-foreground">{paymentData.planName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-semibold text-foreground">{paymentData.duration}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Claim Limit</span>
                      <span className="font-semibold text-foreground">{displayClaimLimit(paymentData.claimLimit)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Labour Rate</span>
                      <span className="font-semibold text-foreground">£{paymentData.labourRate}/hour</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Excess</span>
                      <span className="font-semibold text-foreground">£{paymentData.excess}</span>
                    </div>
                  </div>

                  {/* Price Summary */}
                  <div className="pt-5 border-t border-border space-y-3">
                    {savings > 0 && (
                      <>
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span>Original price</span>
                          <span className="line-through">£{paymentData.originalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-green-600 font-medium">10% discount</span>
                          <span className="text-green-600 font-medium">-£{savings.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-dashed border-border">
                      <span className="text-lg font-bold text-foreground">Total to pay</span>
                      <span className="text-2xl font-bold text-foreground">£{paymentData.amount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trust Elements */}
              <Card className="bg-green-50/50 border-green-200">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">14-day money-back guarantee</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-green-700">
                      <Shield className="w-4 h-4" />
                      <span>Instant cover</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <Clock className="w-4 h-4" />
                      <span>24hr claims</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <Check className="w-4 h-4" />
                      <span>Any garage</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
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
              <Card className="border-2 border-slate-200 shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-green-400" />
                      <div>
                        <h2 className="font-bold text-white">Payment Details</h2>
                        <p className="text-sm text-slate-300">256-bit SSL encryption</p>
                      </div>
                    </div>
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" 
                      alt="Stripe" 
                      className="h-6 opacity-80"
                    />
                  </div>
                </div>
                <CardContent className="p-6 sm:p-8">
                  {paymentData.clientSecret ? (
                    <StripeProvider clientSecret={paymentData.clientSecret}>
                      <StripePaymentForm
                        amount={paymentData.amount}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        isProcessing={isProcessing}
                        setIsProcessing={setIsProcessing}
                      />
                    </StripeProvider>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  )}

                  {/* Additional Security Info */}
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Secure</span>
                      </div>
                      <div className="w-px h-3 bg-border" />
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>PCI Compliant</span>
                      </div>
                      <div className="w-px h-3 bg-border" />
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Verified</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Icons */}
              <div className="flex items-center justify-center gap-3 mt-6 opacity-60">
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-6" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-8" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-5" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple Pay" className="h-5" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </HelmetProvider>
  );
};

export default StripePayment;