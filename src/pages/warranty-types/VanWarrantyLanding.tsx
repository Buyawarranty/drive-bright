import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, ChevronUp, MapPin, Clock, Users, Car, Wrench, Zap, Star, Award, ThumbsUp, FileCheck, MessageCircle, Truck, Search, AlertTriangle, Info, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import { OptimizedImage } from '@/components/OptimizedImage';
import MileageQuickSelect from '@/components/MileageQuickSelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';
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
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import pandaThumbsUp from '@/assets/extended-van-warranty-uk.png';
import trustpilotBadge from '@/assets/trustpilot-badge.png';
import vanHeroImage from '@/assets/uk-extended-used-van-warranty.png';
import fordTransitVan from '@/assets/uk-van-warranty-ford-transit.webp';
import vanIcon from '@/assets/van-icon.png';

// UK Van Models covered (grouped by manufacturer) - 2012-2026
const vanModelCategories = {
  'Ford': {
    'Transit': ['Custom', 'Connect', 'Courier', 'Panel Van', 'Chassis Cab'],
    'Transit Custom': ['L1', 'L2', 'Double Cab', 'Kombi'],
    'Transit Connect': ['L1', 'L2', 'Double Cab'],
    'Ranger': ['Wildtrak', 'Raptor', 'XL', 'XLT'],
  },
  'Mercedes-Benz': {
    'Sprinter': ['L1H1', 'L2H2', 'L3H2', 'L4H3', 'Panel Van', 'Chassis Cab'],
    'Vito': ['L1', 'L2', 'L3', 'Tourer', 'Panel Van'],
    'Citan': ['L1', 'L2', 'Tourer'],
  },
  'Volkswagen': {
    'Transporter': ['T6', 'T6.1', 'T7', 'Kombi', 'Panel Van', 'Chassis Cab'],
    'Crafter': ['L3', 'L4', 'L5', 'Panel Van', 'Chassis Cab', 'Dropside'],
    'Caddy': ['Maxi', 'Cargo', 'Life', 'Panel Van'],
    'Amarok': ['Highline', 'Aventura', 'Trendline'],
  },
  'Renault': {
    'Master': ['L1H1', 'L2H2', 'L3H2', 'L4H3', 'Panel Van', 'Chassis Cab'],
    'Trafic': ['L1', 'L2', 'Panel Van', 'Passenger'],
    'Kangoo': ['L1', 'L2', 'Maxi', 'Express'],
  },
  'Citroën': {
    'Relay': ['L1H1', 'L2H2', 'L3H2', 'L4H3', 'Panel Van', 'Chassis Cab'],
    'Dispatch': ['M', 'XL', 'Panel Van', 'Platform Cab'],
    'Berlingo': ['M', 'XL', 'Panel Van', 'Crew Van'],
  },
  'Peugeot': {
    'Boxer': ['L1H1', 'L2H2', 'L3H2', 'L4H3', 'Panel Van', 'Chassis Cab'],
    'Expert': ['Standard', 'Long', 'Panel Van', 'Platform Cab'],
    'Partner': ['Standard', 'Long', 'Panel Van', 'Crew Van'],
  },
  'Vauxhall': {
    'Movano': ['L1H1', 'L2H2', 'L3H2', 'L4H3', 'Panel Van', 'Chassis Cab'],
    'Vivaro': ['L1', 'L2', 'Panel Van', 'Doublecab'],
    'Combo': ['L1', 'L2', 'Cargo', 'Life'],
  },
  'Fiat': {
    'Ducato': ['L1H1', 'L2H2', 'L3H2', 'L4H3', 'Panel Van', 'Chassis Cab'],
    'Talento': ['L1', 'L2', 'Panel Van', 'Crew Cab'],
    'Doblo': ['L1', 'L2', 'Cargo', 'Combi'],
  },
  'Nissan': {
    'NV400': ['L1H1', 'L2H2', 'L3H2', 'Panel Van', 'Chassis Cab'],
    'NV300': ['L1', 'L2', 'Panel Van', 'Crew Van'],
    'NV200': ['Panel Van', 'Combi', 'Acenta', 'Tekna'],
    'Navara': ['King Cab', 'Double Cab', 'Tekna', 'N-Connecta'],
  },
  'Toyota': {
    'Proace': ['Compact', 'Medium', 'Long', 'Panel Van', 'Crew Cab'],
    'Proace City': ['Short', 'Long', 'Panel Van', 'Crew Van'],
    'Hilux': ['Active', 'Icon', 'Invincible', 'Invincible X'],
  },
  'Iveco': {
    'Daily': ['L1H1', 'L2H2', 'L3H2', 'L4H3', 'Panel Van', 'Chassis Cab', 'Dropside'],
  },
  'MAN': {
    'TGE': ['L1H1', 'L2H2', 'L3H2', 'L4H3', 'Panel Van', 'Chassis Cab'],
  },
};

