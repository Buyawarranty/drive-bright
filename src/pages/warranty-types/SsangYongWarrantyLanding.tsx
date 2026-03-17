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

const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));
const VehicleCoverageSection = lazy(() => import('@/components/homepage/VehicleCoverageSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));

import heroImage from '@/assets/ssangyong-extended-warranty-uk.png';
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';

const brandName = 'SsangYong';
const brandSlug = 'ssangyong-warranty';
const brandMake = 'SsangYong';
const startingPrice = '19';

const modelCategories = {
  'SUV & Crossover': {
    'Korando': ['C200', 'C300'],
    'Rexton': ['Y290', 'Y400', 'Y450'],
    'Tivoli': ['X100', 'X150'],
    'Torres': ['KR10'],
  },
  'Pick-up & Commercial': {
    'Musso': ['Q200', 'Q250'],
    'Musso Grand': ['Q250 Long'],
    'Actyon Sports': ['Q100'],
  },
  'Electric': {
    'Torres EVX': ['Electric'],
  },
};

type ModelCategory = keyof typeof modelCategories;

const faqs = [
  { question: `Is a ${brandName} extended warranty worth it in the UK?`, answer: `Yes, ${brandName} vehicles are rugged and reliable but specialist parts and 4x4 systems can be costly to repair. Our extended warranty protects key components like the engine, gearbox, transfer case, electrics, and more.` },
  { question: `How much does a ${brandName} extended warranty cost?`, answer: `Extended ${brandName} warranty prices start from £${startingPrice} a month. We offer flexible monthly or annual payment options to suit your budget.` },
  { question: `Can I buy a ${brandName} warranty after my original warranty has expired?`, answer: `Yes, you can buy cover even if your ${brandName} is outside its manufacturer warranty or was purchased used. We cover vehicles up to 150,000 miles and 15 years old.` },
  { question: `Can I use my own garage for ${brandName} warranty repairs?`, answer: `Yes, you can choose any VAT-registered garage across the UK. You're not restricted to ${brandName} dealers.` },
  { question: `Does the warranty cover 4x4 and pickup components?`, answer: `Yes, our comprehensive plan covers 4x4 specific components including the transfer case, front and rear differentials, locking hubs, and electronic 4WD systems. Pickup-specific components are also covered.` },
  { question: `Is roadside assistance included?`, answer: `Yes, our comprehensive plan includes 24/7 roadside assistance and recovery anywhere in the UK.` },
  { question: `How do I make a claim on my ${brandName} warranty?`, answer: `Simply call our UK-based claims team or submit a claim online. We aim to authorise repairs quickly. Your garage contacts us directly, and we settle the bill with them.` },
  { question: `What's not covered by the warranty?`, answer: `Routine maintenance, wear and tear items (brake pads, tyres, wiper blades), pre-existing faults, and cosmetic damage are not covered. Our policy documents clearly outline all exclusions.` }
];

const testimonials = [
  { name: "Gary P.", location: "Cumbria", model: "SsangYong Rexton", text: "Automatic gearbox issue covered completely. Would have cost over £3,000. The claims process was straightforward and professional.", rating: 5 },
  { name: "Sarah J.", location: "Devon", model: "SsangYong Korando", text: "Turbo failure sorted within a week. Saved me £2,000. Really glad I took out this warranty.", rating: 5 },
  { name: "Rob M.", location: "Norfolk", model: "SsangYong Musso", text: "Transfer case repair on my Musso was fully covered. Essential for anyone using their vehicle for work.", rating: 5 },
  { name: "Helen C.", location: "Scotland", model: "SsangYong Tivoli", text: "ECU and electrical issue fixed quickly. Great value warranty and excellent customer service.", rating: 5 }
];

const repairs = [
  { name: 'Automatic Gearbox', cost: '£2,000 – £4,500', icon: Wrench, severity: 'critical' },
  { name: 'Transfer Case Rebuild', cost: '£1,500 – £3,000', icon: Car, severity: 'critical' },
  { name: 'Engine Rebuild', cost: '£2,500 – £5,000', icon: Car, severity: 'critical' },
  { name: 'Turbocharger Replacement', cost: '£1,200 – £2,800', icon: Zap, severity: 'high' },
  { name: 'Differential Repair', cost: '£800 – £2,000', icon: Wrench, severity: 'high' },
  { name: 'ECU Replacement', cost: '£500 – £1,500', icon: Zap, severity: 'medium' },
  { name: 'Power Steering Pump', cost: '£400 – £1,000', icon: Car, severity: 'medium' },
  { name: 'Fuel Injector Set', cost: '£500 – £1,200', icon: Wrench, severity: 'high' },
  { name: 'Starter Motor', cost: '£300 – £700', icon: Zap, severity: 'medium' },
];

const SsangYongWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [activeModelFilter, setActiveModelFilter] = useState<ModelCategory | 'All'>('All');
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  const filteredModels = useMemo(() => {
    const allModels = activeModelFilter === 'All'
      ? Object.entries(modelCategories).flatMap(([category, models]) => Object.entries(models).map(([model, generations]) => ({ model, generations, category })))
      : Object.entries(modelCategories[activeModelFilter]).map(([model, generations]) => ({ model, generations, category: activeModelFilter }));
    if (!modelSearchQuery.trim()) return allModels;
    const query = modelSearchQuery.toLowerCase();
    return allModels.filter(({ model, generations }) => model.toLowerCase().includes(query) || generations.some(gen => gen.toLowerCase().includes(query)));
  }, [activeModelFilter, modelSearchQuery]);

  const formatRegNumber = (value: string) => { const formatted = value.replace(/\s/g, '').toUpperCase(); if (formatted.length > 3) return formatted.slice(0, -3) + ' ' + formatted.slice(-3); return formatted; };
  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => { const formatted = formatRegNumber(e.target.value); if (formatted.length <= 8) setRegNumber(formatted); };
  const handleMileageSelection = (selection: string) => { setMileageSelection(selection); if (selection === 'under120k') setMileage('100000'); else if (selection === 'over120k') setMileage('130000'); };

  const handleGetQuote = async () => {
    trackButtonClick(`${brandSlug}_get_quote`, { brand: brandName });
    if (!regNumber.trim()) { toast({ title: "Registration Required", description: "Please enter your vehicle registration number.", variant: "destructive" }); return; }
    if (!mileage.trim()) { toast({ title: "Mileage Required", description: "Please select your vehicle's mileage to continue.", variant: "destructive" }); return; }
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registrationNumber: regNumber } });
      if (error) throw error;
      if (data?.found) {
        const now = new Date();
        if (data.manufactureDate) {
          const manufactureDate = new Date(data.manufactureDate);
          const vehicleAgePrecise = (now.getTime() - manufactureDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          if (vehicleAgePrecise > 15) { setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old'); toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" }); setIsLookingUp(false); return; }
        }
        const vehicleData = { regNumber, mileage, make: data.make || brandMake, model: data.model, fuelType: data.fuelType, transmission: data.transmission, year: data.yearOfManufacture, vehicleType: 'car', manufactureDate: data.manufactureDate };
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
    } finally { setIsLookingUp(false); }
  };

  const scrollToQuoteForm = () => { const hero = document.getElementById('hero-section'); if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const productSchema = { "@context": "https://schema.org", "@type": "Product", "name": `${brandName} Extended Warranty UK`, "description": `Comprehensive extended warranty coverage for all ${brandName} models including Korando, Rexton, Tivoli, Torres, and Musso. Covers engine, gearbox, 4x4 systems, electrical systems, and more. Nationwide UK coverage.`, "brand": { "@type": "Brand", "name": "Buy A Warranty" }, "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": startingPrice, "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], "availability": "https://schema.org/InStock", "url": `https://buyawarranty.co.uk/warranty-types/${brandSlug}/` }, "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5" } };
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(faq => ({ "@type": "Question", "name": faq.question, "acceptedAnswer": { "@type": "Answer", "text": faq.answer } })) };
  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" }, { "@type": "ListItem", "position": 2, "name": "Warranty Types", "item": "https://buyawarranty.co.uk/warranty-types/" }, { "@type": "ListItem", "position": 3, "name": `${brandName} Extended Warranty`, "item": `https://buyawarranty.co.uk/warranty-types/${brandSlug}/` }] };

  return (
    <>
      <Helmet>
        <title>{brandName} Extended Warranty UK | Get Your Instant Quote | Buy A Warranty</title>
        <meta name="description" content={`Protect your ${brandName} with comprehensive extended warranty cover. All models covered including Korando, Rexton, Tivoli, Torres, and Musso. Engine, gearbox, 4x4 systems & more. Nationwide UK coverage. Prices from £${startingPrice}/month.`} />
        <meta name="keywords" content={`${brandName} extended warranty, ${brandName} used car warranty, ${brandName} warranty UK, ${brandName} warranty cost, ${brandName} Rexton warranty, ${brandName} Korando warranty, used ${brandName} warranty`} />
        <link rel="canonical" href={`https://buyawarranty.co.uk/warranty-types/${brandSlug}/`} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="geo.region" content="GB" />
        <meta httpEquiv="content-language" content="en-GB" />
        <meta property="og:title" content={`${brandName} Extended Warranty UK | Instant Quotes from £${startingPrice}/month`} />
        <meta property="og:description" content={`Comprehensive ${brandName} warranty coverage. Engine, gearbox, 4x4 systems & more. All models covered. Nationwide UK coverage.`} />
        <meta property="og:url" content={`https://buyawarranty.co.uk/warranty-types/${brandSlug}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_GB" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <main className="min-h-screen bg-white" role="main">
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-6 pb-12 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              <div className="text-center lg:text-left">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Protect your {brandName}</span><br />
                  <span className="text-brand-orange">in 60 seconds.</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6">Dealer-level warranty. Fixed price. No surprise bills.</p>
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" /><span className="font-medium">From just 60p a day • Easy claims • Fast payouts</span></div>
                  <div className="flex items-center justify-center lg:justify-start"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" /><span className="font-medium">Unlimited claims • Parts and Labour • No excess</span></div>
                </div>
                <div className="mx-auto lg:mx-0 space-y-4">
                  <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black">
                    <div className="bg-blue-600 text-white font-bold px-3 sm:px-4 py-3 flex items-center justify-center min-w-[60px] sm:min-w-[80px]"><div className="flex flex-col items-center"><div className="text-base sm:text-lg leading-tight mb-0.5">🇬🇧</div><div className="text-xs sm:text-sm font-bold leading-none">UK</div></div></div>
                    <input type="text" value={regNumber} onChange={handleRegChange} placeholder="ENTER REG" className="bg-yellow-400 border-none outline-none text-xl sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/60 px-3 sm:px-4 py-3 uppercase tracking-wider min-w-0" maxLength={8} />
                  </div>
                  <MileageQuickSelect value={mileageSelection} onChange={handleMileageSelection} onAutoSubmit={handleGetQuote} error={vehicleAgeError} isLoading={isLookingUp} isRegValid={regNumber.replace(/\s/g, '').length >= 5} />
                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">{brandName} is a registered trademark of KG Mobility. We are an independent warranty provider.</p>
                  <TrustCallbackPanel />
                </div>
              </div>
              <div className="relative">
                <OptimizedImage src={heroImage} alt={`${brandName} extended warranty UK - Professional ${brandName} warranty coverage`} className="w-full h-auto" priority={true} width={651} height={434} />
                <div className="absolute top-4 right-4">
                  <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                    <OptimizedImage src={trustpilotExcellent} alt="Trustpilot Excellent Rating" className="h-auto w-28 sm:w-36 object-contain" width={144} height={61} />
                  </a>
                </div>
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5"><Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">SUVs</span></div>
                    <div className="flex items-center space-x-1.5"><Truck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Pick-ups</span></div>
                  </div>
                  <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 rounded-md px-3 py-1.5 sm:px-3.5 sm:py-2 cursor-pointer"><span className="text-sm font-semibold text-green-700">⚡ Instant cover</span></div></TooltipTrigger><TooltipContent><p>⚡ Cover starts immediately after purchase</p></TooltipContent></Tooltip></TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}><WarrantyBenefitsSection headline={`The Ultimate ${brandName} Warranty.`} /></Suspense>
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}><VehicleCoverageSection headingPrefix={brandName} /></Suspense>
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}><CoverClaritySection /></Suspense>
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}><VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} /></Suspense>

        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4"><Wrench className="w-4 h-4 md:w-5 md:h-5 text-red-600" /><span className="text-xs md:text-sm font-semibold text-red-700">Without warranty, you pay the full bill</span></div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">What {brandName} repairs actually cost</h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">One breakdown could cost more than years of warranty cover.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {repairs.map((repair, index) => {
                const Icon = repair.icon;
                const severityColors = { medium: { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-900' }, high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-brand-orange' }, critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' } };
                const colors = severityColors[repair.severity as keyof typeof severityColors];
                return (<div key={index} className={`${colors.bg} rounded-xl p-4 md:p-5 border ${colors.border} flex items-start gap-3`}><div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-5 h-5 ${colors.text}`} /></div><div><h3 className="font-bold text-gray-900 text-sm md:text-base">{repair.name}</h3><p className={`font-bold text-base md:text-lg ${colors.text}`}>{repair.cost}</p></div></div>);
              })}
            </div>
            <div className="mt-8 md:mt-12 text-center">
              <div className="bg-brand-deep-blue rounded-2xl p-8 md:p-12 max-w-3xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-4">
                  <div className="text-center"><p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Typical repair</p><p className="text-2xl md:text-4xl font-bold text-red-400 line-through decoration-2">£2,000</p></div>
                  <span className="text-lg md:text-xl font-bold text-white/50">vs</span>
                  <div className="text-center"><p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Platinum plan</p><p className="text-2xl md:text-4xl font-bold text-emerald-400">from £{startingPrice}/mo</p></div>
                </div>
                <p className="text-white/70 mb-6 text-sm md:text-base">That's less than a single diagnostic fee — and it covers all of the above.</p>
                <Button onClick={scrollToQuoteForm} className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 md:py-5 px-6 md:px-8 text-base md:text-lg rounded-xl shadow-lg animate-breathing"><span className="flex items-center gap-2">Get my instant quote<ArrowRight className="w-5 h-5" /></span></Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4"><Shield className="w-3.5 h-3.5" />Full Coverage Details</div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">All {brandName} Models Covered</h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">Select your {brandName} model to see tailored warranty options.</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
              {filteredModels.map(({ model, generations, category }) => {
                const isElectric = model === 'Torres EVX';
                return (
                  <button key={model} onClick={() => { setSelectedModel(model); scrollToQuoteForm(); }} className={`group relative bg-white rounded-lg px-2 py-3 md:px-3 md:py-3 text-center border transition-all duration-200 ${selectedModel === model ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-md scale-[1.02]' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
                    {isElectric && <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-2 h-2" />EV</div>}
                    <Car className={`w-6 h-6 mx-auto mb-1.5 transition-colors ${selectedModel === model ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={1.25} />
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate">{brandName} {model}</h3>
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-mono tracking-tight leading-tight">{generations.filter(Boolean).join(' · ')}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Why {brandName} Drivers Choose Us</h2>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4">Get my instant quote<ArrowRight className="w-5 h-5 md:w-6 md:h-6" /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[{ icon: Shield, title: 'Comprehensive Cover', desc: 'Engine, gearbox, 4x4 systems & more' }, { icon: MapPin, title: 'Any UK Garage', desc: 'Choose any VAT-registered garage' }, { icon: Phone, title: 'UK Claims Team', desc: 'Fast, hassle-free claims process' }, { icon: Clock, title: 'Instant Cover', desc: 'Protection starts immediately' }].map((item, i) => (
                <div key={i} className="text-center p-4 md:p-6"><item.icon className="w-8 h-8 md:w-10 md:h-10 text-brand-orange mx-auto mb-3 md:mb-4" /><h3 className="font-bold text-gray-900 text-sm md:text-base mb-1">{item.title}</h3><p className="text-xs md:text-sm text-gray-600">{item.desc}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Buy with confidence</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center"><div className="text-3xl md:text-4xl mb-3 md:mb-4">✅</div><h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">No hidden catches</h3><p className="text-gray-600 text-xs md:text-sm">What you see is what you get</p></div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center"><div className="text-3xl md:text-4xl mb-3 md:mb-4">💰</div><h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">14-day money-back guarantee</h3><p className="text-gray-600 text-xs md:text-sm">Try risk-free</p></div>
              <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center"><div className="text-3xl md:text-4xl mb-3 md:mb-4">⭐</div><h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">94% of claims approved fast</h3><p className="text-gray-600 text-xs md:text-sm">We pay when you need us</p></div>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-16 bg-gradient-to-br from-blue-900 to-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6 text-white">Nationwide UK Coverage</h2>
                <p className="text-base md:text-lg text-white mb-4 md:mb-6">Your {brandName} is covered wherever you drive in the United Kingdom.</p>
                <ul className="space-y-2 md:space-y-3 text-left max-w-md mx-auto md:mx-0">
                  {['Use any VAT-registered garage', `${brandName} dealer or independent garage`, 'Recovery to nearest garage', 'Claims handled by our UK team'].map((item, i) => (<li key={i} className="flex items-center gap-2 md:gap-3"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-400 flex-shrink-0" /><span className="text-sm md:text-base">{item}</span></li>))}
                </ul>
              </div>
              <div className="flex flex-col items-center order-first md:order-last">
                <OptimizedImage src={pandaThumbsUp} alt="Miles the Panda giving thumbs up" className="w-36 sm:w-48 md:w-64 h-auto object-contain mb-3 md:mb-4" width={256} height={256} />
                <div className="inline-block bg-white/10 rounded-xl md:rounded-2xl px-4 md:px-8 py-2 md:py-4 backdrop-blur-sm"><p className="text-sm md:text-xl font-bold text-white">England • Scotland • Wales • N. Ireland</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12"><h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">What {brandName} Owners Say</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                  <div className="flex gap-0.5 md:gap-1 mb-2 md:mb-3">{[...Array(t.rating)].map((_, j) => (<Star key={j} className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 fill-yellow-400" />))}</div>
                  <p className="text-sm md:text-base text-gray-700 mb-3 md:mb-4">"{t.text}"</p>
                  <div className="border-t pt-3 md:pt-4"><p className="font-bold text-gray-900 text-sm md:text-base">{t.name}</p><p className="text-xs md:text-sm text-gray-500">{t.model} • {t.location}</p></div>
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

export default SsangYongWarrantyLanding;
