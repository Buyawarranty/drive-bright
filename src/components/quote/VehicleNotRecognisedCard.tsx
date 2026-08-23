import React, { useState } from 'react';
import { Phone, PhoneCall, ShieldAlert, ShieldCheck, Clock, CheckCircle2, Loader2 } from 'lucide-react';
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
 * let the customer leave their number there and then. Either way the number
 * creates a new lead for the sales team.
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
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 text-left shadow-sm animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-orange-50">
          <ShieldAlert className="h-5 w-5 text-brand-orange" strokeWidth={2.5} />
        </span>
        <div>
          <p className="text-base sm:text-lg font-bold text-brand-blue">{headline}</p>
          <p className="mt-1 text-sm text-gray-500 leading-relaxed">{detail}</p>
          {regNumber && (
            <p className="mt-1 text-sm text-gray-500">
              Registration entered:{' '}
              <span className="font-bold text-brand-blue">{regNumber.toUpperCase()}</span>
            </p>
          )}
        </div>
      </div>

      {submitted ? (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" strokeWidth={2.5} />
          <p className="text-sm font-semibold text-green-800">
            Got it — a warranty specialist will call you {isOpenNow ? 'shortly' : nextOpeningLabel()} to confirm your
            vehicle and give you the price.
          </p>
        </div>
      ) : (
        <>
          {isOpenNow ? (
            <Button
              asChild
              className="h-12 w-full rounded-xl bg-brand-orange text-base font-bold text-white hover:bg-orange-700"
            >
              <a href={SALES_PHONE_TEL} className="flex items-center justify-center gap-2">
                <Phone className="h-5 w-5" strokeWidth={2.5} />
                Call {SALES_PHONE}
              </a>
            </Button>
          ) : (
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-blue">
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
              className="h-12 flex-1 rounded-xl border-gray-300 bg-white text-brand-blue placeholder:text-gray-400"
            />
            <Button
              type="submit"
              disabled={submitting}
              className={
                isOpenNow
                  ? 'h-12 rounded-xl border-2 border-gray-200 bg-white font-bold text-brand-blue hover:bg-gray-50'
                  : 'h-12 rounded-xl bg-brand-orange font-bold text-white hover:bg-orange-700'
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
          {onRequestCallback && (
            <button
              type="button"
              onClick={onRequestCallback}
              className="text-xs font-semibold text-brand-blue underline"
            >
              Prefer to give us more details? Request a callback
            </button>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
          {openingHoursLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
          Quick and secure
        </span>
      </div>
    </div>
  );
};

export default VehicleNotRecognisedCard;
