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
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';

// MG-specific images
import mgZsHero from '@/assets/mg-zs-extended-warranty-uk.png';
import mgHsWarranty from '@/assets/mg-hs-used-car-warranty.png';
import mgFourHighMileage from '@/assets/mg-4-high-mileage-warranty.png';

// MG Models covered (grouped by category) - 2012 to 2026
const mgModelCategories = {
  'Hatchback & Saloon': {
    'MG3': ['Mk1', 'Mk2'],
    'MG6': ['Mk1'],
    'MG 4': ['Mk1'],
    'MG 4 XPower': ['Mk1'],
  },
  'SUV & Crossover': {
    'MG ZS': ['Mk1', 'Mk2'],
    'MG ZS EV': ['Mk1', 'Mk2'],
    'MG HS': ['Mk1'],
    'MG HS PHEV': ['Mk1'],
    'MG VS': ['Mk1'],
  },
  'Electric': {
    'MG 4': ['Standard', 'Long Range', 'Trophy', 'XPower'],
    'MG ZS EV': ['Standard Range', 'Long Range'],
    'MG 5 EV': ['Mk1', 'Long Range'],
    'MG Cyberster': ['Mk1'],
    'MG HS PHEV': ['Mk1'],
  },
  'Estate & Tourer': {
    'MG 5 EV': ['Mk1', 'Long Range'],
    'MG GS': ['Mk1'],
  },
};

type ModelCategory = keyof typeof mgModelCategories;

// Coverage components data - MG-specific
const coverageCategories = [
  {
    title: 'Engine & Powertrain',
    icon: Car,
    items: [
      'MG turbocharged petrol engine block and cylinder head',
      'Pistons, rings, and bearings',
      'Crankshaft and camshaft assemblies',
      'Timing chains and tensioners',
      'Oil pump and oil cooler',
      'Turbocharger assembly (HS Turbo)',
      'Intake and exhaust manifolds',
    ]
  },
  {
    title: 'Transmission & Drivetrain',
    icon: Wrench,
    items: [
      'MG automatic CVT gearbox',
      'Manual gearbox internals',
      'Dual-clutch automatic (DCT)',
      'Single-speed EV reduction gearbox',
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
      'MG iSMART connected car system',
      'Digital instrument cluster',
      'ADAS cameras and sensors (MG Pilot)',
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
      'High-pressure fuel pump (turbo models)',
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
      'MacPherson strut front suspension',
      'Control arms and bushings',
      'Anti-roll bar links',
      'Wheel bearings and hubs',
    ]
  },
  {
    title: 'EV & Hybrid Components',
    icon: Zap,
    items: [
      'Electric drive motor (MG 4 / ZS EV / MG 5 EV)',
      'Power electronics module and inverter',
      'DC-DC converter',
      'On-board charger',
      'Battery management system (BMS)',
      'Regenerative braking system',
      'Thermal management and cooling system',
    ]
  },
];

