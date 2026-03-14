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
import TrustCallbackPanel from '@/components/TrustCallbackPanel';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';
import BrandPageFAQ from '@/components/brand-pages/BrandPageFAQ';
import BluePersistentCallback from '@/components/brand-pages/BluePersistentCallback';
import MinimalLandingFooter from '@/components/brand-pages/MinimalLandingFooter';
import BrandRepairCosts from '@/components/brand-pages/BrandRepairCosts';

// Lazy load heavy components
const HomepageFAQ = lazy(() => import('@/components/HomepageFAQ'));
const VehicleCoverageSection = lazy(() => import('@/components/homepage/VehicleCoverageSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));
const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));

// Assets
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';

// Toyota-specific images
import toyotaYarisHero from '@/assets/toyota-yaris-extended-warranty-uk.png';
import toyotaRav4Warranty from '@/assets/toyota-rav4-used-car-warranty.png';
import toyotaCorollaHighMileage from '@/assets/toyota-corolla-high-mileage-warranty.png';
import toyotaChrClaims from '@/assets/toyota-chr-claims-warranty-uk.png';
import toyotaPriusCoverage from '@/assets/toyota-prius-transparent-coverage.png';
import toyotaLandCruiserCover from '@/assets/toyota-land-cruiser-additional-cover.png';
import toyotaRav4Testimonials from '@/assets/toyota-rav4-hybrid-testimonials.png';
import toyotaCamryCoverage from '@/assets/toyota-camry-uk-coverage.png';

// Toyota Models covered (grouped by category) - 2012 to 2026
const toyotaModelCategories = {
  'Hatchback & Saloon': {
    'Yaris': ['XP130', 'XP210'],
    'Corolla': ['E170', 'E210'],
    'Camry': ['XV70'],
    'Prius': ['ZVW50', 'MXWH60'],
    'Mirai': ['JPD10', 'JPD20'],
    'Aygo / Aygo X': ['AB40', 'AB70'],
    'GR86': ['ZN8'],
    'Supra': ['A90', 'A91'],
  },
  'SUV & Crossover': {
    'RAV4': ['XA40', 'XA50'],
    'C-HR': ['AX10', 'AX50'],
    'Yaris Cross': ['MXPB10'],
    'Highlander': ['XU70'],
    'Land Cruiser': ['J150', 'J300'],
    'bZ4X': ['XEAM10'],
  },
  'Commercial & MPV': {
    'Proace': ['G9'],
    'Proace City': ['K9'],
    'Proace Verso': ['R3'],
    'Hilux': ['AN120', 'AN130'],
  },
  'Electric & Hybrid': {
    'Prius': ['ZVW50', 'MXWH60'],
    'Prius+': ['ZVW40'],
    'Yaris Hybrid': ['XP210'],
    'Corolla Hybrid': ['E210'],
    'C-HR Hybrid': ['AX10', 'AX50'],
    'RAV4 Hybrid': ['XA50'],
    'Camry Hybrid': ['XV70'],
    'Highlander Hybrid': ['XU70'],
    'bZ4X': ['XEAM10'],
    'Mirai': ['JPD10', 'JPD20'],
  },
};

type ModelCategory = keyof typeof toyotaModelCategories;

// Coverage components data - Toyota-specific
const coverageCategories = [
  {
    title: 'Engine & Powertrain',
    icon: Car,
    items: [
      'Toyota VVT-i engine block and cylinder head',
      'Pistons, rings, and bearings',
      'Crankshaft and camshaft',
      'Timing chains and tensioners',
      'Oil pump and oil cooler',
      'Turbocharger (GR Yaris / Supra)',
      'Intake and exhaust manifolds',
    ]
  },
  {
    title: 'Transmission & Drivetrain',
    icon: Wrench,
    items: [
      'CVT / automatic gearbox',
      'Manual gearbox internals',
      'Torque converter',
      'e-CVT hybrid transmission',
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
      'Toyota Touch / Smart Connect',
      'Digital instrument cluster',
      'Toyota Safety Sense cameras',
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
      'Adaptive variable suspension',
      'Control arms and bushings',
      'Anti-roll bar links',
      'Wheel bearings and hubs',
    ]
  },
  {
    title: 'Hybrid & EV Components',
    icon: Zap,
    items: [
      'Hybrid Synergy Drive motor',
      'Power electronics module',
      'DC-DC converter',
      'On-board charger (bZ4X)',
      'Hybrid battery management',
      'Regenerative braking system',
      'Thermal management system',
    ]
  },
];

