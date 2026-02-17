import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, Car, Wrench, Zap, Star, Search } from 'lucide-react';
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
import BrandRepairCosts from '@/components/brand-pages/BrandRepairCosts';

import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import audiA4Hero from '@/assets/audi-a4-extended-warranty-uk.png';
import audiQ5Warranty from '@/assets/audi-q5-used-car-warranty.png';
import audiEtronWarranty from '@/assets/audi-etron-high-mileage-warranty.png';

const audiModelCategories = {
  'Saloon & Sportback': {
    'A3 Sportback': ['8V', '8Y'],
    'A4': ['B8', 'B9'],
    'A5 Sportback': ['F5'],
    'A6': ['C7', 'C8'],
    'A7 Sportback': ['4G', '4K'],
    'A8': ['D4', 'D5'],
  },
  'SUV & Crossover': {
    'Q2': ['GA'],
    'Q3': ['8U', 'F3'],
    'Q5': ['8R', 'FY'],
    'Q7': ['4M'],
    'Q8': ['4M'],
  },
  'Coupé & Convertible': {
    'A5 Coupé': ['F5'],
    'A5 Cabriolet': ['F5'],
    'TT': ['8S'],
    'TT RS': ['8S'],
    'R8': ['4S'],
  },
  'Electric & Hybrid': {
    'e-tron': ['GE'],
    'e-tron GT': ['F8'],
    'Q4 e-tron': ['F4'],
    'Q8 e-tron': ['GE'],
    'A6 TFSI e': ['C8'],
    'Q5 TFSI e': ['FY'],
  },
};

type ModelCategory = keyof typeof audiModelCategories;

const coverageCategories = [
  {
    title: 'Engine & Powertrain',
    icon: Car,
    items: [
      'Audi TFSI turbocharged petrol engine block and cylinder head',
      'TDI diesel engine internals and turbocharger',
      'Pistons, rings, and bearings',
      'Crankshaft and camshaft assemblies',
      'Timing chain and belt tensioners',
      'Oil pump and oil cooler',
      'Intake and exhaust manifolds',
    ]
  },
  {
    title: 'Transmission & Drivetrain',
    icon: Wrench,
    items: [
      'S tronic dual-clutch gearbox and mechatronics',
      'Tiptronic automatic gearbox internals',
      'Multitronic CVT (older models)',
      'Torque converter',
      'quattro all-wheel drive system and Haldex coupling',
      'Drive shafts and CV joints',
      'Differential (front & rear)',
    ]
  },
  {
    title: 'Electrical & Electronics',
    icon: Zap,
    items: [
      'ECU and engine control modules',
      'Audi Virtual Cockpit digital display',
      'MMI infotainment system',
      'Driver assistance sensors and cameras',
      'Electric window motors',
      'Central locking and keyless entry',
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
      'High-pressure fuel pump (TFSI / TDI)',
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
      'Adaptive air suspension (where fitted)',
      'Shock absorbers and struts',
      'Multi-link front and rear suspension',
      'Anti-roll bar links',
      'Wheel bearings and hubs',
    ]
  },
  {
    title: 'EV & Hybrid Components',
    icon: Zap,
    items: [
      'Electric drive motor (e-tron models)',
      'Power electronics module and inverter',
      'DC-DC converter',
      'On-board charger',
      'Battery management system (BMS)',
      'Regenerative braking system',
      'Thermal management and cooling system',
    ]
  },
];

const audiFAQs = [
  {
    question: "Is an Audi extended warranty worth it in the UK?",
    answer: "Yes. Audi vehicles feature complex TFSI/TDI engines, S tronic gearboxes, quattro drivetrains, and advanced electronics that can be very expensive to repair. An extended warranty protects you against unexpected bills that can easily exceed £2,000 for a single repair."
  },
  {
    question: "How much does an Audi extended warranty cost?",
    answer: "Extended Audi warranty prices start from £25 a month depending on your model, mileage, and chosen claim limit. We offer flexible monthly or annual plans."
  },
  {
    question: "Can I buy cover after the Audi manufacturer warranty expires?",
    answer: "Yes. We cover vehicles up to 150,000 miles and 15 years old, so you can get protection even after the Audi factory warranty has ended or if you purchased your Audi used."
  },
  {
    question: "Can I use my own garage for Audi warranty repairs?",
    answer: "Absolutely. You can choose any VAT-registered garage in the UK rather than being restricted to Audi dealers. This can save you significantly on labour rates."
  },
  {
    question: "Does the warranty cover electric and hybrid Audi models?",
    answer: "Yes. Our plans cover e-tron, e-tron GT, Q4 e-tron and TFSI e plug-in hybrid components including the electric motor, battery management system, power electronics, on-board charger, and thermal management."
  },
  {
    question: "Is the S tronic gearbox covered?",
    answer: "Yes, S tronic mechatronics and gearbox internals are fully covered. S tronic repairs can cost £1,500–£3,500, making warranty cover essential for Audi owners with dual-clutch automatics."
  },
  {
    question: "Does the warranty include roadside assistance?",
    answer: "Yes. Our comprehensive plan includes 24/7 UK-wide roadside assistance and recovery, so if your Audi breaks down, help is on the way."
  },
  {
    question: "What is not covered?",
    answer: "Routine maintenance, wear and tear items (brake pads, tyres, wiper blades), pre-existing faults, and cosmetic damage are excluded. Full exclusions are clearly listed in your policy document."
  }
];

