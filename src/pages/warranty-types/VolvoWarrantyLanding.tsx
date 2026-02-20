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
import volvoXC60Hero from '@/assets/volvo-xc60-extended-warranty-uk.png';
import volvoXC90Warranty from '@/assets/volvo-xc90-used-car-warranty.png';
import volvoXC40EVWarranty from '@/assets/volvo-xc40-ev-warranty.png';

const volvoModelCategories = {
  'SUV & Crossover': { 'XC40': ['Mk1'], 'XC60': ['Mk2'], 'XC90': ['Mk2'], 'EX30': ['Mk1'], 'EX90': ['Mk1'] },
  'Saloon & Estate': { 'S60': ['Mk3'], 'S90': ['Mk2'], 'V60': ['Mk2'], 'V90': ['Mk2'], 'V60 Cross Country': ['Mk2'], 'V90 Cross Country': ['Mk2'] },
  'Electric & Hybrid': { 'XC40 Recharge': ['Mk1'], 'C40 Recharge': ['Mk1'], 'EX30': ['Mk1'], 'EX90': ['Mk1'], 'XC60 T8 PHEV': ['Mk2'], 'XC90 T8 PHEV': ['Mk2'], 'S60 T8 PHEV': ['Mk3'] },
};
type ModelCategory = keyof typeof volvoModelCategories;

const coverageCategories = [
  { title: 'Engine & Powertrain', icon: Car, items: ['Volvo T5/T6 turbocharged petrol engine', 'D4/D5 diesel engine internals and turbo', 'B-series mild hybrid engine components', 'Pistons, rings, and bearings', 'Timing belt/chain and tensioners', 'Oil pump and oil cooler', 'Supercharger (T6 models)'] },
  { title: 'Transmission & Drivetrain', icon: Wrench, items: ['Aisin Warner automatic gearbox', 'Geartronic 8-speed gearbox', 'Torque converter', 'AWD system and Haldex coupling', 'Drive shafts and CV joints', 'Differential (front & rear)', 'PowerShift dual-clutch (older models)'] },
  { title: 'Electrical & Electronics', icon: Zap, items: ['ECU and engine control modules', 'Sensus / Google-based infotainment', 'Pilot Assist driver assistance', 'Digital instrument cluster', 'Electric window motors', 'Central locking and keyless entry', 'Starter motor and alternator'] },
  { title: 'Cooling & Fuel Systems', icon: Shield, items: ['Water pump and thermostat', 'Radiator and expansion tank', 'Fuel pump and injectors', 'High-pressure fuel pump', 'Fuel rail and regulator', 'EGR valve and AdBlue system', 'Oil/coolant heat exchangers'] },
  { title: 'Suspension & Steering', icon: Car, items: ['Power steering pump/rack', 'Electric power steering motor', 'Air suspension (where fitted)', 'Shock absorbers and struts', 'Multi-link front and rear suspension', 'Anti-roll bar links', 'Wheel bearings and hubs'] },
  { title: 'EV & Hybrid Components', icon: Zap, items: ['Electric drive motor (Recharge models)', 'T8 plug-in hybrid powertrain', 'Power electronics and inverter', 'DC-DC converter', 'On-board charger', 'Battery management system', 'Regenerative braking and thermal management'] },
];

const volvoFAQs = [
  { question: "Is a Volvo extended warranty worth it?", answer: "Yes. Volvo vehicles feature advanced turbocharged/supercharged engines, sophisticated AWD systems, air suspension, and EV drivetrains that can be very expensive to repair. A single gearbox repair can cost over £2,500." },
  { question: "How much does a Volvo warranty cost?", answer: "Prices start from £25/month. Get an instant quote for your Volvo model and mileage." },
  { question: "Does the warranty cover the XC40 Recharge and C40 Recharge?", answer: "Yes. We cover all EV components including electric motor, battery management system, power electronics, on-board charger, and thermal management." },
  { question: "Can I use my own garage?", answer: "Yes. Any VAT-registered garage in the UK is accepted — no need to use a Volvo dealer." },
  { question: "Is the T8 plug-in hybrid system covered?", answer: "Yes. T8 PHEV components including the electric motor, power electronics, and hybrid control module are fully covered." },
  { question: "Is air suspension covered?", answer: "Yes. Air suspension struts and compressor are covered under our comprehensive plan." },
  { question: "Does the warranty include roadside assistance?", answer: "Yes. 24/7 UK-wide roadside assistance and recovery included." },
  { question: "What is not covered?", answer: "Routine maintenance, wear and tear items, pre-existing faults, and cosmetic damage. Full exclusions clearly listed in your policy." }
];

