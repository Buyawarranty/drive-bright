import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { EmbeddedCheckoutModal } from '@/components/stripe';
import PlanSummaryCard from '@/components/checkout/PlanSummaryCard';
import CoverHighlights from '@/components/checkout/CoverHighlights';
import TrustBar from '@/components/checkout/TrustBar';
import DesktopStickyPriceSidebar from '@/components/checkout/DesktopStickyPriceSidebar';
import MobileStickyFooter from '@/components/checkout/MobileStickyFooter';
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
  const navigate = useNavigate();
  
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
  const [addressExpanded, setAddressExpanded] = useState(true);
  
  // Address fields state - simplified to match API requirements
  // Addr1 = address_line_1, Addr2 = address_line_2, Town = town, PCode = postcode
  const [addressData, setAddressData] = useState({
    postcode: '',
    address_line_1: '',  // Maps to street/building_number combo for W2000 Addr1
    address_line_2: '',  // Maps to flat_number/building_name for W2000 Addr2 (optional)
    town: '',
    county: '',
  });
  
  // Address field errors
  const [addressErrors, setAddressErrors] = useState<{[key: string]: string}>({});
  const [addressValidated, setAddressValidated] = useState<{[key: string]: boolean}>({});
  
  // Track if address lookup failed (for showing manual entry)
  const [addressLookupFailed, setAddressLookupFailed] = useState(false);
  
  // Form states
  const [showValidation, setShowValidation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [validatedFields, setValidatedFields] = useState<{[key: string]: boolean}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  
  // Embedded Stripe checkout modal state
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  
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
  // Step 3 displays: monthlyPrice = Math.floor(totalPrice / 12), and Total = monthlyPrice * 12
  // So Step 4 MUST use the same formula to match exactly
  const baseTotalPrice = updatedPricingData.totalPrice;
  const monthlyPrice = updatedPricingData.monthlyPrice ?? Math.floor(baseTotalPrice / 12);
  
  // CRITICAL: For monthly payments, the displayed total MUST be monthlyPrice * 12
  // This matches Step 3's "Total: £X" which is calculated as monthlyPrice * 12
  // NOT the raw totalPrice (which may differ due to flooring)
  const bumperTotalPrice = monthlyPrice * 12;
  
  // Pay in full uses 10% discount on the floored monthly total
  const stripeTotalPrice = Math.floor(bumperTotalPrice * 0.90);

  // Calculate discounts
  const hasValidDiscountCodes = appliedDiscountCodes.length > 0;
  const totalDiscountAmount = appliedDiscountCodes.reduce((sum, code) => sum + code.discountAmount, 0);
  const discountedBumperPrice = Math.floor(bumperTotalPrice - totalDiscountAmount);
  const discountedStripePrice = Math.floor(stripeTotalPrice - totalDiscountAmount);
  const savings = bumperTotalPrice - stripeTotalPrice;
  
  // Calculate discounted monthly price - use Step 3 monthly price when no discounts, otherwise recalculate
  const discountedMonthlyPrice = hasValidDiscountCodes 
    ? Math.floor(discountedBumperPrice / 12) 
    : monthlyPrice;

  // Check section completion status - now includes address fields
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
  
  // Check if address is complete (required fields)
  // Check if address is complete - simplified fields
  const addressComplete = useMemo(() => {
    const ukPostcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    return !!(
      addressData.address_line_1?.trim() &&
      addressData.town?.trim() &&
      addressData.postcode?.trim() &&
      ukPostcodeRegex.test(addressData.postcode.replace(/\s/g, ''))
    );
  }, [addressData]);
  
  // Count missing address fields
  const addressFieldsMissing = useMemo(() => {
    let count = 0;
    const ukPostcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    if (!addressData.address_line_1?.trim()) count++;
    if (!addressData.town?.trim()) count++;
    if (!addressData.postcode?.trim() || !ukPostcodeRegex.test(addressData.postcode.replace(/\s/g, ''))) count++;
    return count;
  }, [addressData]);

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

  // Auto-collapse details section when BOTH personal details AND address are complete
  // CRITICAL: Do NOT close until address is fully completed - user must enter all required address fields
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
    
    // Only collapse when BOTH personal details AND address are complete
    if (personalDetailsComplete && addressComplete && detailsOpen) {
      const timer = setTimeout(() => {
        setDetailsOpen(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [personalDetailsComplete, addressComplete]);

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

  // Reset loading on mount and handle bfcache restoration - CRITICAL for Stripe back-nav
  useEffect(() => {
    // Ensure loading is always false on mount - immediate
    setIsLoading(false);
    
    const restoreJourneyState = () => {
      try {
        const savedState = localStorage.getItem('warranty_journey_state');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          console.log('📱 Step 4: Restoring journey state from localStorage', parsed);
          
          // Check if the saved state is recent (within 30 minutes)
          const stateAge = Date.now() - (parsed.timestamp || 0);
          if (stateAge < 30 * 60 * 1000) {
            // Restore customer data if available
            if (parsed.customerData) {
              setCustomerData(parsed.customerData);
            }
            // Restore payment type if available
            if (parsed.paymentType) {
              setSelectedPayment(parsed.paymentType === 'monthly' ? 'monthly' : 'full');
            }
            // Restore discount codes if available
            if (parsed.appliedDiscountCodes && Array.isArray(parsed.appliedDiscountCodes)) {
              setAppliedDiscountCodes(parsed.appliedDiscountCodes);
            }
            console.log('✅ Step 4: Journey state restored successfully');
          } else {
            console.log('⚠️ Step 4: Saved state is too old, skipping restoration');
          }
        }
      } catch (error) {
        console.error('❌ Step 4: Error restoring journey state:', error);
      }
    };
    
    const handlePageShow = (event: PageTransitionEvent) => {
      console.log('📱 Step 4: pageshow event, persisted:', event.persisted);
      
      // ALWAYS reset loading state immediately - this is critical for bfcache
      setIsLoading(false);
      
      // If page was restored from bfcache (e.g., back from Stripe)
      if (event.persisted) {
        console.log('📱 Step 4: Page restored from bfcache, resetting all states');
        
        // Restore journey state from localStorage FIRST
        restoreJourneyState();
        
        // Use requestAnimationFrame for smoother state restoration
        requestAnimationFrame(() => {
          setIsPageRestored(true);
          setShowValidation(false);
          setPaymentError('');
          setIsLoading(false); // Double-ensure loading is false
          
          // Re-open details if not complete to prevent frozen collapsed state
          if (!personalDetailsComplete) {
            setDetailsOpen(true);
          }
        });
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 Step 4: Page visible again, resetting loading');
        setIsLoading(false);
        setPaymentError('');
        // Also restore state on visibility change (catches some edge cases)
        restoreJourneyState();
      }
    };
    
    // Handle focus - catches some edge cases where pageshow doesn't fire
    const handleFocus = () => {
      console.log('📱 Step 4: Window focused, resetting loading');
      setIsLoading(false);
    };
    
    // Use type assertion for pageshow event
    window.addEventListener('pageshow', handlePageShow as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
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

  // Validate address field
  const validateAddressField = (field: string): boolean => {
    let isValid = true;
    let error = '';
    const ukPostcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

    switch (field) {
      case 'address_line_1':
        if (!addressData.address_line_1?.trim()) {
          error = 'Enter your address.';
          isValid = false;
        }
        break;
      case 'town':
        if (!addressData.town?.trim()) {
          error = 'Enter your town or city.';
          isValid = false;
        }
        break;
      case 'postcode':
        if (!addressData.postcode?.trim()) {
          error = 'Enter a valid UK postcode.';
          isValid = false;
        } else if (!ukPostcodeRegex.test(addressData.postcode.replace(/\s/g, ''))) {
          error = 'Enter a valid UK postcode.';
          isValid = false;
        }
        break;
    }

    setAddressErrors(prev => ({ ...prev, [field]: error }));
    setAddressValidated(prev => ({ ...prev, [field]: isValid }));
    return isValid;
  };

  // Validate all address fields
  const validateAddressForm = (): boolean => {
    const requiredFields = ['building_number', 'street', 'town', 'postcode'];
    let allValid = true;
    
    requiredFields.forEach(field => {
      if (!validateAddressField(field)) allValid = false;
    });
    
    return allValid;
  };

  const validateForm = (): boolean => {
    const requiredFields = ['first_name', 'last_name', 'email', 'phone', 'mileage'];
    let allValid = true;
    
    requiredFields.forEach(field => {
      if (!validateField(field)) allValid = false;
    });
    
    // Also validate address fields
    if (!validateAddressForm()) allValid = false;
    
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

  const getAddressInputValidationClass = (field: string) => {
    if (showValidation && addressErrors[field]) {
      return 'border-red-500 ring-2 ring-red-200 bg-red-50/50 focus:ring-red-300 focus:border-red-500';
    }
    if (addressValidated[field]) {
      return 'border-green-500 bg-green-50/30';
    }
    return 'bg-[#F5F5F5] border-gray-200 focus:bg-white';
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
        setPromoCodeError(data?.error || data?.message || 'Invalid promo code');
        return;
      }
      
      // Access discount code details from the nested discountCode object
      const discountCode = data.discountCode;
      if (!discountCode) {
        setPromoCodeError('Invalid discount code response');
        return;
      }
      
      const discountAmount = discountCode.type === 'percentage' 
        ? bumperTotalPrice * (discountCode.value / 100)
        : discountCode.value;
      
      setAppliedDiscountCodes(prev => [...prev, {
        code: promoCodeInput.toUpperCase(),
        type: discountCode.type,
        value: discountCode.value,
        discountAmount,
        stripe_coupon_id: discountCode.stripe_coupon_id,
        stripe_promo_code_id: discountCode.stripe_promo_code_id
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
      // Also expand address section if address fields are incomplete
      if (!addressComplete) setAddressExpanded(true);
      
      const formSection = document.getElementById('customer-form');
      formSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast.error('Please complete all required fields including your address.');
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
      
      // CRITICAL: Override vehicleData.mileage with user's actual input from Step 4
      // The original vehicleData.mileage contains the representative value (100000) from Step 1
      const vehicleDataWithActualMileage = {
        ...vehicleData,
        mileage: customerData.mileage || vehicleData.mileage
      };
      
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-bumper-checkout', {
        body: {
          planId,
          vehicleData: vehicleDataWithActualMileage,
          paymentType,
          voluntaryExcess: updatedPricingData.voluntaryExcess,
          claimLimit: updatedPricingData.claimLimit || 1250,
          labourRate: pricingData.labourRate || 50,
          customerData: { 
            ...customerData, 
            first_name: firstName,
            last_name: lastName,
            final_amount: finalPrice,
            // Address fields - mapped for API compatibility
            // Addr1 = address_line_1 (street + building), Addr2 = address_line_2 (optional)
            street: addressData.address_line_1 || '',
            building_name: '',
            building_number: '',
            flat_number: addressData.address_line_2 || '',
            town: addressData.town || '',
            county: addressData.county || '',
            postcode: addressData.postcode || '',
            address_line_1: addressData.address_line_1 || '',
            address_line_2: addressData.address_line_2 || '',
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
        // Save journey state for recovery when returning from Bumper
        localStorage.setItem('warranty_journey_state', JSON.stringify({
          formData: pricingData,
          vehicleData,
          customerData,
          planId,
          paymentType,
          appliedDiscountCodes,
          timestamp: Date.now()
        }));
        
        // CRITICAL: Also save the raw data that Index.tsx reads for recovery
        // Save in raw format (not timestamped) for reliable bfcache recovery
        localStorage.setItem('buyawarranty_vehicleData', JSON.stringify(vehicleData));
        localStorage.setItem('buyawarranty_selectedPlan', JSON.stringify({
          id: planId,
          name: planName,
          paymentType,
          pricingData: updatedPricingData
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
      
      // CRITICAL: Override vehicleData.mileage with user's actual input from Step 4
      // The original vehicleData.mileage contains the representative value (100000) from Step 1
      const vehicleDataWithActualMileage = {
        ...vehicleData,
        mileage: customerData.mileage || vehicleData.mileage
      };
      
      // Create PaymentIntent for embedded checkout (no redirect)
      const { data: paymentIntentData, error: paymentIntentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          planId,
          planName,
          vehicleData: vehicleDataWithActualMileage,
          paymentType,
          voluntaryExcess: updatedPricingData.voluntaryExcess,
          claimLimit: updatedPricingData.claimLimit || 1250,
          labourRate: pricingData.labourRate || 50,
          customerData: { 
            ...customerData, 
            first_name: firstName,
            last_name: lastName,
            final_amount: finalPrice,
            // Address fields - mapped for API compatibility
            street: addressData.address_line_1 || '',
            building_name: '',
            building_number: '',
            flat_number: addressData.address_line_2 || '',
            town: addressData.town || '',
            county: addressData.county || '',
            postcode: addressData.postcode || '',
            address_line_1: addressData.address_line_1 || '',
            address_line_2: addressData.address_line_2 || '',
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
          },
          // Tracking data for conversions
          gclid: localStorage.getItem('gclid') || '',
          gaClientId: localStorage.getItem('ga_client_id') || '',
        }
      });

      if (paymentIntentError) {
        console.error('PaymentIntent creation error:', paymentIntentError);
        toast.error('Unable to process. Please try again.');
        setIsLoading(false);
        return;
      }

      if (paymentIntentData?.clientSecret) {
        // Save journey state for recovery
        localStorage.setItem('warranty_journey_state', JSON.stringify({
          formData: pricingData,
          vehicleData,
          customerData,
          planId,
          paymentType,
          appliedDiscountCodes,
          timestamp: Date.now()
        }));
        
        // Navigate to dedicated Stripe payment page
        const durationText = paymentType === '12months' ? '1 Year Cover' : paymentType === '24months' ? '2 Year Cover' : '3 Year Cover';
        navigate('/checkout/payment/', {
          state: {
            clientSecret: paymentIntentData.clientSecret,
            amount: discountedStripePrice,
            originalAmount: bumperTotalPrice,
            vehicleReg: vehicleData.regNumber,
            vehicleMake: vehicleData.make,
            vehicleModel: vehicleData.model || '',
            planName: formatPlanName(),
            duration: durationText,
            claimLimit: updatedPricingData.claimLimit || 1250,
            labourRate: pricingData.labourRate || 50,
            excess: updatedPricingData.voluntaryExcess || 100,
            customerName: `${customerData.first_name} ${customerData.last_name}`.trim(),
            customerEmail: customerData.email,
            isMonthly: selectedPayment === 'monthly',
            monthlyPrice: discountedMonthlyPrice,
          }
        });
        setIsLoading(false);
      } else {
        toast.error('Unable to process. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Stripe checkout error:', error);
      toast.error('Unable to process. Please try again.');
      setIsLoading(false);
    }
  };

  // Order summary for embedded checkout modal
  const embeddedCheckoutOrderSummary = useMemo(() => ({
    vehicleReg: vehicleData.regNumber,
    vehicleMake: vehicleData.make,
    vehicleModel: vehicleData.model || '',
    planName: planName,
    duration: paymentType === '12months' ? '1 Year Cover' : paymentType === '24months' ? '2 Year Cover' : '3 Year Cover',
    amount: discountedStripePrice,
    originalAmount: bumperTotalPrice,
    savings: bumperTotalPrice - discountedStripePrice,
  }), [vehicleData, planName, paymentType, discountedStripePrice, bumperTotalPrice]);

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
    if (paymentType === '12months') return '1 Year Cover';
    if (paymentType === '24months') return '2 Year Cover';
    return '3 Year Cover';
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
    <div className="min-h-screen bg-background px-2 sm:px-0">
      {/* Desktop: Two-column layout with sticky sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Back Link - Full width */}
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

        <div className="flex gap-8">
          {/* Main Content Column */}
          <div className="flex-1 max-w-2xl space-y-6 sm:space-y-8 pb-32 md:pb-8">
          
          {/* ==================== SECTION 1: PLAN SUMMARY ==================== */}
          <section className="space-y-4">
            {/* Compact Plan Summary Card */}
            <PlanSummaryCard
              planName={formatPlanName()}
              vehicleReg={vehicleData.regNumber}
              vehicleMake={vehicleData.make}
              vehicleModel={vehicleData.model}
              duration={getDurationText()}
              claimLimit={updatedPricingData.claimLimit || 1250}
              labourRate={pricingData.labourRate || 50}
              excess={updatedPricingData.voluntaryExcess || 100}
              selectedPayment={selectedPayment}
              monthlyPrice={discountedMonthlyPrice}
              totalPrice={bumperTotalPrice}
              isLoading={isLoading}
              onPaymentChange={setSelectedPayment}
              onPayClick={processPayment}
              onChangePlan={onBack}
            />

            {/* Key Cover Highlights */}
            <CoverHighlights planName={formatPlanName()} />

            {/* Trust Bar */}
            <TrustBar />

            {/* Cover Start Date */}
            <Card className="border border-border bg-card shadow-sm">
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

                    {/* Required Address Section - Collapsible */}
                    <div 
                      className="rounded-xl overflow-hidden transition-all duration-200 bg-white"
                      style={{ 
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
                          <div>
                            <h2 className="text-base font-semibold text-foreground">
                              Your Address <span className="text-destructive">*</span>
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {addressExpanded 
                                ? 'Enter your postcode to find your address' 
                                : 'Required for your policy documents'
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!addressExpanded && (
                            showValidation && addressFieldsMissing > 0 
                              ? <SectionErrorBadge count={addressFieldsMissing} />
                              : addressComplete && <SectionCompleteBadge />
                          )}
                          {!addressExpanded && !addressComplete && !showValidation && (
                            <span 
                              className="text-xs font-medium px-4 py-2 rounded-full transition-colors whitespace-nowrap"
                              style={{ 
                                backgroundColor: '#FFFFFF', 
                                color: '#666666',
                                border: '1px solid #D0D0D0'
                              }}
                            >
                              Enter address
                            </span>
                          )}
                          {addressExpanded && (
                            <span 
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Collapse
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
                          addressExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="px-4 pb-4 pt-3 space-y-4 border-t border-border/30">
                          {/* Postcode with Find Address - Single unified field */}
                          <div>
                            <Label htmlFor="postcode-search" className="text-sm font-medium text-foreground/80 flex items-center gap-2 mb-2">
                              <Search className="w-3.5 h-3.5" />
                              Postcode <span className="text-destructive">*</span>
                            </Label>
                            <AddressAutocomplete
                              placeholder="Enter your postcode (e.g. SW1A 1AA)"
                              onAddressSelect={(autocompleteData: AddressData) => {
                                // Combine line_1 fields for address_line_1
                                const line1Parts = [
                                  autocompleteData.building_number,
                                  autocompleteData.building_name,
                                  autocompleteData.line_1
                                ].filter(Boolean).join(' ').trim() || autocompleteData.line_1 || '';
                                
                                setAddressData({
                                  postcode: autocompleteData.postcode || '',
                                  address_line_1: line1Parts,
                                  address_line_2: autocompleteData.line_2 || '',
                                  town: autocompleteData.town || '',
                                  county: autocompleteData.county || '',
                                });
                                // Clear errors on successful selection
                                setAddressErrors({});
                                setAddressValidated({
                                  address_line_1: true,
                                  town: true,
                                  postcode: true,
                                });
                              }}
                              onLookupError={(hasError) => setAddressLookupFailed(hasError)}
                              onPostcodeValidation={(isValid, postcode) => {
                                // When API fails but postcode is valid, save just the postcode
                                if (isValid && addressLookupFailed) {
                                  setAddressData(prev => ({ ...prev, postcode: postcode.toUpperCase() }));
                                  setAddressValidated(prev => ({ ...prev, postcode: true }));
                                  setAddressErrors(prev => ({ ...prev, postcode: '' }));
                                }
                              }}
                              className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-[#F5F5F5] focus:bg-white min-h-[44px] transition-colors"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Type your postcode to find your address, or enter manually below
                            </p>
                          </div>

                          {/* Manual Address Fields */}
                          <div className="grid grid-cols-1 gap-3">

                            {/* Address Line 1 */}
                            <div>
                              <Label htmlFor="address_line_1" className="text-sm font-medium text-foreground/80">
                                Address Line 1 <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="address_line_1"
                                  placeholder="e.g. 123 High Street"
                                  value={addressData.address_line_1}
                                  onChange={(e) => {
                                    setAddressData(prev => ({ ...prev, address_line_1: e.target.value }));
                                    if (addressErrors.address_line_1) {
                                      setAddressErrors(prev => ({ ...prev, address_line_1: '' }));
                                    }
                                  }}
                                  onBlur={() => validateAddressField('address_line_1')}
                                  className={`h-10 sm:h-11 text-sm mt-1 pr-10 transition-colors ${getAddressInputValidationClass('address_line_1')}`}
                                />
                                {addressValidated.address_line_1 && !addressErrors.address_line_1 && addressData.address_line_1 && (
                                  <Check className="absolute right-3 top-1/2 translate-y-[-30%] h-5 w-5 text-green-600" />
                                )}
                              </div>
                              {showValidation && addressErrors.address_line_1 && (
                                <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {addressErrors.address_line_1}
                                </p>
                              )}
                            </div>

                            {/* Address Line 2 (optional) */}
                            <div>
                              <Label htmlFor="address_line_2" className="text-sm font-medium text-foreground/80">
                                Address Line 2 <span className="text-muted-foreground font-normal">(optional)</span>
                              </Label>
                              <Input
                                id="address_line_2"
                                placeholder="e.g. Flat 2, Oak House"
                                value={addressData.address_line_2}
                                onChange={(e) => setAddressData(prev => ({ ...prev, address_line_2: e.target.value }))}
                                className="h-10 sm:h-11 text-sm mt-1 bg-[#F5F5F5] border-gray-200 focus:bg-white transition-colors"
                              />
                            </div>

                            {/* Town/City */}
                            <div>
                              <Label htmlFor="town" className="text-sm font-medium text-foreground/80">
                                Town / City <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="town"
                                  placeholder="e.g. London"
                                  value={addressData.town}
                                  onChange={(e) => {
                                    setAddressData(prev => ({ ...prev, town: e.target.value }));
                                    if (addressErrors.town) {
                                      setAddressErrors(prev => ({ ...prev, town: '' }));
                                    }
                                  }}
                                  onBlur={() => validateAddressField('town')}
                                  className={`h-10 sm:h-11 text-sm mt-1 pr-10 transition-colors ${getAddressInputValidationClass('town')}`}
                                />
                                {addressValidated.town && !addressErrors.town && addressData.town && (
                                  <Check className="absolute right-3 top-1/2 translate-y-[-30%] h-5 w-5 text-green-600" />
                                )}
                              </div>
                              {showValidation && addressErrors.town && (
                                <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {addressErrors.town}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Required Note */}
                          <p className="text-xs text-muted-foreground pt-1">
                            <span className="text-destructive">*</span> Required fields for your warranty policy documents.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
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
          
          {/* Desktop: Sticky Right Sidebar */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <DesktopStickyPriceSidebar
              planName={formatPlanName()}
              vehicleReg={vehicleData.regNumber}
              duration={getDurationText()}
              claimLimit={updatedPricingData.claimLimit || 1250}
              labourRate={pricingData.labourRate || 50}
              excess={updatedPricingData.voluntaryExcess || 100}
              monthlyPrice={discountedMonthlyPrice}
              fullPrice={discountedStripePrice}
              originalPrice={bumperTotalPrice}
              selectedPayment={selectedPayment}
              isLoading={isLoading}
              isFormValid={personalDetailsComplete && addressComplete}
              onPayClick={processPayment}
              onPaymentChange={(payment) => {
                setSelectedPayment(payment);
                setPaymentError('');
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Mobile: Sticky Footer */}
      <MobileStickyFooter
        selectedPayment={selectedPayment}
        monthlyPrice={discountedMonthlyPrice}
        fullPrice={discountedStripePrice}
        originalPrice={bumperTotalPrice}
        isLoading={isLoading}
        isFormValid={personalDetailsComplete && addressComplete}
        onPayClick={processPayment}
        onPaymentChange={(payment) => {
          setSelectedPayment(payment);
          setPaymentError('');
        }}
      />

      {/* Embedded Stripe Checkout Modal */}
      <EmbeddedCheckoutModal
        isOpen={showEmbeddedCheckout}
        onClose={() => {
          setShowEmbeddedCheckout(false);
          setStripeClientSecret(null);
        }}
        clientSecret={stripeClientSecret}
        orderSummary={embeddedCheckoutOrderSummary}
      />
    </div>
  );
};

export default StreamlinedCheckout;
