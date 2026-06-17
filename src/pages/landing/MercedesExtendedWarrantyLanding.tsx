import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check, Phone, MessageCircle, Star, Shield, Wrench, Zap, ChevronDown,
  Car, Truck, Battery, Bike, RefreshCw, Settings2, ArrowRight,
  Cog, Thermometer, CircleDot, Fuel, User, Globe, LifeBuoy, Home, ClipboardCheck, Info, Headphones,
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
import mercHeroAsset from '@/assets/mercedes-panda-hero.png.asset.json';
const mercHero = mercHeroAsset.url;
import TrustpilotSliderWidget from '@/components/TrustpilotSliderWidget';
import MileageQuickSelect from '@/components/MileageQuickSelect';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';
import MercedesPPCFooter from '@/components/landing/MercedesPPCFooter';
import mercA from '@/assets/mercedes-models/mercedes-a-class-extended-warranty.png';
import mercC from '@/assets/mercedes-models/mercedes-c-class-extended-warranty.png';
import mercE from '@/assets/mercedes-models/mercedes-e-class-extended-warranty.png';
import mercGLC from '@/assets/mercedes-models/mercedes-glc-suv-extended-warranty.png';
import mercS from '@/assets/mercedes-models/mercedes-s-class-extended-warranty.png';
import mercEQ from '@/assets/mercedes-models/mercedes-eq-ev-extended-warranty.png';

const mercedesModels = [
  { label: 'A-Class', examples: 'A180, A200, A220d', img: mercA, alt: 'Mercedes-Benz A-Class extended warranty cover — A180, A200 hatchback' },
  { label: 'C-Class', examples: 'C200, C220d, C300', img: mercC, alt: 'Mercedes-Benz C-Class extended warranty cover — C200, C220d saloon and estate' },
  { label: 'E-Class', examples: 'E220d, E300, E350', img: mercE, alt: 'Mercedes-Benz E-Class extended warranty cover — E220d, E300 executive saloon' },
  { label: 'GLA / GLC / GLE', examples: 'SUV petrol & diesel', img: mercGLC, alt: 'Mercedes-Benz GLA, GLC and GLE SUV extended warranty cover' },
  { label: 'S-Class', examples: 'S350d, S400d, S500', img: mercS, alt: 'Mercedes-Benz S-Class luxury saloon extended warranty cover' },
  { label: 'EQ Series (EV)', examples: 'EQA, EQB, EQC, EQE, EQS', img: mercEQ, alt: 'Mercedes-Benz EQ electric vehicle extended warranty cover' },
];

const PHONE = '0330 229 5040';
const WHATSAPP_URL = 'https://wa.me/443302295040';

const faqs = [
  { q: 'How much does Mercedes-Benz extended warranty cover cost?', a: 'Prices start from £19/month. Your exact price depends on your Mercedes-Benz model, age, mileage and the level of cover you choose.' },
  { q: 'What Mercedes-Benz models can you cover?', a: 'We can provide cover for many Mercedes-Benz models, subject to age, mileage, vehicle condition and eligibility checks. Vehicles up to 15 years old and 150,000 miles are typically eligible.' },
  { q: 'Can I use my own garage?', a: 'Yes, repairs can usually be carried out by a VAT-registered garage of your choice, subject to claim approval and policy terms.' },
  { q: 'What is not covered?', a: 'Like all warranty products, exclusions apply. Wear and tear, pre-existing faults, routine servicing and maintenance items may not be covered unless included in your chosen plan.' },
  { q: 'How do I make a claim?', a: 'Contact our claims team before any repair work starts. We will explain the next steps and tell your garage what information we need to assess the claim.' },
  { q: 'Is Buyawarranty part of Mercedes-Benz?', a: 'No. Buyawarranty is an independent UK warranty provider and is not affiliated with Mercedes-Benz.' },
  { q: 'Do I need a full service history?', a: 'A documented service history is recommended and helps support any future claim, but it is not always required to start cover.' },
  { q: 'Is there a waiting period for new policies?', a: 'A short initial waiting period applies to new policies. Full details are set out in your policy documents before you buy.' },
];

type Step = 1 | 2 | 3 | 4;