const testimonials = [
  {
    name: "James H.",
    location: "Guildford",
    model: "A4",
    text: "My A4's S tronic gearbox developed a fault at 48,000 miles. The repair was quoted at £2,100 but my warranty covered the entire bill. **Outstanding service from start to finish.**",
    rating: 5
  },
  {
    name: "Claire W.",
    location: "Edinburgh",
    model: "Q5",
    text: "The turbo on my Q5 failed just outside Audi's warranty. Buy A Warranty handled the claim in three days and paid the garage directly. **Would recommend to any Audi owner.**",
    rating: 5
  },
  {
    name: "Tom P.",
    location: "Swindon",
    model: "e-tron",
    text: "Finding EV warranty cover for my e-tron was a nightmare until I found these guys. **They cover the electric motor, BMS and all the important bits.** Great peace of mind.",
    rating: 5
  },
  {
    name: "Rachel D.",
    location: "Falkirk",
    model: "A3",
    text: "My A3's MMI system failed at 5 years old — £1,100 to replace. **The warranty paid out in full within days.** Fantastic value for money.",
    rating: 5
  },
  {
    name: "Michael K.",
    location: "Bristol",
    model: "A6",
    text: "Air suspension issue on my A6 would have cost £1,800. The warranty team were professional and the claim was approved same day. **Couldn't be happier.**",
    rating: 5
  },
  {
    name: "Sophie L.",
    location: "Nottingham",
    model: "Q3",
    text: "My Q3 needed a new water pump and thermostat. **Claim was handled without any hassle** — they paid the garage directly. Will definitely renew.",
    rating: 5
  }
];

