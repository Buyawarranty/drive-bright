import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check, Phone, MessageCircle, Star, Shield, Wrench, Zap, Cpu, ChevronDown,
  Car, Truck, Battery, Bike, Plane, RefreshCw, Settings2, MapPin, ArrowRight,
  Gauge, ChevronLeft, FileText, Users, Award, Cog, Thermometer, CircleDot,
  Fuel, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveWithTimestamp } from '@/utils/localStorage';
import { trackButtonClick, trackQuoteRequest } from '@/utils/analytics';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import pandaMascot from '@/assets/panda-car-warranty-transparent.png';
import bmwHero from '@/assets/bmw-used-car-extended-warranty-uk.webp';
import bmwHighMileage from '@/assets/bmw-high-mileage-transparent.png';

const PHONE = '0330 229 5040';
const WHATSAPP_URL = 'https://wa.me/443302295040';

const faqs = [
  { q: 'How much does a BMW extended warranty cost?', a: 'BMW cover starts from £19/month for eligible vehicles. Final pricing depends on model, mileage, claim limit and plan length.' },
  { q: 'What BMW models and ages are covered?', a: 'Cover is available for most BMW petrol, diesel, hybrid and EV models up to 15 years old and 150,000 miles, subject to eligibility.' },
  { q: 'Is my car too old or has too many miles?', a: 'We cover vehicles up to 15 years old and up to 150,000 miles. Higher-mileage BMWs may still be eligible for selected plans — enter your reg for an instant check.' },
  { q: 'Can I use my own garage?', a: 'Yes. You can choose any VAT-registered garage in the UK for repairs, subject to our claims process and policy terms.' },
  { q: 'What\u2019s covered in my warranty?', a: 'Cover varies by plan and may include mechanical, electrical, tech and safety components. Full inclusions, limits and exclusions are detailed in your policy documents.' },
  { q: 'How do I make a claim?', a: 'Contact our claims team, share the diagnostic report from your chosen garage, and we\u2019ll review the claim against your plan terms and respond quickly.' },
  { q: 'What should I do if my car has an issue?', a: 'Stop driving if it\u2019s unsafe, take the car to a VAT-registered garage for diagnosis, then contact our claims team before any repair work starts.' },
  { q: 'What about modified vehicles?', a: 'Standard manufacturer options are fine. Performance modifications or non-standard parts may not be eligible — please check before purchasing.' },
  { q: 'Do I need a full service history?', a: 'A documented service history is recommended and helps support any future claim, but it is not always required to start cover.' },
  { q: 'What claim limit is right for me?', a: 'Higher claim limits suit higher-value or more complex BMWs. We\u2019ll help you pick a sensible limit during the quote journey.' },
  { q: 'Are diagnostics covered?', a: 'Diagnostic costs can be included where they identify a covered fault, subject to your selected plan and policy terms.' },
  { q: 'Is there a 30-day wait for new customers?', a: 'A short initial waiting period applies to new policies. Full details are set out in your policy documents before you buy.' },
];

const Stars = ({ size = 14 }: { size?: number }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(i => <Star key={i} className="fill-[#00b67a] text-[#00b67a]" style={{ width: size, height: size }} />)}
  </div>
);

const TrustpilotStrip = ({ light = false }: { light?: boolean }) => (
  <div className="inline-flex items-center gap-2">
    <Stars size={16} />
    <span className={`text-xs font-extrabold uppercase tracking-widest ${light ? 'text-white' : 'text-slate-700'}`}>
      Rated Excellent on Trustpilot
    </span>
  </div>
);

type Step = 1 | 2 | 3 | 4;

const BMWExtendedWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [regNumber, setRegNumber] = useState('');
  const [mileageBand, setMileageBand] = useState<'under' | 'over' | ''>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const scrollToQuote = () => {
    trackButtonClick('bmw_ppc_cta');
    document.getElementById('quote-module')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goNext = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!regNumber.trim()) {
        setErrorMsg('Please enter your vehicle registration to continue.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!mileageBand) {
        setErrorMsg('Please select your approximate mileage.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!name.trim() || !email.trim() || !phone.trim()) {
        setErrorMsg('Please complete your name, email and phone.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      submit();
    }
  };

  const submit = async () => {
    setIsSubmitting(true);
    trackQuoteRequest();
    try {
      const mileage = mileageBand === 'under' ? '100000' : '130000';
      let extra: any = {};
      try {
        const { data } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registration: regNumber } });
        if (data?.make) {
          extra = {
            make: data.make, model: data.model, fuelType: data.fuelType, transmission: data.transmission,
            year: data.yearOfManufacture || data.year, vehicleType: data.vehicleType,
          };
        }
      } catch { /* lookup failure ok */ }

      const vehicleData = {
        regNumber: regNumber.toUpperCase(),
        mileage,
        firstName: name.split(' ')[0] || name,
        lastName: name.split(' ').slice(1).join(' '),
        email, phone, postcode,
        ...extra,
      };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      saveWithTimestamp('warrantyJourneyState', JSON.stringify({ vehicleData, formData: vehicleData, currentStep: 2, selectedPlan: null }));
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      setStep(4);
    } catch (e) {
      console.error(e);
      toast({ title: 'Something went wrong', description: 'Please try again or call us.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToQuoteOptions = () => {
    navigate('/?step=2');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const heroBullets = [
    'Fast quote in 60 seconds',
    'Flexible warranty plans',
    'Pay monthly or in full',
    '1, 2 or 3 year cover options',
    'Mechanical, electrical, tech & safety',
    'EV and hybrid cover options',
  ];

  const stepLabels: Array<{ id: Step; label: string }> = [
    { id: 1, label: 'Registration' },
    { id: 2, label: 'Mileage' },
    { id: 3, label: 'Details' },
    { id: 4, label: 'Quote' },
  ];

  return (
    <>
      <SEOHead
        title="BMW Extended Warranty from £19/month | Instant Quote | BuyaWarranty"
        description="Affordable BMW extended warranty from £19/month. Flexible plans covering mechanical, electrical, tech and EV components. Instant online quote in 60 seconds."
        keywords="BMW extended warranty, BMW warranty UK, used BMW warranty, BMW car warranty"
        canonical="https://buyawarranty.co.uk/bmw-extended-warranty/"
        geoRegion="GB" geoPlacename="United Kingdom"
      />
      <OrganizationSchema />
      <WebPageSchema name="BMW Extended Warranty" description="BMW extended warranty cover from £19/month." url="https://buyawarranty.co.uk/bmw-extended-warranty/" />
      <FAQSchema faqs={faqs.map(f => ({ question: f.q, answer: f.a }))} />
      <ProductSchema name="BMW Extended Warranty" description="Flexible BMW warranty cover" price="19" brand="BuyaWarranty" category="Vehicle Warranty" image="https://buyawarranty.co.uk/logo.png" availability="https://schema.org/InStock" areaServed="GB" />
      <BreadcrumbSchema items={[{ name: 'Home', url: 'https://buyawarranty.co.uk/' }, { name: 'BMW Extended Warranty', url: 'https://buyawarranty.co.uk/bmw-extended-warranty/' }]} />

      <div className="min-h-screen bg-white text-slate-900 pb-24 md:pb-0 font-sans">
        {/* PPC Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center">
              <img src={buyawarrantyLogo} alt="BuyaWarranty" className="h-8 md:h-9 w-auto" loading="eager" />
            </Link>
            <div className="hidden md:flex items-center gap-3">
              <TrustpilotStrip />
            </div>
            <div className="flex items-center gap-2">
              <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="hidden sm:flex items-center gap-1.5 text-slate-800 font-bold text-sm hover:text-orange-600">
                <Phone className="w-4 h-4" /> {PHONE}
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener" className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#25D366] text-white text-xs font-extrabold uppercase tracking-wider hover:opacity-90">
                <MessageCircle className="w-4 h-4" /> WhatsApp Us
              </a>
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold uppercase tracking-wider text-xs">Get my quote</Button>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="bg-white pt-8 md:pt-14 pb-10 md:pb-16 px-4 border-b border-slate-100">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* LEFT: copy + quote module */}
            <div>
              <div className="mb-4"><TrustpilotStrip /></div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0F172A] leading-[1.05] tracking-tight">
                BMW Extended Warranty <span className="text-[#F97316]">from £19/month</span>
              </h1>
              <p className="mt-4 text-slate-600 text-base md:text-lg">
                Affordable BMW warranty cover you can trust in 60 seconds.
              </p>
              <p className="mt-2 text-slate-500 text-sm md:text-base">
                Get a fast quote for flexible BMW warranty cover designed to help protect you from unexpected repair bills.
              </p>

              <ul className="mt-5 grid sm:grid-cols-2 gap-y-2 gap-x-4">
                {heroBullets.map(b => (
                  <li key={b} className="flex items-start gap-2 text-sm text-slate-700 font-medium">
                    <Check className="w-4 h-4 text-[#00b67a] mt-0.5 flex-shrink-0" />{b}
                  </li>
                ))}
              </ul>

              {/* Quote module */}
              <div id="quote-module" className="mt-6 bg-white rounded-2xl shadow-[0_20px_50px_-15px_rgba(15,23,42,0.25)] border border-slate-200 p-5 md:p-6">
                {/* Stepper */}
                <div className="flex items-center justify-between mb-5">
                  {stepLabels.map((s, i) => {
                    const active = step === s.id;
                    const done = step > s.id;
                    return (
                      <React.Fragment key={s.id}>
                        <div className="flex flex-col items-center min-w-0">
                          <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[11px] md:text-xs font-black ${
                            active ? 'bg-[#F97316] text-white' : done ? 'bg-[#00b67a] text-white' : 'bg-slate-200 text-slate-500'
                          }`}>{done ? <Check className="w-4 h-4" /> : s.id}</div>
                          <span className={`mt-1 text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest ${active ? 'text-[#0F172A]' : 'text-slate-400'}`}>{s.label}</span>
                        </div>
                        {i < stepLabels.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 md:mx-2 ${step > s.id ? 'bg-[#00b67a]' : 'bg-slate-200'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Step content */}
                {step === 1 && (
                  <div>
                    <p className="text-sm font-extrabold text-[#0F172A] mb-3">Enter your vehicle registration</p>
                    <div className="flex h-[68px] md:h-[76px] bg-[#FBBF24] rounded-xl border-2 border-black overflow-hidden shadow-inner">
                      <div className="w-12 md:w-14 bg-[#0052B4] flex flex-col items-center justify-center text-white">
                        <span className="text-base leading-none">🇬🇧</span>
                        <span className="text-[10px] font-black leading-none mt-1 tracking-tight">UK</span>
                      </div>
                      <input
                        type="text"
                        value={regNumber}
                        onChange={e => setRegNumber(e.target.value.replace(/[^A-Za-z0-9]/g,'').toUpperCase())}
                        placeholder="ENTER REG"
                        maxLength={8}
                        aria-label="Vehicle registration"
                        className="flex-1 bg-transparent text-center text-2xl md:text-3xl font-black uppercase tracking-[0.15em] placeholder:text-black/25 focus:outline-none min-w-0"
                      />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="text-sm font-extrabold text-[#0F172A] mb-3">What's your approximate mileage?</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { id: 'under', label: 'Under 120,000 miles' },
                        { id: 'over', label: 'Over 120,000 miles' },
                      ] as const).map(o => (
                        <button
                          key={o.id}
                          onClick={() => setMileageBand(o.id)}
                          className={`p-4 rounded-xl border-2 text-sm font-bold text-left transition-all ${
                            mileageBand === o.id
                              ? 'border-[#F97316] bg-orange-50 text-[#0F172A]'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <Gauge className="w-5 h-5 mb-1 text-[#F97316]" />
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500">Vehicles may be eligible up to 150,000 miles and 15 years old, subject to plan terms.</p>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <p className="text-sm font-extrabold text-[#0F172A] mb-3">Where should we send your quote?</p>
                    <div className="grid gap-3">
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="px-4 py-3 rounded-lg border border-slate-200 focus:border-[#F97316] focus:outline-none text-sm" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="px-4 py-3 rounded-lg border border-slate-200 focus:border-[#F97316] focus:outline-none text-sm" />
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9+\s]/g,''))} placeholder="Phone number" className="px-4 py-3 rounded-lg border border-slate-200 focus:border-[#F97316] focus:outline-none text-sm" />
                      <input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())} placeholder="Postcode (optional)" className="px-4 py-3 rounded-lg border border-slate-200 focus:border-[#F97316] focus:outline-none text-sm" />
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="text-center py-2">
                    <div className="w-14 h-14 rounded-full bg-[#00b67a] text-white flex items-center justify-center mx-auto mb-3">
                      <Check className="w-7 h-7" />
                    </div>
                    <p className="text-base font-black text-[#0F172A]">Your BMW quote request is ready</p>
                    <p className="mt-2 text-sm text-slate-600">Thanks. We'll use your details to show suitable warranty options for your BMW.</p>
                    <Button onClick={goToQuoteOptions} className="w-full mt-5 bg-[#F97316] hover:bg-[#EA580C] text-white font-black uppercase tracking-wider py-5 rounded-xl">
                      View my cover options <ArrowRight className="ml-1 w-5 h-5" />
                    </Button>
                    <p className="mt-3 text-xs text-slate-500">Or speak to an expert: <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="text-[#F97316] font-bold">{PHONE}</a></p>
                  </div>
                )}

                {errorMsg && step !== 4 && (
                  <p className="mt-3 text-xs text-red-600 font-semibold">{errorMsg}</p>
                )}

                {step !== 4 && (
                  <div className="mt-5 flex items-center gap-3">
                    {step > 1 && (
                      <button onClick={() => { setErrorMsg(''); setStep((step - 1) as Step); }} className="text-xs font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                    )}
                    <Button
                      onClick={goNext}
                      disabled={isSubmitting}
                      className="flex-1 bg-[#F97316] hover:bg-[#EA580C] text-white font-black uppercase tracking-wider py-5 rounded-xl shadow-lg shadow-orange-500/25"
                    >
                      {isSubmitting ? 'Working…' : step === 3 ? 'Get my instant price' : 'Continue'}
                      <ArrowRight className="ml-1 w-4 h-4" />
                    </Button>
                  </div>
                )}

                <p className="mt-3 text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest">
                  No obligation · Quick online quote · Cover levels vary
                </p>
              </div>

              {/* Reassurance card */}
              <div className="mt-5 bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-bold text-[#0F172A]">Fair price. Fast quote. No surprises.</p>
                <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="text-sm font-bold text-[#F97316] hover:underline inline-flex items-center gap-1">
                  <Phone className="w-4 h-4" /> {PHONE}
                </a>
              </div>
            </div>

            {/* RIGHT: BMW image + panda + vehicle icons */}
            <div className="order-first lg:order-last">
              <div className="relative">
                <img src={bmwHero} alt="Premium BMW with extended warranty cover" className="w-full h-auto rounded-2xl" loading="eager" />
                <img src={pandaMascot} alt="" aria-hidden="true" className="absolute -bottom-4 -right-2 w-20 md:w-28 h-auto" loading="lazy" />
              </div>
              <div className="mt-6 grid grid-cols-5 gap-2 md:gap-3">
                {[
                  { I: Car, l: 'Cars' },
                  { I: Truck, l: 'Vans' },
                  { I: Zap, l: 'Hybrid' },
                  { I: Battery, l: 'EV' },
                  { I: Bike, l: 'Motorbikes' },
                ].map(({ I, l }) => (
                  <div key={l} className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-xl py-3">
                    <I className="w-5 h-5 text-[#0F172A]" />
                    <span className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-600">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip — review snippets */}
        <section className="bg-white py-8 border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-4 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {['Easy to get a quote.','Helpful customer service.','Clear warranty options.','Simple and straightforward.'].map(s => (
              <div key={s} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <Stars />
                <p className="text-sm text-slate-700 mt-2 font-medium">"{s}"</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 1: What does BMW warranty cover */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">What does BMW warranty cover?</h2>
              <p className="mt-3 text-slate-600">Flexible cover options for the parts and systems that matter most. Cover levels and limits vary by plan.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {[
                { I: Cog, t: 'Engine' },
                { I: Settings2, t: 'Gearbox' },
                { I: Zap, t: 'Electrical systems' },
                { I: Thermometer, t: 'Cooling system' },
                { I: CircleDot, t: 'Braking system' },
                { I: Gauge, t: 'Steering system' },
                { I: Fuel, t: 'Fuel system' },
                { I: Battery, t: 'Hybrid / EV components' },
              ].map(({ I, t }) => (
                <div key={t} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-[#F97316] transition-all flex flex-col items-center text-center">
                  <div className="w-11 h-11 rounded-lg bg-[#0F172A] text-white flex items-center justify-center mb-3">
                    <I className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-sm text-[#0F172A]">{t}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 text-center mt-6 bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 max-w-3xl mx-auto">
              Policy levels and cover limits vary. Full terms and conditions apply.
            </p>
          </div>
        </section>

        {/* Section 2: Why BMW owners choose */}
        <section className="py-16 md:py-20 bg-slate-50 border-y border-slate-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">Why BMW owners choose BuyaWarranty</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { I: Award, t: 'Specialists in Extended Warranty Cover', d: 'We focus on what matters most — helping you protect your BMW from unexpected repair bills.' },
                { I: Users, t: 'Independent & Customer Focused', d: 'We work for you, not the manufacturers or garages.' },
                { I: Phone, t: 'UK-Based Support You Can Rely On', d: 'Friendly experts ready to help whenever you need us.' },
              ].map(({ I, t, d }) => (
                <div key={t} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-[#F97316] text-white flex items-center justify-center mb-4">
                    <I className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-lg text-[#0F172A] mb-2">{t}</h3>
                  <p className="text-sm text-slate-600">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center"><TrustpilotStrip /></div>
          </div>
        </section>

        {/* Section 3: BMW models we cover */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">BMW models we cover</h2>
              <p className="mt-3 text-slate-600">Cover available for most BMW models and engine types, subject to eligibility.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {['1 Series','3 Series','5 Series','X1 / X3 / X5','7 Series','M Series','i Series / Hybrid / EV','And more'].map(m => (
                <div key={m} className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center hover:border-[#F97316] hover:shadow transition-all">
                  <Car className="w-5 h-5 text-[#F97316] mx-auto mb-2" />
                  <p className="text-sm font-bold text-[#0F172A]">{m}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <button onClick={scrollToQuote} className="inline-flex items-center gap-1 text-[#F97316] font-extrabold uppercase tracking-wider text-sm hover:underline">
                View all BMW models we cover <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Section 4: How it works */}
        <section className="py-16 md:py-20 bg-slate-50 border-y border-slate-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">How it works</h2>
              <p className="mt-3 text-slate-600">Protection in 4 simple steps.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { n: '01', t: 'Enter your reg', d: 'Tell us your BMW registration so we can start your quote.' },
                { n: '02', t: 'Confirm mileage', d: 'Choose your approximate mileage so we can check suitable options.' },
                { n: '03', t: 'Add your details', d: 'Tell us where to send your quote and cover information.' },
                { n: '04', t: 'Choose your cover', d: 'Review available options and choose the plan that works for you.' },
              ].map(s => (
                <div key={s.n} className="bg-white rounded-2xl border border-slate-200 p-6 relative">
                  <span className="text-[#F97316] font-black text-xs tracking-widest">{s.n}</span>
                  <h3 className="font-black text-lg text-[#0F172A] mt-2">{s.t}</h3>
                  <p className="mt-2 text-sm text-slate-600">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Everything You Need, Covered */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">Everything You Need, Covered</h2>
              <p className="mt-3 text-slate-600">Choose flexible warranty cover for your BMW, with plan levels and cover limits clearly explained.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { I: Wrench, t: 'Mechanical & Electrical', items: ['Engine components','Gearbox components','Steering and suspension','Cooling and fuel system','Electrical components'] },
                { I: Cpu, t: 'Tech & Safety', items: ['Sensors','Safety systems','Infotainment components','Convenience features','Plan limits apply'] },
                { I: Shield, t: 'Plan Benefits', items: ['Flexible payment options','Monthly or annual payment','1, 2 or 3 year cover options','Clear terms','Support when you need help'] },
                { I: Battery, t: 'EV & Hybrid', items: ['EV and hybrid options available','Electric components','Charging-related components where covered','Plan limits and exclusions apply'] },
              ].map(({ I, t, items }) => (
                <div key={t} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-[#0F172A] group-hover:bg-[#F97316] text-white flex items-center justify-center mb-5 transition-colors">
                    <I className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-base text-[#0F172A] mb-3">{t}</h3>
                  <ul className="space-y-2">
                    {items.map(x => (
                      <li key={x} className="flex items-start gap-2 text-xs font-semibold text-slate-600">
                        <Check className="w-3 h-3 text-[#00b67a] mt-0.5 flex-shrink-0" />{x}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold uppercase tracking-wider px-8 py-6">Get my quote</Button>
            </div>
          </div>
        </section>

        {/* Section 6: Flexible Plans */}
        <section className="py-16 md:py-20 bg-slate-50 border-y border-slate-100">
          <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-10 items-center">
            <div className="order-2 lg:order-1">
              <img src={pandaMascot} alt="BuyaWarranty mascot" className="w-full max-w-sm mx-auto h-auto" loading="lazy" />
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-flex items-center gap-2 text-[10px] font-extrabold text-[#F97316] uppercase tracking-widest mb-2">
                Easy options
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">Flexible Warranty Plans</h2>
              <p className="mt-3 text-slate-600 text-lg">Choose warranty cover that works for your vehicle, budget and driving needs.</p>
              <ul className="mt-5 space-y-2.5">
                {['Pay monthly or in full','Choose cover that works for you','1, 2 or 3 year cover options','Save with longer-term plans where available','From just £19/month for eligible vehicles']
                  .map(t => (
                    <li key={t} className="flex items-start gap-2 text-slate-800">
                      <Check className="w-5 h-5 text-[#00b67a] mt-0.5 flex-shrink-0" />{t}
                    </li>
                  ))}
              </ul>
              <Button onClick={scrollToQuote} className="mt-6 bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold uppercase tracking-wider px-7 py-5">Get your instant quote</Button>
            </div>
          </div>
        </section>

        {/* Section 7: High mileage */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
            <img src={bmwHighMileage} alt="High mileage BMW warranty cover" className="w-full max-w-md mx-auto h-auto" loading="lazy" />
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">High mileage, no problem</h2>
              <p className="mt-4 text-slate-600 text-lg">Own an older or higher-mileage BMW? Our warranty options can help you find suitable cover, subject to vehicle eligibility and plan terms.</p>
              <div className="mt-6 inline-flex gap-8 items-center">
                <div>
                  <div className="text-3xl font-black text-[#0F172A]">15 yrs</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Max age</div>
                </div>
                <div className="w-px h-10 bg-slate-200" />
                <div>
                  <div className="text-3xl font-black text-[#0F172A]">150k</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Mileage limit</div>
                </div>
              </div>
              <div className="mt-6">
                <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold uppercase tracking-wider px-8 py-6">Get your instant quote</Button>
                <p className="mt-3 text-[11px] text-slate-500">Eligibility, cover limits and exclusions apply.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8: What's included */}
        <section className="py-16 md:py-20" style={{ background: 'linear-gradient(135deg, #e6f0ff 0%, #fff7e6 100%)' }}>
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">What's Included?</h2>
              <p className="mt-3 text-slate-700">Rest assured everything is covered if it breaks, where included in your selected plan and subject to policy terms.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { I: Shield, t: 'Complete Protection', d: 'Cover options designed to help protect against unexpected repair costs.' },
                { I: Wrench, t: 'Instant Claims Support', d: 'Get support when something goes wrong.' },
                { I: ListChecks, t: 'Clear Terms', d: 'Simple cover options with clear limits and exclusions.' },
              ].map(({ I, t, d }) => (
                <div key={t} className="bg-white/90 backdrop-blur rounded-2xl p-6 shadow-md border border-white">
                  <div className="w-12 h-12 rounded-xl bg-[#F97316] text-white flex items-center justify-center mb-4">
                    <I className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-lg text-[#0F172A] mb-2">{t}</h3>
                  <p className="text-slate-600 text-sm">{d}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold uppercase tracking-wider px-8 py-6">Secure your warranty</Button>
            </div>
          </div>
        </section>

        {/* Section 9: Additional cover */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">Additional Cover Options</h2>
              <p className="mt-3 text-slate-600">Tailor your warranty with optional extras, depending on your selected plan and vehicle eligibility.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { I: MapPin, t: 'Vehicle Recovery', d: 'Help when your vehicle breaks down and you need recovery support.' },
                { I: Plane, t: 'Europe Cover', d: 'Extend your protection when driving in selected European countries.' },
                { I: Car, t: 'Vehicle Rental', d: 'Temporary vehicle hire support may be available while your car is being repaired.' },
                { I: RefreshCw, t: 'Transfer Cover', d: 'Transfer your warranty to a new owner if you sell your vehicle, subject to terms.' },
                { I: Settings2, t: 'Bespoke Warranty', d: 'Create a warranty plan that better suits your vehicle, mileage and driving needs.' },
              ].map(({ I, t, d }) => (
                <div key={t} className="bg-slate-50 rounded-xl p-5 border border-slate-100 hover:border-[#F97316] hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-lg bg-[#0F172A] text-white flex items-center justify-center mb-3">
                    <I className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-sm text-[#0F172A] mb-1.5">{t}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 text-center mt-6 max-w-2xl mx-auto">Additional cover options are subject to availability, selected plan, vehicle eligibility, cover limits and policy terms.</p>
            <div className="text-center mt-6">
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold uppercase tracking-wider px-8 py-6">View cover options</Button>
            </div>
          </div>
        </section>

        {/* Section 10: FAQ */}
        <section className="py-16 md:py-20 bg-slate-50 border-y border-slate-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] tracking-tight">FAQ's</h2>
              <p className="mt-3 text-slate-600">First answers to the most common questions about our warranty services.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {faqs.map((f, i) => (
                <button key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-[#F97316] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-bold text-[#0F172A]">{f.q}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180 text-[#F97316]' : ''}`} />
                  </div>
                  {openFaq === i && <p className="mt-3 text-slate-600 text-sm leading-relaxed">{f.a}</p>}
                </button>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/faq/" className="inline-flex items-center gap-1 text-[#F97316] font-extrabold uppercase tracking-wider text-sm hover:underline">View all FAQs <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#0F172A] py-20 md:py-24 px-4 text-center overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#F97316]/15 blur-[140px] rounded-full pointer-events-none" />
          <div className="max-w-3xl mx-auto relative">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">Ready to Protect Your BMW?</h2>
            <p className="mt-4 text-slate-400 text-base md:text-lg max-w-2xl mx-auto">Get a fast quote and choose the right warranty cover for your vehicle.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-black uppercase tracking-wider px-10 py-6 text-base">Get your free quote</Button>
              <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="inline-flex items-center gap-2 px-6 py-4 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold">
                <Phone className="w-5 h-5" /> {PHONE}
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-6 py-4 rounded-md bg-[#25D366] text-white font-bold hover:opacity-90">
                <MessageCircle className="w-5 h-5" /> WhatsApp us
              </a>
            </div>
            <ul className="mt-12 grid sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-6 text-sm text-slate-300 max-w-3xl mx-auto">
              {['Fast quote in 60 seconds','Flexible warranty plans','Pay monthly or in full','1, 2 or 3 year options','Mechanical & electrical cover','EV & hybrid cover options']
                .map(t => (
                  <li key={t} className="flex items-start gap-2 justify-center sm:justify-start">
                    <Check className="w-4 h-4 text-[#00b67a] mt-1 flex-shrink-0" />{t}
                  </li>
                ))}
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-950 text-slate-300 py-12">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-8">
              <div className="md:col-span-1">
                <img src={buyawarrantyLogo} alt="BuyaWarranty" className="h-10 w-auto bg-white p-1.5 rounded" />
                <p className="mt-4 text-sm text-slate-400">Helping UK drivers protect themselves from unexpected repair bills with flexible warranty cover.</p>
              </div>
              <div>
                <h3 className="text-white font-extrabold uppercase tracking-wider text-xs mb-3">Quick Links</h3>
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
                <h3 className="text-white font-extrabold uppercase tracking-wider text-xs mb-3">Legal</h3>
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
                <h3 className="text-white font-extrabold uppercase tracking-wider text-xs mb-3">Help</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/faq/" className="hover:text-white">FAQ's</Link></li>
                  <li>Sales Enquiries: <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="hover:text-white">{PHONE}</a></li>
                  <li>Claims Hotline: <a href="tel:03302295045" className="hover:text-white">0330 229 5045</a></li>
                  <li>Email: <a href="mailto:info@buyawarranty.co.uk" className="hover:text-white">info@buyawarranty.co.uk</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-10 pt-6 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed">
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
            <Button onClick={scrollToQuote} className="flex-1 bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold uppercase tracking-wider h-12">Get quote</Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BMWExtendedWarrantyLanding;
