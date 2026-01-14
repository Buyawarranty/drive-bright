import React, { useState, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, ChevronUp, MapPin, Clock, Users, Car, Wrench, Zap, Star, Award, ThumbsUp, FileCheck, MessageCircle, Truck, Battery, Bike } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import { OptimizedImage } from '@/components/OptimizedImage';
import WebsiteFooter from '@/components/WebsiteFooter';
import MileageQuickSelect from '@/components/MileageQuickSelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';

// Lazy load heavy components
const HomepageFAQ = lazy(() => import('@/components/HomepageFAQ'));

// Assets
import bmwLogo from '@/assets/logos/bmw.webp';
import bmwHeroImage from '@/assets/Bmw-extended-used-car-warranty.png';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import pandaMascot from '@/assets/warranty-panda-mascot.png';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import pandaMechanic from '@/assets/panda-mechanic.png';
import pandaGarage from '@/assets/panda-garage-service.png';

// BMW Models covered (grouped by category)
const bmwModelCategories = {
  'Series': {
    '1 Series': ['F20', 'F21', 'F40', 'F52'],
    '2 Series': ['F22', 'F23', 'F44', 'F45', 'F46', 'G42'],
    '3 Series': ['F30', 'F31', 'F34', 'G20', 'G21'],
    '4 Series': ['F32', 'F33', 'F36', 'G22', 'G23', 'G26'],
    '5 Series': ['F10', 'F11', 'G30', 'G31'],
    '6 Series': ['F06', 'F12', 'F13', 'G32'],
    '7 Series': ['F01', 'F02', 'G11', 'G12'],
    '8 Series': ['G14', 'G15', 'G16'],
  },
  'X Series SUVs': {
    'X1': ['F48', 'U11'],
    'X2': ['F39', 'U10'],
    'X3': ['F25', 'G01'],
    'X4': ['F26', 'G02'],
    'X5': ['F15', 'G05'],
    'X6': ['F16', 'G06'],
    'X7': ['G07'],
  },
  'Electric & Hybrid': {
    'i3': ['I01'],
    'i4': ['G26'],
    'i7': ['G70'],
    'i8': ['I12', 'I15'],
    'iX': ['I20'],
    'iX3': ['G08'],
  },
  'Sports & Roadster': {
    'Z4': ['E89', 'G29'],
  },
};

type ModelCategory = keyof typeof bmwModelCategories;

