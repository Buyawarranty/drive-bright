import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { StartDatePicker } from '@/components/checkout/StartDatePicker';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { 
  Shield, Car, Clock, CheckCircle, CreditCard, Calendar, 
  Phone, Mail, MessageCircle, AlertCircle, Loader2, Lock,
  Wrench, MapPin, Zap, FileText, Award, Heart, User, Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfDay, format, isToday } from 'date-fns';
import bumperLogo from '@/assets/bumper-logo-transparent.png';
import stripeLogo from '@/assets/stripe-logo.png';

interface QuoteData {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
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
  const [paymentMethod, setPaymentMethod] = useState<'bumper' | 'stripe'>('bumper');

  // Customer form state
  const [customerData, setCustomerData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
    mileage: ''
  });
  const [startDate, setStartDate] = useState<Date | undefined>(startOfDay(new Date()));
  const [showValidation, setShowValidation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  
  // Track which fields are pre-populated (for green tick display)
  const [prePopulatedFields, setPrePopulatedFields] = useState<{[key: string]: boolean}>({});

  const cancelled = searchParams.get('cancelled') === '1';
  const failed = searchParams.get('failed') === '1';

  useEffect(() => {
    if (token) {
      fetchQuote();
    }
  }, [token]);

  // Pre-fill form when quote loads
  useEffect(() => {
    if (quote) {
      const nameParts = quote.customerName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const email = quote.customerEmail || '';
      const phone = quote.customerPhone || '';
      const mileage = quote.vehicle.mileage || '';
      
      setCustomerData(prev => ({
        ...prev,
        firstName,
        lastName,
        email,
        phone,
        mileage
      }));
      
      // Mark pre-populated fields for green tick display
      setPrePopulatedFields({
        firstName: !!firstName,
        lastName: !!lastName,
        email: !!email,
        phone: !!phone,
        mileage: !!mileage
      });
    }
  }, [quote]);

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

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!customerData.firstName.trim()) errors.firstName = 'First name is required';
    if (!customerData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!customerData.email.trim()) errors.email = 'Email is required';
    if (!customerData.phone.trim()) errors.phone = 'Phone is required';
    if (!customerData.addressLine1.trim()) errors.addressLine1 = 'Address is required';
    if (!customerData.city.trim()) errors.city = 'Town/City is required';
    if (!customerData.postcode.trim()) errors.postcode = 'Postcode is required';
    if (!customerData.mileage.trim()) errors.mileage = 'Mileage is required';
    
    // Mileage validation
    const mileage = parseInt(customerData.mileage);
    if (mileage > 150000) {
      errors.mileage = 'Mileage cannot exceed 150,000 miles';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePayment = async (method: 'stripe' | 'bumper') => {
    setShowValidation(true);
    
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      document.getElementById('customer-form')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    try {
      setProcessingPayment(method);
      
      const { data, error: paymentError } = await supabase.functions.invoke('quote-payment', {
        body: { 
          accessToken: token, 
          paymentMethod: method,
          customerData: {
            ...customerData,
            fullName: `${customerData.firstName} ${customerData.lastName}`.trim(),
            startDate: startDate?.toISOString()
          }
        }
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

  // Check if a field is valid (pre-populated or has value)
  const isFieldValid = (fieldName: string) => {
    const value = customerData[fieldName as keyof typeof customerData];
    return prePopulatedFields[fieldName] && value && value.trim() !== '';
  };

  // Mileage dropdown options (10,000 to 140,000 in 1,000 increments)
  const mileageOptions = useMemo(() => {
    return Array.from({ length: 131 }, (_, i) => 10000 + (i * 1000));
  }, []);

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
                <span className="font-medium">{quote.cover.durationMonths} months {quote.cover.bonusMonths > 0 && `(+${quote.cover.bonusMonths} bonus)`}</span>
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
  const bumperMonthlyTotal = quote.pricing.monthlyPrice * 12;

  // Payment Options Component (reusable for both mobile and desktop)
  const PaymentOptionsSection = () => (
    <Card className="border-2 border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-orange-600" />
          Choose How to Pay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={paymentMethod} onValueChange={(value: 'bumper' | 'stripe') => setPaymentMethod(value)}>
          <div className="space-y-4">
            {/* Pay Monthly - Bumper */}
            <div 
              onClick={() => setPaymentMethod('bumper')}
              className={`relative rounded-xl cursor-pointer transition-all duration-300 flex flex-col ${
                paymentMethod === 'bumper' 
                  ? 'shadow-[0_0_15px_rgba(243,156,18,0.4)] border-2 border-orange-500' 
                  : 'border-2 border-gray-200 hover:border-orange-300'
              }`}
              style={{ padding: '20px' }}
            >
              <div className="absolute -top-3 left-4 bg-orange-500 text-white text-xs font-bold rounded-full px-3 py-1">
                0% APR
              </div>

              <div className="flex items-start justify-between mb-3 mt-2">
                <RadioGroupItem value="bumper" id="bumper-option" className="border-2 border-gray-400 w-6 h-6" />
              </div>

              <Label htmlFor="bumper-option" className="block cursor-pointer mb-3">
                <h4 className="text-lg font-bold text-gray-900">Pay Monthly</h4>
              </Label>

              <div className="mb-4">
                <div className="text-sm text-gray-600 font-bold">Total: £{bumperMonthlyTotal}</div>
                <div className="text-2xl font-bold text-gray-900">£{quote.pricing.monthlyPrice}/month</div>
                <div className="text-sm text-gray-600 font-bold">Only 12 payments</div>
              </div>

              <div className="space-y-2 mb-4 flex-grow">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Soft search only</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>No impact on credit score</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>No hidden fees</span>
                </div>
              </div>

              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPaymentMethod('bumper');
                  handlePayment('bumper');
                }}
                disabled={!!processingPayment}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3"
              >
                {processingPayment === 'bumper' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Complete checkout'
                )}
              </Button>

              <div className="text-center pt-3 border-t mt-4">
                <span className="text-xs text-gray-500 block mb-1">Powered by</span>
                <img src={bumperLogo} alt="Bumper" className="h-5 mx-auto" />
              </div>
            </div>

            {/* Pay in Full - Stripe */}
            <div 
              onClick={() => setPaymentMethod('stripe')}
              className={`relative rounded-xl cursor-pointer transition-all duration-300 flex flex-col ${
                paymentMethod === 'stripe' 
                  ? 'shadow-[0_0_15px_rgba(39,174,96,0.4)] border-2 border-green-500' 
                  : 'border-2 border-gray-200 hover:border-green-300'
              }`}
              style={{ padding: '20px' }}
            >
              <div className="absolute -top-3 left-4 bg-green-500 text-white text-xs font-bold rounded-full px-3 py-1">
                BEST VALUE
              </div>

              <div className="flex items-start justify-between mb-3 mt-2">
                <RadioGroupItem value="stripe" id="stripe-option" className="border-2 border-gray-400 w-6 h-6" />
              </div>

              <Label htmlFor="stripe-option" className="block cursor-pointer mb-3">
                <h4 className="text-lg font-bold text-gray-900">Pay in Full</h4>
              </Label>

              <div className="mb-4">
                <div className="text-sm text-gray-600 font-bold line-through">Was: £{bumperMonthlyTotal}</div>
                <div className="text-2xl font-bold text-green-700">£{quote.pricing.upfrontPrice}</div>
                <Badge className="bg-green-100 text-green-800 text-xs mt-1">Save 10%</Badge>
              </div>

              <div className="space-y-2 mb-4 flex-grow">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Instant activation</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>One simple payment</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Best value option</span>
                </div>
              </div>

              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPaymentMethod('stripe');
                  handlePayment('stripe');
                }}
                disabled={!!processingPayment}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
              >
                {processingPayment === 'stripe' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Complete checkout'
                )}
              </Button>

              <div className="text-center pt-3 border-t mt-4">
                <span className="text-xs text-gray-500 block mb-1">Secure payment via</span>
                <img src={stripeLogo} alt="Stripe" className="h-5 mx-auto" />
              </div>
            </div>
          </div>
        </RadioGroup>

        <p className="text-xs text-center text-gray-500 mt-4">
          <Lock className="w-3 h-3 inline mr-1" />
          Your payment is secured with 256-bit SSL encryption
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-[#e8f4fb]">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-orange-600" />
            <span className="font-bold text-xl">BuyaWarranty</span>
          </div>
          <div className="flex items-center gap-3">
            <TrustpilotHeader className="h-6" />
            <Badge variant="secondary" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Secure
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Cancelled/Failed alerts */}
        {cancelled && (
          <Card className="border-orange-200 bg-orange-50 mb-4">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
              <p className="text-sm text-orange-800">Payment was cancelled. You can try again when you're ready.</p>
            </CardContent>
          </Card>
        )}
        {failed && (
          <Card className="border-red-200 bg-red-50 mb-4">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">Payment failed. Please try again or choose a different payment method.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title Section */}
            <div className="text-center lg:text-left">
              <h1 className="text-2xl font-bold text-gray-900">Complete Your Warranty Purchase</h1>
              <p className="text-gray-600 mt-1">Welcome back, {firstName}! Just a few details to complete.</p>
            </div>

            {/* Vehicle Summary Card */}
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

            {/* Cover Summary - Mobile Only (at top) */}
            <div className="lg:hidden">
              <Card className="border-2 border-orange-200">
                <CardHeader className="pb-2 bg-orange-50">
                  <CardTitle className="text-lg">Your Cover Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Cover Details */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan</span>
                      <span className="font-semibold">{quote.cover.planType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-semibold">
                        {quote.cover.durationMonths} months
                        {quote.cover.bonusMonths > 0 && (
                          <Badge className="ml-1 text-xs bg-green-100 text-green-800">+{quote.cover.bonusMonths} FREE</Badge>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Excess</span>
                      <span className="font-semibold">£{quote.cover.excessAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Claim Limit</span>
                      <span className="font-semibold">
                        £{displayClaimLimit.toLocaleString()}
                        {quote.cover.boostAddon && <Badge className="ml-1 text-xs bg-orange-100 text-orange-800">+Boost</Badge>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Labour Rate</span>
                      <span className="font-semibold">£{quote.cover.labourRate}/hr</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Included Features */}
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">What's Included:</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>All mechanical parts</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>All electrical parts</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Labour costs covered</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Any VAT-registered garage</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>No waiting period</span>
                      </div>
                      {quote.cover.breakdownIncluded && (
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Vehicle Recovery (FREE)</span>
                        </div>
                      )}
                      {quote.cover.rentalIncluded && (
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Hire Car Cover (FREE)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Price Summary */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Monthly option</span>
                      <span className="font-semibold">£{quote.pricing.monthlyPrice}/mo</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Pay in full</span>
                      <div className="text-right">
                        <span className="font-bold text-green-700 text-lg">£{quote.pricing.upfrontPrice}</span>
                        <Badge className="ml-2 bg-green-100 text-green-800 text-xs">Save 10%</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Additional Notes */}
                  {quote.additionalNotes && (
                    <>
                      <Separator />
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-orange-800 mb-1">Special Notes:</p>
                        <p className="text-sm text-gray-700">{quote.additionalNotes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Start Date Picker */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <Label className="font-semibold">When should your cover start?</Label>
                </div>
                <StartDatePicker
                  value={startDate}
                  onChange={setStartDate}
                  maxDaysAhead={365}
                />
              </CardContent>
            </Card>

            {/* Customer Details Form */}
            <Card id="customer-form">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-orange-600" />
                  Your Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <div className="relative">
                      <Input
                        id="firstName"
                        value={customerData.firstName}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, firstName: e.target.value }))}
                        className={`pr-10 ${fieldErrors.firstName && showValidation ? 'border-red-500' : isFieldValid('firstName') ? 'border-green-500' : ''}`}
                      />
                      {isFieldValid('firstName') && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {fieldErrors.firstName && showValidation && (
                      <p className="text-xs text-red-500">{fieldErrors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <div className="relative">
                      <Input
                        id="lastName"
                        value={customerData.lastName}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, lastName: e.target.value }))}
                        className={`pr-10 ${fieldErrors.lastName && showValidation ? 'border-red-500' : isFieldValid('lastName') ? 'border-green-500' : ''}`}
                      />
                      {isFieldValid('lastName') && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {fieldErrors.lastName && showValidation && (
                      <p className="text-xs text-red-500">{fieldErrors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Contact Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        value={customerData.email}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                        className={`pr-10 ${fieldErrors.email && showValidation ? 'border-red-500' : isFieldValid('email') ? 'border-green-500' : ''}`}
                      />
                      {isFieldValid('email') && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {fieldErrors.email && showValidation && (
                      <p className="text-xs text-red-500">{fieldErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        type="tel"
                        value={customerData.phone}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                        className={`pr-10 ${fieldErrors.phone && showValidation ? 'border-red-500' : isFieldValid('phone') ? 'border-green-500' : ''}`}
                      />
                      {isFieldValid('phone') && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {fieldErrors.phone && showValidation && (
                      <p className="text-xs text-red-500">{fieldErrors.phone}</p>
                    )}
                  </div>
                </div>

                {/* Mileage with dropdown like Step 4 */}
                <div className="space-y-2">
                  <Label htmlFor="mileage">Current Mileage *</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="mileage"
                        type="text"
                        inputMode="numeric"
                        placeholder="e.g. 52,000"
                        value={customerData.mileage ? Number(customerData.mileage).toLocaleString('en-GB') : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/[^0-9]/g, '');
                          setCustomerData(prev => ({ ...prev, mileage: rawValue }));
                        }}
                        className={`pr-10 ${fieldErrors.mileage && showValidation ? 'border-red-500' : isFieldValid('mileage') ? 'border-green-500' : ''}`}
                      />
                      {isFieldValid('mileage') && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    
                    {/* Quick Select Dropdown */}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setCustomerData(prev => ({ ...prev, mileage: e.target.value }));
                          setPrePopulatedFields(prev => ({ ...prev, mileage: true }));
                        }
                      }}
                      className="h-10 px-3 py-2 rounded-md border border-gray-200 bg-[#F5F5F5] text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                    >
                      <option value="">Quick select</option>
                      {mileageOptions.map(value => (
                        <option key={value} value={value}>
                          {value.toLocaleString('en-GB')}
                        </option>
                      ))}
                    </select>
                  </div>
                  {customerData.mileage && Number(customerData.mileage) > 150000 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                      <p className="text-red-600 text-sm font-medium">
                        Sorry, we only cover vehicles under 150,000 miles.
                      </p>
                    </div>
                  )}
                  {fieldErrors.mileage && showValidation && (
                    <p className="text-xs text-red-500">{fieldErrors.mileage}</p>
                  )}
                </div>

                <Separator />

                {/* Address Section */}
                <div className="space-y-4">
                  <Label className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-orange-600" />
                    Your Address
                  </Label>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine1">Address Line 1 *</Label>
                    <Input
                      id="addressLine1"
                      value={customerData.addressLine1}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, addressLine1: e.target.value }))}
                      className={fieldErrors.addressLine1 && showValidation ? 'border-red-500' : ''}
                    />
                    {fieldErrors.addressLine1 && showValidation && (
                      <p className="text-xs text-red-500">{fieldErrors.addressLine1}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">Address Line 2</Label>
                    <Input
                      id="addressLine2"
                      value={customerData.addressLine2}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, addressLine2: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Town/City *</Label>
                      <Input
                        id="city"
                        value={customerData.city}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, city: e.target.value }))}
                        className={fieldErrors.city && showValidation ? 'border-red-500' : ''}
                      />
                      {fieldErrors.city && showValidation && (
                        <p className="text-xs text-red-500">{fieldErrors.city}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postcodeDisplay">Postcode *</Label>
                      <Input
                        id="postcodeDisplay"
                        value={customerData.postcode}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, postcode: e.target.value.toUpperCase() }))}
                        className={fieldErrors.postcode && showValidation ? 'border-red-500' : ''}
                        placeholder="e.g. SW1A 1AA"
                      />
                      {fieldErrors.postcode && showValidation && (
                        <p className="text-xs text-red-500">{fieldErrors.postcode}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Options - Mobile Only (shows in flow) */}
            <div className="lg:hidden">
              <PaymentOptionsSection />
            </div>
          </div>

          {/* Right Column - Order Summary + Payment Options on Desktop Only */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Cover Summary */}
              <Card className="border-2 border-orange-200">
                <CardHeader className="pb-2 bg-orange-50">
                  <CardTitle className="text-lg">Your Cover Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Cover Details */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan</span>
                      <span className="font-semibold">{quote.cover.planType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-semibold">
                        {quote.cover.durationMonths} months
                        {quote.cover.bonusMonths > 0 && (
                          <Badge className="ml-1 text-xs bg-green-100 text-green-800">+{quote.cover.bonusMonths} FREE</Badge>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Excess</span>
                      <span className="font-semibold">£{quote.cover.excessAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Claim Limit</span>
                      <span className="font-semibold">
                        £{displayClaimLimit.toLocaleString()}
                        {quote.cover.boostAddon && <Badge className="ml-1 text-xs bg-orange-100 text-orange-800">+Boost</Badge>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Labour Rate</span>
                      <span className="font-semibold">£{quote.cover.labourRate}/hr</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Included Features */}
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">What's Included:</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>All mechanical parts</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>All electrical parts</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Labour costs covered</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Any VAT-registered garage</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>No waiting period</span>
                      </div>
                      {quote.cover.breakdownIncluded && (
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Vehicle Recovery (FREE)</span>
                        </div>
                      )}
                      {quote.cover.rentalIncluded && (
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Hire Car Cover (FREE)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Price Summary */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Monthly option</span>
                      <span className="font-semibold">£{quote.pricing.monthlyPrice}/mo</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Pay in full</span>
                      <div className="text-right">
                        <span className="font-bold text-green-700 text-lg">£{quote.pricing.upfrontPrice}</span>
                        <Badge className="ml-2 bg-green-100 text-green-800 text-xs">Save 10%</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Additional Notes */}
                  {quote.additionalNotes && (
                    <>
                      <Separator />
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-orange-800 mb-1">Special Notes:</p>
                        <p className="text-sm text-gray-700">{quote.additionalNotes}</p>
                      </div>
                    </>
                  )}

                  {/* Trust indicators */}
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Lock className="w-3 h-3" />
                      <span>Secure checkout</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Phone className="w-3 h-3" />
                      <span>0330 229 5045</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Options - Desktop Only (below cover summary) */}
              <div className="hidden lg:block">
                <PaymentOptionsSection />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}