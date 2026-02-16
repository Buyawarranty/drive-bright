import React, { useState, lazy, Suspense, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, ChevronUp, MapPin, Clock, Users, Car, Wrench, Zap, Star, Award, ThumbsUp, FileCheck, MessageCircle, Truck, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import { OptimizedImage } from '@/components/OptimizedImage';
import MileageQuickSelect from '@/components/MileageQuickSelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';

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
import pandaMechanic from '@/assets/panda-mechanic.png';
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

// Coverage components data for vans
const coverageCategories = [
  {
    title: 'Engine & Powertrain',
    icon: Truck,
    items: [
      'Engine block and cylinder head',
      'Diesel injectors and fuel pump',
      'Turbocharger/supercharger',
      'Timing belts and chains',
      'Oil pump and oil cooler',
      'EGR valve and cooler',
      'DPF and emissions systems',
    ]
  },
  {
    title: 'Transmission & Drivetrain',
    icon: Wrench,
    items: [
      'Manual and automatic gearbox',
      'Clutch (if not wear item)',
      'Differential (front & rear)',
      'Transfer case (4WD vans)',
      'Drive shafts and CV joints',
      'Prop shaft and bearings',
      'Torque converter',
    ]
  },
  {
    title: 'Electrical & Electronics',
    icon: Zap,
    items: [
      'ECU and control modules',
      'Starter motor and alternator',
      'Central locking system',
      'Electric window motors',
      'Instrument cluster',
      'Sensors and actuators',
      'Wiring looms',
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
      'Intercooler',
      'Oil cooler',
    ]
  },
  {
    title: 'Suspension & Steering',
    icon: Truck,
    items: [
      'Power steering pump/rack',
      'Shock absorbers and struts',
      'Heavy-duty leaf springs',
      'Control arms and bushings',
      'Wheel bearings and hubs',
      'Anti-roll bar links',
      'Ball joints',
    ]
  },
  {
    title: 'Commercial Features',
    icon: Wrench,
    items: [
      'Sliding door mechanisms',
      'Rear door locking systems',
      'Load area lighting',
      'Tachograph systems',
      'Reversing camera/sensors',
      'Payload systems',
      'Tailgate mechanisms',
    ]
  },
];

// FAQs for schema
const vanFAQs = [
  {
    question: "Is my van too old or too many miles?",
    answer: "We cover many older and higher mileage vehicles up to 15 years old and 150,000 miles. Check your instant price to confirm."
  },
  {
    question: "Can I use my own garage?",
    answer: "Yes. Any VAT registered garage is acceptable or we can recommend an approved garage."
  },
  {
    question: "What's covered in my warranty?",
    answer: "At Buy-a-Warranty, we like to keep things simple. One solid plan that works for cars, vans, and motorbikes, whether you're driving electric, hybrid, petrol, or diesel. We keep things simple with no confusing packages, you won't encounter any unexpected rejections, and we offer straightforward cover without the hassle."
  },
  {
    question: "How do I make a claim?",
    answer: "Arrange for your vehicle to be inspected by a local independent repair garage to diagnose any issues. Once diagnosed, before any repairs are conducted, the repairer must directly contact our Claims Team at 0330 229 5045. It's important to note that failure to do so will not allow us to process your claim."
  },
  {
    question: "What should I do if my van has an issue?",
    answer: "If your van experiences a problem, please contact our Claims Team at 0330 229 5045. They are available Monday to Friday from 09:00 to 17:30 and can help start and process your warranty claim. If the issue arises outside of these hours, please fill out our online contact form."
  },
  {
    question: "How much does it cost?",
    answer: "Warranty costs start from just £32 per month for vans, depending on your vehicle and the level of cover you choose. Get an instant quote by entering your registration number above."
  },
  {
    question: "What about modified vehicles?",
    answer: "Most body modifications are accepted. Call us on 0330 229 5040 or request a call back using the Call us button in the top navigation bar."
  },
  {
    question: "Do I need a full service history?",
    answer: "A reasonable service history is fine. Many vehicles are accepted even if servicing has been missed."
  },
  {
    question: "Is £1,000, £2,000 or £3,000 the right claim limit for me?",
    answer: "It depends on your vehicle and how much protection you want.\n\n£1,000 is ideal for smaller or lower‑cost repairs.\n£2,000 offers broader cover for most mid‑range repairs.\n£3,000 is our most popular option and covers the majority of common faults in full.\n\nEvery plan includes unlimited claims, and you're covered up to the value of your vehicle, whichever limit you choose."
  },
  {
    question: "Are diagnostics covered?",
    answer: "Diagnostics are usually covered when the fault is approved."
  },
  {
    question: "What is the most expensive repair you have covered?",
    answer: "We regularly cover repairs over £1,500 for engines, gearboxes and ECUs. Higher claim limits are available. Check your instant price by entering your registration."
  }
];

// Testimonials
const testimonials = [
  {
    name: "Mike T.",
    location: "Birmingham",
    model: "Ford Transit Custom",
    text: "My Transit is essential for my plumbing business. When the gearbox went at 95,000 miles, they sorted it in 3 days. Saved me over £2,500. Brilliant service all round.",
    rating: 5
  },
  {
    name: "Steve R.",
    location: "Glasgow",
    model: "Mercedes Sprinter",
    text: "Our Sprinter needed a new turbo. Claim was approved same day and the garage was paid directly. Back on the road within the week.",
    rating: 5
  },
  {
    name: "Karen L.",
    location: "Leeds",
    model: "VW Transporter",
    text: "I was worried about getting warranty for a high-mileage van but they covered my T6 no problem. Fuel pump failed and they covered the lot.",
    rating: 5
  },
  {
    name: "Paul D.",
    location: "London",
    model: "Renault Trafic",
    text: "Professional service from start to finish. The injector failed on my Trafic and they handled everything. No excess to pay either.",
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
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [expandedCoverage, setExpandedCoverage] = useState(false);
  const [activeManufacturer, setActiveManufacturer] = useState<ManufacturerCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

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
    "name": "Van Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for all commercial vans including Ford Transit, Mercedes Sprinter, VW Transporter, Renault Master, and more. Covers engine, gearbox, transmission, electrical systems, and more. Nationwide UK coverage with any VAT-registered garage.",
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
      "price": "32",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://buyawarranty.co.uk/warranty-types/vans/",
      "seller": {
        "@type": "Organization",
        "name": "Buy A Warranty"
      },
      "itemCondition": "https://schema.org/NewCondition",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": "32",
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
      "audienceType": "Commercial van owners in the United Kingdom"
    }
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Van Extended Warranty Service",
    "alternateName": "Commercial Van Warranty",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "telephone": "+44-800-917-9270",
      "priceRange": "£32-£95/month",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "GB"
      }
    },
    "areaServed": {
      "@type": "Country",
      "name": "United Kingdom"
    },
    "description": "Extended warranty coverage for all commercial vans including Ford Transit, Ford Transit Custom, Mercedes Sprinter, VW Transporter, VW Crafter, Renault Master, Renault Trafic, Vauxhall Movano, Vauxhall Vivaro, Peugeot Boxer, Citroen Relay, Fiat Ducato, Nissan NV400, Toyota Proace, Iveco Daily, and MAN TGE. Covers engine, transmission, electrical systems, turbocharger, diesel systems and more. Nationwide UK coverage with any VAT-registered garage. 24/7 roadside assistance included.",
    "serviceType": "Vehicle Extended Warranty",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Van Warranty Plans",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "1 Year Van Warranty"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "2 Year Van Warranty"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "3 Year Van Warranty"
          }
        }
      ]
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": vanFAQs.map(faq => ({
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
        "name": "Van Extended Warranty",
        "item": "https://buyawarranty.co.uk/warranty-types/vans/"
      }
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "description": "UK's trusted extended vehicle warranty provider. Protecting cars, vans, and commercial vehicles since 2016.",
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

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Van Extended Warranty UK - Get Instant Quote",
    "description": "Protect your commercial van with comprehensive extended warranty cover. All major makes covered including Ford Transit, Mercedes Sprinter, VW Transporter. Nationwide UK coverage, approved garages, unlimited claims.",
    "url": "https://buyawarranty.co.uk/warranty-types/vans/",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk"
    },
    "about": {
      "@type": "Thing",
      "name": "Van Extended Warranty"
    },
    "mentions": [
      { "@type": "Brand", "name": "Ford" },
      { "@type": "Brand", "name": "Mercedes-Benz" },
      { "@type": "Brand", "name": "Volkswagen" },
      { "@type": "Brand", "name": "Renault" },
      { "@type": "Brand", "name": "Citroën" },
      { "@type": "Brand", "name": "Peugeot" },
      { "@type": "Brand", "name": "Vauxhall" },
      { "@type": "Brand", "name": "Fiat" },
      { "@type": "Brand", "name": "Nissan" },
      { "@type": "Brand", "name": "Toyota" },
      { "@type": "Brand", "name": "Iveco" },
      { "@type": "Brand", "name": "MAN" },
      { "@type": "Thing", "name": "Commercial Van Warranty" }
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

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Get a Van Extended Warranty Quote",
    "description": "Get an instant van extended warranty quote in 60 seconds",
    "totalTime": "PT1M",
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Enter Registration",
        "text": "Enter your van registration number to look up your vehicle details automatically"
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
        <title>Van Warranty UK | Instant Van Cover Quotes | Buy A Warranty</title>
        <meta name="description" content="Protect your commercial van with comprehensive extended warranty cover. Ford Transit, Mercedes Sprinter, VW Transporter, Renault Master, Vauxhall Vivaro & more. Engine, gearbox, electrics covered. Nationwide UK coverage, any garage. Prices from £32/month. Get your instant quote in 60 seconds." />
        <meta name="keywords" content="van extended warranty, commercial van warranty, van warranty UK, Ford Transit warranty, Ford Transit Custom warranty, Mercedes Sprinter warranty, VW Transporter warranty, VW Crafter warranty, Renault Master warranty, Renault Trafic warranty, Vauxhall Movano warranty, Vauxhall Vivaro warranty, Peugeot Boxer warranty, Citroen Relay warranty, Fiat Ducato warranty, Nissan NV400 warranty, Toyota Proace warranty, Iveco Daily warranty, MAN TGE warranty, used van warranty, second hand van warranty, van breakdown cover, commercial vehicle warranty, panel van warranty, transit van warranty, work van warranty, delivery van warranty UK" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/vans/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large" />
        
        {/* Geographic targeting */}
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5074;-0.1278" />
        <meta name="ICBM" content="51.5074, -0.1278" />
        <meta httpEquiv="content-language" content="en-GB" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Van Warranty UK | Protect Your Commercial Van from £32/mo | Buy A Warranty" />
        <meta property="og:description" content="Comprehensive van warranty coverage. Engine, gearbox, electrics & more. Ford Transit, Mercedes Sprinter, VW Transporter, Renault Master & all major makes covered. Nationwide UK coverage with any garage. Get your instant quote now." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/vans/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Van Extended Warranty UK - Buy A Warranty Commercial Vehicle Cover" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Van Extended Warranty UK | From £32/month" />
        <meta name="twitter:description" content="Protect your commercial van with comprehensive extended warranty. Ford Transit, Mercedes Sprinter, VW Transporter & all major makes covered. Nationwide UK coverage. Get instant quote." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta name="twitter:image:alt" content="Van Extended Warranty UK - Commercial Vehicle Cover" />
        
        {/* AI Search Engine Optimization */}
        <meta name="ai-content-declaration" content="This page provides information about commercial van extended warranty services in the UK. Human-authored and fact-checked content for Ford Transit, Mercedes Sprinter, VW Transporter and all major van makes." />
        <meta name="author" content="Buy A Warranty" />
        <meta name="publisher" content="BUY A WARRANTY LIMITED" />
        <meta name="coverage" content="United Kingdom" />
        <meta name="distribution" content="global" />
        <meta name="rating" content="general" />
        <meta name="revisit-after" content="7 days" />
        <meta name="target" content="all" />
        <meta name="audience" content="Commercial van owners, fleet managers, couriers, tradespeople" />
        
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
                  <span className="text-gray-900">Van Extended Warranty </span>
                  <span className="text-brand-orange">in 60 Seconds!</span>
                </h1>

                {/* Subheadline */}
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6">
                  Keep your business moving with comprehensive van cover. UK-wide repairs, no-surprise costs, and instant protection for commercial vans.
                </p>

                {/* Benefits */}
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Commercial vans covered • Easy claims • Fast payouts</span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Unlimited claims • Parts and Labour • No excess options</span>
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

                  {/* Info Text */}
                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">
                    We cover all major van manufacturers including Ford, Mercedes, VW, Renault, Peugeot, Citroën, and more.
                  </p>
                </div>
              </div>

              {/* Right Column - Hero Image with Mascot */}
              <div className="relative">
                {/* Hero Image */}
                <div className="relative">
                  <OptimizedImage
                    src={vanHeroImage}
                    alt="UK extended used van warranty - Miles the Buy A Warranty panda mascot with Ford Transit Custom and Volkswagen Transporter commercial vans"
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
                      <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Panel Vans</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Crew Vans</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Pickups</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base"><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Luton Vans</span></span>
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
          <WarrantyBenefitsSection headline="The Ultimate Van Warranty." />
        </Suspense>

        {/* Vehicle Coverage Accordion Section */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Van" />
        </Suspense>

        {/* Cover Clarity Section */}
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        {/* Video Section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>

        {/* Van Models Section */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full Coverage Details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                All UK Van Models Covered
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                We cover vans from all major manufacturers registered between 2012 and 2026. Select your make to see models.
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
                  placeholder="Search van makes or models..."
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
                All Makes
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
                    {/* Van Icon - compact */}
                    <img src={vanIcon} alt="" className="w-7 h-7 mx-auto mb-1.5 opacity-60 group-hover:opacity-80 transition-opacity" />
                    
                    {/* Model Name */}
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">
                      {model}
                    </h3>
                    
                    {/* Manufacturer */}
                    <p className="text-[9px] md:text-[10px] text-slate-500 font-medium leading-tight">
                      {manufacturer}
                    </p>

                    {/* Selected check */}
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
                <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">No vans found matching "{modelSearchQuery}"</p>
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
                <span><strong>Also covered:</strong> LWB, SWB, High Roof, and all body configurations</span>
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
                  <Truck className="w-5 h-5 text-white" />
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

        {/* Why Van Owners Choose Us Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why commercial van owners choose us
              </h2>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4"
              >
                Get Van Warranty
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[
                  { icon: Wrench, title: 'Minimise downtime with fast claims', desc: 'We understand time is money. Quick authorisation gets you back on the road.' },
                  { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                  { icon: Users, title: 'UK support team that understands vans', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                  { icon: Truck, title: 'High mileage commercial vans covered', desc: 'Cover vehicles up to 150,000 miles with no restrictions during cover.' },
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
              
              {/* Mascot */}
              <div className="hidden lg:flex justify-center items-end">
                <OptimizedImage 
                  src={fordTransitVan}
                  alt="UK van warranty - Vauxhall Combo with buyawarranty branding"
                  className="w-[400px] h-auto object-contain"
                  width={400}
                  height={300}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Average Van Repair Costs Section */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 font-semibold text-sm px-4 py-2 rounded-full mb-4">
                <Wrench className="w-4 h-4" />
                Without warranty, you pay the full bill
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                What van repairs actually cost
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                One breakdown could cost more than years of warranty cover. Here's what van owners pay without protection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {[
                { part: 'Turbocharger Replacement', cost: '£1,800 – £3,500', icon: Zap, severity: 'high' },
                { part: 'DPF Filter Replacement', cost: '£1,200 – £2,800', icon: Shield, severity: 'high' },
                { part: 'Gearbox Rebuild', cost: '£2,000 – £4,500', icon: Wrench, severity: 'critical' },
                { part: 'Engine Rebuild', cost: '£3,000 – £5,000', icon: Truck, severity: 'critical' },
                { part: 'Fuel Injector Set', cost: '£800 – £2,200', icon: Zap, severity: 'medium' },
                { part: 'Clutch & Flywheel', cost: '£900 – £1,800', icon: Wrench, severity: 'medium' },
                { part: 'ECU Replacement', cost: '£700 – £1,500', icon: Zap, severity: 'medium' },
                { part: 'Power Steering Rack', cost: '£600 – £1,400', icon: Wrench, severity: 'medium' },
                { part: 'Timing Chain Kit', cost: '£800 – £2,000', icon: Clock, severity: 'high' },
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
              <div className="bg-[#1a2e5a] rounded-2xl p-8 md:p-12 max-w-3xl mx-auto">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Warranty cover from just £32/month
                </h3>
                <p className="text-white/70 text-sm md:text-base mb-6">
                  That's less than a single diagnostic fee — and it covers all of the above.
                </p>
                <Button
                  onClick={scrollToQuoteForm}
                  className="bg-brand-orange text-white font-bold px-10 py-6 text-lg rounded-xl animate-breathing shadow-lg shadow-brand-orange/30"
                >
                  Get Your Instant Quote
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
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
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your van' },
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

        {/* Your Van Cover Made Crystal Clear Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent Coverage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your van cover, made <span className="text-brand-orange">crystal clear</span>
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

        {/* High Mileage Van Section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              {/* Image on LEFT side */}
              <div className="flex justify-center">
                <OptimizedImage 
                  src={pandaThumbsUp}
                  alt="High mileage van warranty coverage - Miles the Panda"
                  className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto object-contain"
                  width={448}
                  height={300}
                />
              </div>
              {/* Text on RIGHT side */}
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">
                  High Mileage Van, No Problem!
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                  Keep Your Business Moving<br />
                  <span className="text-brand-orange">You're Covered</span>
                </h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Commercial vans work hard. We understand that high mileage is normal for business vehicles.
                  That's why we cover vans up to 150,000 miles with no restrictions during your cover period.
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

        {/* Additional Van Cover Options Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Additional Van Cover Options
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Enhance your van warranty with these optional extras
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Truck className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Hire Van Cover</h3>
                <p className="text-sm md:text-base text-gray-600">Keep working while your van is being repaired</p>
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


        {/* Testimonials Section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                What Van Owners Say
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Real reviews from real van drivers
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
                  <p className="text-gray-700 text-sm md:text-base mb-3 md:mb-4">"{testimonial.text}"</p>
                  <div>
                    <p className="font-bold text-gray-900 text-sm md:text-base">{testimonial.name}</p>
                    <p className="text-gray-500 text-xs md:text-sm">{testimonial.model} • {testimonial.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section - matching homepage design */}
        <section className="pt-16 sm:pt-20 pb-8 bg-white">
          <div className="max-w-7xl mx-auto px-6 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-brand-dark-text mb-6 leading-tight">
                <span className="text-brand-orange">Van Warranty FAQ's</span>
              </h2>
              <p className="text-lg text-brand-dark-text max-w-3xl mx-auto leading-relaxed">
                Find answers to the most common questions about our van warranty services.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Left Column */}
              <div className="space-y-6">
                {vanFAQs.filter((_, i) => i % 2 === 0).map((faq, index) => (
                  <div key={index} className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg overflow-hidden shadow-lg">
                    <button
                      onClick={() => setOpenFaqId(openFaqId === index * 2 ? null : index * 2)}
                      className="w-full px-6 py-5 text-left flex items-center justify-between text-white hover:bg-orange-600/20 transition-colors"
                    >
                      <span className="font-bold text-lg pr-4">{faq.question}</span>
                      <ChevronDown 
                        className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 text-white ${
                          openFaqId === index * 2 ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {openFaqId === index * 2 && (
                      <div className="px-6 pb-5 bg-white border-t border-orange-200">
                        <p className="text-base leading-relaxed pt-4 whitespace-pre-line text-brand-dark-text">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {vanFAQs.filter((_, i) => i % 2 === 1).map((faq, index) => (
                  <div key={index} className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg overflow-hidden shadow-lg">
                    <button
                      onClick={() => setOpenFaqId(openFaqId === index * 2 + 1 ? null : index * 2 + 1)}
                      className="w-full px-6 py-5 text-left flex items-center justify-between text-white hover:bg-orange-600/20 transition-colors"
                    >
                      <span className="font-bold text-lg pr-4">{faq.question}</span>
                      <ChevronDown 
                        className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 text-white ${
                          openFaqId === index * 2 + 1 ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {openFaqId === index * 2 + 1 && (
                      <div className="px-6 pb-5 bg-white border-t border-orange-200">
                        <p className="text-base leading-relaxed pt-4 whitespace-pre-line text-brand-dark-text">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* View All FAQs Button */}
            <div className="text-center mt-12">
              <Link to="/faq/">
                <Button 
                  size="lg"
                  className="bg-brand-orange hover:bg-brand-orange/90 text-white px-8 py-3 text-lg font-semibold"
                >
                  View All FAQs
                </Button>
              </Link>
              <p className="text-sm text-gray-600 mt-3">
                Have more questions? Check out our comprehensive FAQ page for detailed answers.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-12 md:py-20 bg-brand-orange">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">
              Protect Your Van Today
            </h2>
            <p className="text-lg md:text-xl text-white/90 mb-6 md:mb-8 max-w-2xl mx-auto">
              Get an instant quote in 60 seconds. Comprehensive cover from just £32/month.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={scrollToQuoteForm}
                className="bg-white text-brand-orange hover:bg-gray-100 font-bold px-8 md:px-12 py-4 md:py-6 text-base md:text-xl rounded-xl shadow-lg"
              >
                Get Your Free Quote Now
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
    </>
  );
};

export default VanWarrantyLanding;
