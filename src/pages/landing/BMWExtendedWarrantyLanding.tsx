import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check, Phone, MessageCircle, Star, Shield, Wrench, Zap, Cpu, ChevronDown,
  Car, Truck, Battery, Bike, Plane, RefreshCw, Settings2, MapPin, ArrowRight,
  Gauge, ChevronLeft, FileText, Users, Headphones, Cog, Thermometer, CircleDot,
  Fuel, ListChecks, ChevronRight, User, Globe, MoreHorizontal, Leaf,
  Facebook, Instagram, Youtube,
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
import pandaLaptop from '@/assets/404-panda.png';
import bmwHero from '@/assets/bmw-used-car-extended-warranty-uk.webp';
import bmwHighMileage from '@/assets/bmw-high-mileage-transparent.png';
import TrustpilotSliderWidget from '@/components/TrustpilotSliderWidget';
import TrustpilotMicroWidget from '@/components/TrustpilotMicroWidget';
import MileageQuickSelect from '@/components/MileageQuickSelect';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';
import bmw1Series from '@/assets/bmw-models/bmw-1-series-extended-warranty.jpg';
import bmw3Series from '@/assets/bmw-models/bmw-3-series-extended-warranty.jpg';
import bmw5Series from '@/assets/bmw-models/bmw-5-series-extended-warranty.jpg';
import bmwXSeries from '@/assets/bmw-models/bmw-x-series-suv-extended-warranty.jpg';
import bmw7Series from '@/assets/bmw-models/bmw-7-series-extended-warranty.jpg';
import bmwISeries from '@/assets/bmw-models/bmw-i-series-ev-hybrid-extended-warranty.jpg';

