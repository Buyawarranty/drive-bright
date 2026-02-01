import React from 'react';
import { Car, Battery, Zap, Bike, X, ChevronDown, CheckCircle, ShieldCheck, Shield } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface VehicleCoverageSectionProps {
  headingPrefix?: string;
}

const VehicleCoverageSection: React.FC<VehicleCoverageSectionProps> = ({ headingPrefix = '' }) => {
  return (
    <section className="pt-2 md:pt-4 pb-6 md:pb-8 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 mb-4">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-700">Full Coverage Details</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-brand-dark-text mb-3">
            Every {headingPrefix && `${headingPrefix} `}Part Covered.<br />
            <span className="text-brand-orange">Drive Worry-Free</span>
          </h2>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
            From engine to electrics, see exactly what's protected
          </p>
        </div>

        <div className="space-y-3">
          {/* Petrol & Diesel Vehicles */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-gray-800 text-white hover:bg-gray-700 font-semibold py-4 px-6 rounded-lg transition-colors group">
              <div className="flex items-center gap-3">
                <Car className="w-6 h-6" />
                <span className="text-lg">Petrol & Diesel Vehicles</span>
              </div>
              <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                <ul className="grid md:grid-cols-2 gap-3 text-sm">
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
                <CollapsibleTrigger asChild>
                  <button className="w-full mt-4 pt-3 border-t border-gray-200 flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                    <span className="text-sm font-medium">Close</span>
                    <ChevronDown className="w-5 h-5 rotate-180" />
                  </button>
                </CollapsibleTrigger>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Hybrid & PHEV Vehicles */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-gray-700 text-white hover:bg-gray-600 font-semibold py-4 px-6 rounded-lg transition-colors group">
              <div className="flex items-center gap-3">
                <Battery className="w-6 h-6" />
                <span className="text-lg">Hybrid & PHEV Vehicles</span>
              </div>
              <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-black flex-shrink-0" />
                  <p className="text-black font-medium">
                    Includes ALL petrol/diesel engine parts and labour PLUS:
                  </p>
                </div>
                <ul className="grid md:grid-cols-2 gap-3 text-sm">
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
                <CollapsibleTrigger asChild>
                  <button className="w-full mt-4 pt-3 border-t border-gray-200 flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                    <span className="text-sm font-medium">Close</span>
                    <ChevronDown className="w-5 h-5 rotate-180" />
                  </button>
                </CollapsibleTrigger>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Electric vehicles (EVs) */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-orange-500 text-white hover:bg-orange-600 font-semibold py-4 px-6 rounded-lg transition-colors group">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6" />
                <span className="text-lg">Electric vehicles (EVs)</span>
              </div>
              <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-black flex-shrink-0" />
                  <p className="text-black font-medium">
                    Includes ALL petrol/diesel engine parts and labour PLUS:
                  </p>
                </div>
                <ul className="grid md:grid-cols-2 gap-3 text-sm">
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
                <CollapsibleTrigger asChild>
                  <button className="w-full mt-4 pt-3 border-t border-gray-200 flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                    <span className="text-sm font-medium">Close</span>
                    <ChevronDown className="w-5 h-5 rotate-180" />
                  </button>
                </CollapsibleTrigger>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Motorcycles */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-green-500 text-white hover:bg-green-600 font-semibold py-4 px-6 rounded-lg transition-colors group">
              <div className="flex items-center gap-3">
                <Bike className="w-6 h-6" />
                <span className="text-lg">Motorcycles (Petrol, Hybrid, EV)</span>
              </div>
              <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                <ul className="grid md:grid-cols-2 gap-3 text-sm">
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
                <CollapsibleTrigger asChild>
                  <button className="w-full mt-4 pt-3 border-t border-gray-200 flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                    <span className="text-sm font-medium">Close</span>
                    <ChevronDown className="w-5 h-5 rotate-180" />
                  </button>
                </CollapsibleTrigger>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* What's not covered */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-red-500 text-white hover:bg-red-600 font-semibold py-4 px-6 rounded-lg transition-colors group">
              <div className="flex items-center gap-3">
                <X className="w-6 h-6" />
                <span className="text-lg">What's not covered</span>
              </div>
              <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 p-6 bg-red-50 rounded-lg border border-red-200">
                <p className="text-gray-700 font-medium mb-4">
                  We keep things straightforward and transparent.
                </p>
                <ul className="grid md:grid-cols-2 gap-3 text-sm">
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Pre-existing faults</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Gradual wear without mechanical failure</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Accident, fire, flood, or theft damage</span>
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
                <CollapsibleTrigger asChild>
                  <button className="w-full mt-4 pt-3 border-t border-red-200 flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                    <span className="text-sm font-medium">Close</span>
                    <ChevronDown className="w-5 h-5 rotate-180" />
                  </button>
                </CollapsibleTrigger>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </section>
  );
};

export default VehicleCoverageSection;
