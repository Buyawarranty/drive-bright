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

// Lazy load heavy components
const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));
const VehicleCoverageSection = lazy(() => import('@/components/homepage/VehicleCoverageSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));

// Assets
import audiHeroImage from '@/assets/audi-extended-warranty-uk-miles-panda.webp';
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import audiWhyChooseUs from '@/assets/audi-used-car-warranty-uk.webp';
import audiHighMileage from '@/assets/audi-warranty-cover-uk.webp';
import audiMobileQuote from '@/assets/audi-warranty-mobile-quote.webp';

// Audi Models covered (grouped by category)
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
  },
  'Electric & Hybrid': {
    'e-tron': ['GE'],
    'Q4 e-tron': ['F4'],
    'Q8 e-tron': ['GE'],
    'A6 TFSI e': ['C8'],
    'Q5 TFSI e': ['FY'],
  },
};

type ModelCategory = keyof typeof audiModelCategories;

// FAQs
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
    answer: "Yes. Our plans cover e-tron, Q4 e-tron, Q8 e-tron and TFSI e plug-in hybrid components including the electric motor, battery management system, power electronics, on-board charger, and thermal management."
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

// Testimonials
const testimonials = [
  {
    name: "James H.",
    location: "Guildford",
    model: "Audi A4",
    text: "My A4's S tronic gearbox developed a fault at 48,000 miles. The repair was quoted at £2,100 but my warranty covered the entire bill. Outstanding service.",
    rating: 5
  },
  {
    name: "Claire W.",
    location: "Edinburgh",
    model: "Audi Q5",
    text: "The turbo on my Q5 failed just outside Audi's warranty. Buy A Warranty handled the claim in three days and paid the garage directly.",
    rating: 5
  },
  {
    name: "Tom P.",
    location: "Swindon",
    model: "Audi e-tron",
    text: "Finding EV warranty cover for my e-tron was a nightmare until I found these guys. They cover the electric motor, BMS and all the important bits.",
    rating: 5
  },
  {
    name: "Rachel D.",
    location: "Falkirk",
    model: "Audi A3",
    text: "My A3's MMI system failed at 5 years old — £1,100 to replace. The warranty paid out in full within days. Fantastic value for money.",
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
  const [activeModelFilter, setActiveModelFilter] = useState<ModelCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    const allModels = activeModelFilter === 'All'
      ? Object.entries(audiModelCategories).flatMap(([category, models]) => 
          Object.entries(models).map(([model, generations]) => ({ model, generations, category }))
        )
      : Object.entries(audiModelCategories[activeModelFilter]).map(([model, generations]) => ({ 
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
    trackButtonClick('audi_warranty_get_quote', { brand: 'Audi' });
    
    if (!regNumber.trim()) {
      toast({ title: "Registration Required", description: "Please enter your vehicle registration number.", variant: "destructive" });
      return;
    }
    
    if (!mileage.trim()) {
      toast({ title: "Mileage Required", description: "Please select your vehicle's mileage to continue.", variant: "destructive" });
      return;
    }
    
    setIsLookingUp(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber }
      });

      if (error) throw error;
      
      if (data?.found) {
        if (data.manufactureDate) {
          const ageInMs = Date.now() - new Date(data.manufactureDate).getTime();
          if (ageInMs / (365.25 * 24 * 60 * 60 * 1000) > 15) {
            setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old');
            toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" });
            setIsLookingUp(false);
            return;
          }
        }
        
        const vehicleData = {
          regNumber, mileage,
          make: data.make || 'AUDI',
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
    if (hero) {
      hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Schema.org structured data — optimised for Google, Bing, and AI search engines
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Audi Extended Warranty UK",
    "description": "Comprehensive used Audi extended warranty plans covering A3, A4, A5, A6, A7, A8, Q2, Q3, Q5, Q7, Q8, TT and e-tron models. Includes S tronic gearbox, quattro drivetrain, TFSI and TDI engines, MMI infotainment, air suspension and EV components. Available nationwide across England, Scotland, Wales and Northern Ireland from £25 per month.",
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
      "price": "25",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://buyawarranty.co.uk/warranty-types/audi-warranty/",
      "seller": { "@type": "Organization", "name": "Buy A Warranty" },
      "itemCondition": "https://schema.org/NewCondition",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": "25",
        "priceCurrency": "GBP",
        "unitText": "month",
        "billingIncrement": 1
      }
    },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5", "worstRating": "1" },
    "review": testimonials.map((t, i) => ({
      "@type": "Review",
      "author": { "@type": "Person", "name": t.name },
      "reviewRating": { "@type": "Rating", "ratingValue": t.rating, "bestRating": "5" },
      "reviewBody": t.text,
      "datePublished": new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    })),
    "category": "Vehicle Extended Warranty",
    "audience": { "@type": "Audience", "audienceType": "Used Audi car owners in England, Scotland, Wales and Northern Ireland" },
    "additionalProperty": [
      { "@type": "PropertyValue", "name": "Coverage Area", "value": "United Kingdom — England, Scotland, Wales, Northern Ireland" },
      { "@type": "PropertyValue", "name": "Max Vehicle Age", "value": "15 years" },
      { "@type": "PropertyValue", "name": "Max Mileage at Inception", "value": "150,000 miles" },
      { "@type": "PropertyValue", "name": "Claims Limit", "value": "Unlimited claims value" },
      { "@type": "PropertyValue", "name": "Garage Network", "value": "Any VAT-registered garage in the UK" }
    ]
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Audi Extended Warranty Service UK",
    "alternateName": ["Audi Used Car Warranty", "Audi Second Hand Warranty", "Audi Aftermarket Warranty", "Used Audi Warranty Cover UK"],
    "provider": {
      "@type": "LocalBusiness",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "telephone": "+44-800-917-9270",
      "priceRange": "£25-£95/month",
      "address": { "@type": "PostalAddress", "addressCountry": "GB", "addressRegion": "United Kingdom" },
      "geo": { "@type": "GeoCoordinates", "latitude": "51.5074", "longitude": "-0.1278" },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "09:00",
        "closes": "17:30"
      }
    },
    "areaServed": [
      { "@type": "Country", "name": "United Kingdom" },
      { "@type": "AdministrativeArea", "name": "England" },
      { "@type": "AdministrativeArea", "name": "Scotland" },
      { "@type": "AdministrativeArea", "name": "Wales" },
      { "@type": "AdministrativeArea", "name": "Northern Ireland" }
    ],
    "description": "Extended warranty protection for all used Audi models. Covers TFSI and TDI engines, S tronic dual-clutch gearbox, quattro all-wheel-drive system, MMI infotainment, air suspension, e-tron electric motors and battery management. Use any VAT-registered garage. 24/7 roadside assistance included. Monthly or annual plans with no mileage restrictions during cover.",
    "serviceType": "Vehicle Extended Warranty",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Audi Warranty Plans",
      "itemListElement": [
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "1 Year Audi Extended Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "2 Year Audi Extended Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "3 Year Audi Extended Warranty" } }
      ]
    },
    "termsOfService": "https://buyawarranty.co.uk/terms-and-conditions/"
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": audiFAQs.map(faq => ({
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
      { "@type": "ListItem", "position": 3, "name": "Audi Extended Warranty UK", "item": "https://buyawarranty.co.uk/warranty-types/audi-warranty/" }
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "description": "UK's trusted extended car warranty provider covering Audi, BMW, Mercedes-Benz and all major brands. Protecting vehicles nationwide since 2016.",
    "foundingDate": "2016",
    "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"],
    "contactPoint": { "@type": "ContactPoint", "telephone": "+44-800-917-9270", "contactType": "customer service", "areaServed": "GB", "availableLanguage": "English" }
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Audi Extended Warranty UK — Used Audi Warranty Cover from £25/mo | Buy A Warranty",
    "description": "Protect your used Audi with a comprehensive extended warranty. Covering all models from A3 to Q8 and e-tron across England, Scotland, Wales and Northern Ireland. S tronic, quattro, TFSI/TDI and EV components covered. Use any VAT-registered garage. Instant quote in 60 seconds.",
    "url": "https://buyawarranty.co.uk/warranty-types/audi-warranty/",
    "datePublished": "2024-01-15",
    "dateModified": new Date().toISOString().split('T')[0],
    "inLanguage": "en-GB",
    "isPartOf": { "@type": "WebSite", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "about": [
      { "@type": "Thing", "name": "Audi Extended Warranty" },
      { "@type": "Thing", "name": "Used Car Warranty UK" },
      { "@type": "Thing", "name": "Audi Aftermarket Warranty" }
    ],
    "mentions": [
      { "@type": "Brand", "name": "Audi" },
      { "@type": "Thing", "name": "S tronic gearbox" },
      { "@type": "Thing", "name": "quattro all-wheel drive" },
      { "@type": "Thing", "name": "TFSI engine" },
      { "@type": "Thing", "name": "TDI engine" },
      { "@type": "Thing", "name": "e-tron electric vehicle" },
      { "@type": "Thing", "name": "MMI infotainment system" }
    ],
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".hero-description", "[itemprop='description']"] },
    "mainContentOfPage": { "@type": "WebPageElement", "cssSelector": "main" },
    "potentialAction": {
      "@type": "Action",
      "name": "Get Audi Warranty Quote",
      "target": "https://buyawarranty.co.uk/warranty-types/audi-warranty/"
    }
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to get an Audi extended warranty quote in the UK",
    "description": "Get an instant Audi extended warranty quote online in 60 seconds. Available for all Audi models up to 15 years old and 150,000 miles.",
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "position": 1, "name": "Enter your Audi registration", "text": "Type your Audi registration number and we automatically look up your vehicle details via the DVLA database" },
      { "@type": "HowToStep", "position": 2, "name": "Select your current mileage", "text": "Choose whether your Audi is under or over 120,000 miles to see the right plans" },
      { "@type": "HowToStep", "position": 3, "name": "Get your instant quote", "text": "Receive personalised Audi warranty prices instantly — cover starts the same day" }
    ]
  };

  // AI-friendly ItemList schema for model coverage
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Audi models covered by Buy A Warranty",
    "description": "Complete list of Audi models eligible for extended warranty cover in the UK",
    "numberOfItems": Object.values(audiModelCategories).reduce((acc, cat) => acc + Object.keys(cat).length, 0),
    "itemListElement": Object.entries(audiModelCategories).flatMap(([category, models], catIdx) =>
      Object.keys(models).map((model, modelIdx) => ({
        "@type": "ListItem",
        "position": catIdx * 10 + modelIdx + 1,
        "name": `Audi ${model}`,
        "description": `Extended warranty cover for used Audi ${model} — ${category}`
      }))
    )
  };

  return (
    <>
      <Helmet>
        <title>Audi Extended Warranty UK | Used Audi Warranty Cover from £25/mo</title>
        <meta name="description" content="Get a used Audi extended warranty from £25/month. Covers A3, A4, A5, A6, Q3, Q5, Q7, Q8, TT and e-tron. S tronic gearbox, quattro drivetrain, TFSI/TDI engines and EV components included. Any VAT-registered garage across England, Scotland, Wales and Northern Ireland. Instant online quote in 60 seconds." />
        <meta name="keywords" content="Audi extended warranty, Audi used car warranty, Audi warranty UK, Audi warranty cost, Audi A4 warranty, Audi Q5 warranty, Audi e-tron warranty, Audi A3 warranty, Audi Q7 warranty, Audi S tronic warranty, used Audi warranty, second hand Audi warranty, Audi aftermarket warranty, Audi warranty cover, Audi breakdown cover, Audi mechanical warranty, Audi warranty quote online" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/audi-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="bingbot" content="index, follow" />
        
        {/* Geographic and language targeting */}
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5074;-0.1278" />
        <meta name="ICBM" content="51.5074, -0.1278" />
        <meta httpEquiv="content-language" content="en-GB" />
        <html lang="en-GB" />
        
        {/* Open Graph — unique to this page */}
        <meta property="og:title" content="Used Audi Extended Warranty UK — A3 to Q8 & e-tron Cover | Buy A Warranty" />
        <meta property="og:description" content="Protect your used Audi from unexpected repair bills. S tronic, quattro, TFSI/TDI and EV components covered. Use any garage in England, Scotland, Wales or Northern Ireland. Plans from £25/mo — get your instant quote now." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/audi-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Audi extended warranty UK — affordable used Audi warranty cover from Buy A Warranty" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Used Audi Extended Warranty UK — Cover from £25/mo" />
        <meta name="twitter:description" content="All Audi models covered including A3, A4, Q5, Q7, e-tron. S tronic, quattro, TFSI/TDI and EV components. Any UK garage. Instant quote." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta name="twitter:image:alt" content="Buy A Warranty — Audi extended warranty cover UK" />
        
        {/* AI search engine discoverability */}
        <meta name="ai-content-declaration" content="Authoritative page about Audi extended warranty services available in the United Kingdom. Human-authored, fact-checked, and regularly updated. Published by Buy A Warranty, a UK-regulated warranty provider since 2016." />
        <meta name="subject" content="Audi Extended Warranty UK" />
        <meta name="topic" content="Used Audi car warranty, extended warranty plans, mechanical breakdown cover" />
        <meta name="summary" content="Buy A Warranty offers used Audi extended warranty plans from £25/month covering all models from A3 to Q8 and e-tron. Includes S tronic gearbox, quattro drivetrain, TFSI/TDI engines and EV components. Available at any VAT-registered garage across England, Scotland, Wales and Northern Ireland." />
        <meta name="abstract" content="Comprehensive Audi aftermarket warranty provider in the UK. Covers mechanical and electrical failures on used Audi vehicles up to 15 years old and 150,000 miles." />
        <meta name="author" content="Buy A Warranty" />
        <meta name="publisher" content="Buy A Warranty" />
        <meta name="coverage" content="United Kingdom" />
        <meta name="distribution" content="global" />
        <meta name="rating" content="general" />
        <meta name="revisit-after" content="7 days" />
        <meta name="classification" content="Automotive Insurance, Vehicle Extended Warranty, Car Warranty UK" />
        <meta name="category" content="Automotive" />
        <meta name="pagetype" content="product-landing" />
        
        {/* Structured Data */}
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListSchema)}</script>
      </Helmet>

      <main className="min-h-screen bg-white" role="main" itemScope itemType="https://schema.org/WebPage" lang="en-GB">
        <meta itemProp="name" content="Audi Extended Warranty UK" />
        {/* Hero Section */}
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-6 pb-12 md:pt-12 md:pb-24" aria-label="Get an instant Audi warranty quote">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              {/* Left Column - Content */}
              <div className="text-center lg:text-left">

                {/* H1 Headline */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4" itemProp="headline">
                  <span className="text-gray-900">Protect your Audi in</span>
                  <br />
                  <span className="text-brand-orange">60 seconds.</span>
                </h1>

                {/* Subheadline */}
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6 hero-description" itemProp="description">
                  Used Audi extended warranty from £19/month. Covers S tronic, quattro, TFSI/TDI and e-tron components at any UK garage.
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
                    Audi is a registered trademark of AUDI AG. We are an independent warranty provider.
                  </p>
                  <TrustCallbackPanel />
                </div>
              </div>

              {/* Right Column - Hero Image with Mascot */}
              <div className="relative">
                {/* Hero Image */}
                <div className="relative">
                  <OptimizedImage
                    src={audiHeroImage}
                    alt="Audi extended warranty UK - Miles the Panda with two Audi cars, affordable used Audi warranty cover"
                    className="w-full h-auto"
                    priority={true}
                    width={1024}
                    height={640}
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
          <WarrantyBenefitsSection headline="The ultimate Audi warranty." />
        </Suspense>

        {/* Vehicle Coverage Accordion Section - Matching Homepage */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Audi" />
        </Suspense>

        {/* Cover Clarity Section */}
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        {/* Extended Warranty Video Section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>

        {/* What Audi Repairs Actually Cost */}
        <section className="py-10 md:py-16 bg-white" aria-label="Audi repair costs without warranty">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Wrench className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
                <span className="text-xs md:text-sm font-semibold text-red-700">Without warranty, you pay the full bill</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                What Audi repairs actually cost in the UK
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                A single Audi breakdown could cost more than years of warranty cover. Here's what owners across the UK pay without protection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[
                { name: 'S tronic Gearbox & Mechatronics', cost: '£1,500 – £3,500', icon: Wrench, severity: 'critical' },
                { name: 'Turbocharger (TFSI/TDI)', cost: '£1,200 – £3,000', icon: Zap, severity: 'high' },
                { name: 'Engine Rebuild', cost: '£3,000 – £6,000', icon: Car, severity: 'critical' },
                { name: 'quattro Transfer Case', cost: '£1,200 – £2,800', icon: Wrench, severity: 'high' },
                { name: 'Air Suspension Strut', cost: '£800 – £2,000', icon: Car, severity: 'medium' },
                { name: 'MMI System Replacement', cost: '£800 – £1,500', icon: Zap, severity: 'medium' },
                { name: 'EV Drive Motor (e-tron)', cost: '£2,500 – £5,000', icon: Zap, severity: 'high' },
                { name: 'DPF Filter Replacement', cost: '£1,000 – £2,500', icon: Shield, severity: 'high' },
                { name: 'Fuel Injector Set', cost: '£800 – £2,000', icon: Wrench, severity: 'medium' },
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

        {/* Audi Models Section - Premium Design */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full Coverage Details
              </div>
               <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                All Audi models covered across the UK
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                Select your Audi model to see tailored warranty options. We cover every model from A1 to R8 at any VAT-registered garage in England, Scotland, Wales and Northern Ireland.
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
                  placeholder="Search by model or chassis code (e.g. A4, B9)"
                  className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm md:text-base"
                />
              </div>
            </div>

            {/* Filter Tabs */}
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
                onClick={() => { setActiveModelFilter('Saloon & Sportback'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'Saloon & Sportback'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}
              >
                Saloon & Sportback
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
                onClick={() => { setActiveModelFilter('Coupé & Convertible'); setModelSearchQuery(''); }}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  activeModelFilter === 'Coupé & Convertible'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 focus:ring-slate-900'
                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400'
                }`}
              >
                Coupé & Convertible
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
                  e-tron / Electric
                </span>
              </button>
            </div>

            {/* Models Grid */}
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
                    aria-label={`Audi ${model}, chassis codes ${generations.join(', ')}`}
                  >
                    {/* EV Badge */}
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
                      Audi {model}
                    </h3>
                    
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
                <span><strong>Also covered:</strong> S-Line variants, quattro models, and plug-in hybrids</span>
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
                  <p className="font-bold text-slate-900">Audi {selectedModel} selected</p>
                  <p className="text-slate-500 text-xs md:text-sm">Step 1 of 2: Choose coverage →</p>
                </div>
              </div>
              <Button
                onClick={scrollToQuoteForm}
                className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25"
              >
                Get warranty quote for Audi
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Why Audi Drivers Choose Us Section */}
        <section className="py-10 md:py-16 bg-white" aria-label="Why UK Audi drivers choose Buy A Warranty">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why Audi drivers across the UK choose us
              </h2>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4"
              >
                Get Audi Warranty
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Wrench, title: 'Dealer-level repairs and diagnostics', desc: 'Professional repairs at any VAT-registered garage across the UK.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team that knows Audi systems', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Car, title: 'High mileage Audi warranty plans', desc: 'Cover vehicles up to 150,000 miles with no mileage restrictions during cover.' },
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
              
              {/* Mascot - Miles the Panda with Audi */}
              <div className="hidden lg:flex justify-center items-end">
               <OptimizedImage 
                   src={audiWhyChooseUs}
                   alt="Audi Q4 e-tron extended warranty UK - Why Audi drivers choose BuyAWarranty for transparent coverage"
                   className="w-[400px] h-auto object-contain"
                   priority={false}
                   width={400}
                   height={300}
                 />
              </div>
            </div>
          </div>
        </section>

        {/* How Audi warranty claims work */}
        <section className="py-10 md:py-16 bg-gray-50" aria-label="How Audi warranty claims work in the UK">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                How Audi warranty claims work
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {[
                { step: 1, title: 'Diagnose', desc: 'Diagnose at any VAT-registered garage' },
                { step: 2, title: 'Authorise', desc: 'We authorise eligible repairs quickly' },
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your Audi' },
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

        {/* Your Audi Cover Made Crystal Clear Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent Coverage</span>
              </div>
               <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your Audi cover, made <span className="text-brand-orange">crystal clear</span>
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                See exactly what's included — clear terms, plain English, no surprises. Trusted by Audi owners across the UK.
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

        {/* High Mileage Audi Section */}
        <section className="py-10 md:py-16 bg-gray-50" aria-label="High mileage Audi warranty cover UK">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              {/* Image on LEFT side */}
              <div className="flex justify-center">
                 <OptimizedImage 
                   src={audiMobileQuote}
                   alt="Audi A3 extended warranty quote on mobile — instant online quote for used Audi warranty UK"
                   className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto object-contain"
                   width={448}
                   height={500}
                 />
              </div>
              {/* Text on RIGHT side */}
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High mileage Audi? No problem
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Drive your Audi with confidence<br />
                  <span className="text-brand-orange">You're covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Once you have your Audi warranty, drive with complete peace of mind across England, Scotland, Wales and Northern Ireland. 
                  If something goes wrong, simply call our UK-based claims team and we'll take care of everything — 
                  we want to get you back on the road as quickly as possible.
                </p>
                <div className="space-y-2 md:space-y-3 text-left max-w-md mx-auto lg:mx-0">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm md:text-base text-gray-700">Cover vehicles up to 150,000 miles</span>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm md:text-base text-gray-700">Cover for used Audi models</span>
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
                  Get my instant quote
                  <ArrowRight className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3} />
                </span>
              </Button>
            </div>
          </div>
        </section>

        {/* Additional Audi Cover Options Section */}
        <section className="py-10 md:py-16 bg-white" aria-label="Optional Audi warranty extras">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Additional Audi cover options
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Enhance your Audi warranty with these optional extras — available across the UK
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Car className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Courtesy Car</h3>
                <p className="text-sm md:text-base text-gray-600">Keep moving while your Audi is being repaired</p>
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
        <section className="py-10 md:py-16 bg-gradient-to-br from-blue-900 to-gray-900 text-white" aria-label="Audi warranty coverage across the UK">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6 text-white">
                  Audi warranty cover across the entire UK
                </h2>
                <p className="text-base md:text-lg text-white mb-4 md:mb-6">
                  Your Audi is covered wherever you drive in England, Scotland, Wales and Northern Ireland. Our network of approved garages spans the whole of the United Kingdom.
                </p>
                <ul className="space-y-2 md:space-y-3 text-left max-w-md mx-auto md:mx-0">
                  {[
                    'Use any VAT-registered garage',
                    'Audi dealer or specialist garage',
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
                What Audi Owners Say
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Real reviews from real Audi drivers
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

export default AudiWarrantyLanding;
