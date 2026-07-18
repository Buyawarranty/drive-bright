import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, Send, Copy, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  amountPounds: number;
  description?: string;
  salesLeadId?: string | null;
  customerEmail?: string;
  customerPhone?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPostcode?: string;
  customerAddressLine1?: string;
  vehicleReg?: string;
}

export default function PaymentAssistPanel({
  amountPounds,
  description,
  salesLeadId,
  customerEmail,
  customerPhone,
  customerFirstName,
  customerLastName,
  customerPostcode,
  customerAddressLine1,
  vehicleReg,
}: Props) {
  const { toast } = useToast();
  const [amount, setAmount] = useState<number>(Math.round(amountPounds || 0));
  const [postcode, setPostcode] = useState<string>((customerPostcode || '').toUpperCase());
  const [addr1, setAddr1] = useState<string>(customerAddressLine1 || '');
  const [phone, setPhone] = useState<string>(customerPhone || '');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);

  // Keep fields in sync if parent updates the lead
  useEffect(() => {
    if (customerPhone && !phone) setPhone(customerPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone]);
  useEffect(() => {
    if (customerPostcode && !postcode) setPostcode(customerPostcode.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPostcode]);
  useEffect(() => {
    if (customerAddressLine1 && !addr1) setAddr1(customerAddressLine1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerAddressLine1]);


  const generate = async () => {
    if (!amount || amount < 25) {
      toast({ title: 'Enter a valid amount (min £25)', variant: 'destructive' });
      return;
    }
    if (!postcode.trim() || !addr1.trim()) {
      toast({ title: 'Address line 1 and postcode are required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setLink(null);
    try {
      const { data, error } = await supabase.functions.invoke('payment-assist-create-link', {
        body: {
          amount_pence: Math.round(amount * 100),
          description: description || 'Vehicle warranty',
          sales_lead_id: salesLeadId || null,
          customer_email: customerEmail || undefined,
          customer_phone: phone?.trim() || undefined,
          customer_first_name: customerFirstName || undefined,
          customer_last_name: customerLastName || undefined,
          customer_postcode: postcode.trim(),
          customer_address_line1: addr1.trim(),
          vehicle_reg: vehicleReg || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({
          title: 'Payment Assist rejected the request',
          description: String(data.error),
          variant: 'destructive',
        });
        return;
      }
      if (!data?.application_url) {
        toast({
          title: 'No application URL returned',
          description: 'Payment Assist responded without a link — check function logs.',
          variant: 'destructive',
        });
        return;
      }
      setLink(data.application_url);
      setReference(data.reference || null);
      toast({ title: 'Payment Assist link created' });
    } catch (err: any) {
      toast({
        title: 'Failed to create link',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast({ title: 'Link copied' });
  };

  const send = async () => {
    if (!link) return;
    if (!sendSms && !sendEmail) {
      toast({ title: 'Choose SMS, email, or both', variant: 'destructive' });
      return;
    }
    if (sendSms && !phone?.trim()) {
      toast({ title: 'Phone number required to send SMS', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const tasks: Promise<any>[] = [];
      const message = `Complete your Payment Assist finance application: ${link}`;
      if (sendSms && phone?.trim()) {
        tasks.push(
          supabase.functions.invoke('send-clicksend-sms', {
            body: { to: phone.trim(), message },
          }),
        );
      }
      if (sendEmail && customerEmail) {
        tasks.push(
          supabase.functions.invoke('send-email', {
            body: {
              to: customerEmail,
              subject: 'Your Payment Assist finance link',
              html: `<p>Hi${customerFirstName ? ' ' + customerFirstName : ''},</p>
                     <p>Please continue your finance application here:</p>
                     <p><a href="${link}">${link}</a></p>
                     <p>Amount: £${amount.toFixed(2)}</p>`,
            },
          }),
        );
      }
      if (tasks.length === 0) {
        toast({
          title: 'No delivery channel available',
          description: 'Customer email/phone is missing for the selected channels.',
          variant: 'destructive',
        });
        return;
      }
      await Promise.all(tasks);
      toast({ title: 'Link sent to customer' });
    } catch (err: any) {
      toast({
        title: 'Send failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-5 rounded-lg border-2 border-purple-200 bg-purple-50/50 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-purple-600" />
        <h4 className="font-semibold text-purple-900">Payment Assist</h4>
      </div>
      <p className="text-sm text-purple-700">
        Send the customer an interest-free instalment finance application link.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-purple-900">Amount (£)</Label>
          <Input
            type="number"
            min={25}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="bg-white"
          />
        </div>
        <div>
          <Label className="text-xs text-purple-900">Postcode *</Label>
          <Input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            placeholder="e.g. SW1A 1AA"
            className="bg-white"
          />
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-purple-900">Address line 1 *</Label>
          <Input
            value={addr1}
            onChange={(e) => setAddr1(e.target.value)}
            placeholder="House name/number and street"
            className="bg-white"
          />
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-purple-900">
            Mobile number {sendSms ? '*' : ''}
          </Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 07700 900123"
            className="bg-white"
          />
          {!phone?.trim() && sendSms && (
            <p className="text-xs text-red-600 mt-1">
              Required to send SMS — untick SMS below to skip.
            </p>
          )}
        </div>

        <div className="col-span-2">
          <Button
            onClick={generate}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
            ) : link ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Regenerate</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Generate link</>
            )}
          </Button>
        </div>
      </div>


      {link && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={link} className="bg-white text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copy}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          {reference && (
            <p className="text-xs text-purple-700">Reference: {reference}</p>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-purple-900">
              <Checkbox checked={sendSms} onCheckedChange={(v) => setSendSms(!!v)} />
              Send SMS
            </label>
            <label className="flex items-center gap-2 text-sm text-purple-900">
              <Checkbox
                checked={sendEmail}
                onCheckedChange={(v) => setSendEmail(!!v)}
                disabled={!customerEmail}
              />
              Send email {customerEmail ? '' : '(no email on file)'}
            </label>
          </div>

          <Button
            onClick={send}
            disabled={sending}
            className="w-full bg-purple-700 hover:bg-purple-800 text-white"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Send to customer</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
