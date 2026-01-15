import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X } from 'lucide-react';
import { format } from 'date-fns';

interface PolicyDetails {
  customerName: string;
  customerEmail?: string;
  customerAddress?: {
    flatNumber?: string;
    buildingName?: string;
    buildingNumber?: string;
    street?: string;
    town?: string;
    county?: string;
    postcode?: string;
    country?: string;
  };
  vehicleReg: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  mileage?: string;
  warrantyNumber: string;
  policyNumber: string;
  planType: string;
  policyStartDate: string;
  policyEndDate: string;
  claimLimit?: number;
  voluntaryExcess?: number;
}

interface PrintableWarrantyLetterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: PolicyDetails;
}

export const PrintableWarrantyLetter: React.FC<PrintableWarrantyLetterProps> = ({
  open,
  onOpenChange,
  policy,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the letter');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Warranty Confirmation - ${policy.warrantyNumber}</title>
          <style>
            @page { 
              size: A4; 
              margin: 20mm; 
            }
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              color: #1a1a1a;
              line-height: 1.6;
              margin: 0;
              padding: 0;
              background: white;
            }
            .letter-container {
              max-width: 210mm;
              margin: 0 auto;
              padding: 0;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid #eb4b00;
            }
            .logo {
              height: 50px;
            }
            .company-info {
              text-align: right;
              font-size: 11px;
              color: #666;
            }
            .company-info p {
              margin: 2px 0;
            }
            .date-section {
              text-align: right;
              margin-bottom: 30px;
              font-size: 12px;
              color: #666;
            }
            .customer-address {
              margin-bottom: 30px;
              font-size: 13px;
            }
            .title {
              font-size: 24px;
              font-weight: 700;
              color: #1e3a5f;
              margin-bottom: 25px;
            }
            .warranty-badge {
              background: linear-gradient(135deg, #eb4b00 0%, #ff6b2b 100%);
              color: white;
              padding: 15px 25px;
              border-radius: 8px;
              display: inline-block;
              margin-bottom: 30px;
            }
            .warranty-badge .label {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              opacity: 0.9;
            }
            .warranty-badge .number {
              font-size: 20px;
              font-weight: 700;
              margin-top: 5px;
            }
            .greeting {
              font-size: 14px;
              margin-bottom: 20px;
            }
            .details-section {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 25px;
              margin: 25px 0;
            }
            .details-title {
              font-size: 14px;
              font-weight: 700;
              color: #1e3a5f;
              margin-bottom: 15px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px 30px;
            }
            .detail-item {
              font-size: 13px;
            }
            .detail-label {
              color: #64748b;
              font-weight: 500;
            }
            .detail-value {
              color: #1a1a1a;
              font-weight: 600;
            }
            .body-text {
              font-size: 13px;
              margin: 20px 0;
              color: #333;
            }
            .coverage-highlights {
              background: #f0fdf4;
              border: 1px solid #86efac;
              border-radius: 8px;
              padding: 20px;
              margin: 25px 0;
            }
            .coverage-highlights h4 {
              color: #166534;
              font-size: 14px;
              margin: 0 0 15px 0;
            }
            .coverage-highlights ul {
              margin: 0;
              padding-left: 20px;
              font-size: 12px;
              color: #15803d;
            }
            .coverage-highlights li {
              margin-bottom: 8px;
            }
            .signature-section {
              margin-top: 40px;
            }
            .signature-section p {
              margin: 3px 0;
              font-size: 13px;
            }
            .contact-footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #e2e8f0;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              font-size: 12px;
            }
            .contact-item {
              text-align: center;
            }
            .contact-item .label {
              color: #64748b;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .contact-item .value {
              color: #eb4b00;
              font-weight: 600;
              font-size: 14px;
              margin-top: 5px;
            }
            .legal-footer {
              margin-top: 40px;
              padding-top: 15px;
              border-top: 1px solid #e2e8f0;
              font-size: 10px;
              color: #94a3b8;
              text-align: center;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const formatAddress = () => {
    const addr = policy.customerAddress;
    if (!addr) return null;
    
    const parts = [
      addr.flatNumber && `Flat ${addr.flatNumber}`,
      addr.buildingName,
      addr.buildingNumber && addr.street ? `${addr.buildingNumber} ${addr.street}` : addr.street,
      addr.town,
      addr.county,
      addr.postcode,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts : null;
  };

  const customerAddress = formatAddress();
  const todayDate = format(new Date(), 'd MMMM yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Warranty Confirmation Letter</span>
            <div className="flex gap-2">
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print Letter
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="border rounded-lg bg-white p-8 shadow-inner">
          <div ref={printRef} className="letter-container">
            {/* Header with Logo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', paddingBottom: '20px', borderBottom: '3px solid #eb4b00' }}>
              <img 
                src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" 
                alt="Buy A Warranty" 
                style={{ height: '50px' }}
              />
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#666' }}>
                <p style={{ margin: '2px 0', fontWeight: '600' }}>Buy A Warranty Ltd</p>
                <p style={{ margin: '2px 0' }}>Warranty House</p>
                <p style={{ margin: '2px 0' }}>62 Berkhamsted Ave</p>
                <p style={{ margin: '2px 0' }}>Wembley, HA9 6DT</p>
                <p style={{ margin: '2px 0' }}>Company No: 10314863</p>
              </div>
            </div>

            {/* Date */}
            <div style={{ textAlign: 'right', marginBottom: '30px', fontSize: '12px', color: '#666' }}>
              {todayDate}
            </div>

            {/* Customer Address */}
            <div style={{ marginBottom: '30px', fontSize: '13px' }}>
              <p style={{ margin: '2px 0', fontWeight: '600' }}>{policy.customerName}</p>
              {customerAddress && customerAddress.map((line, idx) => (
                <p key={idx} style={{ margin: '2px 0' }}>{line}</p>
              ))}
              {policy.customerEmail && (
                <p style={{ margin: '8px 0 0 0', color: '#666' }}>{policy.customerEmail}</p>
              )}
            </div>

            {/* Title */}
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e3a5f', marginBottom: '25px' }}>
              Warranty Order Confirmation
            </h1>

            {/* Warranty Badge */}
            <div style={{ background: 'linear-gradient(135deg, #eb4b00 0%, #ff6b2b 100%)', color: 'white', padding: '15px 25px', borderRadius: '8px', display: 'inline-block', marginBottom: '30px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: '0.9' }}>
                Warranty Reference Number
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '5px' }}>
                {policy.warrantyNumber || 'Pending'}
              </div>
            </div>

            {/* Greeting */}
            <p style={{ fontSize: '14px', marginBottom: '20px' }}>
              Dear {policy.customerName.split(' ')[0]},
            </p>

            <p style={{ fontSize: '13px', margin: '20px 0', color: '#333' }}>
              We are pleased to confirm that your vehicle warranty has been successfully processed and is now active. 
              Please keep this letter for your records as confirmation of your warranty coverage.
            </p>

            {/* Vehicle Details Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '25px', margin: '25px 0' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e3a5f', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Vehicle Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 30px' }}>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Registration: </span>
                  <span style={{ color: '#1a1a1a', fontWeight: '600' }}>{policy.vehicleReg}</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Make & Model: </span>
                  <span style={{ color: '#1a1a1a', fontWeight: '600' }}>{policy.vehicleMake} {policy.vehicleModel}</span>
                </div>
                {policy.vehicleYear && (
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Year: </span>
                    <span style={{ color: '#1a1a1a', fontWeight: '600' }}>{policy.vehicleYear}</span>
                  </div>
                )}
                {policy.mileage && (
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Mileage: </span>
                    <span style={{ color: '#1a1a1a', fontWeight: '600' }}>{parseInt(policy.mileage).toLocaleString()} miles</span>
                  </div>
                )}
              </div>
            </div>

            {/* Policy Details Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '25px', margin: '25px 0' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e3a5f', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Warranty Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 30px' }}>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Policy Number: </span>
                  <span style={{ color: '#1a1a1a', fontWeight: '600' }}>{policy.policyNumber}</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Plan Type: </span>
                  <span style={{ color: '#1a1a1a', fontWeight: '600' }}>{policy.planType}</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Start Date: </span>
                  <span style={{ color: '#1a1a1a', fontWeight: '600' }}>{format(new Date(policy.policyStartDate), 'd MMMM yyyy')}</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>End Date: </span>
                  <span style={{ color: '#1a1a1a', fontWeight: '600' }}>{format(new Date(policy.policyEndDate), 'd MMMM yyyy')}</span>
                </div>
                {policy.claimLimit && (
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Claim Limit: </span>
                    <span style={{ color: '#1a1a1a', fontWeight: '600' }}>£{policy.claimLimit.toLocaleString()}</span>
                  </div>
                )}
                {policy.voluntaryExcess !== undefined && (
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Voluntary Excess: </span>
                    <span style={{ color: '#1a1a1a', fontWeight: '600' }}>£{policy.voluntaryExcess}</span>
                  </div>
                )}
              </div>
            </div>

            {/* What's Covered */}
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '20px', margin: '25px 0' }}>
              <h4 style={{ color: '#166534', fontSize: '14px', margin: '0 0 15px 0' }}>Your Coverage Includes:</h4>
              <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '12px', color: '#15803d' }}>
                <li style={{ marginBottom: '8px' }}>Mechanical and electrical breakdown protection</li>
                <li style={{ marginBottom: '8px' }}>UK-wide approved repairer network</li>
                <li style={{ marginBottom: '8px' }}>24/7 claims support helpline</li>
                <li style={{ marginBottom: '8px' }}>Online customer dashboard access</li>
              </ul>
            </div>

            <p style={{ fontSize: '13px', margin: '20px 0', color: '#333' }}>
              Your full policy documents and terms & conditions have been sent to your email address. 
              You can also access these at any time through your online customer dashboard at <strong>buyawarranty.co.uk/customer-dashboard</strong>.
            </p>

            <p style={{ fontSize: '13px', margin: '20px 0', color: '#333' }}>
              If you have any questions or require further assistance, please do not hesitate to contact our customer support team using the details below.
            </p>

            {/* Signature */}
            <div style={{ marginTop: '40px' }}>
              <p style={{ margin: '3px 0', fontSize: '13px' }}>Kind regards,</p>
              <p style={{ margin: '15px 0 3px 0', fontSize: '13px', fontWeight: '600' }}>Customer Support Team</p>
              <p style={{ margin: '3px 0', fontSize: '13px' }}>Buy A Warranty</p>
            </div>

            {/* Contact Footer */}
            <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '2px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', fontSize: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales Enquiries</div>
                <div style={{ color: '#eb4b00', fontWeight: '600', fontSize: '14px', marginTop: '5px' }}>0330 229 5040</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Claims Hotline</div>
                <div style={{ color: '#eb4b00', fontWeight: '600', fontSize: '14px', marginTop: '5px' }}>0330 229 5045</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Support</div>
                <div style={{ color: '#eb4b00', fontWeight: '600', fontSize: '14px', marginTop: '5px' }}>support@buyawarranty.co.uk</div>
              </div>
            </div>

            {/* Legal Footer */}
            <div style={{ marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #e2e8f0', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
              Buy A Warranty Ltd is registered in England & Wales. Company No: 10314863. 
              Registered Address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
