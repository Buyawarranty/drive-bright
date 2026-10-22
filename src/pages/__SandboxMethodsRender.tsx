// TEMPORARY render harness for visually checking the sandbox payment-method
// tiles. Not linked anywhere; removed after verification.
import React, { useState } from 'react';
import SandboxStep3Pricing from '@/components/admin/step3-sandbox/SandboxStep3Pricing';
import { DEFAULT_PAYMENT_SETTINGS } from '@/lib/pricing/sandboxPaymentMethods';

const vehicle = {
  regNumber: 'AB12 CDE',
  mileage: '60000',
  make: 'Ford',
  model: 'Focus',
  fuelType: 'Petrol',
  year: 2019,
};

export default function __SandboxMethodsRender() {
  const [options, setOptions] = useState({ claimLimit: 2000, voluntaryExcess: 100, labourRate: 50 });
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SandboxStep3Pricing
        vehicle={vehicle}
        options={options}
        onOptionsChange={setOptions}
        onSelect={() => {}}
        paymentSettings={{
          ...DEFAULT_PAYMENT_SETTINGS,
          payLater: { enabled: true, upliftPct: 15, offerOn24: true, offerOn36: true },
          klarna: { enabled: true, instalments: 3 },
          zopa: { enabled: true, aprPct: 19.9, termMonths: 24 },
        }}
      />
    </div>
  );
}
