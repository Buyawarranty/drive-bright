import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Search,
  Check,
  X,
  Info,
  Cog,
  Settings2,
  Wind,
  Zap,
  Cpu,
  Thermometer,
  Snowflake,
  Move,
  Waves,
  Disc,
  Fuel,
  BatteryCharging,
  Stethoscope,
  ShieldCheck,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PartsListModal from './PartsListModal';

type Category = {
  id: string;
  name: string;
  group: 'Powertrain' | 'Electronics' | 'Comfort & Climate' | 'Chassis' | 'Fuel & Energy' | 'Diagnostics';
  Icon: React.ComponentType<{ className?: string }>;
  covered: string[];
  excluded: string[];
  claimNote: string;
  example: string;
};

const CATEGORIES: Category[] = [
  {
    id: 'engine',
    name: 'Engine',
    group: 'Powertrain',
    Icon: Cog,
    covered: [
      'Pistons, valves, camshafts, timing chains',
      'Cylinder head, block, crankshaft & bearings',
      'Oil pump, seals and internal gaskets',
    ],
    excluded: ['Routine servicing', 'Wear & tear on consumables (oil, filters)'],
    claimNote: 'Diagnostics are covered when they confirm a valid mechanical failure.',
    example: 'Timing chain failure on a 5-year-old hatchback — parts & labour paid in full up to your claim limit.',
  },
  {
    id: 'gearbox',
    name: 'Gearbox & transmission',
    group: 'Powertrain',
    Icon: Settings2,
    covered: [
      'Manual, automatic, DSG, CVT, dual-clutch',
      'Transfer boxes, differentials, driveshafts',
      'Flywheel & clutch assembly (mechanical failure)',
    ],
    excluded: ['Clutch friction wear from normal driving'],
    claimNote: 'Gearbox repairs are agreed up-front with your garage before work begins.',
    example: 'DSG mechatronic unit failure — replacement covered under Essential and above.',
  },
  {
    id: 'turbo',
    name: 'Turbo & supercharger',
    group: 'Powertrain',
    Icon: Wind,
    covered: [
      'Turbocharger & supercharger units',
      'Wastegate, actuator, intercooler pipework',
      'Variable-vane mechanisms',
    ],
    excluded: ['Damage caused by lack of oil servicing'],
    claimNote: 'A service history helps claims move faster — but is not always required.',
    example: 'Turbo bearing failure at 78,000 miles — covered up to claim limit.',
  },
  {
    id: 'electrical',
    name: 'Electrical components',
    group: 'Electronics',
    Icon: Zap,
    covered: [
      'Alternators, starter motors, wiring looms',
      'Relays, switches & ignition coils',
      'Lighting modules and indicators',
    ],
    excluded: ['Bulbs, fuses and consumables'],
    claimNote: 'Electrical faults are diagnosed by your chosen garage and signed off remotely.',
    example: 'Alternator failure leaving you stranded — parts & labour paid same day.',
  },
  {
    id: 'ecu',
    name: 'ECU & electronics',
    group: 'Electronics',
    Icon: Cpu,
    covered: [
      'Engine, ABS & traction control ECUs',
      'Emissions, NOx & oxygen sensors',
      'Driver assistance modules (lane assist, parking, cameras)',
    ],
    excluded: ['Software updates not linked to a failure'],
    claimNote: 'Replacement ECUs are coded and programmed as part of your claim.',
    example: 'Engine control unit failure on a 2019 SUV — module + coding fully covered.',
  },
  {
    id: 'cooling',
    name: 'Cooling system',
    group: 'Comfort & Climate',
    Icon: Thermometer,
    covered: [
      'Radiator, water pump, thermostat',
      'Cooling fans, heater matrix, hoses',
      'Coolant temperature sensors',
    ],
    excluded: ['Top-up fluids', 'Damage from running on empty coolant'],
    claimNote: 'Overheating-related claims are always investigated for root cause.',
    example: 'Water pump seizure at 60k miles — replacement and labour covered.',
  },
  {
    id: 'aircon',
    name: 'Air conditioning',
    group: 'Comfort & Climate',
    Icon: Snowflake,
    covered: [
      'Compressor, condenser & evaporator',
      'Climate control modules and blower motors',
      'A/C electrical sensors',
    ],
    excluded: ['Re-gas as a standalone service'],
    claimNote: 'Re-gas is covered when it is needed to complete a valid repair.',
    example: 'Compressor failure on a Range Rover — replacement covered up to claim limit.',
  },
  {
    id: 'steering',
    name: 'Steering',
    group: 'Chassis',
    Icon: Move,
    covered: [
      'Steering rack & column',
      'Power steering pumps (hydraulic & electric)',
      'Steering position sensors',
    ],
    excluded: ['Track rod ends worn through normal use'],
    claimNote: 'EPS (electric power steering) faults are fully covered including coding.',
    example: 'Electric steering rack failure — full assembly + fitting covered.',
  },
  {
    id: 'suspension',
    name: 'Suspension',
    group: 'Chassis',
    Icon: Waves,
    covered: [
      'Shocks, struts & air suspension units',
      'Electronic dampers & ride-height sensors',
      'Suspension control modules',
    ],
    excluded: ['Springs broken through corrosion'],
    claimNote: 'Air suspension compressors and bags are covered as standard.',
    example: 'Air compressor failure on a German saloon — compressor + fit covered.',
  },
  {
    id: 'brakes',
    name: 'Braking system',
    group: 'Chassis',
    Icon: Disc,
    covered: [
      'ABS modulator and pump',
      'Calipers, master cylinders, brake servos',
      'Brake control sensors',
    ],
    excluded: ['Brake pads, discs and fluid (wear items)'],
    claimNote: 'Electronic brake failures (EPB, ABS) are fully covered.',
    example: 'ABS pump failure triggering warning lights — replacement covered.',
  },
  {
    id: 'fuel',
    name: 'Fuel system',
    group: 'Fuel & Energy',
    Icon: Fuel,
    covered: [
      'Fuel pumps, injectors and fuel rails',
      'Tanks, sender units and pressure regulators',
      'AdBlue / Eolys systems and DPF/OPF',
    ],
    excluded: ['Contaminated or wrong fuel'],
    claimNote: 'High-pressure diesel injector replacement is one of our most common claims.',
    example: 'Diesel HP injector failure on a 4-year-old van — full set replaced under cover.',
  },
  {
    id: 'hybrid-ev',
    name: 'Hybrid & EV components',
    group: 'Fuel & Energy',
    Icon: BatteryCharging,
    covered: [
      'Hybrid drive motors, inverters & DC-DC converters',
      'High-voltage battery failure (hybrid & EV)',
      'On-board chargers, charging ports, regenerative braking',
    ],
    excluded: ['Home wall-box hardware'],
    claimNote: 'High-voltage battery failure is covered — degradation over time is not.',
    example: 'Inverter failure on a hybrid SUV — replacement and coding covered.',
  },
  {
    id: 'diagnostics',
    name: 'Diagnostics',
    group: 'Diagnostics',
    Icon: Stethoscope,
    covered: [
      'Fault-finding when it confirms a valid claim',
      'Manufacturer-level scan tools at approved garages',
      'Pre- and post-repair scans',
    ],
    excluded: ['Diagnostics that find no fault or only consumables'],
    claimNote: 'Up to 1 hour of diagnostics is paid as part of every approved claim.',
    example: 'EML investigation that confirms a faulty NOx sensor — diagnostics + part covered.',
  },
];

