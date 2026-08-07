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
import { loadPricingVersionHistory, withPricingAsOf, type PricingVersionSnapshot } from '@/lib/pricing/historicalPricing';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths, addMonths, startOfWeek, endOfWeek } from 'date-fns';
import { TrendingDown, TrendingUp, PoundSterling, Users, AlertTriangle, Search, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronDown as ChevronDownIcon, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { DiscountCapManagerDialog } from './quote/DiscountCapManagerDialog';
import { PriceOverridesPanel } from './pricing/PriceOverridesPanel';


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
  sale_credit?: string | null;
  payment_confirmed_by: string | null;
  quote_sent_by: string | null;
  purchase_source: string | null;


  signup_date: string;
  status: string;
  discount_code: string | null;
  discount_amount: number | null;
  price_match_applied?: boolean | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  vehicle_fuel_type: string | null;
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
  record_source?: 'confirmed_payment' | 'sent_quote';
}

interface SentQuoteRecord {
  id: string;
  customer_name: string;
  customer_email: string;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  vehicle_fuel_type: string | null;
  vehicle_mileage: string | null;
  plan_name: string | null;
  payment_type: string | null;
  excess_amount: number | null;
  claim_limit: number | null;
  labour_rate: number | null;
  total_price: number | null;
  sent_by: string | null;
  sent_at: string;
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
    make: customer.vehicle_make,
    fuelType: customer.vehicle_fuel_type,
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

// Roles allowed to see ALL agents' discounts (management + finance only)
const FULL_VIEW_ROLES = new Set(['super_admin', 'admin', 'sales_manager', 'accounts', 'accounts_manager', 'accounts_payroll']);

/**
 * Payments the agent took away from the website checkout (Stripe dashboard, Bumper
 * portal, bank transfer, card over the phone, etc.). The discount they gave still
 * has to be counted here, so these rows are labelled and filterable.
 */
const OUTSIDE_SOURCE_LABELS: Record<string, string> = {
  stripe_dashboard: 'Stripe dashboard',
  bumper_portal: 'Bumper portal',
  payment_assist: 'Payment Assist',
  bank_transfer: 'Bank transfer',
  phone_card: 'Card over the phone',
  dealer_portal: 'Dealer portal',
  other: 'Other (outside)',
  external: 'Outside the system',
};

const isOutsidePayment = (source: string | null): boolean =>
  !!source && Object.prototype.hasOwnProperty.call(OUTSIDE_SOURCE_LABELS, source.toLowerCase());

const paymentRouteLabel = (source: string | null): string => {
  if (!source) return 'Not recorded';
  const key = source.toLowerCase();
  return OUTSIDE_SOURCE_LABELS[key] || source.replace(/_/g, ' ');
};


// Discount bands: up to 20% green, 20–30% orange, 30%+ red
type DiscountBand = 'green' | 'orange' | 'red' | 'none';

const getDiscountBand = (discountPct: number | null): DiscountBand => {
  if (discountPct === null || discountPct <= 0) return 'none';
  if (discountPct < 20) return 'green';
  if (discountPct < 30) return 'orange';
  return 'red';
};

const BAND_STYLES: Record<DiscountBand, { row: string; text: string; badge: string; label: string }> = {
  green: {
    row: 'bg-green-50/40 hover:bg-green-100/60',
    text: 'text-green-700',
    badge: 'border-green-300 text-green-700 bg-green-50',
    label: 'Within 20%',
  },
  orange: {
    row: 'bg-orange-50/60 hover:bg-orange-100/70',
    text: 'text-orange-700',
    badge: 'border-orange-300 text-orange-700 bg-orange-50',
    label: '20–30%',
  },
  red: {
    row: 'bg-red-50 hover:bg-red-100',
    text: 'text-red-700',
    badge: 'border-red-300 text-red-700 bg-red-50',
    label: 'Over 30%',
  },
  none: {
    row: '',
    text: 'text-muted-foreground',
    badge: 'border-muted text-muted-foreground',
    label: '—',
  },
};



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
  // Published price models, newest first — old sales are always valued at the
  // rate that was live on the day they were sold.
  const [pricingVersions, setPricingVersions] = useState<PricingVersionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [quickRange, setQuickRange] = useState<QuickRange>('this_month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(computeRange('this_month'));
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [discountSort, setDiscountSort] = useState<'none' | 'desc' | 'asc'>('none');
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(new Date()));
  const [breakdownOpen, setBreakdownOpen] = useState<boolean>(true);
  const [breakdownGroupBy, setBreakdownGroupBy] = useState<'month' | 'week' | 'day'>('month');
  const [discountCapOpen, setDiscountCapOpen] = useState<boolean>(false);
  const [paymentRoute, setPaymentRoute] = useState<'all' | 'outside' | 'in_system'>('all');
  // Default view = confirmed payments only. Sent quotes stay hidden until asked for.
  const [recordType, setRecordType] = useState<'confirmed_payment' | 'all'>('confirmed_payment');


