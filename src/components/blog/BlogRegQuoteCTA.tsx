import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { trackButtonClick } from '@/utils/analytics';
import MileageQuickSelect from '@/components/MileageQuickSelect';

interface BlogRegQuoteCTAProps {
  heading?: string;
  subheading?: string;
  /** Compact variant for mid-article placement */
  compact?: boolean;
}

const saveWithTimestamp = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    localStorage.setItem(`${key}_timestamp`, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
};

/**
 * Reg-only quote CTA for blog articles. Mirrors the homepage journey:
 * enter reg → mileage comes from the latest MOT reading → continue at step 2.
 */
const BlogRegQuoteCTA: React.FC<BlogRegQuoteCTAProps> = ({
  heading = 'Check your price in 60 seconds',
  subheading = 'Enter your reg and we’ll do the rest — no obligation, instant price.',
  compact = false,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [regNumber, setRegNumber] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [mileage, setMileage] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleAgeError, setVehicleAgeError] = useState('');

  const formatRegNumber = (v: string) => {
    const f = v.replace(/\s/g, '').toUpperCase();
    return f.length > 3 ? `${f.slice(0, -3)} ${f.slice(-3)}` : f;
  };

  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = formatRegNumber(e.target.value);
    if (f.length <= 8) setRegNumber(f);
    setVehicleAgeError('');
  };

  const handleMileageSelection = (s: string) => {
    setMileageSelection(s);
    setMileage(s === 'under120k' ? '100000' : '130000');
  };

  const handleGetQuote = async (mileageOverride?: string) => {
    const effectiveMileage = String(mileageOverride || mileage).replace(/[^0-9]/g, '');
    trackButtonClick('blog_article_get_quote', { source: 'blog_reg_cta' });
    if (!regNumber.trim()) {
      toast({
        title: 'Registration Required',
        description: 'Please enter your vehicle registration number.',
        variant: 'destructive',
      });
      return;
    }
    if (!effectiveMileage) return;
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber },
      });
      if (error) throw error;
      if (data?.found && data.manufactureDate) {
        const age =
          (Date.now() - new Date(data.manufactureDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age > 15) {
          setVehicleAgeError(
            'Sorry, we only cover vehicles under 150,000 miles and less than 15 years old',
          );
          setIsLookingUp(false);
          return;
        }
      }
      const vehicleData = data?.found
        ? {
            regNumber,
            mileage: effectiveMileage,
            make: data.make,
            model: data.model,
            fuelType: data.fuelType,
            transmission: data.transmission,
            year: data.yearOfManufacture,
            vehicleType: 'car',
            manufactureDate: data.manufactureDate,
          }
        : { regNumber, mileage: effectiveMileage, vehicleType: 'car' };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } catch {
      const vd = { regNumber, mileage: effectiveMileage, vehicleType: 'car' };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vd));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vd));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <section
      aria-label="Get a warranty quote"
      className={`not-prose rounded-2xl border border-slate-200 bg-slate-50 shadow-sm ${
        compact ? 'p-4 sm:p-6' : 'p-5 sm:p-8'
      }`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1 text-center lg:text-left">
          <h2
            className={`font-bold text-[#001F3F] ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}
          >
            {heading}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">{subheading}</p>
          <ul className="mt-4 space-y-2 text-left text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              <span>Cover for cars, vans, SUVs and motorbikes</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              <span>Mileage read from your latest MOT — nothing to look up</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              <span>Parts and labour, fast payouts, easy claims</span>
            </li>
          </ul>
        </div>

        <div className="w-full space-y-4 lg:max-w-sm">
          <div className="flex items-stretch overflow-hidden rounded-lg border-2 border-black shadow-lg">
            <div className="flex min-w-[56px] items-center justify-center bg-blue-600 px-3 py-3 font-bold text-white sm:min-w-[72px] sm:px-4">
              <div className="flex flex-col items-center">
                <div className="mb-0.5 text-base leading-tight sm:text-lg">🇬🇧</div>
                <div className="text-[10px] font-bold leading-none sm:text-xs">UK</div>
              </div>
            </div>
            <label htmlFor="blog-reg-input" className="sr-only">
              Vehicle registration
            </label>
            <input
              id="blog-reg-input"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={regNumber}
              onChange={handleRegChange}
              placeholder="ENTER REG"
              className="min-w-0 flex-1 border-none bg-yellow-400 px-3 py-3 text-xl font-black uppercase tracking-wider text-black outline-none placeholder:text-black/60 sm:px-4 sm:text-2xl md:text-3xl"
              maxLength={8}
            />
          </div>

          <MileageQuickSelect
            regNumber={regNumber}
            value={mileageSelection}
            onChange={handleMileageSelection}
            onAutoSubmit={handleGetQuote}
            error={vehicleAgeError}
            isLoading={isLookingUp}
            isRegValid={regNumber.replace(/\s/g, '').length >= 5}
          />
        </div>
      </div>
    </section>
  );
};

export default BlogRegQuoteCTA;
