import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ShieldCheck, CheckCircle2, Clock, Gavel, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface InspectionRequest {
  id: string;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string | null;
  vehicle_registration: string | null;
  claim_reason: string | null;
  inspection_company: string;
  fee_amount: number;
  status: string;
  paid_at: string | null;
  garage_name: string | null;
  garage_contact: string | null;
  garage_phone: string | null;
  garage_address: string | null;
  vehicle_location: string | null;
  current_mileage: number | null;
  availability_notes: string | null;
  additional_notes: string | null;
}

const IndependentInspection: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const paidFlag = searchParams.get('paid') === '1';
  const sessionId = searchParams.get('session_id');
  const cancelled = searchParams.get('cancelled') === '1';

  const [request, setRequest] = useState<InspectionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({
    garageName: '',
    garageContact: '',
    garagePhone: '',
    garageAddress: '',
    vehicleLocation: '',
    currentMileage: '',
    availabilityNotes: '',
    additionalNotes: '',
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-inspection-request', {
        body: { token },
      });
      if (fnError || !data?.request) {
        setError('This link is invalid or has expired.');
      } else {
        const r = data.request as InspectionRequest;
        setRequest(r);
        setForm((f) => ({
          ...f,
          garageName: r.garage_name || '',
          garageContact: r.garage_contact || '',
          garagePhone: r.garage_phone || '',
          garageAddress: r.garage_address || '',
          vehicleLocation: r.vehicle_location || '',
          currentMileage: r.current_mileage ? String(r.current_mileage) : '',
          availabilityNotes: r.availability_notes || '',
          additionalNotes: r.additional_notes || '',
        }));
      }
    } catch {
      setError('Something went wrong loading your inspection request.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Confirm payment on return from Stripe
  useEffect(() => {
    if (!paidFlag || !sessionId || !token) return;
    (async () => {
      await supabase.functions.invoke('confirm-inspection-payment', { body: { token, sessionId } });
      await load();
    })();
  }, [paidFlag, sessionId, token, load]);

  const submit = async () => {
    if (!accepted) {
      toast.error('Please confirm you accept the inspection terms');
      return;
    }
    if (!form.garageName.trim() || !form.garagePhone.trim() || !form.garageAddress.trim()) {
      toast.error('Please give us the garage name, phone number and address');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('submit-inspection-request', {
        body: { token, ...form, acceptedTerms: true },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      throw new Error(data?.error || 'Could not start payment');
    } catch (err: any) {
      toast.error(err?.message || 'Could not start payment. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <h1 className="text-lg font-semibold text-foreground">Link unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">Please call us on 0330 229 5045 and we'll help.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = Boolean(request.paid_at) || request.status === 'paid';
  const fee = Number(request.fee_amount || 140);

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Independent inspection</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {request.vehicle_registration ? `${request.vehicle_registration.toUpperCase()} · ` : ''}
            Fee £{fee.toFixed(2)}
          </p>
        </div>

        {isPaid ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">Payment received — thank you</h2>
              <p className="text-sm text-muted-foreground">
                Your inspection has been booked with <strong>{request.inspection_company}</strong>. They will contact the
                garage directly to arrange a visit. Inspections take on average 7 to 14 working days.
              </p>
              <p className="text-sm text-muted-foreground">
                We'll be in touch as soon as the engineer's report is available.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {cancelled && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Payment was cancelled. Your details are saved — you can pay whenever you're ready.
              </div>
            )}

            <Card>
              <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <p>
                    Your inspection will be carried out by <strong className="text-foreground">{request.inspection_company}</strong>,
                    an independent engineering firm. The firm is assigned by us based on availability in your area.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <p>Inspections take on average <strong className="text-foreground">7 to 14 working days</strong> to complete.</p>
                </div>
                <div className="flex gap-3">
                  <Gavel className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <p>
                    The engineer's findings are the <strong className="text-foreground">full and final decision</strong> on this
                    claim and are binding on both you and Buy a Warranty.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-base font-semibold text-foreground">Where is the vehicle?</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="garageName">Garage name *</Label>
                    <Input id="garageName" value={form.garageName} onChange={(e) => setForm({ ...form, garageName: e.target.value })} placeholder="e.g. Smith's Autos" />
                  </div>
                  <div>
                    <Label htmlFor="garagePhone">Garage phone *</Label>
                    <Input id="garagePhone" value={form.garagePhone} onChange={(e) => setForm({ ...form, garagePhone: e.target.value })} placeholder="01234 567890" />
                  </div>
                  <div>
                    <Label htmlFor="garageContact">Contact at garage</Label>
                    <Input id="garageContact" value={form.garageContact} onChange={(e) => setForm({ ...form, garageContact: e.target.value })} placeholder="Name of the person to ask for" />
                  </div>
                  <div>
                    <Label htmlFor="currentMileage">Current mileage</Label>
                    <Input id="currentMileage" inputMode="numeric" value={form.currentMileage} onChange={(e) => setForm({ ...form, currentMileage: e.target.value.replace(/[^0-9]/g, '') })} placeholder="e.g. 84500" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="garageAddress">Garage address *</Label>
                  <Textarea id="garageAddress" rows={2} value={form.garageAddress} onChange={(e) => setForm({ ...form, garageAddress: e.target.value })} placeholder="Street, town, postcode" />
                </div>

                <div>
                  <Label htmlFor="vehicleLocation">Anything the engineer needs to know to find the vehicle?</Label>
                  <Input id="vehicleLocation" value={form.vehicleLocation} onChange={(e) => setForm({ ...form, vehicleLocation: e.target.value })} placeholder="e.g. Vehicle in rear workshop, ask at reception" />
                </div>

                <div>
                  <Label htmlFor="availabilityNotes">Best days or times for the inspection</Label>
                  <Input id="availabilityNotes" value={form.availabilityNotes} onChange={(e) => setForm({ ...form, availabilityNotes: e.target.value })} placeholder="e.g. Weekday mornings" />
                </div>

                <div>
                  <Label htmlFor="additionalNotes">Anything else about the fault</Label>
                  <Textarea id="additionalNotes" rows={3} value={form.additionalNotes} onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })} placeholder="Optional" />
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <Checkbox id="accept" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                  <Label htmlFor="accept" className="text-sm font-normal leading-relaxed cursor-pointer">
                    I understand the inspection is completed by {request.inspection_company} (assigned by Buy a Warranty),
                    takes on average 7 to 14 working days, and I accept the engineer's findings as the full and final
                    decision on this claim.
                  </Label>
                </div>

                <Button onClick={submit} disabled={submitting} className="w-full h-12 text-base">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Continue to secure payment · £${fee.toFixed(2)}`}
                </Button>
                <p className="text-xs text-center text-muted-foreground">Card payments handled securely by Stripe.</p>
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Buy a Warranty Claims Department · 0330 229 5045 · claims@buyawarranty.co.uk
        </p>
      </div>
    </div>
  );
};

export default IndependentInspection;
