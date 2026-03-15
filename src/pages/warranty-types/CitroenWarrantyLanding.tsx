import React, { useState, lazy, Suspense, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, ChevronUp, MapPin, Clock, Users, Car, Wrench, Zap, Star, Award, ThumbsUp, FileCheck, MessageCircle, Truck, Battery, Bike, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import { OptimizedImage } from '@/components/OptimizedImage';
import MileageQuickSelect from '@/components/MileageQuickSelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';
import BrandPageFAQ from '@/components/brand-pages/BrandPageFAQ';
import BluePersistentCallback from '@/components/brand-pages/BluePersistentCallback';
import MinimalLandingFooter from '@/components/brand-pages/MinimalLandingFooter';
import TrustCallbackPanel from '@/components/TrustCallbackPanel';

const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));
const VehicleCoverageSection = lazy(() => import('@/components/homepage/VehicleCoverageSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));

// Assets
import citroenHeroImage from '@/assets/citroen-c3-hero-warranty-uk.png';
import citroenC4Coverage from '@/assets/citroen-c4-coverage-warranty-uk.png';
import citroenBerlingoClaims from '@/assets/citroen-berlingo-claims-warranty-uk.png';
import citroenC5HighMileage from '@/assets/citroen-c5-aircross-high-mileage-uk.png';
import citroenEC4Electric from '@/assets/citroen-ec4-electric-warranty-uk.png';
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';

// Citroën UK models 2012–2026
const citroenModelCategories = {
  'Hatchbacks': {
    'C1': ['Mk1 Facelift', 'Mk2'],
    'C3': ['Mk2', 'Mk3'],
    'C3 Aircross': ['Mk1', 'Mk2'],
    'C4': ['Mk2', 'Mk3'],
    'C4 Cactus': ['Mk1', 'Mk2'],
    'DS3': ['Mk1'],
  },
  'SUVs & Crossovers': {
    'C5 Aircross': ['Mk1'],
    'C5 X': ['Mk1'],
    'C4 X': ['Mk1'],
  },
  'MPVs & Vans': {
    'Berlingo': ['Mk2', 'Mk3'],
    'SpaceTourer': ['Mk1'],
    'Grand C4 Picasso': ['Mk2'],
    'C4 Grand Picasso': ['Mk2'],
    'Dispatch': ['Mk3'],
    'Relay': ['Mk3'],
  },
  'Electric & Hybrid': {
    'ë-C4': ['Electric'],
    'ë-Berlingo': ['Electric'],
    'ë-SpaceTourer': ['Electric'],
    'ë-Dispatch': ['Electric'],
    'C5 Aircross Hybrid': ['PHEV'],
  },
};

type ModelCategory = keyof typeof citroenModelCategories;

const coverageCategories = [
  {
    title: 'Engine & powertrain',
    icon: Car,
    items: [
      'Engine block and cylinder head',
      'Pistons, rings, and bearings',
      'Crankshaft and camshaft',
      'Timing belt/chain and tensioners',
      'Oil pump and oil cooler',
      'Turbocharger (PureTech/BlueHDi)',
      'Intake and exhaust manifolds',
    ]
  },
  {
    title: 'Transmission & drivetrain',
    icon: Wrench,
    items: [
      'Manual gearbox internals',
      'EAT automatic gearbox',
      'Torque converter',
      'Clutch release bearing',
      'Drive shafts and CV joints',
      'Differential',
      'Prop shaft and bearings',
    ]
  },
  {
    title: 'Electrical & electronics',
    icon: Zap,
    items: [
      'ECU and control modules',
      'Touchscreen infotainment system',
      'Digital instrument cluster',
      'Parking sensors and cameras',
      'Electric window motors',
      'Central locking system',
      'Starter motor and alternator',
    ]
  },
  {
    title: 'Cooling & fuel systems',
    icon: Shield,
    items: [
      'Water pump and thermostat',
      'Radiator and expansion tank',
      'Fuel pump and injectors',
      'High-pressure fuel pump (HDi/BlueHDi)',
      'Fuel rail and regulator',
      'EGR valve and cooler',
      'DPF pressure sensor',
    ]
  },
  {
    title: 'Suspension & steering',
    icon: Car,
    items: [
      'Power steering pump/rack',
      'Electric power steering motor',
      'Shock absorbers and struts',
      'Progressive Hydraulic Cushion system',
      'Control arms and bushings',
      'Anti-roll bar links',
      'Wheel bearings and hubs',
    ]
  },
  {
    title: 'Hybrid & EV components',
    icon: Zap,
    items: [
      'Electric drive motor',
      'Power electronics module',
      'DC-DC converter',
      'On-board charger',
      'Hybrid battery management',
      'Regenerative braking system',
      'Thermal management system',
    ]
  },
];

const citroenFAQs = [
  {
    question: "Is a Citroën extended warranty worth it in the UK?",
    answer: "Yes, Citroën vehicles use advanced PureTech and BlueHDi technology that can be expensive to repair. Our extended warranty protects key components like the engine, gearbox, turbocharger, and electronics, preventing unexpected repair bills."
  },
  {
    question: "How much does a Citroën extended warranty cost?",
    answer: "Citroën extended warranty prices start from just £19 a month, depending on your model, mileage, and chosen claim limit. We offer flexible monthly or annual payment options."
  },
  {
    question: "Can I buy a Citroën warranty after the manufacturer warranty expires?",
    answer: "Yes, you can buy cover even if your Citroën is outside its original manufacturer warranty or if you purchased it used. We cover vehicles up to 150,000 miles and 15 years old."
  },
  {
    question: "Can I use my own garage for Citroën warranty repairs?",
    answer: "Yes, absolutely. You can choose any VAT-registered garage across the UK — you're not restricted to Citroën dealerships. We have a nationwide network of approved garages."
  },
  {
    question: "Does the warranty cover electric Citroën models?",
    answer: "Yes, our comprehensive plan covers electric and hybrid Citroën models including the ë-C4, ë-Berlingo, and C5 Aircross Hybrid. Coverage includes the electric motor, battery management system, and charging components."
  },
  {
    question: "Is roadside assistance included?",
    answer: "Yes, our comprehensive plan includes 24/7 roadside assistance and recovery anywhere in the UK. If your Citroën breaks down, we'll send help to get you back on the road."
  },
  {
    question: "How do I make a claim on my Citroën warranty?",
    answer: "Simply call our UK-based claims team or submit a claim online. We aim to authorise repairs quickly so you're not left waiting. Your garage contacts us directly and we settle the bill with them."
  },
  {
    question: "What's not covered by the warranty?",
    answer: "Routine maintenance, wear and tear items (brake pads, tyres, wiper blades), pre-existing faults, and cosmetic damage are not covered. Our policy documents clearly outline all exclusions."
  }
];

const testimonials = [
  {
    name: "Claire P.",
    location: "Leeds",
    model: "Citroën C3",
    text: "My C3's turbo failed at 72,000 miles. Would have been over £1,500 but the warranty covered everything. Brilliant service, no hassle at all.",
    rating: 5
  },
  {
    name: "Tom H.",
    location: "Cardiff",
    model: "Citroën C5 Aircross",
    text: "The EAT8 gearbox on my C5 Aircross needed work. They sorted it within a week and paid the garage directly. Very impressed.",
    rating: 5
  },
  {
    name: "Rachel S.",
    location: "Southampton",
    model: "Citroën Berlingo",
    text: "Our family Berlingo had an injector issue. Claim was approved same day and the repair was done at our local garage. Couldn't be easier.",
    rating: 5
  },
  {
    name: "Mark D.",
    location: "Glasgow",
    model: "Citroën ë-C4",
    text: "Finding warranty cover for an electric Citroën was hard until I found Buy A Warranty. Great price and they actually cover the EV components properly.",
    rating: 5
  }
];

const CitroenWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [activeModelFilter, setActiveModelFilter] = useState<ModelCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  const filteredModels = useMemo(() => {
    const allModels = activeModelFilter === 'All'
      ? Object.entries(citroenModelCategories).flatMap(([category, models]) =>
          Object.entries(models).map(([model, generations]) => ({ model, generations, category }))
        )
      : Object.entries(citroenModelCategories[activeModelFilter]).map(([model, generations]) => ({
          model,
          generations,
          category: activeModelFilter
        }));

    if (!modelSearchQuery.trim()) return allModels;
    const query = modelSearchQuery.toLowerCase();
    return allModels.filter(({ model, generations }) =>
      model.toLowerCase().includes(query) ||
      generations.some(gen => gen.toLowerCase().includes(query))
    );
  }, [activeModelFilter, modelSearchQuery]);

  const eligibilityError = vehicleAgeError;

  const formatRegNumber = (value: string) => {
    const formatted = value.replace(/\s/g, '').toUpperCase();
    if (formatted.length > 3) {
      return formatted.slice(0, -3) + ' ' + formatted.slice(-3);
    }
    return formatted;
  };

  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRegNumber(e.target.value);
    if (formatted.length <= 8) setRegNumber(formatted);
  };

  const handleMileageSelection = (selection: string) => {
    setMileageSelection(selection);
    if (selection === 'under120k') setMileage('100000');
    else if (selection === 'over120k') setMileage('130000');
  };

  const handleGetQuote = async () => {
    trackButtonClick('citroen_warranty_get_quote', { brand: 'Citroen' });

    if (!regNumber.trim()) {
      toast({ title: "Registration required", description: "Please enter your vehicle registration number.", variant: "destructive" });
      return;
    }
    if (!mileage.trim()) {
      toast({ title: "Mileage required", description: "Please select your vehicle's mileage to continue.", variant: "destructive" });
      return;
    }

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber }
      });
      if (error) throw error;

      if (data?.found) {
        const now = new Date();
        if (data.manufactureDate) {
          const manufactureDate = new Date(data.manufactureDate);
          const vehicleAgePrecise = (now.getTime() - manufactureDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          if (vehicleAgePrecise > 15) {
            setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
            toast({ title: "Vehicle not eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" });
            setIsLookingUp(false);
            return;
          }
        }
        const vehicleData = { regNumber, mileage, make: data.make || 'CITROEN', model: data.model, fuelType: data.fuelType, transmission: data.transmission, year: data.yearOfManufacture, vehicleType: 'car', manufactureDate: data.manufactureDate };
        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_currentStep', '2');
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
        navigate('/?step=2');
      } else {
        const vehicleData = { regNumber, mileage, vehicleType: 'car' };
        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_currentStep', '2');
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
        navigate('/?step=2');
      }
    } catch (err) {
      console.error('Vehicle lookup error:', err);
      const vehicleData = { regNumber, mileage, vehicleType: 'car' };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } finally {
      setIsLookingUp(false);
    }
  };

  const scrollToQuoteForm = () => {
    const hero = document.getElementById('hero-section');
    if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const productSchema = {
    "@context": "https://schema.org", "@type": "Product",
    "name": "Citroën Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for all Citroën models including C3, C4, C5 Aircross, Berlingo, ë-C4 and more. Covers engine, gearbox, electrical systems, turbocharger, and more. Nationwide UK coverage.",
    "brand": { "@type": "Brand", "name": "Buy A Warranty" },
    "manufacturer": { "@type": "Organization", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk", "contactPoint": { "@type": "ContactPoint", "telephone": "+44-800-917-9270", "contactType": "customer service", "areaServed": "GB" } },
    "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": "19", "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], "availability": "https://schema.org/InStock", "url": "https://buyawarranty.co.uk/warranty-types/citroen-warranty/", "seller": { "@type": "Organization", "name": "Buy A Warranty" }, "priceSpecification": { "@type": "UnitPriceSpecification", "price": "19", "priceCurrency": "GBP", "unitText": "month" } },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5" },
    "review": testimonials.map((t, i) => ({ "@type": "Review", "author": { "@type": "Person", "name": t.name }, "reviewRating": { "@type": "Rating", "ratingValue": t.rating, "bestRating": "5" }, "reviewBody": t.text, "datePublished": new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] })),
    "category": "Vehicle Extended Warranty",
  };

  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": citroenFAQs.map(faq => ({ "@type": "Question", "name": faq.question, "acceptedAnswer": { "@type": "Answer", "text": faq.answer } })) };

  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" },
    { "@type": "ListItem", "position": 2, "name": "Warranty Types", "item": "https://buyawarranty.co.uk/warranty-types/" },
    { "@type": "ListItem", "position": 3, "name": "Citroën Extended Warranty", "item": "https://buyawarranty.co.uk/warranty-types/citroen-warranty/" }
  ]};

  const howToSchema = { "@context": "https://schema.org", "@type": "HowTo", "name": "How to get a Citroën extended warranty quote", "description": "Get an instant Citroën extended warranty quote in 60 seconds", "totalTime": "PT1M", "step": [
    { "@type": "HowToStep", "position": 1, "name": "Enter registration", "text": "Enter your Citroën registration number to look up your vehicle details automatically" },
    { "@type": "HowToStep", "position": 2, "name": "Select mileage", "text": "Choose your current mileage range" },
    { "@type": "HowToStep", "position": 3, "name": "Get instant quote", "text": "Receive your personalised warranty quote instantly" }
  ]};

  return (
    <>
      <Helmet>
        <title>Citroën Extended Warranty UK | From £19/mo | Buy A Warranty</title>
        <meta name="description" content="Protect your Citroën with comprehensive extended warranty cover. All models from C3 to C5 Aircross and ë-C4 covered. Engine, gearbox, electrics & more. Nationwide UK coverage, any VAT-registered garage. Prices from £19/month." />
        <meta name="keywords" content="Citroën extended warranty, Citroën used car warranty, Citroën warranty UK, Citroën warranty cost, Citroën C3 warranty, Citroën C4 warranty, Citroën C5 Aircross warranty, Citroën Berlingo warranty, Citroën electric warranty, used Citroën warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/citroen-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="geo.region" content="GB" />
        <meta httpEquiv="content-language" content="en-GB" />
        <meta property="og:title" content="Citroën Extended Warranty UK | From £19/month" />
        <meta property="og:description" content="Comprehensive Citroën warranty coverage. Engine, gearbox, electrics & more. All models covered including hybrid and electric. Nationwide UK coverage." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/citroen-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Citroën Extended Warranty UK | From £19/month" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
      </Helmet>

      <main className="min-h-screen bg-white" role="main">
        {/* Hero section */}
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-6 pb-12 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              <div className="text-center lg:text-left">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Protect your Citroën</span><br />
                  <span className="text-brand-orange">in 60 seconds.</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6">
                  Dealer-level warranty. Fixed price. No surprise bills.
                </p>
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">From just £19/month • Easy claims • Fast payouts</span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Unlimited claims • Parts and labour • No excess</span>
                  </div>
                </div>

                <div className="mx-auto lg:mx-0 space-y-4">
                  <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black">
                    <div className="bg-blue-600 text-white font-bold px-3 sm:px-4 py-3 flex items-center justify-center min-w-[60px] sm:min-w-[80px]">
                      <div className="flex flex-col items-center">
                        <div className="text-base sm:text-lg leading-tight mb-0.5">🇬🇧</div>
                        <div className="text-xs sm:text-sm font-bold leading-none">UK</div>
                      </div>
                    </div>
                    <input type="text" value={regNumber} onChange={handleRegChange} placeholder="ENTER REG" className="bg-yellow-400 border-none outline-none text-xl sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/60 px-3 sm:px-4 py-3 uppercase tracking-wider min-w-0" maxLength={8} />
                  </div>
                  <MileageQuickSelect value={mileageSelection} onChange={handleMileageSelection} onAutoSubmit={handleGetQuote} error={eligibilityError} isLoading={isLookingUp} isRegValid={regNumber.replace(/\s/g, '').length >= 5} />
                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">
                    Citroën is a registered trademark of Stellantis. We are an independent warranty provider.
                  </p>
                  <TrustCallbackPanel />
                </div>
              </div>

              <div className="relative">
                <div className="relative">
                  <OptimizedImage src={citroenHeroImage} alt="Citroën C3 front view - Citroën extended warranty UK coverage" className="w-full max-w-sm mx-auto h-auto object-contain" priority={true} width={1024} height={768} />
                  <div className="absolute top-4 right-4">
                    <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                      <OptimizedImage src={trustpilotExcellent} alt="Trustpilot excellent rating" className="h-auto w-28 sm:w-36 object-contain" width={144} height={61} />
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5"><Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Cars</span></div>
                    <div className="flex items-center space-x-1.5"><Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Vans</span></div>
                    <div className="flex items-center space-x-1.5"><Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Hybrid</span></div>
                    <div className="flex items-center space-x-1.5"><Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">EV</span></div>
                  </div>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 rounded-md px-3 py-1.5 sm:px-3.5 sm:py-2 cursor-pointer">
                          <span className="text-sm font-semibold text-green-700">⚡ Instant cover</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent><p>⚡ Cover starts immediately after purchase</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}>
          <WarrantyBenefitsSection headline="The ultimate Citroën warranty." />
        </Suspense>

        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Citroën" />
        </Suspense>

        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>

        {/* What Citroën repairs actually cost */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Wrench className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
                <span className="text-xs md:text-sm font-semibold text-red-700">Without warranty, you pay the full bill</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">What Citroën repairs actually cost</h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">One breakdown could cost more than years of warranty cover.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[
                { name: 'PureTech timing belt/chain', cost: '£800 – £1,800', icon: Wrench, severity: 'high' },
                { name: 'Turbocharger replacement', cost: '£1,200 – £2,800', icon: Zap, severity: 'high' },
                { name: 'EAT8 gearbox rebuild', cost: '£2,000 – £4,500', icon: Wrench, severity: 'critical' },
                { name: 'Engine rebuild', cost: '£2,500 – £5,500', icon: Car, severity: 'critical' },
                { name: 'BlueHDi injector set', cost: '£600 – £1,800', icon: Zap, severity: 'medium' },
                { name: 'ECU replacement', cost: '£700 – £1,600', icon: Zap, severity: 'medium' },
                { name: 'DPF replacement', cost: '£900 – £2,200', icon: Shield, severity: 'high' },
                { name: 'Power steering rack', cost: '£600 – £1,400', icon: Wrench, severity: 'medium' },
                { name: 'Water pump failure', cost: '£400 – £900', icon: Shield, severity: 'medium' },
              ].map((repair, index) => {
                const Icon = repair.icon;
                const severityColors = {
                  medium: { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-900' },
                  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-brand-orange' },
                  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' },
                };
                const colors = severityColors[repair.severity as keyof typeof severityColors];
                return (
                  <div key={index} className={`${colors.bg} rounded-xl p-4 md:p-5 border ${colors.border} flex items-start gap-3`}>
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-5 h-5 ${colors.text}`} /></div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm md:text-base">{repair.name}</h3>
                      <p className={`font-bold text-base md:text-lg ${colors.text}`}>{repair.cost}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 md:mt-12 text-center">
              <div className="bg-brand-deep-blue rounded-2xl p-8 md:p-12 max-w-3xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-4">
                  <div className="text-center">
                    <p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Typical repair</p>
                    <p className="text-2xl md:text-4xl font-bold text-red-400 line-through decoration-2">£1,800</p>
                  </div>
                  <span className="text-lg md:text-xl font-bold text-white/50">vs</span>
                  <div className="text-center">
                    <p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Platinum plan</p>
                    <p className="text-2xl md:text-4xl font-bold text-emerald-400">from £19/mo</p>
                  </div>
                </div>
                <p className="text-white/70 mb-6 text-sm md:text-base">That's less than a single diagnostic fee — and it covers all of the above.</p>
                <Button onClick={scrollToQuoteForm} className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 md:py-5 px-6 md:px-8 text-base md:text-lg rounded-xl shadow-lg animate-breathing">
                  <span className="flex items-center gap-2">Get my instant quote <ArrowRight className="w-5 h-5" /></span>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Citroën models section */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" /> Full coverage details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">All Citroën models covered</h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">Select your Citroën model to see tailored warranty options.</p>
            </div>

            <div className="max-w-md mx-auto mb-6 md:mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" value={modelSearchQuery} onChange={(e) => setModelSearchQuery(e.target.value)} placeholder="Search by model (e.g. C3, Berlingo)" className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm md:text-base" />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-10 sticky top-0 bg-gradient-to-b from-slate-50 via-slate-50 to-transparent py-4 md:py-5 z-10 -mx-4 px-4">
              {(['All', 'Hatchbacks', 'SUVs & Crossovers', 'MPVs & Vans', 'Electric & Hybrid'] as const).map(cat => (
                <button key={cat} onClick={() => { setActiveModelFilter(cat as any); setModelSearchQuery(''); }}
                  className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all ${
                    activeModelFilter === cat
                      ? cat === 'Electric & Hybrid' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'bg-slate-900 text-white shadow-lg shadow-slate-900/25'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  {cat === 'Electric & Hybrid' ? <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />Electric & Hybrid</span> : cat === 'All' ? 'All models' : cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
              {filteredModels.map(({ model, generations, category }) => {
                const isElectric = category === 'Electric & Hybrid';
                return (
                  <button key={model} onClick={() => { setSelectedModel(model); scrollToQuoteForm(); }}
                    className={`group relative bg-white rounded-lg px-2 py-3 md:px-3 md:py-3 text-center border transition-all duration-200 ${
                      selectedModel === model ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-md scale-[1.02]' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`} aria-label={`Citroën ${model}`}>
                    {isElectric && <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-2 h-2" />EV</div>}
                    <Car className={`w-6 h-6 mx-auto mb-1.5 transition-colors ${selectedModel === model ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={1.25} />
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">Citroën {model}</h3>
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-mono tracking-tight leading-tight">{generations.join(' · ')}</p>
                  </button>
                );
              })}
            </div>

            {filteredModels.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 text-base md:text-lg">No models found for "{modelSearchQuery}".</p>
                <button onClick={() => setModelSearchQuery('')} className="mt-3 text-blue-600 font-medium hover:underline">Clear search</button>
              </div>
            )}

            <div className="mt-8 md:mt-10 text-center">
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 text-xs md:text-sm text-slate-600">
                <Check className="w-4 h-4 text-green-600" />
                <span><strong>Also covered:</strong> Flair, Shine, and Plus trim variants, all engine sizes</span>
              </div>
            </div>
          </div>
        </section>

        {selectedModel && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 md:py-4 px-4 z-50 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm md:text-base">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center"><Car className="w-5 h-5 text-white" /></div>
                <div><p className="font-bold text-slate-900">Citroën {selectedModel} selected</p><p className="text-slate-500 text-xs md:text-sm">Step 1 of 2: Choose coverage →</p></div>
              </div>
              <Button onClick={scrollToQuoteForm} className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25">
                Get warranty quote for Citroën <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Why Citroën drivers choose us */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Why Citroën drivers choose us</h2>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4">
                Get Citroën warranty <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Wrench, title: 'PureTech & BlueHDi specialists', desc: 'We understand Citroën\'s advanced engine technology and cover all key components.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Car, title: 'High mileage Citroën warranty plans', desc: 'Cover vehicles up to 150,000 miles with no mileage restrictions during cover.' },
                  { icon: Clock, title: 'Flexible monthly payments', desc: 'Cancel anytime and get a pro-rata refund. No lock-in contracts.' },
                ].map((benefit, index) => (
                  <div key={index} className="flex gap-3 md:gap-4 bg-white p-3 md:p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-orange/10 rounded-xl flex items-center justify-center flex-shrink-0"><benefit.icon className="w-5 h-5 md:w-6 md:h-6 text-brand-orange" /></div>
                    <div><h3 className="text-base md:text-lg font-bold text-gray-900 mb-0.5 md:mb-1">{benefit.title}</h3><p className="text-gray-600 text-xs md:text-sm">{benefit.desc}</p></div>
                  </div>
                ))}
              </div>
              <div className="hidden lg:flex justify-center items-end">
                <OptimizedImage src={citroenC4Coverage} alt="Citroën C4 front view - Why Citroën owners choose us for extended warranty" className="max-w-[240px] xl:max-w-[280px] h-auto object-contain" width={1024} height={768} />
              </div>
            </div>
          </div>
        </section>

        {/* How claims work */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12"><h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">How claims work</h2></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {[
                { step: 1, title: 'Diagnose', desc: 'Diagnose at any VAT-registered garage' },
                { step: 2, title: 'Authorise', desc: 'We authorise eligible repairs quickly' },
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your Citroën' },
                { step: 4, title: 'We pay', desc: 'We pay the garage directly for covered items' },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-brand-orange text-white rounded-full flex items-center justify-center text-xl md:text-2xl font-bold mx-auto mb-3 md:mb-4">{item.step}</div>
                  <h3 className="text-sm md:text-lg font-bold text-gray-900 mb-1 md:mb-2">{item.title}</h3>
                  <p className="text-xs md:text-base text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Crystal clear cover */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent coverage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Your Citroën cover, made <span className="text-brand-orange">crystal clear</span></h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center"><div className="text-3xl md:text-4xl mb-3 md:mb-4">✅</div><h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">No hidden catches</h3><p className="text-gray-600 text-xs md:text-sm">What you see is what you get</p></div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center"><div className="text-3xl md:text-4xl mb-3 md:mb-4">💰</div><h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">14-day money-back guarantee</h3><p className="text-gray-600 text-xs md:text-sm">Try risk-free</p></div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center"><div className="text-3xl md:text-4xl mb-3 md:mb-4">⭐</div><h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">94% of claims approved fast</h3><p className="text-gray-600 text-xs md:text-sm">We pay when you need us</p></div>
            </div>
          </div>
        </section>

        {/* High mileage Citroën */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              <div className="flex justify-center">
                <OptimizedImage src={citroenC5HighMileage} alt="Citroën C5 Aircross front view - High mileage Citroën warranty coverage" className="max-w-[220px] xl:max-w-[280px] h-auto object-contain" width={1024} height={768} />
              </div>
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">High mileage Citroën, no problem!</div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">Drive your Citroën with confidence<br /><span className="text-brand-orange">You're covered</span></h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">Once you have your Citroën warranty, drive with complete peace of mind. If something goes wrong, simply call our claims team and we'll take care of everything.</p>
                <div className="space-y-2 md:space-y-3 text-left max-w-md mx-auto lg:mx-0">
                  {['Cover vehicles up to 150,000 miles', 'No mileage restrictions during cover', 'Unlimited claims value'].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 md:gap-3"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" /><span className="text-sm md:text-base text-gray-700">{item}</span></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 md:mt-10 max-w-xl mx-auto">
              <Button onClick={scrollToQuoteForm} className="w-full bg-brand-orange text-white font-bold py-5 md:py-6 text-base md:text-xl rounded-xl shadow-lg animate-breathing">
                <span className="flex items-center justify-center gap-2 md:gap-3">Get my instant quote <ArrowRight className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3} /></span>
              </Button>
            </div>
          </div>
        </section>

        {/* Additional cover options */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Additional Citroën cover options</h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">Enhance your Citroën warranty with these optional extras</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100"><div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4"><Car className="w-5 h-5 md:w-6 md:h-6 text-blue-600" /></div><h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Courtesy car</h3><p className="text-sm md:text-base text-gray-600">Keep moving while your Citroën is being repaired</p></div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100"><div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 md:mb-4"><MapPin className="w-5 h-5 md:w-6 md:h-6 text-green-600" /></div><h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">European cover</h3><p className="text-sm md:text-base text-gray-600">Extended protection when driving abroad</p></div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100"><div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 md:mb-4"><Shield className="w-5 h-5 md:w-6 md:h-6 text-purple-600" /></div><h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Wear & tear</h3><p className="text-sm md:text-base text-gray-600">Cover for gradual component deterioration</p></div>
            </div>
          </div>
        </section>

        {/* UK coverage */}
        <section className="py-10 md:py-16 bg-gradient-to-br from-blue-900 to-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6 text-white">Nationwide UK coverage</h2>
                <p className="text-base md:text-lg text-white mb-4 md:mb-6">Your Citroën is covered wherever you drive in the United Kingdom.</p>
                <ul className="space-y-2 md:space-y-3 text-left max-w-md mx-auto md:mx-0">
                  {['Use any VAT-registered garage', 'Citroën dealer or specialist garage', 'Recovery to nearest garage', 'Claims handled by our UK team'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 md:gap-3"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-400 flex-shrink-0" /><span className="text-sm md:text-base">{item}</span></li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-center order-first md:order-last">
                <OptimizedImage src={pandaThumbsUp} alt="Miles the Panda giving thumbs up for UK-wide Citroën coverage" className="w-36 sm:w-48 md:w-64 h-auto object-contain mb-3 md:mb-4" width={256} height={256} />
                <div className="inline-block bg-white/10 rounded-xl md:rounded-2xl px-4 md:px-8 py-2 md:py-4 backdrop-blur-sm">
                  <p className="text-sm md:text-xl font-bold text-white">England • Scotland • Wales • N. Ireland</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">What Citroën owners say</h2>
              <p className="text-base md:text-lg text-gray-600">Real reviews from real Citroën drivers</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                  <div className="flex gap-0.5 md:gap-1 mb-2 md:mb-3">{[...Array(testimonial.rating)].map((_, i) => (<Star key={i} className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 fill-yellow-400" />))}</div>
                  <p className="text-sm md:text-base text-gray-700 mb-3 md:mb-4">"{testimonial.text}"</p>
                  <div className="border-t pt-3 md:pt-4"><p className="font-bold text-gray-900 text-sm md:text-base">{testimonial.name}</p><p className="text-xs md:text-sm text-gray-500">{testimonial.model} • {testimonial.location}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <BrandPageFAQ />
      </main>
      <MinimalLandingFooter />
      <BluePersistentCallback />
    </>
  );
};

export default CitroenWarrantyLanding;
