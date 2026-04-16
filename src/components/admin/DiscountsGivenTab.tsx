import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from './DateRangeFilter';
import { DateRange } from 'react-day-picker';
import { calculateTotalWarrantyPrice, DURATION_MONTHS, type PaymentPeriod } from '@/lib/pricingMatrix';
import { calculateAddOnPrice, normalizePaymentType } from '@/lib/addOnsUtils';
import { format } from 'date-fns';
import { TrendingDown, TrendingUp, PoundSterling, Percent, Users } from 'lucide-react';

interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  registration_plate: string | null;
  plan_type: string;
  payment_type: string | null;
  final_amount: number | null;
  voluntary_excess: number | null;
  claim_limit: number | null;
  labour_rate: number | null;
  assigned_to: string | null;
  signup_date: string;
  status: string;
  discount_code: string | null;
  discount_amount: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  // Add-ons
  tyre_cover: boolean | null;
  wear_tear: boolean | null;
  europe_cover: boolean | null;
  transfer_cover: boolean | null;
  breakdown_recovery: boolean | null;
  vehicle_rental: boolean | null;
  mot_fee: boolean | null;
  mot_repair: boolean | null;
  lost_key: boolean | null;
  consequential: boolean | null;
  warranty_reference_number: string | null;
}

interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

// Calculate the retail price based on the customer's chosen cover
function calculateRetailPrice(customer: CustomerRecord): number | null {
  const paymentType = normalizePaymentType(customer.payment_type) as PaymentPeriod;
  const excess = customer.voluntary_excess ?? 100;
  const claimLimit = customer.claim_limit ?? 1250;
  const labourRate = customer.labour_rate ?? 70;
  const durationMonths = DURATION_MONTHS[paymentType] || 12;

  // Calculate base warranty price
  const { totalPrice: baseTotal } = calculateTotalWarrantyPrice({
    paymentPeriod: paymentType,
    voluntaryExcess: excess,
    claimLimit: claimLimit,
    labourRate: labourRate,
    boostEnabled: false,
    vehicleAdjustment: 0,
    addOnPrice: 0,
  });

  // Calculate add-on prices
  const selectedAddOns: Record<string, boolean> = {
    breakdown: !!customer.breakdown_recovery,
    rental: !!customer.vehicle_rental,
    tyre: !!customer.tyre_cover,
    wearAndTear: !!customer.wear_tear,
    european: !!customer.europe_cover,
    motRepair: !!customer.mot_repair,
    motFee: !!customer.mot_fee,
    lostKey: !!customer.lost_key,
    consequential: !!customer.consequential,
    transfer: !!customer.transfer_cover,
  };

  const addOnTotal = calculateAddOnPrice(selectedAddOns, paymentType, durationMonths);
  return baseTotal + addOnTotal;
}

// Test names to exclude
const TEST_NAMES = ['kamran qureshi', 'prajwal chauhan', 'accepttest'];
const isTestRecord = (customer: CustomerRecord): boolean => {
  const lowerName = customer.name?.toLowerCase() || '';
  const lowerEmail = customer.email?.toLowerCase() || '';
  if (TEST_NAMES.some(t => lowerName.includes(t))) return true;
  if (lowerEmail.includes('@test.com') || lowerEmail.includes('testuser')) return true;
  return false;
};

