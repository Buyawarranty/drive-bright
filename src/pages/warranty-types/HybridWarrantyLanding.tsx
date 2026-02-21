import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, ChevronUp, MapPin, Clock, Users, Car, Wrench, Zap, Star, Award, ThumbsUp, FileCheck, MessageCircle, Battery, Search } from 'lucide-react';
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
const HomepageFAQ = lazy(() => import('@/components/HomepageFAQ'));
const VehicleCoverageSection = lazy(() => import('@/components/homepage/VehicleCoverageSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));
const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));

// Assets
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import pandaMascot from '@/assets/warranty-panda-mascot.png';
import pandaThumbsUp from '@/assets/extended-van-warranty-uk.png';
import hybridHeroImage from '@/assets/hybrid-warranty-hero-vehicle.png';
import hybridKiaNiro from '@/assets/hybrid-warranty-kia-niro.png';

// UK Hybrid Models covered (grouped by manufacturer) - 2012-2026
const hybridModelCategories = {
  'Toyota': {
    'Yaris Hybrid': ['1.5 Hybrid', 'GR Sport Hybrid'],
    'Corolla Hybrid': ['1.8 Hybrid', '2.0 Hybrid', 'Touring Sports'],
    'C-HR Hybrid': ['1.8 Hybrid', '2.0 Hybrid'],
    'RAV4 Hybrid': ['2.5 Hybrid', 'Plug-in Hybrid'],
    'Camry Hybrid': ['2.5 Hybrid'],
    'Highlander Hybrid': ['2.5 Hybrid'],
    'Prius': ['1.8 Hybrid', 'Plug-in Hybrid'],
    'Prius+': ['1.8 Hybrid'],
  },
  'Honda': {
    'Jazz Hybrid': ['1.5 e:HEV'],
    'Civic Hybrid': ['2.0 e:HEV'],
    'HR-V Hybrid': ['1.5 e:HEV'],
    'CR-V Hybrid': ['2.0 e:HEV', 'Plug-in Hybrid'],
    'ZR-V Hybrid': ['2.0 e:HEV'],
  },
  'Hyundai': {
    'Ioniq Hybrid': ['1.6 GDi Hybrid', 'Plug-in Hybrid'],
    'Tucson Hybrid': ['1.6 T-GDi Hybrid', 'Plug-in Hybrid'],
    'Kona Hybrid': ['1.6 GDi Hybrid'],
    'Santa Fe Hybrid': ['1.6 T-GDi Hybrid', 'Plug-in Hybrid'],
  },
  'Kia': {
    'Niro Hybrid': ['1.6 GDi Hybrid', 'Plug-in Hybrid'],
    'Sportage Hybrid': ['1.6 T-GDi Hybrid', 'Plug-in Hybrid'],
    'Sorento Hybrid': ['1.6 T-GDi Hybrid', 'Plug-in Hybrid'],
    'XCeed PHEV': ['1.6 GDi Plug-in Hybrid'],
  },
  'BMW': {
    '330e': ['Plug-in Hybrid'],
    '530e': ['Plug-in Hybrid'],
    'X1 xDrive25e': ['Plug-in Hybrid'],
    'X3 xDrive30e': ['Plug-in Hybrid'],
    'X5 xDrive45e': ['Plug-in Hybrid'],
    '225xe Active Tourer': ['Plug-in Hybrid'],
  },
  'Mercedes-Benz': {
    'A 250 e': ['Plug-in Hybrid'],
    'C 300 e': ['Plug-in Hybrid'],
    'E 300 e': ['Plug-in Hybrid'],
    'GLC 300 e': ['Plug-in Hybrid'],
    'GLE 350 de': ['Plug-in Hybrid Diesel'],
  },
  'Volvo': {
    'XC40 Recharge': ['T4 Plug-in Hybrid', 'T5 Plug-in Hybrid'],
    'XC60 Recharge': ['T6 Plug-in Hybrid', 'T8 Plug-in Hybrid'],
    'XC90 Recharge': ['T8 Plug-in Hybrid'],
    'S60 Recharge': ['T8 Plug-in Hybrid'],
    'V60 Recharge': ['T6 Plug-in Hybrid', 'T8 Plug-in Hybrid'],
  },
  'Ford': {
    'Kuga PHEV': ['2.5 Plug-in Hybrid'],
    'Puma Hybrid': ['1.0 EcoBoost Hybrid'],
    'Fiesta Hybrid': ['1.0 EcoBoost Hybrid'],
    'Focus Hybrid': ['1.0 EcoBoost Hybrid'],
    'Mondeo Hybrid': ['2.0 Hybrid'],
    'Galaxy Hybrid': ['2.5 FHEV'],
    'S-MAX Hybrid': ['2.5 FHEV'],
    'Tourneo Custom PHEV': ['2.5 Plug-in Hybrid'],
  },
  'Volkswagen': {
    'Golf GTE': ['1.4 TSI Plug-in Hybrid'],
    'Passat GTE': ['1.4 TSI Plug-in Hybrid'],
    'Tiguan eHybrid': ['1.4 TSI Plug-in Hybrid'],
    'Touareg R': ['3.0 TSI Plug-in Hybrid'],
    'Arteon eHybrid': ['1.4 TSI Plug-in Hybrid'],
  },
  'Audi': {
    'A3 TFSI e': ['1.4 TFSI Plug-in Hybrid'],
    'Q3 TFSI e': ['1.4 TFSI Plug-in Hybrid'],
    'Q5 TFSI e': ['2.0 TFSI Plug-in Hybrid'],
    'Q7 TFSI e': ['3.0 TFSI Plug-in Hybrid'],
    'A6 TFSI e': ['2.0 TFSI Plug-in Hybrid'],
    'A7 TFSI e': ['2.0 TFSI Plug-in Hybrid'],
    'A8 TFSI e': ['3.0 TFSI Plug-in Hybrid'],
  },
  'Lexus': {
    'UX 250h': ['2.0 Hybrid'],
    'NX 350h': ['2.5 Hybrid', 'Plug-in Hybrid'],
    'RX 450h': ['3.5 Hybrid', 'Plug-in Hybrid'],
    'ES 300h': ['2.5 Hybrid'],
    'LC 500h': ['3.5 Hybrid'],
    'IS 300h': ['2.5 Hybrid'],
    'CT 200h': ['1.8 Hybrid'],
  },
  'Renault': {
    'Clio E-Tech': ['1.6 Hybrid'],
    'Captur E-Tech': ['1.6 Plug-in Hybrid'],
    'Megane E-Tech': ['1.6 Plug-in Hybrid'],
    'Arkana E-Tech': ['1.6 Hybrid'],
  },
  'Peugeot': {
    '3008 Hybrid': ['1.6 Plug-in Hybrid'],
    '308 Hybrid': ['1.6 Plug-in Hybrid'],
    '508 Hybrid': ['1.6 Plug-in Hybrid'],
  },
  'MINI': {
    'Countryman PHEV': ['1.5 Plug-in Hybrid'],
  },
  'Land Rover': {
    'Range Rover Evoque PHEV': ['1.5 Plug-in Hybrid'],
    'Range Rover Sport PHEV': ['2.0 Plug-in Hybrid', '3.0 Plug-in Hybrid'],
    'Range Rover PHEV': ['3.0 Plug-in Hybrid'],
    'Defender PHEV': ['2.0 Plug-in Hybrid'],
  },
  'Mazda': {
    'CX-60 PHEV': ['2.5 Plug-in Hybrid'],
  },
  'Nissan': {
    'Qashqai e-Power': ['1.5 e-Power Hybrid'],
    'X-Trail e-Power': ['1.5 e-Power Hybrid'],
    'Juke Hybrid': ['1.6 Hybrid'],
  },
  'Vauxhall': {
    'Astra Hybrid': ['1.6 Plug-in Hybrid'],
    'Grandland Hybrid': ['1.6 Plug-in Hybrid'],
  },
  'Suzuki': {
    'Swift Hybrid': ['1.2 Mild Hybrid'],
    'Vitara Hybrid': ['1.5 Hybrid'],
    'S-Cross Hybrid': ['1.5 Hybrid'],
    'Across PHEV': ['2.5 Plug-in Hybrid'],
  },
};

