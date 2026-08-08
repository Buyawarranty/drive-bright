import { getVehicleAge } from '@/lib/vehicleAge';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isVehicleBlockedByRules, MANUAL_REFERRAL_MESSAGE } from '@/lib/pricing/vehicleRules';
import { ArrowRight, Mail, MessageCircle, Loader2, History, RefreshCw, Eye, Zap, CreditCard, Calendar, Link as LinkIcon, UserCheck, CheckCircle2, Send, AlertCircle, Save, Pencil, ChevronDown, Gift, BookOpen, Trash2, CalendarIcon, Info, Users, KeyRound, FileText, Car, Copy, X, Gauge, Shield, PoundSterling, ChevronRight, Check, Lock as LockIcon, Ban, CalendarDays, Sparkles, LifeBuoy, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DuplicateWarrantyDialog } from './DuplicateWarrantyDialog';
import { QuotesSentPanel } from './QuotesSentPanel';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useDiscountAuthRequests } from '@/hooks/useDiscountAuthRequests';
import { useConcessionAllowance } from '@/hooks/useConcessionAllowance';
import { useClaimLimit5kAuthRequired } from '@/hooks/useClaimLimit5kAuthRequired';
import { useLeadOwner } from '@/hooks/useLeadOwner';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { ConcessionAllowanceStrip } from './quote/ConcessionAllowanceStrip';

import { PaidOrdersTab } from './PaidOrdersTab';
import CustomerLoginsTab from './CustomerLoginsTab';
import DobTypeOrSelect from './DobTypeOrSelect';
import CustomerPolicyUpdateTab from './CustomerPolicyUpdateTab';
import { format, addDays, isBefore, startOfDay, isToday } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LeadSearchPopover, LeadData } from './LeadSearchPopover';
import { QuoteInvoiceDialog } from './QuoteInvoiceDialog';
import MileageSlider from '@/components/MileageSlider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { 
  calculateAdminQuoteWarrantyPrice, 
  DURATION_MONTHS,
  getVisibleExcessOptions,
  getExcessBracketBasis,
  getLabourRateOptions,
  getWebReferencePrice,
  MAX_WEB_DISCOUNT_VS_GRID_PCT,
  MARKETING_SAVINGS,
  type PaymentPeriod 
} from '@/lib/pricingMatrix';
import { getExcessMonthlyDelta } from '@/lib/pricingMatrix';
import { JOURNEY_EXCESS_OPTIONS } from '@/lib/pricing/journeyOptions';
import { MIN_BASE_PRICE_BY_PERIOD } from '@/lib/pricingMatrix';
import { priceFromPricingModel } from './pricing/modelQuoteEngine';

import { logPriceOverride } from '@/lib/pricing/logPriceOverride';

import { calculateAddOnPrice, getAutoIncludedAddOns, getAddOnInfo } from '@/lib/addOnsUtils';
import { useFeatureEnabled } from '@/hooks/useFeatureFlags';
import { useAuth } from '@/hooks/useAuth';
import { getVehiclePriceFactor } from '@/lib/pricing/vehicleFactorModel';
import { calculateVehiclePriceAdjustment, isMotorbikeAdjustment } from '@/lib/vehicleValidation';
import { useMotMileage } from '@/hooks/useMotMileage';
import { CLAIM_LIMIT_TIERS, isPremiumVehicle, getBaseClaimLimit, getClaimLimitSurcharge, getClaimLimitSurchargeMonthly, PREMIUM_CLAIM_MONTHLY, getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';
import WorldpayPaymentPanel from './WorldpayPaymentPanel';
import PaymentAssistPanel from './PaymentAssistPanel';
import BumperPaymentPanel from './BumperPaymentPanel';
import { useAgentDiscountCap } from '@/hooks/useAgentDiscountCap';
import { DiscountCapManagerDialog } from './quote/DiscountCapManagerDialog';
import { useIsManagement } from '@/hooks/useIsManagement';
import { useSavedPricingModel } from './pricing/useSavedPricingModel';




// Validation helpers for external payment form
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UK_PHONE_REGEX = /^(?:\+?44|0)\s?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}$/;
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
const isValidEmail = (v: string) => !!v && EMAIL_REGEX.test(v.trim());
const isValidUkPhone = (v: string) => !!v && UK_PHONE_REGEX.test(v.replace(/\s/g, ''));
const isValidUkPostcode = (v: string) => !!v && UK_POSTCODE_REGEX.test(v.replace(/\s/g, ''));

interface VehicleData {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  registrationDate?: string;
  manufactureDate?: string;
  vehicleType?: string;
}

// Step 3 exact options
const termOptions = [
  { id: '12months', label: '1-Year Cover', months: 12, bonus: 3 },
  { id: '24months', label: '2-Year Cover', months: 24, bonus: 3, isPopular: true },
  { id: '36months', label: '3-Year Cover', months: 36, bonus: 3, isBestValue: true }
];




// Claim-limit chips. The customer-facing tier (£1,000 / £2,000 / £3,000 / £5,000)
// comes from the published pricing model — the same list the Aug hybrid test
// Step 2 shows — so agents never see a tier the pricing model no longer offers.
// `value` is the internal grid column used by the pricing matrix.
const CLAIM_TIER_TO_INTERNAL: Record<number, number> = {
  1000: 750,
  2000: 2000,
  3000: 3000,
  5000: 5000,
};

const CLAIM_TIER_META: Record<number, { label: string; description: string; popular?: boolean }> = {
  1000: { label: '£1,000', description: 'AutoCare Basic' },
  2000: { label: '£2,000', description: 'AutoCare Essential', popular: true },
  3000: { label: '£3,000', description: 'AutoCare Elite' },
  5000: { label: '£5,000', description: 'AutoCare Premium' },
};

const buildClaimLimitOptions = (tiers: { limit: number }[]) =>
  tiers
    .map(t => Number(t.limit))
    .filter(limit => CLAIM_TIER_TO_INTERNAL[limit] !== undefined)
    .sort((a, b) => a - b)
    .map(limit => ({
      value: CLAIM_TIER_TO_INTERNAL[limit],
      label: CLAIM_TIER_META[limit].label,
      description: CLAIM_TIER_META[limit].description,
      popular: CLAIM_TIER_META[limit].popular,
    }));


/**
 * Labour-rate options shown in Quotes & Orders.
 *
 * The four hourly rates (£50 / £70 / £100 / £150) and their wording are fixed and
 * must ALWAYS be shown, whatever gets pushed live from Admin → Price updates.
 * A published pricing version can only change the pricing FACTOR behind each rate
 * (and add extra rates) — it can never remove an hourly rate or its description.
 */
const CANONICAL_LABOUR_RATES = [50, 70, 100, 150] as const;

const LABOUR_RATE_CHIP_COPY: Record<number, { label: string; description: string }> = {
  50: { label: 'Local garages', description: 'Affordable cover for smaller independent garages and everyday repairs.' },
  70: { label: 'Independent garages', description: 'A strong middle ground for trusted local repairers and servicing specialists.' },
  100: { label: 'Approved garages', description: 'Broader coverage for branded workshops and larger nationwide networks.' },
  150: { label: 'Specialist garages', description: 'Designed for specialist repairers and higher-value vehicles.' },
};

/** Built-in factors used when a pushed version does not include one of the four rates. */
const DEFAULT_LABOUR_FACTORS: Record<number, number> = { 50: 0.84, 70: 1, 100: 1.18, 150: 1.8 };

const getLabourRateChips = (modelRates?: { rate: number; factor: number; uxPosition?: string }[]) => {
  const legacy = getLabourRateOptions();
  const factorByRate = new Map<number, number>();
  legacy.forEach(o => factorByRate.set(Number(o.rate), Number(o.factor)));
  (modelRates ?? []).forEach(r => {
    if (Number.isFinite(Number(r.rate)) && Number.isFinite(Number(r.factor))) {
      factorByRate.set(Number(r.rate), Number(r.factor));
    }
  });

  // Always the four canonical rates first, then any extra rates a pushed version adds.
  const extraRates = [...factorByRate.keys()].filter(
    rate => !CANONICAL_LABOUR_RATES.includes(rate as (typeof CANONICAL_LABOUR_RATES)[number])
  );
  const rates = [...CANONICAL_LABOUR_RATES, ...extraRates.sort((a, b) => a - b)];

  return rates.map(rate => {
    const modelRate = (modelRates ?? []).find(r => Number(r.rate) === rate);
    const copy =
      LABOUR_RATE_CHIP_COPY[rate] ||
      { label: `£${rate}/hr`, description: modelRate?.uxPosition ?? '' };
    return {
      rate,
      label: copy.label,
      description: copy.description,
      factor: factorByRate.get(rate) ?? DEFAULT_LABOUR_FACTORS[rate] ?? 1,
      isBestValue: rate === 50,
      isPopular: rate === 70,
    };
  });
};




// Mileage dropdown options (10,000 to 140,000 in 1,000 increments)
const mileageDropdownOptions = Array.from({ length: 131 }, (_, i) => 10000 + (i * 1000));

interface GetQuoteTabProps {
  prePopulatedLead?: LeadData | null;
  onNavigateToTab?: (tab: string, leadData?: any) => void;
  userRole?: string | null;
  userPermissions?: Record<string, boolean> | null;
  /** Read-only beta preview (Price updates tab): renders the real page but blocks all sends/orders. */
  previewMode?: boolean;
}