const testimonials = [
  { name: "Jonathan R.", location: "Oxford", model: "XC60", text: "My XC60's automatic gearbox developed a fault at 55,000 miles. The repair was £2,800 but **my warranty covered the entire bill.** Exceptional service.", rating: 5 },
  { name: "Catherine B.", location: "Harrogate", model: "XC90", text: "Air suspension failure on my XC90 — **£1,900 repair covered without any fuss.** The claims team were brilliant.", rating: 5 },
  { name: "Ian D.", location: "Cambridge", model: "XC40 Recharge", text: "Finding EV warranty cover for my XC40 Recharge was difficult until I found Buy A Warranty. **They cover the motor, inverter and all the key EV bits.**", rating: 5 },
  { name: "Laura G.", location: "Chester", model: "V60", text: "Turbo failure on my V60 D4. **£2,100 claim paid within a week.** Couldn't be happier with the service.", rating: 5 },
  { name: "Neil F.", location: "Brighton", model: "S60", text: "My S60's infotainment system packed up. **£1,200 repair covered in full.** The process couldn't have been easier.", rating: 5 },
  { name: "Amanda K.", location: "Derby", model: "XC90 T8", text: "T8 hybrid system issue on my XC90. Would have cost a fortune at a dealer. **Warranty covered the lot** and I used my local garage.", rating: 5 }
];

