import React, { useState } from 'react';
import { Phone, PhoneCall, ShieldAlert, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SALES_PHONE, SALES_PHONE_TEL } from '@/constants/contact';
import type { VehicleIdGap } from '@/lib/vehicleIdentification';
import { isNorthernIrelandPlate } from '@/lib/niPlate';
import { isTeamOpenNow, nextOpeningLabel, openingHoursLabel } from '@/lib/aiSandbox/openingHours';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VehicleNotRecognisedCardProps {
  gap: VehicleIdGap;
  regNumber?: string;
  onRequestCallback?: () => void;
}

const validateUKPhone = (phoneNumber: string) => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.startsWith('07') && cleaned.length === 11) return true;
  if ((cleaned.startsWith('01') || cleaned.startsWith('02')) && cleaned.length >= 10 && cleaned.length <= 11) return true;
  if (cleaned.startsWith('03') && cleaned.length === 11) return true;
  return false;
};

/**
 * Shown on public reg-entry surfaces when the make/model can't be confirmed.
 * There is deliberately no "enter it yourself" route — a price is only ever
 * given once we know the exact vehicle.
 *
 * Opening hours (Mon–Sat, 9am–6pm UK) drive the call to action: in hours we
 * lead with the phone number, out of hours we lead with a callback request and
 * let the customer leave their number there and then.
 */
const VehicleNotRecognisedCard: React.FC<VehicleNotRecognisedCardProps> = ({
  gap,
  regNumber,
  onRequestCallback,
}) => {
  const { toast } = useToast();
  const isOpenNow = isTeamOpenNow();
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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

  const handleLeaveNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUKPhone(phone)) {
      setError('Please enter a valid UK phone number (e.g. 07123 456789)');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('abandoned_carts').insert({
        phone: phone.trim(),
        email: `callback_${Date.now()}@callback.temp`,
        step_abandoned: 0,
        contact_status: 'new',
        vehicle_reg: regNumber ? regNumber.toUpperCase() : null,
        contact_notes: `[${new Date().toLocaleDateString('en-GB')} - System] Callback requested — vehicle not confirmed from registration${regNumber ? ` (${regNumber.toUpperCase()})` : ''}${isOpenNow ? '' : ' — left out of hours'}`,
        full_name: 'Callback Request',
        cart_metadata: {
          source: 'vehicle_not_recognised',
          priority: 'urgent',
          request_type: 'urgent_callback',
          out_of_hours: !isOpenNow,
          registration: regNumber ? regNumber.toUpperCase() : null,
        },
      });
      if (insertError) throw insertError;
      setSubmitted(true);
      toast({
        title: 'Thanks — we have your number',
        description: isOpenNow ? "We'll call you back shortly." : `We'll call you ${nextOpeningLabel()}.`,
      });
    } catch (err) {
      console.error('Error submitting callback request:', err);
      toast({
        title: 'Something went wrong',
        description: `Please try again or call us on ${SALES_PHONE}`,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

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

      {submitted ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#B07A00]/40 bg-white p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" strokeWidth={2.5} />
          <p className="text-sm font-semibold text-[#7A5A00]">
            Got it — a warranty specialist will call you {isOpenNow ? 'shortly' : nextOpeningLabel()} to confirm your
            vehicle and give you the price.
          </p>
        </div>
      ) : (
        <>
          {isOpenNow ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="flex-1 bg-brand-orange hover:bg-orange-700 text-white font-bold">
                <a href={SALES_PHONE_TEL} className="flex items-center justify-center gap-2">
                  <Phone className="h-4 w-4" strokeWidth={2.5} />
                  Call {SALES_PHONE}
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onRequestCallback}
                className="flex-1 border-[#B07A00] text-[#7A5A00] hover:bg-[#FFF1CC] font-bold"
              >
                <PhoneCall className="h-4 w-4 mr-2" strokeWidth={2.5} />
                Request a callback
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm font-semibold text-[#7A5A00]">
              <Clock className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
              We're closed right now — leave your number and we'll call you {nextOpeningLabel()}.
            </p>
          )}

          <form onSubmit={handleLeaveNumber} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              aria-label="Your phone number"
              placeholder="Your phone number"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, '').slice(0, 11));
                if (error) setError('');
              }}
              className="flex-1 h-11 bg-white border-[#B07A00]/50 text-[#5A4200] placeholder:text-[#A08850]"
            />
            <Button
              type="submit"
              disabled={submitting}
              className={
                isOpenNow
                  ? 'h-11 border border-[#B07A00] bg-white text-[#7A5A00] hover:bg-[#FFF1CC] font-bold'
                  : 'h-11 bg-brand-orange hover:bg-orange-700 text-white font-bold'
              }
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <PhoneCall className="h-4 w-4 mr-2" strokeWidth={2.5} />
                  Request a callback
                </>
              )}
            </Button>
          </form>
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        </>
      )}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#8A6A1F]">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
          {openingHoursLabel}
        </span>
        <span aria-hidden="true">•</span>
        <span>
          Northern Ireland plates and brand-new or imported vehicles sometimes need a quick manual check.
        </span>
      </p>
    </div>
  );
};

export default VehicleNotRecognisedCard;
