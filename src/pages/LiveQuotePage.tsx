import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, Car, Clock, CheckCircle, CreditCard, Calendar, 
  Phone, Mail, MessageCircle, AlertCircle, Loader2, Lock,
  Wrench, MapPin, Zap, FileText, Award, Heart
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuoteData {
  id: string;
  customerName: string;
  customerEmail: string;
  vehicle: {
    reg: string;
    make: string;
    model: string;
    year: string;
    mileage: string;
    fuelType: string;
    transmission: string;
  };
  cover: {
    planType: string;
    durationMonths: number;
    bonusMonths: number;
    excessAmount: number;
    claimLimit: number;
    labourRate: number;
    boostAddon: boolean;
    breakdownIncluded: boolean;
    rentalIncluded: boolean;
  };
  pricing: {
    monthlyPrice: number;
    upfrontPrice: number;
    currency: string;
  };
  additionalNotes: string;
  status: string;
  isExpired: boolean;
  isPaid: boolean;
  policyNumber: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
}

export default function LiveQuotePage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState<'stripe' | 'bumper' | null>(null);

  const cancelled = searchParams.get('cancelled') === '1';
  const failed = searchParams.get('failed') === '1';

  useEffect(() => {
    if (token) {
      fetchQuote();
    }
  }, [token]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase.functions.invoke('get-live-quote', {
        body: { accessToken: token }
      });

      if (fetchError) throw fetchError;
      if (data.error) throw new Error(data.error);

      setQuote(data.quote);
    } catch (err: any) {
      console.error('Error fetching quote:', err);
      setError(err.message || 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (method: 'stripe' | 'bumper') => {
    try {
      setProcessingPayment(method);
      
      const { data, error: paymentError } = await supabase.functions.invoke('quote-payment', {
        body: { accessToken: token, paymentMethod: method }
      });

      if (paymentError) throw paymentError;
      if (data.error) throw new Error(data.error);

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      toast.error(err.message || 'Failed to start payment');
      setProcessingPayment(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your quote...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
            <p className="text-gray-600 mb-6">
              This quote link may have expired or is no longer valid.
            </p>
            <Button onClick={() => window.location.href = 'tel:03302295045'} className="w-full">
              <Phone className="h-4 w-4 mr-2" />
              Call Us for a Fresh Quote
            </Button>
            <p className="text-sm text-gray-500 mt-4">0330 229 5045</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quote.isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <Clock className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Quote Expired</h2>
            <p className="text-gray-600 mb-6">
              This quote has expired. Tap below to request a fresh quote with the same details.
            </p>
            <Button onClick={() => window.location.href = 'tel:03302295045'} className="w-full bg-orange-600 hover:bg-orange-700">
              <Phone className="h-4 w-4 mr-2" />
              Request Fresh Quote
            </Button>
            <p className="text-sm text-gray-500 mt-4">0330 229 5045</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quote.isPaid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-green-200">
          <CardContent className="pt-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Thanks, Your Cover is Active!</h2>
            <p className="text-gray-600 mb-4">
              We've emailed your documents to {quote.customerEmail}
            </p>
            {quote.policyNumber && (
              <p className="text-sm font-medium text-green-700 mb-6">
                Policy Number: {quote.policyNumber}
              </p>
            )}
            <div className="space-y-3 text-left bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Vehicle</span>
                <span className="font-medium">{quote.vehicle.make} {quote.vehicle.model}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cover Duration</span>
                <span className="font-medium">{quote.cover.durationMonths + quote.cover.bonusMonths} months</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Claim Limit</span>
                <span className="font-medium">£{quote.cover.claimLimit.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <p>Need help? Contact us:</p>
              <p className="font-medium">0330 229 5045</p>
              <p>support@buyawarranty.co.uk</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalMonths = quote.cover.durationMonths + quote.cover.bonusMonths;
  const displayClaimLimit = quote.cover.boostAddon ? quote.cover.claimLimit + 1000 : quote.cover.claimLimit;
  const firstName = quote.customerName.split(' ')[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-orange-600" />
            <span className="font-bold text-xl">BuyaWarranty</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Lock className="h-3 w-3 mr-1" />
            Secure
          </Badge>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Cancelled/Failed alerts */}
        {cancelled && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
              <p className="text-sm text-orange-800">Payment was cancelled. You can try again when you're ready.</p>
            </CardContent>
          </Card>
        )}
        {failed && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">Payment failed. Please try again or choose a different payment method.</p>
            </CardContent>
          </Card>
        )}

        {/* Title Section */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Your Vehicle Warranty Quote</h1>
          <p className="text-gray-600">Prepared for {firstName}</p>
        </div>

        {/* Vehicle Card */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 rounded-full p-3">
                <Car className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-lg">{quote.vehicle.make} {quote.vehicle.model}</p>
                <p className="text-gray-600 text-sm">{quote.vehicle.year} • {quote.vehicle.reg}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What You're Getting */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              What You're Getting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {/* Cover Duration */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium">{quote.cover.durationMonths/12}-Year Cover + {quote.cover.bonusMonths} Months Free</p>
                  <p className="text-sm text-gray-600">Total {totalMonths} months of protection</p>
                </div>
              </div>

              {/* Excess */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium">£{quote.cover.excessAmount} Excess</p>
                  <p className="text-sm text-gray-600">The amount you pay towards each approved claim</p>
                </div>
              </div>

              {/* Claim Limit */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Award className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium">£{displayClaimLimit.toLocaleString()} Claim Limit</p>
                  <p className="text-sm text-gray-600">Maximum per claim for parts and labour</p>
                  {quote.cover.boostAddon && (
                    <Badge className="mt-1 bg-orange-100 text-orange-800 text-xs">+£1,000 Boost included</Badge>
                  )}
                </div>
              </div>

              {/* Labour Rate */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Wrench className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium">£{quote.cover.labourRate}/hr Labour Rate</p>
                  <p className="text-sm text-gray-600">Parts and labour covered up to this rate</p>
                </div>
              </div>

              {/* Use Any Garage */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium">Any VAT-Registered Garage</p>
                  <p className="text-sm text-gray-600">Nationwide coverage at your choice of garage</p>
                </div>
              </div>

              {/* Instant Activation */}
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <Zap className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Instant Activation</p>
                  <p className="text-sm text-green-700">No 30-day waiting period. Cover starts when payment completes.</p>
                </div>
              </div>

              {/* Add-ons if included */}
              {(quote.cover.breakdownIncluded || quote.cover.rentalIncluded) && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <Heart className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">Included Add-ons</p>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      {quote.cover.breakdownIncluded && <li>• Breakdown Recovery</li>}
                      {quote.cover.rentalIncluded && <li>• Car Hire Cover</li>}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        {quote.additionalNotes && (
          <Card className="border-orange-200 bg-orange-50/50">
            <CardContent className="py-4">
              <p className="text-sm font-medium text-orange-800 mb-1">Special Notes</p>
              <p className="text-sm text-gray-700">{quote.additionalNotes}</p>
            </CardContent>
          </Card>
        )}

        {/* Price Summary */}
        <Card className="border-2 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Price Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Monthly Option</p>
                <p className="text-sm text-gray-600">12 instalments via Bumper</p>
              </div>
              <p className="text-xl font-bold text-orange-600">£{quote.pricing.monthlyPrice}/mo</p>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <div>
                <p className="font-medium text-green-800">Pay in Full</p>
                <p className="text-sm text-green-700">One-time payment via Stripe</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-green-700">£{quote.pricing.upfrontPrice}</p>
                <Badge className="bg-green-200 text-green-800 text-xs">Save 10%</Badge>
              </div>
            </div>
            <p className="text-sm text-gray-600 text-center italic">
              "Most customers think of it as protection against just one unexpected bill."
            </p>
          </CardContent>
        </Card>

        {/* Why This Makes Sense */}
        <Card className="bg-gray-50 border-0">
          <CardContent className="py-6">
            <h3 className="font-semibold mb-3 text-center">Why This Makes Sense</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Modern car repairs can easily cost £500-£2,000 for a single issue</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>This protects you from unexpected repair bills</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Designed to work when you actually need it</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Payment Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={() => handlePayment('bumper')}
            disabled={!!processingPayment}
            className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
          >
            {processingPayment === 'bumper' ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Calendar className="h-5 w-5 mr-2" />
            )}
            Pay Monthly with Bumper
          </Button>
          <p className="text-xs text-center text-gray-500">Soft credit check by Bumper for eligibility</p>

          <Button 
            onClick={() => handlePayment('stripe')}
            disabled={!!processingPayment}
            variant="outline"
            className="w-full h-14 text-lg border-2 border-green-600 text-green-700 hover:bg-green-50"
          >
            {processingPayment === 'stripe' ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-5 w-5 mr-2" />
            )}
            Pay in Full — £{quote.pricing.upfrontPrice}
          </Button>
          <p className="text-xs text-center text-gray-500">Secure card payment via Stripe</p>
        </div>

        <Separator />

        {/* What Happens Next */}
        <div className="space-y-4 pb-8">
          <h3 className="font-semibold text-center">What Happens Next</h3>
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 rounded-full p-2 flex-shrink-0">
                <Mail className="h-4 w-4 text-orange-600" />
              </div>
              <span>Confirmation email sent immediately</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 rounded-full p-2 flex-shrink-0">
                <Shield className="h-4 w-4 text-orange-600" />
              </div>
              <span>Cover activates instantly</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 rounded-full p-2 flex-shrink-0">
                <Phone className="h-4 w-4 text-orange-600" />
              </div>
              <span>Claims support via phone, email & WhatsApp</span>
            </div>
          </div>

          {/* Contact */}
          <Card className="bg-gray-50 border-0">
            <CardContent className="py-4 text-center">
              <p className="text-sm text-gray-600 mb-2">Questions? We're here to help:</p>
              <p className="font-semibold">0330 229 5045</p>
              <p className="text-sm text-gray-600">support@buyawarranty.co.uk</p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2 text-green-600"
                onClick={() => window.open('https://wa.me/443302295045', '_blank')}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                WhatsApp
              </Button>
            </CardContent>
          </Card>

          {quote.createdByName && (
            <p className="text-xs text-center text-gray-400">
              Quote prepared by {quote.createdByName}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