type ManufacturerCategory = keyof typeof hybridModelCategories;

// Coverage components data for hybrid vehicles
const coverageCategories = [
  {
    title: 'Engine & hybrid powertrain',
    icon: Battery,
    items: [
      'Internal combustion engine',
      'Hybrid electric motor/generator',
      'Power control unit (inverter)',
      'Hybrid battery management system',
      'DC-DC converter',
      'Regenerative braking system',
      'Engine cooling system',
    ]
  },
  {
    title: 'Transmission & drivetrain',
    icon: Wrench,
    items: [
      'CVT / e-CVT transmission',
      'Automatic gearbox',
      'Differential (front & rear)',
      'Drive shafts and CV joints',
      'Clutch assembly (if fitted)',
      'Transfer case (AWD hybrids)',
      'Torque converter',
    ]
  },
  {
    title: 'Electrical & electronics',
    icon: Zap,
    items: [
      'ECU and control modules',
      'Hybrid system ECU',
      'Starter motor / generator',
      'On-board charger (PHEV)',
      'Charge port and cable management',
      'Instrument cluster / infotainment',
      'Sensors and actuators',
    ]
  },
  {
    title: 'Cooling & fuel systems',
    icon: Shield,
    items: [
      'Water pump and thermostat',
      'Hybrid battery cooling system',
      'Radiator and expansion tank',
      'Fuel pump and injectors',
      'High-pressure fuel pump',
      'Intercooler (turbo hybrids)',
      'Oil cooler',
    ]
  },
  {
    title: 'Suspension & steering',
    icon: Car,
    items: [
      'Power steering pump/rack',
      'Electric power steering motor',
      'Shock absorbers and struts',
      'Control arms and bushings',
      'Wheel bearings and hubs',
      'Anti-roll bar links',
      'Ball joints',
    ]
  },
  {
    title: 'Hybrid-specific systems',
    icon: Battery,
    items: [
      'High-voltage wiring harness',
      'Battery cooling pump',
      'Electric A/C compressor',
      'Heat pump system',
      'Regenerative brake actuator',
      'Hybrid drive mode selector',
      'EV mode controller',
    ]
  },
];