export const GetQuoteTab: React.FC<GetQuoteTabProps> = ({ prePopulatedLead, onNavigateToTab, userRole: effectiveUserRole, userPermissions, previewMode = false }) => {
  const { toast } = useToast();
  const { userRole, user } = useAuth();
  const currentAdminId = useCurrentAdminId();
  const canOverrideAge = ['super_admin', 'admin', 'sales_manager', 'performance_manager', 'claims_manager'].includes(userRole || '');
  const tyreCoverEnabled = useFeatureEnabled('addon_tyre_cover', false);
  const [step, setStep] = useState(1);
  // Invoice builder (available to every sales agent from Step 2)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [sliderMileage, setSliderMileage] = useState(0);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  // Separate first / surname fields — kept in sync with `customerName` (combined
  // full name) so all downstream code (live_quotes payload, LiveQuotePage
  // auto-fill split, customer record) continues to work unchanged.
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerDob, setCustomerDob] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadOwner, setSelectedLeadOwner] = useState<string | null>(null);
  const matchedLeadOwner = useLeadOwner(customerEmail, customerPhone);
  const [paymentType, setPaymentType] = useState<PaymentPeriod>('24months');
  const [excessAmount, setExcessAmount] = useState(150);
  const [claimLimit, setClaimLimit] = useState(2000);

  // Cover-option variables come from the published pricing model (Admin → Price
  // updates), the same source the Aug hybrid test Step 2 uses, so both screens
  // always offer identical excess amounts, claim-limit tiers and labour rates.
  const pricingModel = useSavedPricingModel({ preferLive: true });
  const claimLimitOptions = React.useMemo(
    () => buildClaimLimitOptions(pricingModel.claimLimits),
    [pricingModel.claimLimits]
  );
  // All claim limit tiers (including £5,000 AutoCare Premium) are visible to
  // every agent regardless of vehicle make. Premium is disallowed for a small
  // list of makes at checkout — the inline warning under the chips explains
  // that — but agents still see the option so they can quote consistently.
  const getVisibleClaimLimits = (_vehicleMake?: string) => claimLimitOptions;

  // Excess options come from the SAME canonical journey list as Steps 3/4 — not
  // from the pricing model's excessFactors — because excess is priced as a flat
  // £/mo difference over 12 instalments, identical on both surfaces.
  // The £250/£500 tiers unlock by warranty price bracket, so the current quote
  // total feeds the visibility rules (kept in state to avoid a circular read).
  const [excessPriceBasis, setExcessPriceBasis] = useState<number | undefined>(undefined);
  const excessOptions = React.useMemo(
    () =>
      JOURNEY_EXCESS_OPTIONS.map(o => o.value)
        .filter((ex: number) =>
          getVisibleExcessOptions(paymentType, claimLimit, excessPriceBasis).includes(ex)
        )
        .sort((a: number, b: number) => a - b),
    [paymentType, claimLimit, excessPriceBasis]
  );
  useEffect(() => {
    if (excessOptions.length && !excessOptions.includes(excessAmount)) {
      setExcessAmount(excessOptions.includes(150) ? 150 : excessOptions[0]);
    }
  }, [excessOptions, excessAmount]);



  const [ageOverrideEnabled, setAgeOverrideEnabled] = useState(false);
  const [showAgeOverrideConfirm, setShowAgeOverrideConfirm] = useState(false);
  const [pendingAgeOverrideAction, setPendingAgeOverrideAction] = useState<'lookup' | 'quickConfirm' | null>(null);
  const [labourRate, setLabourRate] = useState(70);
  const [boostAddon, setBoostAddon] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [key: string]: boolean }>({});
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [freeExtendedCover, setFreeExtendedCover] = useState<'none' | '3months' | '6months' | 'peryear'>('none');
  const [includePayInFullDiscount, setIncludePayInFullDiscount] = useState(false); // Default OFF - agent can switch ON to add 10% discount
  const { maxPct: agentMaxDiscountPct, isPromoBlocked } = useAgentDiscountCap();
  const {
    allow3mo,
    allow6mo,
    used3mo,
    used6mo,
    remaining3mo,
    remaining6mo,
    allow1mo,
    used1mo,
    remaining1mo,
    canUse3mo,
    canUse6mo,
    canUse1mo,
    loading: concessionLoading,
  } = useConcessionAllowance(currentAdminId);
  const { isManagement } = useIsManagement();
  // Free bonus months currently selected. 'peryear' gives 1 free month per year of cover
  // (12mo -> 1, 24mo -> 2, 36mo -> 3).
  const coverYears = Math.max(1, Math.round((parseInt(paymentType, 10) || 12) / 12));
  const selectedBonusMonths =
    freeExtendedCover === '3months' ? 3
    : freeExtendedCover === '6months' ? 6
    : freeExtendedCover === 'peryear' ? coverYears
    : 0;
  const block3moFree = isPromoBlocked('3months_free');
  const block6moFree = isPromoBlocked('6months_free');
  const [showDiscountCapManager, setShowDiscountCapManager] = useState(false);
  // Management = admin / super_admin / sales_manager ONLY. sales_lead is NOT management.
  // Check both the authenticated role and the effective (impersonated) role — if either
  // resolves to a non-management role, management-only controls stay hidden.
  const MANAGEMENT_ROLES = ['admin', 'super_admin', 'sales_manager'];
  const authRoleLc = (userRole || '').toLowerCase();
  const effectiveRoleLc = (effectiveUserRole || '').toLowerCase();
  // Server-verified management check (admin_users.role + is_active) — authoritative.
  const { isManagement: isManagementVerified } = useIsManagement();
  const isManagementRole =
    isManagementVerified &&
    MANAGEMENT_ROLES.includes(authRoleLc) &&
    (!effectiveRoleLc || MANAGEMENT_ROLES.includes(effectiveRoleLc));
  // Hard ceiling: discounts above 30% require Management authorisation.
  const DISCOUNT_CEILING_PCT = 30;
  // Price match override — agent matches a competitor quote (max 10% cheaper)
  const PRICE_MATCH_MAX_PCT = 10;
  const [priceMatchMode, setPriceMatchMode] = useState(false);
  const [priceMatchProofPath, setPriceMatchProofPath] = useState<string | null>(null);
  const [priceMatchProofName, setPriceMatchProofName] = useState<string | null>(null);
  const [priceMatchUploading, setPriceMatchUploading] = useState(false);
  const [priceMatchCompetitor, setPriceMatchCompetitor] = useState('');
  // Known competitors agents can price match against ("Other" lets them type a name)
  const PRICE_MATCH_COMPETITORS = [
    'Best4Warranty',
    'Click4Warranty',
    'CoverMe Warranty',
    'Direct Car Warranty',
    'MotorEasy',
    'Warranty Direct',
    'Warranty First',
    'Warrantywise',
    'Other',
  ];
  const [priceMatchCompany, setPriceMatchCompany] = useState('');
  const [priceMatchOtherName, setPriceMatchOtherName] = useState('');
  const [priceMatchPrice, setPriceMatchPrice] = useState('');
  const [priceMatchSavedTotal, setPriceMatchSavedTotal] = useState<number | null>(null);
  // Keep the stored free-text value (saved to the customer notes) in sync
  const applyPriceMatchCompetitor = (company: string, otherName: string, price: string) => {
    const name = company === 'Other' ? otherName.trim() : company;
    const p = parseFloat((price || '').replace(/[^0-9.]/g, ''));
    if (!name && !Number.isFinite(p)) {
      setPriceMatchCompetitor('');
      return;
    }
    setPriceMatchCompetitor([name, Number.isFinite(p) && p > 0 ? `£${p}` : ''].filter(Boolean).join(' — '));
  };
  const blockedByCeiling = !isManagementRole && agentMaxDiscountPct > DISCOUNT_CEILING_PCT;
  const baseMaxDiscountPct = isManagementRole ? 100 : Math.min(agentMaxDiscountPct, DISCOUNT_CEILING_PCT);
  // Management authorisation for discounts over the ceiling (Ali or Kam)
  const [discountAuthOpen, setDiscountAuthOpen] = useState(false);
  const [discountAuthBy, setDiscountAuthBy] = useState<string | null>(null);
  const [discountAuthReason, setDiscountAuthReason] = useState('');
  const [discountAuthRequestPrice, setDiscountAuthRequestPrice] = useState('');
  const [discountAuthSubmitting, setDiscountAuthSubmitting] = useState(false);
  const [discountAuthRequestSent, setDiscountAuthRequestSent] = useState(false);
  const { myApproved: approvedDiscountRequest, myApprovedClaimLimit5k } = useDiscountAuthRequests(userRole);

  // £5,000 AutoCare Premium is a manager-authorised claim limit for every
  // vehicle. Agents request it per quote; management approve from the top
  // banner. Approval is tied to the registration on the quote.
  const [claimLimitAuthOpen, setClaimLimitAuthOpen] = useState(false);
  const [claimLimitAuthReason, setClaimLimitAuthReason] = useState('');
  const [claimLimitAuthSubmitting, setClaimLimitAuthSubmitting] = useState(false);
  const [claimLimitAuthSent, setClaimLimitAuthSent] = useState(false);
  const claimLimit5kApproval = (() => {
    const current = regNumber.replace(/\s/g, '').toUpperCase();
    if (!current) return null;
    return (
      myApprovedClaimLimit5k.find(
        (r) => (r.registration_plate || '').replace(/\s/g, '').toUpperCase() === current,
      ) || null
    );
  })();
  const { required: claimLimit5kAuthRequired } = useClaimLimit5kAuthRequired();
  const claimLimit5kAllowed = !claimLimit5kAuthRequired || isManagementRole || !!claimLimit5kApproval;

  // Reliability score — fetched from the same edge function the customer pricing
  // table uses, so management can see how dependable the vehicle is before
  // approving a big discount.
  const [reliabilityScore, setReliabilityScore] = useState<{
    score: number;
    tier: number;
    tierLabel: string;
  } | null>(null);
  useEffect(() => {
    if (!vehicleData?.regNumber) { setReliabilityScore(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const mileageNumber = vehicleData.mileage
          ? parseInt(vehicleData.mileage.replace(/,/g, ''), 10)
          : undefined;
        const { data, error } = await supabase.functions.invoke('calculate-reliability-score', {
          body: { registration: vehicleData.regNumber, mileage: mileageNumber },
        });
        if (cancelled || error || !data?.success || !data?.data) return;
        setReliabilityScore(data.data);
      } catch {
        /* reliability is advisory only — ignore failures */
      }
    })();
    return () => { cancelled = true; };
  }, [vehicleData?.regNumber, vehicleData?.mileage]);

  // When management authorise this agent's request for THIS vehicle, lift the
  // 30% ceiling automatically and drop the approved price in.
  useEffect(() => {
    if (!approvedDiscountRequest) return;
    const plate = (approvedDiscountRequest.registration_plate || '').replace(/\s/g, '').toUpperCase();
    const current = regNumber.replace(/\s/g, '').toUpperCase();
    if (!plate || plate !== current) return;
    setDiscountAuthBy(approvedDiscountRequest.decided_by_name || 'Management');
    setDiscountAuthReason(approvedDiscountRequest.reason || '');
  }, [approvedDiscountRequest, regNumber]);

  // In price match mode the agent may set any price they need to match the
  // competitor quote, capped at 10% cheaper than the competitor's price.
  const effectiveMaxDiscountPct = (priceMatchMode || discountAuthBy) ? 100 : baseMaxDiscountPct;

  // Parse the competitor's quoted price out of the free-text field (e.g. "WarrantyWise — £520")
  const priceMatchCompetitorPrice = (() => {
    const m = priceMatchCompetitor.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/g);
    if (!m || m.length === 0) return null;
    const val = Math.round(parseFloat(m[m.length - 1]));
    return Number.isFinite(val) && val > 0 ? val : null;
  })();
  // Lowest price allowed under price match: 10% cheaper than the competitor
  const priceMatchFloor = priceMatchCompetitorPrice
    ? Math.round(priceMatchCompetitorPrice * (1 - PRICE_MATCH_MAX_PCT / 100))
    : null;

  // Deposit on Stripe — agent takes a part payment now and tags the customer
  // record as "Payment due" so the balance can be chased in Customer Management.
  const [depositMode, setDepositMode] = useState(false);
  const [depositAmountInput, setDepositAmountInput] = useState('');
  const [depositDueDate, setDepositDueDate] = useState('');
  const depositAmountValue = (() => {
    // Whole pounds only — deposits and balances never carry pence.
    const v = Math.round(parseFloat((depositAmountInput || '').replace(/[^0-9.]/g, '')));
    return Number.isFinite(v) && v > 0 ? v : null;
  })();




  // Upload price match evidence (competitor quote screenshot / PDF).
  // Stored in the same bucket the Customer Management "Price comparison proof"
  // column reads from, and linked to the customer when the order completes.
  const handlePriceMatchUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Evidence must be under 10MB', variant: 'destructive' });
      return;
    }
    if (!/^image\//.test(file.type) && file.type !== 'application/pdf') {
      toast({ title: 'Unsupported file', description: 'Upload an image or PDF', variant: 'destructive' });
      return;
    }
    setPriceMatchUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const objectPath = `price-match/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('price-comparison-proofs')
        .upload(objectPath, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      if (priceMatchProofPath && priceMatchProofPath !== objectPath) {
        await supabase.storage.from('price-comparison-proofs').remove([priceMatchProofPath]);
      }
      setPriceMatchProofPath(objectPath);
      setPriceMatchProofName(file.name);
      toast({ title: 'Evidence uploaded', description: 'It will be saved to the customer record once the order is completed.' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setPriceMatchUploading(false);
    }
  };


  // Auto vehicle preview (Step 1)
  const [autoPreview, setAutoPreview] = useState<{
    loading: boolean;
    error: string | null;
    data: { make?: string; model?: string; year?: string; fuelType?: string; ageYears?: number; motMileage?: number | null; motMileageDate?: string | null; blocked?: boolean; blockReason?: string } | null;
  }>({ loading: false, error: null, data: null });
  
  // Validation state
  const [showNameError, setShowNameError] = useState(false);
  const [showLastNameError, setShowLastNameError] = useState(false);
  const [showEmailError, setShowEmailError] = useState(false);
  const customerInfoRef = React.useRef<HTMLDivElement>(null);
  const customerNameInputRef = React.useRef<HTMLInputElement>(null);
  const customerLastNameInputRef = React.useRef<HTMLInputElement>(null);

  // Keep combined customerName in sync with first + last name so the existing
  // live_quotes payload (`customerName`) and the LiveQuotePage auto-fill
  // (splits on space into firstName / lastName) continue to work unchanged.
  useEffect(() => {
    const combined = `${customerFirstName.trim()} ${customerLastName.trim()}`.trim();
    setCustomerName(combined);
  }, [customerFirstName, customerLastName]);

  // Helper for legacy callers that only have a single "Firstname Lastname"
  // string (lead import, saved-quote loader, sent-quote editor).
  const applyCustomerFullName = (full: string) => {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    setCustomerFirstName(parts[0] || '');
    setCustomerLastName(parts.slice(1).join(' '));
  };

  // ---- Draft persistence (sessionStorage) --------------------------------
  // Keeps the Quote/Order journey state alive if the agent navigates away
  // (browser back, other admin tab, accidental refresh) so customer & vehicle
  // details are not lost when returning to Quotes & Orders.
  const DRAFT_KEY = 'admin_get_quote_draft_v1';
  const hydratedRef = React.useRef(false);
  const clearDraft = React.useCallback(() => {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
  }, []);
  const [customMonthlyPrice, setCustomMonthlyPrice] = useState('');
  const [customFullPrice, setCustomFullPrice] = useState('');
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const [isSendingSelfCopy, setIsSendingSelfCopy] = useState(false);
  const [selfCopySent, setSelfCopySent] = useState(false);
  const [lastSendPayload, setLastSendPayload] = useState<any>(null);
  const [sentQuotes, setSentQuotes] = useState<any[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedHistoryQuote, setSelectedHistoryQuote] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('new');
  const [historySubTab, setHistorySubTab] = useState<'sent' | 'saved'>('sent');
  const [paidOrdersCount, setPaidOrdersCount] = useState(0);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState('');
  
  // Confirm External Payment state
  const [isConfirmingPaid, setIsConfirmingPaid] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; record?: any }>({ show: false });
  const [showConfirmPaymentDialog, setShowConfirmPaymentDialog] = useState(false);
  const [paymentSource, setPaymentSource] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [sendToW2k, setSendToW2k] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [existingPolicyWarning, setExistingPolicyWarning] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [externalPaymentStep, setExternalPaymentStep] = useState<'details' | 'preview' | 'complete'>('details');
  const [quotedPriceOverride, setQuotedPriceOverride] = useState<string>('');
  const [isLookingUpPostcode, setIsLookingUpPostcode] = useState(false);
  const [postcodeLookupSuccess, setPostcodeLookupSuccess] = useState(false);
  
  // Warranty Start Date (separate from payment date)
  const [warrantyStartDate, setWarrantyStartDate] = useState<Date>(new Date());
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [isQuickConfirming, setIsQuickConfirming] = useState(false);
  
  // Customer address fields for external payment
  const [customerPostcode, setCustomerPostcode] = useState('');
  const [customerStreet, setCustomerStreet] = useState('');
  const [customerTown, setCustomerTown] = useState('');
  const [customerBuildingNumber, setCustomerBuildingNumber] = useState('');
  const [customerCounty, setCustomerCounty] = useState('');
  const [skipAddressDetails, setSkipAddressDetails] = useState(false);
  
  // Editable customer fields for external payment dialog
  const [editableCustomerName, setEditableCustomerName] = useState('');
  const [editableCustomerFirstName, setEditableCustomerFirstName] = useState('');
  const [editableCustomerLastName, setEditableCustomerLastName] = useState('');
  const [editableCustomerEmail, setEditableCustomerEmail] = useState('');
  const [editableCustomerPhone, setEditableCustomerPhone] = useState('');
  const [editableMileage, setEditableMileage] = useState('');
  const [editableRegNumber, setEditableRegNumber] = useState('');
  const [mileagePrefilledFromMot, setMileagePrefilledFromMot] = useState(false);
  
  // Section expand/collapse state for external payment dialog - all open by default
  const [expandedSections, setExpandedSections] = useState({
    customerVehicle: true,
    address: true,
    policyConfig: true,
    payment: true,
  });
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Hydrate draft on mount (before any prePopulatedLead effect wipes it).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (prePopulatedLead) return; // Lead selection takes precedence
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      if (typeof d.step === 'number') setStep(d.step);
      if (typeof d.regNumber === 'string') setRegNumber(d.regNumber);
      if (typeof d.mileage === 'string') setMileage(d.mileage);
      if (typeof d.sliderMileage === 'number') setSliderMileage(d.sliderMileage);
      if (d.vehicleData) setVehicleData(d.vehicleData);
      if (typeof d.customerEmail === 'string') setCustomerEmail(d.customerEmail);
      if (typeof d.customerFirstName === 'string') setCustomerFirstName(d.customerFirstName);
      if (typeof d.customerLastName === 'string') setCustomerLastName(d.customerLastName);
      if (typeof d.customerPhone === 'string') setCustomerPhone(d.customerPhone);
      if (typeof d.customerDob === 'string') setCustomerDob(d.customerDob);
      if (d.selectedLeadId !== undefined) setSelectedLeadId(d.selectedLeadId);
      if (typeof d.paymentType === 'string') setPaymentType(d.paymentType as PaymentPeriod);
      if (typeof d.excessAmount === 'number') setExcessAmount(d.excessAmount);
      if (typeof d.claimLimit === 'number') setClaimLimit(d.claimLimit);
      if (typeof d.labourRate === 'number') setLabourRate(d.labourRate);
      if (typeof d.boostAddon === 'boolean') setBoostAddon(d.boostAddon);
      if (d.selectedAddOns && typeof d.selectedAddOns === 'object') setSelectedAddOns(d.selectedAddOns);
      if (typeof d.additionalNotes === 'string') setAdditionalNotes(d.additionalNotes);
      if (d.freeExtendedCover === 'none' || d.freeExtendedCover === '3months' || d.freeExtendedCover === '6months' || d.freeExtendedCover === 'peryear') {
        const val = d.freeExtendedCover as 'none' | '3months' | '6months' | 'peryear';
        if (val === '3months' && block3moFree) setFreeExtendedCover('none');
        else if (val === '6months' && block6moFree) setFreeExtendedCover('none');
        else setFreeExtendedCover(val);
      }
      if (typeof d.includePayInFullDiscount === 'boolean') setIncludePayInFullDiscount(d.includePayInFullDiscount);
      if (typeof d.customerPostcode === 'string') setCustomerPostcode(d.customerPostcode);
      if (typeof d.customerStreet === 'string') setCustomerStreet(d.customerStreet);
      if (typeof d.customerTown === 'string') setCustomerTown(d.customerTown);
      if (typeof d.customerBuildingNumber === 'string') setCustomerBuildingNumber(d.customerBuildingNumber);
      if (typeof d.customerCounty === 'string') setCustomerCounty(d.customerCounty);
      if (typeof d.skipAddressDetails === 'boolean') setSkipAddressDetails(d.skipAddressDetails);
      // NOTE: intentionally not restoring customMonthlyPrice / customFullPrice /
      // quotedPriceOverride here — otherwise a refresh keeps figures stuck on
      // the previous quote even after starting a new one.

      if (typeof d.warrantyStartDate === 'string') {
        const dt = new Date(d.warrantyStartDate);
        if (!isNaN(dt.getTime())) setWarrantyStartDate(dt);
      }
      if (typeof d.ageOverrideEnabled === 'boolean') setAgeOverrideEnabled(d.ageOverrideEnabled);
    } catch { /* ignore corrupt draft */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft on every meaningful change (skip until after hydration).
  useEffect(() => {
    if (!hydratedRef.current) return;
    // Don't persist empty step-1 form (nothing worth saving)
    const hasAnything = regNumber || vehicleData || customerFirstName || customerLastName
      || customerEmail || customerPhone || customerPostcode;
    if (!hasAnything) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        step, regNumber, mileage, sliderMileage, vehicleData,
        customerEmail, customerFirstName, customerLastName, customerPhone, customerDob,
        selectedLeadId, paymentType, excessAmount, claimLimit, labourRate, boostAddon,
        selectedAddOns, additionalNotes, freeExtendedCover, includePayInFullDiscount,
        customerPostcode, customerStreet, customerTown, customerBuildingNumber,
        customerCounty, skipAddressDetails, customMonthlyPrice, customFullPrice,
        quotedPriceOverride, ageOverrideEnabled,
        warrantyStartDate: warrantyStartDate?.toISOString(),
      }));
    } catch { /* quota — ignore */ }
  }, [
    step, regNumber, mileage, sliderMileage, vehicleData,
    customerEmail, customerFirstName, customerLastName, customerPhone, customerDob,
    selectedLeadId, paymentType, excessAmount, claimLimit, labourRate, boostAddon,
    selectedAddOns, additionalNotes, freeExtendedCover, includePayInFullDiscount,
    customerPostcode, customerStreet, customerTown, customerBuildingNumber,
    customerCounty, skipAddressDetails, customMonthlyPrice, customFullPrice,
    quotedPriceOverride, ageOverrideEnabled, warrantyStartDate,
  ]);


  // Keep combined editableCustomerName in sync with the split first/last inputs
  // so summary/preview and legacy save paths continue to work.
  useEffect(() => {
    const combined = `${editableCustomerFirstName.trim()} ${editableCustomerLastName.trim()}`.trim();
    setEditableCustomerName(combined);
  }, [editableCustomerFirstName, editableCustomerLastName]);
  // Completion status tracking
  const [completionStatus, setCompletionStatus] = useState<{
    policyCreated: boolean;
    emailSent: boolean | null; // null = pending, true = success, false = failed
    w2000Sent: boolean | null; // null = pending/scheduled, true = success, false = failed
    warrantyReference: string;
    isFutureStart: boolean;
  } | null>(null);

  // Quicklink visibility mirrors the admin sidebar role/permission rules
  const canAccessTab = (tab: string) => {
    if (!effectiveUserRole) return false;
    if (effectiveUserRole === 'super_admin' || effectiveUserRole === 'dev_tester') return true;
    const permKey = `tab_${tab}`;
    if (userPermissions && permKey in userPermissions) {
      return userPermissions[permKey] === true;
    }
    if (effectiveUserRole === 'admin') return true;
    const roleTabs: Record<string, string[]> = {
      sales: ['new-leads', 'recontact-leads'],
      sales_lead: ['new-leads', 'recontact-leads'],
      sales_manager: ['new-leads', 'recontact-leads'],
      performance_manager: ['new-leads', 'recontact-leads'],
      lead_gen: ['new-leads', 'recontact-leads'],
      accounts: ['new-leads'],
    };
    return roleTabs[effectiveUserRole]?.includes(tab) ?? false;
  };

  // Handle lead selection (from search or pre-populated)
  const handleLeadSelect = (lead: LeadData) => {
    setSelectedLeadId(lead.id);
    setSelectedLeadOwner(lead.owner_name || null);
    setCustomerEmail(lead.email);
    setCustomerFirstName(lead.first_name || '');
    setCustomerLastName(lead.last_name || '');
    setCustomerPhone(lead.phone || '');

    const newReg = lead.vehicle_reg ? lead.vehicle_reg.replace(/\s+/g, '').toUpperCase() : '';
    const currentReg = (vehicleData?.regNumber || regNumber || '').replace(/\s+/g, '').toUpperCase();
    const regChanged = !!newReg && newReg !== currentReg;

    let numMileage: number | null = null;
    if (lead.mileage) {
      const parsed = parseInt(String(lead.mileage).replace(/,/g, ''), 10);
      if (!isNaN(parsed)) numMileage = parsed;
    }

    if (lead.vehicle_reg) {
      setRegNumber(lead.vehicle_reg.toUpperCase());
    }
    if (numMileage !== null) {
      setMileage(numMileage.toLocaleString());
      setSliderMileage(numMileage);
    } else if (regChanged) {
      // Different vehicle with no mileage on the lead — clear the old vehicle's mileage
      setMileage('');
      setSliderMileage(0);
    }

    // Switching to a different vehicle must replace the vehicle shown on Step 2,
    // otherwise the previous lead's car stays on screen and gets priced.
    if (regChanged) {
      setVehicleData({
        regNumber: newReg,
        mileage: numMileage !== null ? numMileage.toLocaleString() : '',
        make: lead.vehicle_make || '',
        model: lead.vehicle_model || '',
        fuelType: '',
        transmission: '',
        year: lead.vehicle_year || '',
        vehicleType: '',
      });

      // Refresh from DVLA in the background so make/model/year/fuel are authoritative
      (async () => {
        try {
          const { data } = await supabase.functions.invoke('dvla-vehicle-lookup', {
            body: { registrationNumber: newReg, skipAgeCheck: true },
          });
          if (data?.make) {
            setVehicleData(prev => {
              if (!prev || prev.regNumber.replace(/\s+/g, '').toUpperCase() !== newReg) return prev;
              return {
                ...prev,
                make: data.make,
                model: data.model || prev.model,
                fuelType: data.fuelType || prev.fuelType,
                transmission: data.transmission || prev.transmission,
                year: data.yearOfManufacture || data.year || prev.year,
                vehicleType: data.vehicleType || prev.vehicleType,
              };
            });
          }
        } catch (e) {
          console.warn('[GetQuote] Lead import DVLA refresh failed', e);
        }
      })();
    }

    toast({
      title: "Lead imported",
      description: regChanged
        ? `Switched to ${lead.first_name || lead.email} — ${newReg}${lead.vehicle_make ? ` (${lead.vehicle_make}${lead.vehicle_model ? ' ' + lead.vehicle_model : ''})` : ''}.`
        : `Details for ${lead.first_name || lead.email} have been loaded.`,
    });
  };

  // Handle pre-populated lead on mount
  useEffect(() => {
    if (prePopulatedLead) {
      handleLeadSelect(prePopulatedLead);
    }
  }, [prePopulatedLead]);

  // Auto-pull the customer's name / email / phone from a matching lead when the
  // agent types a registration and hasn't picked a lead from the search popover.
  // Existing typed values are never overwritten.
  const [autoLeadReg, setAutoLeadReg] = useState<string | null>(null);
  const [autoLeadMatched, setAutoLeadMatched] = useState(false);
  const adminUsersMap = useAllAdminUsersMap();
  useEffect(() => {
    const reg = (regNumber || '').replace(/\s+/g, '').toUpperCase();
    if (reg.length < 4) return;
    if (selectedLeadId) return;
    if (autoLeadReg === reg) return;
    setAutoLeadReg(reg);
    let cancelled = false;
    (async () => {
      try {
        const spaced = reg.length > 4 ? `${reg.slice(0, reg.length - 3)} ${reg.slice(-3)}` : reg;
        const { data } = await supabase
          .from('sales_leads')
          .select('id, first_name, last_name, email, phone, assigned_to, mileage, created_at')
          .or(`vehicle_reg.ilike.${reg},vehicle_reg.ilike.${spaced}`)
          .order('created_at', { ascending: false })
          .limit(1);
        if (cancelled) return;
        const lead = (data as any[])?.[0];
        if (!lead) return;
        let filled = false;
        setCustomerFirstName(prev => { if (prev.trim() || !lead.first_name) return prev; filled = true; return lead.first_name; });
        setCustomerLastName(prev => (prev.trim() || !lead.last_name ? prev : lead.last_name));
        setCustomerEmail(prev => { if (prev.trim() || !lead.email) return prev; filled = true; return lead.email; });
        setCustomerPhone(prev => { if (prev.trim() || !lead.phone) return prev; filled = true; return lead.phone; });
        if (lead.email || lead.first_name || lead.phone) {
          setAutoLeadMatched(true);
          const owner = lead.assigned_to ? adminUsersMap.get(lead.assigned_to) : null;
          setSelectedLeadOwner(owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email : null);
          if (filled) {
            toast({
              title: 'Lead details pulled in',
              description: `Matched an existing lead for ${reg} — contact details filled from the lead.`,
            });
          }
        }
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regNumber, selectedLeadId]);


  // MOT mileage lookup for external payment dialog
  const { motMileage, motDate, isLoading: motMileageLoading } = useMotMileage(editableRegNumber);

  // MOT mileage lookup for Step 1 registration input (mirrors customer journey)
  const { motMileage: step1MotMileage, motDate: step1MotDateRaw, isLoading: step1MotLoading } = useMotMileage(regNumber);
  const step1MotMileageResolved = (autoPreview.data?.motMileage as number | null | undefined) ?? step1MotMileage ?? null;
  const step1MotDate = (autoPreview.data?.motMileageDate as string | null | undefined) ?? step1MotDateRaw ?? null;

  // Auto-prefill Step 1 mileage from MOT history (mirrors Step 4 behaviour).
  // We remember the value we auto-filled so a new registration replaces a stale
  // auto-filled figure, while anything the agent typed by hand is preserved.
  const [step1MileagePrefilledReg, setStep1MileagePrefilledReg] = useState<string | null>(null);
  const [step1AutoFilledMileage, setStep1AutoFilledMileage] = useState<string | null>(null);
  useEffect(() => {
    const reg = (regNumber || '').replace(/\s+/g, '').toUpperCase();
    if (!reg) return;
    if (step1MileagePrefilledReg && step1MileagePrefilledReg !== reg && mileage === (step1AutoFilledMileage ?? '')) {
      // Reg changed and the field still holds the previous MOT figure — clear it
      setMileage('');
      setStep1AutoFilledMileage(null);
      setStep1MileagePrefilledReg(null);
      return;
    }
    if (!step1MotMileageResolved) return;
    if (step1MileagePrefilledReg === reg) return;
    const current = mileage.trim();
    if (current && current !== (step1AutoFilledMileage ?? '')) {
      // Agent typed their own figure — keep it
      setStep1MileagePrefilledReg(reg);
      return;
    }
    const m = Number(step1MotMileageResolved);
    const formatted = m.toLocaleString();
    setMileage(formatted);
    setSliderMileage(Math.min(m, 150000));
    setStep1AutoFilledMileage(formatted);
    setStep1MileagePrefilledReg(reg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regNumber, step1MotMileageResolved]);
  
  
  // Auto-prefill mileage from MOT when available
  useEffect(() => {
    if (motMileage && !editableMileage && !mileagePrefilledFromMot) {
      setEditableMileage(motMileage.toString());
      setMileagePrefilledFromMot(true);
    }
  }, [motMileage, editableMileage, mileagePrefilledFromMot]);

  // Get admin email on mount
  useEffect(() => {
    const getAdminEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('email, first_name, last_name')
          .eq('user_id', user.id)
          .single();
        // Prefer the logged-in auth email so the copy goes to the actual agent
        // who is signed in, not a generic shared mailbox stored on the admin_users row.
        setAdminEmail(user.email || adminUser?.email || null);
        const fullName = [adminUser?.first_name, adminUser?.last_name].filter(Boolean).join(' ');
        setAdminName(fullName || null);
      }
    };
    getAdminEmail();
    // Only load the local (instant) list on mount — sent-history and paid-orders
    // counts hit the DB and were slowing first paint. They're loaded lazily when
    // the user actually opens those tabs (see effect below).
    loadSavedQuotes();
  }, []);

  // Lazy-load DB-backed lists when their tab is opened for the first time.
  const [loadedHistory, setLoadedHistory] = useState(false);
  const [loadedPaidOrders, setLoadedPaidOrders] = useState(false);
  useEffect(() => {
    if (activeTab === 'history' && !loadedHistory) {
      setLoadedHistory(true);
      loadSentQuotesHistory();
    }
    if (activeTab === 'paid' && !loadedPaidOrders) {
      setLoadedPaidOrders(true);
      loadPaidOrdersCount();
    }
  }, [activeTab, loadedHistory, loadedPaidOrders]);

  const resolveAdminRecipient = async () => {
    if (adminEmail) {
      return { email: adminEmail, name: adminName };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { email: null, name: null };

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('email, first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const resolvedEmail = user.email || adminUser?.email || null;
    const resolvedName = [adminUser?.first_name, adminUser?.last_name].filter(Boolean).join(' ') || null;

    setAdminEmail(resolvedEmail);
    setAdminName(resolvedName);

    return { email: resolvedEmail, name: resolvedName };
  };

  // Load paid orders count
  const loadPaidOrdersCount = async () => {
    try {
      const { count } = await supabase
        .from('live_quotes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['paid', 'paid_externally']);
      setPaidOrdersCount(count || 0);
    } catch (e) {
      console.error('Error loading paid orders count:', e);
    }
  };

  // Load saved quotes from localStorage
  const loadSavedQuotes = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('admin_saved_quotes') || '[]');
      setSavedQuotes(saved);
    } catch (e) {
      console.error('Error loading saved quotes:', e);
      setSavedQuotes([]);
    }
  };

  // Load a saved quote into the form
  const loadSavedQuote = (savedQuote: any) => {
    if (savedQuote.vehicleData) {
      setVehicleData(savedQuote.vehicleData);
      setRegNumber(savedQuote.vehicleData.regNumber || '');
      setMileage(savedQuote.vehicleData.mileage || '');
      const numMileage = parseInt(String(savedQuote.vehicleData.mileage).replace(/,/g, ''), 10);
      if (!isNaN(numMileage)) setSliderMileage(numMileage);
    }
    applyCustomerFullName(savedQuote.customerName || '');
    setCustomerEmail(savedQuote.customerEmail || '');
    setCustomerPhone(savedQuote.customerPhone || '');
    const loadedPaymentType = savedQuote.paymentType || '24months';
    setPaymentType(loadedPaymentType);
    setExcessAmount(savedQuote.excessAmount ?? 100);
    setClaimLimit(savedQuote.claimLimit || 2000);
    setLabourRate(savedQuote.labourRate || 70);
    setBoostAddon(savedQuote.boostAddon || false);
    setSelectedAddOns(savedQuote.selectedAddOns || {});
    setFreeExtendedCover(savedQuote.freeExtendedCover || 'none');
    setAdditionalNotes(savedQuote.additionalNotes || '');
    
    // Set step based on available data
    if (savedQuote.vehicleData) {
      setStep(2);
    }
    
    setActiveTab('new');
    toast({
      title: "Quote loaded",
      description: "Saved quote has been loaded. You can continue editing.",
    });
  };

  // Delete a saved quote
  const deleteSavedQuote = (index: number) => {
    const updated = [...savedQuotes];
    updated.splice(index, 1);
    localStorage.setItem('admin_saved_quotes', JSON.stringify(updated));
    setSavedQuotes(updated);
    toast({
      title: "Quote deleted",
      description: "Saved quote has been removed.",
    });
  };

  // Track if custom prices have been manually overridden
  const [isPriceOverridden, setIsPriceOverridden] = useState(false);

  // Manager-only diagnostic: records whether this quote came from the published
  // pricing model or fell back to the legacy grid (vehicle referred out).
  const pricingTrace: { usedLegacy: boolean; reason: string } = { usedLegacy: false, reason: '' };

  // Calculate base price (before any custom overrides)
  const calculateBasePrice = () => {
    // Get duration months for add-on calculation
    const durationMonths = DURATION_MONTHS[paymentType] || 12;
    
    // Auto-included add-ons based on duration (2yr gets breakdown, 3yr gets breakdown+rental)
    const autoIncluded = getAutoIncludedAddOns(paymentType);
    
    // Calculate add-on price from selected add-ons (excluding auto-included)
    const addOnPrice = calculateAddOnPrice(selectedAddOns, paymentType, durationMonths);
    
    // Calculate vehicle adjustment (high-mileage surcharge: +£200/+£400/+£600 for 1/2/3-year)
    // This matches Step 3 pricing logic exactly
    const warrantyYears = paymentType === '12months' ? 1 : paymentType === '24months' ? 2 : 3;
    const vehicleMileage = parseInt(mileage.replace(/[^0-9]/g, '')) || 0;
    const vehicleAdjustmentResult = calculateVehiclePriceAdjustment(
      { 
        mileage: vehicleMileage.toString(),
        make: vehicleData?.make || '',
        model: vehicleData?.model || '',
        year: vehicleData?.year || '',
        vehicleType: vehicleData?.vehicleType || '',
        regNumber: vehicleData?.regNumber || regNumber || ''
      }, 
      warrantyYears
    );
    
    console.log('🔍 Admin Quote - Vehicle Adjustment:', {
      mileage: vehicleMileage,
      warrantyYears,
      adjustmentAmount: vehicleAdjustmentResult.adjustmentAmount,
      adjustmentType: vehicleAdjustmentResult.adjustmentType
    });
    
    // ── Price from the published pricing model (same maths as the Aug hybrid
    // test Step 2) so Quotes & Orders and the pricing sandboxes never disagree.
    const modelVehicleAge = (() => {
      const manufacture = (vehicleData as any)?.manufactureDate || (vehicleData as any)?.registrationDate;
      if (manufacture) {
        const d = new Date(manufacture);
        if (!isNaN(d.getTime())) return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      }
      const year = parseInt(String(vehicleData?.year || ''), 10);
      if (year) return new Date().getFullYear() - year;
      return null;
    })();
    const modelQuote = priceFromPricingModel(pricingModel, {
      ageYears: modelVehicleAge,
      mileage: vehicleMileage || null,
      fuelType: vehicleData?.fuelType,
      vehicleType: vehicleData?.vehicleType,
      make: vehicleData?.make,
      model: (vehicleData as any)?.model,
    }, {
      paymentPeriod: paymentType,
      voluntaryExcess: excessAmount,
      claimLimit: getDisplayClaimLimitValue(claimLimit),
      labourRate: labourRate,
    });
    if (modelQuote && !modelQuote.referral && modelVehicleAge != null) {
      pricingTrace.usedLegacy = false;
      pricingTrace.reason = '';
      const totalPrice = Math.ceil(modelQuote.totalPrice + addOnPrice);
      const monthlyPrice = Math.ceil(totalPrice / 12);
      const contractTotal = monthlyPrice * 12;
      return {
        totalPrice,
        monthlyPrice,
        payInFullPrice: includePayInFullDiscount
          ? Math.ceil(contractTotal * 0.90)
          : contractTotal,
        wasPrice: totalPrice + (MARKETING_SAVINGS[paymentType] || 0),
        savings: MARKETING_SAVINGS[paymentType] || 0,
      };
    }
    pricingTrace.usedLegacy = true;
    pricingTrace.reason = modelVehicleAge == null
      ? 'no vehicle age available (missing manufacture/registration date)'
      : !modelQuote
        ? 'no published pricing model available'
        : (modelQuote as any).referralReason || 'vehicle referred out by the current model';


     const effectiveClaimLimit = getBaseClaimLimit(claimLimit);
    const premiumSurcharge = getClaimLimitSurcharge(claimLimit, paymentType, excessAmount);
    

    
    const result = calculateAdminQuoteWarrantyPrice({
      paymentPeriod: paymentType,
      voluntaryExcess: excessAmount,
      claimLimit: effectiveClaimLimit,
      labourRate: labourRate,
      boostEnabled: boostAddon,
      vehicleAdjustment: vehicleAdjustmentResult.adjustmentAmount,
      isMotorbike: isMotorbikeAdjustment(vehicleAdjustmentResult),
      addOnPrice: addOnPrice + premiumSurcharge,
      make: vehicleData?.make,
      fuelType: vehicleData?.fuelType,
      vehicleName: [vehicleData?.make, (vehicleData as any)?.model].filter(Boolean).join(' '),
      // Age / mileage / powertrain / vehicle-type multiplier from the published
      // Age-based builder figures, so different cars quote different prices.
      vehicleFactor: getVehiclePriceFactor({
        year: vehicleData?.year,
        manufactureDate: (vehicleData as any)?.manufactureDate,
        mileage: vehicleMileage,
        fuelType: vehicleData?.fuelType,
        vehicleType: vehicleData?.vehicleType,
      }),
    });
    
    // Calculate pay-in-full based on monthly × 12 for consistency (avoids rounding discrepancies)
    const contractTotal = result.monthlyPrice * 12;
    const payInFullPrice = includePayInFullDiscount 
      ? Math.ceil(contractTotal * 0.90)
      : contractTotal;
    
    return { 
      totalPrice: result.totalPrice, 
      monthlyPrice: result.monthlyPrice,
      payInFullPrice,
      wasPrice: result.wasPrice,
      savings: result.savings
    };
  };

  // Calculate price using pricingMatrix.ts with add-ons
  const calculatePrice = () => {
    // If custom prices are set and user has manually overridden, use them
    if (isPriceOverridden) {
      if (customFullPrice && parseFloat(customFullPrice) > 0) {
        const fullPrice = Math.round(parseFloat(customFullPrice));
        // Never show decimals — monthly is always rounded UP to a whole pound
        const monthly = Math.ceil(fullPrice / 12);
        return { 
          totalPrice: fullPrice, 
          monthlyPrice: monthly,
          payInFullPrice: includePayInFullDiscount ? Math.ceil(fullPrice * 0.90) : fullPrice,
          wasPrice: 0,
          savings: 0
        };
      }
      if (customMonthlyPrice && parseFloat(customMonthlyPrice) > 0) {
        const monthly = Math.round(parseFloat(customMonthlyPrice));
        const total = Math.ceil(monthly * 12);
        return { 
          totalPrice: total, 
          monthlyPrice: monthly,
          payInFullPrice: includePayInFullDiscount ? Math.ceil(total * 0.90) : total,
          wasPrice: 0,
          savings: 0
        };
      }
    }
    
    return calculateBasePrice();
  };

  const currentPrice = calculatePrice();
  const basePrice = calculateBasePrice();
  // When a custom price is set, the custom total is authoritative
  const displayedTotalPrice = isPriceOverridden
    ? Number(currentPrice.totalPrice || 0)
    : Math.ceil(Number(currentPrice.monthlyPrice || 0) * 12);
  const displayedPayInFullPrice = currentPrice.payInFullPrice || (includePayInFullDiscount ? Math.ceil(displayedTotalPrice * 0.9) : displayedTotalPrice);
  const displayedPayInFullSavings = Math.max(displayedTotalPrice - displayedPayInFullPrice, 0);

  // Feed the quote total back into the excess visibility brackets (£250 unlocks
  // from £300, £500 from £500) so Q&O matches Step 3 exactly.
  useEffect(() => {
    // Bracket on the £100-baseline total (same helper as Step 3/4) so the tiers
    // never flip just because a cheaper excess is currently selected.
    const total = getExcessBracketBasis(paymentType, currentPrice?.totalPrice, excessAmount);
    setExcessPriceBasis(prev => (prev === total ? prev : total));
  }, [currentPrice?.totalPrice, paymentType, excessAmount]);



  /**
   * Audit-only record of a manual price override (no blocking, no price change).
   * Managers review these in Admin → Discounts given → "Manual price overrides".
   */
  const auditPriceOverride = (context: 'quotes_and_orders' | 'quote_link' | 'confirm_payment', enteredTotal?: number) => {
    if (!isPriceOverridden) return;
    const total = Number(enteredTotal ?? displayedTotalPrice) || 0;
    const matrixTotal = Math.ceil(Number(basePrice.monthlyPrice || 0) * 12) || Number(basePrice.totalPrice || 0);
    if (!total || !matrixTotal) return;
    const me = currentAdminId ? adminUsersMap.get(currentAdminId) : null;
    logPriceOverride({
      adminUserId: currentAdminId,
      userId: user?.id || null,
      agentName: me ? [me.first_name, me.last_name].filter(Boolean).join(' ') : (user?.email || null),
      agentEmail: me?.email || user?.email || null,
      context,
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      vehicleReg: vehicleData?.regNumber || null,
      vehicleMake: vehicleData?.make || null,
      vehicleModel: vehicleData?.model || null,
      paymentType,
      excessAmount,
      claimLimit,
      labourRate,
      matrixTotal,
      matrixMonthly: Number(basePrice.monthlyPrice || 0),
      enteredTotal: total,
      enteredMonthly: parseFloat(customMonthlyPrice) || Number(currentPrice.monthlyPrice || 0),
      floorAmount: MIN_BASE_PRICE_BY_PERIOD[paymentType as PaymentPeriod] ?? null,
      priceMatchMode,
      priceMatchCompany: priceMatchMode
        ? (priceMatchCompany === 'Other' ? (priceMatchOtherName || 'Other') : priceMatchCompany) || null
        : null,
      priceMatchPrice: priceMatchMode ? (priceMatchCompetitorPrice ?? null) : null,
    });
  };




  // Reset price override when any selection changes
  useEffect(() => {
    setIsPriceOverridden(false);
  }, [paymentType, excessAmount, claimLimit, labourRate, boostAddon, selectedAddOns]);

  // Reset claim limit if premium vehicle selected and £5000 was chosen
  useEffect(() => {
    if (claimLimit === 5000 && isPremiumVehicle(vehicleData?.make, vehicleData?.model)) {
      setClaimLimit(2000);
    }
  }, [vehicleData?.make]);

  // £5,000 cannot stay selected without a manager authorisation for this reg —
  // fall back to £3,000 (2000 + boost) so it can never be quoted or paid.
  useEffect(() => {
    if (claimLimit === 5000 && !claimLimit5kAllowed) {
      setClaimLimit(2000);
      setBoostAddon(true);
    }
  }, [claimLimit, claimLimit5kAllowed]);

  // Auto-populate custom price fields when selections change (if not manually overridden)
  useEffect(() => {
    if (!isPriceOverridden) {
      setCustomMonthlyPrice(basePrice.monthlyPrice.toString());
      setCustomFullPrice(basePrice.totalPrice.toString());
    }
  }, [paymentType, excessAmount, claimLimit, labourRate, boostAddon, selectedAddOns, isPriceOverridden]);

  // Auto-identify vehicle when a complete reg is entered (Step 1 only)
  useEffect(() => {
    const clean = regNumber.replace(/\s/g, '').toUpperCase();
    if (step !== 1 || clean.length < 5) {
      setAutoPreview({ loading: false, error: null, data: null });
      return;
    }
    let cancelled = false;
    setAutoPreview((p) => ({ ...p, loading: true, error: null }));
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
          body: { registrationNumber: clean, skipAgeCheck: true }, // preview only — no hard block here
        });
        if (cancelled) return;
        if (error || !data || data.error || data.found === false || !data.make) {
          setAutoPreview({ loading: false, error: 'Could not identify vehicle automatically', data: null });
          return;
        }
        const ageYears = getVehicleAge({
          registrationDate: data.registrationDate,
          manufactureDate: data.manufactureDate,
          year: data.yearOfManufacture || data.year,
        }).ageYears ?? undefined;
        setAutoPreview({
          loading: false,
          error: null,
          data: {
            make: data.make,
            model: data.model,
            year: data.yearOfManufacture || data.year,
            fuelType: data.fuelType,
            ageYears,
            motMileage: data.motMileage ?? data.mileage ?? null,
            motMileageDate: data.motMileageDate ?? null,
            // A "Not covered" rule set in Admin → Price updates blocks the vehicle here too.
            blocked: !!data.blocked || isVehicleBlockedByRules([data.make, data.model].filter(Boolean).join(' ')),
            blockReason: data.blockReason || (isVehicleBlockedByRules([data.make, data.model].filter(Boolean).join(' ')) ? MANUAL_REFERRAL_MESSAGE : undefined),
          },
        });
      } catch (e: any) {
        if (!cancelled) setAutoPreview({ loading: false, error: 'Lookup failed', data: null });
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [regNumber, step]);

  // Handle custom price field changes — editing one side auto-updates the other
  // (monthly ↔ total uses ×12 / ÷12). Agents can still type any amount; the 20%
  // floor warning below is informational, not blocking.
  // Whole pounds only — pence are stripped as they are typed so no quote, invoice
  // or payment link can ever carry a decimal.
  const handleCustomMonthlyChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setCustomMonthlyPrice(sanitized);
    const n = parseFloat(sanitized);
    if (!isNaN(n) && n > 0) {
      setCustomFullPrice(String(Math.ceil(n * 12)));
    } else if (sanitized === '') {
      setCustomFullPrice('');
    }
    setIsPriceOverridden(true);
  };

  const handleCustomFullChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setCustomFullPrice(sanitized);
    const n = parseFloat(sanitized);
    if (!isNaN(n) && n > 0) {
      setCustomMonthlyPrice(String(Math.ceil(n / 12)));
    } else if (sanitized === '') {
      setCustomMonthlyPrice('');
    }
    setIsPriceOverridden(true);
  };


  const resetToCalculatedPrice = () => {
    // The calculated/base quote must become the sole price source. Clear every
    // independent state that can alter either the quote or payment amount.
    setIsPriceOverridden(false);
    setCustomMonthlyPrice(basePrice.monthlyPrice.toString());
    setCustomFullPrice(basePrice.totalPrice.toString());
    setQuotedPriceOverride('');
    setIncludePayInFullDiscount(false);

    setPriceMatchMode(false);
    setPriceMatchCompetitor('');
    setPriceMatchCompany('');
    setPriceMatchOtherName('');
    setPriceMatchPrice('');
    setPriceMatchProofPath(null);
    setPriceMatchProofName(null);
    setPriceMatchUploading(false);

    setDepositMode(false);
    setDepositAmountInput('');
    setDepositDueDate('');

    setDiscountAuthOpen(false);
    setDiscountAuthBy(null);
    setDiscountAuthReason('');
    setDiscountAuthRequestPrice('');
    setDiscountAuthRequestSent(false);
    setDiscountAuthSubmitting(false);

    toast({
      title: 'Price reset',
      description: `Returned to the calculated price of £${basePrice.totalPrice}.`,
    });
  };

  const formatRegNumber = (value: string) => {
    return value.replace(/\s/g, '').toUpperCase();
  };

  // ---- Step 2 inline vehicle change -------------------------------------
  // Agents were getting stuck with the previous vehicle: "Edit" bounced them
  // back to Step 1 and the old reg/vehicle could linger in derived state.
  // This swaps the vehicle in place and hard-resets every vehicle-derived value.
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [vehicleEditReg, setVehicleEditReg] = useState('');
  const [isSwappingVehicle, setIsSwappingVehicle] = useState(false);

  const applyNewVehicle = async () => {
    const cleanReg = formatRegNumber(vehicleEditReg);
    if (cleanReg.length < 5) {
      toast({ title: 'Invalid registration', description: 'Please enter a valid registration number.', variant: 'destructive' });
      return;
    }
    setIsSwappingVehicle(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: cleanReg, skipAgeCheck: ageOverrideEnabled },
      });

      if (data?.blocked) {
        toast({
          title: 'Vehicle Not Eligible',
          description: data.blockReason || `${data.make || ''} ${data.model || ''} is on our excluded vehicle list.`,
          variant: 'destructive',
        });
        return;
      }

      if (data?.make) {
        const age = getVehicleAge({
          registrationDate: data.registrationDate,
          manufactureDate: data.manufactureDate,
          year: data.yearOfManufacture || data.year,
        });
        if (age.ageYears !== null && age.ageYears > 15 && !ageOverrideEnabled) {
          toast({
            title: 'Vehicle Too Old',
            description: `This vehicle is ${age.ageYears.toFixed(1)} years old. We only cover vehicles up to 15 years old.`,
            variant: 'destructive',
          });
          return;
        }
      } else if (error) {
        console.warn('[GetQuote] Vehicle swap lookup failed', error);
      }

      // Reset every stale vehicle-derived value before writing the new vehicle.
      setRegNumber(cleanReg);
      setMileage('');
      setSliderMileage(0);
      setStep1AutoFilledMileage(null);
      setStep1MileagePrefilledReg(null);
      setAutoPreview({ loading: false, error: null, data: null });
      setEditableRegNumber(cleanReg);
      setEditableMileage('');
      setMileagePrefilledFromMot(false);
      setIsPriceOverridden(false);
      setCustomMonthlyPrice('');
      setCustomFullPrice('');
      setQuotedPriceOverride('');

      setVehicleData({
        regNumber: cleanReg,
        mileage: '',
        make: data?.make || '',
        model: data?.model || '',
        fuelType: data?.fuelType || '',
        transmission: data?.transmission || '',
        year: data?.yearOfManufacture || data?.year || '',
        vehicleType: data?.vehicleType || '',
        registrationDate: data?.registrationDate || undefined,
        manufactureDate: data?.manufactureDate || undefined,
      });

      setIsEditingVehicle(false);
      toast({
        title: 'Vehicle updated',
        description: data?.make
          ? `Now quoting ${cleanReg} — ${data.make} ${data.model || ''}`.trim()
          : `Now quoting ${cleanReg}. Please check the vehicle details.`,
      });
    } catch (e: any) {
      console.error('Vehicle swap failed', e);
      toast({ title: 'Lookup failed', description: 'Could not update the vehicle. Please try again.', variant: 'destructive' });
    } finally {
      setIsSwappingVehicle(false);
    }
  };


  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setMileage(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setSliderMileage(numValue);
    }
  };

  const handleSliderChange = (value: number) => {
    setSliderMileage(value);
    setMileage(value.toString());
  };

  const handleVehicleLookup = async () => {
    // Sync mileage from slider if text input is empty but slider has a value
    const effectiveMileage = mileage.trim() || (sliderMileage > 0 ? sliderMileage.toLocaleString() : '');
    if (!mileage.trim() && sliderMileage > 0) {
      setMileage(sliderMileage.toLocaleString());
    }
    if (!regNumber.trim() || !effectiveMileage) {
      toast({
        title: "Missing Information",
        description: !regNumber.trim() && !effectiveMileage
          ? "Please enter both registration number and mileage"
          : !regNumber.trim() ? "Please enter the registration number" : "Please enter the mileage",
        variant: "destructive",
      });
      return;
    }

    const numericMileage = parseInt(effectiveMileage.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numericMileage) && numericMileage > 150000) {
      toast({
        title: "Vehicle Not Eligible",
        description: "We cannot cover vehicles with over 150,000 miles. Please try a different vehicle.",
        variant: "destructive",
      });
      return;
    }



    setIsLookingUp(true);
    try {
      // Add timeout to prevent infinite loading - 30s for cold starts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const cleanReg = regNumber.replace(/\s/g, '').toUpperCase();
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: cleanReg, skipAgeCheck: ageOverrideEnabled }
      });
      
      clearTimeout(timeoutId);
      console.log('[GetQuote] DVLA lookup response:', { data, error });

      // Fallback: if DVLA/DVSA API fails or returns no make, reuse the auto-preview
      // data (already fetched successfully when the reg was typed) so we never lose
      // make/model to a transient second-call failure. Only fall back to empty
      // manual-entry if we also have no auto-preview data.
      if (error || data?.error || data?.found === false || !data?.make) {
        const preview = autoPreview.data;
        if (preview?.make) {
          console.warn('[GetQuote] Second DVLA call failed - reusing auto-preview data', { error, data, preview });
          setVehicleData({
            regNumber: regNumber.toUpperCase(),
            mileage: mileage,
            make: preview.make,
            model: preview.model || '',
            fuelType: preview.fuelType || '',
            transmission: '',
            year: preview.year || '',
            vehicleType: '',
          });
          setStep(2);
          setIsLookingUp(false);
          return;
        }
        console.warn('[GetQuote] Vehicle API unavailable - proceeding with manual entry fallback', { error, data });
        toast({
          title: "Vehicle Lookup Unavailable",
          description: "Could not auto-fetch vehicle details. Please enter make/model manually.",
        });
        setVehicleData({
          regNumber: regNumber.toUpperCase(),
          mileage: mileage,
          make: '',
          model: '',
          fuelType: '',
          transmission: '',
          year: '',
          vehicleType: '',
        });
        setStep(2);
        setIsLookingUp(false);
        return;
      }

      // Hard block excluded makes/models (e.g. Maserati, Ferrari, Lamborghini, Bentley...)
      // No override — these brands are not eligible regardless of age override.
      if (data.blocked) {
        toast({
          title: "Vehicle Not Eligible",
          description: data.blockReason || `${data.make} ${data.model || ''} is on our excluded vehicle list and cannot be quoted.`,
          variant: "destructive",
        });
        setIsLookingUp(false);
        return;
      }

      {
        // Age is measured from first registration date where available, falling
        // back to manufacture date and only then to the bare year.
        const age = getVehicleAge({
          registrationDate: data.registrationDate,
          manufactureDate: data.manufactureDate,
          year: data.yearOfManufacture || data.year,
        });
        if (age.ageYears !== null && age.ageYears > 15 && !ageOverrideEnabled) {
          toast({
            title: "Vehicle Too Old",
            description: `This vehicle is ${age.ageYears.toFixed(1)} years old (from ${age.source === 'year_of_manufacture' ? 'year of manufacture' : 'first registration'}). We only cover vehicles up to 15 years old.`,
            variant: "destructive",
          });
          setIsLookingUp(false);
          return;
        }
      }

      setVehicleData({
        regNumber: regNumber.toUpperCase(),
        mileage: mileage,
        make: data.make,
        model: data.model || '',
        fuelType: data.fuelType || '',
        transmission: data.transmission || '',
        year: data.yearOfManufacture || data.year || '',
        vehicleType: data.vehicleType || '',
        registrationDate: data.registrationDate || undefined,
        manufactureDate: data.manufactureDate || undefined,
      });
      
      setStep(2);
    } catch (error: any) {
      console.error('Error looking up vehicle:', error);
      const msg = error?.name === 'AbortError' 
        ? 'Request timed out. Please try again.' 
        : (error?.message || 'Unable to connect to vehicle database. Please try again.');
      toast({
        title: "Lookup Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  // Quick Confirm Order - skips Step 2 and goes directly to Confirm External Payment
  const handleQuickConfirmOrder = async () => {
    if (previewMode) {
      toast({ title: 'Preview mode', description: 'This is a beta preview — nothing is sent, saved or charged.' });
      return;
    }
    if (!regNumber.trim()) {
      toast({
        title: "Missing Registration",
        description: "Please enter a registration number",
        variant: "destructive",
      });
      return;
    }

    // If no mileage, default to 0 - can be edited in dialog
    const effectiveMileage = mileage.trim() || '0';

    setIsQuickConfirming(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const cleanReg2 = regNumber.replace(/\s/g, '').toUpperCase();
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: cleanReg2, skipAgeCheck: ageOverrideEnabled }
      });
      
      clearTimeout(timeoutId);

      // Fallback: if API fails, reuse the auto-preview data (already fetched when
      // reg was typed) before falling back to a truly empty vehicle record.
      if (error || data?.error || data?.found === false || !data?.make) {
        const preview = autoPreview.data;
        const fallbackMake = preview?.make || '';
        const fallbackModel = preview?.model || '';
        const fallbackYear = preview?.year || '';
        const fallbackFuel = preview?.fuelType || '';
        if (!fallbackMake) {
          console.warn('[QuickConfirm] Vehicle API unavailable - proceeding with manual entry', { error, data });
          toast({
            title: "Vehicle Lookup Unavailable",
            description: "Proceeding without auto-fetched details. Please verify vehicle info before confirming.",
          });
        } else {
          console.warn('[QuickConfirm] Second DVLA call failed - reusing auto-preview data', { error, data, preview });
        }
        setVehicleData({
          regNumber: regNumber.toUpperCase(),
          mileage: effectiveMileage,
          make: fallbackMake,
          model: fallbackModel,
          fuelType: fallbackFuel,
          transmission: '',
          year: fallbackYear,
          vehicleType: '',
        });
        setEditableCustomerFirstName(customerFirstName || (customerName || '').trim().split(/\s+/)[0] || '');
        setEditableCustomerLastName(customerLastName || (customerName || '').trim().split(/\s+/).slice(1).join(' ') || '');
        setEditableCustomerEmail(customerEmail);
        setEditableCustomerPhone(customerPhone);
        setEditableRegNumber(regNumber.toUpperCase());
        setEditableMileage(effectiveMileage === '0' ? '' : effectiveMileage);
        setMileagePrefilledFromMot(false);
        setPaymentSource('');
        setPaymentAmount('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentConfirmed(false);
        setPaymentNotes('');
        setWarrantyStartDate(new Date());
        setExternalPaymentStep('details');
        setCompletionStatus(null);
        setShowConfirmPaymentDialog(true);
        setIsQuickConfirming(false);
        return;
      }

      // Hard block excluded makes/models — no override available even on Quick Confirm.
      if (data.blocked) {
        toast({
          title: "Vehicle Not Eligible",
          description: data.blockReason || `${data.make} ${data.model || ''} is on our excluded vehicle list and cannot be sold.`,
          variant: "destructive",
        });
        setIsQuickConfirming(false);
        return;
      }

      {
        // Age is measured from first registration date where available, falling
        // back to manufacture date and only then to the bare year.
        const age = getVehicleAge({
          registrationDate: data.registrationDate,
          manufactureDate: data.manufactureDate,
          year: data.yearOfManufacture || data.year,
        });
        if (age.ageYears !== null && age.ageYears > 15 && !ageOverrideEnabled) {
          toast({
            title: "Vehicle Too Old",
            description: `This vehicle is ${age.ageYears.toFixed(1)} years old (from ${age.source === 'year_of_manufacture' ? 'year of manufacture' : 'first registration'}). We only cover vehicles up to 15 years old.`,
            variant: "destructive",
          });
          setIsQuickConfirming(false);
          return;
        }
      }

      // Set vehicle data
      setVehicleData({
        regNumber: regNumber.toUpperCase(),
        mileage: effectiveMileage,
        make: data.make,
        model: data.model || '',
        fuelType: data.fuelType || '',
        transmission: data.transmission || '',
        year: data.yearOfManufacture || data.year || '',
        vehicleType: data.vehicleType || '',
        registrationDate: data.registrationDate || undefined,
        manufactureDate: data.manufactureDate || undefined,
      });
      setEditableCustomerFirstName(customerFirstName || (customerName || '').trim().split(/\s+/)[0] || '');
      setEditableCustomerLastName(customerLastName || (customerName || '').trim().split(/\s+/).slice(1).join(' ') || '');
      setEditableCustomerEmail(customerEmail);
      setEditableCustomerPhone(customerPhone);
      setEditableRegNumber(regNumber.toUpperCase());
      setEditableMileage(effectiveMileage === '0' ? '' : effectiveMileage);
      setMileagePrefilledFromMot(false);
      
      // Reset payment dialog state for fresh entry
      setPaymentSource('');
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentConfirmed(false);
      setPaymentNotes('');
      setWarrantyStartDate(new Date());
      setExternalPaymentStep('details');
      setCompletionStatus(null);
      
      // Open the Confirm External Payment dialog directly
      setShowConfirmPaymentDialog(true);
      
      toast({
        title: "Vehicle Found",
        description: `${data.make}${data.model ? ` ${data.model}` : ''} (${data.yearOfManufacture || data.year}) - Ready to confirm order`,
      });
    } catch (error: any) {
      console.error('Error looking up vehicle:', error);
      const msg = error?.name === 'AbortError' 
        ? 'Request timed out. Please try again.' 
        : (error?.message || 'Unable to connect to vehicle database. Please try again.');
      toast({
        title: "Lookup Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsQuickConfirming(false);
    }
  };

  const loadSentQuotesHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('admin_sent_quotes')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSentQuotes(data || []);
    } catch (error) {
      console.error('Error loading sent quotes:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleCalculateQuote = () => {
    let hasError = false;
    
    if (!customerFirstName.trim()) {
      setShowNameError(true);
      hasError = true;
    } else {
      setShowNameError(false);
    }

    if (!customerLastName.trim()) {
      setShowLastNameError(true);
      hasError = true;
    } else {
      setShowLastNameError(false);
    }

    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setShowEmailError(true);
      hasError = true;
    } else {
      setShowEmailError(false);
    }

    if (hasError) {
      toast({
        title: "Missing Information",
        description: "Please fill in first name, surname and a valid email address",
        variant: "destructive",
      });
      // Auto-scroll to the customer info section so user can see the error fields
      // Use scrollIntoView (works inside any scroll container) and focus the first invalid field
      setTimeout(() => {
        const target = customerInfoRef.current;
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        // Also try common scroll containers as a fallback
        document.querySelectorAll('[data-scroll-container], main, .overflow-y-auto, .overflow-auto').forEach((el) => {
          try { (el as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
        });
        setTimeout(() => {
          if (!customerFirstName.trim()) customerNameInputRef.current?.focus();
          else if (!customerLastName.trim()) customerLastNameInputRef.current?.focus();
        }, 350);
      }, 0);
      return;
    }
    setStep(3);
  };
  
  // Toggle an add-on
  const handleToggleAddOn = (key: string) => {
    setSelectedAddOns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const generateEmailSubject = (): string => {
    const vehicleName = [vehicleData?.make, vehicleData?.model].filter(Boolean).join(' ').trim();
    const vehicleLabel = vehicleName || vehicleData?.regNumber || regNumber || 'vehicle';
    const reg = (vehicleData?.regNumber || regNumber || '').toString().trim().toUpperCase();
    // Plain, conversational subject — no promo phrases like "choose how to pay",
    // "save", "offer", exclamation marks, or commercial "quote" wording.
    const firstName = (customerName || '').trim().split(/\s+/)[0];
    const prefix = firstName ? `${firstName}, your` : 'Your';
    return reg
      ? `${prefix} ${vehicleLabel} warranty details (${reg})`
      : `${prefix} ${vehicleLabel} warranty details`;
  };

  const handlePreviewEmail = () => {
    if (!quoteLink) {
      toast({
        title: "Quote Link Required",
        description: "Please wait for the quote link to be generated first.",
        variant: "destructive",
      });
      return;
    }
    setEmailSubject(generateEmailSubject());
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (previewMode) {
      toast({ title: 'Preview mode', description: 'This is a beta preview — nothing is sent, saved or charged.' });
      return;
    }
    if (!quoteLink) {
      toast({
        title: "Quote Link Required",
        description: "Please wait for the quote link to be generated first.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      console.log('🚀 Starting quote send process...');
      const { data: { user } } = await supabase.auth.getUser();
      // Strip anything outside the safe email character set (fixes stray
      // brackets / punctuation pasted into the email field, e.g. "foo@bar.com)").
      const cleanCustomerEmail = (customerEmail || '')
        .trim()
        .toLowerCase()
        .replace(/^[^a-z0-9._%+\-]+/i, '')
        .replace(/[^a-z0-9._%+\-@]+$/i, '');
      const cleanCustomerName = customerName.trim() || 'there';
      const cleanVehicleData = {
        ...(vehicleData || {}),
        regNumber: vehicleData?.regNumber || regNumber,
        mileage: vehicleData?.mileage || mileage,
        make: vehicleData?.make || '',
        model: vehicleData?.model || '',
        year: vehicleData?.year || '',
      };

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanCustomerEmail)) {
        throw new Error('Please enter a valid customer email before sending.');
      }

      if (!cleanVehicleData.regNumber) {
        throw new Error('Vehicle registration is missing. Please go back and check the vehicle details.');
      }
      
      // Generate unique quote ID for restoration
      const quoteId = `ADMIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
      const termOption = termOptions.find(t => t.id === paymentType);
      const coverMonths = termOption?.months || 12;
      // Map freeExtendedCover to bonusMonths - only show bonus if explicitly selected
      const bonusMonths = selectedBonusMonths;

      // CRITICAL: Sync the live_quotes record with current form values
      // This ensures the quote link and the email always show the same details
      const accessToken = quoteLink.split('/quote/')[1];
      if (accessToken) {
        console.log('🔄 Syncing live_quotes with current form values...');
        const durationMap: Record<string, number> = { '12months': 12, '24months': 24, '36months': 36 };
        const { error: syncError } = await supabase
          .from('live_quotes')
          .update({
            excess_amount: excessAmount,
            claim_limit: claimLimit,
            labour_rate: labourRate,
            boost_addon: boostAddon,
            duration_months: durationMap[paymentType] || 12,
            bonus_months: bonusMonths,
            monthly_price: currentPrice.monthlyPrice,
            upfront_price: displayedPayInFullPrice,
            customer_name: cleanCustomerName,
            customer_email: cleanCustomerEmail,
          })
          .eq('access_token', accessToken);
        
        if (syncError) {
          console.error('⚠️ Failed to sync live_quotes:', syncError);
        } else {
          console.log('✅ live_quotes synced with current form values');
        }
      }

      // Resolve the logged-in agent freshly here so the agent copy is always
      // included, even if the mount-time fetch hasn't populated adminEmail yet.
      const agentRecipient = await resolveAdminRecipient();
      const agentEmail = agentRecipient.email || adminEmail || null;
      const agentDisplayName = agentRecipient.name || adminName || null;

      // Staff copies are sent on the same customer email so the sales agent sees the exact quote the customer received.
      const copyRecipients = additionalEmails.filter(
        (e) =>
          e &&
          e.toLowerCase() !== cleanCustomerEmail &&
          e.toLowerCase() !== (agentEmail || '').toLowerCase()
      );

      console.log('📧 Sending email to:', cleanCustomerEmail);
      console.log('📧 Agent copy:', agentEmail);
      console.log('📧 Extra internal copies:', copyRecipients);
      console.log('📎 Quote link:', quoteLink);

      // Send the email with HTML template (customer receives it, sales agent is copied on the same email)
      const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-admin-quote', {
        body: {
          to: cleanCustomerEmail,
          agentCopyEmail: agentEmail && agentEmail.toLowerCase() !== cleanCustomerEmail ? agentEmail : undefined,
          agentName: agentDisplayName || undefined,
          copyRecipients: copyRecipients.length > 0 ? copyRecipients : undefined,

          subject: emailSubject,
          quoteLink: quoteLink,
          customerName: cleanCustomerName,
          vehicleData: cleanVehicleData,
          quoteDetails: {
            plan: 'Platinum',
            paymentType,
            totalPrice: displayedTotalPrice,
            monthlyPrice: currentPrice.monthlyPrice,
            payInFullPrice: displayedPayInFullPrice,
            savings: displayedPayInFullSavings,
            includePayInFullDiscount,
            excessAmount,
            claimLimit: displayClaimLimit,
            labourRate,
            boostAddon,
            coverMonths,
            bonusMonths
          }
        }
      });

      if (emailError) {
        console.error('❌ Email sending failed:', emailError);
        throw new Error(`Email failed: ${emailError.message}`);
      }
      
      console.log('✅ Email sent successfully', emailResult);

      // Save to quote_data for restoration
      console.log('💾 Saving to quote_data for restoration...');
      const { error: quoteDataError } = await supabase
        .from('quote_data')
        .insert({
          quote_id: quoteId,
          customer_email: cleanCustomerEmail,
          vehicle_data: {
            regNumber: cleanVehicleData.regNumber,
            mileage: cleanVehicleData.mileage,
            make: cleanVehicleData.make,
            model: cleanVehicleData.model,
            year: cleanVehicleData.year,
            vehicleType: vehicleData?.vehicleType,
            fuelType: vehicleData?.fuelType,
            transmission: vehicleData?.transmission
          },
          plan_data: {
            paymentType,
            claimLimit,
            labourRate,
            voluntaryExcess: excessAmount,
            boostAddon,
            addOns: [],
            additionalNotes
          },
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (quoteDataError) {
        console.error('⚠️ Failed to save quote_data for restoration:', quoteDataError);
      } else {
        console.log('✅ Quote saved for restoration with ID:', quoteId);
      }

      // Save to admin_sent_quotes for tracking
      console.log('💾 Saving to admin_sent_quotes...');
      const providerMessageId = (emailResult as any)?.customerMessageId || null;
      const { error: quoteError } = await supabase
        .from('admin_sent_quotes')
        .insert({
          customer_name: cleanCustomerName,
          customer_email: cleanCustomerEmail,
          vehicle_reg: cleanVehicleData.regNumber || '',
          vehicle_make: cleanVehicleData.make,
          vehicle_model: cleanVehicleData.model,
          vehicle_year: cleanVehicleData.year,
          vehicle_mileage: cleanVehicleData.mileage,
          vehicle_fuel_type: vehicleData?.fuelType,
          vehicle_transmission: vehicleData?.transmission,
          vehicle_type: vehicleData?.vehicleType,
          plan_name: 'Platinum',
          payment_type: paymentType,
          excess_amount: excessAmount,
          claim_limit: displayClaimLimit,
          total_price: displayedTotalPrice,
          monthly_price: currentPrice.monthlyPrice,
          labour_rate: labourRate,
          boost_addon: boostAddon,
          additional_notes: additionalNotes || null,
          email_subject: emailSubject,
          email_content: emailContent,
          sent_by: user?.id,
          provider_message_id: providerMessageId,
          delivery_status: providerMessageId ? 'sent' : 'pending',
          delivery_status_at: new Date().toISOString(),
        });

      if (quoteError) {
        console.error('❌ Failed to save quote to history:', quoteError);
        toast({
          title: "Email Sent (History Not Saved)",
          description: `Quote was emailed to ${customerEmail} but couldn't be saved to history.`,
          variant: "destructive",
        });
        return;
      }
      
      console.log('✅ Quote saved to admin_sent_quotes');
      auditPriceOverride('quotes_and_orders', displayedTotalPrice);


      // Update existing leads to "quote_sent" status
      // First, update sales_leads by email or vehicle_reg
      console.log('📋 Updating existing leads to quote_sent status...');
      const emailLower = cleanCustomerEmail;
      const vehicleRegClean = vehicleData?.regNumber?.replace(/\s/g, '').toUpperCase();
      
      // Update sales_leads matching this email
      const { error: salesLeadError } = await supabase
        .from('sales_leads')
        .update({ 
          status: 'quote_sent', 
          updated_at: new Date().toISOString(),
          last_activity_date: new Date().toISOString()
        })
        .or(`email.ilike.${emailLower}${vehicleRegClean ? `,vehicle_reg.ilike.${vehicleRegClean}` : ''}`);
      
      if (salesLeadError) {
        console.error('Failed to update sales_leads status:', salesLeadError);
      } else {
        console.log('✅ Updated sales_leads to quote_sent');
      }

      // Update abandoned_carts matching this email or reg to quote_sent
      const { error: cartUpdateError } = await supabase
        .from('abandoned_carts')
        .update({ 
          contact_status: 'quote_sent', 
          updated_at: new Date().toISOString() 
        })
        .or(`email.ilike.${emailLower}${vehicleRegClean ? `,vehicle_reg.ilike.${vehicleRegClean}` : ''}`);
      
      if (cartUpdateError) {
        console.error('Failed to update abandoned_carts status:', cartUpdateError);
      } else {
        console.log('✅ Updated abandoned_carts to quote_sent');
      }

      // Add to abandoned_carts if no existing cart (for tracking purposes)
      console.log('📋 Adding to abandoned_carts with quote_sent status...');
      await supabase
        .from('abandoned_carts')
        .upsert({
          email: cleanCustomerEmail,
          full_name: cleanCustomerName,
          phone: '',
          vehicle_reg: cleanVehicleData.regNumber,
          vehicle_make: cleanVehicleData.make,
          vehicle_model: cleanVehicleData.model,
          vehicle_year: cleanVehicleData.year,
          vehicle_type: vehicleData?.vehicleType,
          mileage: cleanVehicleData.mileage,
          plan_name: 'Platinum',
          payment_type: paymentType,
          step_abandoned: 3,
          contact_status: 'quote_sent',
          cart_metadata: {
            excess: excessAmount,
            claimLimit: displayClaimLimit,
            labourRate,
            boostAddon,
            totalPrice: displayedTotalPrice,
            quoteSource: 'admin_sent',
            quoteId,
            additionalNotes
          }
        }, { onConflict: 'email', ignoreDuplicates: true });

      const totalCopies = [
        adminEmail && adminEmail.toLowerCase() !== cleanCustomerEmail ? adminEmail : null,
        ...copyRecipients,
      ].filter(Boolean).length;
      const copyMessage = totalCopies > 0 ? ` ${totalCopies} sales cop${totalCopies === 1 ? 'y was' : 'ies were'} included on the same email.` : '';
      toast({
        title: "✅ Quote Sent Successfully!",
        description: `Email sent to ${cleanCustomerEmail}.${copyMessage}`,
        duration: 5000,
      });

      await loadSentQuotesHistory();

      // Keep the dialog open with all form data intact. The agent can now
      // review what they sent and click "Send a copy to my email" if needed.
      // Only closing the dialog (Cancel/X) resets the form — see Dialog onOpenChange.
      setQuoteSent(true);
      setSelfCopySent(false);
      clearDraft();
      setLastSendPayload({
        subject: emailSubject,
        quoteLink,
        customerName: cleanCustomerName,
        vehicleData: cleanVehicleData,
        quoteDetails: {
          plan: 'Platinum',
          paymentType,
          totalPrice: displayedTotalPrice,
          monthlyPrice: currentPrice.monthlyPrice,
          payInFullPrice: displayedPayInFullPrice,
          savings: displayedPayInFullSavings,
          includePayInFullDiscount,
          excessAmount,
          claimLimit: displayClaimLimit,
          labourRate,
          boostAddon,
          coverMonths,
          bonusMonths,
        },
      });


      
    } catch (error: any) {
      console.error('💥 Error in quote send process:', error);
      toast({
        title: "❌ Error Sending Quote",
        description: error.message || "Failed to send quote. Check console for details.",
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Reset the entire Send-Quote form. Called when the dialog is closed.
  const resetSendQuoteForm = () => {
    setStep(1);
    setRegNumber('');
    setMileage('');
    setSliderMileage(0);
    setVehicleData(null);
    setCustomerEmail('');
    setCustomerFirstName(''); setCustomerLastName('');
    setCustomerDob('');
    setPaymentType('24months');
    setExcessAmount(100);
    setClaimLimit(2000);
    setLabourRate(70);
    setBoostAddon(false);
    setAdditionalNotes('');
    setCustomMonthlyPrice('');
    setCustomFullPrice('');
    setIsPriceOverridden(false);
    setQuoteLink(null);
    setQuoteGenerated(false);
    setQuoteSent(false);
    setSelfCopySent(false);
    setLastSendPayload(null);
  };

  // Send a copy of the just-sent customer quote to the logged-in agent's own
  // inbox. Uses the same branded template as the customer email so the agent
  // sees exactly what was delivered.
  const handleSendSelfCopy = async () => {
    if (previewMode) {
      toast({ title: 'Preview mode', description: 'This is a beta preview — nothing is sent, saved or charged.' });
      return;
    }
    if (!quoteLink) {
      toast({
        title: 'Quote link required',
        description: 'Please wait for the quote link to be generated first.',
        variant: 'destructive',
      });
      return;
    }
    setIsSendingSelfCopy(true);
    try {
      const adminRecipient = await resolveAdminRecipient();
      if (!adminRecipient.email) {
        throw new Error("Couldn't find your admin email. Please refresh the page and try again.");
      }

      // Build payload from current form state so the agent can send themselves
      // a copy at any time — even before the customer email has been sent.
      const cleanCustomerName = (customerName || '').trim() || 'there';
      const cleanCustomerEmail = (customerEmail || '')
        .trim()
        .toLowerCase()
        .replace(/^[^a-z0-9._%+\-]+/i, '')
        .replace(/[^a-z0-9._%+\-@]+$/i, '');
      const cleanVehicleData = {
        ...(vehicleData || {}),
        regNumber: vehicleData?.regNumber || regNumber,
        mileage: vehicleData?.mileage || mileage,
        make: vehicleData?.make || '',
        model: vehicleData?.model || '',
        year: vehicleData?.year || '',
      };
      if (!cleanVehicleData.regNumber) {
        throw new Error('Vehicle registration is missing. Please go back and check the vehicle details.');
      }
      const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
      const termOption = termOptions.find(t => t.id === paymentType);
      const coverMonths = termOption?.months || 12;
      const bonusMonths = selectedBonusMonths;

      const subject = (emailSubject && emailSubject.trim()) || generateEmailSubject();

      const { error } = await supabase.functions.invoke('send-admin-quote', {
        body: {
          to: adminRecipient.email,
          agentName: adminRecipient.name || undefined,
          copyOnly: true,
          originalRecipientEmail: cleanCustomerEmail || undefined,
          subject,
          quoteLink,
          customerName: cleanCustomerName,
          vehicleData: cleanVehicleData,
          quoteDetails: {
            plan: 'Platinum',
            paymentType,
            totalPrice: displayedTotalPrice,
            monthlyPrice: currentPrice.monthlyPrice,
            payInFullPrice: displayedPayInFullPrice,
            savings: displayedPayInFullSavings,
            includePayInFullDiscount,
            excessAmount,
            claimLimit: displayClaimLimit,
            labourRate,
            boostAddon,
            coverMonths,
            bonusMonths,
          },
        },
      });
      if (error) throw new Error(error.message || 'Failed to send copy');
      setSelfCopySent(true);
      toast({ title: '✅ Copy sent', description: `A copy of this quote was sent to ${adminRecipient.email}.`, duration: 4000 });
    } catch (err: any) {
      console.error('Send self-copy failed:', err);
      toast({ title: '❌ Failed to send copy', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSendingSelfCopy(false);
    }
  };



  const handleResendQuote = async (quote: any) => {
    try {
      setIsSendingEmail(true);
      console.log('🔄 Resending quote to:', quote.customer_email);

      const durationMap: Record<string, number> = { '12months': 12, '24months': 24, '36months': 36 };
      const coverMonths = durationMap[quote.payment_type] || 12;
      const resendTotalPrice = Math.round(Number(quote.monthly_price || 0) * 12) || Number(quote.total_price || 0);
      const resendPayInFullPrice = Number(quote.pay_in_full_price || 0) || resendTotalPrice;

      const { data: liveQuote } = await supabase
        .from('live_quotes')
        .select('access_token')
        .eq('customer_email', quote.customer_email)
        .eq('vehicle_reg', quote.vehicle_reg)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const resendQuoteLink = liveQuote?.access_token
        ? `https://buyawarranty.co.uk/quote/${liveQuote.access_token}`
        : undefined;

      if (!resendQuoteLink) {
        throw new Error('Could not find the live quote link for this saved quote. Please edit the quote and generate a new link.');
      }
      
      const resendAgent = await resolveAdminRecipient();
      const resendAgentEmail = resendAgent.email || adminEmail || null;
      const resendAgentName = resendAgent.name || adminName || null;

      const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-admin-quote', {
        body: {
          to: quote.customer_email,
          agentCopyEmail: resendAgentEmail && resendAgentEmail.toLowerCase() !== (quote.customer_email || '').toLowerCase() ? resendAgentEmail : undefined,
          agentName: resendAgentName || undefined,

          subject: (quote.email_subject || 'Your warranty details')
            .replace(/^\[RESENT\]\s*/i, '')
            .replace(/warranty quote/gi, 'warranty details')
            .replace(/\bquote\b/gi, 'details'),
          quoteLink: resendQuoteLink,
          customerName: quote.customer_name || 'there',
          vehicleData: {
            regNumber: quote.vehicle_reg,
            mileage: quote.vehicle_mileage,
            make: quote.vehicle_make,
            model: quote.vehicle_model,
            year: quote.vehicle_year,
            fuelType: quote.vehicle_fuel_type,
            transmission: quote.vehicle_transmission,
            vehicleType: quote.vehicle_type
          },
          quoteDetails: {
            plan: quote.plan_name,
            paymentType: quote.payment_type,
            totalPrice: resendTotalPrice,
            monthlyPrice: Number(quote.monthly_price || 0),
            payInFullPrice: resendPayInFullPrice,
            savings: Math.max(resendTotalPrice - resendPayInFullPrice, 0),
            excessAmount: quote.excess_amount,
            claimLimit: quote.claim_limit,
            labourRate: quote.labour_rate || 70,
            boostAddon: quote.boost_addon || false,
            coverMonths,
            bonusMonths: 0,
          }
        }
      });

      if (emailError) {
        throw new Error(`Email failed: ${emailError.message}`);
      }

      const resentMessageId = (emailResult as any)?.customerMessageId || null;
      await supabase
        .from('admin_sent_quotes')
        .update({
          resent_count: (quote.resent_count || 0) + 1,
          last_resent_at: new Date().toISOString(),
          provider_message_id: resentMessageId || quote.provider_message_id,
          delivery_status: resentMessageId ? 'sent' : quote.delivery_status,
          delivery_status_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      const copyMessage = resendAgentEmail ? ` A copy was also sent to ${resendAgentEmail}.` : '';
      toast({
        title: "✅ Quote Resent Successfully!",
        description: `Email resent to ${quote.customer_email}.${copyMessage}`,
        duration: 5000,
      });

      await loadSentQuotesHistory();
    } catch (error: any) {
      console.error('💥 Error resending quote:', error);
      toast({
        title: "❌ Error Resending Quote",
        description: error.message || "Failed to resend quote.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Edit a sent quote - load it into the form for modification and resend
  const handleEditQuote = (quote: any) => {
    // Set customer data
    applyCustomerFullName(quote.customer_name || '');
    setCustomerEmail(quote.customer_email || '');
    setCustomerPhone(''); // Not stored in sent quotes
    
    // Set vehicle data
    const vehicleDataFromQuote = {
      regNumber: quote.vehicle_reg || '',
      mileage: quote.vehicle_mileage || '',
      make: quote.vehicle_make || '',
      model: quote.vehicle_model || '',
      year: quote.vehicle_year || '',
      fuelType: quote.vehicle_fuel_type || '',
      transmission: quote.vehicle_transmission || '',
      vehicleType: quote.vehicle_type || '',
    };
    setVehicleData(vehicleDataFromQuote);
    setRegNumber(quote.vehicle_reg || '');
    setMileage(quote.vehicle_mileage || '');
    const numMileage = parseInt(String(quote.vehicle_mileage).replace(/,/g, ''), 10);
    if (!isNaN(numMileage)) setSliderMileage(numMileage);
    
    // Set quote configuration
    const duration = quote.payment_type || '24months';
    setPaymentType(duration);
    setExcessAmount(quote.excess_amount ?? 100);
    setClaimLimit(quote.claim_limit || 2000);
    setLabourRate(quote.labour_rate || 70);
    setBoostAddon(quote.boost_addon || false);
    setAdditionalNotes(quote.additional_notes || '');
    
    // Go to Step 2 (quote details) for editing
    setStep(2);
    setActiveTab('new');
    setQuoteGenerated(false);
    setQuoteLink(null);
    
    toast({
      title: "Quote loaded for editing",
      description: `Edit and resend quote for ${quote.customer_name}`,
    });
  };

  const generateWhatsAppMessage = () => {
    const termOption = termOptions.find(t => t.id === paymentType);
    const months = termOption?.months || 12;
    const bonus = termOption?.bonus || 3;
    const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
    
    const content = `Hi ${customerName.split(' ')[0]},

Here's your warranty quote for ${vehicleData?.make} ${vehicleData?.model} (${vehicleData?.regNumber}):

Plan: Platinum
Price: £${currentPrice.monthlyPrice}/month
Cover: ${months} months + ${bonus} FREE
Claim Limit: £${displayClaimLimit.toLocaleString()}

Complete your purchase here:
${quoteLink || 'https://buyawarranty.co.uk'}

Questions? Call 0330 229 5040`;

    const encodedMessage = encodeURIComponent(content);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=447467703287&text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // State for quote link generation
  const [isGeneratingQuoteLink, setIsGeneratingQuoteLink] = useState(false);
  const [quoteLink, setQuoteLink] = useState<string | null>(null);
  const [quoteGenerated, setQuoteGenerated] = useState(false);

  // Auto-generate quote link when entering step 3
  useEffect(() => {
    if (step === 3 && customerEmail && customerName && vehicleData && !quoteGenerated) {
      generateQuoteLink();
    }
  }, [step, customerEmail, customerName, vehicleData]);

  const generateQuoteLink = async () => {
    if (!customerEmail || !customerName || !vehicleData) return;
    
    setIsGeneratingQuoteLink(true);
    setQuoteLink(null);
    
    const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
    const contractTotal = currentPrice.monthlyPrice * 12; // Use monthly × 12 for consistency
    const payInFullPrice = currentPrice.payInFullPrice || Math.ceil(contractTotal * 0.90);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-live-quote', {
        body: {
          customerName,
          customerEmail,
          customerPhone: customerPhone || '',
          vehicleData: {
            regNumber: vehicleData.regNumber,
            make: vehicleData.make,
            model: vehicleData.model,
            year: vehicleData.year,
            fuelType: vehicleData.fuelType,
            transmission: vehicleData.transmission,
            mileage: vehicleData.mileage,
            vehicleType: vehicleData.vehicleType || 'car'
          },
          paymentType,
          excessAmount,
          claimLimit, // Send raw claim limit - customer page will add boost if needed
          labourRate,
          boostAddon,
          monthlyPrice: currentPrice.monthlyPrice,
          upfrontPrice: payInFullPrice,
          breakdownIncluded: getAutoIncludedAddOns(paymentType).includes('breakdown'),
          rentalIncluded: getAutoIncludedAddOns(paymentType).includes('rental'),
          additionalNotes,
          freeExtendedCover, // Pass the free extended cover selection
          createdByName: 'Admin',
          customerDob: customerDob || null,
          warrantyStartDate: warrantyStartDate?.toISOString() || null
        }
      });

      if (error) throw error;

      if (data?.quote?.shareLink || data?.quote?.accessToken) {
        const origin = window.location.origin;
        const quoteUrl = `${origin}/quote/${data.quote.accessToken}`;
        setQuoteLink(quoteUrl);
        setQuoteGenerated(true);
        auditPriceOverride('quote_link');

      } else {
        throw new Error('No quote link returned');
      }
    } catch (error: any) {
      console.error('Error generating quote link:', error);
      toast({
        title: "❌ Failed to Generate Quote Link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQuoteLink(false);
    }
  };

  // Retry generating quote link
  const handleRetryQuoteLink = async () => {
    setQuoteGenerated(false);
    await generateQuoteLink();
  };

  // Copy quote link to clipboard
  const handleCopyQuoteLink = async () => {
    if (!quoteLink) return;
    await navigator.clipboard.writeText(quoteLink);
    toast({ title: "✓ Quote link copied!", duration: 2000 });
  };

  // Generate warranty reference using the DB function (consistent BAW format)
  const generateWarrantyReference = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_warranty_number');
    if (error) {
      console.error('Error generating warranty number:', error);
      // Fallback
      const date = new Date();
      const datePart = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}`;
      const serial = Math.floor(Math.random() * 100000) + 500000;
      return `BAW-${datePart}-${serial}`;
    }
    return data;
  };

  // Check for existing active policy on this vehicle
  const checkExistingPolicy = async () => {
    if (!vehicleData?.regNumber) return null;
    
    const { data: existingPolicy } = await supabase
      .from('customer_policies')
      .select('id, policy_number, email, status, policy_start_date')
      .eq('status', 'active')
      .ilike('email', customerEmail)
      .maybeSingle();
    
    // Also check customers table for active policy on same reg
    const { data: existingCustomerPolicy } = await supabase
      .from('customers')
      .select('id, name, email, registration_plate, status')
      .eq('registration_plate', vehicleData.regNumber.toUpperCase())
      .eq('status', 'Active')
      .maybeSingle();
    
    if (existingPolicy) {
      return `An active policy (${existingPolicy.policy_number}) already exists for this email.`;
    }
    if (existingCustomerPolicy && existingCustomerPolicy.email.toLowerCase() !== customerEmail.toLowerCase()) {
      return `This vehicle (${vehicleData.regNumber}) is already covered under ${existingCustomerPolicy.name}'s policy (${existingCustomerPolicy.email}).`;
    }
    return null;
  };

  // Open payment confirmation dialog with validation
  const handleOpenConfirmPaymentDialog = async () => {
    if (previewMode) {
      toast({ title: 'Preview mode', description: 'This is a beta preview — nothing is sent, saved or charged.' });
      return;
    }
    if (!customerEmail || !customerName || !vehicleData) {
      toast({
        title: "Incomplete Quote",
        description: "Please complete all customer and vehicle details first",
        variant: "destructive",
      });
      return;
    }

    // Check for existing policies
    const warning = await checkExistingPolicy();
    setExistingPolicyWarning(warning);
    
    // Pre-fill payment amount from quote
    // Use monthly × 12 to match the Total displayed across Step 2/Step 3 (pricing-sync constraint)
    setPaymentAmount((currentPrice.monthlyPrice * 12).toString());
    // Reset warranty start date to today
    setWarrantyStartDate(new Date());
    // Reset to details step when opening
    setExternalPaymentStep('details');
    
    // Initialize editable fields with current values
    setEditableCustomerFirstName(customerFirstName || (customerName || '').trim().split(/\s+/)[0] || '');
    setEditableCustomerLastName(customerLastName || (customerName || '').trim().split(/\s+/).slice(1).join(' ') || '');
    setEditableCustomerEmail(customerEmail);
    setEditableCustomerPhone(customerPhone);
    setEditableMileage(vehicleData?.mileage || mileage);
    setEditableRegNumber(vehicleData?.regNumber || regNumber);
    setMileagePrefilledFromMot(false); // Reset MOT prefill flag
    
    // Reset address fields
    setCustomerPostcode('');
    setCustomerStreet('');
    setCustomerTown('');
    setCustomerBuildingNumber('');
    setCustomerCounty('');
    setSkipAddressDetails(false);
    
    setShowConfirmPaymentDialog(true);
  };

  // Generate preview data for external payment
  const getExternalPaymentPreviewData = () => {
    const termOption = termOptions.find(t => t.id === paymentType);
    const durationMonths = termOption?.months || 12;
    const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
    const startDate = startOfDay(warrantyStartDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);
    const autoIncludedAddOns = getAutoIncludedAddOns(paymentType);
    const isFutureStart = !isToday(warrantyStartDate) && warrantyStartDate > new Date();

    return {
      customer: {
        name: editableCustomerName || customerName,
        email: (editableCustomerEmail || customerEmail).toLowerCase(),
        phone: editableCustomerPhone || customerPhone || 'Not provided',
        address: skipAddressDetails 
          ? 'Customer will complete in dashboard' 
          : customerPostcode 
            ? `${customerBuildingNumber ? customerBuildingNumber + ' ' : ''}${customerStreet}, ${customerTown}${customerCounty ? ', ' + customerCounty : ''}, ${customerPostcode}`
            : 'Not provided',
        postcode: customerPostcode,
        street: customerStreet,
        town: customerTown,
        buildingNumber: customerBuildingNumber,
        county: customerCounty,
        skipAddressDetails,
      },
      vehicle: {
        registration: (editableRegNumber || vehicleData?.regNumber)?.toUpperCase() || '',
        make: vehicleData?.make || 'Unknown',
        model: vehicleData?.model || 'Unknown',
        year: vehicleData?.year || 'Unknown',
        mileage: parseInt(editableMileage || vehicleData?.mileage || '0').toLocaleString(),
        fuelType: vehicleData?.fuelType || 'Unknown',
        transmission: vehicleData?.transmission || 'Unknown',
      },
      policy: {
        planType: 'Platinum',
        duration: termOption?.label || '12 months',
        durationMonths,
        startDate: startDate.toLocaleDateString('en-GB'),
        endDate: endDate.toLocaleDateString('en-GB'),
        excess: excessAmount,
        claimLimit: displayClaimLimit,
        labourRate: labourRate,
        boostAddon,
        freeExtendedCover,
        breakdownRecovery: autoIncludedAddOns.includes('breakdown'),
        vehicleRental: autoIncludedAddOns.includes('rental'),
        isFutureStart,
      },
      payment: {
        source: paymentSource,
        amount: parseFloat(paymentAmount),
        date: paymentDate,
        notes: paymentNotes,
      },
      integrations: {
        sendToW2k,
        sendWelcomeEmail,
        w2kNotes: additionalNotes ? `External payment via ${paymentSource}. ${additionalNotes}`.trim() : `External payment via ${paymentSource}`.trim(),
      }
    };
  };

  // Validate payment confirmation form
  const isPaymentFormValid = () => {
    return (
      paymentSource.trim() !== '' &&
      paymentAmount.trim() !== '' &&
      warrantyStartDate !== undefined &&
      paymentConfirmed === true
    );
  };

  // Handle confirm external payment - atomic operation
  const handleConfirmExternalPayment = async () => {
    if (previewMode) {
      toast({ title: 'Preview mode', description: 'This is a beta preview — nothing is sent, saved or charged.' });
      return;
    }
    if (!isPaymentFormValid()) {
      toast({
        title: "Incomplete Form",
        description: "Please fill in all required fields and confirm payment",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate warranty before proceeding
    const { checkDuplicateWarranty } = await import('@/lib/duplicateWarrantyCheck');
    const finalEmail = editableCustomerEmail || customerEmail;
    const duplicateCheck = await checkDuplicateWarranty(regNumber, finalEmail);
    if (duplicateCheck.isDuplicate) {
      setDuplicateWarning({ show: true, record: duplicateCheck.existingRecord });
      return;
    }

    // Price match override — evidence + competitor detail are mandatory, and the
    // matched price may be at most 10% cheaper than the competitor's quote.
    if (priceMatchMode) {
      if (!priceMatchCompetitor.trim()) {
        toast({
          title: "Price match details required",
          description: "Enter the competitor and their quoted price before completing the order.",
          variant: "destructive",
        });
        return;
      }
      if (!priceMatchProofPath) {
        toast({
          title: "Price match evidence required",
          description: "Upload the competitor quote (image or PDF) before completing the order.",
          variant: "destructive",
        });
        return;
      }
      const matchedTotal = parseFloat(paymentAmount);
      if (priceMatchFloor && Number.isFinite(matchedTotal) && matchedTotal < priceMatchFloor) {
        toast({
          title: "Below price match limit",
          description: `Maximum 10% cheaper than competitors — the lowest allowed price is £${priceMatchFloor}.`,
          variant: "destructive",
        });
        return;
      }
    }

    // Price validation - allow override, just show warning in UI (no blocking)
    const confirmedAmount = parseFloat(paymentAmount);
    // Audit-only: record who typed a custom price and how it compares to the grid.
    auditPriceOverride('confirm_payment', Number.isFinite(confirmedAmount) ? confirmedAmount : undefined);


    const hasPriceDifference = Math.abs(confirmedAmount - currentPrice.monthlyPrice * 12) > 1;

    setIsConfirmingPaid(true);
    const warrantyReference = await generateWarrantyReference();
    const displayClaimLimit = boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit);
    const termOption = termOptions.find(t => t.id === paymentType);
    const durationMonths = termOption?.months || 12;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminUserId = user?.id;
      
      // Get the admin_users.id for assigning customer to this agent (confirming agent)
      let adminUserRecordId: string | null = null;
      if (adminUserId) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', adminUserId)
          .maybeSingle();
        adminUserRecordId = adminUser?.id || null;
      }
      
      // Get the original quote sender from live_quotes if a quote link exists
      let quoteSentByUserId: string | null = null;
      if (quoteLink) {
        const accessToken = quoteLink.split('/quote/')[1];
        if (accessToken) {
          const { data: originalQuote } = await supabase
            .from('live_quotes')
            .select('created_by')
            .eq('access_token', accessToken)
            .maybeSingle();
          
          if (originalQuote?.created_by) {
            // Get the admin_users.id for the quote sender
            const { data: quoteSenderAdmin } = await supabase
              .from('admin_users')
              .select('id')
              .eq('user_id', originalQuote.created_by)
              .maybeSingle();
            quoteSentByUserId = quoteSenderAdmin?.id || null;
          }
        }
      }

      // === ATOMIC TRANSACTION START ===
      
      // 1. Check for existing customer by email (case insensitive)
      const finalEmail = editableCustomerEmail || customerEmail;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate')
        .ilike('email', finalEmail)
        .maybeSingle();

      // 1b. Check for existing policy — reuse warranty number if found
      let existingPolicyRecord: { id: string; warranty_number: string | null; policy_number: string } | null = null;
      if (existingCustomer) {
        const { data: policies } = await supabase
          .from('customer_policies')
          .select('id, warranty_number, policy_number')
          .eq('customer_id', existingCustomer.id)
          .not('is_deleted', 'eq', true)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (policies && policies.length > 0) {
          existingPolicyRecord = policies[0];
          console.log('Found existing policy, reusing warranty number:', existingPolicyRecord.warranty_number);
        }
      }

      // Use existing warranty number if available, otherwise use the generated one
      const finalWarrantyReference = existingPolicyRecord?.warranty_number || warrantyReference;

      let customerId: string;
      
      // Use editable fields for final data
      // Prefer the explicit first/last inputs from the Step 2 form so the
      // customer record — and the resulting entry in the Customer Management
      // dashboard — is always split correctly, regardless of whether the
      // customer's first name contains spaces or not.
      const parsedFirstName = (editableCustomerFirstName || customerFirstName || '').trim();
      const parsedLastName = (editableCustomerLastName || customerLastName || '').trim();
      const finalName = `${parsedFirstName} ${parsedLastName}`.trim() || (editableCustomerName || customerName);
      const finalPhone = editableCustomerPhone || customerPhone;
      const finalRegNumber = (editableRegNumber || vehicleData.regNumber)?.toUpperCase();
      const finalMileage = editableMileage || vehicleData.mileage;
      
      // 2. Customer record data with payment confirmation details
      const customerData: Record<string, any> = {
        name: finalName,
        first_name: parsedFirstName,
        last_name: parsedLastName,
        email: finalEmail.toLowerCase(),
        phone: finalPhone || null,
        registration_plate: finalRegNumber || null,
        vehicle_make: vehicleData.make || null,
        vehicle_model: vehicleData.model || null,
        vehicle_year: vehicleData.year || null,
        vehicle_fuel_type: vehicleData.fuelType || null,
        vehicle_transmission: vehicleData.transmission || null,
        mileage: finalMileage || null,
        plan_type: 'Platinum',
        payment_type: paymentType === '12months' ? 'yearly' 
          : paymentType === '24months' ? '2-Year'
          : paymentType === '36months' ? '3-Year'
          : paymentType,
        status: 'Active',
        warranty_reference_number: finalWarrantyReference,
        voluntary_excess: excessAmount,
        claim_limit: displayClaimLimit,
        labour_rate: labourRate,
        final_amount: confirmedAmount,
        is_manual_entry: true,
        // Awaits management verification before flipping to true
        payment_verified: false,
        breakdown_recovery: getAutoIncludedAddOns(paymentType).includes('breakdown'),
        vehicle_rental: getAutoIncludedAddOns(paymentType).includes('rental'),
        // Assign customer to the confirming sales agent
        assigned_to: adminUserRecordId,
        // Sales agent attribution for commission tracking
        quote_sent_by: quoteSentByUserId,
        payment_confirmed_by: adminUserRecordId,
        // CRITICAL: Save the selected payment source from the dropdown
        purchase_source: paymentSource || 'external',
        // Persist notes to customer record so they appear in Customer Management Notes column
        contact_notes: [paymentNotes, additionalNotes, priceMatchMode && priceMatchCompetitor ? `Price match: ${priceMatchCompetitor}` : '', discountAuthBy ? `Discount over ${DISCOUNT_CEILING_PCT}% authorised by ${discountAuthBy}${discountAuthReason ? ` — ${discountAuthReason}` : ''}` : ''].filter(Boolean).join('\n\n') || null,
        // Deposit taken on Stripe — tags the record as Payment due in Customer Management
        deposit_taken: depositMode,
        deposit_amount: depositMode ? depositAmountValue : null,
        balance_due_amount: depositMode
          ? Math.max(0, Number(confirmedAmount || 0) - (depositAmountValue || 0))
          : null,
        deposit_taken_at: depositMode ? new Date().toISOString() : null,
        deposit_taken_by: depositMode ? adminUserRecordId : null,
        payment_due_date: depositMode && depositDueDate ? depositDueDate : undefined,
      };
      
      // Include address if provided (not skipped)
      if (!skipAddressDetails && customerPostcode) {
        customerData.postcode = customerPostcode;
        customerData.street = customerStreet || null;
        customerData.town = customerTown || null;
        customerData.building_number = customerBuildingNumber || null;
        customerData.county = customerCounty || null;
      }

      // Attach price match evidence so it shows in Customer Management
      if (priceMatchMode && priceMatchProofPath) {
        customerData.price_comparison_proof_url = priceMatchProofPath;
      }

      // Structured price match data — feeds the competitor pricing view in Vehicle Intelligence
      if (priceMatchMode) {
        const competitorName = (priceMatchCompany === 'Other' ? priceMatchOtherName : priceMatchCompany).trim();
        customerData.price_match_applied = true;
        customerData.price_match_competitor = competitorName || priceMatchCompetitor.trim() || null;
        customerData.price_match_competitor_price = priceMatchCompetitorPrice ?? null;
        customerData.price_match_our_price = Number(confirmedAmount) || null;
      }




      // 3. Create or update customer
      if (existingCustomer) {
        const { error: updateError } = await supabase
          .from('customers')
          .update({ ...customerData, updated_at: new Date().toISOString() })
          .eq('id', existingCustomer.id);
        
        if (updateError) throw updateError;
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert(customerData as any)
          .select('id')
          .single();
        
        if (insertError) throw insertError;
        customerId = newCustomer.id;
      }

      // 3b. Deposit taken → open a Part Payment plan and log the deposit so the
      // balance is tracked (and reminded) in Customer Management > Part Payments.
      if (depositMode && customerId) {
        try {
          const totalDue = Number(confirmedAmount || 0);
          await supabase
            .from('customer_part_payment_plans')
            .upsert(
              {
                customer_id: customerId,
                total_due: totalDue,
                next_due_date: depositDueDate || null,
                status: 'in_progress',
                reminder_enabled: true,
                reminder_note: `Deposit taken — chase £${Math.round(Math.max(0, totalDue - (depositAmountValue || 0)))} balance`,
                created_by: adminUserRecordId,
              } as any,
              { onConflict: 'customer_id' },
            );

          if (depositAmountValue && depositAmountValue > 0) {
            await supabase.from('customer_part_payments').insert({
              customer_id: customerId,
              amount: depositAmountValue,
              payment_method: paymentSource === 'stripe' ? 'stripe' : (paymentSource || 'stripe'),
              paid_on: new Date().toISOString().slice(0, 10),
              notes: 'Deposit taken at point of sale (Quotes & Orders)',
              recorded_by: (await supabase.auth.getUser()).data?.user?.id ?? null,
            } as any);
          }
        } catch (ppErr) {
          console.error('Part payment plan creation failed:', ppErr);
        }
      }

      // 4. Calculate policy dates using warrantyStartDate
      // CRITICAL: Use UTC midnight to avoid BST/GMT timezone offset causing wrong date

      const startDateLocal = startOfDay(warrantyStartDate);
      const startDate = new Date(Date.UTC(startDateLocal.getFullYear(), startDateLocal.getMonth(), startDateLocal.getDate()));
      const endDate = new Date(startDate);
      endDate.setUTCMonth(endDate.getUTCMonth() + durationMonths);
      
      // Check if this is a future start date for W2000 scheduling
      const isFutureStartDate = !isToday(warrantyStartDate) && warrantyStartDate > new Date();

      // 5. Create or update policy record with payment confirmation metadata
      // Convert paymentType ID to human-readable label for consistency
      const paymentTypeLabel = paymentType === '12months' ? 'yearly' 
        : paymentType === '24months' ? '2-Year'
        : paymentType === '36months' ? '3-Year'
        : paymentType;
      
      const policyData: Record<string, any> = {
        customer_id: customerId,
        email: finalEmail.toLowerCase(),
        customer_full_name: finalName,
        plan_type: 'Platinum',
        payment_type: paymentTypeLabel,
        policy_number: existingPolicyRecord?.policy_number || finalWarrantyReference,
        warranty_number: finalWarrantyReference,
        policy_start_date: startDate.toISOString(),
        policy_end_date: endDate.toISOString(),
        status: isFutureStartDate ? 'scheduled' : 'active',
        voluntary_excess: excessAmount,
        claim_limit: displayClaimLimit,
        payment_amount: confirmedAmount,
        breakdown_recovery: getAutoIncludedAddOns(paymentType).includes('breakdown'),
        vehicle_rental: getAutoIncludedAddOns(paymentType).includes('rental'),
        is_manual_entry: true,
        payment_verified: false,
        // Warranties Register integration removed — internal handling only.
        // Include additional notes and bonus months from quote
        additional_notes: additionalNotes || null,
        seasonal_bonus_months: selectedBonusMonths,
        // Sales agent attribution for commission tracking
        quote_sent_by: quoteSentByUserId,
        payment_confirmed_by: adminUserRecordId,
      };
      
      // Include address in policy if provided
      if (!skipAddressDetails && customerPostcode) {
        policyData.address = {
          postcode: customerPostcode,
          street: customerStreet || '',
          town: customerTown || '',
          building_number: customerBuildingNumber || '',
          county: customerCounty || '',
        };
      }

      let policyId: string;
      
      console.log('[CONFIRM-EXTERNAL] Policy data being saved:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        warrantyStartDate: warrantyStartDate.toISOString(),
        paymentType: policyData.payment_type,
        claimLimit: policyData.claim_limit,
        customerName: finalName,
        email: finalEmail,
      });
      
      if (existingPolicyRecord) {
        // Update existing policy instead of creating duplicate
        const { error: policyUpdateError } = await supabase
          .from('customer_policies')
          .update({ ...policyData, updated_at: new Date().toISOString() })
          .eq('id', existingPolicyRecord.id);

        if (policyUpdateError) throw policyUpdateError;
        policyId = existingPolicyRecord.id;
        console.log('Updated existing policy:', policyId);
      } else {
        // Create new policy
        const { data: newPolicy, error: policyError } = await supabase
          .from('customer_policies')
          .insert(policyData as any)
          .select('id')
          .single();

        if (policyError) throw policyError;
        policyId = newPolicy.id;
      }

      // 6. Add admin note with payment confirmation details
      await supabase
        .from('admin_notes')
        .insert({
          customer_id: customerId,
          note: `External Payment Confirmed:\n• Source: ${paymentSource}\n• Amount: £${confirmedAmount}\n• Warranty Start Date: ${format(startDate, 'd MMM yyyy')}${isFutureStartDate ? ' (future start)' : ''}\n• Confirmed by: ${adminEmail || 'Admin'}${paymentNotes ? `\n• Notes: ${paymentNotes}` : ''}`,
          created_by: adminUserId
        });

      // 7. Update live_quotes status if exists
      if (quoteLink) {
        const accessToken = quoteLink.split('/quote/')[1];
        if (accessToken) {
          await supabase
            .from('live_quotes')
            .update({ 
              status: 'paid_externally',
              payment_confirmed_at: new Date().toISOString(),
              payment_confirmed_by: adminUserId,
              payment_source: paymentSource
            })
            .eq('access_token', accessToken);
        }
      }

      // 8. Mark any abandoned carts as converted
      await supabase
        .from('abandoned_carts')
        .update({ 
          is_converted: true, 
          converted_at: new Date().toISOString(),
          contact_status: 'converted'
        })
        .eq('email', customerEmail.toLowerCase());

      // 9. Mark any sales leads as converted
      if (selectedLeadId) {
        await supabase
          .from('sales_leads')
          .update({
            status: 'converted',
            converted_at: new Date().toISOString()
          })
          .eq('id', selectedLeadId);
      }

      // === ATOMIC TRANSACTION END ===

      // Initialize completion status - policy is created at this point
      let emailSentSuccess: boolean | null = null;

      // Warranties Register integration removed — internal handling only.


      // 11. Send welcome email with warranty number and dashboard login.
      // The edge function itself writes `email_sent_status` on the policy row
      // once Resend accepts the send, so we ignore transport-level invoke
      // errors (they usually just mean the slow function outran the browser's
      // wait) and instead poll the row for the authoritative status.
      if (sendWelcomeEmail) {
        try {
          supabase.functions.invoke('send-welcome-email-manual', {
            body: { policyId, customerId }
          }).catch((e) => console.warn('Welcome email invoke transport error (server may still succeed):', e));

          // Poll customer_policies.email_sent_status for up to ~45s.
          const startedAt = Date.now();
          while (Date.now() - startedAt < 45_000) {
            await new Promise((r) => setTimeout(r, 2000));
            const { data: pRow } = await supabase
              .from('customer_policies')
              .select('email_sent_status')
              .eq('id', policyId)
              .maybeSingle();
            if (pRow?.email_sent_status === 'sent') {
              emailSentSuccess = true;
              break;
            }
            if (pRow?.email_sent_status === 'failed') {
              emailSentSuccess = false;
              break;
            }
          }
          if (emailSentSuccess === null) {
            // Timed out waiting — treat as pending-but-likely-sent so we
            // don't paint a false-negative "Failed" badge.
            console.warn('Welcome email status not confirmed within timeout; leaving pending.');
          }
        } catch (emailError) {
          console.error('Welcome email polling error:', emailError);
          emailSentSuccess = false;
        }
      }

      // Send sale notification email (fire and forget)
      try {
        await supabase.functions.invoke('send-sale-notification', {
          body: {
            customerName: finalName,
            customerEmail: finalEmail,
            customerPhone: customerPhone || null,
            regPlate: regNumber || null,
            planName: 'Platinum',
            saleValue: confirmedAmount,
            paymentMethod: paymentSource || 'External',
            warrantyReference: finalWarrantyReference,
            vehicleMake: vehicleData?.make || null,
            vehicleModel: vehicleData?.model || null,
            agentId: quoteSentByUserId || null,
            saleSource: 'QUOTE',
          }
        });
      } catch (e) {
        console.warn('Sale notification email failed (non-critical):', e);
      }

      // Set completion status and show complete step
      setCompletionStatus({
        policyCreated: true,
        emailSent: sendWelcomeEmail ? emailSentSuccess : null,
        w2000Sent: null,
        warrantyReference: finalWarrantyReference,
        isFutureStart: isFutureStartDate
      });
      setExternalPaymentStep('complete');
      setIsConfirmingPaid(false);

      // Success toast
      toast({
        title: isFutureStartDate ? "✅ Policy Scheduled!" : "✅ Policy Activated!",
        description: isFutureStartDate 
          ? `Warranty ${finalWarrantyReference} created. Cover starts ${format(startDate, 'd MMM yyyy')}.`
          : `Warranty ${finalWarrantyReference} created successfully.`,
        duration: 6000,
      });

    } catch (error: any) {
      console.error('Error confirming external payment:', error);
      toast({
        title: "❌ Payment Confirmation Failed",
        description: error.message || "Failed to create policy. No changes were made.",
        variant: "destructive",
      });
      setIsConfirmingPaid(false);
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    clearDraft();
    setStep(1);
    setRegNumber('');
    setMileage('');
    setSliderMileage(0);
    setVehicleData(null);
    setAutoPreview({ loading: false, error: null, data: null });
    setCustomerEmail('');
    setCustomerFirstName(''); setCustomerLastName('');
    setCustomerPhone('');
    setCustomerDob('');
    setCustomerPostcode('');
    setCustomerStreet('');
    setCustomerTown('');
    setCustomerBuildingNumber('');
    setCustomerCounty('');
    setSkipAddressDetails(false);
    setPaymentType('24months');
    setExcessAmount(100);
    setClaimLimit(2000);
    setLabourRate(70);
    setBoostAddon(false);
    setSelectedAddOns({});
    setAdditionalNotes('');
    setQuoteLink(null);
    setQuoteGenerated(false);
    setSelectedLeadId(null);
    // Clear any price overrides so figures don't stick from previous quote
    setCustomMonthlyPrice('');
    setCustomFullPrice('');
    setQuotedPriceOverride('');
    setIncludePayInFullDiscount(false);
    setFreeExtendedCover('none');
    setAgeOverrideEnabled(false);
    // Reset validation state
    setShowNameError(false);
    setShowEmailError(false);
    // Reset payment confirmation fields
    setPaymentSource('');
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentConfirmed(false);
    setPaymentNotes('');
    setExistingPolicyWarning(null);
    setExternalPaymentStep('details');
    setCompletionStatus(null);
    setWarrantyStartDate(new Date());
  };


  return (
    <>
    <DuplicateWarrantyDialog
      isOpen={duplicateWarning.show}
      onClose={() => setDuplicateWarning({ show: false })}
      record={duplicateWarning.record}
    />
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Quotes & Orders</h1>
        <p className="text-gray-600 mt-1 text-sm">Create quotes to send customers or confirm orders paid elsewhere</p>
      </div>

      

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full h-8 bg-gray-100 rounded-md p-0.5 gap-0.5">
          <TabsTrigger value="new" className="text-xs py-1 px-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-700 rounded transition-colors">
            Quote / Confirm
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs py-1 px-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-700 rounded transition-colors">
            History <span className="opacity-60">({sentQuotes.length + savedQuotes.length})</span>
          </TabsTrigger>
          <TabsTrigger value="paid" className="text-xs py-1 px-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-700 rounded transition-colors">
            Paid Orders {paidOrdersCount > 0 && <span className="opacity-60">({paidOrdersCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="logins" className="text-xs py-1 px-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-700 rounded transition-colors">
            Customer Logins
          </TabsTrigger>
          <TabsTrigger value="update" className="text-xs py-1 px-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-700 rounded transition-colors">
            Update
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4 mt-4">
          {/* Step 1: Vehicle Details */}
          {step === 1 && (
            <Card className="border border-gray-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-br from-gray-50 to-white border-b border-gray-200 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetForm}
                      className="text-muted-foreground hover:text-foreground -ml-2 rounded-full h-8"
                    >
                      ← Back
                    </Button>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black text-white font-bold text-sm shadow-sm">
                        1
                      </div>
                      <div>
                        <CardTitle className="text-lg">Step 1: Vehicle Details</CardTitle>
                        <CardDescription className="text-xs">Enter the customer's vehicle registration and mileage</CardDescription>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2 flex-wrap justify-end">
                      {onNavigateToTab && (
                        <>
                          {canAccessTab('new-leads') && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => onNavigateToTab?.('new-leads')}
                              className="gap-1 px-0 h-auto"
                            >
                              New leads <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                          {canAccessTab('recontact-leads') && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => onNavigateToTab?.('recontact-leads')}
                              className="gap-1 px-0 h-auto"
                            >
                              Recontacted Leads <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                          {canAccessTab('renewals') && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => onNavigateToTab?.('renewals')}
                              className="gap-1 px-0 h-auto"
                            >
                              Renewals <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                      <LeadSearchPopover onSelectLead={handleLeadSelect} />
                      {savedQuotes.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveTab('history');
                            setHistorySubTab('saved');
                          }}
                          className="gap-1"
                        >
                          <BookOpen className="h-4 w-4" />
                          Saved ({savedQuotes.length})
                        </Button>
                      )}
                    </div>
                    {selectedLeadId ? (
                      <Badge variant="secondary" className="gap-1">
                        <UserCheck className="h-3 w-3" />
                        Lead imported{selectedLeadOwner ? ` · ${selectedLeadOwner}'s lead` : ' · Unassigned lead'}
                      </Badge>
                    ) : matchedLeadOwner.leadFound ? (
                      <Badge variant="secondary" className="gap-1">
                        <UserCheck className="h-3 w-3" />
                        Existing lead{matchedLeadOwner.ownerName ? ` · ${matchedLeadOwner.ownerName}'s lead` : ' · Unassigned lead'}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col gap-4 max-w-2xl">
                  <div className="space-y-3">
                {/* Registration — yellow UK plate */}

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-900">Registration Number</Label>
                  <div className="flex items-stretch rounded-lg overflow-hidden border-2 border-black max-w-md shadow-sm">
                    <div className="bg-blue-600 text-white font-bold px-3 flex flex-col items-center justify-center min-w-[56px] text-xs leading-tight">
                      <span>GB</span>
                      <span>UK</span>
                    </div>
                    <input
                      type="text"
                      value={regNumber}
                      onChange={(e) => setRegNumber(formatRegNumber(e.target.value))}
                      placeholder="ENTER REG"
                      className="bg-yellow-400 border-none outline-none text-2xl md:text-3xl text-black flex-1 font-black placeholder:text-black/40 px-4 py-2.5 uppercase tracking-wider min-w-0"
                      maxLength={8}
                    />
                  </div>
                </div>

                {/* Auto Vehicle Identification — clean inline summary, no nested borders */}
                {(autoPreview.loading || autoPreview.data || autoPreview.error) && (
                  <div className="text-sm">
                    {autoPreview.loading && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Identifying vehicle…
                      </div>
                    )}
                    {!autoPreview.loading && autoPreview.error && (
                      <div className="text-muted-foreground">{autoPreview.error} — you can still continue and enter details manually.</div>
                    )}
                    {!autoPreview.loading && autoPreview.data && (() => {
                      const d = autoPreview.data!;
                      const numericMileage = parseInt((mileage || '').replace(/[^0-9]/g, ''), 10) || sliderMileage;
                      const mileageOver = numericMileage > 150000;
                      const ageOver = typeof d.ageYears === 'number' && d.ageYears > 15;
                      const eligible = !d.blocked && !mileageOver && (!ageOver || ageOverrideEnabled);
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Car className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              <div className="font-semibold text-base text-gray-900 truncate">
                                {(d.make || '').toUpperCase()} {d.model} {d.year ? <span className="font-normal">({d.year})</span> : ''}
                                {d.fuelType ? <span className="text-muted-foreground font-normal"> · {d.fuelType}</span> : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-5 text-xs">
                              <span className={`flex items-center gap-1.5 ${ageOver && !ageOverrideEnabled ? 'text-red-700' : 'text-gray-600'}`}>
                                <Calendar className="w-3.5 h-3.5" />
                                Age <strong className="text-gray-900 font-semibold">{typeof d.ageYears === 'number' ? `${d.ageYears} yr${d.ageYears === 1 ? '' : 's'}` : '—'}</strong>
                              </span>
                              <span className={`flex items-center gap-1.5 ${mileageOver ? 'text-red-700' : 'text-gray-600'}`}>
                                <Gauge className="w-3.5 h-3.5" />
                                Mileage <strong className="text-gray-900 font-semibold">{numericMileage > 0 ? numericMileage.toLocaleString() : '—'}</strong>
                              </span>
                              <Badge
                                variant={eligible ? 'default' : 'destructive'}
                                className={eligible ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 gap-1' : 'gap-1'}
                              >
                                {eligible ? <><CheckCircle2 className="w-3.5 h-3.5" /> Eligible</> : 'Not eligible'}
                              </Badge>
                            </div>
                          </div>
                          {d.blocked && (
                            <div className="text-xs text-red-600 font-medium">{d.blockReason || 'This make/model is on the excluded list.'}</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                  </div>

                {/* Mileage — mirrors Step 4 customer checkout */}
                  <div>
                  <Label htmlFor="mileage" className="block text-base font-semibold text-foreground mb-1">
                    Confirm your current mileage
                  </Label>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {step1MotMileageResolved
                      ? "We've suggested this using your latest MOT record."
                      : 'Up to 150,000 miles.'}
                  </p>

                  {step1MotMileageResolved && (
                    <p className="mb-4 text-sm text-muted-foreground">
                      Last recorded at your MOT{step1MotDate ? ` on ${new Date(step1MotDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. Update it if your current mileage is different.
                    </p>
                  )}

                  {step1MotLoading && !step1MotMileageResolved ? (
                    <div className="h-11 sm:h-12 flex items-center gap-2 px-3 border border-border rounded-lg bg-muted/30 mb-4">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Fetching from MOT history…</span>
                    </div>
                  ) : null}

                  {step1MotMileageResolved ? (
                    <p className="mb-4 text-sm text-[#3A6FA0] bg-[#EAF2FB] border border-[#CFE0F2] rounded-md px-4 py-2.5 inline-block">
                      Last recorded MOT: <span className="font-semibold text-[#0F1B3D]">{Number(step1MotMileageResolved).toLocaleString('en-GB')} miles</span>
                      <span className="block mt-1 text-[#0BA360] font-medium">
                        Pulled live from the MOT record — adjust it if the customer's mileage is higher.
                      </span>
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-3">

                    <div className="relative">
                      <input
                        id="mileage"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={mileage}
                        onChange={handleMileageChange}
                        placeholder={step1MotMileageResolved ? `e.g. ${(Number(step1MotMileageResolved) + 5000).toLocaleString('en-GB')}` : 'e.g. 105,000'}
                        className={`h-11 sm:h-12 w-full rounded-lg border bg-background px-3 pr-10 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          (parseInt(mileage.replace(/[^0-9]/g, ''), 10) || 0) > 150000
                            ? 'border-[#FF385C] focus-visible:ring-[#FF385C]'
                            : (parseInt(mileage.replace(/[^0-9]/g, ''), 10) || 0) >= 1000
                              ? 'border-[#0BA360]'
                              : 'border-input'
                        }`}
                      />
                      {(parseInt(mileage.replace(/[^0-9]/g, ''), 10) || 0) >= 1000 &&
                        (parseInt(mileage.replace(/[^0-9]/g, ''), 10) || 0) <= 150000 && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0BA360] pointer-events-none" />
                      )}
                    </div>

                    {step1MotMileageResolved ? (
                      <div className="mt-1">
                        <p className="text-sm font-medium mb-2 text-[#1F2A44]">
                          Or roughly how many miles since your MOT?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: 'Same as MOT', add: 0 },
                            { label: '+2,500', add: 2500 },
                            { label: '+5,000', add: 5000 },
                          ].map(({ label, add }) => {
                            const target = Number(step1MotMileageResolved) + add;
                            const isSelected = (parseInt(mileage.replace(/[^0-9]/g, ''), 10) || 0) === target;
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => {
                                  setMileage(target.toLocaleString());
                                  setSliderMileage(Math.min(target, 150000));
                                }}
                                className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                                  isSelected
                                    ? 'border-brand-orange bg-brand-orange/10 text-[#1F2A44]'
                                    : 'border-[#CFD4DB] bg-white text-[#1F2A44] hover:border-[#1F2A44] hover:bg-muted/30'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        {(() => {
                          const entered = parseInt(mileage.replace(/[^0-9]/g, ''), 10) || 0;
                          if (entered < 1000 || entered > 150000) return null;
                          return (
                            <p className="mt-2 text-sm text-[#0BA360] flex items-center gap-1.5">
                              <Check className="w-4 h-4" />
                              We'll use approximately {entered.toLocaleString('en-GB')} miles.
                            </p>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                  </div>
                </div>


                {/* Age Override Option — restricted to managers / super admins */}
                {canOverrideAge ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2.5">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="ageOverride"
                        checked={ageOverrideEnabled}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setShowAgeOverrideConfirm(true);
                          } else {
                            setAgeOverrideEnabled(false);
                          }
                        }}
                      />
                      <Label htmlFor="ageOverride" className="text-sm font-medium cursor-pointer text-gray-700">
                        Override 15-year age limit <span className="text-xs text-muted-foreground font-normal">(super admin / manager only)</span>
                      </Label>
                    </div>
                    {ageOverrideEnabled && (
                      <Alert className="mt-1.5 py-2 border border-amber-300 bg-amber-50">
                        <AlertCircle className="h-4 w-4 text-amber-700" />
                        <AlertDescription className="text-sm text-amber-900">
                          Age override is active. Vehicles older than 15 years will be priced using 12–15 year pricing.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/40 p-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>15-year age limit override is restricted to super admins and managers.</span>
                  </div>
                )}


                {/* Two Primary Actions */}
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={handleVehicleLookup}
                      disabled={isLookingUp || isQuickConfirming}
                      className="group relative flex flex-col items-start gap-0.5 rounded-xl bg-blue-600 text-white px-4 py-3 shadow-sm hover:shadow-md hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-left"
                    >
                      <div className="flex items-center gap-2 w-full">
                        {isLookingUp ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                        <span className="font-semibold text-sm">
                          {isLookingUp ? 'Looking up…' : 'Send Quote'}
                        </span>
                        <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <span className="text-xs text-white/80 font-normal">Configure & email a quote link</span>
                    </button>

                    <button
                      onClick={handleQuickConfirmOrder}
                      disabled={isLookingUp || isQuickConfirming || !regNumber.trim()}
                      className="group relative flex flex-col items-start gap-0.5 rounded-xl bg-white border-2 border-emerald-600 text-emerald-700 px-4 py-3 shadow-sm hover:shadow-md hover:bg-emerald-50 hover:border-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-left"
                    >
                      <div className="flex items-center gap-2 w-full">
                        {isQuickConfirming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                        <span className="font-semibold text-sm">
                          {isQuickConfirming ? 'Processing…' : 'Confirm Payment'}
                        </span>
                        <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <span className="text-xs text-emerald-700/70 font-normal">Already paid elsewhere</span>
                    </button>

                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invoice builder — open to every sales agent from Step 2 */}
          <QuoteInvoiceDialog
            open={invoiceDialogOpen}
            onOpenChange={setInvoiceDialogOpen}
            source={{
              customerName: customerName || [customerFirstName, customerLastName].filter(Boolean).join(' '),
              customerEmail: customerEmail,
              customerPhone: customerPhone,
              address: [customerBuildingNumber, customerStreet, customerTown, customerCounty, customerPostcode]
                .filter(Boolean)
                .join(', '),
              regNumber: vehicleData?.regNumber || regNumber,
              vehicleMake: vehicleData?.make,
              vehicleModel: vehicleData?.model,
              vehicleYear: vehicleData?.year ? String(vehicleData.year) : undefined,
              mileage,
              planName: 'Platinum',
              durationLabel:
                paymentType === '36months' ? '3 years' : paymentType === '24months' ? '2 years' : '1 year',
              claimLimit,
              excessAmount,
              labourRate,
              totalPrice: displayedTotalPrice,
              monthlyPrice: Number(currentPrice.monthlyPrice || 0),
              addOns: Object.entries(selectedAddOns)
                .filter(([, on]) => on)
                .map(([key]) => key),
            }}
          />

          {/* Step 2: Quote Details */}
          {step === 2 && vehicleData && (
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle>Step 2: Quote Details</CardTitle>
                    <CardDescription>Configure cover options for this vehicle</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <LeadSearchPopover 
                      onSelectLead={handleLeadSelect} 
                      className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300"
                    />
                    <Button
                      size="sm"
                      onClick={() => setInvoiceDialogOpen(true)}
                      className="gap-1 bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      <FileText className="h-4 w-4" />
                      Create invoice
                    </Button>
                    {savedQuotes.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveTab('history');
                          setHistorySubTab('saved');
                        }}
                        className="gap-1"
                      >
                        <BookOpen className="h-4 w-4" />
                        Saved ({savedQuotes.length})
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setStep(1)}
                      className="text-muted-foreground hover:text-foreground border-muted-foreground/30"
                    >
                      ← Back
                    </Button>
                  </div>
                </div>

                {/* Manager-only pricing source note */}
                {isManagementRole && !isPriceOverridden && (
                  pricingTrace.usedLegacy ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <span className="font-semibold">Using legacy pricing</span> — {pricingTrace.reason}. This quote does not follow the currently published pricing model.
                      </div>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 w-fit">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Priced from the published pricing model
                    </div>
                  )
                )}


                {/* Vehicle summary card */}

                <div className="flex items-center justify-between gap-4 p-3 sm:p-4 rounded-xl border border-gray-200 bg-gray-50/60">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="flex-shrink-0 rounded-md overflow-hidden border-2 border-black shadow-sm">
                      <div className="bg-yellow-400 px-2.5 py-1.5 sm:px-3 sm:py-2">
                        <span className="font-black text-black text-sm sm:text-base tracking-wider whitespace-nowrap">
                          {vehicleData.regNumber}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-base sm:text-lg truncate">
                        {[vehicleData.make, vehicleData.model].filter(Boolean).join(' ').toUpperCase() || 'Vehicle'}
                        {vehicleData.year ? ` (${vehicleData.year})` : ''}
                      </p>
                      {vehicleData.fuelType && (
                        <p className="text-sm text-gray-500 truncate">{vehicleData.fuelType}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleEditReg(vehicleData?.regNumber || regNumber || '');
                        setIsEditingVehicle(true);
                      }}
                      className="text-brand-orange hover:text-orange-700 font-semibold text-sm sm:text-base transition-colors"
                    >
                      Change reg
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingVehicle(false);
                        setVehicleData(null);
                        setRegNumber('');
                        setMileage('');
                        setSliderMileage(0);
                        setStep1AutoFilledMileage(null);
                        setStep1MileagePrefilledReg(null);
                        setAutoPreview({ loading: false, error: null, data: null });
                        setStep(1);
                      }}
                      className="text-muted-foreground hover:text-foreground text-sm underline"
                    >
                      Start over
                    </button>
                  </div>
                </div>

                {isEditingVehicle && (
                  <div className="rounded-xl border border-brand-orange/40 bg-orange-50/50 p-3 sm:p-4 space-y-3">
                    <Label className="text-sm font-semibold text-gray-900">Enter the new registration</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-stretch rounded-lg overflow-hidden border-2 border-black shadow-sm">
                        <div className="bg-blue-600 text-white font-bold px-2.5 flex flex-col items-center justify-center min-w-[48px] text-[10px] leading-tight">
                          <span>GB</span>
                          <span>UK</span>
                        </div>
                        <input
                          type="text"
                          value={vehicleEditReg}
                          onChange={(e) => setVehicleEditReg(formatRegNumber(e.target.value))}
                          onKeyDown={(e) => { if (e.key === 'Enter') applyNewVehicle(); }}
                          placeholder="NEW REG"
                          maxLength={8}
                          autoFocus
                          className="bg-yellow-400 border-none outline-none text-xl sm:text-2xl text-black font-black placeholder:text-black/40 px-3 py-2 uppercase tracking-wider w-[190px]"
                        />
                      </div>
                      <Button onClick={applyNewVehicle} disabled={isSwappingVehicle} className="bg-brand-orange hover:bg-orange-700 text-white">
                        {isSwappingVehicle ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</>) : 'Update vehicle'}
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditingVehicle(false)} disabled={isSwappingVehicle}>
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This replaces the vehicle on this quote — make, model, year, mileage and pricing are all recalculated for the new registration.
                    </p>
                  </div>
                )}

              </CardHeader>

              <CardContent className="space-y-6">
                {/* Customer Info */}
                <div ref={customerInfoRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 scroll-mt-24">
                  <div className="space-y-2">
                    <Label>First Name <span className="text-red-500">*</span></Label>
                    <Input
                      ref={customerNameInputRef}
                      value={customerFirstName}
                      onChange={(e) => {
                        setCustomerFirstName(e.target.value);
                        if (showNameError && e.target.value.trim()) setShowNameError(false);
                      }}
                      placeholder="e.g. John"
                      className={cn(
                        "bg-blue-50 border-blue-200 focus:border-blue-400",
                        showNameError && "border-red-500 bg-red-50"
                      )}
                    />
                    {showNameError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> First name is required
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Surname <span className="text-red-500">*</span></Label>
                    <Input
                      ref={customerLastNameInputRef}
                      value={customerLastName}
                      onChange={(e) => {
                        setCustomerLastName(e.target.value);
                        if (showLastNameError && e.target.value.trim()) setShowLastNameError(false);
                      }}
                      placeholder="e.g. Smith"
                      className={cn(
                        "bg-blue-50 border-blue-200 focus:border-blue-400",
                        showLastNameError && "border-red-500 bg-red-50"
                      )}
                    />
                    {showLastNameError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Surname is required
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Email <span className="text-red-500">*</span></Label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        if (showEmailError && e.target.value.includes('@')) setShowEmailError(false);
                      }}
                      placeholder="customer@example.com"
                      className={cn(
                        "bg-blue-50 border-blue-200 focus:border-blue-400",
                        showEmailError && "border-red-500 bg-red-50"
                      )}
                    />
                    {showEmailError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Valid email address is required
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Phone</Label>
                    <Input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="07xxx xxxxxx"
                      className="bg-blue-50 border-blue-200 focus:border-blue-400"
                    />
                  </div>
                </div>

                {/* Date of Birth - Optional (type or select) */}
                <DobTypeOrSelect value={customerDob} onChange={setCustomerDob} />


                {/* Duration - Quick Select Chips */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Cover Duration</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {termOptions.map((term) => (
                      <button
                        key={term.id}
                        onClick={() => setPaymentType(term.id as PaymentPeriod)}
                        className={cn(
                          "relative p-4 rounded-lg border-2 text-center transition-all",
                          paymentType === term.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {term.isPopular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                            POPULAR
                          </span>
                        )}
                        {term.isBestValue && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                            BEST VALUE
                          </span>
                        )}
                        <div className="font-semibold">{term.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Labour Rate - Quick Select Chips */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Labour Rate</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {getLabourRateChips(pricingModel.labourRateFactors).map((option) => (
                      <button
                        key={option.rate}
                        onClick={() => setLabourRate(option.rate)}
                        className={cn(
                          "relative py-3 px-2 rounded-lg border-2 text-center transition-all min-h-[80px] flex flex-col items-center justify-center",
                          labourRate === option.rate
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {option.isBestValue && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            BEST VALUE
                          </span>
                        )}
                        {option.isPopular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            POPULAR
                          </span>
                        )}
                        <div className="text-base font-bold">£{option.rate}/hr</div>
                        <div className="font-semibold text-xs">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>

                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Higher rate = more garage choice</p>
                </div>

                {/* Excess - Quick Select Chips (canonical journey labels + live £/mo delta) */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Excess Amount</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {excessOptions.map((excess) => {
                      const meta = JOURNEY_EXCESS_OPTIONS.find(o => o.value === excess);
                      const delta = getExcessMonthlyDelta(
                        paymentType as PaymentPeriod,
                        excess,
                        excessPriceBasis,
                      );
                      return (
                        <button
                          key={excess}
                          onClick={() => setExcessAmount(excess)}
                          className={cn(
                            "py-2.5 px-2 rounded-lg border-2 text-center transition-all",
                            excessAmount === excess
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="font-semibold">£{excess}</div>
                          <div className="text-[11px] text-muted-foreground leading-tight">
                            {meta?.description}
                          </div>
                          <div className="text-[11px] font-medium">
                            {delta === 0
                              ? '£0'
                              : delta > 0
                                ? `+£${delta}/mo`
                                : `−£${Math.abs(delta)}/mo`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Priced as a flat £/mo difference vs £100 (Balanced), over 12 instalments — identical to Step 3.
                  </p>
                </div>


                {/* Claim Limit - Quick Select Chips */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Claim Limit 🚗</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {getVisibleClaimLimits(vehicleData?.make).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          if (option.value === 5000) {
                            if (!claimLimit5kAllowed) {
                              setClaimLimitAuthSent(false);
                              setClaimLimitAuthReason('');
                              setClaimLimitAuthOpen(true);
                              return;
                            }
                            setClaimLimit(5000);
                            setBoostAddon(false);
                          } else {
                            // £3,000 is a real tier in the published model (its own
                            // factor), never "£2,000 + boost" — otherwise it quotes
                            // identically to £2,000.
                            setClaimLimit(option.value);
                            setBoostAddon(false);
                          }
                        }}
                        className={cn(
                          "py-3 px-2 rounded-lg border-2 text-center transition-all relative",
                          claimLimit === option.value

                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50",
                          option.value === 5000 && !claimLimit5kAllowed && "opacity-60"
                        )}
                      >
                        {option.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">POPULAR</span>
                        )}
                        {option.value === 5000 && !claimLimit5kAllowed && (
                          <LockIcon className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                        {option.value === 5000 && !claimLimit5kAllowed && (
                          <div className="text-[10px] font-semibold text-amber-700 mt-0.5">Manager approval</div>
                        )}
                      </button>
                    ))}
                  </div>
                  {claimLimit5kApproval ? (
                    <p className="text-xs font-medium mt-1 rounded-md px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200">
                      £5,000 cover authorised for {claimLimit5kApproval.registration_plate} by{' '}
                      {claimLimit5kApproval.decided_by_name || 'Management'}.
                    </p>
                  ) : (
                    <p className={cn(
                      "text-xs font-medium mt-1 rounded-md px-2.5 py-1.5 transition-all",
                      claimLimit === 5000
                        ? "bg-[#FF385C]/10 text-[#FF385C] border border-[#FF385C]/20"
                        : "text-amber-600"
                    )}>
                      {isManagementRole
                        ? '⚠️ £5,000 AutoCare Premium is not available for Porsche, Range Rover, Jaguar, and Tesla vehicles. Agents need your authorisation to sell it on any vehicle.'
                        : '🔒 £5,000 AutoCare Premium needs manager authorisation on every vehicle. Sell £3,000 as standard — tap £5,000 to request approval.'}
                    </p>
                  )}
                </div>

                {/* £5,000 claim limit — manager authorisation request */}
                <Dialog open={claimLimitAuthOpen} onOpenChange={setClaimLimitAuthOpen}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>£5,000 cover needs manager approval</DialogTitle>
                      <DialogDescription>
                        £5,000 per claim carries a lot more risk than £3,000 for only a few pounds a month, so it is
                        management-approved on every vehicle. Send the reason and you will get a green go-ahead banner
                        the moment it is authorised.
                      </DialogDescription>
                    </DialogHeader>
                    {claimLimitAuthSent ? (
                      <p className="text-sm font-medium text-emerald-700">
                        Request sent. Keep the customer on £3,000 until it is approved.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Why does this customer need £5,000?</Label>
                        <Textarea
                          rows={3}
                          value={claimLimitAuthReason}
                          onChange={(e) => setClaimLimitAuthReason(e.target.value)}
                          placeholder="e.g. high-value vehicle, customer specifically asked for the top tier, expensive parts"
                        />
                        {!regNumber.trim() && (
                          <p className="text-[11px] text-amber-700">Enter the registration first — approval is tied to the vehicle.</p>
                        )}
                      </div>
                    )}
                    <DialogFooter>
                      {claimLimitAuthSent ? (
                        <Button variant="outline" onClick={() => setClaimLimitAuthOpen(false)}>Close</Button>
                      ) : (
                        <Button
                          disabled={claimLimitAuthSubmitting || !claimLimitAuthReason.trim() || !regNumber.trim()}
                          onClick={async () => {
                            setClaimLimitAuthSubmitting(true);
                            try {
                              const { error } = await supabase.from('discount_auth_requests').insert({
                                request_type: 'claim_limit_5000',
                                requested_by_user_id: user?.id,
                                requested_by_name: user?.email || 'Agent',
                                registration_plate: regNumber.toUpperCase(),
                                mileage: mileage || (sliderMileage ? sliderMileage.toLocaleString() : null),
                                vehicle_description: vehicleData
                                  ? `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim() || null
                                  : null,
                                customer_name:
                                  [customerFirstName, customerLastName].filter(Boolean).join(' ') || customerName || null,
                                base_price: Math.round(basePrice.totalPrice),
                                requested_price: Math.round(basePrice.totalPrice),
                                payment_type: paymentType,
                                reason: claimLimitAuthReason.trim(),
                              });
                              if (error) throw error;
                              setClaimLimitAuthSent(true);
                              toast({
                                title: 'Sent for authorisation',
                                description: 'Management have been alerted. Stay on £3,000 until you get the go-ahead.',
                              });
                            } catch (e: any) {
                              toast({ title: 'Could not send request', description: e?.message || 'Please try again', variant: 'destructive' });
                            } finally {
                              setClaimLimitAuthSubmitting(false);
                            }
                          }}
                        >
                          {claimLimitAuthSubmitting ? 'Sending…' : 'Request approval'}
                        </Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>




                <div className="space-y-3">
                  <Label className="text-base font-semibold">Optional Add-ons</Label>
                  
                  {/* Auto-Included Add-ons Display */}
                  {getAutoIncludedAddOns(paymentType).length > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 text-green-700">
                        <span className="text-sm font-medium">✓ Included FREE with {termOptions.find(t => t.id === paymentType)?.label}:</span>
                        <div className="flex gap-2">
                          {getAutoIncludedAddOns(paymentType).includes('breakdown') && (
                            <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">Vehicle Recovery</Badge>
                          )}
                          {getAutoIncludedAddOns(paymentType).includes('rental') && (
                            <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">Hire Car</Badge>
                          )}
                          {getAutoIncludedAddOns(paymentType).includes('european') && (
                            <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">European Cover</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Selectable Add-ons Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {getAddOnInfo(paymentType, DURATION_MONTHS[paymentType])
                      .filter((addon) => !['motFee', 'lostKey', 'consequential', 'motRepair', 'wearAndTear'].includes(addon.key))
                      .filter((addon) => tyreCoverEnabled || addon.key !== 'tyre')
                      .map((addon) => {
                      const isAutoIncluded = addon.isAutoIncluded;
                      const isUnavailable = false;
                      const isSelected = !isUnavailable && (selectedAddOns[addon.key] || isAutoIncluded);
                      // Display monthly price like Step 3
                      const monthlyPriceDisplay = addon.oneTimePrice 
                        ? `£${addon.oneTimePrice} one-off` 
                        : `+£${addon.monthlyPrice}/mo`;
                      
                      return (
                        <button
                          key={addon.key}
                          onClick={() => !isAutoIncluded && !isUnavailable && handleToggleAddOn(addon.key)}
                          disabled={isAutoIncluded || isUnavailable}
                          className={cn(
                            "p-3 rounded-lg border-2 text-left transition-all relative",
                            isUnavailable
                              ? "border-border bg-muted opacity-50 cursor-not-allowed"
                              : isAutoIncluded 
                                ? "border-green-300 bg-green-50 cursor-default" 
                                : isSelected
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <span className={cn("font-medium text-sm", isUnavailable && "line-through text-muted-foreground")}>{addon.name}</span>
                              {addon.tooltipDetails && !isUnavailable && (
                                <div className="group relative">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-popover border border-border rounded-lg shadow-lg text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                    <p className="font-semibold text-foreground mb-1.5">{addon.name}</p>
                                    <ul className="space-y-1 text-muted-foreground">
                                      {addon.tooltipDetails.map((detail, idx) => (
                                        <li key={idx} className="flex items-start gap-1.5">
                                          <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                                          <span>{detail}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}
                            </div>
                            {isUnavailable ? (
                              <Badge variant="outline" className="text-[10px] bg-muted border-border text-muted-foreground">UNAVAILABLE</Badge>
                            ) : isAutoIncluded ? (
                              <Badge variant="outline" className="text-[10px] bg-green-100 border-green-300 text-green-700">FREE</Badge>
                            ) : (
                              <span className="text-xs font-medium text-primary">{monthlyPriceDisplay}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{addon.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>


                {/* Optional Extended Cover Option */}
                <div className={cn(
                  "rounded-xl border transition-all overflow-hidden",
                  freeExtendedCover !== 'none'
                    ? "border-emerald-400 bg-emerald-50/30 shadow-sm"
                    : "border-dashed border-gray-300 bg-gray-50/40"
                )}>
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          "w-7 h-7 shrink-0 rounded-lg flex items-center justify-center",
                          freeExtendedCover !== 'none' ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"
                        )}>
                          <Gift className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">Optional Extended Cover</div>
                          <p className="text-xs text-muted-foreground">
                            Use free months as a last resort, not a first offer.
                          </p>
                        </div>
                      </div>
                      {freeExtendedCover !== 'none' && (
                        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div className="leading-tight">
                            <div className="text-sm font-bold text-emerald-700">+{selectedBonusMonths} months active</div>
                            <div className="text-[10px] text-muted-foreground">Will show on quote &amp; email</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs mt-2">
                      <span className="font-semibold text-emerald-700">IMPORTANT:</span>{' '}
                      <span className="text-muted-foreground">Click a button below to add free months. This will update the customer's email and quote.</span>
                    </p>
                    <div className="mt-2">
                      <ConcessionAllowanceStrip adminUserId={currentAdminId} />
                    </div>
                  </div>

                  <div className="px-4 pb-3">
                    <div className="text-sm font-bold text-gray-900 mb-1">Choose how many free months to add</div>
                    <p className="text-xs text-muted-foreground mb-2">This will be added to the customer's quote and visible in their email.</p>
                    <div className="space-y-1.5">
                      {([
                        {
                          key: 'none' as const,
                          title: 'None',
                          subtitle: 'No free months',
                          pill: null as string | null,
                          pillTone: '',
                          chip: null as string | null,
                          blocked: false,
                          blockedLabel: '',
                          exhausted: false,
                          onSelect: () => {
                            setFreeExtendedCover('none');
                            setAdditionalNotes(prev => prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim());
                          },
                        },
                        {
                          key: 'peryear' as const,
                          title: '+1 Month per Year',
                          subtitle: `adds ${coverYears} month${coverYears === 1 ? '' : 's'} total`,
                          pill: `${remaining1mo} remaining`,
                          pillTone: remaining1mo <= 0 ? 'bg-red-100 text-red-700' : remaining1mo <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                          chip: 'Recommended',
                          blocked: false,
                          blockedLabel: '',
                          exhausted: !isManagement && !canUse1mo,
                          onSelect: () => {
                            if (freeExtendedCover !== 'peryear' && !isManagement && !canUse1mo) { toast({ title: '+1 month per year allowance used', description: `You have used ${used1mo} of ${allow1mo} +1 month-per-year concessions this month. Request a manager authorisation.`, variant: 'destructive' }); return; }
                            if (freeExtendedCover === 'peryear') {
                              setFreeExtendedCover('none');
                              setAdditionalNotes(prev => prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim());
                            } else {
                              setFreeExtendedCover('peryear');
                              setAdditionalNotes(prev => {
                                const cleaned = prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim();
                                return cleaned ? `${cleaned} | FREE EXTENDED COVER: ${coverYears} months` : `FREE EXTENDED COVER: ${coverYears} months`;
                              });
                            }
                          },
                        },
                        {
                          key: '3months' as const,
                          title: '+3 Months Free',
                          subtitle: 'Balanced option',
                          pill: `${remaining3mo} remaining`,
                          pillTone: remaining3mo <= 0 ? 'bg-red-100 text-red-700' : remaining3mo <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                          chip: null,
                          blocked: block3moFree,
                          blockedLabel: 'Blocked by manager',
                          exhausted: !isManagement && !canUse3mo,
                          onSelect: () => {
                            if (block3moFree) { toast({ title: 'Blocked by manager', description: '+3 months free is not available on your account.', variant: 'destructive' }); return; }
                            if (freeExtendedCover !== '3months' && !isManagement && !canUse3mo) { toast({ title: '+3 months free allowance used', description: `You have used ${used3mo} of ${allow3mo} +3 month concessions this month. Request a manager authorisation.`, variant: 'destructive' }); return; }
                            if (freeExtendedCover === '3months') {
                              setFreeExtendedCover('none');
                              setAdditionalNotes(prev => prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim());
                            } else {
                              setFreeExtendedCover('3months');
                              setAdditionalNotes(prev => {
                                const cleaned = prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim();
                                return cleaned ? `${cleaned} | FREE EXTENDED COVER: 3 months` : 'FREE EXTENDED COVER: 3 months';
                              });
                            }
                          },
                        },
                        {
                          key: '6months' as const,
                          title: '+6 Months Free',
                          subtitle: 'Use as a last resort',
                          pill: `${remaining6mo} remaining`,
                          pillTone: remaining6mo <= 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700',
                          chip: null,
                          blocked: block6moFree,
                          blockedLabel: 'Blocked by manager',
                          exhausted: !isManagement && !canUse6mo,
                          onSelect: () => {
                            if (block6moFree) { toast({ title: 'Blocked by manager', description: '+6 months free is not available on your account.', variant: 'destructive' }); return; }
                            if (freeExtendedCover !== '6months' && !isManagement && !canUse6mo) { toast({ title: '+6 months free allowance used', description: `You have used ${used6mo} of ${allow6mo} +6 month concessions this month. Request a manager authorisation.`, variant: 'destructive' }); return; }
                            if (freeExtendedCover === '6months') {
                              setFreeExtendedCover('none');
                              setAdditionalNotes(prev => prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim());
                            } else {
                              setFreeExtendedCover('6months');
                              setAdditionalNotes(prev => {
                                const cleaned = prev.replace(/\s*\|\s*FREE EXTENDED COVER: \d+ months\s*/g, '').replace(/^FREE EXTENDED COVER: \d+ months\s*\|?\s*/g, '').trim();
                                return cleaned ? `${cleaned} | FREE EXTENDED COVER: 6 months` : 'FREE EXTENDED COVER: 6 months';
                              });
                            }
                          },
                        },
                      ]).map((tile) => {
                        const selected = freeExtendedCover === tile.key;
                        const disabled = tile.blocked || (!selected && tile.exhausted);
                        return (
                          <button
                            key={tile.key}
                            onClick={tile.onSelect}
                            disabled={disabled}
                            title={tile.blocked ? tile.blockedLabel : disabled ? 'Allowance exhausted this month' : undefined}
                            className={cn(
                              "w-full relative flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-left transition-all",
                              selected
                                ? "border-emerald-500 bg-emerald-50/70 shadow-sm"
                                : "border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30",
                              disabled && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                selected ? "border-emerald-600" : "border-gray-300"
                              )}>
                                {selected && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-900">{tile.title}</span>
                                  {tile.chip && (
                                    <span className="rounded bg-emerald-100 px-1.5 py-0 text-[10px] font-bold text-emerald-700">
                                      {tile.chip}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {tile.blocked ? tile.blockedLabel : tile.subtitle}
                                </div>
                              </div>
                            </div>
                            {tile.pill && (
                              <span className={cn("rounded px-2 py-0.5 text-[11px] font-semibold", tile.pillTone)}>
                                {tile.pill}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {freeExtendedCover !== 'none' && (
                      <div className="mt-2 px-3 py-2 bg-emerald-100/70 rounded border border-emerald-300 text-xs text-emerald-900 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold">Customer will see +{selectedBonusMonths} FREE months</div>
                          <div className="text-[11px] text-emerald-800/80">This will appear on their quote page, welcome email and customer dashboard.</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>


                {/* Custom Pricing Override */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold text-gray-900">Custom Pricing</Label>
                    <p className="text-sm text-muted-foreground">
                      {isPriceOverridden
                        ? "Using custom price — edit fields or reset to calculated"
                        : "Auto-calculated based on selections — edit to override"}
                    </p>
                  </div>

                  {(() => {
                    /** Live discount readout so agents never hand-calculate a percentage. */
                    const pctOff = (custom: string, calculated: number) => {
                      const entered = parseFloat(String(custom).replace(/[^0-9.]/g, ''));
                      if (!Number.isFinite(entered) || entered <= 0 || !calculated) return null;
                      return Math.round(((calculated - entered) / calculated) * 1000) / 10;
                    };
                    const monthlyPct = pctOff(customMonthlyPrice, basePrice.monthlyPrice);
                    const totalPct = pctOff(customFullPrice, basePrice.totalPrice);
                    const headline = totalPct ?? monthlyPct;
                    const overCap = headline !== null && !priceMatchMode && headline > effectiveMaxDiscountPct;
                    const chip = (pct: number | null) => {
                      if (pct === null) return null;
                      const isDiscount = pct > 0;
                      const isUplift = pct < 0;
                      return (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
                            isDiscount
                              ? overCap
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isUplift
                                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                                : 'bg-gray-100 text-gray-700 border border-gray-300'
                          )}
                        >
                          {isDiscount ? `${pct}% off` : isUplift ? `${Math.abs(pct)}% above` : 'Same price'}
                        </span>
                      );
                    };
                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="custom-monthly" className="text-sm font-medium text-gray-700">Monthly Price (£)</Label>
                            <Input
                              id="custom-monthly"
                              type="text"
                              inputMode="numeric"
                              value={customMonthlyPrice}
                              onChange={(e) => handleCustomMonthlyChange(e.target.value)}
                              onFocus={(e) => e.target.select()}
                              placeholder="0"
                              className={cn(
                                "text-lg font-semibold py-5",
                                isPriceOverridden ? "border-amber-400 bg-amber-50/60" : "border-emerald-300 bg-emerald-50/40"
                              )}
                            />
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              <span>Calculated: £{basePrice.monthlyPrice}</span>
                              {isPriceOverridden && chip(monthlyPct)}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="custom-full" className="text-sm font-medium text-gray-700">Total Price (£)</Label>
                            <Input
                              id="custom-full"
                              type="text"
                              inputMode="numeric"
                              value={customFullPrice}
                              onChange={(e) => handleCustomFullChange(e.target.value)}
                              onFocus={(e) => e.target.select()}
                              placeholder="0"
                              className={cn(
                                "text-lg font-semibold py-5",
                                isPriceOverridden ? "border-amber-400 bg-amber-50/60" : "border-emerald-300 bg-emerald-50/40"
                              )}
                            />
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              <span>Calculated: £{basePrice.totalPrice}</span>
                              {isPriceOverridden && chip(totalPct)}
                            </p>
                          </div>
                        </div>

                        {isPriceOverridden && headline !== null && (
                          <div
                            className={cn(
                              'rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-3 flex-wrap',
                              headline > 0
                                ? overCap
                                  ? 'border-red-300 bg-red-50 text-red-900'
                                  : 'border-amber-300 bg-amber-50 text-amber-900'
                                : 'border-sky-300 bg-sky-50 text-sky-900'
                            )}
                          >
                            <span className="font-semibold">
                              {headline > 0
                                ? `You are giving ${headline}% off`
                                : headline < 0
                                  ? `This is ${Math.abs(headline)}% above the calculated price`
                                  : 'This matches the calculated price'}
                            </span>
                            <span className="text-xs">
                              £{basePrice.totalPrice} calculated → £{Math.round(parseFloat(String(customFullPrice).replace(/[^0-9.]/g, '')) || basePrice.totalPrice)} total
                              {!priceMatchMode && effectiveMaxDiscountPct < 100 && (
                                <> · your cap {effectiveMaxDiscountPct}%{overCap ? ' — over cap' : ''}</>
                              )}
                            </span>
                          </div>
                        )}

                        {isPriceOverridden && (
                          <p className="text-xs text-muted-foreground">
                            Your discount allowance is measured on the <strong>average across your sales</strong>, not
                            this single sale — one deal above your usual level is fine as long as your average stays
                            within your cap.
                          </p>
                        )}

                      </>
                    );
                  })()}


                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <Label className="text-sm font-semibold text-gray-900">Quick discounts</Label>
                        <p className="text-xs text-muted-foreground">
                          Applied to calculated total
                          {priceMatchMode ? (
                            <> · <span className="font-semibold text-sky-700">Price match active — any price allowed, maximum 10% cheaper than competitors</span></>
                          ) : (
                            <>
                              {effectiveMaxDiscountPct < 100 && (
                                <> · Your cap: <strong>{effectiveMaxDiscountPct}%</strong></>
                              )}
                              {effectiveMaxDiscountPct === 0 && ' · Discounts blocked'}
                              {blockedByCeiling && (
                                <> · <span className="font-semibold text-amber-700">Discounts above {DISCOUNT_CEILING_PCT}% need Management authorisation</span></>
                              )}
                            </>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Your cap is judged on your average discount across sales, not each individual sale.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setPriceMatchMode(!priceMatchMode)}
                          className={cn(
                            "text-xs font-semibold gap-1.5 text-white border",
                            priceMatchMode
                              ? "bg-sky-700 hover:bg-sky-800 border-sky-800 ring-2 ring-sky-300"
                              : "bg-sky-600 hover:bg-sky-700 border-sky-700"
                          )}
                          title="Price match a competitor quote (max 10% cheaper). Price matches are not counted as discounts given."
                        >
                          <Gauge className="w-3.5 h-3.5" />
                          {priceMatchMode ? 'Price match on' : 'Price match'}
                        </Button>
                        <Button
                          variant={depositMode ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDepositMode(!depositMode)}
                          className={cn(
                            "text-xs font-semibold gap-1.5",
                            depositMode && "bg-amber-600 hover:bg-amber-700 text-white border-amber-700"
                          )}
                          title="Take a deposit on Stripe now and tag the customer as Payment due"
                        >
                          <PoundSterling className="w-3.5 h-3.5" />
                          {depositMode ? 'Part payment on' : 'Part payment'}

                        </Button>
                        {isManagementRole && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDiscountCapManager(true)}
                            className="text-xs font-semibold gap-1.5"
                            title="Manager: set discount caps per agent"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Set agent caps
                          </Button>
                        )}
                        <Button
                          variant={isPriceOverridden ? "default" : "outline"}
                          size="sm"
                          onClick={resetToCalculatedPrice}
                          className="text-xs font-semibold gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reset Price
                        </Button>
                      </div>
                    </div>

                    {depositMode && (
                      <div className="space-y-3 p-4 rounded-lg border-2 border-amber-300 bg-amber-50/70">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-900 leading-relaxed">
                            <strong>Deposit on Stripe.</strong> Take a part payment now — the customer record is tagged
                            <strong> Payment due</strong> in Customer Management with the outstanding balance and your name,
                            so the remainder can be chased.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-amber-900">Deposit taken (£)</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={depositAmountInput}
                              onChange={(e) => setDepositAmountInput(e.target.value)}
                              placeholder="0"
                              className="bg-white border-amber-300"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-amber-900">Balance due date</Label>
                            <Input
                              type="date"
                              value={depositDueDate}
                              onChange={(e) => setDepositDueDate(e.target.value)}
                              className="bg-white border-amber-300"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-amber-900">Balance outstanding</Label>
                            <div className="h-10 flex items-center px-3 rounded-md border border-amber-300 bg-white text-sm font-bold text-amber-900">
                              £{Math.max(0, Math.round(((parseFloat(customFullPrice) || basePrice.totalPrice) || 0) - (depositAmountValue || 0)))}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-amber-900">
                          On confirming payment a <strong>Part Payment plan</strong> is opened automatically with this
                          deposit logged and a reminder banner for the balance.{' '}
                          <button
                            type="button"
                            className="font-semibold underline"
                            onClick={() => {
                              window.location.assign(
                                `/admin-dashboard/?tab=customers&pp=outstanding${customerEmail ? `&search=${encodeURIComponent(customerEmail)}` : ''}`,
                              );
                            }}
                          >
                            Open Part Payments
                          </button>

                        </p>
                      </div>

                    )}

                    {priceMatchMode && (
                      <div className="space-y-3 p-4 rounded-lg border-2 border-sky-300 bg-sky-50/70">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-sky-700 mt-0.5 shrink-0" />
                          <p className="text-xs text-sky-900 leading-relaxed">
                            <strong>Price match override on.</strong> You can set any price to match a competitor quote —
                            maximum <strong>10% cheaper than competitors</strong>. Upload the competitor evidence below;
                            it is saved to the customer record in Customer Management once the order is completed.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-sky-900">
                              Competitor & quoted price
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={priceMatchCompany}
                                onValueChange={(v) => {
                                  setPriceMatchCompany(v);
                                  applyPriceMatchCompetitor(v, v === 'Other' ? priceMatchOtherName : '', priceMatchPrice);
                                }}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Select competitor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRICE_MATCH_COMPETITORS.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={priceMatchPrice}
                                onChange={(e) => {
                                  setPriceMatchPrice(e.target.value);
                                  applyPriceMatchCompetitor(priceMatchCompany, priceMatchOtherName, e.target.value);
                                }}
                                placeholder="Their price £"
                                className="bg-white"
                              />
                            </div>
                            {priceMatchCompany === 'Other' && (
                              <Input
                                value={priceMatchOtherName}
                                onChange={(e) => {
                                  setPriceMatchOtherName(e.target.value);
                                  applyPriceMatchCompetitor('Other', e.target.value, priceMatchPrice);
                                }}
                                placeholder="Type the company name"
                                className="bg-white"
                              />
                            )}
                            {priceMatchCompetitor && (
                              <p className="text-[11px] text-sky-800 font-medium">{priceMatchCompetitor}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-sky-900">Price match evidence</Label>
                            <input
                              id="price-match-proof"
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handlePriceMatchUpload(f);
                                e.target.value = '';
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <label htmlFor="price-match-proof">
                                <Button asChild variant="outline" size="sm" disabled={priceMatchUploading} className="text-xs font-semibold gap-1.5 bg-white">
                                  <span>
                                    {priceMatchUploading
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <FileText className="w-3.5 h-3.5" />}
                                    {priceMatchProofPath ? 'Replace evidence' : 'Upload evidence'}
                                  </span>
                                </Button>
                              </label>
                              {priceMatchProofPath && (
                                <span className="text-xs font-medium text-emerald-700 truncate max-w-[180px]">
                                  ✓ {priceMatchProofName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {!priceMatchProofPath && (
                          <p className="text-xs font-semibold text-amber-700">
                            Evidence not uploaded yet — please attach the competitor quote before completing the order.
                          </p>
                        )}
                        {priceMatchFloor && (
                          <p className={cn(
                            "text-xs font-semibold",
                            parseFloat(customFullPrice) > 0 && parseFloat(customFullPrice) < priceMatchFloor
                              ? "text-rose-700"
                              : "text-sky-800"
                          )}>
                            Lowest allowed price (10% under £{priceMatchCompetitorPrice}): <strong>£{priceMatchFloor}</strong>
                            {parseFloat(customFullPrice) > 0 && parseFloat(customFullPrice) < priceMatchFloor
                              ? ` — current total £${Math.round(parseFloat(customFullPrice) || 0)} is too low`
                              : ''}
                          </p>
                        )}

                        {priceMatchFloor && (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900">
                              Update price match
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className={cn(
                                  "text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800",
                                  Math.round(parseFloat(customFullPrice) || 0) === priceMatchFloor && "ring-2 ring-sky-300"
                                )}
                                onClick={() => {
                                  handleCustomFullChange(String(priceMatchFloor));
                                  toast({
                                    title: `Beat ${priceMatchCompany || 'competitor'} by 10%`,
                                    description: `Total set to £${priceMatchFloor} (10% under £${priceMatchCompetitorPrice}).`,
                                  });
                                }}
                              >
                                Beat by 10% → £{priceMatchFloor}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className={cn(
                                  "text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700",
                                  Math.round(parseFloat(customFullPrice) || 0) === Math.round(priceMatchCompetitorPrice as number) && "ring-2 ring-sky-300"
                                )}
                                onClick={() => {
                                  const match = Math.round(priceMatchCompetitorPrice as number);
                                  handleCustomFullChange(String(match));
                                  toast({ title: 'Price matched', description: `Total set to £${match}.` });
                                }}
                              >
                                Match exactly → £{Math.round(priceMatchCompetitorPrice as number)}
                              </Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                                onClick={() => {
                                  const total = Math.round(parseFloat(customFullPrice) || 0);
                                  if (!total) {
                                    toast({
                                      title: 'Set a price first',
                                      description: 'Use "Beat by 10%" or "Match exactly", or type a total price.',
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                  if (priceMatchFloor && total < priceMatchFloor) {
                                    toast({
                                      title: 'Below price match limit',
                                      description: `Maximum 10% cheaper than competitors — the lowest allowed price is £${priceMatchFloor}.`,
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                  if (!priceMatchProofPath) {
                                    toast({
                                      title: 'Evidence required',
                                      description: 'Upload the competitor quote before saving the price match.',
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                  setPriceMatchSavedTotal(total);
                                  toast({
                                    title: 'Price match saved',
                                    description: `Total £${total} locked in. Continue with the quote.`,
                                  });
                                }}
                              >
                                <Save className="w-3.5 h-3.5" />
                                Save price match
                              </Button>
                              {priceMatchSavedTotal !== null && priceMatchSavedTotal === Math.round(parseFloat(customFullPrice) || 0) && (
                                <span className="text-[11px] font-semibold text-emerald-700">
                                  ✓ Saved · £{priceMatchSavedTotal}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-sky-800">
                              Once saved, the summary bar at the bottom shows the price match total so you can continue.
                              Price matches are logged as a price match, not as a discount given.
                            </p>
                          </div>
                        )}



                      </div>
                    )}


                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { label: '£25 off', type: 'fixed' as const, value: 25, pct: null },
                        { label: '£50 off', type: 'fixed' as const, value: 50, pct: null },
                        { label: '5% off', type: 'pct' as const, value: 0.05, pct: 5 },
                        { label: '10% off', type: 'pct' as const, value: 0.10, pct: 10 },
                        { label: '15% off', type: 'pct' as const, value: 0.15, pct: 15 },
                        { label: '20% off', type: 'pct' as const, value: 0.20, pct: 20 },
                        { label: '25% off', type: 'pct' as const, value: 0.25, pct: 25 },
                        { label: '30% off', type: 'pct' as const, value: 0.30, pct: 30 },
                      ].map((d) => {
                        const base = basePrice.totalPrice;
                        const discountAmount = d.type === 'fixed' ? d.value : Math.round(base * d.value);
                        const newTotal = Math.max(0, base - discountAmount);
                        const impliedPct = d.type === 'pct' ? (d.pct as number) : (base > 0 ? (discountAmount / base) * 100 : 0);
                        const overCap = impliedPct > effectiveMaxDiscountPct + 0.01;

                        const currentTotalNum = parseFloat(customFullPrice);
                        const isActive = !isNaN(currentTotalNum) && Math.abs(currentTotalNum - newTotal) < 0.5 && isPriceOverridden;
                        const disabled = base <= 0 || newTotal <= 0 || overCap;
                        return (
                          <button
                            key={d.label}
                            type="button"
                            disabled={disabled}
                            title={overCap ? (impliedPct > DISCOUNT_CEILING_PCT + 0.01 && !isManagementRole ? `Discounts above ${DISCOUNT_CEILING_PCT}% require authorisation from Management.` : `Your discount cap is ${effectiveMaxDiscountPct}%. Ask a manager to raise it.`) : undefined}
                            onClick={() => handleCustomFullChange(newTotal.toString())}
                            className={cn(
                              "py-3 px-3 rounded-lg border text-sm font-semibold transition-all",
                              isActive
                                ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                                : "border-gray-300 bg-slate-100 text-gray-800 hover:border-gray-900 hover:bg-slate-200",
                              disabled && "opacity-50 cursor-not-allowed hover:border-gray-300 hover:bg-slate-100"
                            )}
                          >
                            {d.label}
                            {overCap && <div className="text-[10px] font-normal opacity-70">{impliedPct > DISCOUNT_CEILING_PCT + 0.01 && !isManagementRole ? 'Needs authorisation' : 'Above cap'}</div>}
                          </button>
                        );
                      })}

                      {/* Over 30% — needs management authorisation (Ali or Kam) */}
                      <button
                        type="button"
                        title="Authorise with Ali or Kam"
                        onClick={() => setDiscountAuthOpen(true)}
                        className={cn(
                          "py-3 px-3 rounded-lg border-2 border-dashed text-sm font-semibold transition-all group",
                          discountAuthBy
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                            : "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        )}
                      >
                        Over 30%
                        <div className="text-[10px] font-normal opacity-80">
                          {discountAuthBy ? `Authorised by ${discountAuthBy}` : 'Authorise with Ali or Kam'}
                        </div>
                      </button>
                    </div>

                    {discountAuthBy && (
                      <div className="mt-2 flex items-center justify-between gap-3 p-3 rounded-lg border-2 border-emerald-300 bg-emerald-50">
                        <p className="text-xs text-emerald-900">
                          <strong>Discount authorised by {discountAuthBy}.</strong> The {DISCOUNT_CEILING_PCT}% ceiling is lifted for this quote
                          {discountAuthReason ? ` — ${discountAuthReason}` : ''}.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs bg-white"
                          onClick={() => { setDiscountAuthBy(null); setDiscountAuthReason(''); }}
                        >
                          Remove
                        </Button>
                      </div>
                    )}

                    {/* Management authorisation for discounts over the ceiling */}
                    <Dialog open={discountAuthOpen} onOpenChange={setDiscountAuthOpen}>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Discount over {DISCOUNT_CEILING_PCT}% — ask management</DialogTitle>
                          <DialogDescription>
                            {isManagementRole
                              ? 'Approve a lower price for this quote. Your name and the reason are saved on the customer record. Tip: if the agent is matching a competitor quote, they can already use the Price match button without asking — no approval needed.'
                              : 'Need a bigger discount for reasons other than a competitor quote? Send the details to management. They see your request at the top of their dashboard and you get a green "go ahead" banner the moment it is approved. Matching a competitor? Use the Price match button instead — no approval needed.'}
                          </DialogDescription>

                        </DialogHeader>

                        {reliabilityScore && (
                          <div className="rounded-md border bg-blue-50 p-2 text-xs text-blue-900">
                            <p className="font-semibold">
                              Vehicle reliability: {reliabilityScore.score}/100 ({reliabilityScore.tierLabel})
                            </p>
                            <p className="text-[11px] text-blue-700">
                              Use this as a guide — higher scores mean the vehicle is less likely to claim, so a bigger discount carries less risk.
                            </p>
                          </div>
                        )}

                        {isManagementRole ? (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Why are you allowing this lower price?</Label>
                            <p className="text-[11px] text-muted-foreground">This reason is saved to the customer record so there is always a clear justification for the reduction.</p>
                            <Textarea
                              value={discountAuthReason}
                              onChange={(e) => setDiscountAuthReason(e.target.value)}
                              placeholder="Example: Very low mileage for age (24,000 at 8 years), full service history, reliability score 70/100 checked"
                              rows={7}
                              className="min-h-[160px] text-sm"
                            />
                            <div className="text-[11px] text-muted-foreground space-y-1">
                              <p className="font-medium">Reasons like:</p>
                              <ul className="list-disc pl-4 space-y-0.5">
                                <li>Unusually low mileage</li>
                                <li>One owner with full service history</li>
                                <li>Customer can only afford monthly instalments</li>
                                <li>A payment or card issue we are working around</li>
                                <li>Goodwill after a service problem</li>
                                <li>A second vehicle in the same household</li>
                                <li>A long-standing renewing customer</li>
                              </ul>
                              <p>Not competitor pricing — that is Price match.</p>
                            </div>
                          </div>
                        ) : (

                          <div className="space-y-3">
                            <div className="rounded-md border bg-amber-50 p-2 text-xs text-amber-900">
                              <p className="font-semibold flex items-center gap-1"><Info className="h-3.5 w-3.5" /> Competitor quote? Use Price match</p>
                              <p className="text-[11px]">Matching a competitor does not need approval — use the <strong>Price match</strong> button and go up to 10% cheaper with evidence. Ask management only for vehicle or customer reasons.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-md border bg-muted/40 p-2">
                                <p className="text-muted-foreground">Registration</p>
                                <p className="font-bold">{regNumber ? regNumber.toUpperCase() : '—'}</p>
                              </div>
                              <div className="rounded-md border bg-muted/40 p-2">
                                <p className="text-muted-foreground">Mileage</p>
                                <p className="font-bold">{mileage || (sliderMileage ? sliderMileage.toLocaleString() : '—')}</p>
                              </div>
                            </div>
                            {reliabilityScore && (
                              <div className="rounded-md border bg-blue-50 p-2 text-xs text-blue-900">
                                <p className="font-semibold">Vehicle reliability: {reliabilityScore.score}/100 ({reliabilityScore.tierLabel})</p>
                                <p className="text-[11px] text-blue-700">Use this as a guide — higher scores mean the vehicle is less likely to claim, so a bigger discount carries less risk.</p>
                              </div>
                            )}

                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Price you need (total £)</Label>
                              <Input
                                type="number"
                                value={discountAuthRequestPrice}
                                onChange={(e) => setDiscountAuthRequestPrice(e.target.value)}
                                placeholder={basePrice.totalPrice ? String(Math.round(basePrice.totalPrice * 0.55)) : ''}
                              />
                              <p className="text-[11px] text-muted-foreground">
                                Normal price £{Math.round(basePrice.totalPrice)}
                                {(() => {
                                  const want = parseFloat(discountAuthRequestPrice);
                                  if (!Number.isFinite(want) || want <= 0 || basePrice.totalPrice <= 0) return '';
                                  const pct = ((basePrice.totalPrice - want) / basePrice.totalPrice) * 100;
                                  return ` — that is ${pct.toFixed(0)}% off`;
                                })()}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">What is the reason for the lower price? (not a competitor quote)</Label>
                              <Textarea
                                value={discountAuthReason}
                                onChange={(e) => setDiscountAuthReason(e.target.value)}
                                placeholder="Example: 24,000 miles at 8 years old, full service history, reliability score checked, customer buying today"
                                rows={7}
                                className="min-h-[160px] text-sm"
                              />
                              <div className="text-[11px] text-muted-foreground space-y-1">
                                <p className="font-medium">Good examples:</p>
                                <ul className="list-disc pl-4 space-y-0.5">
                                  <li>Unusually low mileage for the age</li>
                                  <li>One owner with full service history</li>
                                  <li>Customer can only stretch to monthly instalments</li>
                                  <li>A card or payment issue we are working around</li>
                                  <li>Goodwill after a problem with their claim or service</li>
                                  <li>Second vehicle in the same household</li>
                                  <li>A loyal renewing customer</li>
                                </ul>
                                <p>Not competitor pricing — that is Price match.</p>
                              </div>


                            </div>
                            {discountAuthRequestSent && (
                              <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                                <p className="font-semibold">Request sent to management.</p>
                                <p>Keep this quote open — a green go-ahead banner appears at the top once it is authorised.</p>
                              </div>
                            )}
                          </div>
                        )}

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDiscountAuthOpen(false)}>Cancel</Button>
                          {isManagementRole ? (
                            <Button
                              disabled={!discountAuthReason.trim()}
                              onClick={() => {
                                setDiscountAuthBy(user?.email || 'Management');
                                setDiscountAuthOpen(false);
                                toast({ title: 'Discount authorised', description: 'You can now set any price on this quote.' });
                              }}
                            >
                              Authorise lower price
                            </Button>
                          ) : (
                            <Button
                              disabled={
                                discountAuthSubmitting ||
                                !discountAuthReason.trim() ||
                                !regNumber.trim() ||
                                !(parseFloat(discountAuthRequestPrice) > 0)
                              }
                              onClick={async () => {
                                setDiscountAuthSubmitting(true);
                                try {
                                  const want = parseFloat(discountAuthRequestPrice);
                                  const pct = basePrice.totalPrice > 0
                                    ? ((basePrice.totalPrice - want) / basePrice.totalPrice) * 100
                                    : null;
                                  const { error } = await supabase.from('discount_auth_requests').insert({
                                    requested_by_user_id: user?.id,
                                    requested_by_name: user?.email || 'Agent',
                                    registration_plate: regNumber.toUpperCase(),
                                    mileage: mileage || (sliderMileage ? sliderMileage.toLocaleString() : null),
                                    vehicle_description: [
                                      vehicleData ? `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim() : '',
                                      reliabilityScore ? `Reliability ${reliabilityScore.score}/100 (${reliabilityScore.tierLabel})` : '',
                                    ].filter(Boolean).join(' — ') || null,
                                    customer_name: [customerFirstName, customerLastName].filter(Boolean).join(' ') || customerName || null,
                                    base_price: Math.round(basePrice.totalPrice),
                                    requested_price: want,
                                    discount_pct: pct != null ? Number(pct.toFixed(1)) : null,
                                    payment_type: paymentType,
                                    reason: discountAuthReason.trim(),
                                  });
                                  if (error) throw error;
                                  setDiscountAuthRequestSent(true);
                                  toast({
                                    title: 'Sent for authorisation',
                                    description: 'Management have been alerted. You will get a go-ahead banner once approved.',
                                  });
                                } catch (e: any) {
                                  toast({ title: 'Could not send request', description: e?.message || 'Please try again', variant: 'destructive' });
                                } finally {
                                  setDiscountAuthSubmitting(false);
                                }
                              }}
                            >
                              {discountAuthSubmitting ? 'Sending…' : 'Request authorisation'}
                            </Button>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>




                  </div>

                  {/* Discount Floor Warning — uses the agent's cap */}
                  {(() => {
                    const capFraction = Math.max(0, Math.min(1, effectiveMaxDiscountPct / 100));
                    const monthlyVal = parseFloat(customMonthlyPrice);
                    const fullVal = parseFloat(customFullPrice);
                    const monthlyFloor = basePrice.monthlyPrice * (1 - capFraction);
                    const fullFloor = basePrice.totalPrice * (1 - capFraction);
                    const monthlyBelow = !isNaN(monthlyVal) && monthlyVal > 0 && monthlyVal < monthlyFloor;
                    const fullBelow = !isNaN(fullVal) && fullVal > 0 && fullVal < fullFloor;
                    if (!isPriceOverridden || (!monthlyBelow && !fullBelow)) return null;
                    return (
                      <div
                        className="flex items-start gap-3 p-4 rounded-lg border-2"
                        style={{ backgroundColor: '#FFF1F2', borderColor: '#FF5A5F' }}
                      >
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: '#FF5A5F' }}
                        >
                          <X className="w-5 h-5 text-white" strokeWidth={3} />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="font-semibold text-sm" style={{ color: '#FF5A5F' }}>
                            This price is below your {effectiveMaxDiscountPct}% discount cap
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {blockedByCeiling
                              ? `Discounts above ${DISCOUNT_CEILING_PCT}% require authorisation from Management. Please ask a manager to approve and apply the discount on your behalf.`
                              : `Your manager has set your maximum discount to ${effectiveMaxDiscountPct}%. If this is a price match with evidence on file, or has been authorised by a manager, please raise the price or ask a manager to increase your cap.`}
                          </p>
                        </div>
                      </div>
                    );
                  })()}


                  {/* Pay in Full Discount Toggle */}
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 p-4 border rounded-lg transition-colors",
                      includePayInFullDiscount
                        ? "bg-emerald-600 border-emerald-700 text-white"
                        : "bg-amber-50/70 border-amber-200"
                    )}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <Label className={cn(
                        "text-sm font-semibold",
                        includePayInFullDiscount ? "text-white" : "text-amber-900"
                      )}>
                        Include 10% Pay in Full Discount
                      </Label>
                      <p className={cn(
                        "text-xs",
                        includePayInFullDiscount ? "text-white/90" : "text-amber-700"
                      )}>
                        {includePayInFullDiscount
                          ? `Discount applied: £${Math.floor(currentPrice.totalPrice * 0.1)} off`
                          : "Toggle ON to offer 10% off for upfront payment via Stripe"}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={includePayInFullDiscount}
                      onClick={() => setIncludePayInFullDiscount(!includePayInFullDiscount)}
                      className={cn(
                        "relative inline-flex h-12 w-24 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2",
                        includePayInFullDiscount
                          ? "bg-white border-white focus-visible:ring-white/50"
                          : "bg-gray-300 border-gray-400 focus-visible:ring-amber-400"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute text-xs font-bold tracking-wider select-none pointer-events-none",
                          includePayInFullDiscount ? "left-3 text-emerald-700" : "right-2.5 text-gray-700"
                        )}
                      >
                        {includePayInFullDiscount ? "ON" : "OFF"}
                      </span>
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-9 w-9 transform rounded-full shadow-lg ring-0 transition-transform",
                          includePayInFullDiscount
                            ? "translate-x-[52px] bg-emerald-600"
                            : "translate-x-1 bg-white"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Warranty Start Date (optional — pre-fills the customer's preview quote) */}
                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <CalendarIcon className="w-4 h-4" />
                      Warranty Start Date <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <span className="text-xs text-muted-foreground">Pre-fills on the customer's quote page</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWarrantyStartDate(new Date())}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-left",
                        isToday(warrantyStartDate)
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <CheckCircle2 className={cn(
                        "w-4 h-4 flex-shrink-0",
                        isToday(warrantyStartDate) ? "text-green-600" : "text-gray-400"
                      )} />
                      <div>
                        <span className="font-medium text-sm">Start Today</span>
                        <p className="text-xs text-muted-foreground">{format(new Date(), 'd MMM yyyy')}</p>
                      </div>
                    </button>

                    <Popover open={isStartDateCalendarOpen} onOpenChange={setIsStartDateCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-left",
                            !isToday(warrantyStartDate)
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          )}
                        >
                          <CalendarIcon className={cn(
                            "w-4 h-4 flex-shrink-0",
                            !isToday(warrantyStartDate) ? "text-green-600" : "text-gray-400"
                          )} />
                          <div>
                            <span className="font-medium text-sm">
                              {!isToday(warrantyStartDate) ? format(warrantyStartDate, 'd MMM yyyy') : 'Future Date'}
                            </span>
                            <p className="text-xs text-muted-foreground">Select from calendar</p>
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
                        <CalendarComponent
                          mode="single"
                          selected={warrantyStartDate}
                          onSelect={(date) => {
                            if (date) {
                              setWarrantyStartDate(date);
                              setIsStartDateCalendarOpen(false);
                            }
                          }}
                          disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {!isToday(warrantyStartDate) && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-800">
                          Cover will activate on <span className="font-semibold">{format(warrantyStartDate, 'd MMMM yyyy')}</span>. Payment is still processed today.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sticky Price Summary Bar */}
                {(() => {
                  const durationMonths = DURATION_MONTHS[paymentType] || 12;
                  const totalCoverDays = Math.round((durationMonths / 12) * 365);
                  const monthlyTotal = displayedTotalPrice;
                  const monthlyPence = monthlyTotal > 0 && totalCoverDays > 0
                    ? Math.round((monthlyTotal * 100) / totalCoverDays) : 0;
                  const fullPence = currentPrice.payInFullPrice > 0 && totalCoverDays > 0
                    ? Math.round((currentPrice.payInFullPrice * 100) / totalCoverDays) : 0;
                  const fmtPerDay = (p: number) => p >= 100 ? `£${(p / 100).toFixed(2)}/day` : `${p}p/day`;
                  const gridTotal = displayedTotalPrice;
                  // Web price always follows the UNDISCOUNTED grid price — agent
                  // discounts / overrides on this page never change the online price.
                  const undiscountedGridTotal =
                    Math.ceil(Number(basePrice.monthlyPrice || 0) * 12) || Number(basePrice.totalPrice || 0);
                  const web = getWebReferencePrice(undiscountedGridTotal);
                  return (
                <>
                {/* Spacer so the fixed bar never covers the content below */}
                <div aria-hidden className="h-[150px] sm:h-[130px]" />
                <div className="fixed bottom-0 left-0 right-0 z-40 px-4 sm:px-6 pb-2 pointer-events-none">
                  <div className="mx-auto w-full max-w-6xl pointer-events-auto px-5 py-3 bg-white rounded-xl shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.2)] border border-gray-200 border-t-4 border-t-emerald-400 max-h-[45vh] overflow-y-auto">

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-center gap-4 sm:divide-x sm:divide-gray-200">

                    <div className="text-center sm:px-4">
                      <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Monthly · Bumper (12)</div>
                      <div className="text-2xl font-bold text-blue-700 leading-tight mt-0.5">£{currentPrice.monthlyPrice}<span className="text-sm font-medium text-blue-600">/month</span></div>
                      <div className="text-xs text-blue-600 mt-0.5">Equal to just {fmtPerDay(monthlyPence)} over cover period</div>
                      <div className="text-xs font-semibold text-blue-700 mt-1">Total you pay £{monthlyTotal} <span className="font-normal text-blue-600">(12 × £{currentPrice.monthlyPrice})</span></div>
                    </div>
                    <div className="text-center sm:px-4">
                      <div className="text-xs text-emerald-600 font-medium uppercase tracking-wide">
                        Pay in Full · Stripe {includePayInFullDiscount && <span className="text-emerald-700 normal-case">(10% off)</span>}
                      </div>
                      <div className="text-2xl font-bold text-emerald-700 leading-tight mt-0.5">
                        £{currentPrice.payInFullPrice}
                        {includePayInFullDiscount && (
                          <span className="text-xs text-emerald-600 ml-2 font-semibold">Save £{Math.floor(currentPrice.totalPrice * 0.1)}</span>
                        )}
                      </div>
                      <div className="text-xs text-emerald-600 mt-0.5">Equal to just {fmtPerDay(fullPence)} over cover period</div>
                      {currentPrice.payInFullPrice > 0 && monthlyTotal > currentPrice.payInFullPrice && (
                        <div className="text-xs font-semibold text-emerald-700 mt-1">
                          £{monthlyTotal - currentPrice.payInFullPrice} cheaper than monthly
                        </div>
                      )}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={includePayInFullDiscount}
                        aria-label="Apply 10% pay in full discount"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIncludePayInFullDiscount(v => !v); }}
                        className={cn(
                          "mt-3 inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-full border-2 shadow-sm cursor-pointer select-none transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                          includePayInFullDiscount
                            ? "bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500"
                            : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200 hover:border-gray-400 focus-visible:ring-gray-400"
                        )}
                      >
                        <span className={cn(
                          "inline-block w-9 h-5 rounded-full transition-colors relative shrink-0",
                          includePayInFullDiscount ? "bg-emerald-800" : "bg-gray-400"
                        )}>
                          <span className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                            includePayInFullDiscount ? "translate-x-4.5" : "translate-x-0.5"
                          )} style={{ transform: includePayInFullDiscount ? 'translateX(18px)' : 'translateX(2px)' }} />
                        </span>
                        {includePayInFullDiscount ? (
                          <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> 10% off applied</span>
                        ) : (
                          <span>optional · apply 10% off</span>
                        )}
                      </button>

                    </div>

                    <div
                      className="text-center sm:px-4"
                      title={`Online website price for this exact cover: £${web.price}. That is ${web.discountPct}% below the undiscounted grid price of £${undiscountedGridTotal} (capped at ${MAX_WEB_DISCOUNT_VS_GRID_PCT}%). Agent discounts on this page do not change the online price.`}
                    >
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center justify-center gap-1">
                        Web price <Info className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="text-2xl font-bold text-gray-700 leading-tight mt-0.5">£{web.price}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {web.discountPct}% below grid · unaffected by agent discounts
                      </div>
                    </div>
                    <div className="text-center sm:text-left sm:px-4 text-sm">
                      <div className="font-semibold text-gray-900">Total £{gridTotal}</div>
                      {priceMatchMode && priceMatchCompetitorPrice && (
                        <div className="text-xs font-semibold text-sky-700 mt-0.5">
                          Price matched vs {priceMatchCompany === 'Other' ? (priceMatchOtherName || 'competitor') : (priceMatchCompany || 'competitor')} £{Math.round(priceMatchCompetitorPrice)}
                          {priceMatchSavedTotal !== null && priceMatchSavedTotal === displayedTotalPrice ? (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                              ✓ Saved £{priceMatchSavedTotal}
                            </span>
                          ) : (
                            <span className="ml-1.5 text-[10px] font-bold text-amber-700">Not saved yet</span>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-gray-600 mt-0.5">Claim £{(boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit)).toLocaleString()} · Labour £{labourRate}/hr</div>
                      <div className="text-xs text-gray-500 mt-0.5">Over {durationMonths} months</div>
                    </div>
                  </div>
                  </div>
                </div>
                </>
                   );
                })()}

                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={() => {
                      // Save quote data to localStorage for later
                      const savedQuote = {
                        vehicleData,
                        customerName,
                        customerEmail,
                        customerPhone,
                        paymentType,
                        excessAmount,
                        claimLimit,
                        labourRate,
                        boostAddon,
                        selectedAddOns,
                        currentPrice,
                        freeExtendedCover,
                        additionalNotes,
                        savedAt: new Date().toISOString()
                      };
                      const savedQuotes = JSON.parse(localStorage.getItem('admin_saved_quotes') || '[]');
                      savedQuotes.unshift(savedQuote);
                      localStorage.setItem('admin_saved_quotes', JSON.stringify(savedQuotes.slice(0, 50)));
                      toast({
                        title: "Quote saved",
                        description: "Quote saved for later. You can find it in your saved quotes.",
                      });
                    }}
                    className="flex-1 bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Quote
                  </Button>
                  <Button 
                    onClick={handleCalculateQuote}
                    className="flex-1"
                  >
                    Preview Quote
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Choose Action */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Step 3: Complete Order</CardTitle>
                    <CardDescription>
                      Choose to send a quote or confirm payment received elsewhere
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setVehicleData(null);
                        setRegNumber('');
                        setMileage('');
                        setSliderMileage(0);
                        setQuoteGenerated(false);
                        setQuoteLink(null);
                        setStep(1);
                      }}
                      className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Edit Vehicle
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setQuoteGenerated(false);
                        setQuoteLink(null);
                        setStep(2);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ← Back
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Quote Summary */}
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Order Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Customer:</strong> {customerName}</p>
                    <p><strong>Email:</strong> {customerEmail}</p>
                    <p><strong>Vehicle:</strong> {vehicleData?.make} {vehicleData?.model} ({vehicleData?.year})</p>
                    <p><strong>Registration:</strong> {vehicleData?.regNumber}</p>
                    <p><strong>Mileage:</strong> {parseInt(vehicleData?.mileage || '0').toLocaleString()} miles</p>
                    <p><strong>Duration:</strong> {termOptions.find(t => t.id === paymentType)?.label}{freeExtendedCover !== 'none' && <span className="ml-1 text-green-600 font-semibold">+ {selectedBonusMonths} months FREE</span>}</p>
                    <p><strong>Excess:</strong> £{excessAmount}</p>
                    <p><strong>Claim Limit:</strong> £{(boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit)).toLocaleString()}{boostAddon ? ' (boost)' : ''}</p>
                    <p><strong>Labour Rate:</strong> £{labourRate}/hr</p>
                    <p><strong>Total Price:</strong> £{currentPrice.monthlyPrice * 12}</p>
                    {additionalNotes && <p className="col-span-2"><strong>Notes:</strong> {additionalNotes}</p>}
                  </div>
                  {freeExtendedCover !== 'none' && (
                    <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded-md">
                      <p className="text-sm text-green-800 font-medium">🎁 Customer will receive {selectedBonusMonths} FREE bonus months on their cover</p>
                    </div>
                  )}
                </div>

                {/* Two Action Cards */}
                <div className="grid md:grid-cols-2 gap-4">

                  {/* Option 1: Stripe Pay Link */}
                  <div className="p-5 rounded-lg border-2 border-orange-200 bg-orange-50/60 space-y-4">
                    <div className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-orange-600" />
                      <h4 className="font-semibold text-black">Send Quote to Customer</h4>
                    </div>
                    <p className="text-sm text-black/80">
                      Customer will receive a link to complete payment via Stripe (pay in full) or Bumper (monthly).
                    </p>
                    <div className="flex gap-2 text-sm">
                      <span className="px-2 py-1 rounded bg-white text-black border border-orange-200">£{currentPrice.monthlyPrice}/mo</span>
                      <span className="px-2 py-1 rounded bg-orange-100 text-black border border-orange-200">£{currentPrice.payInFullPrice || Math.ceil(currentPrice.totalPrice * 0.9)} upfront</span>
                    </div>
                    
                    {isGeneratingQuoteLink ? (
                      <div className="flex items-center gap-2 text-orange-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Generating quote link...</span>
                      </div>
                    ) : quoteLink ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            onClick={handleCopyQuoteLink}
                            size="sm"
                            variant="outline"
                            className="flex-1 bg-white hover:bg-orange-50 border-orange-200 text-black"
                          >
                            📋 Copy Link
                          </Button>
                          <Button
                            onClick={() => window.open(quoteLink, '_blank')}
                            size="sm"
                            variant="outline"
                            title="Open quote page"
                            className="bg-white hover:bg-orange-50 border-orange-200 text-black"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button 
                          onClick={() => window.open(quoteLink, '_blank')}
                          variant="outline"
                          className="w-full border-orange-300 text-black hover:bg-orange-50"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Preview Quote
                        </Button>
                        <Button 
                          onClick={handlePreviewEmail}
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email Quote
                        </Button>
                        <Button
                          type="button"
                          onClick={handleSendSelfCopy}
                          disabled={isSendingSelfCopy || isSendingEmail || !quoteLink}
                          variant="secondary"
                          className="w-full bg-white hover:bg-orange-50 text-black border border-orange-200"
                        >
                          {isSendingSelfCopy ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending copy…</>
                          ) : (
                            <><Mail className="w-4 h-4 mr-2" />Send me a copy</>
                          )}
                        </Button>
                        <Button 
                          onClick={() => {
                            const message = `Hi ${customerName?.split(' ')[0] || 'there'},\n\nYour warranty quote for ${vehicleData?.make} ${vehicleData?.model} (${vehicleData?.regNumber}) is ready!\n\n💰 £${currentPrice.monthlyPrice}/month via Bumper\n💳 £${currentPrice.payInFullPrice || Math.ceil(currentPrice.totalPrice * 0.9)} pay in full (10% off)\n\n🔗 Complete your purchase: ${quoteLink}\n\nBuyawarranty Customer Care\n📞 0330 229 5040`;
                            const encodedMessage = encodeURIComponent(message);
                            window.open(`https://api.whatsapp.com/send?text=${encodedMessage}`, '_blank');
                          }}
                          variant="outline"
                          className="w-full border-green-500 text-green-600 hover:bg-green-50"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          WhatsApp
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={handleRetryQuoteLink} variant="outline" size="sm" className="bg-white hover:bg-orange-50 text-black border-orange-200">
                        Retry Link Generation
                      </Button>
                    )}
                  </div>

                  {/* Option 2: Confirm External Payment */}
                  <div className="p-5 rounded-lg border-2 border-green-200 bg-green-50/50 space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-green-900">Confirm External Payment</h4>
                    </div>
                    <p className="text-sm text-green-700">
                      Use this if payment was taken via phone, bank transfer, or another portal.
                    </p>
                    <p className="text-xs text-green-600 italic">
                      This creates the warranty, customer login, and sends welcome email.
                    </p>
                    
                    <Button 
                      onClick={handleOpenConfirmPaymentDialog}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm External Payment...
                    </Button>
                  </div>
                </div>

                {/* Payment links (collapsible): Stripe + Payment Assist + Worldpay */}
                <details className="group rounded-lg border-2 border-slate-200 bg-white overflow-hidden">
                  <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 list-none [&::-webkit-details-marker]:hidden">
                    <LinkIcon className="w-4 h-4 text-slate-600" />
                    <h3 className="font-semibold text-slate-800 text-base">Payment links</h3>
                    <span className="ml-2 text-xs text-slate-500">
                    <span className="text-orange-600 font-medium">Stripe</span>
                      <span className="mx-1">·</span>
                      Payment Assist
                      <span className="mx-1">·</span>
                      <span className="text-teal-600 font-medium">Bumper</span>
                      <span className="mx-1">·</span>
                      Worldpay
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-500 ml-auto transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="p-4 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <PaymentAssistPanel
                      amountPounds={currentPrice.payInFullPrice || Math.ceil(currentPrice.totalPrice * 0.9)}
                      description={`Vehicle warranty${customerFirstName ? ` — ${customerFirstName} ${customerLastName}`.trim() : ''}`}
                      salesLeadId={selectedLeadId}
                      customerEmail={customerEmail}
                      customerPhone={editableCustomerPhone || customerPhone}
                      customerFirstName={customerFirstName}
                      customerLastName={customerLastName}
                      customerPostcode={customerPostcode}
                      customerAddressLine1={[customerBuildingNumber, customerStreet].filter(Boolean).join(' ').trim()}
                      vehicleReg={vehicleData?.regNumber}
                    />

                    <BumperPaymentPanel
                      amountPounds={currentPrice.payInFullPrice || Math.ceil(currentPrice.totalPrice * 0.9)}
                      description={`Vehicle warranty${customerFirstName ? ` — ${customerFirstName} ${customerLastName}`.trim() : ''}`}
                      salesLeadId={selectedLeadId}
                      customerEmail={customerEmail}
                      customerPhone={editableCustomerPhone || customerPhone}
                      customerFirstName={customerFirstName}
                      customerLastName={customerLastName}
                      customerPostcode={customerPostcode}
                      customerAddressLine1={[customerBuildingNumber, customerStreet].filter(Boolean).join(' ').trim()}
                      vehicleReg={vehicleData?.regNumber}
                    />


                    {/* Worldpay — temporarily disabled */}
                    <div className="p-5 rounded-lg border-2 border-slate-200 bg-slate-50/60 space-y-3 opacity-80">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-slate-500" />
                        <h4 className="font-semibold text-slate-700">Worldpay</h4>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Coming soon
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Virtual Terminal and Pay by Link — integration in progress.
                      </p>
                      <Button disabled className="w-full">
                        Coming soon
                      </Button>
                    </div>
                  </div>
                </details>

                {adminEmail && (
                  <div className="text-sm text-muted-foreground text-center">
                    ✉️ You'll get the same quote email at: {adminEmail}
                  </div>
                )}

                <Button 
                  variant="outline"
                  onClick={() => {
                    setQuoteGenerated(false);
                    setQuoteLink(null);
                    setStep(2);
                  }}
                  className="w-full"
                >
                  ← Back to Edit Details
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Email Preview Dialog */}
          <Dialog open={showEmailDialog} onOpenChange={(open) => {
            setShowEmailDialog(open);
            if (!open) {
              // Closing the preview dialog should NOT wipe the whole quote —
              // agents lose vehicle/customer/plan details if we reset here.
              // Only clear the transient "sent" flags so re-opening starts clean.
              setQuoteSent(false);
              setSelfCopySent(false);
              setLastSendPayload(null);
            }
          }}>
            <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0 gap-0">
              <DialogHeader className="px-6 py-5 border-b bg-muted/30 pr-14">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Send className="w-5 h-5 text-primary" />
                  3. Review and send quote
                </DialogTitle>
                <DialogDescription>
                  Check the recipient, open the quote link if needed, then send the email.
                </DialogDescription>

              </DialogHeader>
              
              <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] overflow-y-auto max-h-[calc(92vh-154px)]">
                <div className="bg-muted/50 p-5 md:p-6">
                  <div className="mx-auto max-w-[560px] overflow-hidden rounded-xl border bg-background shadow-sm">
                    <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="w-4 h-4 text-primary" />
                        Email preview
                      </div>
                      <Badge variant="secondary">Customer view</Badge>
                    </div>
                    <div className="p-5 bg-background">
                      <div className="text-center mb-5">
                        <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" className="h-10 mx-auto mb-3" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Warranty quote ready</p>
                        <h2 className="text-xl font-bold text-foreground mt-1">
                          {vehicleData?.make || 'Vehicle'} {vehicleData?.model || ''} · Platinum cover
                        </h2>
                      </div>

                      <p className="text-sm text-foreground mb-1">Hi {customerName?.split(' ')[0] || 'there'},</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Your personalised warranty quote is ready. The customer can choose monthly or pay in full from the secure quote page.
                      </p>

                      <div className="rounded-lg border bg-muted/30 p-4 mb-4 text-sm">
                        <div className="flex items-center justify-between pb-2 border-b">
                          <span className="text-muted-foreground">Vehicle</span>
                          <span className="font-semibold text-right">{vehicleData?.make} {vehicleData?.model} ({vehicleData?.regNumber})</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-muted-foreground">Cover period</span>
                          <span className="font-semibold">{(() => { const m = termOptions.find(t => t.id === paymentType)?.months || 0; const y = m / 12; return `${y} ${y === 1 ? 'year' : 'years'}`; })()}{freeExtendedCover !== 'none' ? ` + ${selectedBonusMonths} months free` : ''}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-muted-foreground">Claim limit</span>
                          <span className="font-semibold">£{(boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit)).toLocaleString()} per claim</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-muted-foreground">Excess</span>
                          <span className="font-semibold">£{excessAmount}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-muted-foreground">Labour rate</span>
                          <span className="font-semibold">Up to £{labourRate}/hr</span>
                        </div>
                        <div className="flex items-center justify-between pt-3">
                          <span className="font-semibold">Customer price</span>
                          <span className="text-xl font-bold text-primary">£{currentPrice.monthlyPrice}/mo</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => quoteLink && window.open(quoteLink, '_blank', 'noopener,noreferrer')}
                        disabled={!quoteLink}
                        className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Choose how to pay and activate my warranty
                      </button>
                      <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-start gap-2">
                          <LinkIcon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">Button opens this quote page</p>
                            {quoteLink ? (
                              <a href={quoteLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">
                                {quoteLink}
                              </a>
                            ) : (
                              <p className="text-xs text-muted-foreground">Quote link is still generating.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 md:p-6 space-y-5 bg-background border-l">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Mail className="w-4 h-4" />
                      Customer email
                    </Label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
                      className="h-11"
                    />
                    {customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) && (
                      <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="w-3 h-3" /> This email address looks invalid.</p>
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Copy className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Internal copies</p>
                        <p className="text-xs text-muted-foreground">Copies are sent as separate emails, not CC/BCC, so staff addresses are private and easier to deliver.</p>
                      </div>
                    </div>
                    {adminEmail && adminEmail !== customerEmail && (
                      <div className="rounded-md border bg-background px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Your copy:</span>{' '}
                        <span className="font-medium">{adminName ? `${adminName} (${adminEmail})` : adminEmail}</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Additional internal copy recipients</Label>
                      {additionalEmails.map((email, index) => (
                        <div key={index} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                          <span className="flex-1 truncate">{email}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setAdditionalEmails(prev => prev.filter((_, i) => i !== index))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Input
                        type="email"
                        placeholder="Add internal copy email..."
                        value={newEmailInput}
                        onChange={(e) => {
                          setNewEmailInput(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                            e.preventDefault();
                            const email = newEmailInput.trim().replace(/,+$/, '');
                            if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !additionalEmails.includes(email)) {
                              setAdditionalEmails(prev => [...prev, email]);
                              setNewEmailInput('');
                            }
                          }
                        }}
                        onBlur={() => {
                          const email = newEmailInput.trim().replace(/,+$/, '');
                          if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !additionalEmails.includes(email)) {
                            setAdditionalEmails(prev => [...prev, email]);
                            setNewEmailInput('');
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="h-11"
                    />
                  </div>

                  {freeExtendedCover !== 'none' && (
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-sm font-medium text-foreground">Includes {selectedBonusMonths} free bonus months</p>
                    </div>
                  )}

                  {/* Manual copy/paste fallback for when automated email sending fails */}
                  <div className="rounded-lg border border-dashed bg-muted/10 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Copy className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="inline-block rounded-md bg-yellow-100 px-2.5 py-1 text-sm font-semibold text-yellow-950">Copy Paste email</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          If sending fails, copy the email below and paste it into your own email client.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-950">
                      If email quote not working, please copy paste into your work email and send.
                    </div>
                    {(() => {
                      const firstName = customerName?.split(' ')[0] || 'there';
                      const vehicleLabel = `${vehicleData?.make || ''} ${vehicleData?.model || ''}`.trim() || 'Vehicle';
                      const reg = vehicleData?.regNumber || '';
                      const months = termOptions.find(t => t.id === paymentType)?.months || 0;
                      const years = months / 12;
                      const coverPeriod = `${years} ${years === 1 ? 'year' : 'years'}`;
                      const bonus = freeExtendedCover !== 'none' ? ` + ${selectedBonusMonths} free bonus months` : '';
                      const claim = (boostAddon ? getDisplayClaimLimitValue(claimLimit) + 1000 : getDisplayClaimLimitValue(claimLimit)).toLocaleString();
                      const linkHref = quoteLink || '#';
                      const body =
`Hi ${firstName},

Your personalised warranty quote is ready. You can choose monthly or pay in full from the secure quote page below.

Vehicle: ${vehicleLabel}${reg ? ` (${reg})` : ''}
Cover period: ${coverPeriod}${bonus}
Claim limit: £${claim} per claim
Excess: £${excessAmount}
Labour rate: Up to £${labourRate}/hr
Customer price: £${currentPrice.monthlyPrice}/mo

Choose how to pay and activate your warranty:

${quoteLink || '(quote link is still generating)'}


Kind regards,
Buy A Warranty`;

                      const htmlBody = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
<tr><td style="padding:28px 32px 8px 32px;text-align:center;">
<img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" style="height:40px;display:inline-block;" />
</td></tr>
<tr><td style="padding:8px 32px 0 32px;text-align:center;">
<p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Warranty quote ready</p>
<h2 style="margin:6px 0 0 0;font-size:20px;line-height:1.3;color:#111827;">${vehicleLabel} · Platinum cover</h2>
</td></tr>
<tr><td style="padding:20px 32px 0 32px;font-size:15px;line-height:1.55;color:#1f2937;">
<p style="margin:0 0 14px 0;">Hi ${firstName},</p>
<p style="margin:0 0 18px 0;">Your personalised warranty quote is ready. You can choose monthly or pay in full from the secure quote page below.</p>
</td></tr>
<tr><td style="padding:0 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;">
<tr><td style="padding:10px 14px;color:#6b7280;width:45%;">Vehicle</td><td style="padding:10px 14px;color:#111827;font-weight:600;">${vehicleLabel}${reg ? ` (${reg})` : ''}</td></tr>
<tr><td style="padding:10px 14px;color:#6b7280;border-top:1px solid #eef0f3;">Cover period</td><td style="padding:10px 14px;color:#111827;font-weight:600;border-top:1px solid #eef0f3;">${coverPeriod}${bonus}</td></tr>
<tr><td style="padding:10px 14px;color:#6b7280;border-top:1px solid #eef0f3;">Claim limit</td><td style="padding:10px 14px;color:#111827;font-weight:600;border-top:1px solid #eef0f3;">£${claim} per claim</td></tr>
<tr><td style="padding:10px 14px;color:#6b7280;border-top:1px solid #eef0f3;">Excess</td><td style="padding:10px 14px;color:#111827;font-weight:600;border-top:1px solid #eef0f3;">£${excessAmount}</td></tr>
<tr><td style="padding:10px 14px;color:#6b7280;border-top:1px solid #eef0f3;">Labour rate</td><td style="padding:10px 14px;color:#111827;font-weight:600;border-top:1px solid #eef0f3;">Up to £${labourRate}/hr</td></tr>
<tr><td style="padding:10px 14px;color:#6b7280;border-top:1px solid #eef0f3;">Customer price</td><td style="padding:10px 14px;color:#111827;font-weight:700;border-top:1px solid #eef0f3;">£${currentPrice.monthlyPrice}/mo</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 32px 8px 32px;text-align:center;">
<a href="${linkHref}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:8px;">Choose how to pay & activate</a>
</td></tr>
<tr><td style="padding:8px 32px 4px 32px;text-align:center;font-size:13px;color:#6b7280;word-break:break-all;">
${quoteLink ? `Or open this link:<br/><a href="${linkHref}" style="color:#0b1e4c;font-weight:700;text-decoration:underline;">${quoteLink}</a>` : '(quote link is still generating)'}
</td></tr>
<tr><td style="padding:20px 32px 28px 32px;font-size:14px;color:#374151;">
<p style="margin:0;">Kind regards,<br/><strong>Buy A Warranty</strong></p>
</td></tr>
</table>
<p style="margin:16px 0 0 0;font-size:11px;color:#9ca3af;">Buy A Warranty · buyawarranty.co.uk</p>
</td></tr></table></body></html>`;

                      const copy = async (text: string, label: string) => {
                        try {
                          await navigator.clipboard.writeText(text);
                          toast({ title: `${label} copied` });
                        } catch {
                          toast({ title: 'Copy failed', description: 'Please select and copy manually', variant: 'destructive' });
                        }
                      };

                      const copyRichEmail = async (): Promise<boolean> => {
                        try {
                          if ((window as any).ClipboardItem && navigator.clipboard.write) {
                            const item = new ClipboardItem({
                              'text/html': new Blob([htmlBody], { type: 'text/html' }),
                              'text/plain': new Blob([body], { type: 'text/plain' }),
                            });
                            await navigator.clipboard.write([item]);
                            return true;
                          }
                          await navigator.clipboard.writeText(body);
                          return false;
                        } catch {
                          try { await navigator.clipboard.writeText(body); } catch {}
                          return false;
                        }
                      };

                      const openWith = async (href: string, provider: string) => {
                        const rich = await copyRichEmail();
                        // Diagnostic log — helps debug when Gmail/Outlook opens with an empty body.
                        try {
                          const u = new URL(href);
                          const params: Record<string, { length: number; preview: string }> = {};
                          u.searchParams.forEach((v, k) => {
                            params[k] = { length: v.length, preview: v.slice(0, 120) };
                          });
                          console.info(`[compose:${provider}]`, {
                            href,
                            hrefLength: href.length,
                            richClipboard: rich,
                            params,
                          });
                        } catch (e) {
                          console.warn(`[compose:${provider}] URL parse failed`, e, href);
                        }
                        toast({
                          title: rich ? 'Formatted email copied' : 'Email text copied',
                          description: rich
                            ? `Opening ${provider} — press Ctrl/⌘+V in the message body to paste the formatted email.`
                            : `Opening ${provider} — paste the email body with Ctrl/⌘+V.`,
                        });
                        window.open(href, '_blank', 'noopener,noreferrer');
                      };

                      // Gmail's compose URL truncates around ~2000 chars total, so keep body trimmed as a fallback if clipboard paste fails.
                      const bodyForUrl = (body || '').slice(0, 1800);
                      const encodedBody = encodeURIComponent(bodyForUrl);
                      const mailtoHref = `mailto:${encodeURIComponent(customerEmail || '')}?subject=${encodeURIComponent(emailSubject)}&body=${encodedBody}`;
                      const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customerEmail || '')}&su=${encodeURIComponent(emailSubject)}&body=${encodedBody}`;
                      const outlookHref = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(customerEmail || '')}&subject=${encodeURIComponent(emailSubject)}&body=${encodedBody}`;

                      const runGmailComposeTest = () => {
                        const testTo = customerEmail || 'test@example.com';
                        const testSubject = `[Compose test] ${emailSubject || 'Quote email'}`;
                        const testBody = `Compose test at ${new Date().toISOString()}\n\nTo: ${testTo}\nSubject length: ${(emailSubject || '').length}\nBody length (full): ${(body || '').length}\nBody length (URL): ${bodyForUrl.length}\nRich HTML length: ${htmlBody.length}\n\n---\nFirst 200 chars of body:\n${(body || '').slice(0, 200)}`;
                        const testHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(testTo)}&su=${encodeURIComponent(testSubject)}&body=${encodeURIComponent(testBody)}`;
                        const diagnostics = {
                          origin: window.location.origin,
                          secureContext: window.isSecureContext,
                          clipboardApi: !!(navigator.clipboard && navigator.clipboard.write),
                          clipboardItem: typeof (window as any).ClipboardItem !== 'undefined',
                          userAgent: navigator.userAgent,
                          customerEmail,
                          subjectLength: (emailSubject || '').length,
                          bodyLength: (body || '').length,
                          bodyForUrlLength: bodyForUrl.length,
                          htmlBodyLength: htmlBody.length,
                          gmailHrefLength: gmailHref.length,
                          outlookHrefLength: outlookHref.length,
                          mailtoHrefLength: mailtoHref.length,
                          testHrefLength: testHref.length,
                          gmailParams: Object.fromEntries(new URL(gmailHref).searchParams.entries()),
                        };
                        console.group('[Gmail compose test]');
                        console.info('Diagnostics', diagnostics);
                        console.info('Live Gmail href', gmailHref);
                        console.info('Test Gmail href', testHref);
                        console.groupEnd();
                        toast({
                          title: 'Compose test opened',
                          description: `Gmail href ${gmailHref.length} chars · body ${bodyForUrl.length} chars · full diagnostics in console.`,
                        });
                        window.open(testHref, '_blank', 'noopener,noreferrer');
                      };

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <Button type="button" size="sm" className="col-span-2 bg-yellow-100 text-yellow-950 hover:bg-yellow-200 border border-yellow-300" onClick={async () => { const rich = await copyRichEmail(); toast({ title: rich ? 'Formatted email copied' : 'Email body copied' }); }}>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />Copy formatted email
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => copy(customerEmail || '', 'Recipient')} disabled={!customerEmail}>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />Copy recipient
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => copy(emailSubject, 'Subject')} disabled={!emailSubject}>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />Copy subject
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => copy(body, 'Plain text body')}>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />Copy plain text
                            </Button>
                          </div>
                          <Textarea
                            readOnly
                            value={body}
                            className="h-32 text-xs font-mono resize-none"
                            onFocus={(e) => e.currentTarget.select()}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Button type="button" variant="default" size="sm" disabled={!customerEmail} onClick={() => openWith(gmailHref, 'Gmail')}>
                              <Mail className="w-3.5 h-3.5 mr-1.5" />Open in Gmail
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled={!customerEmail} onClick={() => openWith(outlookHref, 'Outlook')}>
                              <Mail className="w-3.5 h-3.5 mr-1.5" />Open in Outlook
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled={!customerEmail} onClick={() => openWith(mailtoHref, 'your default mail app')}>
                              <Mail className="w-3.5 h-3.5 mr-1.5" />Default mail app
                            </Button>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <p className="text-[11px] text-muted-foreground">
                              The formatted HTML email is copied to your clipboard automatically — paste it into the compose window with Ctrl/⌘+V and Gmail/Outlook will keep the styling, logo and CTA button.
                            </p>
                            {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager') && (
                              <Button type="button" variant="ghost" size="sm" className="text-[11px] h-7 shrink-0" onClick={runGmailComposeTest}>
                                Run Gmail compose test
                              </Button>
                            )}
                          </div>
                        </>
                      );
                    })()}

                  </div>
                </div>

              </div>

              <DialogFooter className="border-t bg-background px-6 py-4 gap-2 flex-col sm:flex-row sm:items-center">
                {selfCopySent && adminEmail && (
                  <span className="mr-auto text-xs text-green-700">✓ Copy sent to {adminEmail}</span>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowEmailDialog(false)}
                  disabled={isSendingEmail || isSendingSelfCopy}
                >
                  {quoteSent ? 'Close' : 'Cancel'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Close the preview and jump back to Step 2 so the agent
                    // can tweak plan / customer details, then reopen and resend.
                    setShowEmailDialog(false);
                    setQuoteSent(false);
                    setSelfCopySent(false);
                    setStep(2);
                  }}
                  disabled={isSendingEmail || isSendingSelfCopy}
                  className="border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit details
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSendSelfCopy}
                  disabled={isSendingSelfCopy || isSendingEmail || !quoteLink}
                >
                  {isSendingSelfCopy ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending copy…</>
                  ) : (
                    <><Mail className="w-4 h-4 mr-2" />Send me a copy</>
                  )}
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail || !quoteLink || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)}
                  className="min-w-[150px]"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : quoteSent ? (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Resend to customer
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
              </DialogFooter>


            </DialogContent>
          </Dialog>

          {/* Quote Preview Dialog */}
          <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-600" />
                  Quote Preview - What Customer Will See
                </DialogTitle>
                <DialogDescription>
                  Review exactly what will be shown in the email and on the quote page
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="email" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email">📧 Email Preview</TabsTrigger>
                  <TabsTrigger value="summary">📋 Quote Summary</TabsTrigger>
                </TabsList>
                
                <TabsContent value="email" className="mt-4">
                  <div className="border rounded-lg overflow-hidden bg-gray-100">
                    <div className="bg-gray-200 p-3 border-b flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm font-medium">Email to: {customerEmail}</span>
                    </div>
                    <div className="p-4 bg-white">
                      {/* Email Header Preview */}
                      <div className="text-center mb-6">
                        <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" className="h-12 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-900">
                          Here's your {vehicleData?.make} {vehicleData?.model} warranty quote
                        </h2>
                        <p className="text-sm text-gray-600 mt-2">
                          Protect your {vehicleData?.make} {vehicleData?.model} from unexpected repair bills
                        </p>
                      </div>
                      
                      {/* Greeting */}
                      <div className="mb-4">
                        <p className="text-gray-800">Hi {customerName?.split(' ')[0] || 'there'},</p>
                        <p className="text-gray-600 text-sm mt-2">
                          Thanks for requesting your personalised warranty quote. Please review your cover details below.
                        </p>
                      </div>
                      
                      {/* Quote Summary Box */}
                      <div className="bg-slate-50 rounded-lg border p-4 mb-4">
                        <p className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-3">Your Cover at a Glance</p>
                        <table className="w-full text-sm">
                          <tbody>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Vehicle</td>
                              <td className="py-2 text-right font-semibold">{vehicleData?.make} {vehicleData?.model} ({vehicleData?.regNumber})</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Mileage</td>
                              <td className="py-2 text-right font-semibold">{parseInt(vehicleData?.mileage || '0').toLocaleString()} miles</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Plan</td>
                              <td className="py-2 text-right font-semibold">Platinum cover</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Cover period</td>
                              <td className="py-2 text-right font-semibold">
                                {termOptions.find(t => t.id === paymentType)?.months} months
                                {freeExtendedCover !== 'none' && (
                                  <span className="text-green-600"> + {selectedBonusMonths} months FREE</span>
                                )}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Claim limit</td>
                              <td className="py-2 text-right font-semibold">£{(boostAddon ? claimLimit + 1000 : claimLimit).toLocaleString()} per claim</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Excess</td>
                              <td className="py-2 text-right font-semibold">£{excessAmount}</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 text-gray-500">Labour rate covered</td>
                              <td className="py-2 text-right font-semibold">Up to £{labourRate} per hour</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-gray-900 font-bold">Total price</td>
                              <td className="py-3 text-right text-xl font-bold text-orange-600">£{currentPrice.monthlyPrice * 12}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      {/* What's Included */}
                      <div className="bg-green-50 rounded-lg p-4 mb-4">
                        <p className="text-sm font-bold text-green-800 uppercase tracking-wide mb-2">What Your Warranty Includes</p>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Mechanical and electrical component cover</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Labour costs included</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Repairs at VAT-registered garages</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>No waiting period once activated</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Unlimited claims up to vehicle value</li>
                          <li><span className="text-green-500 font-bold mr-2">✔</span>Fast, UK-based claims support</li>
                        </ul>
                      </div>
                      
                      {/* CTA Button Preview */}
                      <div className="text-center">
                        <a
                          href={quoteLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white px-8 py-4 rounded-lg font-bold shadow-lg no-underline"
                        >
                          Choose how to pay and activate my warranty
                        </a>
                        <p className="text-xs text-gray-500 mt-2">Opens: {quoteLink} (click to test)</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="summary" className="mt-4">
                  <div className="space-y-4">
                    {/* Customer Info */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2">👤 Customer Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-blue-700">Name:</span>
                        <span className="font-medium">{customerName || 'Not provided'}</span>
                        <span className="text-blue-700">Email:</span>
                        <span className="font-medium">{customerEmail}</span>
                        <span className="text-blue-700">Phone:</span>
                        <span className="font-medium">{customerPhone || 'Not provided'}</span>
                      </div>
                    </div>
                    
                    {/* Vehicle Info */}
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <h4 className="font-semibold text-gray-900 mb-2">🚗 Vehicle Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-gray-600">Registration:</span>
                        <span className="font-medium font-mono">{vehicleData?.regNumber}</span>
                        <span className="text-gray-600">Make/Model:</span>
                        <span className="font-medium">{vehicleData?.make} {vehicleData?.model}</span>
                        <span className="text-gray-600">Year:</span>
                        <span className="font-medium">{vehicleData?.year}</span>
                        <span className="text-gray-600">Mileage:</span>
                        <span className="font-medium">{parseInt(vehicleData?.mileage || '0').toLocaleString()} miles</span>
                        <span className="text-gray-600">Fuel Type:</span>
                        <span className="font-medium">{vehicleData?.fuelType || 'N/A'}</span>
                        <span className="text-gray-600">Transmission:</span>
                        <span className="font-medium">{vehicleData?.transmission || 'N/A'}</span>
                      </div>
                    </div>
                    
                    {/* Cover Details */}
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <h4 className="font-semibold text-purple-900 mb-2">🛡️ Cover Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-purple-700">Plan:</span>
                        <span className="font-medium">Platinum</span>
                        <span className="text-purple-700">Duration:</span>
                        <span className="font-medium">
                          {termOptions.find(t => t.id === paymentType)?.label}
                          {freeExtendedCover !== 'none' && (
                            <span className="text-green-600 font-semibold ml-1">+ {selectedBonusMonths} FREE months</span>
                          )}
                        </span>
                        <span className="text-purple-700">Claim Limit:</span>
                        <span className="font-medium">£{(boostAddon ? claimLimit + 1000 : claimLimit).toLocaleString()}{boostAddon ? ' (boosted)' : ''}</span>
                        <span className="text-purple-700">Excess:</span>
                        <span className="font-medium">£{excessAmount}</span>
                        <span className="text-purple-700">Labour Rate:</span>
                        <span className="font-medium">£{labourRate}/hr</span>
                      </div>
                    </div>
                    
                    {/* Pricing */}
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                      <h4 className="font-semibold text-orange-900 mb-2">💰 Pricing</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-orange-700">Total Price:</span>
                        <span className="font-bold text-lg text-orange-600">£{currentPrice.monthlyPrice * 12}</span>
                        <span className="text-orange-700">Monthly Price:</span>
                        <span className="font-medium">£{currentPrice.monthlyPrice}/month</span>
                        <span className="text-orange-700">Pay in Full (10% off):</span>
                        <span className="font-medium">£{currentPrice.payInFullPrice || Math.ceil(currentPrice.totalPrice * 0.9)}</span>
                      </div>
                    </div>
                    
                    {/* Quote Link */}
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-2">🔗 Quote Link</h4>
                      <p className="text-sm text-green-700 break-all font-mono">{quoteLink}</p>
                    </div>
                    
                    {/* Additional Notes */}
                    {additionalNotes && (
                      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <h4 className="font-semibold text-yellow-900 mb-2">📝 Additional Notes</h4>
                        <p className="text-sm text-yellow-800 whitespace-pre-wrap">{additionalNotes}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                  Close Preview
                </Button>
                <Button onClick={() => { setShowPreviewDialog(false); handlePreviewEmail(); }}>
                  <Mail className="w-4 h-4 mr-2" />
                  Proceed to Send Email
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* External Payment Confirmation Dialog - Two Step Flow */}
          <Dialog open={showConfirmPaymentDialog} onOpenChange={(open) => {
            setShowConfirmPaymentDialog(open);
            if (!open) setExternalPaymentStep('details');
          }}>
            <DialogContent className="max-w-[1120px] max-h-[92vh] overflow-hidden bg-muted p-0 gap-0 shadow-2xl" largeCloseButton>
              <DialogHeader className="sticky top-0 z-10 border-b border-border bg-background px-6 py-5 pr-16">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="w-5 h-5 text-green-700" />
                  </span>
                  {externalPaymentStep === 'details' 
                    ? 'Confirm External Payment' 
                    : externalPaymentStep === 'preview' 
                      ? 'Review Before Submission'
                      : 'Order Complete'}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-3 text-muted-foreground">
                  <span>{externalPaymentStep === 'details' 
                    ? 'Step 2: Verify details and enter payment information' 
                    : externalPaymentStep === 'preview'
                      ? 'Step 3: Review all data before creating the policy'
                      : 'Step 4: Confirmation status'}</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    External order workflow
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[calc(92vh-156px)] overflow-y-auto px-6 py-5">

              {existingPolicyWarning && externalPaymentStep !== 'complete' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{existingPolicyWarning}</AlertDescription>
                </Alert>
              )}

              {externalPaymentStep === 'details' ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-3">
                  {/* Customer & Vehicle Details - Collapsible */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('customerVehicle')}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-800 text-sm">Customer & Vehicle Details</h4>
                          {!expandedSections.customerVehicle && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {editableCustomerName || 'No name'} • {editableRegNumber || 'No reg'} • {vehicleData?.make} {vehicleData?.model}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-medium">
                          {expandedSections.customerVehicle ? 'Close' : 'Edit'}
                        </span>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-gray-400 transition-transform",
                          expandedSections.customerVehicle && "rotate-180"
                        )} />
                      </div>
                    </button>
                    
                    {expandedSections.customerVehicle && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-4 pt-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">First Name <span className="text-red-600">*</span></Label>
                            <Input
                              value={editableCustomerFirstName}
                              onChange={(e) => setEditableCustomerFirstName(e.target.value)}
                              placeholder="John"
                              className={cn(
                                "bg-gray-50 focus:bg-white transition-colors",
                                editableCustomerFirstName.trim() ? "border-gray-200 focus:border-blue-400" : "border-2 border-red-400 focus:border-red-500"
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Last Name <span className="text-red-600">*</span></Label>
                            <Input
                              value={editableCustomerLastName}
                              onChange={(e) => setEditableCustomerLastName(e.target.value)}
                              placeholder="Smith"
                              className={cn(
                                "bg-gray-50 focus:bg-white transition-colors",
                                editableCustomerLastName.trim() ? "border-gray-200 focus:border-blue-400" : "border-2 border-red-400 focus:border-red-500"
                              )}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Email *</Label>
                            <div className="relative">
                              <Input
                                value={editableCustomerEmail}
                                onChange={(e) => setEditableCustomerEmail(e.target.value)}
                                className={cn(
                                  "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors",
                                  isValidEmail(editableCustomerEmail) && "pr-8 border-green-300"
                                )}
                              />
                              {isValidEmail(editableCustomerEmail) && (
                                <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                              )}
                            </div>
                            {editableCustomerEmail && !isValidEmail(editableCustomerEmail) && (
                              <p className="text-xs text-amber-600">Enter a valid email address</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Phone</Label>
                            <div className="relative">
                              <Input
                                value={editableCustomerPhone}
                                onChange={(e) => setEditableCustomerPhone(e.target.value)}
                                placeholder="07xxx xxxxxx"
                                className={cn(
                                  "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors",
                                  isValidUkPhone(editableCustomerPhone) && "pr-8 border-green-300"
                                )}
                              />
                              {isValidUkPhone(editableCustomerPhone) && (
                                <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                              )}
                            </div>
                            {editableCustomerPhone && !isValidUkPhone(editableCustomerPhone) && (
                              <p className="text-xs text-amber-600">Enter a valid UK phone number</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Registration *</Label>
                            <Input
                              value={editableRegNumber}
                              onChange={(e) => setEditableRegNumber(e.target.value.toUpperCase())}
                              className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600">Vehicle</Label>
                            <p className="text-sm text-gray-800 py-2 px-3 bg-gray-50 rounded-md border border-gray-200">{vehicleData?.make} {vehicleData?.model} ({vehicleData?.year})</p>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                              Mileage
                              {motMileageLoading && (
                                <span className="flex items-center gap-1 text-xs text-blue-600">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Looking up MOT...
                                </span>
                              )}
                            </Label>
                            <div className="relative">
                              <Input
                                value={editableMileage}
                                onChange={(e) => {
                                  setEditableMileage(e.target.value.replace(/\D/g, ''));
                                  setMileagePrefilledFromMot(false);
                                }}
                                placeholder="e.g. 45000"
                                className={cn(
                                  "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors",
                                  mileagePrefilledFromMot && "pr-8"
                                )}
                              />
                              {mileagePrefilledFromMot && (
                                <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                              )}
                            </div>
                            {mileagePrefilledFromMot && motDate && (
                              <p className="text-xs text-green-600 flex items-center gap-1">
                                <Car className="w-3 h-3" />
                                Pre-filled from MOT ({format(new Date(motDate), 'MMM yyyy')})
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Address Section - Collapsible */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('address')}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📍</span>
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-800 text-sm">Customer Address</h4>
                          {!expandedSections.address && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {skipAddressDetails ? 'Customer will complete in dashboard' : (customerPostcode ? `${customerBuildingNumber} ${customerStreet}, ${customerPostcode}` : 'Not entered')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-medium">
                          {expandedSections.address ? 'Close' : 'Edit'}
                        </span>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-gray-400 transition-transform",
                          expandedSections.address && "rotate-180"
                        )} />
                      </div>
                    </button>
                    
                    {expandedSections.address && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                        <div className="flex items-center gap-2 pt-3 pb-2">
                          <Checkbox
                            id="skip-address"
                            checked={skipAddressDetails}
                            onCheckedChange={(checked) => setSkipAddressDetails(checked === true)}
                          />
                          <Label htmlFor="skip-address" className="text-xs text-gray-600 cursor-pointer">
                            Customer will complete in dashboard
                          </Label>
                        </div>
                        
                        {!skipAddressDetails && (
                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600">House/Building Number <span className="text-red-600">*</span></Label>
                              <Input
                                value={customerBuildingNumber}
                                onChange={(e) => setCustomerBuildingNumber(e.target.value)}
                                placeholder="e.g. 42"
                                className={cn(
                                  "bg-gray-50 focus:bg-white transition-colors",
                                  customerBuildingNumber.trim() ? "border-gray-200 focus:border-blue-400" : "border-2 border-red-400 focus:border-red-500"
                                )}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600">Street <span className="text-red-600">*</span></Label>
                              <Input
                                value={customerStreet}
                                onChange={(e) => setCustomerStreet(e.target.value)}
                                placeholder="e.g. High Street"
                                className={cn(
                                  "bg-gray-50 focus:bg-white transition-colors",
                                  customerStreet.trim() ? "border-gray-200 focus:border-blue-400" : "border-2 border-red-400 focus:border-red-500"
                                )}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600">Town/City <span className="text-red-600">*</span></Label>
                              <Input
                                value={customerTown}
                                onChange={(e) => setCustomerTown(e.target.value)}
                                placeholder="e.g. Manchester"
                                className={cn(
                                  "bg-gray-50 focus:bg-white transition-colors",
                                  customerTown.trim() ? "border-gray-200 focus:border-blue-400" : "border-2 border-red-400 focus:border-red-500"
                                )}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600">County</Label>
                              <Input
                                value={customerCounty}
                                onChange={(e) => setCustomerCounty(e.target.value)}
                                placeholder="e.g. Greater Manchester"
                                className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                                Postcode *
                                {isLookingUpPostcode && (
                                  <span className="flex items-center gap-1 text-xs text-blue-600">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Looking up...
                                  </span>
                                )}
                              </Label>
                              <div className="relative">
                                <Input
                                  value={customerPostcode}
                                  onChange={(e) => {
                                    const v = e.target.value.toUpperCase();
                                    setCustomerPostcode(v);
                                    setPostcodeLookupSuccess(false);
                                    const clean = v.replace(/\s/g, '');
                                    if (isValidUkPostcode(clean)) {
                                      setIsLookingUpPostcode(true);
                                      fetch(`https://api.postcodes.io/postcodes/${clean}`)
                                        .then(r => r.ok ? r.json() : null)
                                        .then(data => {
                                          if (data?.result) {
                                            const town = data.result.admin_district || data.result.parish || data.result.admin_ward || '';
                                            const county = data.result.admin_county || data.result.region || '';
                                            setCustomerPostcode(data.result.postcode || v);
                                            if (town) setCustomerTown(town);
                                            if (county && !customerCounty) setCustomerCounty(county);
                                            setPostcodeLookupSuccess(true);
                                          }
                                        })
                                        .catch(() => {})
                                        .finally(() => setIsLookingUpPostcode(false));
                                    }
                                  }}
                                  placeholder="e.g. M1 1AA"
                                  className={cn(
                                    "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors uppercase",
                                    !customerPostcode.trim() && "border-2 border-red-400 focus:border-red-500",
                                    postcodeLookupSuccess && "pr-8 border-green-300"
                                  )}

                                />
                                {postcodeLookupSuccess && (
                                  <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                                )}
                              </div>
                              {postcodeLookupSuccess && (
                                <p className="text-xs text-green-600">Town auto-filled from postcode</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {skipAddressDetails && (
                          <Alert className="bg-gray-50 border-gray-200 mt-2">
                            <Info className="h-4 w-4 text-gray-500" />
                            <AlertDescription className="text-gray-600 text-sm">
                              The customer will be prompted to complete their address when they log into their dashboard.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Policy Configuration - Collapsible & Editable */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('policyConfig')}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-purple-600" />
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-800 text-sm">Policy Configuration</h4>
                          {!expandedSections.policyConfig && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {termOptions.find(t => t.id === paymentType)?.label} • £{excessAmount} excess • £{currentPrice.monthlyPrice * 12} total
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-medium">
                          {expandedSections.policyConfig ? 'Close' : 'Edit'}
                        </span>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-gray-400 transition-transform",
                          expandedSections.policyConfig && "rotate-180"
                        )} />
                      </div>
                    </button>
                    
                    {expandedSections.policyConfig && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-4 text-sm pt-4">
                          {/* Plan - Read only */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Plan</Label>
                            <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-800 font-medium text-sm">Platinum</div>
                          </div>
                          
                          {/* Duration - Editable */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Duration</Label>
                            <select
                              value={paymentType}
                              onChange={(e) => setPaymentType(e.target.value as '12months' | '24months' | '36months')}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                            >
                              {termOptions.map(term => (
                                <option key={term.id} value={term.id}>{term.label}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Excess - Editable */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Excess</Label>
                            <select
                              value={excessAmount}
                              onChange={(e) => setExcessAmount(parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                            >
                              {[0, 50, 100, 150, 250, 500].map(val => (
                                <option key={val} value={val}>£{val}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Claim Limit - Editable */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Claim Limit</Label>
                            <select
                              value={claimLimit === 2000 && boostAddon ? 3000 : claimLimit}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val === 3000) {
                                  setClaimLimit(2000);
                                  setBoostAddon(true);
                                } else if (val === 5000) {
                                  if (!claimLimit5kAllowed) {
                                    setClaimLimitAuthSent(false);
                                    setClaimLimitAuthReason('');
                                    setClaimLimitAuthOpen(true);
                                    return;
                                  }
                                  setClaimLimit(5000);
                                  setBoostAddon(false);
                                } else {
                                  setClaimLimit(val);
                                  setBoostAddon(false);
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                            >
                              {getVisibleClaimLimits(vehicleData?.make).map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label} - {opt.description}
                                  {opt.value === 5000 && !claimLimit5kAllowed ? ' (needs manager approval)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Labour Rate - Editable */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Labour Rate</Label>
                            <select
                              value={labourRate}
                              onChange={(e) => setLabourRate(parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                            >
                              {getLabourRateChips(pricingModel.labourRateFactors).map(opt => (
                                <option key={opt.rate} value={opt.rate}>£{opt.rate}/hr</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Quoted Price - Display only, auto-updates */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500 flex items-center justify-between">
                              <span>Quoted Price (editable)</span>
                              {quotedPriceOverride !== '' && (
                                <button
                                  type="button"
                                  onClick={() => setQuotedPriceOverride('')}
                                  className="text-[10px] text-blue-600 hover:underline"
                                >
                                  Reset to £{currentPrice.monthlyPrice * 12}
                                </button>
                              )}
                            </Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-800 font-semibold text-base pointer-events-none">£</span>
                              <Input
                                type="number"
                                step={1}
                                min={0}
                                value={quotedPriceOverride === '' ? (currentPrice.monthlyPrice * 12) : quotedPriceOverride}
                                /* Whole pounds only — pence are stripped on entry. */
                                onChange={(e) => setQuotedPriceOverride(e.target.value.replace(/[^0-9]/g, ''))}
                                className="pl-7 bg-green-50 border-green-200 text-green-800 font-semibold text-base focus:bg-white focus:border-green-400"
                              />
                            </div>
                          </div>
                          
                          
                          {/* Boost Add-on Toggle */}
                          <div className="col-span-2 flex items-center gap-3 pt-2">
                            <Checkbox
                              id="boost-addon-confirm"
                              checked={boostAddon}
                              onCheckedChange={(checked) => setBoostAddon(checked === true)}
                            />
                            <Label htmlFor="boost-addon-confirm" className="text-sm cursor-pointer">
                              Boost Add-on (+£1,000 claim limit)
                            </Label>
                          </div>
                          
                          {/* Included Add-ons Info */}
                          {getAutoIncludedAddOns(paymentType).length > 0 && (
                            <div className="col-span-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                              <span className="text-xs font-medium text-blue-700">Included Add-ons: </span>
                              <span className="text-xs text-blue-800">
                                {getAutoIncludedAddOns(paymentType).includes('breakdown') && 'Vehicle Recovery'}
                                {getAutoIncludedAddOns(paymentType).includes('breakdown') && getAutoIncludedAddOns(paymentType).includes('rental') && ', '}
                                {getAutoIncludedAddOns(paymentType).includes('rental') && 'Hire Car'}
                              </span>
                            </div>
                          )}
                          
                          {/* Optional Extended Cover */}
                          {freeExtendedCover !== 'none' && (
                            <div className="col-span-2 p-2 bg-green-50 border border-green-200 rounded-md">
                              <span className="text-xs font-medium text-green-700">🎁 FREE Extended Cover: </span>
                              <span className="text-xs text-green-800">
                                {selectedBonusMonths} bonus months
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Details Section */}
                  <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-base">
                      💳 Payment Details
                    </h4>
                    
                    {/* Payment Source */}
                    <div className="space-y-1.5">
                      <Label htmlFor="payment-source" className="text-xs font-medium text-gray-600">Payment Source *</Label>
                      <select
                        id="payment-source"
                        value={paymentSource}
                        onChange={(e) => setPaymentSource(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors text-sm"
                      >
                        <option value="">Select payment source...</option>
                        <option value="stripe_dashboard">Stripe Dashboard</option>
                        <option value="bumper_portal">Bumper Portal</option>
                        <option value="payment_assist">Payment Assist</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="phone_card">Phone Card Payment</option>
                        <option value="dealer_portal">Dealer Portal</option>
                        <option value="google">Google</option>
                        <option value="facebook">Facebook</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Amount */}
                    {(() => {
                      const effectiveQuoted = quotedPriceOverride !== '' ? Math.round(parseFloat(quotedPriceOverride) || 0) : (currentPrice.monthlyPrice * 12);
                      return (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="payment-amount" className="text-xs font-medium text-gray-600 flex items-center justify-between">
                              <span>Amount Received (£) *</span>
                              <span className="text-[10px] text-gray-500">Quoted: £{effectiveQuoted}</span>
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="payment-amount"
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder={effectiveQuoted.toString()}
                                className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPaymentAmount(effectiveQuoted.toString())}
                                className="whitespace-nowrap text-xs"
                              >
                                Match quote
                              </Button>
                            </div>
                            {paymentAmount && Math.abs(parseFloat(paymentAmount) - effectiveQuoted) > 1 && (
                              <p className="text-xs text-amber-600">
                                ⚠️ Differs from quoted price (£{effectiveQuoted})
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Part payment / deposit */}
                    <div className={cn(
                      "rounded-lg border-2 p-4 space-y-3",
                      depositMode ? "border-amber-400 bg-amber-50/70" : "border-gray-200 bg-gray-50"
                    )}>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <Checkbox
                          id="step2-part-payment"
                          checked={depositMode}
                          onCheckedChange={(checked) => setDepositMode(checked === true)}
                        />
                        <span className="text-sm">
                          <span className="font-semibold text-gray-800">Part payment (deposit now, balance to follow)</span>
                          <span className="block text-xs text-gray-600 mt-0.5">
                            Tick this if the customer is only paying part of the price today. A Part Payment plan is
                            opened automatically and the balance is tracked in Customer Management &gt; Part Payments.
                          </span>
                        </span>
                      </label>

                      {depositMode && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-amber-900">Deposit taken (£)</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={depositAmountInput}
                                onChange={(e) => setDepositAmountInput(e.target.value)}
                                placeholder="0"
                                className={cn("bg-white", !depositAmountInput ? "border-destructive" : "border-amber-300")}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-amber-900">Balance due date</Label>
                              <Input
                                type="date"
                                value={depositDueDate}
                                onChange={(e) => setDepositDueDate(e.target.value)}
                                className="bg-white border-amber-300"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-amber-900">Balance outstanding</Label>
                              <div className="h-10 flex items-center px-3 rounded-md border border-amber-300 bg-white text-sm font-bold text-amber-900">
                                £{Math.max(0, Math.round(((quotedPriceOverride !== '' ? Math.round(parseFloat(quotedPriceOverride) || 0) : (currentPrice.monthlyPrice * 12)) || 0) - (depositAmountValue || 0)))}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-amber-900 underline text-left"
                            onClick={() => {
                              window.location.assign(
                                `/admin-dashboard/?tab=customers&pp=outstanding${customerEmail ? `&search=${encodeURIComponent(customerEmail)}` : ''}`,
                              );
                            }}
                          >
                            Open Part Payments
                          </button>

                        </>
                      )}
                    </div>


                    
                    {/* Warranty Start Date Picker */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                        <CalendarIcon className="w-4 h-4" />
                        Warranty Start Date *
                      </Label>
                      
                      {/* Start Date Options */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Today Option */}
                        <button
                          type="button"
                          onClick={() => setWarrantyStartDate(new Date())}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-left",
                            isToday(warrantyStartDate)
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          )}
                        >
                          <CheckCircle2 className={cn(
                            "w-4 h-4 flex-shrink-0",
                            isToday(warrantyStartDate) ? "text-green-600" : "text-gray-400"
                          )} />
                          <div>
                            <span className="font-medium text-sm">Start Today</span>
                            <p className="text-xs text-muted-foreground">{format(new Date(), 'd MMM yyyy')}</p>
                          </div>
                        </button>

                        {/* Future Date Picker */}
                        <Popover open={isStartDateCalendarOpen} onOpenChange={setIsStartDateCalendarOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-left",
                                !isToday(warrantyStartDate)
                                  ? "border-green-500 bg-green-50 text-green-700"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                              )}
                            >
                              <CalendarIcon className={cn(
                                "w-4 h-4 flex-shrink-0",
                                !isToday(warrantyStartDate) ? "text-green-600" : "text-gray-400"
                              )} />
                              <div>
                                <span className="font-medium text-sm">
                                  {!isToday(warrantyStartDate) ? format(warrantyStartDate, 'd MMM yyyy') : 'Future Date'}
                                </span>
                                <p className="text-xs text-muted-foreground">Select from calendar</p>
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
                            <CalendarComponent
                              mode="single"
                              selected={warrantyStartDate}
                              onSelect={(date) => {
                                if (date) {
                                  setWarrantyStartDate(date);
                                  setIsStartDateCalendarOpen(false);
                                }
                              }}
                              disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Future Start Date Note */}
                      {!isToday(warrantyStartDate) && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800">
                              <p className="font-medium">Payment is processed today</p>
                              <p className="text-blue-700 mt-1">
                                The warranty will be activated on <span className="font-semibold">{format(warrantyStartDate, 'd MMMM yyyy')}</span>.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <Label htmlFor="payment-notes" className="text-xs font-medium text-gray-600">Internal Notes (optional)</Label>
                      <Textarea
                        id="payment-notes"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Any additional notes about this payment..."
                        rows={2}
                        className="bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="confirm-send-welcome" 
                        checked={sendWelcomeEmail}
                        onCheckedChange={(checked) => setSendWelcomeEmail(checked === true)}
                      />
                      <Label htmlFor="confirm-send-welcome" className="text-sm cursor-pointer">
                        Send welcome email with login details
                      </Label>
                    </div>
                  </div>
                  </div>

                  <aside className="lg:sticky lg:top-0 h-fit space-y-3 rounded-xl border border-border bg-background p-4 shadow-sm">
                    {(() => {
                      const effectiveQuoted = quotedPriceOverride !== '' ? Math.round(parseFloat(quotedPriceOverride) || 0) : currentPrice.totalPrice;
                      const recorded = paymentAmount || effectiveQuoted;
                      const differs = paymentAmount && Math.abs(parseFloat(paymentAmount) - effectiveQuoted) > 1;
                      return (
                        <div className={cn(
                          "rounded-lg border p-4",
                          differs ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
                        )}>
                          <p className={cn("text-xs font-medium", differs ? "text-amber-700" : "text-green-700")}>Amount to record</p>
                          <p className={cn("mt-1 text-3xl font-bold", differs ? "text-amber-900" : "text-green-900")}>£{recorded}</p>
                          <p className={cn("mt-1 text-xs", differs ? "text-amber-700" : "text-green-700")}>Quoted price £{effectiveQuoted}</p>
                          {differs && (
                            <p className="mt-1 text-xs text-amber-800">⚠️ Differs from quoted price</p>
                          )}
                        </div>
                      );
                    })()}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                        <span className="text-muted-foreground">Customer</span>
                        <span className="text-right font-medium">{editableCustomerName || customerName || 'Not entered'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                        <span className="text-muted-foreground">Vehicle</span>
                        <span className="text-right font-medium">{editableRegNumber || regNumber || 'No reg'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                        <span className="text-muted-foreground">Mileage</span>
                        <span className="text-right font-medium">{editableMileage || mileage || 'Not entered'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="text-right font-medium">{termOptions.find(t => t.id === paymentType)?.label}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Start date</span>
                        <span className="text-right font-medium">{format(warrantyStartDate, 'd MMM yyyy')}</span>
                      </div>
                    </div>
                  </aside>
                </div>
              ) : externalPaymentStep === 'preview' ? (
                /* Preview Step */
                <div className="space-y-4">
                  {(() => {
                    const preview = getExternalPaymentPreviewData();
                    const hasPriceDifference = Math.abs(parseFloat(paymentAmount) - currentPrice.totalPrice) > 1;
                    return (
                      <>
                        <Alert className="bg-amber-50 border-amber-200">
                          <Eye className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            Please review all information carefully before confirming. This data will be saved to your Customer Dashboard.
                          </AlertDescription>
                        </Alert>

                        {/* Customer Dashboard Data with Edit Button */}
                        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-green-900 flex items-center gap-2">
                              <UserCheck className="w-4 h-4" />
                              Customer Dashboard Record
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExternalPaymentStep('details')}
                              className="text-xs h-7"
                            >
                              ✏️ Edit Details
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="font-medium">Name:</span> {preview.customer.name}</div>
                            <div><span className="font-medium">Email:</span> {preview.customer.email}</div>
                            <div><span className="font-medium">Phone:</span> {preview.customer.phone}</div>
                            <div><span className="font-medium">Registration:</span> {preview.vehicle.registration}</div>
                            <div><span className="font-medium">Vehicle:</span> {preview.vehicle.make} {preview.vehicle.model} ({preview.vehicle.year})</div>
                            <div><span className="font-medium">Mileage:</span> {preview.vehicle.mileage} miles</div>
                            <div><span className="font-medium">Plan:</span> {preview.policy.planType}</div>
                            <div><span className="font-medium">Duration:</span> {preview.policy.duration}</div>
                            <div><span className="font-medium">Start Date:</span> {preview.policy.startDate}</div>
                            <div><span className="font-medium">End Date:</span> {preview.policy.endDate}</div>
                            <div><span className="font-medium">Excess:</span> £{preview.policy.excess}</div>
                            <div><span className="font-medium">Claim Limit:</span> £{preview.policy.claimLimit.toLocaleString()}</div>
                            <div><span className="font-medium">Labour Rate:</span> £{preview.policy.labourRate}/hr</div>
                            <div><span className="font-medium">Payment Amount:</span> £{preview.payment.amount}</div>
                            <div><span className="font-medium">Payment Source:</span> {preview.payment.source}</div>
                            {preview.policy.breakdownRecovery && <div className="text-green-700">✓ Breakdown Recovery</div>}
                            {preview.policy.vehicleRental && <div className="text-green-700">✓ Hire Car Cover</div>}
                            {preview.policy.boostAddon && <div className="text-green-700">✓ Boost Add-on</div>}
                            {preview.policy.freeExtendedCover !== 'none' && (
                              <div className="col-span-2 text-green-700 font-medium">
                                🎁 FREE Extended Cover: {preview.policy.freeExtendedCover === '3months' ? 3 : preview.policy.freeExtendedCover === '6months' ? 6 : coverYears} bonus months
                              </div>
                            )}
                            {preview.policy.isFutureStart && (
                              <div className="col-span-2 p-2 bg-blue-100 border border-blue-200 rounded text-blue-800 text-sm">
                                <span className="font-medium">📅 Future Start:</span> Payment today, warranty activates on {preview.policy.startDate}
                              </div>
                            )}
                          </div>
                          
                          {/* Price difference info (non-blocking) */}
                          {hasPriceDifference && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
                              <span className="font-medium">💰 Price Override:</span> Payment amount (£{preview.payment.amount}) differs from quoted price (£{currentPrice.totalPrice}). 
                              {paymentNotes ? <span className="text-green-700"> Note added.</span> : <span className="text-amber-700"> Consider adding a note.</span>}
                            </div>
                          )}
                        </div>

                        {/* Warranties Register integration removed — internal handling only. */}

                        {/* Welcome Email */}
                        {sendWelcomeEmail && (
                          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <p className="text-sm text-orange-800">
                              <Mail className="w-4 h-4 inline mr-1" />
                              Welcome email with dashboard login will be sent to: <strong>{preview.customer.email}</strong>
                            </p>
                          </div>
                        )}

                        {/* Final Confirmation */}
                        <div className="p-3 border rounded-md bg-green-50 border-green-200">
                          <div className="flex items-start space-x-3">
                            <Checkbox 
                              id="confirm-payment-final"
                              checked={paymentConfirmed}
                              onCheckedChange={(checked) => setPaymentConfirmed(checked === true)}
                              className="mt-1"
                            />
                            <Label htmlFor="confirm-payment-final" className="text-sm text-green-800 cursor-pointer leading-relaxed">
                              <strong>I confirm</strong> all the above information is correct and payment has been received. This will activate the warranty immediately.
                            </Label>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : null}

              {/* Complete Step - Show confirmation status */}
              {externalPaymentStep === 'complete' && completionStatus && (
                <div className="space-y-4 py-4">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-green-800">
                      {completionStatus.isFutureStart ? 'Policy Scheduled!' : 'Policy Activated!'}
                    </h3>
                    <p className="text-muted-foreground mt-1">
                      Warranty Reference: <strong>{completionStatus.warrantyReference}</strong>
                    </p>
                  </div>

                  {/* Status Items */}
                  <div className="space-y-3">
                    {/* Policy Created */}
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="font-medium">Policy Created in Dashboard</span>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        ✓ Complete
                      </Badge>
                    </div>

                    {/* Email Status */}
                    {sendWelcomeEmail && (
                      <div className={cn(
                        "flex items-center justify-between p-3 border rounded-lg",
                        completionStatus.emailSent === true 
                          ? "bg-green-50 border-green-200" 
                          : completionStatus.emailSent === false 
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200"
                      )}>
                        <div className="flex items-center gap-3">
                          {completionStatus.emailSent === true ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : completionStatus.emailSent === false ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                          )}
                          <div>
                            <span className="font-medium">Welcome Email to Customer</span>
                            <p className="text-xs text-muted-foreground">{customerEmail}</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            completionStatus.emailSent === true 
                              ? "bg-green-100 text-green-700 border-green-300"
                              : completionStatus.emailSent === false
                                ? "bg-red-100 text-red-700 border-red-300"
                                : "bg-gray-100 text-gray-700 border-gray-300"
                          )}
                        >
                          {completionStatus.emailSent === true ? '✓ Sent' : completionStatus.emailSent === false ? '✗ Failed' : 'Pending'}
                        </Badge>
                      </div>
                    )}

                    {/* Warranties Register integration removed — internal handling only. */}
                  </div>

                  {/* Professional Note */}
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {completionStatus.isFutureStart ? (
                        <>
                          <strong>Payment processed today.</strong> The warranty will be activated on the scheduled start date. 
                          The customer has received confirmation of their upcoming cover.
                        </>
                      ) : (
                        <>
                          <strong>Order complete.</strong> The customer now has access to their warranty dashboard 
                          and has been sent their policy documentation.
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              </div>

              <DialogFooter className="border-t border-border bg-background px-6 py-4 flex flex-col gap-2">
                {externalPaymentStep === 'details' ? (
                  <>
                    {/* Validation helper - show what's missing */}
                    {(!paymentSource || !paymentAmount) && (
                      <div className="w-full text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>
                          {!paymentSource && !paymentAmount 
                            ? 'Please select a payment source and enter the amount received'
                            : !paymentSource 
                              ? 'Please select a payment source'
                              : 'Please enter the amount received'}
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2 w-full justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setShowConfirmPaymentDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => setExternalPaymentStep('preview')}
                        disabled={!paymentSource || !paymentAmount}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview Before Submit
                      </Button>
                    </div>
                  </>
                ) : externalPaymentStep === 'preview' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setExternalPaymentStep('details')}
                      disabled={isConfirmingPaid}
                    >
                      ← Back to Edit
                    </Button>
                    <Button
                      onClick={handleConfirmExternalPayment}
                      disabled={isConfirmingPaid || !paymentConfirmed}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isConfirmingPaid ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Policy...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Confirm & Activate Policy
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setShowConfirmPaymentDialog(false);
                      resetForm();
                    }}
                    className="bg-brand-orange hover:bg-brand-orange/90"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Done - Close
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Age Override Confirmation Dialog */}
          <Dialog open={showAgeOverrideConfirm} onOpenChange={setShowAgeOverrideConfirm}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="h-5 w-5" />
                  Override Age Limit
                </DialogTitle>
                <DialogDescription>
                  You are about to allow a vehicle older than 15 years to be quoted/ordered. This vehicle will be priced using the same pricing as vehicles between 12 years 1 day and 15 years old.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <p className="text-sm font-semibold text-gray-900">Are you sure you are authorised to do this?</p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowAgeOverrideConfirm(false)}>
                  Cancel
                </Button>
                <Button 
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => {
                    setAgeOverrideEnabled(true);
                    setShowAgeOverrideConfirm(false);
                    toast({
                      title: "Age Override Enabled",
                      description: "You can now proceed with vehicles older than 15 years.",
                    });
                  }}
                >
                  Yes, I'm Authorised
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* History Quote View Dialog */}
          <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Quote Details</DialogTitle>
                <DialogDescription>
                  {selectedHistoryQuote && `Sent to ${selectedHistoryQuote.customer_email} on ${new Date(selectedHistoryQuote.sent_at).toLocaleString()}`}
                </DialogDescription>
              </DialogHeader>
              
              {selectedHistoryQuote && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">Customer</p>
                      <p className="text-sm">{selectedHistoryQuote.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedHistoryQuote.customer_email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Vehicle</p>
                      <p className="text-sm">{selectedHistoryQuote.vehicle_reg}</p>
                      <p className="text-xs text-muted-foreground">{selectedHistoryQuote.vehicle_make} {selectedHistoryQuote.vehicle_model}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Price</p>
                      <p className="text-sm">£{selectedHistoryQuote.total_price}</p>
                      <p className="text-xs text-muted-foreground">£{selectedHistoryQuote.monthly_price}/month</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Coverage</p>
                      <p className="text-sm">£{selectedHistoryQuote.excess_amount} excess | £{selectedHistoryQuote.claim_limit} limit</p>
                      <p className="text-xs text-muted-foreground">
                        £{selectedHistoryQuote.labour_rate || 70}/hr labour
                        {selectedHistoryQuote.boost_addon && ' | Boost enabled'}
                      </p>
                    </div>
                    {selectedHistoryQuote.additional_notes && (
                      <div className="col-span-2">
                        <p className="text-sm font-semibold">Additional Notes</p>
                        <p className="text-sm text-muted-foreground">{selectedHistoryQuote.additional_notes}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Subject</Label>
                    <Input value={selectedHistoryQuote.email_subject} readOnly className="mt-2" />
                  </div>
                  
                  <div>
                    <Label>Email Content</Label>
                    <Textarea
                      value={selectedHistoryQuote.email_content}
                      readOnly
                      rows={15}
                      className="mt-2 font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
                  Close
                </Button>
                {selectedHistoryQuote && (
                  <Button onClick={() => handleResendQuote(selectedHistoryQuote)} disabled={isSendingEmail}>
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend Quote
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          {/* Sub-tabs for Sent vs Saved */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={historySubTab === 'sent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHistorySubTab('sent')}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              Sent Quotes ({sentQuotes.length})
            </Button>
            <Button
              variant={historySubTab === 'saved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHistorySubTab('saved')}
              className="gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Saved Drafts ({savedQuotes.length})
            </Button>
          </div>

          {/* Sent Quotes Section */}
          {historySubTab === 'sent' && (
            <Card>
              <CardHeader>
                <CardTitle>Quote & Order History</CardTitle>
                <CardDescription>View and resend previously sent quotes</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : sentQuotes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No quotes sent yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Coverage</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentQuotes.map((quote) => (
                        <TableRow key={quote.id}>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(quote.sent_at).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(quote.sent_at).toLocaleTimeString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{quote.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{quote.customer_email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{quote.vehicle_reg}</div>
                            <div className="text-xs text-muted-foreground">
                              {quote.vehicle_make} {quote.vehicle_model}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{quote.payment_type}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">£{quote.excess_amount} / £{quote.claim_limit}</div>
                            <div className="text-xs text-muted-foreground">
                              £{quote.labour_rate || 70}/hr
                              {quote.boost_addon && <Badge variant="outline" className="ml-1 text-[10px]">Boost</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">£{quote.total_price}</div>
                            <div className="text-xs text-muted-foreground">
                              £{quote.monthly_price}/mo
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <DeliveryStatusBadge quote={quote} />
                              {quote.resent_count > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Resent {quote.resent_count}x
                                </Badge>
                              )}
                              {quote.customer_purchased && (
                                <Badge variant="default" className="text-xs">Purchased</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedHistoryQuote(quote);
                                  setShowHistoryDialog(true);
                                }}
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditQuote(quote)}
                                title="Edit & resend"
                                className="text-blue-600 hover:bg-blue-50"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResendQuote(quote)}
                                disabled={isSendingEmail}
                                title="Resend this quote email to the customer"
                                className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                              >
                                <RefreshCw className={`w-4 h-4 ${isSendingEmail ? 'animate-spin' : ''}`} />
                                Resend
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Saved Drafts Section */}
          {historySubTab === 'saved' && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Quote Drafts</CardTitle>
                <CardDescription>Resume working on previously saved quotes</CardDescription>
              </CardHeader>
              <CardContent>
                {savedQuotes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No saved drafts yet. Use "Save Quote" in Step 2 to save a draft.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Saved</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Coverage</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedQuotes.map((quote, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="text-sm">
                              {quote.savedAt ? new Date(quote.savedAt).toLocaleDateString() : 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {quote.savedAt ? new Date(quote.savedAt).toLocaleTimeString() : ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{quote.customerName || 'Not set'}</div>
                            <div className="text-xs text-muted-foreground">{quote.customerEmail || ''}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{quote.vehicleData?.regNumber || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">
                              {quote.vehicleData?.make} {quote.vehicleData?.model}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{quote.paymentType || '24months'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">£{quote.excessAmount ?? 100} / £{quote.claimLimit || 1250}</div>
                            <div className="text-xs text-muted-foreground">
                              £{quote.labourRate || 70}/hr
                              {quote.boostAddon && <Badge variant="outline" className="ml-1 text-[10px]">Boost</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">£{quote.currentPrice?.totalPrice || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">
                              £{quote.currentPrice?.monthlyPrice || 'N/A'}/mo
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => loadSavedQuote(quote)}
                                className="gap-1"
                              >
                                <ArrowRight className="w-4 h-4" />
                                Load
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteSavedQuote(index)}
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Paid Orders Tab */}
        <TabsContent value="paid" className="space-y-6 mt-6">
          <PaidOrdersTab onRefresh={loadPaidOrdersCount} />
        </TabsContent>

        {/* Customer Logins Tab */}
        <TabsContent value="logins" className="space-y-6 mt-6">
          <CustomerLoginsTab />
        </TabsContent>

        {/* Update Policy Tab */}
        <TabsContent value="update" className="space-y-6 mt-6">
          <CustomerPolicyUpdateTab />
        </TabsContent>
      </Tabs>

      {/* Managers-only board, kept at the bottom so it doesn't push the form down */}
      <QuotesSentPanel currentAdminId={currentAdminId} currentUserRole={userRole} className="mt-6" />
    </div>

    {isManagementRole && (
      <DiscountCapManagerDialog open={showDiscountCapManager} onOpenChange={setShowDiscountCapManager} />
    )}
    </>
  );

};