const AudiWarrantyLanding: React.FC = () => {
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
      ? Object.entries(audiModelCategories).flatMap(([category, models]) =>
          Object.entries(models).map(([model, generations]) => ({ model, generations, category }))
        )
      : Object.entries(audiModelCategories[activeModelFilter]).map(([model, generations]) => ({
          model, generations, category: activeModelFilter
        }));
    if (!modelSearchQuery.trim()) return allModels;
    const query = modelSearchQuery.toLowerCase();
    return allModels.filter(({ model, generations }) =>
      model.toLowerCase().includes(query) || generations.some(gen => gen.toLowerCase().includes(query))
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
    trackButtonClick('audi_warranty_get_quote', { brand: 'Audi' });
    if (!regNumber.trim()) { toast({ title: "Registration Required", description: "Please enter your vehicle registration number.", variant: "destructive" }); return; }
    if (!mileage.trim()) { toast({ title: "Mileage Required", description: "Please select your vehicle's mileage to continue.", variant: "destructive" }); return; }
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registrationNumber: regNumber } });
      if (error) throw error;
      if (data?.found) {
        if (data.manufactureDate) {
          const ageInMs = Date.now() - new Date(data.manufactureDate).getTime();
          if (ageInMs / (365.25 * 24 * 60 * 60 * 1000) > 15) {
            setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
            toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" });
            setIsLookingUp(false); return;
          }
        }
        const vehicleData = { regNumber, mileage, make: data.make || 'AUDI', model: data.model, fuelType: data.fuelType, transmission: data.transmission, year: data.yearOfManufacture, vehicleType: 'car', manufactureDate: data.manufactureDate };
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
    } catch {
      const vehicleData = { regNumber, mileage, vehicleType: 'car' };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } finally { setIsLookingUp(false); }
  };

  const scrollToQuoteForm = () => {
    const hero = document.getElementById('hero-section');
    if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const productSchema = {
    "@context": "https://schema.org", "@type": "Product",
    "name": "Audi Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for all Audi models including A3, A4, A5, A6, Q3, Q5, Q7, Q8, e-tron, e-tron GT, TT. Covers TFSI/TDI engines, S tronic gearbox, quattro drivetrain, MMI systems, EV components. Nationwide UK coverage.",
    "brand": { "@type": "Brand", "name": "Buy A Warranty" },
    "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": "25", "availability": "https://schema.org/InStock", "url": "https://buyawarranty.co.uk/warranty-types/audi/", "priceValidUntil": new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0] },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5" },
    "category": "Vehicle Extended Warranty"
  };

  const webPageSchema = {
    "@context": "https://schema.org", "@type": "WebPage",
    "name": "Audi Extended Warranty UK | Buy A Warranty",
    "description": "Comprehensive Audi extended warranty from £25/month covering A3, A4, Q5, e-tron and all models. S tronic, quattro and 8,000+ components covered. Any UK garage.",
    "url": "https://buyawarranty.co.uk/warranty-types/audi/",
    "lastReviewed": new Date().toISOString().split('T')[0],
    "reviewedBy": { "@type": "Organization", "name": "Buy A Warranty" },
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".faq-question"] },
    "publisher": { "@type": "Organization", "name": "Buy A Warranty", "legalName": "BUY A WARRANTY LIMITED", "url": "https://buyawarranty.co.uk" }
  };

  const localBusinessSchema = {
    "@context": "https://schema.org", "@type": "LocalBusiness",
    "name": "Buy A Warranty",
    "description": "UK's trusted Audi extended warranty provider since 2016. Comprehensive cover for all Audi models.",
    "url": "https://buyawarranty.co.uk",
    "telephone": "03302295040",
    "foundingDate": "2016",
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "priceRange": "£18-£60/month",
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5" }
  };

  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": audiFAQs.map(faq => ({ "@type": "Question", "name": faq.question, "acceptedAnswer": { "@type": "Answer", "text": faq.answer } })) };
  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" }, { "@type": "ListItem", "position": 2, "name": "Warranty Types", "item": "https://buyawarranty.co.uk/warranty-types/" }, { "@type": "ListItem", "position": 3, "name": "Audi Warranty", "item": "https://buyawarranty.co.uk/warranty-types/audi/" }] };

  const renderTestimonialText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/);
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);
  };

  return (
    <>
      <Helmet>
        <title>Audi Extended Warranty UK | A3, A4, Q5, e-tron Cover from £25/mo</title>
        <meta name="description" content="Audi extended warranty from £25/month. Cover A3, A4, A5, A6, Q3, Q5, Q7, Q8, e-tron, TT & all models 2012-2026. S tronic gearbox & quattro covered. Any UK garage. 8,000+ components. Instant quote in 60 seconds." />
        <meta name="keywords" content="audi extended warranty, audi warranty UK, audi a4 warranty, audi q5 warranty, audi a3 warranty, audi e-tron warranty, audi s tronic warranty, used audi warranty, audi car warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/audi/" />
        <meta property="og:title" content="Audi Extended Warranty UK | #1 Rated Audi Cover from £25/mo — A4, Q5, e-tron & S tronic Protection" />
        <meta property="og:description" content="Protect your Audi with the UK's top-rated extended warranty. All models covered. S tronic & quattro included. 8,000+ components. Any UK garage." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/audi/" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Audi Extended Warranty UK - Buy A Warranty" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Audi Extended Warranty UK | From £25/month" />
        <meta name="twitter:description" content="UK's #1 rated Audi warranty. All models 2012-2026. S tronic & quattro covered. 8,000+ components. Any garage." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <main itemScope itemType="https://schema.org/WebPage">
        {/* Hero Section */}
        <section id="hero-section" className="relative bg-gradient-to-br from-gray-50 via-white to-slate-50 pt-6 pb-10 md:pt-10 md:pb-16 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-sm font-medium">
                  <Shield className="h-4 w-4" /> Official Audi Extended Warranty Partner
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 leading-tight">
                  Audi Extended <span className="text-brand-orange">Warranty</span> UK
                </h1>
                <p className="text-base md:text-lg text-gray-600 max-w-xl">
                  Protect your Audi with comprehensive cover from just <strong>£25/month</strong>. All models from 2012 to 2026 including A3, A4, A6, Q5, Q7, e-tron & TT. S tronic & quattro covered. Use any UK garage.
                </p>

                <div className="bg-white rounded-2xl shadow-xl p-5 md:p-6 border border-gray-100">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="reg-input" className="block text-sm font-semibold text-gray-700 mb-1.5">Enter Your Registration</label>
                      <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-12 bg-blue-600 rounded-l-lg flex items-center justify-center"><span className="text-white text-xs font-bold">GB</span></div>
                        <input id="reg-input" type="text" value={regNumber} onChange={handleRegChange} placeholder="AB12 CDE" className="w-full pl-16 pr-4 py-3.5 text-xl font-bold uppercase tracking-wider bg-yellow-50 border-2 border-yellow-400 rounded-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 text-center" maxLength={8} aria-label="Vehicle registration number" />
                      </div>
                    </div>
                    <MileageQuickSelect value={mileageSelection} onChange={handleMileageSelection} />
                    {vehicleAgeError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{vehicleAgeError}</div>}
                    <Button onClick={handleGetQuote} disabled={isLookingUp} className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 text-lg rounded-xl shadow-lg animate-cta-enhanced" size="lg">
                      {isLookingUp ? <span className="flex items-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Looking up vehicle...</span> : <span className="flex items-center gap-2">Get My Free Quote <ArrowRight className="h-5 w-5" /></span>}
                    </Button>
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> No obligation</span>
                      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Instant quote</span>
                      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Cancel anytime</span>
                    </div>
                  </div>
                </div>
                <TrustCallbackPanel />
                <div className="flex items-center gap-3">
                  <OptimizedImage src={trustpilotExcellent} alt="Trustpilot Excellent Rating" className="h-10" width={120} height={40} />
                  <span className="text-sm text-gray-600">Rated <strong>Excellent</strong> by Audi owners</span>
                </div>
              </div>

              <div className="relative hidden lg:flex flex-col items-center justify-center">
                <div className="relative flex items-end justify-center gap-4">
                  <OptimizedImage src={audiA4Hero} alt="Audi A4 extended warranty UK" className="max-w-[35%] h-auto drop-shadow-2xl" priority width={269} height={179} />
                  <OptimizedImage src={pandaThumbsUp} alt="Buy A Warranty mascot" className="max-w-[25%] h-auto" priority width={192} height={192} />
                  <OptimizedImage src={audiQ5Warranty} alt="Audi Q5 used car warranty UK" className="max-w-[35%] h-auto drop-shadow-2xl" priority width={269} height={179} />
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div className="flex -space-x-1">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}</div>
                  <span className="text-sm font-medium text-gray-700">Trusted by thousands of Audi owners</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="bg-gray-900 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-white text-sm">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-green-400" /> 8,000+ Components</div>
              <div className="flex items-center gap-2"><Car className="h-4 w-4 text-blue-400" /> All Audi Models</div>
              <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-400" /> Any UK Garage</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-green-400" /> UK Claims Team</div>
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" /> quattro & EV Cover</div>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Why Choose Our Audi Warranty?</h2>
                <p className="text-gray-600">Audi vehicles use sophisticated TFSI/TDI engines, S tronic dual-clutch gearboxes, quattro all-wheel drive, and advanced electronics. While engineered to last, these systems can develop costly faults after the manufacturer warranty expires, with S tronic repairs alone costing over £2,000.</p>
                <div className="space-y-4">
                  {[
                    { icon: Shield, title: 'Comprehensive Cover', desc: 'Over 8,000 mechanical and electrical components protected on every plan' },
                    { icon: Wrench, title: 'Any UK Garage', desc: 'Choose any VAT-registered garage — not restricted to Audi dealers' },
                    { icon: Zap, title: 'Full EV & S tronic Coverage', desc: 'Complete cover for e-tron electric drivetrain plus S tronic gearbox and mechatronics' },
                    { icon: Phone, title: '24/7 Roadside Assistance', desc: 'Breakdown recovery included with comprehensive plans across the UK' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><item.icon className="h-5 w-5 text-gray-700" /></div>
                      <div><h3 className="font-semibold text-gray-900">{item.title}</h3><p className="text-sm text-gray-600">{item.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-center pt-16">
                <OptimizedImage src={audiEtronWarranty} alt="Audi e-tron electric car warranty UK" className="max-w-[60%] h-auto drop-shadow-xl rounded-xl" width={461} height={307} />
              </div>
            </div>
          </div>
        </section>

        <BrandRepairCosts brandName="Audi" monthlyPrice="£25" onGetQuote={scrollToQuoteForm} repairs={[
          { name: 'S tronic Gearbox & Mechatronics', cost: '£1,500 – £3,500', icon: 'Wrench', severity: 'critical' },
          { name: 'Turbocharger (TFSI/TDI)', cost: '£1,200 – £3,000', icon: 'Zap', severity: 'high' },
          { name: 'Engine Rebuild', cost: '£3,000 – £6,000', icon: 'Car', severity: 'critical' },
          { name: 'quattro Transfer Case', cost: '£1,200 – £2,800', icon: 'Wrench', severity: 'high' },
          { name: 'Air Suspension Strut', cost: '£800 – £2,000', icon: 'Car', severity: 'medium' },
          { name: 'MMI System Replacement', cost: '£800 – £1,500', icon: 'Zap', severity: 'medium' },
          { name: 'EV Drive Motor (e-tron)', cost: '£2,500 – £5,000', icon: 'Zap', severity: 'high' },
          { name: 'DPF Filter Replacement', cost: '£1,000 – £2,500', icon: 'Shield', severity: 'high' },
          { name: 'Fuel Injector Set', cost: '£800 – £2,000', icon: 'Wrench', severity: 'medium' },
        ]} />

        {/* Models Covered */}
        <section className="py-12 md:py-16 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Audi Models We Cover</h2>
              <p className="text-gray-600">All models from 2012 to 2026 · Up to 150,000 miles</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {(['All', ...Object.keys(audiModelCategories)] as (ModelCategory | 'All')[]).map(cat => (
                <button key={cat} onClick={() => setActiveModelFilter(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeModelFilter === cat ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{cat}</button>
              ))}
            </div>
            <div className="max-w-sm mx-auto mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" value={modelSearchQuery} onChange={e => setModelSearchQuery(e.target.value)} placeholder="Search Audi models..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-200" />
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {filteredModels.map(({ model, generations, category }) => (
                <button key={`${category}-${model}`} onClick={() => { setSelectedModel(selectedModel === model ? null : model); scrollToQuoteForm(); }} className={`group px-2 py-3 rounded-lg text-center transition-all border ${selectedModel === model ? 'border-gray-300 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
                  <Car className="h-6 w-6 mx-auto mb-1 text-slate-400 group-hover:text-slate-600" strokeWidth={1.25} />
                  <div className="text-[11px] sm:text-xs font-semibold text-gray-900 leading-tight">{model}</div>
                  <div className="text-[9px] sm:text-[10px] text-gray-500">{generations.join(' · ')}</div>
                  <div className="text-[8px] text-gray-400 mt-0.5">2012–2026</div>
                </button>
              ))}
            </div>
            {filteredModels.length === 0 && <p className="text-center text-gray-500 py-8">No models found matching "{modelSearchQuery}"</p>}
            <div className="text-center mt-8">
              <Button onClick={scrollToQuoteForm} className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8 py-3 rounded-xl shadow-lg">Get Your Audi Quote <ArrowRight className="ml-2 h-5 w-5" /></Button>
            </div>
          </div>
        </section>

        {/* Coverage */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What's Covered on Your Audi?</h2>
              <p className="text-gray-600">Comprehensive protection for all major Audi systems</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coverageCategories.slice(0, expandedCoverage ? undefined : 3).map((cat, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><cat.icon className="h-5 w-5 text-gray-700" /></div>
                    <h3 className="font-bold text-gray-900">{cat.title}</h3>
                  </div>
                  <ul className="space-y-2">{cat.items.map((item, j) => <li key={j} className="flex items-start gap-2 text-sm text-gray-600"><Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />{item}</li>)}</ul>
                </div>
              ))}
            </div>
            {!expandedCoverage && <div className="text-center mt-6"><Button variant="outline" onClick={() => setExpandedCoverage(true)} className="gap-2">Show All Coverage <ChevronDown className="h-4 w-4" /></Button></div>}
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-12 md:py-16 bg-gradient-to-br from-gray-50 to-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What Audi Owners Say</h2>
              <div className="flex items-center justify-center gap-2">
                <div className="flex -space-x-1">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-[#00b67a] text-[#00b67a]" />)}</div>
                <span className="text-sm text-gray-600">Rated Excellent on Trustpilot</span>
              </div>
            </div>
            <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>
              {testimonials.map((t, i) => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                  <div className="flex gap-1 mb-3">{[...Array(t.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-[#00b67a] text-[#00b67a]" />)}</div>
                  <p className="text-gray-700 text-sm mb-4">"{renderTestimonialText(t.text)}"</p>
                  <div><p className="font-semibold text-gray-900 text-sm">{t.name}</p><p className="text-xs text-gray-500">{t.model} · {t.location}</p></div>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline text-sm font-medium">Read all reviews on Trustpilot →</a>
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

export default AudiWarrantyLanding;
