import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Check, X, Search, ListChecks, Sparkles, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'covered' | 'excluded';
type CategoryKey =
  | 'Engine'
  | 'Gearbox'
  | 'Turbo'
  | 'Electrical'
  | 'ECU & Electronics'
  | 'Cooling'
  | 'Air Conditioning'
  | 'Steering'
  | 'Suspension'
  | 'Braking'
  | 'Fuel System'
  | 'Hybrid & EV'
  | 'Diagnostics'
  | 'Wear & Tear';

interface Part {
  name: string;
  category: CategoryKey;
  status: Status;
  /** highlight as one of the most commonly claimed parts */
  topClaim?: boolean;
}

const PARTS: Part[] = [
  // Engine
  { name: 'Pistons & piston rings', category: 'Engine', status: 'covered' },
  { name: 'Camshafts & crankshaft', category: 'Engine', status: 'covered' },
  { name: 'Timing chain & tensioners', category: 'Engine', status: 'covered', topClaim: true },
  { name: 'Cylinder head & block', category: 'Engine', status: 'covered' },
  { name: 'Valves & valve guides', category: 'Engine', status: 'covered' },
  { name: 'Oil pump & internal seals', category: 'Engine', status: 'covered' },

  // Gearbox
  { name: 'Manual & automatic gearbox', category: 'Gearbox', status: 'covered', topClaim: true },
  { name: 'DSG / dual-clutch unit', category: 'Gearbox', status: 'covered', topClaim: true },
  { name: 'CVT transmission', category: 'Gearbox', status: 'covered' },
  { name: 'Transfer box & differential', category: 'Gearbox', status: 'covered' },
  { name: 'Driveshafts & CV joints', category: 'Gearbox', status: 'covered' },
  { name: 'Flywheel (mechanical failure)', category: 'Gearbox', status: 'covered' },

  // Turbo
  { name: 'Turbocharger unit', category: 'Turbo', status: 'covered', topClaim: true },
  { name: 'Supercharger unit', category: 'Turbo', status: 'covered' },
  { name: 'Wastegate & actuator', category: 'Turbo', status: 'covered' },
  { name: 'Variable-vane mechanism', category: 'Turbo', status: 'covered' },
  { name: 'Intercooler pipework', category: 'Turbo', status: 'covered' },

  // Electrical
  { name: 'Alternator', category: 'Electrical', status: 'covered', topClaim: true },
  { name: 'Starter motor', category: 'Electrical', status: 'covered', topClaim: true },
  { name: 'Wiring loom & connectors', category: 'Electrical', status: 'covered' },
  { name: 'Ignition coils & switches', category: 'Electrical', status: 'covered' },
  { name: 'Relays & control switches', category: 'Electrical', status: 'covered' },
  { name: 'Lighting modules', category: 'Electrical', status: 'covered' },

  // ECU & Electronics
  { name: 'Engine ECU', category: 'ECU & Electronics', status: 'covered', topClaim: true },
  { name: 'ABS / traction control ECU', category: 'ECU & Electronics', status: 'covered' },
  { name: 'NOx & oxygen sensors', category: 'ECU & Electronics', status: 'covered' },
  { name: 'Parking sensors & reverse cameras', category: 'ECU & Electronics', status: 'covered' },
  { name: 'Lane assist & adaptive cruise', category: 'ECU & Electronics', status: 'covered' },
  { name: 'Infotainment screen', category: 'ECU & Electronics', status: 'covered' },

  // Cooling
  { name: 'Radiator', category: 'Cooling', status: 'covered' },
  { name: 'Water pump', category: 'Cooling', status: 'covered', topClaim: true },
  { name: 'Thermostat & housing', category: 'Cooling', status: 'covered' },
  { name: 'Cooling fans', category: 'Cooling', status: 'covered' },
  { name: 'Heater matrix', category: 'Cooling', status: 'covered' },

  // Air conditioning
  { name: 'A/C compressor', category: 'Air Conditioning', status: 'covered', topClaim: true },
  { name: 'A/C condenser', category: 'Air Conditioning', status: 'covered' },
  { name: 'Evaporator', category: 'Air Conditioning', status: 'covered' },
  { name: 'Climate control module', category: 'Air Conditioning', status: 'covered' },
  { name: 'Blower motor', category: 'Air Conditioning', status: 'covered' },

  // Steering
  { name: 'Steering rack', category: 'Steering', status: 'covered', topClaim: true },
  { name: 'Electric power steering motor', category: 'Steering', status: 'covered' },
  { name: 'Hydraulic steering pump', category: 'Steering', status: 'covered' },
  { name: 'Steering column', category: 'Steering', status: 'covered' },
  { name: 'Steering angle sensors', category: 'Steering', status: 'covered' },

  // Suspension
  { name: 'Shock absorbers (failure)', category: 'Suspension', status: 'covered' },
  { name: 'Air suspension compressor', category: 'Suspension', status: 'covered', topClaim: true },
  { name: 'Air suspension bags', category: 'Suspension', status: 'covered' },
  { name: 'Electronic dampers', category: 'Suspension', status: 'covered' },
  { name: 'Ride-height sensors', category: 'Suspension', status: 'covered' },

  // Braking
  { name: 'ABS modulator / pump', category: 'Braking', status: 'covered', topClaim: true },
  { name: 'Brake master cylinder', category: 'Braking', status: 'covered' },
  { name: 'Brake servo & vacuum pump', category: 'Braking', status: 'covered' },
  { name: 'Calipers (mechanical failure)', category: 'Braking', status: 'covered' },
  { name: 'Electronic parking brake', category: 'Braking', status: 'covered' },

  // Fuel system
  { name: 'High-pressure diesel injectors', category: 'Fuel System', status: 'covered', topClaim: true },
  { name: 'Petrol fuel injectors', category: 'Fuel System', status: 'covered' },
  { name: 'Fuel pump (low & high pressure)', category: 'Fuel System', status: 'covered', topClaim: true },
  { name: 'Fuel rail & pressure regulator', category: 'Fuel System', status: 'covered' },
  { name: 'DPF / OPF particulate filter', category: 'Fuel System', status: 'covered' },
  { name: 'AdBlue / Eolys system', category: 'Fuel System', status: 'covered' },

  // Hybrid & EV
  { name: 'Hybrid drive motor', category: 'Hybrid & EV', status: 'covered' },
  { name: 'High-voltage battery (failure)', category: 'Hybrid & EV', status: 'covered', topClaim: true },
  { name: 'Inverter / power control unit', category: 'Hybrid & EV', status: 'covered', topClaim: true },
  { name: 'DC-DC converter', category: 'Hybrid & EV', status: 'covered' },
  { name: 'On-board charger & charge port', category: 'Hybrid & EV', status: 'covered' },
  { name: 'Regenerative braking module', category: 'Hybrid & EV', status: 'covered' },

  // Diagnostics
  { name: 'Fault-finding for valid claims', category: 'Diagnostics', status: 'covered' },
  { name: 'Manufacturer-level scan tools', category: 'Diagnostics', status: 'covered' },
  { name: 'Pre and post-repair scans', category: 'Diagnostics', status: 'covered' },

  // Wear & tear / exclusions
  { name: 'Brake pads & discs', category: 'Wear & Tear', status: 'excluded' },
  { name: 'Tyres', category: 'Wear & Tear', status: 'excluded' },
  { name: 'Clutch friction plate (worn)', category: 'Wear & Tear', status: 'excluded' },
  { name: 'Bulbs, fuses, wiper blades', category: 'Wear & Tear', status: 'excluded' },
  { name: 'Servicing fluids & filters', category: 'Wear & Tear', status: 'excluded' },
  { name: 'Pre-existing faults', category: 'Wear & Tear', status: 'excluded' },
  { name: 'Accident damage', category: 'Wear & Tear', status: 'excluded' },
  { name: 'Cosmetic items (paint, trim)', category: 'Wear & Tear', status: 'excluded' },
];