type ManufacturerCategory = keyof typeof vanModelCategories;

// Popular van anchors for SEO long-tail
const popularVans = [
  { name: 'Ford Transit', id: 'ford-transit' },
  { name: 'Mercedes Sprinter', id: 'mercedes-sprinter' },
  { name: 'Vauxhall Vivaro', id: 'vauxhall-vivaro' },
  { name: 'VW Transporter', id: 'vw-transporter' },
];

// Van-specific coverage components
const vanCoverageItems = [
  {
    title: 'Engine & turbo',
    icon: Truck,
    items: [
      'Engine block and cylinder head',
      'Turbocharger and wastegate',
      'Diesel injectors and fuel pump',
      'Timing belt/chain and tensioners',
      'Oil pump and oil cooler',
    ]
  },
  {
    title: 'Gearbox & drivetrain',
    icon: Wrench,
    items: [
      'Manual and automatic gearbox',
      'Clutch assembly (if not wear item)',
      'Differential (front & rear)',
      'Drive shafts and CV joints',
      'Torque converter',
    ]
  },
  {
    title: 'Emissions & diesel systems',
    icon: Shield,
    tooltip: 'DPF and EGR are covered when they fail mechanically — not due to soot build-up from short journeys.',
    items: [
      'DPF (diesel particulate filter)',
      'EGR valve and cooler',
      'AdBlue / SCR system',
      'High-pressure fuel rail',
      'Intercooler',
    ]
  },
  {
    title: 'Electrical & electronics',
    icon: Zap,
    items: [
      'ECU and control modules',
      'Starter motor and alternator',
      'Central locking and immobiliser',
      'Instrument cluster',
      'Sensors and actuators',
    ]
  },
];

// What's NOT covered - transparency block
const notCoveredItems = [
  'Routine servicing and MOT items',
  'Bodywork, paint, and glass',
  'Tyres, brake pads, and wiper blades',
  'Pre-existing faults known at purchase',
  'Cosmetic interior trim damage',
];

// Van-specific FAQs
const vanFAQs = [
  {
    question: "Can I use my van for courier, trade, or commercial work?",
    answer: "Absolutely. Our warranty covers commercial use including courier, delivery, trade, and fleet vehicles. Your van is covered whether you're a sole trader or part of a larger fleet."
  },
  {
    question: "Is my van too old or too many miles?",
    answer: "We cover vans up to 15 years old and 150,000 miles at the start of your policy. Once covered, there are no mileage restrictions during your warranty period."
  },
  {
    question: "Can I use my own garage for repairs?",
    answer: "Yes — any VAT-registered garage in the UK is fine. You don't have to use a main dealer or approved repairer. Just make sure the garage calls us before starting work."
  },
  {
    question: "Are diagnostics covered?",
    answer: "Diagnostics are usually covered when the fault is approved under your warranty. The garage just needs to contact our claims team first."
  },
  {
    question: "What about modified vans?",
    answer: "Most body modifications are accepted — racking, ply-lining, sign-writing, and similar fitments are fine. Give us a ring on 0330 229 5040 if you're unsure about a specific modification."
  },
  {
    question: "Do I need a full service history?",
    answer: "A reasonable service history is fine. We understand that commercial vehicles don't always have a perfect dealer history. Many vans are accepted even if some services were missed."
  },
  {
    question: "What claim limits are available?",
    answer: "We offer claim limits of £1,000, £2,000, £3,000, and £5,000 per claim. Every plan includes unlimited claims, and you can choose a zero-excess option. Most van owners go for £3,000 — it covers the majority of common repairs in full."
  },
  {
    question: "Is breakdown recovery included?",
    answer: "Breakdown recovery is included as standard on all 2-year and 3-year plans at no extra cost. For 1-year plans, it's available as an optional add-on."
  },
  {
    question: "How quickly does cover start?",
    answer: "Cover starts the same day you purchase — there's no waiting period and no inspection required. You're protected from the moment you buy."
  },
  {
    question: "How do I make a claim?",
    answer: "Take your van to any VAT-registered garage for diagnosis. Before any repairs begin, the garage must call our claims team on 0330 229 5045. We'll authorise the work and pay the garage directly. It's that simple."
  },
  {
    question: "What's the most expensive repair you've covered?",
    answer: "We regularly cover repairs over £1,500 for engines, gearboxes, and ECUs. With our £5,000 claim limit, even major work like a full gearbox rebuild or engine replacement is covered."
  },
];

