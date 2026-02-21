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
const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));
const VehicleCoverageSection = lazy(() => import('@/components/homepage/VehicleCoverageSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));

// Assets
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import evHeroImage from '@/assets/ev-warranty-hero-electric-vehicle.png';

// UK EV Models covered (grouped by manufacturer) - 2012-2026
const evModelCategories = {
  'Tesla': {
    'Model 3': ['Standard Range Plus', 'Long Range', 'Performance', 'Highland'],
    'Model Y': ['Standard Range', 'Long Range', 'Performance'],
    'Model S': ['Long Range', 'Plaid', '75D', '100D'],
    'Model X': ['Long Range', 'Plaid', '75D', '100D'],
  },
  'Nissan': {
    'Leaf': ['Acenta', 'N-Connecta', 'Tekna', 'e+'],
    'Ariya': ['Advance', 'Evolve', 'Engage', 'e-4ORCE'],
  },
  'BMW': {
    'i3': ['i3', 'i3s', 'i3 120Ah'],
    'i4': ['eDrive35', 'eDrive40', 'M50'],
    'iX': ['xDrive40', 'xDrive50', 'M60'],
    'iX1': ['xDrive30', 'eDrive20'],
    'iX3': ['M Sport', 'Premier Edition'],
  },
  'Hyundai': {
    'Ioniq 5': ['SE Connect', 'Ultimate', 'Namsan', 'N'],
    'Ioniq 6': ['SE Connect', 'Ultimate', 'First Edition'],
    'Kona Electric': ['SE Connect', 'Premium', 'Ultimate'],
  },
  'Kia': {
    'EV6': ['Air', 'GT-Line', 'GT-Line S', 'GT'],
    'EV9': ['Air', 'GT-Line', 'GT-Line S'],
    'Niro EV': ['2', '3', '4'],
    'Soul EV': ['Urban', 'Explore', 'Maxx'],
  },
  'Volkswagen': {
    'ID.3': ['Pure', 'Pro', 'Pro S', 'GTX'],
    'ID.4': ['Pure', 'Pro', 'Pro S', 'GTX'],
    'ID.5': ['Pro', 'Pro S', 'GTX'],
    'ID.7': ['Pro', 'Pro S'],
    'e-Golf': ['SE', 'SE Nav'],
  },
  'Audi': {
    'e-tron': ['50', '55', 'S', 'Sportback'],
    'Q4 e-tron': ['35', '40', '50', 'Sportback'],
    'Q8 e-tron': ['50', '55', 'SQ8'],
    'e-tron GT': ['quattro', 'RS'],
  },
  'Mercedes-Benz': {
    'EQA': ['250', '250+', '300 4MATIC', '350 4MATIC'],
    'EQB': ['250+', '300 4MATIC', '350 4MATIC'],
    'EQC': ['400 4MATIC', 'Edition 1886'],
    'EQS': ['450+', '580 4MATIC', 'AMG'],
    'EQE': ['300', '350+', '500 4MATIC', 'AMG'],
  },
  'MG': {
    'MG4': ['SE', 'Trophy', 'Trophy Extended Range', 'XPOWER'],
    'MG5': ['SE', 'Trophy', 'Long Range'],
    'ZS EV': ['SE', 'Trophy', 'Long Range'],
  },
  'Peugeot': {
    'e-208': ['Active', 'Allure', 'GT'],
    'e-2008': ['Active', 'Allure', 'GT'],
    'e-308': ['Allure', 'GT'],
  },
  'Vauxhall': {
    'Corsa Electric': ['SE', 'SRi', 'GS', 'Ultimate'],
    'Mokka Electric': ['SE', 'SRi', 'GS', 'Ultimate'],
    'Astra Electric': ['Design', 'GS'],
  },
  'Renault': {
    'Zoe': ['Play', 'Iconic', 'GT Line', 'Riviera'],
    'Megane E-Tech': ['Equilibre', 'Techno', 'Iconic'],
    'Scenic E-Tech': ['Esprit Alpine', 'Techno', 'Iconic'],
  },
  'Ford': {
    'Mustang Mach-E': ['Standard Range', 'Extended Range', 'GT'],
    'Explorer Electric': ['Standard Range', 'Extended Range'],
  },
  'Volvo': {
    'XC40 Recharge': ['Single Motor', 'Twin Motor'],
    'C40 Recharge': ['Single Motor', 'Twin Motor'],
    'EX30': ['Single Motor', 'Twin Motor'],
    'EX90': ['Single Motor', 'Twin Motor'],
  },
  'Porsche': {
    'Taycan': ['4S', 'GTS', 'Turbo', 'Turbo S', 'Cross Turismo'],
  },
  'Jaguar': {
    'I-PACE': ['S', 'SE', 'HSE', 'Black'],
  },
  'Mini': {
    'Electric': ['Level 1', 'Level 2', 'Level 3'],
    'Countryman Electric': ['E', 'SE ALL4'],
  },
  'Fiat': {
    '500e': ['Action', 'Passion', 'Icon', 'La Prima'],
  },
  'Škoda': {
    'Enyaq iV': ['60', '80', '80x', 'RS'],
    'Enyaq Coupé iV': ['80', '80x', 'RS'],
  },
  'Cupra': {
    'Born': ['V1', 'V2', 'V3', 'VZ'],
  },
  'BYD': {
    'Atto 3': ['Active', 'Design', 'Comfort', 'Excellence'],
    'Dolphin': ['Active', 'Comfort', 'Design'],
    'Seal': ['Design', 'Excellence', 'Performance'],
  },
  'Polestar': {
    'Polestar 2': ['Standard Range', 'Long Range Single Motor', 'Long Range Dual Motor', 'BST'],
  },
};

type ManufacturerCategory = keyof typeof evModelCategories;

// Coverage components data for EVs
const coverageCategories = [
  {
    title: 'Electric motor & drivetrain',
    icon: Zap,
    items: [
      'Electric motor(s) and inverter',
      'Reduction gearbox',
      'Drive shafts and CV joints',
      'Power electronics module',
      'Motor controller unit',
      'Regenerative braking system',
      'Differential',
    ]
  },
  {
    title: 'Battery & charging systems',
    icon: Battery,
    items: [
      'Battery management system (BMS)',
      'On-board charger unit',
      'DC-DC converter',
      'Charging port and mechanism',
      'High-voltage junction box',
      'Battery cooling system',
      'Thermal management pump',
    ]
  },
  {
    title: 'Electrical & electronics',
    icon: Shield,
    items: [
      'ECU and control modules',
      'Infotainment system',
      'Central locking system',
      'Electric window motors',
      'Instrument cluster / digital dash',
      'Sensors and actuators',
      'Wiring looms',
    ]
  },
  {
    title: 'Cooling & climate',
    icon: Wrench,
    items: [
      'Heat pump system',
      'Battery thermal management',
      'Cabin air conditioning',
      'Coolant pump and valves',
      'Radiator and expansion tank',
      'Climate control module',
      'PTC heater',
    ]
  },
  {
    title: 'Suspension & steering',
    icon: Car,
    items: [
      'Electric power steering rack',
      'Shock absorbers and struts',
      'Control arms and bushings',
      'Wheel bearings and hubs',
      'Anti-roll bar links',
      'Air suspension compressor',
      'Ball joints',
    ]
  },
  {
    title: 'EV-specific systems',
    icon: Battery,
    items: [
      'Brake vacuum pump (electric)',
      'Electric brake booster',
      'Vehicle-to-Load (V2L) system',
      'Pre-conditioning system',
      'Keyless entry and start',
      'Parking sensors and cameras',
      'Adaptive cruise control module',
    ]
  },
];

// FAQs
const evFAQs = [
  {
    question: "Is my electric vehicle too old or high mileage?",
    answer: "We cover electric vehicles up to 15 years old and 150,000 miles. Check your instant price to confirm eligibility."
  },
  {
    question: "Can I use my own garage for EV repairs?",
    answer: "Yes. Any VAT-registered garage is acceptable, including specialist EV garages, or we can recommend an approved repairer."
  },
  {
    question: "What's covered in my EV warranty?",
    answer: "At Buy A Warranty, we keep things simple. One solid plan that covers electric motors, inverters, on-board chargers, power electronics, cooling systems, and thousands of mechanical and electrical components. No confusing packages, no unexpected rejections."
  },
  {
    question: "Is the battery covered?",
    answer: "We cover the battery management system (BMS), battery cooling and thermal management, DC-DC converter, and on-board charger. Battery cell degradation is typically covered by the manufacturer's warranty."
  },
  {
    question: "How do I make a claim?",
    answer: "Arrange for your vehicle to be inspected by a local independent repair garage to diagnose any issues. Once diagnosed, before any repairs are conducted, the repairer must directly contact our Claims Team at 0330 229 5045. Failure to do so will not allow us to process your claim."
  },
  {
    question: "How much does EV warranty cover cost?",
    answer: "Warranty costs start from just £19 per month for electric vehicles, depending on your vehicle and the level of cover you choose. Get an instant quote by entering your registration number above."
  },
  {
    question: "Are hybrid vehicles covered too?",
    answer: "Yes, we cover both fully electric (BEV) and plug-in hybrid (PHEV) vehicles. The same comprehensive cover applies to both drivetrain types."
  },
  {
    question: "Do I need a full service history?",
    answer: "A reasonable service history is fine. Many vehicles are accepted even if servicing has been missed."
  },
  {
    question: "What claim limit is right for me?",
    answer: "It depends on your vehicle and how much protection you want.\n\n£1,000 is ideal for smaller or lower‑cost repairs.\n£2,000 offers broader cover for most mid‑range repairs.\n£3,000 is our most popular option and covers the majority of common faults in full.\n£5,000 provides our highest level of protection and is best suited to newer, higher‑value or more complex vehicles where repair costs can be significantly higher.\n\nEvery plan includes unlimited claims, and you're covered up to the value of your vehicle, whichever limit you choose."
  },
  {
    question: "Are diagnostics covered?",
    answer: "Diagnostics are usually covered when the fault is approved."
  },
  {
    question: "What is the most expensive EV repair you have covered?",
    answer: "We regularly cover repairs over £2,000 for electric motors, inverters, on-board chargers and power electronics. Higher claim limits are available. Check your instant price by entering your registration."
  }
];

// Testimonials
const testimonials = [
  {
    name: "Sarah K.",
    location: "Bristol",
    model: "Tesla Model 3",
    boldLine: "Inverter replaced without any hassle.",
    text: "My Model 3 had a power electronics issue at 45,000 miles. Buy A Warranty covered the full £2,800 repair. Incredibly smooth process.",
    rating: 5
  },
  {
    name: "James W.",
    location: "Edinburgh",
    model: "Hyundai Ioniq 5",
    boldLine: "Claim approved the same day.",
    text: "On-board charger failed on my Ioniq 5. The garage was paid directly and I was back charging at home within the week.",
    rating: 5
  },
  {
    name: "Emma D.",
    location: "Manchester",
    model: "VW ID.4",
    boldLine: "Saved me over £1,500 on the heat pump.",
    text: "The heat pump system went on my ID.4 during winter. Buy A Warranty sorted it quickly and I didn't pay a penny more.",
    rating: 5
  },
  {
    name: "Tom H.",
    location: "Southampton",
    model: "Nissan Leaf",
    boldLine: "Best decision I made when buying my EV.",
    text: "Motor controller issue at 60,000 miles. They covered the full repair without any fuss. Excellent customer service.",
    rating: 5
  },
  {
    name: "Lisa P.",
    location: "Cardiff",
    model: "BMW iX3",
    boldLine: "Professional and fair from start to finish.",
    text: "DC-DC converter needed replacing. The claim was handled brilliantly and the garage was paid within days.",
    rating: 5
  },
  {
    name: "Mark R.",
    location: "Leeds",
    model: "MG4",
    boldLine: "Covered the full £1,200 repair.",
    text: "Charging port mechanism failed on my MG4. I was worried about getting warranty for a newer brand but they covered it without question.",
    rating: 5
  }
];

const EVWarrantyLanding: React.FC = () => {
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
      ? Object.entries(evModelCategories).flatMap(([manufacturer, models]) =>
          Object.entries(models).map(([model, variants]) => ({ model, variants, manufacturer }))
        )
      : Object.entries(evModelCategories[activeManufacturer]).map(([model, variants]) => ({
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
    trackButtonClick('ev_warranty_get_quote', { vehicleType: 'car' });

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
          regNumber,
          mileage,
          make: data.make || 'Unknown',
          model: data.model,
          fuelType: data.fuelType,
          transmission: data.transmission,
          year: data.yearOfManufacture,
          vehicleType: data.vehicleType || 'car',
          manufactureDate: data.manufactureDate
        };

        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
        saveWithTimestamp('buyawarranty_currentStep', '2');
        sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
        navigate('/?step=2');
      } else {
        const vehicleData = {
          regNumber,
          mileage,
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
        regNumber,
        mileage,
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
    "name": "Electric Vehicle Extended Warranty UK",
    "description": "Comprehensive extended warranty coverage for all electric vehicles including Tesla, Nissan Leaf, BMW i-series, Hyundai Ioniq, Kia EV6, VW ID range, and more. Covers electric motors, inverters, on-board chargers, power electronics, cooling systems, and more. Nationwide UK coverage with any VAT-registered garage.",
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
      "price": "29",
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://buyawarranty.co.uk/warranty-types/ev-warranty/",
      "seller": { "@type": "Organization", "name": "Buy A Warranty" },
      "priceSpecification": { "@type": "UnitPriceSpecification", "price": "29", "priceCurrency": "GBP", "unitText": "month", "billingIncrement": 1 }
    },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5", "worstRating": "1" },
    "review": testimonials.map((t, i) => ({
      "@type": "Review",
      "author": { "@type": "Person", "name": t.name },
      "reviewRating": { "@type": "Rating", "ratingValue": t.rating, "bestRating": "5" },
      "reviewBody": t.text,
      "datePublished": new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    })),
    "category": "Electric Vehicle Extended Warranty"
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": evFAQs.map(faq => ({
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
      { "@type": "ListItem", "position": 3, "name": "Electric vehicle warranty", "item": "https://buyawarranty.co.uk/warranty-types/ev-warranty/" }
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Buy A Warranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
    "description": "UK's trusted extended vehicle warranty provider. Protecting cars, vans, electric vehicles, and motorcycles.",
    "foundingDate": "2016",
    "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"],
    "contactPoint": { "@type": "ContactPoint", "telephone": "+44-330-229-5040", "contactType": "customer service", "areaServed": "GB", "availableLanguage": "English" }
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Electric Vehicle Warranty UK — Specialist EV Cover",
    "description": "Protect your electric vehicle with comprehensive extended warranty cover. Tesla, Nissan Leaf, BMW i-series, Hyundai Ioniq, Kia EV6, VW ID range and 20+ EV manufacturers covered. Nationwide UK coverage.",
    "url": "https://buyawarranty.co.uk/warranty-types/ev-warranty/",
    "lastReviewed": new Date().toISOString().split('T')[0],
    "reviewedBy": { "@type": "Organization", "name": "Buy A Warranty" },
    "isPartOf": { "@type": "WebSite", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "about": { "@type": "Thing", "name": "Electric Vehicle Extended Warranty" },
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".faq-question"] },
    "significantLink": "https://www.trustpilot.com/review/buyawarranty.co.uk",
    "publisher": { "@type": "Organization", "name": "Buy A Warranty", "legalName": "BUY A WARRANTY LIMITED", "url": "https://buyawarranty.co.uk" }
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Buy A Warranty",
    "description": "UK's specialist electric vehicle warranty provider. Protecting EVs, cars, vans and motorcycles since 2016.",
    "url": "https://buyawarranty.co.uk",
    "telephone": "+44-330-229-5040",
    "email": "support@buyawarranty.co.uk",
    "foundingDate": "2016",
    "priceRange": "£19-£99/month",
    "address": { "@type": "PostalAddress", "streetAddress": "71-75 Shelton Street", "addressLocality": "London", "addressRegion": "Greater London", "postalCode": "WC2H 9JQ", "addressCountry": "GB" },
    "geo": { "@type": "GeoCoordinates", "latitude": 51.5142, "longitude": -0.1267 },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "openingHoursSpecification": [
      { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "opens": "09:00", "closes": "17:30" }
    ]
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Electric Vehicle Extended Warranty",
    "description": "Comprehensive extended warranty protection for electric vehicles in the UK. Covers electric motors, inverters, on-board chargers, battery management systems, DC-DC converters, heat pumps, and 1,000+ EV-specific components.",
    "provider": { "@type": "Organization", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk" },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "serviceType": "Electric Vehicle Extended Warranty",
    "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": "19", "availability": "https://schema.org/InStock", "url": "https://buyawarranty.co.uk/warranty-types/ev-warranty/" },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "EV Warranty Plans",
      "itemListElement": [
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "EV Warranty - £1,000 Claim Limit" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "EV Warranty - £2,000 Claim Limit" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "EV Warranty - £3,000 Claim Limit" } }
      ]
    }
  };

  return (
    <>
      <Helmet>
        <title>Electric Vehicle Warranty UK | EV Cover from £19/mo | Buy A Warranty</title>
        <meta name="description" content="UK's specialist electric vehicle warranty. Covers Tesla, Nissan Leaf, BMW i-series, Hyundai Ioniq, Kia EV6, VW ID range, MG4, Polestar & 20+ EV makes. Electric motors, inverters, on-board chargers, battery management systems & 1,000+ components. Unlimited claims, any VAT-registered garage. Instant quote in 60 seconds. Plans from £19/month with 14-day money-back guarantee." />
        <meta name="keywords" content="electric vehicle warranty UK, EV warranty, Tesla warranty UK, Nissan Leaf warranty, BMW i3 warranty, BMW iX warranty, Hyundai Ioniq 5 warranty, Kia EV6 warranty, VW ID.3 warranty, VW ID.4 warranty, electric car warranty, EV extended warranty, hybrid vehicle warranty, plug-in hybrid warranty, electric motor warranty, battery management system warranty, on-board charger warranty, inverter warranty, used EV warranty, second hand electric car warranty UK, MG4 warranty, Polestar warranty, BYD warranty, Jaguar I-PACE warranty, Porsche Taycan warranty, EV breakdown cover, electric car repair warranty, EV component cover" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/ev-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large" />

        {/* Author & Publisher */}
        <meta name="author" content="Buy A Warranty" />
        <meta name="publisher" content="BUY A WARRANTY LIMITED" />
        <meta name="copyright" content="Buy A Warranty Limited" />

        {/* Geographic targeting */}
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <meta name="geo.position" content="51.5142;-0.1267" />
        <meta name="ICBM" content="51.5142, -0.1267" />
        <meta httpEquiv="content-language" content="en-GB" />
        <meta name="distribution" content="global" />
        <meta name="coverage" content="United Kingdom" />
        <meta name="target" content="all" />
        <meta name="audience" content="all" />
        <meta name="rating" content="general" />

        {/* AI search engine discoverability */}
        <meta name="ai-content-declaration" content="Human-authored, fact-checked, regularly updated EV warranty information for UK electric vehicle owners" />
        <meta name="ai-summary" content="Buy A Warranty offers specialist electric vehicle extended warranty plans in the UK from £19/month. Covers 20+ EV manufacturers including Tesla, Nissan, BMW, Hyundai, Kia, VW, MG, Polestar, BYD, Porsche, Jaguar, and more. Protection includes electric motors, inverters, on-board chargers, battery management systems, DC-DC converters, heat pumps, and 1,000+ components. Unlimited claims, any VAT-registered garage, 14-day money-back guarantee. Vehicles up to 15 years old and 150,000 miles eligible. Instant online quotes available." />

        {/* Open Graph - unique to this page */}
        <meta property="og:title" content="Electric Vehicle Warranty UK — Specialist EV Cover from £19/mo | Buy A Warranty" />
        <meta property="og:description" content="Protect your Tesla, Nissan, BMW, Hyundai, Kia, VW or any EV with UK's specialist electric vehicle warranty. Motors, inverters, chargers & 1,000+ components covered. Unlimited claims, any garage. Instant quote in 60 seconds." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/ev-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Buy A Warranty - UK Electric Vehicle Warranty Provider - EV Cover from £19 per month" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@buyawarranty" />
        <meta name="twitter:title" content="Electric Vehicle Warranty UK — Specialist EV Cover from £19/mo" />
        <meta name="twitter:description" content="Protect your EV with UK's specialist warranty. Tesla, Nissan, BMW, Hyundai, Kia, VW & 20+ makes covered. Motors, inverters, chargers included. Unlimited claims, any garage. Instant quote." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta name="twitter:image:alt" content="Buy A Warranty - UK Electric Vehicle Warranty Provider" />

        {/* Structured Data */}
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
      </Helmet>

      <main className="min-h-screen bg-white" role="main" itemScope itemType="https://schema.org/WebPage">
        {/* Hero section */}
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-green-50/30 pt-6 pb-12 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              {/* Left column - Content */}
              <div className="text-center lg:text-left">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Electric vehicle warranty </span>
                  <span className="text-brand-orange">in 60 seconds!</span>
                </h1>

                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6">
                  Specialist EV protection for motors, inverters, chargers and thousands of components. UK-wide repairs, no surprises.
                </p>

                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Electric motors, inverters & chargers covered</span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Unlimited claims • Parts and labour • No excess options</span>
                  </div>
                </div>

                {/* Quote form */}
                <div className="max-w-md mx-auto lg:mx-0 space-y-4">
                  {/* Registration input */}
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

                  {/* Mileage quick select */}
                  <MileageQuickSelect
                    value={mileageSelection}
                    onChange={handleMileageSelection}
                    onAutoSubmit={handleGetQuote}
                    error={eligibilityError}
                    isLoading={isLookingUp}
                    isRegValid={regNumber.replace(/\s/g, '').length >= 5}
                  />

                  {/* Trust contact panel */}
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

              {/* Right column - Hero image */}
              <div className="relative">
                <div className="relative">
                  <OptimizedImage
                    src={evHeroImage}
                    alt="Electric vehicle warranty UK - Modern electric car front view"
                    className="w-full h-auto max-w-md mx-auto object-contain"
                    priority={true}
                    width={800}
                    height={608}
                    style={{ border: 'none', boxShadow: 'none' }}
                  />
                  {/* Trustpilot badge */}
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

                {/* Vehicle type tags */}
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5">
                      <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Full electric</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Plug-in hybrid</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">All EV makes</span>
                    </div>
                  </div>

                  {/* Instant activation badge */}
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

        {/* Warranty benefits section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}>
          <WarrantyBenefitsSection headline="The ultimate EV warranty." />
        </Suspense>

        {/* Vehicle coverage accordion section */}
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}>
          <VehicleCoverageSection headingPrefix="Electric vehicle" />
        </Suspense>

        {/* Cover clarity section */}
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}>
          <CoverClaritySection />
        </Suspense>

        {/* Video section */}
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}>
          <VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </Suspense>

        {/* Average EV repair costs section */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 font-semibold text-sm px-4 py-2 rounded-full mb-4">
                <Wrench className="w-4 h-4" />
                Without warranty, you pay the full bill
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                What EV repairs actually cost
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                One breakdown could cost more than years of warranty cover. Here's what EV owners pay without protection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {[
                { part: 'Electric motor replacement', cost: '£2,500 – £5,000', icon: Zap, severity: 'critical' as const },
                { part: 'Inverter replacement', cost: '£1,800 – £4,000', icon: Battery, severity: 'critical' as const },
                { part: 'On-board charger', cost: '£1,200 – £2,500', icon: Zap, severity: 'high' as const },
                { part: 'DC-DC converter', cost: '£800 – £2,000', icon: Battery, severity: 'high' as const },
                { part: 'Heat pump system', cost: '£1,500 – £3,000', icon: Wrench, severity: 'high' as const },
                { part: 'Battery management system', cost: '£1,000 – £2,500', icon: Shield, severity: 'high' as const },
                { part: 'Power electronics module', cost: '£1,200 – £3,500', icon: Zap, severity: 'critical' as const },
                { part: 'Electric power steering', cost: '£600 – £1,400', icon: Wrench, severity: 'medium' as const },
                { part: 'Thermal management pump', cost: '£400 – £1,200', icon: Clock, severity: 'medium' as const },
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
                          <p className={`text-base md:text-lg font-bold ${costColor}`}>{repair.cost}</p>
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

        {/* EV models section */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Full coverage details
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">
                All UK electric vehicle models covered
              </h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                We cover electric and plug-in hybrid vehicles from all major manufacturers registered between 2012 and 2026.
              </p>
            </div>

            {/* Search bar */}
            <div className="max-w-lg mx-auto mb-6 md:mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search EV makes or models..."
                  className="w-full pl-12 pr-4 py-3 md:py-4 rounded-xl border-2 border-slate-200 focus:border-brand-orange focus:ring-0 outline-none text-base md:text-lg transition-colors"
                />
              </div>
            </div>

            {/* Manufacturer filter tabs */}
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
              {(Object.keys(evModelCategories) as ManufacturerCategory[]).map((manufacturer) => (
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
                    <Battery className="w-7 h-7 mx-auto mb-1.5 text-green-500 opacity-60 group-hover:opacity-80 transition-opacity" />
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

            {/* No results */}
            {filteredModels.length === 0 && modelSearchQuery && (
              <div className="text-center py-12">
                <Battery className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">No EVs found matching "{modelSearchQuery}"</p>
                <button onClick={() => setModelSearchQuery('')} className="mt-3 text-blue-600 font-medium hover:underline">
                  Clear search
                </button>
              </div>
            )}

            {/* Bottom info */}
            <div className="mt-8 md:mt-10 text-center">
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 text-xs md:text-sm text-slate-600">
                <Check className="w-4 h-4 text-green-600" />
                <span><strong>Also covered:</strong> BEV, PHEV, and all battery configurations</span>
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

        {/* Why EV owners choose us section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Why electric vehicle owners choose us
              </h2>
              {/* Trustpilot badge */}
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
                  Get EV warranty
                  <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-3 md:gap-6">
              {[
                { icon: Zap, title: 'Specialist EV component cover', desc: 'Motors, inverters, on-board chargers, and power electronics all covered.' },
                { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' },
                { icon: Users, title: 'UK support team that understands EVs', desc: 'Our friendly UK-based team handles claims quickly and fairly.' },
                { icon: Battery, title: 'All EV makes and models covered', desc: 'Tesla, Nissan, BMW, Hyundai, Kia, VW, MG, and many more.' },
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
          </div>
        </section>

        {/* How claims work section */}
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
                { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your EV' },
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

        {/* Crystal clear cover section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                <span className="text-xs md:text-sm font-semibold text-green-700">Transparent coverage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Your EV cover, made <span className="text-brand-orange">crystal clear</span>
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

        {/* Additional EV cover options section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Additional EV cover options
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                Enhance your EV warranty with these optional extras
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <Car className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Hire vehicle cover</h3>
                <p className="text-sm md:text-base text-gray-600">Keep moving while your EV is being repaired</p>
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

        {/* Testimonials section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="flex items-center justify-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-[#00b67a] fill-[#00b67a]" />
                ))}
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
                Real reviews from UK EV owners
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                Trusted by thousands of electric vehicle drivers across the UK
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

        {/* Final CTA section */}
        <section className="py-12 md:py-20 bg-[#1a2e5a]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">
              Protect your electric vehicle today
            </h2>
            <p className="text-lg md:text-xl text-white/90 mb-6 md:mb-8 max-w-2xl mx-auto">
              Get an instant quote in 60 seconds. Comprehensive EV cover with easy claims.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={scrollToQuoteForm}
                className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8 md:px-12 py-4 md:py-6 text-base md:text-xl rounded-xl shadow-lg"
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
      <RequestCallbackModal isOpen={showCallbackModal} onClose={() => setShowCallbackModal(false)} />
    </>
  );
};

export default EVWarrantyLanding;
