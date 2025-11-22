import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Star, Shield, Phone, Menu, Award, MessageCircle, Car, Truck, Battery, Bike } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { ReviewSchema } from '@/components/schema/ReviewSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import WebsiteFooter from '@/components/WebsiteFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick, trackQuoteRequest } from '@/utils/analytics';
import phoneCarImg from '@/assets/car-warranty-phone-car.png';
import pandaVehiclesImg from '@/assets/car-warranty-panda-vehicles.png';
import pandaEvImg from '@/assets/car-warranty-panda-ev.png';
import alfaRomeoLogo from '@/assets/logos/alfa-romeo.webp';
import bmwLogo from '@/assets/logos/bmw.webp';
import daciaLogo from '@/assets/logos/dacia.png';
import nissanLogo from '@/assets/logos/nissan.png';
import renaultLogo from '@/assets/logos/renault.png';
import seatLogo from '@/assets/logos/seat.webp';
import skodaLogo from '@/assets/logos/skoda.webp';
import ssangyongLogo from '@/assets/logos/ssangyong.png';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MileageSlider from '@/components/MileageSlider';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';

const CarExtendedWarranty: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Quote form state
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [sliderMileage, setSliderMileage] = useState(0);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [mileageError, setMileageError] = useState('');
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [mileagePlaceholder, setMileagePlaceholder] = useState(isMobile ? 'Enter mileage' : 'Enter current approximate mileage');

  const navigateToQuoteForm = () => {
    trackButtonClick('car_extended_warranty_get_quote');
    const element = document.getElementById('quote-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

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
    
    const numericValue = parseInt(value.replace(/,/g, ''));
    if (!isNaN(numericValue)) {
      setSliderMileage(numericValue);
    }
    
    if (value && numericValue > 150000) {
      setMileageError('We can only cover vehicles up to 150,000 miles');
    } else {
      setMileageError('');
    }
  };

  const handleMileageFocus = () => {
    setMileage('');
    setSliderMileage(0);
    setMileagePlaceholder(isMobile ? 'e.g. 32,000' : 'Enter mileage (e.g. 32,000)');
  };

  const handleMileageBlur = () => {
    if (!mileage || mileage === '0') {
      setMileagePlaceholder(isMobile ? 'Enter mileage' : 'Enter current approximate mileage');
    }
  };

  const handleSliderChange = (value: number) => {
    setSliderMileage(value);
    setMileage(value.toLocaleString());
    
    if (value > 150000) {
      setMileageError('We can only cover vehicles up to 150,000 miles');
    } else {
      setMileageError('');
    }
  };

  const handleGetQuote = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    trackButtonClick('get_quote_car_extended');
    
    if (!regNumber.trim()) {
      toast.error('Registration Required', {
        description: 'Please enter your vehicle registration number.',
      });
      return;
    }
    
    if (!mileage.trim()) {
      toast.error('Mileage Required', {
        description: "Please enter your vehicle's mileage to continue.",
      });
      return;
    }
    
    const numericMileage = parseInt(mileage.replace(/,/g, ''));
    if (numericMileage === 0) {
      toast.error('Mileage Required', {
        description: 'Please select a mileage greater than 0 to get your quote.',
      });
      return;
    }
    
    if (numericMileage > 150000) {
      setMileageError('We can only cover vehicles up to 150,000 miles');
      return;
    }
    
    setIsLookingUp(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber }
      });

      if (error) {
        console.error('DVSA lookup error:', error);
        throw error;
      }
      
      if (!data?.found && data?.error && data.error.includes('15 years')) {
        toast.error('Vehicle Not Eligible', {
          description: 'We cannot offer warranties for vehicles over 15 years of age.',
        });
        setVehicleAgeError('We cannot offer warranties for vehicles over 15 years old');
        setIsLookingUp(false);
        return;
      }
      
      if (data?.found && !data.yearOfManufacture) {
        toast.error('Vehicle Not Eligible', {
          description: 'We cannot verify the age of this vehicle. Please contact support for assistance.',
        });
        setVehicleAgeError('Cannot verify vehicle age');
        setIsLookingUp(false);
        return;
      }
      
      if (data?.found && data.yearOfManufacture) {
        const currentYear = new Date().getFullYear();
        const vehicleYear = parseInt(data.yearOfManufacture);
        const vehicleAge = currentYear - vehicleYear;
        
        if (vehicleAge > 15) {
          setVehicleAgeError('We cannot offer warranties for vehicles over 15 years old');
          toast.error('Vehicle Not Eligible', {
            description: 'We cannot offer warranties for vehicles over 15 years of age.',
          });
          setIsLookingUp(false);
          return;
        } else {
          setVehicleAgeError('');
        }
      }
      
      const vehicleData = {
        regNumber: regNumber,
        mileage: mileage.replace(/,/g, ''),
        make: data?.found ? data.make : undefined,
        model: data?.found ? data.model : undefined,
        fuelType: data?.found ? data.fuelType : undefined,
        transmission: data?.found ? data.transmission : undefined,
        year: data?.found ? data.yearOfManufacture : undefined,
        vehicleType: data?.found ? (data.vehicleType || 'car') : undefined,
        blocked: data?.blocked || false,
        blockReason: data?.blockReason || '',
      };
      
      trackQuoteRequest();
      
      // Store in localStorage for the homepage to pick up
      localStorage.setItem('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      localStorage.setItem('buyawarranty_formData', JSON.stringify(vehicleData));
      localStorage.setItem('buyawarranty_currentStep', '2');
      
      // Navigate to homepage step 2
      navigate('/?step=2');
      
    } catch (error: any) {
      console.error('Error looking up vehicle:', error);
      
      toast.error('Lookup Failed', {
        description: 'Unable to find vehicle details, but you can still continue to get your quote.',
      });
      
      const vehicleData = {
        regNumber: regNumber,
        mileage: mileage.replace(/,/g, ''),
      };
      
      localStorage.setItem('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      localStorage.setItem('buyawarranty_formData', JSON.stringify(vehicleData));
      localStorage.setItem('buyawarranty_currentStep', '2');
      
      navigate('/?step=2');
    } finally {
      setIsLookingUp(false);
    }
  };

  const customFAQs = [
    {
      question: "What exactly is covered by our platinum major mechanical and electrical plan?",
      answer: "It includes critical, major and minor components such as the engine, gearbox, differential, electricals and fuel system - parts most likely to cause high repair bills. See full details at https://buyawarranty.co.uk/what-is-covered/"
    },
    {
      question: "Can I use my preferred garage for repairs?",
      answer: "You can use your own garage, including main dealers or local independents, as long as they're VAT registered. If the repair cost goes over your claim limit, you may need to pay the difference (top up the extra amount)."
    },
    {
      question: "How do I make a claim?",
      answer: "Arrange for your vehicle to be inspected by a local independent repair garage to diagnose any issues. Once diagnosed, before any repairs are conducted, the repairer must directly contact our Claims Team at 0330 229 5045. It's important to note that failure to do so will not allow us to process your claim."
    },
    {
      question: "Are electric or hybrid vehicles covered?",
      answer: "Yes, our plans include coverage for EVs and hybrids, including electric drive components and battery management systems."
    },
    {
      question: "Is wear and tear included?",
      answer: "General wear and tear (like tyres or brake pads) isn't covered, but sudden mechanical or electrical failures are."
    },
    {
      question: "How fast are claims approved?",
      answer: "Most claims are authorised within hours, and we pay garages directly once the repair is complete."
    },
    {
      question: "Can I transfer my warranty if I sell my car?",
      answer: "Absolutely. You can transfer your policy to the new owner for a small fee - adding resale value to your vehicle."
    },
    {
      question: "What are my rights under UK law?",
      answer: "All our customers are protected under UK consumer legislation and oversight for a fair, transparent service."
    },
    {
      question: "Can I cancel my warranty?",
      answer: "You have 14 days to cancel your warranty for a full refund (if no repairs have been made). After this period, our standard cancellation policy applies. Contact us at support@buyawarranty.co.uk or call 0330 229 5040."
    }
  ];

  return (
    <div className="min-h-screen">
      <SEOHead
        title="Car Extended Warranty UK | Used Car Cover from £19/mo"
        description="Protect your used or new car from costly repairs with affordable extended warranty cover in the UK. Instant quotes online. Prices start from just £19/month."
        keywords="car extended warranty UK, extended car warranty, used car warranty, car warranty cover, vehicle warranty UK, warranty protection"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/"
        ogTitle="Car Extended Warranty UK | Used Car Cover from £19/mo"
        ogDescription="Protect your used or new car from costly repairs with affordable extended warranty cover in the UK. Instant quotes online. Prices start from just £19/month."
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      <ReviewSchema />
      <WebPageSchema
        name="Car Extended Warranty UK - Buy A Warranty"
        description="Comprehensive extended car warranty coverage for used and new vehicles in the UK. Protect your car from unexpected repair costs with flexible plans starting from £19/month."
        url="https://buyawarranty.co.uk/car-extended-warranty/"
        specialty="Car Extended Warranty, Used Car Warranty, Vehicle Warranty Protection"
      />
      <FAQSchema faqs={customFAQs} />
      <ProductSchema
        name="Car Extended Warranty Plans"
        description="Comprehensive car warranty coverage protecting your vehicle from unexpected mechanical and electrical failures. Choose from multiple coverage levels to suit your needs."
        price="19.00"
        priceCurrency="GBP"
        brand="Buy A Warranty"
        category="Extended Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
      />
      <BreadcrumbSchema 
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" }
        ]} 
      />

      {/* Main content */}
      <main role="main" className="pb-20 sm:pb-0">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-50 via-white to-orange-50 py-8 sm:py-12 md:py-20" aria-label="Extended warranty introduction">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
            <div className="flex justify-end mb-3 sm:mb-4">
              <TrustpilotHeader />
            </div>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight px-2">
              Extended Car Warranty UK
            </h1>
            <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-primary px-2">
              Warranty that works when your car doesn't!
            </p>
            
            <p className="text-lg sm:text-xl text-gray-700 px-2">
              The Smart Way to Protect Your Car & Your Wallet
            </p>

            <p className="text-base sm:text-lg text-gray-600 leading-relaxed px-2">
              Every driver knows that moment - the dashboard light flickers on, the car makes an unusual sound, and your heart sinks. Repair bills in the UK are rising fast, with even small faults now costing hundreds of pounds. When the manufacturer's warranty expires, the financial risk shifts to you - and that's where a Car Extended Warranty from Buy A Warranty steps in.
            </p>

            <p className="text-base sm:text-lg text-gray-600 leading-relaxed px-2">
              We're here to keep you protected from unexpected repair costs, inflated garage fees, and the stress of uncertainty. Our plans are simple, transparent, and built to give you peace of mind every mile.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-3 sm:pt-4 px-2">
              <Button 
                size="lg"
                onClick={navigateToQuoteForm}
                className="bg-primary text-white hover:bg-primary/90 text-base sm:text-lg w-full sm:w-auto"
              >
                Get Your Free Quote <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => window.location.href = 'tel:03302295040'}
                className="border-primary text-primary hover:bg-primary hover:text-white text-base sm:text-lg w-full sm:w-auto"
              >
                <Phone className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Call 0330 229 5040
              </Button>
            </div>

            {/* Hero Quote Form - Matching Homepage Design */}
            <div id="quote-form" className="bg-white py-6 sm:py-8 lg:py-12 mt-6 sm:mt-8">
              <div className="w-full mx-auto px-4 sm:px-6 max-w-7xl">
                <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                  {/* Left Content */}
                  <div className="space-y-3 sm:space-y-4 flex flex-col justify-center w-full">
                    {/* Main Headline */}
                    <div className="space-y-2 mb-3 sm:mb-4">
                      <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 leading-tight">
                        We{"'"}ve got you covered <span className="text-brand-orange">in 60 seconds!</span>
                      </h2>
                    </div>

                    {/* Benefits */}
                    <div className="mb-4 sm:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-2">
                      <div className="flex items-center">
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                        <span className="font-medium">From just 80p a day • Easy claims • Fast payouts</span>
                      </div>
                      <div className="flex items-center">
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                        <span className="font-medium">Unlimited claims • Complete Cover • No excess</span>
                      </div>
                    </div>

                    {/* Registration Input Form */}
                    <form onSubmit={handleGetQuote} className="space-y-3 w-full max-w-full">
                      <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black w-full max-w-full">
                        {/* UK Section with flag */}
                        <div className="bg-blue-600 text-white font-bold px-2 sm:px-4 py-3 sm:py-4 flex items-center justify-center w-[60px] sm:w-[80px] flex-shrink-0 h-[54px] sm:h-[66px]">
                          <div className="flex flex-col items-center">
                            <div className="text-base sm:text-lg leading-tight mb-0.5 sm:mb-1">🇬🇧</div>
                            <div className="text-xs sm:text-base font-bold leading-none">UK</div>
                          </div>
                        </div>
                        {/* Registration Input */}
                        <input
                          type="text"
                          value={regNumber}
                          onChange={handleRegChange}
                          placeholder="ENTER REG"
                          className="bg-yellow-400 border-none outline-none text-lg sm:text-xl md:text-2xl lg:text-3xl text-black flex-1 font-black placeholder:text-black/70 px-2 sm:px-3 md:px-4 py-3 sm:py-4 uppercase tracking-wide sm:tracking-wider h-[54px] sm:h-[66px] min-w-0 w-full"
                          maxLength={8}
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-black text-left mt-0.5 px-1">
                        Protection for vehicles up to 150,000 miles and 15 years.
                      </p>

                      {/* Mileage Options */}
                      <div className="space-y-2 w-full">
                        <div className="w-full">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={mileage}
                            onChange={handleMileageChange}
                            onFocus={handleMileageFocus}
                            onBlur={handleMileageBlur}
                            placeholder={mileagePlaceholder}
                            className={`w-full max-w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-lg border-2 rounded-lg focus:outline-none ${
                              mileageError ? 'border-blue-400 focus:border-blue-500' : 'border-gray-300 focus:border-orange-500'
                            }`}
                          />
                        </div>

                        {/* Slider Option */}
                        <div className="w-full px-1">
                          <MileageSlider
                            value={sliderMileage}
                            onChange={handleSliderChange}
                            min={0}
                            max={150000}
                          />
                        </div>

                        {/* Error Messages */}
                        {mileageError && (
                          <p className="text-xs sm:text-sm text-blue-600 font-medium px-1">
                            {mileageError}
                          </p>
                        )}
                        {vehicleAgeError && (
                          <p className="text-xs sm:text-sm text-blue-600 font-medium px-1">
                            {vehicleAgeError}
                          </p>
                        )}
                      </div>

                      {/* Get Quote Button */}
                      <div className="space-y-2 mt-2 w-full">
                        <Button 
                          type="submit"
                          className={`w-full max-w-full px-4 sm:px-6 md:px-12 h-[54px] sm:h-[66px] text-base sm:text-lg md:text-xl font-bold rounded-lg transition-all ${
                            isLookingUp
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-brand-orange hover:bg-brand-orange/90 text-white animate-cta-enhanced'
                          }`}
                          disabled={isLookingUp}
                        >
                          {isLookingUp ? 'Looking up...' : (
                            <>
                              <span className="hidden sm:inline">Get my instant quote</span>
                              <span className="sm:hidden">Get quote</span>
                              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" strokeWidth={2.5} />
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>

                  {/* Right Content - Hero Image */}
                  <div className="relative hidden lg:block">
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
                          className="h-auto w-20 object-contain"
                          priority={false}
                          width={160}
                          height={50}
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

                  {/* Mobile Vehicle Types - Show below form on mobile */}
                  <div className="lg:hidden">
                    <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
                      <div className="flex items-center space-x-1">
                        <Car className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="font-medium text-gray-700 text-sm">Cars</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Truck className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="font-medium text-gray-700 text-sm">Vans</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Battery className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="font-medium text-gray-700 text-sm">EVs</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Bike className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="font-medium text-gray-700 text-sm">Motorcycles</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Is an Extended Car Warranty Section */}
      <article className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">What Is an Extended Car Warranty?</h2>
            
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              An extended car warranty is your safety net once your manufacturer's warranty ends. It's a service contract that covers the cost of repairing or replacing specific mechanical and electrical components that fail unexpectedly.
            </p>

            <p className="text-lg text-gray-700 leading-relaxed mb-8">
              Think of it as a continuation of protection - only this time, you're in control. Whether you drive a used car or a vehicle that's just out of its factory cover, an extended warranty ensures you're not left footing expensive repair bills on your own.
            </p>

            {/* Comparison Table */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="text-2xl font-bold mb-6 text-center">Manufacturer Warranty vs. Extended Warranty</h3>
              <div className="overflow-x-auto" role="table" aria-label="Comparison between manufacturer and extended warranty">
                <table className="w-full border-collapse border-2 border-gray-300">
                  <thead>
                    <tr className="bg-primary text-white">
                      <th scope="col" className="p-3 text-left border-2 border-gray-400">Feature</th>
                      <th scope="col" className="p-3 text-left border-2 border-gray-400">Manufacturer Warranty</th>
                      <th scope="col" className="p-3 text-left border-2 border-gray-400">Buy A Warranty (Extended)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b-2 border-gray-300">
                      <td className="p-3 font-medium border-2 border-gray-300">Duration</td>
                      <td className="p-3 border-2 border-gray-300">Typically 3 years / 60,000 miles</td>
                      <td className="p-3 border-2 border-gray-300">Flexible – choose your term up to 150,000 miles</td>
                    </tr>
                    <tr className="border-b-2 border-gray-300 bg-white">
                      <td className="p-3 font-medium border-2 border-gray-300">Coverage</td>
                      <td className="p-3 border-2 border-gray-300">New cars only</td>
                      <td className="p-3 border-2 border-gray-300">Used cars up to 15 years old & nearly-new cars</td>
                    </tr>
                    <tr className="border-b-2 border-gray-300">
                      <td className="p-3 font-medium border-2 border-gray-300">Provider</td>
                      <td className="p-3 border-2 border-gray-300">Manufacturer</td>
                      <td className="p-3 border-2 border-gray-300">Independent UK provider</td>
                    </tr>
                    <tr className="border-b-2 border-gray-300 bg-white">
                      <td className="p-3 font-medium border-2 border-gray-300">Garage Choice</td>
                      <td className="p-3 border-2 border-gray-300">Manufacturer network only</td>
                      <td className="p-3 border-2 border-gray-300">Wide network + your own choice of trusted garage</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium border-2 border-gray-300">Claim Process</td>
                      <td className="p-3 border-2 border-gray-300">Standard</td>
                      <td className="p-3 border-2 border-gray-300">Fast, online & handled directly</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-center text-lg font-semibold text-primary mt-6 italic">
                "When your manufacturer's warranty ends, our protection begins."
              </p>
            </div>
          </div>
        </div>
      </article>

      {/* Why It's a Smart Financial Move */}
      <article className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50" aria-labelledby="financial-benefits">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 id="financial-benefits" className="text-3xl md:text-4xl font-bold text-center mb-12">
              Why a Car Extended Warranty is a Smart Financial Move
            </h2>

            <div className="space-y-10">
              {/* Benefit 1 */}
              <div className="bg-white rounded-lg p-8 shadow-md">
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white rounded-full p-3 flex-shrink-0">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-4">1. Protection From Unexpected Repair Bills</h3>
                    <p className="text-gray-700 mb-4">When major components fail, the costs can be shocking:</p>
                    <ul className="space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                        <span>Gearbox repair: from £1,200+</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                        <span>Alternator replacement: around £600</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                        <span>Timing belt failure: £800–£1,000</span>
                      </li>
                    </ul>
                    <p className="text-gray-700 mb-4">
                      With Buy A Warranty, those costs can be covered, saving you from financial strain. We pay garages directly, so you're never left out of pocket waiting for reimbursement. You can also choose a repairer of your choice and claimback expenses once the garage has been verified.
                    </p>
                    <p className="text-lg font-semibold text-primary italic">
                      Expect performance, not problems. Our warranty keeps you covered, so you can enjoy the ride.
                    </p>
                  </div>
                </div>
              </div>

              {/* Benefit 2 */}
              <div className="bg-white rounded-lg p-8 shadow-md">
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white rounded-full p-3 flex-shrink-0">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-4">2. Predictable Costs & Peace of Mind</h3>
                    <p className="text-gray-700 mb-4">
                      Our fixed monthly or annual premiums make it easy to plan your motoring budget. You'll know exactly what you're paying - and exactly what's covered with plans which include 0% APR.
                    </p>
                    <p className="text-gray-700 mb-4">
                      That means no shock repair invoices, no last-minute scrambles for cash, just financial stability and worry-free driving.
                    </p>
                    <p className="text-lg font-semibold text-primary italic">
                      Protect your car. Protect your wallet. It's that simple.
                    </p>
                  </div>
                </div>
              </div>

              {/* Benefit 3 */}
              <div className="bg-white rounded-lg p-8 shadow-md">
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white rounded-full p-3 flex-shrink-0">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-4">3. Access to Quality Garages Nationwide</h3>
                    <p className="text-gray-700 mb-4">
                      We partner with approved UK garages and professional repair centres to ensure your car is handled by qualified experts using genuine or approved parts.
                    </p>
                    <p className="text-gray-700 mb-4">
                      Prefer your local garage? No problem. You can choose your own repairer, and we'll handle authorisation and payment directly.
                    </p>
                    <p className="text-gray-700 font-semibold mb-2">Benefits include:</p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                        <span>Quick claim approval</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                        <span>Nationwide garage network</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                        <span>Genuine or OE approved parts (Original Equipment approved parts)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                        <span>No hidden costs</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* Coverage Types */}
      <section className="py-16 bg-white" aria-labelledby="coverage-types">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 id="coverage-types" className="text-3xl md:text-4xl font-bold text-center mb-8">
              Types of Car Extended Warranty Cover
            </h2>
            <p className="text-center text-lg text-gray-700 mb-12">
              We offer flexible levels of protection - because every driver and every car is different.
            </p>

            <div className="overflow-x-auto mb-8">
              <table className="w-full border-collapse bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-300">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="p-4 text-left border-2 border-gray-400">Coverage Level</th>
                    <th className="p-4 text-left border-2 border-gray-400">Duration</th>
                    <th className="p-4 text-left border-2 border-gray-400">Ideal For</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b-2 border-gray-300">
                    <td className="p-4 font-semibold border-2 border-gray-300">Platinum</td>
                    <td className="p-4">3 months & 6 months</td>
                    <td className="p-4">Short-term vehicle ownership, selling a car soon, or trying out or bought a new vehicle</td>
                  </tr>
                  <tr className="border-b bg-white">
                    <td className="p-4 font-semibold">Platinum</td>
                    <td className="p-4">1 year</td>
                    <td className="p-4">Everyday drivers seeking peace of mind for a full year</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 font-semibold">Platinum</td>
                    <td className="p-4">2 year</td>
                    <td className="p-4">Long-term owners looking to save on repairs and benefit from a £100 discount and additional free add-ons</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold">Platinum</td>
                    <td className="p-4">3 year</td>
                    <td className="p-4">Car owners planning to keep their vehicle long-term, with £200 savings and additional free add-ons</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-center text-gray-700">
              <strong>Tip:</strong> You can explore the exact covered parts on our{' '}
              <Link to="/what-is-covered/" className="text-primary underline hover:text-primary/80">
                What's Covered page
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Trustpilot Badge */}
      <div className="py-8 flex justify-end max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TrustpilotHeader />
      </div>

      {/* Eligibility Section */}
      <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50" aria-labelledby="eligibility">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 id="eligibility" className="text-3xl md:text-4xl font-bold text-center mb-8">
              Eligibility – Is Your Car Covered?
            </h2>
            
            <p className="text-lg text-gray-700 mb-6">
              Most UK cars qualify for our extended warranty. You'll typically be eligible if your vehicle:
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Is under 15 years old</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Has done less than 150,000 miles</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Has a valid full or part service history (preferably manufacturer or VAT-registered garage)</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Is roadworthy and not used for hire, racing, or commercial haulage</span>
              </div>
            </div>

            <div className="bg-primary text-white p-6 rounded-lg text-center mb-12">
              <p className="text-lg font-semibold mb-2">Check instantly:</p>
              <p>Enter your registration on our quote form - you'll know your eligibility in seconds.</p>
            </div>

            {/* Eligibility Table */}
            <div className="overflow-x-auto" role="table" aria-label="Vehicle eligibility criteria table">
              <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
                <thead>
                  <tr className="bg-gray-100">
                    <th scope="col" className="p-4 text-left font-bold">Vehicle Type</th>
                    <th scope="col" className="p-4 text-left font-bold">Eligibility Status</th>
                    <th scope="col" className="p-4 text-left font-bold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-4 border-2 border-gray-300">Standard petrol/diesel car</td>
                    <td className="p-4 text-green-600 font-semibold border-2 border-gray-300">✓ Eligible</td>
                    <td className="p-4 border-2 border-gray-300">Must be under 15 years old and less than 150,000 miles</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <td className="p-4 border-2 border-gray-300">Electric vehicle (EV)</td>
                    <td className="p-4 text-green-600 font-semibold border-2 border-gray-300">✓ Eligible</td>
                    <td className="p-4 border-2 border-gray-300">Must be under 15 years old and less than 150,000 miles</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300">
                    <td className="p-4 border-2 border-gray-300">Hybrid or Plug-in Hybrid (PHEV)</td>
                    <td className="p-4 text-green-600 font-semibold border-2 border-gray-300">✓ Eligible</td>
                    <td className="p-4 border-2 border-gray-300">Must be under 15 years old and less than 150,000 miles</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <td className="p-4 border-2 border-gray-300">Commercial vehicles under 3.5 tonnes</td>
                    <td className="p-4 text-green-600 font-semibold border-2 border-gray-300">✓ Eligible</td>
                    <td className="p-4 border-2 border-gray-300">Must be under 15 years old and less than 150,000 miles</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300">
                    <td className="p-4 border-2 border-gray-300">Motorcycles</td>
                    <td className="p-4 text-green-600 font-semibold border-2 border-gray-300">✓ Eligible</td>
                    <td className="p-4 border-2 border-gray-300">Must be under 15 years old and less than 150,000 miles</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <td className="p-4 border-2 border-gray-300">High-performance vehicles (e.g. BMW M, Audi RS, Mercedes-AMG)</td>
                    <td className="p-4 text-red-600 font-semibold border-2 border-gray-300">✗ Ineligible</td>
                    <td className="p-4 border-2 border-gray-300">Excluded due to specialist components and high repair costs</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300">
                    <td className="p-4 border-2 border-gray-300">Certain luxury vehicle models (e.g. Porsche, Maserati, Jaguar)</td>
                    <td className="p-4 text-red-600 font-semibold border-2 border-gray-300">✗ Ineligible</td>
                    <td className="p-4 border-2 border-gray-300">Excluded under standard plans; may be eligible for custom plans</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <td className="p-4 border-2 border-gray-300">Commercial vehicles over 3.5 tonnes</td>
                    <td className="p-4 text-red-600 font-semibold border-2 border-gray-300">✗ Ineligible</td>
                    <td className="p-4 border-2 border-gray-300">Not covered under standard warranty plans</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300">
                    <td className="p-4 border-2 border-gray-300">Modified vehicles</td>
                    <td className="p-4 text-red-600 font-semibold border-2 border-gray-300">✗ Ineligible</td>
                    <td className="p-4 border-2 border-gray-300">Excluded if modified from manufacturer specifications</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <td className="p-4 border-2 border-gray-300">Vehicles over 15 years old</td>
                    <td className="p-4 text-red-600 font-semibold border-2 border-gray-300">✗ Ineligible</td>
                    <td className="p-4 border-2 border-gray-300">Not eligible unless explicitly approved</td>
                  </tr>
                  <tr>
                    <td className="p-4 border-2 border-gray-300">Vehicles over 150,000 miles</td>
                    <td className="p-4 text-red-600 font-semibold border-2 border-gray-300">✗ Ineligible</td>
                    <td className="p-4 border-2 border-gray-300">Not eligible unless explicitly approved</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Manufacturers Covered */}
      <section className="py-16 bg-white" aria-labelledby="manufacturers-covered">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 id="manufacturers-covered" className="text-3xl md:text-4xl font-bold text-center mb-12">
              Manufacturers Covered Under Our Warranty Plans
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 text-center">
              {[
                { name: 'Alfa Romeo', logo: alfaRomeoLogo },
                { name: 'Audi', logo: 'https://logo.clearbit.com/audi.com', link: '/car-extended-warranty/audi/' },
                { name: 'BMW', logo: bmwLogo, link: '/car-extended-warranty/bmw/' },
                { name: 'Chevrolet', logo: 'https://logo.clearbit.com/chevrolet.com' },
                { name: 'Chrysler', logo: 'https://logo.clearbit.com/chrysler.com' },
                { name: 'Citroën', logo: 'https://logo.clearbit.com/citroen.com' },
                { name: 'Dacia', logo: daciaLogo },
                { name: 'Daewoo', logo: 'https://logo.clearbit.com/daewoo.com' },
                { name: 'Daihatsu', logo: 'https://logo.clearbit.com/daihatsu.com' },
                { name: 'Fiat', logo: 'https://logo.clearbit.com/fiat.com' },
                { name: 'Ford', logo: 'https://logo.clearbit.com/ford.com', link: '/car-extended-warranty/ford/' },
                { name: 'Honda', logo: 'https://logo.clearbit.com/honda.com' },
                { name: 'Hyundai', logo: 'https://logo.clearbit.com/hyundai.com', link: '/car-extended-warranty/hyundai/' },
                { name: 'Infiniti', logo: 'https://logo.clearbit.com/infiniti.com' },
                { name: 'Isuzu', logo: 'https://logo.clearbit.com/isuzu.com' },
                { name: 'Iveco', logo: 'https://logo.clearbit.com/iveco.com' },
                { name: 'Jaguar', logo: 'https://logo.clearbit.com/jaguar.com', link: '/car-extended-warranty/jaguar/' },
                { name: 'Jeep', logo: 'https://logo.clearbit.com/jeep.com' },
                { name: 'Kia', logo: 'https://logo.clearbit.com/kia.com' },
                { name: 'Land Rover', logo: 'https://logo.clearbit.com/landrover.com', link: '/car-extended-warranty/land-rover/' },
                { name: 'Lexus', logo: 'https://logo.clearbit.com/lexus.com' },
                { name: 'Mazda', logo: 'https://logo.clearbit.com/mazda.com' },
                { name: 'Mercedes-Benz', logo: 'https://logo.clearbit.com/mercedes-benz.com', link: '/car-extended-warranty/mercedes-benz/' },
                { name: 'MG', logo: 'https://logo.clearbit.com/mgmotor.eu' },
                { name: 'Mini', logo: 'https://logo.clearbit.com/mini.com' },
                { name: 'Mitsubishi', logo: 'https://logo.clearbit.com/mitsubishi-motors.com' },
                { name: 'Nissan', logo: nissanLogo, link: '/car-extended-warranty/nissan/' },
                { name: 'Peugeot', logo: 'https://logo.clearbit.com/peugeot.com' },
                { name: 'Renault', logo: renaultLogo },
                { name: 'SEAT', logo: seatLogo },
                { name: 'Škoda', logo: skodaLogo, link: '/car-extended-warranty/skoda/' },
                { name: 'Smart', logo: 'https://logo.clearbit.com/smart.com' },
                { name: 'SsangYong', logo: ssangyongLogo },
                { name: 'Subaru', logo: 'https://logo.clearbit.com/subaru.com' },
                { name: 'Suzuki', logo: 'https://logo.clearbit.com/suzuki.com' },
                { name: 'Tesla', logo: 'https://logo.clearbit.com/tesla.com' },
                { name: 'Toyota', logo: 'https://logo.clearbit.com/toyota.com' },
                { name: 'Volkswagen', logo: 'https://logo.clearbit.com/volkswagen.com', link: '/car-extended-warranty/volkswagen/' },
                { name: 'Volvo', logo: 'https://logo.clearbit.com/volvo.com' },
                { name: 'Yamaha', logo: 'https://logo.clearbit.com/yamaha-motor.com' }
              ].map((brand) => (
                brand.link ? (
                  <Link 
                    key={brand.name}
                    to={brand.link} 
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex flex-col items-center gap-3 cursor-pointer"
                  >
                    <img 
                      src={brand.logo} 
                      alt={`${brand.name} car warranty coverage - UK extended warranty available`} 
                      className="h-10 w-auto object-contain"
                      loading="lazy"
                      width="80"
                      height="40"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <p className="font-semibold text-gray-800">{brand.name}</p>
                  </Link>
                ) : (
                  <div key={brand.name} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex flex-col items-center gap-3">
                    <img 
                      src={brand.logo} 
                      alt={`${brand.name} car warranty coverage - UK extended warranty available`} 
                      className="h-10 w-auto object-contain"
                      loading="lazy"
                      width="80"
                      height="40"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <p className="font-semibold text-gray-800">{brand.name}</p>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trustpilot Badge */}
      <div className="py-8 flex justify-end max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TrustpilotHeader />
      </div>

      {/* How It Works */}
      <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50" aria-labelledby="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 id="how-it-works" className="text-3xl md:text-4xl font-bold text-center mb-12">
              How It Works: Simple, Fast, and Transparent
            </h2>
            <p className="text-center text-lg text-gray-700 mb-12">
              We've simplified the process - from quote to claim.
            </p>

            <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center mb-12">
              {/* Left - Steps */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">1</div>
                  <h3 className="font-bold text-lg mb-2">Get a Quote</h3>
                  <p className="text-gray-600">Enter your car registration to get an instant quote.</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">2</div>
                  <h3 className="font-bold text-lg mb-2">Choose Cover</h3>
                  <p className="text-gray-600">Choose your level of cover and payment plan.</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">3</div>
                  <h3 className="font-bold text-lg mb-2">Activate Policy</h3>
                  <p className="text-gray-600">Review and activate your policy instantly.</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">4</div>
                  <h3 className="font-bold text-lg mb-2">Drive Confident</h3>
                  <p className="text-gray-600">Enjoy complete peace of mind knowing you're covered.</p>
                </div>
              </div>

              {/* Right - Image */}
              <figure className="relative text-center order-1 lg:order-2">
                <img 
                  src={phoneCarImg} 
                  alt="Buy a Warranty mobile app showing instant car warranty quote with vehicle in background - get covered in 60 seconds" 
                  className="w-full h-auto max-w-sm md:max-w-lg mx-auto object-contain"
                  loading="lazy"
                  width="600"
                  height="400"
                />
              </figure>
            </div>

            {/* Making a Claim */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-2xl font-bold mb-6 text-center">Making a Claim Is Easy</h3>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-gray-700">Call us on <strong>0330 229 5045</strong> or complete the simple online claim form</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-gray-700">We'll authorise the repair with your chosen garage.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-gray-700">The garage completes the work.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-gray-700">We pay them directly.</p>
                </div>
              </div>
              <div className="text-center">
                <Link to="/make-a-claim/">
                  <Button className="bg-[#1e40af] text-white hover:bg-[#1e40af]/90">
                    Make a Claim
                  </Button>
                </Link>
              </div>
              <p className="text-center text-gray-600 mt-6 italic">
                No stress, no paperwork, no unexpected costs - just a smooth process from start to finish.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Buy A Warranty */}
      <section className="py-16 bg-white" aria-labelledby="why-choose-us">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 id="why-choose-us" className="text-3xl md:text-4xl font-bold text-center mb-12">
              Why Choose Buy A Warranty?
            </h2>

            <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center">
              {/* Left - Content */}
              <div className="space-y-6">
                <div className="flex items-start gap-4 bg-gray-50 p-6 rounded-lg">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold mb-2">Reliable & trustworthy</h3>
                    <p className="text-gray-700">
                      We're fully compliant with UK financial laws and transparent practices. You're protected under the Consumer Rights Act 2015 and covered by fair, clear terms.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 bg-gray-50 p-6 rounded-lg">
                  <Star className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold mb-2">Trusted by UK Drivers</h3>
                    <p className="text-gray-700">
                      We're proud of our customer-first approach and transparent pricing. See what UK drivers say on Trustpilot - thousands of real reviews and success stories.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 bg-gray-50 p-6 rounded-lg">
                  <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold mb-2">Real Stories, Real Savings</h3>
                    <p className="text-gray-700">
                      Our customers have saved thousands on unexpected repairs. Read their stories below.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right - Image */}
              <figure className="relative text-center order-1 lg:order-2">
                <img 
                  src={pandaEvImg} 
                  alt="Buy a Warranty panda mascot with electric vehicle representing EV and hybrid car warranty coverage in the UK" 
                  className="w-full h-auto max-w-sm md:max-w-lg mx-auto object-contain"
                  loading="lazy"
                  width="600"
                  height="400"
                />
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* Trustpilot Badge */}
      <div className="py-8 flex justify-end max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TrustpilotHeader />
      </div>

      {/* Customer Testimonials */}
      <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50" aria-labelledby="customer-testimonials">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 id="customer-testimonials" className="text-3xl md:text-4xl font-bold text-center mb-12">
              What Our Customers Say
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-lg shadow-md">
                <div className="flex mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="font-bold mb-2">I was honestly nervous about taking out a car warranty</p>
                <p className="text-gray-700 mb-4">
                  I was honestly nervous about taking out a car warranty – I thought it would be full of hidden costs and fine print. But Buy a Warranty has been a complete game changer. My car needed a repair that would have cost me over £1,200, and they covered the whole thing, parts, labour, even breakdown recovery.
                </p>
                <p className="text-gray-700 mb-4">
                  The sign-up process took less than a minute on my phone, and I love that the plans are flexible! Definitely recommend!
                </p>
                <p className="font-semibold text-gray-800">Corey, Liverpool</p>
              </div>

              <div className="bg-white p-8 rounded-lg shadow-md">
                <div className="flex mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="font-bold mb-2">"Didn't expect it to be this easy"</p>
                <p className="text-gray-700 mb-4">
                  "I've always been sceptical about car warranties, but Buy a Warranty proved me wrong. When my alternator failed, I was dreading the cost - turns out it would've been over £600. But they sorted it all, no fuss. The claim was approved in under two hours and the garage was paid directly. I didn't pay a penny. Brilliant service!"
                </p>
                <p className="font-semibold text-gray-800">Aisha, Birmingham</p>
              </div>

              <div className="bg-white p-8 rounded-lg shadow-md">
                <div className="flex mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="font-bold mb-2">"Saved me just in time"</p>
                <p className="text-gray-700 mb-4">
                  "My timing belt snapped out of nowhere, and I thought I'd be out of pocket by at least £1800. Thankfully, I had a Buy a Warranty plan. They covered the repair, and even helped me find a local garage. I genuinely didn't expect it to be this smooth."
                </p>
                <p className="font-semibold text-gray-800">Mark, Bristol</p>
              </div>

              <div className="bg-white p-8 rounded-lg shadow-md">
                <div className="flex mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="font-bold mb-2">"Peace of mind for my daily commute"</p>
                <p className="text-gray-700 mb-4">
                  "I drive 60 miles a day for work, so I needed proper cover. I took out a 3-year plan and saved £200. When my car broke down on the motorway, they paid for my recovery and paid for the repairs. I was back on the road the next day. Couldn't ask for more."
                </p>
                <p className="font-semibold text-gray-800">James, Reading</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Terms */}
      <section className="py-16 bg-white" aria-labelledby="transparent-terms">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 id="transparent-terms" className="text-3xl md:text-4xl font-bold mb-6">
              Transparent Terms. No Hidden Surprises.
            </h2>
            <p className="text-lg text-gray-700 mb-4">
              You'll never find vague wording or confusing exclusions in our plans. Everything is written in plain English, with clear definitions for what's included and what's not.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              You can even download a sample policy document before you buy.
            </p>
            <p className="text-xl font-semibold text-primary italic">
              Honesty isn't optional - it's our policy.
            </p>
          </div>
        </div>
      </section>

      {/* Trustpilot Badge */}
      <div className="py-8 flex justify-end max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TrustpilotHeader />
      </div>

      {/* FAQs */}
      <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50" aria-labelledby="faqs" itemScope itemType="https://schema.org/FAQPage">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 id="faqs" className="text-3xl md:text-4xl font-bold text-center mb-12 faq-question">
              FAQs: Extended Car Warranty UK
            </h2>
            
            <div className="space-y-4">
              {customFAQs.map((faq, index) => (
                <details key={index} className="bg-white rounded-lg shadow-md" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                  <summary className="px-6 py-4 cursor-pointer font-semibold text-lg hover:bg-gray-50 transition-colors faq-question" itemProp="name">
                    {faq.question}
                  </summary>
                  <div className="px-6 pb-4 text-gray-700 leading-relaxed" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                    <span itemProp="text">{faq.answer}</span>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-primary text-white" aria-label="Get your free quote">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Protect Your Car? Get a Free Instant Quote
            </h2>
            <p className="text-xl">
              Don't wait until something goes wrong - secure your protection today.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Check className="h-6 w-6" />
                <span className="text-lg">Instant online quote – no personal details required</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Check className="h-6 w-6" />
                <span className="text-lg">Transparent pricing – no hidden extras</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Check className="h-6 w-6" />
                <span className="text-lg">UK-based support team ready to help</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button 
                size="lg"
                onClick={navigateToQuoteForm}
                className="bg-white text-gray-900 hover:bg-gray-100"
              >
                Get Your Free Quote Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                onClick={() => window.location.href = 'tel:03302295040'}
                className="bg-black text-white hover:bg-black/90"
              >
                <Phone className="mr-2 h-5 w-5" /> Call 0330 229 5040
              </Button>
            </div>

            <div className="pt-8">
              <h3 className="text-2xl font-bold mb-4">Need Help Deciding?</h3>
              <p className="text-lg">
                Call our friendly UK-based support team or start a live chat to get personalised guidance.
              </p>
              <p className="text-lg">
                We'll help you choose the right plan for your car, your budget, and your peace of mind.
              </p>
            </div>
          </div>
        </div>
      </section>
      </main>

      {/* Floating Contact Buttons */}
      {!isMobile && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
          <a 
            href="https://wa.me/message/SPQPJ6O3UBF5B1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-all hover:scale-110"
          >
            <MessageCircle className="h-6 w-6" />
          </a>
          <a 
            href="tel:03302295040"
            className="bg-[#1e40af] text-white p-4 rounded-full shadow-lg hover:bg-[#1e40af]/90 transition-all hover:scale-110"
          >
            <Phone className="h-6 w-6" />
          </a>
        </div>
      )}

      {/* Mobile Floating Buttons */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50 flex gap-3">
          <a 
            href="https://wa.me/message/SPQPJ6O3UBF5B1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button className="w-full bg-green-500 text-white hover:bg-green-600">
              <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp
            </Button>
          </a>
          <a href="tel:03302295040" className="flex-1">
            <Button className="w-full bg-[#1e40af] text-white hover:bg-[#1e40af]/90">
              <Phone className="mr-2 h-5 w-5" /> Call Us
            </Button>
          </a>
        </div>
      )}
    </div>
  );
};

export default CarExtendedWarranty;