export const DiscountsGivenTab: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      const [customersRes, adminsRes] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('customers')
            .select('id, name, email, registration_plate, plan_type, payment_type, final_amount, voluntary_excess, claim_limit, labour_rate, assigned_to, signup_date, status, discount_code, discount_amount, vehicle_make, vehicle_model, tyre_cover, wear_tear, europe_cover, transfer_cover, breakdown_recovery, vehicle_rental, mot_fee, mot_repair, lost_key, consequential, warranty_reference_number')
            .not('status', 'in', '("cancelled","refunded")'),
        ),
        supabase.from('admin_users').select('id, first_name, last_name, email, role').eq('is_active', true).order('first_name'),
      ]);

      setCustomers((customersRes.data || []) as CustomerRecord[]);
      setAdminUsers((adminsRes.data || []) as AdminUser[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    adminUsers.forEach(u => {
      map[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
    });
    return map;
  }, [adminUsers]);

  // Agents that are sales roles (not admin/super_admin)
  const salesAgents = useMemo(
    () => adminUsers.filter(u => !['admin', 'super_admin'].includes(u.role)),
    [adminUsers],
  );

  const enrichedCustomers = useMemo(() => {
    return customers
      .filter(c => !isTestRecord(c) && c.final_amount && c.final_amount > 0 && c.assigned_to)
      .map(c => {
        const retailPrice = calculateRetailPrice(c);
        const paid = c.final_amount || 0;
        const diff = retailPrice !== null ? paid - retailPrice : null;
        const pctDiff = retailPrice && retailPrice > 0 ? ((paid - retailPrice) / retailPrice) * 100 : null;
        return { ...c, retailPrice, diff, pctDiff };
      })
      .filter(c => {
        // Date range filter
        if (dateRange?.from) {
          const d = new Date(c.signup_date);
          if (d < dateRange.from) return false;
          if (dateRange.to && d > dateRange.to) return false;
        }
        // Agent filter
        if (selectedAgent !== 'all' && c.assigned_to !== selectedAgent) return false;
        return true;
      })
      .sort((a, b) => new Date(b.signup_date).getTime() - new Date(a.signup_date).getTime());
  }, [customers, dateRange, selectedAgent]);

  const totals = useMemo(() => {
    let totalDiff = 0;
    let totalPaid = 0;
    let totalRetail = 0;
    let discountCount = 0;
    let overchargeCount = 0;

    enrichedCustomers.forEach(c => {
      if (c.diff !== null && c.retailPrice !== null) {
        totalDiff += c.diff;
        totalPaid += c.final_amount || 0;
        totalRetail += c.retailPrice;
        if (c.diff < 0) discountCount++;
        if (c.diff > 0) overchargeCount++;
      }
    });

    const avgPct = totalRetail > 0 ? ((totalPaid - totalRetail) / totalRetail) * 100 : 0;
    return { totalDiff, totalPaid, totalRetail, discountCount, overchargeCount, avgPct, count: enrichedCustomers.length };
  }, [enrichedCustomers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discounts Given</h1>
        <p className="text-muted-foreground">Track price differences between retail and what agents charged customers</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="w-64">
          <label className="text-sm font-medium mb-1 block">Filter by Agent</label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger>
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {salesAgents.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {`${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{totals.count}</p>
            <p className="text-xs text-muted-foreground">Total Transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold text-red-600">{totals.discountCount}</p>
            <p className="text-xs text-muted-foreground">Discounted Sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{totals.overchargeCount}</p>
            <p className="text-xs text-muted-foreground">Above Retail Sales</p>
          </CardContent>
        </Card>
        <Card className={totals.totalDiff < 0 ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}>
          <CardContent className="p-4 text-center">
            <PoundSterling className="h-5 w-5 mx-auto mb-1" />
            <p className={`text-2xl font-bold ${totals.totalDiff < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {totals.totalDiff >= 0 ? '+' : ''}£{Math.abs(totals.totalDiff).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              Net {totals.totalDiff < 0 ? 'Loss' : 'Gain'} ({totals.avgPct >= 0 ? '+' : ''}{totals.avgPct.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reg</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Excess</TableHead>
                  <TableHead>Claim Limit</TableHead>
                  <TableHead>Labour Rate</TableHead>
                  <TableHead>Discount Code</TableHead>
                  <TableHead className="bg-blue-50">Payment (Paid)</TableHead>
                  <TableHead className="bg-amber-50">Retail Price</TableHead>
                  <TableHead className="bg-purple-50">Retail Sold +-</TableHead>
                  <TableHead>Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      No transactions found for the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {enrichedCustomers.map(c => {
                      const isDiscount = c.diff !== null && c.diff < 0;
                      const isOvercharge = c.diff !== null && c.diff > 0;
                      const isExact = c.diff !== null && c.diff === 0;
                      const normalizedPT = normalizePaymentType(c.payment_type);
                      const durationLabel = normalizedPT === '12months' ? '12 Months' : normalizedPT === '24months' ? '24 Months' : '36 Months';

                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-sm whitespace-nowrap">{c.name}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(c.signup_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="font-mono text-xs">{c.registration_plate || '-'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{[c.vehicle_make, c.vehicle_model].filter(Boolean).join(' ') || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{c.plan_type}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{durationLabel}</TableCell>
                          <TableCell className="text-xs">£{c.voluntary_excess ?? 100}</TableCell>
                          <TableCell className="text-xs">£{(c.claim_limit ?? 1250).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">£{c.labour_rate ?? 70}/hr</TableCell>
                          <TableCell className="text-xs">{c.discount_code || '-'}</TableCell>
                          <TableCell className="bg-blue-50/50 font-bold">£{(c.final_amount || 0).toLocaleString()}</TableCell>
                          <TableCell className="bg-amber-50/50 font-medium">
                            {c.retailPrice !== null ? `£${c.retailPrice.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="bg-purple-50/50">
                            {c.diff !== null && c.pctDiff !== null ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <span className={`font-bold text-sm ${isDiscount ? 'text-red-600' : isOvercharge ? 'text-green-600' : 'text-muted-foreground'}`}>
                                  {isDiscount ? '' : isOvercharge ? '+' : ''}£{Math.abs(c.diff).toLocaleString()}
                                </span>
                                <span className={`text-xs font-medium ${isDiscount ? 'text-red-500' : isOvercharge ? 'text-green-500' : 'text-muted-foreground'}`}>
                                  {isDiscount ? '' : isOvercharge ? '+' : ''}{c.pctDiff.toFixed(1)}%
                                </span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {c.assigned_to ? agentMap[c.assigned_to] || 'Unknown' : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell colSpan={10} className="text-right text-sm">TOTALS</TableCell>
                      <TableCell className="bg-blue-100/50 text-sm">£{totals.totalPaid.toLocaleString()}</TableCell>
                      <TableCell className="bg-amber-100/50 text-sm">£{totals.totalRetail.toLocaleString()}</TableCell>
                      <TableCell className={`text-sm font-bold ${totals.totalDiff < 0 ? 'bg-red-100/50 text-red-700' : 'bg-green-100/50 text-green-700'}`}>
                        <div className="flex flex-col gap-0.5">
                          <span>{totals.totalDiff >= 0 ? '+' : ''}£{Math.abs(totals.totalDiff).toLocaleString()}</span>
                          <span className="text-xs">{totals.avgPct >= 0 ? '+' : ''}{totals.avgPct.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiscountsGivenTab;
