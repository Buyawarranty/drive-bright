import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Shield, Clock, ArrowRight, Fuel, Battery, Zap, Bike, X, FileText, Wrench, Phone, Settings, AlertTriangle, Ban, HelpCircle, Star, Plus, Cog, RefreshCw, Snowflake, Car, Disc, Thermometer, Smartphone, GitBranch, Wind, Droplets, CircleDot, Move3d, ShieldCheck, Sparkles, ChevronDown } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import HighPerformanceExclusionsList from '@/components/HighPerformanceExclusionsList';
import HelpMeChooseModal from '@/components/cover-page/HelpMeChooseModal';
import trustpilotStars from '@/assets/trustpilot-5-stars.png';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';

// ----- Data for the new design sections -----
const coverageCards = [
  { Icon: Cog, title: 'Engine', desc: 'All internal engine components including pistons, crankshaft, camshaft, oil pump, and cylinder head.' },
  { Icon: GitBranch, title: 'Gearbox', desc: 'Manual or automatic. All internal gearbox components, torque convertor and selector forks.' },
  { Icon: Wind, title: 'Turbo & Supercharger', desc: 'Turbocharger assembly, wastegate, intercooler and supercharger components covered.' },
  { Icon: Zap, title: 'Electrical Systems & ECUs', desc: 'Engine control units, body control modules, and major electrical management systems.' },
  { Icon: Car, title: 'Steering', desc: 'Power steering pump, rack and pinion, steering column and electric power steering motor.' },
  { Icon: Droplets, title: 'Cooling System', desc: 'Water pump, radiator, thermostat, cooling fan and coolant hoses included.' },
  // --- Below this point shown only when "see all" is expanded on mobile ---
  { Icon: RefreshCw, title: 'Clutch System', desc: 'Clutch plate, pressure plate, release bearing, and flywheel. Full clutch assembly covered.' },
  { Icon: Fuel, title: 'Fuel System', desc: 'Fuel pump, injectors, fuel pressure regulator and fuel rail covered in full.' },
  { Icon: Snowflake, title: 'Air Conditioning', desc: 'Compressor, condenser, evaporator, expansion valve, and receiver drier all included.' },
  { Icon: Disc, title: 'Braking System', desc: 'ABS module, brake servo, master cylinder, and brake callipers fully protected.' },
  { Icon: Thermometer, title: 'Heating & Ventilation', desc: 'Heater matrix, blower motor, temperature control module and associated parts.' },
  { Icon: Smartphone, title: 'Infotainment & Cameras', desc: 'Touchscreen, navigation unit, parking sensors, and reversing camera systems.' },
  { Icon: Wrench, title: 'Suspension', desc: 'Shock absorbers, struts, control arms, ball joints, and suspension bushes covered.' },
  { Icon: Move3d, title: 'Drive System', desc: 'Driveshafts, CV joints, differential, prop shaft and transfer box components.' },
  { Icon: ShieldCheck, title: 'Safety Systems', desc: 'Airbag control module, seatbelt pre-tensioners, traction and stability control units.' },
  { Icon: Sparkles, title: 'Everything Else', desc: "If it's essential to the smooth and safe running of your vehicle, it's normally covered." },
];

const coveredItems = [
  'Mechanical failure from normal use',
  'Electrical & ECU faults',
  'Parts AND labour costs',
  'Diagnostic fees',
  'VAT on covered repairs',
  'Approved garage of your choice',
  'Hybrid & EV battery management',
  'Turbo and supercharger failure',
];

const notCoveredItems = [
  'Wear and tear (tyres, brake pads, etc.)',
  'Accidental or cosmetic damage',
  'Pre-existing faults at purchase',
  'Negligence or lack of servicing',
  'Modifications that affect covered parts',
  'High-performance / track cars',
  'Vehicles used for hire or reward',
  'Flood, fire, theft or weather damage',
];

