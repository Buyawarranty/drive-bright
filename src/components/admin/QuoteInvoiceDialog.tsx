import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Download, FileText, Mail, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

import logoAsset from '@/assets/buyawarranty-logo.png.asset.json';

const VAT_RATE = 0.2;

const COMPANY = {
  name: 'Buy A Warranty',
  website: 'www.buyawarranty.co.uk',
  email: 'support@buyawarranty.co.uk',
  phone: '0330 229 5040',
  logoUrl: logoAsset.url,
  /** Absolute URL so the logo also renders inside emailed invoices. */
  logoAbsoluteUrl: `https://buyawarranty.co.uk${logoAsset.url}`,
  legalLine1:
    'Buyawarranty.co.uk is a trading name of Buy A Warranty Limited. Established 2016. Registered in the United Kingdom under Company number: 10314863.',
  legalLine2:
    'Registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England. VAT registration number 519 1099 85.',
};


/** Everything the invoice needs, pulled straight from the Step 2 quote. */
export interface QuoteInvoiceSource {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  address?: string;
  regNumber?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  mileage?: string | number;
  planName: string;
  durationLabel: string;
  claimLimit: number;
  excessAmount: number;
  labourRate: number;
  totalPrice: number;
  monthlyPrice?: number;
  addOns?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Live quote values — re-imported whenever the dialog opens or "Reload" is clicked. */
  source: QuoteInvoiceSource;
}

const gbp = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(
    Math.round(Number(n) || 0)
  );

const makeInvoiceNumber = (reg?: string) =>
  `INV-${format(new Date(), 'yyyyMMdd')}-${(reg || 'QUOTE').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7) || 'QUOTE'}`;

