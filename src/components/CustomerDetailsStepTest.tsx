import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/protected-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CheckCircle, Edit, User, CreditCard, MapPin, X, ArrowUp, Check, ArrowRight, Lock, Car, Mail, ChevronDown } from 'lucide-react';
import { PostcodeAutocomplete } from '@/components/ui/uk-postcode-autocomplete';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { trackFormSubmission, trackEvent, trackStripeCheckoutClick, trackStripeCheckoutPageLoad, trackStep4EmailEntry } from '@/utils/analytics';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { getAddOnInfo, isAddOnAutoIncluded, normalizePaymentType, calculateAddOnPrice } from '@/lib/addOnsUtils';
import { EmailCapturePopup } from '@/components/EmailCapturePopup';
import MobileNavigation from '@/components/MobileNavigation';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import stripeLogo from '@/assets/stripe-logo.png';
import { StartDatePicker } from '@/components/checkout/StartDatePicker';
import { getTrackingData } from '@/utils/gclidCapture';

import { startOfDay, format, isToday } from 'date-fns';

// Payment Assist logo placeholder - replace with actual logo
const paymentAssistLogo = "https://via.placeholder.com/120x30?text=Payment+Assist";

export interface CustomerDetailsStepTestProps {
  vehicleData: {
    regNumber: string;
    make: string;
    model?: string;
    year?: string;
    fuelType?: string;
    mileage: string;
    engineSize?: string;
    bodyType?: string;
    colour?: string;
    transmission?: string;
    dateOfRegistration?: string;
    found?: boolean;
    error?: string;
    isManualEntry?: boolean;
  };
  planId: string;
  paymentType: string;
  planName: string;
  pricingData: {
    basePrice: number;
    totalPrice: number;
    voluntaryExcess?: number;
    claimLimit?: number;
    labourRate?: number;
    boostAddon?: boolean;
    protectionAddOns?: {
      breakdown?: boolean;
      motFee?: boolean;
      motRepair?: boolean;
      wearTear?: boolean;
      wearAndTear?: boolean;
      tyre?: boolean;
      european?: boolean;
      rental?: boolean;
      transfer?: boolean;
    };
    installmentBreakdown?: {
      upfrontInstallment: number;
      monthlyInstallment: number;
      standardInstallment: number;
      hasTransfer: boolean;
      transferAmount: number;
    };
  };
  onBack: () => void;
  onNext: (customerData: any) => void;
}

