import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Star, Shield, Clock, Zap, Car, Truck, Battery, Bike, Menu, X, Phone, FileCheck, MessageCircle, Wrench, PoundSterling } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import WebsiteFooter from './WebsiteFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { VoucherBanner } from './VoucherBanner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { OptimizedImage } from '@/components/OptimizedImage';
import LazySection from './homepage/LazySection';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import heroPandaVehiclesMobile from '@/assets/hero-panda-vehicles-mobile.webp.asset.json';
import heroPandaVehiclesDesktop from '@/assets/hero-panda-vehicles-desktop.webp.asset.json';

import HowPricingWorksModal from './modals/HowPricingWorksModal';

import TrustpilotMicroStarWidget from './TrustpilotMicroStarWidget';
import TrustpilotMicroComboWidget from './TrustpilotMicroComboWidget';

// Lazy load heavy components to reduce initial bundle size.
// lazyWithRetry re-attempts the dynamic import so a single failed/stale chunk
// fetch doesn't permanently blank the homepage (React.lazy caches rejections).
const HomepageFAQ = lazyWithRetry(() => import('./HomepageFAQ'));
const VideoSection = lazyWithRetry(() => import('./homepage/VideoSection'));
const AdditionalCoverSection = lazyWithRetry(() => import('./homepage/AdditionalCoverSection'));
const WarrantyBenefitsSection = lazyWithRetry(() => import('./homepage/WarrantyBenefitsSection'));
const CoverClaritySection = lazyWithRetry(() => import('./homepage/CoverClaritySection'));
const VehicleCoverageSection = lazyWithRetry(() => import('./homepage/VehicleCoverageSection'));
const LandingPageDirectory = lazyWithRetry(() => import('./homepage/LandingPageDirectory'));
// Both popups stay mounted (controlled by an `isOpen` prop) rather than
// conditionally rendered, and both pull in canvas-confetti — lazy-loading
// them keeps that weight out of the homepage's main bundle until one is
// actually about to open instead of shipping it to every mobile visitor.
const EmailCapturePopup = lazyWithRetry(() =>
  import('./EmailCapturePopup').then((m) => ({ default: m.EmailCapturePopup }))
);
const RequestCallbackModal = lazyWithRetry(() => import('./modals/RequestCallbackModal'));

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { trackButtonClick, trackQuoteRequest } from '@/utils/analytics';
import { MileageField, RegLookupError, RegInputErrorOutline, REG_NOT_FOUND_MESSAGE, REG_NOT_FOUND_DETAIL, buildMileageBlockMessage, buildTypedMileageBlockMessage, buildAgeBlockMessage, digitsOnly, MAX_COVERED_MILEAGE } from '@/components/quote/ManualQuoteEntry';
import { getVehicleBlockMessage } from '@/lib/vehicleBlockGuard';
import { getVehicleIdentificationGap, type VehicleIdGap } from '@/lib/vehicleIdentification';
import VehicleNotRecognisedCard from '@/components/quote/VehicleNotRecognisedCard';


interface VehicleData {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  vehicleType?: string;
  blocked?: boolean;
  blockReason?: string;
  manufactureDate?: string; // Full manufacture date for precise age calculation
  registrationDate?: string; // First registration date — preferred basis for age
  motMileage?: number;
  motDate?: string;
}

interface HomepageProps {
  onRegistrationSubmit: (vehicleData: VehicleData) => void;
}

// Accepts current-style (AB12CDE), prefix/suffix and dateless plates.
const UK_REG_PATTERN = /^(?:[A-Z]{2}[0-9]{2}[A-Z]{3}|[A-Z][0-9]{1,3}[A-Z]{3}|[A-Z]{3}[0-9]{1,3}[A-Z]?|[0-9]{1,4}[A-Z]{1,3}|[A-Z]{1,3}[0-9]{1,4})$/;