// Testimonials
const testimonials = [
  {
    name: "Mike T.",
    location: "Swindon",
    model: "Ford Transit Custom",
    boldLine: "Saved me over £2,500.",
    text: "My Transit is essential for my plumbing business. When the gearbox went at 95,000 miles, they sorted it in 3 days. Brilliant service all round.",
    rating: 5
  },
  {
    name: "Steve R.",
    location: "Falkirk",
    model: "Mercedes Sprinter",
    boldLine: "Claim was approved same day.",
    text: "Our Sprinter needed a new turbo. The garage was paid directly and we were back on the road within the week.",
    rating: 5
  },
  {
    name: "Karen L.",
    location: "Wakefield",
    model: "VW Transporter",
    boldLine: "Fuel pump failed and they covered the lot.",
    text: "I was worried about getting warranty for a high-mileage van but they covered my T6 no problem.",
    rating: 5
  },
  {
    name: "Paul D.",
    location: "Basildon",
    model: "Renault Trafic",
    boldLine: "No excess to pay either.",
    text: "Professional service from start to finish. The injector failed on my Trafic and they handled everything.",
    rating: 5
  },
  {
    name: "Chris M.",
    location: "Bridgend",
    model: "Ford Transit",
    boldLine: "Buy A Warranty approved the £2,100 claim same day.",
    text: "Turbo went on my Transit at 87,000 miles. Absolutely fantastic service.",
    rating: 5
  },
  {
    name: "Dave H.",
    location: "Tamworth",
    model: "Citroën Relay",
    boldLine: "Covered the full £1,800 repair without question.",
    text: "DPF went on my Relay at 102,000 miles. I expected a fight but the whole claim was sorted within a week. Highly recommend.",
    rating: 5
  }
];

const VanWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [callbackVisible, setCallbackVisible] = useState(false);
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const [activeManufacturer, setActiveManufacturer] = useState<ManufacturerCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setCallbackVisible(window.scrollY > 300);
      setShowStickyCTA(window.scrollY > 600);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    const allModels = activeManufacturer === 'All'
      ? Object.entries(vanModelCategories).flatMap(([manufacturer, models]) => 
          Object.entries(models).map(([model, variants]) => ({ model, variants, manufacturer }))
        )
      : Object.entries(vanModelCategories[activeManufacturer]).map(([model, variants]) => ({ 
          model, 
          variants, 
          manufacturer: activeManufacturer 
        }));
    
    if (!modelSearchQuery.trim()) return allModels;
    
    const query = modelSearchQuery.toLowerCase();
    return allModels.filter(({ model, manufacturer, variants }) => 
      model.toLowerCase().includes(query) || 
      manufacturer.toLowerCase().includes(query) ||
      variants.some(v => v.toLowerCase().includes(query))
    );
  }, [activeManufacturer, modelSearchQuery]);

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
    trackButtonClick('van_warranty_get_quote', { vehicleType: 'van' });
    
    if (!regNumber.trim()) {
      toast({
        title: "Registration required",
        description: "Please enter your vehicle registration number.",
        variant: "destructive",
      });
      return;
    }
    
    if (!mileage.trim()) {
      toast({
        title: "Mileage required",
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
              title: "Vehicle not eligible",
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
          make: data.make || 'Unknown',
          model: data.model,
          fuelType: data.fuelType,
          transmission: data.transmission,
          year: data.yearOfManufacture,
          vehicleType: 'van',
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
          vehicleType: 'van',
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
        vehicleType: 'van',
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
    "name": "UK van warranty — platinum complete cover",
    "description": "Comprehensive extended warranty for UK commercial vans. Covers engine, turbo, gearbox, DPF, EGR, electrics and more. Ford Transit, Mercedes Sprinter, VW Transporter, Vauxhall Vivaro and all major makes. Claim limits from £1,000 to £5,000. Zero excess available. From £19/month.",
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
      "url": "https://buyawarranty.co.uk/warranty-types/vans-warranty/",
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
    "audience": { "@type": "Audience", "audienceType": "Commercial van owners in the United Kingdom" }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": vanFAQs.map(faq => ({
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
      { "@type": "ListItem", "position": 2, "name": "Warranty types", "item": "https://buyawarranty.co.uk/warranty-types/" },
      { "@type": "ListItem", "position": 3, "name": "Van warranty", "item": "https://buyawarranty.co.uk/warranty-types/vans-warranty/" }
    ]
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Van extended warranty service",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "telephone": "+44-800-917-9270",
      "priceRange": "£19-£95/month",
      "address": { "@type": "PostalAddress", "addressCountry": "GB" }
    },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "description": "Extended warranty for all UK commercial vans. Ford Transit, Mercedes Sprinter, VW Transporter, Vauxhall Vivaro, Renault Master and more.",
    "serviceType": "Vehicle Extended Warranty"
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "description": "UK's trusted extended vehicle warranty provider.",
    "foundingDate": "2016",
    "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"],
    "contactPoint": { "@type": "ContactPoint", "telephone": "+44-800-917-9270", "contactType": "customer service", "areaServed": "GB", "availableLanguage": "English" }
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Van warranty UK — instant quote",
    "description": "Protect your commercial van with comprehensive extended warranty cover. All major makes covered. From £19/month.",
    "url": "https://buyawarranty.co.uk/warranty-types/vans-warranty/",
    "isPartOf": { "@type": "WebSite", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "about": { "@type": "Thing", "name": "Van Extended Warranty" },
    "mentions": [
      { "@type": "Brand", "name": "Ford" },
      { "@type": "Brand", "name": "Mercedes-Benz" },
      { "@type": "Brand", "name": "Volkswagen" },
      { "@type": "Brand", "name": "Vauxhall" },
      { "@type": "Brand", "name": "Renault" },
      { "@type": "Brand", "name": "Citroën" },
      { "@type": "Brand", "name": "Peugeot" },
      { "@type": "Brand", "name": "Fiat" },
      { "@type": "Brand", "name": "Nissan" },
      { "@type": "Brand", "name": "Toyota" },
      { "@type": "Brand", "name": "Iveco" },
      { "@type": "Brand", "name": "MAN" },
    ],
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".hero-description"] },
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to get a van warranty quote",
    "description": "Get an instant van warranty quote in 30 seconds",
    "totalTime": "PT30S",
    "step": [
      { "@type": "HowToStep", "position": 1, "name": "Enter your reg", "text": "Pop in your van registration number and we'll look it up automatically" },
      { "@type": "HowToStep", "position": 2, "name": "Choose your mileage", "text": "Tell us whether your van is under or over 120,000 miles" },
      { "@type": "HowToStep", "position": 3, "name": "See your price", "text": "Get your personalised quote instantly — no phone call needed" }
    ]
  };

  return (
    <>
      <Helmet>
        <title>Van warranty UK | From £19/mo | Buy A Warranty</title>
        <meta name="description" content="Keep your business moving with comprehensive van warranty cover. Ford Transit, Mercedes Sprinter, VW Transporter & all major makes. Engine, turbo, gearbox, DPF covered. Claim limits up to £5,000. Zero excess available. Same-day cover. Free 30-second quote." />
        <meta name="keywords" content="van warranty UK, commercial van warranty, Ford Transit warranty, Mercedes Sprinter warranty, VW Transporter warranty, Vauxhall Vivaro warranty, van extended warranty, used van warranty, van breakdown cover, courier van warranty, trade van warranty, high mileage van warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/vans-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5074;-0.1278" />
        <meta name="ICBM" content="51.5074, -0.1278" />
        <meta httpEquiv="content-language" content="en-GB" />
        
        <meta property="og:title" content="Van warranty UK | Keep your business moving | From £19/mo" />
        <meta property="og:description" content="Comprehensive van warranty. Engine, turbo, gearbox, DPF & more. All major makes covered. Nationwide UK. Same-day cover. Get your free quote." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/vans-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Van warranty UK | From £19/month" />
        <meta name="twitter:description" content="Keep your van on the road with comprehensive warranty cover. All major makes. Same-day cover. Free instant quote." />
        
        <meta name="ai-content-declaration" content="UK commercial van warranty information. Human-authored and fact-checked." />
        <meta name="author" content="Buy A Warranty" />
        <meta name="audience" content="Commercial van owners, couriers, tradespeople, fleet managers" />
        
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
      </Helmet>

      <main className="min-h-screen bg-white" role="main">
        {/* ===== HERO SECTION ===== */}
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-6 pb-12 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              {/* Left Column */}
              <div className="text-center lg:text-left">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Avoid costly repairs.</span>
                  <br className="hidden sm:block" />
                  <span className="text-gray-900"> Protect your van in </span>
                  <span className="text-brand-orange">60 seconds.</span>
                </h1>

                {/* Trust strip */}
                <div className="mb-4 md:mb-6 text-gray-600 text-sm md:text-base space-y-2">
                  <div className="flex items-start justify-center lg:justify-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="font-medium">From just £19/month&nbsp; •&nbsp; Easy claims&nbsp; •&nbsp; Fast payouts</span>
                  </div>
                  <div className="flex items-start justify-center lg:justify-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="font-medium">Unlimited claims&nbsp; •&nbsp; Parts and Labour&nbsp; •&nbsp; Work use</span>
                  </div>
                </div>

                {/* Quote Form */}
                <div className="mx-auto lg:mx-0 space-y-4">
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
                      aria-label="Vehicle registration number"
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

                  {/* Micro-trust panel */}
                  <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-5 py-4 text-center">
                    <p className="text-sm sm:text-[17px] font-bold text-[#1B2A4A]">
                      Fair price. Fast quote. No surprises.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs sm:text-[15px] mt-1.5">
                      <span className="text-gray-600">Speak to an expert:</span>
                      <a href="tel:03302295040" className="font-semibold text-gray-900 hover:underline">
                        0330 229 5040
                      </a>
                      <span className="text-gray-400">·</span>
                      <a
                        href="https://wa.me/443302295040"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                      <span className="text-gray-400">·</span>
                      <button
                        onClick={() => setShowCallbackModal(true)}
                        className="text-brand-orange hover:underline font-medium"
                      >
                        Request a callback
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Hero Image */}
              <div className="relative">
                <div className="relative">
                  <OptimizedImage
                    src={vanHeroImage}
                    alt="UK van warranty — Miles the Buy A Warranty panda mascot with Ford Transit Custom and Volkswagen Transporter"
                    className="w-full h-auto max-w-md mx-auto object-contain"
                    priority={true}
                    width={600}
                    height={450}
                    style={{ border: 'none', boxShadow: 'none' }}
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
                        alt="Trustpilot rated excellent" 
                        className="h-auto w-28 sm:w-36 object-contain"
                        width={144}
                        height={61}
                      />
                    </a>
                  </div>
                </div>

                {/* Value proposition line */}
                <div className="flex flex-col items-center gap-4 mt-6">
                  <p className="text-base sm:text-lg font-medium text-gray-700">
                    Keep your van on the road and your income protected — <span className="text-brand-orange font-semibold">Instant cover</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ===== WARRANTY BENEFITS ===== */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}>
          <WarrantyBenefitsSection headline="The ultimate van warranty." />
        </Suspense>

        {/* ===== VAN-SPECIFIC COVERAGE ===== */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">What's covered</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Van-specific components we cover
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                Built for how vans actually break down — turbo, DPF, injectors, gearbox and more.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
              {vanCoverageItems.map((category, idx) => (
                <div key={idx} className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-brand-orange/10 rounded-lg flex items-center justify-center">
                      <category.icon className="w-5 h-5 text-brand-orange" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{category.title}</h3>
                    {category.tooltip && (
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-gray-400 cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">{category.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {category.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* What's NOT covered */}
            <div className="bg-gray-50 rounded-xl p-5 md:p-6 border border-gray-200 max-w-2xl mx-auto">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <X className="w-5 h-5 text-red-500" />
                What's not covered
              </h3>
              <ul className="space-y-2">
                {notCoveredItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                Full terms available in your policy document. No hidden exclusions — just honest cover.
              </p>
            </div>
          </div>
        </section>

        {/* ===== VEHICLE COVERAGE ACCORDION ===== */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Van" />
        </Suspense>

        {/* ===== COVER CLARITY ===== */}
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        {/* ===== VIDEO ===== */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>

        {/* ===== VALUE FRAMING — KEEP YOUR BUSINESS MOVING ===== */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 font-semibold text-sm px-4 py-2 rounded-full mb-4">
                <AlertTriangle className="w-4 h-4" />
                One breakdown could cost more than a year of cover
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                What van repairs actually cost
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                When your van's off the road, you're not just paying for parts — you're losing income. Here's what unprotected van owners face.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {[
                { part: 'Turbocharger replacement', cost: '£1,800 – £3,500', icon: Zap, severity: 'high', downtime: '3-5 days off road' },
                { part: 'DPF filter replacement', cost: '£1,200 – £2,800', icon: Shield, severity: 'high', downtime: '2-4 days off road' },
                { part: 'Gearbox rebuild', cost: '£2,000 – £4,500', icon: Wrench, severity: 'critical', downtime: '5-10 days off road' },
                { part: 'Engine rebuild', cost: '£3,000 – £5,000', icon: Truck, severity: 'critical', downtime: '7-14 days off road' },
                { part: 'Fuel injector set', cost: '£800 – £2,200', icon: Zap, severity: 'medium', downtime: '1-3 days off road' },
                { part: 'Clutch & flywheel', cost: '£900 – £1,800', icon: Wrench, severity: 'medium', downtime: '2-3 days off road' },
                { part: 'ECU replacement', cost: '£700 – £1,500', icon: Zap, severity: 'medium', downtime: '1-2 days off road' },
                { part: 'EGR valve failure', cost: '£400 – £900', icon: Shield, severity: 'medium', downtime: '1-2 days off road' },
                { part: 'Timing chain kit', cost: '£800 – £2,000', icon: Clock, severity: 'high', downtime: '3-5 days off road' },
              ].map((repair, index) => {
                const severityColor = repair.severity === 'critical' 
                  ? 'border-red-200 bg-red-50/50' 
                  : repair.severity === 'high' 
                  ? 'border-orange-200 bg-orange-50/30' 
                  : 'border-slate-200 bg-white';
                const costColor = repair.severity === 'critical' 
                  ? 'text-red-600' 
                  : repair.severity === 'high' 
                  ? 'text-orange-600' 
                  : 'text-slate-900';
                
                return (
                  <div key={index} className={`relative rounded-xl border-2 ${severityColor} p-4 md:p-5 transition-all hover:shadow-md`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          repair.severity === 'critical' ? 'bg-red-100' : repair.severity === 'high' ? 'bg-orange-100' : 'bg-slate-100'
                        }`}>
                          <repair.icon className={`w-5 h-5 ${
                            repair.severity === 'critical' ? 'text-red-600' : repair.severity === 'high' ? 'text-orange-600' : 'text-slate-600'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm md:text-base">{repair.part}</h3>
                          <p className={`text-lg md:text-xl font-bold ${costColor} mt-0.5`}>{repair.cost}</p>
                          <p className="text-xs text-slate-500 mt-0.5">⏱ {repair.downtime}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparison CTA — repair cost vs plan */}
            <div className="mt-8 md:mt-12 text-center">
              <div className="bg-brand-deep-blue rounded-2xl p-8 md:p-12 max-w-3xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-6">
                  <div className="text-center">
                    <p className="text-white/60 text-sm uppercase tracking-wide mb-1">Typical repair</p>
                    <p className="text-3xl md:text-4xl font-black text-red-400 line-through decoration-2">£2,200</p>
                  </div>
                  <div className="text-white text-2xl font-bold">vs</div>
                  <div className="text-center">
                    <p className="text-white/60 text-sm uppercase tracking-wide mb-1">Platinum plan</p>
                    <p className="text-3xl md:text-4xl font-black text-green-400">from £19/mo</p>
                  </div>
                </div>
                <p className="text-white/70 text-sm md:text-base mb-6">
                  That's less than a single diagnostic fee — and it covers all of the above.
                </p>
                <Button
                  onClick={scrollToQuoteForm}
                  className="bg-brand-orange text-white font-bold px-10 py-6 text-lg rounded-xl animate-breathing shadow-lg shadow-brand-orange/30"
                >
                  Get my instant quote
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ===== VAN MODELS SECTION ===== */}
        <section id="van-models" className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                All makes covered
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                Every UK van make and model
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                We cover vans registered between 2012 and 2026 from all major manufacturers. Find yours below.
              </p>
            </div>

            {/* Search */}
            <div className="max-w-lg mx-auto mb-6 md:mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search van makes or models..."
                  className="w-full pl-12 pr-4 py-3 md:py-4 rounded-xl border-2 border-slate-200 focus:border-brand-orange focus:ring-0 outline-none text-base md:text-lg transition-colors"
                  aria-label="Search van models"
                />
              </div>
            </div>

            {/* Manufacturer tabs */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-6 md:mb-8">
              <button
                onClick={() => setActiveManufacturer('All')}
                className={`px-4 py-2 rounded-full text-sm md:text-base font-medium transition-all ${
                  activeManufacturer === 'All'
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All makes
              </button>
              {(Object.keys(vanModelCategories) as ManufacturerCategory[]).map((manufacturer) => (
                <button
                  key={manufacturer}
                  onClick={() => setActiveManufacturer(manufacturer)}
                  className={`px-4 py-2 rounded-full text-sm md:text-base font-medium transition-all ${
                    activeManufacturer === manufacturer
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {manufacturer}
                </button>
              ))}
            </div>

            {/* Models grid */}
            {filteredModels.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                {filteredModels.map(({ model, manufacturer, variants }) => (
                  <button
                    key={`${manufacturer}-${model}`}
                    onClick={() => setSelectedModel(selectedModel === model ? null : model)}
                    className={`group relative bg-white rounded-lg px-2 py-3 md:px-3 md:py-3 text-center border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                      selectedModel === model
                        ? 'border-brand-orange ring-1 ring-orange-500/20 shadow-md scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm focus:ring-slate-400'
                    }`}
                  >
                    <img src={vanIcon} alt="" className="w-7 h-7 mx-auto mb-1.5 opacity-60 group-hover:opacity-80 transition-opacity" />
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">{model}</h3>
                    <p className="text-[9px] md:text-[10px] text-slate-500 font-medium leading-tight">{manufacturer}</p>
                    {selectedModel === model && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-brand-orange rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {filteredModels.length === 0 && modelSearchQuery && (
              <div className="text-center py-12">
                <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">No vans found matching "{modelSearchQuery}"</p>
                <button onClick={() => setModelSearchQuery('')} className="mt-3 text-blue-600 font-medium hover:underline">
                  Clear search
                </button>
              </div>
            )}

            <div className="mt-8 md:mt-10 text-center">
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 text-xs md:text-sm text-slate-600">
                <Check className="w-4 h-4 text-green-600" />
                <span><strong>Also covered:</strong> LWB, SWB, high roof, and all body configurations</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sticky CTA after model selection */}
        {selectedModel && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 md:py-4 px-4 z-50 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm md:text-base">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{selectedModel} selected</p>
                  <p className="text-slate-500 text-xs md:text-sm">Get your personalised quote →</p>
                </div>
              </div>
              <Button
                onClick={scrollToQuoteForm}
                className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25"
              >
                Get warranty quote for {selectedModel}
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* ===== WHY VAN OWNERS CHOOSE US ===== */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why van owners choose us
              </h2>
              <a
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-5 py-3 hover:border-green-400 transition-colors shadow-sm mt-4 mb-4"
              >
                <img src={trustpilotBadge} alt="Trustpilot rated excellent" className="h-10 object-contain" />
                <span className="text-sm font-semibold text-gray-700">See our reviews</span>
              </a>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Wrench, title: 'Minimise downtime with fast claims', desc: 'We know time is money. Quick authorisation gets you back on the road.' },
                  { icon: ThumbsUp, title: 'Transparent limits, zero hidden fees', desc: 'The price you see is the price you pay. No surprises, no small print.' },
                  { icon: Users, title: 'Friendly UK team that understands vans', desc: 'Our team handles claims quickly and fairly — real people, not robots.' },
                  { icon: Truck, title: 'High mileage commercial vans welcome', desc: 'We cover vans up to 150,000 miles with no restrictions during cover.' },
                  { icon: Clock, title: 'Flexible payments, cancel anytime', desc: 'Monthly payments with no lock-in. Cancel and get a pro-rata refund.' },
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
                <OptimizedImage 
                  src={fordTransitVan}
                  alt="UK van warranty — Vauxhall Combo with Buy A Warranty branding"
                  className="w-[400px] h-auto object-contain"
                  width={400}
                  height={300}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ===== HOW CLAIMS WORK — 3 STEPS ===== */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                How claims work
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-xl mx-auto">
                Three simple steps. We pay the garage directly — you don't have to chase invoices.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto">
              {[
                { step: 1, title: 'Take it to any garage', desc: 'Drop your van at any VAT-registered garage in the UK for diagnosis.' },
                { step: 2, title: 'Garage calls us', desc: 'Before repairs start, the garage rings our claims team. We authorise eligible work quickly.' },
                { step: 3, title: 'We pay, you drive', desc: 'We pay the garage directly for covered repairs. You collect your van and get back to work.' },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-brand-orange text-white rounded-full flex items-center justify-center text-xl md:text-2xl font-bold mx-auto mb-3 md:mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">{item.title}</h3>
                  <p className="text-sm md:text-base text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* UK support promise */}
            <div className="mt-8 md:mt-10 text-center">
              <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm">
                <Phone className="w-5 h-5 text-brand-orange" />
                <span className="text-sm font-medium text-gray-700">
                  UK claims team: <a href="tel:03302295045" className="font-bold text-gray-900 hover:underline">0330 229 5045</a>
                  <span className="text-gray-400 mx-2">·</span>
                  Mon-Fri 9am-5:30pm
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== CRYSTAL CLEAR COVER ===== */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your van cover, made <span className="text-brand-orange">crystal clear</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center">
                <div className="text-3xl md:text-4xl mb-3 md:mb-4">✅</div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">No hidden catches</h3>
                <p className="text-gray-600 text-xs md:text-sm">What you see is what you get — plain English, no jargon</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center">
                <div className="text-3xl md:text-4xl mb-3 md:mb-4">💰</div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">14-day money-back guarantee</h3>
                <p className="text-gray-600 text-xs md:text-sm">Try risk-free — full refund if it's not right for you</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center">
                <div className="text-3xl md:text-4xl mb-3 md:mb-4">⭐</div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">94% of claims approved</h3>
                <p className="text-gray-600 text-xs md:text-sm">We pay when you need us — fast and fair</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== HIGH MILEAGE SECTION ===== */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              <div className="flex justify-center">
                <OptimizedImage 
                  src={pandaThumbsUp}
                  alt="High mileage van warranty — Miles the Panda"
                  className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto object-contain"
                  width={448}
                  height={300}
                />
              </div>
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High mileage? No problem
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Keep your business moving<br />
                  <span className="text-brand-orange">— you're covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Commercial vans work hard — we get it. High mileage is normal for a working vehicle. That's why we cover vans up to 150,000 miles with no restrictions during your policy.
                </p>
                <div className="space-y-2 md:space-y-3 text-left max-w-md mx-auto lg:mx-0">
                  {[
                    'Cover vehicles up to 150,000 miles',
                    'No mileage restrictions during cover',
                    'Unlimited claims throughout your policy',
                    'Claim limits: £1,000, £2,000, £3,000 or £5,000',
                    'Zero excess option available',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 md:gap-3">
                      <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm md:text-base text-gray-700">{item}</span>
                    </div>
                  ))}
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

        {/* ===== ADDITIONAL COVER OPTIONS ===== */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Optional extras
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Boost your cover with these add-ons. Breakdown recovery is included free on 2-year and 3-year plans.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Truck className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Hire van cover</h3>
                <p className="text-sm md:text-base text-gray-600">Keep working while your van is being repaired with a temporary replacement</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">European cover</h3>
                <p className="text-sm md:text-base text-gray-600">Extended protection when you're driving abroad — ideal for couriers doing EU runs</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 relative">
                <div className="absolute -top-2 right-3 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  FREE on 2yr & 3yr
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Shield className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Breakdown recovery</h3>
                <p className="text-sm md:text-base text-gray-600">24/7 roadside assistance and recovery — included free on 2-year and 3-year plans</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== TESTIMONIALS ===== */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="flex items-center justify-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-[#00b67a] fill-[#00b67a]" />
                ))}
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                What van owners are saying
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Trusted by thousands of tradespeople and fleet operators across the UK
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col">
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-[#00b67a] fill-[#00b67a]" />
                    ))}
                  </div>
                  <p className="text-gray-800 text-base md:text-lg mb-4 leading-relaxed flex-1">
                    <strong>{testimonial.boldLine}</strong>{' '}
                    {testimonial.text}
                  </p>
                  <hr className="border-gray-100 mb-3" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
                    <p className="text-gray-400 text-xs">{testimonial.model} · {testimonial.location}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trustpilot link + CTA */}
            <div className="text-center mt-8 space-y-4">
              <a
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-sm font-semibold text-gray-700 hover:text-[#00b67a] transition-colors"
              >
                Read more reviews on Trustpilot →
              </a>
              <div>
                <Button
                  onClick={scrollToQuoteForm}
                  className="bg-brand-orange text-white font-bold px-8 py-4 text-base md:text-lg rounded-xl animate-breathing"
                >
                  Get my instant quote
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ===== VAN-SPECIFIC FAQs ===== */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Van warranty questions
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Straight answers to the things van owners ask most
              </p>
            </div>

            <div className="space-y-4">
              {vanFAQs.map((faq, index) => (
                <article key={index} className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setOpenFaqIndex(prev => prev === index ? null : index);
                    }}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-orange-600/20 transition-colors"
                  >
                    <h3 className="font-semibold text-lg text-white pr-4">{faq.question}</h3>
                    <ChevronDown 
                      className={`w-6 h-6 flex-shrink-0 text-white transition-transform duration-300 ${
                        openFaqIndex === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  
                  <div className={`overflow-hidden transition-all duration-200 ease-out ${
                    openFaqIndex === index 
                      ? 'max-h-screen opacity-100' 
                      : 'max-h-0 opacity-0'
                  }`}>
                    <div className="px-6 pb-5 bg-white border-t border-orange-200">
                      <div className="pt-4">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm md:text-base">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FINAL CTA ===== */}
        <section className="py-12 md:py-20 bg-brand-orange">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">
              Don't wait for the breakdown
            </h2>
            <p className="text-lg md:text-xl text-white/90 mb-6 md:mb-8 max-w-2xl mx-auto">
              Get your free quote in 30 seconds. Platinum complete cover from just £19/month. Same-day activation, cancel anytime.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={scrollToQuoteForm}
                className="bg-white text-brand-orange hover:bg-gray-100 font-bold px-8 md:px-12 py-4 md:py-6 text-base md:text-xl rounded-xl shadow-lg"
              >
                Get my free quote now
                <ArrowRight className="ml-2 w-5 h-5 md:w-6 md:h-6" />
              </Button>
              <div className="flex items-center gap-3">
                <a
                  href="tel:03302295040"
                  className="inline-flex items-center gap-2 text-white font-bold text-base md:text-xl hover:text-white/80 transition-colors"
                >
                  <Phone className="w-5 h-5 md:w-6 md:h-6" />
                  0330 229 5040
                </a>
                <span className="text-white/50">·</span>
                <a
                  href="https://wa.me/443302295040"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-white font-bold text-base md:text-xl hover:text-white/80 transition-colors"
                >
                  <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ===== MOBILE STICKY CTA ===== */}
        {showStickyCTA && !selectedModel && isMobile && (
          <div className="fixed bottom-0 left-0 right-0 bg-brand-orange py-3 px-4 z-50 shadow-2xl safe-area-bottom">
            <Button
              onClick={scrollToQuoteForm}
              className="w-full bg-white text-brand-orange hover:bg-gray-100 font-bold py-4 text-base rounded-xl shadow-lg"
            >
              Get my instant quote
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}
      </main>

      <MinimalLandingFooter />
      <BluePersistentCallback />
      <RequestCallbackModal
        isOpen={showCallbackModal}
        onClose={() => setShowCallbackModal(false)}
      />
    </>
  );
};

export default VanWarrantyLanding;
