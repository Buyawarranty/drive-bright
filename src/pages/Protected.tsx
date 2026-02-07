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
import HighPerformanceExclusionsList from '@/components/HighPerformanceExclusionsList';

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
                <HighPerformanceExclusionsList />
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