export const QuoteInvoiceDialog: React.FC<Props> = ({ open, onOpenChange, source }) => {
  const [form, setForm] = useState(() => hydrate(source));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  function hydrate(s: QuoteInvoiceSource) {
    return {
      invoiceNumber: makeInvoiceNumber(s.regNumber),
      invoiceDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      customerName: s.customerName || '',
      customerEmail: s.customerEmail || '',
      customerPhone: s.customerPhone || '',
      address: s.address || '',
      regNumber: s.regNumber || '',
      vehicle: [s.vehicleMake, s.vehicleModel].filter(Boolean).join(' ') + (s.vehicleYear ? ` (${s.vehicleYear})` : ''),
      planName: s.planName || '',
      durationLabel: s.durationLabel || '',
      claimLimit: String(s.claimLimit ?? ''),
      excessAmount: String(s.excessAmount ?? ''),
      labourRate: String(s.labourRate ?? ''),
      amount: String(Math.round(Number(s.totalPrice) || 0)),
      notes: s.addOns?.length ? `Add-ons included: ${s.addOns.join(', ')}` : '',
    };
  }

  // Always import the latest quote data when the dialog is opened.
  useEffect(() => {
    if (open) setForm(hydrate(source));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof ReturnType<typeof hydrate>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const invoiceHtml = buildInvoiceHtml(form);

  const handleDownload = () => {
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Pop-up blocked — allow pop-ups to export the PDF');
      return;
    }
    w.document.write(`${invoiceHtml}<script>window.onload=function(){window.print();}</script>`);
    w.document.close();
  };

  const handleSend = async () => {
    if (!form.customerEmail) {
      toast.error('Add a customer email address first');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          recipientEmail: form.customerEmail,
          subject: `Invoice ${form.invoiceNumber} — ${COMPANY.name}`,
          invoices: [
            {
              customerId: form.invoiceNumber,
              customerName: form.customerName,
              customerEmail: form.customerEmail,
              customerPhone: form.customerPhone,
              customerAddress: form.address,
              invoiceNumber: form.invoiceNumber,
              invoiceDate: form.invoiceDate,
              purchaseDate: form.invoiceDate,
              planType: form.planName,
              vehicleMake: source.vehicleMake || '',
              vehicleModel: source.vehicleModel || '',
              registrationPlate: form.regNumber,
              paymentType: form.durationLabel,
              amount: Number(form.amount) || 0,
              warrantyNumber: '',
              invoiceHtml,
            },
          ],
        },
      });
      if (error) throw error;
      toast.success(`Invoice emailed to ${form.customerEmail}`);
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('send invoice failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              Create invoice
            </DialogTitle>
            <DialogDescription>
              Imported from this quote — edit anything, then export as PDF or email it to the customer.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                <img src={COMPANY.logoUrl} alt="Buy A Warranty" className="h-8 w-auto" />
                <Button variant="outline" size="sm" onClick={() => setForm(hydrate(source))} className="gap-1">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reload from quote
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Invoice number" value={form.invoiceNumber} onChange={set('invoiceNumber')} />
                <Field label="Invoice date" type="date" value={form.invoiceDate} onChange={set('invoiceDate')} />
                <Field label="Payment due" type="date" value={form.dueDate} onChange={set('dueDate')} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Customer name" value={form.customerName} onChange={set('customerName')} />
                <Field label="Email" value={form.customerEmail} onChange={set('customerEmail')} />
                <Field label="Phone" value={form.customerPhone} onChange={set('customerPhone')} />
                <Field label="Registration" value={form.regNumber} onChange={set('regNumber')} />
                <div className="sm:col-span-2">
                  <Label className="text-xs">Address</Label>
                  <Textarea rows={2} value={form.address} onChange={set('address')} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Vehicle" value={form.vehicle} onChange={set('vehicle')} />
                <Field label="Plan" value={form.planName} onChange={set('planName')} />
                <Field label="Duration" value={form.durationLabel} onChange={set('durationLabel')} />
                <Field label="Claim limit (£)" value={form.claimLimit} onChange={set('claimLimit')} />
                <Field label="Voluntary excess (£)" value={form.excessAmount} onChange={set('excessAmount')} />
                <Field label="Labour rate (£/hr)" value={form.labourRate} onChange={set('labourRate')} />
                <Field label="Total amount (£)" value={form.amount} onChange={set('amount')} />
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={set('notes')} />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Export as PDF
            </Button>
            <Button onClick={() => setConfirmOpen(true)} className="gap-2 bg-orange-600 hover:bg-orange-700">
              <Mail className="h-4 w-4" />
              Send invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Please check the amounts before sending</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Confirm these are correct — the customer will see them on the invoice:</p>
                <ul className="space-y-1">
                  <li>Claim limit: <strong>{gbp(Number(form.claimLimit))}</strong></li>
                  <li>Voluntary excess: <strong>{gbp(Number(form.excessAmount))}</strong></li>
                  <li>Labour rate: <strong>{gbp(Number(form.labourRate))}/hr</strong></li>
                  <li>Duration: <strong>{form.durationLabel || '—'}</strong></li>
                  <li>Total amount: <strong>{gbp(Number(form.amount))}</strong></li>
                </ul>
                <p className="text-muted-foreground">Sending to {form.customerEmail || 'no email set'}.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Go back and edit</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              disabled={sending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {sending ? 'Sending…' : 'Amounts checked — send'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  type?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, value, type = 'text', onChange }) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <Input type={type} value={value} onChange={onChange} />
  </div>
);

function buildInvoiceHtml(f: ReturnType<QuoteInvoiceDialogHydrate>): string {
  const ukDate = (d: string) => (d ? format(new Date(d), 'dd/MM/yyyy') : '');
  const gross = Math.round(Number(f.amount) || 0);
  const net = Math.round(gross / (1 + VAT_RATE));
  const vat = gross - net;
  const amount = gbp(gross);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${f.invoiceNumber}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#333;padding:40px;max-width:800px;margin:0 auto;line-height:1.5}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:20px;margin-bottom:30px}
    .header img{max-width:190px}
    .co{text-align:right;font-size:12px;color:#666}
    h1{font-size:30px;color:#f97316;margin-bottom:18px}
    .meta{display:flex;gap:36px;margin-bottom:24px;font-size:13px}
    .meta strong{display:block;font-size:11px;color:#666;text-transform:uppercase}
    .bill{background:#f9fafb;border-radius:8px;padding:18px;margin-bottom:24px;font-size:13px}
    .bill h4{color:#f97316;font-size:13px;text-transform:uppercase;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    th{background:#f97316;color:#fff;padding:10px;text-align:left;font-size:12px;text-transform:uppercase}
    td{padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;vertical-align:top}
    .totals{display:flex;justify-content:flex-end;margin-bottom:30px}
    .totals div{background:#f9fafb;border-radius:8px;padding:18px;min-width:250px}
    .row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px}
    .grand{font-size:18px;font-weight:bold;color:#f97316;border-top:2px solid #f97316;padding-top:10px;margin-top:10px}
    .footer{text-align:center;font-size:11px;color:#666;border-top:1px solid #e5e7eb;padding-top:18px}
    .legal{font-size:10px;color:#777;line-height:1.6;margin-top:12px;text-align:center}
  </style></head><body>
  <div class="header">
    <img src="${COMPANY.logoAbsoluteUrl}" alt="${COMPANY.name}" />
    <div class="co"><strong>${COMPANY.name}</strong><br>${COMPANY.website}<br>${COMPANY.email}<br>${COMPANY.phone}</div>
  </div>
  <h1>INVOICE</h1>
  <div class="meta">
    <div><strong>Invoice number</strong>${f.invoiceNumber}</div>
    <div><strong>Invoice date</strong>${ukDate(f.invoiceDate)}</div>
    <div><strong>Payment due</strong>${ukDate(f.dueDate)}</div>
  </div>
  <div class="bill"><h4>Bill to</h4>
    <p><strong>${f.customerName || ''}</strong></p>
    <p>${f.address || ''}</p>
    <p>${f.customerEmail || ''}${f.customerPhone ? ` · ${f.customerPhone}` : ''}</p>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Cover details</th><th style="text-align:right">Amount (GBP)</th></tr></thead>
    <tbody><tr>
      <td><strong>Vehicle warranty — ${f.planName || ''}</strong><br>${f.vehicle || ''}<br>Reg: ${f.regNumber || 'N/A'}</td>
      <td>Duration: ${f.durationLabel || ''}<br>Claim limit: ${gbp(Number(f.claimLimit))}<br>Voluntary excess: ${gbp(Number(f.excessAmount))}<br>Labour rate: ${gbp(Number(f.labourRate))}/hr</td>
      <td style="text-align:right">${amount}</td>
    </tr></tbody>
  </table>
  <div class="totals"><div>
    <div class="row"><span>Subtotal (excl. VAT)</span><span>${gbp(net)}</span></div>
    <div class="row"><span>VAT (20%)</span><span>${gbp(vat)}</span></div>
    <div class="row grand"><span>Total (incl. VAT)</span><span>${amount}</span></div>
  </div></div>
  ${f.notes ? `<p style="font-size:12px;color:#555;margin-bottom:24px">${f.notes}</p>` : ''}
  <div class="footer">
    <p><strong>${COMPANY.name}</strong></p>
    <p>${COMPANY.website} · ${COMPANY.email} · ${COMPANY.phone}</p>
    <div class="legal"><p>${COMPANY.legalLine1}</p><p>${COMPANY.legalLine2}</p></div>
  </div>

  </body></html>`;
}

type QuoteInvoiceDialogHydrate = () => {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  regNumber: string;
  vehicle: string;
  planName: string;
  durationLabel: string;
  claimLimit: string;
  excessAmount: string;
  labourRate: string;
  amount: string;
  notes: string;
};

export default QuoteInvoiceDialog;
