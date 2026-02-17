import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';
import { Check, Phone, Mail, Shield, Award, Clock, Wrench, BadgeCheck, Car, Sliders, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { OptimizedImage } from '@/components/OptimizedImage';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import pandaMechanicImage from '@/assets/panda-mechanic-car.png';

interface VehicleData {
  registration: string;
  make: string;
  model: string;
  year: string;
  fuel: string;
  color: string;
  mileage: string;
}

interface HomepageAltProps {
  onRegistrationSubmit: (data: VehicleData) => void;
}

const HomepageAlt: React.FC<HomepageAltProps> = ({ onRegistrationSubmit }) => {
  const [registration, setRegistration] = useState('');
  const [mileage, setMileage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mileageError, setMileageError] = useState('');
  const [showCallbackModal, setShowCallbackModal] = useState(false);

  const formatRegNumber = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleaned;
  };

  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRegNumber(e.target.value);
    setRegistration(formatted);
  };

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, '');
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = parseInt(value) || 0;
      if (numValue > 150000) {
        setMileageError('Maximum mileage is 150,000');
      } else {
        setMileageError('');
      }
      setMileage(value);
    }
  };

  const handleSliderChange = (value: number[]) => {
    setMileage(value[0].toString());
    if (value[0] > 150000) {
      setMileageError('Maximum mileage is 150,000');
    } else {
      setMileageError('');
    }
  };

  const handleGetQuote = async () => {
    if (!registration) {
      toast.error('Registration required', {
        description: 'Please enter your vehicle registration number.',
      });
      return;
    }

    if (!mileage) {
      toast.error('Mileage required', {
        description: 'Please enter or slide to select your vehicle\'s mileage.',
      });
      return;
    }

    const mileageNum = parseInt(mileage);
    if (mileageNum > 150000) {
      toast.error('Mileage too high', {
        description: 'Maximum mileage is 150,000 miles.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registration }
      });

      if (error) throw error;

      if (data?.error) {
        toast.error('Vehicle not found', {
          description: 'We couldn\'t find your vehicle. Please check the registration and try again.',
        });
        setIsLoading(false);
        return;
      }

      const vehicleYear = parseInt(data.yearOfManufacture);
      const currentYear = new Date().getFullYear();
      const vehicleAge = currentYear - vehicleYear;

      if (vehicleAge > 15) {
        toast.error('Vehicle too old', {
          description: 'Sorry, we can only provide cover for vehicles up to 15 years old.',
        });
        setIsLoading(false);
        return;
      }

      const vehicleData: VehicleData = {
        registration: registration,
        make: data.make || '',
        model: data.model || '',
        year: data.yearOfManufacture || '',
        fuel: data.fuelType || '',
        color: data.colour || '',
        mileage: mileage,
      };

      onRegistrationSubmit(vehicleData);
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      
      const basicVehicleData: VehicleData = {
        registration: registration,
        make: '',
        model: '',
        year: '',
        fuel: '',
        color: '',
        mileage: mileage,
      };
      
      onRegistrationSubmit(basicVehicleData);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">

      {/* Hero Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Protect your vehicle from just{' '}
                  <span className="text-[#eb4b00]">80p a day</span>
                </h1>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Fast, affordable cover tailored to your car, van, or motorbike. Get comprehensive warranty protection with simple online quotes and flexible options.
                </p>
              </div>

              {/* Quote Form */}
              <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Vehicle Registration
                    </label>
                    <Input
                      type="text"
                      value={registration}
                      onChange={handleRegChange}
                      placeholder="e.g. AB12 CDE"
                      className="text-lg h-12"
                      maxLength={8}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Current Mileage
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={mileage ? parseInt(mileage).toLocaleString() : ''}
                      onChange={handleMileageChange}
                      placeholder="e.g. 50,000"
                      className="text-lg h-12"
                    />
                    {mileageError && (
                      <p className="text-sm text-red-600 mt-1">{mileageError}</p>
                    )}
                    <div className="mt-4">
                      <Slider
                        value={[parseInt(mileage) || 0]}
                        onValueChange={handleSliderChange}
                        max={150000}
                        step={1000}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>0</span>
                        <span>150,000</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleGetQuote}
                  disabled={isLoading}
                  className="w-full h-14 text-lg bg-brand-orange hover:bg-brand-orange/90 text-white animate-cta-enhanced"
                >
                  {isLoading ? 'Loading...' : 'Get my instant quote ➜'}
                </Button>

                <p className="text-xs text-center text-gray-500">
                  Available for vehicles under 15 years old with less than 150,000 miles
                </p>
              </div>

              {/* Key Benefits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Easy claims</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Fast payouts</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Unlimited claims</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">0% APR</span>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="relative hidden lg:block">
              <div className="relative flex items-center justify-center">
                <OptimizedImage 
                  src={pandaMechanicImage}
                  alt="Friendly mechanic panda with car and tools - Buy A Warranty UK comprehensive vehicle warranty cover"
                  className="w-full max-w-[350px] h-auto object-contain"
                  priority={true}
                  width={350}
                  height={280}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Contact Panel — desktop only, above the fold */}
      <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 mb-10">
        <div className="bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-8 py-5 text-center">
          <p className="text-[17px] font-bold text-[#1B2A4A]">
            Fair price. Fast quote. No surprises.
          </p>
          <p className="text-[15px] text-gray-600 mt-1">
            <Phone className="inline w-4 h-4 mr-1 text-gray-500 -mt-0.5" />
            Speak to an expert:{' '}
            <a href="tel:03302295040" className="font-semibold text-gray-900 hover:underline">
              0330 229 5040
            </a>
            <span className="mx-2 text-gray-400">or</span>
            <button
              onClick={() => setShowCallbackModal(true)}
              className="text-brand-orange hover:underline font-medium"
            >
              Request a callback
            </button>
          </p>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4">
              Why choose our warranty cover?
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Comprehensive protection designed for your peace of mind
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-[#eb4b00]/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-[#eb4b00]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Comprehensive Cover</h3>
              <p className="text-gray-600">
                Protection for over 1,400 mechanical and electrical parts from unexpected breakdowns
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-[#eb4b00]/10 rounded-xl flex items-center justify-center mb-6">
                <Wrench className="w-7 h-7 text-[#eb4b00]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Choose Your Garage</h3>
              <p className="text-gray-600">
                Get your vehicle repaired at any VAT-registered UK garage or dealer of your choice
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-[#eb4b00]/10 rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-7 h-7 text-[#eb4b00]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Instant Cover</h3>
              <p className="text-gray-600">
                Your warranty starts immediately with no waiting period or cooling-off restrictions
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-[#eb4b00]/10 rounded-xl flex items-center justify-center mb-6">
                <BadgeCheck className="w-7 h-7 text-[#eb4b00]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Unlimited Claims</h3>
              <p className="text-gray-600">
                Make as many claims as needed during your warranty period with no hidden limits
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-[#eb4b00]/10 rounded-xl flex items-center justify-center mb-6">
                <Award className="w-7 h-7 text-[#eb4b00]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Expert Support</h3>
              <p className="text-gray-600">
                Our team of warranty experts are here to help with any questions or claims
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-[#eb4b00]/10 rounded-xl flex items-center justify-center mb-6">
                <Phone className="w-7 h-7 text-[#eb4b00]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">24/7 Breakdown</h3>
              <p className="text-gray-600">
                Round-the-clock breakdown assistance to get you back on the road quickly
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How Your Price Is Calculated Section */}
      <section className="py-12 md:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-10 space-y-8">
            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Shield className="w-6 h-6 text-brand-green flex-shrink-0" />
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  How Your Price Is Calculated
                </h2>
              </div>
              <p className="text-gray-600 text-base sm:text-lg">
                Fair, transparent pricing. No hidden fees. No surprises.
              </p>
            </div>

            {/* Quote factors */}
            <div className="space-y-3">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                Your quote is personalised using:
              </h3>
              <ul className="space-y-3">
                {[
                  "Your vehicle's age and mileage",
                  "The cover level you choose",
                  "Your claim limit",
                  "Your labour rate",
                  "Your chosen excess",
                  "How far (and how often) you drive",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* You're in Control */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-5 sm:p-6 space-y-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-green" />
                <h4 className="text-lg font-bold text-gray-900">You're in Control</h4>
              </div>
              <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
                Set your cover, excess and limits to get a price that suits you.
                <br />
                <strong>No pressure. No sales calls. Just options tailored to your car.</strong>
              </p>
            </div>

            {/* CTA */}
            <div className="pt-2 text-center">
              <p className="text-gray-900 font-semibold text-base sm:text-lg mb-4">
                Ready to build your perfect warranty?
              </p>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center justify-center gap-2 bg-brand-orange text-white font-bold px-8 py-4 text-lg rounded-lg animate-breathing w-full sm:w-auto"
              >
                See My Final Price
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#284185]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Need help? Our team of warranty experts are here to help.
          </h3>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <a 
              href="tel:03302295040" 
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-medium text-lg"
            >
              <Phone size={20} />
              Call us: 0330 229 5040
            </a>
            
            <a 
              href="mailto:support@buyawarranty.co.uk" 
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-medium text-lg"
            >
              <Mail size={20} />
              Email us: support@buyawarranty.co.uk
            </a>

            <a 
              href="https://wa.me/message/SPQPJ6O3UBF5B1" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-medium text-lg"
            >
              <Phone size={20} />
              WhatsApp Us
            </a>
          </div>
        </div>
      </section>
      <RequestCallbackModal 
        isOpen={showCallbackModal} 
        onClose={() => setShowCallbackModal(false)} 
      />
    </div>
  );
};

export default HomepageAlt;