// Coverage components data
const coverageCategories = [
  {
    title: 'Engine & Powertrain',
    icon: Car,
    items: [
      'Engine block and cylinder head',
      'Pistons, rings, and bearings',
      'Crankshaft and camshaft',
      'Timing chains and tensioners',
      'Oil pump and oil cooler',
      'Turbocharger/supercharger',
      'Intake and exhaust manifolds',
    ]
  },
  {
    title: 'Transmission & Drivetrain',
    icon: Wrench,
    items: [
      'Automatic/manual gearbox',
      'Torque converter',
      'Dual-clutch transmission (DCT)',
      'xDrive transfer case',
      'Differential (front & rear)',
      'Drive shafts and CV joints',
      'Prop shaft and bearings',
    ]
  },
  {
    title: 'Electrical & Electronics',
    icon: Zap,
    items: [
      'ECU and control modules',
      'iDrive infotainment system',
      'Digital instrument cluster',
      'Parking sensors and cameras',
      'Electric window motors',
      'Central locking system',
      'Starter motor and alternator',
    ]
  },
  {
    title: 'Cooling & Fuel Systems',
    icon: Shield,
    items: [
      'Water pump and thermostat',
      'Radiator and expansion tank',
      'Fuel pump and injectors',
      'High-pressure fuel pump',
      'Fuel rail and regulator',
      'EGR valve and cooler',
      'Oil/coolant heat exchangers',
    ]
  },
  {
    title: 'Suspension & Steering',
    icon: Car,
    items: [
      'Power steering pump/rack',
      'Electric power steering motor',
      'Shock absorbers and struts',
      'Air suspension compressor',
      'Control arms and bushings',
      'Anti-roll bar links',
      'Wheel bearings and hubs',
    ]
  },
  {
    title: 'Hybrid & EV Components',
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

// FAQs for schema
const bmwFAQs = [
  {
    question: "Is a BMW extended warranty worth it in the UK?",
    answer: "Yes, BMW repairs are among the most expensive in the UK due to advanced electronics and complex powertrains. An extended warranty protects key components like the engine, gearbox, fuel injectors, and ECUs, preventing sudden repair bills that can reach £6,000 to £9,000 on premium BMW models."
  },
  {
    question: "How much does a BMW extended warranty cost in the UK?",
    answer: "Extended BMW warranty prices typically start from £35 to £95 per month, depending on your BMW model, mileage, and chosen claim limit. We offer plans from just 80p a day with flexible monthly or annual payment options."
  },
  {
    question: "What BMW models do you cover?",
    answer: "We cover all BMW models from 2011-2025 including 1 Series, 2 Series, 3 Series, 4 Series, 5 Series, 6 Series, 7 Series, 8 Series, all X Series (X1-X7), Z4, i Series (i3, i4, iX, iX3), and M models (M2, M3, M4, M5, M8). Both petrol, diesel, hybrid, and electric variants are covered."
  },
  {
    question: "Can I buy a BMW extended warranty after my original warranty has expired?",
    answer: "Yes, you can buy cover even if your BMW is outside its original 3-year manufacturer warranty, or if you purchased it used. We cover vehicles up to 150,000 miles and 15 years old."
  },
  {
    question: "Can I use my own garage for BMW warranty repairs?",
    answer: "Yes, absolutely. You can choose any VAT-registered garage across the UK instead of being restricted to BMW dealers. We have a network of approved garages nationwide."
  },
  {
    question: "Does the warranty cover hybrid and electric BMW models?",
    answer: "Yes, our comprehensive plan includes cover for hybrid and electric components including the electric motor, battery management system, power electronics, on-board charger, and thermal management systems."
  },
  {
    question: "Is roadside assistance included?",
    answer: "Yes, our comprehensive plan includes 24/7 roadside assistance and recovery anywhere in the UK. If your BMW breaks down, we'll send help to get you back on the road or recover your vehicle to a garage."
  },
  {
    question: "How do I make a claim on my BMW warranty?",
    answer: "Simply call our UK-based claims team or submit a claim online. We aim to authorise repairs quickly so you're not left waiting. Your chosen garage contacts us directly, and we settle the bill with them."
  },
  {
    question: "Can I cancel my BMW warranty if I sell the car?",
    answer: "Yes, you can cancel anytime with no hidden fees. If you sell your BMW, you can either transfer the warranty to the new owner or receive a pro-rata refund for the remaining period."
  },
  {
    question: "What's not covered by the warranty?",
    answer: "Routine maintenance, wear and tear items (brake pads, tyres, wiper blades), pre-existing faults, and cosmetic damage are not covered. Our policy documents clearly outline all exclusions so there are no surprises."
  }
];

// Testimonials
const testimonials = [
  {
    name: "James T.",
    location: "Manchester",
    model: "BMW 330d",
    text: "My 330d needed a new turbo at 85,000 miles. Would have cost me over £3,000 but my warranty covered everything. Brilliant service from start to finish.",
    rating: 5
  },
  {
    name: "Sarah M.",
    location: "Edinburgh",
    model: "BMW X5",
    text: "The peace of mind is worth every penny. When my X5's air suspension failed, they sorted it within days. No quibbles, no excess to pay.",
    rating: 5
  },
  {
    name: "David K.",
    location: "Bristol",
    model: "BMW 520i",
    text: "I was sceptical about third-party warranties but Buy A Warranty proved me wrong. ECU issue fixed, £1,800 claim paid without any hassle.",
    rating: 5
  },
  {
    name: "Emma W.",
    location: "London",
    model: "BMW i3",
    text: "Finding warranty cover for my electric BMW was difficult until I found these guys. They cover all the EV components and the price is very reasonable.",
    rating: 5
  }
];

const BMWWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [expandedCoverage, setExpandedCoverage] = useState(false);
  const [activeModelFilter, setActiveModelFilter] = useState<ModelCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

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
    if (formatted.length <= 8) {
      setRegNumber(formatted);
    }
  };

  const handleMileageSelection = (selection: string) => {
    setMileageSelection(selection);
    if (selection === 'under120k') {
      setMileage('100000');
    } else if (selection === 'over120k') {
      setMileage('130000');
    }
  };

  const handleGetQuote = async () => {
    trackButtonClick('bmw_warranty_get_quote', { brand: 'BMW' });
    
    if (!regNumber.trim()) {
      toast({
        title: "Registration Required",
        description: "Please enter your vehicle registration number.",
        variant: "destructive",
      });
      return;
    }
    
    if (!mileage.trim()) {
      toast({
        title: "Mileage Required",
        description: "Please select your vehicle's mileage to continue.",
        variant: "destructive",
      });
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
          const ageInMs = now.getTime() - manufactureDate.getTime();
          const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
          const vehicleAgePrecise = ageInMs / msPerYear;
          
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
        
        const vehicleData = {
          regNumber: regNumber,
          mileage: mileage,
          make: data.make || 'BMW',
          model: data.model,
          fuelType: data.fuelType,
          transmission: data.transmission,
          year: data.yearOfManufacture,
          vehicleType: 'car',
          manufactureDate: data.manufactureDate
        };
        
        localStorage.setItem('vehicleData', JSON.stringify(vehicleData));
        navigate('/checkout');
      } else {
        toast({
          title: "Vehicle Not Found",
          description: "We couldn't find your vehicle. Please check the registration and try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Vehicle lookup error:', err);
      toast({
        title: "Lookup Error",
        description: "There was a problem looking up your vehicle. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const scrollToQuoteForm = () => {
    const hero = document.getElementById('hero-section');
    if (hero) {
      hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Schema markup
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "BMW Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for BMW vehicles in the UK. Protect your BMW from costly repairs with cover for engine, gearbox, electrics, and more.",
    "brand": {
      "@type": "Brand",
      "name": "Buy A Warranty"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "GBP",
      "price": "29",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://buyawarranty.co.uk/warranty-types/bmw"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "2847"
    }
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "BMW Extended Warranty",
    "provider": {
      "@type": "Organization",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk"
    },
    "areaServed": {
      "@type": "Country",
      "name": "United Kingdom"
    },
    "description": "Extended warranty coverage for all BMW models including 1 Series, 3 Series, 5 Series, X Series, i Series and M models. Nationwide UK coverage with approved garages.",
    "serviceType": "Vehicle Extended Warranty"
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": bmwFAQs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://buyawarranty.co.uk/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Warranty Types",
        "item": "https://buyawarranty.co.uk/warranty-types/"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "BMW Extended Warranty",
        "item": "https://buyawarranty.co.uk/warranty-types/bmw"
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>BMW Extended Warranty UK | Get Your Instant Quote | Buy A Warranty</title>
        <meta name="description" content="Protect your BMW with comprehensive extended warranty cover. All models from 1 Series to X7 and i Series. Nationwide UK coverage, approved garages, unlimited claims. Get your instant quote in 60 seconds." />
        <meta name="keywords" content="BMW extended warranty, BMW used car warranty, BMW warranty UK, BMW warranty cost, BMW warranty quote, BMW 3 Series warranty, BMW X5 warranty, BMW i4 warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/bmw" />
        <meta name="robots" content="index, follow" />
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta property="og:title" content="BMW Extended Warranty UK | Instant Quotes from 80p/day" />
        <meta property="og:description" content="Comprehensive BMW warranty coverage. Engine, gearbox, electrics & more. All models covered including hybrid and electric. Get your instant quote now." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/bmw" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-8 pb-16 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left Column - Content */}
              <div className="text-center lg:text-left">
                {/* Brand Logo */}
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
                  <OptimizedImage 
                    src={bmwLogo} 
                    alt="BMW Logo" 
                    className="h-16 w-auto object-contain"
                    priority={true}
                    width={64}
                    height={64}
                  />
                </div>

                {/* H1 Headline */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-4">
                  <span className="text-gray-900">BMW Extended Warranty </span>
                  <span className="text-brand-orange">in 60 Seconds!</span>
                </h1>

                {/* Subheadline */}
                <p className="text-lg sm:text-xl text-gray-700 mb-6">
                  Get instant quotes for comprehensive cover. Nationwide UK coverage with approved garages.
                </p>

                {/* Benefits */}
                <div className="mb-6 text-gray-700 text-sm sm:text-base space-y-2">
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="font-medium">From just 80p a day • Easy claims • Fast payouts</span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="font-medium">Unlimited claims • Parts and Labour • No excess</span>
                  </div>
                </div>

                {/* Quote Form */}
                <div className="max-w-md mx-auto lg:mx-0 space-y-4">
                  {/* Registration Input */}
                  <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black">
                    <div className="bg-blue-600 text-white font-bold px-3 sm:px-4 py-3 flex items-center justify-center min-w-[60px] sm:min-w-[80px]">
                      <div className="flex flex-col items-center">
                        <div className="text-base sm:text-lg leading-tight mb-0.5">🇬🇧</div>
                        <div className="text-xs sm:text-sm font-bold leading-none">UK</div>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={regNumber}
                      onChange={handleRegChange}
                      placeholder="ENTER REG"
                      className="bg-yellow-400 border-none outline-none text-xl sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/60 px-3 sm:px-4 py-3 uppercase tracking-wider min-w-0"
                      maxLength={8}
                    />
                  </div>

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
              </div>

              {/* Right Column - Hero Image with Mascot */}
              <div className="relative">
                {/* Hero Image */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <OptimizedImage
                    src={bmwHeroImage}
                    alt="BMW extended warranty UK - Professional BMW warranty coverage with Miles the Panda"
                    className="w-full h-auto"
                    priority={true}
                    width={651}
                    height={434}
                  />
                  {/* Trustpilot Badge */}
                  <div className="absolute top-4 right-4">
                    <a 
                      href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:opacity-80 transition-opacity"
                    >
                      <OptimizedImage 
                        src={trustpilotExcellent} 
                        alt="Trustpilot Excellent Rating" 
                        className="h-auto w-28 sm:w-36 object-contain"
                        width={144}
                        height={61}
                      />
                    </a>
                  </div>
                </div>

                {/* Vehicle Type Tabs */}
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5">
                      <Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Cars</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Vans</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Hybrid</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">EV</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Bike className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Motorbikes</span>
                    </div>
                  </div>
                  
                  {/* Instant Activation Badge */}
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 rounded-md px-3 py-1.5 sm:px-3.5 sm:py-2 cursor-pointer">
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
          </div>
        </section>


        {/* Complete BMW Car Warranty Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Complete BMW Car Warranty.
              </h2>
              <h3 className="text-2xl sm:text-3xl font-bold text-brand-orange mb-3">
                Peace of Mind.
              </h3>
              <p className="text-lg text-gray-600">
                Superior Protection. Affordable Prices. Instant Cover.
              </p>
            </div>

            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                One Comprehensive Plan, Everything Included
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                No confusing tiers or hidden extras. Our BMW warranty covers all major mechanical and electrical components, plus roadside assistance and recovery.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Car, title: 'Engine & Gearbox', desc: 'Complete powertrain cover including turbos, timing chains, and dual-clutch systems' },
                { icon: Zap, title: 'Electrics & iDrive', desc: 'ECUs, sensors, infotainment, digital dash, and all electronic systems' },
                { icon: Shield, title: 'Hybrid & EV Systems', desc: 'Electric motors, battery management, inverters, and charging components' },
                { icon: Wrench, title: 'Suspension & Steering', desc: 'Air suspension, power steering, control arms, and wheel bearings' },
                { icon: Phone, title: '24/7 Roadside Assistance', desc: 'Breakdown recovery anywhere in the UK, day or night' },
                { icon: FileCheck, title: 'Labour Costs Included', desc: 'We pay the garage directly - no upfront costs for you' },
              ].map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 bg-brand-orange/10 rounded-xl flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-brand-orange" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Every BMW Part Covered Section */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full mb-4">
                <Shield className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-green-700">Full Coverage Details</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Every BMW Part Covered.<br />
                <span className="text-brand-orange">Drive Worry-Free</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                From engine to electrics, see exactly what's protected on your BMW.
              </p>
            </div>

            <div className={`grid md:grid-cols-2 lg:grid-cols-3 gap-6 ${!expandedCoverage ? 'max-h-[600px] overflow-hidden relative' : ''}`}>
              {coverageCategories.map((category, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <category.icon className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{category.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {category.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!expandedCoverage && (
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-blue-50 to-transparent pointer-events-none" />
              )}
            </div>

            <div className="text-center mt-8">
              <Button
                variant="outline"
                onClick={() => setExpandedCoverage(!expandedCoverage)}
                className="gap-2"
              >
                {expandedCoverage ? 'Show Less' : 'View All Coverage Details'}
                {expandedCoverage ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </section>

        {/* BMW Models Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                All BMW Models Covered
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Select your BMW model below to get an instant warranty quote.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-8 sticky top-0 bg-white py-4 z-10">
              <button
                onClick={() => setActiveModelFilter('All')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeModelFilter === 'All'
                    ? 'bg-brand-orange text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Models
              </button>
              {(Object.keys(bmwModelCategories) as ModelCategory[]).map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveModelFilter(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeModelFilter === category
                      ? 'bg-brand-orange text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Models Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {(activeModelFilter === 'All'
                ? Object.entries(bmwModelCategories).flatMap(([, models]) => Object.entries(models))
                : Object.entries(bmwModelCategories[activeModelFilter])
              ).map(([model, generations]) => (
                <button
                  key={model}
                  onClick={() => {
                    setSelectedModel(model);
                    scrollToQuoteForm();
                  }}
                  className={`group bg-white rounded-xl p-5 text-center border-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${
                    selectedModel === model
                      ? 'border-brand-orange shadow-md bg-orange-50'
                      : 'border-gray-100 hover:border-brand-orange'
                  }`}
                  aria-label={`BMW ${model}, chassis codes ${generations.join(', ')}`}
                >
                  {/* Model Icon */}
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-brand-orange/10 transition-colors">
                    <Car className="w-6 h-6 text-gray-600 group-hover:text-brand-orange transition-colors" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-brand-orange transition-colors">
                    BMW {model}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">
                    {generations.join(' • ')}
                  </p>
                </button>
              ))}
            </div>

            {/* Selected Model CTA */}
            {selectedModel && (
              <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                <Button
                  size="lg"
                  onClick={scrollToQuoteForm}
                  className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8"
                >
                  Get Warranty Quote for BMW {selectedModel} <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            )}

            <p className="text-center text-gray-500 mt-8 text-sm">
              <strong>Also covered:</strong> M-Sport variants, xDrive models, and plug-in hybrids
            </p>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Why BMW Owners Choose Us
              </h2>
              <p className="text-lg text-gray-600">
                Trusted by thousands of BMW drivers across the UK
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
                {[
                  { icon: ThumbsUp, title: 'Transparent Pricing', desc: 'No hidden fees or surprise charges. The price you see is the price you pay.' },
                  { icon: Users, title: 'UK Claims Team', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: MapPin, title: 'Nationwide Garage Network', desc: 'Use any VAT-registered garage across England, Scotland, Wales & Northern Ireland.' },
                  { icon: Car, title: 'Courtesy Car Available', desc: 'Keep moving while your BMW is being repaired with our courtesy car option.' },
                  { icon: Shield, title: 'Cancel Anytime', desc: 'No lock-in contracts. Cancel anytime and get a pro-rata refund.' },
                  { icon: Clock, title: 'Instant Cover', desc: 'Get covered immediately after purchase. No waiting periods for breakdown cover.' },
                ].map((benefit, index) => (
                  <div key={index} className="flex gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="w-12 h-12 bg-brand-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-6 h-6 text-brand-orange" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{benefit.title}</h3>
                      <p className="text-gray-600 text-sm">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Mascot - Miles the Panda */}
              <div className="hidden lg:flex justify-center items-end">
                <OptimizedImage 
                  src={pandaGarage}
                  alt="Miles the Panda - Your friendly BMW warranty guide"
                  className="w-72 h-auto object-contain drop-shadow-lg"
                  width={288}
                  height={300}
                />
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                How It Works
              </h2>
              <p className="text-lg text-gray-600">
                Get covered in 4 simple steps
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
              {[
                { step: 1, title: 'Enter Your Reg', desc: 'Pop your registration in and we\'ll look up your BMW details' },
                { step: 2, title: 'Get Instant Quote', desc: 'See your personalised price in seconds - no obligation' },
                { step: 3, title: 'Choose Your Plan', desc: 'Select claim limit and payment option that suits you' },
                { step: 4, title: 'You\'re Covered!', desc: 'Your warranty is active immediately. Drive with peace of mind' },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-brand-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Your BMW Cover Made Crystal Clear Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full mb-4">
                <Shield className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-green-700">Transparent Coverage</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Your BMW cover, made <span className="text-brand-orange">crystal clear</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                See what's included - clear terms, no jargon, no surprises.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No hidden catches</h3>
                <p className="text-gray-600 text-sm">What you see is what you get</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">14-day money-back guarantee</h3>
                <p className="text-gray-600 text-sm">Try risk-free</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center">
                <div className="text-4xl mb-4">⭐</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">94% of claims approved fast</h3>
                <p className="text-gray-600 text-sm">We pay when you need us</p>
              </div>
            </div>
          </div>
        </section>

        {/* High Mileage BMW Section */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="text-green-600 text-sm font-semibold uppercase tracking-wide mb-4">
                  High Mileage BMW, No Problem!
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                  Drive Your BMW With Confidence –<br />
                  <span className="text-brand-orange">You're Covered</span>
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  Once you have your BMW warranty, drive with complete peace of mind. If something 
                  goes wrong, simply call our claims team and we'll take care of everything.
                  We want to get you back on the road as soon as possible.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">Cover vehicles up to 150,000 miles</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">No mileage restrictions during cover</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">Unlimited claims value</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <OptimizedImage 
                  src={pandaMechanic}
                  alt="Miles the Panda mechanic - High mileage BMW warranty"
                  className="w-64 md:w-80 h-auto object-contain"
                  width={320}
                  height={320}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Additional BMW Cover Options Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Additional BMW Cover Options
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Enhance your BMW warranty with these optional extras
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Car className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Courtesy Car</h3>
                <p className="text-gray-600">Keep moving while your BMW is being repaired</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">European Cover</h3>
                <p className="text-gray-600">Extended protection when driving abroad</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Wear & Tear</h3>
                <p className="text-gray-600">Cover for gradual component deterioration</p>
              </div>
            </div>
          </div>
        </section>

        {/* UK Coverage Section */}
        <section className="py-16 bg-gradient-to-br from-blue-900 to-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                  Nationwide UK Coverage
                </h2>
                <p className="text-lg text-gray-300 mb-6">
                  Your BMW is covered wherever you drive in the United Kingdom. Our network of approved garages spans England, Scotland, Wales, and Northern Ireland.
                </p>
                <ul className="space-y-3">
                  {[
                    'Use any VAT-registered garage',
                    'No BMW dealer restrictions',
                    '24/7 roadside assistance UK-wide',
                    'Recovery to nearest approved garage',
                    'Claims handled by our UK team',
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-center">
                <OptimizedImage 
                  src={pandaThumbsUp}
                  alt="Miles the Panda giving thumbs up for UK-wide coverage"
                  className="w-48 md:w-64 h-auto object-contain mb-4"
                  width={256}
                  height={256}
                />
                <div className="inline-block bg-white/10 rounded-2xl px-8 py-4 backdrop-blur-sm">
                  <p className="text-xl font-bold">England • Scotland • Wales • N. Ireland</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                What BMW Owners Say
              </h2>
              <p className="text-lg text-gray-600">
                Real reviews from real BMW drivers
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                  <div className="flex gap-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4">"{testimonial.text}"</p>
                  <div className="border-t pt-4">
                    <p className="font-bold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.model} • {testimonial.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                BMW Warranty FAQs
              </h2>
              <p className="text-lg text-gray-600">
                Everything you need to know about BMW extended warranty
              </p>
            </div>

            <div className="space-y-4">
              {bmwFAQs.map((faq, index) => (
                <div key={index} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-6 text-left bg-white hover:bg-gray-50 transition-colors"
                    onClick={() => setOpenFaqId(openFaqId === index ? null : index)}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</h3>
                    {openFaqId === index ? (
                      <ChevronUp className="w-5 h-5 text-brand-orange flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {openFaqId === index && (
                    <div className="px-6 pb-6 text-gray-600">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-16 bg-gradient-to-br from-brand-orange to-orange-600 text-white relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Ready to Protect Your BMW?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Get an instant quote and find the perfect warranty for your BMW today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={scrollToQuoteForm}
                className="bg-white text-brand-orange hover:bg-gray-100 font-bold text-lg px-8"
              >
                Get My Instant Quote <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white/10 font-bold text-lg px-8"
                asChild
              >
                <a href="tel:08009179270">
                  <Phone className="mr-2 w-5 h-5" />
                  Call 0800 917 9270
                </a>
              </Button>
            </div>
            <p className="text-sm mt-8 opacity-75">
              Buy A Warranty arranges and administers warranty plans from trusted providers.<br />
              Not affiliated with BMW AG or BMW UK. Terms apply.
            </p>
          </div>
          
          {/* Mascot decoration - hidden on mobile */}
          <div className="hidden lg:block absolute bottom-0 right-8 z-0">
            <OptimizedImage 
              src={pandaMascot}
              alt="Miles the Panda mascot"
              className="w-48 h-auto object-contain opacity-90"
              width={192}
              height={200}
            />
          </div>
        </section>

        {/* Mobile Floating Actions */}
        {isMobile && (
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
            <a
              href="https://wa.me/447700161515"
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"
            >
              <img src={whatsappIconNew} alt="WhatsApp" className="w-7 h-7" />
            </a>
            <a
              href="tel:08009179270"
              className="w-14 h-14 bg-brand-orange rounded-full flex items-center justify-center shadow-lg hover:bg-brand-orange/90 transition-colors"
            >
              <Phone className="w-7 h-7 text-white" />
            </a>
          </div>
        )}
      </div>

      <WebsiteFooter />
    </>
  );
};

export default BMWWarrantyLanding;
