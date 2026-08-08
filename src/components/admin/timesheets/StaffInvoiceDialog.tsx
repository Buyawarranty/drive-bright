import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface LineItem {
  description: string;
  amount: string;
}

interface StaffInvoiceDialogProps {
  currentMonth: Date;
  defaultName?: string;
}

const COMPANY_NAME = 'Buy A Warranty Limited.';
const COMPANY_ADDRESS = 'Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England';

const esc = (v: string) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function StaffInvoiceDialog({ currentMonth, defaultName = '' }: StaffInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [invoiceNo, setInvoiceNo] = useState(`INV-${format(new Date(), 'yyyyMM')}-001`);
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueTerms, setDueTerms] = useState('30 days from invoice date');
  const [servicePeriod, setServicePeriod] = useState(format(currentMonth, 'MMMM yyyy'));
  const [items, setItems] = useState<LineItem[]>([
    { description: 'Inbound / outbound sales calls', amount: '' },
  ]);
  const [bankDetails, setBankDetails] = useState(
    'Account holder:\nSort code:\nAccount number:\nBank name:\nBank address:'
  );
  const [notes, setNotes] = useState('');

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
    [items]
  );

  const money = (n: number) =>
    `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP`;

  const updateItem = (idx: number, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const buildHTML = () => {
    const rows = items
      .filter((i) => i.description.trim() || i.amount)
      .map(
        (i, idx) => `<tr style="background:${idx % 2 ? '#ffffff' : '#eef1f6'}">
          <td style="padding:12px 16px">${esc(i.description)}</td>
          <td style="padding:12px 16px;text-align:right;white-space:nowrap">${money(parseFloat(i.amount) || 0)}</td>
        </tr>`
      )
      .join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>${esc(invoiceNo)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color:#1b2333; margin:0; }
  .muted { color:#6b7280; }
  h1 { font-size:56px; letter-spacing:1px; margin:24px 0 0; color:#14213d; }
  .rule { border-top:3px solid #14213d; margin:12px 0 0; }
  .thin { border-top:1px solid #d7dbe3; margin:28px 0; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  .head td { background:#14213d; color:#fff; font-weight:bold; padding:14px 16px; }
  .totalrow td { background:#14213d; color:#fff; font-weight:bold; padding:14px 16px; }
  .label { font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#6b7280; font-family:Arial,Helvetica,sans-serif; }
  .from { background:#eef1f6; border-left:3px solid #14213d; padding:16px 18px; }
</style></head><body>
  <table style="font-size:14px"><tr>
    <td style="vertical-align:top">
      <div style="font-weight:bold">${esc(name || 'Service Provider')}</div>
      <div class="muted">Service Provider</div>
    </td>
    <td style="vertical-align:top;text-align:right">
      <div><span class="muted">Invoice No.</span> <strong>${esc(invoiceNo)}</strong></div>
      <div class="muted">Date: ${invoiceDate ? format(new Date(invoiceDate), 'dd / MM / yyyy') : ''}</div>
      <div class="muted">Due: ${esc(dueTerms)}</div>
    </td>
  </tr></table>
  <div class="rule"></div>
  <h1>INVOICE</h1>
  <div class="thin"></div>

  <table><tr>
    <td style="vertical-align:top;width:55%">
      <div class="label">Invoice to</div>
      <div style="margin-top:10px">${COMPANY_NAME}</div>
      <div>${COMPANY_ADDRESS}</div>
    </td>
    <td style="width:4%"></td>
    <td style="vertical-align:top" class="from">
      <div class="label">From</div>
      <div style="margin-top:10px">${esc(name || '—')}</div>
      <div>Service period: ${esc(servicePeriod)}</div>
      <div>Currency: GBP</div>
    </td>
  </tr></table>

  <div style="margin-top:32px" class="label">Services provided</div>
  <table style="margin-top:10px">
    <tr class="head"><td>Description of services</td><td style="text-align:right">Amount</td></tr>
    ${rows}
    <tr><td style="padding:14px 16px;text-align:right" class="muted">Subtotal</td>
        <td style="padding:14px 16px;text-align:right">${money(total)}</td></tr>
    <tr class="totalrow"><td style="text-align:right">TOTAL DUE</td>
        <td style="text-align:right">${money(total)}</td></tr>
  </table>

  <div class="thin"></div>
  <div class="label">Payment details</div>
  <div style="margin-top:10px;white-space:pre-line;font-size:14px">${esc(bankDetails)}</div>
  ${notes ? `<div style="margin-top:24px;white-space:pre-line;font-size:14px">${esc(notes)}</div>` : ''}
  <div style="margin-top:48px;text-align:center;font-style:italic" class="muted">Thank you for your business.</div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;
  };

  const handleDownload = () => {
    if (!name.trim()) {
      toast.error('Add your name before downloading');
      return;
    }
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Pop-up blocked — allow pop-ups to download the invoice');
      return;
    }
    win.document.write(buildHTML());
    win.document.close();
    toast.success('Print dialog opened — save as PDF');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Your full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name Surname" />
            </div>
            <div>
              <Label>Invoice number</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </div>
            <div>
              <Label>Invoice date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <Label>Payment terms</Label>
              <Input value={dueTerms} onChange={(e) => setDueTerms(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Service period</Label>
              <Input value={servicePeriod} onChange={(e) => setServicePeriod(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Services provided</Label>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  className="flex-1"
                  value={item.description}
                  placeholder="Description"
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                />
                <Input
                  className="w-32"
                  type="number"
                  step="0.01"
                  value={item.amount}
                  placeholder="0.00"
                  onChange={(e) => updateItem(idx, { amount: e.target.value })}
                />
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, { description: '', amount: '' }])}
            >
              Add line
            </Button>
          </div>

          <div className="text-right text-lg font-semibold">
            Total due: £{total.toFixed(2)} GBP
          </div>

          <div>
            <Label>Payment details</Label>
            <Textarea rows={5} value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleDownload} className="gap-2">
            <Printer className="h-4 w-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StaffInvoiceDialog;