const GROUPS: Category['group'][] = [
  'Powertrain',
  'Electronics',
  'Comfort & Climate',
  'Chassis',
  'Fuel & Energy',
  'Diagnostics',
];

interface WhatsCoveredAccordionProps {
  /** desktop = embedded inside a card on Step 3 desktop; mobile = full-bleed section */
  variant?: 'desktop' | 'mobile';
}

const WhatsCoveredAccordion: React.FC<WhatsCoveredAccordionProps> = ({ variant = 'desktop' }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.filter(c => {
      const haystack = [
        c.name,
        c.group,
        c.claimNote,
        c.example,
        ...c.covered,
        ...c.excluded,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<Category['group'], Category[]>();
    GROUPS.forEach(g => map.set(g, []));
    filtered.forEach(c => map.get(c.group)!.push(c));
    return map;
  }, [filtered]);

  const isMobile = variant === 'mobile';

  return (
    <div className={cn(isMobile ? '' : 'p-6')}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          {!isMobile && (
            <div className="text-[#f36b21] text-[12px] font-extrabold uppercase tracking-[0.08em] mb-2">
              Transparency
            </div>
          )}
          <h2
            className={cn(
              'm-0 mb-1.5 font-bold text-[#161616] tracking-[-0.02em]',
              isMobile ? 'text-[20px] leading-tight' : 'text-[24px] leading-tight'
            )}
          >
            What's covered in your warranty?
          </h2>
          <p className="m-0 text-[#6c6c6c] text-[14px] sm:text-[15px]">
            Tap any category to see exactly what's included, what isn't, and how claims work.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf8f2] text-[#0e6b48] px-3 py-1.5 text-[12px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            13 categories
          </div>
          <PartsListModal
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#161616] hover:bg-[#000] text-white px-3 py-1.5 text-[12px] font-semibold transition"
              >
                <ListChecks className="w-3.5 h-3.5" />
                View full parts list
              </button>
            }
          />
        </div>

      </div>

      {/* Search */}
      <label className="relative block mb-5">
        <Search className="w-4 h-4 text-[#919191] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search parts — e.g. turbo, ABS, injector"
          className="w-full rounded-xl border border-[#e6e6e4] bg-white pl-10 pr-3 py-3 text-[14px] text-[#161616] placeholder:text-[#9a9a9a] focus:outline-none focus:border-[#f36b21] focus:ring-4 focus:ring-[#f36b21]/10 transition"
        />
      </label>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-10 px-4 rounded-xl border border-dashed border-[#e6e6e4] text-sm text-[#6c6c6c]">
          No matches. Try “engine”, “turbo”, “ABS”, “injector”, or “battery”.
        </div>
      )}

      {/* Grouped accordions */}
      <div className="space-y-6">
        {GROUPS.map(group => {
          const items = grouped.get(group) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#919191]">
                  {group}
                </span>
                <span className="h-px flex-1 bg-[#eee]" />
                <span className="text-[11px] text-[#919191] font-semibold">
                  {items.length} {items.length === 1 ? 'category' : 'categories'}
                </span>
              </div>
              <Accordion type="multiple" className="space-y-2">
                {items.map(c => {
                  const { Icon } = c;
                  return (
                    <AccordionItem
                      key={c.id}
                      value={c.id}
                      className="border border-[#e9e9e7] rounded-xl bg-white overflow-hidden data-[state=open]:border-[#f3b58a] data-[state=open]:shadow-[0_8px_24px_rgba(243,107,33,0.06)]"
                    >
                      <AccordionTrigger className="px-4 py-3.5 hover:no-underline group">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="w-9 h-9 rounded-lg bg-[#fff3ec] text-[#f36b21] flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 text-left">
                            <div className="text-[15px] font-bold text-[#161616] leading-tight truncate">
                              {c.name}
                            </div>
                            <div className="text-[12px] text-[#6c6c6c] mt-0.5 truncate">
                              {c.covered.length} covered parts · {c.excluded.length} exclusions
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-0">
                        <div className="grid sm:grid-cols-2 gap-4 pt-2">
                          {/* Covered */}
                          <div className="rounded-lg bg-[#f4faf6] border border-[#dcefdf] p-3.5">
                            <div className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#0e6b48] mb-2">
                              <Check className="w-3.5 h-3.5" strokeWidth={3} />
                              Covered
                            </div>
                            <ul className="space-y-1.5">
                              {c.covered.map(t => (
                                <li
                                  key={t}
                                  className="flex items-start gap-2 text-[13px] text-[#2e2e2e] leading-snug"
                                >
                                  <Check
                                    className="w-3.5 h-3.5 text-[#1ca36f] mt-0.5 flex-shrink-0"
                                    strokeWidth={3}
                                  />
                                  <span>{t}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          {/* Not covered */}
                          <div className="rounded-lg bg-[#fbf6f6] border border-[#efdcdc] p-3.5">
                            <div className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#9b2c2c] mb-2">
                              <X className="w-3.5 h-3.5" strokeWidth={3} />
                              Not covered
                            </div>
                            <ul className="space-y-1.5">
                              {c.excluded.map(t => (
                                <li
                                  key={t}
                                  className="flex items-start gap-2 text-[13px] text-[#3e3e3e] leading-snug"
                                >
                                  <X
                                    className="w-3.5 h-3.5 text-[#c54141] mt-0.5 flex-shrink-0"
                                    strokeWidth={3}
                                  />
                                  <span>{t}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Claim note + example */}
                        <div className="mt-3 grid gap-2">
                          <div className="flex items-start gap-2 text-[13px] text-[#3e3e3e] bg-[#fffaf3] border border-[#f5e4b0] rounded-lg p-3 leading-snug">
                            <Info className="w-4 h-4 text-[#b87807] mt-0.5 flex-shrink-0" />
                            <span>
                              <strong className="text-[#7a4f00]">Claim note:</strong> {c.claimNote}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-[13px] text-[#3e3e3e] bg-[#f5f5f4] rounded-lg p-3 leading-snug">
                            <span className="text-[14px] flex-shrink-0">💡</span>
                            <span>
                              <strong className="text-[#161616]">Real example:</strong> {c.example}
                            </span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          );
        })}
      </div>

      {/* Footer reassurance */}
      <p className="mt-5 text-[12px] text-[#6c6c6c] leading-relaxed">
        Cover applies to sudden mechanical & electrical failure. Pre-existing faults, accident
        damage and wear-and-tear items are not included. See your full policy for the complete
        list of exclusions.
      </p>
    </div>
  );
};

export default WhatsCoveredAccordion;
