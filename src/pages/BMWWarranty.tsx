import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Check, ArrowRight, Shield, Phone, ChevronDown, Zap, Settings, Cpu,
  Thermometer, Gauge, Wrench, Sparkles, Clock, PoundSterling
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { ReviewSchema } from '@/components/schema/ReviewSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { trackButtonClick } from '@/utils/analytics';
import { OptimizedImage } from '@/components/OptimizedImage';
import { SALES_PHONE, SALES_PHONE_TEL } from '@/constants/contact';
import bmwLogo from '@/assets/logos/bmw.webp';
import bmwHeroImage from '@/assets/Bmw-extended-used-car-warranty.png';
import trustpilotLogo from '@/assets/trustpilot-excellent-box.webp';

// Design tokens (Brand Orange + Navy / Space Grotesk + DM Sans / full-bleed cinematic)
const NAVY = '#0a1f44';
const ORANGE = '#eb4b00';
const SOFT_ORANGE = '#FFB37A';
const LIGHT = '#F5F7FA';

const headingFont: React.CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" };
const bodyFont: React.CSSProperties = { fontFamily: "'DM Sans', system-ui, sans-serif" };

const BMWWarranty: React.FC = () => {
  const navigate = useNavigate();
  const [openFaqId, setOpenFaqId] = useState<number | null>(0);

  // Load the two Google fonts once for this page (cinematic typography)
  useEffect(() => {
    const id = 'bmw-page-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);

  const toggleFaq = (i: number) => setOpenFaqId(openFaqId === i ? null : i);

  const goQuote = () => {
    trackButtonClick('bmw_warranty_get_quote');
    navigate('/#quote-form');
  };

  const bmwFAQs = [
    { question: 'Is a BMW extended warranty worth it in the UK?', answer: 'Yes, BMW repairs are some of the most expensive in the UK due to advanced electronics and complex powertrains. An extended warranty protects key components like the engine, gearbox, fuel injectors and ECUs, preventing sudden repair bills that can reach £6,000 to £9,000 on premium BMW models.' },
    { question: 'How much does a BMW extended warranty cost in the UK?', answer: 'Extended BMW warranty prices typically start from £35 to £95 per month, depending on your BMW model, mileage, and chosen claim limit. High-performance or M-Sport models are not covered.' },
    { question: 'Can I purchase an extended warranty directly from BMW?', answer: 'Yes, BMW UK offers extended warranty cover, but it usually requires servicing at BMW-approved workshops and has limits on electrical component cover. Independent warranty providers provide broader coverage, lower prices, and more flexible repair options.' },
    { question: 'Can I buy a BMW extended warranty after my original warranty has expired?', answer: 'Yes, you can buy cover even if your BMW is outside its original 3-year manufacturer warranty, or if you purchased it used. Mileage and vehicle condition will determine which plan fits best.' },
    { question: 'Can I negotiate the price of a BMW extended warranty?', answer: 'Yes, prices for extended warranties are often negotiable, especially with independent providers. You can request discounts, annual payment savings, or remove optional add-ons to reduce cost.' },
    { question: 'How much is a 5-year BMW extended warranty?', answer: 'A 5-year extended warranty usually ranges between £1,200 and £2,800 total, depending on model, mileage, and coverage level. High-performance models like the BMW M3 or X5 can cost more due to costly engine and gearbox repairs.' },
    { question: 'Is a used BMW warranty worth it?', answer: 'Yes. Used BMWs, especially 3 Series, 5 Series, X5 and M models, are more likely to need repairs after 50,000 miles. A used BMW warranty stabilises ownership costs and reduces financial risk.' },
    { question: 'Can I use my own garage for BMW warranty repairs?', answer: 'Yes, with most independent warranties. You can choose any VAT-registered garage instead of being restricted to BMW dealers.' },
    { question: 'Does an extended BMW warranty cover hybrids and electric models?', answer: 'Yes, as long as battery and drivetrain systems are included in the policy. Coverage varies between providers, so always confirm EV inclusions.' },
  ];

  const models = [
    { range: '1 Series', popular: '116i / 118i / 120d', cost: '£900 – £2,000+' },
    { range: '2 Series', popular: '218i / 220d / Gran Coupé', cost: '£1,200 – £2,500+' },
    { range: '3 Series', popular: '320d / 330e / 335d', cost: '£1,500 – £4,000+' },
    { range: '4 Series', popular: '420d / 430i / 440i', cost: '£1,800 – £4,500+' },
    { range: '5 Series', popular: '520d / 530e / 540i', cost: '£2,000 – £6,000+' },
    { range: '7 Series', popular: '730d / 740i / 750Li', cost: '£2,800 – £7,000+' },
    { range: 'X Series (SUV)', popular: 'X1 / X3 / X5 / X6 / X7', cost: '£1,700 – £9,000+' },
    { range: 'i-Series (EV / Hybrid)', popular: 'i3 / i4 / i5 / i7', cost: '£1,200 – £11,000+' },
  ];

  const coverGroups = [
    {
      icon: Settings, title: 'Mechanical',
      items: ['Engine & internal components', 'Gearbox & torque converter', 'Differential & drive shafts'],
    },
    {
      icon: Cpu, title: 'Electrical & ECU',
      items: ['ECU & control units', 'Sensors, wiring & modules', 'Digital instrument clusters', 'Infotainment systems'],
    },
    {
      icon: Thermometer, title: 'Cooling & Climate',
      items: ['Radiators & cooling pumps', 'Fuel injectors & pumps', 'Air conditioning', 'Central locking & mirrors'],
    },
  ];

  return (
    <div style={{ ...bodyFont, color: NAVY, backgroundColor: '#fff' }}>
      <SEOHead
        title="BMW Extended Warranty UK | Get Instant Quote | BuyA Warranty"
        description="Protect your BMW with a comprehensive extended warranty in the UK from BuyA Warranty. Fast claims, affordable pricing and full mechanical cover with instant quote today."
        keywords="BMW warranty, BMW extended warranty, used BMW warranty, BMW car warranty UK, BMW warranty cost, BMW mechanical warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/bmw/"
        geoRegion="GB"
        geoPlacename="United Kingdom"
      />
      <OrganizationSchema />
      <ReviewSchema />
      <WebPageSchema
        name="BMW Extended Warranty - Affordable Cover with Fast Claims"
        description="Comprehensive BMW warranty coverage for all models. Protect your BMW from expensive repairs with our extended warranty plans."
        url="https://buyawarranty.co.uk/car-extended-warranty/bmw/"
      />
      <FAQSchema faqs={bmwFAQs} />
      <ProductSchema
        name="BMW Extended Warranty" description="Comprehensive warranty coverage for BMW vehicles"
        price="35" brand="Buy A Warranty" category="Vehicle Warranty"
        image="https://buyawarranty.co.uk/logo.png" availability="https://schema.org/InStock" areaServed="GB"
      />
      <BreadcrumbSchema items={[
        { name: 'Home', url: 'https://buyawarranty.co.uk/' },
        { name: 'Car Extended Warranty', url: 'https://buyawarranty.co.uk/car-extended-warranty/' },
        { name: 'BMW Warranty', url: 'https://buyawarranty.co.uk/car-extended-warranty/bmw/' },
      ]} />

      {/* ============== HERO (full-bleed cinematic navy) ============== */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          background: `radial-gradient(1200px 600px at 85% 20%, rgba(235,75,0,0.18), transparent 60%), linear-gradient(135deg, ${NAVY} 0%, #061230 100%)`,
        }}
      >
        {/* decorative diagonal stripe */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-1/3 hidden lg:block"
          style={{
            background: `linear-gradient(135deg, transparent 0%, transparent 60%, ${ORANGE} 60%, ${ORANGE} 62%, transparent 62%)`,
            opacity: 0.4,
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6"
                   style={{ backgroundColor: 'rgba(255,179,122,0.15)', color: SOFT_ORANGE }}>
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold tracking-wide uppercase" style={bodyFont}>
                  Specialist BMW Cover · UK
                </span>
              </div>

              <h1
                className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.02]"
                style={headingFont}
              >
                Drive your BMW.<br />
                <span style={{ color: SOFT_ORANGE }}>We&rsquo;ll handle</span> the repair bills.
              </h1>

              <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl" style={bodyFont}>
                Extended warranty cover engineered for BMW owners — from the 1 Series to the X7.
                Flexible monthly plans, instant online quotes and protection up to 150,000 miles.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-10 max-w-xl">
                {[
                  'Full mechanical & electrical cover',
                  'Used & high-mileage BMWs welcome',
                  'Instant online quote in 60 seconds',
                  'Pay monthly or annually',
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0"
                      style={{ backgroundColor: ORANGE }}
                    >
                      <Check className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span className="text-white/90 text-sm" style={bodyFont}>{t}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={goQuote}
                  className="text-base font-semibold h-14 px-8 rounded-full shadow-xl transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: ORANGE, color: '#fff', ...headingFont }}
                >
                  Get my instant quote <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <a
                  href={SALES_PHONE_TEL}
                  className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-full border border-white/25 text-white hover:bg-white/10 transition-colors"
                  style={headingFont}
                >
                  <Phone className="h-4 w-4" /> {SALES_PHONE}
                </a>
              </div>
            </div>

            <div className="lg:col-span-5 relative">
              <div
                className="absolute -inset-6 rounded-[2rem] blur-2xl opacity-60"
                style={{ background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)` }}
                aria-hidden
              />
              <div
                className="relative rounded-2xl overflow-hidden border"
                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
              >
                <OptimizedImage
                  src={bmwHeroImage}
                  alt="BMW extended warranty cover"
                  className="w-full h-auto object-cover"
                  width={620}
                  height={420}
                  priority
                  sizes="(max-width: 1024px) 100vw, 620px"
                />
              </div>
              <div className="mt-5 flex items-center gap-3 justify-center">
                <OptimizedImage src={bmwLogo} alt="BMW" className="h-8 w-auto opacity-80" width={56} height={32} />
                <span className="text-white/60 text-xs tracking-wider uppercase" style={headingFont}>
                  Independent · not affiliated with BMW AG
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Trustpilot strip */}
        <div className="border-t border-white/10 bg-black/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <TrustpilotHeader />
          </div>
        </div>
      </section>

      {/* ============== STATS BAND ============== */}
      <section style={{ backgroundColor: LIGHT }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { v: '150k', l: 'Miles eligible' },
            { v: '60s', l: 'Quote time' },
            { v: '£9k+', l: 'Avg. saved repair' },
            { v: '4.8★', l: 'Trustpilot' },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-4xl md:text-5xl font-bold" style={{ ...headingFont, color: NAVY }}>
                {s.v}
              </div>
              <div className="text-sm mt-1" style={{ color: NAVY, opacity: 0.7 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============== WHAT'S COVERED ============== */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-14">
            <p className="uppercase tracking-[0.2em] text-xs font-semibold mb-3" style={{ color: ORANGE }}>
              What&rsquo;s covered
            </p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ ...headingFont, color: NAVY }}>
              Engineered for the bits that break.
            </h2>
            <p className="text-lg" style={{ opacity: 0.75 }}>
              Our plans focus on the components that fail most often on BMWs — including labour and diagnostics
              up to your chosen claim limit.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {coverGroups.map(({ icon: Icon, title, items }) => (
              <div
                key={title}
                className="group relative p-8 rounded-2xl border transition-all hover:-translate-y-1"
                style={{ borderColor: 'rgba(10,31,68,0.1)', backgroundColor: '#fff' }}
              >
                <div
                  className="inline-flex items-center justify-center h-12 w-12 rounded-xl mb-5"
                  style={{ backgroundColor: NAVY, color: '#fff' }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-4" style={{ ...headingFont, color: NAVY }}>
                  {title}
                </h3>
                <ul className="space-y-2.5">
                  {items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm" style={{ color: NAVY, opacity: 0.85 }}>
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
                <div
                  className="absolute bottom-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-500"
                  style={{ backgroundColor: ORANGE }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== MODELS — full-bleed dark band ============== */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: NAVY, color: '#fff' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-6">
            <div>
              <p className="uppercase tracking-[0.2em] text-xs font-semibold mb-3" style={{ color: SOFT_ORANGE }}>
                Models we cover
              </p>
              <h2 className="text-4xl md:text-5xl font-bold" style={headingFont}>
                From 1 Series<br />to X7.
              </h2>
            </div>
            <p className="text-white/70 max-w-md">
              Coverage for petrol, diesel, hybrid and electric BMWs registered in the UK,
              up to 150,000 miles. M Series performance models are excluded.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            <div className="grid grid-cols-12 px-6 py-4 text-xs uppercase tracking-wider"
                 style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: SOFT_ORANGE, ...headingFont }}>
              <div className="col-span-4">Range</div>
              <div className="col-span-5">Popular models</div>
              <div className="col-span-3 text-right">Avg. repair cost</div>
            </div>
            {models.map((m, i) => (
              <div
                key={m.range}
                className="grid grid-cols-12 px-6 py-5 items-center transition-colors hover:bg-white/[0.04]"
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent',
                }}
              >
                <div className="col-span-4 font-semibold" style={headingFont}>BMW {m.range}</div>
                <div className="col-span-5 text-white/80 text-sm">{m.popular}</div>
                <div className="col-span-3 text-right" style={{ color: SOFT_ORANGE, ...headingFont }}>{m.cost}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 px-5 py-4 rounded-xl text-sm flex items-start gap-3"
               style={{ backgroundColor: 'rgba(235,75,0,0.12)', color: SOFT_ORANGE }}>
            <Shield className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>BMW M Series performance models are not eligible for cover.</span>
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS — full-bleed light ============== */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: LIGHT }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="uppercase tracking-[0.2em] text-xs font-semibold mb-3" style={{ color: ORANGE }}>
              How it works
            </p>
            <h2 className="text-4xl md:text-5xl font-bold" style={{ ...headingFont, color: NAVY }}>
              Three steps. Under a minute.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {[
              { n: '01', icon: Gauge, t: 'Enter your reg', d: 'Quick lookup with your BMW registration.' },
              { n: '02', icon: Wrench, t: 'Pick your cover', d: 'Choose a plan that suits your model & mileage.' },
              { n: '03', icon: Shield, t: 'Drive protected', d: 'Instant cover. No inspections. No hidden fees.' },
            ].map(({ n, icon: Icon, t, d }) => (
              <div key={n} className="relative p-8 bg-white rounded-2xl shadow-sm">
                <div className="text-7xl font-bold opacity-10 absolute top-4 right-6" style={{ ...headingFont, color: NAVY }}>
                  {n}
                </div>
                <Icon className="h-10 w-10 mb-5" style={{ color: ORANGE }} />
                <h3 className="text-xl font-bold mb-2" style={{ ...headingFont, color: NAVY }}>{t}</h3>
                <p className="text-sm" style={{ color: NAVY, opacity: 0.7 }}>{d}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button
              size="lg"
              onClick={goQuote}
              className="h-14 px-8 rounded-full text-base font-semibold"
              style={{ backgroundColor: ORANGE, color: '#fff', ...headingFont }}
            >
              Start my quote <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ============== USED BMW — split editorial ============== */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="uppercase tracking-[0.2em] text-xs font-semibold mb-3" style={{ color: ORANGE }}>
              Used & high-mileage
            </p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ ...headingFont, color: NAVY }}>
              Past 50,000 miles?<br />That&rsquo;s where we come in.
            </h2>
            <p className="text-lg mb-8" style={{ opacity: 0.75 }}>
              A used BMW extended warranty stabilises ownership costs and helps prevent expensive
              repair surprises after the manufacturer warranty ends.
            </p>

            <div className="space-y-4 mb-8">
              {[
                { icon: PoundSterling, t: 'Timing chain failure', s: '£1,800 – £3,500 typical' },
                { icon: Zap, t: 'Turbo / intercooler faults', s: '£1,200 – £2,800 typical' },
                { icon: Settings, t: 'Gearbox & transmission issues', s: '£2,500 – £9,000 typical' },
              ].map(({ icon: Icon, t, s }) => (
                <div key={t} className="flex items-start gap-4 p-4 rounded-xl"
                     style={{ backgroundColor: LIGHT }}>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                    style={{ backgroundColor: NAVY, color: '#fff' }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold" style={{ ...headingFont, color: NAVY }}>{t}</div>
                    <div className="text-sm" style={{ color: ORANGE }}>{s}</div>
                  </div>
                </div>
              ))}
            </div>

            <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
               target="_blank" rel="noopener noreferrer"
               className="inline-block transition-opacity hover:opacity-80">
              <img src={trustpilotLogo} alt="Trustpilot 5 stars" className="h-auto w-32 object-contain" />
            </a>
          </div>

          <div className="relative">
            <div
              className="aspect-[4/5] rounded-3xl overflow-hidden"
              style={{ backgroundColor: NAVY }}
            >
              <OptimizedImage
                src={bmwHeroImage}
                alt="Used BMW with extended warranty"
                className="w-full h-full object-cover mix-blend-luminosity opacity-90"
                width={500}
                height={625}
              />
            </div>
            <div
              className="absolute -bottom-6 -left-6 p-6 rounded-2xl shadow-xl max-w-[260px]"
              style={{ backgroundColor: ORANGE, color: '#fff' }}
            >
              <Clock className="h-6 w-6 mb-2" />
              <div className="text-2xl font-bold" style={headingFont}>From £19/mo</div>
              <div className="text-sm opacity-90">Flexible cover, cancel anytime.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== FAQ ============== */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: LIGHT }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="uppercase tracking-[0.2em] text-xs font-semibold mb-3" style={{ color: ORANGE }}>
              FAQ
            </p>
            <h2 className="text-4xl md:text-5xl font-bold" style={{ ...headingFont, color: NAVY }}>
              Questions, answered.
            </h2>
          </div>

          <div className="space-y-3">
            {bmwFAQs.map((faq, i) => {
              const open = openFaqId === i;
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl overflow-hidden border transition-shadow"
                  style={{ borderColor: open ? ORANGE : 'rgba(10,31,68,0.08)' }}
                >
                  <button
                    onClick={() => toggleFaq(i)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between gap-4"
                    aria-expanded={open}
                  >
                    <span className="font-semibold text-base md:text-lg pr-2"
                          style={{ ...headingFont, color: NAVY }}>
                      {faq.question}
                    </span>
                    <ChevronDown
                      className="h-5 w-5 flex-shrink-0 transition-transform"
                      style={{ color: ORANGE, transform: open ? 'rotate(180deg)' : 'none' }}
                    />
                  </button>
                  {open && (
                    <div className="px-6 pb-6 -mt-1">
                      <p className="leading-relaxed" style={{ color: NAVY, opacity: 0.8 }}>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA — full-bleed navy ============== */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(120deg, ${NAVY} 0%, #051028 60%, ${ORANGE} 180%)`,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center text-white relative">
          <Sparkles className="h-8 w-8 mx-auto mb-4" style={{ color: SOFT_ORANGE }} />
          <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight" style={headingFont}>
            Secure your BMW today.<br />
            <span style={{ color: SOFT_ORANGE }}>It takes 60 seconds.</span>
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            Average BMW repairs exceed £1,500. Lock in flexible monthly cover and get back peace of mind.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={goQuote}
              className="h-14 px-10 rounded-full text-base font-semibold"
              style={{ backgroundColor: ORANGE, color: '#fff', ...headingFont }}
            >
              Get my BMW warranty quote <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <a
              href={SALES_PHONE_TEL}
              className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full border border-white/30 text-white hover:bg-white/10 transition-colors"
              style={headingFont}
            >
              <Phone className="h-4 w-4" /> Speak to a specialist
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BMWWarranty;