  // Find current admin_users record for the logged in user
  const myAdminUser = useMemo(() => {
    if (!user?.id) return null;
    return adminUsers.find(u => u.user_id === user.id) || null;
  }, [user, adminUsers]);
  const currentAdminId = myAdminUser?.id || null;

  // Full view requires management on BOTH the staff record and the auth role.
  // Agents who happen to hold a broad auth role still only see their own deals.
  const staffRole = myAdminUser?.role || null;
  const canSeeAll =
    !!userRole && FULL_VIEW_ROLES.has(userRole) &&
    !!staffRole && FULL_VIEW_ROLES.has(staffRole);
  const isManager =
    canSeeAll &&
    ['super_admin', 'admin', 'sales_manager'].includes(staffRole || '');

  useEffect(() => {
    const fetchData = async () => {
      const [customersRes, quotesRes, adminsRes] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('customers')
            .select('id, name, email, registration_plate, plan_type, payment_type, final_amount, voluntary_excess, claim_limit, labour_rate, assigned_to, payment_confirmed_by, quote_sent_by, purchase_source, signup_date, status, discount_code, discount_amount, price_match_applied, vehicle_make, vehicle_model, vehicle_year, vehicle_fuel_type, mileage, tyre_cover, wear_tear, europe_cover, transfer_cover, breakdown_recovery, vehicle_rental, mot_fee, mot_repair, lost_key, consequential, warranty_reference_number')
            // Only agent-created sales from the Quotes & Orders page — never retail website (step 3) self-serve purchases
            .eq('is_manual_entry', true)
            .not('status', 'in', '("cancelled","refunded")'),

        ),
        fetchAllRows(() =>
          supabase
            .from('admin_sent_quotes')
            .select('id, customer_name, customer_email, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_fuel_type, vehicle_mileage, plan_name, payment_type, excess_amount, claim_limit, labour_rate, total_price, sent_by, sent_at'),
        ),
        supabase.from('admin_users').select('id, user_id, first_name, last_name, email, role').eq('is_active', true).order('first_name'),
      ]);

      const admins = (adminsRes.data || []) as AdminUser[];
      const adminIdByIdentity = new Map<string, string>();
      admins.forEach(admin => {
        adminIdByIdentity.set(admin.id, admin.id);
        if (admin.user_id) adminIdByIdentity.set(admin.user_id, admin.id);
      });
      const normalizeAgentId = (id: string | null) => id ? (adminIdByIdentity.get(id) || id) : null;