const Homepage: React.FC<HomepageProps> = ({ onRegistrationSubmit }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [regError, setRegError] = useState('');
  const [regErrorDetail, setRegErrorDetail] = useState('');
  const [regNudge, setRegNudge] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState<string>('');
  const [showMileageField, setShowMileageField] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  // Only shown when the MOT lookup returns no odometer reading.
  const [needsMileage, setNeedsMileage] = useState(false);
  const [showManualVehicle, setShowManualVehicle] = useState(false);
  const [idGap, setIdGap] = useState<VehicleIdGap | null>(null);
  const [manualVehicle, setManualVehicle] = useState({ make: '', model: '', year: '', mileage: '' });

  const [mileageError, setMileageError] = useState('');
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showVoucherBanner, setShowVoucherBanner] = useState(false);
  const [showSecondWarrantyDiscount, setShowSecondWarrantyDiscount] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  // UK office hours: 09:00–18:00 Europe/London
  const computeUkOfficeHours = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const mins = h * 60 + m;
    // Open Monday to Saturday, 9am–6pm UK time (closed Sundays)
    const isOpenDay = weekday !== 'Sun';
    return isOpenDay && mins >= 9 * 60 && mins < 18 * 60;
  };

  const [isUkOfficeHours, setIsUkOfficeHours] = useState(computeUkOfficeHours);
  useEffect(() => {
    const id = setInterval(() => setIsUkOfficeHours(computeUkOfficeHours()), 60_000);
    return () => clearInterval(id);
  }, []);


  

  useEffect(() => {
    // Check if user is returning from a successful purchase
    const urlParams = new URLSearchParams(window.location.search);
    const fromSuccess = urlParams.get('from_success');
    
    if (fromSuccess === 'true') {
      setShowVoucherBanner(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if user has discount for second warranty
    const hasSecondWarrantyDiscount = localStorage.getItem('addAnotherWarrantyDiscount');
    if (hasSecondWarrantyDiscount === 'true') {
      setShowSecondWarrantyDiscount(true);
      // Generate unique discount code for this session
      const code = `SECOND10-${Date.now().toString().slice(-6)}`;
      setDiscountCode(code);
      localStorage.setItem('secondWarrantyDiscountCode', code);
    }

    // Email popup DISABLED - not converting
    // Show email popup after 60 seconds OR when user scrolls 70% down the page
    let hasTriggered = false;
    
    const showPopup = () => {
      if (!hasTriggered) {
        hasTriggered = true;
        // setShowEmailPopup(true); // DISABLED
      }
    };

    // Timer trigger (60 seconds) - DISABLED
    const timer = setTimeout(showPopup, 60000);

    // Scroll trigger (70% down the page)
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrollPercentage = (scrollTop / documentHeight) * 100;
      
      if (scrollPercentage >= 70) {
        showPopup();
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Plates are letters and digits only — quietly drop anything else the
  // customer types or pastes (punctuation, symbols, emoji) instead of
  // showing them a plate like "LK13 .::".
  const formatRegNumber = (value: string) => {
    const formatted = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (formatted.length > 3) {
      return formatted.slice(0, -3) + ' ' + formatted.slice(-3);
    }
    return formatted;
  };


  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRegNumber(e.target.value);
    if (formatted.length <= 8) {
      setRegNumber(formatted);
      if (regError) { setRegError(''); setRegErrorDetail(''); }
      if (regNudge) setRegNudge('');
      if (showManualVehicle) setShowManualVehicle(false);
      if (idGap) setIdGap(null);

      if (vehicleAgeError) setVehicleAgeError('');
    }
  };

  const handleMileageSelection = (selection: string) => {
    setMileageSelection(selection);
    // Set a representative mileage value for the selection
    if (selection === 'under120k') {
      setMileage('100000'); // Representative value under 120k
      setMileageError('');
    } else if (selection === 'over120k') {
      setMileage('130000'); // Representative value over 120k
      setMileageError('');
    }
  };

  const scrollToQuoteForm = () => {
    trackButtonClick('scroll_to_quote_form');
    const quoteSection = document.getElementById('quote-form');
    if (quoteSection) {
      quoteSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleEnterReg = () => {
    if (regNumber.trim()) {
      // This function is not used in the current flow
      // We go directly through handleGetQuote
    }
  };

  // Remember where the quoted mileage came from so Step 4 can ask the customer
  // to confirm it and honour the price they were shown.
  const rememberMileageSource = (source: 'mot' | 'customer', mileageValue?: number, motDate?: string | null) => {
    try {
      localStorage.setItem('baw_mileage_source', source);
      if (source === 'mot' && mileageValue) {
        localStorage.setItem('baw_mot_mileage', String(mileageValue));
        if (motDate) localStorage.setItem('baw_mot_mileage_date', motDate);
        localStorage.removeItem('baw_customer_mileage');
      } else {
        localStorage.removeItem('baw_mot_mileage');
        localStorage.removeItem('baw_mot_mileage_date');
        if (mileageValue && mileageValue > 0) {
          localStorage.setItem('baw_customer_mileage', String(mileageValue));
        } else {
          localStorage.removeItem('baw_customer_mileage');
        }
      }
    } catch (e) {
      // ignore storage failures (private mode)
    }
  };


  // Inline registration error copy, by failure type
  const REG_ERRORS = {
    notFound: {
      title: REG_NOT_FOUND_MESSAGE,
      detail: REG_NOT_FOUND_DETAIL,
    },
    format: {
      title: REG_NOT_FOUND_MESSAGE,
      detail: REG_NOT_FOUND_DETAIL,
    },
    system: {
      title: "We're having trouble checking your registration",
      detail: 'Please try again in a moment.',
    },
  } as const;

  const showRegError = (kind: keyof typeof REG_ERRORS) => {
    setRegError(REG_ERRORS[kind].title);
    setRegErrorDetail(REG_ERRORS[kind].detail);
    const el = document.getElementById('reg-input-field');
    el?.focus();
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Manual route: used when a registration can't be matched to DVLA/DVSA data.
  const submitManualVehicle = () => {
    const miles = Number(digitsOnly(manualVehicle.mileage) || '0');
    if (!manualVehicle.make.trim() || miles < 100 || miles > MAX_COVERED_MILEAGE) return;

    rememberMileageSource('customer', miles);
    trackQuoteRequest(undefined, undefined, undefined);

    onRegistrationSubmit({
      regNumber: regNumber.replace(/\s+/g, '').toUpperCase(),
      mileage: String(miles),
      make: manualVehicle.make.trim(),
      model: manualVehicle.model.trim(),
      year: manualVehicle.year || undefined,
      vehicleType: 'car',
    } as VehicleData);
  };

  const isRegEntered = regNumber.replace(/\s+/g, '').length >= 5;
  const isRegValid = UK_REG_PATTERN.test(regNumber.replace(/\s/g, '').toUpperCase());

  const handleMainCtaClick = () => {
    trackButtonClick('get_quote_main', { has_reg_number: !!regNumber.trim() });

    const cleaned = regNumber.replace(/\s+/g, '').toUpperCase();

    // Nothing typed yet → gentle nudge, no error card.
    if (!cleaned) {
      setRegNudge('Pop your registration in above and we\'ll fetch your price in seconds.');
      const el = document.getElementById('reg-input-field');
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Something typed but it isn't a UK plate → show the amber error card
    // and the pink outline around the reg input.
    if (!isRegEntered || !isRegValid) {
      setRegNudge('');
      showRegError('format');
      return;
    }

    setRegNudge('');
    handleGetQuote();
  };


  const handleGetQuote = async (mileageOverride?: string) => {
    console.log('🔘 GET QUOTE BUTTON CLICKED');

    // Track main CTA button click
    trackButtonClick('get_quote_main', {
      has_reg_number: !!regNumber.trim(),
    });

    const cleanedReg = regNumber.replace(/\s+/g, '').toUpperCase();

    // Empty or clearly malformed registration → format guidance
    // Accepts current-style (AB12CDE), prefix/suffix and dateless plates.

    if (!cleanedReg || !UK_REG_PATTERN.test(cleanedReg)) {
      showRegError('format');
      return;
    }
    setRegError('');
    setRegErrorDetail('');

    setMileageError('');


    setIsLookingUp(true);

    // Pull latest MOT mileage in parallel with DVLA lookup. If none, default to under 120k.
    const normalizedReg = regNumber.replace(/\s+/g, '').toUpperCase();
    const motPromise = (async () => {
      try {
        // A plate can be stored with and without a space, so read rows (not
        // maybeSingle) — duplicates would otherwise throw and lose the mileage.
        const spacedReg = normalizedReg.length >= 5
          ? `${normalizedReg.slice(0, -3)} ${normalizedReg.slice(-3)}`
          : normalizedReg;
        const { data: motRows } = await supabase
          .from('mot_history')
          .select('mot_tests')
          .in('registration', [normalizedReg, spacedReg])
          .limit(2);
        const motRow = motRows?.find((r) => Array.isArray(r.mot_tests) && (r.mot_tests as any[]).length > 0) ?? motRows?.[0];
        const rawTests = (motRow?.mot_tests as unknown) ?? [];
        const tests: any[] = Array.isArray(rawTests) ? (rawTests as any[]) : [];
        const latest = tests
          .filter((t) => t && Number(t.odometerValue) > 0)
          .sort((a, b) => new Date(b.completedDate || 0).getTime() - new Date(a.completedDate || 0).getTime())[0];
        if (latest?.odometerValue) {
          return { motMileage: Number(latest.odometerValue), motDate: latest.completedDate as string | undefined };
        }
      } catch (e) {
        console.warn('MOT history lookup failed:', e);
      }
      return { motMileage: null as number | null, motDate: undefined as string | undefined };
    })();

    
    try {
      console.log('Looking up vehicle:', regNumber);
      
      // Try the lookup, then retry once if it fails or returns no make/model.
      // The edge function has its own retries plus DVLA + mot_history fallbacks,
      // so a second attempt only triggers on truly transient infrastructure errors.
      let { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber }
      });

      const lookupYieldedNothing = !error && (!data || (!data.found || !data.make));
      if (error || lookupYieldedNothing) {
        console.warn('🔁 First DVSA lookup did not return make - retrying after 800ms', { error, data });
        await new Promise((resolve) => setTimeout(resolve, 800));
        const retry = await supabase.functions.invoke('dvla-vehicle-lookup', {
          body: { registrationNumber: regNumber }
        });
        if (!retry.error && retry.data?.make) {
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        console.error('DVSA lookup error:', error);
        throw error;
      }

      console.log('DVSA lookup result:', data);

      // Excluded vehicle matrix — never quote supercars / luxury / performance models
      const vehicleBlockMessage = getVehicleBlockMessage(data);
      if (vehicleBlockMessage) {
        console.log('Vehicle blocked by exclusion matrix:', vehicleBlockMessage);
        setVehicleAgeError(vehicleBlockMessage);
        setIsLookingUp(false);
        return;
      }

      
      // Check for age-related blocking when vehicle is not found
      if (!data?.found && data?.error && data.error.includes('15 years')) {
        console.log('Vehicle blocked: Over 15 years old');
        setVehicleAgeError(buildAgeBlockMessage(null));
        setIsLookingUp(false);
        return;
      }
      
      // Check for missing year information when vehicle is found
      if (data?.found && !data.yearOfManufacture) {
        console.log('Vehicle blocked: Year information not available');
        setVehicleAgeError("We couldn't verify this vehicle's age just yet.");
        setIsLookingUp(false);
        return;
      }
      
      // Check vehicle age using precise manufactureDate if available
      if (data?.found) {
        const now = new Date();
        let vehicleAgePrecise: number | null = null;
        
        // Try to use manufactureDate for precise age calculation (15 years and 1 day check)
        if (data.registrationDate || data.manufactureDate) {
          const manufactureDate = new Date(data.registrationDate || data.manufactureDate);
          if (!isNaN(manufactureDate.getTime())) {
            const ageInMs = now.getTime() - manufactureDate.getTime();
            const msPerYear = 365.25 * 24 * 60 * 60 * 1000; // Account for leap years
            vehicleAgePrecise = ageInMs / msPerYear;
            
            console.log('🔍 Precise age calculation:', {
              manufactureDate: data.manufactureDate,
              vehicleAgePrecise: vehicleAgePrecise.toFixed(4),
              threshold: '> 15 years'
            });
            
            // Block if over 15 years (15 years and 1 day or older)
            if (vehicleAgePrecise > 15) {
              setVehicleAgeError(buildAgeBlockMessage(vehicleAgePrecise));
              setIsLookingUp(false);
              return;
            }
          }
        }
        
        // Fallback to year-based calculation if no manufactureDate
        if (vehicleAgePrecise === null && data.yearOfManufacture) {
          const currentYear = now.getFullYear();
          const vehicleYear = parseInt(data.yearOfManufacture);
          const vehicleAge = currentYear - vehicleYear;
          
          if (vehicleAge > 15) {
            setVehicleAgeError(buildAgeBlockMessage(vehicleAge));
            setIsLookingUp(false);
            return;
          }
        }
        
        setVehicleAgeError('');
      }
      
      // Resolve MOT mileage. The edge function reads DVSA server-side (and is not
      // limited by RLS), so trust its odometer reading first, then the mot_history
      // table as a secondary source.
      const clientMot = await motPromise;
      const serverMot = Number(String(data?.motMileage ?? '').replace(/[^0-9]/g, ''));
      const motResult = serverMot > 0
        ? { motMileage: serverMot, motDate: (data?.motMileageDate as string | undefined) ?? clientMot.motDate }
        : clientMot;


      // Block over-150k vehicles flagged via MOT history
      if (motResult.motMileage && motResult.motMileage > 150000) {
        setMileageError(buildMileageBlockMessage(motResult.motMileage, motResult.motDate ?? null));
        setIsLookingUp(false);
        return;
      }

      // Vehicle must be fully identified (make AND model) before any price.
      // No manual make/model route — customer calls us or requests a callback.
      const idGapResult = getVehicleIdentificationGap(data);
      if (idGapResult) {
        setIdGap(idGapResult);
        setShowManualVehicle(false);
        setNeedsMileage(false);
        setIsLookingUp(false);
        setTimeout(() => {
          document.getElementById('vehicle-not-recognised')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        return;
      }
      setIdGap(null);


      // Reg-only journey: mileage normally comes from the last MOT reading. When
      // there is no reading (new vehicle, import, NI plate) we ask the customer
      // for their mileage here so the price is accurate, then prefill Step 4.
      let effectiveMileage: string;
      if (motResult.motMileage != null) {
        setNeedsMileage(false);
        effectiveMileage = String(motResult.motMileage);
        rememberMileageSource('mot', motResult.motMileage, motResult.motDate ?? null);
      } else {
        const typed = Number(String(mileageOverride ?? mileage).replace(/[^0-9]/g, ''));
        if (!typed || typed <= 0) {
          // Ask for the mileage inline and stop here.
          setNeedsMileage(true);
          setIsLookingUp(false);
          setTimeout(() => {
            const el = document.getElementById('manual-mileage-field');
            el?.focus();
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
          return;
        }
        if (typed > 150000) {
          setNeedsMileage(true);
          setMileageError(buildTypedMileageBlockMessage(typed));
          setIsLookingUp(false);
          return;
        }
        effectiveMileage = String(typed);
        rememberMileageSource('customer', typed);
      }



      // Prepare vehicle data
      const vehicleData: VehicleData = {
        regNumber: regNumber,
        mileage: effectiveMileage,
      };

      if (motResult.motMileage != null) {
        vehicleData.motMileage = motResult.motMileage;
        vehicleData.motDate = motResult.motDate;
      }

      // Add DVLA data if found
      if (data?.found) {
        vehicleData.make = data.make;
        vehicleData.model = data.model;
        vehicleData.fuelType = data.fuelType;
        vehicleData.transmission = data.transmission;
        vehicleData.year = data.yearOfManufacture;
        vehicleData.vehicleType = data.vehicleType || 'car';
        vehicleData.manufactureDate = data.manufactureDate;
        vehicleData.registrationDate = data.registrationDate;
        if (data.blocked) {
          vehicleData.blocked = true;
          vehicleData.blockReason = data.blockReason;
        }
      }

      // Track quote request with enhanced data for Google Ads
      trackQuoteRequest(undefined, undefined, undefined);

      console.log('✅ Vehicle lookup complete, calling onRegistrationSubmit with:', vehicleData);

      // Submit to parent component
      onRegistrationSubmit(vehicleData);

      
    } catch (error: any) {
      console.error('Error looking up vehicle:', error);

      // System / API failure → inline message under the reg field
      showRegError('system');
    } finally {
      setIsLookingUp(false);
    }
  };

  const eligibilityError = mileageError || vehicleAgeError;
  const isFormValid = regNumber.trim() && mileageSelection && !eligibilityError;

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Voucher Banner for returning customers */}
      {showVoucherBanner && (
        <div className="bg-green-50 border-b border-green-200 py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
            <div className="flex items-center gap-4">
              <span className="text-lg font-semibold text-green-800">🎉 Welcome back!</span>
              <VoucherBanner placement="homepage" animate={true} />
              <span className="text-sm text-green-700 font-medium">Use code for your 2nd vehicle discount</span>
            </div>
          </div>
        </div>
      )}

      {/* Second Warranty Discount Banner */}
      {showSecondWarrantyDiscount && (
        <div className="bg-orange-50 border-b border-orange-200 py-3 sm:py-4 relative">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-center">
              <span className="text-sm sm:text-xl font-bold text-orange-800">🎉 Your 10% Discount is Ready!</span>
              <div className="bg-orange-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-base sm:text-lg">
                {discountCode}
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(discountCode);
                  toast({ title: "Copied!", description: "Discount code copied to clipboard" });
                }}
                variant="outline"
                size="sm"
                className="border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white w-auto sm:w-auto min-h-[40px]"
              >
                Copy Code
              </Button>
              <Button
                onClick={() => {
                  setShowSecondWarrantyDiscount(false);
                  toast({ 
                    title: "✓ Code Saved!", 
                    description: "Your discount code has been applied and will be used at checkout",
                    className: "bg-[#FF5A5F] text-white border-[#FF5A5F] [&>div]:text-white"
                  });
                }}
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 sm:top-3 sm:right-4 text-orange-800 hover:text-orange-900 hover:bg-orange-100"
                aria-label="Close banner"
              >
                <X className="w-6 h-6 sm:w-7 sm:h-7" />
              </Button>
            </div>
            <div className="text-center mt-2">
              <p className="text-xs sm:text-sm text-orange-700 px-2">
                This code will be automatically applied at checkout for your second warranty
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="quote-form" className="bg-white pt-1 sm:pt-8 lg:pt-4 pb-2 sm:pb-4 lg:pb-6 px-3 sm:px-0">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-1 sm:gap-6 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="space-y-1 sm:space-y-4 px-0 sm:px-0 flex flex-col justify-center">

              {/* Trustpilot - mobile only */}
              <div className="md:hidden">
                <TrustpilotMicroComboWidget className="scale-75 origin-center" />
              </div>

              {/* Trustpilot - tablet only (stars without review count) */}
              <div className="hidden md:block lg:hidden">
                <TrustpilotMicroStarWidget className="scale-75 origin-center" />
              </div>

               {/* Main Headline */}
               <div className="space-y-2 mb-2 sm:mb-4">
               <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight">
                 <span className="text-[#333]">Affordable warranty you can trust </span>
                 <span className="text-brand-orange">in 60 seconds!</span>
               </h1>
               </div>

              {/* Benefits */}
              <div className="mb-2 sm:mb-3 text-gray-700 text-xs sm:text-sm md:text-base space-y-1 sm:space-y-2">
                <div className="flex items-center px-1 py-1.5 sm:px-0 sm:py-0">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="font-medium">From just 60p a day • Easy claims • Fast payouts</span>
                </div>

                {/* Second tick line moves to the bottom strip on mobile */}
                <div className="hidden sm:flex items-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="font-medium">Unlimited claims • Parts and Labour • No excess</span>
                </div>

              </div>

              {/* Registration Input */}
              <div className="space-y-2 sm:space-y-3 w-full max-w-lg">
                <div className="relative">
                  <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black w-full">
                    {/* UK Section */}
                    <div className="bg-blue-600 text-white font-bold px-2 sm:px-3 md:px-4 py-2 sm:py-4 flex items-center justify-center min-w-[45px] sm:min-w-[70px] md:min-w-[80px] h-[48px] sm:h-[60px] md:h-[66px]">
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-xs sm:text-sm md:text-base font-bold">GB</span>
                        <span className="text-xs sm:text-sm md:text-base font-bold">UK</span>
                      </div>
                    </div>
                    {/* Registration Input */}
                    <input
                      id="reg-input-field"
                      type="text"
                      value={regNumber}
                      onChange={handleRegChange}
                      placeholder="ENTER REG"
                      className="bg-yellow-400 border-none outline-none text-lg sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/70 px-2 sm:px-3 md:px-4 py-2 sm:py-4 uppercase tracking-wider h-[48px] sm:h-[60px] md:h-[66px] min-w-0"
                      maxLength={8}
                    />
                  </div>
                  {UK_REG_PATTERN.test(regNumber.replace(/\s/g, '').toUpperCase()) && !regError && (
                    <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1 shadow-md" aria-label="Registration looks valid">
                      <Check className="w-4 h-4 text-white" strokeWidth={4} />
                    </div>
                  )}

                </div>

                {/* Main CTA - always clickable so an invalid reg gets a clear error */}
                <Button
                  onClick={handleMainCtaClick}
                  aria-disabled={isLookingUp}
                  className={`w-full font-bold rounded-xl px-6 py-6 sm:py-7 text-lg sm:text-xl bg-[#FF7A00] hover:bg-[#E56E00] text-white shadow-lg ${isLookingUp ? 'opacity-60 cursor-wait' : isRegValid ? 'animate-breathing' : ''}`}
                >
                  {isLookingUp ? 'Preparing your instant price…' : 'Get my quote'}
                </Button>


                {/* Positive nudge when the user clicks before entering a registration */}
                {regNudge && (
                  <p className="text-sm text-center text-brand-orange font-medium animate-fade-in">
                    {regNudge}
                  </p>
                )}

                <p className="text-sm text-gray-500 text-center">
                  Protection for vehicles up to <span className="font-bold text-gray-700">150,000 miles</span> and <span className="font-bold text-gray-700">15 years old</span>.
                </p>

                {/* Inline registration error (friendly amber border + message) */}
                {regError && (
                  <>
                    <RegLookupError
                      message={regError}
                      detail={regErrorDetail}
                      showManualLink={false}
                    />

                    <RegInputErrorOutline inputId="reg-input-field" />
                  </>
                )}

                {/* Reg-only: age comes from the plate and mileage from the last MOT.
                    We never ask the customer for mileage here. */}
                {isRegEntered && idGap && (
                  <div id="vehicle-not-recognised">
                    <VehicleNotRecognisedCard
                      gap={idGap}
                      regNumber={regNumber}
                      onRequestCallback={() => setShowCallbackModal(true)}
                    />
                  </div>
                )}

                {isRegEntered && needsMileage && (
                  <div className="space-y-3 rounded-xl border-2 border-[#F0A500] bg-[#FFF8E5] p-4 text-left animate-fade-in">
                    <div>
                      <p className="text-base font-semibold text-[#7A5A00]">
                        We just need your current mileage
                      </p>
                      <p className="text-sm text-[#8A6A1F] mt-1">
                        We couldn't find an MOT reading for this vehicle, so pop your mileage in and we'll price it straight away.
                      </p>
                    </div>
                    <MileageField
                      id="manual-mileage-field"
                      value={mileage}
                      onChange={(digits) => {
                        setMileage(digits);
                        if (mileageError) setMileageError('');
                      }}
                      onEnter={() => handleGetQuote(mileage)}
                    />
                    <Button
                      onClick={() => handleGetQuote(mileage)}
                      disabled={
                        isLookingUp ||
                        Number(digitsOnly(mileage) || '0') < 100 ||
                        Number(digitsOnly(mileage) || '0') > MAX_COVERED_MILEAGE
                      }
                      className={`w-full font-bold rounded-xl px-6 py-6 text-lg bg-[#FF7A00] hover:bg-[#E56E00] text-white shadow-lg ${isLookingUp ? '' : 'animate-breathing'}`}
                    >
                      {isLookingUp ? 'Preparing your instant price…' : 'Get my quote'}
                    </Button>
                    <p className="text-xs text-[#8A6A1F]">
                      We'll prefill this for you at checkout so you don't have to type it again.
                    </p>
                  </div>
                )}


                {/* Eligibility / lookup error */}
                {eligibilityError && (
                  <div className="flex items-start gap-2 text-white font-medium text-left bg-[#FF5A5F] border border-[#FF5A5F] rounded-lg px-3 py-2 shadow-sm">
                    <span aria-hidden>🔍</span>
                    <div className="text-sm space-y-1 text-white">
                      <p className="text-white">{eligibilityError}</p>
                      <p className="text-white">
                        Please call our friendly sales team on{' '}
                        <a href="tel:03302295040" className="underline font-bold whitespace-nowrap text-white">0330 229 5040</a>
                        {' '}and we'll do our best to help.
                      </p>
                    </div>
                  </div>
                )}

                {/* Mobile speak-to-us card lives below the benefits line (see below) */}



                {/* Pricing Reassurance Panel - Premium Trust Block (desktop) */}
                <div className="hidden sm:block mt-4 sm:mt-6 bg-white border border-gray-100 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] px-6 py-5 text-center">
                   {isUkOfficeHours ? (
                     <>
                       <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0 mb-3">
                         <a href="tel:03309122402" className="group flex items-center gap-2.5 text-brand-blue transition-all duration-200">
                           <span className="p-1.5 bg-blue-50 rounded-full text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
                             <Phone className="w-4 h-4 fill-current" strokeWidth={0} />
                           </span>
                           <span className="text-base md:text-lg font-bold border-b-2 border-brand-blue pb-0.5 leading-none tracking-tight group-hover:text-[#1B2A4A] group-hover:border-[#1B2A4A]">
                             0330 912 2402
                           </span>
                         </a>

                         <span className="hidden sm:block h-6 w-px bg-gray-200 mx-6" aria-hidden />

                         <button
                           onClick={() => setShowCallbackModal(true)}
                           className="group flex items-center gap-1.5 text-brand-orange font-bold text-sm md:text-base hover:text-orange-700 transition-colors"
                         >
                           Request a callback
                           <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                         </button>
                       </div>

                       <p className="text-[13px] text-gray-500 font-medium leading-relaxed">
                         Speak to our UK team – <span className="text-gray-400">Lines open 9am to 6pm, Monday to Saturday.</span>
                       </p>
                     </>
                   ) : (
                     <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
                       <span className="text-gray-600 whitespace-nowrap">Our UK team is open 9am–6pm, Monday to Saturday</span>
                       <button
                         onClick={() => setShowCallbackModal(true)}
                         className="group flex items-center gap-1.5 text-brand-orange font-bold hover:text-orange-700 transition-colors"
                       >
                         Request a callback
                         <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                       </button>
                     </div>
                   )}
                </div>





              </div>
            </div>

 {/* Right Content - Hero Image */}
            <div className="relative flex flex-col items-center">
              <div className="hidden lg:block mb-2">
                <TrustpilotMicroComboWidget className="scale-75 origin-center" />
              </div>
              {/* Mobile: new panda + vehicles line-up */}
              <img
                src={heroPandaVehiclesMobile.url}
                alt="Buyawarranty panda mascot with a car, van, SUV and motorbike covered by UK used car warranty plans"
                title="UK used car, van, hybrid, EV and motorbike warranty cover"
                className="lg:hidden w-full h-auto -mt-6 -mb-2 sm:mt-0 sm:mb-0"
                width={860}
                height={645}
                sizes="(max-width: 1023px) 100vw, 0px"
                fetchPriority="high"
                loading="eager"
                decoding="async"
                itemProp="image"
              />
              <img
                src={heroPandaVehiclesDesktop.url}
                alt="Buyawarranty panda mascot holding car keys beside a car, van, SUV and motorbike covered by extended warranty"
                title="Extended warranty cover for cars, vans, hybrids, EVs and motorbikes"
                className="hidden lg:block w-full h-auto lg:-mt-10 lg:-ml-12 lg:-mb-4 lg:-translate-x-10"
                width={1400}
                height={788}
                sizes="(min-width: 1024px) 50vw, 0px"
                fetchPriority="high"
                loading="eager"
                decoding="async"
                itemProp="image"
              />


              
              {/* Vehicle Types positioned directly below the image on desktop */}
              <div className="hidden lg:block w-full mt-4">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center justify-center gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5">
                      <Car className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-base">Cars</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Truck className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-base">Vans</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Zap className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-base">Hybrid</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Battery className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-base">EV</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Bike className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-base">Motorbikes</span>
                    </div>
                  </div>

                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-sm font-semibold text-gray-700 hover:bg-green-100 transition-colors cursor-help"
                        >
                          <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          Instant activation
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-center">
                        You're protected immediately. Claims can be submitted after the first 14 days of cover.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                </div>
              </div>
            </div>
            
            {/* Vehicle Types for mobile/tablet - spans full width */}
            <div className="lg:hidden w-full px-2 -mt-1 sm:mt-6 lg:col-span-2">
              <div className="flex flex-col items-center gap-1 sm:gap-6">
                <div className="flex items-center justify-center gap-2 sm:gap-4 flex-nowrap w-full">
                  <div className="flex items-center space-x-1 min-w-0">
                    <Car className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-[11px] sm:text-sm whitespace-nowrap">Cars</span>
                  </div>
                  <div className="flex items-center space-x-1 min-w-0">
                    <Truck className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-[11px] sm:text-sm whitespace-nowrap">Vans</span>
                  </div>
                  <div className="flex items-center space-x-1 min-w-0">
                    <Zap className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-[11px] sm:text-sm whitespace-nowrap">Hybrid &amp; EV</span>
                  </div>
                  <div className="flex items-center space-x-1 min-w-0">
                    <Bike className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-[11px] sm:text-sm whitespace-nowrap">Motorbikes</span>
                  </div>
                </div>


                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 border border-green-100 text-[11px] sm:text-sm font-semibold text-gray-700 hover:bg-green-100 transition-colors cursor-help"
                      >
                        <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        Instant activation
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-center">
                      You're protected immediately. Claims can be submitted after the first 14 days of cover.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

              </div>
            </div>

            {/* Mobile bottom line — the second tick row */}
            <div className="sm:hidden w-full mt-1 lg:col-span-2">
              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white shadow-sm px-2 py-1.5">
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span className="text-[11px] leading-tight font-medium text-gray-700 whitespace-nowrap">Unlimited claims • Parts and Labour • No excess</span>
              </div>
            </div>






          </div>
          
        </div>
      </section>

      {/* Why Choose Our Warranty Plans Section - Lazy Loaded */}
      <LazySection>
        <Suspense fallback={<div className="py-12 md:py-20 bg-white min-h-[400px]" />}>
          <WarrantyBenefitsSection />
        </Suspense>
      </LazySection>

      {/* Vehicle Coverage Accordion Section */}
      <LazySection>
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection />
        </Suspense>
      </LazySection>

      {/* Cover Clarity Section - Your cover, made crystal clear */}
      <LazySection>
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>
      </LazySection>

      {/* Extended Warranty Video Section - Lazy Loaded */}
      <LazySection>
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={scrollToQuoteForm} />
        </Suspense>
      </LazySection>

      {/* Step 1 - Enter Your Reg Plate */}
      <section className="pt-6 md:pt-8 pb-10 md:pb-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
            {/* Left - Content */}
            <div className="space-y-6 md:space-y-8 order-2 lg:order-1">
              <div className="mb-4 md:mb-6">
                <div className="text-green-600 text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  Unlimited Claims
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-base md:text-lg text-brand-dark-text leading-relaxed">
                  No hidden fees. No confusing jargon. Just clear cover options tailored to your vehicle and budget.
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-base text-brand-dark-text"><strong>14-day</strong> cooling off period</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-base text-brand-dark-text"><strong>Rated</strong> Excellent by UK drivers</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-base text-brand-dark-text"><strong>Backed</strong> by trusted repair networks</span>
                  </div>
                </div>
                
                <button 
                  onClick={scrollToQuoteForm}
                  className="inline-flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-10 py-3 md:py-4 text-lg md:text-xl rounded shadow-lg transition-colors w-full sm:w-auto justify-center animate-cta-enhanced mt-8 mb-4"
                >
                  Protect Your Vehicle
                  <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            {/* Right - Panda with vehicles */}
            <div className="relative text-center order-1 lg:order-2">
              <OptimizedImage 
                src="/car-warranty-uk-compare-quotes.png" 
                alt="Car warranty UK - Compare quotes - Panda mascot celebrating with orange car" 
                className="w-full h-auto max-w-sm md:max-w-lg mx-auto object-contain"
                priority={false}
                width={600}
                height={600}
              />
              
              <div className="mt-4 max-w-xs mx-auto">
                <TrustpilotMicroStarWidget />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step 2 - Choose Your Plan */}
      <section className="py-6 md:py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
            {/* Left - Panda with plan badges */}
            <div className="relative text-center">
              <OptimizedImage 
                src="/extended-warranty-uk-car-reliable.png" 
                alt="Extended warranty UK - Car reliable - Panda mascot with Monthly, Yearly, 1,2,3 Years options" 
                className="w-full h-auto max-w-sm md:max-w-lg mx-auto object-contain"
                priority={false}
                width={600}
                height={600}
              />
            </div>

            {/* Right - Content */}
            <div className="space-y-6 md:space-y-8">
              <div className="mb-4 md:mb-6">
                <div className="text-green-600 text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  Easy Options
                </div>
                <h2 className="text-2xl md:text-4xl font-bold text-brand-dark-text leading-tight">
                  <span className="text-brand-orange">Flexible Warranty Plans</span>
                </h2>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-base md:text-lg text-brand-dark-text">
                    <strong>Pay Monthly or in Full</strong> – Choose what works for you.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-base md:text-lg text-brand-dark-text">
                    <strong>1, 2 or 3-Year Cover</strong> – Long-term protection, your choice.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-base md:text-lg text-brand-dark-text">
                    <strong>0% APR & No Hidden Fees</strong> – Interest-free, stress-free.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                   <span className="text-base md:text-lg text-brand-dark-text">
                     <strong>Save an Extra £200 with our longer term plans</strong>
                   </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-base md:text-lg text-brand-dark-text">
                    <strong>From Just 60p a Day</strong> – Affordable peace of mind.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step 3 - Drive With Confidence */}
      <section className="py-6 md:py-10 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
            {/* Left - Content */}
            <div className="space-y-6 md:space-y-8 order-2 lg:order-1">
              <div className="mb-4 md:mb-6">
                <div className="text-green-600 text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High Mileage, No Problem!
                </div>
                
              </div>
              
              <p className="text-base md:text-lg text-brand-dark-text leading-relaxed">
                Once you have your used car warranty or extended car warranty, drive with complete peace of mind. If something 
                goes wrong, simply call our claims team and we'll take care of everything.
                <br />
                We want to get you back on the road as soon as possible.
              </p>


              <button 
                onClick={scrollToQuoteForm}
                className="inline-flex items-center gap-2 bg-brand-deep-blue hover:bg-blue-800 text-white font-bold px-6 md:px-10 py-3 md:py-4 text-lg md:text-xl rounded shadow-lg transition-colors w-full sm:w-auto justify-center animate-cta-enhanced"
              >
                Get your instant quote
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            {/* Right - Panda with warranty active */}
            <div className="relative text-center order-1 lg:order-2">
              <OptimizedImage 
                src="/car-warranty-uk-trusted-provider.png" 
                alt="Car warranty UK - Trusted provider - Panda with EV charging station" 
                className="w-full h-auto max-w-sm md:max-w-lg mx-auto object-contain"
                priority={false}
                width={600}
                height={600}
              />
              <div className="mt-4 max-w-xs mx-auto">
                <TrustpilotMicroStarWidget />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="py-8 md:py-12 bg-gradient-to-r from-blue-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-3xl md:text-5xl font-bold text-brand-deep-blue">
              What's <span className="text-brand-orange">Included?</span>
            </h2>
            
            <div className="max-w-3xl mx-auto">
              <p className="text-xl md:text-2xl font-bold text-brand-dark-text leading-relaxed">
                Rest assured everything is covered. If it breaks, We'll fix it, No excuses.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 md:gap-6 mt-8">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-brand-orange rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-brand-dark-text">Complete Protection</h3>
                <p className="text-brand-dark-text">Comprehensive cover for your engine, mechanical and electrical parts.</p>
              </div>

              <div className="space-y-4">
                <div className="w-16 h-16 bg-brand-orange rounded-full flex items-center justify-center mx-auto">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-brand-dark-text">Instant Claims</h3>
                <p className="text-brand-dark-text">Fast, hassle-free claims process to get you back on the road quickly.</p>
              </div>

              <div className="space-y-4">
                <div className="w-16 h-16 bg-brand-orange rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-brand-dark-text">Clear Terms</h3>
                <p className="text-brand-dark-text">Simple, transparent conditions that make sense—no hidden surprises.</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Coverage Showcase Section */}
      <section className="py-6 md:py-8 bg-white text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* CTA Button */}
          <button 
            onClick={scrollToQuoteForm}
            className="inline-flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-10 py-4 md:py-6 text-lg md:text-xl rounded-lg shadow-lg transition-colors w-full sm:w-auto justify-center animate-cta-enhanced"
          >
            Secure your warranty
            <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </section>

      {/* Additional Cover Options Section - Lazy Loaded */}
      <LazySection>
        <Suspense fallback={<div className="py-12 md:py-20 bg-white min-h-[400px]" />}>
          <AdditionalCoverSection />
        </Suspense>
      </LazySection>

      {/* FAQ Section - Lazy Loaded */}
      <LazySection>
        <Suspense fallback={<div className="py-12 md:py-20 min-h-[400px]" />}>
          <HomepageFAQ />
        </Suspense>
      </LazySection>



      {/* Email Capture Popup */}
      <Suspense fallback={null}>
        <EmailCapturePopup
          isOpen={showEmailPopup}
          onClose={() => setShowEmailPopup(false)}
        />
      </Suspense>

      {/* How Pricing Works Modal */}
      <HowPricingWorksModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />

      {/* Request Callback Modal */}
      <Suspense fallback={null}>
        <RequestCallbackModal
          isOpen={showCallbackModal}
          onClose={() => setShowCallbackModal(false)}
        />
      </Suspense>
    </div>
  );
};

export default Homepage;