const CATEGORY_OPTIONS: ('All' | CategoryKey)[] = [
  'All',
  'Engine',
  'Gearbox',
  'Turbo',
  'Electrical',
  'ECU & Electronics',
  'Cooling',
  'Air Conditioning',
  'Steering',
  'Suspension',
  'Braking',
  'Fuel System',
  'Hybrid & EV',
  'Diagnostics',
  'Wear & Tear',
];

type StatusFilter = 'all' | 'covered' | 'excluded' | 'top';

interface PartsListModalProps {
  trigger?: React.ReactNode;
  /** Allow parent to control open state if needed */
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

const PartsListModal: React.FC<PartsListModalProps> = ({ trigger, open, onOpenChange }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | CategoryKey>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PARTS.filter(p => {
      if (category !== 'All' && p.category !== category) return false;
      if (statusFilter === 'covered' && p.status !== 'covered') return false;
      if (statusFilter === 'excluded' && p.status !== 'excluded') return false;
      if (statusFilter === 'top' && !p.topClaim) return false;
      if (q && !(`${p.name} ${p.category}`).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, category, statusFilter]);

  const coveredCount = PARTS.filter(p => p.status === 'covered').length;
  const excludedCount = PARTS.filter(p => p.status === 'excluded').length;
  const topClaimCount = PARTS.filter(p => p.topClaim).length;

  const defaultTrigger = (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-xl bg-[#161616] hover:bg-[#000] text-white text-[13px] font-semibold px-4 py-2.5 transition"
    >
      <ListChecks className="w-4 h-4" />
      View full parts list
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent
        className={cn(
          'p-0 gap-0 overflow-hidden bg-white border border-[#e9e9e7]',
          // Full-screen on mobile, large panel on desktop
          'w-screen h-[100dvh] max-w-none rounded-none sm:rounded-2xl',
          'sm:w-[min(960px,95vw)] sm:h-auto sm:max-h-[88vh]'
        )}
      >
        <DialogHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-[#eee] flex-shrink-0">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#fff3ec] text-[#f36b21] flex items-center justify-center flex-shrink-0">
              <ListChecks className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="text-[18px] sm:text-[22px] font-bold text-[#161616] tracking-[-0.02em]">
                Your full parts list
              </DialogTitle>
              <p className="text-[13px] sm:text-[14px] text-[#6c6c6c] mt-1">
                {coveredCount} parts covered · {excludedCount} exclusions · search and filter any item below.
              </p>
            </div>
          </div>

          {/* Most-claimed reassurance strip */}
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#f5e4b0] bg-[#fffaf3] px-3.5 py-3">
            <Sparkles className="w-4 h-4 text-[#b87807] mt-0.5 flex-shrink-0" />
            <div className="text-[13px] text-[#5b3e00] leading-snug">
              <strong className="text-[#7a4f00]">All {topClaimCount} of our most commonly claimed parts are covered</strong> — including
              turbos, gearboxes, ECUs and HP fuel injectors. Tap the
              <button
                type="button"
                onClick={() => setStatusFilter('top')}
                className="underline font-semibold ml-1 hover:text-[#7a4f00]"
              >
                Top claims
              </button>{' '}
              filter to see them.
            </div>
          </div>

          {/* Search + status filters */}
          <div className="mt-4 grid gap-3">
            <label className="relative block">
              <Search className="w-4 h-4 text-[#919191] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search any part — e.g. turbo, ABS, injector"
                className="w-full rounded-xl border border-[#e6e6e4] bg-white pl-10 pr-3 py-2.5 text-[14px] text-[#161616] placeholder:text-[#9a9a9a] focus:outline-none focus:border-[#f36b21] focus:ring-4 focus:ring-[#f36b21]/10 transition"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All parts', count: PARTS.length },
                { id: 'covered', label: '✓ Covered', count: coveredCount },
                { id: 'top', label: '⭐ Top claims', count: topClaimCount },
                { id: 'excluded', label: '✗ Exclusions', count: excludedCount },
              ].map(opt => {
                const active = statusFilter === (opt.id as StatusFilter);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatusFilter(opt.id as StatusFilter)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[12px] font-semibold border transition whitespace-nowrap',
                      active
                        ? 'bg-[#161616] text-white border-[#161616]'
                        : 'bg-white text-[#3e3e3e] border-[#e6e6e4] hover:border-[#161616]'
                    )}
                  >
                    {opt.label} <span className={cn('ml-1 text-[11px]', active ? 'text-white/70' : 'text-[#919191]')}>{opt.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Category pills (horizontal scroll on mobile) */}
            <div className="-mx-1 px-1 overflow-x-auto">
              <div className="flex gap-1.5 min-w-max pb-1">
                {CATEGORY_OPTIONS.map(c => {
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-[12px] font-semibold border transition whitespace-nowrap',
                        active
                          ? 'bg-[#fff3ec] text-[#f36b21] border-[#f3b58a]'
                          : 'bg-white text-[#6c6c6c] border-[#eee] hover:border-[#d7d7d7]'
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable parts table */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 px-6 text-sm text-[#6c6c6c]">
              No parts match those filters. Try clearing search or switching category.
            </div>
          ) : (
            <>
              {/* Desktop / tablet table */}
              <div className="hidden sm:block px-7 py-4">
                <div className="rounded-xl border border-[#eee] overflow-hidden">
                  <table className="w-full text-[14px]">
                    <thead className="bg-[#fafafa] text-[12px] uppercase tracking-[0.06em] text-[#919191]">
                      <tr>
                        <th className="text-left font-bold px-4 py-2.5">Part</th>
                        <th className="text-left font-bold px-4 py-2.5">Category</th>
                        <th className="text-right font-bold px-4 py-2.5 w-[140px]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, i) => (
                        <tr
                          key={p.name}
                          className={cn(
                            'border-t border-[#f0f0f0]',
                            i % 2 === 1 ? 'bg-[#fafafa]/40' : 'bg-white'
                          )}
                        >
                          <td className="px-4 py-3 text-[#161616] font-medium">
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                              {p.topClaim && (
                                <Badge className="bg-[#fff3ec] text-[#f36b21] hover:bg-[#fff3ec] border border-[#f3b58a] text-[10px] font-bold uppercase tracking-wide px-1.5 py-0">
                                  Top claim
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#6c6c6c]">{p.category}</td>
                          <td className="px-4 py-3 text-right">
                            <StatusPill status={p.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile list */}
              <ul className="sm:hidden divide-y divide-[#f0f0f0] px-2 py-1">
                {filtered.map(p => (
                  <li key={p.name} className="flex items-start justify-between gap-3 px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-[#161616] leading-tight">
                          {p.name}
                        </span>
                        {p.topClaim && (
                          <Badge className="bg-[#fff3ec] text-[#f36b21] hover:bg-[#fff3ec] border border-[#f3b58a] text-[10px] font-bold uppercase tracking-wide px-1.5 py-0">
                            Top claim
                          </Badge>
                        )}
                      </div>
                      <div className="text-[12px] text-[#6c6c6c] mt-0.5">{p.category}</div>
                    </div>
                    <StatusPill status={p.status} compact />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-3 border-t border-[#eee] bg-[#fafafa] text-[12px] text-[#6c6c6c] flex items-center gap-2 flex-shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1ca36f] flex-shrink-0" />
          Cover applies to sudden mechanical &amp; electrical failure. Full T&amp;Cs available before checkout.
        </div>
      </DialogContent>
    </Dialog>
  );
};

const StatusPill: React.FC<{ status: Status; compact?: boolean }> = ({ status, compact }) => {
  if (status === 'covered') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-[#eaf8f2] text-[#0e6b48] border border-[#cdebd9] font-bold',
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'
        )}
      >
        <Check className="w-3 h-3" strokeWidth={3} />
        Covered
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-[#fbf0f0] text-[#9b2c2c] border border-[#efdcdc] font-bold',
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'
      )}
    >
      <X className="w-3 h-3" strokeWidth={3} />
      Not covered
    </span>
  );
};

export default PartsListModal;