      const confirmedPayments = ((customersRes.data || []) as CustomerRecord[]).map(customer => ({
        ...customer,
        assigned_to: normalizeAgentId(customer.assigned_to),
        payment_confirmed_by: normalizeAgentId(customer.payment_confirmed_by),
        quote_sent_by: normalizeAgentId(customer.quote_sent_by),
        record_source: 'confirmed_payment' as const,
      }));
      const sentQuotes = ((quotesRes.data || []) as SentQuoteRecord[]).map((quote): CustomerRecord => ({
        id: `quote-${quote.id}`,
        name: quote.customer_name,
        email: quote.customer_email,
        registration_plate: quote.vehicle_reg,
        plan_type: quote.plan_name || 'Platinum',
        payment_type: quote.payment_type,
        final_amount: quote.total_price,
        voluntary_excess: quote.excess_amount,
        claim_limit: quote.claim_limit,
        labour_rate: quote.labour_rate,
        assigned_to: null,
        payment_confirmed_by: null,
        quote_sent_by: normalizeAgentId(quote.sent_by),
        purchase_source: 'quote_sent',
        signup_date: quote.sent_at,
        status: 'quote_sent',
        discount_code: null,
        discount_amount: null,
        price_match_applied: false,
        vehicle_make: quote.vehicle_make,
        vehicle_model: quote.vehicle_model,
        vehicle_year: quote.vehicle_year,
        vehicle_fuel_type: quote.vehicle_fuel_type,
        mileage: quote.vehicle_mileage,
        tyre_cover: null,
        wear_tear: null,
        europe_cover: null,
        transfer_cover: null,
        breakdown_recovery: null,
        vehicle_rental: null,
        mot_fee: null,
        mot_repair: null,
        lost_key: null,
        consequential: null,
        warranty_reference_number: null,
        record_source: 'sent_quote',
      }));

