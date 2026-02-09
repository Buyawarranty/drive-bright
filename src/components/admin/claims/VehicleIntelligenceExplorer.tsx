import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, X, Filter, ChevronDown, ChevronRight, Car, AlertTriangle, TrendingDown, PoundSterling, Hash, Flame } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { buildVehicleTaxonomy, normaliseMake, normaliseModelFamily, VehicleTaxonomy } from './vehicleNormalisation';

interface SearchSuggestion {
  type: 'make' | 'family' | 'variant' | 'fuel' | 'bodyType';
  label: string;
  make: string;
  family?: string;
  count: number;
  value?: string;
}

interface ClaimData {
  id: string;
  status: string;
  payment_amount?: number;
  created_at: string;
  vehicle_registration?: string;
}

interface VehicleIntelligenceExplorerProps {
  claims: ClaimData[];
}

interface VehicleInfo {
  registration_plate: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_fuel_type: string | null;
  vehicle_year: string | null;
  vehicle_transmission: string | null;
}

// Simple body type inference from model name
function inferBodyType(make: string, model: string): string {
  const m = `${make} ${model}`.toLowerCase();
  // Motorbike makes
  if (['yamaha', 'honda', 'kawasaki', 'suzuki', 'ducati', 'triumph', 'harley', 'ktm', 'bmw motorrad', 'aprilia', 'indian'].some(b => m.includes(b) && !['civic', 'jazz', 'cr-v', 'hr-v', 'accord'].some(car => m.includes(car)))) {
    // Honda makes both cars and bikes - check model
    if (make.toLowerCase() === 'honda' && ['cbr', 'cb', 'crf', 'africa twin', 'rebel', 'goldwing', 'monkey', 'grom', 'nc', 'ctx'].some(bike => m.includes(bike))) return 'Motorbike';
  }
  if (['motorcycle', 'motorbike', 'bike'].some(k => m.includes(k))) return 'Motorbike';
  // Vans
  if (['transit', 'sprinter', 'vito', 'vivaro', 'crafter', 'caddy', 'transporter', 'combo', 'movano', 'relay', 'dispatch', 'expert', 'partner', 'berlingo', 'kangoo', 'trafic', 'master', 'nv200', 'nv300', 'nv400', 'proace', 'hiace', 'caravelle', 'multivan'].some(v => m.includes(v))) return 'Van';
  // SUV / Crossover
  if (['suv', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'rav4', 'rav 4', 'cr-v', 'crv', 'hr-v', 'hrv', 'tucson', 'sportage', 'qashqai', 'juke', 'tiguan', 'touareg', 'q2', 'q3', 'q4', 'q5', 'q7', 'q8', 'gla', 'glb', 'glc', 'gle', 'gls', 'range rover', 'discovery', 'defender', 'freelander', 'kuga', 'puma', 'ecosport', 'mokka', 'crossland', 'grandland', 'c-hr', 'chr', 'highlander', 't-roc', 'troc', 't-cross', 'tcross', 'explorer', 'edge', 'mustang mach-e', 'ix', 'ix3', 'eqa', 'eqb', 'eqc'].some(s => m.includes(s))) return 'SUV';
  // Pickup
  if (['hilux', 'ranger', 'l200', 'navara', 'amarok', 'pickup', 'pick-up'].some(p => m.includes(p))) return 'Pickup';
  // Hatchback indicators
  if (['fiesta', 'focus', 'polo', 'golf', 'corsa', 'astra', 'yaris', 'aygo', 'up!', 'clio', 'micra', 'ibiza', 'fabia', 'i10', 'i20', 'i30', 'swift', 'jazz', 'civic', 'leon'].some(h => m.includes(h))) return 'Hatchback';
  // Saloon / Sedan
  if (['a-class', 'c-class', 'e-class', 's-class', '3 series', '5 series', '7 series', 'a4', 'a6', 'a8', 'passat', 'mondeo', 'insignia', 'camry', 'corolla', 'arteon'].some(s => m.includes(s))) return 'Saloon';
  // Estate / Touring
  if (['estate', 'touring', 'avant', 'sportback', 'wagon'].some(e => m.includes(e))) return 'Estate';
  // Coupe / Sports
  if (['coupe', 'coupé', 'gt86', 'supra', 'tt', 'r8', 'z4', 'mustang', 'scirocco', 'cayman', 'boxster', '911'].some(c => m.includes(c))) return 'Coupe/Sports';
  return 'Car';
}

