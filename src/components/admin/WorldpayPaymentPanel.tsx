import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, Link2, Copy, Check, Loader2, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  amountPounds: number;
  description?: string;
  salesLeadId?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}

type WorldpayResponse = {
  transaction_id: string;
  transaction_reference: string;
  payment_url: string;
  environment: 'sandbox' | 'live';
};

const WorldpayPaymentPanel: React.FC<Props> = ({
  amountPounds,
  description,
  salesLeadId,
  customerId,
  customerEmail,
  customerPhone,
}) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>(String(amountPounds || 0));
  const [desc, setDesc] = useState<string>(description || 'Vehicle warranty payment');
  const [tab, setTab] = useState<'moto' | 'link'>('moto');
  const [loading, setLoading] = useState<null | 'moto' | 'link'>(null);
  const [result, setResult] = useState<Record<'moto' | 'link', WorldpayResponse | null>>({ moto: null, link: null });
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string>('');
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    setAmount(String(amountPounds || 0));
  }, [amountPounds]);

  const cleanupPoll = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => cleanupPoll, []);

  const create = async (flow: 'moto' | 'link') => {
    const pounds = Number(amount);
    if (!pounds || pounds <= 0) {
      toast({ title: 'Enter an amount', variant: 'destructive' });
      return;
    }
    setLoading(flow);
    setStatus('');
    try {
      const { data, error } = await supabase.functions.invoke('worldpay-create-payment-page', {
        body: {
          flow,
          amount_pence: Math.round(pounds * 100),
          description: desc || 'Vehicle warranty payment',
          sales_lead_id: salesLeadId || null,
          customer_id: customerId || null,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
        },
      });
      if (error) throw error;
      const res = data as WorldpayResponse;
      setResult((r) => ({ ...r, [flow]: res }));
      setStatus('pending');
      startPolling(res.transaction_id);
      toast({ title: flow === 'moto' ? 'Virtual terminal ready' : 'Payment link created' });
    } catch (err: any) {
      console.error('Worldpay error', err);
      toast({ title: 'Worldpay error', description: err?.message || 'Failed', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const startPolling = (transactionId: string) => {
    cleanupPoll();
    pollRef.current = window.setInterval(async () => {
      const { data } = await supabase
        .from('worldpay_transactions')
        .select('status')
        .eq('id', transactionId)
        .single();
      if (data?.status && data.status !== 'pending') {
        setStatus(data.status);
        cleanupPoll();
      }
    }, 4000);
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const active = result[tab];

  return (
    <div className="p-5 rounded-lg border-2 border-red-200 bg-red-50/60 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-red-600" />
        <h4 className="font-semibold text-red-900">Worldpay</h4>
        <span className="ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
          Sandbox
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Amount (£)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} className="h-9" maxLength={200} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'moto' | 'link')}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="moto">
            <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Virtual terminal
          </TabsTrigger>
          <TabsTrigger value="link">
            <Link2 className="w-3.5 h-3.5 mr-1.5" /> Pay by link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="moto" className="space-y-3 pt-3">
          <p className="text-xs text-red-800">
            Agent takes the card on the phone. Worldpay's hosted card form opens below — nothing is typed into our servers (PCI-safe).
          </p>
          {!active && (
            <Button
              disabled={loading === 'moto'}
              onClick={() => create('moto')}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {loading === 'moto' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Open card form
            </Button>
          )}
          {active && (
            <div className="space-y-2">
              <iframe
                src={active.payment_url}
                title="Worldpay virtual terminal"
                className="w-full h-[520px] rounded border border-red-200 bg-white"
              />
              <div className="flex items-center gap-2 text-xs text-red-800">
                <RefreshCw className={`w-3 h-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
                Status: <strong className="font-mono">{status || 'pending'}</strong>
                <button
                  className="ml-auto underline"
                  onClick={() => { setResult((r) => ({ ...r, moto: null })); cleanupPoll(); setStatus(''); }}
                >
                  Start again
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="link" className="space-y-3 pt-3">
          <p className="text-xs text-red-800">
            Generates a hosted Worldpay payment link. Copy and send to the customer via SMS, email or WhatsApp.
          </p>
          {!active && (
            <Button
              disabled={loading === 'link'}
              onClick={() => create('link')}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {loading === 'link' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
              Generate payment link
            </Button>
          )}
          {active && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input readOnly value={active.payment_url} className="h-9 font-mono text-xs" />
                <Button variant="outline" onClick={() => copy(active.payment_url)}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              {customerPhone && (
                <a
                  className="inline-flex items-center gap-1 text-xs text-red-700 underline"
                  href={`https://wa.me/${customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, please pay £${amount} securely here: ${active.payment_url}`)}`}
                  target="_blank" rel="noreferrer"
                >
                  <Send className="w-3 h-3" /> Send via WhatsApp
                </a>
              )}
              <div className="flex items-center gap-2 text-xs text-red-800">
                <RefreshCw className={`w-3 h-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
                Status: <strong className="font-mono">{status || 'pending'}</strong>
                <button
                  className="ml-auto underline"
                  onClick={() => { setResult((r) => ({ ...r, link: null })); cleanupPoll(); setStatus(''); }}
                >
                  New link
                </button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorldpayPaymentPanel;
