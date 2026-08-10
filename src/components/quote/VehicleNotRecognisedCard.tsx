import React from 'react';
import { Phone, PhoneCall, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SALES_PHONE, SALES_PHONE_TEL } from '@/constants/contact';
import type { VehicleIdGap } from '@/lib/vehicleIdentification';

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
}) => (
  <div className="space-y-3 rounded-2xl border-2 border-[#F0A500] bg-[#FFF8E5] p-4 text-left animate-fade-in">
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#F0D6A0]">
        <ShieldAlert className="h-4 w-4 text-[#B07A00]" strokeWidth={2.5} />
      </span>
      <div>
        <p className="text-base font-bold text-[#7A5A00]">{gap.message}</p>
        <p className="mt-1 text-sm text-[#8A6A1F] leading-relaxed">{gap.detail}</p>
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

export default VehicleNotRecognisedCard;
