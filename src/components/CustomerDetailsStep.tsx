import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/protected-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CheckCircle, Edit, User, CreditCard, MapPin, X, ArrowUp, Check, ArrowRight } from 'lucide-react';
import { PostcodeAutocomplete } from '@/components/ui/uk-postcode-autocomplete';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AddAnotherWarrantyOffer from '@/components/AddAnotherWarrantyOffer';
import { useAuth } from '@/hooks/useAuth';
import { trackFormSubmission, trackEvent } from '@/utils/analytics';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { getAddOnInfo, isAddOnAutoIncluded, normalizePaymentType, calculateAddOnPrice } from '@/lib/addOnsUtils';
import { EmailCapturePopup } from '@/components/EmailCapturePopup';
import MobileNavigation from '@/components/MobileNavigation';
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

    // Show email capture popup after 35 seconds
    const timer = setTimeout(() => {
      setShowEmailPopup(true);
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
    
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Real-time field validation
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
    
    if (!customerData.first_name.trim()) errors.first_name = 'First name is required';
    if (!customerData.last_name.trim()) errors.last_name = 'Last name is required';
    
    if (!customerData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(customerData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!customerData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!phoneRegex.test(customerData.phone)) {
      errors.phone = 'Please enter a valid UK phone number';
    }
    
    if (!customerData.address_line_1.trim()) errors.address_line_1 = 'Address is required';
    if (!customerData.city.trim()) errors.city = 'City is required';
    
    if (!customerData.postcode.trim()) {
      errors.postcode = 'Postcode is required';
    } else if (!postcodeRegex.test(customerData.postcode)) {
      errors.postcode = 'Please enter a valid UK postcode';
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
      
      // Scroll to top of page immediately on first click
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
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
    <div className="min-h-screen bg-[#e8f4fb] w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Back Button */}
        <div className="mb-8">
          <Button
            onClick={onBack}
            variant="outline"
            className="flex items-center gap-2 bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Plans
          </Button>
        </div>

        {/* Header with Clickable Logo and Mobile Menu */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex-1"></div>
          <a href="/" className="hover:opacity-80 transition-opacity">
            <img 
              src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" 
              alt="Buy a Warranty" 
              className="h-10 w-auto"
            />
          </a>
          <div className="flex-1 flex justify-end">
            <MobileNavigation />
          </div>
        </div>

        {/* Almost Done Heading */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <CheckCircle className="w-6 h-6 text-black" />
            <h1 className="text-3xl font-bold text-black">Almost done! Just confirm your details</h1>
          </div>
        </div>


        {/* Customer Details Form */}
        <Card className="border border-gray-200">
          <CardContent className="pt-6">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column - Personal Details Form */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-6">Tell us about yourself</h3>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">First Name *</Label>
                      <div className="relative">
                        <Input
                          id="first_name"
                          placeholder="Enter first name"
                          value={customerData.first_name}
                          onChange={(e) => handleInputChange('first_name', e.target.value)}
                          required
                          className={`mt-1 transition-all duration-300 ${
                            showValidation && !customerData.first_name.trim() 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'focus:ring-2 focus:ring-blue-200'
                          }`}
                        />
                        {validatedFields.first_name && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                      </div>
                      {fieldErrors.first_name && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.first_name}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">Last Name *</Label>
                      <div className="relative">
                        <Input
                          id="last_name"
                          placeholder="Enter last name"
                          value={customerData.last_name}
                          onChange={(e) => handleInputChange('last_name', e.target.value)}
                          required
                          className={`mt-1 transition-all duration-300 ${
                            showValidation && !customerData.last_name.trim() 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'focus:ring-2 focus:ring-blue-200'
                          }`}
                        />
                        {validatedFields.last_name && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                      </div>
                      {fieldErrors.last_name && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.last_name}</p>
                      )}
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
                        required
                        className={`mt-1 transition-all duration-300 ${
                          showValidation && fieldErrors.email 
                            ? 'border-red-500 focus:border-red-500' 
                            : 'focus:ring-2 focus:ring-blue-200'
                        }`}
                      />
                      {validatedFields.email && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {fieldErrors.email && (
                      <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number *</Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="e.g., 07123 456789 or 01234 567890"
                        value={customerData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        required
                        className={`mt-1 transition-all duration-300 ${
                          showValidation && fieldErrors.phone 
                            ? 'border-red-500 focus:border-red-500' 
                            : 'focus:ring-2 focus:ring-blue-200'
                        }`}
                      />
                      {validatedFields.phone && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {fieldErrors.phone && (
                      <p className="text-red-500 text-sm mt-1">{fieldErrors.phone}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">UK mobile or landline numbers only</p>
                  </div>

                  {/* Address Fields */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="address_line_1" className="text-sm font-medium text-gray-700">Address Line 1 *</Label>
                      <div className="relative">
                        <Input
                          id="address_line_1"
                          placeholder="Enter your address"
                          value={customerData.address_line_1}
                          onChange={(e) => handleInputChange('address_line_1', e.target.value)}
                          required
                          className={`mt-1 transition-all duration-300 ${
                            showValidation && !customerData.address_line_1.trim() 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'focus:ring-2 focus:ring-blue-200'
                          }`}
                        />
                        {validatedFields.address_line_1 && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                      </div>
                      {fieldErrors.address_line_1 && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.address_line_1}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="address_line_2" className="text-sm font-medium text-gray-700">Address Line 2</Label>
                      <Input
                        id="address_line_2"
                        placeholder="Apartment, suite, etc. (optional)"
                        value={customerData.address_line_2}
                        onChange={(e) => handleInputChange('address_line_2', e.target.value)}
                        className="mt-1 focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="postcode" className="text-sm font-medium text-gray-700">Postcode *</Label>
                        <div className="relative">
                          <PostcodeAutocomplete
                            value={customerData.postcode}
                            onChange={(value) => handleInputChange('postcode', value)}
                            onAddressSelect={(address) => {
                              // Auto-populate address fields when postcode is selected
                              if (address.town) {
                                handleInputChange('city', address.town);
                              }
                              if (address.street && !customerData.address_line_1) {
                                handleInputChange('address_line_1', address.street);
                              }
                            }}
                            placeholder="e.g., SW1A 1AA"
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
                            placeholder="Enter your city/town"
                            value={customerData.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            required
                            className={`mt-1 transition-all duration-300 ${
                              showValidation && fieldErrors.city 
                                ? 'border-red-500 focus:border-red-500' 
                                : 'focus:ring-2 focus:ring-blue-200'
                            }`}
                          />
                          {validatedFields.city && (
                            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                          )}
                        </div>
                        {fieldErrors.city && (
                          <p className="text-red-500 text-sm mt-1">{fieldErrors.city}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">This may auto-fill from your postcode</p>
                      </div>
                    </div>
                  </div>

                  <AddAnotherWarrantyOffer
                    onAddAnotherWarranty={() => setAddAnotherWarrantyRequested(true)}
                  />
                </form>
              </div>

              {/* Right Column - Order Summary */}
              <div className="space-y-6">
                {/* Order Summary Card */}
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Order Summary</h2>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={onBack}
                      className="flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Change
                    </Button>
                  </div>
                  
                  {/* Confidence Message */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-center text-green-800 font-medium">
                      <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                      Shop with confidence - cancel anytime within 14 days for a full refund 💸
                    </div>
                  </div>

                   {/* Plan Details */}
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan</span>
                      <span className="font-semibold">{
                        (() => {
                          // Check if it's a motorcycle based on make and model
                          const makeLC = vehicleData.make?.toLowerCase().trim() || '';
                          const modelLC = vehicleData.model?.toLowerCase().trim() || '';
                          
                          const isKnownMotorbikeManufacturer = ['yamaha', 'kawasaki', 'ducati', 'ktm', 'harley-davidson', 'harley davidson', 
                            'triumph', 'aprilia', 'mv agusta', 'benelli', 'moto guzzi', 'indian', 
                            'husqvarna', 'beta', 'sherco', 'gas gas', 'royal enfield', 'norton', 
                            'zero', 'energica'].includes(makeLC);
                          
                          const isMotorbike = isKnownMotorbikeManufacturer || 
                                            ['honda', 'bmw', 'suzuki'].includes(makeLC) && 
                                            (modelLC.includes('gsx') || modelLC.includes('cbr') || modelLC.includes('ninja') || 
                                             modelLC.includes('r1') || modelLC.includes('mt') || modelLC.includes('fazer'));
                          
                          const basePlanName = planName.replace(/premium/gi, 'Platinum');
                          return isMotorbike 
                            ? basePlanName.replace(/Car/gi, 'Bike')
                            : basePlanName.replace(/Bike/gi, 'Car');
                        })()
                      }</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-semibold">{paymentType === '12months' 
                        ? '1 Year'
                        : paymentType === '24months' 
                          ? '2 Years'
                          : '3 Years'
                      }</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vehicle</span>
                      <span className="font-semibold">{vehicleData.make} {vehicleData.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vehicle Registration</span>
                      <span className="font-semibold">{vehicleData.regNumber}</span>
                    </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Mileage</span>
                       <span className="font-semibold">{parseInt(vehicleData.mileage || '0').toLocaleString()} miles</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Claim Limit</span>
                       <span className="font-semibold">£{(pricingData.claimLimit || 2000).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Voluntary Excess</span>
                       <span className="font-semibold">£{updatedPricingData.voluntaryExcess ?? 0}</span>
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
                                                           paymentType === '24months' ? '2 year' : 
                                                           '3 year';
                                        priceSubtext = `Spread over 12 interest-free payments for full ${durationText} coverage.`;
                                      }
                                      
                                      return (
                                        <div key={addOn.key} className="group hover:bg-gray-50 -mx-2 px-2 py-2 rounded">
                                          <div className="flex items-start justify-between">
                                            <div className="flex items-start flex-1">
                                              <span className="text-blue-600 mr-2 mt-0.5">+</span>
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
                          {seasonalOfferClaimed && (
                            <div className="flex justify-between items-center text-sm bg-blue-50 p-2 rounded">
                              <span className="font-medium text-blue-700 flex items-center gap-1">
                                <span>❄️</span>
                                <span>3 Months FREE Bonus Cover</span>
                              </span>
                              <span className="font-bold text-blue-600">Added!</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                   {/* Pricing Information */}
                   <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mb-6">
                     {(() => {
                        const months = getWarrantyDurationInMonths(paymentType);
                        // Always calculate monthly payment based on 12 monthly payments, regardless of warranty duration
                        const monthlyPayment = Math.round(discountedBumperPrice / 12);
                       
                        if (months === 12) {
                          return (
                            <div className="text-center">
                              <div className="text-3xl font-bold text-gray-900 mb-3">£{monthlyPayment}/month</div>
                               <div className="flex items-center justify-center mb-2">
                                 <span className="mr-2 text-green-600 text-lg">✓</span>
                                 <span className="font-medium text-gray-700">Only 12 easy payments</span>
                               </div>
                               {seasonalOfferClaimed && (
                                 <div className="flex items-center justify-center mb-2 text-blue-600">
                                   <span className="mr-2">❄️</span>
                                   <span className="font-semibold">+ 3 Months FREE Bonus</span>
                                 </div>
                               )}
                               <div className="text-center mt-4">
                                 <div className="text-lg font-bold text-gray-900 mb-1">Total cost:</div>
                                 <div className="text-3xl font-bold text-green-600">£{discountedBumperPrice}</div>
                                 {seasonalOfferClaimed && (
                                   <div className="text-sm text-blue-600 mt-1 font-medium">
                                     15 months total cover for the price of 12!
                                   </div>
                                 )}
                               </div>
                            </div>
                          );
                        } else if (months === 24) {
                         // Use actual pricing data instead of simulated calculations
                         const originalPrice = discountedBumperPrice + 100; // £100 discount for 2-year
                         const savings = 100;
                          return (
                            <div className="text-center">
                              <div className="text-3xl font-bold text-gray-900 mb-3">£{monthlyPayment}/month</div>
                               <div className="space-y-2 mb-3">
                                 <div className="flex items-center justify-center">
                                   <span className="mr-2 text-green-600 text-lg">✓</span>
                                   <span className="font-medium text-gray-700">Only 12 easy payments</span>
                                 </div>
                                 <div className="flex items-center justify-center">
                                   <span className="mr-2 text-green-600 text-lg">✓</span>
                                   <span className="font-medium text-gray-700">Nothing to pay in Year 2</span>
                                 </div>
                                 {seasonalOfferClaimed && (
                                   <div className="flex items-center justify-center text-blue-600">
                                     <span className="mr-2">❄️</span>
                                     <span className="font-semibold">+ 3 Months FREE Bonus</span>
                                   </div>
                                 )}
                               </div>
                               <div className="text-center mt-4">
                                 <div className="text-lg font-bold text-gray-900 mb-1">Total cost:</div>
                                 <div className="flex items-center justify-center gap-3">
                                   <span className="line-through text-gray-400 text-xl font-medium">£{originalPrice}</span>
                                   <span className="text-green-600 text-3xl font-bold">£{discountedBumperPrice}</span>
                                 </div>
                                 <div className="text-green-600 font-bold text-lg mt-2">
                                   You save £{savings}!
                                 </div>
                                 {seasonalOfferClaimed && (
                                   <div className="text-sm text-blue-600 mt-1 font-medium">
                                     27 months total cover!
                                   </div>
                                 )}
                               </div>
                            </div>
                          );
                         } else if (months === 36) {
                          // Use actual pricing data instead of simulated calculations  
                          const originalPrice = discountedBumperPrice + 200; // £200 discount for 3-year
                          const savings = 200;
                          return (
                            <div className="text-center">
                              <div className="text-3xl font-bold text-gray-900 mb-3">£{monthlyPayment}/month</div>
                               <div className="space-y-2 mb-3">
                                 <div className="flex items-center justify-center">
                                   <span className="mr-2 text-green-600 text-lg">✓</span>
                                   <span className="font-medium text-gray-700">Only 12 easy payments</span>
                                 </div>
                                 <div className="flex items-center justify-center">
                                   <span className="mr-2 text-green-600 text-lg">✓</span>
                                   <span className="font-medium text-gray-700">Nothing to pay in Year 2 and Year 3</span>
                                 </div>
                                 {seasonalOfferClaimed && (
                                   <div className="flex items-center justify-center text-blue-600">
                                     <span className="mr-2">❄️</span>
                                     <span className="font-semibold">+ 3 Months FREE Bonus</span>
                                   </div>
                                 )}
                               </div>
                               <div className="text-center mt-4">
                                 <div className="text-lg font-bold text-gray-900 mb-1">Total cost:</div>
                                 <div className="flex items-center justify-center gap-3">
                                   <span className="line-through text-gray-400 text-xl font-medium">£{originalPrice}</span>
                                   <span className="text-green-600 text-3xl font-bold">£{discountedBumperPrice}</span>
                                 </div>
                                 <div className="text-green-600 font-bold text-lg mt-2">
                                   You save £{savings}!
                                 </div>
                                 {seasonalOfferClaimed && (
                                   <div className="text-sm text-blue-600 mt-1 font-medium">
                                     39 months total cover!
                                   </div>
                                 )}
                               </div>
                            </div>
                          );
                        }
                       return null;
                     })()}
                   </div>

                   {/* Terms and Conditions Notice */}
                   <div className="text-center mb-6">
                     <p className="text-sm text-gray-500">
                       By completing your purchase, you confirm you've read and accept the Warranty Terms & Conditions
                     </p>
                   </div>

                  {/* Payment Methods */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Choose Payment Method</h3>
                    
                    <RadioGroup value={paymentMethod} onValueChange={(value: 'bumper' | 'stripe') => setPaymentMethod(value)}>
                      {/* Pay Monthly - 0% Interest */}
                      <div 
                        onClick={() => setPaymentMethod('bumper')}
                        className={`rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                          paymentMethod === 'bumper' 
                            ? 'bg-green-100 border-2 border-green-500 shadow-lg shadow-green-500/30' 
                            : 'neutral-container shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-green-500/20'
                        }`}
                      >
                         <div className="flex items-start space-x-3">
                           <div className="flex-shrink-0 mt-1">
                             <RadioGroupItem 
                               value="bumper" 
                               id="bumper" 
                               className="border-2 border-gray-400 text-blue-600 w-5 h-5"
                             />
                           </div>
                           <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                              <Label htmlFor="bumper" className="font-semibold text-gray-900 text-base cursor-pointer">
                                Pay Monthly - 0% Interest
                              </Label>
                              <div className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap">
                                0% APR
                              </div>
                            </div>
                             <div className="flex flex-col items-center mb-3 gap-1">
                               <span className="text-xs text-gray-500">Powered by</span>
                               <img src={bumperLogo} alt="Bumper" className="h-5 sm:h-7 object-contain" />
                             </div>
                             <div className="text-sm text-gray-600 mb-3 space-y-1">
                               <div className="flex items-center">
                                 <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0" />
                                 <span>Only a soft credit search</span>
                               </div>
                               <div className="flex items-center">
                                 <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0" />
                                 <span>No impact on your credit score</span>
                               </div>
                             </div>
                             <p className="text-sm text-gray-600">
                               <span className="font-bold">Pay <span className="text-base font-bold">£{Math.round(discountedBumperPrice / 12)}</span> x 12 monthly payments = <span className="text-base font-bold">£{Math.round(discountedBumperPrice)}</span> total</span>
                              {hasSecondWarrantyDiscount && (
                                <span className="text-orange-600"> (second warranty discount applied)</span>
                              )}
                              {hasValidDiscountCodes && !hasSecondWarrantyDiscount && (
                                <span className="text-green-600"> (discount codes applied)</span>
                              )}
                              {hasValidDiscountCodes && (
                                <span className="text-gray-500 line-through ml-2">was £{Math.round(bumperTotalPrice)}</span>
                              )}
                              {hasValidDiscountCodes && (
                                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                                  <span className="font-semibold text-orange-800">
                                    Discount Codes Applied: {appliedDiscountCodes.map(code => code.code).join(', ')}
                                  </span>
                                </div>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Pay in full today */}
                      <div 
                        onClick={() => setPaymentMethod('stripe')}
                        className={`rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                          paymentMethod === 'stripe' 
                            ? 'bg-blue-100 border-2 border-blue-500 shadow-lg shadow-blue-500/30' 
                            : 'neutral-container shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-blue-500/20'
                        }`}
                      >
                         <div className="flex items-start space-x-3">
                           <div className="flex-shrink-0 mt-1">
                             <RadioGroupItem 
                               value="stripe" 
                               id="stripe" 
                               className="border-2 border-gray-400 text-blue-600 w-5 h-5"
                             />
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                               <Label htmlFor="stripe" className="font-semibold text-gray-900 text-base cursor-pointer">
                                 Pay in full today
                               </Label>
                                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-lg whitespace-nowrap">
                                  💰 Save 10% (£{Math.round(discountedPrice * 0.10)}) Today
                                </div>
                             </div>
                             <div className="flex flex-col items-center mb-3 gap-1">
                               <span className="text-xs text-gray-500">Powered by</span>
                               <img src={stripeLogo} alt="Stripe" className="h-5 sm:h-7 object-contain" />
                             </div>
                             <p className="text-sm text-gray-600">
                               <span className="font-bold">Pay <span className="text-base font-bold">£{discountedStripePrice}</span> upfront <span className="text-green-600">- get a 10% discount today</span></span>
                              {hasValidDiscountCodes && (
                                <span className="text-gray-500 line-through ml-2">was £{Math.round(bumperTotalPrice)}</span>
                              )}
                              {hasValidDiscountCodes && (
                                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                                  <span className="font-semibold text-orange-800">
                                    Discount Codes Applied: {appliedDiscountCodes.map(code => code.code).join(', ')}
                                  </span>
                                </div>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </RadioGroup>

                    {/* Complete Purchase Button */}
                    <ProtectedButton
                      actionType="complete_purchase"
                      onClick={handleSubmit}
                      className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 text-lg rounded-lg"
                      size="lg"
                      disabled={isLoadingPayment}
                      loading={isLoadingPayment}
                    >
                      {isLoadingPayment ? (
                        'Loading Payment Gateway...'
                      ) : (
                        <>
            Complete Purchase
            <ArrowRight className="w-5 h-5 ml-2" strokeWidth={4.5} />
                        </>
                      )}
                    </ProtectedButton>

                    <div className="text-center mt-4 text-sm text-gray-500 flex items-center justify-center gap-2">
                      <CreditCard size={16} className="text-blue-600" />
                      Secure checkout powered by Stripe
                    </div>
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
        
        {/* Scroll to Top Button - Mobile Only */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 md:hidden bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all duration-300 z-50"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CustomerDetailsStep;