const CustomerDetailsStepTest: React.FC<CustomerDetailsStepTestProps> = ({ 
  vehicleData, 
  planId, 
  paymentType, 
  planName, 
  pricingData, 
  onBack, 
  onNext 
}) => {
  console.log('🏗️ CustomerDetailsStepTest mounted (Payment Assist Test)');
  
  const [customerData, setCustomerData] = useState(() => {
    try {
      const savedCustomerData = localStorage.getItem('buyawarranty_customerData');
      if (savedCustomerData) {
        return JSON.parse(savedCustomerData);
      }
    } catch (error) {
      console.error('❌ Error restoring customer data:', error);
    }
    return {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      postcode: '',
      date_of_birth: '',
      mileage: '',
      marketing_opt_in: false,
      privacy_policy_accepted: false,
      terms_conditions_accepted: false,
      contact_method: 'email' as 'email' | 'phone'
    };
  });

  // Changed default to 'payment-assist' instead of 'bumper'
  const [paymentMethod, setPaymentMethod] = useState<'payment-assist' | 'stripe'>('payment-assist');
  
  const [showValidation, setShowValidation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [addAnotherWarrantyRequested, setAddAnotherWarrantyRequested] = useState(false);
  const [appliedDiscountCodes, setAppliedDiscountCodes] = useState<Array<{
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    discountAmount: number;
  }>>([]);
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [promoCodeError, setPromoCodeError] = useState<string>('');
  const [isValidatingPromoCode, setIsValidatingPromoCode] = useState(false);
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const { user } = useAuth();
  
  const [originalPricingData] = useState(() => {
    try {
      const savedOriginalPrice = localStorage.getItem('buyawarranty_originalPricingData');
      if (savedOriginalPrice) {
        return JSON.parse(savedOriginalPrice);
      }
    } catch (error) {
      console.error('❌ Error restoring original pricing data:', error);
    }
    localStorage.setItem('buyawarranty_originalPricingData', JSON.stringify(pricingData));
    return pricingData;
  });
  
  const [updatedPricingData, setUpdatedPricingData] = useState(() => {
    try {
      const savedOriginalPrice = localStorage.getItem('buyawarranty_originalPricingData');
      if (savedOriginalPrice) {
        return JSON.parse(savedOriginalPrice);
      }
    } catch (error) {
      console.error('❌ Error restoring pricing data:', error);
    }
    return pricingData;
  });
  
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);
  const [isLoadingPaymentAssist, setIsLoadingPaymentAssist] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [seasonalOfferClaimed, setSeasonalOfferClaimed] = useState(false);
  const [validatedFields, setValidatedFields] = useState<{[key: string]: boolean}>({});
  
  // Refs to prevent state updates from interrupting async flows
  const isProcessingRef = React.useRef(false);
  
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    try {
      const savedStartDate = localStorage.getItem('buyawarranty_startDate');
      if (savedStartDate) {
        return new Date(savedStartDate);
      }
    } catch (error) {
      console.error('Error restoring start date:', error);
    }
    return startOfDay(new Date());
  });
  const [startDateError, setStartDateError] = useState<string>('');

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const claimed = localStorage.getItem('seasonal_offer_claimed');
    setSeasonalOfferClaimed(claimed === 'true');
  }, []);

  useEffect(() => {
    setIsLoadingPayment(false);
    setIsLoadingStripe(false);
    setIsLoadingPaymentAssist(false);
  }, []);

  useEffect(() => {
    trackStripeCheckoutPageLoad();
  }, []);

  // Calculate pricing
  const monthlyPrice = (updatedPricingData as any).monthlyPrice || Math.floor(updatedPricingData.totalPrice / 12);
  const paymentAssistTotalPrice = monthlyPrice * 12;
  const stripeTotalPrice = Math.floor(paymentAssistTotalPrice * 0.90);

  // Discount calculations
  const hasValidDiscountCodes = appliedDiscountCodes.length > 0;
  const percentageDiscounts = appliedDiscountCodes.filter(code => code.type === 'percentage');
  const fixedDiscounts = appliedDiscountCodes.filter(code => code.type !== 'percentage');
  
  const percentageDiscountAmount = percentageDiscounts.reduce((sum, code) => 
    sum + Math.floor(paymentAssistTotalPrice * (code.value / 100)), 0);
  const fixedDiscountAmount = fixedDiscounts.reduce((sum, code) => sum + code.value, 0);
  const totalDiscountAmount = percentageDiscountAmount + fixedDiscountAmount;
  
  const discountedPaymentAssistPrice = paymentAssistTotalPrice - totalDiscountAmount;
  const discountedStripePrice = stripeTotalPrice - totalDiscountAmount;

  const handleInputChange = (field: string, value: string | boolean) => {
    const updatedData = { ...customerData, [field]: value };
    setCustomerData(updatedData);
    try {
      localStorage.setItem('buyawarranty_customerData', JSON.stringify(updatedData));
    } catch (error) {
      console.error('❌ Failed to save customer data:', error);
    }
    
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Field validation for checkmarks
    if (typeof value === 'string' && value.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/;
      const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
      
      let isValid = false;
      if (field === 'email') isValid = emailRegex.test(value);
      else if (field === 'phone') isValid = phoneRegex.test(value);
      else if (field === 'postcode') isValid = postcodeRegex.test(value);
      else if (field === 'mileage') isValid = !isNaN(parseInt(value, 10)) && parseInt(value, 10) > 0;
      else isValid = value.trim().length > 0;
      
      setValidatedFields(prev => ({ ...prev, [field]: isValid }));
    } else {
      setValidatedFields(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleFieldBlur = (field: string) => {
    const value = customerData[field as keyof typeof customerData];
    if (typeof value !== 'string') return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/;
    const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    
    let errorMessage = '';
    
    if (field === 'email' && (!value.trim() || !emailRegex.test(value))) {
      errorMessage = 'Enter a valid email address.';
    } else if (field === 'phone' && (!value.trim() || !phoneRegex.test(value))) {
      errorMessage = 'Enter a valid UK phone number.';
    } else if (field === 'first_name' && (!value.trim() || value.trim().length < 2)) {
      errorMessage = 'Please enter your first name.';
    } else if (field === 'last_name' && (!value.trim() || value.trim().length < 2)) {
      errorMessage = 'Please enter your last name.';
    } else if (field === 'address_line_1' && (!value.trim() || value.trim().length < 3)) {
      errorMessage = 'Enter your street address.';
    } else if (field === 'city' && (!value.trim() || value.trim().length < 2)) {
      errorMessage = 'Enter your city or town.';
    } else if (field === 'postcode' && (!value.trim() || !postcodeRegex.test(value))) {
      errorMessage = 'Enter a valid UK postcode.';
    } else if (field === 'mileage') {
      const mileageNum = parseInt(value, 10);
      if (!value.trim() || isNaN(mileageNum) || mileageNum <= 0 || mileageNum >= 500000) {
        errorMessage = 'Please enter a valid mileage.';
      }
    }
    
    if (errorMessage) {
      setFieldErrors(prev => ({ ...prev, [field]: errorMessage }));
    }
  };

  const validateForm = (): { isValid: boolean; errors: {[key: string]: string} } => {
    const errors: {[key: string]: string} = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/;
    const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    
    if (!customerData.first_name?.trim() || customerData.first_name.trim().length < 2) {
      errors.first_name = 'Please enter your first name.';
    }
    if (!customerData.last_name?.trim() || customerData.last_name.trim().length < 2) {
      errors.last_name = 'Please enter your last name.';
    }
    if (!customerData.email?.trim() || !emailRegex.test(customerData.email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!customerData.phone?.trim() || !phoneRegex.test(customerData.phone)) {
      errors.phone = 'Enter a valid UK phone number.';
    }
    if (!customerData.address_line_1?.trim() || customerData.address_line_1.trim().length < 3) {
      errors.address_line_1 = 'Enter your street address.';
    }
    if (!customerData.city?.trim() || customerData.city.trim().length < 2) {
      errors.city = 'Enter your city or town.';
    }
    if (!customerData.postcode?.trim() || !postcodeRegex.test(customerData.postcode)) {
      errors.postcode = 'Enter a valid UK postcode.';
    }
    
    const mileageStr = customerData.mileage || '';
    const mileageNum = parseInt(mileageStr, 10);
    if (!mileageStr.trim() || isNaN(mileageNum) || mileageNum <= 0 || mileageNum >= 500000) {
      errors.mileage = 'Please enter a valid mileage.';
    }
    
    if (!startDate) {
      errors.startDate = 'Please select a valid start date.';
    }
    
    const isValid = Object.keys(errors).length === 0;
    return { isValid, errors };
  };
  
  const applyValidationErrors = (errors: {[key: string]: string}) => {
    setFieldErrors(errors);
    if (errors.startDate) {
      setStartDateError(errors.startDate);
    } else {
      setStartDateError('');
    }
  };

  const processStripeCheckout = async () => {
    const finalPrice = discountedStripePrice;
    console.log('💳 Processing Stripe checkout with price:', finalPrice);
    
    const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-stripe-checkout', {
      body: {
        planId,
        vehicleData: { ...vehicleData, mileage: customerData.mileage },
        paymentType,
        voluntaryExcess: updatedPricingData.voluntaryExcess,
        claimLimit: updatedPricingData.claimLimit || 1250,
        labourRate: pricingData.labourRate || 50,
        customerData: {
          ...customerData,
          final_amount: finalPrice,
          start_date: startDate?.toISOString()
        },
        protectionAddOns: updatedPricingData.protectionAddOns || {},
        discountCode: appliedDiscountCodes.map(code => code.code).join(', '),
        finalAmount: finalPrice,
        seasonalBonusMonths: seasonalOfferClaimed ? 3 : 0,
        trackingData: getTrackingData()
      }
    });

    if (checkoutError) {
      console.error('Stripe checkout error:', checkoutError);
      toast.error('Payment processing failed. Please try again.');
      setIsLoadingPayment(false);
      return;
    }

    if (checkoutData?.url) {
      localStorage.setItem('warrantyJourneyState', JSON.stringify({
        step: 4,
        vehicleData,
        selectedPlan: { id: planId, paymentType, name: planName, pricingData: originalPricingData },
        formData: customerData,
        timestamp: Date.now()
      }));
      window.location.href = checkoutData.url;
    } else {
      toast.error('Payment setup failed. Please try again.');
      setIsLoadingPayment(false);
    }
  };

  const processPaymentAssistCheckout = async () => {
    const finalPrice = discountedPaymentAssistPrice;
    console.log('💰 Processing Payment Assist checkout with price:', finalPrice);
    
    const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-payment-assist-checkout', {
      body: {
        planId,
        vehicleData: { ...vehicleData, mileage: customerData.mileage },
        paymentType,
        voluntaryExcess: updatedPricingData.voluntaryExcess,
        claimLimit: updatedPricingData.claimLimit || 1250,
        labourRate: pricingData.labourRate || 50,
        customerData: {
          ...customerData,
          final_amount: finalPrice,
          start_date: startDate?.toISOString()
        },
        protectionAddOns: updatedPricingData.protectionAddOns || {},
        discountCode: appliedDiscountCodes.map(code => code.code).join(', '),
        finalAmount: finalPrice,
        seasonalBonusMonths: seasonalOfferClaimed ? 3 : 0,
        trackingData: getTrackingData()
      }
    });

    if (checkoutError) {
      console.error('Payment Assist checkout error:', checkoutError);
      toast.error('Payment processing failed. Please try again.');
      setIsLoadingPaymentAssist(false);
      setIsLoadingPayment(false);
      return;
    }

    if (checkoutData?.url) {
      localStorage.setItem('warrantyJourneyState', JSON.stringify({
        step: 4,
        vehicleData,
        selectedPlan: { id: planId, paymentType, name: planName, pricingData: originalPricingData },
        formData: customerData,
        timestamp: Date.now()
      }));
      // Open in new tab to avoid iframe restrictions, with fallback to same window
      const newWindow = window.open(checkoutData.url, '_blank');
      if (!newWindow) {
        // Fallback if popup blocked - try top-level navigation
        if (window.top?.location) {
          window.top.location.href = checkoutData.url;
        } else {
          window.location.href = checkoutData.url;
        }
      }
    } else {
      toast.error('Payment setup failed. Please try again.');
      setIsLoadingPaymentAssist(false);
      setIsLoadingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 sm:mb-6 relative">
          <Button
            onClick={() => {
              localStorage.removeItem('buyawarranty_originalPricingData');
              onBack();
            }}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border-0 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Plans</span>
          </Button>
          <MobileNavigation />
        </div>

        {/* Test Mode Banner */}
        <div className="bg-purple-100 border-2 border-purple-400 rounded-lg p-4 mb-6 text-center">
          <span className="text-purple-800 font-bold">🧪 TEST MODE: Payment Assist Integration</span>
          <p className="text-purple-600 text-sm mt-1">This page is for testing Payment Assist instead of Bumper</p>
        </div>

        <Card className="border border-gray-200 overflow-hidden">
          <CardContent className="p-4 sm:pt-6 sm:p-6 overflow-x-hidden">
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 max-w-full">
              
              {/* Left Column - Form */}
              <div id="customer-form-section" className="w-full min-w-0 order-2 lg:order-2">
                <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
                  <div className="mb-6">
                    <div className="flex items-start gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5" />
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">Almost done! Just confirm your details</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 ml-7 sm:ml-8">
                      Secure your warranty. Your details are safe.
                    </p>
                  </div>
                  
                  {/* Start Date Picker */}
                  <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <StartDatePicker
                      value={startDate}
                      onChange={(date) => {
                        setStartDate(date);
                        setStartDateError('');
                        if (date) {
                          localStorage.setItem('buyawarranty_startDate', date.toISOString());
                        }
                      }}
                      maxDaysAhead={365}
                      error={startDateError}
                    />
                  </div>
                  
                  <form className="space-y-6">
                    {/* Name Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">First Name *</Label>
                        <div className="relative">
                          <Input
                            id="first_name"
                            placeholder="Enter your first name"
                            value={customerData.first_name}
                            onChange={(e) => handleInputChange('first_name', e.target.value)}
                            onBlur={() => handleFieldBlur('first_name')}
                            className={`mt-1 ${fieldErrors.first_name ? 'border-red-500' : ''}`}
                          />
                          {validatedFields.first_name && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />}
                        </div>
                        {fieldErrors.first_name && <p className="text-red-500 text-xs mt-1">{fieldErrors.first_name}</p>}
                      </div>
                      <div>
                        <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">Last Name *</Label>
                        <div className="relative">
                          <Input
                            id="last_name"
                            placeholder="Enter your surname"
                            value={customerData.last_name}
                            onChange={(e) => handleInputChange('last_name', e.target.value)}
                            onBlur={() => handleFieldBlur('last_name')}
                            className={`mt-1 ${fieldErrors.last_name ? 'border-red-500' : ''}`}
                          />
                          {validatedFields.last_name && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />}
                        </div>
                        {fieldErrors.last_name && <p className="text-red-500 text-xs mt-1">{fieldErrors.last_name}</p>}
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address *</Label>
                      <div className="relative">
                        <Input
                          id="email"
                          type="email"
                          placeholder="e.g., john.smith@email.com"
                          value={customerData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          onBlur={() => handleFieldBlur('email')}
                          className={`mt-1 ${fieldErrors.email ? 'border-red-500' : ''}`}
                        />
                        {validatedFields.email && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />}
                      </div>
                      {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
                    </div>

                    {/* Phone */}
                    <div>
                      <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number *</Label>
                      <div className="relative">
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="07123 456789"
                          value={customerData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          onBlur={() => handleFieldBlur('phone')}
                          className={`mt-1 ${fieldErrors.phone ? 'border-red-500' : ''}`}
                        />
                        {validatedFields.phone && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />}
                      </div>
                      {fieldErrors.phone && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
                    </div>

                    {/* Mileage */}
                    <div>
                      <Label htmlFor="mileage" className="text-sm font-medium text-gray-700">Vehicle Mileage *</Label>
                      <div className="relative">
                        <Input
                          id="mileage"
                          type="text"
                          placeholder="e.g. 52,000"
                          value={customerData.mileage ? Number(customerData.mileage).toLocaleString('en-GB') : ''}
                          onChange={(e) => handleInputChange('mileage', e.target.value.replace(/[^0-9]/g, ''))}
                          onBlur={() => handleFieldBlur('mileage')}
                          className={`mt-1 ${fieldErrors.mileage ? 'border-red-500' : ''}`}
                        />
                        {validatedFields.mileage && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />}
                      </div>
                      {customerData.mileage && Number(customerData.mileage) > 150000 ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                          <p className="text-red-600 text-sm font-medium">Sorry, we only cover vehicles under 150,000 miles.</p>
                        </div>
                      ) : fieldErrors.mileage ? (
                        <p className="text-red-500 text-xs mt-1">{fieldErrors.mileage}</p>
                      ) : null}
                    </div>

                    {/* Address */}
                    <div className="space-y-4">
                      <div className="border-b border-gray-200 pb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-gray-600" />
                          <h4 className="text-base font-semibold text-gray-900">Address</h4>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="address_line_1" className="text-sm font-medium text-gray-700">Address Line 1 *</Label>
                        <Input
                          id="address_line_1"
                          placeholder="Street address"
                          value={customerData.address_line_1}
                          onChange={(e) => handleInputChange('address_line_1', e.target.value)}
                          onBlur={() => handleFieldBlur('address_line_1')}
                          className={`mt-1 ${fieldErrors.address_line_1 ? 'border-red-500' : ''}`}
                        />
                        {fieldErrors.address_line_1 && <p className="text-red-500 text-xs mt-1">{fieldErrors.address_line_1}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="city" className="text-sm font-medium text-gray-700">City *</Label>
                          <Input
                            id="city"
                            placeholder="City"
                            value={customerData.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            onBlur={() => handleFieldBlur('city')}
                            className={`mt-1 ${fieldErrors.city ? 'border-red-500' : ''}`}
                          />
                          {fieldErrors.city && <p className="text-red-500 text-xs mt-1">{fieldErrors.city}</p>}
                        </div>
                        <div>
                          <Label htmlFor="postcode" className="text-sm font-medium text-gray-700">Postcode *</Label>
                          <Input
                            id="postcode"
                            placeholder="Postcode"
                            value={customerData.postcode}
                            onChange={(e) => handleInputChange('postcode', e.target.value.toUpperCase())}
                            onBlur={() => handleFieldBlur('postcode')}
                            className={`mt-1 ${fieldErrors.postcode ? 'border-red-500' : ''}`}
                          />
                          {fieldErrors.postcode && <p className="text-red-500 text-xs mt-1">{fieldErrors.postcode}</p>}
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right Column - Order Summary */}
              <div className="w-full min-w-0 order-1 lg:order-1 lg:sticky lg:top-6 lg:self-start">
                <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Car className="w-5 h-5 text-orange-500" />
                    Order Summary
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan:</span>
                      <span className="font-semibold">{planName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-semibold">
                        {paymentType === '12months' ? '1 Year' : paymentType === '24months' ? '2 Years' : '3 Years'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vehicle:</span>
                      <span className="font-semibold uppercase">{vehicleData.make} {vehicleData.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Registration:</span>
                      <span className="font-semibold">{vehicleData.regNumber}</span>
                    </div>
                    
                    <div className="border-t pt-4 mt-4 space-y-3">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="text-base">
                          <span className="font-bold">Pay Monthly: £{Math.floor(discountedPaymentAssistPrice / 12)}/month</span>
                          <span className="text-sm text-gray-600 ml-2">via Payment Assist</span>
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 relative">
                        <span className="absolute -top-2 right-3 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded">BEST VALUE</span>
                        <div className="text-base mt-1">
                          <span className="font-bold">Pay in Full: £{discountedStripePrice}</span>
                          <span className="text-sm text-gray-600 ml-2">(10% off)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Methods Section */}
              <div id="payment-section" className="order-3 lg:col-span-2 lg:mt-4 space-y-6 bg-gradient-to-b from-gray-50 to-white rounded-2xl p-6 lg:p-8">
                <div className="text-center space-y-3">
                  <h3 className="text-2xl font-bold text-black mb-2">Choose how you'd like to pay 🔒</h3>
                  <div className="flex items-center justify-center gap-2 text-sm text-black">
                    <Lock className="w-4 h-4 text-green-600" />
                    <span>Secure Checkout</span>
                  </div>
                  <TrustpilotHeader className="h-8 mx-auto" />
                </div>

                <RadioGroup 
                  value={paymentMethod} 
                  onValueChange={(value: 'payment-assist' | 'stripe') => setPaymentMethod(value)}
                >
                  <div className="lg:max-w-2xl lg:mx-auto space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                      
                      {/* OPTION A: Pay Monthly (Payment Assist) */}
                      <div 
                        onClick={() => setPaymentMethod('payment-assist')}
                        className={`relative rounded-xl cursor-pointer transition-all duration-300 w-full flex flex-col ${
                          paymentMethod === 'payment-assist' ? 'shadow-[0_0_15px_rgba(147,51,234,0.4)]' : 'hover:shadow-md'
                        }`}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '2px solid #9333EA',
                          padding: '20px'
                        }}
                      >
                        {/* Badge */}
                        <div className="absolute -top-3 left-4 bg-purple-600 text-white text-xs font-bold rounded-xl px-3 py-1">
                          0% APR
                        </div>

                        <div className="flex items-start justify-between mb-3 mt-2">
                          <RadioGroupItem 
                            value="payment-assist" 
                            id="payment-assist-option" 
                            className="border-2 border-gray-400 w-6 h-6 mt-0.5 data-[state=checked]:border-purple-600 data-[state=checked]:border-[3px]"
                          />
                        </div>

                        <Label htmlFor="payment-assist-option" className="block cursor-pointer mb-3">
                          <h4 className="text-xl font-bold text-gray-800">Pay Monthly</h4>
                        </Label>

                        <div className="mb-4 min-h-[72px]">
                          <div className="text-base text-gray-600 font-bold">
                            Total: £{discountedPaymentAssistPrice}
                          </div>
                          <div className="text-2xl font-bold text-black">
                            £{Math.floor(discountedPaymentAssistPrice / 12)}/month
                          </div>
                          <div className="text-sm text-gray-600 font-bold">12 easy payments</div>
                        </div>

                        <div className="space-y-2 mb-4 min-h-[84px] flex-grow">
                          <div className="flex items-center gap-2 text-sm text-gray-800">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span>Quick application</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-800">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span>No impact on credit score</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-800">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span>No hidden fees</span>
                          </div>
                        </div>

                        <div className="mt-auto">
                          <Button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              console.log('🟣 Payment Assist button clicked');
                              
                              // Use ref to prevent double clicks
                              if (isProcessingRef.current || isLoadingStripe || isLoadingPaymentAssist) {
                                console.log('⚠️ Already processing, returning');
                                return;
                              }
                              
                              try {
                                // Validate form first - no state updates here
                                const { isValid, errors } = validateForm();
                                console.log('📋 Form validation result:', isValid, errors);
                                
                                if (!isValid) {
                                  // Now apply the state updates for UI
                                  setShowValidation(true);
                                  applyValidationErrors(errors);
                                  toast.error('Please fill in all required fields');
                                  setTimeout(() => {
                                    const firstErrorField = document.querySelector('[class*="border-red"]');
                                    firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 100);
                                  return;
                                }
                                
                                console.log('✅ Validation passed, starting Payment Assist checkout');
                                isProcessingRef.current = true;
                                setPaymentMethod('payment-assist');
                                setIsLoadingPaymentAssist(true);
                                setIsLoadingPayment(true);
                                trackFormSubmission('customer_details', { payment_method: 'payment_assist' });
                                
                                processPaymentAssistCheckout()
                                  .catch((error) => {
                                    console.error('❌ Payment Assist checkout error:', error);
                                    toast.error('Payment processing failed. Please try again.');
                                  })
                                  .finally(() => {
                                    isProcessingRef.current = false;
                                    setIsLoadingPaymentAssist(false);
                                    setIsLoadingPayment(false);
                                  });
                              } catch (err) {
                                console.error('❌ Button handler error:', err);
                                toast.error('An error occurred. Please try again.');
                              }
                            }}
                            disabled={isLoadingStripe || isLoadingPaymentAssist}
                            className="w-full rounded-lg transition-colors shadow-lg text-white disabled:opacity-50 bg-purple-600 hover:bg-purple-700"
                            style={{ fontSize: '16px', fontWeight: 'bold', padding: '12px' }}
                          >
                            {isLoadingPaymentAssist ? 'Processing...' : 'Complete checkout'}
                          </Button>
                        </div>

                        <div className="text-center pt-3 border-t mt-4">
                          <span className="text-xs text-gray-500 block mb-1">Powered by</span>
                          <span className="text-sm font-bold text-purple-600">Payment Assist</span>
                        </div>
                      </div>

                      {/* OPTION B: Pay in Full (Stripe) */}
                      <div 
                        onClick={() => setPaymentMethod('stripe')}
                        className={`relative rounded-xl cursor-pointer transition-all duration-300 w-full flex flex-col ${
                          paymentMethod === 'stripe' ? 'shadow-[0_0_15px_rgba(39,174,96,0.4)]' : 'hover:shadow-md'
                        }`}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '2px solid #27AE60',
                          padding: '20px'
                        }}
                      >
                        <div className="absolute -top-3 left-4 bg-green-600 text-white text-xs font-bold rounded-xl px-3 py-1">
                          BEST VALUE
                        </div>

                        <div className="flex items-start justify-between mb-3 mt-2">
                          <RadioGroupItem 
                            value="stripe" 
                            id="stripe-option" 
                            className="border-2 border-gray-400 w-6 h-6 mt-0.5 data-[state=checked]:border-green-600 data-[state=checked]:border-[3px]"
                          />
                        </div>

                        <Label htmlFor="stripe-option" className="block cursor-pointer mb-3">
                          <h4 className="text-xl font-bold text-gray-800">Pay in Full</h4>
                        </Label>

                        <div className="mb-4 min-h-[72px]">
                          <div className="text-base text-gray-600 font-bold">
                            Was: <span className="line-through">£{paymentAssistTotalPrice}</span>
                          </div>
                          <div className="text-2xl font-bold text-black">£{discountedStripePrice}</div>
                          <div className="text-sm text-green-600 font-bold">
                            You save £{paymentAssistTotalPrice - discountedStripePrice}
                          </div>
                        </div>

                        <div className="space-y-2 mb-4 min-h-[84px] flex-grow">
                          <div className="flex items-center gap-2 text-sm text-gray-800">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span>Instant 10% discount</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-800">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span>Immediate cover</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-800">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span>No monthly payments</span>
                          </div>
                        </div>

                        <div className="mt-auto">
                          <Button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              console.log('🟢 Stripe button clicked');
                              
                              // Use ref to prevent double clicks
                              if (isProcessingRef.current || isLoadingStripe || isLoadingPaymentAssist) {
                                console.log('⚠️ Already processing, returning');
                                return;
                              }
                              
                              try {
                                // Validate form first - no state updates here
                                const { isValid, errors } = validateForm();
                                console.log('📋 Form validation result:', isValid, errors);
                                
                                if (!isValid) {
                                  // Now apply the state updates for UI
                                  setShowValidation(true);
                                  applyValidationErrors(errors);
                                  toast.error('Please fill in all required fields');
                                  setTimeout(() => {
                                    const firstErrorField = document.querySelector('[class*="border-red"]');
                                    firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 100);
                                  return;
                                }
                                
                                console.log('✅ Validation passed, starting Stripe checkout');
                                isProcessingRef.current = true;
                                setPaymentMethod('stripe');
                                setIsLoadingStripe(true);
                                setIsLoadingPayment(true);
                                trackFormSubmission('customer_details', { payment_method: 'stripe' });
                                trackStripeCheckoutClick();
                                
                                processStripeCheckout()
                                  .catch((error) => {
                                    console.error('❌ Stripe checkout error:', error);
                                    toast.error('Payment processing failed. Please try again.');
                                  })
                                  .finally(() => {
                                    isProcessingRef.current = false;
                                    setIsLoadingStripe(false);
                                    setIsLoadingPayment(false);
                                  });
                              } catch (err) {
                                console.error('❌ Button handler error:', err);
                                toast.error('An error occurred. Please try again.');
                              }
                            }}
                            disabled={isLoadingStripe || isLoadingPaymentAssist}
                            className="w-full rounded-lg transition-colors shadow-lg text-white disabled:opacity-50 hover:opacity-90"
                            style={{ backgroundColor: '#27AE60', fontSize: '16px', fontWeight: 'bold', padding: '12px' }}
                          >
                            {isLoadingStripe ? 'Processing...' : 'Complete checkout'}
                          </Button>
                        </div>

                        <div className="text-center pt-3 border-t mt-4">
                          <span className="text-xs text-gray-500 block mb-1">Powered by</span>
                          <img src={stripeLogo} alt="Stripe" className="h-5 mx-auto" />
                        </div>
                      </div>
                    </div>

                    {/* Security Icons */}
                    <div className="bg-white border border-gray-200 rounded-lg p-3 lg:max-w-md lg:mx-auto">
                      <div className="flex items-center justify-center gap-4 flex-wrap text-xs text-black">
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-green-600" />
                          <span className="font-medium">SSL Encrypted</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-green-600" />
                          <span className="font-medium">Visa & Mastercard</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="font-medium">Secure Payments</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerDetailsStepTest;
