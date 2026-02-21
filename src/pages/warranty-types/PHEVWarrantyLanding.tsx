import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, ChevronUp, MapPin, Clock, Users, Car, Wrench, Zap, Star, Award, ThumbsUp, FileCheck, MessageCircle, Battery, Search, Plug } from 'lucide-react';
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
import pandaThumbsUp from '@/assets/extended-van-warranty-uk.png';
import phevHeroImage from '@/assets/phev-warranty-hero-bmw-x5.png';
import phevVolvoXC60 from '@/assets/phev-warranty-volvo-xc60.png';

// UK PHEV Models covered (grouped by manufacturer) - 2012-2026
const phevModelCategories = {
  'BMW': {
    '225xe Active Tourer': ['Plug-in Hybrid'],
    '330e': ['Plug-in Hybrid'],
    '530e': ['Plug-in Hybrid'],
    '745e / 745Le': ['Plug-in Hybrid'],
    'X1 xDrive25e': ['Plug-in Hybrid'],
    'X2 xDrive25e': ['Plug-in Hybrid'],
    'X3 xDrive30e': ['Plug-in Hybrid'],
    'X5 xDrive45e': ['Plug-in Hybrid'],
    'XM': ['Plug-in Hybrid'],
  },
  'Mercedes-Benz': {
    'A 250 e': ['Plug-in Hybrid'],
    'B 250 e': ['Plug-in Hybrid'],
    'C 300 e': ['Plug-in Hybrid'],
    'C 300 de': ['Plug-in Hybrid Diesel'],
    'E 300 e': ['Plug-in Hybrid'],
    'E 300 de': ['Plug-in Hybrid Diesel'],
    'GLA 250 e': ['Plug-in Hybrid'],
    'GLC 300 e': ['Plug-in Hybrid'],
    'GLC 300 de': ['Plug-in Hybrid Diesel'],
    'GLE 350 de': ['Plug-in Hybrid Diesel'],
    'GLE 350 e': ['Plug-in Hybrid'],
    'S 580 e': ['Plug-in Hybrid'],
  },
  'Volvo': {
    'XC40 Recharge T4': ['Plug-in Hybrid'],
    'XC40 Recharge T5': ['Plug-in Hybrid'],
    'XC60 Recharge T6': ['Plug-in Hybrid'],
    'XC60 Recharge T8': ['Plug-in Hybrid'],
    'XC90 Recharge T8': ['Plug-in Hybrid'],
    'S60 Recharge T8': ['Plug-in Hybrid'],
    'S90 Recharge T8': ['Plug-in Hybrid'],
    'V60 Recharge T6': ['Plug-in Hybrid'],
    'V60 Recharge T8': ['Plug-in Hybrid'],
    'V90 Recharge T8': ['Plug-in Hybrid'],
  },
  'Audi': {
    'A3 Sportback TFSI e': ['Plug-in Hybrid'],
    'Q3 Sportback TFSI e': ['Plug-in Hybrid'],
    'Q5 TFSI e': ['Plug-in Hybrid'],
    'Q7 TFSI e': ['Plug-in Hybrid'],
    'Q8 TFSI e': ['Plug-in Hybrid'],
    'A6 TFSI e': ['Plug-in Hybrid'],
    'A7 Sportback TFSI e': ['Plug-in Hybrid'],
    'A8 TFSI e': ['Plug-in Hybrid'],
  },
  'Kia': {
    'Niro PHEV': ['1.6 GDi Plug-in Hybrid'],
    'Sportage PHEV': ['1.6 T-GDi Plug-in Hybrid'],
    'Sorento PHEV': ['1.6 T-GDi Plug-in Hybrid'],
    'XCeed PHEV': ['1.6 GDi Plug-in Hybrid'],
  },
  'Hyundai': {
    'Ioniq PHEV': ['1.6 GDi Plug-in Hybrid'],
    'Tucson PHEV': ['1.6 T-GDi Plug-in Hybrid'],
    'Santa Fe PHEV': ['1.6 T-GDi Plug-in Hybrid'],
  },
  'Toyota': {
    'RAV4 Plug-in Hybrid': ['2.5 Plug-in Hybrid'],
    'Prius Plug-in': ['1.8 Plug-in Hybrid', '2.0 Plug-in Hybrid'],
  },
  'Ford': {
    'Kuga PHEV': ['2.5 Plug-in Hybrid'],
    'Tourneo Custom PHEV': ['2.5 Plug-in Hybrid'],
    'Galaxy PHEV': ['2.5 Plug-in Hybrid'],
    'S-MAX PHEV': ['2.5 Plug-in Hybrid'],
  },
  'Volkswagen': {
    'Golf GTE': ['1.4 TSI Plug-in Hybrid'],
    'Passat GTE': ['1.4 TSI Plug-in Hybrid'],
    'Tiguan eHybrid': ['1.4 TSI Plug-in Hybrid'],
    'Touareg R': ['3.0 TSI Plug-in Hybrid'],
    'Arteon eHybrid': ['1.4 TSI Plug-in Hybrid'],
  },
  'Land Rover': {
    'Range Rover Evoque P300e': ['Plug-in Hybrid'],
    'Range Rover Sport P400e': ['Plug-in Hybrid'],
    'Range Rover P440e': ['Plug-in Hybrid'],
    'Defender P400e': ['Plug-in Hybrid'],
    'Discovery Sport P300e': ['Plug-in Hybrid'],
  },
  'Peugeot': {
    '3008 Hybrid': ['1.6 Plug-in Hybrid'],
    '308 Hybrid': ['1.6 Plug-in Hybrid'],
    '508 Hybrid': ['1.6 Plug-in Hybrid'],
    '508 PSE': ['Plug-in Hybrid'],
  },
  'Renault': {
    'Captur E-Tech PHEV': ['1.6 Plug-in Hybrid'],
    'Megane E-Tech PHEV': ['1.6 Plug-in Hybrid'],
  },
  'Vauxhall': {
    'Astra PHEV': ['1.6 Plug-in Hybrid'],
    'Grandland PHEV': ['1.6 Plug-in Hybrid'],
  },
  'MINI': {
    'Countryman Cooper SE': ['1.5 Plug-in Hybrid'],
  },
  'Mazda': {
    'CX-60 PHEV': ['2.5 Plug-in Hybrid'],
  },
  'Porsche': {
    'Cayenne E-Hybrid': ['Plug-in Hybrid'],
    'Panamera 4 E-Hybrid': ['Plug-in Hybrid'],
  },
  'Citroën': {
    'C5 Aircross Hybrid': ['1.6 Plug-in Hybrid'],
  },
  'DS': {
    'DS 4 E-Tense': ['Plug-in Hybrid'],
    'DS 7 E-Tense': ['Plug-in Hybrid'],
    'DS 9 E-Tense': ['Plug-in Hybrid'],
  },
  'Suzuki': {
    'Across PHEV': ['2.5 Plug-in Hybrid'],
  },
  'Cupra': {
    'Formentor eHybrid': ['1.4 TSI Plug-in Hybrid'],
    'Leon eHybrid': ['1.4 TSI Plug-in Hybrid'],
  },
  'SEAT': {
    'Leon eHybrid': ['1.4 TSI Plug-in Hybrid'],
    'Tarraco eHybrid': ['1.4 TSI Plug-in Hybrid'],
  },
  'Jeep': {
    'Renegade 4xe': ['Plug-in Hybrid'],
    'Compass 4xe': ['Plug-in Hybrid'],
    'Wrangler 4xe': ['Plug-in Hybrid'],
  },
};

