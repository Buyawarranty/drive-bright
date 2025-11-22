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

// Lazy load heavy components to reduce initial bundle size
const HomepageFAQ = lazy(() => import('./HomepageFAQ'));
const VideoSection = lazy(() => import('./homepage/VideoSection'));
const AdditionalCoverSection = lazy(() => import('./homepage/AdditionalCoverSection'));

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import MileageSlider from './MileageSlider';
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
}

interface HomepageProps {
  onRegistrationSubmit: (vehicleData: VehicleData) => void;
}

const Homepage: React.FC<HomepageProps> = ({ onRegistrationSubmit }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [sliderMileage, setSliderMileage] = useState(0);
  const [showMileageField, setShowMileageField] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [mileageError, setMileageError] = useState('');
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showVoucherBanner, setShowVoucherBanner] = useState(false);
  const [showSecondWarrantyDiscount, setShowSecondWarrantyDiscount] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [mileagePlaceholder, setMileagePlaceholder] = useState('Enter current approximate mileage');

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

    // Show email popup after 60 seconds OR when user scrolls 70% down the page
    let hasTriggered = false;
    
    const showPopup = () => {
      if (!hasTriggered) {
        hasTriggered = true;
        setShowEmailPopup(true);
      }
    };

    // Timer trigger (60 seconds)
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
    }
  };

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d,]/g, '');
    setMileage(value);
    
    // Update slider to match text input
    const numericValue = parseInt(value.replace(/,/g, ''));
    if (!isNaN(numericValue)) {
      setSliderMileage(numericValue);
    }
    
    // Validate mileage
    if (value && numericValue > 150000) {
      setMileageError('We can only cover vehicles up to 150,000 miles');
    } else {
      setMileageError('');
    }
  };

  const handleMileageFocus = () => {
    setMileage('');
    setSliderMileage(0);
    setMileagePlaceholder('Enter mileage (e.g. 32,000)');
  };

  const handleMileageBlur = () => {
    if (!mileage || mileage === '0') {
      setMileagePlaceholder('Enter current approximate mileage');
    }
  };

  const handleSliderChange = (value: number) => {
    setSliderMileage(value);
    setMileage(value.toLocaleString());
    
    // Validate mileage
    if (value > 150000) {
      setMileageError('We can only cover vehicles up to 150,000 miles');
    } else {
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

  const handleGetQuote = async () => {
    // Track main CTA button click
    trackButtonClick('get_quote_main', {
      has_reg_number: !!regNumber.trim(),
      has_mileage: !!mileage.trim(),
      mileage_value: mileage
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
    
    // Check if mileage is entered
    if (!mileage.trim()) {
      toast({
        title: "Mileage Required", 
        description: "Please enter your vehicle's mileage to continue.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if mileage is zero
    const numericMileage = parseInt(mileage.replace(/,/g, ''));
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
      setMileageError('We can only cover vehicles up to 150,000 miles');
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
      
      // Check vehicle age if data found and year is available
      if (data?.found && data.yearOfManufacture) {
        const currentYear = new Date().getFullYear();
        const vehicleYear = parseInt(data.yearOfManufacture);
        const vehicleAge = currentYear - vehicleYear;
        
        if (vehicleAge > 15) {
          setVehicleAgeError('We cannot offer warranties for vehicles over 15 years old');
          toast({
            title: "Vehicle Not Eligible",
            description: "We cannot offer warranties for vehicles over 15 years of age.",
            variant: "destructive",
          });
          setIsLookingUp(false);
          return;
        } else {
          setVehicleAgeError('');
        }
      }
      
      // Prepare vehicle data
      const vehicleData: VehicleData = {
        regNumber: regNumber,
        mileage: mileage.replace(/,/g, ''), // Remove commas for storage
      };

      // Add DVLA data if found
      if (data?.found) {
        vehicleData.make = data.make;
        vehicleData.model = data.model;
        vehicleData.fuelType = data.fuelType;
        vehicleData.transmission = data.transmission;
        vehicleData.year = data.yearOfManufacture;
        vehicleData.vehicleType = data.vehicleType || 'car';
        if (data.blocked) {
          vehicleData.blocked = true;
          vehicleData.blockReason = data.blockReason;
        }
      }
      
      // Track quote request with enhanced data for Google Ads
      trackQuoteRequest(undefined, undefined, undefined);

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

  const isFormValid = regNumber.trim() && mileage.trim() && !mileageError && !vehicleAgeError;

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
      <section id="quote-form" className="bg-white py-3 sm:py-8 lg:py-16 px-3 sm:px-0">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="space-y-3 sm:space-y-4 px-0 sm:px-0 flex flex-col justify-center">

              {/* Main Headline */}
              <div className="space-y-2 mb-2 sm:mb-4">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight">
                <span className="text-gray-900">We've got you </span>
                <span className="text-brand-orange">covered in 60 seconds!</span>
              </h1>
              </div>

              {/* Benefits */}
              <div className="mb-3 sm:mb-8 text-gray-700 text-xs sm:text-sm md:text-base space-y-1 sm:space-y-2">
                <div className="flex items-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="font-medium">From just 80p a day • Easy claims • Fast payouts</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="font-medium">Unlimited claims • Parts and Labour • No excess</span>
                </div>
              </div>

              {/* Registration Input */}
              <div className="space-y-2 sm:space-y-3 w-full max-w-56 mx-auto lg:mx-0">
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
                    type="text"
                    value={regNumber}
                    onChange={handleRegChange}
                    placeholder="Enter reg"
                    className="bg-yellow-400 border-none outline-none text-lg sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/70 px-2 sm:px-3 md:px-4 py-2 sm:py-4 uppercase tracking-wider h-[48px] sm:h-[60px] md:h-[66px] min-w-0"
                    maxLength={8}
                  />
                </div>
                <p className="text-xs sm:text-sm text-black text-left mt-0.5">
                  Protection for vehicles up to 150,000 miles and 15 years.
                </p>

                {/* Mileage Options - Always Visible */}
                <div className="space-y-2">
                  {/* Text Input Option */}
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={mileage}
                      onChange={handleMileageChange}
                      onFocus={handleMileageFocus}
                      onBlur={handleMileageBlur}
                      placeholder={mileagePlaceholder}
                      className={`w-full max-w-56 px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-sm sm:text-lg border-2 rounded-lg focus:outline-none min-w-0 ${
                        mileageError ? 'border-blue-400 focus:border-blue-500' : 'border-gray-300 focus:border-orange-500'
                      }`}
                    />
                  </div>


                  {/* Slider Option */}
                  <div>
                    <MileageSlider
                      value={sliderMileage}
                      onChange={handleSliderChange}
                      min={0}
                      max={150000}
                    />
                  </div>

                  {/* Error Messages */}
                  {mileageError && (
                    <p className="text-sm text-blue-600 font-medium">
                      {mileageError}
                    </p>
                  )}
                  {vehicleAgeError && (
                    <p className="text-sm text-blue-600 font-medium">
                      {vehicleAgeError}
                    </p>
                  )}
                </div>

                {/* Get Quote Button */}
                <div className="space-y-2 mt-2">
                  <Button 
                    onClick={handleGetQuote}
                    className={`w-full max-w-56 px-3 sm:px-6 md:px-12 h-[48px] sm:h-[60px] md:h-[66px] text-sm sm:text-lg md:text-xl font-bold rounded-lg transition-all min-w-0 ${
                      isLookingUp
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-brand-orange hover:bg-brand-orange/90 text-white animate-cta-enhanced'
                    }`}
                    disabled={isLookingUp}
                  >
                    {isLookingUp ? (
                      <>
                        <span className="hidden sm:inline">Looking up vehicle...</span>
                        <span className="sm:hidden">Looking up...</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Get my instant quote</span>
                        <span className="sm:hidden">Get my instant quote</span>
                        <ArrowRight className="w-5 h-5 ml-2" strokeWidth={4.5} />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

 {/* Right Content - Hero Image */}
            <div className="relative">
              <OptimizedImage 
                src="/extended_warranty_uk-car-trustworthy-reviews.png" 
                alt="Extended warranty UK - Car trustworthy reviews - Panda mascot with vehicle collection" 
                className="w-full h-auto"
                priority={true}
                width={1200}
                height={800}
              />
              {/* Trustpilot Logo positioned to the right */}
              <div className="absolute top-4 right-4 z-10">
                <a 
                  href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <OptimizedImage 
                    src={trustpilotLogo} 
                    alt="Trustpilot Excellent Rating" 
                    className="h-auto w-32 sm:w-40 object-contain"
                    priority={false}
                    width={320}
                    height={100}
                  />
                </a>
              </div>
              
              {/* Vehicle Types positioned underneath the panda's feet */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-12 sm:translate-y-16 w-full px-4">
                <div className="flex flex-col items-center gap-4 sm:gap-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap max-w-full">
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base whitespace-nowrap">Cars</span>
                    </div>
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base whitespace-nowrap">Vans</span>
                    </div>
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base whitespace-nowrap">Hybrid</span>
                    </div>
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base whitespace-nowrap">EV</span>
                    </div>
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <Bike className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base whitespace-nowrap">Motorbikes</span>
                    </div>
                  </div>
                  
                  {/* Instant Activation Badge */}
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 rounded-md px-3 py-1.5 sm:px-3.5 sm:py-2 cursor-pointer">
                          <span className="text-xs sm:text-sm font-semibold text-green-700">⚡ Instant cover protection</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>🛡️ Cover starts immediately after purchase – excludes pre-existing conditions.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* Extended Warranty Video Section - Lazy Loaded */}
      <LazySection>
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={scrollToQuoteForm} />
        </Suspense>
      </LazySection>

      {/* Step 1 - Enter Your Reg Plate */}
      <section className="pt-6 md:pt-10 pb-12 md:pb-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center">
            {/* Left - Content */}
            <div className="space-y-6 md:space-y-8 order-2 lg:order-1">
              <div className="mb-4 md:mb-6">
                <div className="text-green-600 text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  Unlimited Claims
                </div>
                <h2 className="text-2xl md:text-4xl font-bold text-brand-dark-text leading-tight">
                  Complete <span className="text-brand-orange">vehicle protection</span>
                </h2>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl md:text-2xl font-bold text-brand-dark-text">
                  Transparent Pricing. Trusted Protection.
                </h3>
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
              
              {/* Trustpilot Logo */}
              <div className="mt-6 flex justify-center">
                <a 
                  href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block hover:opacity-80 transition-opacity"
                >
                  <OptimizedImage 
                    src={trustpilotLogo} 
                    alt="Trustpilot Excellent Rating - 5 Stars"
                    className="h-auto w-40 object-contain"
                    priority={false}
                    width={320}
                    height={100}
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step 2 - Choose Your Plan */}
      <section className="py-8 md:py-14 bg-brand-gray-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center">
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
                     <strong>Save an Extra 20% with our longer term plans</strong>
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
      <section className="py-8 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center">
            {/* Left - Content */}
            <div className="space-y-6 md:space-y-8 order-2 lg:order-1">
              <div className="mb-4 md:mb-6">
                <div className="text-green-600 text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High Mileage, No Problem!
                </div>
                <h2 className="text-2xl md:text-4xl font-bold text-brand-dark-text leading-tight">
                  Drive With Confidence –
                  <br />
                  <span className="text-brand-orange">You're Covered</span>
                </h2>
              </div>
              
              <p className="text-base md:text-lg text-brand-dark-text leading-relaxed">
                Once you're covered, drive with complete peace of mind. If something 
                goes wrong, simply call our claims team and we'll take care of everything.
                <br />
                We want to get you back on the road as soon as possible.
              </p>

              {/* Trustpilot Section */}
              <div className="py-4">
                <a 
                  href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block hover:opacity-80 transition-opacity"
                >
                  <OptimizedImage 
                    src={trustpilotLogo} 
                    alt="Trustpilot Excellent Rating - 5 Stars"
                    className="h-auto w-40 object-contain"
                    priority={false}
                    width={320}
                    height={100}
                  />
                </a>
              </div>

              <button 
                onClick={scrollToQuoteForm}
                className="bg-brand-deep-blue hover:bg-blue-800 text-white font-bold px-6 md:px-10 py-3 md:py-4 text-lg md:text-xl rounded shadow-lg transition-colors w-full sm:w-auto"
              >
                Get Instant Quote
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
            </div>
          </div>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="py-12 md:py-20 bg-gradient-to-r from-blue-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-6 md:space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold text-brand-deep-blue">
              What's <span className="text-brand-orange">Included?</span>
            </h2>
            
            <div className="max-w-3xl mx-auto">
              <p className="text-xl md:text-2xl font-bold text-brand-dark-text leading-relaxed">
                Rest assured everything is covered. If it breaks, We'll fix it, No excuses.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 md:gap-8 mt-12">
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
      <section className="py-12 md:py-20 bg-brand-gray-bg text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* CTA Button */}
          <button 
            onClick={scrollToQuoteForm}
            className="bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-10 py-4 md:py-6 text-lg md:text-xl rounded-lg shadow-lg transition-colors w-full sm:w-auto"
          >
            Get Instant Quote
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

      {/* Mobile Floating Action Buttons */}
      {isMobile && (
        <div className="fixed bottom-6 right-4 flex flex-col gap-3 z-50">
          {/* WhatsApp Button */}
          <a 
            href="https://wa.me/message/SPQPJ6O3UBF5B1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center w-14 h-14 bg-[#25D366] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <img 
              src={whatsappIconNew} 
              alt="WhatsApp" 
              className="w-12 h-12"
            />
          </a>
          
          {/* Call Button */}
          <a 
            href="tel:03302295040"
            className="flex items-center justify-center w-14 h-14 bg-orange-500 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Phone className="w-7 h-7 text-white" />
          </a>
        </div>
      )}

      {/* Email Capture Popup */}
      <EmailCapturePopup 
        isOpen={showEmailPopup}
        onClose={() => setShowEmailPopup(false)}
      />
    </div>
  );
};

export default Homepage;
