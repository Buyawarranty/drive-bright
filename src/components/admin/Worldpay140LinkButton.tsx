import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Copy, Check, Loader2, Link2, Send } from 'lucide-react';
import { invokeWithFreshSession } from '@/lib/invokeWithFreshSession';
import { useToast } from '@/hooks/use-toast';

const FEE = 140;

/**
 * Global £140 Worldpay pay-by-link generator.
 * Available to every admin dashboard role (admin, super_admin, sales/claims staff)
 * so anyone can create the link and copy/share it with the customer.
 */
export const Worldpay140LinkButton: React.FC<{ className?: string; label?: string }> = ({
  className,
  label = 'Worldpay £140 link',
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithFreshSession('worldpay-create-payment-page', {
        flow: 'link',
        amount_pence: FEE * 100,
        description: reference.trim()
          ? `Independent inspection fee — ${reference.trim()}`.slice(0, 200)
          : 'Independent inspection fee (£140)',
        customer_email: email.trim() || null,
        customer_phone: phone.trim() || null,
      });
      if (error) throw error;
      const payUrl = (data as any)?.payment_url;
      if (!payUrl) throw new Error('Worldpay returned no payment URL');
      setUrl(payUrl);
      toast({ title: 'Payment link created', description: 'Copy the link and send it to the customer.' });
    } catch (err: any) {
      console.error('Worldpay £140 link error', err);
      toast({ title: 'Could not create link', description: err?.message || 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reset = () => {
    setUrl(null);
    setReference('');
    setPhone('');
    setEmail('');
  };

  const shareText = `Hi, please pay the £${FEE} independent inspection fee securely here: ${url}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <CreditCard className="h-4 w-4 mr-1.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> £{FEE} Worldpay payment link
          </DialogTitle>
          <DialogDescription>
            Generate a secure Worldpay link for the £{FEE} independent inspection fee, then copy it and send it to the
            customer by email, SMS or WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {!url ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="wp140-ref">Reference (customer name or registration)</Label>
              <Input
                id="wp140-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. J Smith · AB12 CDE"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wp140-email">Customer email (optional)</Label>
                <Input id="wp140-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" />
              </div>
              <div>
                <Label htmlFor="wp140-phone">Customer phone (optional)</Label>
                <Input id="wp140-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Amount is fixed at £{FEE}.00. The fee is paid to the independent inspection company.
            </div>
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
              Generate £{FEE} payment link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Payment link</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button variant="outline" onClick={copy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {phone.trim() && (
                <a
                  className="inline-flex items-center gap-1 underline text-primary"
                  href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noreferrer nofollow"
                >
                  <Send className="h-3 w-3" /> Send via WhatsApp
                </a>
              )}
              <a
                className="inline-flex items-center gap-1 underline text-primary"
                href={`mailto:${email.trim()}?subject=${encodeURIComponent(`£${FEE} independent inspection fee`)}&body=${encodeURIComponent(shareText)}`}
              >
                <Send className="h-3 w-3" /> Send by email
              </a>
              <button className="ml-auto underline text-muted-foreground" onClick={reset}>
                New link
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Worldpay140LinkButton;
