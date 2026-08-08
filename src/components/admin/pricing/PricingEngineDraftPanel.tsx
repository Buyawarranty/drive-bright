import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, FlaskConical, ShieldCheck, PhoneCall, Ban } from 'lucide-react';
import { calculateQuotePrice } from '@/lib/pricing/quotePricingService';
import type { PaymentPeriod, PricingSurface } from '@/lib/pricingMatrix';
import { MAX_VEHICLE_AGE_YEARS, MAX_VEHICLE_MILEAGE } from '@/lib/pricing/eligibilityBoundaries';
import PricingParityPanel from '@/components/admin/pricing/PricingParityPanel';
import PriceMatrixExplorer from '@/components/admin/pricing/PriceMatrixExplorer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import WebGapDraftPanel from '@/components/admin/pricing/WebGapDraftPanel';
import ModelRiskDraftPanel from '@/components/admin/pricing/ModelRiskDraftPanel';

const PERIODS: { value: PaymentPeriod; label: string }[] = [
  { value: '12months', label: '12 months' },
  { value: '24months', label: '24 months' },
  { value: '36months', label: '36 months' },
];

const EXCESS_OPTIONS = [0, 50, 100, 150, 250, 500];
import { getDisplayClaimLimit } from '@/lib/claimLimitTiers';

// 750 / 1250 / 2000 are internal grid columns for the £1,000 / £2,000 / £3,000 tiers.
const CLAIM_LIMITS = [1000, 2000, 3000];
const LABOUR_RATES = [50, 70, 100, 150];

const money = (n: number) => `£${Math.abs(n).toLocaleString('en-GB')}`;

