import React, { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';
import { trackButtonClick, trackQuoteRequest } from '@/utils/analytics';
import MileageQuickSelect from './MileageQuickSelect';

interface QuoteFormInlineProps {
  vehicleType?: string; // 'car' | 'van' | 'motorcycle'
  className?: string;
}

const QuoteFormInline: React.FC<QuoteFormInlineProps> = ({ 
  vehicleType = 'car',
  className = '' 
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [mileageError, setMileageError] = useState('');
  const [vehicleAgeError, setVehicleAgeError] = useState('');

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
      if (vehicleAgeError) setVehicleAgeError('');
    }
  };

  const handleMileageSelection = (selection: string) => {
    setMileageSelection(selection);
    if (selection === 'under120k') {
      setMileage('100000');
      setMileageError('');
    } else if (selection === 'over120k') {
      setMileage('130000');
      setMileageError('');
    }
  };

  const handleGetQuote = async (mileageOverride?: string) => {
    const effectiveMileage = mileageOverride || mileage;
    const effectiveMileageSelection = mileageOverride ? (mileageOverride === '100000' ? 'under120k' : 'over120k') : mileageSelection;

    trackButtonClick(`get_quote_${vehicleType}_landing`);

    if (!regNumber.trim()) {
      toast({ title: "Registration Required", description: "Please enter your vehicle registration number.", variant: "destructive" });
      return;
    }

    if (!effectiveMileageSelection) {
      toast({ title: "Mileage Required", description: "Please select your approximate mileage to continue.", variant: "destructive" });
      return;
    }

    const numericMileage = parseInt(effectiveMileage.replace(/,/g, ''));
    if (numericMileage > 150000) {
      setMileageError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
      return;
    }

    setIsLookingUp(true);

    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber }
      });

      if (error) throw error;

      // Age checks
      if (!data?.found && data?.error && data.error.includes('15 years')) {
        toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" });
        setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
        setIsLookingUp(false);
        return;
      }

      if (data?.found && !data.yearOfManufacture) {
        toast({ title: "Vehicle Not Eligible", description: "We cannot verify the age of this vehicle. Please contact support for assistance.", variant: "destructive" });
        setVehicleAgeError('Cannot verify vehicle age');
        setIsLookingUp(false);
        return;
      }

      if (data?.found) {
        const now = new Date();
        let vehicleAgePrecise: number | null = null;

        if (data.manufactureDate) {
          const manufactureDate = new Date(data.manufactureDate);
          if (!isNaN(manufactureDate.getTime())) {
            const ageInMs = now.getTime() - manufactureDate.getTime();
            vehicleAgePrecise = ageInMs / (365.25 * 24 * 60 * 60 * 1000);
            if (vehicleAgePrecise > 15) {
              setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
              toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" });
              setIsLookingUp(false);
              return;
            }
          }
        }

        if (vehicleAgePrecise === null && data.yearOfManufacture) {
          const vehicleAge = now.getFullYear() - parseInt(data.yearOfManufacture);
          if (vehicleAge > 15) {
            setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
            toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" });
            setIsLookingUp(false);
            return;
          }
        }

        setVehicleAgeError('');
      }

      const vehicleData: any = {
        regNumber,
        mileage: effectiveMileage.replace(/,/g, ''),
        vehicleType: data?.found ? (data.vehicleType || vehicleType) : vehicleType,
      };

      if (data?.found) {
        vehicleData.make = data.make;
        vehicleData.model = data.model;
        vehicleData.fuelType = data.fuelType;
        vehicleData.transmission = data.transmission;
        vehicleData.year = data.yearOfManufacture;
        vehicleData.manufactureDate = data.manufactureDate;
        if (data.blocked) {
          vehicleData.blocked = true;
          vehicleData.blockReason = data.blockReason;
        }
      }

      trackQuoteRequest(undefined, undefined, undefined);

      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');

      // Store landing page referrer so back button returns here (only for non-homepage)
      if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      }
      navigate('/?step=2');
    } catch (err) {
      console.error('Vehicle lookup error:', err);
      toast({ title: "Lookup Failed", description: "Unable to find vehicle details, but you can still continue to get your quote.", variant: "destructive" });

      const vehicleData = {
        regNumber,
        mileage: effectiveMileage.replace(/,/g, ''),
        vehicleType,
      };

      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');

      if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      }
      navigate('/?step=2');
    } finally {
      setIsLookingUp(false);
    }
  };

  const eligibilityError = mileageError || vehicleAgeError;

  return (
    <div className={`space-y-2 sm:space-y-3 w-full max-w-lg mx-auto lg:mx-0 ${className}`}>
      {/* Yellow Plate Reg Input */}
      <div className="relative">
        <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black w-full">
          <div className="bg-blue-600 text-white font-bold px-2 sm:px-3 md:px-4 py-2 sm:py-4 flex items-center justify-center min-w-[45px] sm:min-w-[70px] md:min-w-[80px] h-[48px] sm:h-[60px] md:h-[66px]">
            <div className="flex flex-col items-center">
              <div className="text-xs sm:text-base md:text-lg leading-tight mb-1">🇬🇧</div>
              <div className="text-xs sm:text-sm md:text-base font-bold leading-none">UK</div>
            </div>
          </div>
          <input
            type="text"
            value={regNumber}
            onChange={handleRegChange}
            placeholder="ENTER REG"
            className="bg-yellow-400 border-none outline-none text-lg sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/70 px-2 sm:px-3 md:px-4 py-2 sm:py-4 uppercase tracking-wider h-[48px] sm:h-[60px] md:h-[66px] min-w-0"
            maxLength={8}
          />
        </div>
        {regNumber.replace(/\s/g, '').length >= 5 && (
          <span className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md z-10">
            <Check className="w-4 h-4 text-white" strokeWidth={3} />
          </span>
        )}
      </div>

      {/* Guidance text */}
      {mileageSelection && regNumber.replace(/\s/g, '').length < 5 ? (
        <p className="text-sm text-red-500 font-semibold text-left animate-fade-in">
          ☝️ Enter your registration above to continue
        </p>
      ) : regNumber.replace(/\s/g, '').length >= 5 && !mileageSelection ? (
        <p className="text-sm text-brand-orange font-semibold text-left animate-fade-in">
          👇 Now select your mileage below
        </p>
      ) : null}

      {/* Mileage Quick Select */}
      <MileageQuickSelect
        value={mileageSelection}
        onChange={handleMileageSelection}
        onAutoSubmit={handleGetQuote}
        error={eligibilityError}
        isLoading={isLookingUp}
        isRegValid={regNumber.replace(/\s/g, '').length >= 5}
      />
    </div>
  );
};

export default QuoteFormInline;
