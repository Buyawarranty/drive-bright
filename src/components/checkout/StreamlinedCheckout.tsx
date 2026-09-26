import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, CheckCircle, CreditCard, MapPin, Check, Lock, ChevronDown, ChevronUp, ChevronRight, Tag, Shield, AlertCircle, User, X, Info, Calendar, Loader2, Search, Car, Home, Pencil } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackFormSubmission, trackBumperCheckoutClick, trackStripeCheckoutClick, trackStripeCheckoutPageLoad, trackStep4EmailEntry } from '@/utils/analytics';
import { getStoredFbclid, getStoredFbReferrer, getSessionFbclid, getSessionFbReferrer } from '@/utils/fbclidCapture';
import { getTrackingData, getStoredGclid, getSessionOrUrlGclid, getAttributionGclid, getTrackingSessionId } from '@/utils/gclidCapture';
import { getUtmPayload } from '@/utils/utmCapture';
import { getEntryPayload } from '@/utils/entryCapture';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { getAddOnInfo, normalizePaymentType, calculateAddOnPrice } from '@/lib/addOnsUtils';
import MobileNavigation from '@/components/MobileNavigation';
import bumperLogo from '@/assets/bumper-logo-transparent.png';
import stripeLogo from '@/assets/stripe-logo.png';
import { getPaymentPreference, setPaymentPreference } from '@/lib/checkoutPaymentPreference';
import { redirectToStripeWithBackGuard } from '@/lib/stripeBackGuard';
import { detectDeviceType } from '@/utils/deviceDetection';
import { useCheckoutStruggleTracker } from '@/hooks/useCheckoutStruggleTracker';
import { checkDuplicateWarranty } from '@/lib/duplicateWarrantyCheck';
import trustpilotStars from '@/assets/trustpilot-5-stars.png';
import trustpilotLogo from '@/assets/trustpilot-logo.png';
import { StartDatePicker } from '@/components/checkout/StartDatePicker';
import { startOfDay, format, isToday } from 'date-fns';
import { useMotMileage } from '@/hooks/useMotMileage';
import { AddressAutocomplete, AddressData } from '@/components/ui/address-autocomplete';
import { EmbeddedCheckoutModal } from '@/components/stripe';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { StripePaymentForm } from '@/components/stripe/StripePaymentForm';
import PlanSummaryCard from '@/components/checkout/PlanSummaryCard';
import CoverHighlights from '@/components/checkout/CoverHighlights';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import HowToPaySection from '@/components/checkout/HowToPaySection';
import TrustpilotSliderWidget from '@/components/TrustpilotSliderWidget';
import Save50PromoPopup from '@/components/checkout/Save50PromoPopup';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';
import DesktopOrderSummary from '@/components/checkout/DesktopOrderSummary';
import DesktopStickyBar from '@/components/checkout/DesktopStickyBar';
import MobileStickyFooter from '@/components/checkout/MobileStickyFooter';
import DesktopPlanHeader from '@/components/checkout/DesktopPlanHeader';
import EditVehicleDialog from '@/components/EditVehicleDialog';
import { minimumPriceForCodes } from '@/lib/testPromoBypass';
import { getNetPayableFloor } from '@/lib/pricing/netFloor';

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
  onUpdateVehicle?: (vehicle: Partial<StreamlinedCheckoutProps['vehicleData']>) => void;
  /**
   * Which provider powers the monthly (pay by instalments) option.
   * Defaults to Bumper — the live customer checkout. 'payment_assist' is used
   * by the Payment Assist test checkout only; everything else is identical.
   */
  monthlyProvider?: 'bumper' | 'payment_assist';
}