const bmwModels = [
  { label: '1 Series', examples: '118i, 120d, 116d', img: bmw1Series, alt: 'BMW 1 Series extended warranty cover — 118i, 120d hatchback' },
  { label: '3 Series', examples: '320i, 330e, 330d', img: bmw3Series, alt: 'BMW 3 Series extended warranty cover — 320i, 330e, 330d saloon and Touring' },
  { label: '5 Series', examples: '520d, 530e, 540i', img: bmw5Series, alt: 'BMW 5 Series extended warranty cover — 520d, 530e, 540i executive saloon' },
  { label: 'X1 / X3 / X5', examples: 'sDrive, xDrive SUVs', img: bmwXSeries, alt: 'BMW X1, X3 and X5 SUV extended warranty cover — sDrive and xDrive variants' },
  { label: '7 Series', examples: '730d, 740i, 750e', img: bmw7Series, alt: 'BMW 7 Series luxury saloon extended warranty cover — 730d, 740i, 750e' },
  { label: 'i Series (EV)', examples: 'i3, i4, iX, iX3', img: bmwISeries, alt: 'BMW i Series electric vehicle extended warranty cover — i3, i4, iX and iX3' },
];

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
  const [showCallbackModal, setShowCallbackModal] = useState(false);


  const scrollToQuote = () => {
    trackButtonClick('bmw_ppc_cta');
    document.getElementById('quote-module')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goNext = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!regNumber.trim()) { setErrorMsg('Please enter your vehicle registration to continue.'); return; }
      if (!mileageBand) { setErrorMsg('Please select your approximate mileage.'); return; }
      setStep(2);
    } else if (step === 2) {
      if (!name.trim() || !email.trim() || !phone.trim()) { setErrorMsg('Please complete your name, email and phone.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrorMsg('Please enter a valid email address.'); return; }
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
          extra = { make: data.make, model: data.model, fuelType: data.fuelType, transmission: data.transmission, year: data.yearOfManufacture || data.year, vehicleType: data.vehicleType };
        }
      } catch { /* ok */ }
      const vehicleData = {
        regNumber: regNumber.toUpperCase(), mileage,
        firstName: name.split(' ')[0] || name, lastName: name.split(' ').slice(1).join(' '),
        email, phone, postcode, ...extra,
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
    } finally { setIsSubmitting(false); }
  };

  const goToQuoteOptions = () => { navigate('/?step=2'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const heroBullets = [
    'Fast quote in 60 seconds',
    'Flexible warranty plans',
    'Pay monthly or in full',
    '1, 2 or 3 year cover options',
    'Mechanical, electrical, tech and safety cover options',
    'EV and hybrid cover options available',
  ];

  // 4-step indicator (reg/mileage combined into step 1 visually; details = step 2; quote = step 3 final)
  // Per reference: stepper shows 1-Registration / 2-Mileage / 3-Details / 4-Quote with reg active.
  const stepLabels = [
    { id: 1, label: 'Registration' },
    { id: 2, label: 'Mileage' },
    { id: 3, label: 'Details' },
    { id: 4, label: 'Quote' },
  ];
  // Map our internal step to visual stepper position
  const visualStep = step === 1 ? (mileageBand ? 2 : 1) : step === 2 ? 3 : step === 4 ? 4 : 1;

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
        <header className="sticky top-0 z-40 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center">
              <img src={buyawarrantyLogo} alt="BuyaWarranty" className="h-8 md:h-10 w-auto" loading="eager" />
            </Link>
            <div className="hidden lg:flex items-center gap-2">
              <Star className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />
              <span className="text-xs font-semibold text-slate-700">Rated Excellent</span>
              <div className="flex items-center gap-0.5 bg-[#00b67a] px-1.5 py-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-white text-white" />)}
              </div>
              <span className="text-xs font-semibold text-slate-700">on Trustpilot</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="hidden md:flex items-center gap-2">
                <div className="w-9 h-9 rounded-full border-2 border-[#F97316] flex items-center justify-center text-[#F97316]">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-bold text-slate-800">{PHONE}</div>
                  <div className="text-[10px] text-slate-500">Call us</div>
                </div>
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener" className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#25D366] text-white text-xs font-bold hover:opacity-90">
                <MessageCircle className="w-4 h-4" /> WhatsApp us
              </a>
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs px-4">Get my quote</Button>
              <Link to="/auth/" className="hidden md:inline-flex items-center gap-1 text-slate-600 text-xs font-semibold hover:text-slate-900">
                <User className="w-4 h-4" /> Login
              </Link>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="bg-white pt-6 md:pt-10 pb-8 md:pb-10 px-4">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-start">
            {/* LEFT */}
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-[#0F172A] leading-[1.02] tracking-tight">
                BMW Extended<br/>Warranty<br/>
                <span className="text-slate-900">from </span><span className="text-[#F97316]">£19/month</span>
              </h1>
              <p className="mt-5 text-slate-700 font-semibold text-base">
                Affordable BMW warranty cover you can trust in 60 seconds.
              </p>
              <p className="mt-2 text-slate-500 text-sm">
                Get a fast quote for flexible BMW warranty cover designed to help protect you from unexpected repair bills.
              </p>

              {/* Quote module */}
              <div id="quote-module" className="mt-6">


                {step === 1 && (
                  <>
                    <div className="flex h-[68px] md:h-[76px] bg-[#FBBF24] rounded-xl border-2 border-black overflow-hidden shadow-inner">
                      <div className="w-12 md:w-14 bg-[#0052B4] flex flex-col items-center justify-center text-white">
                        <span className="text-base leading-none">🇬🇧</span>
                        <span className="text-[10px] font-black leading-none mt-1 tracking-tight">UK</span>
                      </div>
                      <input
                        type="text" value={regNumber}
                        onChange={e => setRegNumber(e.target.value.replace(/[^A-Za-z0-9]/g,'').toUpperCase())}
                        placeholder="ENTER REG" maxLength={8} aria-label="Vehicle registration"
                        className="bg-yellow-400 flex-1 bg-transparent text-center text-2xl md:text-3xl font-black uppercase tracking-[0.15em] placeholder:text-black/25 focus:outline-none min-w-0"
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500 text-center">Protection for vehicles up to 150,000 miles and 15 years.</p>

                    <div className="mt-4">
                      <MileageQuickSelect
                        value={mileageBand === 'under' ? 'under120k' : mileageBand === 'over' ? 'over120k' : ''}
                        onChange={(v) => setMileageBand(v === 'under120k' ? 'under' : v === 'over120k' ? 'over' : '')}
                        onAutoSubmit={() => { setErrorMsg(''); setStep(2); }}
                        isLoading={isSubmitting}
                        isRegValid={regNumber.replace(/\s/g,'').length >= 5}
                      />
                    </div>

                    {/* Pricing Reassurance Panel */}
                    <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-5 py-4 text-center">
                      <h2 className="text-sm sm:text-[17px] font-bold text-[#1B2A4A]">
                        Fair price. Fast quote. No surprises.
                      </h2>
                      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs sm:text-[15px] mt-1.5">
                        <span className="text-gray-600">Speak to an expert:</span>
                        <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="font-semibold text-gray-900 hover:underline">{PHONE}</a>
                        <span className="text-gray-400">or</span>
                        <button onClick={() => setShowCallbackModal(true)} className="text-[#F97316] hover:underline font-medium">
                          Request a callback
                        </button>
                      </div>
                    </div>
                  </>
                )}


                {step === 2 && (
                  <>
                    <p className="text-sm font-bold text-[#0F172A] mb-3">Where should we send your quote?</p>
                    <div className="grid gap-3">
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="px-4 py-3 rounded-lg border border-slate-200 focus:border-[#F97316] focus:outline-none text-sm" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="px-4 py-3 rounded-lg border border-slate-200 focus:border-[#F97316] focus:outline-none text-sm" />
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9+\s]/g,''))} placeholder="Phone number" className="px-4 py-3 rounded-lg border border-slate-200 focus:border-[#F97316] focus:outline-none text-sm" />
                      <input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())} placeholder="Postcode (optional)" className="px-4 py-3 rounded-lg border border-slate-200 focus:border-[#F97316] focus:outline-none text-sm" />
                    </div>
                  </>
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
                  <p className="mt-3 text-xs text-red-600 font-semibold text-center">{errorMsg}</p>
                )}

                {step !== 4 && (
                  <div className="mt-4 flex items-center gap-3">
                    {step > 1 && (
                      <button onClick={() => { setErrorMsg(''); setStep((step - 1) as Step); }} className="text-xs font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                    )}
                    <Button onClick={goNext} disabled={isSubmitting}
                      className="flex-1 bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-5 rounded-lg">
                      {isSubmitting ? 'Working…' : step === 2 ? 'Get my instant price' : 'Continue'}
                      <ArrowRight className="ml-1 w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="mt-3 flex justify-center gap-4 text-[10px] text-slate-400 font-bold">
                  <span className="flex items-center gap-1"><Check className="w-3 h-3 text-[#00b67a]" /> No obligation</span>
                  <span className="flex items-center gap-1"><Check className="w-3 h-3 text-[#00b67a]" /> Quick online quote</span>
                  <span className="flex items-center gap-1"><Check className="w-3 h-3 text-[#00b67a]" /> Cover levels vary</span>
                </div>
              </div>

              <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-sm font-bold text-[#0F172A]">Fair price. Fast quote. No surprises.</p>
                <p className="text-sm text-slate-600 mt-1">Speak to an expert: <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="text-[#F97316] font-bold">{PHONE}</a></p>
              </div>
            </div>

            {/* RIGHT */}
            <div className="order-first lg:order-last">
              <div className="relative">
                <img src={bmwHero} alt="Premium BMW with extended warranty cover" className="w-full h-auto rounded-2xl" loading="eager" />
                <div className="absolute top-3 right-3 bg-white rounded-lg shadow-md border border-slate-100 px-3 py-2 flex items-start gap-2 max-w-[180px]">
                  <Shield className="w-4 h-4 text-[#0F172A] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold text-[#0F172A] leading-tight">Flexible cover for older and newer BMWs</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">subject to eligibility</p>
                  </div>
                </div>
                
              </div>
              <div className="mt-6 grid grid-cols-5 gap-2 md:gap-3 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
                {[
                  { I: Car, l: 'Cars', c: 'text-[#F97316]' },
                  { I: Truck, l: 'Vans', c: 'text-slate-700' },
                  { I: Leaf, l: 'Hybrid', c: 'text-[#00b67a]' },
                  { I: Zap, l: 'EV', c: 'text-blue-500' },
                  { I: Bike, l: 'Motorbikes', c: 'text-slate-700' },
                ].map(({ I, l, c }) => (
                  <div key={l} className="flex flex-col items-center py-2">
                    <I className={`w-6 h-6 ${c}`} />
                    <span className="mt-1 text-[11px] font-bold text-slate-700">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Dark navy trust strip */}
        {/* Trustpilot reviews — same widget as homepage */}
        <section className="bg-white py-8 md:py-10 px-4 border-y border-slate-100">
          <div className="max-w-7xl mx-auto">
            <TrustpilotSliderWidget />
          </div>
        </section>


        {/* What does BMW warranty cover */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A]">What does BMW warranty cover?</h2>
              <p className="mt-2 text-slate-600 text-sm md:text-base">Flexible cover options for the parts and systems that matter most. Cover levels and limits vary by plan.</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3">
              {[
                { I: Cog, t: 'Engine' },
                { I: Settings2, t: 'Gearbox' },
                { I: Zap, t: 'Electrical Systems' },
                { I: Thermometer, t: 'Cooling System' },
                { I: CircleDot, t: 'Braking System' },
                { I: Gauge, t: 'Steering System' },
                { I: Fuel, t: 'Fuel System' },
                { I: Battery, t: 'Hybrid / EV Components' },
              ].map(({ I, t }) => (
                <div key={t} className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 hover:border-[#F97316] hover:shadow transition-all flex flex-col items-center text-center">
                  <I className="w-7 h-7 md:w-8 md:h-8 text-[#0F172A] mb-2" />
                  <p className="font-bold text-[11px] md:text-xs text-[#0F172A] leading-tight">{t}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 bg-orange-50/50 border border-orange-100 rounded-lg py-3 px-4 max-w-2xl mx-auto text-center">
              <p className="text-xs text-slate-700">
                <span className="inline-block w-3.5 h-3.5 rounded-full bg-slate-300 text-white text-[9px] font-black leading-[14px] mr-1">i</span>
                For full inclusions, limits and exclusions, see our{' '}
                <Link to="/terms/" className="text-[#F97316] font-bold underline">Terms &amp; Conditions</Link>
                {' '}and{' '}
                <Link to="/warranty-plan/" className="text-[#F97316] font-bold underline">warranty plan documents</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* Why BMW owners choose BuyaWarranty */}
        <section className="py-12 md:py-16 bg-slate-50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] text-center mb-8">
              Why choose <span className="text-[#F97316]">Buyawarranty</span>?
            </h2>
            <div className="grid md:grid-cols-3 gap-4 md:gap-5">
              {[
                { I: Shield, t: 'Specialists in Extended Warranty Cover', d: 'We focus on what matters most — helping you protect your BMW from unexpected repair bills.' },
                { I: Users, t: 'Independent & Customer Focused', d: 'We work for you, not the manufacturers or garages.' },
                { I: Headphones, t: 'UK-Based Support You Can Rely On', d: 'Friendly experts ready to help whenever you need us.' },
              ].map(({ I, t, d }) => (
                <div key={t} className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-white flex items-center justify-center mb-4">
                    <I className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-base text-[#0F172A] mb-2">{t}</h3>
                  <p className="text-sm text-slate-600">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-7 flex items-center justify-center gap-2">
              <Star className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />
              <span className="text-sm font-bold text-slate-700">Rated Excellent</span>
              <div className="flex items-center gap-0.5 bg-[#00b67a] px-1.5 py-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-white text-white" />)}
              </div>
              <span className="text-sm font-bold text-slate-700">on Trustpilot</span>
            </div>
          </div>
        </section>

        {/* BMW models we cover */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A]">BMW models we cover</h2>
              <p className="mt-2 text-slate-600 text-sm md:text-base">Cover available for most BMW models and engine types, subject to eligibility.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {bmwModels.map(m => (
                <div key={m.label} className="flex flex-col items-center text-center">
                  <div className="w-full aspect-[4/3] bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={m.img}
                      alt={m.alt}
                      title={m.alt}
                      width={768}
                      height={576}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#0F172A]">{m.label}</p>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{m.examples}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <button onClick={scrollToQuote} className="inline-flex items-center gap-1 text-[#F97316] font-bold text-sm hover:underline">
                View all BMW models we cover <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-12 md:py-16 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A]">How it works</h2>
              <p className="mt-2 text-slate-600 text-sm md:text-base">Protection in 4 simple steps.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-3 md:gap-4 items-stretch">
              {[
                { I: FileText, t: 'Enter your reg', d: 'Tell us your BMW registration so we can start your quote.' },
                { I: Gauge, t: 'Confirm mileage', d: 'Choose your approximate mileage so we can check suitable options.' },
                { I: User, t: 'Add your details', d: 'Tell us where to send your quote and cover information.' },
                { I: Shield, t: 'Choose your cover', d: 'Review available options and choose the plan that works for you.' },
              ].map((s, i, arr) => (
                <React.Fragment key={s.t}>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 text-left">
                    <div className="w-11 h-11 rounded-lg bg-slate-50 text-[#F97316] flex items-center justify-center mb-3">
                      <s.I className="w-5 h-5" />
                    </div>
                    <h3 className="font-black text-base text-[#0F172A]">{s.t}</h3>
                    <p className="mt-1.5 text-sm text-slate-600">{s.d}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden md:flex items-center justify-center">
                      <ChevronRight className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* Cover options / what's included */}
        <section className="py-12 md:py-16 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A]">Cover options / what's included</h2>
              <p className="mt-2 text-slate-600 text-sm md:text-base">Choose flexible warranty cover for your BMW. Inclusions and limits vary by plan.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { I: Wrench, t: 'Mechanical & Electrical', items: ['Engine components', 'Transmission & gearbox', 'Electrical systems', 'Cooling system & more'] },
                { I: Cpu, t: 'Tech & Safety', items: ['Sensors & ECU', 'Infotainment systems', 'Air conditioning', 'Driver assistance'] },
                { I: ListChecks, t: 'Plan Benefits', items: ['Flexible cover levels', 'UK-wide garage network', 'Genuine or quality parts', 'Claim policy extras'] },
                { I: Zap, t: 'EV & Hybrid', items: ['Hybrid components', 'High-voltage battery*', 'EV power electronics', 'Electric drive units', '*Subject to plan and eligibility.'] },
              ].map(({ I, t, items }) => (
                <div key={t} className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <I className="w-5 h-5 text-[#0F172A]" />
                    <p className="font-black text-sm text-[#0F172A]">{t}</p>
                  </div>
                  <ul className="space-y-2">
                    {items.map(x => (
                      <li key={x} className={`flex items-start gap-1.5 text-xs ${x.startsWith('*') ? 'text-slate-400 italic' : 'text-slate-600'}`}>
                        {!x.startsWith('*') && <Check className="w-3.5 h-3.5 text-[#00b67a] mt-0.5 flex-shrink-0" />}{x}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Additional cover options */}
        <section className="py-12 md:py-14 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-6">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A]">Additional cover options</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-5xl mx-auto">
              {[
                { I: Truck, t: 'Vehicle Recovery' },
                { I: Globe, t: 'Europe Cover' },
                { I: Car, t: 'Vehicle Rental' },
                { I: RefreshCw, t: 'Transfer Cover' },
                { I: Shield, t: 'Bespoke Warranty' },
              ].map(({ I, t }) => (
                <div key={t} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-2 justify-center hover:border-[#F97316] transition-all">
                  <I className="w-5 h-5 text-[#0F172A] flex-shrink-0" />
                  <p className="text-xs md:text-sm font-bold text-[#0F172A] leading-tight">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 md:py-16 bg-white border-t border-slate-100">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A]">Frequently asked questions</h2>
            </div>
            <div className="space-y-2">
              {faqs.slice(0, 6).map((f, i) => (
                <button key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full text-left bg-white rounded-lg border border-slate-200 p-4 hover:border-[#F97316] transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-sm text-[#0F172A]">{f.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180 text-[#F97316]' : ''}`} />
                  </div>
                  {openFaq === i && <p className="mt-2 text-slate-600 text-xs leading-relaxed">{f.a}</p>}
                </button>
              ))}
            </div>
            <div className="text-center mt-5">
              <Link to="/faq/" className="inline-flex items-center gap-1 text-[#F97316] font-bold text-sm hover:underline">View all FAQs <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </div>
        </section>

        {/* Final dark CTA bar */}
        <section className="bg-[#0F1B3D] py-6 md:py-7">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-3 text-white">
              <Shield className="w-8 h-8 text-white flex-shrink-0" />
              <div>
                <p className="font-black text-base md:text-lg leading-tight">Ready to protect your BMW?</p>
                <p className="text-xs md:text-sm text-white/70 mt-0.5">Get your instant quote in 60 seconds and drive with confidence.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold px-5 h-11">
                Get your free quote <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
              <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="inline-flex items-center gap-2 text-white font-bold text-sm">
                <Phone className="w-4 h-4 text-[#F97316]" /> {PHONE}
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 px-3 h-11 rounded-md bg-[#25D366] text-white text-xs font-bold hover:opacity-90">
                <MessageCircle className="w-4 h-4" /> WhatsApp us
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-100 pt-10 pb-6">
          <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1.1fr] gap-6">
            <div>
              <img src={buyawarrantyLogo} alt="BuyaWarranty" className="h-9 w-auto" />
              <p className="mt-3 text-xs text-slate-600">Helping UK drivers protect themselves from unexpected repair bills with flexible warranty cover.</p>
              <div className="mt-3 flex items-center gap-2">
                <Star className="w-3.5 h-3.5 fill-[#00b67a] text-[#00b67a]" />
                <span className="text-[11px] font-bold text-slate-700">Rated Excellent</span>
                <div className="flex items-center gap-0.5 bg-[#00b67a] px-1 py-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-2.5 h-2.5 fill-white text-white" />)}
                </div>
                <span className="text-[10px] font-bold text-slate-600">on Trustpilot</span>
              </div>
              <div className="mt-4 flex gap-2">
                {[
                  { I: Facebook, url: 'https://facebook.com/buyawarranty', bg: 'bg-[#1877F2]' },
                  { I: Instagram, url: 'https://instagram.com/buyawarranty', bg: 'bg-gradient-to-br from-pink-500 to-orange-500' },
                  { I: Youtube, url: 'https://youtube.com/@buyawarranty', bg: 'bg-[#FF0000]' },
                ].map(({ I, url, bg }, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener" className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center text-white`}>
                    <I className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
            {[
              { h: 'Quick Links', items: [['Home','/'],['Discounts & Offers','/discounts-offers/'],['Customer Login','/auth/'],['Make a Claim','/make-a-claim/'],['Contact Us','/contact-us/'],['Car Warranty','/car-extended-warranty/'],['Van Warranty','/van-warranty/']] },
              { h: '', items: [['EV Warranty','/ev-warranty/'],['Motorbike Warranty','/motorcycle-warranty/'],['Extended Warranty','/car-extended-warranty/'],['Warranty Types','/warranty-types/']] },
              { h: 'Legal', items: [['Privacy Policy','/privacy/'],['Terms & Conditions','/terms/'],['Cookie Policy','/cookies/'],['Complaints Procedure','/complaints/'],['Modern Slavery Statement','/terms/']] },
            ].map((col, ci) => (
              <div key={ci}>
                {col.h && <h3 className="text-[#0F172A] font-black text-xs mb-3">{col.h}</h3>}
                {!col.h && <div className="h-7" />}
                <ul className="space-y-1.5 text-xs">
                  {col.items.map(([l, h]) => (
                    <li key={l}><Link to={h} className="text-slate-600 hover:text-[#F97316]">{l}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h3 className="text-[#0F172A] font-black text-xs mb-3">Help</h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><Link to="/faq/" className="hover:text-[#F97316]">FAQ's</Link></li>
                <li className="pt-1"><span className="font-bold text-[#0F172A]">Sales Enquiries</span><br/><a href={`tel:${PHONE.replace(/\s/g,'')}`} className="hover:text-[#F97316]">{PHONE}</a></li>
                <li className="pt-1"><span className="font-bold text-[#0F172A]">Claims Hotline</span><br/><a href="tel:03302295045" className="hover:text-[#F97316]">0330 229 5045</a></li>
                <li className="pt-1"><span className="font-bold text-[#0F172A]">Email Support</span><br/><a href="mailto:info@buyawarranty.co.uk" className="hover:text-[#F97316] break-all">info@buyawarranty.co.uk</a></li>
              </ul>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 h-fit">
              <h3 className="text-[#0F172A] font-black text-sm mb-2">Get a Quote</h3>
              <p className="text-xs text-slate-600">It only takes 60 seconds to get your free quote.</p>
              <Button onClick={scrollToQuote} className="w-full mt-3 bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs">Get my quote <ArrowRight className="ml-1 w-3 h-3" /></Button>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 mt-8 pt-5 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            BuyaWarranty is an independent warranty provider and is not affiliated with BMW. Cover levels, limits, exclusions and eligibility criteria apply. Please refer to the policy documents for full terms and conditions.
          </div>
        </footer>

        {/* Sticky mobile CTA */}
        <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] p-3">
          <div className="flex gap-2">
            <a href={`tel:${PHONE.replace(/\s/g,'')}`} className="flex items-center justify-center w-12 h-12 rounded-md border-2 border-slate-900 text-slate-900">
              <Phone className="w-5 h-5" />
            </a>
            <Button onClick={scrollToQuote} className="flex-1 bg-[#F97316] hover:bg-[#EA580C] text-white font-bold h-12">Get quote</Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BMWExtendedWarrantyLanding;