// FAQs
const mgFAQs = [
  {
    question: "Is an MG extended warranty worth it in the UK?",
    answer: "Yes, modern MG vehicles feature advanced EV powertrains, turbocharged engines, iSMART connected systems, and MG Pilot ADAS technology that can be costly to repair outside of the manufacturer warranty. Our extended warranty protects key components including electric motors, battery management systems, turbochargers, gearboxes, and ECUs, preventing unexpected repair bills."
  },
  {
    question: "How much does an MG extended warranty cost in the UK?",
    answer: "Extended MG warranty prices typically start from £24 a month, depending on your MG model, mileage, and chosen claim limit. We offer plans from just 80p a day with flexible monthly or annual payment options."
  },
  {
    question: "Can I buy an MG extended warranty after my manufacturer warranty has expired?",
    answer: "Yes, you can buy cover even if your MG's original manufacturer warranty has expired, or if you purchased it used. We cover vehicles up to 150,000 miles and 15 years old, giving MG owners peace of mind beyond the factory warranty."
  },
  {
    question: "Can I use my own garage for MG warranty repairs?",
    answer: "Yes, absolutely. You can choose any VAT-registered garage across the UK instead of being restricted to MG dealers. We have a network of approved garages nationwide."
  },
  {
    question: "Does the warranty cover electric MG models like the MG 4 and ZS EV?",
    answer: "Yes, our comprehensive plan includes cover for MG's electric components including the MG 4, ZS EV, and MG 5 EV electric motors, battery management systems, power electronics, on-board chargers, DC-DC converters, and thermal management systems."
  },
  {
    question: "Is roadside assistance included?",
    answer: "Yes, our comprehensive plan includes 24/7 roadside assistance and recovery anywhere in the UK. If your MG breaks down, we'll send help to get you back on the road or recover your vehicle to a garage."
  },
  {
    question: "How do I make a claim on my MG warranty?",
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
    name: "James P.",
    location: "Manchester",
    model: "MG ZS",
    text: "My MG ZS needed a new turbo at 48,000 miles. Would have cost me over £1,800 but my warranty covered everything. Fantastic service from start to finish.",
    rating: 5
  },
  {
    name: "Rachel K.",
    location: "Bristol",
    model: "MG HS",
    text: "The automatic gearbox on my HS developed a fault outside the manufacturer warranty. Buy A Warranty handled the whole claim without any hassle. Really impressed.",
    rating: 5
  },
  {
    name: "Tom S.",
    location: "Edinburgh",
    model: "MG 4",
    text: "Finding warranty cover for my MG 4 electric was tricky until I found these guys. They cover all the EV components and the price is very competitive.",
    rating: 5
  },
  {
    name: "Laura W.",
    location: "London",
    model: "MG ZS EV",
    text: "I wanted peace of mind for my ZS EV after the factory warranty. These guys cover all the electric drivetrain components. Very happy with the cover.",
    rating: 5
  }
];

