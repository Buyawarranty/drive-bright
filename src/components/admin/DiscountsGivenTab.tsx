import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from './DateRangeFilter';
import { DateRange } from 'react-day-picker';
import { calculateAdminQuoteWarrantyPrice, DURATION_MONTHS, type PaymentPeriod } from '@/lib/pricingMatrix';
import { calculateAddOnPrice, normalizePaymentType } from '@/lib/addOnsUtils';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { TrendingDown, TrendingUp, PoundSterling, Users, AlertTriangle, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';

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
  vehicle_year: string | null;
  mileage: string | null;
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
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

// Maximum allowed discount % per duration
const MAX_DISCOUNT_PCT: Record<string, number> = {
  '12months': 20,
  '24months': 20,
  '36months': 20,
};

const DURATION_LABELS: Record<string, string> = {
  '12months': '1 Year',
  '24months': '2 Years',
  '36months': '3 Years',
};

function getVehicleAdjustment(customer: CustomerRecord, durationYears: number): number {
  const make = (customer.vehicle_make || '').toLowerCase().replace(/dvla/gi, '').trim();
  let adjustment = 0;

  // Premium brand surcharge (Land Rover, Jaguar, Porsche, Tesla)
  if (make === 'land rover' || make.startsWith('jaguar') || make === 'porsche' || make === 'tesla') {
    if (durationYears === 1) adjustment += 500;
    else if (durationYears === 2) adjustment += 700;
    else if (durationYears === 3) adjustment += 900;
  }

  // Mileage and age surcharges (non-stacking, mileage takes precedence)
  const mileageNum = customer.mileage
    ? parseInt(String(customer.mileage).replace(/[^0-9]/g, ''))
    : null;
  const yearNum = customer.vehicle_year
    ? parseInt(String(customer.vehicle_year).replace(/[^0-9]/g, ''))
    : null;
  const ageYears = yearNum ? new Date().getFullYear() - yearNum : null;

  const mileageQualifies = mileageNum !== null && mileageNum > 120000 && mileageNum <= 150000;
  const ageQualifies = ageYears !== null && ageYears > 12 && ageYears <= 15;

  const surchargeByDuration = (y: number) => (y === 1 ? 200 : y === 2 ? 250 : y === 3 ? 300 : 0);

  if (mileageQualifies || ageQualifies) {
    adjustment += surchargeByDuration(durationYears);
  }

  return adjustment;
}

function calculateRetailPrice(customer: CustomerRecord): number | null {
  const paymentType = normalizePaymentType(customer.payment_type) as PaymentPeriod;
  const excess = customer.voluntary_excess ?? 100;
  const claimLimit = customer.claim_limit ?? 1250;
  const labourRate = customer.labour_rate ?? 70;
  const durationMonths = DURATION_MONTHS[paymentType] || 12;
  const durationYears = Math.max(1, Math.round(durationMonths / 12));

  const vehicleAdjustment = getVehicleAdjustment(customer, durationYears);

  const { totalPrice: baseTotal } = calculateAdminQuoteWarrantyPrice({
    paymentPeriod: paymentType,
    voluntaryExcess: excess,
    claimLimit: claimLimit,
    labourRate: labourRate,
    boostEnabled: false,
    vehicleAdjustment,
    addOnPrice: 0,
  });

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

const TEST_NAMES = ['kamran qureshi', 'prajwal chauhan', 'accepttest'];
const isTestRecord = (customer: CustomerRecord): boolean => {
  const lowerName = customer.name?.toLowerCase() || '';
  const lowerEmail = customer.email?.toLowerCase() || '';
  if (TEST_NAMES.some(t => lowerName.includes(t))) return true;
  if (lowerEmail.includes('@test.com') || lowerEmail.includes('testuser')) return true;
  return false;
};

// Roles allowed to see ALL agents' discounts
const FULL_VIEW_ROLES = new Set(['super_admin', 'admin', 'sales_lead', 'accounts', 'accounts_manager', 'accounts_payroll']);

type QuickRange = 'today' | 'yesterday' | 'this_month' | 'last_month' | 'last_7' | 'last_30' | 'custom';

const computeRange = (key: QuickRange): DateRange | undefined => {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case 'last_7':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'last_30':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    default:
      return undefined;
  }
};

export const DiscountsGivenTab: React.FC = () => {
  const { user, userRole } = useAuth();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [quickRange, setQuickRange] = useState<QuickRange>('this_month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(computeRange('this_month'));
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [discountSort, setDiscountSort] = useState<'none' | 'desc' | 'asc'>('none');

  const canSeeAll = !!userRole && FULL_VIEW_ROLES.has(userRole);

  // Find current admin_users.id for the logged in user
  const currentAdminId = useMemo(() => {
    if (!user?.id) return null;
    const me = adminUsers.find(u => u.user_id === user.id);
    return me?.id || null;
  }, [user, adminUsers]);

  useEffect(() => {
    const fetchData = async () => {
      const [customersRes, adminsRes] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('customers')
            .select('id, name, email, registration_plate, plan_type, payment_type, final_amount, voluntary_excess, claim_limit, labour_rate, assigned_to, signup_date, status, discount_code, discount_amount, vehicle_make, vehicle_model, vehicle_year, mileage, tyre_cover, wear_tear, europe_cover, transfer_cover, breakdown_recovery, vehicle_rental, mot_fee, mot_repair, lost_key, consequential, warranty_reference_number')
            .not('status', 'in', '("cancelled","refunded")'),
        ),
        supabase.from('admin_users').select('id, user_id, first_name, last_name, email, role').eq('is_active', true).order('first_name'),
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

  const salesAgents = useMemo(
    () => adminUsers.filter(u => !['admin', 'super_admin'].includes(u.role)),
    [adminUsers],
  );

  const handleQuickRange = (key: QuickRange) => {
    setQuickRange(key);
    if (key !== 'custom') {
      setDateRange(computeRange(key));
    }
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setQuickRange('custom');
  };

  const enrichedCustomers = useMemo(() => {
    return customers
      // Exclude test records and test purchases (< £20)
      .filter(c => !isTestRecord(c) && c.final_amount && c.final_amount >= 20 && c.assigned_to)
      .map(c => {
        const retailPrice = calculateRetailPrice(c);
        const paid = c.final_amount || 0;
        const diff = retailPrice !== null ? paid - retailPrice : null;
        const pctDiff = retailPrice && retailPrice > 0 ? ((paid - retailPrice) / retailPrice) * 100 : null;
        const normalizedPT = normalizePaymentType(c.payment_type);
        const maxDiscount = MAX_DISCOUNT_PCT[normalizedPT] ?? 5;
        // Discount % is positive when below retail
        const discountPct = pctDiff !== null ? -pctDiff : null;
        const exceedsLimit = discountPct !== null && discountPct > maxDiscount;
        return { ...c, retailPrice, diff, pctDiff, normalizedPT, maxDiscount, discountPct, exceedsLimit };
      })
      .filter(c => {
        // Role-based visibility: non-full-view users only see their own
        if (!canSeeAll) {
          if (!currentAdminId || c.assigned_to !== currentAdminId) return false;
        }
        if (dateRange?.from) {
          const d = new Date(c.signup_date);
          if (d < dateRange.from) return false;
          if (dateRange.to && d > dateRange.to) return false;
        }
        if (selectedAgent !== 'all' && c.assigned_to !== selectedAgent) return false;
        if (searchTerm.trim()) {
          const term = searchTerm.trim().toLowerCase().replace(/\s+/g, '');
          const reg = (c.registration_plate || '').toLowerCase().replace(/\s+/g, '');
          const name = (c.name || '').toLowerCase();
          const email = (c.email || '').toLowerCase();
          if (!reg.includes(term) && !name.includes(searchTerm.toLowerCase()) && !email.includes(searchTerm.toLowerCase())) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (discountSort === 'desc') {
          return (b.discountPct ?? -Infinity) - (a.discountPct ?? -Infinity);
        }
        if (discountSort === 'asc') {
          return (a.discountPct ?? Infinity) - (b.discountPct ?? Infinity);
        }
        return new Date(b.signup_date).getTime() - new Date(a.signup_date).getTime();
      });
  }, [customers, dateRange, selectedAgent, canSeeAll, currentAdminId, searchTerm, discountSort]);

  const totals = useMemo(() => {
    let totalDiff = 0;
    let totalPaid = 0;
    let totalRetail = 0;
    let discountCount = 0;
    let overchargeCount = 0;
    let exceededCount = 0;
    let discountPctSum = 0;
    let discountedRetailSum = 0;
    let discountedPaidSum = 0;

    enrichedCustomers.forEach(c => {
      if (c.diff !== null && c.retailPrice !== null) {
        totalDiff += c.diff;
        totalPaid += c.final_amount || 0;
        totalRetail += c.retailPrice;
        if (c.diff < 0) {
          discountCount++;
          if (c.discountPct !== null) discountPctSum += c.discountPct;
          discountedRetailSum += c.retailPrice;
          discountedPaidSum += c.final_amount || 0;
        }
        if (c.diff > 0) overchargeCount++;
        if (c.exceedsLimit) exceededCount++;
      }
    });

    const avgPct = totalRetail > 0 ? ((totalPaid - totalRetail) / totalRetail) * 100 : 0;
    // Weighted average discount % across discounted sales (£-weighted)
    const avgDiscountPct = discountedRetailSum > 0
      ? ((discountedRetailSum - discountedPaidSum) / discountedRetailSum) * 100
      : 0;
    return { totalDiff, totalPaid, totalRetail, discountCount, overchargeCount, exceededCount, avgPct, avgDiscountPct, count: enrichedCustomers.length };
  }, [enrichedCustomers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const quickTabs: { key: QuickRange; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'last_7', label: 'Last 7 Days' },
    { key: 'last_30', label: 'Last 30 Days' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discounts Given</h1>
        <p className="text-muted-foreground">
          {canSeeAll
            ? 'Track price differences between retail and what agents charged customers'
            : 'Your personal discount activity vs retail pricing'}
        </p>
      </div>




      {/* Quick Date Tabs */}
      <div className="flex flex-wrap gap-2">
        {quickTabs.map(t => (
          <Button
            key={t.key}
            size="sm"
            variant={quickRange === t.key ? 'default' : 'outline'}
            onClick={() => handleQuickRange(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        {canSeeAll && (
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
        )}
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        <div className="relative w-72">
          <label className="text-sm font-medium mb-1 block">Search</label>
          <Search className="absolute left-3 top-[34px] h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Reg plate, name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
        <Card className={totals.exceededCount > 0 ? 'border-red-300 bg-red-50/40' : ''}>
          <CardContent className="p-4 text-center">
            <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${totals.exceededCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
            <p className={`text-2xl font-bold ${totals.exceededCount > 0 ? 'text-red-700' : ''}`}>{totals.exceededCount}</p>
            <p className="text-xs text-muted-foreground">Over Limit</p>
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
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <p className="text-2xl font-bold text-amber-700">
              {totals.avgDiscountPct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">Avg Discount Given</p>
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
                  <TableHead className="bg-purple-50">
                    <div className="flex items-center gap-1">
                      <span>Retail Sold +-</span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => setDiscountSort(discountSort === 'desc' ? 'none' : 'desc')}
                          className={`p-0.5 rounded hover:bg-muted ${discountSort === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                          title="Sort highest discount first"
                          aria-label="Sort highest discount first"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountSort(discountSort === 'asc' ? 'none' : 'asc')}
                          className={`p-0.5 rounded hover:bg-muted ${discountSort === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}
                          title="Sort lowest discount first"
                          aria-label="Sort lowest discount first"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </TableHead>
                  <TableHead>Limit</TableHead>
                  <TableHead>Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                      No transactions found for the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {enrichedCustomers.map(c => {
                      const isDiscount = c.diff !== null && c.diff < 0;
                      const isOvercharge = c.diff !== null && c.diff > 0;
                      const durationLabel = DURATION_LABELS[c.normalizedPT] || c.normalizedPT;
                      const rowClass = c.exceedsLimit ? 'bg-red-50 hover:bg-red-100' : '';

                      return (
                        <TableRow key={c.id} className={rowClass}>
                          <TableCell className="font-medium text-sm whitespace-nowrap">{c.name}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(c.signup_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            {c.registration_plate ? (
                              <span className="inline-block bg-[#FFD307] text-black font-bold font-mono text-xs px-2 py-1 rounded border border-black/20 tracking-wider uppercase">
                                {c.registration_plate}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
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
                                <span className={`font-bold text-sm ${c.exceedsLimit ? 'text-red-700' : isDiscount ? 'text-red-600' : isOvercharge ? 'text-green-600' : 'text-muted-foreground'}`}>
                                  {isOvercharge ? '+' : ''}£{Math.abs(c.diff).toLocaleString()}
                                </span>
                                <span className={`text-xs font-medium ${c.exceedsLimit ? 'text-red-700' : isDiscount ? 'text-red-500' : isOvercharge ? 'text-green-500' : 'text-muted-foreground'}`}>
                                  {isOvercharge ? '+' : ''}{c.pctDiff.toFixed(1)}%
                                </span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {c.exceedsLimit ? (
                              <Badge variant="destructive" className="text-xs whitespace-nowrap">
                                Over {c.maxDiscount}%
                              </Badge>
                            ) : isDiscount ? (
                              <Badge variant="outline" className="text-xs whitespace-nowrap border-green-300 text-green-700">
                                Within {c.maxDiscount}%
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {c.assigned_to ? agentMap[c.assigned_to] || 'Unknown' : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
