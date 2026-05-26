import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Car, Battery, Zap, Bike, ChevronDown, CheckCircle, ShieldCheck, X, Settings, AlertTriangle, Ban, HelpCircle } from 'lucide-react';
import HighPerformanceExclusionsList from '@/components/HighPerformanceExclusionsList';

const Item = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2">
    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
    <span>{children}</span>
  </li>
);

const CloseRow = () => (
  <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-end">
    <CollapsibleTrigger asChild>
      <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
        <span className="text-sm font-medium">Close</span>
        <ChevronDown className="w-5 h-5 rotate-180" />
      </button>
    </CollapsibleTrigger>
  </div>
);

const PartsListContent: React.FC = () => {
  return (
    <div className="space-y-4 pt-4">
      {/* Petrol & Diesel */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-black text-white hover:bg-gray-800 font-semibold py-3 px-5 rounded-lg transition-colors group">
          <div className="flex items-center gap-3">
            <Car className="w-5 h-5" />
            <span className="text-base">Petrol & Diesel Vehicles</span>
          </div>
          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 p-5 bg-white rounded-lg border border-gray-200 shadow-sm text-[13px] text-[#3e3e3e]">
            <div className="grid md:grid-cols-2 gap-5">
              <ul className="space-y-1.5">
                <Item>Engine & Internal Components (pistons, valves, camshafts, timing chains, seals, gaskets)</Item>
                <Item>Gearbox / Transmission Systems (manual, automatic, DSG, CVT, dual-clutch, transfer boxes)</Item>
                <Item>Drivetrain & Clutch Assemblies (flywheel, driveshafts, differentials)</Item>
                <Item>Turbocharger & Supercharger Units</Item>
                <Item>Fuel Delivery Systems (tanks, pumps, injectors, fuel rails, fuel control electronics)</Item>
                <Item>Cooling & Heating Systems (radiators, thermostats, water pumps, cooling fans, heater matrix)</Item>
                <Item>Exhaust & Emissions Systems (catalytic converters, DPFs, OPFs, EGR valves, NOx sensors, AdBlue/Eolys systems)</Item>
                <Item>Braking Systems (ABS, calipers, cylinders, master cylinders)</Item>
                <Item>Suspension & Steering Systems (shocks, struts, steering racks, power/electric steering pumps, electronic suspension)</Item>
              </ul>
              <ul className="space-y-1.5">
                <Item>Air Conditioning & Climate Control Systems</Item>
                <Item>Electrical Components & Charging Systems (alternators, starter motors, wiring looms, connectors, relays)</Item>
                <Item>Electronic Control Units (ECUs) & Sensors (engine management, ABS, traction control, emissions sensors)</Item>
                <Item>Lighting & Ignition Systems (headlights, indicators, ignition coils, switches, control modules)</Item>
                <Item>Factory-Fitted Multimedia & Infotainment Systems (screens, sat nav, audio, digital displays)</Item>
                <Item>Driver Assistance Systems (adaptive cruise control, lane assist, steering assist, parking sensors, reversing cameras)</Item>
                <Item>Safety Systems (airbags, seatbelts, pretensioners, safety restraint modules)</Item>
                <Item>Convertible power-hood, motors, hydraulic parts, buttons, switches, wiring, sensors and related parts</Item>
              </ul>
            </div>
            <CloseRow />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Hybrid & PHEV */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-gray-600 text-white hover:bg-gray-700 font-semibold py-3 px-5 rounded-lg transition-colors group">
          <div className="flex items-center gap-3">
            <Battery className="w-5 h-5" />
            <span className="text-base">Hybrid & PHEV Vehicles</span>
          </div>
          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 p-5 bg-white rounded-lg border border-gray-200 shadow-sm text-[13px] text-[#3e3e3e]">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-black flex-shrink-0" />
              <p className="text-black font-medium text-sm">Includes ALL related petrol/diesel engine parts and labour PLUS:</p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <ul className="space-y-1.5">
                <Item>Hybrid Drive Motors & ECUs</Item>
                <Item>Hybrid Battery Failure</Item>
                <Item>Power Control Units, Inverters & DC-DC Converters</Item>
                <Item>Regenerative Braking Systems</Item>
              </ul>
              <ul className="space-y-1.5">
                <Item>High-Voltage Cables & Connectors</Item>
                <Item>Cooling Systems for Hybrid Components</Item>
                <Item>Charging Ports & On-Board Charging Modules</Item>
                <Item>Hybrid Transmission Components</Item>
              </ul>
            </div>
            <CloseRow />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* EVs */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-orange-500 text-white hover:bg-orange-600 font-semibold py-3 px-5 rounded-lg transition-colors group">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5" />
            <span className="text-base">Electric vehicles (EVs)</span>
          </div>
          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 p-5 bg-white rounded-lg border border-gray-200 shadow-sm text-[13px] text-[#3e3e3e]">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-black flex-shrink-0" />
              <p className="text-black font-medium text-sm">Includes ALL related petrol/diesel engine parts and labour PLUS:</p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <ul className="space-y-1.5">
                <Item>EV Drive Motors & Reduction Gear</Item>
                <Item>EV Transmission & Reduction Gearbox Assemblies</Item>
                <Item>High-Voltage Battery Failure</Item>
                <Item>Power Control Units & Inverters</Item>
                <Item>On-Board Charger (OBC) & Charging Ports</Item>
              </ul>
              <ul className="space-y-1.5">
                <Item>DC-DC Converters</Item>
                <Item>Thermal Management Systems</Item>
                <Item>High-Voltage Cables & Connectors</Item>
                <Item>EV-Specific Control Electronics</Item>
                <Item>Regenerative Braking System Components</Item>
              </ul>
            </div>
            <CloseRow />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Motorcycles */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-green-500 text-white hover:bg-green-600 font-semibold py-3 px-5 rounded-lg transition-colors group">
          <div className="flex items-center gap-3">
            <Bike className="w-5 h-5" />
            <span className="text-base">Motorcycles (Petrol, Hybrid, EV)</span>
          </div>
          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 p-5 bg-white rounded-lg border border-gray-200 shadow-sm text-[13px] text-[#3e3e3e]">
            <div className="grid md:grid-cols-2 gap-5">
              <ul className="space-y-1.5">
                <Item>Engine / Motor & Drivetrain Components</Item>
                <Item>Gearbox / Transmission Systems</Item>
                <Item>ECUs, Sensors & Control Modules</Item>
                <Item>Electrical Systems & Wiring</Item>
                <Item>High-Voltage Battery Failure (Hybrid & EV)</Item>
              </ul>
              <ul className="space-y-1.5">
                <Item>Suspension & Steering Systems</Item>
                <Item>Braking Systems</Item>
                <Item>Cooling & Thermal Systems</Item>
                <Item>Lighting & Ignition Systems</Item>
                <Item>Instrumentation & Rider Controls</Item>
              </ul>
            </div>
            <CloseRow />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* What's not covered */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-red-100 text-red-700 hover:bg-red-200 font-semibold py-3 px-5 rounded-lg transition-colors group">
          <div className="flex items-center gap-3">
            <X className="w-5 h-5" />
            <span className="text-base">What's not covered</span>
          </div>
          <ChevronDown className="w-5 h-5 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 p-5 bg-red-50 rounded-lg border border-red-200 text-sm">
            <p className="text-gray-700 font-medium mb-3">We keep things straightforward and transparent.</p>
            <h4 className="font-semibold text-red-700 mb-2">What's Not Included:</h4>
            <ul className="space-y-2">
              {['Pre-existing faults','Routine servicing and maintenance','Tyres, brake pads, and wear & tear items','Accidental damage or accident repairs','Motor trader-owned or operated vehicles','Hire and reward use (taxis, rentals, couriers)'].map(t => (
                <li key={t} className="flex items-start gap-2">
                  <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{t}</span>
                </li>
              ))}
            </ul>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-center gap-2 mt-4 pt-3 border-t border-red-300 text-red-600 hover:text-red-700 font-medium transition-colors cursor-pointer">
                <span>Close</span>
                <ChevronDown className="w-5 h-5 rotate-180" />
              </button>
            </CollapsibleTrigger>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default PartsListContent;
