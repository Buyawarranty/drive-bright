import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Search, Printer, FileText, User, Car } from 'lucide-react';
import { format } from 'date-fns';

interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  flat_number?: string;
  building_name?: string;
  building_number?: string;
  street?: string;
  town?: string;
  county?: string;
  postcode?: string;
  registration_plate?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  mileage?: string;
  plan_type: string;
  claim_limit?: number;
  voluntary_excess?: number;
  labour_rate?: number;
  warranty_number?: string;
  warranty_reference_number?: string;
  breakdown_recovery?: boolean;
  wear_tear?: boolean;
  europe_cover?: boolean;
  mot_fee?: boolean;
  mot_repair?: boolean;
  tyre_cover?: boolean;
  lost_key?: boolean;
  vehicle_rental?: boolean;
  transfer_cover?: boolean;
  consequential?: boolean;
  payment_type?: string;
  seasonal_bonus_months?: number;
}

interface PolicyData {
  id: string;
  policy_number: string;
  policy_start_date: string;
  policy_end_date: string;
  plan_type: string;
  warranty_number?: string;
  claim_limit?: number;
  voluntary_excess?: number;
  payment_type: string;
}

export const PolicyDocumentsTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyData | null>(null);
  const [customerPolicies, setCustomerPolicies] = useState<PolicyData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const searchCustomers = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const normalizedReg = searchQuery.replace(/\s/g, '').toUpperCase();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,registration_plate.ilike.%${normalizedReg}%,warranty_number.ilike.%${searchQuery}%`)
        .eq('is_deleted', false)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
      if (!data?.length) {
        toast({ title: 'No customers found', description: 'Try a different search term.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Search error:', err);
      toast({ title: 'Search failed', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const selectCustomer = async (customer: CustomerData) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setShowPreview(false);

    // Fetch policies for this customer
    const { data: policies } = await supabase
      .from('customer_policies')
      .select('*')
      .eq('email', customer.email)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    setCustomerPolicies(policies || []);
    if (policies && policies.length > 0) {
      setSelectedPolicy(policies[0]);
    } else {
      setSelectedPolicy(null);
    }
  };

  const getDuration = () => {
    if (!selectedPolicy) return 'N/A';
    const start = new Date(selectedPolicy.policy_start_date);
    const end = new Date(selectedPolicy.policy_end_date);
    const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months >= 36) return '3 Years';
    if (months >= 24) return '2 Years';
    if (months >= 12) return '1 Year';
    return `${months} Months`;
  };

  const formatAddress = () => {
    if (!selectedCustomer) return [];
    const parts = [
      selectedCustomer.flat_number && `Flat ${selectedCustomer.flat_number}`,
      selectedCustomer.building_name,
      selectedCustomer.building_number && selectedCustomer.street
        ? `${selectedCustomer.building_number} ${selectedCustomer.street}`
        : selectedCustomer.street,
      selectedCustomer.town,
      selectedCustomer.county,
      selectedCustomer.postcode,
    ].filter(Boolean);
    return parts;
  };

  const getAddonsList = () => {
    if (!selectedCustomer) return [];
    const addons: string[] = [];
    if (selectedCustomer.breakdown_recovery) addons.push('Breakdown Recovery Service');
    if (selectedCustomer.wear_tear) addons.push('Wear & Tear Cover');
    if (selectedCustomer.europe_cover) addons.push('European Cover');
    if (selectedCustomer.mot_fee) addons.push('MOT Test Fee Cover');
    if (selectedCustomer.mot_repair) addons.push('MOT Repair Cover');
    if (selectedCustomer.tyre_cover) addons.push('Tyre Cover');
    if (selectedCustomer.lost_key) addons.push('Lost Key Cover');
    if (selectedCustomer.vehicle_rental) addons.push('Vehicle Rental Cover');
    if (selectedCustomer.transfer_cover) addons.push('Transfer Cover');
    if (selectedCustomer.consequential) addons.push('Consequential Loss Cover');
    return addons;
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
          <title>Policy Documents - ${selectedPolicy?.warranty_number || selectedCustomer?.warranty_number || ''}</title>
          <style>
            @page { size: A4; margin: 15mm 18mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5; background: white; font-size: 11px; }
            .page { max-width: 210mm; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #eb4b00; margin-bottom: 14px; }
            .header img { height: 40px; }
            .company-info { text-align: right; font-size: 9px; color: #666; line-height: 1.4; }
            .date-line { text-align: right; font-size: 10px; color: #666; margin-bottom: 12px; }
            .customer-block { margin-bottom: 14px; font-size: 11px; }
            .customer-block p { margin: 1px 0; }
            .customer-block .name { font-weight: 700; font-size: 12px; }
            h1 { font-size: 18px; font-weight: 700; color: #1e3a5f; margin-bottom: 10px; }
            .ref-badge { background: linear-gradient(135deg, #eb4b00 0%, #ff6b2b 100%); color: white; padding: 8px 16px; border-radius: 6px; display: inline-block; margin-bottom: 14px; }
            .ref-badge .label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; }
            .ref-badge .number { font-size: 15px; font-weight: 700; margin-top: 2px; }
            .greeting { margin-bottom: 8px; }
            .intro-text { margin-bottom: 12px; color: #333; }
            .section { margin-bottom: 14px; }
            .section-title { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
            .glance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; }
            .glance-item { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f0f0f0; }
            .glance-item:last-child { border-bottom: none; }
            .glance-label { color: #64748b; font-weight: 500; }
            .glance-value { font-weight: 600; color: #1a1a1a; text-align: right; }
            .benefits-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 10px 14px; }
            .benefits-box h4 { color: #166534; font-size: 12px; margin-bottom: 6px; }
            .benefits-box ul { margin: 0; padding-left: 16px; color: #15803d; font-size: 10.5px; }
            .benefits-box li { margin-bottom: 3px; }
            .addons-box { background: #eff6ff; border: 1px solid #93c5fd; border-radius: 6px; padding: 10px 14px; }
            .addons-box h4 { color: #1e40af; font-size: 12px; margin-bottom: 6px; }
            .addons-box ul { margin: 0; padding-left: 16px; color: #1d4ed8; font-size: 10.5px; }
            .addons-box li { margin-bottom: 3px; }
            .claims-box { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
            .claims-box h4 { color: #92400e; font-size: 12px; margin-bottom: 4px; }
            .claims-box p { color: #78350f; font-size: 10.5px; margin: 2px 0; }
            .account-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
            .account-box h4 { color: #1e3a5f; font-size: 12px; margin-bottom: 4px; }
            .account-box p { font-size: 10.5px; color: #333; margin: 2px 0; }
            .account-box ul { margin: 4px 0 0; padding-left: 16px; font-size: 10px; color: #555; }
            .account-box li { margin-bottom: 2px; }
            .signature { margin-top: 16px; font-size: 11px; }
            .signature p { margin: 1px 0; }
            .contact-footer { margin-top: 18px; padding-top: 10px; border-top: 2px solid #e2e8f0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 10px; }
            .contact-item { text-align: center; }
            .contact-item .clabel { color: #64748b; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
            .contact-item .cvalue { color: #eb4b00; font-weight: 600; font-size: 12px; margin-top: 2px; }
            .legal-footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #94a3b8; text-align: center; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
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

  const warrantyRef = selectedPolicy?.warranty_number || selectedCustomer?.warranty_number || selectedCustomer?.warranty_reference_number || 'N/A';
  const claimLimit = selectedPolicy?.claim_limit || selectedCustomer?.claim_limit;
  const excess = selectedPolicy?.voluntary_excess ?? selectedCustomer?.voluntary_excess;
  const labourRate = selectedCustomer?.labour_rate;
  const planType = selectedPolicy?.plan_type || selectedCustomer?.plan_type || 'N/A';
  const todayDate = format(new Date(), 'd MMMM yyyy');
  const addons = getAddonsList();
  const address = formatAddress();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-orange-500" />
          Policy Documents
        </h2>
        <p className="text-gray-500 mt-1">Search for a customer and generate a printable A4 policy document letter to include with posted T&Cs.</p>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Customer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Search by name, email, registration, or warranty number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCustomers()}
              className="flex-1"
            />
            <Button onClick={searchCustomers} disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 border rounded-lg divide-y max-h-64 overflow-y-auto">
              {searchResults.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => selectCustomer(customer)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-500">{customer.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-gray-700">{customer.registration_plate || '—'}</p>
                    <p className="text-xs text-gray-400">{customer.plan_type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Customer Info */}
      {selectedCustomer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-gray-500">Name:</span> <strong>{selectedCustomer.name}</strong></p>
              <p><span className="text-gray-500">Email:</span> {selectedCustomer.email}</p>
              {selectedCustomer.phone && <p><span className="text-gray-500">Phone:</span> {selectedCustomer.phone}</p>}
              {address.length > 0 && <p><span className="text-gray-500">Address:</span> {address.join(', ')}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicle & Cover
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-gray-500">Reg:</span> <strong>{selectedCustomer.registration_plate || '—'}</strong></p>
              <p><span className="text-gray-500">Vehicle:</span> {selectedCustomer.vehicle_make} {selectedCustomer.vehicle_model} {selectedCustomer.vehicle_year}</p>
              <p><span className="text-gray-500">Plan:</span> {planType}</p>
              <p><span className="text-gray-500">Warranty Ref:</span> {warrantyRef}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Policy Selector */}
      {customerPolicies.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Select Policy</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {customerPolicies.map((pol) => (
                <Button
                  key={pol.id}
                  variant={selectedPolicy?.id === pol.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPolicy(pol)}
                >
                  {pol.policy_number} — {pol.plan_type}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate / Print */}
      {selectedCustomer && selectedPolicy && (
        <div className="flex gap-3">
          <Button onClick={() => setShowPreview(true)} className="gap-2">
            <FileText className="h-4 w-4" />
            Generate Letter Preview
          </Button>
          {showPreview && (
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </Button>
          )}
        </div>
      )}

      {/* A4 Letter Preview */}
      {showPreview && selectedCustomer && selectedPolicy && (
        <Card className="border-2">
          <CardContent className="p-8 bg-white">
            <div ref={printRef} className="policy-letter">
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: '3px solid #eb4b00', marginBottom: '14px' }}>
                <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" style={{ height: '40px' }} />
                <div style={{ textAlign: 'right', fontSize: '9px', color: '#666', lineHeight: '1.4' }}>
                  <p style={{ fontWeight: '600' }}>Buy A Warranty Ltd</p>
                  <p>Warranty House, 62 Berkhamsted Ave</p>
                  <p>Wembley, HA9 6DT</p>
                  <p>Company No: 10314863</p>
                </div>
              </div>

              {/* Date */}
              <div style={{ textAlign: 'right', fontSize: '10px', color: '#666', marginBottom: '12px' }}>{todayDate}</div>

              {/* Customer Address */}
              <div style={{ marginBottom: '14px', fontSize: '11px' }}>
                <p style={{ fontWeight: '700', fontSize: '12px', margin: '1px 0' }}>{selectedCustomer.name}</p>
                {address.map((line, i) => (
                  <p key={i} style={{ margin: '1px 0' }}>{line}</p>
                ))}
                <p style={{ margin: '4px 0 0', color: '#666' }}>{selectedCustomer.email}</p>
              </div>

              {/* Title */}
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f', marginBottom: '10px' }}>
                Your Warranty Cover Document
              </h1>

              {/* Warranty Badge */}
              <div style={{ background: 'linear-gradient(135deg, #eb4b00 0%, #ff6b2b 100%)', color: 'white', padding: '8px 16px', borderRadius: '6px', display: 'inline-block', marginBottom: '14px' }}>
                <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', opacity: '0.9' }}>Warranty Reference</div>
                <div style={{ fontSize: '15px', fontWeight: '700', marginTop: '2px' }}>{warrantyRef}</div>
              </div>

              <p style={{ marginBottom: '8px', fontSize: '11px' }}>Dear {selectedCustomer.name.split(' ')[0]},</p>
              <p style={{ marginBottom: '12px', color: '#333', fontSize: '11px' }}>
                Thank you for choosing Buyawarranty to protect your vehicle. Please find below a summary of your warranty cover. Your policy provides protection against the cost of unexpected mechanical or electrical breakdowns, helping you stay on the road with peace of mind.
              </p>

              {/* Your Cover at a Glance */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>Your Cover at a Glance</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Vehicle</span>
                    <span style={{ fontWeight: '600' }}>{selectedCustomer.registration_plate || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Plan Type</span>
                    <span style={{ fontWeight: '600' }}>{planType}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Duration</span>
                    <span style={{ fontWeight: '600' }}>{getDuration()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Mileage</span>
                    <span style={{ fontWeight: '600' }}>{selectedCustomer.mileage ? `${parseInt(selectedCustomer.mileage).toLocaleString()} miles` : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Start Date</span>
                    <span style={{ fontWeight: '600' }}>{format(new Date(selectedPolicy.policy_start_date), 'd MMM yyyy')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>End Date</span>
                    <span style={{ fontWeight: '600' }}>{format(new Date(selectedPolicy.policy_end_date), 'd MMM yyyy')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Warranty Ref</span>
                    <span style={{ fontWeight: '600' }}>{warrantyRef}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Policy No.</span>
                    <span style={{ fontWeight: '600' }}>{selectedPolicy.policy_number}</span>
                  </div>
                </div>
              </div>

              {/* What Your Warranty Includes */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>What Your Warranty Includes</div>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '10px 14px', marginBottom: '8px' }}>
                  <h4 style={{ color: '#166534', fontSize: '12px', marginBottom: '6px', fontWeight: '700' }}>Key Benefits of Your Cover</h4>
                  <ul style={{ margin: '0', paddingLeft: '16px', color: '#15803d', fontSize: '10.5px' }}>
                    <li style={{ marginBottom: '3px' }}>Protection for major mechanical and electrical components</li>
                    {claimLimit && <li style={{ marginBottom: '3px' }}>Claims limit of £{claimLimit.toLocaleString()} per claim</li>}
                    {labourRate && <li style={{ marginBottom: '3px' }}>Labour rate covered up to £{labourRate}/hour</li>}
                    {excess !== undefined && excess !== null && <li style={{ marginBottom: '3px' }}>Voluntary excess of £{excess} per claim</li>}
                    <li style={{ marginBottom: '3px' }}>Access to our trusted UK‑wide repair network</li>
                    <li style={{ marginBottom: '3px' }}>Fast, simple claims process via our dedicated claims team</li>
                    {selectedCustomer.breakdown_recovery && <li style={{ marginBottom: '3px' }}>Breakdown recovery included</li>}
                  </ul>
                </div>

                {addons.length > 0 && (
                  <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '6px', padding: '10px 14px' }}>
                    <h4 style={{ color: '#1e40af', fontSize: '12px', marginBottom: '6px', fontWeight: '700' }}>Additional Included Services</h4>
                    <ul style={{ margin: '0', paddingLeft: '16px', color: '#1d4ed8', fontSize: '10.5px' }}>
                      {addons.map((addon, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}>✓ {addon}</li>
                      ))}
                      {selectedCustomer.seasonal_bonus_months && selectedCustomer.seasonal_bonus_months > 0 && (
                        <li style={{ marginBottom: '3px' }}>✓ Free extended cover — {selectedCustomer.seasonal_bonus_months} bonus month{selectedCustomer.seasonal_bonus_months > 1 ? 's' : ''}</li>
                      )}
                    </ul>
                  </div>
                )}

                <p style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
                  Your full policy booklet (attached) includes a detailed breakdown of inclusions, exclusions, claim procedures, and general conditions. Please keep it somewhere safe for future reference.
                </p>
              </div>

              {/* How to Make a Claim */}
              <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
                <h4 style={{ color: '#92400e', fontSize: '12px', marginBottom: '4px', fontWeight: '700' }}>How to Make a Claim</h4>
                <p style={{ color: '#78350f', fontSize: '10.5px', margin: '2px 0' }}>If your vehicle experiences a fault, simply contact our Claims Team <strong>before</strong> any repairs are carried out so we can authorise the work.</p>
                <p style={{ color: '#78350f', fontSize: '10.5px', margin: '4px 0', fontWeight: '700' }}>Claims Hotline: 0330 229 5045</p>
                <p style={{ color: '#78350f', fontSize: '10.5px', margin: '2px 0' }}>Opening Hours: Monday–Friday, 9am–5pm</p>
                <p style={{ color: '#78350f', fontSize: '10.5px', margin: '4px 0 0' }}>We aim to make claims as smooth and stress‑free as possible. Our team will guide you through each step and liaise with the repairer on your behalf.</p>
              </div>

              {/* Your Account & Policy Documents */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
                <h4 style={{ color: '#1e3a5f', fontSize: '12px', marginBottom: '4px', fontWeight: '700' }}>Your Account &amp; Policy Documents</h4>
                <p style={{ fontSize: '10.5px', color: '#333', margin: '2px 0' }}>You can view or download your policy documents anytime by logging into your Buyawarranty account:</p>
                <p style={{ fontSize: '10.5px', color: '#333', margin: '4px 0' }}><strong>Login:</strong> buyawarranty.co.uk &nbsp; | &nbsp; <strong>Email:</strong> {selectedCustomer.email}</p>
                <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '10px', color: '#555' }}>
                  <li style={{ marginBottom: '2px' }}>View your warranty plan</li>
                  <li style={{ marginBottom: '2px' }}>Download your T&Cs</li>
                  <li style={{ marginBottom: '2px' }}>Check your vehicle details</li>
                  <li style={{ marginBottom: '2px' }}>Manage your contact information</li>
                  <li style={{ marginBottom: '2px' }}>Renew or upgrade your plan when the time comes</li>
                </ul>
              </div>

              {/* We're Here to Help */}
              <p style={{ fontSize: '10.5px', color: '#333', marginBottom: '6px' }}>
                If there's anything you're unsure about, or if you simply want to understand your cover better, we're here for you.
              </p>

              {/* Signature */}
              <div style={{ marginTop: '16px', fontSize: '11px' }}>
                <p style={{ margin: '1px 0' }}>Warm regards,</p>
                <p style={{ margin: '10px 0 1px', fontWeight: '600' }}>The Buyawarranty Team</p>
              </div>

              {/* Contact Footer */}
              <div style={{ marginTop: '18px', paddingTop: '10px', borderTop: '2px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales Enquiries</div>
                  <div style={{ color: '#eb4b00', fontWeight: '600', fontSize: '12px', marginTop: '2px' }}>0330 229 5040</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Claims Hotline</div>
                  <div style={{ color: '#eb4b00', fontWeight: '600', fontSize: '12px', marginTop: '2px' }}>0330 229 5045</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer Support</div>
                  <div style={{ color: '#eb4b00', fontWeight: '600', fontSize: '12px', marginTop: '2px' }}>support@buyawarranty.co.uk</div>
                </div>
              </div>

              {/* Legal Footer */}
              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '8px', color: '#94a3b8', textAlign: 'center' }}>
                Buy A Warranty Ltd is registered in England &amp; Wales. Company No: 10314863.
                Registered Address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
