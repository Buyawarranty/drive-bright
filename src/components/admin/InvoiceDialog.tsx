import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { FileText, Send, Download, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  flat_number?: string;
  building_name?: string;
  building_number?: string;
  street?: string;
  town?: string;
  county?: string;
  postcode?: string;
  country?: string;
  final_amount: number;
  plan_type: string;
  payment_type?: string;
  registration_plate?: string;
  warranty_number?: string;
  signup_date: string;
  vehicle_make?: string;
  vehicle_model?: string;
}

interface InvoiceDialogProps {
  customers: Customer[];
  selectedCustomerIds: string[];
  onComplete?: () => void;
}

const COMPANY_INFO = {
  name: 'Buy A Warranty',
  website: 'www.buyawarranty.co.uk',
  email: 'support@buyawarranty.co.uk',
  phone: '0330 229 5040',
  address: ['Buy A Warranty', 'Online', 'United Kingdom'],
  logoUrl: 'https://buyawarranty.co.uk/lovable-uploads/e4a0c8c7-1d74-4e55-a556-1b513ba12cc8.png'
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount || 0);
};

const formatUKDate = (date: string | Date): string => {
  return format(new Date(date), 'dd/MM/yyyy');
};

const generateInvoiceNumber = (customerId: string): string => {
  const today = new Date();
  const dateStr = format(today, 'yyyyMMdd');
  const shortId = customerId.slice(0, 6).toUpperCase();
  return `INV-${dateStr}-${shortId}`;
};

const getFullAddress = (customer: Customer): string => {
  const parts = [
    customer.flat_number && `Flat ${customer.flat_number}`,
    customer.building_name,
    customer.building_number,
    customer.street,
    customer.town,
    customer.county,
    customer.postcode,
    customer.country || 'United Kingdom'
  ].filter(Boolean);
  return parts.join(', ') || 'Address not provided';
};

