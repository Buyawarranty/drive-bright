import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { getWarrantyDurationDisplay } from '@/lib/warrantyUtils';
import { getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';

interface PrintablePolicySummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: {
    plan_type: string;
    payment_type: string;
    policy_number: string;
    policy_start_date: string;
    policy_end_date: string;
    seasonal_bonus_months?: number;
    status: string;
    claim_limit?: number;
    voluntary_excess?: number;
    labour_rate?: number;
    warranty_number?: string;
    mot_fee?: boolean;
    tyre_cover?: boolean;
    wear_tear?: boolean;
    europe_cover?: boolean;
    transfer_cover?: boolean;
    breakdown_recovery?: boolean;
    vehicle_rental?: boolean;
    mot_repair?: boolean;
    lost_key?: boolean;
    consequential?: boolean;
  };
  customer: {
    name?: string;
    email?: string;
    phone?: string;
    registration_plate?: string;
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_year?: string;
    vehicle_fuel_type?: string;
    vehicle_transmission?: string;
    mileage?: string;
    flat_number?: string;
    building_name?: string;
    building_number?: string;
    street?: string;
    town?: string;
    county?: string;
    postcode?: string;
    country?: string;
  };
}

export const PrintablePolicySummary: React.FC<PrintablePolicySummaryProps> = ({
  open,
  onOpenChange,
  policy,
  customer,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  };

  const getEndDate = () => {
    const endDate = new Date(policy.policy_end_date);
    if (policy.seasonal_bonus_months && policy.seasonal_bonus_months > 0) {
      endDate.setMonth(endDate.getMonth() + policy.seasonal_bonus_months);
    }
    return endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const vehicleDesc = [customer.vehicle_year, customer.vehicle_make, customer.vehicle_model]
    .filter(Boolean).join(' ').toUpperCase() || 'Not provided';

  const mileageDisplay = (() => {
    if (!customer.mileage?.trim()) return 'Not provided';
    const m = customer.mileage.trim();
    if (m.includes('to') || m.includes('-')) return m;
    const n = Number(m);
    return !isNaN(n) && n > 0 ? `${n.toLocaleString()} miles` : m;
  })();

  const getPlanDisplayName = () => {
    const pt = policy.plan_type.toLowerCase();
    if (pt.includes('motorbike')) return 'Platinum Motorbike Plan';
    if (pt.includes('van')) return 'Platinum Van Plan';
    if (pt.includes('phev') || pt.includes('electric')) return 'Platinum Electric/Hybrid Plan';
    return 'Platinum Car Plan';
  };

  const addressParts = [
    customer.flat_number && `Flat ${customer.flat_number}`,
    customer.building_name,
    customer.building_number && customer.street ? `${customer.building_number} ${customer.street}` : customer.street,
    customer.town,
    customer.county,
    customer.postcode,
  ].filter(Boolean);

  const addOns = [
    // Breakdown recovery shown in key benefits, not as separate add-on
    policy.vehicle_rental && 'Vehicle Rental Cover',
    policy.mot_repair && 'MOT Repair Cover',
    policy.tyre_cover && 'Tyre Cover',
    policy.wear_tear && 'Wear & Tear Cover',
    policy.europe_cover && 'European Cover',
    policy.transfer_cover && 'Transfer Cover',
    policy.lost_key && 'Lost Key Cover',
    policy.consequential && 'Consequential Loss Cover',
  ].filter(Boolean) as string[];

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow pop-ups to print'); return; }

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Policy Summary - ${customer.registration_plate || policy.policy_number}</title>
      <style>
        @page { size: A4; margin: 18mm 20mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.5; background: white; font-size: 12px; }
        .page { max-width: 210mm; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #eb4b00; margin-bottom: 20px; }
        .logo { height: 42px; }
        .company-info { text-align: right; font-size: 10px; color: #666; line-height: 1.6; }
        .customer-block { margin-bottom: 18px; }
        .customer-block .name { font-weight: 700; font-size: 14px; }
        .customer-block .line { color: #444; font-size: 11px; margin-top: 1px; }
        .title { font-size: 20px; font-weight: 700; color: #1e3a5f; margin-bottom: 16px; }
        .section { margin-bottom: 18px; }
        .section-title { font-size: 13px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
        .glance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .glance-item .label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
        .glance-item .value { font-weight: 600; font-size: 13px; color: #1a1a1a; }
        .highlight-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 14px 16px; }
        .highlight-box h4 { color: #166534; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
        .highlight-box ul { padding-left: 18px; color: #15803d; font-size: 11px; }
        .highlight-box li { margin-bottom: 4px; }
        .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; font-size: 11px; color: #333; }
        .info-box p { margin-bottom: 6px; }
        .info-box strong { color: #1e3a5f; }
        .addon-grid { display: flex; flex-wrap: wrap; gap: 6px; }
        .addon-badge { background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; }
        .contact-footer { margin-top: 24px; padding-top: 14px; border-top: 2px solid #e2e8f0; display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; text-align: center; }
        .contact-footer .label { color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
        .contact-footer .value { color: #eb4b00; font-weight: 600; font-size: 13px; margin-top: 3px; }
        .legal { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; }
        .policy-details-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .policy-detail-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 12px; text-align: center; }
        .policy-detail-box .label { color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
        .policy-detail-box .value { font-weight: 700; font-size: 16px; color: #1e3a5f; margin-top: 2px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head><body>${printContent.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Printable Policy Summary</span>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="border rounded-lg bg-white p-6 shadow-inner">
          <div ref={printRef} className="page">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '3px solid #eb4b00', marginBottom: '20px' }}>
              <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" style={{ height: '42px' }} />
              <div style={{ textAlign: 'right', fontSize: '10px', color: '#666', lineHeight: '1.6' }}>
                <div style={{ fontWeight: '600' }}>Buy A Warranty Ltd</div>
                <div>Warranty House, 62 Berkhamsted Ave</div>
                <div>Wembley, HA9 6DT</div>
                <div>Company No: 10314863</div>
              </div>
            </div>

            {/* Customer Block */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>{customer.name || 'Customer'}</div>
              {addressParts.map((line, i) => (
                <div key={i} style={{ color: '#444', fontSize: '11px', marginTop: '1px' }}>{line}</div>
              ))}
              {customer.email && <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>{customer.email}</div>}
              {customer.phone && <div style={{ color: '#666', fontSize: '11px' }}>{customer.phone}</div>}
            </div>

            {/* Title */}
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>
              Your Warranty Policy Summary
            </h1>

            {/* Cover at a Glance */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', paddingBottom: '4px', borderBottom: '2px solid #e2e8f0' }}>
                Your Cover at a Glance
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                {[
                  ['Vehicle', `${customer.registration_plate || 'N/A'} — ${vehicleDesc}`],
                  ['Plan Type', getPlanDisplayName()],
                  ['Duration', `${getWarrantyDurationDisplay(policy.payment_type)}${policy.seasonal_bonus_months ? ` + ${policy.seasonal_bonus_months} months FREE` : ''}`],
                  ['Mileage', mileageDisplay],
                  ['Warranty Reference', policy.warranty_number || policy.policy_number],
                  ['Policy Start', formatDate(policy.policy_start_date)],
                  ['Policy End', getEndDate()],
                  ['Status', policy.status.toUpperCase()],
                ].map(([label, value]) => (
                  <div key={label} style={{ marginBottom: '2px' }}>
                    <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#1a1a1a' }}>{value}</div>
                  </div>
                ))}
                {customer.vehicle_fuel_type && customer.vehicle_fuel_type !== 'Unknown' && (
                  <div style={{ marginBottom: '2px' }}>
                    <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Fuel / Transmission</div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#1a1a1a' }}>
                      {customer.vehicle_fuel_type}{customer.vehicle_transmission && customer.vehicle_transmission !== 'Unknown' ? ` • ${customer.vehicle_transmission}` : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Policy Details Boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Claim Limit</div>
                <div style={{ fontWeight: '700', fontSize: '16px', color: '#1e3a5f', marginTop: '2px' }}>£{(policy.claim_limit || 1250).toLocaleString()}</div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Voluntary Excess</div>
                <div style={{ fontWeight: '700', fontSize: '16px', color: '#1e3a5f', marginTop: '2px' }}>£{policy.voluntary_excess || 0}</div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Labour Rate</div>
                <div style={{ fontWeight: '700', fontSize: '16px', color: '#1e3a5f', marginTop: '2px' }}>£{policy.labour_rate || 70}/hr</div>
              </div>
            </div>

            {/* What Your Warranty Includes */}
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '14px 16px', marginBottom: '18px' }}>
              <h4 style={{ color: '#166534', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>What Your Warranty Includes</h4>
              <ul style={{ paddingLeft: '18px', color: '#15803d', fontSize: '11px', margin: 0 }}>
                <li style={{ marginBottom: '4px' }}>Protection for major mechanical and electrical components</li>
                <li style={{ marginBottom: '4px' }}>Claims limit of £{getDisplayClaimLimitValue(policy.claim_limit || 1250).toLocaleString()} per claim</li>
                <li style={{ marginBottom: '4px' }}>Labour rate covered up to £{policy.labour_rate || 70}/hour</li>
                <li style={{ marginBottom: '4px' }}>Access to trusted UK-wide VAT registered repair garages</li>
                <li style={{ marginBottom: '4px' }}>Choose your own VAT registered garage option</li>
                <li style={{ marginBottom: '4px' }}>Fast, simple claims process via our dedicated claims team</li>
                {policy.breakdown_recovery && <li style={{ marginBottom: '4px' }}>Breakdown recovery claimback</li>}
              </ul>
            </div>

            {/* Add-Ons */}
            {addOns.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', paddingBottom: '4px', borderBottom: '2px solid #e2e8f0' }}>
                  Additional Included Services
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {addOns.map(addon => (
                    <span key={addon} style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: '600' }}>
                      ✓ {addon}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* How to Make a Claim */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '14px 16px', marginBottom: '18px', fontSize: '11px', color: '#333' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '6px' }}>How to Make a Claim</div>
              <p style={{ marginBottom: '6px' }}>If your vehicle experiences a fault, contact our Claims Team <strong>before</strong> any repairs are carried out so we can authorise the work.</p>
              <p style={{ marginBottom: '4px' }}><strong>Claims Hotline:</strong> 0330 229 5045</p>
              <p><strong>Opening Hours:</strong> Monday–Friday, 9am–5pm</p>
            </div>

            {/* Your Account */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '14px 16px', marginBottom: '18px', fontSize: '11px', color: '#333' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '6px' }}>Your Account & Policy Documents</div>
              <p style={{ marginBottom: '6px' }}>Log in to your dashboard at <strong>buyawarranty.co.uk/customer-dashboard</strong> to:</p>
              <ul style={{ paddingLeft: '18px', margin: 0 }}>
                <li>View your warranty plan & download T&Cs</li>
                <li>Check your vehicle details & manage contact info</li>
                <li>Renew or upgrade your plan</li>
              </ul>
            </div>

            {/* Contact Footer */}
            <div style={{ marginTop: '24px', paddingTop: '14px', borderTop: '2px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', textAlign: 'center' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales Enquiries</div>
                <div style={{ color: '#eb4b00', fontWeight: '600', fontSize: '13px', marginTop: '3px' }}>0330 229 5040</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Claims Hotline</div>
                <div style={{ color: '#eb4b00', fontWeight: '600', fontSize: '13px', marginTop: '3px' }}>0330 229 5045</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Support</div>
                <div style={{ color: '#eb4b00', fontWeight: '600', fontSize: '13px', marginTop: '3px' }}>support@buyawarranty.co.uk</div>
              </div>
            </div>

            {/* Legal */}
            <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '9px', color: '#94a3b8', textAlign: 'center' }}>
              Buy A Warranty Ltd is registered in England & Wales. Company No: 10314863. Registered Address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