// Fuel type and year filters
type FuelFilter = string;
type YearFilter = string;

export const VehicleIntelligenceExplorer: React.FC<VehicleIntelligenceExplorerProps> = ({ claims }) => {
  const [vehicleMap, setVehicleMap] = useState<Map<string, VehicleInfo>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [selectedMakes, setSelectedMakes] = useState<string[]>([]);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedFuel, setSelectedFuel] = useState<FuelFilter>('all');
  const [selectedYear, setSelectedYear] = useState<YearFilter>('all');
  const [selectedBodyType, setSelectedBodyType] = useState<string>('all');
  const [expandedMakes, setExpandedMakes] = useState<Set<string>>(new Set());
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch vehicle data
  useEffect(() => {
    const regs = Array.from(new Set(claims.map(c => c.vehicle_registration?.toUpperCase()).filter(Boolean))) as string[];
    if (regs.length === 0) return;

    const fetchVehicles = async () => {
      const { data } = await supabase
        .from('customers')
        .select('registration_plate, vehicle_make, vehicle_model, vehicle_fuel_type, vehicle_year, vehicle_transmission')
        .in('registration_plate', regs);

      if (data) {
        const map = new Map<string, VehicleInfo>();
        data.forEach(v => {
          if (v.registration_plate) map.set(v.registration_plate.toUpperCase(), v as VehicleInfo);
        });
        setVehicleMap(map);
      }
    };
    fetchVehicles();
  }, [claims]);

  // Build raw records from claims + vehicle data
  const rawRecords = useMemo(() => {
    const byKey = new Map<string, { make: string; model: string; fuel: string; year: string; bodyType: string; claimCount: number; totalCost: number; paidCount: number }>();

    claims.forEach(c => {
      const reg = c.vehicle_registration?.toUpperCase();
      const info = reg ? vehicleMap.get(reg) : null;
      if (!info?.vehicle_make) return;

      const key = `${info.vehicle_make}|${info.vehicle_model || ''}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          make: info.vehicle_make,
          model: info.vehicle_model || '',
          fuel: info.vehicle_fuel_type || 'Unknown',
          year: info.vehicle_year || 'Unknown',
          bodyType: inferBodyType(info.vehicle_make, info.vehicle_model || ''),
          claimCount: 0,
          totalCost: 0,
          paidCount: 0,
        });
      }
      const entry = byKey.get(key)!;
      entry.claimCount++;
      if (c.payment_amount && c.payment_amount > 0) {
        entry.totalCost += c.payment_amount;
        entry.paidCount++;
      }
    });

    return Array.from(byKey.values());
  }, [claims, vehicleMap]);

  // Available filter options
  const availableFuels = useMemo(() => {
    const fuels = new Set<string>();
    rawRecords.forEach(r => fuels.add(r.fuel));
    return Array.from(fuels).sort();
  }, [rawRecords]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    rawRecords.forEach(r => { if (r.year !== 'Unknown') years.add(r.year); });
    return Array.from(years).sort().reverse();
  }, [rawRecords]);

  const availableBodyTypes = useMemo(() => {
    const types = new Set<string>();
    rawRecords.forEach(r => { if (r.bodyType !== 'Unknown') types.add(r.bodyType); });
    return Array.from(types).sort();
  }, [rawRecords]);

  // Build taxonomy
  const taxonomy = useMemo(() => {
    let filtered = rawRecords;

    if (selectedFuel !== 'all') {
      filtered = filtered.filter(r => r.fuel === selectedFuel);
    }
    if (selectedYear !== 'all') {
      filtered = filtered.filter(r => r.year === selectedYear);
    }
    if (selectedBodyType !== 'all') {
      filtered = filtered.filter(r => r.bodyType === selectedBodyType);
    }

    return buildVehicleTaxonomy(filtered);
  }, [rawRecords, selectedFuel, selectedYear, selectedBodyType]);

  // Apply search + chip filters
  const filteredTaxonomy = useMemo(() => {
    let result = taxonomy;

    if (selectedMakes.length > 0) {
      result = result.filter(m => selectedMakes.includes(m.make));
    }

    if (selectedFamilies.length > 0) {
      result = result.map(m => ({
        ...m,
        families: m.families.filter(f => selectedFamilies.includes(`${m.make}|${f.family}`)),
      })).filter(m => m.families.length > 0);
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result
        .map(m => {
          if (m.make.toLowerCase().includes(q)) return m;
          const matchedFamilies = m.families.filter(f =>
            f.family.toLowerCase().includes(q) ||
            f.variants.some(v => v.variant.toLowerCase().includes(q))
          );
          if (matchedFamilies.length > 0) return { ...m, families: matchedFamilies };
          return null;
        })
        .filter(Boolean) as VehicleTaxonomy[];
    }

    return result;
  }, [taxonomy, selectedMakes, selectedFamilies, debouncedSearch]);

  // Top performers
  const topByClaims = useMemo(() => [...taxonomy].sort((a, b) => b.count - a.count).slice(0, 10), [taxonomy]);
  const topByCost = useMemo(() => [...taxonomy].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10), [taxonomy]);
  const topByAvgCost = useMemo(() => {
    return [...taxonomy]
      .filter(m => m.paidCount > 0)
      .map(m => ({ ...m, avgCost: m.totalCost / m.paidCount }))
      .sort((a, b) => b.avgCost - a.avgCost)
      .slice(0, 10);
  }, [taxonomy]);

  // Heatmap data (make x family)
  const heatmapData = useMemo(() => {
    return filteredTaxonomy.slice(0, 15).map(m => ({
      make: m.make,
      families: m.families.slice(0, 6).map(f => ({
        family: f.family,
        claims: f.count,
        cost: f.totalCost,
      })),
    }));
  }, [filteredTaxonomy]);

  const toggleMake = (make: string) => {
    setExpandedMakes(prev => {
      const next = new Set(prev);
      next.has(make) ? next.delete(make) : next.add(make);
      return next;
    });
  };

  const toggleFamily = (key: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const addMakeChip = (make: string) => {
    if (!selectedMakes.includes(make)) setSelectedMakes([...selectedMakes, make]);
  };

  const removeMakeChip = (make: string) => {
    setSelectedMakes(selectedMakes.filter(m => m !== make));
  };

  const addFamilyChip = (make: string, family: string) => {
    const key = `${make}|${family}`;
    if (!selectedFamilies.includes(key)) setSelectedFamilies([...selectedFamilies, key]);
  };

  const removeFamilyChip = (key: string) => {
    setSelectedFamilies(selectedFamilies.filter(f => f !== key));
  };

  const clearAllFilters = () => {
    setSelectedMakes([]);
    setSelectedFamilies([]);
    setSelectedFuel('all');
    setSelectedYear('all');
    setSelectedBodyType('all');
    setSearchQuery('');
  };

  const hasFilters = selectedMakes.length > 0 || selectedFamilies.length > 0 || selectedFuel !== 'all' || selectedYear !== 'all' || selectedBodyType !== 'all' || searchQuery !== '';

  // Autocomplete suggestions
  const suggestions = useMemo<SearchSuggestion[]>(() => {
    if (!searchQuery || searchQuery.length < 1) return [];
    const q = searchQuery.toLowerCase();
    const results: SearchSuggestion[] = [];

    // Fuel type matches
    availableFuels.forEach(f => {
      if (f.toLowerCase().includes(q)) {
        const count = rawRecords.filter(r => r.fuel === f).reduce((s, r) => s + r.claimCount, 0);
        results.push({ type: 'fuel', label: f, make: '', value: f, count });
      }
    });

    // Body type matches
    availableBodyTypes.forEach(bt => {
      if (bt.toLowerCase().includes(q)) {
        const count = rawRecords.filter(r => r.bodyType === bt).reduce((s, r) => s + r.claimCount, 0);
        results.push({ type: 'bodyType', label: bt, make: '', value: bt, count });
      }
    });

    taxonomy.forEach(m => {
      if (m.make.toLowerCase().includes(q)) {
        results.push({ type: 'make', label: m.make, make: m.make, count: m.count });
      }
      m.families.forEach(f => {
        if (f.family.toLowerCase().includes(q) || `${m.make} ${f.family}`.toLowerCase().includes(q)) {
          results.push({ type: 'family', label: `${m.make} ${f.family}`, make: m.make, family: f.family, count: f.count });
        }
        f.variants.forEach(v => {
          if (v.variant.toLowerCase().includes(q) && !results.some(r => r.label === `${m.make} ${v.variant}`)) {
            results.push({ type: 'variant', label: `${m.make} ${v.variant}`, make: m.make, family: f.family, count: v.count });
          }
        });
      });
    });

    return results.slice(0, 12);
  }, [searchQuery, taxonomy, availableFuels, availableBodyTypes, rawRecords]);

  const handleSuggestionClick = (s: SearchSuggestion) => {
    if (s.type === 'fuel' && s.value) {
      setSelectedFuel(s.value);
    } else if (s.type === 'bodyType' && s.value) {
      setSelectedBodyType(s.value);
    } else if (s.type === 'make') {
      addMakeChip(s.make);
    } else if (s.type === 'family' && s.family) {
      addMakeChip(s.make);
      addFamilyChip(s.make, s.family);
    } else if (s.type === 'variant' && s.family) {
      addMakeChip(s.make);
      addFamilyChip(s.make, s.family);
    }
    setSearchQuery('');
    setShowSuggestions(false);
  };

  if (taxonomy.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Car className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No vehicle data available yet</p>
          <p className="text-sm mt-1">Vehicle intelligence will appear once claims are linked to customer vehicles.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with search and filter drawer */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Vehicle Intelligence Explorer</h2>
          <Badge variant="secondary" className="text-xs">{taxonomy.reduce((s, m) => s + m.count, 0)} claims</Badge>
        </div>

        <div className="flex gap-2 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              ref={searchInputRef}
              placeholder="Search make, model, diesel, hybrid, SUV, van..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="pl-10 h-9"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setShowSuggestions(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.label}-${i}`}
                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s); }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                        s.type === 'make' ? 'border-orange-300 text-orange-700' :
                        s.type === 'family' ? 'border-blue-300 text-blue-700' :
                        s.type === 'fuel' ? 'border-green-300 text-green-700' :
                        s.type === 'bodyType' ? 'border-purple-300 text-purple-700' :
                        'border-muted-foreground/30 text-muted-foreground'
                      }`}>
                        {s.type === 'make' ? 'Make' : s.type === 'family' ? 'Family' : s.type === 'fuel' ? 'Fuel' : s.type === 'bodyType' ? 'Category' : 'Variant'}
                      </Badge>
                      <span className="font-medium">{s.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{s.count} claims</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-4 w-4" />
                Filters
                {hasFilters && <Badge variant="destructive" className="h-4 w-4 p-0 text-[10px] flex items-center justify-center rounded-full">!</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[340px] sm:w-[400px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  Vehicle Filters
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-7">
                      Clear All
                    </Button>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5 mt-5">
                {/* Manufacturer */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Manufacturer</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {taxonomy.map(m => (
                      <button
                        key={m.make}
                        onClick={() => selectedMakes.includes(m.make) ? removeMakeChip(m.make) : addMakeChip(m.make)}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex justify-between items-center hover:bg-muted/50 transition-colors ${selectedMakes.includes(m.make) ? 'bg-orange-50 border border-orange-200 text-orange-800' : ''}`}
                      >
                        <span>{m.make}</span>
                        <span className="text-xs text-muted-foreground">{m.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Family (filtered by selected makes) */}
                {selectedMakes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Model Family</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {taxonomy
                        .filter(m => selectedMakes.includes(m.make))
                        .flatMap(m => m.families.map(f => ({ make: m.make, family: f.family, count: f.count })))
                        .map(f => {
                          const key = `${f.make}|${f.family}`;
                          return (
                            <button
                              key={key}
                              onClick={() => selectedFamilies.includes(key) ? removeFamilyChip(key) : addFamilyChip(f.make, f.family)}
                              className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex justify-between items-center hover:bg-muted/50 transition-colors ${selectedFamilies.includes(key) ? 'bg-blue-50 border border-blue-200 text-blue-800' : ''}`}
                            >
                              <span>{f.make} {f.family}</span>
                              <span className="text-xs text-muted-foreground">{f.count}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Fuel Type */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Fuel Type</h4>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedFuel('all')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedFuel === 'all' ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
                    >
                      All
                    </button>
                    {availableFuels.map(f => (
                      <button
                        key={f}
                        onClick={() => setSelectedFuel(f)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedFuel === f ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Body / Vehicle Type */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Vehicle Category</h4>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedBodyType('all')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedBodyType === 'all' ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
                    >
                      All
                    </button>
                    {availableBodyTypes.map(bt => (
                      <button
                        key={bt}
                        onClick={() => setSelectedBodyType(bt)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedBodyType === bt ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
                      >
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Year Range */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Year</h4>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedYear('all')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedYear === 'all' ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
                    >
                      All
                    </button>
                    {availableYears.slice(0, 12).map(y => (
                      <button
                        key={y}
                        onClick={() => setSelectedYear(y)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedYear === y ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {selectedMakes.map(m => (
            <Badge key={m} variant="secondary" className="gap-1 bg-orange-50 text-orange-800 border-orange-200 cursor-pointer" onClick={() => removeMakeChip(m)}>
              {m} <X className="h-3 w-3" />
            </Badge>
          ))}
          {selectedFamilies.map(key => (
            <Badge key={key} variant="secondary" className="gap-1 bg-blue-50 text-blue-800 border-blue-200 cursor-pointer" onClick={() => removeFamilyChip(key)}>
              {key.split('|')[1]} <X className="h-3 w-3" />
            </Badge>
          ))}
          {selectedFuel !== 'all' && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setSelectedFuel('all')}>
              {selectedFuel} <X className="h-3 w-3" />
            </Badge>
          )}
          {selectedYear !== 'all' && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setSelectedYear('all')}>
              {selectedYear} <X className="h-3 w-3" />
            </Badge>
          )}
          {selectedBodyType !== 'all' && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setSelectedBodyType('all')}>
              {selectedBodyType} <X className="h-3 w-3" />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 text-xs">
            Clear all
          </Button>
        </div>
      )}

      {/* Top Performers Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Least Reliable Makes
            </CardTitle>
            <CardDescription className="text-xs">Most claims by manufacturer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topByClaims.slice(0, 5).map((m, i) => (
              <button key={m.make} onClick={() => addMakeChip(m.make)} className="w-full flex justify-between items-center text-sm hover:bg-muted/50 rounded px-1 py-0.5 transition-colors">
                <span className="font-medium">{i + 1}. {m.make}</span>
                <Badge variant="secondary" className="text-xs">{m.count} claims</Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              Most Costly Makes
            </CardTitle>
            <CardDescription className="text-xs">Highest total payout</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topByCost.slice(0, 5).map((m, i) => (
              <button key={m.make} onClick={() => addMakeChip(m.make)} className="w-full flex justify-between items-center text-sm hover:bg-muted/50 rounded px-1 py-0.5 transition-colors">
                <span className="font-medium">{i + 1}. {m.make}</span>
                <Badge variant="secondary" className="text-xs">£{Math.round(m.totalCost).toLocaleString()}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-blue-500" />
              Highest Avg Claim
            </CardTitle>
            <CardDescription className="text-xs">Average cost per paid claim</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topByAvgCost.slice(0, 5).map((m, i) => (
              <button key={m.make} onClick={() => addMakeChip(m.make)} className="w-full flex justify-between items-center text-sm hover:bg-muted/50 rounded px-1 py-0.5 transition-colors">
                <span className="font-medium">{i + 1}. {m.make}</span>
                <Badge variant="secondary" className="text-xs">£{Math.round(m.avgCost).toLocaleString()} avg</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Claims by Make - Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claims by Manufacturer</CardTitle>
          <CardDescription>Click a bar to filter by that make · Top 15 shown</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={filteredTaxonomy.slice(0, 15).map(m => ({
                name: m.make,
                claims: m.count,
                cost: Math.round(m.totalCost),
              }))}
              layout="vertical"
              onClick={(data: any) => {
                if (data?.activePayload?.[0]?.payload?.name) {
                  addMakeChip(data.activePayload[0].payload.name);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number, name: string) => name === 'cost' ? `£${value.toLocaleString()}` : value} />
              <Bar dataKey="claims" fill="hsl(24, 95%, 53%)" name="Claims" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Heatmap / Claims Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Claims Matrix — Make × Model Family
          </CardTitle>
          <CardDescription>Cell intensity shows claim volume · Click to filter</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {heatmapData.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground border-b">Make</th>
                  {(() => {
                    const allFamilies = new Set<string>();
                    heatmapData.forEach(m => m.families.forEach(f => allFamilies.add(f.family)));
                    return Array.from(allFamilies).slice(0, 8).map(f => (
                      <th key={f} className="text-center p-2 font-medium text-muted-foreground border-b min-w-[80px]">{f}</th>
                    ));
                  })()}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map(m => {
                  const allFamilies = new Set<string>();
                  heatmapData.forEach(md => md.families.forEach(f => allFamilies.add(f.family)));
                  const familyList = Array.from(allFamilies).slice(0, 8);
                  const maxClaims = Math.max(...heatmapData.flatMap(md => md.families.map(f => f.claims)), 1);

                  return (
                    <tr key={m.make} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-2 font-medium">
                        <button onClick={() => addMakeChip(m.make)} className="hover:text-orange-600 transition-colors">
                          {m.make}
                        </button>
                      </td>
                      {familyList.map(fam => {
                        const match = m.families.find(f => f.family === fam);
                        if (!match) return <td key={fam} className="p-2 text-center text-muted-foreground/30">—</td>;
                        const intensity = Math.min(match.claims / maxClaims, 1);
                        const bg = intensity > 0.7 ? 'bg-red-100 text-red-800' : intensity > 0.3 ? 'bg-orange-50 text-orange-800' : 'bg-green-50 text-green-800';
                        return (
                          <td key={fam} className="p-1 text-center">
                            <button
                              onClick={() => { addMakeChip(m.make); addFamilyChip(m.make, fam); }}
                              className={`inline-block rounded px-2 py-1 text-xs font-medium ${bg} hover:ring-2 ring-offset-1 ring-orange-300 transition-all`}
                            >
                              {match.claims}
                              <span className="block text-[10px] opacity-70">£{Math.round(match.cost).toLocaleString()}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No data matches current filters</p>
          )}
        </CardContent>
      </Card>

      {/* Expandable Manufacturer → Family → Variant Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Full Vehicle Breakdown</CardTitle>
          <CardDescription>Expand manufacturers to see model families and variants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {filteredTaxonomy.map(m => (
            <Collapsible key={m.make} open={expandedMakes.has(m.make)} onOpenChange={() => toggleMake(m.make)}>
              <CollapsibleTrigger className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                <div className="flex items-center gap-2">
                  {expandedMakes.has(m.make) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-semibold">{m.make}</span>
                  <Badge variant="outline" className="text-xs">{m.families.length} families</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{m.count}</span>
                  <span className="flex items-center gap-1"><PoundSterling className="h-3 w-3" />£{Math.round(m.totalCost).toLocaleString()}</span>
                  {m.paidCount > 0 && (
                    <span className="text-orange-600">avg £{Math.round(m.totalCost / m.paidCount).toLocaleString()}</span>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-6 space-y-0.5">
                {m.families.map(f => {
                  const familyKey = `${m.make}|${f.family}`;
                  return (
                    <Collapsible key={familyKey} open={expandedFamilies.has(familyKey)} onOpenChange={() => toggleFamily(familyKey)}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/30 transition-colors text-sm">
                        <div className="flex items-center gap-2">
                          {expandedFamilies.has(familyKey) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <span className="font-medium">{f.family}</span>
                          <span className="text-xs text-muted-foreground">({f.variants.length} variants)</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{f.count} claims</span>
                          <span>£{Math.round(f.totalCost).toLocaleString()}</span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="ml-6">
                        <div className="border-l-2 border-border/50 pl-3 py-1 space-y-0.5">
                          {f.variants.map((v, i) => (
                            <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/20">
                              <span className="text-muted-foreground">{v.variant}</span>
                              <div className="flex items-center gap-3">
                                <span>{v.count} claims</span>
                                <span>£{Math.round(v.totalCost).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
