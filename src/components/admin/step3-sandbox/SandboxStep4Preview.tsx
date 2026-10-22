import React, { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { WebsiteQuoteVehicle } from '@/lib/pricing/websiteQuotePrice';
import type { SandboxSelection } from './SandboxStep3Pricing';

const StreamlinedCheckout = lazy(() => import('@/components/checkout/StreamlinedCheckout'));

interface SandboxStep4PreviewProps {
  vehicle: WebsiteQuoteVehicle;
  selection: SandboxSelection;
  onBack: () => void;
}

/**
 * The REAL step 4 checkout rendered with the exact prices chosen in the
 * sandbox step 3 — but in preview mode: every payment path is disabled, so no
 * order, email or customer record can ever be created.
 */
export default function SandboxStep4Preview({ vehicle, selection, onBack }: SandboxStep4PreviewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to sandbox step 3
        </Button>
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Step 4 preview — payments disabled
        </span>
      </div>

      <div className="rounded-lg border bg-muted/30">
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading step 4…</div>}>
          <StreamlinedCheckout
            vehicleData={{
              regNumber: vehicle.regNumber || 'PREVIEW',
              make: vehicle.make || 'Preview',
              model: vehicle.model || undefined,
              year: vehicle.year ? String(vehicle.year) : undefined,
              fuelType: vehicle.fuelType || undefined,
              mileage: String(vehicle.mileage ?? '0'),
              transmission: vehicle.transmission || undefined,
            }}
            planId="sandbox-preview"
            paymentType={selection.paymentType}
            planName={selection.planName}
            pricingData={{
              basePrice: selection.pricingData.totalPrice,
              totalPrice: selection.pricingData.totalPrice,
              monthlyPrice: selection.pricingData.monthlyPrice,
              voluntaryExcess: selection.pricingData.voluntaryExcess,
              claimLimit: selection.pricingData.claimLimit,
              labourRate: selection.pricingData.labourRate,
            }}
            onBack={onBack}
            onNext={() => undefined}
            previewOnly
          />
        </Suspense>
      </div>
    </div>
  );
}
