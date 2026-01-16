import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, CheckCircle, Edit, CreditCard, MapPin, Check, Lock, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { PostcodeAutocomplete } from '@/components/ui/uk-postcode-autocomplete';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackFormSubmission, trackBumperCheckoutClick, trackStripeCheckoutClick, trackStripeCheckoutPageLoad, trackStep4EmailEntry } from '@/utils/analytics';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { getAddOnInfo, normalizePaymentType, calculateAddOnPrice } from '@/lib/addOnsUtils';
import MobileNavigation from '@/components/MobileNavigation';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import bumperLogo from '@/assets/bumper-logo-transparent.png';
import stripeLogo from '@/assets/stripe-logo.png';
import { StartDatePicker } from '@/components/checkout/StartDatePicker';

import { startOfDay, format, isToday } from 'date-fns';

// Import the props interface from main component
export interface StreamlinedCheckoutProps {
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

const StreamlinedCheckout: React.FC<StreamlinedCheckoutProps> = ({ 
  vehicleData, 
  planId, 
  paymentType, 
  planName, 
  pricingData, 
  onBack, 
  onNext 
}) => {
  // Pre-populate from Step 2 data in localStorage
  const [customerData, setCustomerData] = useState(() => {
    try {
      const savedCustomerData = localStorage.getItem('buyawarranty_customerData');
      if (savedCustomerData) {
        const parsed = JSON.parse(savedCustomerData);
        console.log('✅ Restored customer data from localStorage:', parsed);
        return parsed;
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
      mileage: '',
      marketing_opt_in: false,
      privacy_policy_accepted: false,
      terms_conditions_accepted: false,
    };
  });

  // Payment toggle state
  const [selectedPayment, setSelectedPayment] = useState<'monthly' | 'full'>('monthly');
  
  // Form states
  const [showValidation, setShowValidation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [validatedFields, setValidatedFields] = useState<{[key: string]: boolean}>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Promo code states (collapsed by default)
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoCodeError, setPromoCodeError] = useState('');
  const [isValidatingPromoCode, setIsValidatingPromoCode] = useState(false);
  const [appliedDiscountCodes, setAppliedDiscountCodes] = useState<Array<{
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    discountAmount: number;
  }>>([]);

  // Pricing data state
  const [updatedPricingData, setUpdatedPricingData] = useState(() => {
    try {
      const savedOriginalPrice = localStorage.getItem('buyawarranty_originalPricingData');
      if (savedOriginalPrice) {
        return JSON.parse(savedOriginalPrice);
      }
    } catch (error) {
      console.error('Error restoring pricing data:', error);
    }
    localStorage.setItem('buyawarranty_originalPricingData', JSON.stringify(pricingData));
    return pricingData;
  });

  // Start date state
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

  // Check if Step 2 data was pre-populated
  const hasPrePopulatedData = Boolean(customerData.first_name || customerData.email || customerData.phone);
  const [editingPrePopulated, setEditingPrePopulated] = useState(false);

  // Calculate prices
  const monthlyPrice = (updatedPricingData as any).monthlyPrice || Math.floor(updatedPricingData.totalPrice / 12);
  const bumperTotalPrice = monthlyPrice * 12;
  const stripeTotalPrice = Math.floor(bumperTotalPrice * 0.90);

  // Calculate discounts
  const hasValidDiscountCodes = appliedDiscountCodes.length > 0;
  const totalDiscountAmount = appliedDiscountCodes.reduce((sum, code) => sum + code.discountAmount, 0);
  const discountedBumperPrice = Math.floor(bumperTotalPrice - totalDiscountAmount);
  const discountedStripePrice = Math.floor(stripeTotalPrice - totalDiscountAmount);
  const savings = bumperTotalPrice - stripeTotalPrice;

  // Track page load
  useEffect(() => {
    trackStripeCheckoutPageLoad();
  }, []);

  // Reset loading on mount
  useEffect(() => {
    setIsLoading(false);
    
    const handlePageShow = () => setIsLoading(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') setIsLoading(false);
    };
    
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Auto-apply discount codes
  useEffect(() => {
    try {
      const autoApplyCode = localStorage.getItem('autoApplyDiscountCode');
      if (autoApplyCode?.startsWith('RETURN20-')) {
        setAppliedDiscountCodes([{
          code: autoApplyCode,
          type: 'percentage',
          value: 20,
          discountAmount: bumperTotalPrice * 0.20
        }]);
        localStorage.removeItem('autoApplyDiscountCode');
        toast.success('Your 20% return discount has been applied!');
      }
      
      const savedDiscountCode = localStorage.getItem('secondWarrantyDiscountCode');
      if (savedDiscountCode?.startsWith('SECOND10-')) {
        setAppliedDiscountCodes(prev => {
          if (prev.some(code => code.code === savedDiscountCode)) return prev;
          toast.success('✓ Your discount code has been applied!');
          return [...prev, {
            code: savedDiscountCode,
            type: 'percentage',
            value: 10,
            discountAmount: bumperTotalPrice * 0.10
          }];
        });
      }
    } catch (error) {
      console.error('Error checking discount codes:', error);
    }
  }, [bumperTotalPrice]);

  // Track abandoned cart
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerData.email || !emailRegex.test(customerData.email)) return;

    const timeoutId = setTimeout(async () => {
      try {
        trackStep4EmailEntry(customerData.email);
        await supabase.functions.invoke('track-abandoned-cart', {
          body: {
            email: customerData.email,
            full_name: `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || customerData.email,
            phone: customerData.phone || '',
            vehicle_reg: vehicleData.regNumber || '',
            vehicle_make: vehicleData.make || '',
            vehicle_model: vehicleData.model || '',
            vehicle_year: vehicleData.year || '',
            vehicle_type: 'car',
            mileage: vehicleData.mileage || '',
            plan_name: planName || '',
            payment_type: paymentType || '',
            step_abandoned: 4
          }
        });
      } catch (error) {
        console.error('Error tracking abandoned cart:', error);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [customerData.email, customerData.first_name, customerData.last_name, customerData.phone, vehicleData, planName, paymentType]);

  // Save customer data to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('buyawarranty_customerData', JSON.stringify(customerData));
    } catch (error) {
      console.error('Error saving customer data:', error);
    }
  }, [customerData]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setCustomerData((prev: typeof customerData) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFieldBlur = (field: string) => {
    validateField(field);
  };

  const validateField = (field: string): boolean => {
    let isValid = true;
    let error = '';

    switch (field) {
      case 'first_name':
        if (!customerData.first_name?.trim()) {
          error = 'First name is required';
          isValid = false;
        }
        break;
      case 'last_name':
        if (!customerData.last_name?.trim()) {
          error = 'Last name is required';
          isValid = false;
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!customerData.email?.trim()) {
          error = 'Email is required';
          isValid = false;
        } else if (!emailRegex.test(customerData.email)) {
          error = 'Please enter a valid email';
          isValid = false;
        }
        break;
      case 'phone':
        const cleanedPhone = customerData.phone?.replace(/\s/g, '') || '';
        const ukPhoneRegex = /^(?:(?:\+44)|(?:0))(?:\d{10}|\d{9})$/;
        if (!cleanedPhone) {
          error = 'Phone number is required';
          isValid = false;
        } else if (!ukPhoneRegex.test(cleanedPhone)) {
          error = 'Please enter a valid UK phone number';
          isValid = false;
        }
        break;
      case 'address_line_1':
        if (!customerData.address_line_1?.trim()) {
          error = 'Address is required';
          isValid = false;
        }
        break;
      case 'postcode':
        const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
        if (!customerData.postcode?.trim()) {
          error = 'Postcode is required';
          isValid = false;
        } else if (!postcodeRegex.test(customerData.postcode.trim())) {
          error = 'Please enter a valid UK postcode';
          isValid = false;
        }
        break;
      case 'city':
        if (!customerData.city?.trim()) {
          error = 'City is required';
          isValid = false;
        }
        break;
      case 'mileage':
        const mileage = parseInt(customerData.mileage || '0');
        if (!customerData.mileage) {
          error = 'Mileage is required';
          isValid = false;
        } else if (mileage < 1000) {
          error = 'Minimum 1,000 miles';
          isValid = false;
        } else if (mileage > 150000) {
          error = 'Maximum 150,000 miles';
          isValid = false;
        }
        break;
    }

    setFieldErrors(prev => ({ ...prev, [field]: error }));
    setValidatedFields(prev => ({ ...prev, [field]: isValid }));
    return isValid;
  };

  const validateForm = (): boolean => {
    const requiredFields = ['first_name', 'last_name', 'email', 'phone', 'address_line_1', 'postcode', 'city', 'mileage'];
    let allValid = true;
    
    requiredFields.forEach(field => {
      if (!validateField(field)) allValid = false;
    });
    
    
    
    return allValid;
  };

  const applyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    
    setIsValidatingPromoCode(true);
    setPromoCodeError('');
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: { code: promoCodeInput.toUpperCase(), vehicleReg: vehicleData.regNumber }
      });
      
      if (error || !data?.valid) {
        setPromoCodeError(data?.message || 'Invalid promo code');
        return;
      }
      
      const discountAmount = data.type === 'percentage' 
        ? bumperTotalPrice * (data.value / 100)
        : data.value;
      
      setAppliedDiscountCodes(prev => [...prev, {
        code: promoCodeInput.toUpperCase(),
        type: data.type,
        value: data.value,
        discountAmount
      }]);
      
      setPromoCodeInput('');
      setPromoOpen(false);
      toast.success('Promo code applied!');
    } catch (error) {
      setPromoCodeError('Error validating code');
    } finally {
      setIsValidatingPromoCode(false);
    }
  };

  const removePromoCode = (code: string) => {
    setAppliedDiscountCodes(prev => prev.filter(d => d.code !== code));
    toast.success('Promo code removed');
  };

  const processPayment = async () => {
    setShowValidation(true);
    
    if (!validateForm()) {
      const formSection = document.getElementById('customer-form');
      formSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsLoading(true);
    trackFormSubmission('customer_details', { payment_method: selectedPayment });

    if (selectedPayment === 'monthly') {
      trackBumperCheckoutClick();
      await processBumperCheckout();
    } else {
      trackStripeCheckoutClick();
      await processStripeCheckout();
    }
  };

  const processBumperCheckout = async () => {
    try {
      const finalPrice = discountedBumperPrice;
      
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-bumper-checkout', {
        body: {
          planId,
          vehicleData,
          paymentType,
          voluntaryExcess: updatedPricingData.voluntaryExcess,
          claimLimit: updatedPricingData.claimLimit || 1250,
          labourRate: pricingData.labourRate || 50,
          customerData: { ...customerData, final_amount: finalPrice },
          discountCode: appliedDiscountCodes.map(code => code.code).join(', '),
          finalAmount: finalPrice,
          protectionAddOns: {
            tyre: updatedPricingData.protectionAddOns?.tyre || false,
            wearAndTear: updatedPricingData.protectionAddOns?.wearAndTear || false,
            european: updatedPricingData.protectionAddOns?.european || false,
            breakdown: updatedPricingData.protectionAddOns?.breakdown || false,
            rental: updatedPricingData.protectionAddOns?.rental || false,
            transfer: updatedPricingData.protectionAddOns?.transfer || false,
            motRepair: false,
            motFee: updatedPricingData.protectionAddOns?.motFee || false,
          }
        }
      });

      if (checkoutError) {
        const errorMessage = checkoutError?.message || '';
        if (errorMessage.includes('is not available for Bumper') || errorMessage.includes('Monthly payments are not available')) {
          toast.error('Monthly payments unavailable. Please pay in full.', {
            duration: 8000,
            action: { label: 'Pay in Full', onClick: () => setSelectedPayment('full') }
          });
          setIsLoading(false);
          return;
        }
        toast.error('Unable to process. Please try again.');
        setIsLoading(false);
        return;
      }

      if (checkoutData?.url) {
        localStorage.setItem('warranty_journey_state', JSON.stringify({
          formData: pricingData,
          vehicleData,
          customerData,
          planId,
          paymentType,
          appliedDiscountCodes,
          timestamp: Date.now()
        }));
        window.location.href = checkoutData.url;
      } else {
        toast.error('Unable to process. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      toast.error('Unable to process. Please try again.');
      setIsLoading(false);
    }
  };

  const processStripeCheckout = async () => {
    try {
      const finalPrice = discountedStripePrice;
      
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout', {
        body: {
          planId,
          vehicleData,
          paymentType,
          voluntaryExcess: updatedPricingData.voluntaryExcess,
          claimLimit: updatedPricingData.claimLimit || 1250,
          labourRate: pricingData.labourRate || 50,
          customerData: { ...customerData, final_amount: finalPrice },
          discountCode: appliedDiscountCodes.map(code => code.code).join(', '),
          finalAmount: finalPrice,
          protectionAddOns: {
            tyre: updatedPricingData.protectionAddOns?.tyre || false,
            wearAndTear: updatedPricingData.protectionAddOns?.wearAndTear || false,
            european: updatedPricingData.protectionAddOns?.european || false,
            breakdown: updatedPricingData.protectionAddOns?.breakdown || false,
            rental: updatedPricingData.protectionAddOns?.rental || false,
            transfer: updatedPricingData.protectionAddOns?.transfer || false,
            motRepair: false,
            motFee: updatedPricingData.protectionAddOns?.motFee || false,
          }
        }
      });

      if (checkoutError) {
        toast.error('Unable to process. Please try again.');
        setIsLoading(false);
        return;
      }

      if (checkoutData?.url) {
        localStorage.setItem('warranty_journey_state', JSON.stringify({
          formData: pricingData,
          vehicleData,
          customerData,
          planId,
          paymentType,
          appliedDiscountCodes,
          timestamp: Date.now()
        }));
        window.location.href = checkoutData.url;
      } else {
        toast.error('Unable to process. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      toast.error('Unable to process. Please try again.');
      setIsLoading(false);
    }
  };

  const formatPlanName = () => {
    return planName
      .replace(/vehicle/gi, '')
      .replace(/car/gi, '')
      .replace(/bike/gi, '')
      .replace(/plan/gi, '')
      .replace(/premium/gi, 'Platinum')
      .trim() || 'Platinum';
  };

  const getDurationText = () => {
    if (paymentType === '12months') return '1 Year';
    if (paymentType === '24months') return '2 Years';
    return '3 Years';
  };

  return (
    <div className="min-h-screen bg-[#e8f4fb]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.removeItem('buyawarranty_originalPricingData');
              onBack();
            }}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Plans</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <MobileNavigation />
        </div>

        <div className="flex flex-col gap-6 lg:gap-8 max-w-3xl mx-auto">
          {/* SECTION 1: CONFIRM YOUR DETAILS */}
          <div className="w-full">
            <Card id="customer-form" className="border border-gray-200 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                {/* Form Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Confirm Your Details</h3>
                  </div>
                  <p className="text-sm text-gray-600">Your information is secure and encrypted.</p>
                </div>

                {/* Pre-populated Data Display (if from Step 2) */}
                {hasPrePopulatedData && !editingPrePopulated && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-blue-900">Your Details</span>
                      <button
                        type="button"
                        onClick={() => setEditingPrePopulated(true)}
                        className="text-xs font-medium text-blue-700 hover:text-blue-800 underline flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </button>
                    </div>
                    <div className="space-y-1 text-sm text-blue-800">
                      {customerData.first_name && <p><span className="text-blue-600">Name:</span> {customerData.first_name} {customerData.last_name}</p>}
                      {customerData.email && <p><span className="text-blue-600">Email:</span> {customerData.email}</p>}
                      {customerData.phone && <p><span className="text-blue-600">Phone:</span> {customerData.phone}</p>}
                    </div>
                  </div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); processPayment(); }} className="space-y-5">
                  {/* Start Date Picker - Hidden in form but accessible */}
                  <div id="start-date-picker" className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <StartDatePicker
                      value={startDate}
                      onChange={(date) => {
                        setStartDate(date);
                        if (date) {
                          try {
                            localStorage.setItem('buyawarranty_startDate', date.toISOString());
                          } catch (error) {
                            console.error('Error saving start date:', error);
                          }
                        }
                      }}
                      maxDaysAhead={365}
                    />
                  </div>

                  {/* Personal Details - Show all if editing or not pre-populated */}
                  {(!hasPrePopulatedData || editingPrePopulated) && (
                    <>
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
                              required
                              className={`mt-1 ${showValidation && fieldErrors.first_name ? 'border-red-500' : ''}`}
                            />
                            {validatedFields.first_name && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />}
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
                              required
                              className={`mt-1 ${showValidation && fieldErrors.last_name ? 'border-red-500' : ''}`}
                            />
                            {validatedFields.last_name && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />}
                          </div>
                          {fieldErrors.last_name && <p className="text-red-500 text-xs mt-1">{fieldErrors.last_name}</p>}
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address *</Label>
                        <p className="text-xs text-gray-500 mb-1">For your policy documents</p>
                        <div className="relative">
                          <Input
                            id="email"
                            type="email"
                            placeholder="john.smith@email.com"
                            value={customerData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            onBlur={() => handleFieldBlur('email')}
                            required
                            className={showValidation && fieldErrors.email ? 'border-red-500' : ''}
                          />
                          {validatedFields.email && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />}
                        </div>
                        {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
                      </div>

                      {/* Phone */}
                      <div>
                        <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number *</Label>
                        <p className="text-xs text-gray-500 mb-1">UK mobile or landline</p>
                        <div className="relative">
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="07123 456789"
                            value={customerData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            onBlur={() => handleFieldBlur('phone')}
                            required
                            className={showValidation && fieldErrors.phone ? 'border-red-500' : ''}
                          />
                          {validatedFields.phone && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />}
                        </div>
                        {fieldErrors.phone && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
                      </div>
                    </>
                  )}

                  {/* Mileage */}
                  <div>
                    <Label htmlFor="mileage" className="text-sm font-medium text-gray-700">Vehicle Mileage *</Label>
                    <p className="text-xs text-gray-500 mb-1">Approximate current mileage</p>
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
                            handleInputChange('mileage', rawValue);
                          }}
                          onBlur={() => handleFieldBlur('mileage')}
                          required
                          className={showValidation && fieldErrors.mileage ? 'border-red-500' : ''}
                        />
                        {validatedFields.mileage && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />}
                      </div>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleInputChange('mileage', e.target.value);
                            setValidatedFields(prev => ({ ...prev, mileage: true }));
                          }
                        }}
                        className="h-10 px-3 rounded-md border border-gray-200 bg-gray-50 text-sm cursor-pointer"
                      >
                        <option value="">Quick select</option>
                        {Array.from({ length: 131 }, (_, i) => {
                          const value = 10000 + (i * 1000);
                          return <option key={value} value={value}>{value.toLocaleString('en-GB')}</option>;
                        })}
                      </select>
                    </div>
                    {customerData.mileage && Number(customerData.mileage) > 150000 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                        <p className="text-red-600 text-sm font-medium">
                          Sorry, we only cover vehicles under 150,000 miles.
                        </p>
                      </div>
                    )}
                    {fieldErrors.mileage && <p className="text-red-500 text-xs mt-1">{fieldErrors.mileage}</p>}
                  </div>

                  {/* Address Section */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                      <MapPin className="w-4 h-4 text-gray-600" />
                      <h4 className="text-sm font-semibold text-gray-900">Your Address</h4>
                    </div>

                    <div>
                      <Label htmlFor="address_line_1" className="text-sm font-medium text-gray-700">Address Line 1 *</Label>
                      <div className="relative">
                        <Input
                          id="address_line_1"
                          placeholder="Street address"
                          value={customerData.address_line_1}
                          onChange={(e) => handleInputChange('address_line_1', e.target.value)}
                          onBlur={() => handleFieldBlur('address_line_1')}
                          required
                          className={`mt-1 ${showValidation && fieldErrors.address_line_1 ? 'border-red-500' : ''}`}
                        />
                        {validatedFields.address_line_1 && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />}
                      </div>
                      {fieldErrors.address_line_1 && <p className="text-red-500 text-xs mt-1">{fieldErrors.address_line_1}</p>}
                    </div>

                    <div>
                      <Label htmlFor="address_line_2" className="text-sm font-medium text-gray-700">Address Line 2</Label>
                      <Input
                        id="address_line_2"
                        placeholder="Apartment, suite, etc. (optional)"
                        value={customerData.address_line_2}
                        onChange={(e) => handleInputChange('address_line_2', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-start">
                      <div>
                        <Label htmlFor="postcode" className="text-sm font-medium text-gray-700">Postcode *</Label>
                        <div className="mt-1">
                          <PostcodeAutocomplete
                            value={customerData.postcode}
                            onChange={(value) => handleInputChange('postcode', value)}
                            onBlur={() => handleFieldBlur('postcode')}
                            onAddressSelect={(address) => {
                              if (address.town) handleInputChange('city', address.town);
                              if (address.street && !customerData.address_line_1) {
                                handleInputChange('address_line_1', address.street);
                              }
                            }}
                            placeholder="SW1A 1AA"
                            required
                            className={showValidation && fieldErrors.postcode ? 'border-red-500' : ''}
                            error={fieldErrors.postcode}
                            showCheckmark={validatedFields.postcode}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="city" className="text-sm font-medium text-gray-700">City/Town *</Label>
                        <div className="relative mt-1">
                          <Input
                            id="city"
                            placeholder="City"
                            value={customerData.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            onBlur={() => handleFieldBlur('city')}
                            required
                            className={showValidation && fieldErrors.city ? 'border-red-500' : ''}
                          />
                          {validatedFields.city && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />}
                        </div>
                        {fieldErrors.city && <p className="text-red-500 text-xs mt-1">{fieldErrors.city}</p>}
                      </div>
                    </div>
                  </div>
                </form>

                {/* Help Text */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Need help? <a href="tel:03302295040" className="text-orange-600 hover:underline font-medium">0330 229 5040</a>
                    {' '}or{' '}
                    <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline font-medium">WhatsApp us</a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SECTION 2: PLAN SUMMARY */}
          <div className="w-full">
            <Card className="border-2 border-gray-200 shadow-lg overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                {/* Plan Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                      🛡️ Your {formatPlanName()} Plan
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">{getDurationText()} Coverage</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onBack}
                    className="flex items-center gap-1 text-xs"
                  >
                    <Edit className="w-3 h-3" />
                    Change
                  </Button>
                </div>

                {/* Start Date - Compact */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        Cover starts: {startDate && isToday(startDate) ? 'Today' : startDate ? format(startDate, 'd MMM yyyy') : 'Today'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const picker = document.getElementById('start-date-picker');
                        picker?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-xs font-medium text-green-700 hover:text-green-800 underline"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Vehicle Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vehicle:</span>
                    <span className="font-semibold text-gray-900 uppercase">{vehicleData.make} {vehicleData.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registration:</span>
                    <span className="font-semibold text-gray-900 uppercase">{vehicleData.regNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Claim Limit:</span>
                    <span className="font-semibold text-gray-900">£{(updatedPricingData.claimLimit || 1250).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SECTION 3: CHOOSE PAYMENT - Premium Design */}
          <div className="w-full">
            {/* Header with Trust Signals */}
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
                Choose how you'd like to pay 🔒
              </h2>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-3">
                <Lock className="w-4 h-4 text-green-600" />
                <span>Secure Checkout</span>
              </div>
              <div className="flex justify-center">
                <TrustpilotHeader className="h-7" />
              </div>
            </div>

            {/* Savings Banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex items-center justify-center gap-2">
              <span className="text-lg">💷</span>
              <span className="text-sm font-medium text-green-800">
                <span className="font-bold text-green-700">Pay in Full</span> for extra savings
              </span>
            </div>

            {/* Payment Cards - Side by Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Pay Monthly Card */}
              <button
                type="button"
                onClick={() => setSelectedPayment('monthly')}
                className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                  selectedPayment === 'monthly'
                    ? 'border-orange-500 bg-orange-50/50 shadow-lg ring-2 ring-orange-200'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {/* 0% APR Badge */}
                <span className="absolute -top-3 left-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  0% APR
                </span>

                {/* Radio Circle */}
                <div className="flex items-start gap-3 mt-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                    selectedPayment === 'monthly' ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                  }`}>
                    {selectedPayment === 'monthly' && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Pay Monthly</h3>
                    <p className="text-sm text-gray-600 mb-2">Total: £{discountedBumperPrice.toLocaleString()}</p>
                    <p className="text-3xl font-bold text-gray-900 mb-1">
                      £{Math.floor(discountedBumperPrice / 12)}<span className="text-lg font-normal text-gray-600">/month</span>
                    </p>
                    <p className="text-sm text-gray-500 mb-4">Only 12 payments</p>

                    {/* Benefits */}
                    <div className="space-y-2">
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
                  </div>
                </div>

                {/* CTA Button */}
                <div className="mt-5">
                  <div className={`w-full py-3 rounded-lg font-bold text-center transition-colors ${
                    selectedPayment === 'monthly'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    Complete checkout
                  </div>
                </div>

                {/* Powered By */}
                <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                  <span className="text-xs text-gray-400">Powered by</span>
                  <img src={bumperLogo} alt="Bumper" className="h-5 mx-auto mt-1" />
                </div>
              </button>

              {/* Pay in Full Card */}
              <button
                type="button"
                onClick={() => setSelectedPayment('full')}
                className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                  selectedPayment === 'full'
                    ? 'border-green-500 bg-green-50/50 shadow-lg ring-2 ring-green-200'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {/* Best Value Badge */}
                <span className="absolute -top-3 left-4 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  BEST VALUE
                </span>

                {/* Radio Circle */}
                <div className="flex items-start gap-3 mt-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                    selectedPayment === 'full' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}>
                    {selectedPayment === 'full' && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Pay in Full</h3>
                    <p className="text-sm text-gray-500 mb-2 line-through">Was: £{bumperTotalPrice.toLocaleString()}</p>
                    <p className="text-3xl font-bold text-gray-900 mb-1">
                      £{discountedStripePrice.toLocaleString()}
                    </p>
                    <p className="text-sm text-green-600 font-semibold mb-4">You save £{savings}</p>

                    {/* Benefits */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span>Instant 10% discount</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span>Immediate cover</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span>No monthly payments</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="mt-5">
                  <div className={`w-full py-3 rounded-lg font-bold text-center transition-colors ${
                    selectedPayment === 'full'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    Complete checkout
                  </div>
                </div>

                {/* Powered By */}
                <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                  <span className="text-xs text-gray-400">Powered by</span>
                  <img src={stripeLogo} alt="Stripe" className="h-5 mx-auto mt-1" />
                </div>
              </button>
            </div>

            {/* Promo Code Section */}
            <Card className="border border-gray-200 shadow-sm mb-6">
              <CardContent className="p-4">
                <Collapsible open={promoOpen} onOpenChange={setPromoOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm text-gray-600 hover:text-gray-900">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      <span>Have a promo code?</span>
                    </div>
                    {promoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    {appliedDiscountCodes.length > 0 ? (
                      <div className="space-y-2">
                        {appliedDiscountCodes.map(discount => (
                          <div key={discount.code} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-2">
                            <div>
                              <span className="font-semibold text-green-800 text-sm">{discount.code}</span>
                              <span className="text-xs text-green-600 ml-2">
                                {discount.type === 'percentage' ? `${discount.value}% OFF` : `£${discount.value} OFF`}
                              </span>
                            </div>
                            <button
                              onClick={() => removePromoCode(discount.code)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter code"
                          value={promoCodeInput}
                          onChange={(e) => {
                            setPromoCodeInput(e.target.value.toUpperCase());
                            setPromoCodeError('');
                          }}
                          className="flex-1 text-sm"
                          disabled={isValidatingPromoCode}
                        />
                        <Button
                          onClick={applyPromoCode}
                          variant="outline"
                          size="sm"
                          disabled={!promoCodeInput.trim() || isValidatingPromoCode}
                        >
                          Apply
                        </Button>
                      </div>
                    )}
                    {promoCodeError && (
                      <p className="text-red-500 text-xs mt-1">{promoCodeError}</p>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Discount Applied Banner */}
                {hasValidDiscountCodes && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-700">Discount Applied:</span>
                      <span className="font-bold text-green-600">-£{Math.floor(totalDiscountAmount)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Primary CTA Button */}
            <Button
              onClick={processPayment}
              disabled={isLoading}
              className={`w-full py-6 text-lg font-bold rounded-xl shadow-lg animate-breathing ${
                selectedPayment === 'monthly'
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isLoading ? 'Processing...' : selectedPayment === 'monthly' ? 'Complete Monthly Checkout' : 'Complete Full Payment'}
            </Button>

            {/* Legal Text */}
            <p className="text-xs text-gray-500 text-center mt-3 mb-6">
              By completing your purchase, you agree to our{' '}
              <a href="/terms" className="underline hover:text-gray-700">Terms & Conditions</a>
              {' '}and{' '}
              <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a>.
            </p>

            {/* Footer Trust Section */}
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap text-xs text-gray-600 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-green-600" />
                    <span>SSL Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>Visa & Mastercard</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Secure Payments</span>
                  </div>
                </div>
                <div className="text-center text-sm text-gray-600">
                  Need help?{' '}
                  <a href="tel:03302295040" className="text-orange-600 hover:text-orange-700 font-medium">
                    Call us on 0330 229 5040
                  </a>
                  {' '}or{' '}
                  <a 
                    href="https://wa.me/447960128083" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    WhatsApp us
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamlinedCheckout;
