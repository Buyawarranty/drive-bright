import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Car, Truck, Battery, Bike, ArrowRight, Zap, AlertCircle, Shield } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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

interface HeroQuoteFormProps {
  onRegistrationSubmit: (vehicleData: VehicleData) => void;
}

export const HeroQuoteForm: React.FC<HeroQuoteFormProps> = ({ onRegistrationSubmit }) => {
  const { toast } = useToast();
  const [regNumber, setRegNumber] = useState('');
  const [regError, setRegError] = useState('');
  const [regErrorDetail, setRegErrorDetail] = useState('');
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  // Only shown when the MOT lookup returns no odometer reading.
  const [needsMileage, setNeedsMileage] = useState(false);
  const [manualMileage, setManualMileage] = useState('');

  // Inline registration error copy, by failure type
  const REG_ERRORS = {
    notFound: {
      title: "We couldn't find that registration",
      detail: 'Check the letters and numbers, then try again.',
    },
    format: {
      title: "That registration doesn't look right",
      detail: 'Enter it in this format: AB12 CDE',
    },
    system: {
      title: "We're having trouble checking your registration",
      detail: 'Please try again in a moment.',
    },
  } as const;

  const showRegError = (kind: keyof typeof REG_ERRORS) => {
    setRegError(REG_ERRORS[kind].title);
    setRegErrorDetail(REG_ERRORS[kind].detail);
  };

  const formatRegNumber = (input: string): string => {
    const cleanInput = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return cleanInput;
  };

  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRegNumber(e.target.value);
    setRegNumber(formatted);
    setRegError('');
    setRegErrorDetail('');
    setVehicleAgeError('');
  };


  // Remember where the quoted mileage came from so Step 4 can simply ask the
  // customer to confirm it (and honour the price they were shown).
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

  const handleGetQuote = async (mileageOverride?: string) => {
    trackButtonClick('get_quote_hero');
    trackQuoteRequest();

    const cleanedReg = regNumber.replace(/\s+/g, '').toUpperCase();

    // Accepts current-style (AB12CDE), prefix/suffix and dateless plates.
    const UK_REG_PATTERN = /^(?:[A-Z]{2}[0-9]{2}[A-Z]{3}|[A-Z][0-9]{1,3}[A-Z]{3}|[A-Z]{3}[0-9]{1,3}[A-Z]?|[0-9]{1,4}[A-Z]{1,3}|[A-Z]{1,3}[0-9]{1,4})$/;
    if (!cleanedReg || !UK_REG_PATTERN.test(cleanedReg)) {
      showRegError('format');
      return;
    }

    setRegError('');
    setRegErrorDetail('');
    setIsLookingUp(true);
    setVehicleAgeError('');

    // Safety timeout: if the DVLA lookup hangs, surface a system message rather
    // than leaving the user on "Preparing your instant price…".
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      console.warn('DVLA lookup timed out');
      setIsLookingUp(false);
      showRegError('system');
    }, 8000);

    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registration: regNumber }
      });

      if (timedOut) return;

      if (error) {
        console.error('DVLA lookup error:', error);
        showRegError('system');
        return;
      }

      if (!data || !data.make) {
        showRegError('notFound');
        return;
      }

      // Check vehicle age using precise manufactureDate if available
      const now = new Date();
      let vehicleAgePrecise: number | null = null;
      
      // Try to use manufactureDate for precise age calculation (15 years and 1 day check)
      if (data.manufactureDate) {
        const manufactureDate = new Date(data.manufactureDate);
        if (!isNaN(manufactureDate.getTime())) {
          const ageInMs = now.getTime() - manufactureDate.getTime();
          const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
          vehicleAgePrecise = ageInMs / msPerYear;
          
          if (vehicleAgePrecise > 15) {
            setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
            setIsLookingUp(false);
            return;
          }
        }
      }
      
      // Fallback to year-based calculation if no manufactureDate
      if (vehicleAgePrecise === null) {
        const currentYear = now.getFullYear();
        const vehicleYear = parseInt(data.yearOfManufacture || data.year || '0', 10);
        const vehicleAge = currentYear - vehicleYear;

        if (vehicleAge > 15) {
          setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
          setIsLookingUp(false);
          return;
        }
      }

      // Mileage always comes from the last MOT odometer reading. When there is
      // no reading we assume a typical mileage and confirm it at checkout.
      const motMileage = Number(String(data.motMileage ?? '').replace(/[^0-9]/g, ''));
      let quotedMileage: string;

      if (motMileage > 0) {
        if (motMileage > 150000) {
          setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
          setIsLookingUp(false);
          return;
        }
        quotedMileage = String(motMileage);
        setNeedsMileage(false);
        rememberMileageSource('mot', motMileage, data.motMileageDate ?? null);
      } else {
        const typed = Number(String(mileageOverride ?? manualMileage).replace(/[^0-9]/g, ''));
        if (!typed || typed <= 0) {
          // No MOT reading available — ask the customer for their mileage here.
          setNeedsMileage(true);
          setIsLookingUp(false);
          setTimeout(() => {
            const el = document.getElementById('hero-manual-mileage-field');
            el?.focus();
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
          return;
        }
        if (typed > 150000) {
          setNeedsMileage(true);
          setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
          setIsLookingUp(false);
          return;
        }
        quotedMileage = String(typed);
        rememberMileageSource('customer', typed);
      }

      const vehicleData: VehicleData = {
        regNumber: regNumber.toUpperCase(),
        mileage: quotedMileage,
        make: data.make,
        model: data.model,
        fuelType: data.fuelType,
        transmission: data.transmission,
        year: data.yearOfManufacture || data.year,
        vehicleType: data.vehicleType,
        blocked: data.blocked || false,
        blockReason: data.blockReason || '',
      };

      onRegistrationSubmit(vehicleData);
    } catch (error) {
      if (timedOut) return;
      console.error('Error looking up vehicle:', error);
      showRegError('system');
    } finally {
      window.clearTimeout(timeoutId);
      if (!timedOut) setIsLookingUp(false);
    }
  };



  return (
    <div className="bg-white py-8 lg:py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Content */}
          <div className="space-y-4 flex flex-col justify-center">
            {/* Main Headline */}
            <div className="space-y-2 mb-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
                <span className="text-[#333]">Affordable warranty you can trust </span>
                <span className="text-brand-orange">in 60 seconds!</span>
              </h2>
            </div>

            {/* Benefits */}
            <div className="mb-6 text-gray-700 text-sm md:text-base space-y-2">
              <div className="flex items-center">
                <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                <span className="font-medium">From just 60p a day • Easy claims • Fast payouts</span>
              </div>
              <div className="flex items-center">
                <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                <span className="font-medium">Unlimited claims • Complete Cover • No excess</span>
              </div>
            </div>

            {/* Registration Input */}
            <div className="space-y-3 w-full max-w-md">
              <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black w-full">
                {/* UK Section with flag */}
                <div className="bg-blue-600 text-white font-bold px-4 py-4 flex items-center justify-center min-w-[80px] h-[66px]">
                  <div className="flex flex-col items-center">
                    <div className="text-lg leading-tight mb-1">🇬🇧</div>
                    <div className="text-base font-bold leading-none">UK</div>
                  </div>
                </div>
                {/* Registration Input */}
                <input
                  type="text"
                  value={regNumber}
                  onChange={handleRegChange}
                  placeholder="Enter reg"
                  className="bg-yellow-400 border-none outline-none text-3xl text-black flex-1 font-black placeholder:text-black/70 px-4 py-4 uppercase tracking-wider h-[66px] min-w-0"
                  maxLength={8}
                />
              </div>
              <p className="text-sm text-black text-left mt-0.5">
                Protection for vehicles up to 150,000 miles and 15 years.
              </p>

              {/* Inline registration error */}
              {regError && (
                <div className="text-left animate-fade-in">
                  <p className="text-sm text-red-600 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {regError}
                  </p>
                  {regErrorDetail && (
                    <p className="text-sm text-red-600/80 mt-0.5 pl-6">{regErrorDetail}</p>
                  )}
                </div>
              )}

              {/* Reg-only journey: age comes from the plate and mileage from the
                  last MOT. We never ask the customer for mileage here. */}
              {(
                <div className="space-y-3">
                  {isLookingUp ? (
                    <div className="flex items-center justify-center gap-3 py-6 px-4 rounded-xl bg-gradient-to-r from-brand-orange/10 to-brand-orange/5 border-2 border-brand-orange/30">
                      <Zap className="w-5 h-5 text-brand-orange animate-pulse" />
                      <span className="text-base sm:text-lg font-semibold text-brand-orange">
                        Preparing your instant price…
                      </span>
                    </div>
                  ) : regNumber.replace(/\s/g, '').length < 5 ? (
                    <button
                      type="button"
                      onClick={() => handleGetQuote()}
                      className="w-full text-center rounded-xl border border-[#F0D6C3] bg-[#FBE4D6]/50 hover:bg-[#FBE4D6]/70 transition-colors px-3 py-2.5 flex items-center justify-center gap-3"
                    >
                      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/70 ring-1 ring-[#EBC9B0] flex-shrink-0">
                        <Shield className="w-4 h-4" style={{ color: '#B07A5C' }} strokeWidth={2} />
                      </span>
                      <span className="flex flex-col leading-tight text-center">
                        <span className="text-sm font-semibold" style={{ color: '#8A5A45' }}>
                          Enter reg for an instant price
                        </span>
                        <span className="text-xs mt-0.5" style={{ color: '#B07A5C' }}>
                          We'll instantly find your car details.
                        </span>
                      </span>
                    </button>
                  ) : needsMileage ? (
                    <div className="space-y-3 rounded-xl border-2 border-[#F0A500] bg-[#FFF8E5] p-4 text-left">
                      <div>
                        <p className="text-base font-semibold text-[#7A5A00]">We just need your current mileage</p>
                        <p className="text-sm text-[#8A6A1F] mt-1">
                          We couldn't find an MOT reading for this vehicle, so pop your mileage in and we'll price it straight away.
                        </p>
                      </div>
                      <input
                        id="hero-manual-mileage-field"
                        type="text"
                        inputMode="numeric"
                        value={manualMileage ? Number(manualMileage).toLocaleString('en-GB') : ''}
                        onChange={(e) => {
                          setManualMileage(e.target.value.replace(/[^0-9]/g, ''));
                          if (vehicleAgeError) setVehicleAgeError('');
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleGetQuote(manualMileage); }}
                        placeholder="e.g. 62,000"
                        className="w-full h-12 rounded-lg border-2 border-[#E0B24A] bg-white px-3 text-lg font-semibold text-gray-900 outline-none focus:border-[#F0A500]"
                      />
                      <Button
                        onClick={() => handleGetQuote(manualMileage)}
                        disabled={!manualMileage}
                        className="w-full font-bold rounded-xl px-6 py-6 text-lg bg-brand-orange hover:bg-orange-700 text-white shadow-lg animate-breathing"
                      >
                        <span className="flex items-center justify-center gap-3">
                          Get my quote
                          <ArrowRight className="w-6 h-6" strokeWidth={3} />
                        </span>
                      </Button>
                      <p className="text-xs text-[#8A6A1F]">
                        We'll prefill this for you at checkout so you don't have to type it again.
                      </p>
                      {vehicleAgeError && (
                        <div className="flex items-center gap-2 text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm">{vehicleAgeError}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={() => handleGetQuote()}
                        className="w-full font-bold rounded-xl px-6 py-6 sm:py-8 text-lg sm:text-xl bg-brand-orange hover:bg-orange-700 text-white shadow-lg animate-breathing"
                      >
                        <span className="flex items-center justify-center gap-3">
                          Get my quote
                          <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={3} />
                        </span>
                      </Button>
                      <p className="text-sm text-gray-600 text-center">
                        No mileage needed — we use your last MOT reading and confirm it with you at checkout.
                      </p>
                      {vehicleAgeError && (
                        <div className="flex items-center gap-2 text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm">{vehicleAgeError}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Right Content - Hero Image */}
          <div className="relative">
            <OptimizedImage 
              src="/extended_warranty_uk-car-trustworthy-reviews.webp" 
              alt="Extended warranty UK - Car trustworthy reviews - Panda mascot with vehicle collection" 
              className="w-full h-auto"
              priority={true}
              width={651}
              height={434}
              sizes="(max-width: 768px) 100vw, 651px"
            />
            
            {/* Vehicle Types positioned underneath */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-16 w-full px-4">
              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center justify-center gap-6 flex-wrap max-w-full">
                  <div className="flex items-center space-x-1.5">
                    <Car className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-base">Cars</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Truck className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-base">Vans</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Battery className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-base">EVs</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Bike className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-base">Motorcycles</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
