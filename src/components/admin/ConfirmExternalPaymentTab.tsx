import React, { useState, useEffect } from 'react';
import { getInstalmentOptions, isInstalmentAllowed, isInstalmentComingSoon, instalmentAmount, instalmentPlanTotal, oneYearRatio, BUMPER_LONG_PLAN_NOTE, type InstalmentCount } from '@/lib/instalmentOptions';
import { getVehiclePriceFactor } from '@/lib/pricing/vehicleFactorModel';
import { logPriceOverride } from '@/lib/pricing/logPriceOverride';
import { getNetPayableFloor } from '@/lib/pricing/netFloor';
import { getSoldVsReference } from '@/lib/pricing/soldVsReference';
import { resolveHighestQuotedTotal } from '@/lib/pricing/quotedTotalLookup';


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Dialog removed — page now renders inline as a full workflow (no modal)
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithFreshSession } from '@/lib/invokeWithFreshSession';
import { 
  Loader2, Search, CheckCircle2, UserCheck, AlertCircle, 
  CalendarIcon, CreditCard, Car, Info, Zap, ArrowRight, Edit, UserPlus
} from 'lucide-react';
import { format, isToday, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { DuplicateWarrantyDialog } from './DuplicateWarrantyDialog';
import { LeadSearchPopover, LeadData } from './LeadSearchPopover';
import { AddressAutocomplete, AddressData } from '@/components/ui/address-autocomplete';
import { 
  calculateAdminQuoteWarrantyPrice, 
  DURATION_MONTHS,
  type PaymentPeriod 
} from '@/lib/pricingMatrix';
import { getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { CLAIM_LIMIT_TIERS, isPremiumVehicle, getBlockedClaimLimits, getBaseClaimLimit, getClaimLimitSurcharge } from '@/lib/claimLimitTiers';
import FreeMonthsOptions, { bonusMonthsForOption, type FreeCoverOption } from './quote/FreeMonthsOptions';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useIsManagement } from '@/hooks/useIsManagement';
import { useConfirmPaymentPriceBlock } from '@/hooks/useConfirmPaymentPriceBlock';
import { useDiscountAuthRequests } from '@/hooks/useDiscountAuthRequests';
import { useAuth } from '@/hooks/useAuth';
import { BaseFloorNotice } from '@/components/admin/pricing/BaseFloorNotice';


interface VehicleData {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  vehicleType?: string;
}

interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

// Step 3 exact options
const termOptions = [
  { id: '12months', label: '1-Year Cover', months: 12, bonus: 3 },
  { id: '24months', label: '2-Year Cover', months: 24, bonus: 3, isPopular: true },
  { id: '36months', label: '3-Year Cover', months: 36, bonus: 3, isBestValue: true }
];

const excessOptions = [0, 50, 100, 150, 250, 500];

// Note: AutoCare Basic (£1,000 / internal 750) removed — no longer offered
const claimLimitOptions = [
  { value: 2000, label: '£2,000', description: 'AutoCare Essential' },
  { value: 3000, label: '£3,000', description: 'AutoCare Elite' },
  { value: 5000, label: '£5,000', description: 'AutoCare Premium' },
];

/** Removes any claim limit management has blocked for this vehicle. */
const getVisibleClaimLimits = (vehicle?: {
  make?: string | null;
  model?: string | null;
  fuelType?: string | null;
  registration?: string | null;
}) => {
  const blocked = getBlockedClaimLimits(vehicle || {});
  return claimLimitOptions.filter(opt => !blocked.includes(opt.value));
};

const labourRateOptions = [
  { rate: 50, label: '£50/hr', description: 'Local Garages', isBestValue: true },
  { rate: 70, label: '£70/hr', description: 'Independent Garages', isPopular: true },
  { rate: 100, label: '£100/hr', description: 'Approved Garages' },
  { rate: 150, label: '£150/hr', description: 'Specialist garages' }
];

// Mileage dropdown options
const mileageDropdownOptions = Array.from({ length: 131 }, (_, i) => 10000 + (i * 1000));

interface ConfirmExternalPaymentTabProps {
  onPaymentConfirmed?: () => void;
}

export const ConfirmExternalPaymentTab: React.FC<ConfirmExternalPaymentTabProps> = ({ onPaymentConfirmed }) => {
  const { toast } = useToast();
  const { isManagement } = useIsManagement();
  const isManagementRole = isManagement === true;
  const { user } = useAuth();
  const { myApproved: approvedAuthRequest } = useDiscountAuthRequests();
  const { enabled: priceBlockEnabled } = useConfirmPaymentPriceBlock();
  const [authReason, setAuthReason] = useState('');
  const [authSent, setAuthSent] = useState(false);
  const [sendingAuth, setSendingAuth] = useState(false);

  // ---------------------------------------------------------------------------
  // Price match route out of a blocked confirmation.
  // An agent stuck under the floor / over the 30% ceiling has two ways forward:
  // upload evidence of a competitor quote (self-serve, max 10% cheaper than the
  // competitor), or ask management to authorise it. Same rules and the same
  // storage bucket as the Quotes & Orders price match.
  // ---------------------------------------------------------------------------
  const PRICE_MATCH_MAX_PCT = 10;
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
  const [blockRoute, setBlockRoute] = useState<'none' | 'price_match' | 'manager'>('none');
  const [pmCompany, setPmCompany] = useState('');
  const [pmOtherName, setPmOtherName] = useState('');
  const [pmPrice, setPmPrice] = useState('');
  const [pmProofPath, setPmProofPath] = useState<string | null>(null);
  const [pmProofName, setPmProofName] = useState<string | null>(null);
  const [pmUploading, setPmUploading] = useState(false);
  // Every confirmation must answer this: was the sale a price match? If yes the
  // competitor file has to be attached AND the agent has to tick that they have
  // received and checked it before the payment can be confirmed.
  const [pmIsPriceMatch, setPmIsPriceMatch] = useState<'unset' | 'yes' | 'no'>('unset');
  const [pmFileConfirmed, setPmFileConfirmed] = useState(false);

  const pmCompetitorName = (pmCompany === 'Other' ? pmOtherName : pmCompany).trim();
  const pmCompetitorPrice = (() => {
    const v = Math.round(parseFloat(String(pmPrice).replace(/[^0-9.]/g, '')));
    return Number.isFinite(v) && v > 0 ? v : null;
  })();
  /** Lowest price an evidenced match may reach: 10% under the competitor. */
  const pmFloor = pmCompetitorPrice
    ? Math.round(pmCompetitorPrice * (1 - PRICE_MATCH_MAX_PCT / 100))
    : null;

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
    setPmUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const objectPath = `price-match/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('price-comparison-proofs')
        .upload(objectPath, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      if (pmProofPath && pmProofPath !== objectPath) {
        await supabase.storage.from('price-comparison-proofs').remove([pmProofPath]);
      }
      setPmProofPath(objectPath);
      setPmProofName(file.name);
      toast({ title: 'Evidence uploaded', description: 'Saved against the customer when you confirm the payment.' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setPmUploading(false);
    }
  };



  
  // Vehicle lookup state
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [sliderMileage, setSliderMileage] = useState(0);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  
  // Customer details - split into first/last name
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  
  // Assignee
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string>('');
  const currentAdminId = useCurrentAdminId();
  
  // Policy configuration
  const [paymentType, setPaymentType] = useState<PaymentPeriod>('24months');
  // Instalment plan is separate from cover duration: 2-year = 12 or 24, 3-year = 12 or 36.
  const [instalmentCount, setInstalmentCount] = useState<InstalmentCount>(12);
  useEffect(() => {
    // 36 instalments is visible but disabled (Coming Soon), so never let it be selected.
    if (!isInstalmentAllowed(paymentType, instalmentCount) || isInstalmentComingSoon(instalmentCount)) setInstalmentCount(12);
  }, [paymentType, instalmentCount]);
  const [excessAmount, setExcessAmount] = useState(100);
  const [claimLimit, setClaimLimit] = useState(2000);
  const [labourRate, setLabourRate] = useState(70);
  const [boostAddon, setBoostAddon] = useState(false);
  const [freeExtendedCover, setFreeExtendedCover] = useState<FreeCoverOption>('none');
  const [isEditingPolicyConfig, setIsEditingPolicyConfig] = useState(false);
  
  // Payment confirmation state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; record?: any }>({ show: false });
  const [paymentSource, setPaymentSource] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [warrantyStartDate, setWarrantyStartDate] = useState<Date>(new Date());
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [existingPolicyWarning, setExistingPolicyWarning] = useState<string | null>(null);
  const [externalPaymentStep, setExternalPaymentStep] = useState<'details' | 'preview' | 'complete'>('details');
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  
  // Address fields
  const [customerPostcode, setCustomerPostcode] = useState('');
  const [customerStreet, setCustomerStreet] = useState('');
  const [customerTown, setCustomerTown] = useState('');
  const [customerBuildingNumber, setCustomerBuildingNumber] = useState('');
  const [customerCounty, setCustomerCounty] = useState('');
  
  // Address fields stay hidden until an address is picked from postcode lookup (or manual entry)
  const [showAddressFields, setShowAddressFields] = useState(false);
  
  // Editable fields for dialog
  const [editableFirstName, setEditableFirstName] = useState('');
  const [editableLastName, setEditableLastName] = useState('');
  const [editableCustomerEmail, setEditableCustomerEmail] = useState('');
  const [editableCustomerPhone, setEditableCustomerPhone] = useState('');
  const [editableMileage, setEditableMileage] = useState('');
  const [editableRegNumber, setEditableRegNumber] = useState('');
  
  // Part payment (deposit now, balance to follow)
  const [partPaymentMode, setPartPaymentMode] = useState(false);
  const [depositAmountInput, setDepositAmountInput] = useState('');
  const [depositDueDate, setDepositDueDate] = useState('');

  // Options
  const [sendToW2k, setSendToW2k] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  
  // Completion status
  const [completionStatus, setCompletionStatus] = useState<{
    policy?: boolean;
    customer?: boolean;
    w2k?: boolean;
    email?: boolean;
    loginVerified?: boolean;
    emailError?: string | null;
  }>({});

  // Fetch admin users for assignee dropdown
  useEffect(() => {
    const fetchAdminUsers = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get current user's admin_users.id
        const { data: currentAdmin } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (currentAdmin) {
          setCurrentAdminUserId(currentAdmin.id);
        }
      }

      // Only sales agents can be credited with a sale: accounts@/support@/info@
      // and managers confirm on an agent's behalf and must pick that agent.
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role')
        .in('role', ['sales', 'sales_lead'])
        .eq('is_active', true)
        .order('first_name');

      if (data) {
        setAdminUsers(data);
        // Default to self only when the signed-in user is a sales agent.
        const { data: { user: me } } = await supabase.auth.getUser();
        if (me) {
          const { data: mine } = await supabase
            .from('admin_users')
            .select('id, role')
            .eq('user_id', me.id)
            .maybeSingle();
          if (mine && (mine.role === 'sales' || mine.role === 'sales_lead')) {
            setAssigneeId(mine.id);
          }
        }
      }
    };
    fetchAdminUsers();
  }, []);
  // Reset claim limit if premium vehicle selected and £5000 was chosen
  useEffect(() => {
    const blocked = getBlockedClaimLimits({
      make: vehicleData?.make,
      model: vehicleData?.model,
      fuelType: vehicleData?.fuelType,
      registration: regNumber,
    });
    if (blocked.includes(claimLimit)) {
      setClaimLimit(2000);
    }
  }, [vehicleData?.make, vehicleData?.model, vehicleData?.fuelType, regNumber, claimLimit]);

  // Calculate price
  const effectiveClaimLimit = getBaseClaimLimit(claimLimit);
  const premiumSurcharge = getClaimLimitSurcharge(claimLimit, paymentType, excessAmount);
  const currentPrice = vehicleData ? calculateAdminQuoteWarrantyPrice({
    paymentPeriod: paymentType,
    voluntaryExcess: excessAmount,
    claimLimit: effectiveClaimLimit,
    labourRate: labourRate,
    boostEnabled: boostAddon,
    addOnPrice: premiumSurcharge,
    make: vehicleData?.make,
    fuelType: vehicleData?.fuelType,
    vehicleFactor: getVehiclePriceFactor({
      year: vehicleData?.year,
      mileage: mileage,
      fuelType: vehicleData?.fuelType,
      vehicleType: (vehicleData as any)?.vehicleType,
    }),
  }) : { totalPrice: 0, monthlyPrice: 0 };

  // LONGER PLAN BASE = the 1-YEAR price. Price the same cover over 12 months so the
  // 24/36 instalment plans can be set at 2.22× / 3.51× that figure.
  const oneYearPrice = vehicleData ? calculateAdminQuoteWarrantyPrice({
    paymentPeriod: '12months',
    voluntaryExcess: excessAmount,
    claimLimit: effectiveClaimLimit,
    labourRate: labourRate,
    boostEnabled: boostAddon,
    addOnPrice: getClaimLimitSurcharge(claimLimit, '12months', excessAmount),
    make: vehicleData?.make,
    fuelType: vehicleData?.fuelType,
    vehicleFactor: getVehiclePriceFactor({
      year: vehicleData?.year,
      mileage: mileage,
      fuelType: vehicleData?.fuelType,
      vehicleType: (vehicleData as any)?.vehicleType,
    }),
  }) : { totalPrice: 0, monthlyPrice: 0 };
  const longPlanRatio = oneYearRatio(oneYearPrice.totalPrice, currentPrice.totalPrice);

  // ── Hard 30% discount ceiling ───────────────────────────────────────────────
  // Confirming an outside payment must never be a back door around the discount
  // cap enforced on Get a quote. Anything more than 30% below the quoted grid
  // price is blocked unless the person confirming is Management.
  const DISCOUNT_CEILING_PCT = 30;
  const enteredAmount = parseFloat(paymentAmount);
  const quotedTotal = currentPrice.totalPrice;
  const discountPct =
    quotedTotal > 0 && Number.isFinite(enteredAmount) && enteredAmount < quotedTotal
      ? ((quotedTotal - enteredAmount) / quotedTotal) * 100
      : 0;
  // NET payable floor — £349 / £769 / £1,099 (12/24/36mo), shaped by the options
  // chosen and halved for motorbikes. Confirming a manual payment used to have no
  // floor at all, so this closes the biggest under-floor leak. Management may go
  // below (logged to price_override_audit).
  const netFloorAmount = getNetPayableFloor({
    paymentPeriod: paymentType,
    voluntaryExcess: excessAmount,
    claimLimit: effectiveClaimLimit,
    labourRate,
    isMotorbike: /motor\s*(bike|cycle)|\bbike\b/i.test(String((vehicleData as any)?.vehicleType || '')),
    surface: 'admin',
  });
  // Kept for reference/display only — no longer used to block a confirmation.
  const ceilingMinAmount = quotedTotal > 0
    ? Math.round(quotedTotal * (1 - DISCOUNT_CEILING_PCT / 100) * 100) / 100
    : 0;
  void ceilingMinAmount;

  // Sales staff may confirm ANY amount down to the absolute net floor — the 30%
  // ceiling no longer blocks a confirmation here, it only flags the discount.
  const minAllowedAmount = netFloorAmount;
  const overDiscountCeiling = discountPct > DISCOUNT_CEILING_PCT + 0.01;

  const underNetFloor = Number.isFinite(enteredAmount) && enteredAmount > 0 && enteredAmount < netFloorAmount - 0.01;
  // A manager-approved authorisation for this vehicle lifts the block up to the
  // price they approved (agents no longer hit a dead end).
  const hasApprovedAuth =
    !!approvedAuthRequest &&
    String(approvedAuthRequest.registration_plate || '').replace(/\s/g, '').toUpperCase() ===
      String(editableRegNumber || regNumber || '').replace(/\s/g, '').toUpperCase() &&
    Number.isFinite(enteredAmount) &&
    enteredAmount >= Number(approvedAuthRequest.requested_price || 0) - 0.01;
  // An evidenced price match also lifts the block: competitor named, their price
  // entered, proof uploaded, and the amount no more than 10% under their quote.
  const priceMatchReady =
    blockRoute === 'price_match' &&
    !!pmCompetitorName &&
    !!pmCompetitorPrice &&
    !!pmProofPath &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > 0 &&
    pmFloor !== null &&
    enteredAmount >= pmFloor - 0.01;
  const priceMatchApplied = priceMatchReady && !isManagementRole;
  // The Confirm payment price block is OFF by default (Lead Allocation → Confirm
  // payment price block). While it is off, EVERY sales agent can confirm an
  // external payment at any amount — nothing here stops them. Only when
  // management switch it on does the absolute net floor (£349/£769/£1,099, half for
  // motorbikes) block a confirmation; discounts above 30% are always allowed,
  // flagged and logged.
  const discountBlocked =
    priceBlockEnabled && underNetFloor && !isManagementRole && !hasApprovedAuth && !priceMatchReady;



  /**
   * Price match gate — runs on every confirmation regardless of discount.
   * Returns a blocking message, or null when we are clear to proceed.
   */
  const priceMatchGate = (): { title: string; description: string } | null => {
    if (pmIsPriceMatch === 'unset') {
      return {
        title: 'Price match check needed',
        description: 'Tell us whether this sale was a price match — answer Yes or No under Payment details.',
      };
    }
    if (pmIsPriceMatch === 'yes') {
      if (!pmProofPath) {
        return {
          title: 'Price match file required',
          description: 'Upload the competitor quote (image or PDF) for this price match before confirming the payment.',
        };
      }
      if (!pmFileConfirmed) {
        return {
          title: 'Confirm the price match file',
          description: 'Tick to confirm you have received and checked the price match file, then confirm the payment.',
        };
      }
    }
    return null;
  };






  const formatRegNumber = (value: string): string => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (clean.length <= 4) return clean;
    return clean.slice(0, 4) + ' ' + clean.slice(4);
  };

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const formatted = rawValue ? parseInt(rawValue, 10).toLocaleString() : '';
    setMileage(formatted);
    setSliderMileage(rawValue ? parseInt(rawValue, 10) : 0);
  };

  const handleLeadSelect = (lead: LeadData) => {
    setSelectedLeadId(lead.id);
    if (lead.vehicle_reg) setRegNumber(formatRegNumber(lead.vehicle_reg));
    if (lead.email) setCustomerEmail(lead.email);
    // Many leads store the whole name in first_name with last_name empty.
    // Split it so the agent isn't blocked by "Customer Details Required".
    const leadFirst = (lead.first_name || '').trim();
    const leadLast = (lead.last_name || '').trim();
    if (!leadLast && leadFirst.includes(' ')) {
      const parts = leadFirst.split(/\s+/);
      setCustomerFirstName(parts[0]);
      setCustomerLastName(parts.slice(1).join(' '));
    } else {
      if (leadFirst) setCustomerFirstName(leadFirst);
      if (leadLast) setCustomerLastName(leadLast);
    }
    if (lead.phone) setCustomerPhone(lead.phone);
    if (lead.mileage) {
      setMileage(parseInt(lead.mileage.replace(/\D/g, ''), 10).toLocaleString());
      setSliderMileage(parseInt(lead.mileage.replace(/\D/g, ''), 10));
    }
    
    // Auto-lookup vehicle if reg exists
    if (lead.vehicle_reg) {
      setRegNumber(formatRegNumber(lead.vehicle_reg));
      // Trigger lookup after a short delay
      setTimeout(() => handleVehicleLookup(lead.vehicle_reg), 100);
    }
    
    toast({
      title: "Lead Imported",
      description: `Imported data for ${[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email}`,
    });
  };

  const handleVehicleLookup = async (regToLookup?: string) => {
    const reg = regToLookup || regNumber;
    if (!reg.trim()) {
      toast({
        title: "Missing Registration",
        description: "Please enter a registration number",
        variant: "destructive",
      });
      return;
    }

    setIsLookingUp(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: reg.replace(/\s/g, '') }
      });
      
      clearTimeout(timeoutId);

      if (error) {
        console.error('DVLA lookup error:', error);
        toast({
          title: "Lookup Failed",
          description: error.message || "Unable to connect to vehicle database. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data?.error || !data?.make || !data?.model) {
        toast({
          title: "Vehicle Not Found",
          description: data?.error || "Unable to find vehicle details. Please check the registration.",
          variant: "destructive",
        });
        return;
      }

      // Check vehicle age
      if (data.yearOfManufacture || data.year) {
        const currentYear = new Date().getFullYear();
        const vehicleYear = parseInt(data.yearOfManufacture || data.year, 10);
        if (!isNaN(vehicleYear) && vehicleYear > 0) {
          const vehicleAge = currentYear - vehicleYear;
          if (vehicleAge > 15) {
            toast({
              title: "Vehicle Too Old",
              description: `This vehicle is ${vehicleAge} years old. We only cover vehicles up to 15 years old.`,
              variant: "destructive",
            });
            return;
          }
        }
      }

      setVehicleData({
        regNumber: reg.toUpperCase(),
        mileage: mileage || '0',
        make: data.make,
        model: data.model,
        fuelType: data.fuelType || '',
        transmission: data.transmission || '',
        year: data.yearOfManufacture || data.year || '',
        vehicleType: data.vehicleType || '',
      });
      
      toast({
        title: "Vehicle Found",
        description: `${data.make} ${data.model} (${data.yearOfManufacture || data.year})`,
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
      setIsLookingUp(false);
    }
  };

  const handleOpenConfirmDialog = async () => {
    if (!vehicleData) {
      toast({
        title: "Vehicle Required",
        description: "Please look up a vehicle first",
        variant: "destructive",
      });
      return;
    }

    const missingCustomerFields = [
      !customerFirstName.trim() && 'first name',
      !customerLastName.trim() && 'last name',
      !customerEmail.trim() && 'email',
      !customerPhone.trim() && 'phone number',
    ].filter(Boolean) as string[];

    if (missingCustomerFields.length > 0) {
      toast({
        title: "Customer details required",
        description: `Please add the customer's ${missingCustomerFields.join(', ')} — the lead record doesn't have ${missingCustomerFields.length === 1 ? 'it' : 'them'}.`,
        variant: "destructive",
      });
      return;
    }

    // Check for an existing live policy on THIS vehicle only. Orders are keyed
    // by registration plate, so the same customer can hold two orders at once
    // on different vehicles without a clash warning.
    setExistingPolicyWarning(null);
    const normalizedReg = (vehicleData.regNumber || '').toUpperCase().replace(/\s/g, '');
    const { data: sameRegCustomers } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerEmail.toLowerCase())
      .eq('registration_plate', normalizedReg);

    if (sameRegCustomers && sameRegCustomers.length > 0) {
      const { data: existingPolicy } = await supabase
        .from('customer_policies')
        .select('id, policy_number, status')
        .in('customer_id', sameRegCustomers.map(c => c.id))
        .eq('status', 'active')
        .maybeSingle();

      if (existingPolicy) {
        setExistingPolicyWarning(
          `Warning: this customer already has an active policy (${existingPolicy.policy_number}) on ${vehicleData.regNumber}. Creating another one for the same vehicle may cause issues.`
        );
      }
    }


    // Pre-fill editable fields
    setEditableFirstName(customerFirstName);
    setEditableLastName(customerLastName);
    setEditableCustomerEmail(customerEmail);
    setEditableCustomerPhone(customerPhone);
    setEditableMileage(mileage.replace(/,/g, ''));
    setEditableRegNumber(vehicleData.regNumber);
    setPaymentAmount(currentPrice.totalPrice.toString());
    setExternalPaymentStep('details');
    setShowConfirmDialog(true);
  };

  const handleProceedToPreview = () => {
    if (!editableFirstName.trim() || !editableLastName.trim()) {
      toast({
        title: "Full name required",
        description: "Please enter both the customer's first name and last name.",
        variant: "destructive",
      });
      return;
    }

    // Name, email and phone are the minimum needed to confirm a payment.
    const missingContact = [
      !editableCustomerEmail.trim() && 'email address',
      !editableCustomerPhone.trim() && 'phone number',
    ].filter(Boolean) as string[];
    if (missingContact.length > 0) {
      toast({
        title: "Contact details required",
        description: `Please add the customer's ${missingContact.join(' and ')} before confirming the payment.`,
        variant: "destructive",
      });
      document.getElementById(!editableCustomerEmail.trim() ? 'confirm-email-field' : 'confirm-phone-field')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }


    const missingAddress = [
      !customerBuildingNumber.trim() && 'house/building number',
      !customerStreet.trim() && 'street',
      !customerTown.trim() && 'town/city',
      !customerPostcode.trim() && 'postcode',
    ].filter(Boolean);
    if (missingAddress.length > 0) {
      toast({
        title: "Address required",
        description: `Please complete: ${missingAddress.join(', ')}.`,
        variant: "destructive",
      });
      return;
    }

    if (!paymentSource || !paymentAmount) {
      toast({
        title: "Payment source and amount are required",
        description: !paymentSource
          ? "Select where the payment was taken (Stripe, Bumper, Payment Assist, bank transfer…) before confirming."
          : "Enter the amount actually received before confirming.",
        variant: "destructive",
      });
      document
        .getElementById(!paymentSource ? 'payment-source-field' : 'payment-amount-field')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }


    const pmGateSubmit = priceMatchGate();
    if (pmGateSubmit) {
      toast({ ...pmGateSubmit, variant: 'destructive' });
      document.getElementById('price-match-check')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }



    if (discountBlocked) {
      toast({
        title: `Below the minimum sellable price`,
        description: `£${enteredAmount.toFixed(2)} is under the £${netFloorAmount.toFixed(2)} floor for this cover. Contact management to authorise anything lower.`,
        variant: "destructive",
      });
      return;
    }


    // CRITICAL: Sales agent is compulsory for commission tracking
    if (!assigneeId) {
      toast({
        title: "Sales Agent Required",
        description: "Please select a sales agent before confirming. This is required for commission tracking.",
        variant: "destructive",
      });
      return;
    }
    
    setExternalPaymentStep('preview');
  };

  const handleConfirmPayment = async () => {
    // Prevent double-click race condition
    if (isConfirming) return;

    // Minimum customer record: full name, email and phone.
    if (!editableFirstName.trim() || !editableLastName.trim() || !editableCustomerEmail.trim() || !editableCustomerPhone.trim()) {
      toast({
        title: "Name, email and phone required",
        description: "Add the customer's full name, email address and phone number before confirming the payment.",
        variant: "destructive",
      });
      setExternalPaymentStep('details');
      return;
    }

    // Full address is required before a policy can be created.
    const missingAddress = [
      !customerBuildingNumber.trim() && 'house/building number',
      !customerStreet.trim() && 'street',
      !customerTown.trim() && 'town/city',
      !customerPostcode.trim() && 'postcode',
    ].filter(Boolean);
    if (missingAddress.length > 0) {
      toast({
        title: "Address required",
        description: `Please complete: ${missingAddress.join(', ')}.`,
        variant: "destructive",
      });
      setExternalPaymentStep('details');
      return;
    }

    // Price match journey: answered, file uploaded and confirmed as received.
    const pmGate = priceMatchGate();
    if (pmGate) {
      toast({ ...pmGate, variant: 'destructive' });
      return;
    }

    // Hard stop: never create a policy more than 30% below the quoted price, and
    // never below the absolute net floor (£349/£769/£1,099 shaped), unless
    // Management are the ones confirming it.
    if (discountBlocked) {
      toast({
        title: `Blocked — contact management`,
        description: underNetFloor
          ? `£${enteredAmount.toFixed(2)} is below the minimum sellable price of £${netFloorAmount.toFixed(2)} for this cover. You cannot confirm this payment — contact management to authorise it.`
          : `${discountPct.toFixed(1)}% off exceeds the ${DISCOUNT_CEILING_PCT}% limit. You cannot confirm this payment — contact management to authorise it. Minimum allowed here is £${minAllowedAmount.toFixed(2)}.`,
        variant: "destructive",
      });
      return;
    }

    setIsConfirming(true);

    // Check for duplicate warranty before proceeding
    const { checkDuplicateWarranty } = await import('@/lib/duplicateWarrantyCheck');
    const duplicateCheck = await checkDuplicateWarranty(editableRegNumber, editableCustomerEmail);
    if (duplicateCheck.isDuplicate) {
      setDuplicateWarning({ show: true, record: duplicateCheck.existingRecord });
      setIsConfirming(false);
      return;
    }
    setCompletionStatus({});
    
    try {
      const termOption = termOptions.find(t => t.id === paymentType);
      const coverMonths = termOption?.months || 12;
      const bonusMonths = bonusMonthsForOption(
        freeExtendedCover,
        Math.round((DURATION_MONTHS[paymentType] || 12) / 12)
      );
      const displayClaimLimit = boostAddon ? claimLimit + 1000 : claimLimit;
      const fullName = `${editableFirstName} ${editableLastName}`.trim();

      const { data, error } = await invokeWithFreshSession('confirm-external-payment', {
          customerName: fullName,
          customerFirstName: editableFirstName,
          customerLastName: editableLastName,
          customerEmail: editableCustomerEmail,
          customerPhone: editableCustomerPhone,
          vehicleReg: editableRegNumber,
          vehicleMake: vehicleData?.make,
          vehicleModel: vehicleData?.model,
          vehicleYear: vehicleData?.year,
          vehicleFuelType: vehicleData?.fuelType,
          vehicleTransmission: vehicleData?.transmission,
          mileage: editableMileage,
          paymentType,
          claimLimit: displayClaimLimit,
          labourRate,
          excessAmount,
          boostAddon,
          finalAmount: parseFloat(paymentAmount),
          paymentSource,
          assigneeId: assigneeId || null,
          warrantyStartDate: format(warrantyStartDate, 'yyyy-MM-dd'),
          durationMonths: coverMonths,
          bonusMonths,
          sendToW2k,
          sendWelcomeEmail,
          skipAddressDetails: false,
          address: {
            buildingNumber: customerBuildingNumber,
            street: customerStreet,
            town: customerTown,
            county: customerCounty,
            postcode: customerPostcode,
          },
      });

      if (error) throw error;

      // Record the discount given on this manual confirmation. Confirming an
      // outside payment IS the moment the discount is agreed, so we store the
      // quoted grid price alongside the amount collected — Discounts given and
      // Customer management both read these two numbers.
      if (data?.customerId && quotedTotal > 0) {
        const collected = parseFloat(paymentAmount) || 0;
        // The discount the agent actually gave is measured against the price the
        // customer was FIRST quoted, not against a grid price recalculated at
        // confirmation time (config tweaks like labour rate can quietly shrink it).
        // So take the highest quoted total logged for this reg in the last 14 days.
        // Every quote on record for this plate (price logs and quotes emailed to
        // the customer), whatever spacing the plate was saved with. The highest
        // one wins, so a real discount is never saved as zero.
        let effectiveQuoted = await resolveHighestQuotedTotal(
          editableRegNumber,
          Math.round(quotedTotal * 100) / 100
        );


        // Validation: the recorded quote can never sit below the Quotes & Orders
        // grid price for these exact options, so a low figure can't quietly zero
        // out the discount an agent gave.
        const gridReference = getSoldVsReference({
            registration_plate: editableRegNumber,
            vehicle_make: vehicleData?.make ?? null,
            vehicle_model: vehicleData?.model ?? null,
            vehicle_fuel_type: vehicleData?.fuelType ?? null,
            vehicle_year: vehicleData?.year ?? null,
            vehicle_type: (vehicleData as any)?.vehicleType ?? null,
            mileage: mileage ?? null,
            payment_type: paymentType,
            voluntary_excess: excessAmount,
            claim_limit: claimLimit,
            labour_rate: labourRate,
            final_amount: collected || quotedTotal,
        });
        if (gridReference && gridReference.qop > effectiveQuoted) {
          effectiveQuoted = Math.round(gridReference.qop * 100) / 100;
        }
        const givenAway = Math.max(0, Math.round((effectiveQuoted - collected) * 100) / 100);


        try {
          await supabase
            .from('customers')
            .update({
              original_amount: effectiveQuoted,
              discount_amount: givenAway,
              // Point-of-sale record used for commissions and the Customers tab
              // discount column — never re-derived from a later price change.
              sale_quoted_total: effectiveQuoted,
              sale_discount_amount: givenAway,
              sale_discount_pct: effectiveQuoted > 0 ? Math.round((givenAway / effectiveQuoted) * 1000) / 10 : 0,

              sale_price_basis: 'agent_quote',
              // Evidenced price match used to get under the floor / ceiling —
              // stored so Customer management and Vehicle intelligence show it.
              ...((priceMatchReady || (pmIsPriceMatch === 'yes' && pmProofPath))
                ? {
                    price_comparison_proof_url: pmProofPath,
                    price_match_applied: true,
                    price_match_competitor: pmCompetitorName || null,
                    price_match_competitor_price: pmCompetitorPrice,
                    price_match_our_price: collected || null,
                  }
                : {}),
            })
            .eq('id', data.customerId);

        } catch (discErr) {
          console.error('Failed to record discount on manual confirmation:', discErr);
        }

        if (givenAway > 0.5 || underNetFloor) {
          logPriceOverride({
            adminUserId: assigneeId || null,
            context: 'confirm_payment',
            customerName: fullName,
            customerEmail: editableCustomerEmail,
            vehicleReg: editableRegNumber,
            vehicleMake: vehicleData?.make,
            vehicleModel: vehicleData?.model,
            paymentType,
            excessAmount,
            claimLimit: displayClaimLimit,
            labourRate,
            matrixTotal: quotedTotal,
            enteredTotal: collected,
            notes: [
              `Manual payment confirmed via ${paymentSource || 'outside route'} — ${discountPct.toFixed(1)}% off`,
              underNetFloor && !priceMatchReady
                ? `MANAGEMENT OVERRIDE — below the £${netFloorAmount.toFixed(2)} net floor for this cover`
                : '',
              priceMatchReady
                ? `PRICE MATCH — ${pmCompetitorName} £${pmCompetitorPrice} (evidence: ${pmProofName || 'uploaded'})`
                : '',

            ].filter(Boolean).join(' · '),
          });
        }

      }

      // Part payment: open a plan + log the deposit so the balance is chased
      if (partPaymentMode && data?.customerId) {
        try {
          const totalDue = parseFloat(paymentAmount) || currentPrice.totalPrice;
          const depositValue = parseFloat(depositAmountInput) || 0;
          await supabase.from('customer_part_payment_plans').upsert(
            {
              customer_id: data.customerId,
              total_due: totalDue,
              next_due_date: depositDueDate || null,
              status: 'in_progress',
              reminder_enabled: true,
              reminder_note: `Deposit taken — chase £${Math.max(0, totalDue - depositValue).toFixed(2)} balance`,
            } as any,
            { onConflict: 'customer_id' },
          );

          if (depositValue > 0) {
            await supabase.from('customer_part_payments').insert({
              customer_id: data.customerId,
              amount: depositValue,
              payment_method: paymentSource || 'other',
              paid_on: new Date().toISOString().slice(0, 10),
              notes: 'Deposit taken at Confirm External Payment',
              recorded_by: (await supabase.auth.getUser()).data?.user?.id ?? null,
            } as any);
          }
        } catch (ppErr) {
          console.error('Part payment plan creation failed:', ppErr);
        }
      }



      setCompletionStatus({
        policy: data?.policyCreated,
        customer: data?.customerCreated,
        w2k: data?.w2kSent,
        email: data?.emailSent,
        loginVerified: data?.loginVerified,
        emailError: data?.emailError ?? null,
      });

      if (sendWelcomeEmail && !data?.emailSent) {
        toast({
          title: "Welcome email and login not sent",
          description: data?.emailError || "Use Resend welcome email on the customer record to send their login details.",
          variant: "destructive",
        });
      }
      
      setExternalPaymentStep('complete');
      onPaymentConfirmed?.();
      
      toast({
        title: "Payment Confirmed!",
        description: `Policy created for ${fullName}`,
      });
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to confirm payment",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const resetForm = () => {
    setRegNumber('');
    setMileage('');
    setSliderMileage(0);
    setVehicleData(null);
    setCustomerFirstName('');
    setCustomerLastName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setSelectedLeadId(null);
    setPaymentType('24months');
    setExcessAmount(100);
    setClaimLimit(2000);
    setLabourRate(70);
    setBoostAddon(false);
    setFreeExtendedCover('none');
    setPaymentSource('');
    setPaymentAmount('');
    setExternalPaymentStep('details');
    setCompletionStatus({});
    setShowConfirmDialog(false);
    setAssigneeId(currentAdminUserId);
  };

  const getAdminDisplayName = (admin: AdminUser) => {
    const name = [admin.first_name, admin.last_name].filter(Boolean).join(' ');
    return name || admin.email.split('@')[0];
  };

  // ============================================================
  // INLINE PAGE FLOW (no modal): 'form' → 'details' → 'preview' → 'complete'
  // The state machine `externalPaymentStep` + `showConfirmDialog` is preserved
  // so all handlers and API calls work exactly as before.
  // ============================================================
  const inPaymentFlow = showConfirmDialog;

  return (
    <>
      <DuplicateWarrantyDialog
        isOpen={duplicateWarning.show}
        onClose={() => setDuplicateWarning({ show: false })}
        record={duplicateWarning.record}
      />

      <div className="min-h-screen bg-slate-50/60 -m-4 md:-m-6 lg:-m-8 p-4 md:p-8 lg:p-10">
        <div className="max-w-6xl mx-auto">
          {/* Page header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-primary" />
                Confirm External Payment
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {inPaymentFlow
                  ? externalPaymentStep === 'details'
                    ? 'Step 2: Verify details and enter payment information'
                    : externalPaymentStep === 'preview'
                      ? 'Step 3: Review all data before creating the policy'
                      : 'Done — policy created'
                  : 'Step 1: Find the vehicle and configure the policy'}
              </p>
            </div>
            {!inPaymentFlow && (
              <div className="flex items-center gap-2">
                {selectedLeadId && (
                  <Badge variant="secondary" className="gap-1">
                    <UserCheck className="h-3 w-3" />
                    Lead imported
                  </Badge>
                )}
                <LeadSearchPopover onSelectLead={handleLeadSelect} />
              </div>
            )}
            {inPaymentFlow && externalPaymentStep !== 'complete' && (
              <Button
                variant="outline"
                onClick={() => { setShowConfirmDialog(false); setExternalPaymentStep('details'); }}
              >
                ← Back to edit
              </Button>
            )}
          </div>

          {/* ============================================================
              STEP 1 — Form (vehicle + customer + policy)
              ============================================================ */}
          {!inPaymentFlow && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6">
                {/* Yellow reg-plate hero */}
                <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <Label className="block text-sm font-semibold text-slate-700 mb-3">
                    Vehicle Registration
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="relative w-full sm:w-auto">
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-[70%] bg-[#003399] rounded-[2px] pointer-events-none z-10" />
                      <Input
                        value={regNumber}
                        onChange={(e) => setRegNumber(formatRegNumber(e.target.value))}
                        placeholder="AB12 CDE"
                        maxLength={8}
                        className="bg-[#FFD307] border-2 border-slate-900 rounded-md py-4 pl-8 pr-6 text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-widest placeholder:text-slate-900/30 text-center w-full sm:w-[260px] shadow-[3px_3px_0px_0px_rgba(0,0,0,0.15)] focus-visible:ring-2 focus-visible:ring-[#FFD307] focus-visible:ring-offset-2"
                        style={{ fontFamily: '"UKNumberPlate", "Arial Narrow", sans-serif' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full">
                      <Button
                        onClick={() => handleVehicleLookup()}
                        disabled={isLookingUp || !regNumber.trim()}
                        size="lg"
                        className="gap-2"
                      >
                        {isLookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Look up vehicle
                      </Button>
                      <p className="text-xs text-slate-500 self-center">
                        Or use <span className="font-medium text-slate-700">Import existing lead</span> above to pre-fill everything.
                      </p>
                    </div>
                  </div>

                  {vehicleData && (
                    <div className="mt-4 p-4 bg-emerald-50/60 border border-emerald-200/70 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Car className="h-4 w-4 text-emerald-700" />
                        <span className="font-semibold text-emerald-900 text-sm">Vehicle found</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-slate-700">
                        <div><span className="text-slate-500">Make:</span> <span className="font-medium">{vehicleData.make}</span></div>
                        <div><span className="text-slate-500">Model:</span> <span className="font-medium">{vehicleData.model}</span></div>
                        <div><span className="text-slate-500">Year:</span> <span className="font-medium">{vehicleData.year}</span></div>
                        <div><span className="text-slate-500">Fuel:</span> <span className="font-medium">{vehicleData.fuelType}</span></div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Customer details */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer details</h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">First Name *</Label>
                      <Input value={customerFirstName} onChange={(e) => setCustomerFirstName(e.target.value)} placeholder="John" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">Last Name *</Label>
                      <Input value={customerLastName} onChange={(e) => setCustomerLastName(e.target.value)} placeholder="Smith" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">Email *</Label>
                      <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="john@example.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">Phone</Label>
                      <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07xxx xxxxxx" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">Mileage</Label>
                      <div className="flex gap-2">
                        <Input type="text" inputMode="numeric" value={mileage} onChange={handleMileageChange} placeholder="e.g. 45000" className="flex-1" />
                        <Select
                          value={sliderMileage.toString()}
                          onValueChange={(value) => {
                            const numValue = parseInt(value, 10);
                            setSliderMileage(numValue);
                            setMileage(numValue.toLocaleString());
                          }}
                        >
                          <SelectTrigger className="w-[110px]"><SelectValue placeholder="Quick" /></SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {mileageDropdownOptions.map((miles) => (
                              <SelectItem key={miles} value={miles.toString()}>{miles.toLocaleString()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5" /> Assign to sales agent
                      </Label>
                      <Select value={assigneeId} onValueChange={setAssigneeId}>
                        <SelectTrigger><SelectValue placeholder="Select agent..." /></SelectTrigger>
                        <SelectContent>
                          {adminUsers.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {getAdminDisplayName(admin)}{admin.id === currentAdminUserId && ' (You)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                {/* Policy configuration */}
                {vehicleData && (
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-primary" /> Policy configuration
                      </h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">Plan</Label>
                        <Input value="Platinum" readOnly className="bg-slate-100 text-slate-600 cursor-not-allowed" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">Duration</Label>
                        <Select value={paymentType} onValueChange={(v) => setPaymentType(v as PaymentPeriod)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {termOptions.map((opt) => (<SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      {getInstalmentOptions(paymentType).length > 1 && (
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs font-semibold text-slate-500">Instalment plan</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {getInstalmentOptions(paymentType).map((count) => {
                              const comingSoon = isInstalmentComingSoon(count);
                              return (
                                <button
                                  key={count}
                                  type="button"
                                  disabled={comingSoon}
                                  onClick={() => !comingSoon && setInstalmentCount(count)}
                                  className={cn(
                                    "rounded-lg border-2 p-3 text-left transition-all relative",
                                    comingSoon
                                      ? "border-dashed border-slate-300 bg-slate-50 cursor-not-allowed"
                                      : instalmentCount === count
                                        ? "border-indigo-500 bg-indigo-50"
                                        : "border-slate-200 bg-white hover:border-indigo-300"
                                  )}
                                >
                                  {comingSoon && (
                                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                                      <Badge className="bg-amber-500 text-white hover:bg-amber-500 text-[10px] px-2 py-0.5">
                                        Coming Soon
                                      </Badge>
                                    </div>
                                  )}
                                  <div className={cn("text-sm font-semibold", comingSoon ? "text-slate-600" : "text-slate-800")}>
                                    {count} instalments
                                  </div>
                                  <div className={cn("text-xs font-medium", comingSoon ? "text-slate-500" : "text-slate-900")}>
                                    {comingSoon
                                      ? "Not active yet"
                                      : `£${instalmentAmount(currentPrice.totalPrice, count, longPlanRatio)}/mo · £${instalmentPlanTotal(currentPrice.totalPrice, count, longPlanRatio)} total`}
                                  </div>
                                  {!comingSoon && count !== 12 && (
                                    <div className="text-[11px] font-semibold text-amber-700">
                                      +£{instalmentPlanTotal(currentPrice.totalPrice, count, longPlanRatio) - Math.round(Number(currentPrice.totalPrice) || 0)} vs 12-instalment plan
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Spreading the payments over 24 or 36 months costs more than the 12-instalment plan.
                          </p>
                          {instalmentCount !== 12 && (
                            <p className="text-[11px] font-semibold text-amber-700">{BUMPER_LONG_PLAN_NOTE}</p>
                          )}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">Excess</Label>
                        <Select value={excessAmount.toString()} onValueChange={(v) => setExcessAmount(parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {excessOptions.map((opt) => (<SelectItem key={opt} value={opt.toString()}>£{opt}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">Claim Limit</Label>
                        <Select value={claimLimit.toString()} onValueChange={(v) => setClaimLimit(parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {getVisibleClaimLimits({
                              make: vehicleData?.make,
                              model: vehicleData?.model,
                              fuelType: vehicleData?.fuelType,
                              registration: regNumber,
                            }).map((opt) => (
                              <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label} — {opt.description}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(paymentType === '24months' || paymentType === '36months') && (
                          <p className="text-xs text-emerald-600 font-medium">✨ Free upgrade to £2,000 on multi-year plans</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">Labour Rate</Label>
                        <Select value={labourRate.toString()} onValueChange={(v) => setLabourRate(parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {labourRateOptions.map((opt) => (<SelectItem key={opt.rate} value={opt.rate.toString()}>{opt.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-semibold text-slate-500">Optional Extended Cover</Label>
                        <FreeMonthsOptions
                          value={freeExtendedCover}
                          onChange={setFreeExtendedCover}
                          coverYears={Math.round((DURATION_MONTHS[paymentType] || 12) / 12)}
                          adminUserId={currentAdminId}
                          hideHeader
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-center gap-3">
                          <Info className="w-4 h-4 text-indigo-500" />
                          <span className="text-sm text-indigo-700 font-medium">
                            Included Add-ons:{' '}
                            {getAutoIncludedAddOns(paymentType).length > 0
                              ? getAutoIncludedAddOns(paymentType).map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')
                              : 'None'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Sticky summary */}
              <aside className="lg:sticky lg:top-6 space-y-4">
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
                  <h3 className="text-base font-bold mb-5">Policy Summary</h3>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-start">
                      <span className="text-slate-400 text-sm">Vehicle</span>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{vehicleData ? `${vehicleData.make} ${vehicleData.model}` : '—'}</p>
                        {vehicleData && <p className="text-xs text-slate-500 uppercase">{vehicleData.regNumber}</p>}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Plan</span>
                      <span className="font-semibold">Platinum ({termOptions.find(t => t.id === paymentType)?.label.replace(' Cover','')})</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Claim Limit</span>
                      <span className="font-semibold text-emerald-400">£{claimLimit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Excess</span>
                      <span className="font-semibold">£{excessAmount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Labour</span>
                      <span className="font-semibold">£{labourRate}/hr</span>
                    </div>
                    <div className="pt-4 border-t border-slate-800">
                      <div className="flex justify-between items-end">
                        <span className="text-slate-400 text-sm">Total Due</span>
                        <span className="text-3xl font-bold">£{currentPrice.totalPrice}</span>
                      </div>
                      {currentPrice.monthlyPrice > 0 && (
                        <p className="text-xs text-slate-500 text-right mt-1">
                          £{instalmentCount === 12 ? currentPrice.monthlyPrice : instalmentAmount(currentPrice.totalPrice, instalmentCount, longPlanRatio)}/month
                          {' '}× {instalmentCount} instalments
                          {instalmentCount !== 12 && ` · £${instalmentPlanTotal(currentPrice.totalPrice, instalmentCount, longPlanRatio)} total on Bumper`}
                        </p>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const missing: string[] = [];
                    if (!vehicleData) missing.push('vehicle lookup');
                    if (!customerFirstName) missing.push('first name');
                    if (!customerLastName) missing.push('last name');
                    if (!customerEmail) missing.push('email address');
                    return (
                      <>
                        <Button
                          onClick={handleOpenConfirmDialog}
                          disabled={missing.length > 0}
                          title={missing.length > 0 ? `Add: ${missing.join(', ')}` : undefined}
                          className="w-full py-6 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl shadow-lg disabled:opacity-100 disabled:bg-slate-700 disabled:text-slate-300"
                        >
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Confirm External Payment
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                        {missing.length > 0 ? (
                          <p className="text-center text-amber-300 text-xs mt-3 font-semibold">
                            ⚠️ Still needed before you can activate: {missing.join(', ')}
                          </p>
                        ) : (
                          <p className="text-center text-slate-500 text-xs mt-3">
                            Activates the policy and emails the customer.
                          </p>
                        )}
                      </>
                    );
                  })()}

                </div>
              </aside>
            </div>
          )}

          {/* ============================================================
              STEP 2 — Details (the former dialog "details" step)
              ============================================================ */}
          {inPaymentFlow && externalPaymentStep === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6">
                {existingPolicyWarning && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{existingPolicyWarning}</AlertDescription>
                  </Alert>
                )}

                {/* Customer & vehicle */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-primary" /> Customer & Vehicle
                    </h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">First Name <span className="text-destructive">*</span></Label>
                      <Input value={editableFirstName} onChange={(e) => setEditableFirstName(e.target.value)} className={!editableFirstName.trim() ? 'border-destructive focus-visible:ring-destructive' : ''} />
                      {!editableFirstName.trim() && <p className="text-[11px] text-destructive">First name is required</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">Last Name <span className="text-destructive">*</span></Label>
                      <Input value={editableLastName} onChange={(e) => setEditableLastName(e.target.value)} className={!editableLastName.trim() ? 'border-destructive focus-visible:ring-destructive' : ''} />
                      {!editableLastName.trim() && <p className="text-[11px] text-destructive">Last name is required</p>}
                    </div>

                    <div className="space-y-1.5" id="confirm-email-field">
                      <Label className="text-xs font-semibold text-slate-500">Email <span className="text-destructive">*</span></Label>
                      <Input type="email" value={editableCustomerEmail} onChange={(e) => setEditableCustomerEmail(e.target.value)} className={!editableCustomerEmail.trim() ? 'border-destructive focus-visible:ring-destructive' : ''} />
                      {!editableCustomerEmail.trim() && <p className="text-[11px] text-destructive">Email address is required</p>}
                    </div>
                    <div className="space-y-1.5" id="confirm-phone-field">
                      <Label className="text-xs font-semibold text-slate-500">Phone <span className="text-destructive">*</span></Label>
                      <Input type="tel" value={editableCustomerPhone} onChange={(e) => setEditableCustomerPhone(e.target.value)} placeholder="07xxx xxxxxx" className={!editableCustomerPhone.trim() ? 'border-destructive focus-visible:ring-destructive' : ''} />
                      {!editableCustomerPhone.trim() && <p className="text-[11px] text-destructive">Phone number is required</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">Registration *</Label>
                      <Input value={editableRegNumber} onChange={(e) => setEditableRegNumber(e.target.value.toUpperCase())} className="font-mono uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">Mileage</Label>
                      <Input value={editableMileage} onChange={(e) => setEditableMileage(e.target.value.replace(/\D/g, ''))} />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500">Vehicle</Label>
                      <Input value={`${vehicleData?.make ?? ''} ${vehicleData?.model ?? ''} (${vehicleData?.year ?? ''})`} readOnly className="bg-slate-100 text-slate-600" />
                    </div>
                  </div>
                </section>

                {/* Address */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer Address <span className="text-destructive">*</span></h2>
                  </div>
                  <div className="p-6">
                    {true ? (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold text-slate-900">Postcode, street or town <span className="text-destructive">*</span></Label>
                          <AddressAutocomplete
                            placeholder="e.g. SW1A 1AA or High Street, Bath"
                            className={!customerPostcode.trim() ? 'border-2 border-destructive focus-visible:ring-destructive' : ''}
                            onAddressSelect={(address: AddressData) => {
                              if (address.building_number) setCustomerBuildingNumber(address.building_number);
                              if (address.line_1) setCustomerStreet(address.line_1);
                              if (address.town) setCustomerTown(address.town);
                              if (address.county) setCustomerCounty(address.county);
                              if (address.postcode) setCustomerPostcode(address.postcode.toUpperCase());
                              setShowAddressFields(true);
                            }}
                          />
                          {!customerPostcode.trim() && (
                            <p className="text-xs text-destructive">Address is required — search and select the customer's address.</p>
                          )}
                        </div>
                        {!showAddressFields && (
                          <button
                            type="button"
                            onClick={() => setShowAddressFields(true)}
                            className="text-sm font-semibold text-slate-900 hover:underline"
                          >
                            Enter your address manually
                          </button>
                        )}
                        {showAddressFields && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">House/Building Number <span className="text-destructive">*</span></Label>
                            <Input value={customerBuildingNumber} onChange={(e) => setCustomerBuildingNumber(e.target.value)} className={!customerBuildingNumber.trim() ? 'border-destructive focus-visible:ring-destructive' : ''} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Street <span className="text-destructive">*</span></Label>
                            <Input value={customerStreet} onChange={(e) => setCustomerStreet(e.target.value)} className={!customerStreet.trim() ? 'border-destructive focus-visible:ring-destructive' : ''} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Town/City <span className="text-destructive">*</span></Label>
                            <Input value={customerTown} onChange={(e) => setCustomerTown(e.target.value)} className={!customerTown.trim() ? 'border-destructive focus-visible:ring-destructive' : ''} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">County</Label>
                            <Input value={customerCounty} onChange={(e) => setCustomerCounty(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Postcode <span className="text-destructive">*</span></Label>
                            <Input value={customerPostcode} onChange={(e) => setCustomerPostcode(e.target.value.toUpperCase())} className={`uppercase ${!customerPostcode.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
                          </div>
                        </div>
                        )}
                        <p className="text-[11px] text-destructive">A full address is required to confirm the payment.</p>
                      </div>
                    ) : null}
                  </div>
                </section>

                {/* Payment */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-primary" /> Payment details
                    </h2>
                  </div>
                  <div className="p-6 space-y-5">
                    <div className="space-y-1.5" id="payment-source-field">
                      <Label className="text-xs font-semibold text-slate-500">
                        Payment Source <span className="text-destructive">*</span>
                      </Label>
                      <select
                        value={paymentSource}
                        onChange={(e) => setPaymentSource(e.target.value)}
                        required
                        aria-required="true"
                        aria-invalid={!paymentSource}
                        className={cn(
                          'w-full px-3 py-2 border rounded-md bg-white text-slate-900',
                          !paymentSource
                            ? 'border-2 border-destructive ring-1 ring-destructive'
                            : 'border-slate-300',
                        )}
                      >
                        <option value="">Select payment source...</option>
                        <option value="stripe_dashboard">Stripe Dashboard</option>
                        <option value="bumper_portal">Bumper Portal</option>
                        <option value="payment_assist">Payment Assist</option>
                        <option value="klarna">Klarna</option>
                        <option value="ivendi">iVendi</option>
                        <option value="zopa">Zopa</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="phone_card">Phone Card Payment</option>
                        <option value="dealer_portal">Dealer Portal</option>
                        <option value="google">Google</option>
                        <option value="facebook">Facebook</option>
                        <option value="other">Other</option>
                      </select>
                      {!paymentSource && (
                        <p className="text-xs font-semibold text-destructive">
                          Required — we must record where the payment was taken.
                        </p>
                      )}
                    </div>




                    {/* Staff-only pricing summary — never emailed or shown to the
                        customer. Gives the agent the quoted grid price, what they
                        are actually taking, and the discount that implies. */}
                    {(() => {
                      const given = Number.isFinite(enteredAmount) && enteredAmount > 0 ? enteredAmount : quotedTotal;
                      const discAmount = Math.max(0, quotedTotal - given);
                      const discPct = quotedTotal > 0 ? (discAmount / quotedTotal) * 100 : 0;
                      return (
                        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                              Staff view only — not sent to the customer
                            </p>
                            <Badge variant="outline" className="border-amber-400 text-amber-900 bg-white">
                              Internal
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <p className="text-[11px] font-semibold text-amber-800">Quote &amp; order price</p>
                              <p className="text-lg font-bold text-slate-900">£{quotedTotal.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-amber-800">Price given</p>
                              <p className="text-lg font-bold text-slate-900">£{given.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-amber-800">Discount given</p>
                              <p className={cn('text-lg font-bold', discAmount > 0 ? 'text-destructive' : 'text-slate-900')}>
                                £{discAmount.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-amber-800">Discount %</p>
                              <p className={cn('text-lg font-bold', discPct > DISCOUNT_CEILING_PCT ? 'text-destructive' : 'text-slate-900')}>
                                {discPct.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          {discPct > DISCOUNT_CEILING_PCT && (
                            <p className="text-xs font-semibold text-destructive mt-2">
                              Over the {DISCOUNT_CEILING_PCT}% ceiling — management authorisation required.
                            </p>
                          )}
                        </div>
                      );
                    })()}



                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5" id="payment-amount-field">
                        <Label className="text-xs font-semibold text-slate-500">
                          Amount Received (£) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder={currentPrice.totalPrice.toString()}
                          required
                          aria-required="true"
                          aria-invalid={!paymentAmount || discountBlocked}
                          className={cn(
                            (discountBlocked || !paymentAmount) &&
                              'border-2 border-destructive ring-1 ring-destructive',
                          )}
                        />
                        {!paymentAmount && (
                          <p className="text-xs font-semibold text-destructive">
                            Required — enter the amount actually taken.
                          </p>
                        )}
                        {paymentAmount && Math.abs(parseFloat(paymentAmount) - currentPrice.totalPrice) > 1 && (
                          <p className="text-xs text-destructive">⚠️ Differs from quoted price (£{currentPrice.totalPrice})</p>
                        )}


                        {/* Minimum sale price notice — always on, so the floor is never a
                            surprise after the amount is typed. Turns red once breached. */}
                        <div
                          className={cn(
                            'rounded-md border px-2.5 py-2 text-xs font-semibold',
                            underNetFloor
                              ? 'border-destructive bg-destructive/5 text-destructive'
                              : priceMatchReady && enteredAmount < netFloorAmount
                                ? 'border-sky-300 bg-sky-50 text-sky-900'
                                : 'border-slate-300 bg-slate-50 text-slate-700'
                          )}
                        >
                          Minimum sale price for this cover £{netFloorAmount.toFixed(2)} —{' '}
                          {paymentType.replace('months', ' month')} · £{effectiveClaimLimit} claim limit · £
                          {excessAmount} excess · £{labourRate}/hr labour
                          {underNetFloor ? (
                            <span className="block font-bold">
                              £{Number.isFinite(enteredAmount) ? enteredAmount.toFixed(2) : '0.00'} is below it — this
                              payment cannot be confirmed. Upload price match evidence or contact management.
                            </span>
                          ) : priceMatchReady && enteredAmount < netFloorAmount ? (
                            <span className="block">Allowed: evidenced price match on file.</span>
                          ) : (
                            <span className="block font-normal">
                              This figure moves with the term, claim limit, excess and labour rate: base £399 (1 year),
                              £769 (2 year), £1,099 (3 year), shaped up for richer cover and halved for motorbikes.
                              Whatever discount is applied, nothing can be confirmed below the figure shown.
                            </span>
                          )}
                        </div>

                        {/* Same staff-only base floor + discount rules as Get a quote */}
                        <BaseFloorNotice showDiscountNote className="mt-2" />


                        {discountBlocked && (
                          <p className="text-xs font-semibold text-destructive">
                            {`Blocked — £${netFloorAmount.toFixed(2)} is the minimum sellable price for this cover (${paymentType.replace('months', ' month')} term). Contact management to authorise anything lower.`}
                          </p>
                        )}

                        {!discountBlocked && overDiscountCeiling && !isManagementRole && (
                          <p className="text-xs font-semibold text-amber-700">
                            {discountPct.toFixed(1)}% off — above the {DISCOUNT_CEILING_PCT}% guideline. You can still
                            confirm it; the discount is recorded against your name for management review.
                          </p>
                        )}



                        {discountBlocked && blockRoute === 'none' && (
                          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
                            <p className="text-xs font-semibold text-slate-600">
                              Is this a price match? Choose how to get this signed off:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => setBlockRoute('price_match')}>
                                Upload price match evidence
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setBlockRoute('manager')}>
                                Contact management
                              </Button>
                            </div>
                          </div>
                        )}

                        {discountBlocked && blockRoute === 'price_match' && (
                          <div className="space-y-2 rounded-lg border border-amber-400/60 bg-amber-50 p-2.5">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-amber-700">Price match evidence</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => setBlockRoute('none')}
                              >
                                Back
                              </Button>
                            </div>
                            <Select
                              value={pmCompany}
                              onValueChange={(v) => { setPmCompany(v); if (v !== 'Other') setPmOtherName(''); }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Which competitor?" />
                              </SelectTrigger>
                              <SelectContent>
                                {PRICE_MATCH_COMPETITORS.map((c) => (
                                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {pmCompany === 'Other' && (
                              <Input
                                value={pmOtherName}
                                onChange={(e) => setPmOtherName(e.target.value)}
                                placeholder="Competitor name"
                                className="h-8 text-xs"
                              />
                            )}
                            <Input
                              type="number"
                              value={pmPrice}
                              onChange={(e) => setPmPrice(e.target.value)}
                              placeholder="Their quoted price (£)"
                              className="h-8 text-xs"
                            />
                            <div className="space-y-1">
                              <Input
                                type="file"
                                accept="image/*,application/pdf"
                                disabled={pmUploading}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handlePriceMatchUpload(f);
                                }}
                                className="h-8 text-xs"
                              />
                              {pmUploading && (
                                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                                </p>
                              )}
                              {pmProofName && !pmUploading && (
                                <p className="text-xs font-semibold text-emerald-600">✅ {pmProofName} attached</p>
                              )}
                            </div>
                            {pmFloor !== null && (
                              <p className="text-xs text-amber-700">
                                Lowest allowed against a £{pmCompetitorPrice} quote is <strong>£{pmFloor}</strong> (max {PRICE_MATCH_MAX_PCT}% cheaper).
                              </p>
                            )}
                            <p className="text-xs text-slate-500">
                              Competitor, their price and the uploaded quote are all needed before this unlocks. No evidence? Use Contact management instead.
                            </p>
                            {/* Self-verification: the agent confirms their own uploaded
                                evidence and unlocks the confirmation, no manager needed. */}
                            <div className="space-y-1.5 rounded-md border border-amber-300 bg-white p-2">
                              <p className="text-[11px] font-semibold text-slate-600">
                                Verify it yourself — upload above, then submit this confirmation:
                              </p>
                              <ul className="text-[11px] text-slate-500 space-y-0.5">
                                <li>{pmCompetitorName ? '✅' : '⬜'} Competitor selected</li>
                                <li>{pmCompetitorPrice ? '✅' : '⬜'} Their quoted price entered</li>
                                <li>{pmProofPath ? '✅' : '⬜'} Competitor quote uploaded</li>
                                <li>
                                  {pmFloor !== null && Number.isFinite(enteredAmount) && enteredAmount >= pmFloor - 0.01
                                    ? '✅'
                                    : '⬜'}{' '}
                                  Amount within {PRICE_MATCH_MAX_PCT}% of their price
                                </li>
                              </ul>
                              <Button
                                size="sm"
                                className="h-7 w-full text-xs font-semibold"
                                disabled={!priceMatchReady || pmUploading}
                                onClick={() => {
                                  setPmIsPriceMatch('yes');
                                  setPmFileConfirmed(true);
                                  toast({
                                    title: 'Price match verified',
                                    description: `Evidence accepted (${pmCompetitorName} £${pmCompetitorPrice}). You can now confirm this payment.`,
                                  });
                                }}
                              >
                                Submit &amp; confirm evidence
                              </Button>
                              {priceMatchReady && pmFileConfirmed && (
                                <p className="text-[11px] font-semibold text-emerald-600">
                                  ✅ Verified — continue to Review &amp; Confirm.
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => setBlockRoute('manager')}
                            >
                              Contact management instead
                            </Button>
                          </div>
                        )}

                        {discountBlocked && blockRoute === 'manager' && (
                          authSent ? (
                            <p className="text-xs font-semibold text-amber-600">
                              Sent for authorisation — management have been alerted. This button unlocks as soon as they approve it.
                            </p>
                          ) : (
                            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-600">Manager authorisation</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => setBlockRoute('none')}
                                >
                                  Back
                                </Button>
                              </div>
                              <Input
                                value={authReason}
                                onChange={(e) => setAuthReason(e.target.value)}
                                placeholder="Reason for manager (e.g. price match, goodwill)"
                                className="h-8 text-xs"
                              />

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={sendingAuth || !authReason.trim()}
                                onClick={async () => {
                                  setSendingAuth(true);
                                  try {
                                    const { error } = await supabase.from('discount_auth_requests').insert({
                                      requested_by_user_id: user?.id,
                                      requested_by_name: user?.email || 'Agent',
                                      registration_plate: (editableRegNumber || regNumber).toUpperCase(),
                                      mileage: mileage || null,
                                      vehicle_description: vehicleData
                                        ? `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim() || null
                                        : null,
                                      customer_name:
                                        [customerFirstName, customerLastName].filter(Boolean).join(' ') || null,
                                      base_price: Math.round(quotedTotal),
                                      requested_price: Math.round(enteredAmount),
                                      discount_pct: Number(discountPct.toFixed(1)),
                                      payment_type: paymentType,
                                      reason: `External payment confirmation — ${authReason.trim()}`,
                                    });
                                    if (error) throw error;
                                    setAuthSent(true);
                                    toast({
                                      title: 'Sent for authorisation',
                                      description: 'Management have been alerted and will approve or decline.',
                                    });
                                  } catch (e: any) {
                                    toast({ title: 'Could not send request', description: e?.message, variant: 'destructive' });
                                  } finally {
                                    setSendingAuth(false);
                                  }
                                }}
                              >
                                {sendingAuth ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : null}
                                Request manager authorisation
                              </Button>
                            </div>
                          )
                        )}

                        {hasApprovedAuth && (overDiscountCeiling || underNetFloor) && (
                          <p className="text-xs font-semibold text-emerald-600">
                            ✅ Authorised by {approvedAuthRequest?.decided_by_name || 'management'} — you can confirm this payment.
                          </p>
                        )}

                        {priceMatchReady && (overDiscountCeiling || underNetFloor) && (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2">
                            <p className="text-xs font-semibold text-emerald-700">
                              ✅ Price match evidenced — {pmCompetitorName} £{pmCompetitorPrice} ({pmProofName}). You can confirm this payment.
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => { setPmProofPath(null); setPmProofName(null); }}
                            >
                              Change evidence
                            </Button>
                          </div>
                        )}




                        {underNetFloor && isManagementRole && (
                          <p className="text-xs font-semibold text-amber-600">
                            Management override: below the £{netFloorAmount.toFixed(2)} minimum sellable price. This will be logged.
                          </p>
                        )}

                        {overDiscountCeiling && isManagementRole && (
                          <p className="text-xs font-semibold text-amber-600">
                            Management override: {discountPct.toFixed(1)}% off (over the {DISCOUNT_CEILING_PCT}% ceiling). This will be logged.

                          </p>
                        )}

                        {/* Price match check — required on every confirmation */}
                        <div id="price-match-check" className="space-y-2 rounded-lg border-2 border-sky-300 bg-sky-50/70 p-3">
                          <p className="text-xs font-bold text-sky-900">
                            Was this sale a price match? *
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={pmIsPriceMatch === 'yes' ? 'default' : 'outline'}
                              className="h-7 text-xs font-semibold"
                              onClick={() => { setPmIsPriceMatch('yes'); setBlockRoute('price_match'); }}
                            >
                              Yes — price match
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={pmIsPriceMatch === 'no' ? 'default' : 'outline'}
                              className="h-7 text-xs font-semibold"
                              onClick={() => { setPmIsPriceMatch('no'); setPmFileConfirmed(false); }}
                            >
                              No — normal sale
                            </Button>
                          </div>

                          {pmIsPriceMatch === 'yes' && (
                            <div className="space-y-2 pt-1">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Select
                                  value={pmCompany}
                                  onValueChange={(v) => { setPmCompany(v); if (v !== 'Other') setPmOtherName(''); }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-white">
                                    <SelectValue placeholder="Which competitor?" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRICE_MATCH_COMPETITORS.map((c) => (
                                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  value={pmPrice}
                                  onChange={(e) => setPmPrice(e.target.value)}
                                  placeholder="Their quoted price (£)"
                                  className="h-8 text-xs bg-white"
                                />
                              </div>
                              {pmCompany === 'Other' && (
                                <Input
                                  value={pmOtherName}
                                  onChange={(e) => setPmOtherName(e.target.value)}
                                  placeholder="Competitor name"
                                  className="h-8 text-xs bg-white"
                                />
                              )}
                              <div className="space-y-1">
                                <Label className="text-[11px] font-semibold text-sky-900">
                                  Price match file (competitor quote — image or PDF) *
                                </Label>
                                <Input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  disabled={pmUploading}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handlePriceMatchUpload(f);
                                  }}
                                  className="h-8 text-xs bg-white"
                                />
                                {pmUploading && (
                                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                                  </p>
                                )}
                                {pmProofName && !pmUploading ? (
                                  <p className="text-xs font-semibold text-emerald-700">✅ {pmProofName} attached</p>
                                ) : (
                                  !pmUploading && (
                                    <p className="text-xs font-bold text-amber-800">
                                      ⚠️ Upload the price match file before you can confirm this payment.
                                    </p>
                                  )
                                )}
                              </div>
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={pmFileConfirmed}
                                  disabled={!pmProofPath}
                                  onChange={(e) => setPmFileConfirmed(e.target.checked)}
                                  className="mt-0.5 h-4 w-4"
                                />
                                <span className="text-xs font-semibold text-sky-900">
                                  I confirm I have received and checked this price match file, and the price agreed
                                  matches the competitor quote attached.
                                </span>
                              </label>
                              <p className="text-[11px] text-sky-800">
                                The file is saved to this customer's record in Customer management as soon as the payment is confirmed.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" /> Warranty Start Date *
                        </Label>
                        <Popover open={isStartDateCalendarOpen} onOpenChange={setIsStartDateCalendarOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start font-normal">
                              {format(warrantyStartDate, 'd MMM yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={warrantyStartDate}
                              onSelect={(date) => {
                                if (date) setWarrantyStartDate(date);
                                setIsStartDateCalendarOpen(false);
                              }}
                              disabled={(date) => date < new Date()}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Part payment (deposit now, balance to follow) */}
                    <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 space-y-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={partPaymentMode}
                          onChange={(e) => setPartPaymentMode(e.target.checked)}
                          className="mt-1"
                        />
                        <span className="text-sm font-semibold text-amber-900">
                          Part payment (deposit now, balance to follow)
                          <span className="block text-xs font-normal text-amber-800">
                            Opens a plan in Customer Management → Part Payments and logs this deposit.
                          </span>
                        </span>
                      </label>
                      {partPaymentMode && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-amber-900">Deposit taken now (£)</Label>
                            <Input
                              type="number"
                              value={depositAmountInput}
                              onChange={(e) => setDepositAmountInput(e.target.value)}
                              placeholder="e.g. 200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-amber-900">Balance due date</Label>
                            <Input
                              type="date"
                              value={depositDueDate}
                              onChange={(e) => setDepositDueDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-amber-900">Outstanding balance</Label>
                            <div className="h-10 flex items-center px-3 rounded-md bg-white border border-amber-300 font-semibold text-amber-900">
                              £{Math.max(0, (parseFloat(paymentAmount) || currentPrice.totalPrice) - (parseFloat(depositAmountInput) || 0)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>


                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5" /> Assign to Sales Agent *
                      </Label>
                      <Select value={assigneeId} onValueChange={setAssigneeId}>
                        <SelectTrigger className={!assigneeId ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Select sales agent (required)..." />
                        </SelectTrigger>
                        <SelectContent>
                          {adminUsers.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>{getAdminDisplayName(admin)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!assigneeId && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Sales agent is required for commission tracking
                        </p>
                      )}
                      {assigneeId && (
                        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                          This sale will be credited to{' '}
                          <strong>
                            {adminUsers.find(a => a.id === assigneeId)
                              ? getAdminDisplayName(adminUsers.find(a => a.id === assigneeId)!)
                              : 'the selected agent'}
                          </strong>{' '}
                          — not to whoever is confirming the payment.
                        </p>
                      )}
                    </div>


                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox id="welcome" checked={sendWelcomeEmail} onCheckedChange={(c) => setSendWelcomeEmail(c === true)} />
                      <Label htmlFor="welcome" className="cursor-pointer text-sm">Send Welcome Email</Label>
                    </div>
                  </div>
                </section>

                <div className="sticky bottom-0 z-20 -mx-1 px-1 py-3 bg-white/95 backdrop-blur border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
                  {discountBlocked && (
                    <span className="text-xs font-semibold text-destructive mr-auto">
                      Blocked: minimum you can confirm yourself is £{minAllowedAmount.toFixed(2)}
                    </span>
                  )}
                  <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
                  <Button onClick={handleProceedToPreview} size="lg" disabled={discountBlocked} title={discountBlocked ? 'Blocked — contact management to authorise this discount' : undefined}>{discountBlocked ? 'Contact management to confirm' : <>Review & Confirm <ArrowRight className="w-4 h-4 ml-2" /></>}</Button>
                </div>

              </div>

              {/* Sticky summary (mirrors form view) */}
              <aside className="lg:sticky lg:top-6">
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
                  <h3 className="text-base font-bold mb-5">Policy Summary</h3>
                  <div className="space-y-3 mb-2">
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Vehicle</span><span className="font-semibold">{vehicleData?.make} {vehicleData?.model}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Reg</span><span className="font-semibold uppercase">{editableRegNumber}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Plan</span><span className="font-semibold">Platinum</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Duration</span><span className="font-semibold">{termOptions.find(t => t.id === paymentType)?.label}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Claim Limit</span><span className="font-semibold text-emerald-400">£{claimLimit.toLocaleString()}</span></div>
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Total Due</span>
                        {!isEditingPrice ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const base = parseFloat(paymentAmount) || currentPrice.totalPrice;
                                const discounted = Math.round(base * 0.9 * 100) / 100;
                                if (!isManagementRole && quotedTotal > 0 && discounted < minAllowedAmount) {
                                  toast({
                                    title: `${DISCOUNT_CEILING_PCT}% discount ceiling reached`,
                                    description: `The lowest price you can confirm is £${minAllowedAmount.toFixed(2)}. Contact management to authorise anything lower.`,
                                    variant: 'destructive',
                                  });
                                  setPaymentAmount(minAllowedAmount.toString());
                                  return;
                                }
                                setPaymentAmount(discounted.toString());
                              }}
                              className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 font-semibold"
                              title="Apply 10% discount to current price"
                            >
                              -10%
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingPrice(true)}
                              className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" /> Edit price
                            </button>
                          </div>

                        ) : (
                          <button
                            type="button"
                            onClick={() => { setPaymentAmount(currentPrice.totalPrice.toString()); setIsEditingPrice(false); }}
                            className="text-xs text-slate-400 hover:text-slate-200"
                          >
                            Reset to £{currentPrice.totalPrice}
                          </button>
                        )}
                      </div>
                      {isEditingPrice ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 border border-indigo-500/40">
                            <span className="text-2xl font-bold text-slate-300">£</span>
                            <Input
                              type="number"
                              step="0.01"
                              autoFocus
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              onBlur={() => setIsEditingPrice(false)}
                              onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingPrice(false); }}
                              className="h-10 text-2xl font-bold bg-transparent border-0 text-white p-0 focus-visible:ring-0"
                            />
                          </div>
                          {paymentAmount && Math.abs(parseFloat(paymentAmount) - currentPrice.totalPrice) > 1 && (
                            <p className="text-[11px] text-amber-300">
                              Manual override — quoted price is £{currentPrice.totalPrice}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-between items-end">
                          <span className="text-xs text-slate-500">
                            {paymentAmount && Math.abs(parseFloat(paymentAmount) - currentPrice.totalPrice) > 1
                              ? `Overridden (quoted £${currentPrice.totalPrice})`
                              : 'Matches quoted price'}
                          </span>
                          <span className="text-3xl font-bold">£{paymentAmount || currentPrice.totalPrice}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </aside>
            </div>
          )}

          {/* ============================================================
              STEP 3 — Preview
              ============================================================ */}
          {inPaymentFlow && externalPaymentStep === 'preview' && (
            <div className="max-w-3xl mx-auto space-y-5">
              <Alert className="bg-indigo-50 border-indigo-200">
                <Info className="h-4 w-4 text-indigo-600" />
                <AlertDescription className="text-slate-700">
                  Please review all details before confirming. This will create a policy and customer record.
                </AlertDescription>
              </Alert>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><strong>Customer:</strong> {editableFirstName} {editableLastName}</div>
                  <div><strong>Email:</strong> {editableCustomerEmail}</div>
                  <div><strong>Vehicle:</strong> {editableRegNumber}</div>
                  <div><strong>Mileage:</strong> {editableMileage ? parseInt(editableMileage.replace(/\D/g, ''), 10).toLocaleString() : '—'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-slate-100">
                  <div><strong>Duration:</strong> {termOptions.find(t => t.id === paymentType)?.label}</div>
                  <div><strong>Claim Limit:</strong> £{claimLimit.toLocaleString()}</div>
                  <div><strong>Start Date:</strong> {format(warrantyStartDate, 'd MMM yyyy')}</div>
                  <div><strong>Amount:</strong> £{paymentAmount}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-slate-100">
                  <div><strong>Payment Source:</strong> {paymentSource}</div>
                  <div><strong>Assigned To:</strong> {adminUsers.find(a => a.id === assigneeId) ? getAdminDisplayName(adminUsers.find(a => a.id === assigneeId)!) : 'Unassigned'}</div>
                </div>
              </div>

              {discountBlocked && (
                <div className="p-4 rounded-lg border-2 border-destructive bg-destructive/10 text-sm font-semibold text-destructive">
                  Cannot confirm this payment — £{enteredAmount.toFixed(2)} is {discountPct.toFixed(1)}% off the quoted £{quotedTotal}.
                  Please contact management to authorise it. The lowest you can confirm yourself is £{minAllowedAmount.toFixed(2)}.
                </div>
              )}

              <div className="sticky bottom-0 z-20 -mx-1 px-1 py-3 bg-white/95 backdrop-blur border-t border-slate-200 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setExternalPaymentStep('details')}>Back</Button>
                <Button onClick={handleConfirmPayment} disabled={isConfirming || discountBlocked} size="lg" className="bg-indigo-500 hover:bg-indigo-400" title={discountBlocked ? 'Blocked — contact management to authorise this discount' : undefined}>
                  {isConfirming ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Policy...</>
                  ) : discountBlocked ? (
                    <>Contact management to confirm</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" />Confirm Payment</>
                  )}
                </Button>
              </div>

            </div>
          )}

          {/* ============================================================
              STEP 4 — Complete
              ============================================================ */}
          {inPaymentFlow && externalPaymentStep === 'complete' && (
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-slate-900">Payment Confirmed!</h3>
              <p className="text-slate-500 mt-1">Policy has been created successfully</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-8 text-left">
                <div className={cn("p-3 rounded-lg border flex items-center gap-2", completionStatus.customer ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200")}>
                  <CheckCircle2 className={cn("w-4 h-4", completionStatus.customer ? "text-emerald-600" : "text-slate-400")} />
                  <span>Customer Record</span>
                </div>
                <div className={cn("p-3 rounded-lg border flex items-center gap-2", completionStatus.policy ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200")}>
                  <CheckCircle2 className={cn("w-4 h-4", completionStatus.policy ? "text-emerald-600" : "text-slate-400")} />
                  <span>Policy Created</span>
                </div>
                {sendWelcomeEmail && (
                  <div className={cn("p-3 rounded-lg border flex items-center gap-2", completionStatus.email ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200")}>
                    <CheckCircle2 className={cn("w-4 h-4", completionStatus.email ? "text-emerald-600" : "text-slate-400")} />
                    <span>Welcome Email{completionStatus.email && completionStatus.loginVerified === false ? ' (login link only)' : ''}</span>
                  </div>
                )}
              </div>

              {sendWelcomeEmail && !completionStatus.email && (
                <div className="mt-4 text-left text-sm rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
                  <strong>The customer has not received their welcome email or login details.</strong>
                  <p className="mt-1">
                    {completionStatus.emailError || 'Sending failed.'} Open the customer record and use
                    “Resend welcome email” to send their login details.
                  </p>
                </div>
              )}

              <Button onClick={resetForm} size="lg" className="mt-8">Create Another</Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

