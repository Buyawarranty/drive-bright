import React, { useState, lazy, Suspense, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, ChevronUp, MapPin, Clock, Users, Car, Wrench, Zap, Star, Award, ThumbsUp, FileCheck, MessageCircle, Truck, Battery, Bike, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import { OptimizedImage } from '@/components/OptimizedImage';
// WebsiteFooter is rendered globally in App.tsx via ConditionalFooter
import MileageQuickSelect from '@/components/MileageQuickSelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';
import BrandPageFAQ from '@/components/brand-pages/BrandPageFAQ';
import BluePersistentCallback from '@/components/brand-pages/BluePersistentCallback';
import MinimalLandingFooter from '@/components/brand-pages/MinimalLandingFooter';
import TrustCallbackPanel from '@/components/TrustCallbackPanel';

// Lazy load heavy components
const HomepageFAQ = lazy(() => import('@/components/HomepageFAQ'));
const VehicleCoverageSection = lazy(() => import('@/components/homepage/VehicleCoverageSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));
const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));

// Assets
import bmwLogo from '@/assets/logos/bmw.webp';
import bmwHeroImage from '@/assets/bmw-used-car-extended-warranty-uk.webp';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import pandaMascot from '@/assets/warranty-panda-mascot.png';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import pandaMechanic from '@/assets/panda-mechanic.png';
import pandaGarage from '@/assets/panda-garage-service.png';
import bmwWhyChooseUs from '@/assets/bmw-extended-used-car-warranty.webp';
import bmwHighMileage from '@/assets/bmw-i3-warranty.webp';

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
    answer: "Yes, BMW repairs are among the most expensive in the UK due to advanced electronics and complex powertrains. Our extended warranty protects key components like the engine, gearbox, fuel injectors, and ECUs, preventing sudden repair bills with easy claims and fast payouts."
  },
  {
    question: "How much does a BMW extended warranty cost in the UK?",
    answer: "Extended BMW warranty prices typically start from £24 a month, depending on your BMW model, mileage, and chosen claim limit. We offer plans from just 80p a day with flexible monthly or annual payment options."
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
  const [openFaqId, setOpenFaqId] = useState<string | number | null>(null);
  const [expandedCoverage, setExpandedCoverage] = useState(false);
  const [activeModelFilter, setActiveModelFilter] = useState<ModelCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    const allModels = activeModelFilter === 'All'
      ? Object.entries(bmwModelCategories).flatMap(([category, models]) => 
          Object.entries(models).map(([model, generations]) => ({ model, generations, category }))
        )
      : Object.entries(bmwModelCategories[activeModelFilter]).map(([model, generations]) => ({ 
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
        
        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_currentStep', '2');
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
        navigate('/?step=2');
      } else {
        // Vehicle not found - still proceed with basic data so user can continue
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
      // On error, still proceed with basic data
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

  // Schema.org structured data - Enhanced for AI discoverability
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "BMW Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for all BMW models including 1 Series, 2 Series, 3 Series, 4 Series, 5 Series, 6 Series, 7 Series, 8 Series, X1, X2, X3, X4, X5, X6, X7, i3, i4, i7, i8, iX, and iX3. Covers engine, gearbox, transmission, electrical systems, and more. Nationwide UK coverage with any VAT-registered garage.",
    "brand": {
      "@type": "Brand",
      "name": "Buy A Warranty"
    },
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
      "price": "29",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://buyawarranty.co.uk/warranty-types/bmw-warranty/",
      "seller": {
        "@type": "Organization",
        "name": "Buy A Warranty"
      },
      "itemCondition": "https://schema.org/NewCondition",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": "29",
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
      "author": {
        "@type": "Person",
        "name": t.name
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": t.rating,
        "bestRating": "5"
      },
      "reviewBody": t.text,
      "datePublished": new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    })),
    "category": "Vehicle Extended Warranty",
    "audience": {
      "@type": "Audience",
      "audienceType": "BMW vehicle owners in the United Kingdom"
    }
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "BMW Extended Warranty Service",
    "alternateName": "BMW Used Car Warranty",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "telephone": "+44-800-917-9270",
      "priceRange": "£29-£95/month",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "GB"
      }
    },
    "areaServed": {
      "@type": "Country",
      "name": "United Kingdom"
    },
    "description": "Extended warranty coverage for all BMW models including 1 Series, 3 Series, 5 Series, X Series, i Series and M models. Covers engine, transmission, electrical systems, turbocharger, and more. Nationwide UK coverage with any VAT-registered garage. 24/7 roadside assistance included.",
    "serviceType": "Vehicle Extended Warranty",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "BMW Warranty Plans",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "1 Year BMW Warranty"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "2 Year BMW Warranty"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "3 Year BMW Warranty"
          }
        }
      ]
    }
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
        "item": "https://buyawarranty.co.uk/warranty-types/bmw-warranty/"
      }
    ]
  };

  // Organization schema for AI engines
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "description": "UK's trusted extended car warranty provider. Protecting vehicles since 2016 with comprehensive coverage and excellent customer service.",
    "foundingDate": "2016",
    "sameAs": [
      "https://uk.trustpilot.com/review/buyawarranty.co.uk"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+44-800-917-9270",
      "contactType": "customer service",
      "areaServed": "GB",
      "availableLanguage": "English"
    }
  };

  // WebPage schema for AI context
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "BMW Extended Warranty UK - Get Instant Quote",
    "description": "Protect your BMW with comprehensive extended warranty cover. All models from 1 Series to X7 and i Series. Nationwide UK coverage, approved garages, unlimited claims. Get your instant quote in 60 seconds.",
    "url": "https://buyawarranty.co.uk/warranty-types/bmw-warranty/",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk"
    },
    "about": {
      "@type": "Thing",
      "name": "BMW Extended Warranty"
    },
    "mentions": [
      { "@type": "Brand", "name": "BMW" },
      { "@type": "Thing", "name": "Extended Warranty" },
      { "@type": "Thing", "name": "Vehicle Protection" }
    ],
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": ["h1", "h2", ".hero-description"]
    },
    "mainContentOfPage": {
      "@type": "WebPageElement",
      "cssSelector": "main"
    }
  };

  // HowTo schema for getting a quote
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Get a BMW Extended Warranty Quote",
    "description": "Get an instant BMW extended warranty quote in 60 seconds",
    "totalTime": "PT1M",
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Enter Registration",
        "text": "Enter your BMW registration number to look up your vehicle details automatically"
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Select Mileage",
        "text": "Choose your current mileage range (under or over 120,000 miles)"
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Get Instant Quote",
        "text": "Receive your personalised warranty quote instantly with pricing for different coverage levels"
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>BMW Extended Warranty UK | Get Your Instant Quote | Buy A Warranty</title>
        <meta name="description" content="Protect your BMW with comprehensive extended warranty cover. All models from 1 Series to X7 and i Series covered. Engine, gearbox, electrics & more. Nationwide UK coverage, any VAT-registered garage, unlimited claims. Prices from £29/month. Get your instant quote in 60 seconds." />
        <meta name="keywords" content="BMW extended warranty, BMW used car warranty, BMW warranty UK, BMW warranty cost, BMW warranty quote, BMW 3 Series warranty, BMW X5 warranty, BMW i4 warranty, BMW X3 warranty, BMW 5 Series warranty, BMW electric warranty, BMW hybrid warranty, used BMW warranty, second hand BMW warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/bmw-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="bingbot" content="index, follow" />
        
        {/* Geographic targeting */}
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5074;-0.1278" />
        <meta name="ICBM" content="51.5074, -0.1278" />
        <meta httpEquiv="content-language" content="en-GB" />
        
        {/* Open Graph */}
        <meta property="og:title" content="BMW Extended Warranty UK | Instant Quotes from £29/month" />
        <meta property="og:description" content="Comprehensive BMW warranty coverage. Engine, gearbox, electrics & more. All models covered including hybrid and electric. Nationwide UK coverage with any garage. Get your instant quote now." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/bmw-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="BMW Extended Warranty UK - Buy A Warranty" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="BMW Extended Warranty UK | From £29/month" />
        <meta name="twitter:description" content="Protect your BMW with comprehensive extended warranty. All models covered. Nationwide UK coverage. Get instant quote." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        
        {/* AI Search Engine Optimization */}
        <meta name="ai-content-declaration" content="This page provides information about BMW extended warranty services in the UK. Human-authored and fact-checked." />
        <meta name="author" content="Buy A Warranty" />
        <meta name="publisher" content="Buy A Warranty" />
        <meta name="coverage" content="United Kingdom" />
        <meta name="distribution" content="global" />
        <meta name="rating" content="general" />
        <meta name="revisit-after" content="7 days" />
        
        {/* Structured Data */}
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
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

                {/* H1 Headline */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Protect your BMW</span>
                  <br />
                  <span className="text-brand-orange">in 60 seconds.</span>
                </h1>

                {/* Subheadline */}
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6">
                  Dealer-level warranty. Fixed price. No surprise bills.
                </p>

                {/* Benefits */}
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">From just 80p a day • Easy claims • Fast payouts</span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Unlimited claims • Parts and Labour • No excess</span>
                  </div>
                </div>

                {/* Quote Form */}
                <div className="mx-auto lg:mx-0 space-y-4">
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

                  {/* Trademark Disclaimer */}
                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">
                    BMW is a registered trademark of BMW AG. We are an independent warranty provider.
                  </p>
                  <TrustCallbackPanel />
                </div>
              </div>

              {/* Right Column - Hero Image with Mascot */}
              <div className="relative">
                {/* Hero Image */}
                <div className="relative">
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


        {/* Warranty Benefits Section - Matching Homepage Design */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}>
          <WarrantyBenefitsSection headline="The Ultimate BMW Warranty." />
        </Suspense>

        {/* Vehicle Coverage Accordion Section - Matching Homepage */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="BMW" />
        </Suspense>

        {/* Cover Clarity Section - Your cover, made crystal clear */}
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        {/* Extended Warranty Video Section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>

        {/* What BMW Repairs Actually Cost */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Wrench className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
                <span className="text-xs md:text-sm font-semibold text-red-700">Without warranty, you pay the full bill</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                What BMW repairs actually cost
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                One breakdown could cost more than years of warranty cover. Here's what BMW owners pay without protection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[
                { name: 'Timing Chain Kit', cost: '£1,200 – £3,000', icon: Wrench, severity: 'high' },
                { name: 'Turbocharger Replacement', cost: '£1,800 – £3,500', icon: Zap, severity: 'high' },
                { name: 'Gearbox Rebuild', cost: '£2,500 – £5,000', icon: Wrench, severity: 'critical' },
                { name: 'Engine Rebuild', cost: '£3,500 – £7,000', icon: Car, severity: 'critical' },
                { name: 'Fuel Injector Set', cost: '£800 – £2,200', icon: Zap, severity: 'medium' },
                { name: 'ECU Replacement', cost: '£900 – £2,000', icon: Zap, severity: 'medium' },
                { name: 'Air Suspension Compressor', cost: '£1,200 – £2,500', icon: Car, severity: 'high' },
                { name: 'Power Steering Rack', cost: '£800 – £1,800', icon: Wrench, severity: 'medium' },
                { name: 'DPF Filter Replacement', cost: '£1,000 – £2,500', icon: Shield, severity: 'high' },
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

            {/* Bottom CTA */}
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
                <Button
                  onClick={scrollToQuoteForm}
                  className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 md:py-5 px-6 md:px-8 text-base md:text-lg rounded-xl shadow-lg animate-breathing"
                >
                  <span className="flex items-center gap-2">
                    Get my instant quote
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* BMW Models Section - Premium Design */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full Coverage Details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                All BMW Models Covered
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                Select your BMW model to see tailored warranty options designed for premium performance vehicles.
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-md mx-auto mb-6 md:mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search by model or chassis code (e.g. 320, G20)"
                  className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm md:text-base"
                />
              </div>
            </div>

            {/* Filter Tabs - Premium Style */}
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
                onClick={() => { setActiveModelFilter('Series'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'Series'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}
              >
                Series
              </button>
              <button
                onClick={() => { setActiveModelFilter('X Series SUVs'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'X Series SUVs'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}
              >
                X Series SUVs
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
                  i Series / Electric
                </span>
              </button>
            </div>

            {/* Models Grid - Compact Cards */}
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
                    aria-label={`BMW ${model}, chassis codes ${generations.join(', ')}`}
                  >
                    {/* EV Badge */}
                    {isElectric && (
                      <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Zap className="w-2 h-2" />
                        EV
                      </div>
                    )}
                    
                    {/* Model Icon - minimal, no background */}
                    <Car className={`w-6 h-6 mx-auto mb-1.5 transition-colors ${
                      selectedModel === model 
                        ? 'text-blue-500' 
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`} strokeWidth={1.25} />
                    
                    {/* Model Name */}
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">
                      BMW {model}
                    </h3>
                    
                    {/* Chassis Codes */}
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-mono tracking-tight leading-tight">
                      {generations.join(' · ')}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* No Results Message */}
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

            {/* Bottom Info */}
            <div className="mt-8 md:mt-10 text-center">
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 text-xs md:text-sm text-slate-600">
                <Check className="w-4 h-4 text-green-600" />
                <span><strong>Also covered:</strong> M-Sport variants, xDrive models, and plug-in hybrids</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sticky CTA - Shows after model selection */}
        {selectedModel && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 md:py-4 px-4 z-50 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm md:text-base">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">BMW {selectedModel} selected</p>
                  <p className="text-slate-500 text-xs md:text-sm">Step 1 of 2: Choose coverage →</p>
                </div>
              </div>
              <Button
                onClick={scrollToQuoteForm}
                className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25"
              >
                Get warranty quote for BMW
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Why BMW Drivers Choose Us Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why BMW Drivers Choose Us
              </h2>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4"
              >
                Get BMW Warranty
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Wrench, title: 'Dealer-level repairs and diagnostics', desc: 'Professional repairs at any VAT-registered garage across the UK.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team that knows BMW systems', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Car, title: 'High mileage BMW warranty plans', desc: 'Cover vehicles up to 150,000 miles with no mileage restrictions during cover.' },
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
              
              {/* Mascot - Miles the Panda with BMW */}
              <div className="hidden lg:flex justify-center items-end">
                <OptimizedImage 
                  src={bmwWhyChooseUs}
                  alt="Miles the Panda mechanic with BMW - Why BMW owners choose us for extended warranty"
                  className="w-[400px] h-auto object-contain"
                  width={400}
                  height={300}
                />
              </div>
            </div>
          </div>
        </section>

        {/* How Claims Work Section */}
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
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your BMW' },
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

        {/* Your BMW Cover Made Crystal Clear Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent Coverage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your BMW cover, made <span className="text-brand-orange">crystal clear</span>
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

        {/* High Mileage BMW Section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              {/* Image on LEFT side */}
              <div className="flex justify-center">
                <OptimizedImage 
                  src={bmwHighMileage}
                  alt="BMW i3 with BuyAWarranty branding - High mileage BMW warranty coverage"
                  className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto object-contain"
                  width={448}
                  height={300}
                />
              </div>
              {/* Text on RIGHT side */}
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High Mileage BMW, No Problem!
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Drive Your BMW With Confidence<br />
                  <span className="text-brand-orange">You're Covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Once you have your BMW warranty, drive with complete peace of mind. If something 
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
            
            {/* CTA Button - Same styling as Homepage */}
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

        {/* Additional BMW Cover Options Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Additional BMW Cover Options
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Enhance your BMW warranty with these optional extras
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Car className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Courtesy Car</h3>
                <p className="text-sm md:text-base text-gray-600">Keep moving while your BMW is being repaired</p>
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
                  Your BMW is covered wherever you drive in the United Kingdom. Our network of approved garages spans England, Scotland, Wales, and Northern Ireland.
                </p>
                <ul className="space-y-2 md:space-y-3 text-left max-w-md mx-auto md:mx-0">
                  {[
                    'Use any VAT-registered garage',
                    'BMW dealer or Specialist garage',
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
                  alt="Miles the Panda giving thumbs up for UK-wide coverage"
                  className="w-36 sm:w-48 md:w-64 h-auto object-contain mb-3 md:mb-4"
                  width={256}
                  height={256}
                />
                <div className="inline-block bg-white/10 rounded-xl md:rounded-2xl px-4 md:px-8 py-2 md:py-4 backdrop-blur-sm">
                  <p className="text-sm md:text-xl font-bold text-white">England • Scotland • Wales • N. Ireland</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                What BMW Owners Say
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Real reviews from real BMW drivers
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
                    <p className="text-xs md:text-sm text-gray-500">{testimonial.model} • {testimonial.location}</p>
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

export default BMWWarrantyLanding;
