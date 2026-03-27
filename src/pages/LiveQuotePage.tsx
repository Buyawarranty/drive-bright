import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import MinimalLandingFooter from '@/components/brand-pages/MinimalLandingFooter';

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
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<{type: string; value: number; label: string} | null>(null);
  const [showPromoField, setShowPromoField] = useState(false);

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
  
  // Track which fields have been touched (blurred) for real-time validation
  const [touchedFields, setTouchedFields] = useState<{[key: string]: boolean}>({});
  
  // Postcode lookup state
  const [isLookingUpPostcode, setIsLookingUpPostcode] = useState(false);
  const [postcodeLookupError, setPostcodeLookupError] = useState<string | null>(null);
  const postcodeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Paid confirmation flow state (must be before early returns)
  const [confirmationStep, setConfirmationStep] = useState<'review' | 'confirmed' | 'flagged'>('review');
  const [flagMessage, setFlagMessage] = useState('');
  const [flagging, setFlagging] = useState(false);
  
  // UK postcode regex for validation
  const postcodeRegexForLookup = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
  
  // Debounced postcode lookup function
  const lookupPostcode = useCallback(async (postcode: string) => {
    const trimmedPostcode = postcode.trim();
    
    // Validate format before lookup
    if (!postcodeRegexForLookup.test(trimmedPostcode)) {
      return;
    }
    
    setIsLookingUpPostcode(true);
    setPostcodeLookupError(null);
    
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmedPostcode)}`);
      const data = await response.json();
      
      if (response.ok && data.status === 200 && data.result) {
        const result = data.result;
        
        // Get the town/city from various possible fields
        const city = result.admin_district || result.parish || result.admin_ward || result.nuts || '';
        
        // Format the postcode properly
        const formattedPostcode = result.postcode || trimmedPostcode.toUpperCase();
        
        setCustomerData(prev => ({
          ...prev,
          city: city,
          postcode: formattedPostcode
        }));
        
        // Mark city as touched so validation shows
        setTouchedFields(prev => ({ ...prev, city: true }));
        
        // Clear any city errors
        setFieldErrors(prev => {
          const { city: _, ...rest } = prev;
          return rest;
        });
        
      } else {
        setPostcodeLookupError('Postcode not found. Please enter your address manually.');
      }
    } catch (error) {
      console.error('Postcode lookup error:', error);
      setPostcodeLookupError('Unable to lookup postcode. Please enter your address manually.');
    } finally {
      setIsLookingUpPostcode(false);
    }
  }, []);
  
  // Handle postcode change with debounce
  const handlePostcodeChange = useCallback((value: string) => {
    const uppercaseValue = value.toUpperCase();
    setCustomerData(prev => ({ ...prev, postcode: uppercaseValue }));
    setPostcodeLookupError(null);
    
    // Clear existing timeout
    if (postcodeDebounceRef.current) {
      clearTimeout(postcodeDebounceRef.current);
    }
    
    // Only trigger lookup if postcode looks valid (has enough characters)
    if (uppercaseValue.length >= 5 && postcodeRegexForLookup.test(uppercaseValue.trim())) {
      postcodeDebounceRef.current = setTimeout(() => {
        lookupPostcode(uppercaseValue);
      }, 300);
    }
  }, [lookupPostcode]);
  
  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (postcodeDebounceRef.current) {
        clearTimeout(postcodeDebounceRef.current);
      }
    };
  }, []);

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
    
    // Same validation patterns as Step 4 (CustomerDetailsStep.tsx)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // UK phone number validation (landline and mobile)
    const phoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?1\d{3}|\(?01\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?2\d{2}|\(?02\d{2}\)?)\s?\d{3}\s?\d{4}$/;
    
    // UK postcode validation
    const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    
    // First name validation
    if (!customerData.firstName.trim()) {
      errors.firstName = 'Please enter your first name.';
    } else if (customerData.firstName.trim().length < 2) {
      errors.firstName = 'Please enter your first name.';
    }
    
    // Last name validation
    if (!customerData.lastName.trim()) {
      errors.lastName = 'Please enter your last name.';
    } else if (customerData.lastName.trim().length < 2) {
      errors.lastName = 'Please enter your last name.';
    }
    
    // Email validation
    if (!customerData.email.trim()) {
      errors.email = 'Please enter your email address.';
    } else if (!emailRegex.test(customerData.email)) {
      errors.email = 'Please enter a valid email address.';
    }
    
    // Phone validation (UK format)
    if (!customerData.phone.trim()) {
      errors.phone = 'Enter a phone number.';
    } else if (!phoneRegex.test(customerData.phone)) {
      errors.phone = 'Enter a valid UK phone number.';
    }
    
    // Address validation
    if (!customerData.addressLine1.trim()) {
      errors.addressLine1 = 'Enter your street address.';
    } else if (customerData.addressLine1.trim().length < 3) {
      errors.addressLine1 = 'Enter your street address.';
    }
    
    // City validation
    if (!customerData.city.trim()) {
      errors.city = 'Enter your city or town.';
    } else if (customerData.city.trim().length < 2) {
      errors.city = 'Enter your city or town.';
    }
    
    // Postcode validation (UK format)
    if (!customerData.postcode.trim()) {
      errors.postcode = 'Enter your postcode.';
    } else if (!postcodeRegex.test(customerData.postcode)) {
      errors.postcode = 'Enter a valid UK postcode.';
    }
    
    // Mileage validation
    if (!customerData.mileage.trim()) {
      errors.mileage = 'Please confirm the current mileage.';
    } else {
      const mileage = parseInt(customerData.mileage);
      if (mileage > 150000) {
        errors.mileage = 'Sorry, we only cover vehicles under 150,000 miles.';
      }
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
          discountCode: promoApplied ? promoCode.trim().toUpperCase() : undefined,
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

  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setValidatingPromo(true);
    setPromoError('');
    try {
      const orderAmount = quote?.pricing.upfrontPrice || 0;
      const { data, error: fnError } = await supabase.functions.invoke('validate-discount-code', {
        body: { code, orderAmount }
      });
      if (fnError) throw fnError;
      if (data?.valid) {
        setPromoApplied(true);
        setPromoDiscount({
          type: data.discount_type,
          value: data.discount_value,
          label: data.discount_type === 'percentage' ? `${data.discount_value}% off` : `£${data.discount_value} off`
        });
        toast.success(`Promo code applied: ${data.discount_type === 'percentage' ? data.discount_value + '% off' : '£' + data.discount_value + ' off'}`);
      } else {
        setPromoError(data?.error || 'Invalid promo code');
        setPromoApplied(false);
        setPromoDiscount(null);
      }
    } catch (err: any) {
      setPromoError('Unable to validate code');
      setPromoApplied(false);
      setPromoDiscount(null);
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode('');
    setPromoApplied(false);
    setPromoError('');
    setPromoDiscount(null);
  };

  // Validation patterns (same as validateForm)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?1\d{3}|\(?01\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?2\d{2}|\(?02\d{2}\)?)\s?\d{3}\s?\d{4}$/;
  const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

  // Validate a single field
  const validateField = (fieldName: string, value: string): string | null => {
    switch (fieldName) {
      case 'firstName':
        if (!value.trim()) return 'Please enter your first name.';
        if (value.trim().length < 2) return 'Please enter your first name.';
        return null;
      case 'lastName':
        if (!value.trim()) return 'Please enter your last name.';
        if (value.trim().length < 2) return 'Please enter your last name.';
        return null;
      case 'email':
        if (!value.trim()) return 'Please enter your email address.';
        if (!emailRegex.test(value)) return 'Please enter a valid email address.';
        return null;
      case 'phone':
        if (!value.trim()) return 'Enter a phone number.';
        if (!phoneRegex.test(value)) return 'Enter a valid UK phone number.';
        return null;
      case 'addressLine1':
        if (!value.trim()) return 'Enter your street address.';
        if (value.trim().length < 3) return 'Enter your street address.';
        return null;
      case 'city':
        if (!value.trim()) return 'Enter your city or town.';
        if (value.trim().length < 2) return 'Enter your city or town.';
        return null;
      case 'postcode':
        if (!value.trim()) return 'Enter your postcode.';
        if (!postcodeRegex.test(value)) return 'Enter a valid UK postcode.';
        return null;
      case 'mileage':
        if (!value.trim()) return 'Please confirm the current mileage.';
        const mileage = parseInt(value);
        if (mileage > 150000) return 'Sorry, we only cover vehicles under 150,000 miles.';
        return null;
      default:
        return null;
    }
  };

  // Handle field blur for real-time validation
  const handleFieldBlur = (fieldName: string) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
    const value = customerData[fieldName as keyof typeof customerData];
    const error = validateField(fieldName, value);
    setFieldErrors(prev => {
      if (error) {
        return { ...prev, [fieldName]: error };
      } else {
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      }
    });
  };

  // Check if a field is valid (pre-populated with value OR user-filled and passes validation)
  const isFieldValid = (fieldName: string) => {
    const value = customerData[fieldName as keyof typeof customerData];
    if (!value || value.trim() === '') return false;
    
    // If pre-populated, check it still has value
    if (prePopulatedFields[fieldName]) {
      return validateField(fieldName, value) === null;
    }
    
    // If touched by user and passes validation
    if (touchedFields[fieldName]) {
      return validateField(fieldName, value) === null;
    }
    
    return false;
  };

  // Check if we should show error for a field
  const shouldShowError = (fieldName: string) => {
    return (touchedFields[fieldName] || showValidation) && fieldErrors[fieldName];
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



  const handleFlagDetails = async () => {
    setFlagging(true);
    try {
      await supabase.functions.invoke('flag-quote-details', {
        body: {
          quoteId: quote.id,
          customerName: quote.customerName,
          customerEmail: quote.customerEmail,
          vehicleReg: quote.vehicle.reg,
          issueMessage: flagMessage || 'Customer flagged details as incorrect',
        }
      });
      setConfirmationStep('flagged');
    } catch (err) {
      console.error('Error flagging details:', err);
      toast.error('Failed to report issue. Please call us on 0330 229 5045.');
    } finally {
      setFlagging(false);
    }
  };

  const handleConfirmDetails = () => {
    setConfirmationStep('confirmed');
  };

  if (quote.isPaid) {
    // Step: Customer flagged details as incorrect — show thank you + we'll fix it
    if (confirmationStep === 'flagged') {
      return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-orange-200">
            <CardContent className="pt-8 text-center">
              <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Thank You for Letting Us Know</h2>
              <p className="text-gray-600 mb-4">
                Our team has been notified and will review your details as soon as possible. 
                A member of our team will be in touch shortly.
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-orange-800">
                  <strong>Reference:</strong> {quote.vehicle.reg}
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  We've sent an alert to our sales team. No further action is needed from you right now.
                </p>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Need urgent help? Contact us:</p>
                <p className="font-medium">0330 229 5045</p>
                <p>support@buyawarranty.co.uk</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Step: Customer confirmed — show standard thank you (no policy yet, pending agent review)
    if (confirmationStep === 'confirmed') {
      return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-green-200">
            <CardContent className="pt-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Thank You! Payment Received</h2>
              <p className="text-gray-600 mb-4">
                Your warranty details are being processed. You'll receive your policy documents via email shortly.
              </p>
              <div className="space-y-3 text-left bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Vehicle</span>
                  <span className="font-medium">{quote.vehicle.make} {quote.vehicle.model}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Registration</span>
                  <span className="font-medium">{quote.vehicle.reg}</span>
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

    // Step: Review — customer must confirm or flag details
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-lg w-full border-blue-200">
          <CardContent className="pt-8">
            <div className="text-center mb-6">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold mb-1">Payment Received — Thank You!</h2>
              <p className="text-gray-600 text-sm">
                Please review your warranty details below and confirm everything is correct.
              </p>
            </div>

            <div className="space-y-3 bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-sm text-gray-800 border-b pb-2">Your Warranty Details</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Name</span>
                <span className="font-medium">{quote.customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Email</span>
                <span className="font-medium">{quote.customerEmail}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Vehicle</span>
                <span className="font-medium">{quote.vehicle.make} {quote.vehicle.model} ({quote.vehicle.year})</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Registration</span>
                <span className="font-medium font-mono">{quote.vehicle.reg}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Mileage</span>
                <span className="font-medium">{quote.vehicle.mileage ? `${Number(quote.vehicle.mileage).toLocaleString()} miles` : 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cover Duration</span>
                <span className="font-medium">
                  {quote.cover.durationMonths} months
                  {quote.cover.bonusMonths > 0 && ` (+${quote.cover.bonusMonths} FREE)`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Claim Limit</span>
                <span className="font-medium">£{quote.cover.claimLimit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Labour Rate</span>
                <span className="font-medium">£{quote.cover.labourRate}/hr</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Excess</span>
                <span className="font-medium">£{quote.cover.excessAmount}</span>
              </div>
              {quote.cover.boostAddon && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Boost Add-on</span>
                  <span className="font-medium text-green-700">Included ✓</span>
                </div>
              )}
              {quote.cover.breakdownIncluded && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Vehicle Recovery</span>
                  <span className="font-medium text-green-700">Included ✓</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleConfirmDetails}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-5 text-base font-bold"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                All Details Are Correct — Confirm
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400">or</span>
                </div>
              </div>

              <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <p className="text-sm font-medium text-orange-800 mb-2">
                  Something not right? Let us know:
                </p>
                <textarea
                  className="w-full border border-orange-300 rounded-md p-2 text-sm mb-3 bg-white"
                  placeholder="Please describe what's incorrect (e.g., wrong name, wrong mileage, etc.)"
                  rows={3}
                  value={flagMessage}
                  onChange={(e) => setFlagMessage(e.target.value)}
                />
                <Button
                  onClick={handleFlagDetails}
                  disabled={flagging}
                  variant="outline"
                  className="w-full border-orange-400 text-orange-700 hover:bg-orange-100"
                >
                  {flagging ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                  ) : (
                    <><AlertCircle className="w-4 h-4 mr-2" /> My Details Are Incorrect</>
                  )}
                </Button>
              </div>
            </div>

            <div className="text-center mt-4 text-sm text-gray-500 space-y-1">
              <p>Need help? Call us: <strong>0330 229 5045</strong></p>
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

  // Payment Options Component
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly Card */}
            <div className="relative">
              <div className="absolute -top-3 left-4 z-10">
                <span className="bg-[#FF6B00] text-white text-xs font-bold px-2.5 py-1 rounded-md whitespace-nowrap">
                  0% APR
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentMethod('bumper')}
                className={`w-full h-full text-left rounded-xl p-4 sm:p-5 border-2 transition-all ${
                  paymentMethod === 'bumper'
                    ? 'border-[#FF6B00] bg-white'
                    : 'border-[#E5E5E5] bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                      <span className="text-sm font-semibold text-[#1a1a1a]">
                        Platinum {Math.round(quote.cover.durationMonths / 12)}-Year Cover
                      </span>
                    </div>
                    <p className="text-base font-bold text-[#1a1a1a]">Monthly</p>
                    <p className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] mt-1">
                      £{quote.pricing.monthlyPrice}<span className="text-base font-normal text-gray-600">/mo</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Total £{bumperMonthlyTotal}</p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                        <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                        <span>No credit impact</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                        <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                        <span>12 payments only</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                        <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                        <span>0% APR</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <img src={bumperLogo} alt="Bumper" className="h-6 object-contain" />
                    </div>
                  </div>
                  <div className={`w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === 'bumper' ? 'bg-[#FF6B00] border-[#FF6B00]' : 'border-gray-300 bg-white'
                  }`}>
                    {paymentMethod === 'bumper' && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
              </button>
            </div>

            {/* Pay in Full Card */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPaymentMethod('stripe')}
                className={`w-full h-full text-left rounded-xl p-4 sm:p-5 border-2 transition-all ${
                  paymentMethod === 'stripe' ? 'border-[#0BA360] bg-white' : 'border-[#E5E5E5] bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                      <span className="text-sm font-semibold text-[#1a1a1a]">
                        Platinum {Math.round(quote.cover.durationMonths / 12)}-Year Cover
                      </span>
                    </div>
                    <p className="text-base font-bold text-[#1a1a1a]">Pay in Full</p>
                    <p className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] mt-1">
                      £{quote.pricing.upfrontPrice}
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                        <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                        <span>One simple payment</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                        <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                        <span>No ongoing payments</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-[#635BFF] font-semibold text-sm">stripe</span>
                    </div>
                  </div>
                  <div className={`w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === 'stripe' ? 'bg-[#0BA360] border-[#0BA360]' : 'border-gray-300 bg-white'
                  }`}>
                    {paymentMethod === 'stripe' && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </RadioGroup>

        {/* Promo Code Section */}
        <div className="mt-4">
          {!showPromoField && !promoApplied ? (
            <button
              type="button"
              onClick={() => setShowPromoField(true)}
              className="text-sm text-[#FF6B00] hover:text-[#e56000] font-medium underline underline-offset-2"
            >
              Have a promo code?
            </button>
          ) : promoApplied && promoDiscount ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {promoCode.toUpperCase()} — {promoDiscount.label}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemovePromo}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                  placeholder="Enter promo code"
                  className="flex-1 h-11 uppercase font-medium"
                  disabled={validatingPromo}
                />
                <Button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={validatingPromo || !promoCode.trim()}
                  variant="outline"
                  className="h-11 px-5 border-[#FF6B00] text-[#FF6B00] hover:bg-orange-50 font-semibold"
                >
                  {validatingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
              {promoError && (
                <p className="text-xs text-red-500">{promoError}</p>
              )}
            </div>
          )}
        </div>

        {/* CTA Button */}
        <div className="mt-6">
          <Button
            type="button"
            onClick={() => { if (paymentMethod) handlePayment(paymentMethod); }}
            disabled={!!processingPayment || !paymentMethod}
            className={`w-full py-6 text-lg font-bold rounded-xl hover:opacity-90 ${
              !paymentMethod ? 'bg-gray-400'
                : paymentMethod === 'stripe' ? 'bg-[#0BA360] hover:bg-[#099355]'
                : 'bg-[#FF6B00] hover:bg-[#e56000]'
            }`}
            style={{ color: '#FFFFFF' }}
          >
            {processingPayment ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                {paymentMethod === 'bumper'
                  ? `Pay £${quote.pricing.monthlyPrice} today`
                  : paymentMethod === 'stripe'
                  ? `Pay £${quote.pricing.upfrontPrice} now`
                  : 'Select payment option'}
              </span>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-600">
          <Lock className="w-4 h-4 text-gray-400" />
          <span>Secure checkout processing</span>
        </div>
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
            <a
              href="tel:03302295045"
              className="inline-flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#e56000] text-white font-bold text-sm px-3 py-2 rounded-lg transition-colors"
            >
              <Phone className="h-4 w-4" />
              0330 229 5045
            </a>
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
                      <span className="text-gray-600">Mileage</span>
                      <span className="font-semibold">{quote.vehicle.mileage?.toLocaleString()} miles</span>
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
                {/* Email - Pre-populated from quote */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={customerData.email}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                      onBlur={() => handleFieldBlur('email')}
                      className={`pr-10 ${shouldShowError('email') ? 'border-red-500' : isFieldValid('email') ? 'border-green-500' : ''}`}
                    />
                    {isFieldValid('email') && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                    )}
                  </div>
                  {shouldShowError('email') && (
                    <p className="text-xs text-red-500">{fieldErrors.email}</p>
                  )}
                </div>

                {/* Phone - Pre-populated from quote */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <div className="relative">
                    <Input
                      id="phone"
                      type="tel"
                      value={customerData.phone}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                      onBlur={() => handleFieldBlur('phone')}
                      className={`pr-10 ${shouldShowError('phone') ? 'border-red-500' : isFieldValid('phone') ? 'border-green-500' : ''}`}
                    />
                    {isFieldValid('phone') && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                    )}
                  </div>
                  {shouldShowError('phone') && (
                    <p className="text-xs text-red-500">{fieldErrors.phone}</p>
                  )}
                </div>

                {/* Name Row - Pre-populated from quote */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <div className="relative">
                      <Input
                        id="firstName"
                        value={customerData.firstName}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, firstName: e.target.value }))}
                        onBlur={() => handleFieldBlur('firstName')}
                        className={`pr-10 ${shouldShowError('firstName') ? 'border-red-500' : isFieldValid('firstName') ? 'border-green-500' : ''}`}
                      />
                      {isFieldValid('firstName') && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {shouldShowError('firstName') && (
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
                        onBlur={() => handleFieldBlur('lastName')}
                        className={`pr-10 ${shouldShowError('lastName') ? 'border-red-500' : isFieldValid('lastName') ? 'border-green-500' : ''}`}
                      />
                      {isFieldValid('lastName') && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {shouldShowError('lastName') && (
                      <p className="text-xs text-red-500">{fieldErrors.lastName}</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Address Section - Postcode First */}
                <div className="space-y-4">
                  <Label className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-orange-600" />
                    Your Address
                  </Label>

                  {/* Postcode with auto-lookup */}
                  <div className="space-y-2">
                    <Label htmlFor="postcodeDisplay" className="flex items-center gap-2">
                      Postcode *
                      {isLookingUpPostcode && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Looking up...
                        </span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        id="postcodeDisplay"
                        value={customerData.postcode}
                        onChange={(e) => handlePostcodeChange(e.target.value)}
                        onBlur={() => {
                          handleFieldBlur('postcode');
                          // Trigger lookup on blur if valid format
                          if (postcodeRegexForLookup.test(customerData.postcode.trim()) && !customerData.city) {
                            lookupPostcode(customerData.postcode);
                          }
                        }}
                        className={`pr-10 ${shouldShowError('postcode') ? 'border-red-500' : isFieldValid('postcode') ? 'border-green-500' : ''}`}
                        placeholder="e.g. SW1A 1AA"
                      />
                      {isLookingUpPostcode ? (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500 animate-spin" />
                      ) : isFieldValid('postcode') ? (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      ) : null}
                    </div>
                    {shouldShowError('postcode') && (
                      <p className="text-xs text-red-500">{fieldErrors.postcode}</p>
                    )}
                    {postcodeLookupError && !shouldShowError('postcode') && (
                      <p className="text-xs text-amber-600">{postcodeLookupError}</p>
                    )}
                    {!isLookingUpPostcode && isFieldValid('postcode') && customerData.city && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Address details auto-filled
                      </p>
                    )}
                  </div>

                  {/* Address Line 1 */}
                  <div className="space-y-2">
                    <Label htmlFor="addressLine1">Address Line 1 *</Label>
                    <div className="relative">
                      <Input
                        id="addressLine1"
                        value={customerData.addressLine1}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, addressLine1: e.target.value }))}
                        onBlur={() => handleFieldBlur('addressLine1')}
                        className={`pr-10 ${shouldShowError('addressLine1') ? 'border-red-500' : isFieldValid('addressLine1') ? 'border-green-500' : ''}`}
                      />
                      {isFieldValid('addressLine1') && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {shouldShowError('addressLine1') && (
                      <p className="text-xs text-red-500">{fieldErrors.addressLine1}</p>
                    )}
                  </div>

                  {/* Address Line 2 */}
                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">Address Line 2</Label>
                    <Input
                      id="addressLine2"
                      value={customerData.addressLine2}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, addressLine2: e.target.value }))}
                    />
                  </div>

                  {/* Town/City */}
                  <div className="space-y-2">
                    <Label htmlFor="city">Town/City *</Label>
                    <div className="relative">
                      <Input
                        id="city"
                        value={customerData.city}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, city: e.target.value }))}
                        onBlur={() => handleFieldBlur('city')}
                        className={`pr-10 ${shouldShowError('city') ? 'border-red-500' : isFieldValid('city') ? 'border-green-500' : ''}`}
                      />
                      {isFieldValid('city') && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {shouldShowError('city') && (
                      <p className="text-xs text-red-500">{fieldErrors.city}</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Mileage - Last */}
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
                        onBlur={() => handleFieldBlur('mileage')}
                        className={`pr-10 ${shouldShowError('mileage') ? 'border-red-500' : isFieldValid('mileage') ? 'border-green-500' : ''}`}
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
                          setTouchedFields(prev => ({ ...prev, mileage: true }));
                          // Clear any mileage error when selecting from dropdown
                          const error = validateField('mileage', e.target.value);
                          setFieldErrors(prev => {
                            if (error) {
                              return { ...prev, mileage: error };
                            } else {
                              const { mileage: _, ...rest } = prev;
                              return rest;
                            }
                          });
                        }
                      }}
                      className="h-10 px-3 py-2 rounded-md border border-gray-200 bg-[#F5F5F5] text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
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
                  {shouldShowError('mileage') && (
                    <p className="text-xs text-red-500">{fieldErrors.mileage}</p>
                  )}
                </div>

              </CardContent>
            </Card>

            {/* Payment Options - Below form on all screen sizes */}
            <div id="payment-options">
              <PaymentOptionsSection />
            </div>
          </div>

          {/* Right Column - Cover Summary (Desktop Only) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <Card className="border-2 border-orange-200">
                <CardHeader className="pb-2 bg-orange-50">
                  <CardTitle className="text-lg">Your Cover Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan</span>
                      <span className="font-semibold">{quote.cover.planType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mileage</span>
                      <span className="font-semibold">{quote.vehicle.mileage?.toLocaleString()} miles</span>
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

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Monthly option</span>
                      <span className="font-semibold">£{quote.pricing.monthlyPrice}/mo</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Pay in full</span>
                      <div className="text-right">
                        <span className="font-bold text-green-700 text-lg">£{quote.pricing.upfrontPrice}</span>
                      </div>
                    </div>
                  </div>

                  {quote.additionalNotes && (
                    <>
                      <Separator />
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-orange-800 mb-1">Special Notes:</p>
                        <p className="text-sm text-gray-700">{quote.additionalNotes}</p>
                      </div>
                    </>
                  )}

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
            </div>
          </div>
        </div>
      </main>

      {/* Desktop Sticky Bottom Bar */}
      <div className="hidden lg:block fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-gray-600">Monthly</p>
              <p className="text-xl font-bold text-[#1a1a1a]">£{quote.pricing.monthlyPrice}/mo <span className="text-sm font-normal text-gray-500">0% APR</span></p>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div>
              <p className="text-sm text-gray-600">Pay in Full</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-[#1a1a1a]">£{quote.pricing.upfrontPrice}</span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => document.getElementById('payment-options')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-[#FF6B00] hover:bg-[#e56000] text-white font-bold px-8 py-3 text-base rounded-xl"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Choose Payment Option
          </Button>
        </div>
      </div>
      {/* Spacer for sticky bar on desktop */}
      <div className="hidden lg:block h-20" />
      <MinimalLandingFooter />
    </div>
  );
}