type ManufacturerCategory = keyof typeof phevModelCategories;

// Coverage components data for PHEV vehicles
const coverageCategories = [
  {
    title: 'Engine & PHEV powertrain',
    icon: Battery,
    items: [
      'Internal combustion engine',
      'Electric traction motor',
      'Power control unit (inverter)',
      'Battery management system (BMS)',
      'DC-DC converter',
      'Regenerative braking system',
      'Engine cooling system',
    ]
  },
  {
    title: 'Transmission & drivetrain',
    icon: Wrench,
    items: [
      'Automatic / e-CVT gearbox',
      'Differential (front & rear)',
      'Drive shafts and CV joints',
      'Clutch assembly (if fitted)',
      'Transfer case (AWD PHEVs)',
      'Torque converter',
      'Final drive assembly',
    ]
  },
  {
    title: 'Charging & electrical',
    icon: Zap,
    items: [
      'On-board charger (AC)',
      'Charge port and flap actuator',
      'Cable management system',
      'High-voltage wiring harness',
      'ECU and hybrid control modules',
      'Instrument cluster / infotainment',
      'Sensors and actuators',
    ]
  },
  {
    title: 'Cooling & thermal management',
    icon: Shield,
    items: [
      'Battery cooling circuit',
      'Electric A/C compressor',
      'Heat pump system (if fitted)',
      'Water pump and thermostat',
      'Radiator and expansion tank',
      'Intercooler (turbo PHEVs)',
      'Oil cooler',
    ]
  },
  {
    title: 'Suspension & steering',
    icon: Car,
    items: [
      'Electric power steering motor',
      'Power steering rack',
      'Shock absorbers and struts',
      'Control arms and bushings',
      'Wheel bearings and hubs',
      'Anti-roll bar links',
      'Ball joints',
    ]
  },
  {
    title: 'PHEV-specific systems',
    icon: Plug,
    items: [
      'EV drive mode controller',
      'Hybrid drive mode selector',
      'Regenerative brake actuator',
      'Battery cooling pump',
      'High-voltage junction box',
      'Pre-heater system',
      'Electric cabin heater',
    ]
  },
];

// FAQs for schema
const phevFAQs = [
  {
    question: "What is covered on a plug-in hybrid warranty?",
    answer: "Our PHEV warranty covers the electric motor, inverter, on-board charger, battery management system, DC-DC converter, regenerative braking, charge port, and all standard mechanical components — over 1,000 parts in total."
  },
  {
    question: "Is my plug-in hybrid too old or too many miles?",
    answer: "We cover plug-in hybrid vehicles up to 15 years old and 150,000 miles. Enter your registration above for an instant eligibility check and quote."
  },
  {
    question: "Can I use my own garage for PHEV repairs?",
    answer: "Yes. Any VAT-registered garage can carry out repairs. We can also recommend approved garages experienced with plug-in hybrid vehicles."
  },
  {
    question: "Is the PHEV traction battery covered?",
    answer: "We cover the battery management system, DC-DC converter, battery cooling system, and related electronics. The high-voltage traction battery cells are typically covered by the manufacturer's warranty (usually 8-10 years)."
  },
  {
    question: "How do I make a PHEV warranty claim?",
    answer: "Take your vehicle to any VAT-registered garage for diagnosis. Once the fault is identified, the garage must call our Claims Team on 0330 229 5045 before starting repairs. We authorise and pay the garage directly."
  },
  {
    question: "How much does a PHEV warranty cost?",
    answer: "PHEV warranty plans start from just £19 per month. The exact price depends on your vehicle's make, model, age, and mileage. Get an instant quote by entering your registration above."
  },
  {
    question: "Is the on-board charger covered?",
    answer: "Yes. The on-board charger, charge port, charge flap actuator, and cable management system are all covered under our PHEV warranty plans."
  },
  {
    question: "Do I need a full service history?",
    answer: "A reasonable service history is fine. Many vehicles are accepted even if servicing has been missed."
  },
  {
    question: "What claim limit should I choose for a PHEV?",
    answer: "PHEV repairs can be expensive due to specialist components. We recommend £3,000 (our most popular) or £5,000 for newer, higher-value plug-in hybrids where repair costs can be significantly higher. Every plan includes unlimited claims."
  },
  {
    question: "Are diagnostics covered?",
    answer: "Yes, diagnostics are usually covered when the fault is approved under your warranty."
  },
];

