import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Car, Truck, Battery, Bike, ArrowRight } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import MileageQuickSelect from './MileageQuickSelect';
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
  const [mileageSelection, setMileageSelection] = useState<string>(''); // 'under120k' or 'over120k'
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

  const handleGetQuote = async (mileageOverride?: string) => {
    // Use the override mileage if provided (from auto-submit), otherwise use state
    const effectiveMileage = mileageOverride || mileage;
    const effectiveMileageSelection = mileageOverride ? (mileageOverride === '100000' ? 'under120k' : 'over120k') : mileageSelection;
    
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

    if (!effectiveMileageSelection) {
      toast({
        title: "Mileage Required",
        description: "Please select your approximate mileage to continue.",
        variant: "destructive",
      });
      return;
    }

    const mileageNum = parseInt(effectiveMileage, 10);
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
          mileage: effectiveMileage,
        };
        onRegistrationSubmit(vehicleData);
        return;
      }

      if (!data || !data.make) {
        const vehicleData: VehicleData = {
          regNumber: regNumber.toUpperCase(),
          mileage: effectiveMileage,
        };
        onRegistrationSubmit(vehicleData);
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

      const vehicleData: VehicleData = {
        regNumber: regNumber.toUpperCase(),
        mileage: effectiveMileage,
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
        mileage: effectiveMileage,
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

              {/* Mileage Quick Select */}
              <MileageQuickSelect
                value={mileageSelection}
                onChange={handleMileageSelection}
                onAutoSubmit={handleGetQuote}
                error={mileageError || vehicleAgeError}
                isLoading={isLookingUp}
                isRegValid={regNumber.replace(/\s/g, '').length >= 5}
              />
            </div>
          </div>
          {/* Right Content - Hero Image */}
          <div className="relative">
            <OptimizedImage 
              src="/extended_warranty_uk-car-trustworthy-reviews.png" 
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
