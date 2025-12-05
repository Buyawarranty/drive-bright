import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/protected-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CheckCircle, Edit, User, CreditCard, MapPin, X, ArrowUp, Check, ArrowRight, Lock, Car, Mail } from 'lucide-react';
import { PostcodeAutocomplete } from '@/components/ui/uk-postcode-autocomplete';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { trackFormSubmission, trackEvent } from '@/utils/analytics';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { getAddOnInfo, isAddOnAutoIncluded, normalizePaymentType, calculateAddOnPrice } from '@/lib/addOnsUtils';
import { EmailCapturePopup } from '@/components/EmailCapturePopup';
import MobileNavigation from '@/components/MobileNavigation';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import bumperLogo from '@/assets/bumper-logo-transparent.png';
import stripeLogo from '@/assets/stripe-logo.png';

export interface CustomerDetailsStepProps {
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

const CustomerDetailsStep: React.FC<CustomerDetailsStepProps> = ({ 
  vehicleData, 
  planId, 
  paymentType, 
  planName, 
  pricingData, 
  onBack, 
  onNext 
}) => {
  console.log('🏗️ CustomerDetailsStep mounted with props:', {
    vehicleData: vehicleData ? 'present' : 'missing',
    planId: planId ? 'present' : 'missing', 
    paymentType,
    planName,
    pricingData: pricingData ? 'present' : 'missing'
  });
  const [customerData, setCustomerData] = useState(() => {
    // Try to restore customer data from localStorage (iOS-safe)
    try {
      const savedCustomerData = localStorage.getItem('buyawarranty_customerData');
      if (savedCustomerData) {
        const parsed = JSON.parse(savedCustomerData);
        console.log('✅ Restored customer data from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('❌ Error restoring customer data (iOS/Safari):', error);
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
      marketing_opt_in: false,
      privacy_policy_accepted: false,
      terms_conditions_accepted: false,
      contact_method: 'email' as 'email' | 'phone'
    };
  });

  const [paymentMethod, setPaymentMethod] = useState<'bumper' | 'stripe'>('bumper');
  
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
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const { user } = useAuth();
  
  // State for managing updated pricing data when add-ons are removed
  const [updatedPricingData, setUpdatedPricingData] = useState(pricingData);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  
  // State for scroll-to-top button
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // State for seasonal offer
  const [seasonalOfferClaimed, setSeasonalOfferClaimed] = useState(false);
  
  // State for field validation
  const [validatedFields, setValidatedFields] = useState<{[key: string]: boolean}>({});

  // Scroll listener for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check for seasonal offer on mount
  useEffect(() => {
    const claimed = localStorage.getItem('seasonal_offer_claimed');
    setSeasonalOfferClaimed(claimed === 'true');

    // Listen for offer claim events
    const handleOfferClaimed = () => {
      setSeasonalOfferClaimed(true);
    };

    window.addEventListener('offerClaimed', handleOfferClaimed);
    return () => window.removeEventListener('offerClaimed', handleOfferClaimed);
  }, []);

  // Reset loading state when user returns from payment page via back button
  useEffect(() => {
    // Always reset loading state on mount (when returning to step 4)
    console.log('🔄 Component mounted - ensuring payment button is enabled');
    setIsLoadingPayment(false);

    const handlePageShow = (event: PageTransitionEvent) => {
      // If page is loaded from cache (back button), reset loading state
      console.log('🔄 Pageshow event - resetting payment state', { persisted: event.persisted });
      setIsLoadingPayment(false);
    };

    const handleVisibilityChange = () => {
      // Reset loading state when page becomes visible again
      if (document.visibilityState === 'visible') {
        console.log('👁️ Page visible again - resetting payment state');
        setIsLoadingPayment(false);
      }
    };

    const handleFocus = () => {
      // Reset loading state when window regains focus
      console.log('🎯 Window focused - resetting payment state');
      setIsLoadingPayment(false);
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Run only on mount
  
  // Recalculate pricing when initial pricingData changes (e.g., when add-ons are selected)
  useEffect(() => {
    console.log('🔧 CustomerDetailsStep - Pricing data updated:', {
      initialPricingData: pricingData,
      currentUpdatedPricingData: updatedPricingData
    });
    setUpdatedPricingData(pricingData);
  }, [pricingData]);

  // Track abandoned cart when email is filled in (with debounce)
  useEffect(() => {
    // Only track if we have a valid email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerData.email || !emailRegex.test(customerData.email)) {
      return;
    }

    console.log('📧 Valid email detected, scheduling abandoned cart tracking');

    // Debounce the API call by 2 seconds
    const timeoutId = setTimeout(async () => {
      try {
        console.log('🔔 Tracking abandoned cart for email:', customerData.email);
        
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

        console.log('✅ Abandoned cart tracked successfully for step 4');
      } catch (error) {
        console.error('❌ Error tracking abandoned cart:', error);
      }
    }, 2000); // Wait 2 seconds after user stops typing

    return () => clearTimeout(timeoutId);
  }, [customerData.email, customerData.first_name, customerData.last_name, customerData.phone, vehicleData.regNumber, vehicleData.make, vehicleData.model, vehicleData.year, vehicleData.mileage, planName, paymentType]);

  // Function to remove add-on and recalculate pricing
  const removeAddOn = (addOnKey: string) => {
    if (!updatedPricingData.protectionAddOns) return;
    
    // Get current add-on total price
    const durationMonths = getWarrantyDurationInMonths(paymentType);
    const currentAddOnPrice = calculateAddOnPrice(updatedPricingData.protectionAddOns, paymentType, durationMonths);
    
    // Update protection add-ons by removing the selected one
    const updatedAddOns = { ...updatedPricingData.protectionAddOns };
    
    // Handle both possible key formats
    if (addOnKey === 'wearTear' || addOnKey === 'wearAndTear') {
      updatedAddOns.wearTear = false;
      updatedAddOns.wearAndTear = false;
    } else {
      updatedAddOns[addOnKey as keyof typeof updatedAddOns] = false;
    }
    
    // Calculate new add-on total price
    const newAddOnPrice = calculateAddOnPrice(updatedAddOns, paymentType, durationMonths);
    const priceReduction = currentAddOnPrice - newAddOnPrice;
    
    // Update pricing data
    const newTotalPrice = updatedPricingData.totalPrice - priceReduction;
    setUpdatedPricingData({
      ...updatedPricingData,
      protectionAddOns: updatedAddOns,
      totalPrice: newTotalPrice
    });
    
    // Get add-on name for toast message
    const addOnInfos = getAddOnInfo(normalizePaymentType(paymentType), durationMonths);
    const addOnInfo = addOnInfos.find(addon => addon.key === addOnKey || 
      (addOnKey === 'wearTear' && addon.key === 'wearAndTear'));
    
    toast.success(`${addOnInfo?.name || 'Add-on'} removed from your policy`);
  };

  // Calculate pricing with discounts
  const bumperTotalPrice = updatedPricingData.totalPrice;
  const stripeTotalPrice = Math.round(updatedPricingData.totalPrice * 0.90);

  console.log('💰 CustomerDetailsStep - Pricing calculation:', {
    updatedPricingDataTotal: updatedPricingData.totalPrice,
    bumperTotalPrice,
    stripeTotalPrice
  });

  // Check for discount code on component mount and set up email popup timer
  useEffect(() => {
    try {
      // Check for auto-apply discount code from return banner
      const autoApplyCode = localStorage.getItem('autoApplyDiscountCode');
      if (autoApplyCode && autoApplyCode.startsWith('RETURN20-')) {
        setAppliedDiscountCodes([{
          code: autoApplyCode,
          type: 'percentage',
          value: 20,
          discountAmount: bumperTotalPrice * 0.20
        }]);
        // Clear the auto-apply flag
        localStorage.removeItem('autoApplyDiscountCode');
        toast.success('Your 20% return discount has been applied!');
      }
      
      // Check for second warranty discount code
      const savedDiscountCode = localStorage.getItem('secondWarrantyDiscountCode');
      if (savedDiscountCode && savedDiscountCode.startsWith('SECOND10-')) {
        setAppliedDiscountCodes(prev => {
          // Don't add if already applied
          if (prev.some(code => code.code === savedDiscountCode)) {
            return prev;
          }
          // Show success message
          toast.success('✓ Your discount code has been applied for checkout!');
          return [...prev, {
            code: savedDiscountCode,
            type: 'percentage',
            value: 10,
            discountAmount: bumperTotalPrice * 0.10
          }];
        });
      }
    } catch (error) {
      console.error('❌ Error checking discount codes (iOS/Safari):', error);
    }

    // Email popup DISABLED - not converting
    // Show email capture popup after 35 seconds
    const timer = setTimeout(() => {
      // setShowEmailPopup(true); // DISABLED
    }, 35000);

    return () => clearTimeout(timer);
  }, [bumperTotalPrice]);

  // Calculate total discount from all applied codes
  const totalDiscountAmount = appliedDiscountCodes.reduce((total, code) => total + code.discountAmount, 0);
  const hasValidDiscountCodes = appliedDiscountCodes.length > 0;
  const discountedPrice = hasValidDiscountCodes ? bumperTotalPrice - totalDiscountAmount : bumperTotalPrice;
  const discountedBumperPrice = Math.round(Math.max(discountedPrice, 0)); // Ensure price doesn't go negative
  const discountedStripePrice = Math.round(discountedPrice * 0.90); // 10% upfront discount on discounted price

  console.log('💸 CustomerDetailsStep - Final pricing:', {
    bumperTotalPrice,
    totalDiscountAmount,
    discountedPrice,
    discountedBumperPrice,
    monthlyPayment: Math.round(discountedBumperPrice / 12)
  });

  const hasSecondWarrantyDiscount = appliedDiscountCodes.some(code => code.code.startsWith('SECOND10-'));

  const handleInputChange = (field: string, value: string | boolean) => {
    const updatedData = { ...customerData, [field]: value };
    setCustomerData(updatedData);
    
    // Save to localStorage whenever customer data changes (iOS-safe)
    try {
      localStorage.setItem('buyawarranty_customerData', JSON.stringify(updatedData));
    } catch (error) {
      console.error('❌ Failed to save customer data (iOS/Safari):', error);
    }
    
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Real-time field validation for checkmarks
    if (typeof value === 'string' && value.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?1\d{3}|\(?01\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?2\d{2}|\(?02\d{2}\)?)\s?\d{3}\s?\d{4}$/;
      const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
      
      let isValid = false;
      
      if (field === 'email') {
        isValid = emailRegex.test(value);
      } else if (field === 'phone') {
        isValid = phoneRegex.test(value);
      } else if (field === 'postcode') {
        isValid = postcodeRegex.test(value);
      } else {
        isValid = value.trim().length > 0;
      }
      
      setValidatedFields(prev => ({ ...prev, [field]: isValid }));
    } else {
      setValidatedFields(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleFieldBlur = (field: string) => {
    const value = customerData[field as keyof typeof customerData];
    if (typeof value !== 'string') return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?1\d{3}|\(?01\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?2\d{2}|\(?02\d{2}\)?)\s?\d{3}\s?\d{4}$/;
    const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    
    let errorMessage = '';
    
    if (field === 'email') {
      if (!value.trim()) {
        errorMessage = 'Enter a valid email address.';
      } else if (!emailRegex.test(value)) {
        errorMessage = 'Enter a valid email address.';
      }
    } else if (field === 'phone') {
      if (!value.trim()) {
        errorMessage = 'Enter a phone number.';
      } else if (!phoneRegex.test(value)) {
        errorMessage = 'Enter a valid UK phone number.';
      }
    } else if (field === 'first_name') {
      if (!value.trim()) {
        errorMessage = 'Please enter your first name.';
      } else if (value.trim().length < 2) {
        errorMessage = 'Please enter your first name.';
      }
    } else if (field === 'last_name') {
      if (!value.trim()) {
        errorMessage = 'Please enter your last name.';
      } else if (value.trim().length < 2) {
        errorMessage = 'Please enter your last name.';
      }
    } else if (field === 'address_line_1') {
      if (!value.trim()) {
        errorMessage = 'Enter your street address.';
      } else if (value.trim().length < 3) {
        errorMessage = 'Enter your street address.';
      }
    } else if (field === 'city') {
      if (!value.trim()) {
        errorMessage = 'Enter your city or town.';
      } else if (value.trim().length < 2) {
        errorMessage = 'Enter your city or town.';
      }
    } else if (field === 'postcode') {
      if (!value.trim()) {
        errorMessage = 'Enter your postcode.';
      } else if (!postcodeRegex.test(value)) {
        errorMessage = 'Enter a valid UK postcode.';
      }
    }
    
    if (errorMessage) {
      setFieldErrors(prev => ({ ...prev, [field]: errorMessage }));
    }
  };

  const applyPromoCode = async () => {
    if (!promoCodeInput.trim()) {
      setPromoCodeError('Please enter a promo code');
      return;
    }

    // Check if code is already applied
    if (appliedDiscountCodes.some(code => code.code === promoCodeInput.trim())) {
      setPromoCodeError('This promo code is already applied');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: { 
          code: promoCodeInput.trim(),
          customerEmail: customerData.email,
          orderAmount: bumperTotalPrice
        }
      });

      if (error) throw error;

      if (data.valid) {
        const newDiscountCode = {
          code: promoCodeInput.trim(),
          type: data.discountCode.type,
          value: data.discountCode.value,
          discountAmount: data.discountCode.type === 'percentage' 
            ? (bumperTotalPrice * data.discountCode.value / 100)
            : data.discountCode.value
        };

        setAppliedDiscountCodes(prev => [...prev, newDiscountCode]);
        setPromoCodeInput('');
        setPromoCodeError('');
        
        const discountText = data.discountCode.type === 'percentage' 
          ? `${data.discountCode.value}% discount` 
          : `£${data.discountAmount.toFixed(2)} discount`;
        toast.success(`Promo code applied! ${discountText}`);
      } else {
        setPromoCodeError(data.error || 'Invalid or expired promo code');
      }
    } catch (error) {
      console.error('Error validating promo code:', error);
      setPromoCodeError('Unable to validate promo code. Please try again.');
    }
  };

  const removePromoCode = (codeToRemove: string) => {
    setAppliedDiscountCodes(prev => prev.filter(code => code.code !== codeToRemove));
    toast.success('Promo code removed');
  };

  const handleEmailPopupDiscountCode = (generatedCode: string) => {
    // Auto-apply the discount code from email popup
    const newDiscountCode = {
      code: generatedCode,
      type: 'fixed' as const,
      value: 25,
      discountAmount: 25
    };
    setAppliedDiscountCodes(prev => [...prev, newDiscountCode]);
    toast.success('£25 discount code applied automatically!');
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // UK phone number validation (landline and mobile)
    const phoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?1\d{3}|\(?01\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?2\d{2}|\(?02\d{2}\)?)\s?\d{3}\s?\d{4}$/;
    
    // UK postcode validation
    const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    
    if (!customerData.first_name.trim()) {
      errors.first_name = 'Please enter your first name.';
    } else if (customerData.first_name.trim().length < 2) {
      errors.first_name = 'Please enter your first name.';
    }
    
    if (!customerData.last_name.trim()) {
      errors.last_name = 'Please enter your last name.';
    } else if (customerData.last_name.trim().length < 2) {
      errors.last_name = 'Please enter your last name.';
    }
    
    if (!customerData.email.trim()) {
      errors.email = 'Enter a valid email address.';
    } else if (!emailRegex.test(customerData.email)) {
      errors.email = 'Enter a valid email address.';
    }
    
    if (!customerData.phone.trim()) {
      errors.phone = 'Enter a phone number.';
    } else if (!phoneRegex.test(customerData.phone)) {
      errors.phone = 'Enter a valid UK phone number.';
    }
    
    if (!customerData.address_line_1.trim()) {
      errors.address_line_1 = 'Enter your street address.';
    } else if (customerData.address_line_1.trim().length < 3) {
      errors.address_line_1 = 'Enter your street address.';
    }
    
    if (!customerData.city.trim()) {
      errors.city = 'Enter your city or town.';
    } else if (customerData.city.trim().length < 2) {
      errors.city = 'Enter your city or town.';
    }
    
    if (!customerData.postcode.trim()) {
      errors.postcode = 'Enter your postcode.';
    } else if (!postcodeRegex.test(customerData.postcode)) {
      errors.postcode = 'Enter a valid UK postcode.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    console.log('🚀 Submit button clicked - starting payment process');
    console.log('Payment method:', paymentMethod);
    console.log('Form data:', { planId, vehicleData, customerData });

    // Track abandoned cart BEFORE any validation or payment processing
    try {
      await supabase.functions.invoke('track-abandoned-cart', {
        body: {
          email: customerData.email || '',
          full_name: `${customerData.first_name} ${customerData.last_name}`.trim(),
          phone: customerData.phone || null,
          vehicle_reg: vehicleData.regNumber || null,
          vehicle_make: vehicleData.make || null,
          vehicle_model: vehicleData.model || null,
          vehicle_year: vehicleData.year || null,
          mileage: vehicleData.mileage || null,
          plan_id: planId || null,
          plan_name: planName || null,
          payment_type: paymentType || null,
          vehicle_type: vehicleData.bodyType || 'car',
          step_abandoned: 4,
          // Pricing details
          total_price: pricingData.totalPrice || 0,
          voluntary_excess: pricingData.voluntaryExcess || 0,
          claim_limit: pricingData.claimLimit || 1250,
          // Address for contact
          address: {
            flat_number: customerData.flat_number || '',
            building_name: customerData.building_name || '',
            building_number: customerData.building_number || '',
            street: customerData.street || '',
            town: customerData.town || '',
            county: customerData.county || '',
            postcode: customerData.postcode || '',
            country: customerData.country || 'United Kingdom'
          },
          // Protection add-ons
          protection_addons: pricingData.protectionAddOns || {}
        }
      });
      console.log('✅ Abandoned cart tracked with full details');
    } catch (error) {
      console.error('Failed to track abandoned cart:', error);
      // Don't block checkout if tracking fails
    }

    setShowValidation(true);
    
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      
      // Scroll to the form section on validation error (not top of page)
      const formSection = document.getElementById('customer-form-section');
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      toast.error('Please fill in all required fields', {
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fca5a5'
        }
      });
      trackEvent('form_validation_error', { form_name: 'customer_details' });
      
      return;
    }

    console.log('✅ Form validation passed');
    setIsLoadingPayment(true);

    // Track customer details form submission
    trackFormSubmission('customer_details', {
      payment_type: paymentType,
      payment_method: paymentMethod
    });

    try {
      const finalPrice = paymentMethod === 'stripe' ? discountedStripePrice : discountedBumperPrice;
      console.log('💰 Final price calculated:', finalPrice);
      
      // Process payment based on selected method
      if (paymentMethod === 'bumper') {
        console.log('🏦 Processing Bumper payment...');
        // Create Bumper checkout
        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-bumper-checkout', {
          body: {
            planId,
            vehicleData,
            paymentType,
            voluntaryExcess: updatedPricingData.voluntaryExcess,
            claimLimit: updatedPricingData.claimLimit || 1250,
            labourRate: pricingData.labourRate || 70,
            customerData: {
              ...customerData,
              final_amount: finalPrice
            },
            discountCode: appliedDiscountCodes.map(code => code.code).join(', '),
            finalAmount: finalPrice,
            addAnotherWarrantyRequested,
            protectionAddOns: {
              tyre: updatedPricingData.protectionAddOns?.tyre || false,
              wearAndTear: updatedPricingData.protectionAddOns?.wearAndTear || false,
              european: updatedPricingData.protectionAddOns?.european || false,
              breakdown: updatedPricingData.protectionAddOns?.breakdown || false,
              rental: updatedPricingData.protectionAddOns?.rental || false,
              transfer: updatedPricingData.protectionAddOns?.transfer || false,
              motRepair: false, // Not available in frontend selection
              motFee: updatedPricingData.protectionAddOns?.motFee || false,
              lostKey: false, // Not available in frontend selection
              consequential: false // Not available in frontend selection
            },
            seasonalBonusMonths: seasonalOfferClaimed ? 3 : 0
          }
        });

        console.log('Bumper response:', { checkoutData, checkoutError });

        if (checkoutError) {
          console.error('Bumper checkout error:', checkoutError);
          toast.error('Payment processing failed. Please try again.');
          setIsLoadingPayment(false);
          return;
        }

        if (checkoutData?.fallbackToStripe) {
          console.log('🔄 Falling back to Stripe...', checkoutData.fallbackReason);
          
          // Show user-friendly message about why we're falling back to Stripe
          const fallbackMessages = {
            missing_credentials: 'Monthly Interest-Free Credit is temporarily unavailable. Please pay the full amount instead.',
            no_customer_data: 'Unable to process monthly payments. Please pay the full amount instead.',
            credit_check_failed: 'Your credit application was not approved. Please pay the full amount instead.',
            error: 'Monthly Interest-Free Credit is temporarily unavailable. Please pay the full amount instead.'
          };
          
          const message = fallbackMessages[checkoutData.fallbackReason] || fallbackMessages.error;
          
          toast.error(message, {
            duration: 8000,
            action: {
              label: 'Continue with Card Payment',
              onClick: () => {
                // Auto-switch to Stripe payment method
                setPaymentMethod('stripe');
                toast.dismiss();
              }
            }
          });
          
          setIsLoadingPayment(false);
          return; // Don't automatically process Stripe - let user decide
        } else if (checkoutData?.url) {
          console.log('🌐 Redirecting to Bumper checkout:', checkoutData.url);
          
          // CRITICAL: Save step 4 state to localStorage BEFORE redirecting to Bumper
          // This ensures browser back button returns to step 4 with saved data
          const currentState = {
            step: 4,
            vehicleData,
            selectedPlan: { id: planId, paymentType, name: planName, pricingData: updatedPricingData },
            formData: customerData,
            timestamp: Date.now()
          };
          
          localStorage.setItem('warrantyJourneyState', JSON.stringify(currentState));
          localStorage.setItem('buyawarranty_currentStep', '4');
          localStorage.setItem('buyawarranty_customerData', JSON.stringify(customerData));
          localStorage.setItem('buyawarranty_returnedFromPayment', 'true');
          
          console.log('✅ Saved step 4 state before Bumper redirect');
          
          // Add step 4 to browser history so back button returns here
          const step4Url = `${window.location.origin}/?step=4`;
          window.history.pushState({ step: 4 }, '', step4Url);
          
          // Redirect to Bumper checkout
          window.location.href = checkoutData.url;
        } else {
          console.log('❌ No checkout URL received from Bumper');
          toast.error('Payment setup failed. Please try again.');
          setIsLoadingPayment(false);
        }
      } else {
        console.log('💳 Processing Stripe payment...');
        // Process Stripe payment
        await processStripeCheckout();
      }

      // Clear the discount codes after use
      if (appliedDiscountCodes.length > 0) {
        localStorage.removeItem('secondWarrantyDiscountCode');
        localStorage.removeItem('addAnotherWarrantyDiscount');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Payment processing failed. Please try again.');
      setIsLoadingPayment(false);
    }
  };

  const processStripeCheckout = async () => {
    const finalPrice = discountedStripePrice;
    console.log('💳 Processing Stripe checkout with price:', finalPrice);
    
    const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-stripe-checkout', {
      body: {
        planId,
        vehicleData,
        paymentType,
        voluntaryExcess: updatedPricingData.voluntaryExcess,
        claimLimit: updatedPricingData.claimLimit || 1250,
        labourRate: pricingData.labourRate || 70,
        customerData: {
          ...customerData,
          final_amount: finalPrice
        },
        protectionAddOns: {
          tyre: updatedPricingData.protectionAddOns?.tyre || false,
          wearAndTear: updatedPricingData.protectionAddOns?.wearAndTear || false,
          european: updatedPricingData.protectionAddOns?.european || false,
          breakdown: updatedPricingData.protectionAddOns?.breakdown || false,
          rental: updatedPricingData.protectionAddOns?.rental || false,
          transfer: updatedPricingData.protectionAddOns?.transfer || false,
          motRepair: false, // Not available in frontend selection
          motFee: updatedPricingData.protectionAddOns?.motFee || false,
          lostKey: false, // Not available in frontend selection
          consequential: false // Not available in frontend selection
        },
        discountCode: appliedDiscountCodes.map(code => code.code).join(', '),
        finalAmount: finalPrice,
        seasonalBonusMonths: seasonalOfferClaimed ? 3 : 0
      }
    });

    console.log('Stripe response:', { checkoutData, checkoutError });

    if (checkoutError) {
      console.error('Stripe checkout error:', checkoutError);
      toast.error('Payment processing failed. Please try again.');
      setIsLoadingPayment(false);
      return;
    }

    if (checkoutData?.url) {
      console.log('🌐 Redirecting to Stripe checkout:', checkoutData.url);
      
      // CRITICAL: Save step 4 state to localStorage BEFORE redirecting to Stripe
      // This ensures browser back button returns to step 4 with saved data
      const currentState = {
        step: 4,
        vehicleData,
        selectedPlan: { id: planId, paymentType, name: planName, pricingData: updatedPricingData },
        formData: customerData,
        timestamp: Date.now()
      };
      
      localStorage.setItem('warrantyJourneyState', JSON.stringify(currentState));
      localStorage.setItem('buyawarranty_currentStep', '4');
      localStorage.setItem('buyawarranty_customerData', JSON.stringify(customerData));
      localStorage.setItem('buyawarranty_returnedFromPayment', 'true');
      
      console.log('✅ Saved step 4 state before Stripe redirect');
      
      // Add step 4 to browser history so back button returns here
      const step4Url = `${window.location.origin}/?step=4`;
      window.history.pushState({ step: 4 }, '', step4Url);
      
      // Redirect to Stripe checkout
      window.location.href = checkoutData.url;
    } else {
      console.log('❌ No checkout URL received from Stripe');
      toast.error('Payment setup failed. Please try again.');
      setIsLoadingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header with Back Button, Logo and Mobile Menu */}
        <div className="flex justify-between items-center mb-8 relative">
          <Button
            onClick={onBack}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border-0 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Plans</span>
          </Button>
          <MobileNavigation />
        </div>

        {/* Customer Details Form */}
        <Card className="border border-gray-200 overflow-hidden">
          <CardContent className="p-4 sm:pt-6 sm:p-6 overflow-x-hidden">
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 max-w-full">
              {/* Left Column - Personal Details Form (order-2 on mobile, order-2 on desktop = right side) */}
              <div id="customer-form-section" className="w-full min-w-0 order-2 lg:order-2">
                <div className="bg-gray-100 rounded-lg p-4 sm:p-6">
                {/* Heading with Security Badge */}
                <div className="mb-6">
                  <div className="flex items-start gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">Almost done! Just confirm your details</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 ml-7 sm:ml-8">
                    Secure your warranty. Your details are safe.
                  </p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Information Section */}
                  <div className="space-y-4">
                    <div className="border-b border-gray-200 pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-600 flex-shrink-0" />
                          <h4 className="text-sm font-semibold text-gray-900 tracking-wide">Where should we send your policy?</h4>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200 self-start sm:self-auto">
                          <Lock className="w-3 h-3" />
                          <span className="font-medium">Secure & Encrypted</span>
                        </div>
                      </div>
                    </div>
                  
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
                          className={`mt-1 transition-all duration-300 ${
                            showValidation && fieldErrors.first_name 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'focus:ring-2 focus:ring-orange-200'
                          }`}
                        />
                        {validatedFields.first_name && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                      </div>
                      {fieldErrors.first_name && (
                        <p className="text-red-500 text-xs mt-1" role="alert" aria-live="polite">{fieldErrors.first_name}</p>
                      )}
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
                          className={`mt-1 transition-all duration-300 ${
                            showValidation && fieldErrors.last_name 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'focus:ring-2 focus:ring-orange-200'
                          }`}
                        />
                        {validatedFields.last_name && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                      </div>
                      {fieldErrors.last_name && (
                        <p className="text-red-500 text-xs mt-1" role="alert" aria-live="polite">{fieldErrors.last_name}</p>
                      )}
                    </div>
                  </div>

                  </div>
                  
                  {/* Email */}
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address *</Label>
                    <p className="text-xs text-gray-500 mt-0.5">For your policy documents</p>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="e.g., john.smith@email.com"
                        value={customerData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        onBlur={() => handleFieldBlur('email')}
                        required
                        className={`mt-1 transition-all duration-300 ${
                          showValidation && fieldErrors.email 
                            ? 'border-red-500 focus:border-red-500' 
                            : 'focus:ring-2 focus:ring-orange-200'
                        }`}
                      />
                      {validatedFields.email && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {fieldErrors.email && (
                      <p className="text-red-500 text-xs mt-1" role="alert" aria-live="polite">{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number *</Label>
                    <p className="text-xs text-gray-500 mt-0.5">e.g., 07123 456789 (UK mobile or landline)</p>
                    <div className="relative">
                      <Input
                        id="phone"
                        type="tel"
                        placeholder=""
                        value={customerData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        onBlur={() => handleFieldBlur('phone')}
                        required
                        className={`mt-1 transition-all duration-300 ${
                          showValidation && fieldErrors.phone 
                            ? 'border-red-500 focus:border-red-500' 
                            : 'focus:ring-2 focus:ring-orange-200'
                        }`}
                      />
                      {validatedFields.phone && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {fieldErrors.phone && (
                      <p className="text-red-500 text-xs mt-1" role="alert" aria-live="polite">{fieldErrors.phone}</p>
                    )}
                  </div>

                  {/* Address Section */}
                  <div className="space-y-4">
                    <div className="border-b border-gray-200 pb-2 pt-2">
                      <h4 className="text-sm font-semibold text-gray-900 tracking-wide">Address for your warranty</h4>
                    </div>
                    <div>
                      <Label htmlFor="address_line_1" className="text-sm font-medium text-gray-700">Address Line 1 *</Label>
                      <div className="relative">
                        <Input
                          id="address_line_1"
                          placeholder="Enter your street address"
                          value={customerData.address_line_1}
                          onChange={(e) => handleInputChange('address_line_1', e.target.value)}
                          onBlur={() => handleFieldBlur('address_line_1')}
                          required
                          className={`mt-1 transition-all duration-300 ${
                            showValidation && fieldErrors.address_line_1 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'focus:ring-2 focus:ring-orange-200'
                          }`}
                        />
                        {validatedFields.address_line_1 && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                      </div>
                      {fieldErrors.address_line_1 && (
                        <p className="text-red-500 text-xs mt-1" role="alert" aria-live="polite">{fieldErrors.address_line_1}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="address_line_2" className="text-sm font-medium text-gray-700">Address Line 2</Label>
                      <Input
                        id="address_line_2"
                        placeholder="Apartment, suite, etc. (optional)"
                        value={customerData.address_line_2}
                        onChange={(e) => handleInputChange('address_line_2', e.target.value)}
                        className="mt-1 focus:ring-2 focus:ring-orange-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="postcode" className="text-sm font-medium text-gray-700">Postcode *</Label>
                        <div className="relative">
                          <PostcodeAutocomplete
                            value={customerData.postcode}
                            onChange={(value) => handleInputChange('postcode', value)}
                            onBlur={() => handleFieldBlur('postcode')}
                            onAddressSelect={(address) => {
                              // Auto-populate address fields when postcode is selected
                              if (address.town) {
                                handleInputChange('city', address.town);
                              }
                              if (address.street && !customerData.address_line_1) {
                                handleInputChange('address_line_1', address.street);
                              }
                            }}
                            placeholder="e.g., SW1A 1AA (auto-fills your town)"
                            required
                            className={`${
                              showValidation && fieldErrors.postcode 
                                ? 'border-red-500 focus:border-red-500' 
                                : ''
                            }`}
                            error={fieldErrors.postcode}
                          />
                          {validatedFields.postcode && (
                            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600 z-10" />
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="city" className="text-sm font-medium text-gray-700">City/Town *</Label>
                        <div className="relative">
                          <Input
                            id="city"
                            placeholder="Enter your city or town"
                            value={customerData.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            onBlur={() => handleFieldBlur('city')}
                            required
                            className={`mt-1 transition-all duration-300 ${
                              showValidation && fieldErrors.city 
                                ? 'border-red-500 focus:border-red-500' 
                                : 'focus:ring-2 focus:ring-orange-200'
                            }`}
                          />
                          {validatedFields.city && (
                            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                          )}
                        </div>
                        {fieldErrors.city && (
                          <p className="text-red-500 text-xs mt-1" role="alert" aria-live="polite">{fieldErrors.city}</p>
                        )}
                      </div>
                    </div>
                  </div>

                </form>
                </div>
              </div>

              {/* Right Column - Order Summary (order-1 on mobile, order-1 on desktop = left side) */}
              <div className="space-y-6 order-1 lg:order-1">
                <div className="bg-gray-100 rounded-lg p-4 sm:p-6">
                {/* Order Summary Card */}
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border overflow-hidden">
                  <div className="flex items-start justify-between mb-4 gap-2">
                    <h2 className="text-lg sm:text-2xl font-bold text-black flex-1 min-w-0">
                      {(() => {
                        // Format plan name: "Your platinum vehicle plan is ready"
                        const formattedPlanName = planName
                          .toLowerCase()
                          .replace(/car/gi, 'vehicle')
                          .replace(/plan/gi, '')
                          .replace(/premium/gi, 'platinum')
                          .trim();
                        return `🛡️ Your ${formattedPlanName} plan is ready`;
                      })()}
                    </h2>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={onBack}
                      className="flex items-center gap-1 sm:gap-2 flex-shrink-0 text-xs sm:text-sm"
                    >
                      <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                      Change
                    </Button>
                  </div>
                  
                  {/* Trust Badge */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
                    <div className="flex items-start gap-2 text-black text-sm">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>Cancel anytime within 14 days for a full refund</span>
                    </div>
                  </div>

                   {/* Plan Details - Clean Bullet Style */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-black text-xs sm:text-sm flex-shrink-0">Plan:</span>
                      <span className="font-semibold text-black text-xs sm:text-sm text-right truncate">{
                        (() => {
                          // Extract just the plan tier name (e.g., "Platinum", "Gold", "Silver")
                          const cleanPlanName = planName
                            .replace(/vehicle/gi, '')
                            .replace(/car/gi, '')
                            .replace(/bike/gi, '')
                            .replace(/plan/gi, '')
                            .replace(/premium/gi, 'Platinum')
                            .trim();
                          return cleanPlanName || 'Platinum';
                        })()
                      }</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-black text-xs sm:text-sm flex-shrink-0">Duration:</span>
                      <span className="font-semibold text-black text-xs sm:text-sm text-right">{paymentType === '12months' 
                        ? '1 Year'
                        : paymentType === '24months' 
                          ? '2 Years'
                          : '3 Years'
                      }</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-black text-xs sm:text-sm flex-shrink-0">Vehicle:</span>
                      <span className="font-semibold text-black text-xs sm:text-sm uppercase text-right truncate">{vehicleData.make} {vehicleData.model}</span>
                    </div>
                     <div className="flex justify-between items-center gap-2">
                       <span className="text-black text-xs sm:text-sm flex-shrink-0">Mileage:</span>
                       <span className="font-semibold text-black text-xs sm:text-sm text-right">{parseInt(vehicleData.mileage || '0').toLocaleString()} miles</span>
                     </div>
                     <div className="flex justify-between items-center gap-2">
                       <span className="text-black text-xs sm:text-sm flex-shrink-0">Claim Limit:</span>
                       <span className="font-semibold text-black text-xs sm:text-sm text-right">£{(pricingData.claimLimit || 2000).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center gap-2">
                        <span className="text-black text-xs sm:text-sm flex-shrink-0">Labour Rate:</span>
                        <span className="font-semibold text-black text-xs sm:text-sm text-right">
                          £{pricingData.labourRate || 70}/hour
                        </span>
                      </div>
                     <div className="flex justify-between items-center gap-2">
                       <span className="text-black text-xs sm:text-sm flex-shrink-0">Excess:</span>
                       <span className="font-semibold text-black text-xs sm:text-sm text-right">£{updatedPricingData.voluntaryExcess ?? 0}</span>
                     </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-black text-xs sm:text-sm flex-shrink-0">Registration:</span>
                      <span className="font-semibold text-black text-xs sm:text-sm text-right">{vehicleData.regNumber}</span>
                    </div>

                      {/* Payment Summary - Mobile First */}
                      <div className="border-t pt-4 mt-4 space-y-3">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-black text-xs sm:text-sm font-medium">Pay Monthly:</span>
                            <div className="text-right">
                              <span className="font-bold text-black text-sm sm:text-base">£{Math.round(discountedBumperPrice / 12)}/month</span>
                              <span className="block text-xs text-orange-600 font-medium">12 interest-free payments</span>
                              <span className="block text-xs text-gray-600 font-medium">Total: £{Math.round(discountedBumperPrice / 12) * 12}</span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-black text-xs sm:text-sm font-medium">Pay in Full:</span>
                            <div className="text-right">
                              <span className="font-bold text-black text-sm sm:text-base">£{discountedStripePrice}</span>
                              <span className="block text-xs text-green-600 font-medium">Save £{discountedBumperPrice - discountedStripePrice} today</span>
                              <span className="block text-xs text-gray-600 font-medium">Total: £{discountedStripePrice} (10% off)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    
                    {/* Add-ons Section */}
                    {updatedPricingData.protectionAddOns && Object.values(updatedPricingData.protectionAddOns).some(Boolean) && (
                      <div className="border-t pt-4">
                        {(() => {
                          // Get duration in months and normalize payment type
                          const durationMonths = getWarrantyDurationInMonths(paymentType);
                          const normalizedPaymentType = normalizePaymentType(paymentType);
                          const addOnInfos = getAddOnInfo(normalizedPaymentType, durationMonths);
                          
                          // Separate paid and free add-ons
                          const paidAddOns: any[] = [];
                          const freeAddOns: any[] = [];
                          
                          addOnInfos.forEach(addOn => {
                            // Check if this add-on is selected
                            let isSelected = false;
                            
                            // Map different key formats
                            const keyMappings: { [key: string]: string } = {
                              'wearAndTear': 'wearTear'
                            };
                            
                            const mappedKey = keyMappings[addOn.key] || addOn.key;
                            
                            // Check both the original key and mapped key
                            if (updatedPricingData.protectionAddOns) {
                              isSelected = Boolean(
                                updatedPricingData.protectionAddOns[addOn.key as keyof typeof updatedPricingData.protectionAddOns] || 
                                updatedPricingData.protectionAddOns[mappedKey as keyof typeof updatedPricingData.protectionAddOns]
                              );
                            }
                            
                            if (isSelected) {
                              if (addOn.isAutoIncluded) {
                                freeAddOns.push(addOn);
                              } else {
                                paidAddOns.push(addOn);
                              }
                            }
                          });
                          
                          return (
                            <>
                              {/* Display Paid Add-ons */}
                              {paidAddOns.length > 0 && (
                                <div className="mb-4">
                                  <div className="mb-2">
                                    <span className="text-black font-medium">Additional Protection</span>
                                  </div>
                                  <div className="space-y-3">
                                    {paidAddOns.map(addOn => {
                                      // Calculate display price matching step 3 format
                                      let priceDisplay;
                                      let priceSubtext;
                                      
                                      if (addOn.oneTimePrice) {
                                        // One-time fee (e.g., Transfer Cover)
                                        priceDisplay = `Just £${addOn.oneTimePrice} one-time fee`;
                                        priceSubtext = null;
                                      } else {
                                        // Monthly add-on - spread over 12 payments
                                        const totalCost = addOn.monthlyPrice * durationMonths;
                                        const monthlyPayment = totalCost / 12;
                                        priceDisplay = `Only £${monthlyPayment.toFixed(2)} per month`;
                                        
                                        // Determine duration text
                                        const durationText = paymentType === '12months' ? '1 year' : 
                                                           paymentType === '24months' ? '2 years' : 
                                                           '3 years';
                                        priceSubtext = `12 interest-free payments for ${durationText}' cover`;
                                      }
                                      
                                      return (
                                        <div key={addOn.key} className="group hover:bg-gray-50 -mx-2 px-2 py-2 rounded">
                                          <div className="flex items-start justify-between">
                                            <div className="flex items-start flex-1">
                                              <span className="text-orange-600 mr-2 mt-0.5">+</span>
                                              <div className="flex-1">
                                                <span className="text-sm text-gray-700 block">{addOn.name}</span>
                                                <div className="mt-1">
                                                  <div className="text-sm text-gray-900 font-medium">
                                                    {priceDisplay}
                                                  </div>
                                                  {priceSubtext && (
                                                    <div className="text-xs text-gray-600 mt-0.5">
                                                      {priceSubtext}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => removeAddOn(addOn.key)}
                                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              {/* Display Free Add-ons */}
                              {freeAddOns.length > 0 && (
                                <div className={paidAddOns.length > 0 ? "border-t pt-4" : ""}>
                                  <div className="mb-2">
                                    <span className="text-black font-medium">Included Protection</span>
                                  </div>
                                  <div className="space-y-1">
                                    {freeAddOns.map(addOn => (
                                      <div key={addOn.key} className="flex items-center justify-between">
                                        <div className="flex items-center">
                                          <span className="text-green-600 mr-2">✓</span>
                                          <span className="text-sm text-gray-700">{addOn.name}</span>
                                        </div>
                                        <span className="text-sm text-green-600 font-medium">FREE</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    
                    {/* Promo Code Section */}
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Promo Codes</span>
                        {hasValidDiscountCodes && (
                          <span className="text-sm text-gray-500">
                            {appliedDiscountCodes.length} applied
                          </span>
                        )}
                      </div>
                      
                      {/* Applied Discount Codes */}
                      {appliedDiscountCodes.map((discount, index) => (
                        <div key={discount.code} className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-semibold text-green-800">{discount.code}</span>
                              <span className="text-xs text-green-600">
                                {discount.type === 'percentage' ? `${discount.value}% OFF` : `£${discount.value} OFF`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-green-600 font-medium">-£{discount.discountAmount.toFixed(2)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removePromoCode(discount.code)}
                                className="text-red-600 hover:text-red-800 h-auto p-1"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Add New Promo Code */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter another promo code"
                            value={promoCodeInput}
                            onChange={(e) => {
                              setPromoCodeInput(e.target.value.toUpperCase());
                              setPromoCodeError('');
                            }}
                            className="flex-1"
                          />
                          <Button
                            onClick={applyPromoCode}
                            variant="outline"
                            size="sm"
                            disabled={!promoCodeInput.trim()}
                          >
                            Apply
                          </Button>
                        </div>
                        {promoCodeError && (
                          <p className="text-red-500 text-xs">{promoCodeError}</p>
                        )}
                      </div>

                      {/* Total Discount Summary */}
                      {(hasValidDiscountCodes || seasonalOfferClaimed) && (
                        <div className="mt-3 pt-3 border-t border-green-200 space-y-2">
                          {hasValidDiscountCodes && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-gray-700">Total Discount:</span>
                              <span className="font-bold text-green-600">-£{totalDiscountAmount.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
                </div>
              </div>

              {/* Payment Methods Section (order-3 on mobile) */}
              <div className="order-3 lg:col-span-2 space-y-6 bg-gradient-to-b from-gray-50 to-white rounded-2xl p-6 lg:p-8">
                      {/* Section Header */}
                       <div className="text-center space-y-3">
                          <h3 className="text-2xl font-bold text-black mb-2">
                           Choose how you'd like to pay 🔒
                          </h3>
                         <div className="flex items-center justify-center gap-2 text-sm text-black">
                           <Lock className="w-4 h-4 text-green-600" />
                           <span>Secure Checkout</span>
                         </div>
                         {/* Trustpilot Logo */}
                         <div className="flex justify-center pt-2">
                           <TrustpilotHeader className="h-8" />
                         </div>
                       </div>

                    <RadioGroup value={paymentMethod} onValueChange={(value: 'bumper' | 'stripe') => setPaymentMethod(value)}>
                      {/* Side-by-side Payment Cards - Constrained width on desktop */}
                      <div className="lg:max-w-2xl lg:mx-auto space-y-4">
                        {/* Social Proof */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center flex items-center justify-center gap-2">
                          <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">£</span>
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            <span className="font-bold text-green-700">Pay in Full</span> for extra savings
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* OPTION A: Pay in Full (Stripe) */}
                        <div 
                          onClick={() => setPaymentMethod('stripe')}
                          className={`relative rounded-xl p-5 cursor-pointer transition-all duration-300 border-2 w-full ${
                            paymentMethod === 'stripe' 
                              ? 'bg-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          {/* Best Value Badge - GREEN */}
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md uppercase">
                            BEST VALUE
                          </div>

                          {/* Radio Button and Limited Time Badge */}
                          <div className="flex items-start justify-between mb-3">
                            <RadioGroupItem 
                              value="stripe" 
                              id="stripe-option" 
                              className="border-2 border-gray-400 w-6 h-6 mt-0.5 data-[state=checked]:border-green-600 data-[state=checked]:border-[3px]"
                            />
                            {/* Limited Time Badge - GREY */}
                            <div className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded uppercase">
                              LIMITED TIME
                            </div>
                          </div>

                          {/* Wallet Icon */}
                          <div className="flex justify-center mb-3">
                            <div className="bg-green-100 p-3 rounded-full">
                              <CreditCard className="w-6 h-6 text-green-600" />
                            </div>
                          </div>

                          {/* Heading */}
                          <Label htmlFor="stripe-option" className="block text-center cursor-pointer mb-2">
                            <h4 className="text-lg font-bold text-black mb-1">Pay in Full</h4>
                            <p className="text-xs font-bold text-gray-700">One-time payment today</p>
                          </Label>

                          {/* Price Display - Clean & Integrated */}
                          <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
                            <div className="text-center">
                              <div className="text-4xl font-black text-black mb-1">£{discountedStripePrice}</div>
                              <div className="inline-block bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                Save £{discountedBumperPrice - discountedStripePrice} today
                              </div>
                              <div className="text-sm font-bold text-gray-600 mt-1">
                                (normally £{discountedBumperPrice})
                              </div>
                            </div>
                          </div>

                          {/* Features - GREEN TICKS */}
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-black font-medium">Instant 10% discount</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-black font-medium">Immediate cover</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-black font-medium">No monthly payments</span>
                            </div>
                          </div>

                          {/* CTA inside box */}
                          <Button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentMethod('stripe');
                              setTimeout(() => handleSubmit(), 50);
                            }}
                            disabled={isLoadingPayment}
                            className="w-full font-bold py-2.5 rounded-lg transition-colors shadow-lg bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50"
                          >
                            {isLoadingPayment && paymentMethod === 'stripe' ? 'Processing...' : 'Complete checkout'}
                          </Button>

                          {/* Powered By */}
                          <div className="text-center pt-2 border-t mt-3">
                            <span className="text-xs text-black block mb-1">Powered by</span>
                            <img src={stripeLogo} alt="Stripe" className="h-5 mx-auto" />
                          </div>
                        </div>

                        {/* OPTION B: Pay Monthly (Bumper) */}
                        <div 
                          onClick={() => setPaymentMethod('bumper')}
                          className={`relative rounded-xl p-5 cursor-pointer transition-all duration-300 border-2 w-full ${
                            paymentMethod === 'bumper' 
                              ? 'bg-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          {/* 0% APR Badge - ORANGE */}
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md uppercase">
                            0% APR
                          </div>

                          {/* Radio Button and No Fees Badge */}
                          <div className="flex items-start justify-between mb-3">
                            <RadioGroupItem 
                              value="bumper" 
                              id="bumper-option" 
                              className="border-2 border-gray-400 w-6 h-6 mt-0.5"
                            />
                            {/* No Fees Badge - GREY */}
                            <div className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded uppercase">
                              NO FEES
                            </div>
                          </div>

                          {/* Calendar Icon */}
                          <div className="flex justify-center mb-3">
                            <div className="bg-orange-100 p-3 rounded-full">
                              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          </div>

                          {/* Heading */}
                          <Label htmlFor="bumper-option" className="block text-center cursor-pointer mb-2">
                            <h4 className="text-lg font-bold text-black mb-1">Spread the Cost</h4>
                            <p className="text-xs font-bold text-gray-700">Interest-free monthly instalments</p>
                          </Label>

                          {/* Price Display - Clean & Integrated */}
                          <div className="bg-orange-50 rounded-lg p-3 mb-3 border border-orange-100">
                            <div className="text-center">
                              <div className="text-4xl font-black text-black mb-1">
                                £{Math.round(discountedBumperPrice / 12)}<span className="text-lg">/month</span>
                              </div>
                              <div className="inline-block bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full mb-1">
                                Only 12 payments
                              </div>
                              <div className="text-sm font-bold text-gray-600">
                                £{Math.round(discountedBumperPrice)} total
                              </div>
                            </div>
                          </div>

                          {/* Features - GREEN TICKS */}
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-black font-medium">12 interest-free payments</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-black font-medium">No impact on credit score</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-black font-medium">0% interest, no hidden fees</span>
                            </div>
                          </div>

                          {/* CTA inside box */}
                          <Button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentMethod('bumper');
                              setTimeout(() => handleSubmit(), 50);
                            }}
                            disabled={isLoadingPayment}
                            className="w-full font-bold py-2.5 rounded-lg transition-colors shadow-lg bg-orange-500 hover:bg-orange-600 text-white text-sm disabled:opacity-50"
                          >
                            {isLoadingPayment && paymentMethod === 'bumper' ? 'Processing...' : 'Complete checkout'}
                          </Button>

                          {/* Powered By */}
                          <div className="text-center pt-2 border-t mt-3">
                            <span className="text-xs text-black block mb-1">Powered by</span>
                            <img src={bumperLogo} alt="Bumper" className="h-5 mx-auto" />
                          </div>
                        </div>
                      </div>
                      </div>
                    </RadioGroup>

                    {/* Discount Codes Applied Notice */}
                    {hasValidDiscountCodes && (
                      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 lg:max-w-md lg:mx-auto">
                        {appliedDiscountCodes.map((discount) => (
                          <div key={discount.code} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-black font-bold text-sm truncate">{discount.code}</span>
                                <span className="text-xs text-green-600 font-medium">
                                  {discount.type === 'percentage' ? `${discount.value}% OFF` : `£${discount.value} OFF`}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-green-600 font-bold whitespace-nowrap">-£{discount.discountAmount.toFixed(2)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removePromoCode(discount.code)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 h-auto px-2 py-1 text-xs font-medium flex-shrink-0"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Complete Purchase Button - Centered with max width on desktop */}
                    <div className="text-center lg:max-w-sm lg:mx-auto">
                      <ProtectedButton
                        actionType="complete_purchase"
                        onClick={handleSubmit}
                        className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 text-lg rounded-xl shadow-lg animate-[breathing_3s_ease-in-out_infinite] transition-all hover:scale-[1.02]"
                        size="lg"
                        disabled={isLoadingPayment}
                        loading={isLoadingPayment}
                      >
                        {isLoadingPayment ? (
                          'Loading Payment Gateway...'
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            Complete Purchase
                            <ArrowRight className="w-5 h-5" strokeWidth={3} />
                          </span>
                        )}
                      </ProtectedButton>
                      <p className="text-sm text-black mt-2 font-medium">Takes less than 1 minute</p>
                    </div>

                    {/* Trust & Security - Constrained width on desktop */}
                    <div className="space-y-3 mt-4 lg:max-w-md lg:mx-auto">
                      {/* Security Icons */}
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-center gap-4 flex-wrap text-xs text-black">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
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

                      {/* Customer Support */}
                      <div className="text-center">
                        <p className="text-sm text-black">
                          Need help? <a href="tel:03302295040" className="text-orange-600 hover:text-orange-700 font-semibold underline">Call us on 0330 229 5040</a>
                        </p>
                      </div>
                    </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Capture Popup */}
        <EmailCapturePopup
          isOpen={showEmailPopup}
          onClose={() => setShowEmailPopup(false)}
          onDiscountCodeGenerated={handleEmailPopupDiscountCode}
        />
      </div>
    </div>
  );
};

export default CustomerDetailsStep;
