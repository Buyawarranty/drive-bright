import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Star, Shield, Clock, Zap, Car, Truck, Battery, Bike, Menu, X, Phone, FileCheck, MessageCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import WebsiteFooter from './WebsiteFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { VoucherBanner } from './VoucherBanner';
import { EmailCapturePopup } from './EmailCapturePopup';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { OptimizedImage } from '@/components/OptimizedImage';
import LazySection from './homepage/LazySection';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import HowPricingWorksModal from './modals/HowPricingWorksModal';
import TrustpilotMicroWidget from './TrustpilotMicroWidget';
import TrustpilotSliderWidget from './TrustpilotSliderWidget';
import TrustpilotMicroStarWidget from './TrustpilotMicroStarWidget';
import RequestCallbackModal from './modals/RequestCallbackModal';

// Lazy load heavy components to reduce initial bundle size
const HomepageFAQ = lazy(() => import('./HomepageFAQ'));
const VideoSection = lazy(() => import('./homepage/VideoSection'));
const AdditionalCoverSection = lazy(() => import('./homepage/AdditionalCoverSection'));
const WarrantyBenefitsSection = lazy(() => import('./homepage/WarrantyBenefitsSection'));
const CoverClaritySection = lazy(() => import('./homepage/CoverClaritySection'));
const VehicleCoverageSection = lazy(() => import('./homepage/VehicleCoverageSection'));
const LandingPageDirectory = lazy(() => import('./homepage/LandingPageDirectory'));

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import MileageQuickSelect from './MileageQuickSelect';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import { trackButtonClick, trackEvent, trackQuoteRequest } from '@/utils/analytics';

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
}

interface HomepageProps {
  onRegistrationSubmit: (vehicleData: VehicleData) => void;
}