      setCustomers([...confirmedPayments, ...sentQuotes]);
      setAdminUsers(admins);
      setLoading(false);
    };
    fetchData();
    loadPricingVersionHistory().then(setPricingVersions);
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
      // Price matches are competitor matches with evidence on file — never counted as discounts given
      .filter(c => !c.price_match_applied)
      .filter(c => !isTestRecord(c) && c.final_amount && c.final_amount >= 20)
      .map(c => {
        const retailPrice = withPricingAsOf(pricingVersions, c.signup_date, () => calculateRetailPrice(c));
        const paid = c.final_amount || 0;
        const diff = retailPrice !== null ? paid - retailPrice : null;
        const pctDiff = retailPrice && retailPrice > 0 ? ((paid - retailPrice) / retailPrice) * 100 : null;
        const normalizedPT = normalizePaymentType(c.payment_type);
        const maxDiscount = MAX_DISCOUNT_PCT[normalizedPT] ?? 5;
        // Discount % is positive when below retail
        const discountPct = pctDiff !== null ? -pctDiff : null;
        const exceedsLimit = discountPct !== null && discountPct > maxDiscount;
        // Credit the agent who actually made the sale (same priority as the scoreboard)
        const agentId = c.payment_confirmed_by || c.quote_sent_by || c.assigned_to || null;
        const band = getDiscountBand(discountPct);
        const takenOutside = isOutsidePayment(c.purchase_source);
        return { ...c, agentId, retailPrice, diff, pctDiff, normalizedPT, maxDiscount, discountPct, exceedsLimit, band, takenOutside };

      })
      .filter(c => {
        if (!c.agentId) return false;
        if (recordType === 'confirmed_payment' && c.record_source !== 'confirmed_payment') return false;
        // Role-based visibility: non-full-view users only see their own deals
        if (!canSeeAll) {
          if (!currentAdminId || c.agentId !== currentAdminId) return false;
        }
        if (dateRange?.from) {
          const d = new Date(c.signup_date);
          if (d < dateRange.from) return false;
          if (dateRange.to && d > dateRange.to) return false;
        }
        if (selectedAgent !== 'all' && c.agentId !== selectedAgent) return false;
        if (paymentRoute === 'outside' && !c.takenOutside) return false;
        if (paymentRoute === 'in_system' && c.takenOutside) return false;
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
  }, [customers, dateRange, selectedAgent, canSeeAll, currentAdminId, searchTerm, discountSort, paymentRoute, recordType, pricingVersions]);

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
    let outsideDiscountCount = 0;
    let outsideDiscountTotal = 0;

    enrichedCustomers.forEach(c => {
      if (c.diff !== null && c.retailPrice !== null) {
        totalDiff += c.diff;
        totalPaid += c.final_amount || 0;
        totalRetail += c.retailPrice;
        if (c.diff < 0) {
          discountCount++;
          if (c.takenOutside) {
            outsideDiscountCount++;
            outsideDiscountTotal += Math.abs(c.diff);
          }
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
    const bands = { green: 0, orange: 0, red: 0 };
    enrichedCustomers.forEach(c => {
      if (c.band === 'green' || c.band === 'orange' || c.band === 'red') bands[c.band]++;
    });
    return { totalDiff, totalPaid, totalRetail, discountCount, overchargeCount, exceededCount, avgPct, avgDiscountPct, bands, outsideDiscountCount, outsideDiscountTotal, count: enrichedCustomers.length };
  }, [enrichedCustomers]);

  // "My discounts" — always the logged-in agent's own deals in the selected date range,
  // regardless of the agent dropdown selection.
  const myStats = useMemo(() => {
    if (!currentAdminId) return null;
    let discountCount = 0;
    let totalDiscount = 0;
    let retailSum = 0;
    let paidSum = 0;
    const bands = { green: 0, orange: 0, red: 0 };
    let count = 0;

    customers
      .filter(c => !isTestRecord(c) && c.final_amount && c.final_amount >= 20)
      .filter(c => recordType !== 'confirmed_payment' || c.record_source === 'confirmed_payment')
      .forEach(c => {
        const agentId = c.payment_confirmed_by || c.quote_sent_by || c.assigned_to || null;
        if (agentId !== currentAdminId) return;
        if (dateRange?.from) {
          const d = new Date(c.signup_date);
          if (d < dateRange.from) return;
          if (dateRange.to && d > dateRange.to) return;
        }
        const retailPrice = withPricingAsOf(pricingVersions, c.signup_date, () => calculateRetailPrice(c));
        if (retailPrice === null) return;
        count++;
        const paid = c.final_amount || 0;
        const discountPct = retailPrice > 0 ? ((retailPrice - paid) / retailPrice) * 100 : null;
        const band = getDiscountBand(discountPct);
        if (band !== 'none') {
          bands[band]++;
          discountCount++;
          totalDiscount += retailPrice - paid;
          retailSum += retailPrice;
          paidSum += paid;
        }
      });

    const avgDiscountPct = retailSum > 0 ? ((retailSum - paidSum) / retailSum) * 100 : 0;
    return { count, discountCount, totalDiscount, avgDiscountPct, bands };
  }, [customers, currentAdminId, dateRange, recordType, pricingVersions]);


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
      <PriceOverridesPanel />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Discounts Given</h1>
          <p className="text-muted-foreground">
            {canSeeAll
              ? 'Track price differences between retail and what agents charged customers'
              : 'Your personal discount activity vs retail pricing'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sent quotes and confirmed payments from Quotes &amp; Orders — website (step 3) self-serve purchases are excluded.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            "Retail price" is recalculated with today's pricing rules for the same options. A "+" figure means the
            customer paid above that benchmark — normally because the sale was priced before a price change, or because
            add-ons / claim-limit boost weren't saved on the record. It is not extra profit and it is not a discount.
          </p>

        </div>
        {isManager && (

          <Button variant="outline" onClick={() => setDiscountCapOpen(true)} className="gap-2">
            <Settings className="h-4 w-4" />
            Manage discount caps
          </Button>
        )}
      </div>
      {isManager && (
        <DiscountCapManagerDialog open={discountCapOpen} onOpenChange={setDiscountCapOpen} />
      )}

      {/* My discounts — every agent (and manager) sees their own section first */}
      {myStats && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h2 className="font-semibold">My discounts</h2>
              <span className="text-xs text-muted-foreground">
                {myStats.count} of my sales in this date range
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-md border border-green-300 bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{myStats.bands.green}</p>
                <p className="text-xs text-green-700">Under 20% — good</p>
              </div>
              <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-center">
                <p className="text-2xl font-bold text-orange-700">{myStats.bands.orange}</p>
                <p className="text-xs text-orange-700">20–30% — watch</p>
              </div>
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{myStats.bands.red}</p>
                <p className="text-xs text-red-700">Over 30% — too high</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-center">
                <p className="text-2xl font-bold">£{Math.round(myStats.totalDiscount).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">My total discount</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-center">
                <p className={`text-2xl font-bold ${BAND_STYLES[getDiscountBand(myStats.avgDiscountPct)].text}`}>
                  {myStats.avgDiscountPct.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">My avg discount</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Band legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted-foreground">Discount bands:</span>
        <Badge variant="outline" className={BAND_STYLES.green.badge}>Under 20% ({totals.bands.green})</Badge>
        <Badge variant="outline" className={BAND_STYLES.orange.badge}>20–30% ({totals.bands.orange})</Badge>
        <Badge variant="outline" className={BAND_STYLES.red.badge}>Over 30% ({totals.bands.red})</Badge>
      </div>





      {/* Month stepper */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const prev = subMonths(monthCursor, 1);
            setMonthCursor(prev);
            setQuickRange('custom');
            setDateRange({ from: startOfMonth(prev), to: endOfMonth(prev) });
          }}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-[140px] text-center font-semibold text-sm">
          {format(monthCursor, 'MMMM yyyy')}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const next = addMonths(monthCursor, 1);
            setMonthCursor(next);
            setQuickRange('custom');
            setDateRange({ from: startOfMonth(next), to: endOfMonth(next) });
          }}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const now = startOfMonth(new Date());
            setMonthCursor(now);
            setQuickRange('this_month');
            setDateRange(computeRange('this_month'));
          }}
        >
          This month
        </Button>
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

      {/* Manager quick links — jump straight to one agent's discounts */}
      {canSeeAll && salesAgents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Quick view:</span>
          <Button
            size="sm"
            variant={selectedAgent === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedAgent('all')}
          >
            All agents
          </Button>
          {salesAgents.map(a => (
            <Button
              key={a.id}
              size="sm"
              variant={selectedAgent === a.id ? 'default' : 'outline'}
              onClick={() => setSelectedAgent(a.id)}
            >
              {`${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email}
            </Button>
          ))}
        </div>
      )}

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
        <div className="w-64">
          <label className="text-sm font-medium mb-1 block">Record type</label>
          <Select value={recordType} onValueChange={(v) => setRecordType(v as 'confirmed_payment' | 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="Confirmed payments only" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed_payment">Confirmed payments only</SelectItem>
              <SelectItem value="all">Include sent quotes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        <div className="w-64">
          <label className="text-sm font-medium mb-1 block">Payment route</label>
          <Select value={paymentRoute} onValueChange={(v) => setPaymentRoute(v as 'all' | 'outside' | 'in_system')}>
            <SelectTrigger>
              <SelectValue placeholder="All payment routes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payment routes</SelectItem>
              <SelectItem value="outside">Taken outside the system</SelectItem>
              <SelectItem value="in_system">Taken through the system</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
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
            <p className="text-xs text-muted-foreground">No discount (at/above benchmark)</p>
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
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-4 text-center">
            <PoundSterling className="h-5 w-5 mx-auto mb-1 text-indigo-600" />
            <p className="text-2xl font-bold text-indigo-700">{totals.outsideDiscountCount}</p>
            <p className="text-xs text-muted-foreground">
              Discounts on payments taken outside (£{Math.round(totals.outsideDiscountTotal).toLocaleString()})
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

      {/* Per-Agent Breakdown */}
      {canSeeAll && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBreakdownOpen(o => !o)}
                className="flex items-center gap-2 font-semibold text-sm hover:text-primary"
              >
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${breakdownOpen ? '' : '-rotate-90'}`} />
                Discounts by agent ({breakdownGroupBy === 'month' ? 'monthly' : breakdownGroupBy === 'week' ? 'weekly' : 'daily'})
              </button>
              {breakdownOpen && (
                <div className="flex gap-1">
                  {(['day', 'week', 'month'] as const).map(g => (
                    <Button
                      key={g}
                      size="sm"
                      variant={breakdownGroupBy === g ? 'default' : 'outline'}
                      onClick={() => setBreakdownGroupBy(g)}
                    >
                      {g === 'day' ? 'Day' : g === 'week' ? 'Week' : 'Month'}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {breakdownOpen && (() => {
              const groupKey = (d: Date) => {
                if (breakdownGroupBy === 'month') return format(startOfMonth(d), 'yyyy-MM');
                if (breakdownGroupBy === 'week') return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                return format(d, 'yyyy-MM-dd');
              };
              const groupLabel = (k: string) => {
                if (breakdownGroupBy === 'month') return format(new Date(k + '-01'), 'MMM yyyy');
                if (breakdownGroupBy === 'week') {
                  const start = new Date(k);
                  return `${format(start, 'dd MMM')} – ${format(endOfWeek(start, { weekStartsOn: 1 }), 'dd MMM')}`;
                }
                return format(new Date(k), 'dd MMM yyyy');
              };
              type Cell = { count: number; discountCount: number; totalDiscount: number; retailSum: number; paidSum: number };
              const matrix: Record<string, Record<string, Cell>> = {};
              const periodKeys = new Set<string>();
              const agentIds = new Set<string>();
              enrichedCustomers.forEach(c => {
                if (!c.agentId) return;
                const pk = groupKey(new Date(c.signup_date));
                periodKeys.add(pk);
                agentIds.add(c.agentId);
                const row = (matrix[c.agentId] ||= {});
                const cell = (row[pk] ||= { count: 0, discountCount: 0, totalDiscount: 0, retailSum: 0, paidSum: 0 });
                cell.count++;
                if (c.diff !== null && c.diff < 0 && c.retailPrice !== null) {
                  cell.discountCount++;
                  cell.totalDiscount += Math.abs(c.diff);
                  cell.retailSum += c.retailPrice;
                  cell.paidSum += c.final_amount || 0;
                }
              });
              const sortedPeriods = Array.from(periodKeys).sort().reverse();
              const sortedAgents = Array.from(agentIds).sort((a, b) => (agentMap[a] || '').localeCompare(agentMap[b] || ''));

              if (sortedAgents.length === 0) {
                return <p className="text-sm text-muted-foreground py-4">No agent discount data for the selected filters.</p>;
              }

              return (
                <div className="overflow-auto max-h-[400px] border rounded">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">Agent</TableHead>
                        <TableHead className="text-right">Total discount £</TableHead>
                        <TableHead className="text-right">Discounted sales</TableHead>
                        <TableHead className="text-right">Avg %</TableHead>
                        {sortedPeriods.map(pk => (
                          <TableHead key={pk} className="text-right whitespace-nowrap">{groupLabel(pk)}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAgents.map(aid => {
                        const row = matrix[aid] || {};
                        let totalDisc = 0, discCount = 0, retailSum = 0, paidSum = 0;
                        Object.values(row).forEach(v => {
                          totalDisc += v.totalDiscount;
                          discCount += v.discountCount;
                          retailSum += v.retailSum;
                          paidSum += v.paidSum;
                        });
                        const avgPct = retailSum > 0 ? ((retailSum - paidSum) / retailSum) * 100 : 0;
                        return (
                          <TableRow key={aid}>
                            <TableCell className="sticky left-0 bg-background font-medium text-sm whitespace-nowrap">
                              {agentMap[aid] || 'Unknown'}
                            </TableCell>
                            <TableCell className="text-right font-bold text-red-600">£{totalDisc.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{discCount}</TableCell>
                            <TableCell className="text-right text-amber-700">{avgPct.toFixed(1)}%</TableCell>
                            {sortedPeriods.map(pk => {
                              const cell = row[pk];
                              return (
                                <TableCell key={pk} className="text-right text-xs whitespace-nowrap">
                                  {cell && cell.totalDiscount > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-red-600 font-semibold">£{cell.totalDiscount.toLocaleString()}</span>
                                      <span className="text-muted-foreground">{cell.discountCount} sale{cell.discountCount === 1 ? '' : 's'}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">–</span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

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
                  <TableHead>Record</TableHead>
                  <TableHead>Payment route</TableHead>
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
                  <TableHead>Band</TableHead>
                  <TableHead>Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="text-center py-8 text-muted-foreground">
                      No transactions found for the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {enrichedCustomers.map(c => {
                      const isDiscount = c.diff !== null && c.diff < 0;
                      const isOvercharge = c.diff !== null && c.diff > 0;
                      const durationLabel = DURATION_LABELS[c.normalizedPT] || c.normalizedPT;
                      const rowClass = BAND_STYLES[c.band].row;

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
                          <TableCell className="text-xs whitespace-nowrap">
                            <Badge variant="outline" className={c.record_source === 'sent_quote' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}>
                              {c.record_source === 'sent_quote' ? 'Quote sent' : 'Payment confirmed'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {c.takenOutside ? (
                              <Badge
                                variant="outline"
                                className="text-xs whitespace-nowrap border-indigo-300 text-indigo-700 bg-indigo-50"
                                title="Payment was taken away from the website checkout, then confirmed on Quotes & Orders — the discount still counts here."
                              >
                                Outside · {paymentRouteLabel(c.purchase_source)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">{paymentRouteLabel(c.purchase_source)}</span>
                            )}
                          </TableCell>
                          <TableCell className="bg-blue-50/50 font-bold">£{(c.final_amount || 0).toLocaleString()}</TableCell>
                          <TableCell className="bg-amber-50/50 font-medium">
                            {c.retailPrice !== null ? `£${c.retailPrice.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="bg-purple-50/50">
                            {c.diff !== null && c.pctDiff !== null ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <span className={`font-bold text-sm ${c.band !== 'none' ? BAND_STYLES[c.band].text : isOvercharge ? 'text-slate-600' : 'text-muted-foreground'}`}>
                                  {isOvercharge ? '+' : ''}£{Math.abs(c.diff).toLocaleString()}
                                </span>
                                <span className={`text-xs font-medium ${c.band !== 'none' ? BAND_STYLES[c.band].text : isOvercharge ? 'text-slate-500' : 'text-muted-foreground'}`}>
                                  {isOvercharge ? '+' : ''}{c.pctDiff.toFixed(1)}%
                                </span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {c.band !== 'none' ? (
                              <Badge variant="outline" className={`text-xs whitespace-nowrap ${BAND_STYLES[c.band].badge}`}>
                                {BAND_STYLES[c.band].label}
                              </Badge>
                            ) : isOvercharge ? (
                              <Badge
                                variant="outline"
                                className="text-xs whitespace-nowrap border-slate-300 text-slate-600 bg-slate-50"
                                title="Paid above today's recalculated benchmark. Usually means the sale was priced before a price change, or add-ons / boost were not recorded on this record."
                              >
                                No discount
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>


                          <TableCell className="text-xs whitespace-nowrap">
                            {c.agentId ? agentMap[c.agentId] || 'Unknown' : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell colSpan={12} className="text-right text-sm">TOTALS</TableCell>
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
