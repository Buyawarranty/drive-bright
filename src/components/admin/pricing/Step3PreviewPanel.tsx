import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { readAppliedPromos, setPromoSuppressed } from '@/lib/promoStorage';

const PricingTable = lazy(() => import('@/components/PricingTable'));


type Vehicle = {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  vehicleType?: string;
};

/**
 * Replicates the public website Step 3 (?step=3) plan/price selector so the
 * prices being tested can be checked exactly as a customer would see them.
 * Plan selection is intercepted — no cart, no checkout, no writes.
 */
export default function Step3PreviewPanel() {
  const [reg, setReg] = useState('');
  const [mileage, setMileage] = useState('60000');
  const [looking, setLooking] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [storedPromos] = useState(() => readAppliedPromos().map(c => c.code));

  // Any promo/test code left in this browser (e.g. a 99% manager test code) would
  // discount the summary panel while the term cards stay at grid price — making the
  // preview look broken. Suppress promos for as long as the preview is open.
  useEffect(() => {
    setPromoSuppressed(true);
    return () => setPromoSuppressed(false);
  }, []);



  async function loadVehicle() {
    if (!reg.trim()) {
      toast.error('Enter a registration to preview Step 3');
      return;
    }
    setLooking(true);
    try {
      const { data } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registration: reg.trim() },
      });
      setVehicle({
        regNumber: reg.trim().toUpperCase(),
        mileage: String(Math.max(0, Number(mileage) || 0)),
        make: data?.make,
        model: data?.model,
        fuelType: data?.fuelType,
        transmission: data?.transmission,
        year: data?.yearOfManufacture || data?.year,
        vehicleType: data?.vehicleType,
      });
      if (!data?.make) toast.warning('No DVLA match — previewing with registration and mileage only');
    } catch {
      setVehicle({ regNumber: reg.trim().toUpperCase(), mileage: String(Number(mileage) || 0) });
      toast.warning('Lookup failed — previewing with registration and mileage only');
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Website Step 3 preview</CardTitle>
          <CardDescription>
            Enter a vehicle to see the real customer plan selector priced with the grid selected
            above. Choosing a plan here does nothing — it never reaches the cart or checkout.
            {storedPromos.length > 0 && (
              <span className="block mt-2 font-semibold text-foreground">
                Promo code{storedPromos.length > 1 ? 's' : ''} {storedPromos.join(', ')} {storedPromos.length > 1 ? 'are' : 'is'} saved
                in this browser and {storedPromos.length > 1 ? 'are' : 'is'} ignored here, so the preview shows the true grid
                prices.
              </span>
            )}
          </CardDescription>

        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Registration</Label>
            <Input
              value={reg}
              onChange={e => setReg(e.target.value.toUpperCase())}
              placeholder="AB12 CDE"
              className="w-40 uppercase font-semibold"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mileage</Label>
            <Input
              value={mileage}
              onChange={e => setMileage(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-32"
            />
          </div>
          <Button onClick={loadVehicle} disabled={looking}>
            {looking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Preview Step 3
          </Button>
          {vehicle && (
            <Button variant="outline" onClick={() => setVehicle(null)}>
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {vehicle && (
        <div className="rounded-lg border bg-background">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Step 3…</div>}>
            <PricingTable
              vehicleData={vehicle}
              onBack={() => setVehicle(null)}
              /* Same props the real website passes at ?step=3 so the preview shows
                 identical fields and buttons (change vehicle, inline edits). */
              onChangeVehicle={() => setVehicle(null)}
              onUpdateVehicle={patch =>
                setVehicle(prev => (prev ? { ...prev, ...patch } : prev))
              }
              previousLabourRate={70}
              onPlanSelected={(_planId, paymentType, planName) => {
                toast.info(
                  `Preview only — “${planName ?? 'plan'}” (${paymentType}) was not added to a cart.`
                );
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
