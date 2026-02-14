import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Shield, Clock, ArrowRight, Fuel, Battery, Zap, Bike, X, FileText, Wrench, Phone, Star, ChevronRight, ChevronDown } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { OptimizedImage } from '@/components/OptimizedImage';
import { supabase } from '@/integrations/supabase/client';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import bmwWarranty from '@/assets/bmw-warranty.webp';
import audiWarrantyPhone from '@/assets/audi-warranty-phone.png';
import pandaSavingsVehicles from '@/assets/panda-savings-vehicles.png';
import pandaVans from '@/assets/panda-vans.png';
import HighPerformanceExclusionsList from '@/components/HighPerformanceExclusionsList';

const Protected = () => {
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string>('');
  const [termsDocUrl, setTermsDocUrl] = useState<string>('');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

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

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

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
      bgClass: 'bg-success text-white',
      hoverClass: 'hover:bg-success/90',
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
    {
      id: 'not-covered',
      title: "What Is Not Covered",
      icon: X,
      bgClass: 'bg-red-100 text-red-700',
      hoverClass: 'hover:bg-red-200',
      components: [
        'Tyres',
        'Brake pads',
        'Bulbs',
        'Wiper blades',
        'Filters and fluids',
        'Paintwork or cosmetic damage',
        'Routine service items',
        'Cosmetic or trim related items'
      ],
      showPdf: false,
      isExclusion: true,
    },
  ];

  const repairCosts = [
    { name: 'Engine repair', cost: '£1,500 – £3,000' },
    { name: 'Gearbox repair', cost: '£900 – £2,500' },
    { name: 'ECU faults', cost: '£450 – £1,200' },
    { name: 'Turbocharger failure', cost: '£700 – £2,000' },
    { name: 'Fuel pump failure', cost: '£350 – £900' },
  ];

  const claimSteps = [
    { step: '1', title: 'Contact Us', desc: 'Contact us or ask your VAT registered garage to call before work begins.' },
    { step: '2', title: 'Same-Day Approval', desc: 'We approve the repair on the same day in most cases.' },
    { step: '3', title: 'Pay Your Excess', desc: 'You pay any agreed excess.' },
    { step: '4', title: 'Back on the Road', desc: 'We cover the rest and you are back on the road.' },
  ];

  const faqs = [
    { q: 'Is my car too old or too many miles?', a: 'We cover many older and higher mileage vehicles up to 15 years old and 150,000 miles. Check your instant price to confirm.' },
    { q: 'What about modified vehicles?', a: 'Most body modifications are accepted. Call us on 0330 229 5040 or request a call back using the Call us button in the top navigation bar.' },
    { q: 'What is the most expensive repair you have covered?', a: 'We regularly cover repairs over £1,500 for engines, gearboxes and ECUs. Higher claim limits are available. Check your instant price by entering your registration.' },
    { q: 'Can I use my own garage?', a: 'Yes. Any VAT registered garage is acceptable or we can recommend an approved garage.' },
    { q: 'Do I need a full service history?', a: 'A reasonable service history is fine. Many vehicles are accepted even if servicing has been missed.' },
    { q: 'Are diagnostics covered?', a: 'Diagnostics are usually covered when the fault is approved.' },
  ];

  const whyChooseUs = [
    'Protection from unexpected repair bills',
    'Use any VAT registered garage',
    'UK network of recommended garages',
    'Fast claim decisions',
    'Instant online prices',
    'Simple and clear cover',
    'Rated highly by drivers across the UK',
    '14-day money-back guarantee',
  ];

  const includedSystems = [
    'Engine', 'Gearbox', 'Clutch', 'Turbo & supercharger', 'Fuel system', 'Cooling system',
    'Air conditioning', 'Electrical systems & ECUs', 'Steering', 'Suspension', 'Braking system',
    'Drive system', 'Heating & ventilation', 'Safety systems',
    'Infotainment, multimedia screens, navigation units, parking sensors & reversing cameras',
    'Any other essential systems that support normal operation'
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEOHead 
        title="Your Warranty Explained | Comprehensive UK Vehicle Protection"
        description="Clear protection. Simple cover. Zero jargon. See exactly what your Platinum Warranty covers for petrol, diesel, hybrid and electric vehicles. Instant online prices."
      />

      {/* ═══ HERO ═══ */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-orange-50 py-12 md:py-14 pb-6 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-5">
            Your Warranty <span className="text-primary">Explained</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-4">
            Clear protection. Simple cover. Zero jargon.
          </p>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-8">
            Unexpected repairs can cost between £350 and £2,500. Your Platinum Warranty protects you from surprise repair bills with approved UK garages, fast claim decisions and instant online pricing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <div className="flex items-center gap-2 bg-white border border-border rounded-full px-4 py-2 shadow-sm">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">Trusted by UK drivers</span>
            </div>
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white border border-border rounded-full px-4 py-2 shadow-sm hover:opacity-80 transition-opacity"
            >
              <OptimizedImage src={trustpilotLogo} alt="Trustpilot Excellent Rating" className="h-5 w-auto object-contain" priority={false} width={80} height={25} />
              <span className="text-sm font-medium">Rated highly by our customers</span>
            </a>
            <div className="flex items-center gap-2 bg-white border border-border rounded-full px-4 py-2 shadow-sm">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Instant prices in under 30 seconds</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link to="/">
              <Button size="lg" className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-10 py-6 text-lg rounded-lg animate-breathing flex items-center gap-2">
                Get My Instant Price
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="#coverage-list" className="text-primary hover:underline font-semibold flex items-center gap-1">
              View Covered Parts <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className="max-w-md mx-auto">
            <img src={bmwWarranty} alt="BMW i3 with buyawarranty branding" className="w-full h-auto object-contain" loading="eager" />
          </div>
        </div>
      </section>

      {/* ═══ WHAT IS INCLUDED ═══ */}
      <section id="coverage-list" className="py-8 md:py-10 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">What Is Included</h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              The Platinum Warranty covers all major mechanical and electrical parts needed for safe and reliable driving.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto mb-6">
            {includedSystems.map((system, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{system}</span>
              </div>
            ))}
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center mb-8">
            <p className="text-sm font-medium text-green-700">
              If the part is important to the smooth and safe running of your vehicle, it is normally covered.
            </p>
          </div>

          {/* Download Full Cover Guide */}
          <div className="flex flex-col items-center gap-3">
            <h3 className="text-lg font-bold text-foreground">Download your full cover guide</h3>
            {platinumDocUrl ? (
              <a href={platinumDocUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="flex items-center gap-2 border-primary text-primary hover:bg-primary/5">
                  <FileText className="w-4 h-4" />
                  Download PDF
                </Button>
              </a>
            ) : (
              <span className="text-muted-foreground text-sm">Loading PDF...</span>
            )}
          </div>
        </div>
      </section>

      {/* ═══ VEHICLE TYPE DROPDOWNS ═══ */}
      <section className="py-14 md:py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Full Coverage by Vehicle Type</h2>
            <p className="text-base text-muted-foreground">
              Select your vehicle type to view everything that's covered.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {vehicleTypes.map((vt) => {
              const Icon = vt.icon;
              return (
                <AccordionItem key={vt.id} value={vt.id} className="bg-white rounded-lg shadow-sm border border-border overflow-hidden">
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
                            {vt.isExclusion ? (
                              <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                            )}
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

            {/* High Performance Exclusions */}
            <AccordionItem value="high-performance" className="bg-white rounded-lg shadow-sm border border-border overflow-hidden">
              <AccordionTrigger className="w-full px-5 py-4 text-left flex items-center justify-between bg-sky-100 hover:bg-sky-200 transition-all duration-300 hover:no-underline text-sky-700">
                <div className="flex items-center gap-3">
                  <X className="w-5 h-5 flex-shrink-0" />
                  <span className="font-bold text-base sm:text-lg">Exclusions: High-End & Performance Cars</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 py-5 bg-white">
                <HighPerformanceExclusionsList />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* ═══ TRANSPARENT COVERAGE - PDF Downloads ═══ */}
      <section className="py-14 md:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 mb-4">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700">Transparent Coverage</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Your cover, made <span className="text-brand-orange">crystal clear</span>
            </h2>
            <p className="text-muted-foreground">Download your warranty and terms documents.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-orange-50 border border-orange-200/50 rounded-lg px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-foreground">Platinum Warranty Document</span>
              </div>
              {platinumDocUrl ? (
                <a href={platinumDocUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-brand-orange text-brand-orange hover:bg-brand-orange/5">
                    Download PDF
                  </Button>
                </a>
              ) : (
                <span className="text-muted-foreground text-sm">Loading...</span>
              )}
            </div>

            <div className="flex items-center justify-between bg-green-50 border border-green-200/50 rounded-lg px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-foreground">Terms & Conditions</span>
              </div>
              {termsDocUrl ? (
                <a href={termsDocUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                    Download PDF
                  </Button>
                </a>
              ) : (
                <span className="text-muted-foreground text-sm">Loading...</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LABOUR RATES ═══ */}
      <section className="py-14 md:py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Labour Rates</h2>
          <p className="text-muted-foreground mb-8">Choose the rate that suits your garage preference.</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {['£50', '£70', '£100', '£200'].map((rate) => (
              <div key={rate} className="bg-white border border-border rounded-xl p-5 shadow-sm">
                <p className="text-2xl font-bold text-primary">{rate}</p>
                <p className="text-sm text-muted-foreground">per hour</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            This gives flexibility to choose your preferred VAT registered garage anywhere in the UK.
          </p>
        </div>
      </section>

      {/* ═══ REPAIR COST EXAMPLES ═══ */}
      <section className="py-14 md:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Typical Repair Costs</h2>
            <p className="text-muted-foreground">See what you could be protected from.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-3">
              {repairCosts.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Wrench className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-foreground">{item.name}</span>
                  </div>
                  <span className="font-bold text-red-600">{item.cost}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <img src={audiWarrantyPhone} alt="Audi car with buyawarranty app on phone" className="w-64 md:w-80 h-auto object-contain" loading="lazy" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center mt-6">
            <p className="text-sm font-medium text-green-700">
              Your Platinum Warranty protects you from these unexpected bills.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ HOW CLAIMS WORK ═══ */}
      <section className="py-14 md:py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">How Claims Work</h2>
            <p className="text-muted-foreground">Simple, fast and stress-free.</p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {claimSteps.map((s) => (
              <div key={s.step} className="bg-white rounded-xl border border-border p-6 md:p-8 text-center shadow-sm">
                <div className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-5">
                  {s.step}
                </div>
                <h3 className="font-bold text-foreground mb-3 text-lg">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-center mt-10">
            <p className="text-sm font-medium text-green-700 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Average decision time is under two hours upon receiving repair details from your garage.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ WHY DRIVERS CHOOSE US ═══ */}
      <section className="py-14 md:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Why Drivers Choose Us</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="flex justify-center order-2 md:order-1">
              <img src={pandaVans} alt="Miles the panda with buyawarranty vans" className="w-72 md:w-80 h-auto object-contain" loading="lazy" />
            </div>
            <div className="grid gap-3 order-1 md:order-2">
              {whyChooseUs.map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CUSTOMER STORY ═══ */}
      <section className="py-14 md:py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-2xl border border-border p-8 md:p-10 shadow-sm">
            <div className="flex justify-center mb-4">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <blockquote className="text-lg md:text-xl text-foreground italic mb-4 leading-relaxed">
              "My BMW needed a new water pump. The garage quoted £780. Buyawarranty approved the repair and I paid nothing. Everything was fast and easy."
            </blockquote>
            <p className="font-semibold text-foreground">Matt from Leeds</p>
          </div>
        </div>
      </section>

      {/* ═══ FAQs ═══ */}
      <section className="py-14 md:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={() => setOpenFaqIdx(openFaqIdx === i ? null : i)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-orange-600/20 transition-colors"
                >
                  <span className="font-semibold text-lg text-white pr-4">{faq.q}</span>
                  <ChevronDown className={`w-6 h-6 flex-shrink-0 text-white transition-transform duration-300 ${openFaqIdx === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-200 ease-out ${openFaqIdx === i ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-6 pb-5 bg-white border-t border-orange-200">
                    <p className="pt-4 text-foreground leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-16 md:py-20 bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-center gap-2 text-white/90">
              <Clock className="w-5 h-5" />
              <span className="font-medium">Instant online prices in under 30 seconds</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-white/90">
              <Shield className="w-5 h-5" />
              <span className="font-medium">Cover designed to protect against real repair bills</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-white/90">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">14-day money-back guarantee for complete confidence</span>
            </div>
          </div>

          <Link to="/">
            <Button size="lg" className="bg-white text-primary hover:bg-gray-100 font-bold px-12 py-6 text-lg rounded-lg animate-breathing flex items-center gap-2 mx-auto">
              Get My Instant Price
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>

          <div className="mt-10 flex justify-center">
            <img src={pandaSavingsVehicles} alt="Miles the panda with vehicles and savings jar" className="w-72 md:w-96 h-auto object-contain" loading="lazy" />
          </div>
        </div>
      </section>

      <ScrollToTopButton />
    </div>
  );
};

export default Protected;
