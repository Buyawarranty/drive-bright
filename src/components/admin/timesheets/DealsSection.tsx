import React, { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, TrendingUp, Package, Car, Search, Globe, PenLine, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DealRecord } from '@/hooks/useTimesheets';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DealsSectionProps {
  deals: DealRecord[];
  onAddDeal: (
    dealValue: number,
    dealDate: Date,
    planType?: string,
    customerName?: string,
    vehicleReg?: string,
    notes?: string
  ) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
}

const proofTypes = [
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'email_confirmation', label: 'Email Confirmation' },
  { value: 'phone_recording', label: 'Phone Recording' },
  { value: 'crm_reference', label: 'CRM Reference' },
  { value: 'customer_confirmation', label: 'Customer Confirmation' },
  { value: 'other', label: 'Other' },
];

interface WebsiteDeal {
  id: string;
  vehicleReg: string;
  make: string;
  model: string;
  customerName: string;
  planType: string;
  dateOfSale: string;
  amount: number;
}

export function DealsSection({ deals, onAddDeal, onDeleteDeal }: DealsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'choose' | 'import' | 'manual'>('choose');
  const [searchReg, setSearchReg] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundDeal, setFoundDeal] = useState<WebsiteDeal | null>(null);
  const [searchError, setSearchError] = useState('');
  const [proofType, setProofType] = useState('');
  const [comment, setComment] = useState('');

  // Manual form
  const [manualData, setManualData] = useState({
    vehicleReg: '',
    planType: '',
    proofType: '',
    comment: '',
  });

  const websiteDeals = deals.filter(d => d.notes?.includes('[Source: Website]'));
  const manualDeals = deals.filter(d => !d.notes?.includes('[Source: Website]'));

  const resetForm = () => {
    setStep('choose');
    setSearchReg('');
    setFoundDeal(null);
    setSearchError('');
    setProofType('');
    setComment('');
    setManualData({ vehicleReg: '', planType: '', proofType: '', comment: '' });
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    setIsOpen(open);
  };

  const handleSearchReg = async () => {
    if (!searchReg.trim()) return;
    setSearching(true);
    setSearchError('');
    setFoundDeal(null);

    try {
      // Search customer_policies for a matching vehicle
      const { data, error } = await supabase
        .from('customer_policies')
        .select('id, email, customer_full_name, plan_type, policy_start_date, payment_amount, status')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Also search customers table by vehicle reg
      const { data: customers, error: custErr } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate, vehicle_make, vehicle_model')
        .ilike('registration_plate', `%${searchReg.replace(/\s/g, '')}%`)
        .limit(5);

      if (custErr) throw custErr;

      if (customers && customers.length > 0) {
        const c = customers[0];
        // Check if already logged
        const alreadyLogged = deals.some(d =>
          d.vehicle_reg?.replace(/\s/g, '').toUpperCase() === searchReg.replace(/\s/g, '').toUpperCase()
        );
        if (alreadyLogged) {
          setSearchError('This deal has already been logged for you.');
          return;
        }

        setFoundDeal({
          id: c.id,
          vehicleReg: c.registration_plate || searchReg,
          make: c.vehicle_make || 'N/A',
          model: c.vehicle_model || 'N/A',
          customerName: c.name || 'N/A',
          planType: 'Standard',
          dateOfSale: new Date().toISOString(),
          amount: 0,
        });
      } else {
        setSearchError('No matching vehicle found. Try a different registration or add manually.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!foundDeal || !proofType) {
      toast.error('Please select a proof type');
      return;
    }
    const notes = `[Source: Website] [Proof: ${proofType}]${comment ? ` ${comment}` : ''}`;
    await onAddDeal(
      0, // No value - payroll handles
      new Date(),
      foundDeal.planType,
      foundDeal.customerName,
      foundDeal.vehicleReg,
      notes
    );
    handleClose(false);
  };

  const handleManualSubmit = async () => {
    if (!manualData.vehicleReg.trim()) {
      toast.error('Please enter a registration plate');
      return;
    }
    if (!manualData.proofType) {
      toast.error('Please select a proof type');
      return;
    }
    const notes = `[Source: Manual] [Proof: ${manualData.proofType}]${manualData.comment ? ` ${manualData.comment}` : ''}`;
    await onAddDeal(
      0,
      new Date(),
      manualData.planType || undefined,
      undefined,
      manualData.vehicleReg.toUpperCase(),
      notes
    );
    handleClose(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <div className="p-5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Your Deals</h3>
              <p className="text-sm text-gray-500">This month's sales</p>
            </div>
          </div>
          <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600">
                <Plus className="h-4 w-4" />
                Add Deal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {step === 'choose' && 'Add a Deal'}
                  {step === 'import' && 'Import from Website'}
                  {step === 'manual' && 'Add Deal Manually'}
                </DialogTitle>
              </DialogHeader>

              {/* Step 1: Choose type */}
              {step === 'choose' && (
                <div className="space-y-3 mt-4">
                  <p className="text-sm text-gray-500">How would you like to add the deal?</p>
                  <button
                    onClick={() => setStep('import')}
                    className="w-full flex items-center gap-4 p-4 border-2 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left"
                  >
                    <div className="p-2.5 bg-emerald-100 rounded-lg">
                      <Globe className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Import from Website</div>
                      <div className="text-xs text-gray-500">Search by registration plate</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setStep('manual')}
                    className="w-full flex items-center gap-4 p-4 border-2 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="p-2.5 bg-blue-100 rounded-lg">
                      <PenLine className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Add Manually</div>
                      <div className="text-xs text-gray-500">Enter deal details yourself</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 2A: Import from Website */}
              {step === 'import' && (
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm">Search Registration Plate</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={searchReg}
                        onChange={(e) => setSearchReg(e.target.value.toUpperCase())}
                        placeholder="e.g. AB12 CDE"
                        className="flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchReg()}
                      />
                      <Button onClick={handleSearchReg} disabled={searching} className="gap-1.5">
                        <Search className="h-4 w-4" />
                        {searching ? 'Searching...' : 'Search'}
                      </Button>
                    </div>
                  </div>

                  {searchError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {searchError}
                    </div>
                  )}

                  {foundDeal && (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium text-emerald-700">Vehicle Found</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-500">Reg:</span> <strong>{foundDeal.vehicleReg}</strong></div>
                          <div><span className="text-gray-500">Make/Model:</span> <strong>{foundDeal.make} {foundDeal.model}</strong></div>
                          <div><span className="text-gray-500">Customer:</span> <strong>{foundDeal.customerName}</strong></div>
                          <div><span className="text-gray-500">Plan:</span> <strong>{foundDeal.planType}</strong></div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm">Proof Type <span className="text-red-500">*</span></Label>
                        <Select value={proofType} onValueChange={setProofType}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select proof type" />
                          </SelectTrigger>
                          <SelectContent>
                            {proofTypes.map(p => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm">Comment (optional)</Label>
                        <Textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Add any notes..."
                          className="mt-1 h-16 resize-none"
                        />
                      </div>

                      <Button onClick={handleConfirmImport} className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
                        <Check className="h-4 w-4" />
                        Confirm Deal
                      </Button>
                    </div>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => setStep('choose')} className="text-gray-500">
                    ← Back
                  </Button>
                </div>
              )}

              {/* Step 2B: Manual Entry */}
              {step === 'manual' && (
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm">Registration Plate <span className="text-red-500">*</span></Label>
                    <Input
                      value={manualData.vehicleReg}
                      onChange={(e) => setManualData(prev => ({ ...prev, vehicleReg: e.target.value.toUpperCase() }))}
                      placeholder="e.g. AB12 CDE"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Warranty Type</Label>
                    <Select value={manualData.planType} onValueChange={(v) => setManualData(prev => ({ ...prev, planType: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="platinum">Platinum</SelectItem>
                        <SelectItem value="ev">EV</SelectItem>
                        <SelectItem value="phev">PHEV</SelectItem>
                        <SelectItem value="motorbike">Motorbike</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm">Proof Type <span className="text-red-500">*</span></Label>
                    <Select value={manualData.proofType} onValueChange={(v) => setManualData(prev => ({ ...prev, proofType: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select proof type" />
                      </SelectTrigger>
                      <SelectContent>
                        {proofTypes.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm">Comment (optional)</Label>
                    <Textarea
                      value={manualData.comment}
                      onChange={(e) => setManualData(prev => ({ ...prev, comment: e.target.value }))}
                      placeholder="Add any notes..."
                      className="mt-1 h-16 resize-none"
                    />
                  </div>

                  <Button onClick={handleManualSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
                    <Check className="h-4 w-4" />
                    Confirm Deal
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => setStep('choose')} className="text-gray-500">
                    ← Back
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 p-5 border-b bg-gray-50">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{deals.length}</div>
          <div className="text-xs text-gray-500">Total Deals</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">{websiteDeals.length}</div>
          <div className="text-xs text-gray-500">Website Imports</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{manualDeals.length}</div>
          <div className="text-xs text-gray-500">Manual Deals</div>
        </div>
      </div>

      {/* Deals List */}
      <div className="max-h-[300px] overflow-y-auto">
        {deals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No deals recorded this month</p>
            <p className="text-xs mt-1">Click "Add Deal" to record your first sale</p>
          </div>
        ) : (
          <div className="divide-y">
            {deals.map((deal) => {
              const isWebsite = deal.notes?.includes('[Source: Website]');
              return (
                <div key={deal.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', isWebsite ? 'bg-emerald-100' : 'bg-blue-100')}>
                      {isWebsite ? (
                        <Globe className={cn('h-4 w-4 text-emerald-600')} />
                      ) : (
                        <Car className={cn('h-4 w-4 text-blue-600')} />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {deal.vehicle_reg || 'No Reg'}
                        {deal.plan_type && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 rounded-full capitalize">
                            {deal.plan_type}
                          </span>
                        )}
                        <span className={cn('ml-2 text-xs px-2 py-0.5 rounded-full', isWebsite ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                          {isWebsite ? 'Website' : 'Manual'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(deal.deal_date), 'd MMM')}
                        {deal.customer_name && ` • ${deal.customer_name}`}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDeleteDeal(deal.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
