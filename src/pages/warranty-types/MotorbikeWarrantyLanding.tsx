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
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import pandaMascot from '@/assets/warranty-panda-mascot.png';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import motorcycleHeroImage from '@/assets/motorcycle-hero.png';
import motorcyclePanda from '@/assets/panda-motorcycle-warranty.png';
import motorcycleCoverage from '@/assets/motorbike-warranty-uk-repair-cover.png';

// UK Motorbike Models covered (grouped by manufacturer) - 2012-2026
const motorbikeModelCategories = {
  'Honda': {
    'CBR650R': ['2019-2026'],
    'CBR500R': ['2013-2026'],
    'CB650R': ['2019-2026'],
    'CB500F': ['2013-2026'],
    'CB500X': ['2013-2026'],
    'NC750X': ['2014-2026'],
    'Africa Twin CRF1100L': ['2016-2026'],
    'NT1100': ['2022-2026'],
    'Rebel 500': ['2017-2026'],
    'Rebel 1100': ['2021-2026'],
    'Forza 750': ['2021-2026'],
    'Forza 350': ['2020-2026'],
    'PCX125': ['2012-2026'],
    'SH125i': ['2012-2026'],
    'X-ADV': ['2017-2026'],
    'Gold Wing': ['2012-2026'],
  },
  'Yamaha': {
    'MT-07': ['2014-2026'],
    'MT-09': ['2014-2026'],
    'MT-10': ['2016-2026'],
    'Tracer 9': ['2015-2026'],
    'Tracer 7': ['2016-2026'],
    'XSR700': ['2016-2026'],
    'XSR900': ['2016-2026'],
    'Ténéré 700': ['2019-2026'],
    'R1': ['2012-2026'],
    'R7': ['2021-2026'],
    'R3': ['2015-2026'],
    'NMAX 125': ['2015-2026'],
    'XMAX 300': ['2017-2026'],
    'TMAX 560': ['2012-2026'],
    'FJR1300': ['2012-2022'],
  },
  'Kawasaki': {
    'Z650': ['2017-2026'],
    'Z900': ['2017-2026'],
    'Z900RS': ['2018-2026'],
    'Z H2': ['2020-2026'],
    'Ninja 650': ['2012-2026'],
    'Ninja 1000SX': ['2020-2026'],
    'Ninja ZX-6R': ['2012-2026'],
    'Ninja ZX-10R': ['2012-2026'],
    'Versys 650': ['2012-2026'],
    'Versys 1000': ['2012-2026'],
    'Vulcan S': ['2015-2026'],
    'W800': ['2019-2026'],
    'KLR 650': ['2012-2026'],
  },
  'Suzuki': {
    'GSX-S750': ['2015-2023'],
    'GSX-S1000': ['2015-2026'],
    'GSX-R750': ['2012-2022'],
    'GSX-R1000': ['2012-2026'],
    'V-Strom 650': ['2012-2026'],
    'V-Strom 1050': ['2020-2026'],
    'SV650': ['2016-2026'],
    'Katana': ['2019-2026'],
    'Hayabusa': ['2012-2026'],
    'GSX-8S': ['2023-2026'],
    'V-Strom 800': ['2023-2026'],
    'Burgman 400': ['2012-2026'],
  },
  'Triumph': {
    'Street Triple': ['2012-2026'],
    'Speed Triple': ['2012-2026'],
    'Tiger 900': ['2020-2026'],
    'Tiger 1200': ['2012-2026'],
    'Tiger Sport 660': ['2022-2026'],
    'Trident 660': ['2021-2026'],
    'Bonneville T120': ['2016-2026'],
    'Bonneville T100': ['2016-2026'],
    'Scrambler 1200': ['2019-2026'],
    'Thruxton RS': ['2020-2026'],
    'Rocket 3': ['2020-2026'],
    'Speed 400': ['2023-2026'],
    'Scrambler 400 X': ['2024-2026'],
  },
  'BMW Motorrad': {
    'R 1250 GS': ['2019-2026'],
    'R 1250 RT': ['2019-2026'],
    'F 900 R': ['2020-2026'],
    'F 900 XR': ['2020-2026'],
    'F 750 GS': ['2018-2026'],
    'F 850 GS': ['2018-2026'],
    'S 1000 RR': ['2012-2026'],
    'S 1000 XR': ['2015-2026'],
    'R nineT': ['2014-2026'],
    'C 400 GT': ['2019-2026'],
    'CE 04': ['2022-2026'],
    'R 1300 GS': ['2024-2026'],
    'M 1000 RR': ['2021-2026'],
  },
  'Ducati': {
    'Monster': ['2012-2026'],
    'Multistrada V4': ['2021-2026'],
    'Multistrada 950': ['2017-2023'],
    'Scrambler': ['2015-2026'],
    'Panigale V4': ['2018-2026'],
    'Panigale V2': ['2020-2026'],
    'Streetfighter V4': ['2020-2026'],
    'Diavel V4': ['2023-2026'],
    'DesertX': ['2022-2026'],
    'Hypermotard': ['2012-2026'],
    'XDiavel': ['2016-2026'],
  },
  'KTM': {
    '390 Duke': ['2013-2026'],
    '690 Duke': ['2012-2026'],
    '790 Duke': ['2018-2023'],
    '890 Duke': ['2020-2026'],
    '1290 Super Duke R': ['2014-2026'],
    '390 Adventure': ['2020-2026'],
    '890 Adventure': ['2021-2026'],
    '1290 Super Adventure': ['2015-2026'],
    'RC 390': ['2015-2026'],
    '1390 Super Duke R': ['2024-2026'],
  },
  'Harley-Davidson': {
    'Sportster S': ['2021-2026'],
    'Street Bob': ['2012-2026'],
    'Fat Boy': ['2012-2026'],
    'Road King': ['2012-2026'],
    'Street Glide': ['2012-2026'],
    'Road Glide': ['2012-2026'],
    'Pan America': ['2021-2026'],
    'Nightster': ['2022-2026'],
    'Low Rider': ['2012-2026'],
    'Heritage Classic': ['2012-2026'],
    'Breakout': ['2013-2026'],
    'LiveWire': ['2020-2023'],
  },
  'Royal Enfield': {
    'Interceptor 650': ['2018-2026'],
    'Continental GT 650': ['2018-2026'],
    'Himalayan': ['2016-2026'],
    'Meteor 350': ['2020-2026'],
    'Classic 350': ['2012-2026'],
    'Hunter 350': ['2022-2026'],
    'Super Meteor 650': ['2023-2026'],
    'Shotgun 650': ['2024-2026'],
  },
  'Aprilia': {
    'RS 660': ['2021-2026'],
    'Tuono 660': ['2021-2026'],
    'Tuono V4': ['2012-2026'],
    'RSV4': ['2012-2026'],
    'Tuareg 660': ['2022-2026'],
    'SR GT 200': ['2022-2026'],
    'Shiver 900': ['2017-2022'],
  },
};

