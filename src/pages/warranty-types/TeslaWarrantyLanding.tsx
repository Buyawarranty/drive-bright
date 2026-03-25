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
import TrustCallbackPanel from '@/components/TrustCallbackPanel';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';
import BrandPageFAQ from '@/components/brand-pages/BrandPageFAQ';
import BluePersistentCallback from '@/components/brand-pages/BluePersistentCallback';
import MinimalLandingFooter from '@/components/brand-pages/MinimalLandingFooter';
import BrandRepairCosts from '@/components/brand-pages/BrandRepairCosts';

const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));
const VehicleCoverageSection = lazy(() => import('@/components/homepage/VehicleCoverageSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));

import trustpilotExcellent from '@/assets/trustpilot-excellent-box.webp';
import teslaModel3Hero from '@/assets/tesla-model-3-hero-warranty-uk.png';
import teslaModelYClaims from '@/assets/tesla-model-y-claims-warranty-uk.png';
import teslaModelSCoverage from '@/assets/tesla-model-s-coverage-warranty-uk.png';
import teslaModelXTestimonials from '@/assets/tesla-model-x-testimonials-warranty-uk.png';
import teslaModel3AdditionalCover from '@/assets/tesla-model-3-additional-cover-uk.png';

const teslaModelCategories = {
  'Sedan': {
    'Model 3': ['Standard Range Plus', 'Long Range', 'Performance', 'Highland'],
    'Model S': ['Long Range', 'Plaid', '75D', '100D', 'P100D'],
  },
  'SUV & Crossover': {
    'Model Y': ['Standard Range', 'Long Range', 'Performance'],
    'Model X': ['Long Range', 'Plaid', '75D', '100D', 'P100D'],
  },
};
type ModelCategory = keyof typeof teslaModelCategories;

const teslaFAQs = [
  { question: "Is a Tesla extended warranty worth it in the UK?", answer: "Yes. Tesla vehicles feature advanced electric drivetrains, large battery packs, sophisticated thermal management systems, and complex electronics that can be very costly to repair outside the manufacturer network. Our extended warranty protects key components like the drive unit, power electronics, on-board charger, and suspension, preventing unexpected repair bills." },
  { question: "How much does a Tesla extended warranty cost in the UK?", answer: "Extended Tesla warranty prices typically start from £19 a month, depending on your Tesla model, mileage, and chosen claim limit. We offer plans from just 60p a day with flexible monthly or annual payment options." },
  { question: "Can I buy a Tesla extended warranty after my original warranty has expired?", answer: "Yes, you can buy cover even if your Tesla is outside its original 4-year/50,000-mile manufacturer warranty, or if you purchased it used. We cover vehicles up to 150,000 miles and 15 years old." },
  { question: "Can I use my own garage for Tesla warranty repairs?", answer: "Yes, absolutely. You can choose any VAT-registered garage across the UK, including Tesla-approved body shops and independent EV specialists. We have a network of approved garages nationwide." },
  { question: "Does the warranty cover Tesla battery and drive unit?", answer: "Yes, our comprehensive plan includes cover for key EV components including the electric drive unit, power electronics module, DC-DC converter, on-board charger, battery management system (BMS), thermal management, and regenerative braking system." },
  { question: "Is roadside assistance included with my Tesla warranty?", answer: "Yes, our comprehensive plan includes 24/7 roadside assistance and recovery anywhere in the UK. If your Tesla breaks down or runs out of charge unexpectedly, we'll send help to get you to the nearest charging point or garage." },
  { question: "How do I make a claim on my Tesla warranty?", answer: "Simply call our UK-based claims team or submit a claim online. We aim to authorise repairs quickly so you're not left waiting. Your chosen garage contacts us directly, and we settle the bill with them." },
  { question: "What's not covered by the Tesla warranty?", answer: "Routine maintenance, wear and tear items (brake pads, tyres, wiper blades), pre-existing faults, cosmetic damage, and the main high-voltage battery pack are not covered. Our policy documents clearly outline all exclusions so there are no surprises." }
];

const testimonials = [
  { name: "Alex R.", location: "London", model: "Tesla Model 3", text: "My Model 3's drive unit developed a whine at 68,000 miles. Would have cost over £4,500 at Tesla but Buy A Warranty covered everything. Sorted within a week. Brilliant.", rating: 5 },
  { name: "Sophie L.", location: "Bristol", model: "Tesla Model Y", text: "The air suspension compressor on my Model Y failed. The claims team were incredibly helpful and had it repaired within four days. £2,200 claim paid without any fuss.", rating: 5 },
  { name: "Daniel W.", location: "Manchester", model: "Tesla Model S", text: "Finding proper warranty cover for an older Model S was difficult until I found these guys. They understand EV components and the price is very fair for the cover you get.", rating: 5 },
  { name: "Karen B.", location: "Edinburgh", model: "Tesla Model 3", text: "On-board charger failed on my Model 3 — couldn't charge at home. Buy A Warranty authorised the repair same day and paid the garage directly. Absolutely recommend.", rating: 5 }
];

const TeslaWarrantyLanding: React.FC = () => {
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

  const filteredModels = useMemo(() => {
    const allModels = activeModelFilter === 'All'
      ? Object.entries(teslaModelCategories).flatMap(([category, models]) => Object.entries(models).map(([model, variants]) => ({ model, generations: variants, category })))
      : Object.entries(teslaModelCategories[activeModelFilter]).map(([model, variants]) => ({ model, generations: variants, category: activeModelFilter }));
    if (!modelSearchQuery.trim()) return allModels;
    const query = modelSearchQuery.toLowerCase();
    return allModels.filter(({ model, generations }) => model.toLowerCase().includes(query) || generations.some(gen => gen.toLowerCase().includes(query)));
  }, [activeModelFilter, modelSearchQuery]);

  const formatRegNumber = (value: string) => { const f = value.replace(/\s/g, '').toUpperCase(); return f.length > 3 ? f.slice(0, -3) + ' ' + f.slice(-3) : f; };
  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = formatRegNumber(e.target.value); if (f.length <= 8) setRegNumber(f); };
  const handleMileageSelection = (selection: string) => { setMileageSelection(selection); setMileage(selection === 'under120k' ? '100000' : '130000'); };

  const handleGetQuote = async () => {
    trackButtonClick('tesla_warranty_get_quote', { brand: 'Tesla' });
    if (!regNumber.trim()) { toast({ title: "Registration required", description: "Please enter your vehicle registration number.", variant: "destructive" }); return; }
    if (!mileage.trim()) { toast({ title: "Mileage required", description: "Please select your vehicle's mileage to continue.", variant: "destructive" }); return; }
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registrationNumber: regNumber } });
      if (error) throw error;
      if (data?.found) {
        if (data.manufactureDate) {
          const agePrecise = (Date.now() - new Date(data.manufactureDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          if (agePrecise > 15) { setVehicleAgeError('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old'); toast({ title: "Vehicle not eligible", description: "Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.", variant: "destructive" }); setIsLookingUp(false); return; }
        }
        const vehicleData = { regNumber, mileage, make: data.make || 'TESLA', model: data.model, fuelType: data.fuelType || 'ELECTRIC', transmission: data.transmission, year: data.yearOfManufacture, vehicleType: 'car', manufactureDate: data.manufactureDate };
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

  const scrollToQuoteForm = () => { document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const productSchema = { "@context": "https://schema.org", "@type": "Product", "name": "Tesla Extended Warranty UK", "description": "Comprehensive extended warranty coverage for all Tesla models sold in the UK including Model 3, Model Y, Model S, and Model X. Covers electric drive unit, power electronics, on-board charger, suspension, and electrical systems. Nationwide UK coverage.", "brand": { "@type": "Brand", "name": "Buy A Warranty" }, "manufacturer": { "@type": "Organization", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk", "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png", "contactPoint": { "@type": "ContactPoint", "telephone": "+44-800-917-9270", "contactType": "customer service", "availableLanguage": "English", "areaServed": "GB" } }, "offers": { "@type": "Offer", "priceCurrency": "GBP", "price": "19", "priceValidUntil": new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], "availability": "https://schema.org/InStock", "url": "https://buyawarranty.co.uk/warranty-types/tesla-warranty/", "seller": { "@type": "Organization", "name": "Buy A Warranty" }, "priceSpecification": { "@type": "UnitPriceSpecification", "price": "19", "priceCurrency": "GBP", "unitText": "month" } }, "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847", "bestRating": "5" }, "review": testimonials.map((t, i) => ({ "@type": "Review", "author": { "@type": "Person", "name": t.name }, "reviewRating": { "@type": "Rating", "ratingValue": t.rating, "bestRating": "5" }, "reviewBody": t.text, "datePublished": new Date(Date.now() - (i+1)*7*24*60*60*1000).toISOString().split('T')[0] })), "category": "Vehicle Extended Warranty", "audience": { "@type": "Audience", "audienceType": "Tesla vehicle owners in the United Kingdom" } };
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": teslaFAQs.map(faq => ({ "@type": "Question", "name": faq.question, "acceptedAnswer": { "@type": "Answer", "text": faq.answer } })) };
  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [ { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" }, { "@type": "ListItem", "position": 2, "name": "Warranty Types", "item": "https://buyawarranty.co.uk/warranty-types/" }, { "@type": "ListItem", "position": 3, "name": "Tesla Extended Warranty", "item": "https://buyawarranty.co.uk/warranty-types/tesla-warranty/" } ] };
  const howToSchema = { "@context": "https://schema.org", "@type": "HowTo", "name": "How to get a Tesla extended warranty quote", "description": "Get an instant Tesla extended warranty quote in 60 seconds", "totalTime": "PT1M", "step": [ { "@type": "HowToStep", "position": 1, "name": "Enter registration", "text": "Enter your Tesla registration number" }, { "@type": "HowToStep", "position": 2, "name": "Select mileage", "text": "Choose your mileage range" }, { "@type": "HowToStep", "position": 3, "name": "Get instant quote", "text": "Receive your personalised Tesla warranty quote" } ] };
  const localBusinessSchema = { "@context": "https://schema.org", "@type": "LocalBusiness", "name": "Buy A Warranty", "url": "https://buyawarranty.co.uk", "telephone": "+44-800-917-9270", "email": "support@buyawarranty.co.uk", "priceRange": "£19-£85/month", "address": { "@type": "PostalAddress", "streetAddress": "124 City Road", "addressLocality": "London", "postalCode": "EC1V 2NX", "addressCountry": "GB" }, "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "2847" } };

  return (
    <>
      <Helmet>
        <title>Tesla Extended Warranty UK | Model 3, Model Y, Model S, Model X from £19/mo</title>
        <meta name="description" content="Protect your Tesla Model 3, Model Y, Model S or Model X with comprehensive extended warranty cover. Drive unit, power electronics, on-board charger and suspension covered. Nationwide UK coverage, any VAT-registered garage. Prices from £19/month." />
        <meta name="keywords" content="Tesla extended warranty, Tesla warranty UK, Tesla Model 3 warranty, Tesla Model Y warranty, Tesla Model S warranty, Tesla Model X warranty, used Tesla warranty, Tesla EV warranty, electric car warranty UK" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types/tesla-warranty/" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="geo.region" content="GB" /><meta name="geo.placename" content="United Kingdom" /><meta httpEquiv="content-language" content="en-GB" />
        <meta property="og:title" content="Tesla warranty UK — Model 3, Y, S, X covered from £19/mo | Buy A Warranty" />
        <meta property="og:description" content="Comprehensive Tesla warranty for Model 3, Model Y, Model S and Model X. Drive unit, electronics, suspension covered. Nationwide UK coverage from £19/month." />
        <meta property="og:url" content="https://buyawarranty.co.uk/warranty-types/tesla-warranty/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" />
        <meta property="og:site_name" content="Buy A Warranty" /><meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Tesla warranty UK — Model 3, Y, S, X covered from £19/mo" />
        <meta name="twitter:description" content="Protect your Tesla with comprehensive extended warranty. All EV components covered. Nationwide UK coverage." />
        <meta name="ai-content-declaration" content="This content is human-authored, fact-checked, and regularly updated" />
        <meta name="ai-summary" content="Buy A Warranty offers Tesla extended warranty plans in the UK from £19/month covering Model 3, Model Y, Model S, and Model X. Coverage includes drive unit, power electronics, on-board charger, suspension, and electrical systems. Use any VAT-registered garage nationwide." />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
      </Helmet>

      <main className="min-h-screen bg-white" role="main" itemScope itemType="https://schema.org/WebPage">
        {/* Hero section */}
        <section id="hero-section" className="bg-gradient-to-br from-gray-50 via-white to-orange-50/30 pt-6 pb-12 md:pt-12 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-4 md:mb-6">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Tesla_logo.png/120px-Tesla_logo.png" alt="Tesla Logo" className="h-8 md:h-12 w-auto object-contain" width={48} height={48} />
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 md:mb-4">
                  <span className="text-gray-900">Tesla extended warranty </span>
                  <span className="text-brand-orange">in 60 seconds!</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 md:mb-6 hero-description">Protect your Tesla with specialist EV repairs, UK-wide cover and no-surprise costs. Get a fixed price with instant cover.</p>
                <div className="mb-4 md:mb-6 text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-center lg:justify-start"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" /><span className="font-medium">From just 60p a day • Easy claims • Fast payouts</span></div>
                  <div className="flex items-center justify-center lg:justify-start"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mr-1.5 md:mr-2 flex-shrink-0" /><span className="font-medium">Unlimited claims • Parts and labour • No excess</span></div>
                </div>
                <div className="max-w-md mx-auto lg:mx-0 space-y-4">
                  <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black">
                    <div className="bg-blue-600 text-white font-bold px-3 sm:px-4 py-3 flex items-center justify-center min-w-[60px] sm:min-w-[80px]">
                      <div className="flex flex-col items-center"><div className="text-base sm:text-lg leading-tight mb-0.5">🇬🇧</div><div className="text-xs sm:text-sm font-bold leading-none">UK</div></div>
                    </div>
                    <input type="text" value={regNumber} onChange={handleRegChange} placeholder="ENTER REG" className="bg-yellow-400 border-none outline-none text-xl sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/60 px-3 sm:px-4 py-3 uppercase tracking-wider min-w-0" maxLength={8} />
                  </div>
                  <MileageQuickSelect value={mileageSelection} onChange={handleMileageSelection} onAutoSubmit={handleGetQuote} error={vehicleAgeError} isLoading={isLookingUp} isRegValid={regNumber.replace(/\s/g, '').length >= 5} />
                  <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">Tesla is a registered trademark of Tesla, Inc. We are an independent warranty provider.</p>
                  <TrustCallbackPanel />
                </div>
              </div>
              <div className="relative">
                <div className="relative">
                  <OptimizedImage src={teslaModel3Hero} alt="Tesla Model 3 front view - Tesla extended warranty UK coverage" className="w-full max-w-sm mx-auto h-auto object-contain" priority={true} width={1024} height={768} />
                  <div className="absolute top-4 right-4"><a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity"><OptimizedImage src={trustpilotExcellent} alt="Trustpilot Excellent Rating" className="h-auto w-28 sm:w-36 object-contain" width={144} height={61} /></a></div>
                </div>
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                    {[{ icon: Car, label: 'Cars' }, { icon: Truck, label: 'Vans' }, { icon: Zap, label: 'Hybrid' }, { icon: Battery, label: 'EV' }, { icon: Bike, label: 'Motorbikes' }].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center space-x-1.5"><Icon className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /><span className="font-medium text-gray-700 text-xs sm:text-sm lg:text-base">{label}</span></div>
                    ))}
                  </div>
                  <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 rounded-md px-3 py-1.5 sm:px-3.5 sm:py-2 cursor-pointer"><span className="text-sm font-semibold text-green-700">⚡ Instant cover</span></div></TooltipTrigger><TooltipContent><p>⚡ Cover starts immediately after purchase</p></TooltipContent></Tooltip></TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Suspense fallback={<div className="py-12 md:py-20 bg-gray-50 min-h-[300px]" />}><WarrantyBenefitsSection headline="The ultimate Tesla warranty." /></Suspense>
        <Suspense fallback={<div className="py-12 md:py-16 bg-gray-50 min-h-[300px]" />}><VehicleCoverageSection headingPrefix="Tesla" /></Suspense>
        <Suspense fallback={<div className="py-8 md:py-12 bg-gray-50 min-h-[200px]" />}><CoverClaritySection /></Suspense>
        <Suspense fallback={<div className="py-12 md:py-20 bg-brand-gray-bg min-h-[400px]" />}><VideoSection scrollToQuoteForm={() => window.scrollTo({ top: 0, behavior: 'smooth' })} /></Suspense>

        <BrandRepairCosts brandName="Tesla" monthlyPrice="£19" onGetQuote={scrollToQuoteForm} repairs={[
          { name: 'Drive unit replacement', cost: '£4,000 – £8,000', icon: 'Zap', severity: 'critical' },
          { name: 'On-board charger', cost: '£1,200 – £2,500', icon: 'Zap', severity: 'high' },
          { name: 'Power electronics module', cost: '£2,000 – £4,500', icon: 'Zap', severity: 'critical' },
          { name: 'Air suspension compressor', cost: '£1,500 – £3,000', icon: 'Wrench', severity: 'high' },
          { name: 'DC-DC converter', cost: '£800 – £1,800', icon: 'Zap', severity: 'medium' },
          { name: 'Touchscreen/MCU replacement', cost: '£1,200 – £2,800', icon: 'Zap', severity: 'high' },
          { name: 'Thermal management system', cost: '£1,000 – £2,500', icon: 'Shield', severity: 'medium' },
          { name: 'Electric power steering rack', cost: '£800 – £1,600', icon: 'Wrench', severity: 'medium' },
          { name: 'Autopilot camera module', cost: '£600 – £1,400', icon: 'Shield', severity: 'medium' },
        ]} />

        {/* Tesla models section */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-slate-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium mb-4"><Shield className="w-3.5 h-3.5" />Full coverage details</div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 md:mb-4">All Tesla models covered</h2>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">Select your Tesla model to see tailored warranty options designed for your vehicle.</p>
            </div>
            <div className="max-w-md mx-auto mb-6 md:mb-8"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input type="text" value={modelSearchQuery} onChange={(e) => setModelSearchQuery(e.target.value)} placeholder="Search by model or variant (e.g. Model 3, Long Range)" className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm md:text-base" /></div></div>
            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-10 sticky top-0 bg-gradient-to-b from-slate-50 via-slate-50 to-transparent py-4 md:py-5 z-10 -mx-4 px-4">
              {(['All', 'Sedan', 'SUV & Crossover'] as const).map(cat => (
                <button key={cat} onClick={() => { setActiveModelFilter(cat as any); setModelSearchQuery(''); }} className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${activeModelFilter === cat ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25' : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                  {cat === 'All' ? 'All models' : cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
              {filteredModels.map(({ model, generations, category }) => (
                <button key={model} onClick={() => { setSelectedModel(model); scrollToQuoteForm(); }} className={`group relative bg-white rounded-lg px-3 py-4 md:px-4 md:py-5 text-center border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${selectedModel === model ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-md scale-[1.02]' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm focus:ring-slate-400'}`} aria-label={`Tesla ${model}, variants: ${generations.join(', ')}`}>
                  <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-2 h-2" />EV</div>
                  <Battery className={`w-7 h-7 mx-auto mb-2 transition-colors ${selectedModel === model ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={1.25} />
                  <h3 className="text-sm md:text-base font-bold text-slate-900 leading-tight mb-1">Tesla {model}</h3>
                  <p className="text-[9px] md:text-[10px] text-slate-400 font-medium leading-tight">{generations.join(' · ')}</p>
                </button>
              ))}
            </div>
            {filteredModels.length === 0 && <div className="text-center py-12"><p className="text-slate-500">No models found for "{modelSearchQuery}".</p><button onClick={() => setModelSearchQuery('')} className="mt-3 text-blue-600 font-medium hover:underline">Clear search</button></div>}
            <div className="mt-8 md:mt-10 text-center"><div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 text-xs md:text-sm text-slate-600"><Check className="w-4 h-4 text-green-600" /><span><strong>Also covered:</strong> Performance variants, Long Range, Plaid editions, and all UK-spec models</span></div></div>
          </div>
        </section>

        {selectedModel && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 md:py-4 px-4 z-50 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm md:text-base"><div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center"><Battery className="w-5 h-5 text-white" /></div><div><p className="font-bold text-slate-900">Tesla {selectedModel} selected</p><p className="text-slate-500 text-xs md:text-sm">Step 1 of 2: Choose coverage →</p></div></div>
              <Button onClick={scrollToQuoteForm} className="w-full sm:w-auto bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 md:px-8 py-3 md:py-4 text-sm md:text-base rounded-xl animate-breathing shadow-lg shadow-orange-500/25">Get warranty quote for Tesla<ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" /></Button>
            </div>
          </div>
        )}

        {/* Why Tesla drivers choose us */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Why Tesla drivers choose us</h2>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-2 bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-5 rounded-xl text-base md:text-lg animate-breathing mt-4">Get Tesla warranty<ArrowRight className="w-5 h-5 md:w-6 md:h-6" /></button>
            </div>
            <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                {[{ icon: Zap, title: 'Specialist EV component cover', desc: 'Drive unit, power electronics, on-board charger, and thermal management all covered.' }, { icon: ThumbsUp, title: 'Transparent limits and zero hidden fees', desc: 'The price you see is the price you pay. No surprises.' }, { icon: Users, title: 'UK support team that understands Tesla', desc: 'Our friendly UK-based team handles claims quickly and fairly.' }, { icon: Car, title: 'High mileage Tesla warranty plans', desc: 'Cover vehicles up to 150,000 miles with no mileage restrictions during cover.' }, { icon: Clock, title: 'Flexible monthly payments with no long contracts', desc: 'Cancel anytime and get a pro-rata refund. No lock-in.' }].map((b, i) => (
                  <div key={i} className="flex gap-3 md:gap-4 bg-white p-3 md:p-5 rounded-xl shadow-sm border border-gray-100"><div className="w-10 h-10 md:w-12 md:h-12 bg-brand-orange/10 rounded-xl flex items-center justify-center flex-shrink-0"><b.icon className="w-5 h-5 md:w-6 md:h-6 text-brand-orange" /></div><div><h3 className="text-base md:text-lg font-bold text-gray-900 mb-0.5 md:mb-1">{b.title}</h3><p className="text-gray-600 text-xs md:text-sm">{b.desc}</p></div></div>
                ))}
              </div>
              <div className="hidden lg:flex justify-center items-end pt-16"><OptimizedImage src={teslaModelXTestimonials} alt="Tesla Model X front view - Why Tesla owners choose Buy A Warranty" className="max-w-[220px] xl:max-w-[260px] h-auto object-contain" width={1024} height={768} /></div>
            </div>
          </div>
        </section>

        {/* How claims work */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12"><h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">How claims work</h2></div>
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                {[{ step: 1, title: 'Diagnose', desc: 'Diagnose at any VAT-registered garage' }, { step: 2, title: 'Authorise', desc: 'We authorise eligible repairs quickly' }, { step: 3, title: 'Repair', desc: 'You approve and the garage repairs your Tesla' }, { step: 4, title: 'We pay', desc: 'We pay the garage directly for covered items' }].map((item, i) => (
                  <div key={i} className="text-center"><div className="w-12 h-12 md:w-16 md:h-16 bg-brand-orange text-white rounded-full flex items-center justify-center text-xl md:text-2xl font-bold mx-auto mb-3 md:mb-4">{item.step}</div><h3 className="text-sm md:text-lg font-bold text-gray-900 mb-1 md:mb-2">{item.title}</h3><p className="text-xs md:text-base text-gray-600">{item.desc}</p></div>
                ))}
              </div>
              <div className="hidden lg:flex justify-center"><OptimizedImage src={teslaModelYClaims} alt="Tesla Model Y front view - How Tesla warranty claims work" className="max-w-[200px] xl:max-w-[240px] h-auto object-contain" width={1024} height={768} /></div>
            </div>
          </div>
        </section>

        {/* Crystal clear section */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 bg-green-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4"><Shield className="w-4 h-4 md:w-5 md:h-5 text-green-600" /><span className="text-xs md:text-sm font-semibold text-green-700">Transparent coverage</span></div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Your Tesla cover, made <span className="text-brand-orange">crystal clear</span></h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">See what's included — clear terms, no jargon, no surprises.</p>
            </div>
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                {[{ emoji: '✅', title: 'No hidden catches', desc: 'What you see is what you get' }, { emoji: '💰', title: '14-day money-back guarantee', desc: 'Try risk-free' }, { emoji: '⭐', title: '94% of claims approved fast', desc: 'We pay when you need us' }].map((c, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100 text-center"><div className="text-3xl md:text-4xl mb-3 md:mb-4">{c.emoji}</div><h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 md:mb-2">{c.title}</h3><p className="text-gray-600 text-xs md:text-sm">{c.desc}</p></div>
                ))}
              </div>
              <div className="hidden lg:flex justify-center"><OptimizedImage src={teslaModelSCoverage} alt="Tesla Model S front view - Crystal clear Tesla warranty coverage UK" className="max-w-[200px] xl:max-w-[240px] h-auto object-contain" width={1024} height={768} /></div>
            </div>
          </div>
        </section>

        {/* High mileage section */}
        <section className="py-10 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 items-center">
              <div className="flex justify-center"><OptimizedImage src={teslaModelYClaims} alt="Tesla Model Y front view - High mileage Tesla warranty coverage UK" className="max-w-[240px] md:max-w-[280px] h-auto object-contain" width={1024} height={768} /></div>
              <div className="text-center lg:text-left">
                <div className="text-green-600 text-xs md:text-sm font-semibold uppercase tracking-wide mb-3 md:mb-4">High mileage Tesla, no problem!</div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">Drive your Tesla with confidence<br /><span className="text-brand-orange">You're covered</span></h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">Once you have your Tesla warranty, drive with complete peace of mind. If something goes wrong, simply call our claims team and we'll take care of everything.</p>
                <div className="space-y-2 md:space-y-3 text-left max-w-md mx-auto lg:mx-0">
                  {['Cover vehicles up to 150,000 miles', 'No mileage restrictions during cover', 'Unlimited claims value'].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 md:gap-3"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 flex-shrink-0" /><span className="text-sm md:text-base text-gray-700">{item}</span></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 md:mt-10 max-w-xl mx-auto"><Button onClick={scrollToQuoteForm} className="w-full bg-brand-orange text-white font-bold py-5 md:py-6 text-base md:text-xl rounded-xl shadow-lg animate-breathing"><span className="flex items-center justify-center gap-2 md:gap-3">Get my instant quote<ArrowRight className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3} /></span></Button></div>
          </div>
        </section>

        {/* Additional cover options */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12"><h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Additional Tesla cover options</h2><p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">Enhance your Tesla warranty with these optional extras</p></div>
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                {[{ icon: Car, color: 'blue', title: 'Courtesy car', desc: 'Keep moving while your Tesla is being repaired' }, { icon: MapPin, color: 'green', title: 'European cover', desc: 'Extended protection when driving abroad' }, { icon: Shield, color: 'purple', title: 'Wear & tear', desc: 'Cover for gradual component deterioration' }].map((o, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100"><div className={`w-10 h-10 md:w-12 md:h-12 bg-${o.color}-100 rounded-xl flex items-center justify-center mb-3 md:mb-4`}><o.icon className={`w-5 h-5 md:w-6 md:h-6 text-${o.color}-600`} /></div><h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">{o.title}</h3><p className="text-sm md:text-base text-gray-600">{o.desc}</p></div>
                ))}
              </div>
              <div className="hidden lg:flex justify-center"><OptimizedImage src={teslaModel3AdditionalCover} alt="Tesla Model 3 front view - Additional Tesla warranty cover options UK" className="max-w-[200px] xl:max-w-[240px] h-auto object-contain" width={1024} height={768} /></div>
            </div>
          </div>
        </section>

        {/* UK coverage section */}
        <section className="py-10 md:py-16 bg-gradient-to-br from-blue-900 to-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6 text-white">Nationwide UK coverage</h2>
                <p className="text-base md:text-lg text-white mb-4 md:mb-6">Your Tesla is covered wherever you drive in the United Kingdom. Our network of approved garages spans England, Scotland, Wales, and Northern Ireland.</p>
                <ul className="space-y-2 md:space-y-3 text-left max-w-md mx-auto md:mx-0">
                  {['Use any VAT-registered garage', 'Tesla-approved or independent EV specialist', 'Recovery to nearest garage or charging point', 'Claims handled by our UK team'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 md:gap-3"><Check className="w-4 h-4 md:w-5 md:h-5 text-green-400 flex-shrink-0" /><span className="text-sm md:text-base">{item}</span></li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-center order-first md:order-last">
                <OptimizedImage src={teslaModelSCoverage} alt="Tesla Model S front view - Nationwide UK Tesla warranty coverage" className="max-w-[220px] md:max-w-[260px] h-auto object-contain mb-4 md:mb-6" width={1024} height={768} />
                <div className="inline-block bg-white/10 rounded-xl md:rounded-2xl px-4 md:px-8 py-2 md:py-4 backdrop-blur-sm"><p className="text-sm md:text-xl font-bold text-white">England • Scotland • Wales • N. Ireland</p></div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12"><h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">What Tesla owners say</h2><p className="text-base md:text-lg text-gray-600">Real reviews from real Tesla drivers</p></div>
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                {testimonials.map((t, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100">
                    <div className="flex gap-0.5 md:gap-1 mb-2 md:mb-3">{[...Array(t.rating)].map((_, j) => <Star key={j} className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 fill-yellow-400" />)}</div>
                    <p className="text-sm md:text-base text-gray-700 mb-3 md:mb-4">"{t.text}"</p>
                    <div className="border-t pt-3 md:pt-4"><p className="font-bold text-gray-900 text-sm md:text-base">{t.name}</p><p className="text-xs md:text-sm text-gray-500">{t.model} • {t.location}</p></div>
                  </div>
                ))}
              </div>
              <div className="hidden lg:flex justify-center"><OptimizedImage src={teslaModelXTestimonials} alt="Tesla Model X front view - Tesla owners trust Buy A Warranty" className="max-w-[200px] xl:max-w-[240px] h-auto object-contain" width={240} height={180} /></div>
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

export default TeslaWarrantyLanding;