const claimLimits = [
  { amount: '£1,000', value: 1000, label: 'Light cover', example: 'A £900 alternator replacement with a £1,000 limit: fully covered.' },
  { amount: '£2,000', value: 2000, label: 'Popular choice', example: 'A £1,800 turbo replacement with a £2,000 limit: fully covered.' },
  { amount: '£3,000', value: 3000, label: 'Best protection', popular: true, example: 'A £1,300 repair with a £3,000 limit: fully covered.' },
  { amount: '£5,000', value: 5000, label: 'Maximum cover', example: 'A £4,200 engine rebuild with a £5,000 limit: fully covered.' },
];

const repairExamples = [
  { icon: '🔧', name: 'Engine Repair', desc: 'Head gasket, piston rings, crankshaft bearings & more', range: '£1,000–£4,000' },
  { icon: '⚙️', name: 'Gearbox Repair', desc: 'Synchromesh, selectors, automatic valve body', range: '£500–£3,000' },
  { icon: '💨', name: 'Turbo Failure', desc: 'Full turbocharger replacement including labour', range: '£700–£2,500' },
  { icon: '🖥️', name: 'ECU / Control Module', desc: 'Engine, body, or transmission ECU replacement', range: '£400–£1,800' },
];

const faqs = [
  {
    q: 'Is £1,000, £2,000, £3,000 or £5,000 the right claim limit for me?',
    a: 'We recommend matching your limit to the most expensive single system in your vehicle. For most cars, the £3,000 limit covers engine and gearbox repairs in full. Luxury and high-mileage vehicles benefit from the £5,000 tier.',
  },
  {
    q: 'What if a repair costs more than my limit?',
    a: 'We pay up to your chosen claim limit and you cover any difference directly with the garage. You only pay once per repair event, not per part.',
  },
  {
    q: 'What is an approved claim?',
    a: "A claim is approved once our team verifies the fault is covered under your policy and wasn't pre-existing. Most claims are approved within hours of the garage report.",
  },
  {
    q: 'Are diagnostics and labour included?',
    a: "Yes, diagnostic fees and labour are included in your claim limit, so you won't be left paying for investigation costs on top of repairs.",
  },
  {
    q: 'Can I use my own garage?',
    a: "Yes, as long as it's VAT-registered. We work with thousands of approved garages across the UK, or your preferred local mechanic can be approved quickly.",
  },
  {
    q: 'When does my cover start?',
    a: 'Your cover starts immediately from the policy start date shown in your documents, so you’re protected right away. Please note that, like all warranties, pre-existing faults (anything wrong with your vehicle before the policy began) are not covered.',
  },
];

