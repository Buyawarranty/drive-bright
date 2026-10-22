// TEMPORARY preview harness for visually checking the step 3 sandbox tweak
// settings. Not linked anywhere; remove after verification.
import React, { useState } from 'react';
import SandboxStep3Pricing from '@/components/admin/step3-sandbox/SandboxStep3Pricing';
import QuotesOrdersReviewPanel from '@/components/admin/step3-sandbox/QuotesOrdersReviewPanel';
import type { SandboxOptions, SandboxTweaks } from '@/lib/pricing/sandboxStep3Pricing';

const vehicle = {
  regNumber: 'AB12 CDE',
  make: 'Ford',
  model: 'Focus',
  fuelType: 'Petrol',
  year: '2019',
  mileage: '45000',
};

export default function __SandboxTweaksRender() {
  const [options, setOptions] = useState<SandboxOptions>({
    claimLimit: 2000,
    voluntaryExcess: 100,
    labourRate: 50,
  });
  const tweaks: SandboxTweaks = { priceAdjustPct: 10, payLaterUpliftPct: 20 };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold">Sandbox tweaks render check (+10% prices, 20% PayLater uplift, 10% gap)</h1>
      <SandboxStep3Pricing
        vehicle={vehicle}
        options={options}
        onOptionsChange={setOptions}
        onSelect={() => undefined}
        tweaks={tweaks}
      />
      <QuotesOrdersReviewPanel vehicle={vehicle} options={options} gapPct={10} tweaks={tweaks} />
    </div>
  );
}
