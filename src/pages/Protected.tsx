import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, ChevronDown, CheckCircle, Phone, Mail, Shield, Clock, Users, Wrench, FileText, Star, X, Fuel, Battery, Zap, Bike, Crown, ArrowRight, ArrowUp } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { OptimizedImage } from '@/components/OptimizedImage';
import { supabase } from '@/integrations/supabase/client';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';

const Protected = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string>('');
  const [termsDocUrl, setTermsDocUrl] = useState<string>('');

  useEffect(() => {
    const fetchDocuments = async () => {
      // Fetch Platinum document
      const { data: platinumData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'platinum')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (platinumData) {
        setPlatinumDocUrl(platinumData.file_url);
      }

      // Fetch Terms document
      const { data: termsData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'terms-and-conditions')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (termsData) {
        setTermsDocUrl(termsData.file_url);
      }
    };
    
    fetchDocuments();
  }, []);

  const vehicleTypes = [
    {
      id: 'petrol-diesel',
      title: 'Petrol & Diesel Vehicles',
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
        'Convertible power-hood, motors, hydraulic parts , buttons, switches, wiring, sensors and related parts'
      ]
    },
    {
      id: 'hybrid-phev',
      title: 'Hybrid & PHEV Vehicles',
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
      ]
    },
    {
      id: 'electric-vehicles',
      title: 'Electric vehicles (EVs)',
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
      ]
    },
    {
      id: 'motorcycles',
      title: 'Motorcycles (Petrol, Hybrid, EV)',
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
      ]
    },
    {
      id: 'not-covered',
      title: "What's not covered",
      components: [
        'We keep things straightforward and transparent.',
        '',
        "What's Not Included:",
        'Pre-existing faults',
        'Routine servicing and maintenance (such as fluids or brake pads)',
        'Vehicles used for hire or reward (including taxis, rentals, or couriers)'
      ]
    }
  ];

  const getVehicleConfig = (vehicleId: string) => {
    switch (vehicleId) {
      case 'petrol-diesel':
        return { 
          icon: Fuel, 
          bgColor: 'bg-foreground', 
          bgColorHover: 'hover:bg-foreground/90' 
        };
      case 'hybrid-phev':
        return { 
          icon: Battery, 
          bgColor: 'bg-muted-foreground', 
          bgColorHover: 'hover:bg-muted-foreground/90' 
        };
      case 'electric-vehicles':
        return { 
          icon: Zap, 
          bgColor: 'bg-primary', 
          bgColorHover: 'hover:bg-primary/90' 
        };
      case 'motorcycles':
        return { 
          icon: Bike, 
          bgColor: 'bg-success', 
          bgColorHover: 'hover:bg-success/90' 
        };
      case 'not-covered':
        return { 
          icon: X, 
          bgColor: 'bg-red-100', 
          bgColorHover: 'hover:bg-red-200' 
        };
      default:
        return { 
          icon: Fuel, 
          bgColor: 'bg-muted-foreground', 
          bgColorHover: 'hover:bg-muted-foreground/90' 
        };
    }
  };

  const VehicleSection = ({ vehicleType }: { vehicleType: typeof vehicleTypes[0] }) => {
    const config = getVehicleConfig(vehicleType.id);
    const IconComponent = config.icon;
    const isNotCovered = vehicleType.id === 'not-covered';
    
    return (
      <AccordionItem value={vehicleType.id} className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <AccordionTrigger 
          className={`w-full px-4 sm:px-6 py-4 text-left flex items-center justify-between transition-all duration-300 hover:no-underline ${config.bgColor} ${config.bgColorHover} ${
            isNotCovered ? 'text-red-600' : 'text-white'
          }`}
        >
          <div className="flex items-center">
            <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 flex-shrink-0" />
            <span className="font-bold text-base sm:text-lg break-words">{vehicleType.title}</span>
          </div>
        </AccordionTrigger>
        
        <AccordionContent className="px-4 sm:px-6 py-4 bg-white">
          <ul className="space-y-2">
            {vehicleType.components.map((component, index) => {
              if (vehicleType.id === 'not-covered') {
                // Handle special formatting for not-covered section
                if (component === '') {
                  return <li key={index} className="h-2"></li>; // Empty space
                }
                if (component === 'We keep things straightforward and transparent.' || component === "What's Not Included:") {
                  return (
                    <li key={index} className="text-gray-700">
                      <span className="text-sm leading-relaxed font-medium">{component}</span>
                    </li>
                  );
                }
                // Items with X
                return (
                  <li key={index} className="flex items-start text-gray-700">
                    <X className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm leading-relaxed">{component}</span>
                  </li>
                );
              }
              // Bold formatting for "Includes all related..." text in hybrid and EV sections
              if (component.startsWith('Includes ALL related petrol/diesel engine parts and labour PLUS')) {
                return (
                  <li key={index} className="flex items-start text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm leading-relaxed font-bold">{component}</span>
                  </li>
                );
              }
              // Default formatting for covered items
              return (
                <li key={index} className="flex items-start text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm leading-relaxed">{component}</span>
                </li>
              );
            })}
          </ul>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <SEOHead 
        title="What's Covered in My Car Warranty | Comprehensive UK Vehicle Protection"
        description="Discover what's covered in your Buy-a-Warranty plan. Full mechanical and electrical protection for petrol, diesel, hybrid, and electric vehicles. No hidden exclusions."
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-orange-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Your Warranty <span className="text-primary">Explained</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            At Buy-a-Warranty, we like to keep things straightforward. One solid plan that works for cars, vans, and motorbikes - whether you're driving electric, hybrid, petrol or diesel.
          </p>
          
          {/* Instant Activation Notice */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-green-50 border border-green-400 rounded-lg p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-green-100 cursor-pointer group">
              <div className="flex items-center justify-center mb-1.5">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-lg font-bold text-gray-900 transition-colors duration-300 group-hover:text-green-700">Instant Activation</h3>
              </div>
              <p className="text-sm text-gray-700 text-center transition-colors duration-300 group-hover:text-gray-900">
                ⚡ Cover starts immediately after purchase
              </p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
            <div className="flex items-center justify-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
              <Shield className="w-6 h-6 text-green-500" />
              <span className="font-medium">No confusing packages</span>
            </div>
            <div className="flex items-center justify-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <span className="font-medium">No hidden exclusions</span>
            </div>
            <div className="flex items-center justify-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
              <Clock className="w-6 h-6 text-green-500" />
              <span className="font-medium">Fast payouts and support</span>
            </div>
          </div>
          
          <p className="text-lg text-gray-900 font-semibold mt-8">
            If something goes wrong, <span className="text-brand-orange">we look for reasons to say yes!</span>
          </p>
          
          {/* Trustpilot Section */}
          <div className="flex justify-center mt-6">
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block hover:opacity-80 transition-opacity"
            >
              <OptimizedImage 
                src={trustpilotLogo} 
                alt="Trustpilot Excellent Rating - 5 Stars"
                className="h-12 w-auto object-contain"
                priority={false}
                width={160}
                height={50}
              />
            </a>
          </div>
        </div>
      </section>

      {/* Full Coverage List */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Full List of Covered Components
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Select your vehicle type to view everything that's include - covering electrical, mechanical parts, consequential damage and labour.
            </p>
          </div>
          
          <Accordion type="single" collapsible className="space-y-4 max-w-5xl mx-auto">
            {vehicleTypes.map((vehicleType) => (
              <VehicleSection key={vehicleType.id} vehicleType={vehicleType} />
            ))}
            
            {/* High Performance Vehicles Not Eligible - positioned after What's not covered */}
            <div className="mt-8">
              <AccordionItem value="high-performance-vehicles" className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                <AccordionTrigger className="px-6 py-4 text-left bg-sky-100 hover:bg-sky-200 transition-all duration-300 hover:no-underline border border-sky-300 rounded-lg">
                  <div className="flex items-center">
                    <X className="w-5 h-5 text-sky-700 mr-3 flex-shrink-0" />
                    <span className="font-medium text-base text-sky-700">Exclusions: High-End & Performance Cars</span>
                  </div>
                </AccordionTrigger>
              <AccordionContent className="px-6 py-4 bg-white">
                <div className="max-h-[400px] overflow-y-auto space-y-6 text-sm">
                  {/* Disclaimer */}
                  <div className="bg-orange-50 p-3 rounded-md">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      We're not able to offer warranty cover for high-performance, high-end or luxury vehicles, including those with similar specifications or servicing requirements to the models listed below, as well as newer versions of the same makes and models.
                    </p>
                  </div>

                  {/* BMW Models by Series */}
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-gray-900">BMW Models</h4>
                    
                    {/* 1 Series */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">1 Series</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW M135i xDrive</li>
                      </ul>
                    </div>

                    {/* 2 Series */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">2 Series</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW M240i Coupé</li>
                        <li>• BMW M235i xDrive Gran Coupé</li>
                        <li>• BMW M2 Coupé</li>
                        <li>• BMW M2 CS</li>
                      </ul>
                    </div>

                    {/* 3 Series */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">3 Series</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW M340i xDrive Sedan</li>
                        <li>• BMW M340d xDrive Sedan</li>
                        <li>• BMW M340i xDrive Touring</li>
                        <li>• BMW M340d xDrive Touring</li>
                        <li>• BMW M3 Sedan</li>
                        <li>• BMW M3 Competition Sedan</li>
                        <li>• BMW M3 CS</li>
                        <li>• BMW M3 Competition Touring</li>
                      </ul>
                    </div>

                    {/* 4 Series */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">4 Series</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW M440i xDrive Coupé</li>
                        <li>• BMW M440d xDrive Coupé</li>
                        <li>• BMW M440i xDrive Convertible</li>
                        <li>• BMW M440d xDrive Convertible</li>
                        <li>• BMW M440i xDrive Gran Coupé</li>
                        <li>• BMW M4 Coupé</li>
                        <li>• BMW M4 Competition Coupé</li>
                        <li>• BMW M4 CS</li>
                        <li>• BMW M4 Competition Convertible</li>
                        <li>• BMW M4 CS Edition VR46</li>
                      </ul>
                    </div>

                    {/* 5 Series */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">5 Series</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW M550i xDrive Sedan</li>
                        <li>• BMW M5 Sedan</li>
                        <li>• BMW M5 Competition</li>
                        <li>• BMW M5 CS</li>
                        <li>• BMW M5 Touring</li>
                      </ul>
                    </div>

                    {/* 7 Series */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">7 Series</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW M760e xDrive (Plug-in Hybrid)</li>
                        <li>• BMW M760Li xDrive (Petrol)</li>
                      </ul>
                    </div>

                    {/* 8 Series */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">8 Series</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW M850i xDrive Coupé</li>
                        <li>• BMW M850i xDrive Convertible</li>
                        <li>• BMW M850i xDrive Gran Coupé</li>
                        <li>• BMW M8 Coupé</li>
                        <li>• BMW M8 Competition Coupé</li>
                        <li>• BMW M8 Convertible</li>
                        <li>• BMW M8 Competition Convertible</li>
                        <li>• BMW M8 Gran Coupé</li>
                        <li>• BMW M8 Competition Gran Coupé</li>
                        <li>• BMW M850i Edition M Heritage</li>
                      </ul>
                    </div>

                    {/* i Series (Electric) */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">i Series (Electric)</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW i4 M60 xDrive</li>
                        <li>• BMW i5 M60 Sedan</li>
                        <li>• BMW i5 M60 Touring</li>
                        <li>• BMW i7 M70</li>
                        <li>• BMW iX M70</li>
                      </ul>
                    </div>

                    {/* X Series (SUVs) */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">X Series (SUVs)</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW X1 M35i</li>
                        <li>• BMW X2 M35i</li>
                        <li>• BMW X3 M40i / M40d</li>
                        <li>• BMW X3 M / X3 M Competition</li>
                        <li>• BMW X4 M40i / M40d</li>
                        <li>• BMW X4 M / X4 M Competition</li>
                        <li>• BMW X5 M60i</li>
                        <li>• BMW X5 M / X5 M Competition</li>
                        <li>• BMW X6 M60i</li>
                        <li>• BMW X6 M / X6 M Competition</li>
                        <li>• BMW X7 M60i</li>
                      </ul>
                    </div>

                    {/* XM Series */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">XM Series</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW XM</li>
                        <li>• BMW XM Label</li>
                        <li>• BMW XM 50e</li>
                        <li>• BMW XM by Kith</li>
                      </ul>
                    </div>

                    {/* Z Series (Roadster) */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Z Series (Roadster)</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• BMW Z4 M40i</li>
                      </ul>
                    </div>
                  </div>

                  {/* Audi Models */}
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-gray-900">Audi Models</h4>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <h5 className="text-xs font-semibold text-gray-800 mb-1.5">RS Performance Models</h5>
                        <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                          <li>• Audi RS 3 Sportback</li>
                          <li>• Audi RS 3 Sedan</li>
                          <li>• Audi RS 4 Avant</li>
                          <li>• Audi RS 5 Coupé</li>
                          <li>• Audi RS 5 Sportback</li>
                          <li>• Audi RS 6 Avant</li>
                          <li>• Audi RS 6 Avant Performance</li>
                          <li>• Audi RS 7 Sportback</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-gray-800 mb-1.5">RS SUVs & Sports Cars</h5>
                        <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                          <li>• Audi RS Q3</li>
                          <li>• Audi RS Q3 Sportback</li>
                          <li>• Audi RS Q5</li>
                          <li>• Audi RS Q8</li>
                          <li>• Audi RS e-tron GT</li>
                          <li>• Audi TT RS Coupé</li>
                          <li>• Audi TT RS Roadster</li>
                          <li>• Audi R8 Coupé</li>
                          <li>• Audi R8 Spyder</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Mercedes-AMG Models */}
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-gray-900">Mercedes-AMG Models</h4>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Compact & Mid-Size AMG</h5>
                        <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                          <li>• Mercedes-AMG A 35</li>
                          <li>• Mercedes-AMG A 45 S</li>
                          <li>• Mercedes-AMG CLA 35</li>
                          <li>• Mercedes-AMG CLA 45 S</li>
                          <li>• Mercedes-AMG C 43</li>
                          <li>• Mercedes-AMG C 63 S</li>
                          <li>• Mercedes-AMG C 43 Estate</li>
                          <li>• Mercedes-AMG C 63 S Estate</li>
                          <li>• Mercedes-AMG C 43 Coupé</li>
                          <li>• Mercedes-AMG C 63 S Coupé</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Executive AMG</h5>
                        <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                          <li>• Mercedes-AMG E 53</li>
                          <li>• Mercedes-AMG E 63 S</li>
                          <li>• Mercedes-AMG E 53 Estate</li>
                          <li>• Mercedes-AMG E 63 S Estate</li>
                          <li>• Mercedes-AMG E 53 Coupé</li>
                          <li>• Mercedes-AMG S 63</li>
                          <li>• Mercedes-AMG CLE 53</li>
                          <li>• Mercedes-AMG CLE 63</li>
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <h5 className="text-xs font-semibold text-gray-800 mb-1.5">GT & Sports Cars</h5>
                        <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                          <li>• Mercedes-AMG GT 43 4-Door</li>
                          <li>• Mercedes-AMG GT 53 4-Door</li>
                          <li>• Mercedes-AMG GT 63 4-Door</li>
                          <li>• Mercedes-AMG GT Coupé</li>
                          <li>• Mercedes-AMG SL 43</li>
                          <li>• Mercedes-AMG SL 55</li>
                          <li>• Mercedes-AMG SL 63</li>
                          <li>• Mercedes-AMG One</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-gray-800 mb-1.5">AMG SUVs</h5>
                        <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                          <li>• Mercedes-AMG GLA 35</li>
                          <li>• Mercedes-AMG GLA 45</li>
                          <li>• Mercedes-AMG GLB 35</li>
                          <li>• Mercedes-AMG GLC 43</li>
                          <li>• Mercedes-AMG GLC 63</li>
                          <li>• Mercedes-AMG GLC 43 Coupé</li>
                          <li>• Mercedes-AMG GLC 63 Coupé</li>
                          <li>• Mercedes-AMG GLE 53</li>
                          <li>• Mercedes-AMG GLE 63</li>
                          <li>• Mercedes-AMG GLE 53 Coupé</li>
                          <li>• Mercedes-AMG GLE 63 Coupé</li>
                          <li>• Mercedes-AMG GLS 63</li>
                          <li>• Mercedes-AMG G 63</li>
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Electric AMG</h5>
                      <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                        <li>• Mercedes-AMG EQE</li>
                        <li>• Mercedes-AMG EQE SUV</li>
                        <li>• Mercedes-AMG EQS SUV</li>
                      </ul>
                    </div>
                  </div>

                  {/* Ford Performance Models */}
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-gray-900">Ford Performance Models</h4>
                    
                    <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                      <li>• Ford Fiesta ST</li>
                      <li>• Ford Focus ST</li>
                      <li>• Ford Focus RS</li>
                      <li>• Ford Puma ST</li>
                      <li>• Ford Mustang GT</li>
                      <li>• Ford Mustang Mach 1</li>
                      <li>• Ford Mustang Mach-E GT</li>
                      <li>• Ford GT</li>
                      <li>• Ford Ranger Raptor</li>
                    </ul>
                  </div>

                  {/* Vauxhall Performance Models */}
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-gray-900">Vauxhall Performance Models</h4>
                    
                    <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                      <li>• Vauxhall Corsa VXR</li>
                      <li>• Vauxhall Astra VXR</li>
                      <li>• Vauxhall Astra GTC VXR</li>
                      <li>• Vauxhall Insignia VXR</li>
                      <li>• Vauxhall Vectra VXR</li>
                      <li>• Vauxhall Zafira VXR</li>
                      <li>• Vauxhall Meriva VXR</li>
                      <li>• Vauxhall VX220 VXR</li>
                      <li>• Vauxhall Monaro VXR</li>
                      <li>• Vauxhall VXR8</li>
                      <li>• Vauxhall GSi</li>
                    </ul>
                  </div>

                  {/* MINI Performance Models */}
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-gray-900">MINI John Cooper Works (JCW) Models</h4>
                    
                    <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                      <li>• MINI JCW 3-Door Hatch</li>
                      <li>• MINI JCW Convertible</li>
                      <li>• MINI JCW Clubman</li>
                      <li>• MINI JCW Countryman</li>
                      <li>• MINI JCW Electric</li>
                    </ul>
                  </div>

                  {/* Land Rover Performance Models */}
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-gray-900">Land Rover Performance Models</h4>
                    
                    <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
                      <li>• Range Rover Sport SVR</li>
                      <li>• Range Rover Sport SV</li>
                      <li>• Range Rover SVAutobiography Dynamic</li>
                      <li>• Defender V8</li>
                      <li>• Defender V8 Carpathian Edition</li>
                      <li>• Range Rover Velar SVAutobiography Dynamic Edition</li>
                      <li>• Range Rover SV Black</li>
                      <li>• Range Rover SV Carbon</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            </div>
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center">
          <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
            <Shield className="w-8 h-8" />
            Ready to protect your vehicle?
          </h2>
          <Link to="/">
            <Button size="lg" className="bg-white text-primary hover:bg-gray-100 font-bold px-10 py-5 text-lg animate-breathing flex items-center gap-2 mx-auto">
              Get my quote
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Transparent Coverage Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-green-200">
                <Shield className="w-4 h-4" />
                Transparent Coverage
              </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              What's covered in <span className="text-brand-orange">your warranty</span>
            </h2>
              <p className="text-base md:text-lg text-gray-600">
                See what's included - clear terms, no jargon, no surprises.
              </p>
            </div>

            {/* Accordion Document Links */}
            <Accordion type="multiple" className="space-y-3 mb-6">
              <AccordionItem value="platinum-plan" className="border-0">
                <AccordionTrigger className="bg-orange-50 hover:bg-orange-100 px-5 py-4 rounded-lg border border-orange-100 hover:no-underline transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-orange-200">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <span className="font-semibold text-sm text-gray-900">Your Platinum Plan</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-3 px-2">
                  {platinumDocUrl ? (
                    <a 
                      href={platinumDocUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-brand-orange hover:underline font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      View Platinum Plan Details (PDF)
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="terms-conditions" className="border-0">
                <AccordionTrigger className="bg-green-50 hover:bg-green-100 px-5 py-4 rounded-lg border border-green-100 hover:no-underline transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <span className="font-semibold text-sm text-gray-900">Terms & Conditions</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-3 px-2">
                  {termsDocUrl ? (
                    <a 
                      href={termsDocUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-green-600 hover:underline font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      View Terms & Conditions (PDF)
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* CTA Button - Outside the box */}
          <div className="flex justify-center mt-8">
            <Link to="/">
              <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8 py-4 text-lg rounded-lg flex items-center gap-2 animate-breathing">
                Protect Your Vehicle Now
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>


      {/* Vehicle Coverage Image Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center">
            <img 
              src="/images/miles-panda-mechanic.png" 
              alt="Miles the Panda mechanic - Your friendly car warranty expert"
              className="h-auto"
              style={{ width: '530px', maxWidth: '100%' }}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>
      
      <ScrollToTopButton />
    </div>
  );
};

export default Protected;