import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Check,
  X,
  ChevronDown,
  Cog,
  Settings,
  Wind,
  Cpu,
  Navigation,
  Thermometer,
  Disc,
  Fuel,
  Snowflake,
  CircleSlash,
  Flame,
  Monitor,
  CarFront,
  Zap,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'desktop' | 'mobile';

const PLATINUM_PDF =
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.3-2026-05.pdf';
const TERMS_PDF =
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.3-2026-05.pdf';

interface CoveredPart {
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const COVERED_PARTS: CoveredPart[] = [
  { title: 'Engine', desc: 'Pistons, crankshaft, camshaft, oil pump and cylinder head.', Icon: Cog },
  { title: 'Gearbox', desc: 'Manual or automatic. Internal components, torque convertor and selector forks.', Icon: Settings },
  { title: 'Turbo & Supercharger', desc: 'Turbocharger assembly, wastegate, intercooler and supercharger components.', Icon: Wind },
  { title: 'Electrical & ECUs', desc: 'Engine control units, body control modules and electrical management systems.', Icon: Cpu },
  { title: 'Steering', desc: 'Power steering pump, rack and pinion, column and electric steering motor.', Icon: Navigation },
  { title: 'Cooling System', desc: 'Water pump, radiator, thermostat, cooling fan and coolant hoses.', Icon: Thermometer },
  { title: 'Clutch System', desc: 'Clutch plate, pressure plate, release bearing and flywheel.', Icon: Disc },
  { title: 'Fuel System', desc: 'Fuel pump, injectors, fuel pressure regulator and fuel rail.', Icon: Fuel },
  { title: 'Air Conditioning', desc: 'Compressor, condenser, evaporator, expansion valve and receiver drier.', Icon: Snowflake },
  { title: 'Braking System', desc: 'ABS module, brake servo, master cylinder and brake callipers.', Icon: CircleSlash },
  { title: 'Heating & Ventilation', desc: 'Heater matrix, blower motor and temperature control module.', Icon: Flame },
  { title: 'Infotainment & Cameras', desc: 'Touchscreen, navigation unit, parking sensors and reversing cameras.', Icon: Monitor },
  { title: 'Suspension', desc: 'Shock absorbers, struts, control arms, ball joints and bushes.', Icon: CarFront },
  { title: 'Drive System', desc: 'Driveshafts, CV joints, differential, prop shaft and transfer box.', Icon: Cog },
  { title: 'Safety Systems', desc: 'Airbag control module, seatbelt pre-tensioners and stability control.', Icon: ShieldCheck },
  { title: 'Everything Else', desc: "If it's essential to the smooth running of your vehicle, it's normally covered.", Icon: Sparkles },
];

const COVERED_LIST = [
  'Mechanical failure from normal use',
  'Electrical & ECU faults',
  'Parts AND labour costs',
  'Diagnostic fees',
  'VAT on covered repairs',
  'Approved garage of your choice',
  'Hybrid & EV battery management',
  'Turbo and supercharger failure',
];

const NOT_COVERED_LIST = [
  'Wear and tear (tyres, brake pads, etc.)',
  'Accidental or cosmetic damage',
  'Pre-existing faults at purchase',
  'Negligence or lack of servicing',
  'Modifications that affect covered parts',
  'High-performance / track cars',
  'Vehicles used for hire or reward',
  'Flood, fire, theft or weather damage',
];

interface Props {
  variant?: Variant;
  className?: string;
}

const PolicyTermsAccordion: React.FC<Props> = ({ variant = 'desktop', className }) => {
  const [showAll, setShowAll] = useState(false);
  const isMobile = variant === 'mobile';
  const visibleParts = showAll ? COVERED_PARTS : COVERED_PARTS.slice(0, 8);

  return (
    <div className={cn(isMobile ? 'p-0' : 'p-2', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-lg md:text-xl font-bold text-foreground leading-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
            Know exactly what's covered
          </h3>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <ShieldCheck className="w-3 h-3" /> Full transparency
        </span>
      </div>

      {/* Covered parts grid */}
      <h4 className="text-sm font-semibold text-foreground mb-2">What your warranty actually covers</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {visibleParts.map((p) => {
          const Icon = p.Icon;
          return (
            <div
              key={p.title}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:border-emerald-300 transition-colors"
            >
              <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground leading-tight">{p.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{p.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      {COVERED_PARTS.length > 8 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mb-5 text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          {showAll ? 'Show fewer' : `See all covered parts (+${COVERED_PARTS.length - 8})`}
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAll && 'rotate-180')} />
        </button>
      )}

      {/* Side-by-side covered / not covered */}
      <h4 className="text-sm font-semibold text-foreground mb-2 mt-2">What we cover and what we don't</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
              <Check className="w-4 h-4" strokeWidth={3} />
            </span>
            <span className="text-sm font-bold text-emerald-800">Covered</span>
          </div>
          <ul className="space-y-1.5">
            {COVERED_LIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-foreground/90">
                <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center">
              <X className="w-4 h-4" strokeWidth={3} />
            </span>
            <span className="text-sm font-bold text-rose-800">Not covered</span>
          </div>
          <ul className="space-y-1.5">
            {NOT_COVERED_LIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-foreground/90">
                <X className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* PDF links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <a
          href={PLATINUM_PDF}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 p-3 rounded-lg border border-orange-200 bg-card hover:bg-orange-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
            <span className="text-sm font-semibold text-foreground">Platinum Warranty</span>
          </span>
          <span className="text-[11px] font-bold px-2 py-1 rounded border border-orange-400 text-orange-600">PDF</span>
        </a>
        <a
          href={TERMS_PDF}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 p-3 rounded-lg border border-emerald-200 bg-card hover:bg-emerald-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
            <span className="text-sm font-semibold text-foreground">Terms &amp; Conditions</span>
          </span>
          <span className="text-[11px] font-bold px-2 py-1 rounded border border-emerald-500 text-emerald-700">PDF</span>
        </a>
      </div>

      {/* Reassurance footer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] leading-snug text-amber-900">
          Summaries are written in plain English for clarity. The full policy wording is authoritative and sent to you on purchase — and available on request before you pay.
        </p>
      </div>
    </div>
  );
};

export default PolicyTermsAccordion;