const MercedesExtendedWarrantyLanding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step] = useState<Step>(1);
  const [regNumber, setRegNumber] = useState('');
  const [mileageBand, setMileageBand] = useState<'under' | 'over' | ''>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showCallbackModal, setShowCallbackModal] = useState(false);

  const scrollToQuote = () => {
    trackButtonClick('mercedes_ppc_cta');
    document.getElementById('quote-module')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitToMainJourney = async () => {
    setIsSubmitting(true);
    trackQuoteRequest();
    try {
      const mileage = mileageBand === 'under' ? '100000' : '130000';
      let extra: any = { vehicleType: 'car' };
      try {
        const { data } = await supabase.functions.invoke('dvla-vehicle-lookup', { body: { registrationNumber: regNumber } });
        if (data?.found) {
          extra = { make: data.make || 'MERCEDES-BENZ', model: data.model, fuelType: data.fuelType, transmission: data.transmission, year: data.yearOfManufacture, vehicleType: 'car', manufactureDate: data.manufactureDate };
        }
      } catch { /* ok */ }
      const vehicleData = { regNumber: regNumber.toUpperCase(), mileage, ...extra };
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
      saveWithTimestamp('buyawarranty_currentStep', '2');
      sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
      navigate('/?step=2');
    } catch (e) {
      console.error(e);
      toast({ title: 'Something went wrong', description: 'Please try again or call us.', variant: 'destructive' });
    } finally { setIsSubmitting(false); }
  };

  return (
    <>
      <SEOHead
        title="Mercedes-Benz Extended Warranty Cover from £19/month | Quote"
        description="Protect your Mercedes-Benz from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds."
        keywords="Mercedes extended warranty, Mercedes-Benz warranty quote, Mercedes warranty UK, used Mercedes warranty, Mercedes repair cover, Mercedes-Benz warranty cost"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/mercedes-benz/"
        geoRegion="GB" geoPlacename="United Kingdom"
      />
      <OrganizationSchema />
      <WebPageSchema name="Mercedes-Benz Extended Warranty" description="Mercedes-Benz extended warranty cover from £19/month." url="https://buyawarranty.co.uk/car-extended-warranty/mercedes-benz/" />
      <FAQSchema faqs={faqs.map(f => ({ question: f.q, answer: f.a }))} />
      <ProductSchema name="Mercedes-Benz Extended Warranty" description="Flexible Mercedes-Benz warranty cover" price="19" brand="BuyaWarranty" category="Vehicle Warranty" image="https://buyawarranty.co.uk/logo.png" availability="https://schema.org/InStock" areaServed="GB" />
      <BreadcrumbSchema items={[{ name: 'Home', url: 'https://buyawarranty.co.uk/' }, { name: 'Mercedes-Benz Extended Warranty', url: 'https://buyawarranty.co.uk/car-extended-warranty/mercedes-benz/' }]} />

      <div className="min-h-screen bg-white text-slate-900 pb-24 md:pb-0 font-sans">
        {/* PPC Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center">
              <img src={buyawarrantyLogo} alt="BuyaWarranty" width={1600} height={254} className="h-7 md:h-10 w-auto object-contain shrink-0" loading="eager" />
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
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs px-4">Get my Mercedes quote</Button>
              <Link to="/auth/" className="hidden md:inline-flex items-center gap-1 text-slate-600 text-xs font-semibold hover:text-slate-900">
                <User className="w-4 h-4" /> Login
              </Link>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="bg-white pt-5 md:pt-8 pb-6 md:pb-8 px-4">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-6 lg:gap-10 items-start">
            <div>
              <h1 className="text-[28px] sm:text-4xl md:text-5xl lg:text-[52px] font-black text-[#0F172A] leading-[1.05] tracking-tight">
                Mercedes-Benz Extended Warranty Cover<br className="hidden sm:block"/>{' '}
                <span className="text-slate-900">from </span><span className="text-[#F97316]">£19/month</span>
              </h1>
              <p className="mt-3 md:mt-4 text-slate-700 text-[15px] md:text-base leading-snug">
                Flexible UK warranty cover. Instant quote in 60 seconds.
              </p>

              {/* Mobile-only hero image */}
              <div className="md:hidden mt-2 flex justify-center">
                <img
                  src={mercHero}
                  alt="Premium Mercedes-Benz with extended warranty cover"
                  className="w-3/4 max-w-[280px] h-auto"
                  loading="eager"
                />
              </div>


              <ul className="mt-1 md:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  'Covers mechanical and electrical faults',
                  'UK-based support team',
                  'Use your own VAT-registered garage',
                  'Easy Claims, Fast Payouts',
                ].map(b => (
                  <li key={b} className="flex items-start gap-2 text-[13.5px] text-slate-800">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0 mt-0.5" strokeWidth={3} />
                    <span className="font-medium">{b}</span>
                  </li>
                ))}
              </ul>

              <div id="quote-module" className="mt-5">
                {step === 1 && (
                  <>
                    <div className="relative">
                      <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-black w-full">
                        <div className="bg-blue-600 text-white font-bold px-2 sm:px-3 md:px-4 py-2 sm:py-4 flex items-center justify-center min-w-[45px] sm:min-w-[70px] md:min-w-[80px] h-[48px] sm:h-[60px] md:h-[66px]">
                          <div className="flex flex-col items-center">
                            <div className="text-xs sm:text-base md:text-lg leading-tight mb-1">🇬🇧</div>
                            <div className="text-xs sm:text-sm md:text-base font-bold leading-none">UK</div>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={regNumber}
                          onChange={e => setRegNumber(e.target.value.replace(/[^A-Za-z0-9]/g,'').toUpperCase())}
                          placeholder="ENTER MERCEDES REG"
                          aria-label="Vehicle registration"
                          className="bg-yellow-400 border-none outline-none text-lg sm:text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/70 px-2 sm:px-3 md:px-4 py-2 sm:py-4 uppercase tracking-wider h-[48px] sm:h-[60px] md:h-[66px] min-w-0"
                          maxLength={8}
                        />
                      </div>
                      {regNumber.replace(/\s/g, '').length >= 5 && (
                        <span className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md z-10">
                          <Check className="w-4 h-4 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-slate-500 text-center">
                      No payment required to view your quote. Takes less than 60 seconds.
                    </p>

                    <div className="mt-4">
                      <MileageQuickSelect
                        value={mileageBand === 'under' ? 'under120k' : mileageBand === 'over' ? 'over120k' : ''}
                        onChange={(v) => setMileageBand(v === 'under120k' ? 'under' : v === 'over120k' ? 'over' : '')}
                        onAutoSubmit={() => { setErrorMsg(''); submitToMainJourney(); }}
                        isLoading={isSubmitting}
                        isRegValid={regNumber.replace(/\s/g,'').length >= 5}
                        ctaLabels={{
                          enterReg: 'Enter your Mercedes reg above',
                          selectMileage: 'Select mileage to see your price',
                          submit: 'Get my Mercedes quote',
                        }}
                      />
                    </div>

                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-5 py-3 text-center">
                      <h2 className="text-sm sm:text-[15px] font-bold text-[#1B2A4A]">
                        Fair price. Fast quote. No surprises.
                      </h2>
                      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs sm:text-[14px] mt-1">
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

                {errorMsg && (
                  <p className="mt-3 text-xs text-red-600 font-semibold text-center">{errorMsg}</p>
                )}
              </div>
            </div>

            <div className="hidden md:block lg:order-last">
              <div className="relative">
                <img src={mercHero} alt="Premium Mercedes-Benz with extended warranty cover" className="w-full h-auto rounded-2xl" loading="eager" />
              </div>
              <div className="mt-5 flex flex-col items-center gap-3">
                <div className="flex items-center justify-center gap-5 md:gap-7 flex-wrap">
                  {[
                    { I: Car, l: 'Cars' },
                    { I: Truck, l: 'Vans' },
                    { I: Zap, l: 'Hybrid' },
                    { I: Battery, l: 'EV' },
                    { I: Bike, l: 'Motorbikes' },
                  ].map(({ I, l }) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <I className="w-5 h-5 text-[#00b67a]" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-800">{l}</span>
                    </div>
                  ))}
                </div>
                <div className="inline-flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-4 py-1.5">
                  <Star className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />
                  <span className="text-sm font-bold text-slate-800">Rated Excellent on Trustpilot</span>
                </div>
                <p className="text-center text-[12.5px] text-slate-600 leading-snug max-w-xs">
                  <span className="font-semibold text-slate-800">Independent UK warranty provider</span><br />
                  Not affiliated with Mercedes-Benz. Flexible cover from 60p a day.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trustpilot */}
        <section className="bg-white py-8 md:py-10 px-4 border-y border-slate-100">
          <div className="max-w-7xl mx-auto">
            <TrustpilotSliderWidget />
          </div>
        </section>

        {/* Why Mercedes owners choose us */}
        <section className="py-14 md:py-20 bg-gradient-to-b from-[#EFF4FB] via-[#F1F5FB] to-[#E8EEF7] border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl md:text-[40px] font-black text-[#0F172A] leading-tight">
                Why Mercedes-Benz owners choose <span className="text-[#F97316]">Buyawarranty</span>
              </h2>
              <p className="mt-3 text-slate-600 text-[15px] md:text-base">
                Mercedes-Benz repairs can be expensive. We help make unexpected costs easier to manage with simple warranty cover and UK-based support.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 md:gap-6">
              {[
                { I: Shield, badge: 'Peace of mind', badgeBg: 'bg-[#FFF1E6] text-[#EA580C]', iconBg: 'bg-[#FFEDD5]', iconColor: 'text-[#F97316]', topBar: 'bg-[#F97316]', t: 'Avoid unexpected repair bills', d: 'Cover available for major mechanical and electrical faults, depending on your plan.' },
                { I: Wrench, badge: 'More choice', badgeBg: 'bg-[#E7F8EF] text-[#16A34A]', iconBg: 'bg-[#DCFCE7]', iconColor: 'text-[#16A34A]', topBar: 'bg-[#16A34A]', t: 'Use your own trusted garage', d: 'Repairs can be carried out by a VAT-registered garage, subject to claim approval.' },
                { I: Headphones, badge: 'Real support', badgeBg: 'bg-[#E6EEFB] text-[#2563EB]', iconBg: 'bg-[#DBEAFE]', iconColor: 'text-[#2563EB]', topBar: 'bg-[#2563EB]', t: 'Speak to a real UK team', d: 'Get help with quotes, claims and questions before and after you buy.' },
              ].map(({ I, badge, badgeBg, iconBg, iconColor, topBar, t, d }) => (
                <div key={t} className="group relative bg-white rounded-2xl p-6 md:p-7 shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${topBar}`} />
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-14 h-14 rounded-full ${iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                      <I className={`w-7 h-7 ${iconColor}`} strokeWidth={2.25} />
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeBg}`}>{badge}</span>
                  </div>
                  <h3 className="font-black text-lg text-[#0F172A] mb-2 leading-snug">{t}</h3>
                  <p className="text-[14.5px] text-slate-600 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center gap-3">
              <div className="inline-flex items-center gap-2 bg-white border border-[#BBF7D0] rounded-full px-5 py-2 shadow-sm">
                <Star className="w-4 h-4 fill-[#00b67a] text-[#00b67a]" />
                <span className="text-sm font-bold text-slate-800">Rated Excellent</span>
                <div className="flex items-center gap-0.5 bg-[#00b67a] px-1.5 py-0.5 rounded-sm">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-white text-white" />)}
                </div>
                <span className="text-sm font-bold text-slate-800">on Trustpilot</span>
              </div>
              <p className="text-center text-[13px] text-slate-600 leading-snug max-w-md">
                Independent UK warranty provider. Not affiliated with Mercedes-Benz.<br />
                Flexible cover from <span className="font-semibold text-slate-800">60p a day</span>.
              </p>
              <Button onClick={scrollToQuote} className="mt-2 bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-base px-8 py-3 h-auto min-h-[52px] inline-flex items-center justify-center rounded-md shadow-md">
                Check my Mercedes price <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </section>

        {/* How claims work */}
        <section className="py-14 md:py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl md:text-[40px] font-black text-[#0F172A] leading-tight">Making a claim is simple</h2>
              <p className="mt-3 text-slate-600 text-[15px] md:text-base">
                Call us before repair work begins and we'll guide you through the next steps.
              </p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
              <div className="hidden md:block absolute top-[44px] left-[16.66%] right-[16.66%] border-t-2 border-dashed border-slate-300 -z-0" />
              {[
                { I: Phone, n: '1', t: 'Call our claims team', d: "Get in touch before any repair work starts.", iconBg: 'bg-[#FFEDD5]', iconColor: 'text-[#F97316]', numBg: 'bg-[#F97316]' },
                { I: Home, n: '2', t: 'Visit a VAT-registered garage', d: 'Your garage diagnoses the fault and provides the repair details.', iconBg: 'bg-[#DCFCE7]', iconColor: 'text-[#16A34A]', numBg: 'bg-[#16A34A]' },
                { I: ClipboardCheck, n: '3', t: 'We review the repair details', d: 'Our claims team checks the information from your garage and confirms the next steps with you.', iconBg: 'bg-[#DBEAFE]', iconColor: 'text-[#2563EB]', numBg: 'bg-[#2563EB]' },
              ].map(({ I, n, t, d, iconBg, iconColor, numBg }) => (
                <div key={n} className="relative flex flex-col items-center text-center px-2">
                  <div className="relative mb-5">
                    <div className={`w-[88px] h-[88px] rounded-full ${iconBg} flex items-center justify-center shadow-sm`}>
                      <I className={`w-10 h-10 ${iconColor}`} strokeWidth={2} />
                    </div>
                    <div className={`absolute -right-2 -bottom-1 w-9 h-9 rounded-full ${numBg} text-white flex items-center justify-center font-black text-sm shadow-md ring-4 ring-white`}>
                      {n}
                    </div>
                  </div>
                  <h3 className="font-black text-lg text-[#0F172A] mb-2">{t}</h3>
                  <p className="text-[14.5px] text-slate-600 leading-relaxed max-w-[280px]">{d}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 max-w-2xl mx-auto flex items-start justify-center gap-2 bg-[#F0F6FF] border border-[#DBEAFE] rounded-xl px-4 py-3">
              <Info className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
              <span className="text-[13.5px] text-slate-700 leading-relaxed text-center">
                All claims are reviewed in line with your{' '}
                <a href="/warranty-plan/" target="_blank" rel="noopener noreferrer" className="text-slate-700 underline underline-offset-2 decoration-slate-400 hover:decoration-slate-700">chosen warranty plan</a>
                , including any limits and exclusions. Please also read our{' '}
                <a href="/terms/" target="_blank" rel="noopener noreferrer" className="text-slate-700 underline underline-offset-2 decoration-slate-400 hover:decoration-slate-700">Terms &amp; Conditions</a>.
              </span>
            </div>

            <div className="text-center mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button onClick={scrollToQuote} className="animate-breathing bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-base px-8 py-3 h-auto min-h-[52px] inline-flex items-center justify-center rounded-md shadow-md">
                Get my Mercedes quote <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                <Shield className="w-4 h-4 text-slate-500" />
                <span className="font-semibold">No payment required</span>
              </div>
            </div>
          </div>
        </section>

        {/* Mercedes models we cover */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A]">Mercedes-Benz models we cover</h2>
              <p className="mt-2 text-slate-600 text-sm md:text-base">Cover available for most Mercedes-Benz models and engine types, subject to eligibility.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {mercedesModels.map(m => (
                <div key={m.label} className="flex flex-col items-center text-center">
                  <div className="w-full aspect-[4/3] bg-white rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden p-3">
                    <img src={m.img} alt={m.alt} title={m.alt} width={768} height={576} className="w-full h-full object-contain" loading="lazy" />
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#0F172A]">{m.label}</p>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{m.examples}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <button onClick={scrollToQuote} className="inline-flex items-center gap-1 text-[#F97316] font-bold text-sm hover:underline">
                View all Mercedes-Benz models we cover <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* What's covered */}
        <section className="py-12 md:py-16 bg-gradient-to-b from-white to-slate-50 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A]">What does Mercedes-Benz warranty cover?</h2>
              <p className="mt-2 text-slate-600 text-sm md:text-base">Eight major systems protected, so you can drive your Mercedes-Benz with confidence.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[
                { I: Cog,        t: 'Engine',                bg: 'bg-orange-50',  ring: 'border-orange-200',  ic: 'text-orange-600',  hoverRing: 'hover:border-orange-400' },
                { I: Settings2,  t: 'Gearbox',               bg: 'bg-blue-50',    ring: 'border-blue-200',    ic: 'text-blue-600',    hoverRing: 'hover:border-blue-400' },
                { I: Zap,        t: 'Electrical systems',    bg: 'bg-amber-50',   ring: 'border-amber-200',   ic: 'text-amber-600',   hoverRing: 'hover:border-amber-400' },
                { I: Thermometer,t: 'Cooling system',        bg: 'bg-cyan-50',    ring: 'border-cyan-200',    ic: 'text-cyan-600',    hoverRing: 'hover:border-cyan-400' },
                { I: CircleDot,  t: 'Braking system',        bg: 'bg-red-50',     ring: 'border-red-200',     ic: 'text-red-600',     hoverRing: 'hover:border-red-400' },
                { I: LifeBuoy,   t: 'Steering system',       bg: 'bg-indigo-50',  ring: 'border-indigo-200',  ic: 'text-indigo-600',  hoverRing: 'hover:border-indigo-400' },
                { I: Fuel,       t: 'Fuel system',           bg: 'bg-emerald-50', ring: 'border-emerald-200', ic: 'text-emerald-600', hoverRing: 'hover:border-emerald-400' },
                { I: Battery,    t: 'Hybrid / EV components',bg: 'bg-lime-50',    ring: 'border-lime-200',    ic: 'text-lime-700',    hoverRing: 'hover:border-lime-400' },
              ].map(({ I, t, bg, ring, ic, hoverRing }) => (
                <div key={t} className={`${bg} border-2 ${ring} ${hoverRing} rounded-2xl p-5 flex flex-col items-center text-center transition-all hover:-translate-y-0.5 hover:shadow-md`}>
                  <div className={`w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mb-3 ${ic}`}>
                    <I className="w-6 h-6" />
                  </div>
                  <p className="font-black text-sm md:text-base text-[#0F172A] leading-tight">{t}</p>
                </div>
              ))}
            </div>
            <p className="text-center mt-5 text-xs text-slate-500">Inclusions and limits vary by plan. Hybrid &amp; EV components subject to plan and eligibility.</p>
            <div className="text-center mt-6">
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-base px-8 py-3 h-auto min-h-[52px] inline-flex items-center justify-center rounded-md shadow-md">
                See my Mercedes cover options <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </section>

        {/* Additional cover */}
        <section className="py-12 md:py-14 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-6">
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A]">Additional Mercedes-Benz cover options</h2>
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
              <p className="mt-3 text-sm md:text-base text-slate-600">Got questions before you get a quote? Here are the answers Mercedes owners ask us most.</p>
            </div>
            <div className="space-y-3">
              {faqs.slice(0, 6).map((f, i) => {
                const open = openFaq === i;
                return (
                  <button
                    key={i}
                    onClick={() => setOpenFaq(open ? null : i)}
                    className={`group w-full text-left bg-white rounded-[14px] border border-[#DCE3EC] border-l-4 border-l-[#FFB580] shadow-[0_4px_14px_rgba(15,23,42,0.04)] hover:bg-[#FFF9F4] hover:border-[#FFB278] hover:border-l-[#FFB580] hover:shadow-[0_8px_22px_rgba(15,23,42,0.07)] transition-all px-6 py-6 md:px-[30px] ${open ? 'bg-[#FFF9F4] border-[#FFB278] border-l-[#FFB580] shadow-[0_8px_22px_rgba(15,23,42,0.07)]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-sm md:text-base text-gray-900">{f.q}</span>
                      <span className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors flex-shrink-0 ${open ? 'bg-[#FFE8D6]' : 'bg-transparent group-hover:bg-[#FFE8D6]'}`}>
                        <ChevronDown className={`w-4 h-4 text-[#F97316] transition-transform ${open ? 'rotate-180' : ''}`} />
                      </span>
                    </div>
                    {open && (
                      <div className="mt-2">
                        <p className="text-gray-700 text-sm leading-relaxed">{f.a}</p>
                        {i === 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); scrollToQuote(); }}
                            className="mt-3 inline-flex items-center gap-1 text-[#F97316] font-bold text-sm hover:underline"
                          >
                            Check my Mercedes price <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-center mt-6 flex flex-col items-center gap-4">
              <Link to="/faq/" className="text-[#F97316] font-bold text-base hover:underline">View all FAQs →</Link>
              <Button onClick={scrollToQuote} className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-base px-8 py-3 h-auto min-h-[52px] inline-flex items-center justify-center rounded-md shadow-md">
                Get my Mercedes quote <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </section>

        <MercedesPPCFooter />

        {/* Sticky mobile CTA */}
        <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] p-3">
          <div className="flex gap-2">
            <a href={`tel:${PHONE.replace(/\s/g,'')}`} aria-label={`Call us on ${PHONE}`} className="flex items-center justify-center gap-1.5 h-12 px-4 rounded-md border-2 border-[#16A34A] text-[#16A34A] font-bold bg-white">
              <Phone className="w-4 h-4" />
              <span className="text-sm">Call us</span>
            </a>
            <Button onClick={scrollToQuote} className="flex-1 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-12">Get my Mercedes quote</Button>
          </div>
        </div>
      </div>
      <RequestCallbackModal isOpen={showCallbackModal} onClose={() => setShowCallbackModal(false)} />
    </>
  );
};

export default MercedesExtendedWarrantyLanding;