// Generate HTML invoice for a single customer
const generateInvoiceHTML = (customer: Customer): string => {
  const invoiceNumber = generateInvoiceNumber(customer.id);
  const invoiceDate = formatUKDate(new Date());
  const fullAddress = getFullAddress(customer);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoiceNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; padding: 40px; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #f97316; padding-bottom: 20px; }
        .logo-section img { max-width: 200px; height: auto; }
        .company-details { text-align: right; font-size: 12px; color: #666; }
        .company-details h3 { color: #333; font-size: 14px; margin-bottom: 8px; }
        .invoice-title { font-size: 32px; color: #f97316; font-weight: bold; margin-bottom: 20px; }
        .invoice-meta { display: flex; gap: 40px; margin-bottom: 30px; }
        .meta-item { font-size: 13px; }
        .meta-item strong { display: block; color: #666; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }
        .bill-to { margin-bottom: 30px; padding: 20px; background: #f9fafb; border-radius: 8px; }
        .bill-to h4 { color: #f97316; font-size: 14px; margin-bottom: 12px; text-transform: uppercase; }
        .bill-to p { font-size: 13px; margin: 4px 0; }
        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .invoice-table th { background: #f97316; color: white; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
        .invoice-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        .invoice-table tr:nth-child(even) { background: #f9fafb; }
        .total-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
        .total-box { background: #f9fafb; padding: 20px; border-radius: 8px; min-width: 250px; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
        .total-row.grand-total { font-size: 18px; font-weight: bold; color: #f97316; border-top: 2px solid #f97316; padding-top: 12px; margin-top: 12px; }
        .footer { text-align: center; font-size: 11px; color: #666; border-top: 1px solid #e5e7eb; padding-top: 20px; }
        .footer p { margin: 4px 0; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          <img src="${COMPANY_INFO.logoUrl}" alt="Buy A Warranty" />
        </div>
        <div class="company-details">
          <h3>${COMPANY_INFO.name}</h3>
          <p>${COMPANY_INFO.website}</p>
          <p>${COMPANY_INFO.email}</p>
          <p>${COMPANY_INFO.phone}</p>
          <p>${COMPANY_INFO.address.join(', ')}</p>
        </div>
      </div>
      
      <h1 class="invoice-title">INVOICE</h1>
      
      <div class="invoice-meta">
        <div class="meta-item">
          <strong>Invoice Number</strong>
          ${invoiceNumber}
        </div>
        <div class="meta-item">
          <strong>Invoice Date</strong>
          ${invoiceDate}
        </div>
        <div class="meta-item">
          <strong>Purchase Date</strong>
          ${formatUKDate(customer.signup_date)}
        </div>
      </div>
      
      <div class="bill-to">
        <h4>Bill To</h4>
        <p><strong>${customer.name}</strong></p>
        <p>${fullAddress}</p>
        <p>Email: ${customer.email}</p>
        ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ''}
      </div>
      
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Details</th>
            <th style="text-align: right;">Amount (GBP)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Vehicle Warranty</strong></td>
            <td>
              ${customer.plan_type || 'Platinum'} Plan<br>
              ${customer.vehicle_make || ''} ${customer.vehicle_model || ''}<br>
              Reg: ${customer.registration_plate || 'N/A'}<br>
              Duration: ${customer.payment_type === '36months' ? '3 Years' : customer.payment_type === '24months' ? '2 Years' : '1 Year'}
            </td>
            <td style="text-align: right;">${formatCurrency(customer.final_amount)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="total-section">
        <div class="total-box">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${formatCurrency(customer.final_amount)}</span>
          </div>
          <div class="total-row">
            <span>VAT (0%)</span>
            <span>£0.00</span>
          </div>
          <div class="total-row grand-total">
            <span>Total Paid</span>
            <span>${formatCurrency(customer.final_amount)}</span>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p><strong>Thank you for your purchase!</strong></p>
        <p>This invoice is issued in UK format (GBP, DD/MM/YYYY).</p>
        <p>If you have any questions, please contact us at ${COMPANY_INFO.email}</p>
        <p style="margin-top: 12px; color: #999;">Warranty Reference: ${customer.warranty_number || 'Pending'}</p>
      </div>
    </body>
    </html>
  `;
};

export const InvoiceDialog: React.FC<InvoiceDialogProps> = ({
  customers,
  selectedCustomerIds,
  onComplete
}) => {
  const [open, setOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [selectedForInvoice, setSelectedForInvoice] = useState<Set<string>>(new Set(selectedCustomerIds));
  const [sending, setSending] = useState(false);
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);
  const printRef = useRef<HTMLIFrameElement>(null);

  const selectedCustomers = customers.filter(c => selectedForInvoice.has(c.id));

  const handleSelectAll = () => {
    if (selectedForInvoice.size === selectedCustomerIds.length) {
      setSelectedForInvoice(new Set());
    } else {
      setSelectedForInvoice(new Set(selectedCustomerIds));
    }
  };

  const handleToggleCustomer = (customerId: string) => {
    const newSelected = new Set(selectedForInvoice);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedForInvoice(newSelected);
  };

  const handleDownloadInvoice = (customer: Customer) => {
    const html = generateInvoiceHTML(customer);
    const invoiceNumber = generateInvoiceNumber(customer.id);
    
    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleDownloadAll = () => {
    selectedCustomers.forEach((customer, index) => {
      setTimeout(() => {
        handleDownloadInvoice(customer);
      }, index * 500);
    });
    toast.success(`Opening ${selectedCustomers.length} invoice(s) for download`);
  };

  const handleSendInvoices = async () => {
    if (!emailAddress.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    if (selectedCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    setSending(true);
    try {
      // Generate invoice data for each customer
      const invoiceData = selectedCustomers.map(customer => ({
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone || '',
        customerAddress: getFullAddress(customer),
        invoiceNumber: generateInvoiceNumber(customer.id),
        invoiceDate: formatUKDate(new Date()),
        purchaseDate: formatUKDate(customer.signup_date),
        planType: customer.plan_type || 'Platinum',
        vehicleMake: customer.vehicle_make || '',
        vehicleModel: customer.vehicle_model || '',
        registrationPlate: customer.registration_plate || 'N/A',
        paymentType: customer.payment_type || 'yearly',
        amount: customer.final_amount || 0,
        warrantyNumber: customer.warranty_number || 'Pending',
        invoiceHtml: generateInvoiceHTML(customer)
      }));

      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          recipientEmail: emailAddress.trim(),
          invoices: invoiceData,
          subject: `Invoice${selectedCustomers.length > 1 ? 's' : ''} from Buy A Warranty - ${formatUKDate(new Date())}`
        }
      });

      if (error) throw error;

      toast.success(`Invoice${selectedCustomers.length > 1 ? 's' : ''} sent successfully to ${emailAddress}`);
      setOpen(false);
      onComplete?.();
    } catch (error: any) {
      console.error('Error sending invoices:', error);
      toast.error(`Failed to send invoices: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const eligibleCustomers = customers.filter(c => selectedCustomerIds.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <FileText className="h-3 w-3 mr-1" />
          Generate Invoices ({selectedCustomerIds.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-600" />
            Generate & Send Invoices
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="invoice-email">Send invoices to email address</Label>
            <div className="flex gap-2">
              <Input
                id="invoice-email"
                type="email"
                placeholder="Enter email address..."
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Customer Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select customers ({selectedForInvoice.size} selected)</Label>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedForInvoice.size === eligibleCustomers.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <ScrollArea className="h-[300px] border rounded-md p-2">
              <div className="space-y-2">
                {eligibleCustomers.map(customer => (
                  <div
                    key={customer.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      selectedForInvoice.has(customer.id) 
                        ? 'bg-orange-50 border-orange-200' 
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedForInvoice.has(customer.id)}
                        onCheckedChange={() => handleToggleCustomer(customer.id)}
                      />
                      <div>
                        <p className="font-medium text-sm">{customer.name}</p>
                        <p className="text-xs text-gray-500">{customer.email}</p>
                        <p className="text-xs text-gray-400">
                          {customer.registration_plate || 'No reg'} • {customer.plan_type || 'Platinum'} • {formatCurrency(customer.final_amount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewCustomer(customer)}
                        className="text-xs"
                      >
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadInvoice(customer)}
                        className="text-xs"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Preview Panel */}
          {previewCustomer && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <Label>Invoice Preview - {previewCustomer.name}</Label>
                <Button variant="ghost" size="sm" onClick={() => setPreviewCustomer(null)}>
                  Close Preview
                </Button>
              </div>
              <div className="bg-white rounded border overflow-hidden">
                <iframe
                  ref={printRef}
                  srcDoc={generateInvoiceHTML(previewCustomer)}
                  className="w-full h-[400px] border-0"
                  title="Invoice Preview"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              onClick={handleDownloadAll}
              disabled={selectedForInvoice.size === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download All ({selectedForInvoice.size})
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSendInvoices}
                disabled={sending || !emailAddress.trim() || selectedForInvoice.size === 0}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send {selectedForInvoice.size} Invoice{selectedForInvoice.size > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDialog;
