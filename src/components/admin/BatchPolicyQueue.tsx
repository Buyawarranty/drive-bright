import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Search, Printer, FileText, Tag, X, Users, Plus, Mail, Car, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';

interface QueuedCustomer {
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
  // policy data joined
  policy?: {
    id: string;
    policy_number: string;
    policy_start_date: string;
    policy_end_date: string;
    plan_type: string;
    warranty_number?: string;
    claim_limit?: number;
    voluntary_excess?: number;
    payment_type: string;
    additional_notes?: string;
    seasonal_bonus_months?: number | null;
  };
}

export const BatchPolicyQueue: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [queue, setQueue] = useState<QueuedCustomer[]>([]);
  const [printMode, setPrintMode] = useState<'bw' | 'colour'>('bw');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search customers
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const q = searchQuery.trim();
      const cleanReg = q.replace(/\s/g, '').toUpperCase();

      const { data } = await supabase
        .from('customers')
        .select('id, name, email, phone, registration_plate, warranty_number, warranty_reference_number, plan_type, vehicle_make, vehicle_model')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,registration_plate.ilike.%${cleanReg}%`)
        .limit(20);

      setSearchResults(data || []);
      setIsSearching(false);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addToQueue = async (customer: any) => {
    // Check if already in queue
    if (queue.find(q => q.id === customer.id)) {
      toast({ title: 'Already in queue', description: `${customer.name} is already in the batch queue.` });
      setShowDropdown(false);
      setSearchQuery('');
      return;
    }

    // Fetch full customer data + policy
    const [{ data: fullCustomer }, { data: policies }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customer.id).single(),
      supabase.from('customer_policies').select('*').ilike('email', customer.email).or('is_deleted.is.null,is_deleted.eq.false').order('created_at', { ascending: false }).limit(1),
    ]);

    if (fullCustomer) {
      const entry: QueuedCustomer = {
        ...fullCustomer,
        policy: policies?.[0] || undefined,
      };
      setQueue(prev => [...prev, entry]);
      toast({ title: 'Added to batch', description: `${customer.name} added to queue.` });

      // Log to posted letters log
      try {
        await supabase.from('posted_letters_log').insert({
          customer_id: customer.id,
          registration_plate: customer.registration_plate || 'N/A',
          customer_name: customer.name,
          customer_email: customer.email,
          warranty_number: customer.warranty_number || customer.warranty_reference_number || null,
          plan_type: customer.plan_type,
          action_type: 'batch',
          notes: 'Added to batch queue',
        } as any);
      } catch (e) { /* silent */ }
    }

    setShowDropdown(false);
    setSearchQuery('');
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const clearQueue = () => setQueue([]);

  const formatAddress = (c: QueuedCustomer) => {
    return [
      c.flat_number && `Flat ${c.flat_number}`,
      c.building_name,
      c.building_number && c.street ? `${c.building_number} ${c.street}` : c.street,
      c.town,
      c.county,
      c.postcode,
    ].filter(Boolean) as string[];
  };

  // Batch print labels (2x4 grid per page)
  const handleBatchPrintLabels = () => {
    if (queue.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Allow pop-ups'); return; }

    const labels = queue.map(c => {
      const lines = [c.name, ...formatAddress(c)].filter(Boolean);
      return `<div class="label">${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
    });

    // Pad to fill last page (8 per page)
    while (labels.length % 8 !== 0) {
      labels.push('<div class="label"></div>');
    }

    const pages: string[] = [];
    for (let i = 0; i < labels.length; i += 8) {
      pages.push(`<div class="page">${labels.slice(i, i + 8).join('')}</div>`);
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Batch Labels</title><style>
      @page { size: A4; margin: 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; }
      .page { width: 190mm; height: 277mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, 1fr); gap: 4mm; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .label { border: 1px dashed #ccc; padding: 8mm; display: flex; flex-direction: column; justify-content: center; font-size: 13pt; line-height: 1.5; font-weight: 500; }
      .label p { margin: 0; }
      @media print { .label { border: none; } }
    </style></head><body>${pages.join('')}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);

    // Log all
    logBatchAction('label');
  };

  // Batch print Brother QL labels (29mm x 90mm, one per page)
  const handleBatchPrintBrotherLabels = () => {
    if (queue.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Allow pop-ups'); return; }

    const labels = queue.map(c => {
      const lines = [c.name, ...formatAddress(c)].filter(Boolean);
      return `<div class="label">${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
    });

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Brother QL Labels</title><style>
      @page { size: 90mm 29mm; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; }
      .label { width: 90mm; height: 29mm; padding: 1.5mm 3mm; display: flex; flex-direction: column; justify-content: center; font-size: 7pt; line-height: 1.35; font-weight: 600; page-break-after: always; overflow: hidden; }
      .label:last-child { page-break-after: auto; }
      .label p { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    </style></head><body>${labels.join('')}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);

    logBatchAction('label');
  };

  // Batch print letters
  const handleBatchPrintLetters = () => {
    if (queue.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Allow pop-ups'); return; }

    const isBW = printMode === 'bw';
    const letterPages = queue.map(c => buildLetterHTML(c, isBW)).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Batch Letters</title><style>
      @page { size: A4; margin: 15mm 18mm; margin-top: 0; margin-bottom: 0; }
      @media print { @page { margin-top: 0; margin-bottom: 0; } body { margin-top: 0; } .letter-page { page-break-after: always; padding-top: 15mm; } .letter-page:last-child { page-break-after: auto; } }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5; background: white; font-size: 11px; }
      .letter-page { max-width: 210mm; margin: 0 auto; page-break-after: always; padding: 15mm 0; }
      .letter-page:last-child { page-break-after: auto; }
      ${isBW ? '' : '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'}
    </style></head><body>${letterPages}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);

    logBatchAction('print');
  };

  const handleBatchPrintBoth = () => {
    handleBatchPrintLabels();
    setTimeout(() => handleBatchPrintLetters(), 1000);
  };

  const logBatchAction = async (type: string) => {
    try {
      const inserts = queue.map(c => ({
        customer_id: c.id,
        registration_plate: c.registration_plate || 'N/A',
        customer_name: c.name,
        customer_email: c.email,
        warranty_number: c.policy?.warranty_number || c.warranty_number || c.warranty_reference_number || null,
        plan_type: c.policy?.plan_type || c.plan_type || null,
        sent_at: new Date().toISOString(),
        action_type: `batch_${type}`,
        notes: `Batch ${type} — ${queue.length} customers`,
      }));
      await supabase.from('posted_letters_log').insert(inserts as any);
    } catch (e) { /* silent */ }
  };

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Batch Print Queue
            {queue.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">{queue.length}</span>
            )}
          </CardTitle>
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
            {queue.length > 0 && (
              <Button size="sm" variant="ghost" onClick={clearQueue} className="text-destructive hover:text-destructive text-xs gap-1">
                <Trash2 className="h-3.5 w-3.5" /> Clear All
              </Button>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-sm">Search and add multiple customers, then batch print labels, letters, or both.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search to add */}
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search to add customer to batch..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setShowDropdown(true); }}
              onFocus={() => { if (searchQuery) setShowDropdown(true); }}
              className="pl-10"
            />
          </div>
          {showDropdown && searchQuery.trim() && (
            <div className="absolute z-50 mt-1 w-full bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="px-4 py-4 text-center text-sm text-muted-foreground">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-4 text-center text-sm text-muted-foreground">No customers found</div>
              ) : (
                searchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => addToQueue(c)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between border-b last:border-b-0 ${queue.find(q => q.id === c.id) ? 'opacity-40' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {c.registration_plate && (
                        <span className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono font-semibold">{c.registration_plate}</span>
                      )}
                      {queue.find(q => q.id === c.id) ? (
                        <span className="text-xs text-muted-foreground">Added</span>
                      ) : (
                        <Plus className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Queue list */}
        {queue.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">#</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Reg</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Warranty #</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Address</th>
                  <th className="py-2 px-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {queue.map((c, i) => (
                  <tr key={c.id} className="border-b hover:bg-muted/20">
                    <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-xs">{c.registration_plate || '—'}</span>
                    </td>
                    <td className="py-2 px-3 text-xs">{c.policy?.plan_type || c.plan_type || '—'}</td>
                    <td className="py-2 px-3 text-xs font-mono">{c.policy?.warranty_number || c.warranty_number || c.warranty_reference_number || '—'}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground truncate max-w-[200px]">{formatAddress(c).join(', ') || 'No address'}</td>
                    <td className="py-2 px-3">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeFromQueue(c.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Batch action buttons */}
        {queue.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={handleBatchPrintLabels} variant="secondary" className="gap-2 bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300">
              <Tag className="h-4 w-4" />
              🏷️ Envelope Labels ({queue.length})
            </Button>
            <Button onClick={handleBatchPrintBrotherLabels} variant="secondary" className="gap-2 bg-purple-100 text-purple-900 hover:bg-purple-200 border border-purple-300">
              <Tag className="h-4 w-4" />
              🖨️ Brother QL Labels ({queue.length})
            </Button>
            <Button onClick={handleBatchPrintLetters} className="gap-2">
              <FileText className="h-4 w-4" />
              Print All Letters ({queue.length})
            </Button>
            <Button onClick={handleBatchPrintBoth} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Print Labels + Letters
            </Button>
          </div>
        )}

        {queue.length === 0 && (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Search above to add customers to the batch queue. You can then print all their labels and/or letters in one go.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// Build a single letter page HTML for batch printing
function buildLetterHTML(c: QueuedCustomer, isBW: boolean): string {
  const col = {
    accent: isBW ? '#333' : '#eb4b00',
    accentGrad: isBW ? '#333' : 'linear-gradient(135deg, #eb4b00 0%, #ff6b2b 100%)',
    heading: isBW ? '#000' : '#1e3a5f',
    border: isBW ? '#999' : '#e2e8f0',
    borderAccent: isBW ? '#333' : '#eb4b00',
    glanceBg: isBW ? '#f5f5f5' : '#f8fafc',
    glanceBorder: isBW ? '#ccc' : '#e2e8f0',
    benefitsBg: isBW ? '#f5f5f5' : '#f0fdf4',
    benefitsBorder: isBW ? '#aaa' : '#86efac',
    benefitsHeading: isBW ? '#000' : '#166534',
    benefitsText: isBW ? '#333' : '#15803d',
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

  const policy = c.policy;
  const address = [
    c.flat_number && `Flat ${c.flat_number}`,
    c.building_name,
    c.building_number && c.street ? `${c.building_number} ${c.street}` : c.street,
    c.town,
    c.county,
    c.postcode,
  ].filter(Boolean);

  const warrantyRef = policy?.warranty_number || c.warranty_number || c.warranty_reference_number || 'N/A';
  const planType = policy?.plan_type || c.plan_type || 'N/A';
  const claimLimit = policy?.claim_limit || c.claim_limit;
  const excess = policy?.voluntary_excess ?? c.voluntary_excess;
  const labourRate = c.labour_rate;
  const todayDate = format(new Date(), 'd MMMM yyyy');

  const addons: string[] = [];
  if (c.wear_tear) addons.push('Wear & Tear Cover');
  if (c.europe_cover) addons.push('European Cover');
  if (c.mot_repair) addons.push('MOT Repair Cover');
  if (c.tyre_cover) addons.push('Tyre Cover');
  if (c.lost_key) addons.push('Lost Key Cover');
  if (c.vehicle_rental) addons.push('Vehicle Rental Cover');
  if (c.transfer_cover) addons.push('Transfer Cover');
  if (c.consequential) addons.push('Consequential Loss Cover');

  const bonusMonths = Number(policy?.seasonal_bonus_months ?? c.seasonal_bonus_months ?? 0);

  const getDuration = () => {
    if (!policy) return 'N/A';
    const start = new Date(policy.policy_start_date);
    const end = new Date(policy.policy_end_date);
    if (bonusMonths > 0) end.setMonth(end.getMonth() + bonusMonths);
    const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (bonusMonths > 0) return `${months} Months`;
    if (months >= 36) return '3 Years';
    if (months >= 24) return '2 Years';
    if (months >= 12) return '1 Year';
    return `${months} Months`;
  };

  const endDate = (() => {
    if (!policy) return 'N/A';
    const d = new Date(policy.policy_end_date);
    if (bonusMonths > 0) d.setMonth(d.getMonth() + bonusMonths);
    return format(d, 'd MMM yyyy');
  })();

  const claimLimitDisplay = claimLimit ? `£${getDisplayClaimLimitValue(claimLimit).toLocaleString()}` : '';

  return `<div class="letter-page">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid ${col.borderAccent};margin-bottom:14px">
      <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="BAW" style="height:40px;${isBW ? 'filter:grayscale(100%)' : ''}" />
      <div style="text-align:right;font-size:9px;color:#666;line-height:1.4">
        <p style="font-weight:600">Buy A Warranty Ltd</p><p>Warranty House, 62 Berkhamsted Ave</p><p>Wembley, HA9 6DT</p><p>Company No: 10314863</p>
      </div>
    </div>
    <div style="text-align:right;font-size:10px;color:#666;margin-bottom:12px">${todayDate}</div>
    <div style="margin-bottom:14px;font-size:11px">
      <p style="font-weight:700;font-size:11px;margin:1px 0">${c.name}</p>
      ${address.map(l => `<p style="margin:1px 0">${l}</p>`).join('')}
      <p style="margin:4px 0 0;color:#666">${c.email}</p>
    </div>
    <h1 style="font-size:18px;font-weight:700;color:${col.heading};margin-bottom:10px">Your Warranty Cover Document</h1>
    <div style="background:${isBW ? '#333' : col.accentGrad};color:white;padding:8px 16px;border-radius:6px;display:inline-block;margin-bottom:14px">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;opacity:0.9">Warranty Reference</div>
      <div style="font-size:15px;font-weight:700;margin-top:2px">${warrantyRef}</div>
    </div>
    <p style="margin-bottom:8px;font-size:11px">Dear ${c.name.split(' ')[0]},</p>
    <p style="margin-bottom:12px;color:#333;font-size:11px">Thank you for choosing Buyawarranty to protect your vehicle. Please find below a summary of your warranty cover.</p>
    ${policy ? `<div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:${col.heading};margin-bottom:8px;border-bottom:2px solid ${col.border};padding-bottom:4px">Your Cover at a Glance</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;background:${col.glanceBg};border:1px solid ${col.glanceBorder};border-radius:6px;padding:12px 14px">
        ${[
          ['Vehicle', c.registration_plate || '-'],
          ['Plan Type', planType],
          ['Duration', getDuration()],
          ['Mileage', c.mileage ? `${parseInt(c.mileage).toLocaleString()} miles` : 'N/A'],
          ['Start Date', format(new Date(policy.policy_start_date), 'd MMM yyyy')],
          ['End Date', endDate],
          ['Warranty Ref', warrantyRef],
          ['Policy No.', policy.policy_number],
        ].map(([label, value]) => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${col.divider}"><span style="color:${col.muted};font-weight:500">${label}</span><span style="font-weight:600">${value}</span></div>`).join('')}
      </div>
    </div>` : ''}
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:${col.heading};margin-bottom:8px;border-bottom:2px solid ${col.border};padding-bottom:4px">What Your Warranty Includes</div>
      <div style="background:${col.benefitsBg};border:1px solid ${col.benefitsBorder};border-radius:6px;padding:10px 14px;margin-bottom:8px">
        <h4 style="color:${col.benefitsHeading};font-size:12px;margin-bottom:6px;font-weight:700">Key Benefits</h4>
        <ul style="margin:0;padding-left:16px;color:${col.benefitsText};font-size:10.5px">
          <li style="margin-bottom:3px">Protection for major mechanical and electrical components</li>
          ${claimLimitDisplay ? `<li style="margin-bottom:3px">Claims limit of ${claimLimitDisplay} per claim</li>` : ''}
          ${labourRate ? `<li style="margin-bottom:3px">Labour rate covered up to £${labourRate}/hour</li>` : ''}
          ${excess !== undefined && excess !== null ? `<li style="margin-bottom:3px">Voluntary excess of £${excess} per claim</li>` : ''}
          <li style="margin-bottom:3px">Access to trusted UK-wide VAT registered repair garages</li>
          <li style="margin-bottom:3px">Fast, simple claims process via our dedicated claims team</li>
          ${c.breakdown_recovery ? '<li style="margin-bottom:3px">Breakdown recovery claimback</li>' : ''}
        </ul>
      </div>
      ${addons.length > 0 || bonusMonths > 0 ? `<div style="background:${isBW ? '#f5f5f5' : '#eff6ff'};border:1px solid ${isBW ? '#aaa' : '#93c5fd'};border-radius:6px;padding:10px 14px">
        <h4 style="color:${isBW ? '#000' : '#1e40af'};font-size:12px;margin-bottom:6px;font-weight:700">Additional Included Services</h4>
        <ul style="margin:0;padding-left:16px;color:${isBW ? '#333' : '#1d4ed8'};font-size:10.5px">
          ${addons.map(a => `<li style="margin-bottom:3px">✓ ${a}</li>`).join('')}
          ${bonusMonths > 0 ? `<li style="margin-bottom:3px">✓ Free extended cover: ${bonusMonths} bonus month${bonusMonths > 1 ? 's' : ''}</li>` : ''}
        </ul>
      </div>` : ''}
    </div>
    ${(policy as any)?.additional_notes?.trim() ? `<div style="background:${isBW ? '#f5f5f5' : '#fef9ee'};border:2px solid ${isBW ? '#666' : '#f59e0b'};border-radius:6px;padding:12px 14px;margin-bottom:14px">
      <h4 style="color:${isBW ? '#000' : '#92400e'};font-size:13px;margin-bottom:6px;font-weight:700">⭐ Important Notes About Your Cover</h4>
      <p style="color:${isBW ? '#333' : '#78350f'};font-size:11px;margin:0;white-space:pre-wrap;line-height:1.5">${(policy as any).additional_notes}</p>
    </div>` : ''}
    <div style="background:${col.claimsBg};border:1px solid ${col.claimsBorder};border-radius:6px;padding:10px 14px;margin-bottom:14px">
      <h4 style="color:${col.claimsHeading};font-size:12px;margin-bottom:4px;font-weight:700">How to Make a Claim</h4>
      <p style="color:${col.claimsText};font-size:10.5px;margin:2px 0">Contact our Claims Team <strong>before</strong> any repairs are carried out.</p>
      <p style="color:${col.claimsText};font-size:10.5px;margin:4px 0;font-weight:700">Claims Hotline: 0330 229 5045</p>
      <p style="color:${col.claimsText};font-size:10.5px;margin:2px 0">Mon–Fri, 9am–5pm</p>
    </div>
    <div style="background:${col.accountBg};border:1px solid ${col.accountBorder};border-radius:6px;padding:10px 14px;margin-bottom:14px">
      <h4 style="color:${col.accountHeading};font-size:12px;margin-bottom:4px;font-weight:700">Your Account &amp; Policy Documents</h4>
      <p style="font-size:10.5px;color:#333;margin:2px 0">Access your documents online:</p>
      <p style="font-size:11px;color:${col.contactValue};margin:6px 0;font-weight:700">https://buyawarranty.co.uk/customer-dashboard/</p>
      <p style="font-size:10.5px;color:#333;margin:4px 0"><strong>Email:</strong> ${c.email}</p>
    </div>
    <div style="margin-top:16px;font-size:11px"><p style="margin:1px 0">Warm regards,</p><p style="margin:10px 0 1px;font-weight:600">The Buyawarranty Team</p></div>
    <div style="margin-top:18px;padding-top:10px;border-top:2px solid ${col.border};display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:10px">
      <div style="text-align:center"><div style="color:${col.muted};font-size:8px;text-transform:uppercase;letter-spacing:0.5px">Sales</div><div style="color:${col.contactValue};font-weight:600;font-size:12px;margin-top:2px">0330 229 5040</div></div>
      <div style="text-align:center"><div style="color:${col.muted};font-size:8px;text-transform:uppercase;letter-spacing:0.5px">Claims</div><div style="color:${col.contactValue};font-weight:600;font-size:12px;margin-top:2px">0330 229 5045</div></div>
      <div style="text-align:center"><div style="color:${col.muted};font-size:8px;text-transform:uppercase;letter-spacing:0.5px">Support</div><div style="color:${col.contactValue};font-weight:600;font-size:12px;margin-top:2px">support@buyawarranty.co.uk</div></div>
    </div>
    <div style="margin-top:12px;padding-top:8px;border-top:1px solid ${col.border};font-size:8px;color:${col.legal};text-align:center">Buy A Warranty Ltd — Company No: 10314863 — Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT</div>
  </div>`;
}