type ManufacturerCategory = keyof typeof motorbikeModelCategories;

// Coverage components data for motorbikes
const coverageCategories = [
  {
    title: 'Engine & Powertrain',
    icon: Wrench,
    items: [
      'Engine block and cylinder head',
      'Pistons, rings, and conrods',
      'Crankshaft and camshaft',
      'Timing chains and tensioners',
      'Oil pump and oil cooler',
      'Turbocharger (where fitted)',
      'Clutch basket and pressure plate',
    ]
  },
  {
    title: 'Transmission & Drive',
    icon: Zap,
    items: [
      'Gearbox internals',
      'Gear selector mechanism',
      'Final drive (chain, belt, shaft)',
      'Shaft drive components',
      'Clutch slave/master cylinder',
      'Quickshifter mechanism',
      'Drive shaft and bearings',
    ]
  },
  {
    title: 'Electrical & Electronics',
    icon: Zap,
    items: [
      'ECU and control modules',
      'TFT dashboard/instrument cluster',
      'ABS pump and sensors',
      'Traction control system',
      'Ride-by-wire throttle',
      'Starter motor and alternator',
      'Ignition coils and sensors',
    ]
  },
  {
    title: 'Cooling & Fuel Systems',
    icon: Shield,
    items: [
      'Water pump and thermostat',
      'Radiator and expansion tank',
      'Fuel pump and injectors',
      'Fuel pressure regulator',
      'Throttle bodies',
      'Oil/coolant heat exchangers',
      'Fan motor and switch',
    ]
  },
  {
    title: 'Suspension & Steering',
    icon: Bike,
    items: [
      'Fork internals (cartridge/USD)',
      'Rear shock linkage',
      'Electronic suspension (where fitted)',
      'Steering head bearings',
      'Steering damper',
      'Swingarm pivot bearings',
      'Wheel bearings',
    ]
  },
  {
    title: 'Braking System',
    icon: Shield,
    items: [
      'Brake calipers and pistons',
      'ABS modulator unit',
      'Brake master cylinders',
      'Combined braking system (CBS)',
      'Cornering ABS module',
      'Brake servo (where fitted)',
      'Brake pressure sensors',
    ]
  },
];

