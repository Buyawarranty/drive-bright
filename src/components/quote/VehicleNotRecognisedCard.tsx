import React from 'react';
import { Phone, PhoneCall, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SALES_PHONE, SALES_PHONE_TEL } from '@/constants/contact';
import type { VehicleIdGap } from '@/lib/vehicleIdentification';
import { isNorthernIrelandPlate } from '@/lib/niPlate';

interface VehicleNotRecognisedCardProps {
  gap: VehicleIdGap;
  regNumber?: string;
  onRequestCallback?: () => void;
}

/**
 * Shown on public reg-entry surfaces when the make/model can't be confirmed.
 * There is deliberately no "enter it yourself" route — a price is only ever
 * given once we know the exact vehicle.
 */
const VehicleNotRecognisedCard: React.FC<VehicleNotRecognisedCardProps> = ({
  gap,
  regNumber,
  onRequestCallback,
}) => {
  // Northern Ireland has no MOT/vehicle API we can read, so when the plate
  // isn't recognised we say so plainly and promise a call back to confirm the
  // vehicle and complete the order.
  const isNI = isNorthernIrelandPlate(regNumber);
  const headline = isNI
    ? "We couldn't confirm this Northern Ireland registration"
    : gap.message;
  const detail = isNI
    ? "Northern Ireland vehicles aren't always on the databases we check. Request a callback and we'll confirm your vehicle, give you the price and finish the order with you on the phone."
    : gap.detail;

  return (
  <div className="space-y-3 rounded-2xl border-2 border-[#F0A500] bg-[#FFF8E5] p-4 text-left animate-fade-in">
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#F0D6A0]">
        <ShieldAlert className="h-4 w-4 text-[#B07A00]" strokeWidth={2.5} />
      </span>
      <div>
        <p className="text-base font-bold text-[#7A5A00]">{headline}</p>
        <p className="mt-1 text-sm text-[#8A6A1F] leading-relaxed">{detail}</p>
        {regNumber && (
          <p className="mt-1 text-xs font-semibold text-[#8A6A1F]">
            Registration entered: {regNumber.toUpperCase()}
          </p>
        )}
      </div>
    </div>
    <div className="flex flex-col sm:flex-row gap-2">
      <Button asChild className="flex-1 bg-brand-orange hover:bg-orange-700 text-white font-bold">
        <a href={SALES_PHONE_TEL} className="flex items-center justify-center gap-2">
          <Phone className="h-4 w-4" strokeWidth={2.5} />
          Call {SALES_PHONE}
        </a>
      </Button>
      {onRequestCallback && (
        <Button
          type="button"
          variant="outline"
          onClick={onRequestCallback}
          className="flex-1 border-[#B07A00] text-[#7A5A00] hover:bg-[#FFF1CC] font-bold"
        >
          <PhoneCall className="h-4 w-4 mr-2" strokeWidth={2.5} />
          Request a callback
        </Button>
      )}
    </div>
    <p className="text-xs text-[#8A6A1F]">
      Lines are open Monday to Friday. Northern Ireland plates and brand-new or imported
      vehicles sometimes need a quick manual check.
    </p>
  </div>
  );
};

export default VehicleNotRecognisedCard;