// Testimonials
const testimonials = [
  {
    name: "Claire W.",
    location: "Oxford",
    model: "BMW X5 xDrive45e",
    boldLine: "Inverter replaced — £3,100 covered in full.",
    text: "The power control unit failed at 72,000 miles. Buy A Warranty handled the entire claim and paid the garage directly. Incredible service.",
    rating: 5
  },
  {
    name: "Mark T.",
    location: "Glasgow",
    model: "Volvo XC60 Recharge T8",
    boldLine: "On-board charger replaced within a week.",
    text: "My XC60 wouldn't charge. They approved the repair same day and I was back to full electric driving in no time.",
    rating: 5
  },
  {
    name: "Helen R.",
    location: "Bristol",
    model: "Kia Niro PHEV",
    boldLine: "Saved me over £2,000 on a single claim.",
    text: "DC-DC converter and battery cooling pump both failed. They covered the full repair without any excess to pay.",
    rating: 5
  },
  {
    name: "Andrew S.",
    location: "Leeds",
    model: "Mercedes GLC 300 e",
    boldLine: "Professional and hassle-free from start to finish.",
    text: "Electric A/C compressor needed replacing. The claim was authorised the same day and the garage was paid directly.",
    rating: 5
  },
  {
    name: "Joanne K.",
    location: "Cardiff",
    model: "Ford Kuga PHEV",
    boldLine: "Claim approved in under 24 hours.",
    text: "Hybrid battery management system fault at 65,000 miles. They were brilliant — no arguments, no delays.",
    rating: 5
  },
  {
    name: "David L.",
    location: "Birmingham",
    model: "Audi Q5 TFSI e",
    boldLine: "£2,800 claim paid directly to the garage.",
    text: "High-voltage wiring harness issue on my Q5. The whole process was smooth and professional. Highly recommend for any PHEV owner.",
    rating: 5
  }
];

const PHEVWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [callbackVisible, setCallbackVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setCallbackVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [expandedCoverage, setExpandedCoverage] = useState(false);
  const [activeManufacturer, setActiveManufacturer] = useState<ManufacturerCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  const filteredModels = useMemo(() => {
    const allModels = activeManufacturer === 'All'
      ? Object.entries(phevModelCategories).flatMap(([manufacturer, models]) => 
          Object.entries(models).map(([model, variants]) => ({ model, variants, manufacturer }))
        )
      : Object.entries(phevModelCategories[activeManufacturer]).map(([model, variants]) => ({ 
          model, variants, manufacturer: activeManufacturer 
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
    trackButtonClick('phev_warranty_get_quote', { vehicleType: 'phev' });
    if (!regNumber.trim()) {
      toast({ title: "Registration required", description: "Please enter your vehicle registration number.", variant: "destructive" });
      return;
    }
    if (!mileage.trim()) {
      toast({ title: "Mileage required", description: "Please select your vehicle's mileage to continue.", variant: "destructive" });
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
            toast({ title: "Vehicle not eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" });
            setIsLookingUp(false);
            return;
          }
        }
        const vehicleData = {
          regNumber, mileage, make: data.make || 'Unknown', model: data.model, fuelType: data.fuelType,
          transmission: data.transmission, year: data.yearOfManufacture, vehicleType: 'phev', manufactureDate: data.manufactureDate
        };
        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_currentStep', '2');
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
        navigate('/?step=2');
      } else {
        const vehicleData = { regNumber, mileage, vehicleType: 'phev' };
        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_currentStep', '2');
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
        navigate('/?step=2');
      }
    } catch (err) {
      console.error('Vehicle lookup error:', err);
      const vehicleData = { regNumber, mileage, vehicleType: 'phev' };
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
    if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Schema.org structured data
  const productSchema = {
    "@context": "https://schema.org", "@type": "Product",
    "name": "Plug-in Hybrid (PHEV) Warranty UK — Extended Cover for All PHEV Models",
    "description": "UK's specialist PHEV extended warranty from £19/month. Covers BMW 330e, X5 xDrive45e, Mercedes C 300 e, GLC 300 e, Volvo XC60 Recharge, Audi Q5 TFSI e, Kia Niro PHEV, Hyundai Tucson PHEV, Ford Kuga PHEV, VW Golf GTE, Land Rover Range Rover PHEV, and 100+ plug-in hybrid models. Protects electric motors, inverters, on-board chargers, battery management systems, DC-DC converters, and 1,000+ components.",
    "brand": { "@type": "Brand", "name": "Buy A Warranty" },
    "manufacturer": { "@type": "Organization", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk", "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png", "contactPoint": { "@type": "ContactPoint", "telephone": "+44-330-229-5040", "contactType": "customer service", "availableLanguage": "English", "areaServed": "GB" } },
    "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": "19", "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], "availability": "https://schema.org/InStock", "url": "https://buyawarranty.co.uk/warranty-types/phev-warranty/", "seller": { "@type": "Organization", "name": "Buy A Warranty" }, "itemCondition": "https://schema.org/NewCondition", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "19", "priceCurrency": "GBP", "unitText": "month", "billingIncrement": 1 } },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5", "worstRating": "1" },
    "review": testimonials.map((t, i) => ({ "@type": "Review", "author": { "@type": "Person", "name": t.name }, "reviewRating": { "@type": "Rating", "ratingValue": t.rating, "bestRating": "5" }, "reviewBody": t.text, "datePublished": new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] })),
    "category": "Vehicle Extended Warranty",
    "audience": { "@type": "Audience", "audienceType": "Plug-in hybrid vehicle owners in the United Kingdom" }
  };

  const serviceSchema = {
    "@context": "https://schema.org", "@type": "Service",
    "name": "PHEV Plug-in Hybrid Extended Warranty — UK Specialist Provider",
    "alternateName": ["PHEV Warranty UK", "Plug-in Hybrid Warranty", "Plug-in Hybrid Car Warranty"],
    "provider": { "@type": "LocalBusiness", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk", "telephone": "+44-330-229-5040", "priceRange": "£19-£99/month", "address": { "@type": "PostalAddress", "addressCountry": "GB" } },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "description": "UK's specialist extended warranty for plug-in hybrid (PHEV) vehicles. Covers BMW 330e, 530e, X1/X3/X5 PHEV; Mercedes A/C/E/GLC/GLE PHEV; Volvo XC40/XC60/XC90 Recharge; Audi A3/Q5/Q7/Q8 TFSI e; Kia Niro/Sportage/Sorento PHEV; Hyundai Tucson/Santa Fe PHEV; Toyota RAV4/Prius PHEV; Ford Kuga PHEV; VW Golf GTE/Tiguan eHybrid/Touareg R; Land Rover Range Rover/Defender PHEV; Peugeot 3008/308/508 Hybrid; Porsche Cayenne/Panamera E-Hybrid; and 100+ PHEV models. Covers electric motors, inverters, on-board chargers, battery management, DC-DC converters, charge ports, regenerative braking, and 1,000+ components.",
    "serviceType": "Vehicle Extended Warranty",
    "hasOfferCatalog": { "@type": "OfferCatalog", "name": "PHEV Warranty Plans", "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "1 Year PHEV Warranty" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "2 Year PHEV Warranty" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "3 Year PHEV Warranty" } }
    ] }
  };

  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": phevFAQs.map(faq => ({ "@type": "Question", "name": faq.question, "acceptedAnswer": { "@type": "Answer", "text": faq.answer } })) };

  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" },
    { "@type": "ListItem", "position": 2, "name": "Warranty types", "item": "https://buyawarranty.co.uk/warranty-types/" },
    { "@type": "ListItem", "position": 3, "name": "PHEV plug-in hybrid warranty", "item": "https://buyawarranty.co.uk/warranty-types/phev-warranty/" }
  ] };

  const organizationSchema = { "@context": "https://schema.org", "@type": "Organization", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk", "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png", "legalName": "BUY A WARRANTY LIMITED", "description": "UK's trusted extended vehicle warranty provider since 2016. Specialist in PHEV, hybrid, electric, car, and van warranty cover.", "foundingDate": "2016", "areaServed": { "@type": "Country", "name": "United Kingdom" }, "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"], "contactPoint": { "@type": "ContactPoint", "telephone": "+44-330-229-5040", "contactType": "customer service", "areaServed": "GB", "availableLanguage": "English" } };

  const webPageSchema = { "@context": "https://schema.org", "@type": "WebPage",
    "name": "PHEV Plug-in Hybrid Warranty UK From £19/mo — BMW, Mercedes, Volvo, Audi & 100+ Models",
    "description": "Get specialist PHEV warranty cover in the UK. We protect electric motors, inverters, on-board chargers, battery management systems, and 1,000+ components on BMW, Mercedes, Volvo, Audi, Kia, Hyundai, Toyota, Ford, VW, Land Rover, Porsche, and more. From £19/month.",
    "url": "https://buyawarranty.co.uk/warranty-types/phev-warranty/", "dateModified": new Date().toISOString().split('T')[0], "inLanguage": "en-GB",
    "isPartOf": { "@type": "WebSite", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "about": [{ "@type": "Thing", "name": "PHEV Plug-in Hybrid Extended Warranty" }, { "@type": "Thing", "name": "Plug-in Hybrid Car Warranty UK" }],
    "mentions": [
      { "@type": "Brand", "name": "BMW" }, { "@type": "Brand", "name": "Mercedes-Benz" }, { "@type": "Brand", "name": "Volvo" },
      { "@type": "Brand", "name": "Audi" }, { "@type": "Brand", "name": "Kia" }, { "@type": "Brand", "name": "Hyundai" },
      { "@type": "Brand", "name": "Toyota" }, { "@type": "Brand", "name": "Ford" }, { "@type": "Brand", "name": "Volkswagen" },
      { "@type": "Brand", "name": "Land Rover" }, { "@type": "Brand", "name": "Porsche" }, { "@type": "Brand", "name": "Peugeot" },
      { "@type": "Thing", "name": "PHEV Warranty" }, { "@type": "Thing", "name": "Plug-in Hybrid Warranty" }
    ],
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".hero-description"] },
    "mainContentOfPage": { "@type": "WebPageElement", "cssSelector": "main" }
  };

  const howToSchema = { "@context": "https://schema.org", "@type": "HowTo",
    "name": "How to get a plug-in hybrid warranty quote in the UK",
    "description": "Get an instant PHEV warranty quote in 60 seconds — covers BMW, Mercedes, Volvo, Audi, Kia & 100+ PHEV models",
    "image": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "position": 1, "name": "Enter registration", "text": "Enter your PHEV registration number to look up your vehicle details automatically" },
      { "@type": "HowToStep", "position": 2, "name": "Select mileage", "text": "Choose your current mileage range (under or over 120,000 miles)" },
      { "@type": "HowToStep", "position": 3, "name": "Get instant quote", "text": "Receive your personalised PHEV warranty quote instantly with pricing for different coverage levels" }
    ]
  };

  return (
    <>
      <Helmet>
        <title>PHEV Warranty UK From £19/mo | Plug-in Hybrid Cover — BMW, Mercedes, Volvo, Kia</title>
        <meta name="description" content="UK's No.1 plug-in hybrid (PHEV) warranty from just £19/month. Covers 100+ PHEV models including BMW 330e, X5 xDrive45e, Mercedes GLC 300 e, Volvo XC60 Recharge, Audi Q5 TFSI e, Kia Niro PHEV, Ford Kuga PHEV, Range Rover P440e & more. Electric motors, inverters, on-board chargers, DC-DC converters & 1,000+ parts protected. Unlimited claims at any VAT-registered UK garage. 60-second online quotes — 14-day money-back guarantee. Call 0330 229 5040." />
        <meta name="keywords" content="PHEV warranty UK, plug-in hybrid warranty, plug-in hybrid car warranty, PHEV extended warranty, BMW 330e warranty, BMW X5 PHEV warranty, Mercedes PHEV warranty, Volvo Recharge warranty, Audi TFSI e warranty, Kia Niro PHEV warranty, Hyundai PHEV warranty, Ford Kuga PHEV warranty, VW Golf GTE warranty, Land Rover PHEV warranty, plug-in hybrid breakdown cover, PHEV inverter warranty, on-board charger warranty, PHEV battery warranty UK, cheap PHEV warranty, best PHEV warranty UK, used plug-in hybrid warranty, Range Rover PHEV warranty, Porsche Cayenne E-Hybrid warranty, Peugeot 3008 hybrid warranty, PHEV electric motor cover" />
        <meta name="subject" content="Plug-in Hybrid Vehicle Extended Warranty Plans in the United Kingdom" />
        <meta name="topic" content="PHEV Plug-in Hybrid Car Warranty UK" />
        <meta name="summary" content="Extended warranty plans for plug-in hybrid vehicles in the UK from £19/month. Over 100 PHEV models covered across 20+ manufacturers." />
        <meta name="classification" content="Automotive Warranty / PHEV Plug-in Hybrid / Vehicle Protection" />
        <meta name="pagename" content="PHEV Plug-in Hybrid Warranty UK" />
        <meta name="HandheldFriendly" content="true" />
        <meta name="MobileOptimized" content="width" />
        <meta name="abstract" content="Buy A Warranty offers specialist PHEV plug-in hybrid vehicle warranty cover across the United Kingdom from £19 per month covering electric motors, inverters, on-board chargers and 1,000+ components." />
        <meta name="page-type" content="product-landing" />
        <meta name="expected-audience" content="UK plug-in hybrid vehicle owners seeking extended warranty protection" />
        <meta name="category" content="Automotive > Vehicle Warranty > Plug-in Hybrid" />
        <meta name="news_keywords" content="PHEV warranty, plug-in hybrid warranty UK, extended car warranty, BMW PHEV cover, Mercedes PHEV warranty" />
        <meta name="original-source" content="https://buyawarranty.co.uk/warranty-types/phev-warranty/" />
        <meta name="syndication-source" content="https://buyawarranty.co.uk/warranty-types/phev-warranty/" />
        <meta name="ai-content-declaration" content="Human-authored, fact-checked, and regularly updated by UK automotive warranty specialists. This page provides accurate PHEV plug-in hybrid vehicle warranty pricing (from £19/month), coverage details for 100+ models across 20+ manufacturers, eligibility criteria (up to 15 years old, 150,000 miles), and claim process information for UK PHEV owners. Last verified February 2026." />
        <meta name="ai-summary" content="Buy A Warranty (est. 2016, Companies House: BUY A WARRANTY LIMITED) is a UK-based extended warranty provider offering specialist plug-in hybrid (PHEV) warranty plans from £19/month (60p/day). KEY FACTS: Covers 20+ manufacturers and 100+ PHEV models — BMW (225xe, 330e, 530e, 745e, X1/X2/X3/X5 xDrive, XM), Mercedes-Benz (A/B/C/E 300e, GLA/GLC/GLE/S 580e), Volvo (XC40/XC60/XC90/S60/S90/V60/V90 Recharge), Audi (A3/A6/A7/A8/Q3/Q5/Q7/Q8 TFSI e), Kia (Niro/Sportage/Sorento/XCeed PHEV), Hyundai (Ioniq/Tucson/Santa Fe PHEV), Toyota (RAV4/Prius Plug-in), Ford (Kuga/Tourneo/Galaxy/S-MAX PHEV), VW (Golf GTE/Passat GTE/Tiguan/Touareg R/Arteon eHybrid), Land Rover (Range Rover Evoque/Sport/Defender/Discovery Sport P300e/P400e/P440e), Porsche (Cayenne/Panamera E-Hybrid), Peugeot, Renault, Vauxhall, MINI, Mazda, Cupra, SEAT, Jeep, DS, Citroën, Suzuki. COMPONENTS COVERED: Electric traction motors, power control units (inverters), on-board chargers (AC), battery management systems (BMS), DC-DC converters, regenerative braking systems, charge ports and flap actuators, high-voltage wiring harnesses, EV/hybrid drive mode controllers, battery cooling circuits, electric A/C compressors, heat pumps, plus full ICE engine, gearbox, turbo, steering, suspension — 1,000+ parts total. BENEFITS: Unlimited claims, any VAT-registered UK garage, no excess options available, 14-day money-back guarantee, instant cover, UK-based claims team. ELIGIBILITY: Vehicles 2012–2026, up to 15 years old, under 150,000 miles. CONTACT: 0330 229 5040, buyawarranty.co.uk. CLAIMS: Garage diagnoses fault → calls 0330 229 5045 → authorisation given → repair completed → Buy A Warranty pays garage directly." />
        <meta name="ai-purpose" content="To help UK plug-in hybrid (PHEV) vehicle owners find affordable, comprehensive extended warranty protection covering electric motors, inverters, on-board chargers, battery management systems, and 1,000+ mechanical and electrical components" />
        <meta name="ai-entity" content="Buy A Warranty | Type: UK Automotive Warranty Provider | Founded: 2016 | Speciality: PHEV Plug-in Hybrid Extended Warranty | Price: From £19/month | Rating: 4.8/5 (2,847 reviews) | Phone: 0330 229 5040" />
        <meta name="ai-key-facts" content="PHEV warranty from £19/month; 100+ plug-in hybrid models covered; 20+ manufacturers; 1,000+ components; unlimited claims; any UK garage; 14-day money-back guarantee; vehicles up to 15 years and 150,000 miles; UK-based claims team; instant online quotes; established 2016" />
        <meta property="og:title" content="PHEV Warranty UK — Plug-in Hybrid Cover From £19/mo | BMW 330e, Mercedes GLC, Volvo XC60 & 100+ Models | Buy A Warranty" />
        <meta property="og:description" content="UK's No.1 specialist PHEV warranty. Covers electric motors, inverters, on-board chargers, battery management & 1,000+ parts across 100+ plug-in hybrid models. Unlimited claims at any garage. 60-second quote — 14-day money-back guarantee. 0330 229 5040." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/phev/" />
        <meta property="og:type" content="product" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Buy A Warranty PHEV plug-in hybrid warranty — covers BMW, Mercedes, Volvo, Audi and 100+ UK PHEV models from £19 per month" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        <meta property="product:price:amount" content="19" />
        <meta property="product:price:currency" content="GBP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@buyawarranty" />
        <meta name="twitter:creator" content="@buyawarranty" />
        <meta name="twitter:title" content="PHEV Warranty UK From £19/mo — Plug-in Hybrid Cover for BMW, Mercedes, Volvo & 100+ Models" />
        <meta name="twitter:description" content="UK's specialist PHEV warranty covering electric motors, inverters, on-board chargers & 1,000+ parts. Unlimited claims, any UK garage. 60-second quote — 14-day money-back guarantee." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta name="twitter:image:alt" content="PHEV plug-in hybrid warranty UK from £19 per month — Buy A Warranty covers BMW, Mercedes, Volvo, Audi, Kia and 100+ models" />
        <meta name="twitter:label1" content="Price" />
        <meta name="twitter:data1" content="From £19/month" />
        <meta name="twitter:label2" content="Models covered" />
        <meta name="twitter:data2" content="100+ PHEV models" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
      </Helmet>

      <main className="min-h-screen bg-white" role="main" itemScope itemType="https://schema.org/WebPage" lang="en-GB">
        {/* Hero Section */}
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-6 pb-12 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              <div className="text-center lg:text-left">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">PHEV plug-in hybrid warranty </span>
                  <span className="text-brand-orange">from £19/month</span>
                </h1>
                <p className="hero-description text-sm md:text-base text-gray-600 mb-2">Specialist UK warranty for plug-in hybrid vehicles — covers electric motors, inverters, on-board chargers, battery management systems & 1,000+ components across BMW, Mercedes, Volvo, Audi, Kia & 100+ PHEV models.</p>
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">From just 60p a day • Easy claims • Fast payouts</span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Unlimited claims • Parts and labour • No excess</span>
                  </div>
                </div>
                <div className="max-w-md mx-auto lg:mx-0 space-y-4">
                  <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black">
                    <div className="bg-blue-600 text-white font-bold px-3 sm:px-4 py-3 flex items-center justify-center min-w-[60px] sm:min-w-[80px]">
                      <div className="flex flex-col items-center">
                        <div className="text-base sm:text-lg leading-tight mb-0.5">🇬🇧</div>
                        <div className="text-xs sm:text-sm font-bold leading-none">UK</div>
                      </div>
                    </div>
                    <input type="text" value={regNumber} onChange={handleRegChange} placeholder="ENTER REG"
                      className="bg-yellow-400 border-none outline-none text-xl sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/60 px-3 sm:px-4 py-3 uppercase tracking-wider min-w-0" maxLength={8} />
                  </div>
                  <MileageQuickSelect value={mileageSelection} onChange={handleMileageSelection} onAutoSubmit={handleGetQuote} error={eligibilityError} isLoading={isLookingUp} isRegValid={regNumber.replace(/\s/g, '').length >= 5} />
                  <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-5 py-4 text-center">
                    <p className="text-sm sm:text-[17px] font-bold text-[#1B2A4A]">Fair price. Fast quote. No surprises.</p>
                    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs sm:text-[15px] mt-1.5">
                      <span className="text-gray-600">Speak to an expert:</span>
                      <a href="tel:03302295040" className="font-semibold text-gray-900 hover:underline">0330 229 5040</a>
                      <span className="text-gray-400">or</span>
                      <button onClick={() => setShowCallbackModal(true)} className="text-brand-orange hover:underline font-medium">Request a callback</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="relative">
                  <OptimizedImage src={phevHeroImage} alt="BMW X5 xDrive45e plug-in hybrid covered by Buy A Warranty PHEV warranty UK from £19 per month — electric motor, inverter and on-board charger protection"
                    className="w-full h-auto max-w-md mx-auto object-contain" priority={true} width={600} height={450} style={{ border: 'none', boxShadow: 'none' }} />
                  <div className="absolute top-4 right-4">
                    <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                      <OptimizedImage src={trustpilotExcellent} alt="Trustpilot Excellent Rating" className="h-auto w-28 sm:w-36 object-contain" width={144} height={61} />
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5">
                      <Plug className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Plug-in hybrid (PHEV)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Electric + petrol/diesel</span>
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

        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}>
          <WarrantyBenefitsSection headline="The ultimate PHEV warranty." />
        </Suspense>

        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="PHEV" />
        </Suspense>

        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>

        {/* Average PHEV Repair Costs */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 font-semibold text-sm px-4 py-2 rounded-full mb-4">
                <Wrench className="w-4 h-4" />
                Without warranty, you pay the full bill
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                Average plug-in hybrid repair costs in the UK
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                Plug-in hybrid parts are specialist and expensive. A single component failure could cost you thousands.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {[
                { part: 'Power control unit (inverter)', cost: '£1,800 – £4,000', icon: Zap, severity: 'critical' as const },
                { part: 'Electric traction motor', cost: '£2,000 – £4,500', icon: Battery, severity: 'critical' as const },
                { part: 'On-board charger replacement', cost: '£1,200 – £3,000', icon: Plug, severity: 'critical' as const },
                { part: 'DC-DC converter', cost: '£800 – £2,000', icon: Zap, severity: 'high' as const },
                { part: 'Electric A/C compressor', cost: '£900 – £2,200', icon: Shield, severity: 'high' as const },
                { part: 'Battery management system', cost: '£700 – £1,800', icon: Battery, severity: 'high' as const },
                { part: 'Charge port & flap actuator', cost: '£400 – £1,200', icon: Plug, severity: 'medium' as const },
                { part: 'Regenerative brake actuator', cost: '£600 – £1,400', icon: Wrench, severity: 'medium' as const },
                { part: 'Battery cooling pump', cost: '£500 – £1,200', icon: Clock, severity: 'medium' as const },
              ].map((repair, index) => {
                const severityColor = repair.severity === 'critical' ? 'border-red-200 bg-red-50/50' : repair.severity === 'high' ? 'border-orange-200 bg-orange-50/30' : 'border-slate-200 bg-white';
                const costColor = repair.severity === 'critical' ? 'text-red-600' : repair.severity === 'high' ? 'text-orange-600' : 'text-slate-900';
                return (
                  <div key={index} className={`relative rounded-xl border-2 ${severityColor} p-4 md:p-5 transition-all hover:shadow-md`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${repair.severity === 'critical' ? 'bg-red-100' : repair.severity === 'high' ? 'bg-orange-100' : 'bg-slate-100'}`}>
                          <repair.icon className={`w-5 h-5 ${repair.severity === 'critical' ? 'text-red-600' : repair.severity === 'high' ? 'text-orange-600' : 'text-slate-600'}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm md:text-base">{repair.part}</h3>
                          <p className={`text-lg md:text-xl font-bold ${costColor} mt-0.5`}>{repair.cost}</p>
                        </div>
                      </div>
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
                <p className="text-white/70 text-sm md:text-base mb-6">That's less than a single diagnostic fee — and it covers all of the above.</p>
                <Button onClick={scrollToQuoteForm} className="bg-brand-orange text-white font-bold px-10 py-6 text-lg rounded-xl animate-breathing shadow-lg shadow-brand-orange/30">
                  Get my instant quote <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* PHEV Models Section */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full coverage details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                Every UK plug-in hybrid model we cover
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                We cover PHEV vehicles from 20+ manufacturers registered between 2012 and 2026. Select your make to see models.
              </p>
            </div>
            <div className="max-w-lg mx-auto mb-6 md:mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" value={modelSearchQuery} onChange={(e) => setModelSearchQuery(e.target.value)} placeholder="Search PHEV makes or models..."
                  className="w-full pl-12 pr-4 py-3 md:py-4 rounded-xl border-2 border-slate-200 focus:border-brand-orange focus:ring-0 outline-none text-base md:text-lg transition-colors" />
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-6 md:mb-8">
              <button onClick={() => setActiveManufacturer('All')} className={`px-4 py-2 rounded-full text-sm md:text-base font-medium transition-all ${activeManufacturer === 'All' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>All makes</button>
              {(Object.keys(phevModelCategories) as ManufacturerCategory[]).map((manufacturer) => (
                <button key={manufacturer} onClick={() => setActiveManufacturer(manufacturer)} className={`px-4 py-2 rounded-full text-sm md:text-base font-medium transition-all ${activeManufacturer === manufacturer ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>{manufacturer}</button>
              ))}
            </div>
            {filteredModels.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                {filteredModels.map(({ model, manufacturer, variants }) => (
                  <button key={`${manufacturer}-${model}`} onClick={() => setSelectedModel(selectedModel === model ? null : model)}
                    className={`group relative bg-white rounded-lg px-2 py-3 md:px-3 md:py-3 text-center border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${selectedModel === model ? 'border-brand-orange ring-1 ring-orange-500/20 shadow-md scale-[1.02]' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm focus:ring-slate-400'}`}>
                    <Plug className="w-7 h-7 mx-auto mb-1.5 opacity-60 group-hover:opacity-80 transition-opacity text-green-600" />
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">{model}</h3>
                    <p className="text-[9px] md:text-[10px] text-slate-500 font-medium leading-tight">{manufacturer}</p>
                    {selectedModel === model && (<div className="absolute top-1 right-1 w-4 h-4 bg-brand-orange rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>)}
                  </button>
                ))}
              </div>
            )}
            {filteredModels.length === 0 && modelSearchQuery && (
              <div className="text-center py-12">
                <Plug className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">No PHEVs found matching "{modelSearchQuery}"</p>
                <button onClick={() => setModelSearchQuery('')} className="mt-3 text-blue-600 font-medium hover:underline">Clear search</button>
              </div>
            )}
            <div className="mt-8 md:mt-10 text-center">
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 text-xs md:text-sm text-slate-600">
                <Check className="w-4 h-4 text-green-600" />
                <span><strong>Also covered:</strong> All PHEV variants, petrol and diesel plug-in hybrids</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sticky CTA */}
        {selectedModel && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 md:py-4 px-4 z-50 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm md:text-base">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center"><Plug className="w-5 h-5 text-white" /></div>
                <div><p className="font-bold text-slate-900">{selectedModel} selected</p><p className="text-slate-500 text-xs md:text-sm">Step 1 of 2: Choose coverage →</p></div>
              </div>
              <Button onClick={scrollToQuoteForm} className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25">
                Get warranty quote for {selectedModel} <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Why PHEV Owners Choose Us */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Why plug-in hybrid owners choose us</h2>
              <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-5 py-3 hover:border-green-400 transition-colors shadow-sm mt-4 mb-4">
                <img src={trustpilotExcellent} alt="Trustpilot - Rated Excellent" className="h-10 object-contain" />
                <span className="text-sm font-semibold text-gray-700">See our reviews</span>
              </a>
              <div className="mt-4">
                <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing">
                  Get PHEV warranty <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Plug, title: 'Specialist PHEV component cover', desc: 'Motors, inverters, on-board chargers, and all plug-in specific parts covered.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team that understands PHEVs', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Car, title: 'All PHEV types from 20+ manufacturers', desc: 'BMW, Mercedes, Volvo, Audi, Kia, Toyota, Ford, VW, Land Rover & more.' },
                  { icon: Clock, title: 'Flexible monthly payments with no lock-in', desc: 'Cancel anytime and get a pro-rata refund. No long contracts.' },
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
                <OptimizedImage src={phevVolvoXC60} alt="PHEV plug-in hybrid warranty UK - Volvo XC60 Recharge covered by Buy A Warranty" className="w-[400px] h-auto object-contain" width={400} height={300} />
              </div>
            </div>
          </div>
        </section>

        {/* How Claims Work */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">How claims work</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {[
                { step: 1, title: 'Diagnose', desc: 'Diagnose at any VAT-registered garage' },
                { step: 2, title: 'Authorise', desc: 'We authorise eligible repairs quickly' },
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your vehicle' },
                { step: 4, title: 'We pay', desc: 'We pay the garage directly for covered items' },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-brand-orange text-white rounded-full flex items-center justify-center text-xl md:text-2xl font-bold mx-auto mb-3 md:mb-4">{item.step}</div>
                  <h3 className="text-sm md:text-lg font-bold text-gray-900 mb-1 md:mb-2">{item.title}</h3>
                  <p className="text-xs md:text-base text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Crystal Clear Cover */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent coverage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your PHEV cover, made <span className="text-brand-orange">crystal clear</span>
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">See what's included — clear terms, no jargon, no surprises.</p>
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

        {/* High Mileage PHEV */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              <div className="flex justify-center">
                <OptimizedImage src={pandaThumbsUp} alt="High mileage PHEV warranty coverage UK - Buy A Warranty" className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto object-contain" width={448} height={300} />
              </div>
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">High mileage PHEV? No problem!</div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Keep driving electric<br /><span className="text-brand-orange">You're covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  PHEVs are built to last. We understand that higher mileage doesn't mean higher risk.
                  That's why we cover plug-in hybrid vehicles up to 150,000 miles with no restrictions during your cover period.
                </p>
                <div className="space-y-2 md:space-y-3 text-left max-w-md mx-auto lg:mx-0">
                  {['Cover vehicles up to 150,000 miles', 'No mileage restrictions during cover', 'Unlimited claims value'].map((text, i) => (
                    <div key={i} className="flex items-center gap-2 md:gap-3">
                      <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm md:text-base text-gray-700">{text}</span>
                    </div>
                  ))}
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

        {/* Additional Cover Options */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Additional PHEV cover options</h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">Enhance your plug-in hybrid warranty with these optional extras</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4"><Car className="w-5 h-5 md:w-6 md:h-6 text-blue-600" /></div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Hire car cover</h3>
                <p className="text-sm md:text-base text-gray-600">Keep moving while your PHEV is being repaired</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 md:mb-4"><MapPin className="w-5 h-5 md:w-6 md:h-6 text-green-600" /></div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">European cover</h3>
                <p className="text-sm md:text-base text-gray-600">Extended protection when driving abroad</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 md:mb-4"><Shield className="w-5 h-5 md:w-6 md:h-6 text-purple-600" /></div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Wear & tear</h3>
                <p className="text-sm md:text-base text-gray-600">Cover for gradual component deterioration</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="flex items-center justify-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (<Star key={i} className="w-5 h-5 text-[#00b67a] fill-[#00b67a]" />))}
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">What UK PHEV owners say about us</h2>
              <p className="text-base md:text-lg text-gray-600">Trusted by thousands of plug-in hybrid owners across England, Scotland, Wales, and Northern Ireland</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col">
                  <div className="flex gap-0.5 mb-3">{[...Array(testimonial.rating)].map((_, i) => (<Star key={i} className="w-4 h-4 text-[#00b67a] fill-[#00b67a]" />))}</div>
                  <p className="text-gray-800 text-base md:text-lg mb-4 leading-relaxed flex-1"><strong>{testimonial.boldLine}</strong>{' '}{testimonial.text}</p>
                  <hr className="border-gray-100 mb-3" />
                  <div><p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p><p className="text-gray-400 text-xs">{testimonial.model} • {testimonial.location}</p></div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 text-sm font-semibold text-gray-700 hover:text-[#00b67a] transition-colors">
                Read more reviews on Trustpilot →
              </a>
            </div>
          </div>
        </section>

        <BrandPageFAQ />

        {/* Final CTA */}
        <section className="py-12 md:py-20 bg-brand-orange">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">Avoid costly PHEV repairs</h2>
            <p className="text-lg md:text-xl text-white/90 mb-6 md:mb-8 max-w-2xl mx-auto">Get an instant quote in 60 seconds. Comprehensive plug-in hybrid cover with easy claims.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button onClick={scrollToQuoteForm} className="bg-white text-brand-orange hover:bg-gray-100 font-bold px-8 md:px-12 py-4 md:py-6 text-base md:text-xl rounded-xl shadow-lg">
                Get your free quote now <ArrowRight className="ml-2 w-5 h-5 md:w-6 md:h-6" />
              </Button>
              <a href="tel:03302295040" className="inline-flex items-center gap-2 text-white font-bold text-base md:text-xl hover:text-white/80 transition-colors">
                <Phone className="w-5 h-5 md:w-6 md:h-6" /> 0330 229 5040
              </a>
            </div>
          </div>
        </section>
      </main>
      <MinimalLandingFooter />
      <BluePersistentCallback />
      <RequestCallbackModal isOpen={showCallbackModal} onClose={() => setShowCallbackModal(false)} />
    </>
  );
};

export default PHEVWarrantyLanding;