// FAQs for schema
const motorbikeFAQs = [
  {
    question: "Is a motorcycle extended warranty worth it in the UK?",
    answer: "Yes, motorcycle repairs can be surprisingly expensive due to specialist labour and parts. A single engine or gearbox issue can cost £1,500-£3,000+. Our extended warranty protects key components like the engine, transmission, electrics, and braking systems, preventing sudden repair bills."
  },
  {
    question: "How much does a motorcycle extended warranty cost in the UK?",
    answer: "Motorcycle warranty prices typically start from £18 a month, depending on your bike model, engine size, mileage, and chosen claim limit. We offer flexible monthly or annual payment options."
  },
  {
    question: "Can I buy an extended warranty after my bike's manufacturer warranty has expired?",
    answer: "Yes, you can buy cover even if your motorcycle is outside its original manufacturer warranty, or if you purchased it used. We cover bikes up to 150,000 miles and 15 years old."
  },
  {
    question: "Can I use my own garage for motorcycle warranty repairs?",
    answer: "Yes, you can choose any VAT-registered motorcycle specialist or general garage across the UK. You're not restricted to the dealer network."
  },
  {
    question: "Does the warranty cover electric motorcycles?",
    answer: "Yes, our comprehensive plan covers electric motorcycle components including the electric motor, battery management system, power electronics, on-board charger, and controller units."
  },
  {
    question: "Is roadside assistance included with motorcycle cover?",
    answer: "Yes, our plan includes 24/7 roadside assistance and recovery anywhere in the UK. If your bike breaks down, we'll send help to get you and your motorcycle recovered."
  },
  {
    question: "How do I make a claim on my motorcycle warranty?",
    answer: "Simply call our UK-based claims team or submit a claim online. We aim to authorise repairs quickly. Your chosen garage contacts us directly, and we settle the bill with them — no upfront costs for you."
  },
  {
    question: "What's not covered by the motorcycle warranty?",
    answer: "Routine maintenance items (oil changes, brake pads, chain & sprockets, tyres), pre-existing faults, cosmetic damage, and crash damage are not covered. Our policy documents clearly outline all exclusions."
  }
];

// Testimonials
const testimonials = [
  {
    name: "Mark R.",
    location: "Birmingham",
    model: "BMW R 1250 GS",
    text: "My GS needed a new alternator at 42,000 miles. Would have been over £1,200 but my warranty covered the lot. Brilliant service and fast authorisation.",
    rating: 5
  },
  {
    name: "Chris P.",
    location: "Leeds",
    model: "Triumph Tiger 900",
    text: "ECU fault on my Tiger - £900 repair bill covered in full. The claims team were great and the garage said they were easy to deal with.",
    rating: 5
  },
  {
    name: "Sarah L.",
    location: "Bristol",
    model: "Yamaha MT-09",
    text: "Fuel pump failure on a weekend ride. Called the warranty team on Monday, authorised by Tuesday, fixed by Wednesday. Can't fault them.",
    rating: 5
  },
  {
    name: "Dave H.",
    location: "Manchester",
    model: "Ducati Monster",
    text: "Finding warranty cover for an Italian bike was tricky until I found Buy A Warranty. Clutch issue sorted, no quibbles. Very reasonable price too.",
    rating: 5
  }
];

