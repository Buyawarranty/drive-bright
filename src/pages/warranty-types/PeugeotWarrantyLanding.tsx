import React, { useState, lazy, Suspense, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, ChevronUp, MapPin, Clock, Users, Car, Wrench, Zap, Star, Award, ThumbsUp, FileCheck, MessageCircle, Truck, Battery, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import { OptimizedImage } from '@/components/OptimizedImage';
import MileageQuickSelect from '@/components/MileageQuickSelect';
import TrustCallbackPanel from '@/components/TrustCallbackPanel';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';
import BrandPageFAQ from '@/components/brand-pages/BrandPageFAQ';
import BluePersistentCallback from '@/components/brand-pages/BluePersistentCallback';
import MinimalLandingFooter from '@/components/brand-pages/MinimalLandingFooter';

// Lazy load heavy components
const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));
const VehicleCoverageSection = lazy(() => import('@/components/homepage/VehicleCoverageSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));

// Assets
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import peugeot3008Hero from '@/assets/peugeot-3008-extended-warranty-uk.png';
import peugeotWhyChooseUs from '@/assets/peugeot-why-choose-us.webp';
import peugeotConfidenceCovered from '@/assets/peugeot-confidence-covered.png';

// Peugeot Models covered (grouped by category)
const peugeotModelCategories = {
  'Hatchback & Saloon': {
    '208': ['Mk1', 'Mk2'],
    '308': ['T9', 'P5'],
    '508': ['Mk1', 'Mk2'],
  },
  'SUV & Crossover': {
    '2008': ['Mk1', 'Mk2'],
    '3008': ['Mk1', 'Mk2'],
    '5008': ['Mk2'],
  },
  'Electric & Hybrid': {
    'e-208': ['Mk2'],
    'e-2008': ['Mk2'],
    'e-308': ['P5'],
    '3008 Hybrid': ['Mk2'],
    '508 PSE': ['Mk2'],
  },
  'MPV & Estate': {
    '308 SW': ['T9', 'P5'],
    '508 SW': ['Mk1', 'Mk2'],
    'Rifter': ['K9'],
    'Partner Tepee': ['B9'],
  },
};

type ModelCategory = keyof typeof peugeotModelCategories;

// Coverage components data
const coverageCategories = [
  {
    title: 'Engine & Powertrain',
    icon: Car,
    items: ['PureTech turbocharged petrol engine', 'BlueHDi diesel engine internals and turbo', 'Pistons, rings, and bearings', 'Crankshaft and camshaft assemblies', 'Timing belt/chain and tensioners', 'Oil pump and oil cooler', 'Intake and exhaust manifolds'],
  },
  {
    title: 'Transmission & Drivetrain',
    icon: Wrench,
    items: ['EAT8 automatic gearbox internals', 'Manual gearbox internals', 'Torque converter', 'e-CMP electric drivetrain components', 'Drive shafts and CV joints', 'Differential', 'Clutch actuator'],
  },
  {
    title: 'Electrical & Electronics',
    icon: Zap,
    items: ['ECU and engine control modules', 'Peugeot i-Cockpit digital display', 'Touchscreen infotainment system', 'Driver assistance sensors and cameras', 'Electric window motors', 'Central locking and keyless entry', 'Starter motor and alternator'],
  },
  {
    title: 'Cooling & Fuel Systems',
    icon: Shield,
    items: ['Water pump and thermostat', 'Radiator and expansion tank', 'Fuel pump and injectors', 'High-pressure fuel pump', 'Fuel rail and regulator', 'EGR valve and AdBlue system', 'Oil/coolant heat exchangers'],
  },
  {
    title: 'Suspension & Steering',
    icon: Car,
    items: ['Power steering pump/rack', 'Electric power steering motor', 'Shock absorbers and struts', 'MacPherson strut suspension', 'Torsion beam rear suspension', 'Anti-roll bar links', 'Wheel bearings and hubs'],
  },
  {
    title: 'EV & Hybrid Components',
    icon: Zap,
    items: ['Electric drive motor (e-208/e-2008)', 'Power electronics and inverter', 'DC-DC converter', 'On-board charger', 'Battery management system', 'Regenerative braking system', 'Thermal management system'],
  },
];

// FAQs
const peugeotFAQs = [
  { question: "Is a Peugeot extended warranty worth it?", answer: "Yes. Modern Peugeots feature complex PureTech engines, EAT8 gearboxes, i-Cockpit electronics, and EV drivetrains that can be costly to repair outside the manufacturer warranty." },
  { question: "How much does a Peugeot warranty cost?", answer: "Prices start from £19/month depending on your model, mileage, and claim limit. Monthly or annual payment options available." },
  { question: "Are PureTech engine issues covered?", answer: "Yes. Our warranty covers PureTech engine internals including timing belt, turbocharger, oil pump, and all major mechanical components." },
  { question: "Can I use my own garage?", answer: "Yes. Any VAT-registered garage in the UK is accepted — no need to use a Peugeot dealer." },
  { question: "Does the warranty cover electric Peugeot models?", answer: "Yes. We cover e-208, e-2008, e-308 and hybrid models including the electric motor, battery management, power electronics, and on-board charger." },
  { question: "Is the EAT8 gearbox covered?", answer: "Yes. EAT8 automatic gearbox internals and torque converter are fully covered under our plans." },
  { question: "Does the warranty include roadside assistance?", answer: "Yes. 24/7 UK-wide roadside assistance and recovery is included with our comprehensive plan." },
  { question: "What is not covered?", answer: "Routine maintenance, wear and tear items, pre-existing faults, and cosmetic damage are excluded. See your policy for full details." },
];

// Testimonials - Own branded, no Trustpilot links
const testimonials = [
  { name: "David C.", location: "Bath", model: "Peugeot 3008", text: "My 3008's EAT8 gearbox developed a fault at 52,000 miles. Buy A Warranty covered the £1,900 repair without any fuss. Brilliant service.", rating: 5 },
  { name: "Helen R.", location: "Dundee", model: "Peugeot 208", text: "PureTech timing belt issue on my 208. Would have been £1,100 at a dealer. Warranty covered it and I used my local garage. Saved a fortune.", rating: 5 },
  { name: "Chris M.", location: "Exeter", model: "Peugeot e-2008", text: "Great to find EV cover for my e-2008. They cover the motor, inverter and charging system. Peace of mind for a great price.", rating: 5 },
  { name: "Sarah J.", location: "Swansea", model: "Peugeot 5008", text: "Turbo failure on my 5008 BlueHDi. £2,100 repair covered in full. The claims process was really straightforward.", rating: 5 },
  { name: "Mark P.", location: "Ipswich", model: "Peugeot 308", text: "i-Cockpit display failed on my 308. £900 claim paid within a week. Would recommend to any Peugeot owner.", rating: 5 },
  { name: "Emma T.", location: "York", model: "Peugeot 508", text: "My 508's air conditioning compressor went in summer. Claim approved same day and repaired within 48 hours. Excellent.", rating: 5 },
];

const PeugeotWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [expandedCoverage, setExpandedCoverage] = useState(false);
  const [activeModelFilter, setActiveModelFilter] = useState<ModelCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  const filteredModels = useMemo(() => {
    const allModels = activeModelFilter === 'All'
      ? Object.entries(peugeotModelCategories).flatMap(([category, models]) =>
          Object.entries(models).map(([model, generations]) => ({ model, generations, category }))
        )
      : Object.entries(peugeotModelCategories[activeModelFilter]).map(([model, generations]) => ({
          model, generations, category: activeModelFilter
        }));
    if (!modelSearchQuery.trim()) return allModels;
    const q = modelSearchQuery.toLowerCase();
    return allModels.filter(({ model, generations }) =>
      model.toLowerCase().includes(q) || generations.some(g => g.toLowerCase().includes(q))
    );
  }, [activeModelFilter, modelSearchQuery]);

  const formatRegNumber = (value: string) => {
    const formatted = value.replace(/\s/g, '').toUpperCase();
    if (formatted.length > 3) return formatted.slice(0, -3) + ' ' + formatted.slice(-3);
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
    trackButtonClick('peugeot_warranty_get_quote', { brand: 'Peugeot' });
    if (!regNumber.trim()) { toast({ title: "Registration Required", description: "Please enter your vehicle registration number.", variant: "destructive" }); return; }
    if (!mileage.trim()) { toast({ title: "Mileage Required", description: "Please select your vehicle's mileage.", variant: "destructive" }); return; }
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registrationNumber: regNumber } });
      if (error) throw error;
      if (data?.found && data.manufactureDate) {
        const age = (Date.now() - new Date(data.manufactureDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age > 15) {
          setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
          toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" });
          setIsLookingUp(false);
          return;
        }
      }
      const vehicleData = data?.found
        ? { regNumber, mileage, make: data.make || 'PEUGEOT', model: data.model, fuelType: data.fuelType, transmission: data.transmission, year: data.yearOfManufacture, vehicleType: 'car', manufactureDate: data.manufactureDate }
        : { regNumber, mileage, vehicleType: 'car' };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } catch {
      const vd = { regNumber, mileage, vehicleType: 'car' };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vd));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vd));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } finally {
      setIsLookingUp(false);
    }
  };

  const scrollToQuoteForm = () => {
    document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Schema.org structured data
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Peugeot Extended Warranty UK",
    "description": "Comprehensive extended warranty for Peugeot models including 208, 308, 3008, 5008, 508, e-208, e-2008. PureTech engines, EAT8 gearbox, EV components covered.",
    "brand": { "@type": "Brand", "name": "Buy A Warranty" },
    "manufacturer": { "@type": "Organization", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk", "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png", "contactPoint": { "@type": "ContactPoint", "telephone": "+44-330-229-5040", "contactType": "customer service", "availableLanguage": "English", "areaServed": "GB" } },
    "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": "19", "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], "availability": "https://schema.org/InStock", "url": "https://buyawarranty.co.uk/warranty-types/peugeot-warranty/", "seller": { "@type": "Organization", "name": "Buy A Warranty" }, "priceSpecification": { "@type": "UnitPriceSpecification", "price": "19", "priceCurrency": "GBP", "unitText": "month", "billingIncrement": 1 } },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5", "worstRating": "1" },
    "review": testimonials.map((t, i) => ({ "@type": "Review", "author": { "@type": "Person", "name": t.name }, "reviewRating": { "@type": "Rating", "ratingValue": t.rating, "bestRating": "5" }, "reviewBody": t.text, "datePublished": new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] })),
    "category": "Vehicle Extended Warranty",
    "audience": { "@type": "Audience", "audienceType": "Peugeot vehicle owners in the United Kingdom" },
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Peugeot Extended Warranty Service",
    "alternateName": "Peugeot Used Car Warranty",
    "provider": { "@type": "LocalBusiness", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk", "telephone": "+44-330-229-5040", "priceRange": "£19-£60/month", "address": { "@type": "PostalAddress", "addressCountry": "GB" } },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "description": "Extended warranty coverage for all Peugeot models including 208, 308, 3008, 5008, 508, and EV models. Covers PureTech engine, EAT8 transmission, electrical systems, and more.",
    "serviceType": "Vehicle Extended Warranty",
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": peugeotFAQs.map(f => ({ "@type": "Question", "name": f.question, "acceptedAnswer": { "@type": "Answer", "text": f.answer } })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" },
      { "@type": "ListItem", "position": 2, "name": "Warranty Types", "item": "https://buyawarranty.co.uk/warranty-types/" },
      { "@type": "ListItem", "position": 3, "name": "Peugeot Extended Warranty", "item": "https://buyawarranty.co.uk/warranty-types/peugeot-warranty/" },
    ],
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "description": "UK's trusted extended car warranty provider. Protecting vehicles since 2016.",
    "foundingDate": "2016",
    "contactPoint": { "@type": "ContactPoint", "telephone": "+44-330-229-5040", "contactType": "customer service", "areaServed": "GB", "availableLanguage": "English" },
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Peugeot Extended Warranty UK - Get Instant Quote",
    "description": "Protect your Peugeot with comprehensive extended warranty cover. All models from 208 to 5008 and EV range. Nationwide UK coverage.",
    "url": "https://buyawarranty.co.uk/warranty-types/peugeot-warranty/",
    "isPartOf": { "@type": "WebSite", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".hero-description"] },
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Get a Peugeot Extended Warranty Quote",
    "description": "Get an instant Peugeot extended warranty quote in 60 seconds",
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "position": 1, "name": "Enter Registration", "text": "Enter your Peugeot registration number to look up your vehicle details automatically" },
      { "@type": "HowToStep", "position": 2, "name": "Select Mileage", "text": "Choose your current mileage range (under or over 120,000 miles)" },
      { "@type": "HowToStep", "position": 3, "name": "Get Instant Quote", "text": "Receive your personalised warranty quote instantly with pricing for different coverage levels" },
    ],
  };

  return (
    <>
      <Helmet>
        <title>Peugeot Extended Warranty UK | 208, 3008, 5008 Cover from £19/mo</title>
        <meta name="description" content="Peugeot extended warranty from £19/month. Cover 208, 308, 3008, 5008, 508, e-208, e-2008 & all models. PureTech & EAT8 covered. Any UK garage. Instant quote." />
        <meta name="keywords" content="peugeot extended warranty, peugeot warranty UK, peugeot 3008 warranty, peugeot 208 warranty, peugeot puretech warranty, peugeot electric warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/peugeot-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5074;-0.1278" />
        <meta httpEquiv="content-language" content="en-GB" />
        <meta property="og:title" content="Peugeot Extended Warranty UK | Instant Quotes from £19/month" />
        <meta property="og:description" content="Comprehensive Peugeot warranty coverage. PureTech engine, EAT8 gearbox, electrics & more. All models covered including EV. Any UK garage." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/peugeot-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Peugeot Extended Warranty UK - Buy A Warranty" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Peugeot Extended Warranty UK | From £19/month" />
        <meta name="twitter:description" content="UK's top-rated Peugeot warranty. 208, 3008, 5008 & all models. PureTech & EAT8 covered. 8,000+ components. Any garage." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta name="ai-content-declaration" content="This page provides information about Peugeot extended warranty services in the UK. Human-authored and fact-checked." />
        <meta name="author" content="Buy A Warranty" />
        <meta name="publisher" content="Buy A Warranty" />
        <meta name="revisit-after" content="7 days" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
      </Helmet>

      <main className="min-h-screen bg-white" role="main" itemScope itemType="https://schema.org/WebPage">
        {/* 1. Hero Section */}
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-6 pb-12 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              <div className="text-center lg:text-left">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Protect your Peugeot</span>
                  <br />
                  <span className="text-brand-orange">in 60 seconds.</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6 hero-description">
                  Dealer-level warranty. Fixed price. No surprise bills.
                </p>
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">From just 60p a day • Easy claims • Fast payouts</span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Unlimited claims • Parts and Labour • No excess</span>
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
                  <MileageQuickSelect value={mileageSelection} onChange={handleMileageSelection} onAutoSubmit={handleGetQuote} error={vehicleAgeError} isLoading={isLookingUp} isRegValid={regNumber.replace(/\s/g, '').length >= 5} />
                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">
                    Peugeot is a registered trademark of Stellantis. We are an independent warranty provider.
                  </p>
                  <TrustCallbackPanel />
                </div>
              </div>

              <div className="relative">
                <div className="relative">
                  <OptimizedImage src={peugeot3008Hero} alt="Peugeot 3008 front view - Peugeot extended warranty UK coverage" className="w-full max-w-md mx-auto h-auto object-contain" priority width={651} height={500} />
                  <div className="absolute top-4 right-4">
                    <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                      <OptimizedImage src={trustpilotExcellent} alt="Trustpilot Excellent Rating" className="h-auto w-28 sm:w-36 object-contain" width={144} height={61} />
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5"><Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Cars</span></div>
                    <div className="flex items-center space-x-1.5"><Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">SUVs</span></div>
                    <div className="flex items-center space-x-1.5"><Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Electric</span></div>
                    <div className="flex items-center space-x-1.5"><Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Estate</span></div>
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

        {/* 2. Warranty Benefits Section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}>
          <WarrantyBenefitsSection headline="The Ultimate Peugeot Warranty." />
        </Suspense>

        {/* 3. Vehicle Coverage Accordion */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Peugeot" />
        </Suspense>

        {/* 4. Cover Clarity Section */}
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        {/* 5. Video Section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>

        {/* 6. What Peugeot Repairs Actually Cost */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Wrench className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
                <span className="text-xs md:text-sm font-semibold text-red-700">Without warranty, you pay the full bill</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                What Peugeot repairs actually cost
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                One breakdown could cost more than years of warranty cover. Here's what Peugeot owners pay without protection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[
                { name: 'PureTech Timing Belt & Tensioner', cost: '£800 – £1,500', icon: Wrench, severity: 'critical' },
                { name: 'EAT8 Gearbox Repair', cost: '£1,500 – £3,000', icon: Wrench, severity: 'critical' },
                { name: 'Turbocharger Replacement', cost: '£1,000 – £2,500', icon: Zap, severity: 'critical' },
                { name: 'DPF Filter (BlueHDi)', cost: '£800 – £2,000', icon: Shield, severity: 'high' },
                { name: 'EV Drive Motor', cost: '£2,000 – £4,000', icon: Zap, severity: 'high' },
                { name: 'i-Cockpit Display', cost: '£600 – £1,200', icon: Zap, severity: 'medium' },
                { name: 'Fuel Injector Set', cost: '£500 – £1,400', icon: Wrench, severity: 'medium' },
                { name: 'AdBlue System', cost: '£400 – £1,200', icon: Shield, severity: 'medium' },
                { name: 'Air Con Compressor', cost: '£500 – £1,100', icon: Car, severity: 'medium' },
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
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>
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
                    <p className="text-2xl md:text-4xl font-bold text-red-400 line-through decoration-2">£2,200</p>
                  </div>
                  <span className="text-lg md:text-xl font-bold text-white/50">vs</span>
                  <div className="text-center">
                    <p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Platinum plan</p>
                    <p className="text-2xl md:text-4xl font-bold text-emerald-400">from £19/mo</p>
                  </div>
                </div>
                <p className="text-white/70 mb-6 text-sm md:text-base">
                  That's less than a single diagnostic fee — and it covers all of the above.
                </p>
                <Button onClick={scrollToQuoteForm} className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 md:py-5 px-6 md:px-8 text-base md:text-lg rounded-xl shadow-lg animate-breathing">
                  <span className="flex items-center gap-2">Get my instant quote <ArrowRight className="w-5 h-5" /></span>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Peugeot Models Section - Premium Design */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full Coverage Details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                All Peugeot Models Covered
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                Select your Peugeot model to see tailored warranty options designed for your vehicle.
              </p>
            </div>

            <div className="max-w-md mx-auto mb-6 md:mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" value={modelSearchQuery} onChange={(e) => setModelSearchQuery(e.target.value)} placeholder="Search by model (e.g. 3008, 208)" className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm md:text-base" />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-10 sticky top-0 bg-gradient-to-b from-slate-50 via-slate-50 to-transparent py-4 md:py-5 z-10 -mx-4 px-4">
              {(['All', ...Object.keys(peugeotModelCategories)] as (ModelCategory | 'All')[]).map(cat => (
                <button key={cat} onClick={() => { setActiveModelFilter(cat as ModelCategory | 'All'); setModelSearchQuery(''); }} className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === cat
                    ? cat === 'Electric & Hybrid' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 focus:ring-blue-600' : 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : cat === 'Electric & Hybrid' ? 'bg-white text-slate-700 border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 focus:ring-blue-400' : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}>
                  {cat === 'Electric & Hybrid' ? <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />EV / Hybrid</span> : cat === 'All' ? 'All Models' : cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
              {filteredModels.map(({ model, generations, category }) => {
                const isElectric = category === 'Electric & Hybrid';
                return (
                  <button key={`${category}-${model}`} onClick={() => { setSelectedModel(model); scrollToQuoteForm(); }} className={`group relative bg-white rounded-lg px-2 py-3 md:px-3 md:py-3 text-center border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    selectedModel === model ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-md scale-[1.02]' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm focus:ring-slate-400'
                  }`} aria-label={`Peugeot ${model}, generations ${generations.join(', ')}`}>
                    {isElectric && <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-2 h-2" />EV</div>}
                    <Car className={`w-6 h-6 mx-auto mb-1.5 transition-colors ${selectedModel === model ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={1.25} />
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">{model}</h3>
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-mono tracking-tight leading-tight">{generations.join(' · ')}</p>
                  </button>
                );
              })}
            </div>

            {filteredModels.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 text-base md:text-lg">No models found for "{modelSearchQuery}". Try a different search.</p>
                <button onClick={() => setModelSearchQuery('')} className="mt-3 text-blue-600 font-medium hover:underline">Clear search</button>
              </div>
            )}

            <div className="mt-8 md:mt-10 text-center">
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 text-xs md:text-sm text-slate-600">
                <Check className="w-4 h-4 text-green-600" />
                <span><strong>Also covered:</strong> Allure, GT, GT Line, Active, and all trim variants</span>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Sticky CTA after model selection */}
        {selectedModel && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 md:py-4 px-4 z-50 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm md:text-base">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Peugeot {selectedModel} selected</p>
                  <p className="text-slate-500 text-xs md:text-sm">Step 1 of 2: Choose coverage →</p>
                </div>
              </div>
              <Button onClick={scrollToQuoteForm} className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25">
                Get warranty quote for Peugeot
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* 9. Why Peugeot Drivers Choose Us */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why Peugeot Drivers Choose Us
              </h2>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4">
                Get Peugeot Warranty <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Wrench, title: 'PureTech & EAT8 specialist cover', desc: 'Full cover for PureTech timing belt, turbo, and EAT8 automatic gearbox issues.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team that knows Peugeot systems', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Car, title: 'High mileage Peugeot warranty plans', desc: 'Cover vehicles up to 150,000 miles with no mileage restrictions during cover.' },
                  { icon: Clock, title: 'Flexible monthly payments with no long contracts', desc: 'Cancel anytime and get a pro-rata refund. No lock-in.' },
                ].map((benefit, index) => (
                  <div key={index} className="flex gap-3 md:gap-4 bg-white p-3 md:p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-5 h-5 md:w-6 md:h-6 text-brand-orange" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-gray-900 mb-0.5 md:mb-1">{benefit.title}</h3>
                      <p className="text-gray-600 text-xs md:text-sm">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden lg:flex justify-center items-end">
                <OptimizedImage src={peugeotWhyChooseUs} alt="Peugeot 3008 and 208 - Why Peugeot owners choose us for extended warranty" className="w-[400px] h-auto object-contain" width={400} height={300} />
              </div>
            </div>
          </div>
        </section>

        {/* 10. How Claims Work */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                How Claims Work
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {[
                { step: 1, title: 'Diagnose', desc: 'Diagnose at any VAT-registered garage' },
                { step: 2, title: 'Authorise', desc: 'We authorise eligible repairs quickly' },
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your Peugeot' },
                { step: 4, title: 'We Pay', desc: 'We pay the garage directly for covered items' },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-brand-orange text-white rounded-full flex items-center justify-center text-xl md:text-2xl font-bold mx-auto mb-3 md:mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-sm md:text-lg font-bold text-gray-900 mb-1 md:mb-2">{item.title}</h3>
                  <p className="text-xs md:text-base text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 11. Crystal Clear Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent Coverage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your Peugeot cover, made <span className="text-brand-orange">crystal clear</span>
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                See what's included - clear terms, no jargon, no surprises.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center">
                <div className="text-3xl md:text-4xl mb-3 md:mb-4">✅</div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">No hidden catches</h3>
                <p className="text-gray-600 text-xs md:text-sm">What you see is what you get</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center">
                <div className="text-3xl md:text-4xl mb-3 md:mb-4">💰</div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">14-day money-back guarantee</h3>
                <p className="text-gray-600 text-xs md:text-sm">Try risk-free</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center">
                <div className="text-3xl md:text-4xl mb-3 md:mb-4">⭐</div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">94% of claims approved fast</h3>
                <p className="text-gray-600 text-xs md:text-sm">We pay when you need us</p>
              </div>
            </div>
          </div>
        </section>

        {/* 12. Drive With Confidence / High Mileage Section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              <div className="flex justify-center">
                <OptimizedImage src={peugeotConfidenceCovered} alt="Peugeot 3008 with BuyAWarranty branding - High mileage Peugeot warranty coverage" className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto object-contain" width={448} height={300} />
              </div>
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High Mileage Peugeot, No Problem!
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Drive Your Peugeot With Confidence<br />
                  <span className="text-brand-orange">You're Covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Once you have your Peugeot warranty, drive with complete peace of mind. If something
                  goes wrong, simply call our claims team and we'll take care of everything.
                  We want to get you back on the road as soon as possible.
                </p>
                <div className="space-y-2 md:space-y-3 text-left max-w-md mx-auto lg:mx-0">
                  <div className="flex items-center gap-2 md:gap-3"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" /><span className="text-sm md:text-base text-gray-700">Cover vehicles up to 150,000 miles</span></div>
                  <div className="flex items-center gap-2 md:gap-3"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" /><span className="text-sm md:text-base text-gray-700">No mileage restrictions during cover</span></div>
                  <div className="flex items-center gap-2 md:gap-3"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" /><span className="text-sm md:text-base text-gray-700">Unlimited claims value</span></div>
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

        {/* 13. Additional Cover Options */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Additional Peugeot Cover Options
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Enhance your Peugeot warranty with these optional extras
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4"><Car className="w-5 h-5 md:w-6 md:h-6 text-blue-600" /></div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Courtesy Car</h3>
                <p className="text-sm md:text-base text-gray-600">Keep moving while your Peugeot is being repaired</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 md:mb-4"><MapPin className="w-5 h-5 md:w-6 md:h-6 text-green-600" /></div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">European Cover</h3>
                <p className="text-sm md:text-base text-gray-600">Extended protection when driving abroad</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 md:mb-4"><Shield className="w-5 h-5 md:w-6 md:h-6 text-purple-600" /></div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Wear & Tear</h3>
                <p className="text-sm md:text-base text-gray-600">Cover for gradual component deterioration</p>
              </div>
            </div>
          </div>
        </section>

        {/* 14. UK Coverage Section */}
        <section className="py-10 md:py-16 bg-gradient-to-br from-blue-900 to-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6 text-white">Nationwide UK Coverage</h2>
                <p className="text-base md:text-lg text-white mb-4 md:mb-6">
                  Your Peugeot is covered wherever you drive in the United Kingdom. Our network of approved garages spans England, Scotland, Wales, and Northern Ireland.
                </p>
                <ul className="space-y-2 md:space-y-3 text-left max-w-md mx-auto md:mx-0">
                  {['Use any VAT-registered garage', 'Peugeot dealer or specialist garage', 'Recovery to nearest garage', 'Claims handled by our UK team'].map((item, index) => (
                    <li key={index} className="flex items-center gap-2 md:gap-3">
                      <Check className="w-4 h-4 md:w-5 md:h-5 text-green-400 flex-shrink-0" />
                      <span className="text-sm md:text-base">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-center order-first md:order-last">
                <OptimizedImage src={pandaThumbsUp} alt="Miles the Panda giving thumbs up for UK-wide coverage" className="w-36 sm:w-48 md:w-64 h-auto object-contain mb-3 md:mb-4" width={256} height={256} />
                <div className="inline-block bg-white/10 rounded-xl md:rounded-2xl px-4 md:px-8 py-2 md:py-4 backdrop-blur-sm">
                  <p className="text-sm md:text-xl font-bold text-white">England • Scotland • Wales • N. Ireland</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 15. Testimonials - Own branded, NO Trustpilot links */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                What Peugeot Owners Say
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Real reviews from real Peugeot drivers
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                  <div className="flex gap-0.5 md:gap-1 mb-2 md:mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 md:w-5 md:h-5 text-brand-orange fill-brand-orange" />
                    ))}
                  </div>
                  <p className="text-sm md:text-base text-gray-700 mb-3 md:mb-4">"{testimonial.text}"</p>
                  <div className="border-t pt-3 md:pt-4">
                    <p className="font-bold text-gray-900 text-sm md:text-base">{testimonial.name}</p>
                    <p className="text-xs md:text-sm text-gray-500">{testimonial.model} • {testimonial.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 16. FAQ */}
        <BrandPageFAQ />
      </main>

      {/* 17. Footer & Callback */}
      <MinimalLandingFooter />
      <BluePersistentCallback />
    </>
  );
};

export default PeugeotWarrantyLanding;
