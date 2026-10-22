import React, { useState } from 'react';
import SandboxStep3Pricing, { type SandboxSelection } from '@/components/admin/step3-sandbox/SandboxStep3Pricing';
import SandboxStep4Preview from '@/components/admin/step3-sandbox/SandboxStep4Preview';
import QuotesOrdersReviewPanel from '@/components/admin/step3-sandbox/QuotesOrdersReviewPanel';
import { CODE_WEB_DISCOUNT_PCT } from '@/lib/pricing/pricingVersionConfig';
import type { SandboxOptions } from '@/lib/pricing/sandboxStep3Pricing';
import type { WebsiteQuoteVehicle } from '@/lib/pricing/websiteQuotePrice';

const VEHICLE: WebsiteQuoteVehicle = {
  make: 'Audi',
  model: 'A4',
  fuelType: 'Diesel',
  transmission: 'Manual',
  vehicleType: 'Car',
  year: 2019,
  mileage: 60000,
  regNumber: 'AB19CDX',
};

export default function SandboxRenderPage() {
  const [options, setOptions] = useState<SandboxOptions>({
    claimLimit: 2000,
    voluntaryExcess: 100,
    labourRate: 50,
  });
  const [selection, setSelection] = useState<SandboxSelection | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-xl font-bold">Sandbox step 3 (render check)</h1>
      <SandboxStep3Pricing
        vehicle={VEHICLE}
        options={options}
        onOptionsChange={setOptions}
        onSelect={setSelection}
      />
      <QuotesOrdersReviewPanel vehicle={VEHICLE} options={options} gapPct={CODE_WEB_DISCOUNT_PCT} />
      {selection && (
        <SandboxStep4Preview vehicle={VEHICLE} selection={selection} onBack={() => setSelection(null)} />
      )}
    </div>
  );
}