const StreamlinedCheckout: React.FC<StreamlinedCheckoutProps> = ({ 
  vehicleData, 
  planId, 
  paymentType, 
  planName, 
  pricingData, 
  onBack, 
  onNext,
  onUpdateVehicle,
  monthlyProvider = 'bumper',
}) => {
  const isPaymentAssist = monthlyProvider === 'payment_assist';
  const monthlyProviderLabel = isPaymentAssist ? 'Payment Assist' : 'Bumper';
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Ref to track if we've already auto-scrolled to payment section
  const hasAutoScrolledToPaymentRef = useRef(false);
  // Ref for the How to Pay section
  const howToPayRef = useRef<HTMLDivElement>(null);
  // Ref to track if we've already scrolled to the Stripe payment section
  const hasScrolledToStripeRef = useRef(false);

  // Inline "Change vehicle" dialog state (Step 4)
  const [editVehicleOpen, setEditVehicleOpen] = useState(false);
  const handleChangeVehicleClick = onUpdateVehicle ? () => setEditVehicleOpen(true) : undefined;
  
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
        
        // Always start mileage empty — never prefill from MOT or previous sessions
        return {
          ...parsed,
          first_name: firstName,
          last_name: lastName,
          mileage: '',
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
      dob_day: '',
      dob_month: '',
      dob_year: '',
      marketing_opt_in: false,
      privacy_policy_accepted: false,
      terms_conditions_accepted: false,
    };
  });

  // Payment toggle state
  const [selectedPayment, setSelectedPayment] = useState<'monthly' | 'full' | null>(() => getPaymentPreference() || 'monthly');
  const [declarationChecked, setDeclarationChecked] = useState(true);
  const [declarationError, setDeclarationError] = useState(false);
  const [termsDocUrl, setTermsDocUrl] = useState('');
  const [platinumDocUrl, setPlatinumDocUrl] = useState('');

  useEffect(() => {
    const fetchDocs = async () => {
      const { data: termsData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'terms-and-conditions')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (termsData?.file_url) setTermsDocUrl(termsData.file_url);

      const { data: platinumData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'platinum')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (platinumData?.file_url) setPlatinumDocUrl(platinumData.file_url);
    };
    fetchDocs();
  }, []);
  const selectedPaymentRef = React.useRef<'monthly' | 'full' | null>(getPaymentPreference() || 'monthly');

  // Keep the shared step 3 / step 4 preference in sync with the toggle here.
  useEffect(() => {
    if (selectedPayment) setPaymentPreference(selectedPayment);
  }, [selectedPayment]);
  
  // Section states for collapsible accordion
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [addressExpanded, setAddressExpanded] = useState(true);
  
  // Address fields state - simplified to match API requirements
  // Addr1 = address_line_1, Addr2 = address_line_2, Town = town, PCode = postcode
  const [addressData, setAddressData] = useState(() => {
    try {
      const savedAddress = localStorage.getItem('buyawarranty_addressData');
      if (savedAddress) {
        const parsed = JSON.parse(savedAddress);
        console.log('✅ Restored address data from localStorage:', parsed);
        return {
          postcode: parsed.postcode || '',
          address_line_1: parsed.address_line_1 || '',
          address_line_2: parsed.address_line_2 || '',
          town: parsed.town || '',
          county: parsed.county || '',
        };
      }
    } catch (error) {
      console.error('❌ Error restoring address data:', error);
    }
    return {
      postcode: '',
      address_line_1: '',
      address_line_2: '',
      town: '',
      county: '',
    };
  });
  
  // Address field errors
  const [addressErrors, setAddressErrors] = useState<{[key: string]: string}>({});
  const [addressTouched, setAddressTouched] = useState<{[key: string]: boolean}>({});
  const [addressValidated, setAddressValidated] = useState<{[key: string]: boolean}>(() => {
    // Auto-validate pre-filled address fields from localStorage
    try {
      const savedAddress = localStorage.getItem('buyawarranty_addressData');
      if (savedAddress) {
        const parsed = JSON.parse(savedAddress);
        const ukPcRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
        return {
          postcode: !!(parsed.postcode && ukPcRegex.test(parsed.postcode.replace(/\s/g, ''))),
          address_line_1: !!parsed.address_line_1?.trim(),
          town: !!parsed.town?.trim(),
        };
      }
    } catch (e) {}
    return {};
  });
  
  // Track if address lookup failed (for showing manual entry)
  const [addressLookupFailed, setAddressLookupFailed] = useState(false);
  // Track if address fields should be shown (only after lookup selection or manual entry click)
  const [showAddressFields, setShowAddressFields] = useState(false);
  // True when the customer opened the fields via "Enter your address manually" —
  // clearing the search box must not collapse fields they're typing into.
  const [manualAddressEntry, setManualAddressEntry] = useState(false);
  // Only true once the address is COMPLETE: a full address picked from the
  // lookup, or every field filled manually / restored complete. A partial
  // Postcoder fill (postcode + town only) must never trigger the auto-scroll.
  const [addressConfirmedComplete, setAddressConfirmedComplete] = useState(false);
  // Postcode/street/town search input — starts empty even if an address was restored
  const [postcodeInput, setPostcodeInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const postcodeLookupTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // UK postcode regex for validation
  const ukPostcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
  
  // Auto lookup postcode function
  const performPostcodeLookup = useCallback(async (postcode: string) => {
    const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
    if (!ukPostcodeRegex.test(cleanPostcode)) return;
    
    setIsLookingUp(true);
    setAddressLookupFailed(false);
    // A fresh lookup means the address is back to partial until a full
    // address is picked — re-arm the auto-scroll gate.
    setAddressConfirmedComplete(false);
    hasAutoScrolledToPayRef.current = false;
    hasAutoScrolledToPaymentRef.current = false;

    try {
      console.log('🔍 Auto postcode lookup for:', cleanPostcode);

      // Postcoder full address lookup (via edge function, key stays server-side)
      try {
        const { data: pcData, error: pcError } = await supabase.functions.invoke('postcoder-lookup', {
          body: { action: 'find', postcode: cleanPostcode },
        });
        // The lookup service returns slightly different field names depending on
        // version — normalise every shape so the address always fills in.
        const rawRows = Array.isArray(pcData?.addresses)
          ? pcData.addresses
          : Array.isArray(pcData?.suggestions)
            ? pcData.suggestions
            : [];
        const rows = rawRows
          .map((r: any) => (r?.resolved ? r.resolved : r))
          .filter((r: any) => r && (r.line_1 || r.address || r.formatted_address))
          .map((r: any) => ({
            ...r,
            town_or_city: r.town_or_city || r.town || r.posttown || '',
            formatted_address: r.formatted_address || r.address || '',
          }));
        if (!pcError && rows.length > 0) {
          const displayPostcode = rows[0].postcode || postcode;
          const lookupTown = rows[0].town_or_city || '';
          setPostcodeInput(displayPostcode);
          // Fill town/county straight away so the customer only has to pick their house
          setAddressData(prev => ({
            ...prev,
            postcode: displayPostcode,
            town: prev.town?.trim() || lookupTown,
            county: prev.county?.trim() || rows[0].county || '',
          }));
          setAddressValidated(prev => ({
            ...prev,
            postcode: true,
            town: prev.town || !!lookupTown,
          }));
          setAddressErrors(prev => ({ ...prev, postcode: '', town: lookupTown ? '' : prev.town }));
          if (lookupTown) setTownAutoFilled(true);
          setAddressSuggestions(rows);
          setShowAddressDropdown(true);
          setIsLookingUp(false);
          return;
        }
      } catch (pcErr) {
        console.warn('Postcoder lookup unavailable, falling back', pcErr);
      }

      const response = await fetch(`https://api.postcodes.io/postcodes/${cleanPostcode}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📍 Postcode API response:', data);
        if (data.result) {
          const displayPostcode = data.result.postcode || postcode;
          const town = data.result.admin_district || 
                       data.result.parish || 
                       data.result.admin_ward || 
                       data.result.nuts || 
                       '';
          
          console.log('🏘️ Setting town to:', town);
          
          setPostcodeInput(displayPostcode);
          setAddressData(prev => ({ 
            ...prev, 
            postcode: displayPostcode,
            town: town
          }));
          setAddressValidated(prev => ({ 
            ...prev, 
            postcode: true,
            town: !!town
          }));
          // CRITICAL: Clear postcode error when API validates successfully
          setAddressErrors(prev => ({ ...prev, postcode: '' }));
          if (town) {
            setAddressErrors(prev => ({ ...prev, town: '' }));
            setTownAutoFilled(true);
          } else {
            setTownAutoFilled(false);
          }
          setManualAddressEntry(false);
          setShowAddressFields(true);
        } else {
          setAddressLookupFailed(true);
          setManualAddressEntry(true);
          setShowAddressFields(true);
        }
      } else {
        console.log('⚠️ Postcode API returned non-OK status:', response.status);
        setAddressLookupFailed(true);
        setManualAddressEntry(true);
        setShowAddressFields(true);
        const formatted = cleanPostcode.length > 3 
          ? cleanPostcode.slice(0, -3) + ' ' + cleanPostcode.slice(-3) 
          : cleanPostcode;
        setAddressData(prev => ({ ...prev, postcode: formatted }));
        setAddressValidated(prev => ({ ...prev, postcode: true }));
      }
    } catch (err) {
      console.error('Postcode lookup error:', err);
      setAddressLookupFailed(true);
      setManualAddressEntry(true);
      setShowAddressFields(true);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  // Free-text address search — works for street names, towns and partial addresses
  const normaliseAddr = (r: any) => ({
    ...r,
    town_or_city: r.town_or_city || r.town || r.posttown || '',
    formatted_address: r.formatted_address || r.address || '',
  });

  const performAddressSearch = useCallback(async (term: string, drillDown = false) => {
    const query = term.trim();
    if (query.length < 3) return;

    setIsLookingUp(true);
    setAddressLookupFailed(false);
    try {
      let { data, error } = await supabase.functions.invoke('postcoder-lookup', {
        body: { action: 'search', term: query, drillDown },
      });
      // Older versions of the lookup service only support "autocomplete"
      if (error || !Array.isArray(data?.suggestions)) {
        const retry = await supabase.functions.invoke('postcoder-lookup', {
          body: { action: 'autocomplete', term: query, drillDown },
        });
        data = retry.data;
        error = retry.error;
      }
      const rows = Array.isArray(data?.suggestions)
        ? data.suggestions
            .map((s: any) => {
              if (s.container) {
                return { __container: true, label: s.address, count: s.count, drill: s.drill || s.address };
              }
              if (s.resolved) return normaliseAddr(s.resolved);
              if (s.line_1 || s.formatted_address) return normaliseAddr(s);
              // Autocomplete-style result: resolve it when the customer picks it
              if (s.id) {
                const isGroup = s.type === 'group' || Number(s.count) > 1;
                return isGroup
                  ? { __container: true, label: s.address, count: s.count, retrieveId: s.id, searchTerm: query }
                  : { __lookupId: s.id, searchTerm: query, formatted_address: s.address };
              }
              return null;
            })
            .filter(Boolean)
        : [];
      if (rows.length > 0) {
        setAddressSuggestions(rows);
        setShowAddressDropdown(true);
      } else {
        setAddressSuggestions([]);
        setShowAddressDropdown(false);
      }
    } catch (err) {
      console.warn('Address search unavailable', err);
      setAddressSuggestions([]);
      setShowAddressDropdown(false);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  // Populate every address field once the customer picks their final address
  const handleSelectLookupAddress = useCallback((addr: any) => {
    // Full address chosen — the address is now genuinely complete.
    setAddressConfirmedComplete(true);
    const line1 = addr.line_1 || '';
    const line2 = [addr.line_2, addr.line_3].filter(Boolean).join(', ');
    const town = addr.town_or_city || addr.town || addr.posttown || '';
    setAddressData(prev => ({
      ...prev,
      address_line_1: line1,
      address_line_2: line2,
      town: town || prev.town || '',
      county: addr.county || prev.county || '',
      postcode: addr.postcode || prev.postcode,
    }));
    setAddressValidated(prev => ({
      ...prev,
      address_line_1: !!line1,
      town: !!(town || prev.town),
      postcode: true,
    }));
    setAddressErrors(prev => ({ ...prev, address_line_1: '', town: '', postcode: '' }));
    if (addr.postcode) setPostcodeInput(addr.postcode);
    setTownAutoFilled(!!town);
    setShowAddressDropdown(false);
    setAddressSuggestions([]);
    setManualAddressEntry(false);
    setShowAddressFields(true);
  }, []);

  // Turn an autocomplete suggestion id into a full address (or a shorter list)
  const resolveSuggestionId = useCallback(async (id: string, term: string) => {
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('postcoder-lookup', {
        body: { action: 'get', id, term },
      });
      if (error || !data) return;
      if (Array.isArray(data.addresses) && data.addresses.length > 1) {
        setAddressSuggestions(data.addresses.map(normaliseAddr));
        setShowAddressDropdown(true);
        return;
      }
      handleSelectLookupAddress(normaliseAddr(data));
    } catch (err) {
      console.warn('Address retrieve failed', err);
    } finally {
      setIsLookingUp(false);
    }
  }, [handleSelectLookupAddress]);
  
  // Form states
  const [showValidation, setShowValidation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [validatedFields, setValidatedFields] = useState<{[key: string]: boolean}>({});
  const [isLoading, setIsLoading] = useState(false);

  // Returning from Bumper / Payment Assist / Stripe with the browser back button:
  // the browser can restore a frozen, half-rendered snapshot (bfcache) that shows
  // only fragments of text. Always clear the spinner and, if restored from the
  // cache, reload step 4 cleanly from the saved journey data.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      setIsLoading(false);
      if (event.persisted) {
        try {
          const url = new URL(window.location.href);
          if (!url.searchParams.get('step')) url.searchParams.set('step', '4');
          window.location.replace(url.toString());
        } catch {
          window.location.reload();
        }
      }
    };
    window.addEventListener('pageshow', onPageShow as EventListener);
    return () => window.removeEventListener('pageshow', onPageShow as EventListener);
  }, []);
  const [townAutoFilled, setTownAutoFilled] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  
  // Embedded Stripe checkout modal state
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState<string | null>(null);
  
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
    stripe_coupon_id?: string;
    stripe_promo_code_id?: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('buyawarranty_appliedDiscountCodes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          console.log('✅ Restored applied discount codes from localStorage:', parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error('❌ Error restoring discount codes:', error);
    }
    return [];
  });

  // Persist applied discount codes so they survive back-nav between steps
  useEffect(() => {
    try {
      if (appliedDiscountCodes.length > 0) {
        localStorage.setItem('buyawarranty_appliedDiscountCodes', JSON.stringify(appliedDiscountCodes));
      } else {
        localStorage.removeItem('buyawarranty_appliedDiscountCodes');
      }
      // Notify any other mounted component (Step 3 sticky bar) that the promo changed
      window.dispatchEvent(new Event('promoCodesChanged'));
    } catch (error) {
      console.error('❌ Error saving discount codes:', error);
    }
  }, [appliedDiscountCodes]);

  // Auto-apply promo code from email link (?promo=SAVE10TODAY)
  // Per-code minimum spend is enforced server-side by validate-discount-code.
  const hasAutoAppliedPromo = React.useRef(false);
  useEffect(() => {
    if (hasAutoAppliedPromo.current) return;
    const savedPromo = localStorage.getItem('buyawarranty_promoCode');
    if (savedPromo && appliedDiscountCodes.length === 0) {
      hasAutoAppliedPromo.current = true;
      localStorage.removeItem('buyawarranty_promoCode');
      // Set the input and trigger apply
      setPromoCodeInput(savedPromo);
      setPromoOpen(true);
      // Delay to allow component to mount fully, then auto-apply
      setTimeout(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('validate-discount-code', {
            body: { code: savedPromo, vehicleReg: vehicleData.regNumber, orderAmount: bumperTotalPrice }
          });
          if (error || !data?.valid) {
            setPromoCodeError(data?.error || data?.message || 'Invalid promo code');
            return;
          }
          const discountCode = data.discountCode;
          if (!discountCode) return;
          setAppliedDiscountCodes([{
            code: savedPromo,
            type: discountCode.type,
            value: discountCode.value,
            discountAmount: 0,
          }]);
          setPromoCodeInput('');
          // Show pink Airbnb-style toast
          toast.success(`🎉 Code ${savedPromo} applied — you're saving ${discountCode.type === 'percentage' ? `${discountCode.value}%` : `£${discountCode.value}`}!`, {
            style: {
              background: '#E91E63',
              color: '#ffffff',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
            },
            duration: 5000,
          });
        } catch (err) {
          console.error('Auto-apply promo failed:', err);
        }
      }, 500);
    }
  }, []);

  // Pricing data state - ALWAYS use pricingData from Step 3 as source of truth
  // RECOVERY: if Step 3 hands us an empty/zero price (stale session, refresh on Step 4,
  // restored quote), fall back to the last known good pricing snapshot so the customer
  // never sees "£0" on the order summary.
  const recoverPricing = useCallback((pd: typeof pricingData) => {
    if (pd && (pd.totalPrice > 0 || (pd.monthlyPrice ?? 0) > 0)) return pd;
    try {
      const cached = localStorage.getItem('buyawarranty_originalPricingData');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.totalPrice > 0 || (parsed.monthlyPrice ?? 0) > 0)) {
          console.warn('⚠️ Step 4 received £0 pricing — recovered from cached snapshot', parsed);
          return { ...pd, ...parsed };
        }
      }
      const plan = localStorage.getItem('buyawarranty_selectedPlan');
      if (plan) {
        const p = JSON.parse(plan);
        const total = Number(p?.pricingData?.totalPrice ?? p?.totalPrice ?? 0);
        const monthly = Number(p?.pricingData?.monthlyPrice ?? p?.monthlyPrice ?? 0);
        if (total > 0 || monthly > 0) {
          console.warn('⚠️ Step 4 received £0 pricing — recovered from selectedPlan', { total, monthly });
          return { ...pd, ...(p.pricingData || {}), totalPrice: total || monthly * 12, monthlyPrice: monthly || Math.ceil(total / 12) };
        }
      }
    } catch (e) {
      console.error('Pricing recovery failed:', e);
    }
    return pd;
  }, []);

  const [updatedPricingData, setUpdatedPricingData] = useState(() => {
    const recovered = recoverPricing(pricingData);
    if (recovered.totalPrice > 0) {
      localStorage.setItem('buyawarranty_originalPricingData', JSON.stringify(recovered));
    }
    return recovered;
  });

  // Sync updatedPricingData when pricingData prop changes
  useEffect(() => {
    const recovered = recoverPricing(pricingData);
    const step3Monthly = recovered.monthlyPrice ?? Math.ceil(recovered.totalPrice / 12);
    const step3Total = step3Monthly * 12;
    console.log('📊 Step 4: Syncing pricing from Step 3:', {
      receivedTotal: pricingData.totalPrice,
      receivedMonthly: pricingData.monthlyPrice,
      computedMonthly: step3Monthly,
      computedTotal: step3Total,
      match: recovered.totalPrice === step3Total
    });
    setUpdatedPricingData(recovered);
    if (recovered.totalPrice > 0) {
      localStorage.setItem('buyawarranty_originalPricingData', JSON.stringify(recovered));
    }
  }, [pricingData.totalPrice, pricingData.monthlyPrice, recoverPricing]);


  // Track if customer originally selected "under 120k" on homepage
  const [originalMileageWasUnder120k] = useState(() => {
    const originalMileage = parseInt(vehicleData.mileage?.replace(/[^0-9]/g, '') || '0');
    return originalMileage <= 120000;
  });

  // Track if high mileage surcharge applies based on entered mileage
  const [highMileageSurchargeApplied, setHighMileageSurchargeApplied] = useState(false);
  const [highMileageSurchargeAmount, setHighMileageSurchargeAmount] = useState(0);
  // Confirmation for sub-10,000 mileage entries (4-digit values). Green tick only
  // appears automatically for 5+ digit values (>= 10,000). Anything lower requires
  // an explicit "yes, this is correct" tick from the customer.
  const [mileageConfirmedLow, setMileageConfirmedLow] = useState(false);
  // Over-150,000-mile callback request modal
  const [showHighMileageCallback, setShowHighMileageCallback] = useState(false);
  
  // Fetch MOT mileage from database
  const { motMileage: dbMotMileage, motDate: dbMotDate, isLoading: motLoading } = useMotMileage(vehicleData.regNumber);
  const [mileagePreFilled, setMileagePreFilled] = useState(false);
  const [mileagePrefillSource, setMileagePrefillSource] = useState<'mot' | 'session' | null>(null);
  // Fallback to the MOT reading captured at Step 1 (reg-only journey) when the
  // mot_history table has no row for this registration yet.
  const storedMot = useMemo(() => {
    try {
      const m = Number(String(localStorage.getItem('baw_mot_mileage') || '').replace(/[^0-9]/g, ''));
      const d = localStorage.getItem('baw_mot_mileage_date');
      return { mileage: m > 0 ? m : null, date: d || null };
    } catch {
      return { mileage: null as number | null, date: null as string | null };
    }
  }, []);
  const motMileage = dbMotMileage ?? storedMot.mileage;
  const motDate = dbMotDate ?? storedMot.date;
  const numericMotMileage = useMemo(() => Number(String(motMileage || '').replace(/[^0-9]/g, '')), [motMileage]);
  const motDateLabel = useMemo(() => {
    if (!motDate) return '';
    const d = new Date(motDate);
    return isNaN(d.getTime()) ? '' : format(d, 'd MMMM yyyy');
  }, [motDate]);
  // The reg-only journey prices from the last MOT odometer reading, so here we
  // only ask the customer to CONFIRM that mileage — and we honour the price they
  // were already shown even if they correct it upward.
  const [quotedFromMotMileage] = useState(() => {
    try {
      return localStorage.getItem('baw_mileage_source') === 'mot';
    } catch (e) {
      return false;
    }
  });
  // Mileage the customer typed at Step 1 when no MOT reading was available.
  const storedCustomerMileage = useMemo(() => {
    try {
      const m = Number(String(localStorage.getItem('baw_customer_mileage') || '').replace(/[^0-9]/g, ''));
      return m > 0 ? m : null;
    } catch {
      return null as number | null;
    }
  }, []);
  const motPrefillDone = useRef(false);
  useEffect(() => {
    if (motPrefillDone.current) return;
    if (numericMotMileage > 0 && !customerData.mileage) {
      motPrefillDone.current = true;
      setCustomerData(prev => ({ ...prev, mileage: String(numericMotMileage) }));
      setValidatedFields(prev => ({ ...prev, mileage: numericMotMileage <= 150000 }));
      setMileagePreFilled(true);
      setMileagePrefillSource('mot');
      setMileageConfirmedLow(true);
      return;
    }
    // No MOT reading — reuse the mileage the customer gave us at Step 1.
    if (numericMotMileage <= 0 && !motLoading && storedCustomerMileage && !customerData.mileage) {
      motPrefillDone.current = true;
      setCustomerData(prev => ({ ...prev, mileage: String(storedCustomerMileage) }));
      setValidatedFields(prev => ({ ...prev, mileage: storedCustomerMileage <= 150000 }));
      setMileagePreFilled(true);
      setMileagePrefillSource('session');
      setMileageConfirmedLow(storedCustomerMileage <= 150000);
    }
  }, [numericMotMileage, customerData.mileage, motLoading, storedCustomerMileage]);


  const mileageQuickSelectOptions = useMemo(() => {
    if (!numericMotMileage) return [];
    return [0, 2500, 5000]
      .map(delta => ({
        delta,
        value: numericMotMileage + delta,
        label: delta === 0
          ? `${numericMotMileage.toLocaleString('en-GB')} (same as MOT)`
          : `${(numericMotMileage + delta).toLocaleString('en-GB')} (+${delta.toLocaleString('en-GB')})`,
      }))
      .filter(option => option.value <= 150000);
  }, [numericMotMileage]);

  // Estimate today's mileage: MOT mileage + ~12,000 miles/year since MOT date, rounded to nearest 1,000
  const estimatedMileagePlaceholder = useMemo(() => {
    if (!numericMotMileage) return 'e.g. 50,000';
    let estimated = numericMotMileage;
    if (motDate) {
      const motTime = new Date(motDate).getTime();
      if (!isNaN(motTime)) {
        const years = (Date.now() - motTime) / (365.25 * 24 * 60 * 60 * 1000);
        if (years > 0) estimated = numericMotMileage + years * 12000;
      }
    }
    const rounded = Math.round(estimated / 1000) * 1000;
    return `e.g. ${rounded.toLocaleString('en-GB')}`;
  }, [numericMotMileage, motDate]);

  // Numeric suggestion (MOT + ~12k/yr since MOT, rounded to nearest 1,000).
  // NOT capped at 150,000 — capping used to hide vehicles that are actually
  // over the eligibility limit behind a "Use 150,000" button.
  const suggestedMileage = useMemo(() => {
    if (!numericMotMileage) return 0;
    let estimated = numericMotMileage;
    if (motDate) {
      const motTime = new Date(motDate).getTime();
      if (!isNaN(motTime)) {
        const years = (Date.now() - motTime) / (365.25 * 24 * 60 * 60 * 1000);
        if (years > 0) estimated = numericMotMileage + years * 12000;
      }
    }
    return Math.round(estimated / 1000) * 1000;
  }, [numericMotMileage, motDate]);

  // Last MOT odometer reading already exceeds our 150,000-mile limit — the
  // vehicle is not eligible for online cover whatever the customer types.
  const motOverLimit = numericMotMileage > 150000;

  // MOT cross-check: soft warning when entered mileage looks lower than the last MOT.
  const [motWarningDismissed, setMotWarningDismissed] = useState(false);
  const enteredMileageNumber = useMemo(
    () => Number(String(customerData.mileage || '').replace(/[^0-9]/g, '')) || 0,
    [customerData.mileage]
  );
  const showMotWarning =
    numericMotMileage > 0 &&
    !motOverLimit &&
    enteredMileageNumber >= 1000 &&
    enteredMileageNumber < numericMotMileage &&
    !motWarningDismissed;

  // Track MOT match for UI state (do NOT auto-prefill)
  useEffect(() => {
    if (motMileage && customerData.mileage && String(customerData.mileage) === String(motMileage)) {
      setMileagePreFilled(true);
      setMileagePrefillSource('mot');
    }
  }, [motMileage, customerData.mileage]);


  // Persist mileage to sessionStorage so it can be re-used in the same session
  useEffect(() => {
    try {
      const m = String(customerData.mileage || '').replace(/[^0-9]/g, '');
      if (m && Number(m) > 0) {
        sessionStorage.setItem('baw_last_mileage', m);
      }
    } catch (e) {
      // ignore
    }
  }, [customerData.mileage]);

  const handleClearMileage = () => {
    setCustomerData(prev => ({ ...prev, mileage: '' }));
    setValidatedFields(prev => ({ ...prev, mileage: false }));
    setMileagePreFilled(false);
    setMileagePrefillSource(null);
    try { sessionStorage.removeItem('baw_last_mileage'); } catch (e) { /* ignore */ }
    // Focus back on the input for quick re-entry
    setTimeout(() => {
      const el = document.getElementById('mileage') as HTMLInputElement | null;
      el?.focus();
    }, 0);
  };

  // Calculate high mileage surcharge based on warranty duration
  const getHighMileageSurcharge = (enteredMileage: number): number => {
    if (enteredMileage > 120000 && enteredMileage <= 150000) {
      if (paymentType === '12months') return 100;
      if (paymentType === '24months') return 150;
      if (paymentType === '36months') return 200;
    }
    return 0;
  };

  // Effect to handle mileage change and recalculate pricing
  // CRITICAL: Step 3's monthlyPrice is the source of truth - preserve it when adding surcharges
  // INVARIANT: monthlyPrice * 12 MUST equal totalPrice (otherwise Bumper gets fractional £/mo)
  useEffect(() => {
    const enteredMileage = parseInt(customerData.mileage?.replace(/[^0-9]/g, '') || '0');
    // Get Step 3's monthlyPrice as the base (source of truth)
    const step3MonthlyPrice = pricingData.monthlyPrice ?? Math.ceil(pricingData.totalPrice / 12);
    
    // When the quote was priced from the MOT reading, we honour the price the
    // customer was shown even if they correct the mileage upward at this step.
    if (!quotedFromMotMileage && originalMileageWasUnder120k && enteredMileage > 120000 && enteredMileage <= 150000) {
      const surcharge = getHighMileageSurcharge(enteredMileage);
      // Surcharge added to total; monthly = floor((total+surcharge)/12) so monthly*12 stays
      // consistent with totalPrice (prevents Bumper £25.58 / Step 4 £25 fractional drift).
      const newTotalPrice = (step3MonthlyPrice * 12) + surcharge;
      const newMonthlyPrice = Math.ceil(newTotalPrice / 12); // round UP so monthly*12 >= total
      const reconciledTotal = newMonthlyPrice * 12; // KEEP IN SYNC

      if (!highMileageSurchargeApplied || highMileageSurchargeAmount !== surcharge) {
        console.log('📊 High mileage surcharge applied:', { enteredMileage, surcharge, newMonthlyPrice, reconciledTotal, paymentType });
        setHighMileageSurchargeApplied(true);
        setHighMileageSurchargeAmount(surcharge);
        
        setUpdatedPricingData(prev => ({
          ...prev,
          totalPrice: reconciledTotal,
          monthlyPrice: newMonthlyPrice
        }));
      }
    } else if (highMileageSurchargeApplied && (enteredMileage <= 120000 || enteredMileage > 150000)) {
      console.log('📊 High mileage surcharge removed:', { enteredMileage });
      setHighMileageSurchargeApplied(false);
      setHighMileageSurchargeAmount(0);
      // Restore exact Step 3 pricing (source of truth) - reconciled to invariant
      const reconciledMonthly = pricingData.monthlyPrice ?? Math.ceil(pricingData.totalPrice / 12);
      setUpdatedPricingData({
        ...pricingData,
        totalPrice: reconciledMonthly * 12,
        monthlyPrice: reconciledMonthly,
      });
    }
  }, [customerData.mileage, originalMileageWasUnder120k, quotedFromMotMileage, paymentType, pricingData.totalPrice, pricingData.monthlyPrice]);

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
  // Step 3 displays: monthlyPrice = Math.ceil(totalPrice / 12), and Total = monthlyPrice * 12
  // So Step 4 MUST use the same formula to match exactly
  const baseTotalPrice = updatedPricingData.totalPrice;
  // CRITICAL: Always floor monthlyPrice to ensure it's a whole number
  // Step 3 uses Math.ceil(totalPrice / 12), so Step 4 must match exactly
  // This prevents Bumper from showing fractional amounts (e.g., £46.75 instead of £46)
  const monthlyPrice = Math.ceil(updatedPricingData.monthlyPrice ?? Math.ceil(baseTotalPrice / 12));
  
  // CRITICAL: For monthly payments, the displayed total MUST be monthlyPrice * 12
  // This matches Step 3's "Total: £X" which is calculated as monthlyPrice * 12
  // NOT the raw totalPrice (which may differ due to flooring)
  const bumperTotalPrice = monthlyPrice * 12;

  // INVARIANT GUARD: Step 3 should hand us values that satisfy monthlyPrice*12 === totalPrice.
  // If they don't, log loudly so we can pinpoint which upstream path produced bad data
  // (stale localStorage selectedPlan / quote restoration / surcharge desync).
  if (typeof window !== 'undefined' && updatedPricingData?.totalPrice && updatedPricingData?.monthlyPrice) {
    const expected = updatedPricingData.monthlyPrice * 12;
    if (expected !== updatedPricingData.totalPrice) {
      console.warn('⚠️ Step 4 pricing invariant broken (monthly*12 ≠ total):', {
        receivedTotal: updatedPricingData.totalPrice,
        receivedMonthly: updatedPricingData.monthlyPrice,
        expectedTotal: expected,
        canonicalBumperTotal: bumperTotalPrice,
        delta: updatedPricingData.totalPrice - expected,
        paymentType,
        planId,
        voluntaryExcess: updatedPricingData.voluntaryExcess,
        claimLimit: updatedPricingData.claimLimit,
        labourRate: updatedPricingData.labourRate,
        boostAddon: updatedPricingData.boostAddon,
        highMileageSurchargeApplied,
        highMileageSurchargeAmount,
      });
    }
  }
  
  // Pay in full uses 10% discount on the floored monthly total
  // CRITICAL: Must match Step 3's formula: total - Math.floor(total * 0.10)
  // NOT Math.floor(total * 0.90) which can differ by £1 due to rounding
  const stripeSavingsBase = Math.floor(bumperTotalPrice * 0.10);
  const stripeTotalPrice = bumperTotalPrice - stripeSavingsBase;

  // Calculate discounts with minimum price floor (Stripe requires minimum £0.50, we use £1 for safety)
  // Hard floor = the net sell floor for this term (£399/£769/£1,099 for
  // 12/24/36 months, halved for motorbikes) — promo codes may NOT take a sale
  // below it. Mirrors supabase/functions/_shared/price-floor.ts, which rejects
  // any charge under the same floor server-side.
  // Manager test codes (SAVE99GOLDEN / TEST*) drop the floor to £1 so 99%-off QA runs work.
  const checkoutPeriod = String(paymentType || '').includes('36')
    ? '36months'
    : String(paymentType || '').includes('24')
      ? '24months'
      : '12months';
  const checkoutTermFloor = getNetPayableFloor({
    paymentPeriod: checkoutPeriod as '12months' | '24months' | '36months',
    voluntaryExcess: updatedPricingData.voluntaryExcess ?? 100,
    claimLimit: updatedPricingData.claimLimit || 2000,
    labourRate: pricingData.labourRate || 50,
    isMotorbike: /motor\s*(bike|cycle)|\bbike\b/i.test(String((vehicleData as any)?.vehicleType || '')),
    surface: 'admin',
  });
  const MINIMUM_PRICE = minimumPriceForCodes(appliedDiscountCodes, checkoutTermFloor);
  const hasValidDiscountCodes = appliedDiscountCodes.length > 0;

  
  // CRITICAL: Calculate discount amounts based on the SELECTED payment method
  // For monthly payments (Bumper): discount applies to bumperTotalPrice
  // For pay in full (Stripe): discount applies to stripeTotalPrice (which already has 10% off)
  const calculateDiscountForPaymentMethod = (basePrice: number) => {
    return appliedDiscountCodes.reduce((sum, code) => {
      const discountAmount = code.type === 'percentage' 
        ? basePrice * (code.value / 100)
        : code.value;
      return sum + discountAmount;
    }, 0);
  };
  
  // Calculate discounts separately for each payment method
  const bumperDiscountAmount = calculateDiscountForPaymentMethod(bumperTotalPrice);
  const stripeDiscountAmount = calculateDiscountForPaymentMethod(stripeTotalPrice);
  
  // Apply discount but ensure we never go below minimum price
  // For bumper (monthly): cap discount so final price >= £1
  const maxBumperDiscount = bumperTotalPrice - MINIMUM_PRICE;
  const effectiveBumperDiscount = Math.min(bumperDiscountAmount, maxBumperDiscount);
  const discountedBumperPrice = Math.max(MINIMUM_PRICE, Math.floor(bumperTotalPrice - effectiveBumperDiscount));
  
  // For stripe (pay in full): cap discount so final price >= £1
  // IMPORTANT: Discount is calculated on stripeTotalPrice (already 10% off), not bumperTotalPrice
  const maxStripeDiscount = stripeTotalPrice - MINIMUM_PRICE;
  const effectiveStripeDiscount = Math.min(stripeDiscountAmount, maxStripeDiscount);
  const discountedStripePrice = Math.max(MINIMUM_PRICE, Math.floor(stripeTotalPrice - effectiveStripeDiscount));
  
  // For display purposes, show the discount amount relevant to the current selection
  const totalDiscountAmount = selectedPayment === 'full' ? effectiveStripeDiscount : effectiveBumperDiscount;
  
  // Base savings from 10% pay-in-full discount
  const baseSavings = bumperTotalPrice - stripeTotalPrice;
  // Total savings including promo code (for "Pay in Full" option)
  const totalSavings = bumperTotalPrice - discountedStripePrice;
  // Use totalSavings when promo codes are applied, otherwise baseSavings
  const savings = hasValidDiscountCodes ? totalSavings : baseSavings;
  
  // Calculate discounted monthly price - use Step 3 monthly price when no discounts, otherwise recalculate
  const discountedMonthlyPrice = hasValidDiscountCodes 
    ? Math.max(1, Math.ceil(discountedBumperPrice / 12)) 
    : monthlyPrice;

  // Display total for monthly option: when promo applied, show discounted total (monthly * 12)
  // This ensures "Total £X" always matches the displayed monthly price × 12
  const displayBumperTotal = hasValidDiscountCodes ? discountedMonthlyPrice * 12 : bumperTotalPrice;

  // ------------------------------------------------------------------
  // Checkout struggle tracker — flags stuck/failed customers to admins
  // ------------------------------------------------------------------
  const struggleTracker = useCheckoutStruggleTracker({
    enabled: true,
    customer: {
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      email: customerData.email,
      phone: customerData.phone,
    },
    vehicleReg: vehicleData.regNumber,
    paymentType: selectedPayment || undefined,
    planName,
    amount: selectedPayment === 'full' ? discountedStripePrice : discountedBumperPrice,
    paymentMethod: selectedPayment === 'full' ? 'stripe' : 'bumper',
  });

  // Helper: is the entered mileage a valid, "trusted" value?
  // 5+ digit values (>= 10,000) are trusted automatically. 4-digit values
  // (1,000 – 9,999) require an explicit confirmation tick from the customer.
  const mileageValueValid = useMemo(() => {
    const n = parseInt(String(customerData.mileage || '').replace(/[^0-9]/g, '') || '0');
    if (!n || n < 1000 || n > 150000) return false;
    if (motOverLimit) return false;
    if (n < 10000) return mileageConfirmedLow;
    return true;
  }, [customerData.mileage, mileageConfirmedLow, motOverLimit]);

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
      mileageValueValid
    );
  }, [customerData.first_name, customerData.last_name, customerData.email, customerData.phone, mileageValueValid]);
  
  // Check if address is complete (required fields)
  // Check if address is complete - simplified fields
  const addressComplete = useMemo(() => {
    const ukPostcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    return !!(
      postcodeInput.trim() &&
      addressData.address_line_1?.trim() &&
      addressData.town?.trim() &&
      addressData.postcode?.trim() &&
      ukPostcodeRegex.test(addressData.postcode.replace(/\s/g, ''))
    );
  }, [addressData, postcodeInput]);
  
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
    if (!mileageValueValid) count++;
    return count;
  }, [customerData, mileageValueValid]);

  // Mark the address as confirmed-complete when every field is filled WITHOUT
  // going through the lookup picker: manual entry, or details restored
  // already complete from an earlier step. A partial Postcoder fill (postcode
  // + town while the suggestion dropdown is still open) never counts.
  useEffect(() => {
    if (addressConfirmedComplete) return;
    if (!addressComplete) return;
    if (showAddressDropdown || isLookingUp) return;
    if (manualAddressEntry) {
      setAddressConfirmedComplete(true);
      return;
    }
    // Restored/pre-filled complete address (no lookup in flight, no dropdown).
    if (addressSuggestions.length === 0) {
      setAddressConfirmedComplete(true);
    }
  }, [addressComplete, addressConfirmedComplete, manualAddressEntry, showAddressDropdown, isLookingUp, addressSuggestions.length]);

  // Auto-scroll to "Choose how you want to pay" only once personal details AND a
  // fully confirmed address (picked in full or every field completed) are in place.
  const hasAutoScrolledToPayRef = React.useRef(false);
  useEffect(() => {
    if (hasAutoScrolledToPayRef.current) return;
    if (personalDetailsComplete && addressComplete && addressConfirmedComplete && !showAddressDropdown && !isLookingUp) {
      hasAutoScrolledToPayRef.current = true;
      setTimeout(() => {
        const paySection = document.getElementById('how-to-pay-section');
        if (paySection) {
          paySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [personalDetailsComplete, addressComplete, addressConfirmedComplete, showAddressDropdown, isLookingUp]);

  // Track if component has been mounted (for bfcache handling)
  const hasMountedRef = React.useRef(false);
  const [isPageRestored, setIsPageRestored] = useState(false);
   
   // Desktop sticky bar visibility based on scroll position
   const [showDesktopStickyBar, setShowDesktopStickyBar] = useState(false);
   const aboutYouRef = React.useRef<HTMLElement>(null);
   
   // Track whether the bottom CTA (HowToPaySection / Stripe form) is visible or scrolled past
   const [isBottomCtaFullyVisible, setIsBottomCtaFullyVisible] = useState(false);
   const [isScrolledPastBottomCta, setIsScrolledPastBottomCta] = useState(false);
   const bottomCtaRef = React.useRef<HTMLDivElement>(null);
   
    // Track when the bottom CTA button area is actually in view (not just the top of the section).
    // The HowToPaySection wrapper is tall, so we only consider the CTA "visible" when its
    // bottom edge has scrolled into the viewport — meaning the user can actually see the
    // inline "Activate my cover" button. Only then do we minimise the floating sticky bar.
    useEffect(() => {
      const el = bottomCtaRef.current;
      if (!el) return;

      const handleCheck = () => {
        const rect = el.getBoundingClientRect();
        const viewportH = window.innerHeight;
        // Inline CTA button sits near the bottom of this section. Consider it "visible"
        // when the section's bottom is within the viewport (with a small buffer).
        const ctaInView = rect.bottom <= viewportH + 80 && rect.bottom >= 120;
        const scrolledPast = rect.bottom < 120;

        setIsBottomCtaFullyVisible(ctaInView);
        setIsScrolledPastBottomCta(scrolledPast);
      };

      handleCheck();
      window.addEventListener('scroll', handleCheck, { passive: true });
      window.addEventListener('resize', handleCheck);
      return () => {
        window.removeEventListener('scroll', handleCheck);
        window.removeEventListener('resize', handleCheck);
      };
    }, []);
   
   // Track scroll to show/hide desktop sticky bar
   useEffect(() => {
     const handleScroll = () => {
       if (!aboutYouRef.current) return;
       
       const aboutYouRect = aboutYouRef.current.getBoundingClientRect();
       // Show sticky bar when "About you" section top is above viewport (scrolled past it)
       const shouldShow = aboutYouRect.top < 0;
       setShowDesktopStickyBar(shouldShow);
     };
     
     window.addEventListener('scroll', handleScroll, { passive: true });
     handleScroll(); // Check initial position
     
     return () => window.removeEventListener('scroll', handleScroll);
   }, []);

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
    
    // Keep address section open for customer review - do NOT auto-collapse
    // Users need to confirm their details before proceeding
  }, [personalDetailsComplete, addressComplete]);

  // The "please complete…" banner stays on screen for six seconds, so a customer
  // who fixes the offending field straight away (picking "Same as MOT", for
  // example) was left staring at an error that no longer applied. Clear it the
  // moment nothing is outstanding.
  useEffect(() => {
    if (personalDetailsComplete && addressComplete) {
      toast.dismiss('checkout-required-fields');
    }
  }, [personalDetailsComplete, addressComplete]);

  // Track page load
  useEffect(() => {
    trackStripeCheckoutPageLoad();
  }, []);

  // Auto-scroll to "How to Pay" section when the address is fully confirmed
  useEffect(() => {
    // Only if address is complete AND confirmed (full pick or all fields filled)
    if (!addressComplete || !addressConfirmedComplete) return;
    if (showAddressDropdown || isLookingUp) return;

    // Only trigger once per session
    if (hasAutoScrolledToPaymentRef.current) return;

    // Ensure all required address fields are filled
    const isAddressFullyComplete =
      addressData.postcode?.trim() &&
      addressData.address_line_1?.trim() &&
      addressData.town?.trim();

    if (isAddressFullyComplete) {
      hasAutoScrolledToPaymentRef.current = true;

      // Small delay to ensure DOM is updated
      setTimeout(() => {
        if (howToPayRef.current) {
          howToPayRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 300);
    }
  }, [addressComplete, addressConfirmedComplete, showAddressDropdown, isLookingUp, addressData.postcode, addressData.address_line_1, addressData.town]);

  // Auto-validate pre-filled fields from Step 2
  useEffect(() => {
    const autoValidatePrefilledFields = () => {
      // CRITICAL: Force reload from localStorage to ensure fields are populated
      try {
        const savedCustomerData = localStorage.getItem('buyawarranty_customerData');
        if (savedCustomerData) {
          const parsed = JSON.parse(savedCustomerData);
          console.log('🔄 Step 4: Re-checking localStorage for pre-filled data:', parsed);
          
          // Only update if current fields are empty but localStorage has data
          setCustomerData(prev => {
            const updated = { ...prev };
            if (!prev.first_name && parsed.first_name) {
              updated.first_name = parsed.first_name;
            }
            if (!prev.email && parsed.email) {
              updated.email = parsed.email;
            }
            if (!prev.phone && parsed.phone) {
              updated.phone = parsed.phone;
            }
            return updated;
          });
        }
      } catch (error) {
        console.error('Error re-loading customer data:', error);
      }
      
      // Short delay to allow state to update before validating
      setTimeout(() => {
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
          // Clear any errors for pre-filled valid fields
          setFieldErrors(prev => {
            const updated = { ...prev };
            Object.keys(newValidatedFields).forEach(field => {
              delete updated[field];
            });
            return updated;
          });
        }
      }, 100);
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
              // Always start mileage empty — never prefill from previous sessions
              setCustomerData({ ...parsed.customerData, mileage: '' });

            }
            // Restore address data if available
            if (parsed.addressData) {
              setAddressData(parsed.addressData);
              setShowAddressFields(true);
              setPostcodeInput(parsed.addressData.postcode || '');
            }
            // Restore payment type if available
            if (parsed.paymentMethod === 'full' || parsed.paymentMethod === 'monthly') {
              const restoredPayment = parsed.paymentMethod;
              setSelectedPayment(restoredPayment);
              selectedPaymentRef.current = restoredPayment;
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
            full_name: customerData.first_name ? `${customerData.first_name} ${customerData.last_name || ''}`.trim() : (customerData.full_name?.trim() || null),
            phone: customerData.phone?.trim() || undefined,
            vehicle_reg: vehicleData.regNumber || '',
            vehicle_make: vehicleData.make || '',
            vehicle_model: vehicleData.model || '',
            vehicle_year: vehicleData.year || '',
            vehicle_type: 'car',
            mileage: vehicleData.mileage || '',
            plan_name: planName || '',
            payment_type: paymentType || '',
            step_abandoned: 4,
            ...(getSessionFbclid() ? { fbclid: getSessionFbclid() } : {}),
            ...(getSessionOrUrlGclid() ? { gclid: getSessionOrUrlGclid() } : {}),
            ...(getAttributionGclid() ? { gclid_any: getAttributionGclid() } : {}),
            ...(getTrackingSessionId() ? { tracking_session_id: getTrackingSessionId() } : {}),
            ...(!getSessionFbclid() && getSessionFbReferrer() ? { fb_referrer: getSessionFbReferrer() } : {}),
            device_type: detectDeviceType(),
            ...getUtmPayload(),
            ...getEntryPayload(),
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

  // Save address data to localStorage for recovery after Bumper/payment redirects
  useEffect(() => {
    try {
      localStorage.setItem('buyawarranty_addressData', JSON.stringify(addressData));
    } catch (error) {
      console.error('Error saving address data:', error);
    }
  }, [addressData]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setCustomerData((prev: typeof customerData) => ({ ...prev, [field]: value }));
    if (paymentError) setPaymentError('');
    
    // Live validate immediately with the NEW value (not stale state)
    if (typeof value === 'string') {
      validateField(field, value, { onBlur: false });
    }
  };

  const handleFieldBlur = (field: string) => {
    validateField(field, undefined, { onBlur: true });
  };

  // validateField accepts an optional currentValue to avoid stale state reads
  // When called from handleInputChange, the state hasn't updated yet,
  // so we pass the new value directly for instant real-time validation.
  const validateField = (field: string, currentValue?: string, opts?: { onBlur?: boolean }): boolean => {
    const isBlurOrSubmit = opts?.onBlur !== false; // default true (submit path passes no opts)
    let isValid = true;
    let error = '';

    // Use provided value if available, otherwise fall back to state
    const getValue = (f: string) => {
      if (f === field && currentValue !== undefined) return currentValue;
      return (customerData as any)[f] || '';
    };

    switch (field) {
      case 'first_name': {
        const val = getValue('first_name');
        if (!val?.trim()) {
          error = 'First name is required';
          isValid = false;
        } else if (val.trim().length < 2) {
          error = 'First name must be at least 2 characters';
          isValid = false;
        }
        break;
      }
      case 'last_name': {
        const val = getValue('last_name');
        if (!val?.trim()) {
          error = 'Please enter your last name.';
          isValid = false;
        } else if (val.trim().length < 2) {
          error = 'Last name must be at least 2 characters';
          isValid = false;
        }
        break;
      }
      case 'email': {
        const val = getValue('email');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!val?.trim()) {
          error = 'Email is required';
          isValid = false;
        } else if (!emailRegex.test(val)) {
          error = 'Please enter a valid email';
          isValid = false;
        }
        break;
      }
      case 'phone': {
        const val = getValue('phone');
        const cleanedPhone = val?.replace(/\s/g, '') || '';
        const ukPhoneRegex = /^(?:(?:\+44)|(?:0))(?:\d{10}|\d{9})$/;
        if (!cleanedPhone) {
          error = 'Phone number is required';
          isValid = false;
        } else if (!ukPhoneRegex.test(cleanedPhone)) {
          error = 'Please enter a valid UK phone number';
          isValid = false;
        }
        break;
      }
      case 'mileage': {
        const val = getValue('mileage');
        const mileage = parseInt(val || '0');
        if (!val) {
          error = 'Please enter your current mileage.';
          isValid = false;
        } else if (mileage < 1000) {
          error = 'Please enter a valid mileage (at least 1,000).';
          isValid = false;
        } else if (mileage > 150000) {
          error = 'Maximum 150,000 miles';
          isValid = false;
        } else if (motOverLimit) {
          error = `Your last MOT recorded ${numericMotMileage.toLocaleString('en-GB')} miles, which is over our 150,000-mile limit.`;
          isValid = false;
        } else if (mileage < 10000 && !mileageConfirmedLow) {
          error = 'Please tick the box below to confirm this mileage is correct.';
          isValid = false;
        }
        break;
      }
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
          error = 'Please enter your address.';
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
        // Nothing typed and nothing picked — the customer skipped the address entirely.
        if (!postcodeInput.trim() || !addressData.postcode?.trim()) {
          error = 'Please enter postcode';
          isValid = false;
        } else if (!ukPostcodeRegex.test(addressData.postcode.replace(/\s/g, ''))) {
          // Trust an API-confirmed postcode even if the raw string looks odd.
          if (addressValidated.postcode) {
            isValid = true;
            error = '';
          } else {
            error = 'Please enter a valid UK postcode.';
            isValid = false;
          }
        }
        break;
    }

    setAddressErrors(prev => ({ ...prev, [field]: error }));
    setAddressValidated(prev => ({ ...prev, [field]: isValid }));
    return isValid;
  };

  // Validate all address fields
  const validateAddressForm = (): boolean => {
    const requiredFields = ['address_line_1', 'town', 'postcode'];
    let allValid = true;
    
    requiredFields.forEach(field => {
      if (!validateAddressField(field)) allValid = false;
    });
    
    return allValid;
  };

  const validateForm = (): boolean => {
    const requiredFields = ['first_name', 'last_name', 'dob', 'email', 'phone', 'mileage'];
    let allValid = true;
    
    requiredFields.forEach(field => {
      if (!validateField(field)) allValid = false;
    });
    
    // Also validate address fields
    if (!validateAddressForm()) allValid = false;
    
    return allValid;
  };

  const getInputValidationClass = (field: string) => {
    // Airbnb-pink error state when the field has been touched or the form was submitted.
    if (fieldErrors[field] && (showValidation || validatedFields[field] === false)) {
      return 'border-2 border-[#FF385C] ring-2 ring-[#FF385C]/25 bg-[#FF385C]/5 focus:ring-[#FF385C]/40 focus:border-[#FF385C]';
    }
    if (validatedFields[field]) {
      return 'border-green-500 bg-green-50/30 cursor-text focus:border-green-500 focus:ring-2 focus:ring-green-500/20';
    }
    return '';
  };

  const getAddressInputValidationClass = (field: string) => {
    // The lookup is only complete after the customer has selected or manually
    // entered a full address. A recognised postcode by itself must never look done.
    if (field === 'postcode' && showValidation && !addressComplete) {
      return 'border-2 border-[#FF385C] ring-2 ring-[#FF385C]/25 bg-[#FF385C]/5 focus:ring-[#FF385C]/40 focus:border-[#FF385C]';
    }
    if ((showValidation || addressTouched[field]) && addressErrors[field]) {
      return 'border-2 border-[#FF385C] ring-2 ring-[#FF385C]/25 bg-[#FF385C]/5 focus:ring-[#FF385C]/40 focus:border-[#FF385C]';
    }
    if (
      addressValidated[field] &&
      addressData[field as keyof typeof addressData]?.trim() &&
      (field !== 'postcode' || (postcodeInput.trim() && addressComplete))
    ) {
      return 'border-green-500 bg-green-50/30 cursor-text focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white';
    }
    return 'bg-[#F5F5F5] border-gray-200 focus:bg-white';
  };

  const applyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    
    const codeUpper = promoCodeInput.trim().toUpperCase();
    
    // CRITICAL: Prevent applying the same promo code twice
    if (appliedDiscountCodes.some(d => d.code === codeUpper)) {
      setPromoCodeError('A promo code has already been applied');
      return;
    }
    
    // Only allow one promo code at a time
    if (appliedDiscountCodes.length > 0) {
      setPromoCodeError('Only one promo code can be used per purchase. Remove the existing code first.');
      return;
    }
    
    setIsValidatingPromoCode(true);
    setPromoCodeError('');
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: { 
          code: promoCodeInput.toUpperCase(), 
          vehicleReg: vehicleData.regNumber,
          customerEmail: customerData.email?.trim().toLowerCase() || undefined,
          orderAmount: selectedPayment === 'full' ? stripeTotalPrice : bumperTotalPrice
        }
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
      
      // Store the discount code details - discountAmount will be calculated dynamically
      // based on the selected payment method (monthly vs pay in full)
      setAppliedDiscountCodes(prev => [...prev, {
        code: promoCodeInput.toUpperCase(),
        type: discountCode.type,
        value: discountCode.value,
        discountAmount: 0, // Will be calculated dynamically in useMemo
        stripe_coupon_id: discountCode.stripe_coupon_id,
        stripe_promo_code_id: discountCode.stripe_promo_code_id
      }]);
      
      // CRITICAL: If payment form is already showing, we need to re-create the PaymentIntent
      // with the new discounted amount - close the form so user re-triggers payment
      if (showEmbeddedCheckout && stripeClientSecret) {
        console.log('💳 Promo code applied while payment form open - need to recreate PaymentIntent');
        setShowEmbeddedCheckout(false);
        setStripeClientSecret(null);
        toast.success('Promo code applied! Click "Pay in Full" again to continue.');
      } else {
        toast.success('Promo code applied!');
      }
      
      setPromoCodeInput('');
      setPromoOpen(false);
    } catch (error) {
      setPromoCodeError('Error validating code');
    } finally {
      setIsValidatingPromoCode(false);
    }
  };

  const removePromoCode = (code: string) => {
    setAppliedDiscountCodes(prev => prev.filter(d => d.code !== code));
    setPromoCodeInput('');
    setPromoCodeError('');
    
    // CRITICAL: If payment form is already showing, we need to re-create the PaymentIntent
    // with the updated amount (without discount) - close the form so user re-triggers payment
    if (showEmbeddedCheckout && stripeClientSecret) {
      console.log('💳 Promo code removed while payment form open - need to recreate PaymentIntent');
      setShowEmbeddedCheckout(false);
      setStripeClientSecret(null);
      toast.success('Promo code removed! Click "Pay in Full" again to continue.');
    } else {
      toast.success('Promo code removed');
    }
  };

  const processPayment = async (paymentOverride?: 'monthly' | 'full') => {
    const effectivePayment = paymentOverride || selectedPayment || selectedPaymentRef.current;
    console.log('💳 processPayment called:', { paymentOverride, selectedPayment, refValue: selectedPaymentRef.current, effectivePayment });

    // Validate at the shared payment entry point as well as at each provider.
    // This blocks stale saved address data and an already-open Stripe form when
    // the visible postcode/search field has not been completed this session.
    if (!enforceAddressBeforePayment()) return;
    
    // If Stripe form is already showing, just scroll to it instead of creating a new PaymentIntent
    if (effectivePayment === 'full' && showEmbeddedCheckout && stripeClientSecret) {
      console.log('💳 processPayment: Stripe form already visible, scrolling to it');
      const stripeSection = document.getElementById('inline-stripe-payment');
      if (stripeSection) {
        stripeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        stripeSection.classList.add('ring-2', 'ring-[#0BA360]', 'ring-offset-2');
        setTimeout(() => {
          stripeSection.classList.remove('ring-2', 'ring-[#0BA360]', 'ring-offset-2');
        }, 2000);
      }
      return;
    }
    
    setShowValidation(true);
    setPaymentError('');

    // Hard block: vehicles over 150,000 miles are not eligible for cover
    const enteredMileageNum = parseInt(String(customerData.mileage || '').replace(/[^0-9]/g, '') || '0');
    if (enteredMileageNum > 150000 || motOverLimit) {
      const mileageEl = document.getElementById('mileage');
      if (mileageEl) {
        mileageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (mileageEl as HTMLInputElement).focus();
      }
      toast('Our team will check the options for vehicles over 150,000 miles — request a callback or call 0330 229 5040.', {
        duration: 7000,
        className: 'border-2 border-[#F0A500] shadow-2xl',
      });
      return;
    }


    // Helper: scroll to an element accounting for sticky top nav and bottom bar
    const scrollToSection = (el: HTMLElement | null) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Offset ~120px from top so the section sits clearly in view above the sticky bottom bar
      const top = window.scrollY + rect.top - 120;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
      // Highlight a specific child if marked, otherwise fall back to the section itself
      const target = (el.querySelector('[data-highlight-target]') as HTMLElement) || el;
      target.classList.add('ring-2', 'ring-red-500', 'ring-offset-2', 'rounded-xl');
      setTimeout(() => {
        target.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2', 'rounded-xl');
      }, 2500);
    };

    // Note: declaration check is performed AFTER all other field validation below,
    // so users are prompted to complete name/address/etc. before the declaration popup.

    if (!effectivePayment) {
      setPaymentError('Please choose a payment option to continue.');
      const paymentSection = document.getElementById('payment-section');
      scrollToSection(paymentSection);
      toast.error('Please choose a payment option to continue.', {
        duration: 5000,
        className: 'border-2 border-red-500 shadow-2xl',
      });
      return;
    }
    
    if (!validateForm()) {
      if (!personalDetailsComplete) setDetailsOpen(true);
      // Also expand address section if address fields are incomplete
      if (!addressComplete) {
        setAddressExpanded(true);
        if (manualAddressEntry || postcodeInput.trim()) setShowAddressFields(true);
      }
      
      // Determine which section to scroll to based on what's missing
      // Prioritize: personal details first, then address (starting with postcode)
      // Use requestAnimationFrame for smoother scroll after DOM updates
      // Use setTimeout to allow React state to update before scrolling
      setTimeout(() => {
        const scrollToFirstIncomplete = () => {
          if (!personalDetailsComplete) {
            const personalFields = ['first_name', 'last_name', 'email', 'phone', 'mileage'];
            for (const field of personalFields) {
              const val = customerData[field as keyof typeof customerData];
              if (!val || (typeof val === 'string' && !val.trim())) {
                const element = document.getElementById(field);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  element.focus();
                  return;
                }
              }
            }
            // Fallback: scroll to about-you section
            const aboutYou = document.getElementById('customer-form');
            if (aboutYou) aboutYou.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else if (!addressComplete) {
            // If postcode isn't a valid UK format OR the lookup hasn't
            // populated the town yet, keep the user on the postcode field so
            // they can complete/correct it (which auto-fills the rest).
            const rawPostcode = (addressData.postcode || '').replace(/\s/g, '');
            const postcodeValid = ukPostcodeRegex.test(rawPostcode);
            const addressResolved = !!addressData.town?.trim();
            if (!postcodeValid || !addressResolved) {
              const el = document.getElementById('postcode-lookup');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                (el as HTMLInputElement).focus();
                return;
              }
            }
            const addressChecks = [
              { field: 'address_line_1', id: 'address_line_1', value: addressData.address_line_1 },
              { field: 'town', id: 'town', value: addressData.town },
            ];
            for (const check of addressChecks) {
              if (!check.value?.trim()) {
                const element = document.getElementById(check.id);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  element.focus();
                  return;
                }
              }
            }
            // Fallback: scroll to address section
            const addressSection = document.getElementById('address-fields');
            if (addressSection) addressSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        };
        
        // Try immediately, then retry after DOM updates from section expansion
        scrollToFirstIncomplete();
      }, 200);
      
      // Name the fields that are actually outstanding. The old copy assumed a
      // missing mileage whenever personal details were incomplete, so a customer
      // who had already confirmed their mileage was told to check it again.
      const missing: string[] = [];
      if (!customerData.first_name?.trim() || customerData.first_name.trim().length < 2) missing.push('first name');
      if (!customerData.last_name?.trim() || customerData.last_name.trim().length < 2) missing.push('last name');
      if (!customerData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) missing.push('email');
      if (!customerData.phone?.trim()) missing.push('phone number');
      if (!mileageValueValid) missing.push('mileage');
      if (!addressComplete) missing.push('address');

      const toastMsg = missing.length
        ? `Please complete your ${missing.length === 1
            ? missing[0]
            : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`} to continue.`
        : 'Please check the highlighted fields to continue.';
      toast.error(toastMsg, {
        id: 'checkout-required-fields',
        duration: 6000,
        closeButton: true,
        dismissible: true,
      });
      return;
    }

    // All other fields are valid — now check the vehicle declaration last
    if (!declarationChecked) {
      setDeclarationError(true);
      const declSection = document.getElementById('vehicle-declaration');
      scrollToSection(declSection);
      // Inline validation is shown above the sticky CTA and at the checkbox itself —
      // no floating toast (it was covering the CTA on mobile).
      return;
    }

    setIsLoading(true);

    // Duplicate warranty guard: same email + same registration plate already has an active/pending paid warranty
    try {
      const dupCheck = await checkDuplicateWarranty(
        vehicleData?.regNumber || '',
        customerData.email || ''
      );
      if (dupCheck.isDuplicate) {
        setIsLoading(false);
        toast.error(
          'This vehicle registration already has an active warranty with us. Please use a different vehicle registration to continue, or contact us for further support.',
          {
            duration: 10000,
            closeButton: true,
            dismissible: true,
            className: 'border-2 border-red-500 shadow-2xl',
          }
        );
        return;
      }
    } catch (err) {
      console.warn('Duplicate warranty check failed (continuing):', err);
    }

    trackFormSubmission('customer_details', { payment_method: effectivePayment });

    if (effectivePayment === 'monthly') {
      trackBumperCheckoutClick(discountedBumperPrice);
      await processBumperCheckout();
    } else {
      trackStripeCheckoutClick(discountedStripePrice);
      await processStripeCheckout();
    }
  };

  // FINAL HARD GATE — no payment provider may be reached without a full address.
  // This runs immediately before Bumper/Stripe are called, so it cannot be
  // bypassed by any UI path, auto-trigger or stale validation state.
  const enforceAddressBeforePayment = (): boolean => {
    const ukPc = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    const visibleSearch = postcodeInput.trim();
    const pc = (addressData.postcode || '').trim();
    const line1 = (addressData.address_line_1 || '').trim();
    const town = (addressData.town || '').trim();
    const pcOk = !!visibleSearch && !!pc && ukPc.test(pc.replace(/\s/g, ''));

    if (pcOk && line1 && town) return true;

    setShowValidation(true);
    setAddressExpanded(true);
    if (manualAddressEntry || visibleSearch) setShowAddressFields(true);
    setAddressTouched(prev => ({ ...prev, postcode: true, address_line_1: true, town: true }));
    setAddressErrors(prev => ({
      ...prev,
      postcode: pcOk && line1 && town
        ? ''
        : (!visibleSearch ? 'Please enter postcode' : (pc && !ukPc.test(pc.replace(/\s/g, '')) ? 'Please enter a valid UK postcode.' : 'Please enter postcode')),
      address_line_1: line1 ? '' : 'Please enter your address.',
      town: town ? '' : 'Enter your town or city.',
    }));
    setAddressValidated(prev => ({ ...prev, postcode: pcOk, address_line_1: !!line1, town: !!town }));
    setIsLoading(false);

    setTimeout(() => {
      const el = document.getElementById(!pcOk ? 'postcode-lookup' : !line1 ? 'address_line_1' : 'town');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLInputElement).focus?.();
      }
    }, 100);

    toast.error('Please enter postcode and select your address to continue.', {
      id: 'checkout-address-required',
      duration: 6000,
      closeButton: true,
      dismissible: true,
      className: 'border-2 border-[#FF385C] shadow-2xl',
    });
    return false;
  };

  const processBumperCheckout = async () => {
    if (!enforceAddressBeforePayment()) return;

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
      
      const trackingData = getTrackingData();

      struggleTracker.reportPaymentAttempt('bumper');
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(isPaymentAssist ? 'create-payment-assist-checkout' : 'create-bumper-checkout', {
        body: {
          planId,
          vehicleData: vehicleDataWithActualMileage,
          paymentType,
          voluntaryExcess: updatedPricingData.voluntaryExcess,
          claimLimit: updatedPricingData.claimLimit || 2000,
          labourRate: pricingData.labourRate || 50,
          customerData: { 
            ...customerData, 
            first_name: firstName,
            last_name: lastName,
            final_amount: finalPrice,
            customer_dob: customerData.dob_year && customerData.dob_month && customerData.dob_day 
              ? `${customerData.dob_year}-${customerData.dob_month}-${customerData.dob_day}` : null,
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
          trackingData,
          device_type: detectDeviceType(),
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

      // Read structured error body (edge function returns non-2xx for upstream outages)
      let errorBody: any = checkoutData && (checkoutData as any).error ? checkoutData : null;
      if (checkoutError && (checkoutError as any).context?.json) {
        try { errorBody = await (checkoutError as any).context.json(); } catch { /* ignore */ }
      }

      if (errorBody?.code === 'bumper_unavailable' || errorBody?.retryable) {
        struggleTracker.reportPaymentFailed('bumper', 'bumper_unavailable');
        toast.error(
          errorBody?.message ||
            `${monthlyProviderLabel} isn't responding right now. Please try again in a few minutes, or choose pay in full.`,
          {
            duration: 12000,
            action: {
              label: 'Pay in Full',
              onClick: () => { setSelectedPayment('full'); selectedPaymentRef.current = 'full'; }
            }
          }
        );
        setIsLoading(false);
        return;
      }

      if (checkoutError || errorBody) {
        const errorMessage = errorBody?.error || errorBody?.message || checkoutError?.message || '';
        console.error('Monthly checkout failed:', { errorBody, checkoutError });
        struggleTracker.reportPaymentFailed('bumper', errorMessage);
        if (errorMessage.includes('is not available for Bumper') || errorMessage.includes('Monthly payments are not available')) {
          toast.error('Monthly payments unavailable. Please pay in full.', {
            duration: 8000,
            action: { label: 'Pay in Full', onClick: () => { setSelectedPayment('full'); selectedPaymentRef.current = 'full'; } }
          });
          setIsLoading(false);
          return;
        }
        // Show the real reason (invalid phone, missing address, price mismatch) so the
        // customer can fix it instead of seeing an opaque "Unable to process".
        const friendly = /phone|address|postcode|price/i.test(errorMessage)
          ? errorMessage
          : 'Unable to process. Please try again.';
        toast.error(friendly, { duration: 10000, closeButton: true });
        setIsLoading(false);
        return;
      }



      if (checkoutData?.url) {
        // Save pending Bumper conversion data so /thank-you can fire purchase event
        // even if Bumper's return URL is missing params
        const pendingBumperConversion = {
          amount: discountedBumperPrice,
          transactionId: `bumper_${Date.now()}`,
          email: customerData.email || '',
          plan: planName,
          payment: paymentType,
          vehicle: `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim(),
          vehicleReg: vehicleData.regNumber || '',
          source: 'bumper',
          createdAt: Date.now()
        };
        sessionStorage.setItem('pending_stripe_conversion', JSON.stringify(pendingBumperConversion));
        localStorage.setItem('pending_stripe_conversion', JSON.stringify(pendingBumperConversion));

        // Save journey state for recovery when returning from Bumper
        localStorage.setItem('warranty_journey_state', JSON.stringify({
          formData: pricingData,
          vehicleData,
          customerData,
          addressData,
          planId,
          paymentType,
          paymentMethod: selectedPaymentRef.current || selectedPayment,
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
        
        redirectToStripeWithBackGuard(checkoutData.url);
      } else {
        toast.error('Unable to process. Please try again.');
        setIsLoading(false);
      }
    } catch (error: any) {
      struggleTracker.reportPaymentFailed('bumper', error?.message || 'Bumper checkout exception');
      toast.error('Unable to process. Please try again.');
      setIsLoading(false);
    }
  };

  const processStripeCheckout = async () => {
    if (!enforceAddressBeforePayment()) return;

    try {
      console.log('💳 processStripeCheckout: Starting...');
      const finalPrice = discountedStripePrice;
      
      // Debug: Log discount calculation
      console.log('💳 processStripeCheckout: Price calculation:', {
        baseTotalPrice,
        bumperTotalPrice,
        stripeTotalPrice,
        hasDiscountCodes: appliedDiscountCodes.length > 0,
        appliedCodes: appliedDiscountCodes.map(c => ({ code: c.code, type: c.type, value: c.value })),
        stripeDiscountAmount,
        discountedStripePrice,
        finalPriceSentToAPI: finalPrice
      });
      
      const firstName = customerData.first_name?.trim() || '';
      const lastName = customerData.last_name?.trim() || '';
      
      // CRITICAL: Override vehicleData.mileage with user's actual input from Step 4
      // The original vehicleData.mileage contains the representative value (100000) from Step 1
      const vehicleDataWithActualMileage = {
        ...vehicleData,
        mileage: customerData.mileage || vehicleData.mileage
      };
      
      console.log('💳 processStripeCheckout: Calling create-payment-intent API...');
      
      const trackingData = getTrackingData();

      // Create PaymentIntent for embedded checkout (no redirect)
      struggleTracker.reportPaymentAttempt('stripe');
      const { data: paymentIntentData, error: paymentIntentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          planId,
          planName,
          vehicleData: vehicleDataWithActualMileage,
          paymentType,
          voluntaryExcess: updatedPricingData.voluntaryExcess,
          claimLimit: updatedPricingData.claimLimit || 2000,
          labourRate: pricingData.labourRate || 50,
          customerData: { 
            ...customerData, 
            first_name: firstName,
            last_name: lastName,
            final_amount: finalPrice,
            customer_dob: customerData.dob_year && customerData.dob_month && customerData.dob_day 
              ? `${customerData.dob_year}-${customerData.dob_month}-${customerData.dob_day}` : null,
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
          gclid: trackingData.gclid || '',
          gaClientId: trackingData.clientId || '',
          device_type: detectDeviceType(),
        }
      });

      console.log('💳 processStripeCheckout: API response:', { 
        hasData: !!paymentIntentData, 
        hasError: !!paymentIntentError,
        clientSecret: paymentIntentData?.clientSecret ? 'present' : 'missing',
        error: paymentIntentError 
      });

      if (paymentIntentError) {
        console.error('💳 processStripeCheckout: PaymentIntent creation error:', paymentIntentError);
        struggleTracker.reportPaymentFailed('stripe', paymentIntentError?.message || 'PaymentIntent creation failed');
        toast.error('Unable to process. Please try again.');
        setIsLoading(false);
        return;
      }

      if (paymentIntentData?.clientSecret) {
        console.log('💳 processStripeCheckout: Got clientSecret, saving state and showing payment form...');
        const pendingStripeConversion = {
          amount: Number(paymentIntentData.amount || finalPrice),
          transactionId: paymentIntentData.paymentIntentId || `stripe_${Date.now()}`,
          email: customerData.email || '',
          phone: customerData.phone || customerData.mobile || '',
          firstName,
          lastName,
          address: addressData.address_line_1 || customerData.street || '',
          postcode: addressData.postcode || customerData.postcode || '',
          plan: planId,
          payment: paymentType,
          vehicle: `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim(),
          vehicleReg: vehicleData.regNumber || '',
          mileage: customerData.mileage || vehicleData.mileage || '',
          claimLimit: updatedPricingData.claimLimit || 2000,
          labourRate: pricingData.labourRate || 50,
          excess: updatedPricingData.voluntaryExcess || 0,
          source: 'stripe',
          createdAt: Date.now()
        };
        sessionStorage.setItem('pending_stripe_conversion', JSON.stringify(pendingStripeConversion));
        localStorage.setItem('pending_stripe_conversion', JSON.stringify(pendingStripeConversion));
        setStripePaymentIntentId(pendingStripeConversion.transactionId);
        
        // Save journey state for recovery
        localStorage.setItem('warranty_journey_state', JSON.stringify({
          formData: pricingData,
          vehicleData,
          customerData,
          planId,
          paymentType,
          paymentMethod: selectedPaymentRef.current || selectedPayment,
          appliedDiscountCodes,
          timestamp: Date.now()
        }));
        
        // Show inline Stripe payment instead of navigating away
        console.log('💳 processStripeCheckout: Setting stripeClientSecret and showEmbeddedCheckout...');
        setStripeClientSecret(paymentIntentData.clientSecret);
        setShowEmbeddedCheckout(true);
        setIsLoading(false);
        
        console.log('💳 processStripeCheckout: State updated, scrolling to payment section...');
        
        // Scroll to payment section
        setTimeout(() => {
          const paymentSection = document.getElementById('inline-stripe-payment');
          console.log('💳 processStripeCheckout: Payment section element:', paymentSection);
          if (paymentSection) {
            paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            console.warn('💳 processStripeCheckout: Payment section element NOT found in DOM!');
          }
        }, 100);
      } else {
        console.error('💳 processStripeCheckout: No clientSecret in response');
        toast.error('Unable to process. Please try again.');
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('💳 processStripeCheckout: Stripe checkout error:', error);
      struggleTracker.reportPaymentFailed('stripe', error?.message || 'Stripe checkout exception');
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

  // HARD GUARD: never show a £0 order summary or allow activation without a price.
  if (!(monthlyPrice > 0) && !(bumperTotalPrice > 0)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">We couldn't load your plan price</h1>
          <p className="text-sm text-muted-foreground">
            Your quote details didn't carry over to checkout, so we can't show a price here.
            Please choose your cover again and we'll take you straight back.
          </p>
          <Button onClick={onBack} className="w-full">Back to plans</Button>
          <p className="text-xs text-muted-foreground">
            Need help? Call our team on <a href="tel:03302295040" className="underline font-medium">0330 229 5040</a>
          </p>
        </div>
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* SAVE50 popup — 20s inactivity, 15-min countdown, single-use */}
      <Save50PromoPopup
        orderTotal={selectedPayment === 'full' ? stripeTotalPrice : bumperTotalPrice}
        customerEmail={customerData.email}
        vehicleReg={vehicleData?.regNumber}
        hasDiscountApplied={appliedDiscountCodes.length > 0}
        suppress={showEmbeddedCheckout}
        onApplied={(d) => {
          setAppliedDiscountCodes((prev) => {
            if (prev.some((c) => c.code === d.code)) return prev;
            return [
              ...prev,
              {
                code: d.code,
                type: d.type,
                value: d.value,
                discountAmount: 0,
                stripe_coupon_id: d.stripe_coupon_id,
                stripe_promo_code_id: d.stripe_promo_code_id,
              },
            ];
          });
          // If embedded checkout was already showing, force re-create PaymentIntent
          if (showEmbeddedCheckout && stripeClientSecret) {
            setShowEmbeddedCheckout(false);
            setStripeClientSecret(null);
          }
        }}
      />
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
            className="flex items-center gap-2 text-gray-600 hover:text-foreground hover:bg-muted px-2 sm:px-3 py-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Plan Selection</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <MobileNavigation />
        </div>

        <div className="flex gap-8 items-start">
          {/* Main Content Column */}
          <div className="flex-1 max-w-2xl space-y-6 sm:space-y-8 pb-4 lg:pb-4 lg:space-y-0 min-w-0">
          {/* Hero title moved into DesktopPlanHeader to avoid duplication */}


          {/* ==================== MOBILE: PLAN SUMMARY ACCORDION ==================== */}
          <section className="lg:hidden">
            <PlanSummaryCard
              planName={formatPlanName()}
              vehicleReg={vehicleData.regNumber}
              vehicleMake={vehicleData.make}
              vehicleModel={vehicleData.model}
              vehicleYear={vehicleData.year}
              duration={getDurationText()}
              claimLimit={updatedPricingData.claimLimit || 2000}
              labourRate={pricingData.labourRate || 50}
              excess={updatedPricingData.voluntaryExcess ?? 100}
              selectedPayment={selectedPayment}
              monthlyPrice={discountedMonthlyPrice}
              totalPrice={displayBumperTotal}
              isLoading={isLoading}
              onPaymentChange={(p) => { setSelectedPayment(p); selectedPaymentRef.current = p; }}
              onPayClick={() => processPayment(selectedPaymentRef.current || selectedPayment || undefined)}
              onChangePlan={onBack}
              isMobile={true}
              startDate={startDate}
            />
          </section>

          {/* ==================== PLAN HEADER (desktop only) ==================== */}
          <section className="hidden lg:block">
            <DesktopPlanHeader
              vehicleReg={vehicleData.regNumber}
              vehicleMake={vehicleData.make}
              vehicleModel={vehicleData.model}
              vehicleYear={vehicleData.year}
              duration={getDurationText()}
              claimLimit={updatedPricingData.claimLimit || 2000}
              labourRate={pricingData.labourRate || 50}
              excess={updatedPricingData.voluntaryExcess ?? 100}
              startDate={startDate}
              onStartDateChange={(date) => {
                setStartDate(date);
                if (date) {
                  try {
                    localStorage.setItem('buyawarranty_startDate', date.toISOString());
                  } catch (error) {
                    console.error('Error saving start date:', error);
                  }
                }
              }}
              onEditPlan={onBack}
              onChangeVehicle={handleChangeVehicleClick}
            />
          </section>

          {/* Payment method selection moved to HowToPaySection */}

          {/* Cover Start Date - Mobile Only (hidden on lg since PlanHeader has it) */}
          <section id="start-date-section" className="mt-6 sm:mt-8 lg:hidden">
            <Card className="border border-[#E5E5E5] bg-white rounded-xl">
              <CardContent className="p-4 sm:p-5">
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
          <section ref={aboutYouRef} id="customer-form" className="mt-6 sm:mt-8 lg:mt-8 bg-white rounded-xl border border-border p-5 sm:p-6">
            
            {/* Section Header: About you */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-[#1a1a1a] flex items-center gap-2"><User className="w-5 h-5 text-[#0BA360]" /> About you</h2>
              <div className="h-px bg-border mt-3" />
            </div>

            <div className="space-y-5">
              {/* Email - First for cognitive ease */}
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-foreground/80">Email Address *</Label>
                <p className="text-xs text-muted-foreground mt-0.5">We'll send your policy documents here.</p>
                <div className="relative mt-1.5">
                  <Input
                    id="email"
                    type="email"
                    placeholder="john.smith@email.com"
                    value={customerData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    required
                    className={`h-11 sm:h-12 text-base pr-10 ${getInputValidationClass('email')}`}
                  />
                  {validatedFields.email && !fieldErrors.email && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                  )}
                </div>
                {fieldErrors.email && (
                  <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Phone - Second */}
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
                    className={`h-11 sm:h-12 text-base pr-10 ${getInputValidationClass('phone')}`}
                  />
                  {validatedFields.phone && !fieldErrors.phone && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                  )}
                </div>
                {fieldErrors.phone && (
                  <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              {/* Name Fields - Side by Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <Label htmlFor="first_name" className="text-sm font-medium text-foreground/80">First Name *</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="first_name"
                      placeholder="First name"
                      value={customerData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      onBlur={() => handleFieldBlur('first_name')}
                      required
                      className={`h-11 sm:h-12 text-base pr-10 ${getInputValidationClass('first_name')}`}
                    />
                    {validatedFields.first_name && customerData.first_name?.trim()?.length >= 2 && !fieldErrors.first_name && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                    )}
                  </div>
                  {fieldErrors.first_name && (
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
                      placeholder="Last name"
                      value={customerData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      onBlur={() => handleFieldBlur('last_name')}
                      required
                      className={`h-11 sm:h-12 text-base pr-10 ${getInputValidationClass('last_name')}`}
                    />
                    {validatedFields.last_name && customerData.last_name?.trim()?.length >= 2 && !fieldErrors.last_name && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                    )}
                  </div>
                  {fieldErrors.last_name && (
                    <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {fieldErrors.last_name}
                    </p>
                  )}
                  {/* Auto-scroll to mileage once last name is valid */}
                  {validatedFields.last_name && customerData.last_name?.trim()?.length >= 2 && !customerData.mileage && (
                    <span
                      ref={(el) => {
                        if (el) {
                          setTimeout(() => {
                            document.getElementById('mileage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => document.getElementById('mileage')?.focus(), 400);
                          }, 300);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section Divider - Your Address */}
            <div className="mt-10 mb-6">
              <h2 className="text-lg font-bold text-[#1a1a1a] flex items-center gap-2"><Home className="w-5 h-5 text-[#0BA360]" /> Your address</h2>
              <div className="h-px bg-border mt-3" />
            </div>

            {/* Address Section - Always visible */}
            <div id="address-fields" className="space-y-4">
              {/* Postcode Lookup - Auto triggers on valid format or blur */}
              <div>
                <Label className="text-sm font-medium text-foreground/80">Postcode, street or town *</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="postcode-lookup"
                    type="text"
                    value={postcodeInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const looksLikePostcode = /^[A-Za-z0-9\s]{0,8}$/.test(raw) && /\d/.test(raw);
                      const value = looksLikePostcode ? raw.toUpperCase() : raw;
                      setPostcodeInput(value);
                      // Only mirror into the postcode field when it looks like a postcode —
                      // a street or town search must not be treated as an invalid postcode.
                      if (looksLikePostcode) {
                        setAddressData(prev => ({ ...prev, postcode: value }));
                      }
                      setAddressErrors(prev => ({ ...prev, postcode: '' }));

                      // Clear existing timeout
                      if (postcodeLookupTimeoutRef.current) {
                        clearTimeout(postcodeLookupTimeoutRef.current);
                      }

                      // Search emptied — hide the dropdown and, unless the customer
                      // is typing a manual address, collapse and clear the address fields
                      if (value.trim().length === 0) {
                        setAddressSuggestions([]);
                        setShowAddressDropdown(false);
                        setAddressLookupFailed(false);
                        if (!manualAddressEntry) {
                          setShowAddressFields(false);
                          setTownAutoFilled(false);
                          setAddressData(prev => ({
                            ...prev,
                            address_line_1: '',
                            address_line_2: '',
                            town: '',
                            county: '',
                            postcode: '',
                          }));
                          setAddressValidated(prev => ({
                            ...prev,
                            address_line_1: false,
                            town: false,
                            postcode: false,
                          }));
                        }
                        return;
                      }

                      const cleanValue = value.replace(/\s/g, '');
                      if (ukPostcodeRegex.test(cleanValue)) {
                        postcodeLookupTimeoutRef.current = setTimeout(() => {
                          performPostcodeLookup(value);
                        }, 300);
                      } else if (value.trim().length >= 3) {
                        // Street / town search
                        postcodeLookupTimeoutRef.current = setTimeout(() => {
                          performAddressSearch(value);
                        }, 400);
                      }
                    }}
                    onBlur={() => {
                      // Also trigger on blur if valid format and not already looking up
                      const cleanValue = postcodeInput.replace(/\s/g, '');
                      if (ukPostcodeRegex.test(cleanValue) && !isLookingUp && !showAddressFields) {
                        performPostcodeLookup(postcodeInput);
                      }
                      // Once an address has been picked (or manual entry opened) the
                      // search box is just a search box — don't flag it as a postcode.
                      if (!showAddressFields) {
                        setAddressTouched(prev => ({ ...prev, postcode: true }));
                        validateAddressField('postcode');
                      }
                    }}

                    placeholder="e.g. SW1A 1AA or High Street, Bath"
                    className={`h-11 sm:h-12 text-base pr-10 ${getAddressInputValidationClass('postcode')}`}
                  />

                  {isLookingUp ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
                  ) : postcodeInput.trim() && addressComplete && addressValidated.postcode && !addressErrors.postcode ? (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
                  ) : null}
                </div>
                
                {/* Lookup status message */}
                {isLookingUp && (
                  <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Looking up address...
                  </p>
                )}

                {/* Address picker — drill into a street or town, then pick the address */}
                {showAddressDropdown && addressSuggestions.length > 0 && (
                  <div className="mt-2 rounded-lg border border-border bg-background shadow-sm">
                    <p className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                      Select your address ({addressSuggestions.length} found)
                    </p>
                    <div className="max-h-56 overflow-auto">
                      {addressSuggestions.map((addr: any, i: number) => (
                        <button
                          key={`${addr.__container ? addr.label : addr.formatted_address}-${i}`}
                          type="button"
                          onClick={() => {
                            if (addr.__container) {
                              if (addr.retrieveId) {
                                resolveSuggestionId(addr.retrieveId, addr.searchTerm || postcodeInput);
                              } else {
                                setPostcodeInput(addr.drill);
                                performAddressSearch(addr.drill, true);
                              }
                            } else if (addr.__lookupId) {
                              resolveSuggestionId(addr.__lookupId, addr.searchTerm || postcodeInput);
                            } else {
                              handleSelectLookupAddress(addr);
                            }
                          }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b border-border/60 last:border-b-0 flex items-center justify-between gap-2"
                        >
                          <span className="min-w-0 truncate">
                            {addr.__container
                              ? addr.label
                              : addr.formatted_address || [addr.line_1, addr.town_or_city, addr.postcode].filter(Boolean).join(', ')}
                          </span>
                          {addr.__container && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                              {addr.count} addresses
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}


                {/* Postcode validation error — Airbnb pink */}
                {(showValidation || addressTouched.postcode) && addressErrors.postcode && (
                  <p className="text-[#FF385C] text-sm font-medium mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {addressErrors.postcode}
                  </p>
                )}

                {/* Nothing picked from the lookup yet — the customer must still choose an address */}
                {showValidation && !addressErrors.postcode && !addressData.address_line_1?.trim() && (
                  <p className="text-[#FF385C] text-sm font-medium mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Please enter postcode
                  </p>
                )}
                
                {/* Enter your address link */}
                {!showAddressFields && !isLookingUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddressFields(true);
                      setManualAddressEntry(true);
                      setShowAddressDropdown(false);
                      if (ukPostcodeRegex.test(postcodeInput.replace(/\s/g, ''))) {
                        const formatted = postcodeInput.replace(/\s/g, '').toUpperCase();
                        const displayPostcode = formatted.length > 3 
                          ? formatted.slice(0, -3) + ' ' + formatted.slice(-3) 
                          : formatted;
                        setAddressData(prev => ({ ...prev, postcode: displayPostcode }));
                        setAddressValidated(prev => ({ ...prev, postcode: true }));
                      }
                    }}
                    className="mt-2 text-sm text-[#1a1a1a] underline font-medium"
                  >
                    Enter your address manually
                  </button>
                )}
              </div>

              {/* Address Fields - Shown after lookup or manual entry click */}
              {showAddressFields && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressFields(false);
                        setManualAddressEntry(false);
                        setShowAddressDropdown(false);
                        setAddressSuggestions([]);
                      }}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] hover:underline"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Search a different address
                    </button>
                  </div>

                  {/* Address Line 1 */}
                  <div>
                    <Label htmlFor="address_line_1" className="text-sm font-medium text-foreground/80">
                      Address Line 1 *
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="address_line_1"
                        placeholder="e.g. 123 High Street"
                        value={addressData.address_line_1}
                        onChange={(e) => {
                          setAddressData(prev => ({ ...prev, address_line_1: e.target.value }));
                          setAddressValidated(prev => ({ ...prev, address_line_1: !!e.target.value.trim() }));
                          if (addressErrors.address_line_1) {
                            setAddressErrors(prev => ({ ...prev, address_line_1: '' }));
                          }
                        }}
                        onBlur={() => {
                          setAddressTouched(prev => ({ ...prev, address_line_1: true }));
                          validateAddressField('address_line_1');
                        }}
                        className={`h-11 sm:h-12 text-base pr-10 ${getAddressInputValidationClass('address_line_1')}`}
                      />
                      {addressData.address_line_1?.trim() && !addressErrors.address_line_1 && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                      )}
                    </div>
                    {(showValidation || addressTouched.address_line_1) && addressErrors.address_line_1 && (
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
                      className="h-11 sm:h-12 text-base mt-1.5"
                    />
                  </div>

                  {/* Town/City — shown as compact confirmation once auto-filled by postcode */}
                  {townAutoFilled && addressData.town?.trim() && !addressErrors.town ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#0BA360]/30 bg-[#0BA360]/5 px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                        <span className="text-sm text-[#1F2A44] truncate">
                          <span className="text-muted-foreground">Town / City:</span>{' '}
                          <span className="font-semibold">{addressData.town}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTownAutoFilled(false)}
                        className="text-xs font-medium text-[#1a1a1a] hover:underline flex-shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="town" className="text-sm font-medium text-foreground/80">
                        Town / City *
                      </Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="town"
                          placeholder="e.g. London"
                          value={addressData.town}
                          onChange={(e) => {
                            setAddressData(prev => ({ ...prev, town: e.target.value }));
                            setAddressValidated(prev => ({ ...prev, town: !!e.target.value.trim() }));
                            if (addressErrors.town) {
                              setAddressErrors(prev => ({ ...prev, town: '' }));
                            }
                          }}
                          onBlur={() => {
                            setAddressTouched(prev => ({ ...prev, town: true }));
                            validateAddressField('town');
                          }}
                          className={`h-11 sm:h-12 text-base pr-10 ${getAddressInputValidationClass('town')}`}
                        />
                        {addressData.town?.trim() && !addressErrors.town && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--success))]" />
                        )}
                      </div>
                      {(showValidation || addressTouched.town) && addressErrors.town && (
                        <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {addressErrors.town}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section Divider - Your Vehicle */}
            <div className="mt-10 mb-6">
              <h2 className="text-lg font-bold text-[#1a1a1a] flex items-center gap-2"><Car className="w-5 h-5 text-[#0BA360]" /> Your vehicle</h2>
              <div className="h-px bg-border mt-3" />
            </div>

            {/* Mileage */}
             <div>
              <Label htmlFor="mileage" className="block text-base font-semibold text-foreground mb-1">
                Confirm your current mileage
              </Label>
              <p className="mb-3 text-sm text-muted-foreground">
                {numericMotMileage > 0
                  ? "We've suggested this using your latest MOT record."
                  : storedCustomerMileage
                    ? "This is the mileage you gave us when you got your quote. Update it if it's changed."
                    : 'Up to 150,000 miles.'}
              </p>

              {numericMotMileage > 0 && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Last recorded at your MOT{motDateLabel ? ` on ${motDateLabel}` : ''}. Update it if your current mileage is different.
                </p>
              )}
              {motMileage ? (
                <p className="mb-4 text-sm text-[#3A6FA0] bg-[#EAF2FB] border border-[#CFE0F2] rounded-md px-4 py-2.5 inline-block">
                  Last recorded MOT: <span className="font-semibold text-[#0F1B3D]">{numericMotMileage.toLocaleString('en-GB')} miles</span>
                  {quotedFromMotMileage && (
                    <span className="block mt-1 text-[#0BA360] font-medium">
                      Your price is locked in — updating this won't change it.
                    </span>
                  )}
                </p>
              ) : null}


              <div className="flex flex-col gap-3">

                <div className="relative">
                  {motLoading ? (
                    <div className="h-11 sm:h-12 flex items-center gap-2 px-3 border border-border rounded-lg bg-muted/30">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Fetching from MOT history...</span>
                    </div>
                  ) : (
                    <>
                      <Input
                        id="mileage"
                        type="text"
                        inputMode="numeric"
                        placeholder={estimatedMileagePlaceholder}
                        value={customerData.mileage ? Number(customerData.mileage).toLocaleString('en-GB') : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/[^0-9]/g, '');
                          handleInputChange('mileage', rawValue);
                          setMileagePreFilled(false);
                          setMotWarningDismissed(false);
                          // Any change invalidates a previous low-mileage confirmation.
                          setMileageConfirmedLow(false);
                        }}
                        onBlur={() => handleFieldBlur('mileage')}
                        required
                        className={`h-11 sm:h-12 text-base pr-10 ${Number(customerData.mileage) > 150000 ? 'border-2 border-[#F0A500] bg-[#FFF8E5]' : getInputValidationClass('mileage')}`}
                      />
                      {mileageValueValid && !showMotWarning && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0BA360] pointer-events-none" />
                      )}
                    </>
                  )}
                </div>
                {numericMotMileage > 0 && (
                  <div className="mt-1">
                    <p className="text-sm font-medium mb-2 text-[#1F2A44]">
                      Or roughly how many miles since your MOT?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {mileageQuickSelectOptions.map(option => {
                        const pillLabel = option.delta === 0
                          ? 'Same as MOT'
                          : `+${option.delta.toLocaleString('en-GB')}`;
                        const isSelected = String(customerData.mileage) === String(option.value);
                        return (
                          <button
                            type="button"
                            key={option.delta}
                            onClick={() => {
                              handleInputChange('mileage', String(option.value));
                              setValidatedFields(prev => ({ ...prev, mileage: true }));
                              setMileagePreFilled(option.delta === 0);
                              // Quick-select picks are trusted (they're MOT-derived).
                              setMileageConfirmedLow(true);
                            }}
                            className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                              isSelected
                                ? 'border-brand-orange bg-brand-orange/10 text-[#1F2A44]'
                                : 'border-[#CFD4DB] bg-white text-[#1F2A44] hover:border-[#1F2A44] hover:bg-muted/30'
                            }`}
                          >
                            {pillLabel}
                          </button>
                        );
                      })}
                    </div>
                    {mileageValueValid && !showMotWarning && (
                      <p className="mt-2 text-sm text-[#0BA360] flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        We'll use approximately {Number(customerData.mileage).toLocaleString('en-GB')} miles.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 4-digit confirmation: requires an explicit tick before we accept sub-10,000 mileages */}
              {customerData.mileage &&
                Number(customerData.mileage) >= 1000 &&
                Number(customerData.mileage) < 10000 &&
                !showMotWarning && (
                  <label
                    htmlFor="mileage-confirm-low"
                    className={`mt-3 flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors ${
                      mileageConfirmedLow
                        ? 'border-[#0BA360] bg-[#0BA360]/5'
                        : showValidation
                          ? 'border-[#FF385C] bg-[#FF385C]/5'
                          : 'border-[#F0A500] bg-[#FFF8E5]'
                    }`}
                  >
                    <input
                      id="mileage-confirm-low"
                      type="checkbox"
                      checked={mileageConfirmedLow}
                      onChange={(e) => {
                        setMileageConfirmedLow(e.target.checked);
                        setValidatedFields((prev) => ({ ...prev, mileage: e.target.checked }));
                        if (e.target.checked) {
                          setFieldErrors((prev) => ({ ...prev, mileage: '' }));
                        }
                      }}
                      className="mt-0.5 w-4 h-4 accent-[#0BA360] flex-shrink-0"
                    />
                    <span className="text-sm text-[#1F2A44] leading-snug">
                      Yes, my mileage really is <strong>{Number(customerData.mileage).toLocaleString('en-GB')}</strong> miles.
                      Please tick to confirm — most cars have 5+ digit mileage.
                    </span>
                  </label>
                )}

              {/* Over 150,000 miles — warm amber information card (not an error) */}
              {(motOverLimit || (customerData.mileage && Number(customerData.mileage) > 150000)) && (
                <div className="mt-3 rounded-xl border-2 border-[#F0A500] bg-[#FFF8E5] px-4 py-4">
                  <p className="text-base font-bold text-[#7A4E00] flex items-center gap-2">
                    <Info className="w-5 h-5 flex-shrink-0" />
                    We may still be able to cover your vehicle
                  </p>
                  <p className="text-sm text-[#5C3D00] mt-2 leading-relaxed">
                    Our online plans cover vehicles up to 150,000 miles. {motOverLimit
                      ? `Your last MOT recorded ${numericMotMileage.toLocaleString('en-GB')} miles, so this vehicle is above the limit and can't be bought online.`
                      : 'As your vehicle is above this, our team will need to check the available options with you.'}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowHighMileageCallback(true)}
                      className="px-5 py-3 rounded-lg bg-brand-orange text-white text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                      Request a callback
                    </button>
                    <a
                      href="tel:03302295040"
                      className="px-5 py-3 rounded-lg border-2 border-[#7A4E00] text-[#7A4E00] text-sm font-bold text-center hover:bg-[#F0A500]/10 transition-colors"
                    >
                      Call us now: 0330 229 5040
                    </a>
                  </div>
                  {!motOverLimit && (
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange('mileage', '');
                      setValidatedFields(prev => ({ ...prev, mileage: false }));
                      setFieldErrors(prev => ({ ...prev, mileage: '' }));
                      setTimeout(() => {
                        const el = document.getElementById('mileage') as HTMLInputElement | null;
                        el?.focus();
                      }, 50);
                    }}
                    className="mt-3 text-sm font-semibold text-[#7A4E00] underline hover:no-underline"
                  >
                    Change mileage
                  </button>
                  )}
                </div>
              )}

              {showValidation && !mileageValueValid && !motOverLimit && !(customerData.mileage && Number(customerData.mileage) > 150000) && (
                <div className="mt-2 rounded-lg border-2 border-[#FF385C] bg-[#FF385C]/5 px-3 py-2">
                  <p className="text-[#FF385C] text-sm font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {!customerData.mileage
                      ? 'Please enter your current mileage.'
                      : Number(customerData.mileage) < 1000
                        ? 'Please enter a valid mileage (at least 1,000).'
                        : Number(customerData.mileage) < 10000
                          ? 'That mileage looks low — please tick the box above to confirm it\u2019s correct.'
                          : 'Please check your mileage.'}
                  </p>
                </div>
              )}

              {/* Soft MOT cross-check warning — entered mileage lower than last MOT */}
              {showMotWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 mt-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900">
                        That looks lower than your last MOT ({numericMotMileage.toLocaleString('en-GB')} miles).
                        {suggestedMileage > numericMotMileage && (
                          <> Did you mean <span className="font-semibold">{suggestedMileage.toLocaleString('en-GB')}</span>?</>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {suggestedMileage > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              handleInputChange('mileage', String(suggestedMileage));
                              setValidatedFields(prev => ({ ...prev, mileage: true }));
                              setMotWarningDismissed(true);
                            }}
                            className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                          >
                            Use {suggestedMileage.toLocaleString('en-GB')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setMotWarningDismissed(true)}
                          className="px-3 py-1.5 rounded-md bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-sm font-semibold transition-colors"
                        >
                          Keep {enteredMileageNumber.toLocaleString('en-GB')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Helper text */}
              <p className="text-muted-foreground mt-3 text-xs">
                Your mileage helps us confirm the right cover for your vehicle.
              </p>


              {/* High Mileage Surcharge Banner */}
              {highMileageSurchargeApplied && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 mt-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        Higher mileage? No problem!
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        As your mileage is over 120,000 miles, we've updated your quote to include our higher mileage cover.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </section>

          {/* Promo Code — placed below the Vehicle section, not part of it */}
          <div className="mt-6 bg-[#FFFBF0] border border-[#FFD980] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-[#FF8C00]" />
              <span className="text-sm font-bold text-[#1a1a1a]">Have a promo code?</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={appliedDiscountCodes.length > 0 ? 'Promo code applied' : 'Enter code'}
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                className="flex-1 h-11 text-base uppercase bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isValidatingPromoCode || appliedDiscountCodes.length > 0}
              />
              <Button
                type="button"
                onClick={applyPromoCode}
                disabled={!promoCodeInput.trim() || isValidatingPromoCode || appliedDiscountCodes.length > 0}
                className="h-11 px-5 bg-[#FF8C00] hover:bg-[#e57e00] text-white font-semibold"
              >
                {isValidatingPromoCode ? 'Checking...' : 'Apply'}
              </Button>
            </div>
            {appliedDiscountCodes.length > 0 && (
              <p className="text-xs text-gray-600 mt-2">
                Only one promo code can be used. Remove the current code to try another.
              </p>
            )}
            {promoCodeError && (
              <p className="text-destructive text-sm mt-2">{promoCodeError}</p>
            )}
            {appliedDiscountCodes.length > 0 && totalDiscountAmount > 0 && (
              <div className="mt-3 border border-[#0BA360] bg-green-50 rounded-lg px-3 py-2">
                {appliedDiscountCodes.map((discount) => (
                  <div key={discount.code} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Tag className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
                      <span className="font-semibold text-[#1a1a1a] truncate">{discount.code}</span>
                      <span className="text-sm text-gray-600 flex-shrink-0">applied</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[#0BA360] font-bold text-base whitespace-nowrap">
                        -£{totalDiscountAmount.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePromoCode(discount.code)}
                        className="p-1 hover:bg-red-100 rounded-full transition-colors"
                        title="Remove promo code"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activate your warranty section removed per request — declaration auto-accepted */}


          {/* Customer reviews section removed — already shown below the CTA */}

          {/* ==================== HOW TO PAY SECTION (BOTTOM) ==================== */}
          <div ref={(el) => { (howToPayRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }} id="how-to-pay-section">
          {/* Separate ref for the payment cards area to track visibility for sticky bar hiding */}
          <div ref={bottomCtaRef}>
            <HowToPaySection
              selectedPayment={selectedPayment}
              onPaymentChange={async (payment) => {
                setSelectedPayment(payment);
                selectedPaymentRef.current = payment;
                setPaymentError('');
                
                if (payment === 'monthly') {
                  // Scroll down so the orange CTA is visible
                  setTimeout(() => {
                    const paySection = document.getElementById('how-to-pay-section');
                    if (paySection) {
                      paySection.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }
                  }, 150);
                }
                
                // Auto-trigger Stripe checkout when "Pay in Full" is selected
                if (payment === 'full') {
                  setTimeout(() => {
                    processPayment('full');
                  }, 100);
                }
              }}
              monthlyPrice={discountedMonthlyPrice}
              totalPrice={displayBumperTotal}
              fullPrice={discountedStripePrice}
              originalPrice={bumperTotalPrice}
              savings={savings}
              isLoading={isLoading}
              onPayClick={(paymentOverride) => processPayment(paymentOverride || selectedPaymentRef.current || selectedPayment || undefined)}
              planDurationMonths={paymentType === '12months' ? 12 : paymentType === '24months' ? 24 : 36}
              promoOpen={promoOpen}
              setPromoOpen={setPromoOpen}
              promoCodeInput={promoCodeInput}
              setPromoCodeInput={setPromoCodeInput}
              promoCodeError={promoCodeError}
              isValidatingPromoCode={isValidatingPromoCode}
              onApplyPromoCode={applyPromoCode}
              appliedDiscountCodes={appliedDiscountCodes}
              onRemoveDiscountCode={removePromoCode}
              totalDiscountAmount={totalDiscountAmount}
              hidePayButton={showEmbeddedCheckout && selectedPayment === 'full'}
              hideTrustpilot={showEmbeddedCheckout && selectedPayment === 'full' && !!stripeClientSecret}
              hidePromoCode={true}
            />
          </div>

          {/* 14-day guarantee now inside HowToPaySection */}

          {/* ==================== INLINE STRIPE PAYMENT ==================== */}
          {(() => {
            // Debug log for payment section rendering
            console.log('💳 Payment section render check:', { 
              showEmbeddedCheckout, 
              hasClientSecret: !!stripeClientSecret, 
              selectedPayment,
              shouldRender: showEmbeddedCheckout && stripeClientSecret && selectedPayment === 'full'
            });
            return null;
          })()}
          
          {showEmbeddedCheckout && stripeClientSecret && selectedPayment === 'full' && (
            <section 
              id="inline-stripe-payment" 
              className="mt-6 sm:mt-8 lg:mt-8 bg-white rounded-xl border-2 border-green-400 p-5 sm:p-6 shadow-[0_0_16px_rgba(34,197,94,0.25)] animate-fade-in"
              ref={(el) => {
                if (el && !hasScrolledToStripeRef.current) {
                  hasScrolledToStripeRef.current = true;
                  setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 200);
                }
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Lock className="w-6 h-6" style={{ color: '#0BA360' }} />
                  <div>
                    <h2 className="font-semibold text-foreground text-base" style={{ color: '#0BA360' }}>
                      Secure Payment
                    </h2>
                    <p className="text-xs text-muted-foreground">256-bit SSL encryption</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Powered by</span>
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" 
                    alt="Stripe" 
                    className="h-5"
                  />
                </div>
              </div>

              <StripeProvider clientSecret={stripeClientSecret}>
                <StripePaymentForm
                  amount={discountedStripePrice}
                  isMonthly={false}
                  onSuccess={() => {
                    // Clear cached payment data and navigate to thank-you
                    localStorage.removeItem('stripe_payment_data');
                    const thankYouParams = new URLSearchParams({ source: 'stripe' });
                    if (stripePaymentIntentId) thankYouParams.set('payment_intent', stripePaymentIntentId);
                    // Enrich with vehicle + cover details so the Thank You order summary
                    // always shows registration, duration, plan, etc. (independent of
                    // the hosted-checkout success URL which carries these natively).
                    thankYouParams.set('plan', planName || 'Platinum');
                    thankYouParams.set('payment', paymentType || '');
                    thankYouParams.set('duration', paymentType || '');
                    thankYouParams.set('vehicle_reg', vehicleData?.regNumber || '');
                    thankYouParams.set('vehicle', `${vehicleData?.make || ''} ${vehicleData?.model || ''}`.trim());
                    thankYouParams.set('mileage', String(vehicleData?.mileage || ''));
                    if (pricingData?.claimLimit) thankYouParams.set('claim_limit', String(pricingData.claimLimit));
                    if (pricingData?.labourRate) thankYouParams.set('labour_rate', String(pricingData.labourRate));
                    if (pricingData?.voluntaryExcess !== undefined) thankYouParams.set('excess', String(pricingData.voluntaryExcess));
                    thankYouParams.set('final_amount', String(discountedStripePrice));
                    thankYouParams.set('total_price', String(discountedStripePrice));
                    navigate(`/thank-you?${thankYouParams.toString()}`);
                  }}
                  onError={(error) => {
                    console.error('Payment error:', error);
                    toast.error('Please complete your card details to continue.');
                  }}
                  isProcessing={isLoading}
                  setIsProcessing={setIsLoading}
                />
              </StripeProvider>
            </section>
          )}

          {/* Trustpilot reviews — moved BELOW the Stripe panel when it's open */}
          {showEmbeddedCheckout && stripeClientSecret && selectedPayment === 'full' && (
            <TrustpilotSliderWidget className="mt-6" />
          )}
          </div>{/* close bottomCtaRef wrapper */}
          </div>
          
          {/* Desktop: Right side Order Summary Sidebar */}
          <DesktopOrderSummary
            planName={formatPlanName()}
            vehicleReg={vehicleData.regNumber}
            vehicleMake={vehicleData.make}
            vehicleModel={vehicleData.model}
            vehicleYear={vehicleData.year}
            duration={getDurationText()}
            claimLimit={updatedPricingData.claimLimit || 2000}
            labourRate={pricingData.labourRate || 70}
            excess={updatedPricingData.voluntaryExcess ?? 100}
            selectedPayment={selectedPayment}
            monthlyPrice={discountedMonthlyPrice}
            totalPrice={displayBumperTotal}
            fullPrice={discountedStripePrice}
            savings={savings}
            isLoading={isLoading}
            onPayClick={() => processPayment(selectedPaymentRef.current || selectedPayment || undefined)}
            onChangePlan={onBack}
            startDate={startDate}
            onPaymentChange={async (payment) => {
              setSelectedPayment(payment);
              selectedPaymentRef.current = payment;
              setPaymentError('');
              if (payment === 'full') {
                setTimeout(() => processPayment('full'), 100);
              }
            }}
          />
        </div>
      </div>

      {/* Desktop Sticky Bottom Bar - shows after scrolling past "About you" */}
      <DesktopStickyBar
        selectedPayment={selectedPayment}
        monthlyPrice={discountedMonthlyPrice}
        totalPrice={displayBumperTotal}
        originalPrice={bumperTotalPrice}
        fullPrice={discountedStripePrice}
        savings={savings}
        duration={getDurationText()}
        paymentType={paymentType as '12months' | '24months' | '36months'}
        isLoading={isLoading}
        hasPromoDiscount={hasValidDiscountCodes}
        onPayClick={() => {
          processPayment(selectedPaymentRef.current || selectedPayment || undefined);
        }}
        onPaymentChange={(p) => { setSelectedPayment(p); selectedPaymentRef.current = p; }}
        ctaLabel="Pay securely"
        isVisible={showDesktopStickyBar}
        minimised={isBottomCtaFullyVisible}
        trustStripOnly={isScrolledPastBottomCta}
        validationError={declarationError && !declarationChecked ? 'Please confirm the vehicle declaration to continue.' : undefined}
      />

      {/* Mobile Sticky Footer - trust strip only when scrolled past bottom CTA */}
      <MobileStickyFooter
        selectedPayment={selectedPayment}
        monthlyPrice={discountedMonthlyPrice}
        totalPrice={bumperTotalPrice}
        fullPrice={discountedStripePrice}
        originalPrice={bumperTotalPrice}
        paymentType={paymentType as '12months' | '24months' | '36months'}
        isLoading={isLoading}
        isFormValid={personalDetailsComplete && addressComplete}
        onPayClick={() => {
          processPayment(selectedPaymentRef.current || selectedPayment || undefined);
        }}
        onPaymentChange={(p) => { setSelectedPayment(p); selectedPaymentRef.current = p; }}
        minimised={isBottomCtaFullyVisible}
        trustStripOnly={isScrolledPastBottomCta}
        defaultExpanded={false}
        ctaLabel="Pay securely"
        validationError={declarationError && !declarationChecked ? 'Please confirm the vehicle declaration to continue.' : undefined}
      />
      {onUpdateVehicle && (
        <EditVehicleDialog
          open={editVehicleOpen}
          onOpenChange={setEditVehicleOpen}
          initialReg={vehicleData.regNumber}
          initialMileage={vehicleData.mileage}
          onSave={(v) => onUpdateVehicle(v)}
        />
      )}
      <RequestCallbackModal
        isOpen={showHighMileageCallback}
        onClose={() => setShowHighMileageCallback(false)}
      />
    </div>
  );
};

export default StreamlinedCheckout;
