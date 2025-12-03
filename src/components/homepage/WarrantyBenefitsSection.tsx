import React, { useState } from 'react';
import { Check, ArrowUp, Settings, Cpu, Zap, Wrench, Lock, Car, Battery, Bike, ChevronDown, Info, X, CheckCircle, ShieldCheck } from 'lucide-react';
import warrantyPandaMascot from '@/assets/warranty-panda-mascot.png';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const WarrantyBenefitsSection: React.FC = () => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const leftColumnCategories = [
    {
      icon: Settings,
      title: "Mechanical & Electrical",
      headerText: "Everything You Need, Covered:",
      items: ["Full Mechanical & Electrical Cover", "Engine, Gearbox, Clutch, Drivetrain & Turbo", "Brakes, Steering, Suspension, Fuel, Cooling, Emissions & Air-conditioning"],
      showMore: false
    },
    {
      icon: Wrench,
      title: "Plan Benefits",
      headerText: null,
      items: ["Labour & Diagnostics Included", "Generous Repair Limits", "Wear & Tear Protection", "Consequential Damage Cover", "Breakdown Recovery", "Vehicle Rental"],
      showMore: false
    }
  ];

  const rightColumnCategories = [
    {
      icon: Cpu,
      title: "Tech & Safety",
      items: ["Modern Tech & Safety – Sensors, Airbags, Multimedia, Cameras", "Electrical Systems – ECUs, Wiring, Lighting, Charging"],
      showMore: false
    },
    {
      icon: Zap,
      title: "EV & Hybrid",
      items: ["Hybrid & EV Components – Motors, Batteries, Inverters, Charging Units"],
      showMore: true
    }
  ];

  return (
    <section className="py-12 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content */}
        <div className="max-w-5xl mx-auto">
          <div>
            {/* Section Header */}
            <div className="mb-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl md:text-4xl font-bold text-brand-dark-text mb-1">
                  Complete Car Warranty.
                </h2>
                <h2 className="text-2xl md:text-4xl font-bold text-brand-orange mb-3">
                  Peace of Mind.
                </h2>
                <p className="text-base md:text-lg text-gray-500">
                  Superior Protection. Affordable Prices. Instant Cover.
                </p>
              </div>
            </div>
            
            {/* Desktop Collapsible Content - moved outside header */}
            <div className="hidden lg:block">
              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger className="hidden"></CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="space-y-3 mt-4">
                      {/* Petrol & Diesel Vehicles */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-black text-white hover:bg-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors group">
                          <div className="flex items-center gap-3">
                            <Car className="w-5 h-5" />
                            <span className="text-base">Petrol & Diesel Vehicles</span>
                          </div>
                          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm max-h-[400px] overflow-y-auto">
                            <ul className="space-y-1.5 text-sm">
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Engine & Internal Components (pistons, valves, camshafts, timing chains, seals, gaskets)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Gearbox / Transmission Systems (manual, automatic, DSG, CVT, dual-clutch, transfer boxes)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Drivetrain & Clutch Assemblies (flywheel, driveshafts, differentials)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Turbocharger & Supercharger Units</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Fuel Delivery Systems (tanks, pumps, injectors, fuel rails, fuel control electronics)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Cooling & Heating Systems (radiators, thermostats, water pumps, cooling fans, heater matrix)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Exhaust & Emissions Systems (catalytic converters, DPFs, OPFs, EGR valves, NOx sensors, AdBlue/Eolys systems)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Braking Systems (ABS, calipers, cylinders, master cylinders)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Suspension & Steering Systems (shocks, struts, steering racks, power/electric steering pumps, electronic suspension)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Air Conditioning & Climate Control Systems</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Electrical Components & Charging Systems (alternators, starter motors, wiring looms, connectors, relays)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Electronic Control Units (ECUs) & Sensors (engine management, ABS, traction control, emissions sensors)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Lighting & Ignition Systems (headlights, indicators, ignition coils, switches, control modules)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Factory-Fitted Multimedia & Infotainment Systems (screens, sat nav, audio, digital displays)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Driver Assistance Systems (adaptive cruise control, lane assist, steering assist, parking sensors, reversing cameras)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Safety Systems (airbags, seatbelts, pretensioners, safety restraint modules)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Convertible power-hood, motors, hydraulic parts, buttons, switches, wiring, sensors and related parts</span>
                              </li>
                            </ul>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Hybrid & PHEV Vehicles */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-gray-600 text-white hover:bg-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors group">
                          <div className="flex items-center gap-3">
                            <Battery className="w-5 h-5" />
                            <span className="text-base">Hybrid & PHEV Vehicles</span>
                          </div>
                          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <ShieldCheck className="w-4 h-4 text-black flex-shrink-0" />
                              <p className="text-black font-medium text-sm">
                                Includes ALL petrol/diesel engine parts and labour PLUS:
                              </p>
                            </div>
                            <ul className="space-y-1.5 text-sm">
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Hybrid Drive Motors & ECUs</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Hybrid Battery Failure</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Power Control Units, Inverters & DC-DC Converters</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Regenerative Braking Systems</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>High-Voltage Cables & Connectors</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Cooling Systems for Hybrid Components</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Charging Ports & On-Board Charging Modules</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Hybrid Transmission Components</span>
                              </li>
                            </ul>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Electric vehicles (EVs) */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-orange-500 text-white hover:bg-orange-600 font-semibold py-3 px-4 rounded-lg transition-colors group">
                          <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5" />
                            <span className="text-base">Electric vehicles (EVs)</span>
                          </div>
                          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <ShieldCheck className="w-4 h-4 text-black flex-shrink-0" />
                              <p className="text-black font-medium text-sm">
                                Includes ALL petrol/diesel engine parts and labour PLUS:
                              </p>
                            </div>
                            <ul className="space-y-1.5 text-sm">
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>EV Drive Motors & Reduction Gear</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>EV Transmission & Reduction Gearbox Assemblies</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>High-Voltage Battery Failure</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Power Control Units & Inverters</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>On-Board Charger (OBC) & Charging Ports</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>DC-DC Converters</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Thermal Management Systems</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>High-Voltage Cables & Connectors</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>EV-Specific Control Electronics</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Regenerative Braking System Components</span>
                              </li>
                            </ul>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Motorcycles */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-green-500 text-white hover:bg-green-600 font-semibold py-3 px-4 rounded-lg transition-colors group">
                          <div className="flex items-center gap-3">
                            <Bike className="w-5 h-5" />
                            <span className="text-base">Motorcycles (Petrol, Hybrid, EV)</span>
                          </div>
                          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <ul className="space-y-1.5 text-sm">
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Engine / Motor & Drivetrain Components</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Gearbox / Transmission Systems</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>ECUs, Sensors & Control Modules</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Electrical Systems & Wiring</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>High-Voltage Battery Failure (Hybrid & EV)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Suspension & Steering Systems</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Braking Systems</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Cooling & Thermal Systems</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Lighting & Ignition Systems</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Instrumentation & Rider Controls</span>
                              </li>
                            </ul>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* What's not covered */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-red-100 text-red-700 hover:bg-red-200 font-semibold py-3 px-4 rounded-lg transition-colors group">
                          <div className="flex items-center gap-3">
                            <X className="w-5 h-5" />
                            <span className="text-base">What's not covered</span>
                          </div>
                          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-3 p-4 bg-red-50 rounded-lg border border-red-200">
                            <p className="text-gray-700 font-medium mb-3 text-sm">
                              We keep things straightforward and transparent.
                            </p>
                            <ul className="space-y-1.5 text-sm">
                              <li className="flex items-start gap-2">
                                <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-700">Pre-existing faults</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-700">Routine servicing and maintenance</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-700">Vehicles used for hire or reward</span>
                              </li>
                            </ul>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

            {/* Two Column Coverage Layout */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Left Column - Mechanical & Electrical, Features */}
              <div className="space-y-4">
                {leftColumnCategories.map((category, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    {category.headerText && (
                      <p className="text-center lg:text-left font-bold text-brand-dark-text mb-3">{category.headerText}</p>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                        <category.icon className="w-5 h-5 text-brand-orange" />
                      </div>
                      <h3 className="font-bold text-brand-dark-text text-lg">{category.title}</h3>
                    </div>
                    <div className="space-y-2">
                      {category.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-gray-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column - Tech & Safety, EV & Hybrid */}
              <div className="space-y-4">
                {rightColumnCategories.map((category, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                        <category.icon className="w-5 h-5 text-brand-orange" />
                      </div>
                      <h3 className="font-bold text-brand-dark-text text-lg">{category.title}</h3>
                    </div>
                    <div className="space-y-2">
                      {category.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-gray-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Desktop CTAs - below EV & Hybrid box */}
                <div className="hidden lg:flex flex-col items-start gap-4 mt-4">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setDetailsOpen(!detailsOpen)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 rounded-lg px-4 py-3 shadow-sm animate-[breathing_3s_ease-in-out_infinite] transition-colors"
                    >
                      <Info className="w-5 h-5 text-white" />
                      <span className="text-base font-medium text-white whitespace-nowrap">See full coverage</span>
                      <ChevronDown className={`w-5 h-5 text-white transition-transform duration-300 ${detailsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      onClick={scrollToTop}
                      className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-medium px-4 py-3 rounded-lg shadow-sm transition-colors animate-[breathing_3s_ease-in-out_infinite]"
                    >
                      Get my quote
                      <ArrowUp className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Desktop: Panda below CTAs */}
                  <div className="flex justify-start">
                    <img 
                      src={warrantyPandaMascot} 
                      alt="Miles the Panda mascot with car" 
                      className="w-48 md:w-56 lg:w-64 h-auto object-contain"
                    />
                  </div>
                  
                  {/* Desktop: Trustpilot */}
                  <TrustpilotHeader className="flex-shrink-0" />
                  
                  {/* Desktop: Security text */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Lock className="w-4 h-4 text-green-600" />
                    <span>Your details are encrypted and safe.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Only: What's Covered Accordion */}
            <div className="lg:hidden mb-6">
              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex justify-center items-center gap-3 py-2 group cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 rounded-lg px-4 py-2 shadow-sm animate-[breathing_3s_ease-in-out_infinite]">
                      <Info className="w-5 h-5 text-white" />
                      <span className="text-base font-medium text-white whitespace-nowrap">See full coverage</span>
                    </div>
                    <ChevronDown className={`w-10 h-10 text-green-600 transition-transform duration-300 ease-in-out ${detailsOpen ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="space-y-3 mt-4">
                    {/* Petrol & Diesel Vehicles */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-black text-white hover:bg-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors group">
                        <div className="flex items-center gap-3">
                          <Car className="w-5 h-5" />
                          <span className="text-base">Petrol & Diesel Vehicles</span>
                        </div>
                        <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm max-h-[400px] overflow-y-auto">
                          <ul className="space-y-1.5 text-sm">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Engine & Internal Components (pistons, valves, camshafts, timing chains, seals, gaskets)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Gearbox / Transmission Systems (manual, automatic, DSG, CVT, dual-clutch, transfer boxes)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Drivetrain & Clutch Assemblies (flywheel, driveshafts, differentials)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Turbocharger & Supercharger Units</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Fuel Delivery Systems (tanks, pumps, injectors, fuel rails, fuel control electronics)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Cooling & Heating Systems (radiators, thermostats, water pumps, cooling fans, heater matrix)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Exhaust & Emissions Systems (catalytic converters, DPFs, OPFs, EGR valves, NOx sensors, AdBlue/Eolys systems)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Braking Systems (ABS, calipers, cylinders, master cylinders)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Suspension & Steering Systems (shocks, struts, steering racks, power/electric steering pumps, electronic suspension)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Air Conditioning & Climate Control Systems</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Electrical Components & Charging Systems (alternators, starter motors, wiring looms, connectors, relays)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Electronic Control Units (ECUs) & Sensors (engine management, ABS, traction control, emissions sensors)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Lighting & Ignition Systems (headlights, indicators, ignition coils, switches, control modules)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Factory-Fitted Multimedia & Infotainment Systems (screens, sat nav, audio, digital displays)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Driver Assistance Systems (adaptive cruise control, lane assist, steering assist, parking sensors, reversing cameras)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Safety Systems (airbags, seatbelts, pretensioners, safety restraint modules)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Convertible power-hood, motors, hydraulic parts, buttons, switches, wiring, sensors and related parts</span>
                            </li>
                          </ul>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Hybrid & PHEV Vehicles */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-gray-600 text-white hover:bg-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors group">
                        <div className="flex items-center gap-3">
                          <Battery className="w-5 h-5" />
                          <span className="text-base">Hybrid & PHEV Vehicles</span>
                        </div>
                        <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <ShieldCheck className="w-4 h-4 text-black flex-shrink-0" />
                            <p className="text-black font-medium text-sm">
                              Includes ALL petrol/diesel engine parts and labour PLUS:
                            </p>
                          </div>
                          <ul className="space-y-1.5 text-sm">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Hybrid Drive Motors & ECUs</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Hybrid Battery Failure</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Power Control Units, Inverters & DC-DC Converters</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Regenerative Braking Systems</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>High-Voltage Cables & Connectors</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Cooling Systems for Hybrid Components</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Charging Ports & On-Board Charging Modules</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Hybrid Transmission Components</span>
                            </li>
                          </ul>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Electric vehicles (EVs) */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-orange-500 text-white hover:bg-orange-600 font-semibold py-3 px-4 rounded-lg transition-colors group">
                        <div className="flex items-center gap-3">
                          <Zap className="w-5 h-5" />
                          <span className="text-base">Electric vehicles (EVs)</span>
                        </div>
                        <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <ShieldCheck className="w-4 h-4 text-black flex-shrink-0" />
                            <p className="text-black font-medium text-sm">
                              Includes ALL petrol/diesel engine parts and labour PLUS:
                            </p>
                          </div>
                          <ul className="space-y-1.5 text-sm">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>EV Drive Motors & Reduction Gear</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>EV Transmission & Reduction Gearbox Assemblies</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>High-Voltage Battery Failure</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Power Control Units & Inverters</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>On-Board Charger (OBC) & Charging Ports</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>DC-DC Converters</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Thermal Management Systems</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>High-Voltage Cables & Connectors</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>EV-Specific Control Electronics</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Regenerative Braking System Components</span>
                            </li>
                          </ul>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Motorcycles */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-green-500 text-white hover:bg-green-600 font-semibold py-3 px-4 rounded-lg transition-colors group">
                        <div className="flex items-center gap-3">
                          <Bike className="w-5 h-5" />
                          <span className="text-base">Motorcycles (Petrol, Hybrid, EV)</span>
                        </div>
                        <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <ul className="space-y-1.5 text-sm">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Engine / Motor & Drivetrain Components</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Gearbox / Transmission Systems</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>ECUs, Sensors & Control Modules</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Electrical Systems & Wiring</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>High-Voltage Battery Failure (Hybrid & EV)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Suspension & Steering Systems</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Braking Systems</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Cooling & Thermal Systems</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Lighting & Ignition Systems</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Instrumentation & Rider Controls</span>
                            </li>
                          </ul>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* What's not covered */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-red-100 text-red-700 hover:bg-red-200 font-semibold py-3 px-4 rounded-lg transition-colors group">
                        <div className="flex items-center gap-3">
                          <X className="w-5 h-5" />
                          <span className="text-base">What's not covered</span>
                        </div>
                        <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 p-4 bg-red-50 rounded-lg border border-red-200">
                          <p className="text-gray-700 font-medium mb-3 text-sm">
                            We keep things straightforward and transparent.
                          </p>
                          <ul className="space-y-1.5 text-sm">
                            <li className="flex items-start gap-2">
                              <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">Pre-existing faults</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">Routine servicing and maintenance</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">Vehicles used for hire or reward</span>
                            </li>
                          </ul>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Panda and CTA Section - Mobile only */}
            <div className="lg:hidden flex flex-col items-center gap-6">
              {/* Panda */}
              <div className="flex justify-center">
                <img 
                  src={warrantyPandaMascot} 
                  alt="Miles the Panda mascot with car" 
                  className="w-48 md:w-56 h-auto object-contain"
                />
              </div>
              
              {/* CTA Button + Trust - Below Panda */}
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={scrollToTop}
                  className="inline-flex items-center justify-center gap-3 bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 py-3 text-base rounded-lg shadow-lg transition-all animate-[breathing_3s_ease-in-out_infinite]"
                >
                  Get my quote
                  <ArrowUp className="w-6 h-6" />
                </button>
                
                {/* Trust & Reassurance */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <TrustpilotHeader className="flex-shrink-0 scale-90 sm:scale-100" />
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Lock className="w-4 h-4 text-green-600" />
                    <span>Your details are encrypted and safe.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WarrantyBenefitsSection;
