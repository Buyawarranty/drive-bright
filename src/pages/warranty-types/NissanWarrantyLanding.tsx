import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, ChevronDown, Car, Wrench, Zap, Star, Search, Truck, Battery } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
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

import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import nissanQashqaiHero from '@/assets/nissan-qashqai-extended-warranty-uk.png';
import nissanJukeWarranty from '@/assets/nissan-juke-used-car-warranty.png';
import nissanLeafWarranty from '@/assets/nissan-leaf-ev-warranty.png';

const nissanModelCategories = {
  'Crossover & SUV': { 'Qashqai': ['J11', 'J12'], 'Juke': ['F15', 'F16'], 'X-Trail': ['T32', 'T33'], 'Ariya': ['FE0'] },
  'Hatchback & Saloon': { 'Micra': ['K14'], 'Note': ['E12', 'E13'], 'Pulsar': ['C13'] },
  'Electric': { 'Leaf': ['ZE0', 'ZE1'], 'Ariya': ['FE0'], 'Townstar EV': ['XFK'] },
  'Commercial': { 'Navara': ['D23'], 'NV200': ['M20'], 'NV300': ['X82'], 'Townstar': ['XFK'] },
};
type ModelCategory = keyof typeof nissanModelCategories;

const coverageCategories = [
  { title: 'Engine & Powertrain', icon: Car, items: ['Nissan petrol engine block and cylinder head', 'dCi diesel engine internals and turbocharger', 'DIG-T turbocharged engine components', 'Pistons, rings, and bearings', 'Timing chain and tensioners', 'Oil pump and oil cooler', 'Intake and exhaust manifolds'] },
  { title: 'Transmission & Drivetrain', icon: Wrench, items: ['Xtronic CVT gearbox internals', 'Manual gearbox internals', 'Torque converter', 'All-wheel drive system (X-Trail)', 'Drive shafts and CV joints', 'Differential', 'Clutch actuator (automated models)'] },
  { title: 'Electrical & Electronics', icon: Zap, items: ['ECU and engine control modules', 'NissanConnect infotainment system', 'ProPILOT driver assistance', 'Around View Monitor cameras', 'Electric window motors', 'Central locking and keyless entry', 'Starter motor and alternator'] },
  { title: 'Cooling & Fuel Systems', icon: Shield, items: ['Water pump and thermostat', 'Radiator and expansion tank', 'Fuel pump and injectors', 'High-pressure fuel pump', 'Fuel rail and regulator', 'EGR valve and cooler', 'Oil/coolant heat exchangers'] },
  { title: 'Suspension & Steering', icon: Car, items: ['Power steering pump/rack', 'Electric power steering motor', 'Shock absorbers and struts', 'MacPherson strut suspension', 'Multi-link rear suspension', 'Anti-roll bar links', 'Wheel bearings and hubs'] },
  { title: 'EV & Hybrid Components', icon: Zap, items: ['Electric drive motor (Leaf / Ariya)', 'Power electronics module and inverter', 'DC-DC converter', 'On-board charger', 'Battery management system (BMS)', 'Regenerative braking system', 'e-Pedal / e-POWER system'] },
];

const nissanFAQs = [
  { question: "Is a Nissan extended warranty worth it?", answer: "Yes. Nissan vehicles use Xtronic CVT gearboxes, turbocharged DIG-T engines, and advanced electronics that can be costly to repair. An extended warranty protects you against unexpected bills." },
  { question: "How much does a Nissan extended warranty cost?", answer: "Prices start from £20 a month depending on your model, mileage, and claim limit. Flexible monthly or annual payment options available." },
  { question: "Does the warranty cover the Nissan Leaf and Ariya?", answer: "Yes. We cover EV components including the electric motor, battery management system, power electronics, on-board charger, and regenerative braking system." },
  { question: "Can I use my own garage?", answer: "Yes. Any VAT-registered garage in the UK is accepted — you're not restricted to Nissan dealers." },
  { question: "Is the CVT gearbox covered?", answer: "Yes. Xtronic CVT internals are fully covered. CVT repairs can cost £1,500–£3,000, making warranty cover particularly valuable." },
  { question: "Does the warranty include roadside assistance?", answer: "Yes. Our comprehensive plan includes 24/7 UK-wide roadside assistance and recovery." },
  { question: "Can I get cover after the manufacturer warranty expires?", answer: "Yes. We cover vehicles up to 150,000 miles and 15 years old, even if purchased used." },
  { question: "What is not covered?", answer: "Routine maintenance, wear and tear items, pre-existing faults, and cosmetic damage. Full exclusions are clearly listed in your policy." }
];

