import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, CheckCircle, CreditCard, MapPin, Check, Lock, ChevronDown, ChevronUp, Tag, Shield, AlertCircle, User, X, Info, Calendar, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackFormSubmission, trackBumperCheckoutClick, trackStripeCheckoutClick, trackStripeCheckoutPageLoad, trackStep4EmailEntry } from '@/utils/analytics';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { getAddOnInfo, normalizePaymentType, calculateAddOnPrice } from '@/lib/addOnsUtils';
import MobileNavigation from '@/components/MobileNavigation';
import bumperLogo from '@/assets/bumper-logo-transparent.png';
import stripeLogo from '@/assets/stripe-logo.png';
import { StartDatePicker } from '@/components/checkout/StartDatePicker';
import { startOfDay, format, isToday } from 'date-fns';
import { useMotMileage } from '@/hooks/useMotMileage';
import { AddressAutocomplete, AddressData } from '@/components/ui/address-autocomplete';

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
    monthlyPrice?: number;
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
        let firstName = parsed.first_name || '';
        let lastName = parsed.last_name || '';
        
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

  // Payment toggle state
  const [selectedPayment, setSelectedPayment] = useState<'monthly' | 'full' | null>('monthly');
  
  // Section states for collapsible accordion
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [addressExpanded, setAddressExpanded] = useState(false);
  
  // Address fields state - using canonical database field names
  const [addressData, setAddressData] = useState({
    street: '',
    building_name: '',
    building_number: '',
    flat_number: '',
    town: '',
    county: '',
    postcode: '',
  });
  
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

  // Pricing data state - ALWAYS use pricingData from Step 3 as source of truth
  const [updatedPricingData, setUpdatedPricingData] = useState(() => {
    localStorage.setItem('buyawarranty_originalPricingData', JSON.stringify(pricingData));
    return pricingData;
  });

  // Sync updatedPricingData when pricingData prop changes
  useEffect(() => {
    console.log('📊 Step 4: Syncing pricing from Step 3:', pricingData);
    setUpdatedPricingData(pricingData);
    localStorage.setItem('buyawarranty_originalPricingData', JSON.stringify(pricingData));
  }, [pricingData.totalPrice, pricingData.monthlyPrice]);

  // Track if customer originally selected "under 120k" on homepage
  const [originalMileageWasUnder120k] = useState(() => {
    const originalMileage = parseInt(vehicleData.mileage?.replace(/[^0-9]/g, '') || '0');
    return originalMileage <= 120000;
  });

  // Track if high mileage surcharge applies based on entered mileage
  const [highMileageSurchargeApplied, setHighMileageSurchargeApplied] = useState(false);
  const [highMileageSurchargeAmount, setHighMileageSurchargeAmount] = useState(0);
  
  // Fetch MOT mileage from database
  const { motMileage, motDate, isLoading: motLoading } = useMotMileage(vehicleData.regNumber);
  const [mileagePreFilled, setMileagePreFilled] = useState(false);
  
  // Pre-fill mileage from MOT data if customer hasn't entered one
  useEffect(() => {
    if (motMileage && !mileagePreFilled && !customerData.mileage) {
      console.log('✅ Pre-filling mileage from MOT:', motMileage);
      setCustomerData(prev => ({
        ...prev,
        mileage: String(motMileage)
      }));
      setValidatedFields(prev => ({ ...prev, mileage: true }));
      setMileagePreFilled(true);
    }
  }, [motMileage, mileagePreFilled, customerData.mileage]);

  // Calculate high mileage surcharge based on warranty duration
  const getHighMileageSurcharge = (enteredMileage: number): number => {
    if (enteredMileage > 120000 && enteredMileage <= 150000) {
      if (paymentType === '12months') return 200;
      if (paymentType === '24months') return 400;
      if (paymentType === '36months') return 600;
    }
    return 0;
  };

  // Effect to handle mileage change and recalculate pricing
  useEffect(() => {
    const enteredMileage = parseInt(customerData.mileage?.replace(/[^0-9]/g, '') || '0');
    
    if (originalMileageWasUnder120k && enteredMileage > 120000 && enteredMileage <= 150000) {
      const surcharge = getHighMileageSurcharge(enteredMileage);
      
      if (!highMileageSurchargeApplied || highMileageSurchargeAmount !== surcharge) {
        console.log('📊 High mileage surcharge applied:', { enteredMileage, surcharge, paymentType });
        setHighMileageSurchargeApplied(true);
        setHighMileageSurchargeAmount(surcharge);
        
        setUpdatedPricingData(prev => ({
          ...prev,
          totalPrice: pricingData.totalPrice + surcharge,
          monthlyPrice: Math.floor((pricingData.totalPrice + surcharge) / 12)
        }));
      }
    } else if (highMileageSurchargeApplied && (enteredMileage <= 120000 || enteredMileage > 150000)) {
      console.log('📊 High mileage surcharge removed:', { enteredMileage });
      setHighMileageSurchargeApplied(false);
      setHighMileageSurchargeAmount(0);
      setUpdatedPricingData(pricingData);
    }
  }, [customerData.mileage, originalMileageWasUnder120k, paymentType, pricingData.totalPrice]);

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

  // Calculate prices - ALWAYS use monthlyPrice from Step 3 as source of truth
  const monthlyPrice = updatedPricingData.monthlyPrice ?? Math.floor(updatedPricingData.totalPrice / 12);
  const bumperTotalPrice = monthlyPrice * 12;
  const stripeTotalPrice = Math.floor(bumperTotalPrice * 0.90);

  // Calculate discounts
  const hasValidDiscountCodes = appliedDiscountCodes.length > 0;
  const totalDiscountAmount = appliedDiscountCodes.reduce((sum, code) => sum + code.discountAmount, 0);
  const discountedBumperPrice = Math.floor(bumperTotalPrice - totalDiscountAmount);
  const discountedStripePrice = Math.floor(stripeTotalPrice - totalDiscountAmount);
  const savings = bumperTotalPrice - stripeTotalPrice;

  // Check section completion status
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

  // Count missing fields
  const personalDetailsMissing = useMemo(() => {
    let count = 0;
    if (!customerData.first_name?.trim() || customerData.first_name.trim().length < 2) count++;
    if (!customerData.last_name?.trim() || customerData.last_name.trim().length < 2) count++;
    if (!customerData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) count++;
    if (!customerData.phone?.trim()) count++;
    if (!customerData.mileage) count++;
    return count;
  }, [customerData]);

  // Track if component has been mounted (for bfcache handling)
  const hasMountedRef = React.useRef(false);
  const [isPageRestored, setIsPageRestored] = useState(false);

  // Auto-collapse details section when complete (only after initial render, not on bfcache restore)
  useEffect(() => {
    // Skip auto-collapse on initial mount or bfcache restore to prevent freezing
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    
    // Don't auto-collapse if page was just restored from bfcache
    if (isPageRestored) {
      setIsPageRestored(false);
      return;
    }
    
    if (personalDetailsComplete && detailsOpen) {
      const timer = setTimeout(() => {
        setDetailsOpen(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [personalDetailsComplete]);

  // Track page load
  useEffect(() => {
    trackStripeCheckoutPageLoad();
  }, []);

  // Auto-validate pre-filled fields from Step 2
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

    autoValidatePrefilledFields();
  }, []);

  // Reset loading on mount and handle bfcache restoration
  useEffect(() => {
    // Ensure loading is always false on mount
    setIsLoading(false);
    
    const handlePageShow = (event: PageTransitionEvent) => {
      console.log('📱 Step 4: pageshow event, persisted:', event.persisted);
      
      // Always reset loading state
      setIsLoading(false);
      
      // If page was restored from bfcache, mark it and reset states
      if (event.persisted) {
        console.log('📱 Step 4: Page restored from bfcache, resetting states');
        setIsPageRestored(true);
        setShowValidation(false);
        setPaymentError('');
        
        // Re-open details if not complete to prevent frozen collapsed state
        if (!personalDetailsComplete) {
          setDetailsOpen(true);
        }
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 Step 4: Page visible again, resetting loading');
        setIsLoading(false);
      }
    };
    
    // Use type assertion for pageshow event
    window.addEventListener('pageshow', handlePageShow as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [personalDetailsComplete]);

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

  // Save customer data to localStorage - preserve first_name/last_name directly
  useEffect(() => {
    try {
      const dataToSave = {
        ...customerData,
        first_name: customerData.first_name || '',
        last_name: customerData.last_name || '',
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
    
    if (!selectedPayment) {
      setPaymentError('Please choose a payment option to continue.');
      const paymentSection = document.getElementById('payment-section');
      paymentSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (!validateForm()) {
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
      
      const firstName = customerData.first_name?.trim() || 'Customer';
      const lastName = customerData.last_name?.trim() || firstName;
      
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
            final_amount: finalPrice,
            // Address fields with canonical database names
            street: addressData.street || '',
            building_name: addressData.building_name || '',
            building_number: addressData.building_number || '',
            flat_number: addressData.flat_number || '',
            town: addressData.town || '',
            county: addressData.county || '',
            postcode: addressData.postcode || '',
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
            final_amount: finalPrice,
            // Address fields with canonical database names
            street: addressData.street || '',
            building_name: addressData.building_name || '',
            building_number: addressData.building_number || '',
            flat_number: addressData.flat_number || '',
            town: addressData.town || '',
            county: addressData.county || '',
            postcode: addressData.postcode || '',
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
      <span>Completed</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Back Link */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.removeItem('buyawarranty_originalPricingData');
              onBack();
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted px-2 sm:px-3 py-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Plan Selection</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <MobileNavigation />
        </div>

        <div className="space-y-6 sm:space-y-8">
          
          {/* ==================== SECTION 1: VEHICLE PLAN DETAILS ==================== */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Vehicle Plan Details</h2>
            
            {/* Plan Summary Card */}
            <Card className="border border-border bg-card shadow-sm">
              <CardContent className="p-4 sm:p-5">
                {/* Plan Header with Change Link */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                    <span className="font-bold text-foreground">{formatPlanName()}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{getDurationText()}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-semibold text-foreground uppercase tracking-wide">{vehicleData.regNumber}</span>
                  </div>
                  <button 
                    onClick={onBack}
                    className="text-primary hover:text-primary/80 text-sm font-medium underline underline-offset-2 flex-shrink-0"
                  >
                    Change
                  </button>
                </div>

                {/* Price Summary Label */}
                <div className="mb-3">
                  <p className="text-sm font-semibold text-foreground mb-0.5">Price Summary</p>
                  <p className="text-xs text-muted-foreground">Includes your comprehensive {formatPlanName()} cover.</p>
                </div>

                {/* Two Column Pricing Layout */}
                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  {/* Monthly Column */}
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly</p>
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-2xl sm:text-3xl font-bold text-foreground">£{monthlyPrice}</span>
                      <span className="text-sm text-muted-foreground">/mo</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Total £{bumperTotalPrice}</p>
                    <p className="text-xs text-muted-foreground">12 payments • 0% APR</p>
                  </div>

                  {/* Pay in Full Column */}
                  <div className="space-y-0.5 text-right">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pay in Full</p>
                    <div className="flex items-baseline gap-2 justify-end flex-wrap">
                      <span className="text-2xl sm:text-3xl font-bold text-foreground">£{stripeTotalPrice}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-through">Was £{bumperTotalPrice}</p>
                    <p className="text-xs font-medium text-[hsl(var(--success))]">Save £{savings} (10% off)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reassurance Bar - Subtle, muted */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 px-3 mt-3 bg-muted/40 rounded-lg border border-border text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-muted-foreground" />
                14-day money-back guarantee
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-muted-foreground" />
                No hidden fees
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Secure checkout
              </span>
            </div>

            {/* Cover Start Date */}
            <Card className="border border-border bg-card shadow-sm mt-3">
              <CardContent className="p-3 sm:p-4">
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
              </CardContent>
            </Card>
          </section>

          {/* ==================== SECTION 2: CUSTOMER DETAILS ==================== */}
          <section>
            <Card id="customer-form" className="border border-border shadow-sm overflow-hidden bg-card">
              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors ${
                        personalDetailsComplete 
                          ? 'bg-[hsl(var(--success)/0.15)] border border-[hsl(var(--success)/0.3)]' 
                          : showValidation && !personalDetailsComplete 
                          ? 'bg-destructive/10 border border-destructive/20' 
                          : 'bg-muted border border-border'
                      }`}>
                        <User className={`w-4 h-4 sm:w-5 sm:h-5 ${
                          personalDetailsComplete 
                            ? 'text-[hsl(var(--success))]' 
                            : showValidation && !personalDetailsComplete 
                            ? 'text-destructive' 
                            : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="text-left">
                        <h2 className="text-base font-semibold text-foreground">Customer Details</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Just a few quick fields to complete.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {!detailsOpen && (
                        showValidation && personalDetailsMissing > 0 
                          ? <SectionErrorBadge count={personalDetailsMissing} />
                          : personalDetailsComplete && <SectionCompleteBadge />
                      )}
                      <div className="text-muted-foreground">
                        {detailsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="px-4 pb-5 space-y-4 border-t border-border/50 pt-4">
                    {/* Name Fields - Side by Side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* First Name */}
                      <div>
                        <Label htmlFor="first_name" className="text-sm font-medium text-foreground/80">First Name *</Label>
                        <div className="relative mt-1.5">
                          <Input
                            id="first_name"
                            placeholder="John"
                            value={customerData.first_name}
                            onChange={(e) => handleInputChange('first_name', e.target.value)}
                            onBlur={() => handleFieldBlur('first_name')}
                            required
                            className={`h-11 sm:h-12 text-base ${getInputValidationClass('first_name')}`}
                          />
                          {validatedFields.first_name && !fieldErrors.first_name && (
                            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                          )}
                        </div>
                        {showValidation && fieldErrors.first_name && (
                          <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {fieldErrors.first_name}
                          </p>
                        )}
                      </div>

                      {/* Last Name */}
                      <div>
                        <Label htmlFor="last_name" className="text-sm font-medium text-foreground/80">Last Name *</Label>
                        <div className="relative mt-1.5">
                          <Input
                            id="last_name"
                            placeholder="Enter surname"
                            value={customerData.last_name}
                            onChange={(e) => handleInputChange('last_name', e.target.value)}
                            onBlur={() => handleFieldBlur('last_name')}
                            required
                            className={`h-11 sm:h-12 text-base ${getInputValidationClass('last_name')}`}
                          />
                          {validatedFields.last_name && !fieldErrors.last_name && (
                            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                          )}
                        </div>
                        {showValidation && fieldErrors.last_name && (
                          <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {fieldErrors.last_name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-foreground/80">Email Address *</Label>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">We'll send your policy documents here.</p>
                      <div className="relative">
                        <Input
                          id="email"
                          type="email"
                          placeholder="john.smith@email.com"
                          value={customerData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          onBlur={() => handleFieldBlur('email')}
                          required
                          className={`h-11 sm:h-12 text-base ${getInputValidationClass('email')}`}
                        />
                        {validatedFields.email && !fieldErrors.email && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                        )}
                      </div>
                      {showValidation && fieldErrors.email && (
                        <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {fieldErrors.email}
                        </p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <Label htmlFor="phone" className="text-sm font-medium text-foreground/80">Phone Number *</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="07123 456789"
                          value={customerData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          onBlur={() => handleFieldBlur('phone')}
                          required
                          className={`h-11 sm:h-12 text-base ${getInputValidationClass('phone')}`}
                        />
                        {validatedFields.phone && !fieldErrors.phone && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                        )}
                      </div>
                      {showValidation && fieldErrors.phone && (
                        <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {fieldErrors.phone}
                        </p>
                      )}
                    </div>

                    {/* Mileage */}
                    <div>
                      <Label htmlFor="mileage" className="text-sm font-medium text-foreground/80">Current Mileage *</Label>
                      <div className="flex gap-2 mt-1.5">
                        <div className="relative flex-1">
                          {motLoading ? (
                            <div className="h-11 sm:h-12 flex items-center gap-2 px-3 border border-border rounded-lg bg-muted/30">
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Fetching from MOT history...</span>
                            </div>
                          ) : (
                            <Input
                              id="mileage"
                              type="text"
                              inputMode="numeric"
                              placeholder="e.g. 52,000"
                              value={customerData.mileage ? Number(customerData.mileage).toLocaleString('en-GB') : ''}
                              onChange={(e) => {
                                const rawValue = e.target.value.replace(/[^0-9]/g, '');
                                handleInputChange('mileage', rawValue);
                                setMileagePreFilled(false); // User is editing, so clear the pre-filled state
                              }}
                              onBlur={() => handleFieldBlur('mileage')}
                              required
                              className={`h-11 sm:h-12 text-base ${getInputValidationClass('mileage')}`}
                            />
                          )}
                          {!motLoading && validatedFields.mileage && !fieldErrors.mileage && (
                            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                          )}
                        </div>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleInputChange('mileage', e.target.value);
                              setValidatedFields(prev => ({ ...prev, mileage: true }));
                              setMileagePreFilled(false);
                            }
                          }}
                          className="h-11 sm:h-12 px-3 rounded-lg border border-border bg-card text-sm cursor-pointer hover:border-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Quick</option>
                          {Array.from({ length: 131 }, (_, i) => {
                            const value = 10000 + (i * 1000);
                            return <option key={value} value={value}>{value.toLocaleString('en-GB')}</option>;
                          })}
                        </select>
                      </div>
                      
                      {/* MOT Pre-fill Info Badge */}
                      {mileagePreFilled && motMileage && motDate && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <Info className="w-3.5 h-3.5" />
                          <span>
                            Pre-filled from your last MOT ({format(new Date(motDate), 'MMM yyyy')}) — feel free to update
                          </span>
                        </div>
                      )}
                      
                      {customerData.mileage && Number(customerData.mileage) > 150000 && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mt-2">
                          <p className="text-destructive text-sm font-medium">
                            Sorry, we only cover vehicles under 150,000 miles.
                          </p>
                        </div>
                      )}
                      {/* High Mileage Surcharge Banner */}
                      {highMileageSurchargeApplied && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 mt-2">
                          <div className="flex items-start gap-2 sm:gap-3">
                            <Info className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-amber-800">
                                Higher mileage? No problem!
                              </p>
                              <p className="text-xs text-amber-700 mt-0.5">
                                As your mileage is over 120,000 miles, we've updated your quote to include our higher mileage cover. Your new price is shown above.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {showValidation && fieldErrors.mileage && (
                        <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {fieldErrors.mileage}
                        </p>
                      )}
                    </div>

                    {/* Optional Address Section - Collapsible */}
                    <div 
                      className="rounded-xl overflow-hidden transition-all duration-200"
                      style={{ 
                        backgroundColor: '#F8F8F8', 
                        border: '1px solid #E5E5E5' 
                      }}
                    >
                      {/* Collapsed Header */}
                      <button
                        type="button"
                        onClick={() => setAddressExpanded(!addressExpanded)}
                        className="w-full p-4 flex items-center justify-between text-left transition-colors hover:bg-muted/60"
                        aria-expanded={addressExpanded}
                        aria-controls="address-fields"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: '#EFEFEF' }}
                          >
                            <MapPin className="w-4 h-4" style={{ color: '#8A8A8A' }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {addressExpanded ? 'Your Address' : 'No address needed now'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {addressExpanded 
                                ? 'Search or enter your address below' 
                                : 'You can add it later from your dashboard — or enter it now if you prefer.'
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!addressExpanded && (
                            <span 
                              className="text-xs font-medium px-4 py-2 rounded-full transition-colors whitespace-nowrap"
                              style={{ 
                                backgroundColor: '#FFFFFF', 
                                color: '#666666',
                                border: '1px solid #D0D0D0'
                              }}
                            >
                              Add address now
                            </span>
                          )}
                          {addressExpanded && (
                            <span 
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Hide
                            </span>
                          )}
                          <ChevronDown 
                            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${addressExpanded ? 'rotate-180' : ''}`} 
                          />
                        </div>
                      </button>

                      {/* Expanded Address Fields */}
                      <div 
                        id="address-fields"
                        className={`overflow-hidden transition-all duration-200 ease-in-out ${
                          addressExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/30">
                          {/* Address Autocomplete Search */}
                          <div>
                            <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2 mb-1.5">
                              <Search className="w-3.5 h-3.5" />
                              Find Your Address
                            </Label>
                            <AddressAutocomplete
                              placeholder="Start typing your postcode or address..."
                              onAddressSelect={(autocompleteData: AddressData) => {
                                setAddressData({
                                  street: autocompleteData.line_1 || '',
                                  building_name: autocompleteData.building_name || '',
                                  building_number: autocompleteData.building_number || '',
                                  flat_number: autocompleteData.line_2 || '',
                                  town: autocompleteData.town || '',
                                  county: autocompleteData.county || '',
                                  postcode: autocompleteData.postcode || '',
                                });
                              }}
                              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                            />
                            <p className="text-xs text-muted-foreground mt-1.5">
                              Type to search, then edit fields below if needed
                            </p>
                          </div>

                          {/* Manual Address Fields */}
                          <div className="grid grid-cols-1 gap-3">
                            {/* Building Number & Name */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="building_number" className="text-sm font-medium text-foreground/80">
                                  Building Number
                                </Label>
                                <Input
                                  id="building_number"
                                  placeholder="e.g. 123"
                                  value={addressData.building_number}
                                  onChange={(e) => setAddressData(prev => ({ ...prev, building_number: e.target.value }))}
                                  className="h-10 sm:h-11 text-sm mt-1 bg-white"
                                />
                              </div>
                              <div>
                                <Label htmlFor="building_name" className="text-sm font-medium text-foreground/80">
                                  Building Name <span className="text-muted-foreground font-normal">(optional)</span>
                                </Label>
                                <Input
                                  id="building_name"
                                  placeholder="e.g. Oak House"
                                  value={addressData.building_name}
                                  onChange={(e) => setAddressData(prev => ({ ...prev, building_name: e.target.value }))}
                                  className="h-10 sm:h-11 text-sm mt-1 bg-white"
                                />
                              </div>
                            </div>

                            {/* Street */}
                            <div>
                              <Label htmlFor="street" className="text-sm font-medium text-foreground/80">
                                Street
                              </Label>
                              <Input
                                id="street"
                                placeholder="e.g. High Street"
                                value={addressData.street}
                                onChange={(e) => setAddressData(prev => ({ ...prev, street: e.target.value }))}
                                className="h-10 sm:h-11 text-sm mt-1 bg-white"
                              />
                            </div>

                            {/* Flat Number (optional) */}
                            <div>
                              <Label htmlFor="flat_number" className="text-sm font-medium text-foreground/80">
                                Flat / Apartment <span className="text-muted-foreground font-normal">(optional)</span>
                              </Label>
                              <Input
                                id="flat_number"
                                placeholder="e.g. Flat 2"
                                value={addressData.flat_number}
                                onChange={(e) => setAddressData(prev => ({ ...prev, flat_number: e.target.value }))}
                                className="h-10 sm:h-11 text-sm mt-1 bg-white"
                              />
                            </div>

                            {/* Town/City and Postcode - Side by Side */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="town" className="text-sm font-medium text-foreground/80">
                                  Town / City
                                </Label>
                                <Input
                                  id="town"
                                  placeholder="e.g. London"
                                  value={addressData.town}
                                  onChange={(e) => setAddressData(prev => ({ ...prev, town: e.target.value }))}
                                  className="h-10 sm:h-11 text-sm mt-1 bg-white"
                                />
                              </div>
                              <div>
                                <Label htmlFor="postcode" className="text-sm font-medium text-foreground/80">
                                  Postcode
                                </Label>
                                <Input
                                  id="postcode"
                                  placeholder="e.g. SW1A 1AA"
                                  value={addressData.postcode}
                                  onChange={(e) => setAddressData(prev => ({ ...prev, postcode: e.target.value.toUpperCase() }))}
                                  className="h-10 sm:h-11 text-sm mt-1 bg-white"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Reassuring Note */}
                          <p className="text-xs text-muted-foreground pt-1">
                            Your address is optional — you can always update it later in your dashboard.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </section>

          {/* ==================== SECTION 3: HOW TO PAY ==================== */}
          <section id="payment-section" className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              How To Pay
            </h2>

            {/* Payment Error Message */}
            {paymentError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 sm:p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-destructive text-sm font-medium">{paymentError}</p>
              </div>
            )}

            {/* Payment Cards - Radio Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-4">
              {/* Pay Monthly Card */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPayment('monthly');
                  setPaymentError('');
                }}
                style={{
                  borderColor: selectedPayment === 'monthly' ? '#FF9A4C' : '#FFD9BF',
                  borderWidth: selectedPayment === 'monthly' ? '3px' : '2px',
                }}
                className={`relative text-left p-5 sm:p-5 rounded-xl bg-white transition-all duration-150 ${
                  selectedPayment === 'monthly'
                    ? 'shadow-md'
                    : 'hover:shadow-sm'
                }`}
              >
                {/* Badge - Soft orange tint */}
                <span 
                  className="absolute -top-2.5 left-4 text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#FF6B00', color: '#FFFFFF' }}
                >
                  0% APR
                </span>

                <div className="flex items-start gap-3 mt-1">
                  {/* Radio - Orange when active */}
                  <div 
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all duration-150"
                    style={{
                      borderColor: selectedPayment === 'monthly' ? '#FF6B00' : '#D1D5DB',
                      backgroundColor: selectedPayment === 'monthly' ? '#FF6B00' : 'white',
                    }}
                  >
                    {selectedPayment === 'monthly' && (
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">Monthly</h3>
                    
                    {/* Price Display */}
                    <div className="mt-3 mb-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-bold text-gray-900">£{Math.floor(discountedBumperPrice / 12)}</span>
                        <span className="text-sm font-medium text-gray-500">/mo</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Total £{discountedBumperPrice}</p>
                    </div>
                    
                    <div className="space-y-2">
                      {/* Tick icons - Brand Orange #FF6B00 */}
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#FF6B00' }} />
                        <span>No credit impact</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#FF6B00' }} />
                        <span>Spread the cost</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-100">
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
                style={{
                  borderColor: selectedPayment === 'full' ? '#7AD69D' : '#C8F3D2',
                  borderWidth: selectedPayment === 'full' ? '3px' : '2px',
                }}
                className={`relative text-left p-5 sm:p-5 rounded-xl bg-white transition-all duration-150 ${
                  selectedPayment === 'full'
                    ? 'shadow-md'
                    : 'hover:shadow-sm'
                }`}
              >
                {/* Badge - Soft orange tint */}
                <span 
                  className="absolute -top-2.5 left-4 text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#28A745', color: '#FFFFFF' }}
                >
                  Save 10%
                </span>

                <div className="flex items-start gap-3 mt-1">
                  {/* Radio - Green when active */}
                  <div 
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all duration-150"
                    style={{
                      borderColor: selectedPayment === 'full' ? '#28A745' : '#D1D5DB',
                      backgroundColor: selectedPayment === 'full' ? '#28A745' : 'white',
                    }}
                  >
                    {selectedPayment === 'full' && (
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">Pay in Full</h3>
                    
                    {/* Price Display */}
                    <div className="mt-3 mb-3">
                      <p className="text-sm text-gray-400 line-through">Was £{bumperTotalPrice}</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-2xl sm:text-3xl font-bold text-gray-900">£{discountedStripePrice}</span>
                      </div>
                      {/* Savings - Orange #FF6B00 */}
                      <p className="text-sm font-medium mt-1" style={{ color: '#1B5E20' }}>You save £{savings}!</p>
                    </div>
                    
                    <div className="space-y-2">
                      {/* Tick icons - Green #28A745 */}
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#28A745' }} />
                        <span>Instant 10% off</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#28A745' }} />
                        <span>One simple payment</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <img src={stripeLogo} alt="Stripe" className="h-5 opacity-70" />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Promo Code - Collapsed */}
            <div className="pt-2">
              <Collapsible open={promoOpen} onOpenChange={setPromoOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Tag className="w-4 h-4" />
                  <span>Have a promo code?</span>
                  {promoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {appliedDiscountCodes.length > 0 ? (
                    <div className="space-y-2">
                      {appliedDiscountCodes.map(discount => (
                        <div key={discount.code} className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-primary" />
                            <span className="font-semibold text-primary text-sm">{discount.code}</span>
                            <span className="text-xs text-primary/80">
                              {discount.type === 'percentage' ? `${discount.value}% OFF` : `£${discount.value} OFF`}
                            </span>
                          </div>
                          <button
                            onClick={() => removePromoCode(discount.code)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
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
                        className="flex-1 h-10 placeholder:text-muted-foreground placeholder:font-normal"
                        disabled={isValidatingPromoCode}
                      />
                      <Button
                        onClick={applyPromoCode}
                        variant="outline"
                        size="sm"
                        disabled={!promoCodeInput.trim() || isValidatingPromoCode}
                        className="h-10 px-4 border-primary/30 text-primary font-semibold hover:bg-primary/10"
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                  {promoCodeError && (
                    <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {promoCodeError}
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Discount Applied Banner */}
              {hasValidDiscountCodes && !promoOpen && (
                <div className="mt-3 bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-foreground/80">Discount Applied:</span>
                    <span className="font-bold text-primary">-£{Math.floor(totalDiscountAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* PRIMARY CTA BUTTON - Dynamic based on selection */}
            <div className="pt-4">
              <Button
                onClick={processPayment}
                disabled={isLoading || !selectedPayment}
                style={{
                  backgroundColor: !selectedPayment 
                    ? '#CCCCCC' 
                    : selectedPayment === 'monthly' 
                      ? '#FF6B00' 
                      : '#28A745',
                  borderColor: !selectedPayment 
                    ? '#B3B3B3' 
                    : selectedPayment === 'monthly' 
                      ? '#E05F00' 
                      : '#1F8A39',
                  cursor: !selectedPayment ? 'not-allowed' : 'pointer',
                }}
                className="w-full py-6 text-base sm:text-lg font-bold rounded-xl shadow-lg text-white border-2 transition-all duration-150 hover:opacity-90"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                    {selectedPayment === 'monthly' 
                      ? 'Complete Monthly Checkout' 
                      : selectedPayment === 'full'
                      ? 'Complete One-Time Payment'
                      : 'Select a payment option'}
                  </span>
                )}
              </Button>
              
              {/* Form error indicator */}
              {showValidation && !personalDetailsComplete && (
                <p className="text-center text-sm text-destructive mt-3 flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  Please complete all required fields above
                </p>
              )}
              
              {/* Security text */}
              <p className="text-center text-xs text-muted-foreground mt-3">
                🔒 Secure checkout processing
              </p>
            </div>
          </section>

          {/* TRUST SIGNALS */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 py-5 border-t border-border">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>256-bit encryption</span>
            </div>
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <img 
                src="/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" 
                alt="Trustpilot" 
                className="h-5 object-contain"
              />
              <span className="underline underline-offset-2">Rated Excellent</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamlinedCheckout;