const Homepage: React.FC<HomepageProps> = ({ onRegistrationSubmit }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState<string>(''); // 'under120k' or 'over120k'
  const [showMileageField, setShowMileageField] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [mileageError, setMileageError] = useState('');
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showVoucherBanner, setShowVoucherBanner] = useState(false);
  const [showSecondWarrantyDiscount, setShowSecondWarrantyDiscount] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  

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

  const formatRegNumber = (value: string) => {
    const formatted = value.replace(/\s/g, '').toUpperCase();
    if (formatted.length > 3) {
      return formatted.slice(0, -3) + ' ' + formatted.slice(-3);
    }
    return formatted;
  };

  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRegNumber(e.target.value);
    if (formatted.length <= 8) {
      setRegNumber(formatted);
      // Clear vehicle age error when user changes reg number so they can try again
      if (vehicleAgeError) {
        setVehicleAgeError('');
      }
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

  const handleGetQuote = async (mileageOverride?: string) => {
    // Use the override mileage if provided (from auto-submit), otherwise use state
    const effectiveMileage = mileageOverride || mileage;
    const effectiveMileageSelection = mileageOverride ? (mileageOverride === '100000' ? 'under120k' : 'over120k') : mileageSelection;
    
    console.log('🔘 GET QUOTE BUTTON CLICKED');
    console.log('📋 Form values:', { regNumber, mileage: effectiveMileage, mileageSelection: effectiveMileageSelection });
    
    // Track main CTA button click
    trackButtonClick('get_quote_main', {
      has_reg_number: !!regNumber.trim(),
      has_mileage: !!effectiveMileage.trim(),
      mileage_value: effectiveMileage
    });
    
    // Check if registration number is entered
    if (!regNumber.trim()) {
      toast({
        title: "Registration Required",
        description: "Please enter your vehicle registration number.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if mileage is selected
    if (!effectiveMileageSelection) {
      toast({
        title: "Mileage Required", 
        description: "Please select your approximate mileage to continue.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if mileage is zero
    const numericMileage = parseInt(effectiveMileage.replace(/,/g, ''));
    if (numericMileage === 0) {
      toast({
        title: "Mileage Required",
        description: "Please select a mileage greater than 0 to get your quote.",
        variant: "destructive",
      });
      return;
    }
    
    // Check mileage validation before proceeding
    if (numericMileage > 150000) {
      setMileageError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
      return;
    }
    
    setIsLookingUp(true);
    
    try {
      console.log('Looking up vehicle:', regNumber);
      
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber }
      });

      if (error) {
        console.error('DVSA lookup error:', error);
        throw error;
      }

      console.log('DVSA lookup result:', data);
      
      // Check for age-related blocking when vehicle is not found
      if (!data?.found && data?.error && data.error.includes('15 years')) {
        console.log('Vehicle blocked: Over 15 years old');
        toast({
          title: "Vehicle Not Eligible",
          description: "We cannot offer warranties for vehicles over 15 years of age.",
          variant: "destructive",
        });
        setVehicleAgeError('We cannot offer warranties for vehicles over 15 years old');
        setIsLookingUp(false);
        return;
      }
      
      // Check for missing year information when vehicle is found
      if (data?.found && !data.yearOfManufacture) {
        console.log('Vehicle blocked: Year information not available');
        toast({
          title: "Vehicle Not Eligible",
          description: "We cannot verify the age of this vehicle. Please contact support for assistance.",
          variant: "destructive",
        });
        setVehicleAgeError('Cannot verify vehicle age');
        setIsLookingUp(false);
        return;
      }
      
      // Check vehicle age using precise manufactureDate if available
      if (data?.found) {
        const now = new Date();
        let vehicleAgePrecise: number | null = null;
        
        // Try to use manufactureDate for precise age calculation (15 years and 1 day check)
        if (data.manufactureDate) {
          const manufactureDate = new Date(data.manufactureDate);
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
              setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
              toast({
                title: "Vehicle Not Eligible",
                description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.",
                variant: "destructive",
              });
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
            setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
            toast({
              title: "Vehicle Not Eligible",
              description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.",
              variant: "destructive",
            });
            setIsLookingUp(false);
            return;
          }
        }
        
        setVehicleAgeError('');
      }
      
      // Prepare vehicle data
      const vehicleData: VehicleData = {
        regNumber: regNumber,
        mileage: effectiveMileage.replace(/,/g, ''), // Remove commas for storage
      };

      // Add DVLA data if found
      if (data?.found) {
        vehicleData.make = data.make;
        vehicleData.model = data.model;
        vehicleData.fuelType = data.fuelType;
        vehicleData.transmission = data.transmission;
        vehicleData.year = data.yearOfManufacture;
        vehicleData.vehicleType = data.vehicleType || 'car';
        vehicleData.manufactureDate = data.manufactureDate; // Full manufacture date for precise age calculation
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
      
      toast({
        title: "Lookup Failed",
        description: "Unable to find vehicle details, but you can still continue to get your quote.",
        variant: "destructive",
      });
      
      // Continue with basic vehicle data even if lookup fails
      const vehicleData: VehicleData = {
        regNumber: regNumber,
        mileage: mileage.replace(/,/g, ''),
      };
      
      onRegistrationSubmit(vehicleData);
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
                    description: "Your discount code has been applied and will be used at checkout" 
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
      <section id="quote-form" className="bg-white pt-3 sm:pt-8 lg:pt-16 pb-2 sm:pb-4 lg:pb-8 px-3 sm:px-0">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="space-y-3 sm:space-y-4 px-0 sm:px-0 flex flex-col justify-center">

               {/* Trustpilot Micro TrustScore */}
               <TrustpilotMicroWidget className="mb-2" />

               {/* Main Headline */}
               <div className="space-y-2 mb-2 sm:mb-4">
               <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight">
                 <span className="text-[#333]">Affordable warranty you can trust </span>
                 <span className="text-brand-orange">in 60 seconds!</span>
               </h1>
               </div>

              {/* Benefits */}
              <div className="mb-3 sm:mb-8 text-gray-700 text-xs sm:text-sm md:text-base space-y-1 sm:space-y-2">
                <div className="flex items-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="font-medium">From just 60p a day • Easy claims • Fast payouts</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="font-medium">Unlimited claims • Parts and Labour • No excess</span>
                </div>
              </div>

              {/* Registration Input */}
              <div className="space-y-2 sm:space-y-3 w-full max-w-56 mx-auto lg:mx-0">
                <div className="relative">
                  <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black w-full">
                    {/* UK Section with flag */}
                    <div className="bg-blue-600 text-white font-bold px-2 sm:px-3 md:px-4 py-2 sm:py-4 flex items-center justify-center min-w-[45px] sm:min-w-[70px] md:min-w-[80px] h-[48px] sm:h-[60px] md:h-[66px]">
                      <div className="flex flex-col items-center">
                        <div className="text-xs sm:text-base md:text-lg leading-tight mb-1">🇬🇧</div>
                        <div className="text-xs sm:text-sm md:text-base font-bold leading-none">UK</div>
                      </div>
                    </div>
                    {/* Registration Input */}
                    <input
                      id="reg-input-field"
                      type="text"
                      value={regNumber}
                      onChange={handleRegChange}
                      placeholder="Enter reg"
                      className="bg-yellow-400 border-none outline-none text-lg sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/70 px-2 sm:px-3 md:px-4 py-2 sm:py-4 uppercase tracking-wider h-[48px] sm:h-[60px] md:h-[66px] min-w-0"
                      maxLength={8}
                    />
                  </div>
                  {/* Green tick when reg is valid (at least 5 chars) */}
                  {regNumber.replace(/\s/g, '').length >= 5 && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md z-10">
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </span>
                  )}
                </div>
                
                {/* Guidance text based on state - also highlight reg input when showing error */}
                {mileageSelection && regNumber.replace(/\s/g, '').length < 5 ? (
                  <>
                    <p className="text-sm text-red-500 font-semibold text-left animate-fade-in">
                      ☝️ Enter your registration above to continue
                    </p>
                    <style>{`
                      #reg-input-field {
                        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.5) !important;
                        animation: pulse-red 1.5s ease-in-out infinite;
                      }
                      @keyframes pulse-red {
                        0%, 100% { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.5); }
                        50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.3); }
                      }
                    `}</style>
                  </>
                ) : regNumber.replace(/\s/g, '').length >= 5 && !mileageSelection ? (
                  <p className="text-sm text-brand-orange font-semibold text-left animate-fade-in flex items-center gap-1.5">
                    <span className="text-brand-orange font-black text-base">▼</span> Select your mileage
                  </p>
                ) : null}

                {/* Mileage Quick Select */}
                <div id="mileage-section">
                  <MileageQuickSelect
                    value={mileageSelection}
                    onChange={handleMileageSelection}
                    onAutoSubmit={handleGetQuote}
                    error={eligibilityError}
                    isLoading={isLookingUp}
                    isRegValid={regNumber.replace(/\s/g, '').length >= 5}
                    autoScrollOnValid
                  />
                </div>
                
                {/* Pricing Reassurance Panel - Premium Trust Block */}
                <div className="mt-5 sm:mt-7 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-5 py-4 text-center">
                   <h2 className="text-sm sm:text-[17px] font-bold text-[#1B2A4A]">
                     Fair price. Fast quote. No surprises.
                   </h2>
                   
                   <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs sm:text-[15px] mt-1.5">
                    <span className="text-gray-600">Speak to an expert:</span>
                    <a 
                      href="tel:03302295040" 
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      0330 229 5040
                    </a>
                    <span className="text-gray-400">or</span>
                    <button
                      onClick={() => setShowCallbackModal(true)}
                      className="text-brand-orange hover:underline font-medium"
                    >
                      Request a callback
                    </button>
                  </div>
                </div>
              </div>
            </div>

 {/* Right Content - Hero Image */}
            <div className="relative flex flex-col">
              <OptimizedImage 
                src="/extended_warranty_uk-car-trustworthy-reviews.png" 
                alt="Extended warranty UK - Car trustworthy reviews - Panda mascot with vehicle collection" 
                className="w-full h-auto"
                priority={true}
                width={651}
                height={434}
                sizes="(max-width: 768px) 100vw, 651px"
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
                  
                  {/* Instant Activation Badge */}
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 rounded-md px-3.5 py-2 cursor-pointer">
                          <span className="text-sm font-semibold text-green-700">⚡ Instant cover</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>⚡ Cover starts immediately after purchase</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                </div>
              </div>
            </div>
            
            {/* Vehicle Types for mobile/tablet - spans full width */}
            <div className="lg:hidden w-full px-4 mt-4 sm:mt-6 lg:col-span-2">
              <div className="flex flex-col items-center gap-4 sm:gap-6">
                <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap max-w-full">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-xs sm:text-sm whitespace-nowrap">Cars</span>
                  </div>
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-xs sm:text-sm whitespace-nowrap">Vans</span>
                  </div>
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-xs sm:text-sm whitespace-nowrap">Hybrid</span>
                  </div>
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-xs sm:text-sm whitespace-nowrap">EV</span>
                  </div>
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <Bike className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-xs sm:text-sm whitespace-nowrap">Motorbikes</span>
                  </div>
                </div>
                
                {/* Instant Activation Badge */}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 rounded-md px-3 py-1.5 sm:px-3.5 sm:py-2 cursor-pointer">
                        <span className="text-xs sm:text-sm font-semibold text-green-700">⚡ Instant cover</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>⚡ Cover starts immediately after purchase</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
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
                    <span className="text-base text-brand-dark-text"><strong>14-day</strong> money-back guarantee</span>
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
                    <strong>From Just 80p a Day</strong> – Affordable peace of mind.
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
      <EmailCapturePopup 
        isOpen={showEmailPopup}
        onClose={() => setShowEmailPopup(false)}
      />
      
      {/* How Pricing Works Modal */}
      <HowPricingWorksModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />
      
      {/* Request Callback Modal */}
      <RequestCallbackModal
        isOpen={showCallbackModal}
        onClose={() => setShowCallbackModal(false)}
      />
    </div>
  );
};

export default Homepage;