const testimonials = [
  { name: "Paul M.", location: "Sheffield", model: "Qashqai", text: "My Qashqai's CVT gearbox failed at 58,000 miles. Repair was £2,200 but **my warranty covered every penny.** Brilliant service.", rating: 5 },
  { name: "Lisa H.", location: "Cardiff", model: "Juke", text: "The turbo on my Juke DIG-T went at 45,000 miles. **Buy A Warranty handled the claim within 48 hours** and paid the garage directly.", rating: 5 },
  { name: "Andrew S.", location: "Aberdeen", model: "Leaf", text: "Finding warranty cover for my Leaf was tricky until I found these guys. **They cover the motor, inverter and all the key EV bits.** Excellent.", rating: 5 },
  { name: "Karen T.", location: "Plymouth", model: "X-Trail", text: "My X-Trail needed a new transfer case for the AWD system. Would have been £1,600. **Warranty paid out in full.** Highly recommend.", rating: 5 },
  { name: "Steve B.", location: "Coventry", model: "Qashqai", text: "Air conditioning compressor failed on my Qashqai in summer. **Claim was approved same day** — couldn't ask for more.", rating: 5 },
  { name: "Jenny W.", location: "Norwich", model: "Micra", text: "My Micra's infotainment system packed up. **£800 repair covered completely.** The process was painless.", rating: 5 }
];

const NissanWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [expandedCoverage, setExpandedCoverage] = useState(false);
  const [activeModelFilter, setActiveModelFilter] = useState<ModelCategory | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  const filteredModels = useMemo(() => {
    const allModels = activeModelFilter === 'All' ? Object.entries(nissanModelCategories).flatMap(([category, models]) => Object.entries(models).map(([model, generations]) => ({ model, generations, category }))) : Object.entries(nissanModelCategories[activeModelFilter]).map(([model, generations]) => ({ model, generations, category: activeModelFilter }));
    if (!modelSearchQuery.trim()) return allModels;
    const query = modelSearchQuery.toLowerCase();
    return allModels.filter(({ model, generations }) => model.toLowerCase().includes(query) || generations.some(gen => gen.toLowerCase().includes(query)));
  }, [activeModelFilter, modelSearchQuery]);

  const formatRegNumber = (value: string) => { const f = value.replace(/\s/g, '').toUpperCase(); return f.length > 3 ? f.slice(0, -3) + ' ' + f.slice(-3) : f; };
  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = formatRegNumber(e.target.value); if (f.length <= 8) setRegNumber(f); };
  const handleMileageSelection = (s: string) => { setMileageSelection(s); setMileage(s === 'under120k' ? '100000' : '130000'); };

  const handleGetQuote = async () => {
    trackButtonClick('nissan_warranty_get_quote', { brand: 'Nissan' });
    if (!regNumber.trim()) { toast({ title: "Registration Required", description: "Please enter your vehicle registration number.", variant: "destructive" }); return; }
    if (!mileage.trim()) { toast({ title: "Mileage Required", description: "Please select your vehicle's mileage.", variant: "destructive" }); return; }
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registrationNumber: regNumber } });
      if (error) throw error;
      if (data?.found && data.manufactureDate) { const age = (Date.now() - new Date(data.manufactureDate).getTime()) / (365.25*24*60*60*1000); if (age > 15) { setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old'); toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" }); setIsLookingUp(false); return; } }
      const vehicleData = data?.found ? { regNumber, mileage, make: data.make || 'NISSAN', model: data.model, fuelType: data.fuelType, transmission: data.transmission, year: data.yearOfManufacture, vehicleType: 'car', manufactureDate: data.manufactureDate } : { regNumber, mileage, vehicleType: 'car' };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } catch { const vd = { regNumber, mileage, vehicleType: 'car' }; saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vd)); saveWithTimestamp('buyawarranty_formData', JSON.stringify(vd)); saveWithTimestamp('buyawarranty_currentStep', '2'); sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname); navigate('/?step=2'); } finally { setIsLookingUp(false); }
  };

  const scrollToQuoteForm = () => { document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const productSchema = { "@context": "https://schema.org", "@type": "Product", "name": "Nissan Extended Warranty UK", "description": "Comprehensive extended warranty for all Nissan models including Qashqai, Juke, X-Trail, Leaf, Ariya, Micra, Note, Navara. CVT gearbox, EV components, DIG-T engines covered.", "brand": { "@type": "Brand", "name": "Buy A Warranty" }, "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": "20", "availability": "https://schema.org/InStock", "url": "https://buyawarranty.co.uk/warranty-types/nissan-warranty/", "priceValidUntil": new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0] }, "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5" }, "category": "Vehicle Extended Warranty" };
  const webPageSchema = { "@context": "https://schema.org", "@type": "WebPage", "name": "Nissan Extended Warranty UK | Buy A Warranty", "description": "Comprehensive Nissan extended warranty from £20/month covering Qashqai, Juke, Leaf and all models. CVT gearbox and 8,000+ components covered.", "url": "https://buyawarranty.co.uk/warranty-types/nissan-warranty/", "lastReviewed": new Date().toISOString().split('T')[0], "reviewedBy": { "@type": "Organization", "name": "Buy A Warranty" }, "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".faq-question"] }, "publisher": { "@type": "Organization", "name": "Buy A Warranty", "legalName": "BUY A WARRANTY LIMITED", "url": "https://buyawarranty.co.uk" } };
  const localBusinessSchema = { "@context": "https://schema.org", "@type": "LocalBusiness", "name": "Buy A Warranty", "description": "UK's trusted Nissan extended warranty provider since 2016.", "url": "https://buyawarranty.co.uk", "telephone": "03302295040", "foundingDate": "2016", "areaServed": { "@type": "Country", "name": "United Kingdom" }, "priceRange": "£18-£60/month", "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5" } };
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": nissanFAQs.map(f => ({ "@type": "Question", "name": f.question, "acceptedAnswer": { "@type": "Answer", "text": f.answer } })) };
  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" }, { "@type": "ListItem", "position": 2, "name": "Warranty Types", "item": "https://buyawarranty.co.uk/warranty-types/" }, { "@type": "ListItem", "position": 3, "name": "Nissan Warranty", "item": "https://buyawarranty.co.uk/warranty-types/nissan-warranty/" }] };

  const renderTestimonialText = (text: string) => { const parts = text.split(/\*\*(.*?)\*\*/); return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part); };

  return (
    <>
      <Helmet>
        <title>Nissan Extended Warranty UK | Qashqai, Juke, Leaf Cover from £20/mo</title>
        <meta name="description" content="Nissan extended warranty from £20/month. Cover Qashqai, Juke, X-Trail, Leaf, Ariya, Micra & all models. CVT gearbox covered. Any UK garage. Instant quote." />
        <meta name="keywords" content="nissan extended warranty, nissan warranty UK, nissan qashqai warranty, nissan juke warranty, nissan leaf warranty, nissan cvt warranty, used nissan warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/nissan-warranty/" />
        <meta property="og:title" content="Nissan Extended Warranty UK | Top-Rated Nissan Cover from £20/mo — Qashqai, Juke, Leaf & CVT Protection" />
        <meta property="og:description" content="Protect your Nissan with comprehensive warranty cover. All models covered. CVT & EV included. 8,000+ components. Any UK garage." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/nissan-warranty/" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Buy A Warranty" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Nissan Extended Warranty UK | From £20/month" />
        <meta name="twitter:description" content="UK's top-rated Nissan warranty. Qashqai, Juke, Leaf & all models. CVT & EV covered. 8,000+ components. Any garage." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta name="twitter:image:alt" content="Nissan Extended Warranty UK - Buy A Warranty" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <main itemScope itemType="https://schema.org/WebPage">
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-6 pb-12 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-4 md:mb-6">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Nissan_logo_2020.svg/800px-Nissan_logo_2020.svg.png" alt="Nissan Logo" className="h-10 md:h-14 w-auto object-contain" width={112} height={56} />
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Nissan Extended Warranty </span>
                  <span className="text-brand-orange">in 60 Seconds!</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6 hero-description">
                  Protect your Nissan with dealer-level repairs, UK-wide cover and no-surprise costs. Get a fixed-price with instant cover.
                </p>
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">From just 65p a day . Easy claims . Fast payouts</span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-medium">Unlimited claims . Parts and Labour . No excess</span>
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
                    <input type="text" value={regNumber} onChange={handleRegChange} placeholder="ENTER REG" className="bg-yellow-400 border-none outline-none text-xl sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/60 px-3 sm:px-4 py-3 uppercase tracking-wider min-w-0" maxLength={8} />
                  </div>
                  <MileageQuickSelect value={mileageSelection} onChange={handleMileageSelection} onAutoSubmit={handleGetQuote} error={vehicleAgeError} isLoading={isLookingUp} isRegValid={regNumber.replace(/\s/g, '').length >= 5} />
                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">
                    Nissan is a registered trademark of Nissan Motor Co., Ltd. We are an independent warranty provider.
                  </p>
                  <TrustCallbackPanel />
                </div>
              </div>
              <div className="relative">
                <div className="relative">
                  <OptimizedImage src={nissanQashqaiHero} alt="Nissan Qashqai front view - Nissan extended warranty UK coverage" className="w-full max-w-md mx-auto h-auto object-contain" priority width={651} height={500} />
                  <div className="absolute top-4 right-4">
                    <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                      <OptimizedImage src={trustpilotExcellent} alt="Trustpilot Excellent Rating" className="h-auto w-28 sm:w-36 object-contain" width={144} height={61} />
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5"><Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Cars</span></div>
                    <div className="flex items-center space-x-1.5"><Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">SUVs</span></div>
                    <div className="flex items-center space-x-1.5"><Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Electric</span></div>
                    <div className="flex items-center space-x-1.5"><Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Commercial</span></div>
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

        <section className="bg-gray-900 py-4"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-white text-sm"><div className="flex items-center gap-2"><Shield className="h-4 w-4 text-green-400" /> 8,000+ Components</div><div className="flex items-center gap-2"><Car className="h-4 w-4 text-blue-400" /> All Nissan Models</div><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-400" /> Any UK Garage</div><div className="flex items-center gap-2"><Phone className="h-4 w-4 text-green-400" /> UK Claims Team</div><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" /> CVT & EV Cover</div></div></div></section>

        <section className="py-12 md:py-16 bg-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center"><div className="space-y-6"><h2 className="text-2xl md:text-3xl font-bold text-gray-900">Why Choose Our Nissan Warranty?</h2><p className="text-gray-600">Nissan vehicles use Xtronic CVT gearboxes, turbocharged DIG-T engines, e-POWER systems, and advanced ProPILOT electronics. These can develop expensive faults after the factory warranty expires, with CVT repairs costing upwards of £2,000.</p><div className="space-y-4">{[{ icon: Shield, title: 'Comprehensive Cover', desc: 'Over 8,000 mechanical and electrical components protected' }, { icon: Wrench, title: 'Any UK Garage', desc: 'Choose any VAT-registered garage — not restricted to Nissan dealers' }, { icon: Zap, title: 'Full EV & CVT Coverage', desc: 'Complete cover for Leaf/Ariya electric drivetrain plus Xtronic CVT' }, { icon: Phone, title: '24/7 Roadside Assistance', desc: 'Breakdown recovery included across the UK' }].map((item, i) => (<div key={i} className="flex gap-4"><div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><item.icon className="h-5 w-5 text-red-600" /></div><div><h3 className="font-semibold text-gray-900">{item.title}</h3><p className="text-sm text-gray-600">{item.desc}</p></div></div>))}</div></div><div className="flex justify-center pt-16"><OptimizedImage src={nissanLeafWarranty} alt="Nissan Leaf electric car warranty UK" className="max-w-[60%] h-auto drop-shadow-xl rounded-xl" width={461} height={307} /></div></div></div></section>

        <BrandRepairCosts brandName="Nissan" monthlyPrice="£20" onGetQuote={scrollToQuoteForm} repairs={[
          { name: 'CVT Gearbox Replacement', cost: '£1,500 – £3,000', icon: 'Wrench', severity: 'critical' },
          { name: 'Turbocharger (DIG-T)', cost: '£1,000 – £2,500', icon: 'Zap', severity: 'high' },
          { name: 'Engine Rebuild', cost: '£2,000 – £4,500', icon: 'Car', severity: 'critical' },
          { name: 'EV Motor (Leaf/Ariya)', cost: '£2,000 – £4,000', icon: 'Zap', severity: 'high' },
          { name: 'DPF Filter Replacement', cost: '£800 – £2,000', icon: 'Shield', severity: 'medium' },
          { name: 'Fuel Injector Set', cost: '£600 – £1,500', icon: 'Wrench', severity: 'medium' },
          { name: 'ProPILOT System', cost: '£700 – £1,800', icon: 'Zap', severity: 'medium' },
          { name: 'Transfer Case (AWD)', cost: '£1,000 – £2,200', icon: 'Wrench', severity: 'high' },
          { name: 'Air Con Compressor', cost: '£500 – £1,200', icon: 'Shield', severity: 'medium' },
        ]} />

        <section className="py-12 md:py-16 bg-gradient-to-br from-gray-50 to-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="text-center mb-8"><h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Nissan Models We Cover</h2><p className="text-gray-600">All models from 2012 to 2026 · Up to 150,000 miles</p></div><div className="flex flex-wrap justify-center gap-2 mb-6">{(['All', ...Object.keys(nissanModelCategories)] as (ModelCategory | 'All')[]).map(cat => (<button key={cat} onClick={() => setActiveModelFilter(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeModelFilter === cat ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{cat}</button>))}</div><div className="max-w-sm mx-auto mb-6"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" value={modelSearchQuery} onChange={e => setModelSearchQuery(e.target.value)} placeholder="Search Nissan models..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm" /></div></div><div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">{filteredModels.map(({ model, generations, category }) => (<button key={`${category}-${model}`} onClick={() => { setSelectedModel(selectedModel === model ? null : model); scrollToQuoteForm(); }} className={`group px-2 py-3 rounded-lg text-center transition-all border ${selectedModel === model ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}><Car className="h-6 w-6 mx-auto mb-1 text-slate-400 group-hover:text-slate-600" strokeWidth={1.25} /><div className="text-[11px] sm:text-xs font-semibold text-gray-900 leading-tight">{model}</div><div className="text-[9px] sm:text-[10px] text-gray-500">{generations.join(' · ')}</div><div className="text-[8px] text-gray-400 mt-0.5">2012–2026</div></button>))}</div>{filteredModels.length === 0 && <p className="text-center text-gray-500 py-8">No models found</p>}<div className="text-center mt-8"><Button onClick={scrollToQuoteForm} className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8 py-3 rounded-xl shadow-lg">Get Your Nissan Quote <ArrowRight className="ml-2 h-5 w-5" /></Button></div></div></section>

        <section className="py-12 md:py-16 bg-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="text-center mb-8"><h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What's Covered on Your Nissan?</h2><p className="text-gray-600">Comprehensive protection for all major Nissan systems</p></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{coverageCategories.slice(0, expandedCoverage ? undefined : 3).map((cat, i) => (<div key={i} className="bg-gray-50 rounded-xl p-6 border border-gray-100"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><cat.icon className="h-5 w-5 text-red-600" /></div><h3 className="font-bold text-gray-900">{cat.title}</h3></div><ul className="space-y-2">{cat.items.map((item, j) => <li key={j} className="flex items-start gap-2 text-sm text-gray-600"><Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />{item}</li>)}</ul></div>))}</div>{!expandedCoverage && <div className="text-center mt-6"><Button variant="outline" onClick={() => setExpandedCoverage(true)} className="gap-2">Show All Coverage <ChevronDown className="h-4 w-4" /></Button></div>}</div></section>

        <section className="py-12 md:py-16 bg-gradient-to-br from-red-50 to-gray-50"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="text-center mb-8"><h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What Nissan Owners Say</h2><div className="flex items-center justify-center gap-2"><div className="flex -space-x-1">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-[#00b67a] text-[#00b67a]" />)}</div><span className="text-sm text-gray-600">Rated Excellent on Trustpilot</span></div></div><div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>{testimonials.map((t, i) => (<div key={i} className="bg-white rounded-xl p-6 shadow-md border border-gray-100"><div className="flex gap-1 mb-3">{[...Array(t.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-[#00b67a] text-[#00b67a]" />)}</div><p className="text-gray-700 text-sm mb-4">"{renderTestimonialText(t.text)}"</p><div><p className="font-semibold text-gray-900 text-sm">{t.name}</p><p className="text-xs text-gray-500">{t.model} · {t.location}</p></div></div>))}</div><div className="text-center mt-6"><a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline text-sm font-medium"><section className="py-12 md:py-16 bg-gradient-to-br from-red-50 to-gray-50"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="text-center mb-8"><h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What Nissan Owners Say</h2><div className="flex items-center justify-center gap-2"><div className="flex -space-x-1">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-[#00b67a] text-[#00b67a]" />)}</div><span className="text-sm text-gray-600">Rated Excellent on Trustpilot</span></div></div><div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>{testimonials.map((t, i) => (<div key={i} className="bg-white rounded-xl p-6 shadow-md border border-gray-100"><div className="flex gap-1 mb-3">{[...Array(t.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-[#00b67a] text-[#00b67a]" />)}</div><p className="text-gray-700 text-sm mb-4">"{renderTestimonialText(t.text)}"</p><div><p className="font-semibold text-gray-900 text-sm">{t.name}</p><p className="text-xs text-gray-500">{t.model} · {t.location}</p></div></div>))}</div><div className="text-center mt-6"><a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline text-sm font-medium">Read more reviews on Trustpilot →</a></div></div></section></a></div></div></section>

        <BrandPageFAQ />
      </main>
      <MinimalLandingFooter />
      <BluePersistentCallback />
    </>
  );
};

export default NissanWarrantyLanding;
