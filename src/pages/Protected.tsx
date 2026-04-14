import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Shield, Clock, ArrowRight, Fuel, Battery, Zap, Bike, X, FileText, Wrench, Phone, Settings, AlertTriangle, Ban, HelpCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import HighPerformanceExclusionsList from '@/components/HighPerformanceExclusionsList';

import CoverHero from '@/components/cover-page/CoverHero';
import BenefitsStrip from '@/components/cover-page/BenefitsStrip';
import PandaReassurance from '@/components/cover-page/PandaReassurance';
import RepairCostsSection from '@/components/cover-page/RepairCostsSection';
import ClaimLimitSelector from '@/components/cover-page/ClaimLimitSelector';
import CoverTestimonial from '@/components/cover-page/CoverTestimonial';
import CoverMiniFAQ from '@/components/cover-page/CoverMiniFAQ';


import HelpMeChooseModal from '@/components/cover-page/HelpMeChooseModal';

const Protected = () => {
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string>('');
  const [termsDocUrl, setTermsDocUrl] = useState<string>('');
  const [showHelpModal, setShowHelpModal] = useState(false);
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

  const scrollToCoverage = () => {
    coverageRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const openHelpModal = () => setShowHelpModal(true);

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
    {
      id: 'not-covered',
      title: "What Is Not Covered",
      icon: X,
      bgClass: 'bg-red-100 text-red-700',
      hoverClass: 'hover:bg-red-200',
      components: [
        'Pre-existing faults',
        'Routine servicing and maintenance',
        'Tyres, brake pads, and wear & tear items',
        'Accidental damage or accident repairs',
        'Motor trader-owned or operated vehicles',
        'Hire and reward use (taxis, rentals, couriers)'
      ],
      showPdf: false,
      isExclusion: true,
    },
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

      {/* 1. Hero */}
      <CoverHero />

      {/* 2. Benefits Strip */}
      <BenefitsStrip />

      {/* 3. Coverage Details (scrolled to via "See how cover works") */}
      <div ref={coverageRef}>
        {/* What Is Included */}
        <section id="coverage-list" className="py-8 md:py-12 bg-muted">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">What is included</h2>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
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

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center mb-8">
              <p className="text-sm font-medium text-green-700">
                If the part is important to the smooth and safe running of your vehicle, it is normally covered.
              </p>
            </div>

          </div>
        </section>

        {/* Vehicle Type Accordions */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Full coverage by vehicle type</h2>
              <p className="text-sm text-muted-foreground">
                Select your vehicle type to view everything that's covered.
              </p>
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
                    {/* Happy with */}
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

                    {/* May affect */}
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

                    {/* Cannot cover */}
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

                    {/* Not sure */}
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
            </Accordion>
          </div>
        </section>

        {/* Transparent Coverage - PDF Downloads */}
        <section className="py-16 md:py-20 bg-muted">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Your cover, made crystal clear
              </h2>
              <p className="text-sm text-muted-foreground">Download your warranty and terms documents.</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white border border-border rounded-xl px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-foreground text-sm">Platinum Warranty Document</span>
                </div>
                {platinumDocUrl ? (
                  <a href={platinumDocUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="border-brand-orange text-brand-orange hover:bg-brand-orange/5 text-xs">
                      Download PDF
                    </Button>
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">Loading...</span>
                )}
              </div>

              <div className="flex items-center justify-between bg-white border border-border rounded-xl px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-foreground text-sm">Terms & Conditions</span>
                </div>
                {termsDocUrl ? (
                  <a href={termsDocUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 text-xs">
                      Download PDF
                    </Button>
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">Loading...</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Panda Reassurance */}
      <PandaReassurance onSeeHowCoverWorks={scrollToCoverage} />

      {/* Typical Repair Costs */}
      <RepairCostsSection onTalkToTechnician={openHelpModal} />

      {/* Claim Limit Selector */}
      <ClaimLimitSelector onHelpMeChoose={openHelpModal} />

      {/* Testimonial */}
      <CoverTestimonial />

      {/* 8. Mini FAQ */}
      <CoverMiniFAQ onAskQuestion={openHelpModal} />

      {/* CoverFinalCTA removed — duplicate of section above */}


      {/* Help Me Choose modal */}
      <HelpMeChooseModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

      <ScrollToTopButton />
    </div>
  );
};

export default Protected;
