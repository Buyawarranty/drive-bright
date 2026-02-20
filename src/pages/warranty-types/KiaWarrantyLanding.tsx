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

// Kia-specific images
import kiaSportageHero from '@/assets/kia-sportage-extended-warranty-uk.png';
import kiaCeedWarranty from '@/assets/kia-ceed-used-car-warranty.png';
import kiaNiroHighMileage from '@/assets/kia-niro-high-mileage-warranty.png';

// Kia Models covered (grouped by category) - 2012 to 2026
const kiaModelCategories = {
  'Hatchback & Saloon': {
    'Ceed': ['Mk1', 'Mk2', 'Mk3'],
    'ProCeed': ['Mk1', 'Mk2'],
    'Rio': ['Mk3', 'Mk4'],
    'Picanto': ['Mk2', 'Mk3'],
    'Stinger': ['Mk1'],
    'Optima': ['Mk1', 'Mk2'],
    'Ceed GT': ['Mk2', 'Mk3'],
  },
  'SUV & Crossover': {
    'Sportage': ['Mk3', 'Mk4', 'Mk5'],
    'Sorento': ['Mk2', 'Mk3', 'Mk4'],
    'Niro': ['Mk1', 'Mk2'],
    'Stonic': ['Mk1'],
    'XCeed': ['Mk1'],
    'Seltos': ['Mk1'],
    'EV9': ['Mk1'],
  },
  'MPV & People Carrier': {
    'Carens': ['Mk3', 'Mk4'],
    'Venga': ['Mk1'],
    'Soul': ['Mk2', 'Mk3'],
  },
  'Electric & Hybrid': {
    'EV6': ['Mk1'],
    'EV9': ['Mk1'],
    'Niro EV': ['Mk1', 'Mk2'],
    'Niro PHEV': ['Mk1', 'Mk2'],
    'Sportage HEV': ['Mk5'],
    'Sportage PHEV': ['Mk5'],
    'Sorento PHEV': ['Mk4'],
    'XCeed PHEV': ['Mk1'],
    'Soul EV': ['Mk2', 'Mk3'],
    'Ceed PHEV': ['Mk3'],
  },
};

type ModelCategory = keyof typeof kiaModelCategories;

// Coverage components data - Kia-specific
const coverageCategories = [
  {
    title: 'Engine & Powertrain',
    icon: Car,
    items: [
      'Kia GDi and T-GDi engine block and cylinder head',
      'Pistons, rings, and bearings',
      'Crankshaft and camshaft',
      'Timing chains and tensioners',
      'Oil pump and oil cooler',
      'Turbocharger (T-GDi / GT models)',
      'Intake and exhaust manifolds',
    ]
  },
  {
    title: 'Transmission & Drivetrain',
    icon: Wrench,
    items: [
      'Kia DCT dual-clutch gearbox',
      'Manual gearbox internals',
      'Torque converter (automatic)',
      'Intelligent All-Wheel Drive (HTRAC)',
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
      'Kia Connect infotainment system',
      'Digital instrument cluster',
      'ADAS cameras and sensors',
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
      'High-pressure fuel pump (GDi/T-GDi)',
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
      'Electronically controlled suspension',
      'Control arms and bushings',
      'Anti-roll bar links',
      'Wheel bearings and hubs',
    ]
  },
  {
    title: 'Hybrid & EV Components',
    icon: Zap,
    items: [
      'Electric drive motor (EV6 / EV9 / Niro EV)',
      'Power electronics module',
      'DC-DC converter',
      'On-board charger (800V where fitted)',
      'Battery management system',
      'Regenerative braking system',
      'Thermal management system',
    ]
  },
];

