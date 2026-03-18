import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
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
  labourRate?: number;
  breakdownRecovery?: boolean;
  wearTear?: boolean;
  europeCover?: boolean;
  motFee?: boolean;
  motRepair?: boolean;
  tyreCover?: boolean;
  lostKey?: boolean;
  vehicleRental?: boolean;
  transferCover?: boolean;
  consequential?: boolean;
  seasonalBonusMonths?: number;
  additionalNotes?: string;
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
  const [printMode, setPrintMode] = useState<'bw' | 'colour'>('colour');

  const isBW = printMode === 'bw';

  const c = {
    accent: isBW ? '#333' : '#eb4b00',
    accentGrad: isBW ? '#333' : 'linear-gradient(135deg, #eb4b00 0%, #ff6b2b 100%)',
    accentText: 'white',
    heading: isBW ? '#000' : '#1e3a5f',
    border: isBW ? '#999' : '#e2e8f0',
    borderAccent: isBW ? '#333' : '#eb4b00',
    glanceBg: isBW ? '#f5f5f5' : '#f8fafc',
    glanceBorder: isBW ? '#ccc' : '#e2e8f0',
    benefitsBg: isBW ? '#f5f5f5' : '#f0fdf4',
    benefitsBorder: isBW ? '#aaa' : '#86efac',
    benefitsHeading: isBW ? '#000' : '#166534',
    benefitsText: isBW ? '#333' : '#15803d',
    addonsBg: isBW ? '#f5f5f5' : '#eff6ff',
    addonsBorder: isBW ? '#aaa' : '#93c5fd',
    addonsHeading: isBW ? '#000' : '#1e40af',
    addonsText: isBW ? '#333' : '#1d4ed8',
    claimsBg: isBW ? '#f5f5f5' : '#fef3c7',
    claimsBorder: isBW ? '#aaa' : '#fbbf24',
    claimsHeading: isBW ? '#000' : '#92400e',
    claimsText: isBW ? '#333' : '#78350f',
    accountBg: isBW ? '#f5f5f5' : '#f8fafc',
    accountBorder: isBW ? '#ccc' : '#e2e8f0',
    accountHeading: isBW ? '#000' : '#1e3a5f',
    contactValue: isBW ? '#000' : '#eb4b00',
    muted: isBW ? '#555' : '#64748b',
    legal: isBW ? '#777' : '#94a3b8',
    divider: isBW ? '#ccc' : '#f0f0f0',
  };

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
          <title>${policy.customerName} - ${policy.warrantyNumber || policy.policyNumber}</title>
          <style>
            @page { size: A4; margin: 15mm 18mm; margin-top: 0; margin-bottom: 0; }
            @media print { @page { margin-top: 0; margin-bottom: 0; } body { margin-top: 15mm; margin-bottom: 15mm; } }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.45; background: white; font-size: 10.5px; }
            .page { max-width: 210mm; margin: 0 auto; }
            div[style] { page-break-inside: avoid; }
            ${isBW ? '' : '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'}
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
    }, 250);
  };

  const formatAddress = () => {
    const addr = policy.customerAddress;
    if (!addr) return [];
    const parts = [
      addr.flatNumber && `Flat ${addr.flatNumber}`,
      addr.buildingName,
      addr.buildingNumber && addr.street ? `${addr.buildingNumber} ${addr.street}` : addr.street,
      addr.town,
      addr.county,
      addr.postcode,
    ].filter(Boolean);
    return parts;
  };

  const getAddonsList = () => {
    const addons: string[] = [];
    if (policy.wearTear) addons.push('Wear & Tear Cover');
    if (policy.europeCover) addons.push('European Cover');
    if (policy.motRepair) addons.push('MOT Repair Cover');
    if (policy.tyreCover) addons.push('Tyre Cover');
    if (policy.lostKey) addons.push('Lost Key Cover');
    if (policy.vehicleRental) addons.push('Vehicle Rental Cover');
    if (policy.transferCover) addons.push('Transfer Cover');
    if (policy.consequential) addons.push('Consequential Loss Cover');
    return addons;
  };

  const getDuration = () => {
    if (!policy.policyStartDate || !policy.policyEndDate) return 'N/A';
    const start = new Date(policy.policyStartDate);
    const end = new Date(policy.policyEndDate);
    const bonusMonths = Number(policy.seasonalBonusMonths) || 0;

    if (bonusMonths > 0) {
      end.setMonth(end.getMonth() + bonusMonths);
    }

    const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));

    if (bonusMonths > 0) return `${months} Months`;
    if (months >= 36) return '3 Years';
    if (months >= 24) return '2 Years';
    if (months >= 12) return '1 Year';
    return `${months} Months`;
  };

  const address = formatAddress();
  const addons = getAddonsList();
  const warrantyRef = policy.warrantyNumber || policy.policyNumber || 'N/A';
  const todayDate = format(new Date(), 'd MMMM yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Warranty Confirmation Letter</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
                <button
                  onClick={() => setPrintMode('bw')}
                  className={`px-2 py-1 text-xs font-medium transition-colors ${printMode === 'bw' ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'}`}
                >
                  B&W
                </button>
                <button
                  onClick={() => setPrintMode('colour')}
                  className={`px-2 py-1 text-xs font-medium transition-colors ${printMode === 'colour' ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'}`}
                >
                  Colour
                </button>
              </div>
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print Letter
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="border rounded-lg bg-white px-16 py-10 shadow-inner">
          <div ref={printRef} className="letter-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: `3px solid ${c.borderAccent}`, marginBottom: '14px' }}>
              <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" style={{ height: '40px', filter: isBW ? 'grayscale(100%)' : 'none' }} />
              <div style={{ textAlign: 'right', fontSize: '9px', color: '#666', lineHeight: '1.4' }}>
                <p style={{ fontWeight: '600' }}>Buy A Warranty Ltd</p>
                <p>Warranty House, 62 Berkhamsted Ave</p>
                <p>Wembley, HA9 6DT</p>
                <p>Company No: 10314863</p>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '10px', color: '#666', marginBottom: '12px' }}>{todayDate}</div>

            <div style={{ marginBottom: '14px', fontSize: '11px' }}>
              <p style={{ margin: '1px 0', fontWeight: '400' }}>{policy.customerName}</p>
              {address.map((line, i) => (
                <p key={i} style={{ margin: '1px 0' }}>{line}</p>
              ))}
              {policy.customerEmail && (
                <p style={{ margin: '4px 0 0', color: '#666' }}>{policy.customerEmail}</p>
              )}
            </div>

            <h1 style={{ fontSize: '18px', fontWeight: '700', color: c.heading, marginBottom: '10px' }}>
              Your Warranty Cover Document
            </h1>

            {/* Warranty Badge */}
            <div style={{ background: isBW ? '#333' : c.accentGrad, color: c.accentText, padding: '8px 16px', borderRadius: '6px', display: 'inline-block', marginBottom: '14px' }}>
              <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', opacity: '0.9' }}>Warranty Reference</div>
              <div style={{ fontSize: '15px', fontWeight: '700', marginTop: '2px' }}>{warrantyRef}</div>
            </div>

            <p style={{ marginBottom: '8px', fontSize: '11px' }}>Dear {policy.customerName.split(' ')[0]},</p>
            <p style={{ marginBottom: '12px', color: '#333', fontSize: '11px' }}>
              Thank you for choosing Buyawarranty to protect your vehicle. Please find below a summary of your warranty cover. Your policy provides protection against the cost of unexpected mechanical or electrical breakdowns, helping you stay on the road with peace of mind.
            </p>

            {/* Cover at a Glance */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: c.heading, marginBottom: '8px', borderBottom: `2px solid ${c.border}`, paddingBottom: '4px' }}>Your Cover at a Glance</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', background: c.glanceBg, border: `1px solid ${c.glanceBorder}`, borderRadius: '6px', padding: '12px 14px' }}>
                {[
                  ['Vehicle', policy.vehicleReg || '-'],
                  ['Plan Type', policy.planType || 'N/A'],
                  ['Duration', getDuration()],
                  ['Mileage', policy.mileage ? `${parseInt(policy.mileage).toLocaleString()} miles` : 'N/A'],
                  ['Start Date', policy.policyStartDate ? format(new Date(policy.policyStartDate), 'd MMM yyyy') : 'N/A'],
                  ['End Date', policy.policyEndDate ? (() => {
                    const endDate = new Date(policy.policyEndDate);
                    if (policy.seasonalBonusMonths && policy.seasonalBonusMonths > 0) {
                      endDate.setMonth(endDate.getMonth() + policy.seasonalBonusMonths);
                    }
                    return format(endDate, 'd MMM yyyy');
                  })() : 'N/A'],
                  ['Warranty Ref', warrantyRef],
                  ['Policy No.', policy.policyNumber || 'N/A'],
                ].map(([label, value], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${c.divider}` }}>
                    <span style={{ color: c.muted, fontWeight: '500' }}>{label}</span>
                    <span style={{ fontWeight: '600' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: c.heading, marginBottom: '8px', borderBottom: `2px solid ${c.border}`, paddingBottom: '4px' }}>What Your Warranty Includes</div>
              <div style={{ background: c.benefitsBg, border: `1px solid ${c.benefitsBorder}`, borderRadius: '6px', padding: '10px 14px', marginBottom: '8px' }}>
                <h4 style={{ color: c.benefitsHeading, fontSize: '12px', marginBottom: '6px', fontWeight: '700' }}>Key Benefits of Your Cover</h4>
                <ul style={{ margin: '0', paddingLeft: '16px', color: c.benefitsText, fontSize: '10.5px' }}>
                  <li style={{ marginBottom: '3px' }}>Protection for major mechanical and electrical components</li>
                  {policy.claimLimit && <li style={{ marginBottom: '3px' }}>Claims limit of £{policy.claimLimit.toLocaleString()} per claim</li>}
                  {policy.labourRate && <li style={{ marginBottom: '3px' }}>Labour rate covered up to £{policy.labourRate}/hour</li>}
                  {policy.voluntaryExcess !== undefined && policy.voluntaryExcess !== null && <li style={{ marginBottom: '3px' }}>Voluntary excess of £{policy.voluntaryExcess} per claim</li>}
                  <li style={{ marginBottom: '3px' }}>Access to trusted UK-wide VAT registered repair garages</li>
                  <li style={{ marginBottom: '3px' }}>Choose your own VAT registered garage option</li>
                  <li style={{ marginBottom: '3px' }}>Fast, simple claims process via our dedicated claims team</li>
                  {policy.breakdownRecovery && <li style={{ marginBottom: '3px' }}>Breakdown recovery claimback</li>}
                </ul>
              </div>

              {addons.length > 0 && (
                <div style={{ background: c.addonsBg, border: `1px solid ${c.addonsBorder}`, borderRadius: '6px', padding: '10px 14px' }}>
                  <h4 style={{ color: c.addonsHeading, fontSize: '12px', marginBottom: '6px', fontWeight: '700' }}>Additional Included Services</h4>
                  <ul style={{ margin: '0', paddingLeft: '16px', color: c.addonsText, fontSize: '10.5px' }}>
                    {addons.map((addon, i) => (
                      <li key={i} style={{ marginBottom: '3px' }}>✓ {addon}</li>
                    ))}
                    {(Number(policy.seasonalBonusMonths) || 0) > 0 && (
                      <li style={{ marginBottom: '3px' }}>✓ Free extended cover: {policy.seasonalBonusMonths} bonus month{policy.seasonalBonusMonths! > 1 ? 's' : ''}</li>
                    )}
                  </ul>
                </div>
              )}

              <p style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
                Your full policy booklet (attached) includes a detailed breakdown of inclusions, exclusions, claim procedures, and general conditions. Please keep it somewhere safe for future reference.
              </p>
            </div>

            {/* Additional Notes */}
            {policy.additionalNotes && policy.additionalNotes.trim() && (
              <div style={{ background: isBW ? '#f5f5f5' : '#fef9ee', border: `1px solid ${isBW ? '#aaa' : '#f59e0b'}`, borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
                <h4 style={{ color: isBW ? '#000' : '#92400e', fontSize: '12px', marginBottom: '6px', fontWeight: '700' }}>Important Notes About Your Cover</h4>
                <p style={{ color: isBW ? '#333' : '#78350f', fontSize: '10.5px', margin: '0', whiteSpace: 'pre-wrap' }}>{policy.additionalNotes}</p>
              </div>
            )}

            {/* Claims */}
            <div style={{ background: c.claimsBg, border: `1px solid ${c.claimsBorder}`, borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
              <h4 style={{ color: c.claimsHeading, fontSize: '12px', marginBottom: '4px', fontWeight: '700' }}>How to Make a Claim</h4>
              <p style={{ color: c.claimsText, fontSize: '10.5px', margin: '2px 0' }}>If your vehicle experiences a fault, simply contact our Claims Team <strong>before</strong> any repairs are carried out so we can authorise the work.</p>
              <p style={{ color: c.claimsText, fontSize: '10.5px', margin: '4px 0', fontWeight: '700' }}>Claims Hotline: 0330 229 5045</p>
              <p style={{ color: c.claimsText, fontSize: '10.5px', margin: '2px 0' }}>Opening Hours: Monday to Friday, 9am to 5pm</p>
              <p style={{ color: c.claimsText, fontSize: '10.5px', margin: '4px 0 0' }}>We aim to make claims as smooth and stress-free as possible. Our team will guide you through each step and liaise with the repairer on your behalf.</p>
            </div>

            {/* Account */}
            <div style={{ background: c.accountBg, border: `1px solid ${c.accountBorder}`, borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
              <h4 style={{ color: c.accountHeading, fontSize: '12px', marginBottom: '4px', fontWeight: '700' }}>Your Account &amp; Policy Documents</h4>
              <p style={{ fontSize: '10.5px', color: '#333', margin: '2px 0' }}>Your warranty policy documents are also available online. You can access them at any time by visiting:</p>
              <p style={{ fontSize: '11px', color: c.contactValue, margin: '6px 0', fontWeight: '700' }}>https://buyawarranty.co.uk/customer-dashboard/</p>
              <p style={{ fontSize: '10.5px', color: '#333', margin: '4px 0' }}>Simply click the <strong>Login</strong> option at the top of the homepage, or go directly to the link above. Use your registered email to sign in:</p>
              {policy.customerEmail && (
                <p style={{ fontSize: '10.5px', color: '#333', margin: '4px 0' }}><strong>Email:</strong> {policy.customerEmail}</p>
              )}
              <p style={{ fontSize: '10px', color: '#555', margin: '6px 0 0' }}>Once logged in, you can:</p>
              <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '10px', color: '#555' }}>
                <li style={{ marginBottom: '2px' }}>View and download your full warranty policy</li>
                <li style={{ marginBottom: '2px' }}>Download your Terms &amp; Conditions</li>
                <li style={{ marginBottom: '2px' }}>Check your vehicle and cover details</li>
                <li style={{ marginBottom: '2px' }}>Manage your contact information</li>
                <li style={{ marginBottom: '2px' }}>Renew or upgrade your plan when the time comes</li>
              </ul>
            </div>

            <p style={{ fontSize: '10.5px', color: '#333', marginBottom: '6px' }}>
              If there's anything you're unsure about, or if you simply want to understand your cover better, we're here for you.
            </p>

            <div style={{ marginTop: '16px', fontSize: '11px' }}>
              <p style={{ margin: '1px 0' }}>Warm regards,</p>
              <p style={{ margin: '10px 0 1px', fontWeight: '600' }}>The Buyawarranty Team</p>
            </div>

            {/* Contact Footer */}
            <div style={{ marginTop: '18px', paddingTop: '10px', borderTop: `2px solid ${c.border}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: c.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales Enquiries</div>
                <div style={{ color: c.contactValue, fontWeight: '600', fontSize: '12px', marginTop: '2px' }}>0330 229 5040</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: c.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Claims Hotline</div>
                <div style={{ color: c.contactValue, fontWeight: '600', fontSize: '12px', marginTop: '2px' }}>0330 229 5045</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: c.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer Support</div>
                <div style={{ color: c.contactValue, fontWeight: '600', fontSize: '12px', marginTop: '2px' }}>support@buyawarranty.co.uk</div>
              </div>
            </div>

            <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${c.border}`, fontSize: '8px', color: c.legal, textAlign: 'center' }}>
              Buy A Warranty Ltd is registered in England &amp; Wales. Company No: 10314863.
              Registered Address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
