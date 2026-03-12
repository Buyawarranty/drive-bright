import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, TrendingUp, Package, Car, Search, Globe, PenLine, AlertCircle, Check, Import, RefreshCw, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DealRecord } from '@/hooks/useTimesheets';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  currentMonth?: Date;
}

interface AssignedCustomer {
  id: string;
  name: string;
  registration_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  plan_type: string;
  signup_date: string;
  final_amount: number | null;
  status: string;
}

interface CommissionClaimDeal {
  id: string;
  agent_id: string;
  deal_value: number;
  claim_reason: string;
  status: string;
  created_at: string;
  customer_id: string | null;
}

const proofTypes = [
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'email_confirmation', label: 'Email Confirmation' },
  { value: 'phone_recording', label: 'Phone Recording' },
  { value: 'crm_reference', label: 'CRM Reference' },
  { value: 'customer_confirmation', label: 'Customer Confirmation' },
  { value: 'other', label: 'Other' },
];

export function DealsSection({ deals, onAddDeal, onDeleteDeal, currentMonth }: DealsSectionProps) {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchReg, setSearchReg] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [proofType, setProofType] = useState('');
  const [comment, setComment] = useState('');
  const [assignedCustomers, setAssignedCustomers] = useState<AssignedCustomer[]>([]);
  const [commissionClaims, setCommissionClaims] = useState<CommissionClaimDeal[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Found customer from import search
  const [foundCustomer, setFoundCustomer] = useState<AssignedCustomer | null>(null);

  const month = currentMonth || new Date();
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  // Fetch customers assigned to this agent for the current month
  const fetchAssignedCustomers = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingCustomers(true);
    try {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!adminUser) { setAssignedCustomers([]); return; }

      const { data, error } = await supabase
        .from('customers')
        .select('id, name, registration_plate, vehicle_make, vehicle_model, plan_type, signup_date, final_amount, status')
        .eq('assigned_to', adminUser.id)
        .gte('signup_date', monthStart.toISOString().split('T')[0])
        .lte('signup_date', monthEnd.toISOString().split('T')[0])
        .eq('is_deleted', false)
        .order('signup_date', { ascending: false });

      if (error) throw error;
      setAssignedCustomers((data || []) as AssignedCustomer[]);

      // Fetch approved commission claims for this agent in this month
      const { data: claims } = await supabase
        .from('commission_claims')
        .select('id, agent_id, deal_value, claim_reason, status, created_at, customer_id')
        .eq('agent_id', adminUser.id)
        .in('status', ['approved', 'pending'])
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: false });

      setCommissionClaims((claims || []) as CommissionClaimDeal[]);
    } catch (err) {
      console.error('Error fetching assigned customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  }, [session?.user?.id, monthStart.toISOString(), monthEnd.toISOString()]);

  useEffect(() => {
    fetchAssignedCustomers();
  }, [fetchAssignedCustomers]);

  // Check if a customer is already logged as a deal
  const isDealLogged = (regPlate: string | null) => {
    if (!regPlate) return false;
    const normalized = regPlate.replace(/\s/g, '').toUpperCase();
    return deals.some(d => d.vehicle_reg?.replace(/\s/g, '').toUpperCase() === normalized);
  };

  // Manually added deals (not auto from customers)
  const manualDeals = deals.filter(d => d.notes?.includes('[Source: Manual]'));
  const importedDeals = deals.filter(d => d.notes?.includes('[Source: Import]'));

  const resetForm = () => {
    setSearchReg('');
    setFoundCustomer(null);
    setSearchError('');
    setProofType('');
    setComment('');
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    setIsOpen(open);
  };

  // Search for a customer by reg plate to import as a deal
  const handleSearchReg = async () => {
    if (!searchReg.trim()) return;
    setSearching(true);
    setSearchError('');
    setFoundCustomer(null);

    const normalizedSearch = searchReg.replace(/\s/g, '').toUpperCase();

    try {
      // Check if already logged
      if (isDealLogged(normalizedSearch)) {
        setSearchError('This deal has already been logged.');
        return;
      }

      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, registration_plate, vehicle_make, vehicle_model, plan_type, signup_date, final_amount, status')
        .ilike('registration_plate', `%${normalizedSearch}%`)
        .eq('is_deleted', false)
        .limit(5);

      if (error) throw error;

      if (customers && customers.length > 0) {
        setFoundCustomer(customers[0] as AssignedCustomer);
      } else {
        setSearchError('No matching vehicle found. Check the registration and try again.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!foundCustomer) return;
    if (!proofType) {
      toast.error('Please select a proof type');
      return;
    }
    const notes = `[Source: Import] [Proof: ${proofType}]${comment ? ` ${comment}` : ''}`;
    await onAddDeal(
      0,
      new Date(foundCustomer.signup_date),
      foundCustomer.plan_type,
      foundCustomer.name,
      foundCustomer.registration_plate || '',
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
              <p className="text-sm text-gray-500">Evidence — {format(month, 'MMM yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchAssignedCustomers} disabled={loadingCustomers}>
              <RefreshCw className={cn("h-4 w-4", loadingCustomers && "animate-spin")} />
            </Button>
            <Dialog open={isOpen} onOpenChange={handleClose}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600">
                  <Import className="h-4 w-4" />
                  Import Deal
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Import Deal by Registration</DialogTitle>
                </DialogHeader>
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

                  {foundCustomer && (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium text-emerald-700">Vehicle Found</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-500">Reg:</span> <strong>{foundCustomer.registration_plate}</strong></div>
                          <div><span className="text-gray-500">Vehicle:</span> <strong>{foundCustomer.vehicle_make} {foundCustomer.vehicle_model}</strong></div>
                          <div><span className="text-gray-500">Customer:</span> <strong>{foundCustomer.name}</strong></div>
                          <div><span className="text-gray-500">Plan:</span> <strong className="capitalize">{foundCustomer.plan_type}</strong></div>
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
                        Confirm Import
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 p-5 border-b bg-gray-50">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{assignedCustomers.length}</div>
          <div className="text-xs text-gray-500">Assigned Deals</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">{deals.length}</div>
          <div className="text-xs text-gray-500">Logged</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{importedDeals.length + manualDeals.length}</div>
          <div className="text-xs text-gray-500">Imported</div>
        </div>
      </div>

      {/* Auto-populated deals from customer dashboard */}
      <div className="max-h-[400px] overflow-y-auto">
        {loadingCustomers ? (
          <div className="p-8 text-center text-gray-400">
            <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading your deals...</p>
          </div>
        ) : assignedCustomers.length === 0 && deals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No deals this month</p>
            <p className="text-xs mt-1">Deals from your customer dashboard will appear here automatically</p>
          </div>
        ) : (
          <div className="divide-y">
            {/* Assigned customers (auto-populated from dashboard) */}
            {assignedCustomers.map((customer) => {
              const logged = isDealLogged(customer.registration_plate);
              return (
                <div key={customer.id} className={cn("p-4 flex items-center justify-between", logged ? 'bg-green-50/50' : 'hover:bg-gray-50')}>
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', logged ? 'bg-green-100' : 'bg-gray-100')}>
                      <Car className={cn('h-4 w-4', logged ? 'text-green-600' : 'text-gray-500')} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm tracking-wide">
                          {customer.registration_plate || 'No Reg'}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
                          {customer.plan_type}
                        </Badge>
                        {logged && (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5 py-0 gap-0.5">
                            <Check className="h-2.5 w-2.5" />
                            Logged
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {customer.vehicle_make} {customer.vehicle_model} • {customer.name}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {format(new Date(customer.signup_date), 'dd MMM yyyy')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Additional imported/manual deals not in assigned list */}
            {deals.filter(d => {
              const reg = d.vehicle_reg?.replace(/\s/g, '').toUpperCase();
              return !assignedCustomers.some(c => c.registration_plate?.replace(/\s/g, '').toUpperCase() === reg);
            }).map((deal) => (
              <div key={deal.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Import className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm tracking-wide">
                        {deal.vehicle_reg || 'No Reg'}
                      </span>
                      {deal.plan_type && (
                        <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
                          {deal.plan_type}
                        </Badge>
                      )}
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] px-1.5 py-0">
                        Imported
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(deal.deal_date), 'dd MMM yyyy')}
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
            ))}

            {/* Commission Claimed Deals */}
            {commissionClaims.length > 0 && (
              <>
                <div className="px-4 py-2 bg-amber-50 border-y border-amber-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <Award className="h-3.5 w-3.5" />
                    Commission Claims ({commissionClaims.length})
                  </div>
                </div>
                {commissionClaims.map((claim) => (
                  <div key={claim.id} className="p-4 flex items-center justify-between bg-amber-50/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100">
                        <Award className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">
                            Commission Claim
                          </span>
                          <Badge className={cn(
                            "text-[10px] px-1.5 py-0",
                            claim.status === 'approved' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {claim.status === 'approved' ? 'Approved' : 'Pending'}
                          </Badge>
                          {claim.deal_value > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              £{claim.deal_value.toLocaleString()}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {claim.claim_reason.replace('_', ' ')} • {format(new Date(claim.created_at), 'dd MMM yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