// FAQs
const kiaFAQs = [
  {
    question: "Is a Kia extended warranty worth it in the UK?",
    answer: "Yes, modern Kias feature complex GDi and T-GDi turbo engines, DCT gearboxes, advanced infotainment systems, and hybrid/EV technology that can be costly to repair outside of the manufacturer warranty. Our extended warranty protects key components including the engine, turbocharger, gearbox, fuel injectors, and ECUs, preventing unexpected repair bills."
  },
  {
    question: "How much does a Kia extended warranty cost in the UK?",
    answer: "Extended Kia warranty prices typically start from £24 a month, depending on your Kia model, mileage, and chosen claim limit. We offer plans from just 80p a day with flexible monthly or annual payment options."
  },
  {
    question: "Can I buy a Kia extended warranty after my 7-year warranty has expired?",
    answer: "Yes, you can buy cover even if your Kia's original 7-year manufacturer warranty has expired, or if you purchased it used without the remaining warranty transferring. We cover vehicles up to 150,000 miles and 15 years old."
  },
  {
    question: "Can I use my own garage for Kia warranty repairs?",
    answer: "Yes, absolutely. You can choose any VAT-registered garage across the UK instead of being restricted to Kia dealers. We have a network of approved garages nationwide."
  },
  {
    question: "Does the warranty cover hybrid and electric Kia models?",
    answer: "Yes, our comprehensive plan includes cover for Kia's hybrid and fully electric components including the EV6 and EV9 electric motors, 800V charging system, battery management, power electronics, on-board charger, and thermal management systems."
  },
  {
    question: "Is roadside assistance included?",
    answer: "Yes, our comprehensive plan includes 24/7 roadside assistance and recovery anywhere in the UK. If your Kia breaks down, we'll send help to get you back on the road or recover your vehicle to a garage."
  },
  {
    question: "How do I make a claim on my Kia warranty?",
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
    model: "Kia Sportage",
    text: "My Sportage needed a new turbo at 68,000 miles. Would have cost me over £2,500 but my warranty covered everything. Brilliant service from start to finish.",
    rating: 5
  },
  {
    name: "Sarah D.",
    location: "Bristol",
    model: "Kia Ceed",
    text: "The DCT gearbox on my Ceed developed a fault after the Kia warranty expired. Buy A Warranty handled the whole claim without any fuss. Back on the road in two days.",
    rating: 5
  },
  {
    name: "Tom B.",
    location: "Edinburgh",
    model: "Kia Niro PHEV",
    text: "Finding warranty cover for my Niro hybrid was tricky until I found these guys. They cover all the hybrid components and the price is very reasonable.",
    rating: 5
  },
  {
    name: "Emma L.",
    location: "London",
    model: "Kia EV6",
    text: "I wanted peace of mind for my EV6 after the manufacturer warranty. These guys cover all the EV components including the 800V system. Couldn't be happier.",
    rating: 5
  }
];