const VolvoWarrantyLanding: React.FC = () => {
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
    const allModels = activeModelFilter === 'All' ? Object.entries(volvoModelCategories).flatMap(([category, models]) => Object.entries(models).map(([model, generations]) => ({ model, generations, category }))) : Object.entries(volvoModelCategories[activeModelFilter]).map(([model, generations]) => ({ model, generations, category: activeModelFilter }));
    if (!modelSearchQuery.trim()) return allModels;
    const q = modelSearchQuery.toLowerCase();
    return allModels.filter(({ model, generations }) => model.toLowerCase().includes(q) || generations.some(g => g.toLowerCase().includes(q)));
  }, [activeModelFilter, modelSearchQuery]);

  const formatRegNumber = (v: string) => { const f = v.replace(/\s/g, '').toUpperCase(); return f.length > 3 ? f.slice(0, -3) + ' ' + f.slice(-3) : f; };
  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = formatRegNumber(e.target.value); if (f.length <= 8) setRegNumber(f); };
  const handleMileageSelection = (s: string) => { setMileageSelection(s); setMileage(s === 'under120k' ? '100000' : '130000'); };

  const handleGetQuote = async () => {
    trackButtonClick('volvo_warranty_get_quote', { brand: 'Volvo' });
    if (!regNumber.trim()) { toast({ title: "Registration Required", description: "Please enter your vehicle registration number.", variant: "destructive" }); return; }
    if (!mileage.trim()) { toast({ title: "Mileage Required", description: "Please select your vehicle's mileage.", variant: "destructive" }); return; }
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registrationNumber: regNumber } });
      if (error) throw error;
      if (data?.found && data.manufactureDate) { const age = (Date.now() - new Date(data.manufactureDate).getTime()) / (365.25*24*60*60*1000); if (age > 15) { setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old'); toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" }); setIsLookingUp(false); return; } }
      const vehicleData = data?.found ? { regNumber, mileage, make: data.make || 'VOLVO', model: data.model, fuelType: data.fuelType, transmission: data.transmission, year: data.yearOfManufacture, vehicleType: 'car', manufactureDate: data.manufactureDate } : { regNumber, mileage, vehicleType: 'car' };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData)); saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData)); saveWithTimestamp('buyawarranty_currentStep', '2'); sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname); navigate('/?step=2');
    } catch { const vd = { regNumber, mileage, vehicleType: 'car' }; saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vd)); saveWithTimestamp('buyawarranty_formData', JSON.stringify(vd)); saveWithTimestamp('buyawarranty_currentStep', '2'); sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname); navigate('/?step=2'); } finally { setIsLookingUp(false); }
  };

  const scrollToQuoteForm = () => { document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const productSchema = { "@context": "https://schema.org", "@type": "Product", "name": "Volvo Extended Warranty UK", "description": "Comprehensive extended warranty for Volvo models including XC40, XC60, XC90, S60, V60, V90, S90, XC40 Recharge, C40 Recharge, EX30, EX90. T8 hybrid, AWD, air suspension, EV components covered.", "brand": { "@type": "Brand", "name": "Buy A Warranty" }, "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": "25", "availability": "https://schema.org/InStock", "url": "https://buyawarranty.co.uk/warranty-types/volvo-warranty/", "priceValidUntil": new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0] }, "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5" }, "category": "Vehicle Extended Warranty" };
  const webPageSchema = { "@context": "https://schema.org", "@type": "WebPage", "name": "Volvo Extended Warranty UK | Buy A Warranty", "description": "Comprehensive Volvo extended warranty from £25/month covering XC40, XC60, XC90 and all models. AWD, T8 hybrid & air suspension covered.", "url": "https://buyawarranty.co.uk/warranty-types/volvo-warranty/", "lastReviewed": new Date().toISOString().split('T')[0], "reviewedBy": { "@type": "Organization", "name": "Buy A Warranty" }, "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".faq-question"] }, "publisher": { "@type": "Organization", "name": "Buy A Warranty", "legalName": "BUY A WARRANTY LIMITED", "url": "https://buyawarranty.co.uk" } };
  const localBusinessSchema = { "@context": "https://schema.org", "@type": "LocalBusiness", "name": "Buy A Warranty", "description": "UK's trusted Volvo extended warranty provider since 2016.", "url": "https://buyawarranty.co.uk", "telephone": "03302295040", "foundingDate": "2016", "areaServed": { "@type": "Country", "name": "United Kingdom" }, "priceRange": "£18-£60/month", "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5" } };
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": volvoFAQs.map(f => ({ "@type": "Question", "name": f.question, "acceptedAnswer": { "@type": "Answer", "text": f.answer } })) };
  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" }, { "@type": "ListItem", "position": 2, "name": "Warranty Types", "item": "https://buyawarranty.co.uk/warranty-types/" }, { "@type": "ListItem", "position": 3, "name": "Volvo Warranty", "item": "https://buyawarranty.co.uk/warranty-types/volvo-warranty/" }] };
  const renderTestimonialText = (text: string) => { const parts = text.split(/\*\*(.*?)\*\*/); return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part); };

  return (
    <>
      <Helmet>
        <title>Volvo Extended Warranty UK | XC60, XC90, XC40 Cover from £25/mo</title>
        <meta name="description" content="Volvo extended warranty from £25/month. Cover XC40, XC60, XC90, S60, V60, V90, XC40 Recharge, C40 Recharge & all models. AWD, T8 hybrid & air suspension covered. Any UK garage." />
        <meta name="keywords" content="volvo extended warranty, volvo warranty UK, volvo xc60 warranty, volvo xc90 warranty, volvo xc40 warranty, volvo recharge warranty, volvo electric warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/volvo-warranty/" />
        <meta property="og:title" content="Volvo Extended Warranty UK | Top-Rated Cover from £25/mo — XC60, XC90, XC40 Recharge & T8 Protection" />
        <meta property="og:description" content="Protect your Volvo with the UK's top-rated extended warranty. AWD, T8 hybrid & air suspension covered. 8,000+ components. Any UK garage." />
        <meta property="og:type" content="website" /><meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/volvo-warranty/" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Buy A Warranty" /><meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Volvo Extended Warranty UK | From £25/month" />
        <meta name="twitter:description" content="UK's top-rated Volvo warranty. XC40, XC60, XC90 & all models. AWD & T8 hybrid covered. 8,000+ components. Any garage." />
        <meta name="twitter:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta name="twitter:image:alt" content="Volvo Extended Warranty UK - Buy A Warranty" />
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
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Volvo_Cars_Logo.svg/800px-Volvo_Cars_Logo.svg.png" alt="Volvo Logo" className="h-10 md:h-14 w-auto object-contain" width={112} height={56} />
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Volvo Extended Warranty </span>
                  <span className="text-brand-orange">in 60 Seconds!</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6 hero-description">
                  Protect your Volvo with dealer-level repairs, UK-wide cover and no-surprise costs. Get a fixed-price with instant cover.
                </p>
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
                    Volvo is a registered trademark of Volvo Car Corporation. We are an independent warranty provider.
                  </p>
                  <TrustCallbackPanel />
                </div>
              </div>
              <div className="relative">
                <div className="relative">
                  <OptimizedImage src={volvoXC60Hero} alt="Volvo XC60 front view - Volvo extended warranty UK coverage" className="w-full max-w-md mx-auto h-auto object-contain" priority width={651} height={500} />
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
                    <div className="flex items-center space-x-1.5"><Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Hybrid</span></div>
                    <div className="flex items-center space-x-1.5"><Battery className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">EV</span></div>
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

        <section className="bg-gray-900 py-4"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-white text-sm"><div className="flex items-center gap-2"><Shield className="h-4 w-4 text-green-400" /> 8,000+ Components</div><div className="flex items-center gap-2"><Car className="h-4 w-4 text-blue-400" /> All Volvo Models</div><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-400" /> Any UK Garage</div><div className="flex items-center gap-2"><Phone className="h-4 w-4 text-green-400" /> UK Claims Team</div><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" /> AWD & EV Cover</div></div></div></section>

        <section className="py-12 md:py-16 bg-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center"><div className="space-y-6"><h2 className="text-2xl md:text-3xl font-bold text-gray-900">Why Choose Our Volvo Warranty?</h2><p className="text-gray-600">Volvo vehicles use advanced turbocharged and supercharged engines, sophisticated AWD systems, air suspension, and EV/PHEV drivetrains. These can develop very costly faults once the manufacturer warranty ends, with gearbox repairs alone costing over £2,500.</p><div className="space-y-4">{[{ icon: Shield, title: 'Comprehensive Cover', desc: 'Over 8,000 components protected on every plan' }, { icon: Wrench, title: 'Any UK Garage', desc: 'Choose any VAT-registered garage — not restricted to Volvo dealers' }, { icon: Zap, title: 'Full EV & T8 Coverage', desc: 'Complete cover for Recharge electric drivetrain and T8 PHEV' }, { icon: Phone, title: '24/7 Roadside Assistance', desc: 'Breakdown recovery included across the UK' }].map((item, i) => (<div key={i} className="flex gap-4"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><item.icon className="h-5 w-5 text-blue-700" /></div><div><h3 className="font-semibold text-gray-900">{item.title}</h3><p className="text-sm text-gray-600">{item.desc}</p></div></div>))}</div></div><div className="flex justify-center pt-16"><OptimizedImage src={volvoXC40EVWarranty} alt="Volvo XC40 Recharge electric car warranty UK" className="max-w-[60%] h-auto drop-shadow-xl rounded-xl" width={461} height={307} /></div></div></div></section>

        <BrandRepairCosts brandName="Volvo" monthlyPrice="£25" onGetQuote={scrollToQuoteForm} repairs={[
          { name: 'Automatic Gearbox Repair', cost: '£1,800 – £3,500', icon: 'Wrench', severity: 'critical' },
          { name: 'Turbocharger/Supercharger', cost: '£1,500 – £3,000', icon: 'Zap', severity: 'critical' },
          { name: 'Engine Rebuild', cost: '£3,000 – £6,000', icon: 'Car', severity: 'critical' },
          { name: 'Air Suspension Strut', cost: '£1,000 – £2,500', icon: 'Car', severity: 'high' },
          { name: 'AWD System / Haldex', cost: '£1,200 – £2,800', icon: 'Wrench', severity: 'high' },
          { name: 'T8 Hybrid Motor', cost: '£2,000 – £4,500', icon: 'Zap', severity: 'high' },
          { name: 'Sensus Infotainment', cost: '£800 – £1,800', icon: 'Zap', severity: 'medium' },
          { name: 'DPF Filter Replacement', cost: '£900 – £2,200', icon: 'Shield', severity: 'medium' },
          { name: 'Fuel Injector Set', cost: '£700 – £1,600', icon: 'Wrench', severity: 'medium' },
        ]} />

        <section className="py-12 md:py-16 bg-gradient-to-br from-gray-50 to-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="text-center mb-8"><h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Volvo Models We Cover</h2><p className="text-gray-600">All models from 2012 to 2026 · Up to 150,000 miles</p></div><div className="flex flex-wrap justify-center gap-2 mb-6">{(['All', ...Object.keys(volvoModelCategories)] as (ModelCategory | 'All')[]).map(cat => (<button key={cat} onClick={() => setActiveModelFilter(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeModelFilter === cat ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{cat}</button>))}</div><div className="max-w-sm mx-auto mb-6"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" value={modelSearchQuery} onChange={e => setModelSearchQuery(e.target.value)} placeholder="Search Volvo models..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm" /></div></div><div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">{filteredModels.map(({ model, generations, category }) => (<button key={`${category}-${model}`} onClick={() => { setSelectedModel(selectedModel === model ? null : model); scrollToQuoteForm(); }} className={`group px-2 py-3 rounded-lg text-center transition-all border ${selectedModel === model ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}><Car className="h-6 w-6 mx-auto mb-1 text-slate-400 group-hover:text-slate-600" strokeWidth={1.25} /><div className="text-[11px] sm:text-xs font-semibold text-gray-900 leading-tight">{model}</div><div className="text-[9px] sm:text-[10px] text-gray-500">{generations.join(' · ')}</div><div className="text-[8px] text-gray-400 mt-0.5">2012–2026</div></button>))}</div>{filteredModels.length === 0 && <p className="text-center text-gray-500 py-8">No models found</p>}<div className="text-center mt-8"><Button onClick={scrollToQuoteForm} className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8 py-3 rounded-xl shadow-lg">Get Your Volvo Quote <ArrowRight className="ml-2 h-5 w-5" /></Button></div></div></section>

        <section className="py-12 md:py-16 bg-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="text-center mb-8"><h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What's Covered on Your Volvo?</h2><p className="text-gray-600">Comprehensive protection for all major Volvo systems</p></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{coverageCategories.slice(0, expandedCoverage ? undefined : 3).map((cat, i) => (<div key={i} className="bg-gray-50 rounded-xl p-6 border border-gray-100"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><cat.icon className="h-5 w-5 text-blue-700" /></div><h3 className="font-bold text-gray-900">{cat.title}</h3></div><ul className="space-y-2">{cat.items.map((item, j) => <li key={j} className="flex items-start gap-2 text-sm text-gray-600"><Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />{item}</li>)}</ul></div>))}</div>{!expandedCoverage && <div className="text-center mt-6"><Button variant="outline" onClick={() => setExpandedCoverage(true)} className="gap-2">Show All Coverage <ChevronDown className="h-4 w-4" /></Button></div>}</div></section>

        <section className="py-12 md:py-16 bg-gradient-to-br from-blue-50 to-slate-50"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="text-center mb-8"><h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What Volvo Owners Say</h2><div className="flex items-center justify-center gap-2"><div className="flex -space-x-1">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-[#00b67a] text-[#00b67a]" />)}</div><span className="text-sm text-gray-600">Rated Excellent on Trustpilot</span></div></div><div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>{testimonials.map((t, i) => (<div key={i} className="bg-white rounded-xl p-6 shadow-md border border-gray-100"><div className="flex gap-1 mb-3">{[...Array(t.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-[#00b67a] text-[#00b67a]" />)}</div><p className="text-gray-700 text-sm mb-4">"{renderTestimonialText(t.text)}"</p><div><p className="font-semibold text-gray-900 text-sm">{t.name}</p><p className="text-xs text-gray-500">{t.model} · {t.location}</p></div></div>))}</div><div className="text-center mt-6"><a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline text-sm font-medium"><section className="py-12 md:py-16 bg-gradient-to-br from-blue-50 to-slate-50"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="text-center mb-8"><h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What Volvo Owners Say</h2><div className="flex items-center justify-center gap-2"><div className="flex -space-x-1">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-[#00b67a] text-[#00b67a]" />)}</div><span className="text-sm text-gray-600">Rated Excellent on Trustpilot</span></div></div><div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>{testimonials.map((t, i) => (<div key={i} className="bg-white rounded-xl p-6 shadow-md border border-gray-100"><div className="flex gap-1 mb-3">{[...Array(t.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-[#00b67a] text-[#00b67a]" />)}</div><p className="text-gray-700 text-sm mb-4">"{renderTestimonialText(t.text)}"</p><div><p className="font-semibold text-gray-900 text-sm">{t.name}</p><p className="text-xs text-gray-500">{t.model} · {t.location}</p></div></div>))}</div><div className="text-center mt-6"><a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline text-sm font-medium">Read more reviews on Trustpilot →</a></div></div></section></a></div></div></section>

        <BrandPageFAQ />
      </main>
      <MinimalLandingFooter />
      <BluePersistentCallback />
    </>
  );
};

export default VolvoWarrantyLanding;