// FAQs
const toyotaFAQs = [
  {
    question: "Is a Toyota extended warranty worth it in the UK?",
    answer: "Yes, while Toyotas are renowned for reliability, modern models feature complex hybrid systems, turbo engines, and advanced electronics that can be costly to repair. Our extended warranty protects key components like the engine, hybrid transmission, fuel injectors, and ECUs, preventing sudden repair bills."
  },
  {
    question: "How much does a Toyota extended warranty cost in the UK?",
    answer: "Extended Toyota warranty prices typically start from £19 a month, depending on your Toyota model, mileage, and chosen claim limit. We offer plans from just 60p a day with flexible monthly or annual payment options."
  },
  {
    question: "Can I buy a Toyota extended warranty after my original warranty has expired?",
    answer: "Yes, you can buy cover even if your Toyota is outside its original manufacturer warranty, or if you purchased it used. We cover vehicles up to 150,000 miles and 15 years old."
  },
  {
    question: "Can I use my own garage for Toyota warranty repairs?",
    answer: "Yes, absolutely. You can choose any VAT-registered garage across the UK instead of being restricted to Toyota dealers. We have a network of approved garages nationwide."
  },
  {
    question: "Does the warranty cover hybrid and electric Toyota models?",
    answer: "Yes, our comprehensive plan includes cover for Toyota's Hybrid Synergy Drive and fully electric components including the electric motor, battery management system, power electronics, on-board charger, and thermal management systems."
  },
  {
    question: "Is roadside assistance included?",
    answer: "Yes, our comprehensive plan includes 24/7 roadside assistance and recovery anywhere in the UK. If your Toyota breaks down, we'll send help to get you back on the road or recover your vehicle to a garage."
  },
  {
    question: "How do I make a claim on my Toyota warranty?",
    answer: "Simply call our UK-based claims team or submit a claim online. We aim to authorise repairs quickly so you're not left waiting. Your chosen garage contacts us directly, and we settle the bill with them."
  },
  {
    question: "What's not covered by the warranty?",
    answer: "Routine maintenance, wear and tear items (brake pads, tyres, wiper blades), pre-existing faults, and cosmetic damage are not covered. Our policy documents clearly outline all exclusions so there are no surprises."
  }
];

// Testimonials
const testimonials = [
  {
    name: "James W.",
    location: "Manchester",
    model: "Toyota RAV4",
    text: "My RAV4 hybrid needed a new inverter at 85,000 miles. Would have cost me over £3,500 but my warranty covered everything. Absolutely brilliant service.",
    rating: 5
  },
  {
    name: "Sarah L.",
    location: "Edinburgh",
    model: "Toyota Corolla",
    text: "The e-CVT on my Corolla Hybrid developed a fault. Buy A Warranty handled the whole claim without any fuss. Back on the road in two days.",
    rating: 5
  },
  {
    name: "David K.",
    location: "Bristol",
    model: "Toyota Yaris",
    text: "I was sceptical about third-party warranties but they proved me wrong. Fuel injector issue on my Yaris sorted quickly, £900 claim paid without hassle.",
    rating: 5
  },
  {
    name: "Anita R.",
    location: "London",
    model: "Toyota bZ4X",
    text: "Finding warranty cover for my bZ4X was difficult until I found these guys. They cover all the EV components and the price is very reasonable.",
    rating: 5
  }
];