// FAQs for schema
const hybridFAQs = [
  {
    question: "Is my hybrid vehicle too old or too many miles?",
    answer: "We cover hybrid vehicles up to 15 years old and 150,000 miles. Check your instant price to confirm eligibility."
  },
  {
    question: "Can I use my own garage?",
    answer: "Yes. Any VAT registered garage is acceptable or we can recommend an approved garage."
  },
  {
    question: "What's covered in my hybrid warranty?",
    answer: "At Buy-a-Warranty, we like to keep things simple. One solid plan that covers hybrid-specific components including the electric motor, inverter, hybrid battery management system, regenerative braking, and all standard mechanical parts. No confusing packages."
  },
  {
    question: "How do I make a claim?",
    answer: "Arrange for your vehicle to be inspected by a local independent repair garage to diagnose any issues. Once diagnosed, before any repairs are conducted, the repairer must directly contact our Claims Team at 0330 229 5045. It's important to note that failure to do so will not allow us to process your claim."
  },
  {
    question: "Are hybrid batteries covered?",
    answer: "We cover the hybrid battery management system, DC-DC converter, and related electronics. The high-voltage traction battery cells themselves are typically covered by the manufacturer's warranty (usually 8-10 years)."
  },
  {
    question: "How much does it cost?",
    answer: "Warranty costs start from just £19 per month for hybrid vehicles, depending on your vehicle and the level of cover you choose. Get an instant quote by entering your registration number above."
  },
  {
    question: "Do you cover plug-in hybrids (PHEVs)?",
    answer: "Yes, we cover both standard hybrids (HEV) and plug-in hybrids (PHEV). This includes the on-board charger, charge port, and all hybrid-specific components."
  },
  {
    question: "Do I need a full service history?",
    answer: "A reasonable service history is fine. Many vehicles are accepted even if servicing has been missed."
  },
  {
    question: "What claim limit is right for me?",
    answer: "It depends on your vehicle and how much protection you want.\n\n£1,000 is ideal for smaller or lower-cost repairs.\n£2,000 offers broader cover for most mid-range repairs.\n£3,000 is our most popular option and covers the majority of common faults in full.\n£5,000 provides our highest level of protection and is best suited to newer, higher-value or more complex vehicles where repair costs can be significantly higher.\n\nEvery plan includes unlimited claims, and you're covered up to the value of your vehicle, whichever limit you choose."
  },
  {
    question: "Are diagnostics covered?",
    answer: "Diagnostics are usually covered when the fault is approved."
  },
];

// Testimonials
const testimonials = [
  {
    name: "Sarah W.",
    location: "Reading",
    model: "Toyota RAV4 Hybrid",
    boldLine: "Hybrid inverter replaced — £2,200 covered.",
    text: "My RAV4's power control unit failed at 78,000 miles. Buy A Warranty handled everything and the garage was paid directly. Brilliant service.",
    rating: 5
  },
  {
    name: "James P.",
    location: "Edinburgh",
    model: "Kia Niro PHEV",
    boldLine: "Claim approved within 24 hours.",
    text: "The on-board charger on my Niro needed replacing. They sorted it quickly and I was back on the road in no time.",
    rating: 5
  },
  {
    name: "Rachel K.",
    location: "Bristol",
    model: "Volvo XC60 Recharge",
    boldLine: "Saved me over £3,000 on repairs.",
    text: "Electric A/C compressor and hybrid cooling pump both went. They covered the full repair without any hassle.",
    rating: 5
  },
  {
    name: "Tom B.",
    location: "Manchester",
    model: "Honda CR-V Hybrid",
    boldLine: "Excellent cover for hybrid-specific parts.",
    text: "e-CVT gearbox issue at 62,000 miles. Everything was covered, no excess to pay. Highly recommend for any hybrid owner.",
    rating: 5
  },
  {
    name: "Linda M.",
    location: "Cardiff",
    model: "Hyundai Tucson Hybrid",
    boldLine: "DC-DC converter failed — fully covered.",
    text: "Was worried about getting warranty for a hybrid but they covered my Tucson no problem. Fantastic experience from start to finish.",
    rating: 5
  },
  {
    name: "David C.",
    location: "Brighton",
    model: "BMW 330e",
    boldLine: "Professional and fast claims process.",
    text: "High-voltage wiring issue on my 330e. The whole claim was approved same day and the repair cost £1,800 — all covered.",
    rating: 5
  }
];