const Protected = () => {
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string>('');
  const [termsDocUrl, setTermsDocUrl] = useState<string>('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAllParts, setShowAllParts] = useState(false);
  const [selectedLimitIndex, setSelectedLimitIndex] = useState(2); // £3,000 default
  const coverageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      const { data: platinumData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'platinum')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (platinumData) setPlatinumDocUrl(platinumData.file_url);

      const { data: termsData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'terms-and-conditions')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (termsData) setTermsDocUrl(termsData.file_url);
    };
    fetchDocuments();
  }, []);

  // Re-initialize Trustpilot widget on mount (SPA navigation safe)
  useEffect(() => {
    const tryLoad = () => {
      if ((window as any).Trustpilot) {
        const widgets = document.querySelectorAll('.trustpilot-widget');
        widgets.forEach((w) => (window as any).Trustpilot.loadFromElement(w, true));
      } else {
        setTimeout(tryLoad, 300);
      }
    };
    tryLoad();
  }, []);

  const scrollToCoverage = () => {
    coverageRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const openHelpModal = () => setShowHelpModal(true);

  // Vehicle types — exclusions removed (now live in Covered/Not Covered section)
  const vehicleTypes = [
    {
      id: 'petrol-diesel',
      title: 'Petrol & Diesel Vehicles',
      icon: Fuel,
      bgClass: 'bg-foreground text-white',
      hoverClass: 'hover:bg-foreground/90',
      components: [
        'Engine & Internal Components (pistons, valves, camshafts, timing chains, seals, gaskets)',
        'Gearbox / Transmission Systems (manual, automatic, DSG, CVT, dual-clutch, transfer boxes)',
        'Drivetrain & Clutch Assemblies (flywheel, driveshafts, differentials)',
        'Turbocharger & Supercharger Units',
        'Fuel Delivery Systems (tanks, pumps, injectors, fuel rails, fuel control electronics)',
        'Cooling & Heating Systems (radiators, thermostats, water pumps, cooling fans, heater matrix)',
        'Exhaust & Emissions Systems (catalytic converters, DPFs, OPFs, EGR valves, NOx sensors, AdBlue/Eolys systems)',
        'Braking Systems (ABS, calipers, cylinders, master cylinders)',
        'Suspension & Steering Systems (shocks, struts, steering racks, power/electric steering pumps, electronic suspension)',
        'Air Conditioning & Climate Control Systems',
        'Electrical Components & Charging Systems (alternators, starter motors, wiring looms, connectors, relays)',
        'Electronic Control Units (ECUs) & Sensors (engine management, ABS, traction control, emissions sensors)',
        'Lighting & Ignition Systems (headlights, indicators, ignition coils, switches, control modules)',
        'Factory-Fitted Multimedia & Infotainment Systems (screens, sat nav, audio, digital displays)',
        'Driver Assistance Systems (adaptive cruise control, lane assist, steering assist, parking sensors, reversing cameras)',
        'Safety Systems (airbags, seatbelts, pretensioners, safety restraint modules)',
        'Convertible power-hood, motors, hydraulic parts, buttons, switches, wiring, sensors and related parts'
      ],
      showPdf: true,
    },
    {
      id: 'hybrid-phev',
      title: 'Hybrid & PHEV Vehicles',
      icon: Battery,
      bgClass: 'bg-muted-foreground text-white',
      hoverClass: 'hover:bg-muted-foreground/90',
      components: [
        'Includes ALL related petrol/diesel engine parts and labour PLUS:',
        'Hybrid Drive Motors & ECUs',
        'Hybrid Battery Failure',
        'Power Control Units, Inverters & DC-DC Converters',
        'Regenerative Braking Systems',
        'High-Voltage Cables & Connectors',
        'Cooling Systems for Hybrid Components',
        'Charging Ports & On-Board Charging Modules',
        'Hybrid Transmission Components'
      ],
      showPdf: true,
    },
    {
      id: 'electric-vehicles',
      title: 'Electric Vehicles (EVs)',
      icon: Zap,
      bgClass: 'bg-primary text-white',
      hoverClass: 'hover:bg-primary/90',
      components: [
        'Includes ALL related petrol/diesel engine parts and labour PLUS:',
        'EV Drive Motors & Reduction Gear',
        'EV Transmission & Reduction Gearbox Assemblies',
        'High-Voltage Battery Failure',
        'Power Control Units & Inverters',
        'On-Board Charger (OBC) & Charging Ports',
        'DC-DC Converters',
        'Thermal Management Systems',
        'High-Voltage Cables & Connectors',
        'EV-Specific Control Electronics',
        'Regenerative Braking System Components'
      ],
      showPdf: true,
    },
    {
      id: 'motorcycles',
      title: 'Motorcycles (Petrol, Hybrid, EV)',
      icon: Bike,
      bgClass: 'bg-green-600 text-white',
      hoverClass: 'hover:bg-green-700',
      components: [
        'Engine / Motor & Drivetrain Components',
        'Gearbox / Transmission Systems',
        'ECUs, Sensors & Control Modules',
        'Electrical Systems & Wiring',
        'High-Voltage Battery Failure (Hybrid & EV)',
        'Suspension & Steering Systems',
        'Braking Systems',
        'Cooling & Thermal Systems',
        'Lighting & Ignition Systems',
        'Instrumentation & Rider Controls'
      ],
      showPdf: true,
    },
  ];

  const CORE_PARTS_COUNT = 6;

  // Inline reusable row for inserting Platinum + T&Cs PDF links throughout the page.
  // `variant` slightly changes the wording so each placement reads naturally.
  const DocLinksRow = ({
    variant = 'default',
    align = 'left',
  }: {
    variant?: 'coverage' | 'exclusions' | 'plan' | 'default';
    align?: 'left' | 'center';
  }) => {
    if (!platinumDocUrl && !termsDocUrl) return null;
    const platinumLabel =
      variant === 'plan'
        ? 'Full details available in our Platinum Plan document (PDF)'
        : variant === 'coverage'
          ? 'Download full Platinum coverage (PDF)'
          : 'Platinum Cover Summary (PDF)';
    const termsLabel =
      variant === 'exclusions'
        ? 'See full exclusions in our Terms & Conditions (PDF)'
        : variant === 'coverage'
          ? 'View full Terms & Conditions (PDF)'
          : 'Terms & Conditions (PDF)';
    return (
      <div
        className={`mt-8 flex flex-col sm:flex-row gap-3 ${align === 'center' ? 'justify-center' : ''}`}
      >
        {platinumDocUrl && (
          <a
            href={platinumDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white border border-brand-orange/40 text-brand-orange hover:bg-brand-orange/5 font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            {platinumLabel}
          </a>
        )}
        {termsDocUrl && (
          <a
            href={termsDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white border border-green-600/40 text-green-700 hover:bg-green-50 font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            {termsLabel}
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="What's Covered | Complete UK Vehicle Warranty Coverage Guide"
        description="See exactly what your warranty covers and what we pay. Unlimited claims, parts and labour included. Petrol, diesel, hybrid, EV and motorcycles."
      />

      {/* ── 1. HERO ── */}
      <section className="relative px-4 sm:px-6 pt-10 pb-10 md:pt-16 md:pb-12 overflow-hidden border-b border-gray-200">
        <div className="relative z-10 max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center">
          <div className="text-center md:text-left order-2 md:order-1">
            <span className="inline-flex items-center gap-2 bg-brand-orange/10 border border-brand-orange/25 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-brand-orange mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
              Complete Coverage Guide
            </span>
            <h1
              className="font-bold leading-[1.05] tracking-tight mb-5 text-foreground"
              style={{ fontSize: 'clamp(36px, 5.5vw, 64px)' }}
            >
              Know exactly what's covered
              <span className="block text-brand-orange">and what we pay.</span>
            </h1>
            <p className="text-base md:text-lg text-foreground max-w-2xl mx-auto md:mx-0 mb-9 font-light">
              Protect against costly <strong className="font-semibold">mechanical and electrical failures</strong>. We pay your garage <strong className="font-semibold">directly</strong> so you are never out of pocket. <strong className="font-bold">Parts and labour included.</strong>
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <Link
                to="/?step=1"
                className="inline-flex items-center gap-2 bg-brand-orange text-white px-7 py-3.5 rounded-xl font-semibold text-[15px] shadow-[0_8px_30px_rgba(240,90,40,0.4)] hover:bg-brand-orange/90 hover:-translate-y-0.5 transition-all"
              >
                Get my free quote <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={scrollToCoverage}
                className="inline-flex items-center gap-2 border border-border bg-transparent text-foreground px-7 py-3.5 rounded-xl font-medium text-[15px] hover:bg-muted hover:-translate-y-0.5 transition-all"
              >
                See what's covered ↓
              </button>
            </div>
          </div>
          <div className="order-1 md:order-2 hidden md:flex justify-center md:justify-start">
            <img
              src={pandaThumbsUp}
              alt="Buyawarranty panda mascot giving a thumbs up"
              className="w-64 sm:w-72 md:w-[28.8rem] lg:w-[32rem] xl:w-[35.2rem] h-auto object-contain drop-shadow-xl"
              loading="eager"
            />
          </div>
        </div>
      </section>


      {/* ── 2. FULL COVERAGE BY VEHICLE TYPE ── */}
      <section className="py-12 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Full coverage by vehicle type</h2>
            <p className="text-sm text-muted-foreground">
              Select your vehicle type to view everything that's covered.
            </p>
            <DocLinksRow align="center" />
          </div>


          <Accordion type="single" collapsible className="space-y-3">
            {vehicleTypes.map((vt) => {
              const Icon = vt.icon;
              return (
                <AccordionItem key={vt.id} value={vt.id} className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                  <AccordionTrigger
                    className={`w-full px-5 py-4 text-left flex items-center justify-between transition-all duration-300 hover:no-underline ${vt.bgClass} ${vt.hoverClass}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-bold text-base sm:text-lg">{vt.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 py-5 bg-white">
                    <ul className="space-y-2 mb-4">
                      {vt.components.map((component, index) => {
                        const isBold = component.startsWith('Includes ALL');
                        return (
                          <li key={index} className="flex items-start gap-2 text-foreground">
                            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className={`text-sm leading-relaxed ${isBold ? 'font-bold' : ''}`}>{component}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {vt.showPdf && platinumDocUrl && (
                      <a
                        href={platinumDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline font-medium text-sm"
                      >
                        <FileText className="w-4 h-4" />
                        Download Full PDF
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}

            {/* What's not covered */}
            <AccordionItem value="not-covered" className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
              <AccordionTrigger className="w-full px-5 py-4 text-left flex items-center justify-between bg-red-100 hover:bg-red-200 transition-all duration-300 hover:no-underline text-red-800">
                <div className="flex items-center gap-3">
                  <X className="w-5 h-5 flex-shrink-0" />
                  <span className="font-bold text-base sm:text-lg">What's not covered</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 py-5 bg-white">
                <ul className="space-y-3">
                  {notCoveredItems.map((it, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm sm:text-base text-foreground">{it}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">
                  For the complete list of exclusions, please see the full Terms & Conditions PDF.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Modifications and Your Cover */}
            <AccordionItem value="modifications" className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
              <AccordionTrigger className="w-full px-5 py-4 text-left flex items-center justify-between bg-amber-50 hover:bg-amber-100 transition-all duration-300 hover:no-underline text-amber-800">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  <span className="font-bold text-base sm:text-lg">Modifications and Your Cover</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 py-5 bg-white">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <h4 className="font-bold text-foreground">Modifications we're happy with</h4>
                    </div>
                    <ul className="space-y-2 pl-1">
                      {[
                        'Cosmetic upgrades such as body kits, spoilers, trims or badges',
                        'Alloy wheels and tyres within safe manufacturer limits',
                        'Interior upgrades including screens, lighting and seat changes',
                        'Tow bars fitted correctly',
                        'Parking sensors, dash cams and other small accessories',
                        'Road‑legal lighting or exhaust upgrades that meet UK standards',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <h4 className="font-bold text-foreground">Modifications that may affect your cover</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 pl-7">We can still cover the car, but not issues caused by these mods.</p>
                    <ul className="space-y-2 pl-1">
                      {[
                        'Engine remaps, tuning boxes or performance chips',
                        'Turbo or supercharger upgrades',
                        'Lowered or raised suspension and geometry changes',
                        'Electrical rewiring or aftermarket electrics that cause faults',
                        'Non‑legal exhaust systems or noise‑excessive systems',
                        'Oversized wheels or tyres beyond safe limits',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Ban className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <h4 className="font-bold text-foreground">Modifications we cannot cover</h4>
                    </div>
                    <ul className="space-y-2 pl-1">
                      {[
                        'Emissions removals or illegal changes (DPF/EGR delete)',
                        'Illegal window tints that break UK light‑transmission rules',
                        'Straight‑pipe exhausts that break emissions or noise limits',
                        'Any modification that makes the car unsafe or illegal for UK roads',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-muted rounded-lg p-4 border border-border">
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-brand-orange mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-foreground text-sm">Not sure about a modification?</p>
                        <p className="text-sm text-muted-foreground mt-1">Tell us what's been changed and we'll confirm what's covered. It only takes a moment and avoids claim delays.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* High-performance exclusions — placed after Modifications */}
            <AccordionItem value="high-performance" className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
              <AccordionTrigger className="w-full px-5 py-4 text-left flex items-center justify-between bg-sky-100 hover:bg-sky-200 transition-all duration-300 hover:no-underline text-sky-700">
                <div className="flex items-center gap-3">
                  <X className="w-5 h-5 flex-shrink-0" />
                  <span className="font-bold text-base sm:text-lg">Exclusions: High-Performance Cars</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 py-5 bg-white">
                <HighPerformanceExclusionsList />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      
      {/* ── 3. COVERAGE GRID — most urgent question first ── */}
      <div ref={coverageRef}>
        <section className="bg-gray-50 border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-xs uppercase tracking-[0.14em] text-brand-orange font-semibold mb-3 flex items-center gap-2">
            Coverage
            <span className="flex-1 max-w-[40px] h-px bg-brand-orange/40" />
          </div>
          <h2
            className="font-bold tracking-tight leading-tight mb-3 text-foreground"
            style={{ fontSize: 'clamp(26px, 4vw, 44px)' }}
          >
            What your warranty actually covers
          </h2>
          <p className="text-base text-muted-foreground font-light max-w-xl mb-12">
            All major mechanical and electrical parts needed to keep your car running, covered when they fail.
          </p>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {coverageCards.map((c, i) => {
              // On mobile (single column), hide non-core cards behind toggle
              const isCore = i < CORE_PARTS_COUNT;
              const hiddenOnMobile = !isCore && !showAllParts;
              return (
                <div
                  key={i}
                  className={`group bg-white hover:bg-orange-50/40 border border-border rounded-2xl p-7 transition-colors relative overflow-hidden shadow-sm hover:shadow-md ${hiddenOnMobile ? 'hidden sm:block' : ''}`}
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-orange/10 flex items-center justify-center mb-4">
                    <c.Icon className="w-5 h-5 text-brand-orange" strokeWidth={2} />
                  </div>
                  <h3
                    className="text-[17px] font-bold mb-1.5 text-foreground"
                   
                  >
                    {c.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{c.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Mobile-only "see all covered parts" toggle */}
          <div className="mt-6 flex justify-center sm:hidden">
            <button
              onClick={() => setShowAllParts((v) => !v)}
              className="inline-flex items-center gap-2 border border-brand-orange/40 bg-brand-orange/5 text-brand-orange px-5 py-3 rounded-xl font-semibold text-sm hover:bg-brand-orange/10 transition-all"
            >
              {showAllParts ? 'Show fewer parts' : `See all covered parts (+${coverageCards.length - CORE_PARTS_COUNT})`}
              <ChevronDown className={`w-4 h-4 transition-transform ${showAllParts ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* PDF documents — placed right after the coverage grid */}
          <DocLinksRow variant="coverage" />
          </div>
        </section>

        {/* ── 4. COVERED / NOT COVERED COLUMNS ── */}
        <section className="max-w-6xl mx-auto px-6 py-12 border-b border-gray-200">
          <div className="text-xs uppercase tracking-[0.14em] text-brand-orange font-semibold mb-3 flex items-center gap-2">
            At a glance
            <span className="flex-1 max-w-[40px] h-px bg-brand-orange/40" />
          </div>
          <h2
            className="font-bold tracking-tight leading-tight mb-3 text-foreground"
            style={{ fontSize: 'clamp(26px, 4vw, 44px)' }}
          >
            What we cover and what we don't
          </h2>
          <p className="text-base text-muted-foreground font-light max-w-xl mb-12">
            A clear, side-by-side list so you know exactly what your policy includes before you buy.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-muted/40 rounded-2xl border border-border overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-2.5 font-bold text-base border-b border-border bg-green-500/10 text-green-700"
               
              >
                <CheckCircle className="w-5 h-5" /> Covered
              </div>
              {coveredItems.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-6 py-3.5 text-sm border-b border-border last:border-b-0 hover:bg-muted/60 transition-colors"
                >
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-foreground">{it}</span>
                </div>
              ))}
            </div>

            <div className="bg-muted/40 rounded-2xl border border-border overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-2.5 font-bold text-base border-b border-border bg-red-500/10 text-red-600"
               
              >
                <X className="w-5 h-5" /> Not Covered
              </div>
              {notCoveredItems.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-6 py-3.5 text-sm border-b border-border last:border-b-0 hover:bg-muted/60 transition-colors"
                >
                  <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-foreground">{it}</span>
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* ── 5. CLAIM LIMITS — conversion decision point ── */}
        <section className="bg-gray-50 border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-xs uppercase tracking-[0.14em] text-brand-orange font-semibold mb-3 flex items-center gap-2">
            Protection Levels
            <span className="flex-1 max-w-[40px] h-px bg-brand-orange/40" />
          </div>
          <h2
            className="font-bold tracking-tight leading-tight mb-3 text-foreground"
            style={{ fontSize: 'clamp(26px, 4vw, 44px)' }}
          >
            Choose how much we cover per repair
          </h2>
          <p className="text-base text-muted-foreground font-light max-w-xl mb-12">
            Most repairs cost £700 to £1,500. Higher limits protect you against expensive faults like engine and gearbox repairs.
          </p>

          {/* Mobile gets extra top padding so the "Recommended" badge isn't clipped */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 pt-4 md:pt-0">
            {claimLimits.map((l, i) => {
              const isSelected = selectedLimitIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedLimitIndex(i)}
                  aria-pressed={isSelected}
                  className={`relative rounded-2xl border-2 p-5 text-center transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 ${
                    isSelected
                      ? 'border-brand-orange bg-brand-orange/10 shadow-md ring-1 ring-brand-orange/30'
                      : 'border-border bg-muted/40 hover:border-brand-orange/40'
                  }`}
                >
                  {l.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-brand-orange text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap shadow-md">
                      Recommended
                    </span>
                  )}
                  <div
                    className="text-2xl md:text-3xl font-extrabold text-foreground mb-1"
                   
                  >
                    {l.amount}
                  </div>
                  <div className="text-xs text-muted-foreground">{l.label}</div>
                  {isSelected && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-orange">
                      <CheckCircle className="w-3 h-3" /> Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="bg-brand-orange/5 border border-brand-orange/20 rounded-xl px-5 py-4 text-sm text-foreground transition-all">
            💡 <strong>Quick example:</strong> {claimLimits[selectedLimitIndex].example}
          </div>

          <div className="mt-4 flex justify-center md:justify-start">
            <a
              href="/?step=1#quote-form"
              className="inline-flex items-center justify-center bg-brand-orange hover:bg-brand-orange/90 text-white font-bold text-base px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all w-full md:w-auto"
            >
              Get cover today <ArrowRight className="w-6 h-6 ml-2 stroke-[3]" />
            </a>
          </div>

          {/* PDF documents — decision-point reassurance near pricing */}
          <DocLinksRow variant="plan" />

          {/* ── 6. REPAIR COSTS — directly below limits to confirm the choice ── */}
          <div className="mt-16">
            <div className="text-xs uppercase tracking-[0.14em] text-brand-orange font-semibold mb-3 flex items-center gap-2">
              Repair costs
              <span className="flex-1 max-w-[40px] h-px bg-brand-orange/40" />
            </div>
            <h3
              className="font-bold tracking-tight leading-tight mb-3 text-foreground"
              style={{ fontSize: 'clamp(22px, 3vw, 32px)' }}
            >
              What repairs actually cost and what we pay
            </h3>
            <p className="text-base text-muted-foreground font-light max-w-xl mb-8">
              Real examples of common faults so you know what to expect before you buy.
            </p>

            <div className="flex flex-col gap-3">
              {repairExamples.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 bg-muted/40 border border-border rounded-2xl px-5 py-4 hover:border-brand-orange/30 hover:bg-muted/70 transition-colors"
                >
                  <div className="text-2xl flex-shrink-0">{r.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[15px] text-foreground mb-0.5">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.desc}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div
                      className="text-base md:text-lg font-bold text-brand-orange"
                     
                    >
                      {r.range}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">avg UK garage</div>
                    <span className="inline-block mt-1 bg-green-500/10 text-green-700 border border-green-500/25 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                      ✓ Covered
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </section>

      </div>

      {/* ── TRUST BAR ── */}
      <div className="flex justify-center gap-8 flex-wrap px-6 py-7 border-y border-border">
        <a
          href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:opacity-80 transition-opacity"
        >
          <img src={trustpilotStars} alt="Trustpilot 5 stars" className="h-7 w-auto" />
          <span><strong className="text-foreground font-medium">4.8/5</strong> rated on Trustpilot</span>
        </a>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="text-lg">🔧</span>
          <span><strong className="text-foreground font-medium">Approved garages</strong> across the UK</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="text-lg">💳</span>
          <span><strong className="text-foreground font-medium">Claims paid</strong> directly to garage</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="text-lg">📞</span>
          <span><strong className="text-foreground font-medium">UK support</strong> when you need it</span>
        </div>
      </div>


      {/* ── 8. TRUSTPILOT REVIEWS — social proof after decision ── */}
      <section className="bg-gray-50 py-12 text-center border-b border-gray-200">
        <div className="relative max-w-7xl mx-auto px-6">
          <h2
            className="font-bold tracking-tight mb-6 text-foreground"
            style={{ fontSize: 'clamp(24px, 3.5vw, 36px)' }}
          >
            What our customers say
          </h2>
          <div className="bg-white rounded-2xl p-4 md:p-6">
            <div
              className="trustpilot-widget"
              data-locale="en-GB"
              data-template-id="54ad5defc6454f065c28af8b"
              data-businessunit-id="6586c764848940568d554a08"
              data-style-height="240px"
              data-style-width="100%"
              data-stars="4,5"
              data-review-languages="en"
            >
              <a
                href="https://www.trustpilot.com/review/buyawarranty.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground"
              >
                Trustpilot
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. FAQ — late-stage objection handling ── */}
      <section className="max-w-6xl mx-auto px-6 py-12 border-b border-gray-200">
        <div className="text-xs uppercase tracking-[0.14em] text-brand-orange font-semibold mb-3 flex items-center gap-2">
          FAQ
          <span className="flex-1 max-w-[40px] h-px bg-brand-orange/40" />
        </div>
        <h2
          className="font-bold tracking-tight leading-tight mb-3 text-foreground"
          style={{ fontSize: 'clamp(26px, 4vw, 44px)' }}
        >
          Your questions answered
        </h2>
        <p className="text-base text-muted-foreground font-light max-w-xl mb-12">
          Everything you need to know about your cover and how it works.
        </p>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-white border border-border rounded-xl overflow-hidden shadow-sm"
            >
              <AccordionTrigger className="px-6 py-4 text-left font-bold text-[15px] text-white bg-brand-orange hover:bg-brand-orange/90 hover:no-underline [&>svg]:text-white">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-5 pt-5 text-sm text-foreground leading-relaxed bg-white">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Document downloads — secondary trust signal alongside FAQ */}
        <div className="mt-10 pt-8 border-t border-border">
          <h3
            className="font-bold text-foreground mb-2 text-lg"
           
          >
            Your cover, made crystal clear
          </h3>
          <p className="text-sm text-muted-foreground mb-5">Download your warranty and terms documents.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between bg-muted/40 border border-border rounded-xl px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-foreground text-sm truncate">Platinum Warranty</span>
              </div>
              {platinumDocUrl ? (
                <a href={platinumDocUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-brand-orange text-brand-orange hover:bg-brand-orange/5 text-xs">
                    PDF
                  </Button>
                </a>
              ) : (
                <span className="text-muted-foreground text-xs">Loading...</span>
              )}
            </div>

            <div className="flex items-center justify-between bg-muted/40 border border-border rounded-xl px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-foreground text-sm truncate">Terms & Conditions</span>
              </div>
              {termsDocUrl ? (
                <a href={termsDocUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 text-xs">
                    PDF
                  </Button>
                </a>
              ) : (
                <span className="text-muted-foreground text-xs">Loading...</span>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* Help Me Choose modal */}
      <HelpMeChooseModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

      <ScrollToTopButton />
    </div>
  );
};

export default Protected;
