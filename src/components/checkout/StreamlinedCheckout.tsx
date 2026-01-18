import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, CheckCircle, Edit, CreditCard, MapPin, Check, Lock, ChevronDown, ChevronUp, Tag, Shield, AlertCircle, User, Car, X, Info } from 'lucide-react';
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
        // Handle both old full_name format and new first_name/last_name format
        let firstName = parsed.first_name || '';
        let lastName = parsed.last_name || '';
        
        // If we have full_name but not first/last, split it
        if (parsed.full_name && (!firstName || !lastName)) {
          const parts = parsed.full_name.trim().split(/\s+/).filter(Boolean);
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }
        
        return {
          ...parsed,
          first_name: firstName,
          last_name: lastName,
        };
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

  // Payment toggle state - null initially to require selection
  const [selectedPayment, setSelectedPayment] = useState<'monthly' | 'full' | null>('monthly');
  
  // Section states for collapsible accordion
  const [detailsOpen, setDetailsOpen] = useState(true);
  
  // Form states
  const [showValidation, setShowValidation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [validatedFields, setValidatedFields] = useState<{[key: string]: boolean}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  
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

  // Check section completion status - simplified for new form
  const personalDetailsComplete = useMemo(() => {
    return !!(
      customerData.first_name?.trim() &&
      customerData.first_name.trim().length >= 2 &&
      customerData.last_name?.trim() &&
      customerData.last_name.trim().length >= 2 &&
      customerData.email?.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email) &&
      customerData.phone?.trim() &&
      customerData.mileage
    );
  }, [customerData.first_name, customerData.last_name, customerData.email, customerData.phone, customerData.mileage]);

  // Count missing fields for the simplified section
  const personalDetailsMissing = useMemo(() => {
    let count = 0;
    if (!customerData.first_name?.trim() || customerData.first_name.trim().length < 2) count++;
    if (!customerData.last_name?.trim() || customerData.last_name.trim().length < 2) count++;
    if (!customerData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) count++;
    if (!customerData.phone?.trim()) count++;
    if (!customerData.mileage) count++;
    return count;
  }, [customerData]);

  // Track page load
  useEffect(() => {
    trackStripeCheckoutPageLoad();
  }, []);

  // Auto-validate pre-filled fields from Step 2 (First Name, Last Name, Email, Phone)
  useEffect(() => {
    const autoValidatePrefilledFields = () => {
      const fieldsToCheck = ['first_name', 'last_name', 'email', 'phone'];
      const newValidatedFields: { [key: string]: boolean } = {};

      fieldsToCheck.forEach(field => {
        const value = customerData[field as keyof typeof customerData];
        if (value && typeof value === 'string' && value.trim()) {
          let isValid = false;
          switch (field) {
            case 'first_name':
              isValid = value.trim().length >= 2;
              break;
            case 'last_name':
              isValid = value.trim().length >= 2;
              break;
            case 'email':
              isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
              break;
            case 'phone':
              const cleanedPhone = value.replace(/\s/g, '');
              isValid = /^(?:(?:\+44)|(?:0))(?:\d{10}|\d{9})$/.test(cleanedPhone);
              break;
          }
          if (isValid) {
            newValidatedFields[field] = true;
          }
        }
      });

      if (Object.keys(newValidatedFields).length > 0) {
        setValidatedFields(prev => ({ ...prev, ...newValidatedFields }));
      }
    };

    // Run on mount if we have pre-filled data
    autoValidatePrefilledFields();
  }, []); // Run once on mount

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
            full_name: customerData.full_name?.trim() || customerData.email,
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
  }, [customerData.email, customerData.full_name, customerData.phone, vehicleData, planName, paymentType]);

  // Save customer data to localStorage
  useEffect(() => {
    try {
      // Also save first_name and last_name for backwards compatibility
      const nameParts = customerData.full_name?.trim().split(' ') || [];
      const dataToSave = {
        ...customerData,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
      };
      localStorage.setItem('buyawarranty_customerData', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving customer data:', error);
    }
  }, [customerData]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setCustomerData((prev: typeof customerData) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Clear payment error when user interacts
    if (paymentError) setPaymentError('');
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
        } else if (customerData.first_name.trim().length < 2) {
          error = 'First name must be at least 2 characters';
          isValid = false;
        }
        break;
      case 'last_name':
        if (!customerData.last_name?.trim()) {
          error = 'Last name is required';
          isValid = false;
        } else if (customerData.last_name.trim().length < 2) {
          error = 'Last name must be at least 2 characters';
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
    const requiredFields = ['first_name', 'last_name', 'email', 'phone', 'mileage'];
    let allValid = true;
    
    requiredFields.forEach(field => {
      if (!validateField(field)) allValid = false;
    });
    
    return allValid;
  };

  // Helper function for input validation styling - makes errors very visible
  const getInputValidationClass = (field: string) => {
    if (showValidation && fieldErrors[field]) {
      return 'border-red-500 ring-2 ring-red-200 bg-red-50/50 focus:ring-red-300 focus:border-red-500';
    }
    if (validatedFields[field]) {
      return 'border-green-500 bg-green-50/30';
    }
    return '';
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
    setPaymentError('');
    
    // Check if payment option is selected
    if (!selectedPayment) {
      setPaymentError('Please choose a payment option to continue.');
      const paymentSection = document.getElementById('payment-section');
      paymentSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (!validateForm()) {
      // Open sections with errors
      if (!personalDetailsComplete) setDetailsOpen(true);
      
      const formSection = document.getElementById('customer-form');
      formSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast.error('Please complete all required fields above.');
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
      
      // Use separate first_name and last_name fields directly
      const firstName = customerData.first_name?.trim() || 'Customer';
      const lastName = customerData.last_name?.trim() || firstName; // Fallback if somehow empty
      
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-bumper-checkout', {
        body: {
          planId,
          vehicleData,
          paymentType,
          voluntaryExcess: updatedPricingData.voluntaryExcess,
          claimLimit: updatedPricingData.claimLimit || 1250,
          labourRate: pricingData.labourRate || 50,
          customerData: { 
            ...customerData, 
            first_name: firstName,
            last_name: lastName,
            final_amount: finalPrice 
          },
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
      
      // Use separate first_name and last_name fields directly
      const firstName = customerData.first_name?.trim() || '';
      const lastName = customerData.last_name?.trim() || '';
      
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout', {
        body: {
          planId,
          vehicleData,
          paymentType,
          voluntaryExcess: updatedPricingData.voluntaryExcess,
          claimLimit: updatedPricingData.claimLimit || 1250,
          labourRate: pricingData.labourRate || 50,
          customerData: { 
            ...customerData, 
            first_name: firstName,
            last_name: lastName,
            final_amount: finalPrice 
          },
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

  // Collapsed section error indicator
  const SectionErrorBadge = ({ count }: { count: number }) => (
    <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-full text-xs font-medium">
      <AlertCircle className="w-3.5 h-3.5" />
      <span>{count} field{count > 1 ? 's' : ''} missing</span>
    </div>
  );

  // Section complete badge
  const SectionCompleteBadge = () => (
    <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2.5 py-1 rounded-full text-xs font-medium">
      <CheckCircle className="w-3.5 h-3.5" />
      <span>Complete</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.removeItem('buyawarranty_originalPricingData');
              onBack();
            }}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
          <MobileNavigation />
        </div>


        <div className="space-y-4">
          {/* SECTION 1: PLAN SUMMARY - With Pricing */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-gradient-to-r from-slate-50 to-white">
            <CardContent className="p-4 sm:p-5">
              {/* Top Row: Plan Info + Pricing */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{formatPlanName()} Plan</h3>
                    <p className="text-sm text-slate-500">{getDurationText()} • {vehicleData.regNumber?.toUpperCase()}</p>
                  </div>
                </div>
                
                {/* Pricing Summary - Right Side */}
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                    £{monthlyPrice}<span className="text-base font-normal text-slate-500">/mo</span>
                  </div>
                  <p className="text-xs text-slate-500">12 monthly payments • 0% APR</p>
                </div>
              </div>
              
              {/* Pricing Details Bar */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-slate-600">
                    Or pay in full: <span className="line-through text-slate-400">£{bumperTotalPrice}</span>{' '}
                    <span className="font-semibold text-slate-900">£{stripeTotalPrice}</span>
                  </span>
                  <span className="text-green-600 font-medium">Save £{savings}!</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onBack}
                  className="text-slate-500 hover:text-slate-700 text-xs -mr-2"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Change
                </Button>
              </div>
              
              {/* Start Date */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div id="start-date-picker">
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
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2: YOUR DETAILS - Simplified */}
          <Card id="customer-form" className="border border-slate-200 shadow-sm overflow-hidden">
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      personalDetailsComplete ? 'bg-green-100' : showValidation && !personalDetailsComplete ? 'bg-red-100' : 'bg-slate-100'
                    }`}>
                      <User className={`w-5 h-5 ${
                        personalDetailsComplete ? 'text-green-600' : showValidation && !personalDetailsComplete ? 'text-red-600' : 'text-slate-600'
                      }`} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-slate-900">Your Details</h3>
                      <p className="text-sm text-slate-500">Just 5 quick fields to complete</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!detailsOpen && (
                      showValidation && personalDetailsMissing > 0 
                        ? <SectionErrorBadge count={personalDetailsMissing} />
                        : personalDetailsComplete && <SectionCompleteBadge />
                    )}
                    <div className="text-slate-400">
                      {detailsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                  {/* Name Fields - Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* First Name */}
                    <div>
                      <Label htmlFor="first_name" className="text-sm font-medium text-slate-700">First Name *</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="first_name"
                          placeholder="John"
                          value={customerData.first_name}
                          onChange={(e) => handleInputChange('first_name', e.target.value)}
                          onBlur={() => handleFieldBlur('first_name')}
                          required
                          className={`h-12 text-base ${getInputValidationClass('first_name')}`}
                        />
                        {validatedFields.first_name && !fieldErrors.first_name && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                      </div>
                      {showValidation && fieldErrors.first_name && (
                        <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {fieldErrors.first_name}
                        </p>
                      )}
                    </div>

                    {/* Last Name */}
                    <div>
                      <Label htmlFor="last_name" className="text-sm font-medium text-slate-700">Last Name *</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="last_name"
                          placeholder="Smith"
                          value={customerData.last_name}
                          onChange={(e) => handleInputChange('last_name', e.target.value)}
                          onBlur={() => handleFieldBlur('last_name')}
                          required
                          className={`h-12 text-base ${getInputValidationClass('last_name')}`}
                        />
                        {validatedFields.last_name && !fieldErrors.last_name && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                      </div>
                      {showValidation && fieldErrors.last_name && (
                        <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {fieldErrors.last_name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email Address *</Label>
                    <p className="text-xs text-slate-500 mt-0.5 mb-1.5">We'll send your policy documents here</p>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="john.smith@email.com"
                        value={customerData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        onBlur={() => handleFieldBlur('email')}
                        required
                        className={`h-12 text-base ${getInputValidationClass('email')}`}
                      />
                      {validatedFields.email && !fieldErrors.email && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {showValidation && fieldErrors.email && (
                      <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone Number *</Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="07123 456789"
                        value={customerData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        onBlur={() => handleFieldBlur('phone')}
                        required
                        className={`h-12 text-base ${getInputValidationClass('phone')}`}
                      />
                      {validatedFields.phone && !fieldErrors.phone && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {showValidation && fieldErrors.phone && (
                      <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  {/* Mileage */}
                  <div>
                    <Label htmlFor="mileage" className="text-sm font-medium text-slate-700">Current Mileage *</Label>
                    <div className="flex gap-2 mt-1.5">
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
                          className={`h-12 text-base ${getInputValidationClass('mileage')}`}
                        />
                        {validatedFields.mileage && !fieldErrors.mileage && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleInputChange('mileage', e.target.value);
                            setValidatedFields(prev => ({ ...prev, mileage: true }));
                          }
                        }}
                        className="h-12 px-3 rounded-lg border border-slate-200 bg-white text-sm cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Quick</option>
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
                    {showValidation && fieldErrors.mileage && (
                      <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldErrors.mileage}
                      </p>
                    )}
                  </div>

                  {/* Address Info Message */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Info className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">No address needed at checkout</p>
                        <p className="text-xs text-slate-500 mt-1">
                          You can update your address later in your customer dashboard. We only need it if you ever make a claim or update your policy.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* SECTION 3: PAYMENT SELECTION */}
          <div id="payment-section" className="space-y-4">
            <div className="text-center pt-2">
              <h2 className="text-xl font-bold text-slate-900">Choose Payment</h2>
              <div className="flex items-center justify-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Lock className="w-4 h-4 text-green-600" />
                  <span>Secure checkout</span>
                </div>
              </div>
            </div>

            {/* Payment Error Message */}
            {paymentError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-700 text-sm font-medium">{paymentError}</p>
              </div>
            )}

            {/* Payment Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pay Monthly Card */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPayment('monthly');
                  setPaymentError('');
                }}
                className={`relative text-left p-5 sm:p-6 rounded-2xl border-2 transition-all duration-200 ${
                  selectedPayment === 'monthly'
                    ? 'border-orange-500 bg-orange-50/50 shadow-lg ring-2 ring-orange-200'
                    : 'border-slate-200 bg-white hover:border-orange-300 hover:shadow-md'
                }`}
              >
                {/* Badge */}
                <span className="absolute -top-3 left-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  0% APR
                </span>

                <div className="flex items-start gap-3 mt-1">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all ${
                    selectedPayment === 'monthly' 
                      ? 'border-orange-500 bg-orange-500' 
                      : 'border-slate-300 bg-white'
                  }`}>
                    {selectedPayment === 'monthly' && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900">Pay Monthly</h3>
                    
                    {/* Price Display - Improved hierarchy */}
                    <div className="mt-3 mb-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-bold text-slate-900">£{Math.floor(discountedBumperPrice / 12)}</span>
                        <span className="text-base font-normal text-slate-600">/mo</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1.5 font-medium">12 easy payments • Total £{discountedBumperPrice}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>No credit impact</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>Spread the cost</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <img src={bumperLogo} alt="Bumper" className="h-5 opacity-70" />
                    </div>
                  </div>
                </div>
              </button>

              {/* Pay in Full Card */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPayment('full');
                  setPaymentError('');
                }}
                className={`relative text-left p-5 sm:p-6 rounded-2xl border-2 transition-all duration-200 ${
                  selectedPayment === 'full'
                    ? 'border-green-500 bg-green-50/50 shadow-lg ring-2 ring-green-200'
                    : 'border-slate-200 bg-white hover:border-green-300 hover:shadow-md'
                }`}
              >
                {/* Badge */}
                <span className="absolute -top-3 left-4 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  SAVE 10%
                </span>

                <div className="flex items-start gap-3 mt-1">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all ${
                    selectedPayment === 'full' 
                      ? 'border-green-500 bg-green-500' 
                      : 'border-slate-300 bg-white'
                  }`}>
                    {selectedPayment === 'full' && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900">Pay in Full</h3>
                    
                    {/* Price Display - Improved hierarchy with Was/Now/Save */}
                    <div className="mt-3 mb-3">
                      {/* Was price - muted with clear strikethrough */}
                      <p className="text-sm font-medium text-slate-400">
                        <span className="line-through decoration-2 decoration-slate-400">Was £{bumperTotalPrice}</span>
                      </p>
                      {/* Main price - bold and prominent */}
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl sm:text-4xl font-bold text-slate-900">£{discountedStripePrice}</span>
                      </div>
                      {/* Savings - green and encouraging */}
                      <p className="text-sm font-semibold text-green-600 mt-1.5">You save £{savings}!</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>Instant 10% off</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>One simple payment</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <img src={stripeLogo} alt="Stripe" className="h-5 opacity-70" />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Promo Code - Subtle, collapsed */}
            <div className="pt-2">
              <Collapsible open={promoOpen} onOpenChange={setPromoOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                  <Tag className="w-4 h-4" />
                  <span>Have a promo code?</span>
                  {promoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {appliedDiscountCodes.length > 0 ? (
                    <div className="space-y-2">
                      {appliedDiscountCodes.map(discount => (
                        <div key={discount.code} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-800 text-sm">{discount.code}</span>
                            <span className="text-xs text-green-600">
                              {discount.type === 'percentage' ? `${discount.value}% OFF` : `£${discount.value} OFF`}
                            </span>
                          </div>
                          <button
                            onClick={() => removePromoCode(discount.code)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
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
                        className="flex-1 h-10 placeholder:text-slate-500 placeholder:font-normal"
                        disabled={isValidatingPromoCode}
                      />
                      <Button
                        onClick={applyPromoCode}
                        variant="outline"
                        size="sm"
                        disabled={!promoCodeInput.trim() || isValidatingPromoCode}
                        className="h-10 px-4 bg-[#DFF5E3] border-[#6BBF7B] text-[#1a4d24] font-semibold hover:bg-[#c8ebd0] hover:border-[#4da85f]"
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                  {promoCodeError && (
                    <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {promoCodeError}
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Discount Applied Banner */}
              {hasValidDiscountCodes && !promoOpen && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">Discount Applied:</span>
                    <span className="font-bold text-green-600">-£{Math.floor(totalDiscountAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Primary CTA Button - Sticky on mobile */}
          <div className="sticky bottom-4 z-10 pt-4">
            <Button
              onClick={processPayment}
              disabled={isLoading}
              className={`w-full py-6 text-lg font-bold rounded-xl shadow-xl transition-all ${
                selectedPayment === 'monthly'
                  ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200/50'
                  : selectedPayment === 'full'
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200/50'
                  : 'bg-slate-400 text-white'
              } ${!isLoading && selectedPayment ? 'animate-breathing' : ''}`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="w-5 h-5" />
                  {selectedPayment === 'monthly' 
                    ? 'Complete Monthly Checkout' 
                    : selectedPayment === 'full'
                    ? 'Complete One-Time Payment'
                    : 'Select Payment Option'}
                </span>
              )}
            </Button>
            
            {/* Form error indicator on CTA */}
            {showValidation && !personalDetailsComplete && (
              <p className="text-center text-sm text-red-600 mt-3 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Please complete all required fields above
              </p>
            )}
            
            {/* Security text */}
            <p className="text-center text-xs text-slate-400 mt-3">
              Secure checkout — You have 14 days to cancel
            </p>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap justify-center gap-4 py-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-green-600" />
              <span>256-bit encryption</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-green-600" />
              <span>FCA regulated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span>Trusted by 10,000+ UK drivers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamlinedCheckout;
