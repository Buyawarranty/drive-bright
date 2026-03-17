import React, { useState, lazy, Suspense, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Shield, Phone, MapPin, Clock, Car, Wrench, Zap, Star, Battery, Bike, Truck, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
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

import heroImage from '@/assets/cadillac-extended-warranty-uk.png';
import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';

const brandName = 'Cadillac';
const brandSlug = 'cadillac-warranty';
const brandMake = 'CADILLAC';
const startingPrice = '19';

const modelCategories = {
  'SUVs': { 'Escalade': ['GMT K2XL'], 'XT4': ['E2UL'], 'XT5': ['C1UL'], 'XT6': ['C1UL'] },
  'Saloons': { 'CT4': ['A2LL'], 'CT5': ['A2LL'] },
  'Performance': { 'CT5-V': ['A2LL'], 'Escalade-V': ['GMT K2XL'] },
};

type ModelCategory = keyof typeof modelCategories;

const faqs = [
  { question: "Is a Cadillac extended warranty worth it?", answer: "Absolutely. Cadillacs are luxury American vehicles with complex systems. An engine or transmission failure can cost £3,000–£8,000. Our warranty protects you from unexpected bills at a fraction of the cost." },
  { question: "How much does a Cadillac extended warranty cost?", answer: `Cadillac warranty prices start from £${startingPrice}/month depending on model, mileage, and claim limit. Flexible monthly or annual payments available.` },
  { question: "Can I get cover after my Cadillac dealer warranty expires?", answer: "Yes, we cover vehicles up to 150,000 miles and 15 years old, even after manufacturer warranty has expired." },
  { question: "Can I use my own garage?", answer: "Yes, any VAT-registered garage in the UK, including Cadillac specialists and independent garages." },
  { question: "Is the Cadillac Escalade covered?", answer: "Yes, we cover all Escalade variants including the full V8 engine, air suspension, 4WD system, and all electronic components." },
  { question: "Are imported Cadillacs covered?", answer: "Yes, we cover UK-registered Cadillacs regardless of where they were originally purchased, subject to standard eligibility checks." },
  { question: "How do I make a claim?", answer: "Call our UK claims team or submit online. We aim to authorise quickly — your garage contacts us directly and we settle the bill." },
  { question: "What's not covered?", answer: "Routine maintenance, wear and tear items, pre-existing faults, and cosmetic damage. Full exclusions are clearly listed in your policy." }
];

const testimonials = [
  { name: "Richard P.", location: "London", model: "Cadillac Escalade", text: "Air suspension system fully covered — would have been £4,500 out of pocket. Exceptional service!", rating: 5 },
  { name: "Michael J.", location: "Essex", model: "Cadillac CT5", text: "Transmission issue sorted quickly. £3,200 claim paid without any fuss. Outstanding warranty.", rating: 5 },
  { name: "Sandra K.", location: "Surrey", model: "Cadillac XT5", text: "ECU and sensor package replaced — fully covered. Saved me over £2,800. Highly recommend.", rating: 5 },
  { name: "Brian L.", location: "Hertfordshire", model: "Cadillac Escalade", text: "V8 engine issue covered completely. The claims process was smooth and professional.", rating: 5 }
];

const repairs = [
  { name: 'V8 Engine Overhaul', cost: '£3,500 – £8,000', icon: Wrench, severity: 'critical' as const },
  { name: 'Automatic Transmission', cost: '£2,500 – £5,500', icon: Wrench, severity: 'critical' as const },
  { name: 'Air Suspension System', cost: '£2,000 – £4,500', icon: Car, severity: 'critical' as const },
  { name: 'Magnetic Ride Control', cost: '£1,500 – £3,500', icon: Car, severity: 'high' as const },
  { name: 'ECU & Electronics', cost: '£1,200 – £3,000', icon: Zap, severity: 'high' as const },
  { name: 'Supercharger (V-Series)', cost: '£2,000 – £5,000', icon: Zap, severity: 'critical' as const },
  { name: '4WD Transfer Case', cost: '£1,500 – £3,500', icon: Car, severity: 'high' as const },
  { name: 'Power Steering Rack', cost: '£900 – £2,200', icon: Wrench, severity: 'medium' as const },
  { name: 'Catalytic Converter Set', cost: '£1,800 – £4,000', icon: Wrench, severity: 'high' as const },
];

const CadillacWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const formatRegNumber = (value: string) => { const f = value.replace(/\s/g, '').toUpperCase(); return f.length > 3 ? f.slice(0, -3) + ' ' + f.slice(-3) : f; };
  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = formatRegNumber(e.target.value); if (f.length <= 8) setRegNumber(f); };
  const handleMileageSelection = (s: string) => { setMileageSelection(s); setMileage(s === 'under120k' ? '100000' : '130000'); };

  const handleGetQuote = async () => {
    trackButtonClick(`${brandSlug}_get_quote`, { brand: brandName });
    if (!regNumber.trim()) { toast({ title: "Registration Required", description: "Please enter your vehicle registration number.", variant: "destructive" }); return; }
    if (!mileage.trim()) { toast({ title: "Mileage Required", description: "Please select your vehicle's mileage.", variant: "destructive" }); return; }
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registrationNumber: regNumber } });
      if (error) throw error;
      if (data?.found && data.manufactureDate) {
        const age = (Date.now() - new Date(data.manufactureDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age > 15) { setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old'); toast({ title: "Vehicle Not Eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" }); setIsLookingUp(false); return; }
      }
      const vehicleData = { regNumber, mileage, make: data?.found ? (data.make || brandMake) : undefined, model: data?.found ? data.model : undefined, fuelType: data?.found ? data.fuelType : undefined, transmission: data?.found ? data.transmission : undefined, year: data?.found ? data.yearOfManufacture : undefined, vehicleType: 'car', manufactureDate: data?.found ? data.manufactureDate : undefined };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } catch (err) {
      console.error('Vehicle lookup error:', err);
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify({ regNumber, mileage, vehicleType: 'car' }));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify({ regNumber, mileage, vehicleType: 'car' }));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } finally { setIsLookingUp(false); }
  };

  const scrollToQuoteForm = () => { document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const productSchema = { "@context": "https://schema.org", "@type": "Product", "name": `${brandName} Extended Warranty UK`, "description": `Comprehensive extended warranty for all ${brandName} models including Escalade, CT5, XT5, and XT4.`, "brand": { "@type": "Brand", "name": "Buy A Warranty" }, "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": startingPrice, "availability": "https://schema.org/InStock", "url": `https://buyawarranty.co.uk/warranty-types/${brandSlug}/` }, "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847" } };
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(f => ({ "@type": "Question", "name": f.question, "acceptedAnswer": { "@type": "Answer", "text": f.answer } })) };
  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" }, { "@type": "ListItem", "position": 2, "name": "Warranty Types", "item": "https://buyawarranty.co.uk/warranty-types/" }, { "@type": "ListItem", "position": 3, "name": `${brandName} Extended Warranty`, "item": `https://buyawarranty.co.uk/warranty-types/${brandSlug}/` }] };

  return (
    <>
      <Helmet>
        <title>{brandName} Extended Warranty UK | Get Your Instant Quote | Buy A Warranty</title>
        <meta name="description" content={`Protect your ${brandName} with comprehensive extended warranty cover. Escalade, CT5, XT5, XT4 covered. Engine, transmission, air suspension & more. Nationwide UK coverage. From £${startingPrice}/month.`} />
        <meta name="keywords" content="Cadillac extended warranty, Cadillac warranty UK, Cadillac Escalade warranty, Cadillac CT5 warranty, Cadillac XT5 warranty, used Cadillac warranty" />
        <link rel="canonical" href={`https://buyawarranty.co.uk/warranty-types/${brandSlug}/`} />
        <meta name="robots" content="index, follow" />
        <meta name="geo.region" content="GB" />
        <meta httpEquiv="content-language" content="en-GB" />
        <meta property="og:title" content={`${brandName} Extended Warranty UK | From £${startingPrice}/month`} />
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
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4"><span className="text-gray-900">Protect your {brandName}</span><br /><span className="text-brand-orange">in 60 seconds.</span></h1>
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6">Dealer-level warranty. Fixed price. No surprise bills.</p>
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5">
                  <div className="flex items-center justify-center lg:justify-start"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-2 flex-shrink-0" /><span className="font-medium">From £{startingPrice}/month • Easy claims • Fast payouts</span></div>
                  <div className="flex items-center justify-center lg:justify-start"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-2 flex-shrink-0" /><span className="font-medium">Unlimited claims • Parts and Labour • No excess</span></div>
                </div>
                <div className="mx-auto lg:mx-0 space-y-4">
                  <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black">
                    <div className="bg-blue-600 text-white font-bold px-3 sm:px-4 py-3 flex items-center justify-center min-w-[60px] sm:min-w-[80px]"><div className="flex flex-col items-center"><div className="text-base sm:text-lg leading-tight mb-0.5">🇬🇧</div><div className="text-xs sm:text-sm font-bold leading-none">UK</div></div></div>
                    <input type="text" value={regNumber} onChange={handleRegChange} placeholder="ENTER REG" className="bg-yellow-400 border-none outline-none text-xl sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/60 px-3 sm:px-4 py-3 uppercase tracking-wider min-w-0" maxLength={8} />
                  </div>
                  <MileageQuickSelect value={mileageSelection} onChange={handleMileageSelection} onAutoSubmit={handleGetQuote} error={vehicleAgeError} isLoading={isLookingUp} isRegValid={regNumber.replace(/\s/g, '').length >= 5} />
                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">{brandName} is a registered trademark of General Motors. We are an independent warranty provider.</p>
                  <TrustCallbackPanel />
                </div>
              </div>
              <div className="relative">
                <OptimizedImage src={heroImage} alt={`${brandName} extended warranty UK`} className="w-full h-auto" priority={true} width={651} height={434} />
                <div className="absolute top-4 right-4"><a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer"><OptimizedImage src={trustpilotExcellent} alt="Trustpilot Excellent" className="h-auto w-28 sm:w-36 object-contain" width={144} height={61} /></a></div>
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    <div className="flex items-center space-x-1.5"><Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">SUVs</span></div>
                    <div className="flex items-center space-x-1.5"><Car className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Saloons</span></div>
                    <div className="flex items-center space-x-1.5"><Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">Performance</span></div>
                  </div>
                  <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 rounded-md px-3 py-1.5 cursor-pointer"><span className="text-sm font-semibold text-green-700">⚡ Instant cover</span></div></TooltipTrigger><TooltipContent><p>⚡ Cover starts immediately after purchase</p></TooltipContent></Tooltip></TooltipProvider>
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3">What {brandName} repairs actually cost</h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">American luxury means premium parts and specialist labour costs.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {repairs.map((r, i) => {
                const Icon = r.icon;
                const colors = { medium: { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-900' }, high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-brand-orange' }, critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' } }[r.severity];
                return (<div key={i} className={`${colors.bg} rounded-xl p-4 md:p-5 border ${colors.border} flex items-start gap-3`}><div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-5 h-5 ${colors.text}`} /></div><div><h3 className="font-bold text-gray-900 text-sm md:text-base">{r.name}</h3><p className={`font-bold text-base md:text-lg ${colors.text}`}>{r.cost}</p></div></div>);
              })}
            </div>
            <div className="mt-8 md:mt-12 text-center">
              <div className="bg-brand-deep-blue rounded-2xl p-8 md:p-12 max-w-3xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-4">
                  <div className="text-center"><p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Typical repair</p><p className="text-2xl md:text-4xl font-bold text-red-400 line-through decoration-2">£4,500</p></div>
                  <span className="text-lg md:text-xl font-bold text-white/50">vs</span>
                  <div className="text-center"><p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Platinum plan</p><p className="text-2xl md:text-4xl font-bold text-emerald-400">from £{startingPrice}/mo</p></div>
                </div>
                <Button onClick={scrollToQuoteForm} className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 md:py-5 px-6 md:px-8 text-base md:text-lg rounded-xl shadow-lg animate-breathing"><span className="flex items-center gap-2">Get my instant quote<ArrowRight className="w-5 h-5" /></span></Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3">All {brandName} Models Covered</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
              {filteredModels.map(({ model, generations, category }) => (
                <button key={model} onClick={() => { setSelectedModel(model); scrollToQuoteForm(); }} className={`group bg-white rounded-lg px-2 py-3 text-center border transition-all ${selectedModel === model ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
                  <Car className={`w-6 h-6 mx-auto mb-1.5 ${selectedModel === model ? 'text-blue-500' : 'text-slate-400'}`} strokeWidth={1.25} />
                  <h3 className="text-[11px] md:text-xs font-bold text-slate-900 truncate">{brandName} {model}</h3>
                  <p className="text-[8px] md:text-[9px] text-slate-400 font-mono">{generations.filter(Boolean).join(' · ')}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-8">Why {brandName} Drivers Choose Us</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[{ icon: Shield, title: 'Comprehensive Cover', desc: 'Engine, transmission, electrics & more' }, { icon: MapPin, title: 'Any UK Garage', desc: 'Any VAT-registered garage' }, { icon: Phone, title: 'UK Claims Team', desc: 'Fast, hassle-free claims' }, { icon: Clock, title: 'Instant Cover', desc: 'Protection starts immediately' }].map((item, i) => (
                <div key={i} className="text-center p-4 md:p-6"><item.icon className="w-8 h-8 md:w-10 md:h-10 text-brand-orange mx-auto mb-3" /><h3 className="font-bold text-gray-900 text-sm md:text-base mb-1">{item.title}</h3><p className="text-xs md:text-sm text-gray-600">{item.desc}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 md:py-16 bg-gradient-to-br from-blue-900 to-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-white">Nationwide UK Coverage</h2>
                <ul className="space-y-2 text-left max-w-md mx-auto md:mx-0">
                  {['Use any VAT-registered garage', 'American car specialist or independent', 'Recovery to nearest garage', 'UK-based claims team'].map((item, i) => (<li key={i} className="flex items-center gap-2"><Check className="w-5 h-5 text-green-400 flex-shrink-0" /><span>{item}</span></li>))}
                </ul>
              </div>
              <div className="flex flex-col items-center order-first md:order-last">
                <OptimizedImage src={pandaThumbsUp} alt="Miles the Panda" className="w-36 sm:w-48 md:w-64 h-auto object-contain mb-4" width={256} height={256} />
                <div className="bg-white/10 rounded-2xl px-8 py-4 backdrop-blur-sm"><p className="text-sm md:text-xl font-bold text-white">England • Scotland • Wales • N. Ireland</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">What {brandName} Owners Say</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                  <div className="flex gap-0.5 mb-2">{[...Array(t.rating)].map((_, j) => (<Star key={j} className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 fill-yellow-400" />))}</div>
                  <p className="text-sm md:text-base text-gray-700 mb-3">"{t.text}"</p>
                  <div className="border-t pt-3"><p className="font-bold text-gray-900 text-sm">{t.name}</p><p className="text-xs text-gray-500">{t.model} • {t.location}</p></div>
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

export default CadillacWarrantyLanding;