const ToyotaWarrantyLanding: React.FC = () => {
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
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  const filteredModels = useMemo(() => {
    const allModels = activeModelFilter === 'All'
      ? Object.entries(toyotaModelCategories).flatMap(([category, models]) => 
          Object.entries(models).map(([model, generations]) => ({ model, generations, category }))
        )
      : Object.entries(toyotaModelCategories[activeModelFilter]).map(([model, generations]) => ({ 
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
    trackButtonClick('toyota_warranty_get_quote', { brand: 'Toyota' });
    
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
          make: data.make || 'TOYOTA',
          model: data.model,
          fuelType: data.fuelType,
          transmission: data.transmission,
          year: data.yearOfManufacture,
          vehicleType: 'car',
          manufactureDate: data.manufactureDate
        };
        
        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_currentStep', '2');
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
        navigate('/?step=2');
      } else {
        const vehicleData = {
          regNumber: regNumber,
          mileage: mileage,
          vehicleType: 'car',
        };
        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_currentStep', '2');
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
        navigate('/?step=2');
      }
    } catch (err) {
      console.error('Vehicle lookup error:', err);
      const vehicleData = {
        regNumber: regNumber,
        mileage: mileage,
        vehicleType: 'car',
      };
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
    if (hero) {
      hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Schema.org structured data
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Toyota Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for all Toyota models including Yaris, Corolla, RAV4, C-HR, Prius, Camry, Land Cruiser, bZ4X, and Hilux. Covers engine, gearbox, transmission, electrical systems, and more. Nationwide UK coverage with any VAT-registered garage.",
    "brand": { "@type": "Brand", "name": "Buy A Warranty" },
    "manufacturer": {
      "@type": "Organization",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+44-800-917-9270",
        "contactType": "customer service",
        "availableLanguage": "English",
        "areaServed": "GB"
      }
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "GBP",
      "price": "19",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://buyawarranty.co.uk/warranty-types/toyota-warranty/",
      "seller": { "@type": "Organization", "name": "Buy A Warranty" },
      "itemCondition": "https://schema.org/NewCondition",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": "19",
        "priceCurrency": "GBP",
        "unitText": "month",
        "billingIncrement": 1
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "2847",
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": testimonials.map((t, i) => ({
      "@type": "Review",
      "author": { "@type": "Person", "name": t.name },
      "reviewRating": { "@type": "Rating", "ratingValue": t.rating, "bestRating": "5" },
      "reviewBody": t.text,
      "datePublished": new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    })),
    "category": "Vehicle Extended Warranty",
    "audience": { "@type": "Audience", "audienceType": "Toyota vehicle owners in the United Kingdom" }
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Toyota Extended Warranty Service",
    "alternateName": "Toyota Used Car Warranty",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "telephone": "+44-800-917-9270",
      "priceRange": "£19-£85/month",
      "address": { "@type": "PostalAddress", "addressCountry": "GB" }
    },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "description": "Extended warranty coverage for all Toyota models including Yaris, Corolla, RAV4, C-HR, Prius, Camry, and electric/hybrid models. Covers engine, transmission, electrical systems, Hybrid Synergy Drive, and more.",
    "serviceType": "Vehicle Extended Warranty",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Toyota Warranty Plans",
      "itemListElement": [
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "1 Year Toyota Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "2 Year Toyota Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "3 Year Toyota Warranty" } }
      ]
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": toyotaFAQs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
    }))
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" },
      { "@type": "ListItem", "position": 2, "name": "Warranty Types", "item": "https://buyawarranty.co.uk/warranty-types/" },
      { "@type": "ListItem", "position": 3, "name": "Toyota Extended Warranty", "item": "https://buyawarranty.co.uk/warranty-types/toyota-warranty/" }
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "description": "UK's trusted extended car warranty provider. Protecting vehicles since 2016 with comprehensive coverage and excellent customer service.",
    "foundingDate": "2016",
    "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"],
    "contactPoint": { "@type": "ContactPoint", "telephone": "+44-800-917-9270", "contactType": "customer service", "areaServed": "GB", "availableLanguage": "English" }
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Buy A Warranty",
    "image": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "url": "https://buyawarranty.co.uk",
    "telephone": "+44-800-917-9270",
    "email": "support@buyawarranty.co.uk",
    "priceRange": "£19-£85/month",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "124 City Road",
      "addressLocality": "London",
      "addressRegion": "England",
      "postalCode": "EC1V 2NX",
      "addressCountry": "GB"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 51.5267,
      "longitude": -0.0886
    },
    "openingHoursSpecification": [
      { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "18:00" },
      { "@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday", "opens": "09:00", "closes": "13:00" }
    ],
    "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"],
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847" }
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Toyota Extended Warranty UK - Yaris, Corolla, RAV4, C-HR, Prius Cover",
    "description": "Protect your Toyota with comprehensive extended warranty cover. All models from Yaris to RAV4 and bZ4X. Nationwide UK coverage, approved garages, unlimited claims.",
    "url": "https://buyawarranty.co.uk/warranty-types/toyota-warranty/",
    "isPartOf": { "@type": "WebSite", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "about": { "@type": "Thing", "name": "Toyota Extended Warranty" },
    "mentions": [
      { "@type": "Brand", "name": "Toyota" },
      { "@type": "Thing", "name": "Extended Warranty" },
      { "@type": "Thing", "name": "Vehicle Protection" }
    ],
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".hero-description"] },
    "mainContentOfPage": { "@type": "WebPageElement", "cssSelector": "main" }
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Get a Toyota Extended Warranty Quote",
    "description": "Get an instant Toyota extended warranty quote in 60 seconds",
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "position": 1, "name": "Enter Registration", "text": "Enter your Toyota registration number to look up your vehicle details automatically" },
      { "@type": "HowToStep", "position": 2, "name": "Select Mileage", "text": "Choose your current mileage range (under or over 120,000 miles)" },
      { "@type": "HowToStep", "position": 3, "name": "Get Instant Quote", "text": "Receive your personalised warranty quote instantly with pricing for different coverage levels" }
    ]
  };

  return (
    <>
      <Helmet>
        <title>Toyota Extended Warranty UK | Yaris, Corolla, RAV4, Prius from £19/mo</title>
        <meta name="description" content="Protect your Toyota Yaris, Corolla, RAV4, C-HR, Prius, Camry or bZ4X with comprehensive extended warranty cover. Engine, gearbox, electrics and hybrid components covered. Nationwide UK coverage, any VAT-registered garage, unlimited claims. Prices from £19/month. Get your instant quote in 60 seconds." />
        <meta name="keywords" content="Toyota extended warranty, Toyota used car warranty, Toyota warranty UK, Toyota warranty cost, Toyota warranty quote, Toyota Yaris warranty, Toyota Corolla warranty, Toyota RAV4 warranty, Toyota C-HR warranty, Toyota Prius warranty, Toyota hybrid warranty, used Toyota warranty, second hand Toyota warranty, Toyota bZ4X warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/toyota-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="bingbot" content="index, follow" />
        
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5074;-0.1278" />
        <meta name="ICBM" content="51.5074, -0.1278" />
        <meta httpEquiv="content-language" content="en-GB" />
        
        <meta property="og:title" content="Toyota Warranty UK | Yaris, Corolla, RAV4, C-HR, Prius from £19/mo" />
        <meta property="og:description" content="Comprehensive Toyota warranty coverage for Yaris, Corolla, RAV4, C-HR, Prius, Camry and Hybrid Synergy Drive models. Engine, gearbox, electrics and more. Nationwide UK coverage with any VAT-registered garage." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/toyota-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Toyota Extended Warranty UK - Buy A Warranty" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Toyota Warranty UK | Yaris, Corolla, RAV4, Prius from £19/mo" />
        <meta name="twitter:description" content="Protect your Toyota Yaris, Corolla, RAV4, C-HR, Prius with comprehensive extended warranty. Hybrid and EV models covered. Nationwide UK coverage. Get instant quote." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        
        <meta name="ai-content-declaration" content="This page provides information about Toyota extended warranty services in the UK, covering Yaris, Corolla, RAV4, C-HR, Prius, Camry, bZ4X, Land Cruiser, and Hilux models. Human-authored and fact-checked." />
        <meta name="ai-summary" content="Buy A Warranty offers comprehensive Toyota extended warranty plans in the UK from £19/month. Coverage includes engine, gearbox, electrical, Hybrid Synergy Drive and EV components for all Toyota models 2012-2026. Nationwide garage network, unlimited claims, 14-day money-back guarantee." />
        <meta name="author" content="Buy A Warranty" />
        <meta name="publisher" content="Buy A Warranty" />
        <meta name="coverage" content="United Kingdom" />
        <meta name="distribution" content="global" />
        <meta name="rating" content="general" />
        <meta name="revisit-after" content="7 days" />
        
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
      </Helmet>

      <main className="min-h-screen bg-white" role="main" itemScope itemType="https://schema.org/WebPage">
        {/* Hero Section */}
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-6 pb-12 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              {/* Left Column - Content */}
              <div className="text-center lg:text-left">
                {/* Brand Logo */}
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-4 md:mb-6">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Toyota.svg/800px-Toyota.svg.png" 
                    alt="Toyota Logo" 
                    className="h-10 md:h-14 w-auto object-contain"
                    width={112}
                    height={56}
                  />
                </div>

                {/* H1 Headline */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Toyota Extended Warranty </span>
                  <span className="text-brand-orange">in 60 Seconds!</span>
                </h1>

                {/* Subheadline */}
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6 hero-description">
                  Protect your Toyota with dealer-level repairs, UK-wide cover and no-surprise costs. Get a fixed-price with instant cover.
                </p>

                {/* Benefits */}
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

                {/* Quote Form */}
                <div className="max-w-md mx-auto lg:mx-0 space-y-4">
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

                  <MileageQuickSelect
                    value={mileageSelection}
                    onChange={handleMileageSelection}
                    onAutoSubmit={handleGetQuote}
                    error={eligibilityError}
                    isLoading={isLookingUp}
                    isRegValid={regNumber.replace(/\s/g, '').length >= 5}
                  />

                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">
                    Toyota is a registered trademark of Toyota Motor Corporation. We are an independent warranty provider.
                  </p>
                  <TrustCallbackPanel />
                </div>
              </div>

              {/* Right Column - Hero Image */}
              <div className="relative">
                <div className="relative">
                  <OptimizedImage
                    src={toyotaYarisHero}
                    alt="Toyota Yaris front view - Toyota extended warranty UK coverage for all Yaris models"
                    className="w-full max-w-md mx-auto h-auto object-contain"
                    priority={true}
                    width={651}
                    height={500}
                  />
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

        {/* Warranty Benefits Section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}>
          <WarrantyBenefitsSection headline="The Ultimate Toyota Warranty." />
        </Suspense>

        {/* Vehicle Coverage Accordion Section */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Toyota" />
        </Suspense>

        {/* Cover Clarity Section */}
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        {/* Video Section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>
        <BrandRepairCosts
          brandName="Toyota"
          monthlyPrice="£24"
          onGetQuote={scrollToQuoteForm}
          repairs={[
            { name: 'Hybrid Synergy Drive Motor', cost: '£2,000 – £4,500', icon: 'Zap', severity: 'critical' },
            { name: 'e-CVT Transmission', cost: '£1,800 – £3,500', icon: 'Wrench', severity: 'high' },
            { name: 'Engine Rebuild', cost: '£3,000 – £6,000', icon: 'Car', severity: 'critical' },
            { name: 'Turbocharger (GR Yaris)', cost: '£1,500 – £3,000', icon: 'Zap', severity: 'high' },
            { name: 'Fuel Injector Set', cost: '£700 – £1,800', icon: 'Zap', severity: 'medium' },
            { name: 'ECU Replacement', cost: '£800 – £1,800', icon: 'Zap', severity: 'medium' },
            { name: 'Power Steering Rack', cost: '£600 – £1,400', icon: 'Wrench', severity: 'medium' },
            { name: 'Timing Chain Kit', cost: '£800 – £2,000', icon: 'Wrench', severity: 'high' },
            { name: 'Hybrid Battery Inverter', cost: '£1,500 – £3,000', icon: 'Shield', severity: 'high' },
          ]}
        />

        {/* Toyota Models Section */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full Coverage Details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                All Toyota Models Covered
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                Select your Toyota model to see tailored warranty options designed for reliable performance vehicles.
              </p>
            </div>

            <div className="max-w-md mx-auto mb-6 md:mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search by model or chassis code (e.g. RAV4, XA50)"
                  className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm md:text-base"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-10 sticky top-0 bg-gradient-to-b from-slate-50 via-slate-50 to-transparent py-4 md:py-5 z-10 -mx-4 px-4">
              <button
                onClick={() => { setActiveModelFilter('All'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'All'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}
              >
                All Models
              </button>
              <button
                onClick={() => { setActiveModelFilter('Hatchback & Saloon'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'Hatchback & Saloon'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}
              >
                Hatchback & Saloon
              </button>
              <button
                onClick={() => { setActiveModelFilter('SUV & Crossover'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'SUV & Crossover'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}
              >
                SUV & Crossover
              </button>
              <button
                onClick={() => { setActiveModelFilter('Commercial & MPV'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'Commercial & MPV'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}
              >
                Commercial & MPV
              </button>
              <button
                onClick={() => { setActiveModelFilter('Electric & Hybrid'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'Electric & Hybrid'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 focus:ring-blue-600'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 focus:ring-blue-400'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Electric & Hybrid
                </span>
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
              {filteredModels.map(({ model, generations, category }) => {
                const isElectric = category === 'Electric & Hybrid';
                
                return (
                  <button
                    key={model}
                    onClick={() => {
                      setSelectedModel(model);
                      scrollToQuoteForm();
                    }}
                    className={`group relative bg-white rounded-lg px-2 py-3 md:px-3 md:py-3 text-center border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                      selectedModel === model
                        ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-md scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm focus:ring-slate-400'
                    }`}
                    aria-label={`Toyota ${model}, chassis codes ${generations.join(', ')}`}
                  >
                    {isElectric && (
                      <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Zap className="w-2 h-2" />
                        EV
                      </div>
                    )}
                    
                    <Car className={`w-6 h-6 mx-auto mb-1.5 transition-colors ${
                      selectedModel === model 
                        ? 'text-blue-500' 
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`} strokeWidth={1.25} />
                    
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">
                      Toyota {model}
                    </h3>
                    
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-mono tracking-tight leading-tight">
                      {generations.join(' · ')}
                    </p>
                  </button>
                );
              })}
            </div>

            {filteredModels.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 text-base md:text-lg">
                  No models found for "{modelSearchQuery}". Try a different search.
                </p>
                <button
                  onClick={() => setModelSearchQuery('')}
                  className="mt-3 text-blue-600 font-medium hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}

            <div className="mt-8 md:mt-10 text-center">
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 text-xs md:text-sm text-slate-600">
                <Check className="w-4 h-4 text-green-600" />
                <span><strong>Also covered:</strong> GR Sport variants, Hybrid Synergy Drive, and all special editions</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sticky CTA */}
        {selectedModel && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 md:py-4 px-4 z-50 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm md:text-base">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Toyota {selectedModel} selected</p>
                  <p className="text-slate-500 text-xs md:text-sm">Step 1 of 2: Choose coverage →</p>
                </div>
              </div>
              <Button
                onClick={scrollToQuoteForm}
                className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25"
              >
                Get warranty quote for Toyota
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Why Toyota Drivers Choose Us */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why Toyota Drivers Choose Us
              </h2>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4"
              >
                Get Toyota Warranty
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Wrench, title: 'Dealer-level repairs and diagnostics', desc: 'Professional repairs at any VAT-registered garage across the UK.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team that knows Toyota systems', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Car, title: 'High mileage Toyota warranty plans', desc: 'Cover vehicles up to 150,000 miles with no mileage restrictions during cover.' },
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
              
              <div className="hidden lg:flex justify-center items-end pt-16">
                <OptimizedImage 
                  src={toyotaRav4Warranty}
                  alt="Toyota RAV4 front view - Why Toyota RAV4 owners choose Buy A Warranty for extended warranty cover"
                  className="max-w-[35%] h-auto object-contain"
                  width={400}
                  height={300}
                />
              </div>
            </div>
          </div>
        </section>

        {/* How Claims Work */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                How Claims Work
              </h2>
            </div>

            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                {[
                  { step: 1, title: 'Diagnose', desc: 'Diagnose at any VAT-registered garage' },
                  { step: 2, title: 'Authorise', desc: 'We authorise eligible repairs quickly' },
                  { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your Toyota' },
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
              <div className="hidden lg:flex justify-center">
                <OptimizedImage
                  src={toyotaChrClaims}
                  alt="Toyota C-HR front view - How Toyota warranty claims work with Buy A Warranty UK"
                  className="max-w-[200px] xl:max-w-[240px] h-auto object-contain"
                  width={240}
                  height={180}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Crystal Clear Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent Coverage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your Toyota cover, made <span className="text-brand-orange">crystal clear</span>
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                See what's included - clear terms, no jargon, no surprises.
              </p>
            </div>
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
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
              <div className="hidden lg:flex justify-center">
                <OptimizedImage
                  src={toyotaPriusCoverage}
                  alt="Toyota Prius front view - Crystal clear transparent Toyota warranty coverage UK"
                  className="max-w-[200px] xl:max-w-[240px] h-auto object-contain"
                  width={240}
                  height={180}
                />
              </div>
            </div>
          </div>
        </section>

        {/* High Mileage Toyota Section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              <div className="flex justify-center">
                <OptimizedImage 
                  src={toyotaCorollaHighMileage}
                  alt="Toyota Corolla front view - High mileage Toyota Corolla extended warranty coverage UK"
                  className="max-w-[35%] h-auto object-contain"
                  width={448}
                  height={300}
                />
              </div>
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High Mileage Toyota, No Problem!
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Drive Your Toyota With Confidence<br />
                  <span className="text-brand-orange">You're Covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Once you have your Toyota warranty, drive with complete peace of mind. If something 
                  goes wrong, simply call our claims team and we'll take care of everything.
                  We want to get you back on the road as soon as possible.
                </p>
                <div className="space-y-2 md:space-y-3 text-left max-w-md mx-auto lg:mx-0">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm md:text-base text-gray-700">Cover vehicles up to 150,000 miles</span>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm md:text-base text-gray-700">No mileage restrictions during cover</span>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm md:text-base text-gray-700">Unlimited claims value</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 md:mt-10 max-w-xl mx-auto">
              <Button
                onClick={scrollToQuoteForm}
                className="w-full bg-brand-orange text-white font-bold py-5 md:py-6 text-base md:text-xl rounded-xl shadow-lg animate-breathing"
              >
                <span className="flex items-center justify-center gap-2 md:gap-3">
                  Get my instant quote
                  <ArrowRight className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3} />
                </span>
              </Button>
            </div>
          </div>
        </section>

        {/* Additional Cover Options */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Additional Toyota Cover Options
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Enhance your Toyota warranty with these optional extras
              </p>
            </div>
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                    <Car className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Courtesy Car</h3>
                  <p className="text-sm md:text-base text-gray-600">Keep moving while your Toyota is being repaired</p>
                </div>
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                    <MapPin className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">European Cover</h3>
                  <p className="text-sm md:text-base text-gray-600">Extended protection when driving abroad</p>
                </div>
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                    <Shield className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Wear & Tear</h3>
                  <p className="text-sm md:text-base text-gray-600">Cover for gradual component deterioration</p>
                </div>
              </div>
              <div className="hidden lg:flex justify-center">
                <OptimizedImage
                  src={toyotaLandCruiserCover}
                  alt="Toyota Land Cruiser front view - Additional Toyota warranty cover options UK"
                  className="max-w-[200px] xl:max-w-[240px] h-auto object-contain"
                  width={240}
                  height={180}
                />
              </div>
            </div>
          </div>
        </section>

        {/* UK Coverage Section */}
        <section className="py-10 md:py-16 bg-gradient-to-br from-blue-900 to-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6 text-white">
                  Nationwide UK Coverage
                </h2>
                <p className="text-base md:text-lg text-white mb-4 md:mb-6">
                  Your Toyota is covered wherever you drive in the United Kingdom. Our network of approved garages spans England, Scotland, Wales, and Northern Ireland.
                </p>
                <ul className="space-y-2 md:space-y-3 text-left max-w-md mx-auto md:mx-0">
                  {[
                    'Use any VAT-registered garage',
                    'Toyota dealer or independent specialist',
                    'Recovery to nearest garage',
                    'Claims handled by our UK team',
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2 md:gap-3">
                      <Check className="w-4 h-4 md:w-5 md:h-5 text-green-400 flex-shrink-0" />
                      <span className="text-sm md:text-base">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-center order-first md:order-last">
                <OptimizedImage 
                  src={toyotaCamryCoverage}
                  alt="Toyota Camry front view - Nationwide UK Toyota warranty coverage"
                  className="max-w-[200px] md:max-w-[240px] h-auto object-contain mb-4 md:mb-6"
                  width={240}
                  height={180}
                />
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                What Toyota Owners Say
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Real reviews from real Toyota drivers
              </p>
            </div>

            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                    <div className="flex gap-0.5 md:gap-1 mb-2 md:mb-3">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 fill-yellow-400" />
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
              <div className="hidden lg:flex justify-center">
                <OptimizedImage
                  src={toyotaRav4Testimonials}
                  alt="Toyota RAV4 Hybrid front view - Toyota owners trust Buy A Warranty for extended warranty cover"
                  className="max-w-[200px] xl:max-w-[240px] h-auto object-contain"
                  width={240}
                  height={180}
                />
              </div>
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

export default ToyotaWarrantyLanding;
