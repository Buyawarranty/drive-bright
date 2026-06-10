import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Phone, MessageCircle, Star, Shield, Wrench, Zap, Cpu, ChevronDown, Car, Truck, Battery, Bike, Plane, RefreshCw, Settings2, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import { OptimizedImage } from '@/components/OptimizedImage';
import MileageQuickSelect from '@/components/MileageQuickSelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';
import { trackButtonClick, trackQuoteRequest } from '@/utils/analytics';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import bmwHero from '@/assets/Bmw-extended-used-car-warranty.png';
import pandaMascot from '@/assets/panda-car-warranty-transparent.png';

const PHONE = '0330 229 5040';
const WHATSAPP_URL = 'https://wa.me/443302295040';

const faqs = [
  { q: 'Is my car too old or has too many miles?', a: 'We cover vehicles up to 15 years old and up to 150,000 miles. Higher-mileage BMWs may still be eligible for selected plans — enter your reg for an instant check.' },
  { q: 'Can I use my own garage?', a: 'Yes. You can choose any VAT-registered garage in the UK for repairs, subject to our claims process and policy terms.' },
  { q: 'What\u2019s covered in my warranty?', a: 'Cover varies by plan and may include mechanical, electrical, tech and safety components. Full inclusions, limits and exclusions are detailed in your policy documents.' },
  { q: 'How do I make a claim?', a: 'Contact our claims team, share the diagnostic report from your chosen garage, and we\u2019ll review the claim against your plan terms and respond quickly.' },
  { q: 'What should I do if my car has an issue?', a: 'Stop driving if it\u2019s unsafe, take the car to a VAT-registered garage for diagnosis, then contact our claims team before any repair work starts.' },
  { q: 'How much does it cost?', a: 'BMW cover starts from £19/month for eligible vehicles. Final pricing depends on model, mileage, claim limit and plan length.' },
  { q: 'What about modified vehicles?', a: 'Standard manufacturer options are fine. Performance modifications or non-standard parts may not be eligible — please check before purchasing.' },
  { q: 'Do I need a full service history?', a: 'A documented service history is recommended and helps support any future claim, but it is not always required to start cover.' },
  { q: 'What claim limit is right for me?', a: 'Higher claim limits suit higher-value or more complex BMWs. We\u2019ll help you pick a sensible limit during the quote journey.' },
  { q: 'Are diagnostics covered?', a: 'Diagnostic costs can be included where they identify a covered fault, subject to your selected plan and policy terms.' },
  { q: 'What is the most expensive repair you have covered?', a: 'Major component repairs (such as engine or gearbox work) can run into thousands of pounds — exactly the kind of bill an extended warranty is designed to help with, subject to your claim limit.' },
  { q: 'Is there a 30-day wait for new customers?', a: 'A short initial waiting period applies to new policies. Full details are set out in your policy documents before you buy.' },
];

const BMWExtendedWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const scrollToQuote = () => {
    trackButtonClick('bmw_ppc_cta');
    const el = document.getElementById('quote-module');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleMileageSelection = (sel: string) => {
    setMileageSelection(sel);
    setMileage(sel === 'under120k' ? '100000' : '130000');
    setErrorMsg('');
  };

  const handleGetQuote = async (mileageOverride?: string) => {
    trackButtonClick('bmw_ppc_get_quote');
    trackQuoteRequest();
    const effectiveMileage = mileageOverride || mileage;
    const effectiveSel = mileageOverride ? (mileageOverride === '100000' ? 'under120k' : 'over120k') : mileageSelection;

    if (!regNumber.trim()) {
      toast({ title: 'Registration required', description: 'Please enter your vehicle registration.', variant: 'destructive' });
      return;
    }
    if (!effectiveSel) {
      toast({ title: 'Mileage required', description: 'Please select your approximate mileage.', variant: 'destructive' });
      return;
    }

    setIsLooking(true);
    setErrorMsg('');
    try {
      const { data } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registration: regNumber } });
      const vehicleData: any = {
        regNumber: regNumber.toUpperCase(),
        mileage: effectiveMileage,
        ...(data?.make ? {
          make: data.make,
          model: data.model,
          fuelType: data.fuelType,
          transmission: data.transmission,
          year: data.yearOfManufacture || data.year,
          vehicleType: data.vehicleType,
          blocked: data.blocked || false,
          blockReason: data.blockReason || '',
        } : {}),
      };

      if (data?.yearOfManufacture) {
        const age = new Date().getFullYear() - parseInt(data.yearOfManufacture, 10);
        if (age > 15) {
          setErrorMsg('Sorry, we only cover vehicles under 150,000 miles and less than 15 years old.');
          setIsLooking(false);
          return;
        }
      }

      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      saveWithTimestamp('warrantyJourneyState', JSON.stringify({ vehicleData, formData: vehicleData, currentStep: 2, selectedPlan: null }));
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      const vehicleData: any = { regNumber: regNumber.toUpperCase(), mileage: effectiveMileage };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      navigate('/?step=2');
    } finally {
      setIsLooking(false);
    }
  };

  return (
    <>
      <SEOHead
        title="BMW Extended Warranty from £19/month | Instant Quote | BuyaWarranty"
        description="Affordable BMW extended warranty from £19/month. Flexible plans, mechanical, electrical, tech and EV cover options. Get an instant quote in 60 seconds."
        keywords="BMW extended warranty, BMW warranty UK, used BMW warranty, BMW car warranty"
        canonical="https://buyawarranty.co.uk/bmw-extended-warranty/"
        geoRegion="GB"
        geoPlacename="United Kingdom"
      />
      <OrganizationSchema />
      <WebPageSchema name="BMW Extended Warranty" description="BMW extended warranty cover from £19/month." url="https://buyawarranty.co.uk/bmw-extended-warranty/" />
      <FAQSchema faqs={faqs.map(f => ({ question: f.q, answer: f.a }))} />
      <ProductSchema name="BMW Extended Warranty" description="Flexible BMW warranty cover" price="19" brand="BuyaWarranty" category="Vehicle Warranty" image="https://buyawarranty.co.uk/logo.png" availability="https://schema.org/InStock" areaServed="GB" />
      <BreadcrumbSchema items={[{ name: 'Home', url: 'https://buyawarranty.co.uk/' }, { name: 'BMW Extended Warranty', url: 'https://buyawarranty.co.uk/bmw-extended-warranty/' }]} />

      <div className="min-h-screen bg-white text-slate-900 pb-24 md:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center">
              <img src={buyawarrantyLogo} alt="BuyaWarranty" className="h-9 md:h-10 w-auto" loading="eager" />
            </Link>
            <div className="hidden md:flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#00b67a]/10">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-[#00b67a] text-[#00b67a]" />)}
                <span className="ml-1 font-semibold text-slate-800">Excellent</span>
                <span className="text-slate-500">· Rated on Trustpilot</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="hidden sm:flex items-center gap-1.5 text-slate-800 font-semibold text-sm hover:text-orange-600">
                <Phone className="w-4 h-4" /> {PHONE}
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener" className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#25D366] text-white text-sm font-semibold hover:opacity-90">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
              <Button onClick={scrollToQuote} className="bg-orange-500 hover:bg-orange-600 text-white font-bold">Get my quote</Button>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="bg-gradient-to-b from-white to-slate-50">
          <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Left */}
              <div>
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00b67a] mb-3">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />)}
                  <span className="ml-1 text-slate-700">Excellent · Rated on Trustpilot</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-slate-900">
                  Affordable <span className="text-orange-500">BMW warranty</span> you can trust in 60 seconds!
                </h1>
                <p className="mt-3 text-lg md:text-xl font-bold text-slate-900">From £19/month</p>
                <p className="mt-3 text-base md:text-lg text-slate-700 max-w-xl">
                  Get a fast quote for flexible BMW warranty cover designed to help protect you from unexpected repair bills.
                </p>

                <ul className="mt-5 grid sm:grid-cols-2 gap-y-2.5 gap-x-4 text-sm md:text-base">
                  {[
                    'Fast quote in 60 seconds',
                    'Flexible warranty plans',
                    'Pay monthly or in full',
                    '1, 2 or 3 year cover options',
                    'Mechanical, electrical, tech & safety',
                    'EV and hybrid cover options',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-800">{t}</span>
                    </li>
                  ))}
                </ul>

                {/* Quote module */}
                <div id="quote-module" className="mt-7 bg-white rounded-2xl border border-slate-200 shadow-lg p-5 md:p-6">
                  <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-3">Enter your vehicle registration</h2>
                  <div className="flex items-stretch rounded-lg overflow-hidden border-2 border-black w-full max-w-md shadow-md">
                    <div className="bg-blue-600 text-white font-bold px-3 py-3 flex flex-col items-center justify-center min-w-[64px]">
                      <span className="text-base leading-none">🇬🇧</span>
                      <span className="text-sm font-bold leading-none mt-1">UK</span>
                    </div>
                    <input
                      type="text"
                      value={regNumber}
                      onChange={e => setRegNumber(e.target.value.replace(/[^A-Za-z0-9]/g,'').toUpperCase())}
                      placeholder="ENTER REG"
                      maxLength={8}
                      aria-label="Vehicle registration"
                      className="bg-yellow-400 outline-none text-2xl md:text-3xl text-black font-black flex-1 placeholder:text-black/60 px-4 py-3 uppercase tracking-wider min-w-0"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Cover for vehicles up to 150,000 miles and 15 years.</p>
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-800 mb-2">What's your approximate mileage?</p>
                    <MileageQuickSelect
                      value={mileageSelection}
                      onChange={handleMileageSelection}
                      onAutoSubmit={handleGetQuote}
                      error={errorMsg}
                      isLoading={isLooking}
                      isRegValid={regNumber.length >= 5}
                    />
                  </div>
                  <Button onClick={() => handleGetQuote()} disabled={isLooking} className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base md:text-lg py-6">
                    {isLooking ? 'Checking…' : 'Enter reg for an instant price'}
                    <ArrowRight className="ml-1 w-5 h-5" />
                  </Button>
                  <p className="mt-2 text-xs text-slate-500 text-center">No obligation · Quick online quote · Cover levels vary</p>
                </div>
              </div>

              {/* Right */}
              <div className="lg:pt-4">
                <OptimizedImage src={bmwHero} alt="BMW extended warranty UK" className="w-full h-auto rounded-2xl" priority width={651} height={434} sizes="(max-width:768px) 100vw, 600px" />
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-slate-700">
                  {[
                    { I: Car, l: 'Cars' },
                    { I: Truck, l: 'Vans' },
                    { I: Zap, l: 'Hybrid' },
                    { I: Battery, l: 'EV' },
                    { I: Bike, l: 'Motorbikes' },
                  ].map(({ I, l }) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <I className="w-5 h-5 text-green-500" />
                      <span className="font-medium">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 py-6 grid md:grid-cols-4 gap-4">
            {[
              'Easy to get a quote.',
              'Helpful customer service.',
              'Clear warranty options.',
              'Simple and straightforward.',
            ].map(snip => (
              <div key={snip} className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
                <div className="flex gap-0.5 mb-1.5">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />)}
                </div>
                <p className="text-sm text-slate-700">"{snip}"</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 1: Everything you need, covered */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">Everything You Need, Covered</h2>
              <p className="mt-3 text-slate-600">Choose flexible warranty cover for your BMW, with plan levels and cover limits clearly explained.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { I: Wrench, t: 'Mechanical & Electrical', items: ['Engine components','Gearbox components','Steering and suspension','Cooling and fuel system','Electrical components'] },
                { I: Cpu, t: 'Tech & Safety', items: ['Sensors','Safety systems','Infotainment components','Convenience features','Plan limits apply'] },
                { I: Shield, t: 'Plan Benefits', items: ['Flexible payment options','Monthly or annual payment','1, 2 or 3 year cover options','Clear terms','Support when you need help'] },
                { I: Battery, t: 'EV & Hybrid', items: ['EV and hybrid options available','Electric components','Charging-related components where covered','Plan limits and exclusions apply'] },
              ].map(({ I, t, items }) => (
                <div key={t} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-11 h-11 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
                    <I className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mb-3">{t}</h3>
                  <ul className="space-y-1.5 text-sm text-slate-700">
                    {items.map(x => (
                      <li key={x} className="flex gap-2"><Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button onClick={scrollToQuote} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-6 text-base">Get my quote</Button>
            </div>
          </div>
        </section>

        {/* Section 2: Flexible plans */}
        <section className="py-12 md:py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-10 items-center">
            <div className="order-2 lg:order-1">
              <img src={pandaMascot} alt="BuyaWarranty mascot" className="w-full max-w-sm mx-auto h-auto" loading="lazy" />
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-sm font-semibold text-orange-600 uppercase tracking-wide">Easy options</span>
              <h2 className="mt-2 text-3xl md:text-4xl font-black text-slate-900">Flexible Warranty Plans</h2>
              <p className="mt-3 text-slate-700 text-lg">Choose warranty cover that works for your vehicle, budget and driving needs.</p>
              <ul className="mt-5 space-y-2.5">
                {[
                  'Pay monthly or in full',
                  'Choose cover that works for you',
                  '1, 2 or 3 year cover options',
                  'Save with longer-term plans where available',
                  'From just £19/month for eligible vehicles',
                ].map(t => (
                  <li key={t} className="flex items-start gap-2 text-slate-800"><Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />{t}</li>
                ))}
              </ul>
              <Button onClick={scrollToQuote} className="mt-6 bg-orange-500 hover:bg-orange-600 text-white font-bold px-7 py-5">Get your instant quote</Button>
            </div>
          </div>
        </section>

        {/* Section 3: High mileage */}
        <section className="py-12 md:py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">High mileage, no problem</h2>
            <p className="mt-4 text-slate-700 text-lg">Own an older or higher-mileage BMW? Our warranty options can help you find suitable cover, subject to vehicle eligibility and plan terms.</p>
            <Button onClick={scrollToQuote} className="mt-6 bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-6">Get your instant quote</Button>
            <p className="mt-3 text-xs text-slate-500">Eligibility, cover limits and exclusions apply.</p>
          </div>
        </section>

        {/* Section 4: What's included */}
        <section className="py-12 md:py-16" style={{ background: 'linear-gradient(135deg, #e6f0ff 0%, #fff7e6 100%)' }}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">What's Included?</h2>
              <p className="mt-3 text-slate-700">Rest assured everything is covered if it breaks, where included in your selected plan and subject to policy terms.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { I: Shield, t: 'Complete Protection', d: 'Cover options designed to help protect against unexpected repair costs.' },
                { I: Wrench, t: 'Instant Claims Support', d: 'Get support when something goes wrong.' },
                { I: Check, t: 'Clear Terms', d: 'Simple cover options with clear limits and exclusions.' },
              ].map(({ I, t, d }) => (
                <div key={t} className="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-md border border-white">
                  <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center mb-4">
                    <I className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mb-2">{t}</h3>
                  <p className="text-slate-700 text-sm">{d}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button onClick={scrollToQuote} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-6">Secure your warranty</Button>
            </div>
          </div>
        </section>

        {/* Section 5: Additional cover */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">Additional Cover Options</h2>
              <p className="mt-3 text-slate-600">Tailor your warranty with optional extras, depending on your selected plan and vehicle eligibility.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { I: MapPin, t: 'Vehicle Recovery', d: 'Help when your vehicle breaks down and you need recovery support.' },
                { I: Plane, t: 'Europe Cover', d: 'Extend your protection when driving in selected European countries.' },
                { I: Car, t: 'Vehicle Rental', d: 'Temporary vehicle hire support may be available while your car is being repaired.' },
                { I: RefreshCw, t: 'Transfer Cover', d: 'Transfer your warranty to a new owner if you sell your vehicle, subject to terms.' },
                { I: Settings2, t: 'Bespoke Warranty', d: 'Create a warranty plan that better suits your vehicle, mileage and driving needs.' },
              ].map(({ I, t, d }) => (
                <div key={t} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <I className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1.5 text-sm">{t}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 text-center mt-6 max-w-2xl mx-auto">Additional cover options are subject to availability, selected plan, vehicle eligibility, cover limits and policy terms.</p>
            <div className="text-center mt-6">
              <Button onClick={scrollToQuote} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-6">View cover options</Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 md:py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">FAQ's</h2>
              <p className="mt-3 text-slate-600">First answers to the most common questions about our warranty services.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {faqs.map((f, i) => (
                <button key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="text-left bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-slate-900">{f.q}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-500 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </div>
                  {openFaq === i && <p className="mt-3 text-slate-700 text-sm leading-relaxed">{f.a}</p>}
                </button>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/faq/" className="inline-flex items-center gap-1 text-orange-600 font-semibold hover:underline">View all FAQs <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-14 md:py-20 bg-slate-900 text-white">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-5xl font-black">Ready to Protect Your BMW?</h2>
            <p className="mt-3 text-slate-300 text-lg max-w-2xl mx-auto">Get a fast quote and choose the right warranty cover for your vehicle.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button onClick={scrollToQuote} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-6 text-base">Get your free quote</Button>
              <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="inline-flex items-center gap-2 px-6 py-4 rounded-md border-2 border-white text-white font-semibold hover:bg-white hover:text-slate-900 transition-colors">
                <Phone className="w-5 h-5" /> {PHONE}
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-6 py-4 rounded-md bg-[#25D366] text-white font-semibold hover:opacity-90">
                <MessageCircle className="w-5 h-5" /> WhatsApp us
              </a>
            </div>
            <ul className="mt-10 grid sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-6 text-sm text-slate-200 max-w-3xl mx-auto">
              {[
                'Fast quote in 60 seconds',
                'Flexible warranty plans',
                'Pay monthly or in full',
                '1, 2 or 3 year options',
                'Mechanical & electrical cover',
                'EV & hybrid cover options',
              ].map(t => (
                <li key={t} className="flex items-start gap-2 justify-center sm:justify-start"><Check className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />{t}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-950 text-slate-300 py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-8">
              <div className="md:col-span-1">
                <img src={buyawarrantyLogo} alt="BuyaWarranty" className="h-10 w-auto bg-white p-1.5 rounded" />
                <p className="mt-4 text-sm text-slate-400">Helping UK drivers protect themselves from unexpected repair bills with flexible warranty cover.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-3">Quick Links</h3>
                <ul className="space-y-2 text-sm">
                  {[
                    ['Home','/'],
                    ['Discounts & Offers','/discounts-offers/'],
                    ['Customer Login','/auth/'],
                    ['Make a Claim','/make-a-claim/'],
                    ['Contact Us','/contact-us/'],
                    ['Car Warranty','/car-extended-warranty/'],
                    ['Van Warranty','/van-warranty/'],
                    ['EV Warranty','/ev-warranty/'],
                    ['Motorbike Warranty','/motorcycle-warranty/'],
                    ['Extended Warranty','/car-extended-warranty/'],
                    ['Warranty Types','/warranty-types/'],
                  ].map(([l, h]) => (
                    <li key={l}><Link to={h} className="hover:text-white">{l}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold mb-3">Legal</h3>
                <ul className="space-y-2 text-sm">
                  {[
                    ['Privacy Policy','/privacy/'],
                    ['Terms & Conditions','/terms/'],
                    ['Cookie Policy','/cookies/'],
                    ['Complaints Procedure','/complaints/'],
                    ['Modern Slavery Statement','/terms/'],
                  ].map(([l, h]) => (
                    <li key={l}><Link to={h} className="hover:text-white">{l}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold mb-3">Help</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/faq/" className="hover:text-white">FAQ's</Link></li>
                  <li>Sales Enquiries: <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="hover:text-white">{PHONE}</a></li>
                  <li>Claims Hotline: <a href="tel:03302295045" className="hover:text-white">0330 229 5045</a></li>
                  <li>Email: <a href="mailto:info@buyawarranty.co.uk" className="hover:text-white">info@buyawarranty.co.uk</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-10 pt-6 border-t border-slate-800 text-xs text-slate-500 leading-relaxed">
              BuyaWarranty is an independent warranty provider and is not affiliated with BMW. Cover levels, limits, exclusions and eligibility criteria apply. Please refer to the policy documents for full terms and conditions.
            </div>
          </div>
        </footer>

        {/* Sticky mobile CTA */}
        <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] p-3">
          <div className="flex gap-2">
            <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="flex items-center justify-center w-12 h-12 rounded-md border-2 border-slate-900 text-slate-900">
              <Phone className="w-5 h-5" />
            </a>
            <Button onClick={scrollToQuote} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold h-12">Get quote</Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BMWExtendedWarrantyLanding;