export default function PricingEngineDraftPanel() {
  const [make, setMake] = useState('Vauxhall');
  const [model, setModel] = useState('Zafira');
  const [fuelType, setFuelType] = useState('Petrol');
  const [vehicleType, setVehicleType] = useState('Car');
  const [year, setYear] = useState('2015');
  const [registrationDate, setRegistrationDate] = useState('');
  const [mileage, setMileage] = useState('85000');

  const [period, setPeriod] = useState<PaymentPeriod>('12months');
  const [excess, setExcess] = useState(100);
  const [claimLimit, setClaimLimit] = useState(1250);
  const [labourRate, setLabourRate] = useState(70);
  const [boost, setBoost] = useState(false);
  const [surface, setSurface] = useState<PricingSurface>('admin');
  const [skipEligibility, setSkipEligibility] = useState(false);
  const [reg, setReg] = useState('');
  const [looking, setLooking] = useState(false);

  const lookupReg = async () => {
    const plate = reg.trim().toUpperCase().replace(/\s+/g, '');
    if (!plate) return;
    setLooking(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: plate },
      });
      if (error) throw error;
      if (!data?.found) {
        toast.error('Vehicle not found for that registration');
        return;
      }
      setMake(data.make || '');
      setModel(data.model || '');
      setFuelType(data.fuelType || '');
      setVehicleType(data.vehicleType || 'Car');
      setYear(String(data.yearOfManufacture ?? ''));
      setRegistrationDate(
        (data.registrationDate || data.manufactureDate || '').toString().slice(0, 10)
      );
      if (data.motMileage != null) setMileage(String(data.motMileage));
      toast.success(`Loaded ${data.make} ${data.model}`);
    } catch (e) {
      console.error('[PricingEngineDraftPanel] reg lookup failed', e);
      toast.error('Lookup failed — enter the vehicle manually');
    } finally {
      setLooking(false);
    }
  };

  const result = useMemo(
    () =>
      calculateQuotePrice({
        vehicle: {
          make,
          model,
          fuelType,
          vehicleType,
          yearOfManufacture: year,
          registrationDate: registrationDate || null,
          mileage,
        },
        paymentPeriod: period,
        voluntaryExcess: excess,
        claimLimit,
        labourRate,
        boostAddon: boost,
        surface,
        skipEligibility,
      }),
    [
      make,
      model,
      fuelType,
      vehicleType,
      year,
      registrationDate,
      mileage,
      period,
      excess,
      claimLimit,
      labourRate,
      boost,
      surface,
      skipEligibility,
    ]
  );

  const eligibilityBadge = () => {
    if (result.eligibility.outcome === 'eligible') {
      return (
        <Badge className="bg-emerald-600 text-primary-foreground gap-1">
          <ShieldCheck className="h-3 w-3" /> Eligible
        </Badge>
      );
    }
    if (result.eligibility.outcome === 'referral') {
      return (
        <Badge variant="secondary" className="gap-1">
          <PhoneCall className="h-3 w-3" /> Referral
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <Ban className="h-3 w-3" /> Declined
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <Alert>
        <FlaskConical className="h-4 w-4" />
        <AlertDescription>
          <strong>Draft only — nothing here is live.</strong> This runs the single pricing service
          and the shared eligibility boundaries ({MAX_VEHICLE_AGE_YEARS} years from first
          registration, {MAX_VEHICLE_MILEAGE.toLocaleString()} miles inclusive, polite phone
          referral when age or mileage is missing). Compare the total against Quotes &amp; Orders and
          Step 3/4 before we switch those pages over.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Look up a real vehicle (optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={reg}
                  onChange={(e) => setReg(e.target.value.toUpperCase())}
                  placeholder="e.g. LN18 XKO"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void lookupReg();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => void lookupReg()} disabled={looking}>
                  {looking ? 'Looking…' : 'Look up'}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Make</Label>
              <Input value={make} onChange={(e) => setMake(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fuel type</Label>
              <Input value={fuelType} onChange={(e) => setFuelType(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vehicle type</Label>
              <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Year of manufacture</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label>First registration date (preferred)</Label>
              <Input
                type="date"
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Mileage</Label>
              <Input value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cover options</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Term</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PaymentPeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Voluntary excess</Label>
              <Select value={String(excess)} onValueChange={(v) => setExcess(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXCESS_OPTIONS.map((e) => (
                    <SelectItem key={e} value={String(e)}>
                      £{e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Claim limit</Label>
              <Select value={String(claimLimit)} onValueChange={(v) => setClaimLimit(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_LIMITS.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {getDisplayClaimLimit(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Labour rate</Label>
              <Select value={String(labourRate)} onValueChange={(v) => setLabourRate(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABOUR_RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      £{r}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Surface</Label>
              <Select value={surface} onValueChange={(v) => setSurface(v as PricingSurface)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Quotes &amp; Orders (admin)</SelectItem>
                  <SelectItem value="customer">Step 3 / 4 (customer)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <Label className="text-sm">Claim-limit boost</Label>
              <Switch checked={boost} onCheckedChange={setBoost} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2 sm:col-span-2">
              <Label className="text-sm">Skip eligibility (admin override)</Label>
              <Switch checked={skipEligibility} onCheckedChange={setSkipEligibility} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Breakdown</CardTitle>
          <div className="flex items-center gap-2">
            {eligibilityBadge()}
            <Badge variant="outline">factor ×{result.vehicleFactor.toFixed(3)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.eligibility.outcome !== 'eligible' && (
            <Alert variant={result.eligibility.outcome === 'declined' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {result.eligibility.message}
                {result.eligibility.reasons.length > 0 && (
                  <span className="block text-xs opacity-80">
                    {result.eligibility.reasons.join(' · ')}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {result.legacySurchargeDoubleCounts && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Double charge detected: the published factor model already prices age and mileage,
                and the legacy surcharge adds {money(result.legacySurcharge)} on top.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border divide-y">
            {result.lines.map((line, i) => (
              <div
                key={`${line.label}-${i}`}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
                  line.label === 'Total' ? 'font-semibold bg-muted/50' : ''
                }`}
              >
                <span>
                  {line.label}
                  {line.note && <span className="block text-xs text-muted-foreground">{line.note}</span>}
                </span>
                <span className={line.amount < 0 ? 'text-emerald-600' : ''}>
                  {line.amount < 0 ? `− ${money(line.amount)}` : money(line.amount)}
                </span>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Monthly equivalent</div>
              <div className="text-lg font-semibold">{money(result.monthlyEquivalent)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Web reference price</div>
              <div className="text-lg font-semibold">{money(result.webReferencePrice)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Age used</div>
              <div className="text-lg font-semibold">
                {result.eligibility.ageYears !== null
                  ? `${result.eligibility.ageYears.toFixed(2)}y`
                  : '—'}
              </div>
              <div className="text-xs text-muted-foreground">
                from {result.eligibility.ageSource.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PriceMatrixExplorer
        vehicle={{
          make,
          model,
          fuelType,
          vehicleType,
          yearOfManufacture: year,
          registrationDate: registrationDate || null,
          mileage,
        }}
        labourRate={labourRate}
        surface={surface}
        boostAddon={boost}
        skipEligibility={skipEligibility}
        excessOptions={EXCESS_OPTIONS}
        claimLimits={CLAIM_LIMITS}
        activePeriod={period}
        activeExcess={excess}
        activeClaimLimit={claimLimit}
        onSelect={(p, e, c) => {
          setPeriod(p);
          setExcess(e);
          setClaimLimit(c);
        }}
      />

      <WebGapDraftPanel />

      <ModelRiskDraftPanel />

      <PricingParityPanel />
    </div>
  );
}
