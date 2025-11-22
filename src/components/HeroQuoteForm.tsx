import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Car, Truck, Battery, Bike, ArrowRight } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import MileageSlider from './MileageSlider';
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
  const [mileage, setMileage] = useState('');
  const [sliderMileage, setSliderMileage] = useState(0);
  const [mileagePlaceholder, setMileagePlaceholder] = useState('Enter mileage');
  const [mileageError, setMileageError] = useState('');
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  const formatRegNumber = (input: string): string => {
    const cleanInput = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return cleanInput;
  };

  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRegNumber(e.target.value);
    setRegNumber(formatted);
  };

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    const numValue = parseInt(value, 10);
    
    if (value === '') {
      setMileage('');
      setSliderMileage(0);
      setMileageError('');
      return;
    }

    if (numValue > 150000) {
      setMileageError('Maximum mileage is 150,000. For higher mileage, please call us.');
      setMileage(value);
      setSliderMileage(150000);
      return;
    }

    setMileage(value);
    setSliderMileage(numValue);
    setMileageError('');
  };

  const handleMileageFocus = () => {
    setMileagePlaceholder('e.g. 45000');
  };

  const handleMileageBlur = () => {
    setMileagePlaceholder('Enter mileage');
  };

  const handleSliderChange = (value: number) => {
    setSliderMileage(value);
    setMileage(value.toString());
    
    if (value > 150000) {
      setMileageError('Maximum mileage is 150,000. For higher mileage, please call us.');
    } else {
      setMileageError('');
    }
  };

  const handleGetQuote = async () => {
    trackButtonClick('get_quote_hero');
    trackQuoteRequest();

    if (!regNumber.trim()) {
      toast({
        title: "Registration Required",
        description: "Please enter your vehicle registration number",
        variant: "destructive",
      });
      return;
    }

    if (!mileage.trim()) {
      toast({
        title: "Mileage required",
        description: "Please enter or slide to select your vehicle's mileage.",
        variant: "destructive",
      });
      return;
    }

    const mileageNum = parseInt(mileage, 10);
    if (mileageNum > 150000) {
      toast({
        title: "Mileage Too High",
        description: "Maximum mileage is 150,000. For higher mileage vehicles, please call us on 0330 229 5040.",
        variant: "destructive",
      });
      return;
    }

    setIsLookingUp(true);
    setVehicleAgeError('');

    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registration: regNumber }
      });

      if (error) {
        console.error('DVLA lookup error:', error);
        const vehicleData: VehicleData = {
          regNumber: regNumber.toUpperCase(),
          mileage: mileage,
        };
        onRegistrationSubmit(vehicleData);
        return;
      }

      if (!data || !data.make) {
        const vehicleData: VehicleData = {
          regNumber: regNumber.toUpperCase(),
          mileage: mileage,
        };
        onRegistrationSubmit(vehicleData);
        return;
      }

      const currentYear = new Date().getFullYear();
      const vehicleYear = parseInt(data.yearOfManufacture || data.year || '0', 10);
      const vehicleAge = currentYear - vehicleYear;

      if (vehicleAge > 15) {
        setVehicleAgeError(`Sorry, we can only cover vehicles up to 15 years old. Your vehicle is ${vehicleAge} years old.`);
        setIsLookingUp(false);
        return;
      }

      const vehicleData: VehicleData = {
        regNumber: regNumber.toUpperCase(),
        mileage: mileage,
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
      console.error('Error looking up vehicle:', error);
      const vehicleData: VehicleData = {
        regNumber: regNumber.toUpperCase(),
        mileage: mileage,
      };
      onRegistrationSubmit(vehicleData);
    } finally {
      setIsLookingUp(false);
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
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight">
                We{"'"}ve got you covered <span className="text-brand-orange">in 60 seconds!</span>
              </h2>
            </div>

            {/* Benefits */}
            <div className="mb-6 text-gray-700 text-sm md:text-base space-y-2">
              <div className="flex items-center">
                <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                <span className="font-medium">From just 80p a day • Easy claims • Fast payouts</span>
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

              {/* Mileage Options */}
              <div className="space-y-2">
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
                    className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:outline-none ${
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
                  className={`w-full px-12 h-[66px] text-xl font-bold rounded-lg transition-all ${
                    isLookingUp
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-brand-orange hover:bg-brand-orange/90 text-white animate-cta-enhanced'
                  }`}
                  disabled={isLookingUp}
                >
                  {isLookingUp ? 'Looking up vehicle...' : (
                    <>
                      Get my instant quote
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
                  className="h-auto w-40 object-contain"
                  priority={false}
                  width={320}
                  height={100}
                />
              </a>
            </div>
            
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