const MGWarrantyLanding: React.FC = () => {
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
      ? Object.entries(mgModelCategories).flatMap(([category, models]) => 
          Object.entries(models).map(([model, generations]) => ({ model, generations, category }))
        )
      : Object.entries(mgModelCategories[activeModelFilter]).map(([model, generations]) => ({ 
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
    trackButtonClick('mg_warranty_get_quote', { brand: 'MG' });
    
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
          make: data.make || 'MG',
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
    "name": "MG Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for all MG models including ZS, HS, MG 4, MG 5 EV, ZS EV, MG3, and Cyberster. Covers engine, turbo, gearbox, electrical systems, EV drivetrain components. Nationwide UK coverage with any VAT-registered garage.",
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
      "price": "24",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://buyawarranty.co.uk/warranty-types/mg-warranty/",
      "seller": { "@type": "Organization", "name": "Buy A Warranty" },
      "itemCondition": "https://schema.org/NewCondition",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": "24",
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
    "audience": { "@type": "Audience", "audienceType": "MG vehicle owners in the United Kingdom" }
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "MG Extended Warranty Service",
    "alternateName": "MG Used Car Warranty",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "telephone": "+44-800-917-9270",
      "priceRange": "£24-£85/month",
      "address": { "@type": "PostalAddress", "addressCountry": "GB" }
    },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "description": "Extended warranty coverage for all MG models including ZS, HS, MG 4, MG 5 EV, ZS EV, and Cyberster. Covers turbocharged engines, automatic gearboxes, iSMART systems, and EV/PHEV components.",
    "serviceType": "Vehicle Extended Warranty",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "MG Warranty Plans",
      "itemListElement": [
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Basic MG Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Gold MG Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Platinum MG Warranty" } }
      ]
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": mgFAQs.map(faq => ({
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
      { "@type": "ListItem", "position": 3, "name": "MG Warranty", "item": "https://buyawarranty.co.uk/warranty-types/mg-warranty/" }
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+44-330-229-5040",
      "contactType": "customer service",
      "areaServed": "GB",
      "availableLanguage": "English"
    }
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://buyawarranty.co.uk/#localbusiness",
    "name": "Buy A Warranty",
    "description": "UK's leading MG extended warranty provider offering flexible, affordable vehicle protection with instant quotes and no hidden fees.",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "image": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "telephone": "+443302295040",
    "email": "support@buyawarranty.co.uk",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "71-75 Shelton Street",
      "addressLocality": "London",
      "addressRegion": "Greater London",
      "postalCode": "WC2H 9JQ",
      "addressCountry": "GB"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 51.5142,
      "longitude": -0.1267
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "09:00",
      "closes": "17:30"
    },
    "priceRange": "££",
    "currenciesAccepted": "GBP",
    "paymentAccepted": "Credit Card, Debit Card, Bank Transfer",
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.7",
      "reviewCount": "30",
      "bestRating": "5",
      "worstRating": "1"
    },
    "knowsAbout": ["MG Warranty", "MG Extended Warranty", "MG Used Car Warranty", "MG EV Warranty", "Vehicle Warranty"],
    "foundingDate": "2016",
    "legalName": "BUY A WARRANTY LIMITED"
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Get an MG Extended Warranty Quote",
    "description": "Get an MG extended warranty quote in under 60 seconds",
    "step": [
      { "@type": "HowToStep", "position": 1, "name": "Enter Registration", "text": "Enter your MG's registration number" },
      { "@type": "HowToStep", "position": 2, "name": "Select Mileage", "text": "Choose your current mileage band" },
      { "@type": "HowToStep", "position": 3, "name": "Choose Plan", "text": "Select from Basic, Gold, or Platinum cover" },
      { "@type": "HowToStep", "position": 4, "name": "Get Protected", "text": "Complete your purchase and get instant cover" }
    ]
  };

  const LazySection = ({ children }: { children: React.ReactNode }) => (
    <Suspense fallback={<div className="min-h-[200px]" />}>
      {children}
    </Suspense>
  );

  return (
    <>
      <Helmet>
        <title>MG Extended Warranty UK | ZS, HS, MG 4, MG 5 EV Cover from £24/mo</title>
        <meta name="description" content="MG extended warranty from £24/month. Cover ZS, HS, MG 4, MG 5 EV, ZS EV, MG3, Cyberster & all models 2012-2026. Use any UK garage. 8,000+ components covered. Instant quote in 60 seconds." />
        <meta name="keywords" content="MG extended warranty, MG warranty UK, MG ZS warranty, MG HS warranty, MG 4 warranty, MG 5 EV warranty, MG ZS EV warranty, MG3 warranty, MG Cyberster warranty, used MG warranty, MG car warranty, MG electric car warranty, MG PHEV warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/mg-warranty/" />
        
        {/* Open Graph */}
        <meta property="og:title" content="MG Extended Warranty UK | Best-Rated MG Cover from £24/mo – ZS, HS, MG 4 & EV Models" />
        <meta property="og:description" content="Protect your MG with the UK's top-rated extended warranty. Cover ZS, HS, MG 4, MG 5 EV, ZS EV & all models. 8,000+ components. Any UK garage. Instant quote." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/mg-warranty/" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="MG Extended Warranty UK - Buy A Warranty" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MG Extended Warranty UK | From £24/month" />
        <meta name="twitter:description" content="UK's #1 rated MG warranty. Cover all models from 2012-2026. 8,000+ components. Any garage. Instant quote." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />

        {/* AI & Bot directives */}
        <meta name="ai-content-declaration" content="This page provides genuine MG extended warranty information for UK vehicle owners" />
        <meta name="ai-summary" content="Buy A Warranty offers MG extended warranties from £24/month covering 8,000+ components for all models 2012-2026 including ZS, HS, MG 4, MG 5 EV, ZS EV, MG3, and Cyberster. UK-based claims team, any VAT-registered garage, 24/7 roadside assistance. Full EV and PHEV component coverage." />
        <meta name="author" content="Buy A Warranty" />
        <meta name="publisher" content="Buy A Warranty" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta name="bingbot" content="index, follow" />

        {/* Geo targeting */}
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5142;-0.1267" />
        <meta name="ICBM" content="51.5142, -0.1267" />

        {/* Schema.org JSON-LD */}
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
      </Helmet>

      <main itemScope itemType="https://schema.org/WebPage">
        {/* Hero Section */}
        <section id="hero-section" className="relative bg-gradient-to-br from-red-50 via-white to-orange-50 pt-6 pb-10 md:pt-10 md:pb-16 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left Content */}
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-medium">
                  <Shield className="h-4 w-4" />
                  Official MG Extended Warranty Partner
                </div>
                
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 leading-tight hero-description">
                  MG Extended <span className="text-brand-orange">Warranty</span> UK
                </h1>
                
                <p className="text-base md:text-lg text-gray-600 max-w-xl hero-description">
                  Protect your MG with comprehensive cover from just <strong>£24/month</strong>. All models from 2012–2026 including ZS, HS, MG 4, MG 5 EV & ZS EV. Use any UK garage.
                </p>

                {/* Quote Form */}
                <div className="bg-white rounded-2xl shadow-xl p-5 md:p-6 border border-gray-100">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="reg-input" className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Enter Your Registration
                      </label>
                      <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-12 bg-blue-600 rounded-l-lg flex items-center justify-center">
                          <span className="text-white text-xs font-bold">GB</span>
                        </div>
                        <input
                          id="reg-input"
                          type="text"
                          value={regNumber}
                          onChange={handleRegChange}
                          placeholder="AB12 CDE"
                          className="w-full pl-16 pr-4 py-3.5 text-xl font-bold uppercase tracking-wider bg-yellow-50 border-2 border-yellow-400 rounded-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 text-center"
                          maxLength={8}
                          aria-label="Vehicle registration number"
                        />
                      </div>
                    </div>

                    <MileageQuickSelect
                      value={mileageSelection}
                      onChange={handleMileageSelection}
                    />

                    {eligibilityError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {eligibilityError}
                      </div>
                    )}

                    <Button
                      onClick={handleGetQuote}
                      disabled={isLookingUp}
                      className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 text-lg rounded-xl shadow-lg animate-cta-enhanced"
                      size="lg"
                    >
                      {isLookingUp ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Looking up vehicle...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Get My Free Quote <ArrowRight className="h-5 w-5" />
                        </span>
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> No obligation</span>
                      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Instant quote</span>
                      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Cancel anytime</span>
                    </div>
                  </div>
                </div>

                <TrustCallbackPanel />

                {/* Trustpilot */}
                <div className="flex items-center gap-3">
                  <OptimizedImage src={trustpilotExcellent} alt="Trustpilot Excellent Rating" className="h-10" width={120} height={40} />
                  <span className="text-sm text-gray-600">Rated <strong>Excellent</strong> by MG owners</span>
                </div>
              </div>

              {/* Right Column - Hero Image */}
              <div className="relative">
                <div className="relative">
                  <OptimizedImage 
                    src={mgZsHero}
                    alt="MG ZS extended warranty UK - front view"
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
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Hatchbacks</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">SUVs</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Electric</span>
                    </div>
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

        {/* Trust Bar */}
        <section className="bg-gray-900 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-white text-sm">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-green-400" /> 8,000+ Components</div>
              <div className="flex items-center gap-2"><Car className="h-4 w-4 text-blue-400" /> All MG Models</div>
              <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-400" /> Any UK Garage</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-green-400" /> UK Claims Team</div>
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" /> EV & PHEV Cover</div>
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Why Choose Our MG Warranty?
                </h2>
                <p className="text-gray-600">
                  MG has transformed into one of the UK's best-selling brands with affordable EVs and SUVs, but their advanced electric drivetrains, turbocharged engines, and iSMART connected systems can still develop costly faults after the manufacturer warranty expires.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: Shield, title: 'Comprehensive Cover', desc: 'Over 8,000 mechanical and electrical components protected on every plan' },
                    { icon: Wrench, title: 'Any UK Garage', desc: 'Choose any VAT-registered garage — not restricted to MG dealers' },
                    { icon: Zap, title: 'Full EV Coverage', desc: 'Complete cover for MG 4, ZS EV, MG 5 EV electric motors, BMS, and power electronics' },
                    { icon: Phone, title: '24/7 Roadside Assistance', desc: 'Breakdown recovery included with comprehensive plans across the UK' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.title}</h3>
                        <p className="text-sm text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-center pt-16">
                <OptimizedImage 
                  src={mgFourHighMileage}
                  alt="MG 4 electric car warranty UK - front view"
                  className="max-w-[60%] h-auto drop-shadow-xl rounded-xl"
                  width={461}
                  height={307}
                />
              </div>
            </div>
          </div>
        </section>
        <BrandRepairCosts
          brandName="MG"
          monthlyPrice="£24"
          onGetQuote={scrollToQuoteForm}
          repairs={[
            { name: 'EV Drive Motor (MG 4)', cost: '£2,000 – £4,500', icon: 'Zap', severity: 'critical' },
            { name: 'Turbocharger (HS Turbo)', cost: '£1,200 – £2,500', icon: 'Zap', severity: 'high' },
            { name: 'Automatic Gearbox Rebuild', cost: '£1,800 – £3,500', icon: 'Wrench', severity: 'critical' },
            { name: 'Engine Rebuild', cost: '£2,500 – £5,000', icon: 'Car', severity: 'critical' },
            { name: 'Battery Management System', cost: '£1,500 – £3,000', icon: 'Zap', severity: 'high' },
            { name: 'ECU Replacement', cost: '£700 – £1,500', icon: 'Zap', severity: 'medium' },
            { name: 'Power Steering Rack', cost: '£500 – £1,200', icon: 'Wrench', severity: 'medium' },
            { name: 'On-Board Charger', cost: '£800 – £2,000', icon: 'Shield', severity: 'high' },
            { name: 'Fuel Injector Set', cost: '£600 – £1,500', icon: 'Zap', severity: 'medium' },
          ]}
        />

        {/* Models Covered Section - Apple-style compact grid */}
        <section className="py-12 md:py-16 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                MG Models We Cover
              </h2>
              <p className="text-gray-600">All models from 2012 to 2026 • Up to 150,000 miles</p>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {(['All', ...Object.keys(mgModelCategories)] as (ModelCategory | 'All')[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveModelFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeModelFilter === cat
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="max-w-sm mx-auto mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search MG models..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
                />
              </div>
            </div>

            {/* Model Grid - Compact Apple-style */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {filteredModels.map(({ model, generations, category }) => (
                <button
                  key={`${category}-${model}`}
                  onClick={() => {
                    setSelectedModel(selectedModel === model ? null : model);
                    scrollToQuoteForm();
                  }}
                  className={`group px-2 py-3 rounded-lg text-center transition-all border ${
                    selectedModel === model
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  <Car className="h-6 w-6 mx-auto mb-1 text-slate-400 group-hover:text-slate-600" strokeWidth={1.25} />
                  <div className="text-[11px] sm:text-xs font-semibold text-gray-900 leading-tight">{model}</div>
                  <div className="text-[9px] sm:text-[10px] text-gray-500">{generations.join(' • ')}</div>
                  <div className="text-[8px] text-gray-400 mt-0.5">2012–2026</div>
                </button>
              ))}
            </div>

            {filteredModels.length === 0 && (
              <p className="text-center text-gray-500 py-8">No models found matching "{modelSearchQuery}"</p>
            )}

            <div className="text-center mt-8">
              <Button onClick={scrollToQuoteForm} className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8 py-3 rounded-xl shadow-lg">
                Get Your MG Quote <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* Coverage Section */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                What's Covered on Your MG?
              </h2>
              <p className="text-gray-600">Comprehensive protection for all major MG systems</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coverageCategories.slice(0, expandedCoverage ? undefined : 3).map((cat, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <cat.icon className="h-5 w-5 text-red-600" />
                    </div>
                    <h3 className="font-bold text-gray-900">{cat.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {cat.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {!expandedCoverage && (
              <div className="text-center mt-6">
                <Button
                  variant="outline"
                  onClick={() => setExpandedCoverage(true)}
                  className="gap-2"
                >
                  Show All Coverage <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-12 md:py-16 bg-gradient-to-br from-red-50 to-orange-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                What MG Owners Say
              </h2>
              <div className="flex items-center justify-center gap-2">
                <div className="flex -space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="text-sm text-gray-600">Rated Excellent on Trustpilot</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                  <div className="flex gap-1 mb-3">
                    {[...Array(t.rating)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm mb-4">"{t.text}"</p>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.model} • {t.location}</p>
                  </div>
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

export default MGWarrantyLanding;