const MotorbikeWarrantyLanding: React.FC = () => {
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
  const [activeModelFilter, setActiveModelFilter] = useState<ManufacturerCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    const allModels = activeModelFilter === 'All'
      ? Object.entries(motorbikeModelCategories).flatMap(([category, models]) => 
          Object.entries(models).map(([model, years]) => ({ model, years, category }))
        )
      : Object.entries(motorbikeModelCategories[activeModelFilter]).map(([model, years]) => ({ 
          model, 
          years, 
          category: activeModelFilter 
        }));
    
    if (!modelSearchQuery.trim()) return allModels;
    
    const query = modelSearchQuery.toLowerCase();
    return allModels.filter(({ model, category }) => 
      model.toLowerCase().includes(query) || 
      category.toLowerCase().includes(query)
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
    trackButtonClick('motorbike_warranty_get_quote', { brand: 'Motorbike' });
    
    if (!regNumber.trim()) {
      toast({
        title: "Registration Required",
        description: "Please enter your motorcycle registration number.",
        variant: "destructive",
      });
      return;
    }
    
    if (!mileage.trim()) {
      toast({
        title: "Mileage Required",
        description: "Please select your motorcycle's mileage to continue.",
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
          make: data.make || '',
          model: data.model,
          fuelType: data.fuelType,
          transmission: data.transmission,
          year: data.yearOfManufacture,
          vehicleType: 'motorcycle',
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
          vehicleType: 'motorcycle',
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
        vehicleType: 'motorcycle',
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

  // Manufacturer filter buttons
  const manufacturerFilters: (ManufacturerCategory | 'All')[] = ['All', 'Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'Triumph', 'BMW Motorrad', 'Ducati', 'KTM', 'Harley-Davidson', 'Royal Enfield', 'Aprilia'];

  // Schema.org structured data
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Motorcycle Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for all motorcycle makes and models including Honda, Yamaha, Kawasaki, Suzuki, Triumph, BMW Motorrad, Ducati, KTM, Harley-Davidson, Royal Enfield and Aprilia. Covers engine, gearbox, electrics, braking systems and more. Nationwide UK coverage with any VAT-registered garage.",
    "brand": { "@type": "Brand", "name": "Buy A Warranty" },
    "manufacturer": {
      "@type": "Organization",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
      "contactPoint": { "@type": "ContactPoint", "telephone": "+44-800-917-9270", "contactType": "customer service", "availableLanguage": "English", "areaServed": "GB" }
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "GBP",
      "price": "18",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://buyawarranty.co.uk/warranty-types/motorbike-motorcycle-warranty/",
      "seller": { "@type": "Organization", "name": "Buy A Warranty" },
      "priceSpecification": { "@type": "UnitPriceSpecification", "price": "18", "priceCurrency": "GBP", "unitText": "month", "billingIncrement": 1 }
    },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5", "worstRating": "1" },
    "review": testimonials.map((t, i) => ({
      "@type": "Review",
      "author": { "@type": "Person", "name": t.name },
      "reviewRating": { "@type": "Rating", "ratingValue": t.rating, "bestRating": "5" },
      "reviewBody": t.text,
      "datePublished": new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    })),
    "category": "Motorcycle Extended Warranty",
    "audience": { "@type": "Audience", "audienceType": "Motorcycle owners in the United Kingdom" }
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Motorcycle Extended Warranty Service",
    "alternateName": "Motorbike Warranty UK",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "telephone": "+44-800-917-9270",
      "priceRange": "£18-£75/month",
      "address": { "@type": "PostalAddress", "addressCountry": "GB" }
    },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "description": "Extended warranty coverage for all motorcycle makes including Honda, Yamaha, Kawasaki, Suzuki, Triumph, BMW Motorrad, Ducati, KTM, and Harley-Davidson. Covers engine, transmission, electrical systems, braking, and more.",
    "serviceType": "Motorcycle Extended Warranty",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Motorcycle Warranty Plans",
      "itemListElement": [
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "1 Year Motorcycle Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "2 Year Motorcycle Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "3 Year Motorcycle Warranty" } }
      ]
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": motorbikeFAQs.map(faq => ({
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
      { "@type": "ListItem", "position": 3, "name": "Motorcycle Extended Warranty", "item": "https://buyawarranty.co.uk/warranty-types/motorbike-motorcycle-warranty/" }
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "description": "UK's trusted extended vehicle warranty provider. Protecting vehicles since 2016.",
    "foundingDate": "2016",
    "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"],
    "contactPoint": { "@type": "ContactPoint", "telephone": "+44-800-917-9270", "contactType": "customer service", "areaServed": "GB", "availableLanguage": "English" }
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Motorcycle Extended Warranty UK - Get Instant Quote",
    "description": "Protect your motorcycle with comprehensive extended warranty cover. All UK makes and models covered. Engine, gearbox, electrics, braking & more. Nationwide UK coverage. Get your instant quote in 60 seconds.",
    "url": "https://buyawarranty.co.uk/warranty-types/motorbike-motorcycle-warranty/",
    "isPartOf": { "@type": "WebSite", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "about": { "@type": "Thing", "name": "Motorcycle Extended Warranty" },
    "mentions": [
      { "@type": "Brand", "name": "Honda" },
      { "@type": "Brand", "name": "Yamaha" },
      { "@type": "Brand", "name": "Kawasaki" },
      { "@type": "Brand", "name": "Triumph" },
      { "@type": "Thing", "name": "Extended Warranty" }
    ],
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".hero-description"] },
    "mainContentOfPage": { "@type": "WebPageElement", "cssSelector": "main" }
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Get a Motorcycle Extended Warranty Quote",
    "description": "Get an instant motorcycle extended warranty quote in 60 seconds",
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "position": 1, "name": "Enter Registration", "text": "Enter your motorcycle registration number to look up your vehicle details automatically" },
      { "@type": "HowToStep", "position": 2, "name": "Select Mileage", "text": "Choose your current mileage range (under or over 120,000 miles)" },
      { "@type": "HowToStep", "position": 3, "name": "Get Instant Quote", "text": "Receive your personalised warranty quote instantly with pricing for different coverage levels" }
    ]
  };

  return (
    <>
      <Helmet>
        <title>Motorcycle Extended Warranty UK | Motorbike Warranty | Get Instant Quote</title>
        <meta name="description" content="Protect your motorcycle with comprehensive extended warranty cover. All UK makes from Honda, Yamaha, Kawasaki, Triumph, BMW, Ducati & more. Engine, gearbox, electrics covered. From £18/month. Get your instant quote in 60 seconds." />
        <meta name="keywords" content="motorcycle extended warranty, motorbike warranty UK, motorcycle warranty cost, Honda warranty, Yamaha warranty, Kawasaki warranty, Triumph warranty, BMW motorcycle warranty, Ducati warranty, KTM warranty, Harley-Davidson warranty, used motorcycle warranty, motorbike warranty quote" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/motorbike-motorcycle-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="bingbot" content="index, follow" />
        
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5074;-0.1278" />
        <meta name="ICBM" content="51.5074, -0.1278" />
        <meta httpEquiv="content-language" content="en-GB" />
        
        <meta property="og:title" content="Motorcycle Extended Warranty UK | From £18/month" />
        <meta property="og:description" content="Comprehensive motorcycle warranty coverage. Engine, gearbox, electrics & more. All makes covered. Nationwide UK coverage with any garage. Get your instant quote now." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/motorbike-motorcycle-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Motorcycle Extended Warranty UK - Buy A Warranty" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Motorcycle Extended Warranty UK | From £18/month" />
        <meta name="twitter:description" content="Protect your motorcycle with comprehensive extended warranty. All makes covered. Nationwide UK coverage. Get instant quote." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        
        <meta name="ai-content-declaration" content="This page provides information about motorcycle extended warranty services in the UK. Human-authored and fact-checked." />
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
                {/* Brand Icon */}
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-4 md:mb-6">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-brand-orange/10 rounded-full flex items-center justify-center">
                    <Bike className="w-8 h-8 md:w-10 md:h-10 text-brand-orange" />
                  </div>
                </div>

                {/* H1 Headline */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Motorcycle Warranty </span>
                  <span className="text-brand-orange">in 60 Seconds!</span>
                </h1>

                {/* Subheadline */}
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6 hero-description">
                  Protect your motorbike with specialist-level repairs, UK-wide cover and no-surprise costs. Get a fixed-price warranty with instant cover for all UK motorcycle makes.
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

                  {/* Disclaimer */}
                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">
                    All manufacturer names and logos are trademarks of their respective owners. We are an independent warranty provider.
                  </p>
                  <TrustCallbackPanel />
                </div>
              </div>

              {/* Right Column - Hero Image */}
              <div className="relative">
                <div className="relative">
                  <OptimizedImage
                    src={motorcycleHeroImage}
                    alt="Motorcycle extended warranty UK - Comprehensive motorbike warranty coverage"
                    className="w-full h-auto object-contain max-w-lg mx-auto"
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
                    <div className="flex items-center space-x-1.5 bg-brand-orange/10 px-2 py-1 rounded-full">
                      <Bike className="w-4 h-4 sm:w-5 sm:h-5 text-brand-orange flex-shrink-0" />
                      <span className="font-bold text-brand-orange text-xs sm:text-sm lg:text-base">Motorbikes</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Electric</span>
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

        {/* Warranty Benefits Section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}>
          <WarrantyBenefitsSection headline="The Ultimate Motorcycle Warranty." />
        </Suspense>

        {/* Vehicle Coverage Accordion Section */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Motorcycle" />
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
          brandName="motorcycle"
          monthlyPrice="£18"
          onGetQuote={scrollToQuoteForm}
          repairs={[
            { name: 'Engine Rebuild', cost: '£1,500 – £3,500', icon: 'Car', severity: 'critical' },
            { name: 'Gearbox Internals', cost: '£800 – £2,500', icon: 'Wrench', severity: 'high' },
            { name: 'Clutch Basket & Pressure Plate', cost: '£400 – £1,200', icon: 'Wrench', severity: 'medium' },
            { name: 'ECU & Electronics', cost: '£600 – £1,800', icon: 'Zap', severity: 'high' },
            { name: 'Fork Cartridge Rebuild', cost: '£400 – £1,000', icon: 'Wrench', severity: 'medium' },
            { name: 'ABS Modulator Unit', cost: '£500 – £1,500', icon: 'Shield', severity: 'high' },
            { name: 'Fuel Pump & Injectors', cost: '£300 – £900', icon: 'Zap', severity: 'medium' },
            { name: 'Starter Motor & Alternator', cost: '£250 – £800', icon: 'Zap', severity: 'medium' },
            { name: 'Radiator & Cooling System', cost: '£300 – £900', icon: 'Shield', severity: 'medium' },
          ]}
        />

        {/* Motorcycle Models Section */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full Coverage Details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                All Motorcycle Makes Covered
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                Select your motorcycle to see tailored warranty options. We cover all major UK manufacturers from 2012 to 2026.
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
                  placeholder="Search by model (e.g. MT-07, Street Triple)"
                  className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm md:text-base"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-10 sticky top-0 bg-gradient-to-b from-slate-50 via-slate-50 to-transparent py-4 md:py-5 z-10 -mx-4 px-4">
              {manufacturerFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => { setActiveModelFilter(filter); setModelSearchQuery(''); }}
                  className={`px-3 md:px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    activeModelFilter === filter
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                  }`}
                >
                  {filter === 'All' ? 'All Makes' : filter}
                </button>
              ))}
            </div>

            {/* Models Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
              {filteredModels.map(({ model, years, category }) => (
                <button
                  key={`${category}-${model}`}
                  onClick={() => {
                    setSelectedModel(model);
                    scrollToQuoteForm();
                  }}
                  className={`group relative bg-white rounded-lg px-2 py-3 md:px-3 md:py-3 text-center border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    selectedModel === model
                      ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-md scale-[1.02]'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm focus:ring-slate-400'
                  }`}
                  aria-label={`${category} ${model}, years ${years.join(', ')}`}
                >
                  {/* Model Icon - minimal, no background */}
                  <Bike className={`w-6 h-6 mx-auto mb-1.5 transition-colors ${
                    selectedModel === model 
                      ? 'text-blue-500' 
                      : 'text-slate-400 group-hover:text-slate-600'
                  }`} strokeWidth={1.25} />
                  
                  {/* Model Name */}
                  <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">
                    {model}
                  </h3>
                  
                  {/* Manufacturer */}
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-medium leading-tight">
                    {category}
                  </p>
                  
                  {/* Years */}
                  <p className="text-[8px] md:text-[9px] text-slate-400 leading-tight mt-0.5">
                    {years.join(' · ')}
                  </p>
                </button>
              ))}
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
                <span><strong>Also covered:</strong> Scooters, adventure bikes, touring, and electric motorcycles</span>
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
                  <Bike className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{selectedModel} selected</p>
                  <p className="text-slate-500 text-xs md:text-sm">Step 1 of 2: Choose coverage →</p>
                </div>
              </div>
              <Button
                onClick={scrollToQuoteForm}
                className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25"
              >
                Get motorcycle warranty quote
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Why Motorcyclists Choose Us Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why Motorcyclists Choose Us
              </h2>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4"
              >
                Get Motorcycle Warranty
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Wrench, title: 'Specialist-level repairs and diagnostics', desc: 'Use any VAT-registered motorcycle specialist or garage across the UK.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team that knows motorcycles', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Bike, title: 'High mileage motorcycle warranty plans', desc: 'Cover bikes up to 150,000 miles with no mileage restrictions during cover.' },
                  { icon: Clock, title: 'Flexible monthly payments', desc: 'Cancel anytime and get a pro-rata refund. No lock-in contracts.' },
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
              
              {/* Mascot */}
              <div className="hidden lg:flex justify-center items-end">
                <OptimizedImage 
                  src={motorcycleCoverage}
                  alt="Motorcycle warranty coverage - Protect your motorbike with comprehensive cover"
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
                { step: 1, title: 'Diagnose', desc: 'Diagnose at any VAT-registered garage or bike specialist' },
                { step: 2, title: 'Authorise', desc: 'We authorise eligible repairs quickly' },
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your motorcycle' },
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
                Your motorcycle cover, made <span className="text-brand-orange">crystal clear</span>
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

        {/* High Mileage Section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              {/* Image on LEFT side */}
              <div className="flex justify-center">
                <OptimizedImage 
                  src={motorcyclePanda}
                  alt="Motorcycle warranty coverage - High mileage motorbike protection"
                  className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto object-contain"
                  width={448}
                  height={300}
                />
              </div>
              {/* Text on RIGHT side */}
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High Mileage Motorcycle, No Problem!
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Ride With Confidence<br />
                  <span className="text-brand-orange">You're Covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Once you have your motorcycle warranty, ride with complete peace of mind. If something 
                  goes wrong, simply call our claims team and we'll take care of everything.
                  We want to get you back on the road as soon as possible.
                </p>
                <div className="space-y-2 md:space-y-3 text-left max-w-md mx-auto lg:mx-0">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm md:text-base text-gray-700">Cover motorcycles up to 150,000 miles</span>
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
            
            {/* CTA Button */}
            <div className="mt-6 md:mt-10 max-w-xl mx-auto">
              <Button
                onClick={scrollToQuoteForm}
                className="w-full bg-brand-orange text-white font-bold py-5 md:py-6 text-base md:text-xl rounded-xl shadow-lg animate-breathing"
              >
                <span className="flex items-center justify-center gap-2 md:gap-3">
                  Get my instant motorcycle quote
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
                Additional Motorcycle Cover Options
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Enhance your motorcycle warranty with these optional extras
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Bike className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Roadside Recovery</h3>
                <p className="text-sm md:text-base text-gray-600">24/7 breakdown recovery for your motorcycle across the UK</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">European Cover</h3>
                <p className="text-sm md:text-base text-gray-600">Extended protection when touring abroad</p>
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
                  Your motorcycle is covered wherever you ride in the United Kingdom. Use any VAT-registered motorcycle specialist or general garage.
                </p>
                <ul className="space-y-2 md:space-y-3 text-left max-w-md mx-auto md:mx-0">
                  {[
                    'Use any VAT-registered garage',
                    'Motorcycle specialist or general garage',
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
                  alt="Miles the Panda giving thumbs up for UK-wide motorcycle coverage"
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
                What Motorcyclists Say
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Real reviews from real riders
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

export default MotorbikeWarrantyLanding;