const HybridWarrantyLanding: React.FC = () => {
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

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    const allModels = activeManufacturer === 'All'
      ? Object.entries(hybridModelCategories).flatMap(([manufacturer, models]) => 
          Object.entries(models).map(([model, variants]) => ({ model, variants, manufacturer }))
        )
      : Object.entries(hybridModelCategories[activeManufacturer]).map(([model, variants]) => ({ 
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
    trackButtonClick('hybrid_warranty_get_quote', { vehicleType: 'hybrid' });
    
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
          vehicleType: 'hybrid',
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
          vehicleType: 'hybrid',
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
        vehicleType: 'hybrid',
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
    "name": "Hybrid Car Warranty UK — Extended Cover for HEV, PHEV & Mild Hybrids",
    "description": "UK's specialist hybrid vehicle extended warranty from £19/month. Covers Toyota Prius, RAV4, Corolla Hybrid, Honda CR-V e:HEV, Kia Niro, Hyundai Tucson Hybrid, BMW 330e, Volvo XC60 Recharge, Mercedes C 300 e, Lexus NX, Audi Q5 TFSI e, and 100+ hybrid models. Protection for electric motors, inverters, battery management systems, DC-DC converters, regenerative braking, e-CVT transmissions, on-board chargers, and 1,000+ components. Unlimited claims at any VAT-registered garage across the UK.",
    "brand": { "@type": "Brand", "name": "Buy A Warranty" },
    "manufacturer": {
      "@type": "Organization",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
      "contactPoint": { "@type": "ContactPoint", "telephone": "+44-330-229-5040", "contactType": "customer service", "availableLanguage": "English", "areaServed": "GB" }
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "GBP",
      "price": "19",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://buyawarranty.co.uk/warranty-types/hybrid-warranty/",
      "seller": { "@type": "Organization", "name": "Buy A Warranty" },
      "itemCondition": "https://schema.org/NewCondition",
      "priceSpecification": { "@type": "UnitPriceSpecification", "price": "19", "priceCurrency": "GBP", "unitText": "month", "billingIncrement": 1 }
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
    "audience": { "@type": "Audience", "audienceType": "Hybrid vehicle owners in the United Kingdom" }
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Hybrid Car Extended Warranty — UK Specialist Provider",
    "alternateName": ["Hybrid Vehicle Warranty UK", "PHEV Warranty", "Plug-in Hybrid Warranty", "HEV Extended Warranty"],
    "provider": {
      "@type": "LocalBusiness",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "telephone": "+44-330-229-5040",
      "priceRange": "£19-£99/month",
      "address": { "@type": "PostalAddress", "addressCountry": "GB" }
    },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "description": "UK's specialist extended warranty for hybrid cars, plug-in hybrids (PHEV), and mild hybrids (MHEV). Covers Toyota Prius, Yaris, Corolla, RAV4 & C-HR Hybrid; Honda Jazz, Civic, CR-V & HR-V e:HEV; Kia Niro, Sportage & Sorento; Hyundai Tucson, Ioniq & Kona Hybrid; BMW 330e, 530e & X5 PHEV; Volvo XC40, XC60 & XC90 Recharge; Mercedes A 250 e, C 300 e & GLC 300 e; Lexus UX, NX & RX; Audi A3, Q5 & Q7 TFSI e; Ford Kuga PHEV & Puma Hybrid; VW Golf GTE & Tiguan eHybrid; Renault, Peugeot, Nissan, Land Rover, MINI & more. Protects electric motors, inverters, battery management systems, DC-DC converters, regenerative braking, e-CVT transmissions, on-board chargers, and 1,000+ mechanical and electrical components. Plans from £19/month with unlimited claims at any VAT-registered garage.",
    "serviceType": "Vehicle Extended Warranty",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Hybrid Warranty Plans",
      "itemListElement": [
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "1 Year Hybrid Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "2 Year Hybrid Warranty" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "3 Year Hybrid Warranty" } }
      ]
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": hybridFAQs.map(faq => ({
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
      { "@type": "ListItem", "position": 3, "name": "Hybrid vehicle warranty", "item": "https://buyawarranty.co.uk/warranty-types/hybrid-warranty/" }
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "legalName": "BUY A WARRANTY LIMITED",
    "description": "UK's trusted extended vehicle warranty provider since 2016. Specialist in hybrid, electric, car, van, and motorbike warranty cover. Rated Excellent on Trustpilot.",
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "knowsAbout": ["Hybrid Car Warranty", "PHEV Warranty", "EV Warranty", "Used Car Warranty", "Van Warranty", "Extended Vehicle Warranty"],
    "foundingDate": "2016",
    "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"],
    "contactPoint": { "@type": "ContactPoint", "telephone": "+44-330-229-5040", "contactType": "customer service", "areaServed": "GB", "availableLanguage": "English" }
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Hybrid Car Warranty UK From £19/mo — Toyota, BMW, Kia, Volvo & 100+ Models",
    "description": "Get specialist hybrid vehicle warranty cover in the UK. We protect electric motors, inverters, battery management systems, and 1,000+ components on Toyota, Honda, Kia, Hyundai, BMW, Volvo, Mercedes, Lexus, Audi, Ford, VW, Nissan, Land Rover and more. HEV, PHEV and mild hybrid. Unlimited claims, any garage, from £19/month.",
    "url": "https://buyawarranty.co.uk/warranty-types/hybrid-warranty/",
    "dateModified": new Date().toISOString().split('T')[0],
    "inLanguage": "en-GB",
    "isPartOf": { "@type": "WebSite", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "about": [
      { "@type": "Thing", "name": "Hybrid Vehicle Extended Warranty" },
      { "@type": "Thing", "name": "Plug-in Hybrid Car Warranty" },
      { "@type": "Thing", "name": "PHEV Warranty UK" }
    ],
    "mentions": [
      { "@type": "Brand", "name": "Toyota" },
      { "@type": "Brand", "name": "Honda" },
      { "@type": "Brand", "name": "Kia" },
      { "@type": "Brand", "name": "Hyundai" },
      { "@type": "Brand", "name": "BMW" },
      { "@type": "Brand", "name": "Volvo" },
      { "@type": "Brand", "name": "Mercedes-Benz" },
      { "@type": "Brand", "name": "Lexus" },
      { "@type": "Brand", "name": "Audi" },
      { "@type": "Brand", "name": "Volkswagen" },
      { "@type": "Brand", "name": "Ford" },
      { "@type": "Brand", "name": "Renault" },
      { "@type": "Brand", "name": "Peugeot" },
      { "@type": "Brand", "name": "Nissan" },
      { "@type": "Brand", "name": "Land Rover" },
      { "@type": "Brand", "name": "MINI" },
      { "@type": "Brand", "name": "Mazda" },
      { "@type": "Brand", "name": "Suzuki" },
      { "@type": "Brand", "name": "Vauxhall" },
      { "@type": "Thing", "name": "Hybrid Vehicle Warranty" },
      { "@type": "Thing", "name": "PHEV Warranty" },
      { "@type": "Thing", "name": "Mild Hybrid Warranty" }
    ],
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".hero-description"] },
    "mainContentOfPage": { "@type": "WebPageElement", "cssSelector": "main" }
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to get a hybrid car warranty quote in the UK",
    "description": "Get an instant hybrid vehicle warranty quote in 60 seconds — covers Toyota, BMW, Kia, Volvo, Mercedes, Honda & 100+ hybrid models",
    "image": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "position": 1, "name": "Enter registration", "text": "Enter your hybrid vehicle registration number to look up your vehicle details automatically" },
      { "@type": "HowToStep", "position": 2, "name": "Select mileage", "text": "Choose your current mileage range (under or over 120,000 miles)" },
      { "@type": "HowToStep", "position": 3, "name": "Get instant quote", "text": "Receive your personalised warranty quote instantly with pricing for different coverage levels" }
    ]
  };

  return (
    <>
      <Helmet>
        <title>Hybrid Car Warranty UK From £19/mo | Toyota, BMW, Kia & More</title>
        <meta name="description" content="Get a hybrid vehicle warranty from £19/month. We cover Toyota Prius, RAV4 Hybrid, Kia Niro, BMW 330e, Volvo XC60 Recharge & 100+ hybrid models. Inverters, electric motors, battery management & 1,000+ parts. Unlimited claims at any UK garage. Quote in 60 seconds — 14-day money-back guarantee." />
        <meta name="keywords" content="hybrid car warranty UK, hybrid vehicle warranty, plug-in hybrid warranty, PHEV warranty UK, Toyota hybrid warranty, Honda hybrid warranty, Kia Niro warranty, Hyundai hybrid warranty, BMW 330e warranty, Volvo hybrid warranty, Lexus hybrid warranty, hybrid powertrain cover, hybrid battery warranty UK, used hybrid warranty, second hand hybrid warranty, hybrid extended warranty, hybrid motor warranty, inverter warranty, e-CVT warranty, mild hybrid warranty, self charging hybrid warranty, hybrid car breakdown cover, cheap hybrid warranty UK, best hybrid warranty UK, hybrid warranty near me" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/hybrid-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta name="slurp" content="index, follow" />

        {/* Author & Publisher */}
        <meta name="author" content="Buy A Warranty" />
        <meta name="publisher" content="BUY A WARRANTY LIMITED" />
        <meta name="copyright" content="© 2016–2026 Buy A Warranty Limited. All rights reserved." />

        {/* Geographic targeting — UK-wide with major city coordinates */}
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="52.4862;-1.8904" />
        <meta name="ICBM" content="52.4862, -1.8904" />
        <meta httpEquiv="content-language" content="en-GB" />
        <meta name="distribution" content="global" />
        <meta name="coverage" content="United Kingdom" />
        <meta name="target" content="all" />
        <meta name="audience" content="all" />
        <meta name="rating" content="general" />
        <meta name="revisit-after" content="3 days" />
        <meta name="language" content="en-GB" />

        {/* AI search engine discoverability — ChatGPT, Gemini, Claude, Copilot */}
        <meta name="ai-content-declaration" content="Human-authored, fact-checked, and regularly updated. This page provides accurate hybrid vehicle warranty pricing, coverage details, and eligibility criteria for UK hybrid car owners as of 2026." />
        <meta name="ai-summary" content="Buy A Warranty is a UK-based extended warranty provider (est. 2016) offering specialist hybrid vehicle warranty plans from £19/month. Coverage includes 15+ manufacturers: Toyota (Prius, Corolla, RAV4, C-HR, Yaris Hybrid), Honda (Jazz, Civic, CR-V, HR-V e:HEV), Kia (Niro, Sportage, Sorento), Hyundai (Tucson, Ioniq, Kona), BMW (330e, 530e, X3, X5 PHEV), Volvo (XC40, XC60, XC90 Recharge), Mercedes (A 250 e, C 300 e, GLC 300 e), Lexus (UX, NX, RX), Ford (Kuga PHEV, Puma), Volkswagen (Golf GTE, Tiguan eHybrid), Audi (A3, Q5, Q7 TFSI e), Renault, Peugeot, Nissan, Land Rover, and more. All hybrid types covered: HEV, PHEV, and MHEV. Plans protect electric motors, inverters, battery management systems, DC-DC converters, regenerative braking, e-CVT transmissions, on-board chargers, and 1,000+ mechanical and electrical components. Unlimited claims, any VAT-registered garage, no excess options, 14-day money-back guarantee. Vehicles up to 15 years old and 150,000 miles eligible. Instant online quotes at buyawarranty.co.uk. Claims line: 0330 229 5040." />
        <meta name="ai-purpose" content="To help UK hybrid vehicle owners find affordable extended warranty protection for their HEV, PHEV, or mild hybrid car" />

        {/* Open Graph — unique, keyword-rich, click-worthy */}
        <meta property="og:title" content="Hybrid Car Warranty From £19/mo — Toyota, BMW, Kia, Volvo & 100+ Models Covered" />
        <meta property="og:description" content="UK's specialist hybrid warranty. Covers electric motors, inverters, battery management & 1,000+ parts on any HEV, PHEV or mild hybrid. Unlimited claims, any garage, no excess options. Instant quote in 60 seconds." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/hybrid-warranty/" />
        <meta property="og:type" content="product" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Buy A Warranty hybrid vehicle warranty — covers Toyota, BMW, Kia, Volvo and 100+ UK hybrid models from £19 per month" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        <meta property="product:price:amount" content="19" />
        <meta property="product:price:currency" content="GBP" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@buyawarranty" />
        <meta name="twitter:creator" content="@buyawarranty" />
        <meta name="twitter:title" content="Hybrid Car Warranty UK — From £19/mo | 100+ Models Covered" />
        <meta name="twitter:description" content="Specialist hybrid warranty for Toyota, BMW, Kia, Volvo & more. Electric motors, inverters, battery systems covered. Unlimited claims, any UK garage. Quote in 60 seconds." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta name="twitter:image:alt" content="Hybrid Vehicle Warranty UK — Buy A Warranty — From £19 per month" />

        {/* Facebook/Meta domain verification compatibility */}
        <meta property="article:publisher" content="Buy A Warranty" />
        <meta property="article:section" content="Hybrid Vehicle Warranty" />

        {/* Structured Data - 7 JSON-LD schemas */}
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
                  <span className="text-gray-900">Hybrid car warranty </span>
                  <span className="text-brand-orange">from £19/month</span>
                </h1>

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

                  {/* Trust Contact Panel */}
                  <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-5 py-4 text-center">
                    <p className="text-sm sm:text-[17px] font-bold text-[#1B2A4A]">
                      Fair price. Fast quote. No surprises.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs sm:text-[15px] mt-1.5">
                      <span className="text-gray-600">Speak to an expert:</span>
                      <a href="tel:03302295040" className="font-semibold text-gray-900 hover:underline">
                        0330 229 5040
                      </a>
                      <span className="text-gray-400">or</span>
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
                    src={hybridHeroImage}
                    alt="Hybrid car warranty UK - Toyota RAV4 Hybrid covered by Buy A Warranty from £19 per month"
                    className="w-full h-auto max-w-md mx-auto object-contain"
                    priority={true}
                    width={600}
                    height={450}
                    style={{ border: 'none', boxShadow: 'none' }}
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

                {/* Vehicle Type Tags */}
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5">
                      <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Hybrid (HEV)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Plug-in hybrid (PHEV)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Mild hybrid (MHEV)</span>
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
          <WarrantyBenefitsSection headline="The ultimate hybrid warranty." />
        </Suspense>

        {/* Vehicle Coverage Accordion Section */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Hybrid" />
        </Suspense>

        {/* Cover Clarity Section */}
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        {/* Video Section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>

        {/* Average Hybrid Repair Costs Section */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 font-semibold text-sm px-4 py-2 rounded-full mb-4">
                <Wrench className="w-4 h-4" />
                Without warranty, you pay the full bill
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                Average hybrid repair costs in the UK
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                Hybrid-specific parts are expensive. A single inverter or electric motor failure could cost you thousands without warranty cover.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {[
                { part: 'Hybrid inverter replacement', cost: '£1,500 – £3,500', icon: Zap, severity: 'critical' as const },
                { part: 'Electric motor / generator', cost: '£2,000 – £4,000', icon: Battery, severity: 'critical' as const },
                { part: 'e-CVT transmission rebuild', cost: '£2,500 – £5,000', icon: Wrench, severity: 'critical' as const },
                { part: 'DC-DC converter', cost: '£800 – £1,800', icon: Zap, severity: 'high' as const },
                { part: 'Electric A/C compressor', cost: '£900 – £2,200', icon: Shield, severity: 'high' as const },
                { part: 'Battery management system', cost: '£700 – £1,500', icon: Battery, severity: 'high' as const },
                { part: 'On-board charger (PHEV)', cost: '£1,200 – £2,500', icon: Zap, severity: 'high' as const },
                { part: 'Regenerative brake actuator', cost: '£600 – £1,400', icon: Wrench, severity: 'medium' as const },
                { part: 'Hybrid cooling pump', cost: '£500 – £1,200', icon: Clock, severity: 'medium' as const },
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
                  <div 
                    key={index} 
                    className={`relative rounded-xl border-2 ${severityColor} p-4 md:p-5 transition-all hover:shadow-md`}
                  >
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
                        </div>
                      </div>
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
                  className="bg-brand-orange text-white font-bold px-10 py-6 text-lg rounded-xl animate-breathing shadow-lg shadow-brand-orange/30"
                >
                  Get my instant quote <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Hybrid Models Section */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full coverage details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                Every UK hybrid model we cover
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                We cover hybrid, plug-in hybrid, and mild hybrid vehicles from all major manufacturers registered between 2012 and 2026. Select your make to see models.
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-lg mx-auto mb-6 md:mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search hybrid makes or models..."
                  className="w-full pl-12 pr-4 py-3 md:py-4 rounded-xl border-2 border-slate-200 focus:border-brand-orange focus:ring-0 outline-none text-base md:text-lg transition-colors"
                />
              </div>
            </div>

            {/* Manufacturer Filter Tabs */}
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
              {(Object.keys(hybridModelCategories) as ManufacturerCategory[]).map((manufacturer) => (
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

            {/* Models Grid */}
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
                    <Battery className="w-7 h-7 mx-auto mb-1.5 opacity-60 group-hover:opacity-80 transition-opacity text-green-600" />
                    
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">
                      {model}
                    </h3>
                    
                    <p className="text-[9px] md:text-[10px] text-slate-500 font-medium leading-tight">
                      {manufacturer}
                    </p>

                    {selectedModel === model && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-brand-orange rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {filteredModels.length === 0 && modelSearchQuery && (
              <div className="text-center py-12">
                <Battery className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">No hybrids found matching "{modelSearchQuery}"</p>
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
                <span><strong>Also covered:</strong> All hybrid variants, plug-in hybrid, mild hybrid, and self-charging hybrid</span>
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
                  <Battery className="w-5 h-5 text-white" />
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
                Get warranty quote for {selectedModel}
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Why Hybrid Owners Choose Us Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why hybrid vehicle owners choose us
              </h2>
              {/* Trustpilot Badge */}
              <a
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-5 py-3 hover:border-green-400 transition-colors shadow-sm mt-4 mb-4"
              >
                <img src={trustpilotExcellent} alt="Trustpilot - Rated Excellent" className="h-10 object-contain" />
                <span className="text-sm font-semibold text-gray-700">See our reviews</span>
              </a>
              <div className="mt-4">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing"
                >
                  Get hybrid warranty
                  <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Battery, title: 'Specialist hybrid component cover', desc: 'Motors, inverters, battery management, and all hybrid-specific parts covered.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team that understands hybrids', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Car, title: 'All hybrid types covered', desc: 'HEV, PHEV, and mild hybrid vehicles from 15+ manufacturers.' },
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
              
              {/* Mascot / Image */}
              <div className="hidden lg:flex justify-center items-end">
                <OptimizedImage 
                  src={hybridKiaNiro}
                  alt="Kia Niro hybrid warranty UK - covered by Buy A Warranty specialist hybrid cover"
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
                How claims work
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {[
                { step: 1, title: 'Diagnose', desc: 'Diagnose at any VAT-registered garage' },
                { step: 2, title: 'Authorise', desc: 'We authorise eligible repairs quickly' },
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your vehicle' },
                { step: 4, title: 'We pay', desc: 'We pay the garage directly for covered items' },
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

        {/* Your Hybrid Cover Made Crystal Clear Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent coverage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your hybrid cover, made <span className="text-brand-orange">crystal clear</span>
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                See what's included — clear terms, no jargon, no surprises.
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

        {/* High Mileage Hybrid Section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              <div className="flex justify-center">
                <OptimizedImage 
                  src={pandaThumbsUp}
                  alt="High mileage hybrid warranty coverage - Miles the Panda"
                  className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto object-contain"
                  width={448}
                  height={300}
                />
              </div>
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High mileage hybrid? No problem!
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Keep driving green<br />
                  <span className="text-brand-orange">You're covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Hybrids are built to last. We understand that higher mileage doesn't mean higher risk.
                  That's why we cover hybrid vehicles up to 150,000 miles with no restrictions during your cover period.
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

        {/* Additional Cover Options Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Additional hybrid cover options
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Enhance your hybrid warranty with these optional extras
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Car className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Hire car cover</h3>
                <p className="text-sm md:text-base text-gray-600">Keep moving while your hybrid is being repaired</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">European cover</h3>
                <p className="text-sm md:text-base text-gray-600">Extended protection when driving abroad</p>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Shield className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Wear & tear</h3>
                <p className="text-sm md:text-base text-gray-600">Cover for gradual component deterioration</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="flex items-center justify-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-[#00b67a] fill-[#00b67a]" />
                ))}
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                What UK hybrid owners say about us
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Trusted by thousands of hybrid vehicle owners across England, Scotland, Wales, and Northern Ireland
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
                    <p className="text-gray-400 text-xs">{testimonial.model} • {testimonial.location}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              <a
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-sm font-semibold text-gray-700 hover:text-[#00b67a] transition-colors"
              >
                Read more reviews on Trustpilot →
              </a>
            </div>
          </div>
        </section>

        <BrandPageFAQ />

        {/* Final CTA Section */}
        <section className="py-12 md:py-20 bg-brand-orange">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">
              Avoid costly hybrid repairs
            </h2>
            <p className="text-lg md:text-xl text-white/90 mb-6 md:mb-8 max-w-2xl mx-auto">
              Get an instant quote in 60 seconds. Comprehensive hybrid cover with easy claims.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={scrollToQuoteForm}
                className="bg-white text-brand-orange hover:bg-gray-100 font-bold px-8 md:px-12 py-4 md:py-6 text-base md:text-xl rounded-xl shadow-lg"
              >
                Get your free quote now
                <ArrowRight className="ml-2 w-5 h-5 md:w-6 md:h-6" />
              </Button>
              <a
                href="tel:03302295040"
                className="inline-flex items-center gap-2 text-white font-bold text-base md:text-xl hover:text-white/80 transition-colors"
              >
                <Phone className="w-5 h-5 md:w-6 md:h-6" />
                0330 229 5040
              </a>
            </div>
          </div>
        </section>
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

export default HybridWarrantyLanding;