const KiaWarrantyLanding: React.FC = () => {
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
      ? Object.entries(kiaModelCategories).flatMap(([category, models]) => 
          Object.entries(models).map(([model, generations]) => ({ model, generations, category }))
        )
      : Object.entries(kiaModelCategories[activeModelFilter]).map(([model, generations]) => ({ 
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
    trackButtonClick('kia_warranty_get_quote', { brand: 'Kia' });
    
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
          make: data.make || 'KIA',
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
    "name": "Kia Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for all Kia models including Sportage, Ceed, Niro, Sorento, Picanto, Rio, Stonic, EV6, and EV9. Covers engine, turbo, gearbox, electrical systems, hybrid and EV components. Nationwide UK coverage with any VAT-registered garage.",
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
      "url": "https://buyawarranty.co.uk/warranty-types/kia-warranty/",
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
    "audience": { "@type": "Audience", "audienceType": "Kia vehicle owners in the United Kingdom" }
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Kia Extended Warranty Service",
    "alternateName": "Kia Used Car Warranty",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "telephone": "+44-800-917-9270",
      "priceRange": "£24-£85/month",
      "address": { "@type": "PostalAddress", "addressCountry": "GB" }
    },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "description": "Extended warranty coverage for all Kia models including Sportage, Ceed, Niro, Sorento, Picanto, Rio, EV6, and EV9. Covers GDi/T-GDi engines, DCT gearboxes, infotainment, and hybrid/EV components.",
    "serviceType": "Vehicle Extended Warranty",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Kia Warranty Plans",
      "itemListElement": [
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "1 Year Kia Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "2 Year Kia Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "3 Year Kia Warranty" } }
      ]
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": kiaFAQs.map(faq => ({
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
      { "@type": "ListItem", "position": 3, "name": "Kia Extended Warranty", "item": "https://buyawarranty.co.uk/warranty-types/kia-warranty/" }
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
    "priceRange": "£24-£85/month",
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
    "name": "Kia Extended Warranty UK - Sportage, Ceed, Niro, Sorento, EV6 Cover",
    "description": "Protect your Kia with comprehensive extended warranty cover. All models from Picanto to EV9. Nationwide UK coverage, approved garages, unlimited claims.",
    "url": "https://buyawarranty.co.uk/warranty-types/kia-warranty/",
    "isPartOf": { "@type": "WebSite", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "about": { "@type": "Thing", "name": "Kia Extended Warranty" },
    "mentions": [
      { "@type": "Brand", "name": "Kia" },
      { "@type": "Thing", "name": "Extended Warranty" },
      { "@type": "Thing", "name": "Vehicle Protection" }
    ],
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".hero-description"] },
    "mainContentOfPage": { "@type": "WebPageElement", "cssSelector": "main" }
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Get a Kia Extended Warranty Quote",
    "description": "Get an instant Kia extended warranty quote in 60 seconds",
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "position": 1, "name": "Enter Registration", "text": "Enter your Kia registration number to look up your vehicle details automatically" },
      { "@type": "HowToStep", "position": 2, "name": "Select Mileage", "text": "Choose your current mileage range (under or over 120,000 miles)" },
      { "@type": "HowToStep", "position": 3, "name": "Get Instant Quote", "text": "Receive your personalised warranty quote instantly with pricing for different coverage levels" }
    ]
  };

  return (
    <>
      <Helmet>
        <title>Kia Extended Warranty UK | Sportage, Ceed, Niro, Sorento, EV6 from £24/mo</title>
        <meta name="description" content="Protect your Kia Sportage, Ceed, Niro, Sorento, Picanto, Rio, EV6 or EV9 with comprehensive extended warranty cover. GDi engines, DCT gearboxes, electrics and hybrid/EV components covered. Nationwide UK coverage, any VAT-registered garage, unlimited claims. Prices from £24/month. Get your instant quote in 60 seconds." />
        <meta name="keywords" content="Kia extended warranty, Kia used car warranty, Kia warranty UK, Kia warranty cost, Kia warranty quote, Kia Sportage warranty, Kia Ceed warranty, Kia Niro warranty, Kia Sorento warranty, Kia EV6 warranty, Kia EV9 warranty, Kia Picanto warranty, used Kia warranty, second hand Kia warranty, Kia hybrid warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/kia-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="bingbot" content="index, follow" />
        
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5074;-0.1278" />
        <meta name="ICBM" content="51.5074, -0.1278" />
        <meta httpEquiv="content-language" content="en-GB" />
        
        <meta property="og:title" content="Kia Warranty UK | Sportage, Ceed, Niro, Sorento, EV6 from £24/mo" />
        <meta property="og:description" content="Comprehensive Kia warranty coverage for Sportage, Ceed, Niro, Sorento, Picanto, Rio, EV6 and EV9. GDi engines, gearbox, electrics and more. Nationwide UK coverage with any VAT-registered garage." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/kia-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Kia Extended Warranty UK - Buy A Warranty" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Kia Warranty UK | Sportage, Ceed, Niro, Sorento, EV6 from £24/mo" />
        <meta name="twitter:description" content="Protect your Kia Sportage, Ceed, Niro, Sorento with comprehensive extended warranty. EV and hybrid models covered. Nationwide UK coverage. Get instant quote." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        
        <meta name="ai-content-declaration" content="This page provides information about Kia extended warranty services in the UK, covering Sportage, Ceed, Niro, Sorento, Picanto, Rio, Stonic, EV6, and EV9 models. Human-authored and fact-checked." />
        <meta name="ai-summary" content="Buy A Warranty offers comprehensive Kia extended warranty plans in the UK from £24/month. Coverage includes GDi/T-GDi engines, DCT gearboxes, Kia Connect infotainment, electrical, hybrid and EV components for all Kia models 2012-2026. Nationwide garage network, unlimited claims, 14-day money-back guarantee." />
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
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/KIA_logo2.svg/800px-KIA_logo2.svg.png" 
                    alt="Kia Logo" 
                    className="h-10 md:h-14 w-auto object-contain"
                    width={112}
                    height={56}
                  />
                </div>

                {/* H1 Headline */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Kia Extended Warranty </span>
                  <span className="text-brand-orange">in 60 Seconds!</span>
                </h1>

                {/* Subheadline */}
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6 hero-description">
                  Protect your Kia with dealer-level repairs, UK-wide cover and no-surprise costs. Get a fixed-price with instant cover.
                </p>

                {/* Benefits */}
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">From just 80p a day . Easy claims . Fast payouts</span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Unlimited claims . Parts and Labour . No excess</span>
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
                    Kia is a registered trademark of Kia Corporation. We are an independent warranty provider.
                  </p>
                  <TrustCallbackPanel />
                </div>
              </div>

              {/* Right Column - Hero Image */}
              <div className="relative">
                <div className="relative">
                  <OptimizedImage
                    src={kiaSportageHero}
                    alt="Kia Sportage front view - Kia extended warranty UK coverage for all Sportage models"
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
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">SUVs</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Hybrid</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">EV</span>
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
          <WarrantyBenefitsSection headline="The Ultimate Kia Warranty." />
        </Suspense>

        {/* Vehicle Coverage Accordion Section */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Kia" />
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
          brandName="Kia"
          monthlyPrice="£24"
          onGetQuote={scrollToQuoteForm}
          repairs={[
            { name: 'DCT Gearbox Rebuild', cost: '£1,800 – £3,500', icon: 'Wrench', severity: 'critical' },
            { name: 'Turbocharger (T-GDi)', cost: '£1,500 – £3,000', icon: 'Zap', severity: 'high' },
            { name: 'Engine Rebuild', cost: '£3,000 – £5,500', icon: 'Car', severity: 'critical' },
            { name: 'EV Drive Motor (EV6)', cost: '£2,500 – £5,000', icon: 'Zap', severity: 'high' },
            { name: 'Fuel Injector Set', cost: '£700 – £1,800', icon: 'Zap', severity: 'medium' },
            { name: 'ECU Replacement', cost: '£800 – £1,800', icon: 'Zap', severity: 'medium' },
            { name: 'Power Steering Rack', cost: '£600 – £1,400', icon: 'Wrench', severity: 'medium' },
            { name: 'Timing Chain Kit', cost: '£800 – £2,000', icon: 'Wrench', severity: 'high' },
            { name: 'DPF Filter Replacement', cost: '£1,000 – £2,200', icon: 'Shield', severity: 'high' },
          ]}
        />

        {/* Kia Models Section */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full Coverage Details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                All Kia Models Covered
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                Select your Kia model to see tailored warranty options designed for every Kia vehicle on UK roads.
              </p>
            </div>

            <div className="max-w-md mx-auto mb-6 md:mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search by model or generation (e.g. Sportage, Mk5)"
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
                onClick={() => { setActiveModelFilter('MPV & People Carrier'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'MPV & People Carrier'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}
              >
                MPV & People Carrier
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
                    aria-label={`Kia ${model}, generations ${generations.join(', ')}`}
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
                      Kia {model}
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
                <span><strong>Also covered:</strong> GT-Line, GT, Edition, and all special editions</span>
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
                  <p className="font-bold text-slate-900">Kia {selectedModel} selected</p>
                  <p className="text-slate-500 text-xs md:text-sm">Step 1 of 2: Choose coverage →</p>
                </div>
              </div>
              <Button
                onClick={scrollToQuoteForm}
                className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25"
              >
                Get warranty quote for Kia
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Why Kia Drivers Choose Us */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why Kia Drivers Choose Us
              </h2>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4"
              >
                Get Kia Warranty
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Wrench, title: 'Dealer-level repairs and diagnostics', desc: 'Professional repairs at any VAT-registered garage across the UK.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team that knows Kia systems', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Car, title: 'High mileage Kia warranty plans', desc: 'Cover vehicles up to 150,000 miles with no mileage restrictions during cover.' },
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
                  src={kiaCeedWarranty}
                  alt="Kia Ceed front view - Why Kia Ceed owners choose Buy A Warranty for extended warranty cover"
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {[
                { step: 1, title: 'Diagnose', desc: 'Diagnose at any VAT-registered garage' },
                { step: 2, title: 'Authorise', desc: 'We authorise eligible repairs quickly' },
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your Kia' },
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

        {/* Crystal Clear Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent Coverage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your Kia cover, made <span className="text-brand-orange">crystal clear</span>
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

        {/* High Mileage Kia Section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              <div className="flex justify-center">
                <OptimizedImage 
                  src={kiaNiroHighMileage}
                  alt="Kia Niro front view - High mileage Kia Niro extended warranty coverage UK"
                  className="max-w-[35%] h-auto object-contain"
                  width={448}
                  height={300}
                />
              </div>
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High Mileage Kia, No Problem!
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Drive Your Kia With Confidence<br />
                  <span className="text-brand-orange">You're Covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Once you have your Kia warranty, drive with complete peace of mind. If something 
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
                Additional Kia Cover Options
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Enhance your Kia warranty with these optional extras
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Car className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Courtesy Car</h3>
                <p className="text-sm md:text-base text-gray-600">Keep moving while your Kia is being repaired</p>
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
                  Your Kia is covered wherever you drive in the United Kingdom. Our network of approved garages spans England, Scotland, Wales, and Northern Ireland.
                </p>
                <ul className="space-y-2 md:space-y-3 text-left max-w-md mx-auto md:mx-0">
                  {[
                    'Use any VAT-registered garage',
                    'Kia dealer or independent specialist',
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
                  src={pandaThumbsUp}
                  alt="Miles the Panda giving thumbs up for UK-wide Kia warranty coverage"
                  className="w-36 sm:w-48 md:w-64 h-auto object-contain mb-3 md:mb-4"
                  width={256}
                  height={256}
                />
                <div className="inline-block bg-white/10 rounded-xl md:rounded-2xl px-4 md:px-8 py-2 md:py-4 backdrop-blur-sm">
                  <p className="text-sm md:text-xl font-bold text-white">England . Scotland . Wales . N. Ireland</p>
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
                What Kia Owners Say
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Real reviews from real Kia drivers
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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
                    <p className="text-xs md:text-sm text-gray-500">{testimonial.model} . {testimonial.location}</p>
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

export default KiaWarrantyLanding;
