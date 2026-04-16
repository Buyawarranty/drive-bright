import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getStoredFbclid } from '@/utils/fbclidCapture';
import { getStoredGclid } from '@/utils/gclidCapture';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/protected-button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, ArrowLeft, Info, FileText, ExternalLink, ChevronDown, ChevronUp, Plus, Infinity, Zap, Car, Cog, Settings, Droplets, Cpu, Snowflake, Search, Users, RotateCcw, MapPin, X, Shield, Hash, Calendar, Gauge, Fuel, Edit3, HelpCircle, Gift, ArrowRight, ArrowUp, DollarSign, MousePointerClick, ShieldCheck, PartyPopper, CheckCircle, Crown, Battery, Bike, AlertTriangle, AlertCircle, Mail, Wrench, Lock, Star } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import BackgroundRemovalProcessor from '@/components/BackgroundRemovalProcessor';
import MobileNavigation from '@/components/MobileNavigation';
import { OptimizedImage } from '@/components/OptimizedImage';
import { cn } from '@/lib/utils';

import AddOnProtectionPackages from '@/components/AddOnProtectionPackages';
import { validateVehicleEligibility, calculateVehiclePriceAdjustment, applyPriceAdjustment } from '@/lib/vehicleValidation';
import { calculateAddOnPrice, getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { 
  getBasePrice as getCentralizedBasePrice,
  DURATION_MONTHS,
  calculateLabourRateAdjustment,
  calculateBoostAdjustment,
  getMarketingSavings,
  type PaymentPeriod
} from '@/lib/pricingMatrix';
import { CLAIM_LIMIT_TIERS, PREMIUM_CLAIM_MONTHLY, isPremiumVehicle, getBaseClaimLimit, getClaimLimitSurcharge, getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';
import pandaCarWarranty from "@/assets/panda-car-warranty-transparent.png";
import pandaSavingsMascot from "@/assets/panda-savings-mascot.webp";
import trustpilotLogo from "@/assets/trustpilot-excellent-box.webp";
import { trackStepCompletion, trackBeginCheckout } from '@/utils/analytics';
import PriceHelpPanel from '@/components/step3/PriceHelpPanel';
import PriceHelpTrigger from '@/components/step3/PriceHelpTrigger';

type VehicleType = 'car' | 'motorbike' | 'phev' | 'hybrid' | 'ev';

const normalizeVehicleType = (raw?: string): VehicleType => {
  const v = (raw ?? '').toLowerCase().trim();
  if (['car','saloon','hatchback','estate','suv','van','truck','lorry','bus','coach'].includes(v)) return 'car';
  // Only treat as motorbike if explicitly a motorbike/motorcycle, not if it just contains 'motor'
  if (['motorbike', 'motorcycle', 'moped', 'scooter'].includes(v) || v === 'bike') return 'motorbike';
  // Treat hybrid, phev, and electric vehicles the same as regular cars
  if (v === 'phev' || v.includes('hybrid') || ['ev','electric'].includes(v)) return 'car';
  return 'car'; // safe default
};

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  two_monthly_price: number | null;
  three_monthly_price: number | null;
  coverage: string[];
  add_ons: string[];
  is_active: boolean;
  pricing_matrix?: any;
  vehicle_type?: string;
}

interface PricingTableProps {
  vehicleData: {
    regNumber: string;
    mileage: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
    make?: string;
    model?: string;
    fuelType?: string;
    transmission?: string;
    year?: string;
    vehicleType?: string;
  };
  onBack: () => void;
  onChangeVehicle?: () => void;
  onPlanSelected?: (planId: string, paymentType: string, planName?: string, pricingData?: {
    totalPrice: number, 
    monthlyPrice: number, 
    voluntaryExcess: number, 
    selectedAddOns: {[addon: string]: boolean}, 
    protectionAddOns?: {[key: string]: boolean},
    claimLimit?: number,
    labourRate?: number,
    boostAddon?: boolean,
    installmentBreakdown?: {
      firstInstallment: number,
      standardInstallment: number,
      hasTransfer: boolean,
      transferAmount: number
    }
  }) => void;
  // Props to restore previously selected options when navigating back
  previousPaymentType?: '12months' | '24months' | '36months';
  previousVoluntaryExcess?: number;
  previousClaimLimit?: number;
  previousSelectedAddOns?: {[addon: string]: boolean};
  previousProtectionAddOns?: {[key: string]: boolean};
  previousLabourRate?: number;
  previousBoostAddon?: boolean;
}

const PricingTable: React.FC<PricingTableProps> = ({ 
  vehicleData, 
  onBack,
  onChangeVehicle,
  onPlanSelected,
  previousPaymentType,
  previousVoluntaryExcess,
  previousClaimLimit,
  previousSelectedAddOns,
  previousProtectionAddOns,
  previousLabourRate,
  previousBoostAddon
}) => {

  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  // Initialize payment type from previous selection, defaulting to 24 months
  const initialPaymentType = previousPaymentType || '24months';
  console.log('🎯 PricingTable mount - previousPaymentType:', previousPaymentType, 'initialPaymentType:', initialPaymentType);
  const [paymentType, setPaymentType] = useState<'12months' | '24months' | '36months' | null>(initialPaymentType);
  // If previousVoluntaryExcess is explicitly set (including 0), use it; otherwise default to £100
  const [voluntaryExcess, setVoluntaryExcess] = useState<number | null>(
    previousVoluntaryExcess !== undefined ? previousVoluntaryExcess : 100
  );
  const [selectedAddOns, setSelectedAddOns] = useState<{[planId: string]: {[addon: string]: boolean}}>(
    previousSelectedAddOns ? { 'platinum': previousSelectedAddOns } : {}
  );
  // Detect if boost was enabled - either from explicit prop or inferred from boosted claim limit
  const wasBoostEnabled = previousBoostAddon || 
    (previousClaimLimit && previousClaimLimit > 2000 && [1750, 2250, 3000].includes(previousClaimLimit));
  const [boostAddon, setBoostAddon] = useState(wasBoostEnabled || false);
  const [loading, setLoading] = useState<{[key: string]: boolean}>({});
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  
  // Email quote dialog state
  const [emailQuoteDialogOpen, setEmailQuoteDialogOpen] = useState(false);
  const [emailQuoteDuration, setEmailQuoteDuration] = useState<'12months' | '24months' | '36months'>('12months');
  const [emailQuoteEmail, setEmailQuoteEmail] = useState('');
  const [emailQuoteSending, setEmailQuoteSending] = useState(false);
  
  // Track if we're restoring from previous selections to avoid overriding them
  const isRestoringFromPrevious = React.useRef(!!previousProtectionAddOns);
  const hasInitializedAddOns = React.useRef(false);
  // Track if payment type was changed by user action vs restoration/auto-change
  const isUserPaymentTypeChange = React.useRef(false);
  // Store the initial payment type to detect changes
  const initialPaymentTypeRef = React.useRef(previousPaymentType || '12months');
  
  // Vehicle validation
  const vehicleValidation = useMemo(() => {
    return validateVehicleEligibility(vehicleData);
  }, [vehicleData]);
  
  const vehiclePriceAdjustment = useMemo(() => {
    // This is now only used for the currently selected plan in certain calculations
    // Each individual plan will calculate its own adjustment in the map function
    const warrantyYears = paymentType === '12months' ? 1 : 
                         paymentType === '24months' ? 2 : 3;
    
    // Use ORIGINAL vehicleData for price adjustments to preserve motorbike detection
    let adjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);

    console.log('🚗 Vehicle Price Adjustment Calculation:', {
      vehicleData,
      originalVehicleType: vehicleData?.vehicleType,
      warrantyYears,
      paymentType,
      adjustment
    });
    return adjustment;
  }, [vehicleData, paymentType]);

  const [pdfUrls, setPdfUrls] = useState<{[planName: string]: string}>({});
  const [termsDocUrl, setTermsDocUrl] = useState<string>('');
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string>('');
  const [showAddOnInfo, setShowAddOnInfo] = useState<{[planId: string]: boolean}>({});
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isFloatingBarVisible, setIsFloatingBarVisible] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  // Validate previousClaimLimit is a valid option, otherwise default based on duration
  // Account for boost addon which adds 1000 to the claim limit value
  const validClaimLimits = [750, 1250, 2000, 5000];
  const getValidatedClaimLimit = (): number => {
    if (previousClaimLimit) {
      // Check if it's a valid base claim limit
      if (validClaimLimits.includes(previousClaimLimit)) return previousClaimLimit;
      // Check if it's a boosted claim limit (base + 1000)
      const possibleBaseLimit = previousClaimLimit - 1000;
      if (validClaimLimits.includes(possibleBaseLimit)) return possibleBaseLimit;
    }
    // Default to £2000 per claim
    return 2000;
  };
  const [selectedClaimLimit, setSelectedClaimLimit] = useState<number | null>(getValidatedClaimLimit());
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  // Fetch PDF documents from Supabase
  useEffect(() => {
    const fetchDocuments = async () => {
      // Fetch Terms document
      const { data: termsData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'terms-and-conditions')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (termsData) {
        setTermsDocUrl(termsData.file_url);
      }

      // Fetch Platinum document
      const { data: platinumData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'platinum')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (platinumData) {
        setPlatinumDocUrl(platinumData.file_url);
      }
    };
    
    fetchDocuments();
  }, []);
  
  // Add-ons state - restore from previous selections if available
  const [selectedProtectionAddOns, setSelectedProtectionAddOns] = useState<{[key: string]: boolean}>(
    previousProtectionAddOns || {
      breakdown: false,
      motFee: false,
      tyre: false,
      wearAndTear: false,
      european: false,
      rental: false,
      transfer: false
    }
  );
  
  // New state for labour rate selection - restore from previous if available
  const [selectedLabourRate, setSelectedLabourRate] = useState<number>(previousLabourRate ?? 70);
  
  // NOTE: Add-on auto-inclusion on payment type change is handled by a single useEffect below (around line 490)
  // to avoid duplicate state updates that cause pricing inconsistencies when navigating between steps
  
  // Benefits expansion state
  const [expandedBenefits, setExpandedBenefits] = useState<Record<string, boolean>>({});
  
  // Claim limit dialog state
  const [claimLimitDialogOpen, setClaimLimitDialogOpen] = useState<{[key: number]: boolean}>({
    750: false,
    1250: false,
    2000: false
  });
  
  // Validation error states
  const [validationErrors, setValidationErrors] = useState<{
    voluntaryExcess: boolean;
    claimLimit: boolean;
    paymentType: boolean;
  }>({
    voluntaryExcess: false,
    claimLimit: false,
    paymentType: false
  });
  
  // Claim limit guide expansion state
  const [claimLimitGuideExpanded, setClaimLimitGuideExpanded] = useState(false);
  
  // Check if any optional add-ons are selected (excluding auto-included ones)
  const hasAddOnsSelected = useMemo(() => {
    const autoIncluded = paymentType ? getAutoIncludedAddOns(paymentType) : [];
    // Check if any add-on is selected that isn't auto-included, OR if boost is enabled
    const hasManualAddOns = Object.entries(selectedProtectionAddOns).some(
      ([key, value]) => value && !autoIncluded.includes(key)
    );
    return hasManualAddOns || boostAddon;
  }, [selectedProtectionAddOns, paymentType, boostAddon]);
  
  // What's Covered section expansion state
  const [whatsCoveredOpen, setWhatsCoveredOpen] = useState(false);
  
  // Price Help Panel state
  const [showPriceHelpPanel, setShowPriceHelpPanel] = useState(false);
  
  // Reliability score state
  const [reliabilityScore, setReliabilityScore] = useState<{
    score: number;
    tier: number;
    tierLabel: string;
    pricing: { [key: string]: number };
  } | null>(null);
  const [reliabilityLoading, setReliabilityLoading] = useState(false);

  // Normalize vehicle type once
  const vt = useMemo(() => normalizeVehicleType(vehicleData?.vehicleType), [vehicleData?.vehicleType]);

  // Use the imported function from addOnsUtils instead of local duplicate
  // This ensures consistency across all components

  // Check vehicle age validation
  const vehicleAgeError = useMemo(() => {
    if (vehicleData?.year) {
      const currentYear = new Date().getFullYear();
      const vehicleYear = parseInt(vehicleData.year);
      const vehicleAge = currentYear - vehicleYear;
      
      if (vehicleAge > 15) {
        return 'We cannot offer warranties for vehicles over 15 years of age';
      }
    }
    return null;
  }, [vehicleData?.year]);

  // Calculate vehicle age for duration filtering
  const vehicleAge = useMemo(() => {
    if (vehicleData?.year) {
      const currentYear = new Date().getFullYear();
      const vehicleYear = parseInt(vehicleData.year);
      const age = currentYear - vehicleYear;
      console.log('🚗 Vehicle Age Calculation:', { currentYear, vehicleYear, age, rawYear: vehicleData.year });
      return age;
    }
    console.log('🚗 No vehicle year provided, defaulting to age 0');
    return 0;
  }, [vehicleData?.year]);

  // Calculate vehicle mileage for duration filtering
  const vehicleMileage = useMemo(() => {
    if (vehicleData?.mileage) {
      // Parse mileage - remove commas and non-numeric characters
      const mileageStr = String(vehicleData.mileage).replace(/[^0-9]/g, '');
      const mileage = parseInt(mileageStr) || 0;
      console.log('🚗 Vehicle Mileage Calculation:', { mileage, rawMileage: vehicleData.mileage });
      return mileage;
    }
    console.log('🚗 No vehicle mileage provided, defaulting to 0');
    return 0;
  }, [vehicleData?.mileage]);

  // Filter available duration options based on vehicle age AND mileage
  const availableDurations = useMemo(() => {
    type DurationType = '12months' | '24months' | '36months';
    const allDurations: DurationType[] = ['12months', '24months', '36months'];
    
    console.log('🔍 Available Durations Check:', { vehicleAge, vehicleMileage });
    
    // Check age-based restrictions
    let ageBasedDurations: DurationType[] = allDurations;
    if (vehicleAge === 15) {
      console.log('⚠️ 15-year vehicle detected - limiting to 1-year only');
      ageBasedDurations = ['12months'];
    } else if (vehicleAge === 14) {
      console.log('⚠️ 14-year vehicle detected - limiting to 1-2 years');
      ageBasedDurations = ['12months', '24months'];
    }
    
    // Check mileage-based restrictions
    let mileageBasedDurations: DurationType[] = allDurations;
    if (vehicleMileage >= 140000) {
      console.log('⚠️ Vehicle 140,000+ miles - limiting to 1-year only');
      mileageBasedDurations = ['12months'];
    } else if (vehicleMileage > 120000) {
      console.log('⚠️ Vehicle 120,001-139,999 miles - limiting to 1-2 years');
      mileageBasedDurations = ['12months', '24months'];
    }
    
    // Return the most restrictive of the two (intersection)
    const finalDurations = ageBasedDurations.filter(d => mileageBasedDurations.includes(d)) as DurationType[];
    console.log('✅ Final available durations:', finalDurations);
    return finalDurations.length > 0 ? finalDurations : ['12months'];
  }, [vehicleAge, vehicleMileage]);

  // Track if we've initialized from previous props to avoid overriding user's selection
  const hasInitializedPaymentType = React.useRef(false);
  
  // Ensure selected payment type is valid for vehicle age
  useEffect(() => {
    console.log('🔄 Payment Type Validation:', { paymentType, availableDurations, previousPaymentType, hasInitialized: hasInitializedPaymentType.current });
    
    // Skip validation on first render if we have a previous payment type
    // This prevents the useEffect from overriding the user's selection when navigating back
    if (!hasInitializedPaymentType.current && previousPaymentType) {
      hasInitializedPaymentType.current = true;
      console.log('✅ Skipping initial validation - respecting previousPaymentType:', previousPaymentType);
      return;
    }
    
    hasInitializedPaymentType.current = true;
    
    if (paymentType && !availableDurations.includes(paymentType)) {
      // If current selection is not available, default to 12months
      console.log('⚠️ Resetting payment type to 12months - current selection not available');
      setPaymentType('12months');
    }
  }, [paymentType, availableDurations, previousPaymentType]);

  // Retry function for fetching plans
  const retryFetchPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const rows = await fetchPlansFor(vt);
      console.log(`🔍 Fetched ${rows.length} plans for ${vt}:`, rows);
      setPlans(rows);
    } catch (e: any) {
      console.error('💥 Error fetching plans:', e);
      setPlansError('Failed to load pricing plans. Please try again.');
      toast.error('Failed to load pricing plans');
    } finally {
      setPlansLoading(false);
    }
  }, [vt]);

  useEffect(() => {
    let alive = true;
    setPlans([]); // clear immediately so no leakage
    setPlansLoading(true);
    setPlansError(null);
    
    (async () => {
      try {
        const rows = await fetchPlansFor(vt);
        if (!alive) return;
        console.log(`🔍 Fetched ${rows.length} plans for ${vt}:`, rows);
        setPlans(rows);
      } catch (e: any) {
        if (!alive) return;
        console.error('💥 Error fetching plans:', e);
        setPlansError('Failed to load pricing plans. Please try again.');
        toast.error('Failed to load pricing plans');
      } finally {
        if (alive) setPlansLoading(false);
      }
    })();
    
    return () => { alive = false; };
  }, [vt]); // ONLY depends on normalized vt

  useEffect(() => {
    fetchPdfUrls();
  }, []);

  // Set selectedPlan when plans are loaded
  useEffect(() => {
    if (plans.length > 0 && !selectedPlan) {
      setSelectedPlan(plans[0]);
    }
  }, [plans, selectedPlan]);

  // Track abandoned cart when user reaches pricing page (Step 3)
  useEffect(() => {
    const trackPricingPageView = async () => {
      // Track if we have either an email OR a vehicle registration
      const hasValidEmail = vehicleData?.email && vehicleData.email.includes('@');
      const hasVehicleReg = vehicleData?.regNumber && vehicleData.regNumber.trim() !== '';
      
      if (!hasValidEmail && !hasVehicleReg) {
        console.log('⏭️ Skipping abandoned cart tracking - no email or vehicle reg');
        return;
      }
      
      try {
        // Only track if we have a valid email
        if (!hasValidEmail) {
          console.log('⏭️ Skipping abandoned cart tracking - no valid email yet');
          return;
        }
        
        await supabase.functions.invoke('track-abandoned-cart', {
          body: {
            full_name: vehicleData?.firstName ? `${vehicleData.firstName}${vehicleData?.lastName ? ' ' + vehicleData.lastName : ''}`.trim() : vehicleData.email,
            email: vehicleData.email,
            phone: vehicleData?.phone?.trim() || undefined,
            vehicle_reg: vehicleData?.regNumber,
            vehicle_make: vehicleData?.make,
            vehicle_model: vehicleData?.model,
            vehicle_year: vehicleData?.year,
            vehicle_type: vehicleData?.vehicleType,
            mileage: vehicleData?.mileage,
            step_abandoned: 3,
            payment_type: paymentType,
            // Include Step 3 pricing selections for email restoration
            voluntary_excess: voluntaryExcess,
            claim_limit: selectedClaimLimit,
            labour_rate: selectedLabourRate,
            boost_addon: boostAddon,
            protection_addons: selectedProtectionAddOns,
            ...(getStoredFbclid() ? { fbclid: getStoredFbclid() } : {}),
            ...(getStoredGclid() ? { gclid: getStoredGclid() } : {}),
          }
        });
        console.log('✅ Tracked abandoned cart at Step 3 (Pricing Page) with pricing selections for:', vehicleData.email);
      } catch (error) {
        console.error('Error tracking abandoned cart on pricing page:', error);
      }
    };
    
    trackPricingPageView();
  }, []); // Only run once when component mounts

  // Restore quote settings from localStorage if available (set by email quote restoration)
  useEffect(() => {
    try {
      const savedQuoteSettings = localStorage.getItem('buyawarranty_quotePlanSettings');
      if (savedQuoteSettings) {
        const settings = JSON.parse(savedQuoteSettings);
        console.log('📧 Restoring quote settings from email link:', settings);
        
        // Only skip restoration if we have FULL previous data from back navigation
        // (all three props set). If only partial (e.g. just paymentType from email restore), allow localStorage restoration
        if (!(previousPaymentType && previousClaimLimit && previousLabourRate)) {
          if (settings.paymentType && ['12months', '24months', '36months'].includes(settings.paymentType)) {
            setPaymentType(settings.paymentType);
          }
          if (settings.claimLimit && [750, 1250, 2000, 5000].includes(settings.claimLimit)) {
            setSelectedClaimLimit(settings.claimLimit);
          }
          if (settings.labourRate && [50, 70, 100, 200].includes(settings.labourRate)) {
            setSelectedLabourRate(settings.labourRate);
          }
          if (typeof settings.voluntaryExcess === 'number') {
            setVoluntaryExcess(settings.voluntaryExcess);
          }
          if (typeof settings.boostAddon === 'boolean') {
            setBoostAddon(settings.boostAddon);
          }
          if (settings.addOns && Array.isArray(settings.addOns)) {
            const restoredAddOns: {[key: string]: boolean} = {};
            settings.addOns.forEach((addon: string) => {
              restoredAddOns[addon] = true;
            });
            if (Object.keys(restoredAddOns).length > 0) {
              setSelectedProtectionAddOns(prev => ({ ...prev, ...restoredAddOns }));
            }
          }
          
          // Mark as restoring from previous to prevent auto-inclusion overrides
          isRestoringFromPrevious.current = true;
        }
        
        // Clear the stored settings after restoration
        localStorage.removeItem('buyawarranty_quotePlanSettings');
      }
    } catch (error) {
      console.error('Error restoring quote settings:', error);
    }
  }, []);

  // Fetch reliability score when component loads
  useEffect(() => {
    if (vehicleData?.regNumber && vt === 'car') {
      fetchReliabilityScore();
    }
  }, [vehicleData?.regNumber, vehicleData?.mileage, vt]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      const isNearBottom = scrollY + windowHeight >= documentHeight - 200;
      
      // Show floating bar when user scrolls past the initial pricing cards
      setIsFloatingBarVisible(scrollY > 400);
      
      // Reshow summary if dismissed and user scrolls to bottom
      if (summaryDismissed && isNearBottom && scrollY > lastScrollY) {
        setSummaryDismissed(false);
      }
      
      setLastScrollY(scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [summaryDismissed, lastScrollY]);

  // Reset summary dismissed state when user changes options
  useEffect(() => {
    setSummaryDismissed(false);
  }, [selectedClaimLimit, paymentType, voluntaryExcess, selectedProtectionAddOns]);

  // Update claim limit default when payment type changes
  // Default to £2000 for all durations
  useEffect(() => {
    if (!isRestoringFromPrevious.current && isUserPaymentTypeChange.current) {
      // Only auto-update if current selection is the old default (£1250)
      if (selectedClaimLimit === 1250) {
        setSelectedClaimLimit(2000);
      }
    }
  }, [paymentType]);

  // Auto-include add-ons for 2-year and 3-year plans using imported utility
  // ONLY runs when user explicitly changes payment type via UI, not on restoration
  useEffect(() => {
    // Skip auto-inclusion entirely if we're restoring from previous selections
    if (isRestoringFromPrevious.current) {
      console.log('🔧 Skipping auto-inclusion - restoring from previous selections');
      // Mark as initialized but don't modify add-ons
      hasInitializedAddOns.current = true;
      // Clear the restoration flag after first render cycle
      const timer = setTimeout(() => {
        isRestoringFromPrevious.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
    
    // Skip if this is not a user-initiated payment type change
    if (!isUserPaymentTypeChange.current && hasInitializedAddOns.current) {
      console.log('🔧 Skipping auto-inclusion - not a user-initiated change');
      return;
    }
    
    hasInitializedAddOns.current = true;
    isUserPaymentTypeChange.current = false; // Reset the flag
    
    // Use the imported function to get auto-included add-ons for consistency
    const newAutoIncluded = getAutoIncludedAddOns(paymentType);
    
    console.log('🔧 Payment type changed (user action):', paymentType);
    console.log('🔧 New auto-included add-ons:', newAutoIncluded);
    
    setSelectedProtectionAddOns(prev => {
      // Get all possible auto-included add-ons from all plans (complete list)
      const allPossibleAutoIncluded = ['breakdown', 'motFee', 'rental', 'tyre'];
      
      // Start with current selections but preserve manually selected add-ons
      const updated = { ...prev };
      
      // Set auto-included add-ons to true (these should always be checked for the selected payment type)
      newAutoIncluded.forEach(addonKey => {
        updated[addonKey] = true;
      });
      
      // For add-ons that are NOT auto-included for this payment type,
      // reset them to false ONLY if they were auto-included for the previous selection
      // This preserves user manual selections while clearing previously auto-included ones
      allPossibleAutoIncluded.forEach(addonKey => {
        if (!newAutoIncluded.includes(addonKey)) {
          // Check if this was auto-included in ANY other plan
          const wasAutoIn24 = getAutoIncludedAddOns('24months').includes(addonKey);
          const wasAutoIn36 = getAutoIncludedAddOns('36months').includes(addonKey);
          if (wasAutoIn24 || wasAutoIn36) {
            updated[addonKey] = false;
          }
        }
      });
      
      console.log('🔧 Updated protection add-ons:', updated);
      
      return updated;
    });
  }, [paymentType]);

  // Server-side filtering function - now gets correct plan based on actual vehicle type
  async function fetchPlansFor(vt: VehicleType): Promise<Plan[]> {
    // Determine the correct vehicle type for the database query
    let dbVehicleType: string;
    
    // Map the normalized vehicle type to the actual vehicle characteristics
    const actualVehicleType = vehicleData?.vehicleType?.toLowerCase() || '';
    const vehicleMake = vehicleData?.make?.toLowerCase() || '';
    const vehicleModel = vehicleData?.model?.toLowerCase() || '';
    
    console.log('🔍 Vehicle Type Mapping:', {
      normalizedVt: vt,
      actualVehicleType,
      vehicleMake,
      vehicleModel,
      vehicleData
    });
    
    // Determine correct plan type based on actual vehicle characteristics
    // For motorbikes, use car plans but apply 50% discount via calculatePlanPrice()
    if (actualVehicleType.includes('motorbike') || actualVehicleType.includes('motorcycle') || actualVehicleType === 'bike') {
      dbVehicleType = 'car'; // Use car plans, discount applied in calculatePlanPrice()
    } else if (actualVehicleType.includes('van') || vehicleModel?.includes('transit') || vehicleModel?.includes('sprinter') || vehicleModel?.includes('crafter')) {
      dbVehicleType = 'van';
    } else if (actualVehicleType.includes('suv')) {
      dbVehicleType = 'suv';
    } else if (actualVehicleType.includes('electric') || actualVehicleType === 'ev') {
      dbVehicleType = 'electric';
    } else if (actualVehicleType.includes('hybrid') || actualVehicleType === 'phev') {
      dbVehicleType = 'hybrid';
    } else {
      // Default to car for cars, saloons, hatchbacks, estates, etc.
      dbVehicleType = 'car';
    }
    
    console.log(`🚗 Fetching plans for vehicle type: ${dbVehicleType}`);
    
    const { data, error } = await supabase
      .from('special_vehicle_plans')
      .select('*')
      .eq('is_active', true)
      .eq('vehicle_type', dbVehicleType)
      .order('monthly_price');
    
    if (error) {
      console.error('❌ Error fetching vehicle plans:', error);
      throw error;
    }
    
    console.log('✅ Vehicle plans fetched:', data?.length || 0, 'for type:', dbVehicleType);
    return (data || []).map(plan => ({
      ...plan,
      coverage: Array.isArray(plan.coverage) ? plan.coverage.map(item => String(item)) : [],
      add_ons: [], // Plans don't have add-ons in this structure
      two_monthly_price: plan.two_yearly_price || null,
      three_monthly_price: plan.three_yearly_price || null
    }));
  }

  const fetchPdfUrls = async () => {
    try {
      console.log('Fetching PDF URLs...');
      const { data, error } = await supabase
        .from('customer_documents')
        .select('plan_type, file_url, document_name')
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('PDF documents from database:', data);

      if (data) {
        const urlMap: {[planName: string]: string} = {};
        data.forEach(doc => {
          if (!urlMap[doc.plan_type]) {
            urlMap[doc.plan_type] = doc.file_url;
            console.log(`Mapped ${doc.plan_type} to ${doc.file_url}`);
          }
        });
        console.log('Final PDF URL mapping:', urlMap);
        setPdfUrls(urlMap);
      }
    } catch (error) {
      console.error('Error fetching PDF URLs:', error);
    }
  };

  const fetchReliabilityScore = async () => {
    if (!vehicleData?.regNumber) return;
    
    setReliabilityLoading(true);
    try {
      console.log('Fetching reliability score for:', vehicleData.regNumber);
      
      const mileageNumber = vehicleData.mileage ? 
        parseInt(vehicleData.mileage.replace(/,/g, '')) : undefined;
      
      const { data, error } = await supabase.functions.invoke('calculate-reliability-score', {
        body: { 
          registration: vehicleData.regNumber,
          mileage: mileageNumber
        }
      });

      if (error) {
        console.error('Reliability score error:', error);
        throw error;
      }

      if (data?.success && data?.data) {
        console.log('Reliability score result:', data.data);
        setReliabilityScore(data.data);
      }
    } catch (error) {
      console.error('Error fetching reliability score:', error);
      // Don't show error to user, just continue with normal pricing
    } finally {
      setReliabilityLoading(false);
    }
  };

  // Get pricing data using centralized pricing matrix (includes promo logic)
  const getPricingData = useCallback((excess: number, claimLimit: number, paymentPeriod: string) => {
    // Map £5000 to £2000 for base price lookup (surcharge added separately)
    const effectiveLimit = getBaseClaimLimit(claimLimit);
    return getCentralizedBasePrice(paymentPeriod as PaymentPeriod, excess, effectiveLimit);
  }, []);

  // Memoized price calculation to prevent pricing fluctuations
  const basePlanPrice = useMemo(() => {
    // Calculate vehicle adjustment for the currently selected payment type only
    const currentWarrantyYears = paymentType === '12months' ? 1 : 
                                paymentType === '24months' ? 2 : 3;
    const currentVehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, currentWarrantyYears);
    
    console.log('💰 calculatePlanPrice Debug:', {
      paymentType,
      voluntaryExcess,
      selectedClaimLimit,
      vehicleData,
      currentVehicleAdjustment
    });
    
    // Use centralized pricing matrix
    const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, paymentType);
    
    console.log('Found price in exact table:', { basePrice, voluntaryExcess, selectedClaimLimit, paymentType });
    
    // Apply vehicle adjustments (SUV/van, Range Rover, motorbike discount, etc.) to the base price
    const adjustedPrice = applyPriceAdjustment(basePrice, currentVehicleAdjustment);
    
    console.log('🏍️ Motorbike/Vehicle adjustment applied:', { 
      basePrice, 
      adjustedPrice, 
      adjustment: currentVehicleAdjustment,
      vehicleType: vehicleData?.vehicleType,
      isMotorbike: currentVehicleAdjustment.adjustmentType === 'motorbike_discount',
      discountApplied: basePrice !== adjustedPrice
    });
    
    return adjustedPrice;
  }, [paymentType, voluntaryExcess, selectedClaimLimit, vehicleData]);

  // CRITICAL: Compute "effective add-ons" synchronized with paymentType to prevent race condition.
  // When switching durations, paymentType updates immediately but selectedProtectionAddOns
  // updates asynchronously via useEffect, causing a brief frame with wrong prices.
  // This memo normalizes add-ons inline, eliminating the price fluctuation.
  const effectiveAddOns = useMemo(() => {
    const autoIncluded = getAutoIncludedAddOns(paymentType);
    const allPossibleAutoIncluded = ['breakdown', 'motFee', 'rental', 'tyre'];
    const normalized = { ...selectedProtectionAddOns };
    
    // Ensure auto-included add-ons for current paymentType are always true
    autoIncluded.forEach(key => { normalized[key] = true; });
    
    // Reset add-ons that were auto-included for OTHER durations but not this one
    allPossibleAutoIncluded.forEach(key => {
      if (!autoIncluded.includes(key)) {
        const wasAutoInOther = getAutoIncludedAddOns('24months').includes(key) || 
                               getAutoIncludedAddOns('36months').includes(key);
        if (wasAutoInOther) {
          normalized[key] = false;
        }
      }
    });
    
    return normalized;
  }, [paymentType, selectedProtectionAddOns]);

  // Memoized add-on price calculation - uses effectiveAddOns to avoid race condition
  const addOnPrice = useMemo(() => {
    const durationMonths = DURATION_MONTHS[paymentType as PaymentPeriod] || 12;
    return calculateAddOnPrice(effectiveAddOns, paymentType, durationMonths);
  }, [paymentType, effectiveAddOns]);

  // Memoized one-time add-on price (transfer cover only - not included in monthly)
  const oneTimeAddOnPrice = useMemo(() => {
    const autoIncluded = getAutoIncludedAddOns(paymentType);
    return effectiveAddOns.transfer && !autoIncluded.includes('transfer') ? 19 : 0;
  }, [paymentType, effectiveAddOns]);

  // Memoized recurring add-on price (excludes one-time add-ons)
  const recurringAddOnPrice = useMemo(() => {
    return addOnPrice - oneTimeAddOnPrice;
  }, [addOnPrice, oneTimeAddOnPrice]);
  
  // Calculate labour rate total adjustment using centralized function
  const labourRateTotalAdjustment = useMemo(() => {
    return calculateLabourRateAdjustment(selectedLabourRate, paymentType as PaymentPeriod);
  }, [selectedLabourRate, paymentType]);

   // £3000 and £5000 claim limit surcharge
  const premiumClaimSurcharge = useMemo(() => {
    return getClaimLimitSurcharge(selectedClaimLimit, paymentType as string, voluntaryExcess || 100);
  }, [selectedClaimLimit, paymentType, voluntaryExcess]);

  // Memoized total price calculation - EXACT Excel price + adjustments (no marketing discount applied)
  const totalPrice = useMemo(() => {
    return basePlanPrice + labourRateTotalAdjustment + addOnPrice + premiumClaimSurcharge;
  }, [basePlanPrice, labourRateTotalAdjustment, addOnPrice, premiumClaimSurcharge]);

  // Marketing savings (display only - NOT applied to actual price)
  const marketingSavings = useMemo(() => {
    return getMarketingSavings(paymentType as PaymentPeriod);
  }, [paymentType]);

  // "Was" price for display (total + marketing savings)
  const wasPriceForDisplay = useMemo(() => {
    return totalPrice + marketingSavings;
  }, [totalPrice, marketingSavings]);

  // Memoized labour rate per-month adjustment (for display in UI)
  // £50=-5, £70=0 (default), £100=+8, £200=+24
  const labourRateDisplayAdjustment = useMemo(() => {
    return selectedLabourRate === 50 ? -5 : selectedLabourRate === 70 ? 0 : selectedLabourRate === 100 ? 8 : selectedLabourRate === 200 ? 24 : 0;
  }, [selectedLabourRate]);

  // Memoized boost display adjustment (no longer used - surcharge replaces boost)
  const boostDisplayAdjustment = useMemo(() => {
    return 0;
  }, []);

  // Memoized display monthly price - ALWAYS floor(total / 12)
  const displayMonthlyPrice = useMemo(() => {
    return Math.floor(totalPrice / 12);
  }, [totalPrice]);

  // Memoized display total price - exact total including all add-ons
  const displayTotalPrice = useMemo(() => {
    return totalPrice;
  }, [totalPrice]);

  // Memoized monthly price calculation - ALWAYS floor(total / 12)
  const monthlyPrice = useMemo(() => {
    return Math.floor(totalPrice / 12);
  }, [totalPrice]);

  // Get the plan that matches the selected claim limit
  const getSelectedPlan = (): Plan | null => {
    // Single Premium plan drives all claim limits; just return the first active plan
    return plans[0] || null;
  };

  const calculateAdjustedPriceForDisplay = (basePrice: number) => {
    return applyPriceAdjustment(basePrice, vehiclePriceAdjustment);
  };

  const getMonthlyDisplayPrice = (totalPrice: number) => {
    // ALWAYS floor - never round
    return Math.floor(totalPrice / 12);
  };

  const getPlanSavings = (plan: Plan) => {
    if (paymentType === '12months') return null;
    
    // Calculate savings compared to 12-month pricing
    const twelveMonthPrice = getPricingData(voluntaryExcess, selectedClaimLimit, '12months');
    const currentPrice = basePlanPrice;
    const monthlyEquivalent = currentPrice / (paymentType === '24months' ? 24 : 36);
    const monthlyTwelve = twelveMonthPrice / 12;
    
    const savings = Math.round((monthlyTwelve - monthlyEquivalent) * (paymentType === '24months' ? 24 : 36));
    return savings > 0 ? savings : 0;
  };

  const calculateLocalAddOnPrice = (planId: string) => {
    // Get auto-included add-ons for current payment type
    const autoIncluded = getAutoIncludedAddOns(paymentType);
    
    // Calculate protection add-ons price using centralized utility
    const protectionPrice = calculateAddOnPrice(selectedProtectionAddOns, paymentType, 12);
    
    return protectionPrice;
  };

  const toggleAddOn = (planId: string, addon: string) => {
    setSelectedAddOns(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [addon]: !prev[planId]?.[addon]
      }
    }));
  };

  const toggleVoluntaryExcess = (amount: number) => {
    setVoluntaryExcess(amount);
  };

  const toggleAddOnInfo = (planId: string) => {
    setShowAddOnInfo(prev => ({
      ...prev,
      [planId]: !prev[planId]
    }));
  };


  const handleSelectPlan = async () => {
    // Validation: Check if all required selections are made
    // Update validation error states
    const errors = {
      voluntaryExcess: voluntaryExcess === null,
      claimLimit: !selectedClaimLimit,
      paymentType: !paymentType
    };
    
    setValidationErrors(errors);
    
    // If any selections are missing, scroll to first missing section
    if (errors.voluntaryExcess || errors.claimLimit || errors.paymentType) {
      // Scroll to the first missing selection section
      if (errors.voluntaryExcess) {
        document.getElementById('excess-amount-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (errors.claimLimit) {
        document.getElementById('claim-limit-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (errors.paymentType) {
        document.getElementById('duration-price-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      return;
    }
    
    const selectedPlan = getSelectedPlan();
    if (!selectedPlan) return;
    
    // Set loading state for this plan
    setLoading(prev => ({ ...prev, [selectedPlan.id]: true }));
    
    try {
      // Use the actually selected payment type instead of hardcoding to 12 months
      const selectedPaymentType = paymentType;
      const durationMonths = paymentType === '12months' ? 12 : 
                            paymentType === '24months' ? 24 : 36;
      
      // Get base price for selected duration using the pricing matrix
      const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, selectedPaymentType);
      
      // Calculate add-on prices using effectiveAddOns (race-condition-safe)
      const totalAddOnPrice = calculateAddOnPrice(effectiveAddOns, paymentType, durationMonths);
      const oneTimeAddonTotal = effectiveAddOns.transfer && !getAutoIncludedAddOns(paymentType).includes('transfer') ? 19 : 0;
      const recurringAddonTotal = totalAddOnPrice - oneTimeAddonTotal;
      
      // Calculate total price for selected duration with vehicle adjustments applied
      const adjustedBasePrice = applyPriceAdjustment(basePrice, vehiclePriceAdjustment);
      
      // Apply automatic discounts for multi-year plans
      let discountedBasePrice = adjustedBasePrice;
      if (selectedPaymentType === '24months') {
        discountedBasePrice = adjustedBasePrice - 100; // £100 discount for 2-year plans
      } else if (selectedPaymentType === '36months') {
        discountedBasePrice = adjustedBasePrice - 200; // £200 discount for 3-year plans
      }
      
      // Calculate boost addon cost (£5/month for 12 months = £60)
      const boostCost = boostAddon ? 60 : 0;
      
      // Calculate labour rate display adjustment (annual)
      let labourRateAdjust = 0;
      if (selectedLabourRate === 70) {
        labourRateAdjust = 4 * 12; // +£48 annually
      } else if (selectedLabourRate === 100) {
        labourRateAdjust = 8 * 12; // +£96 annually
      } else if (selectedLabourRate === 200) {
        labourRateAdjust = 24 * 12; // +£288 annually
      }
      // £50/hr is the default with no adjustment
      
      const totalPrice = discountedBasePrice + recurringAddonTotal + oneTimeAddonTotal + boostCost + labourRateAdjust;
      
      // Don't allow progression if vehicle is too old
      if (vehicleAgeError) {
        toast.error(vehicleAgeError);
        return;
      }
      
      console.log('Selected plan pricing data:', {
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        paymentType: selectedPaymentType,
        durationMonths,
        basePrice: basePrice,
        adjustedBasePrice,
        discountedBasePrice,
        recurringAddonTotal,
        oneTimeAddonTotal,
        totalPrice: totalPrice,
        voluntaryExcess,
        selectedClaimLimit,
        selectedAddOns: selectedAddOns[selectedPlan.id],
        protectionAddOns: selectedProtectionAddOns
      });
      
      // Track step 3 completion and begin checkout for Google Ads
      trackStepCompletion(3, 'plan_selection', {
        email: vehicleData?.email,
        phone: vehicleData?.phone,
        firstName: vehicleData?.firstName,
        lastName: vehicleData?.lastName,
        address: vehicleData?.address
      });
      
      trackBeginCheckout(totalPrice, [{
        item_name: selectedPlan.name,
        item_id: selectedPlan.id,
        price: totalPrice,
        quantity: 1
      }], {
        email: vehicleData?.email,
        phone: vehicleData?.phone,
        firstName: vehicleData?.firstName,
        lastName: vehicleData?.lastName,
        address: vehicleData?.address
      });
      
      // Call onPlanSelected with the correct pricing data and selected options
      // Claim limit is now set directly (3000/5000), no boost mapping needed
      const effectiveClaimLimit = selectedClaimLimit;
      
      // Use displayMonthlyPrice * 12 as totalPrice to match what's shown in Step 3
      // Step 3 displays: "£X/month (12 payments)" with total = monthlyPrice × 12
      // This ensures Step 4 receives the EXACT same values
      const consistentTotalPrice = displayMonthlyPrice * 12;
      
      onPlanSelected?.(
        selectedPlan.id, 
        selectedPaymentType, 
        selectedPlan.name,
        {
          totalPrice: consistentTotalPrice, 
          monthlyPrice: displayMonthlyPrice,
          voluntaryExcess,
          selectedAddOns: selectedAddOns[selectedPlan.id] || {},
          protectionAddOns: selectedProtectionAddOns,
          claimLimit: effectiveClaimLimit,
          labourRate: selectedLabourRate,
          boostAddon: boostAddon
        }
      );
      
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast.error('Failed to select plan. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, [selectedPlan.id]: false }));
    }
  };

  const handleOpenEmailQuoteDialog = (durationId: '12months' | '24months' | '36months') => {
    setEmailQuoteDuration(durationId);
    setEmailQuoteEmail('');
    setEmailQuoteDialogOpen(true);
  };

  const handleSendQuoteEmail = async () => {
    if (!emailQuoteEmail || !emailQuoteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setEmailQuoteSending(true);
    try {
      // Calculate price using the same centralized logic as the display
      let displayedMonthlyPrice: number;
      
      if (emailQuoteDuration === paymentType) {
        // Use current monthlyPrice if duration matches
        displayedMonthlyPrice = monthlyPrice;
      } else {
        // Calculate for the selected duration using centralized logic
        const warrantyYears = emailQuoteDuration === '12months' ? 1 : emailQuoteDuration === '24months' ? 2 : 3;
        const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
        const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, emailQuoteDuration);
        const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
        
        const durationMonths = emailQuoteDuration === '12months' ? 12 : emailQuoteDuration === '24months' ? 24 : 36;
        const labourRateTotalAdj = calculateLabourRateAdjustment(selectedLabourRate, emailQuoteDuration as PaymentPeriod);
        const addOnCost = calculateAddOnPrice(selectedProtectionAddOns, emailQuoteDuration, durationMonths);
        const premSurcharge = getClaimLimitSurcharge(selectedClaimLimit, emailQuoteDuration, voluntaryExcess || 100);
        
        const total = adjustedBasePrice + labourRateTotalAdj + addOnCost + premSurcharge;
        displayedMonthlyPrice = Math.floor(total / 12);
      }

      const planName = emailQuoteDuration === '12months' ? '1-Year Cover' : 
                       emailQuoteDuration === '24months' ? '2-Year Cover' : '3-Year Cover';

      const { error } = await supabase.functions.invoke('send-quote-email', {
        body: {
          email: emailQuoteEmail,
          firstName: vehicleData.firstName,
          lastName: vehicleData.lastName,
          vehicleData: {
            regNumber: vehicleData.regNumber,
            make: vehicleData.make,
            model: vehicleData.model,
            year: vehicleData.year,
            mileage: vehicleData.mileage,
            fuelType: vehicleData.fuelType,
            transmission: vehicleData.transmission,
            vehicleType: vehicleData.vehicleType
          },
          selectedPlan: {
            name: 'Platinum Complete Plan',
            price: displayedMonthlyPrice,
            paymentType: emailQuoteDuration,
            claimLimit: selectedClaimLimit,
            labourRate: selectedLabourRate,
            voluntaryExcess: voluntaryExcess,
            boostAddon: boostAddon,
            addOns: selectedProtectionAddOns
          }
        }
      });

      if (error) throw error;

      toast.success('Quote email sent successfully!', {
        style: {
          background: '#16a34a',
          color: 'white',
          border: 'none',
        },
      });
      setEmailQuoteDialogOpen(false);
      setEmailQuoteEmail('');
    } catch (error: any) {
      console.error('Error sending quote email:', error);
      toast.error('Failed to send quote email. Please try again.');
    } finally {
      setEmailQuoteSending(false);
    }
  };

  const ensureCarOnly = () => plans;
  const displayPlans = ensureCarOnly();

  // Check for vehicle exclusions first
  if (!vehicleValidation.isValid) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-red-800 mb-4">Vehicle Not Eligible</h2>
            <p className="text-red-600 mb-6">{vehicleValidation.errorMessage}</p>
            <Button onClick={onBack} className="mr-4 bg-gray-100 hover:bg-gray-200 text-gray-700 border-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (vehicleAgeError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-red-800 mb-4">Vehicle Age Restriction</h2>
            <p className="text-red-600 mb-6">{vehicleAgeError}</p>
            <Button onClick={onBack} className="mr-4 bg-gray-100 hover:bg-gray-200 text-gray-700 border-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      
      {/* Header with Back button and Get Covered heading */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Back button + Heading row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            {/* Mobile: Centered heading */}
            <div className="flex items-center justify-center gap-2 sm:hidden">
              <h1 className="text-xl font-bold text-foreground">
                One complete warranty. Tailored to you.
              </h1>
            </div>
            
            {/* Mobile: Back and Nav row */}
            <div className="flex items-center justify-between sm:hidden">
              <button 
                onClick={() => {
                  console.log('🔙 PricingTable Back button clicked');
                  onBack();
                }}
                className="flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200 bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <MobileNavigation />
            </div>
            
            {/* Desktop layout */}
            <button 
              onClick={() => {
                console.log('🔙 PricingTable Back button clicked');
                onBack();
              }}
              className="hidden sm:flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200 bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                One complete warranty. Tailored to you.
              </h1>
            </div>

            {/* Spacer for desktop to balance the layout */}
            <div className="hidden sm:block w-20"></div>
          </div>

        </div>
      </div>

      {/* Configuration Sections */}
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-6">

        {/* Hero Section - Trust Badges & Pricing */}
        <div className="text-center space-y-3">
          <p className="text-sm sm:text-base text-muted-foreground">
            All plans include <button type="button" onClick={() => document.getElementById('whats-covered')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="font-bold underline underline-offset-2 decoration-success/60 hover:decoration-success cursor-pointer transition-colors text-foreground"><strong>full comprehensive cover</strong></button> - choose your length of cover
            and level of protection
          </p>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="w-5 h-5 text-success fill-success/20" />
              <span className="font-medium text-foreground">Easy Claims, Fast Payout</span>
            </div>
            <TrustpilotHeader className="flex-shrink-0" />
            <div className="flex items-center gap-1.5 text-sm">
              <Shield className="w-5 h-5 text-amber-500 fill-amber-500/20" />
              <span className="font-medium text-foreground">14-day money-back guarantee</span>
            </div>
          </div>

          {/* Pricing Banner */}
          <div className="bg-muted border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-sm sm:text-base text-foreground">
              From <span className="text-lg sm:text-xl font-bold text-primary">£19/month</span> - <strong>tailored to your car, your garage, your budget</strong>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              12 interest-free payments  ·  Longer cover = better value, locked in today's price
            </p>
          </div>
        </div>
        
        {/* Vehicle Information - Simplified */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {/* Desktop layout */}
            <div className="hidden sm:flex items-center gap-3 flex-wrap">
              <Car className="w-5 h-5 text-foreground flex-shrink-0" />
              <span className="text-foreground font-medium">Your vehicle details</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-bold text-foreground">
                {vehicleData?.year} {vehicleData?.make?.toUpperCase()} {vehicleData?.model?.toUpperCase()}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {vehicleData?.mileage && parseInt(vehicleData.mileage) >= 120000 ? 'Over 120,000 miles' : 'Under 120,000 miles'}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{vehicleData?.fuelType}</span>
              <span className="text-muted-foreground">·</span>
              <span className="bg-yellow-400 border-2 border-black rounded px-2 py-0.5 font-mono font-bold text-black text-sm">
                {vehicleData?.regNumber}
              </span>
            </div>
            
            {/* Mobile layout - centered */}
            <div className="sm:hidden flex flex-col items-center gap-2 w-full">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-foreground flex-shrink-0" />
                <span className="text-foreground font-medium text-sm">Your vehicle details</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-center">
                  {vehicleData?.year} {vehicleData?.make?.toUpperCase()} {vehicleData?.model?.toUpperCase()}
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    localStorage.removeItem('warrantyVehicleData');
                    localStorage.removeItem('warrantyFormData');
                    if (onChangeVehicle) {
                      onChangeVehicle();
                    } else {
                      navigate('/', { replace: true });
                    }
                  }}
                  className="flex items-center gap-2 text-sm sm:text-base font-medium text-orange-600 hover:text-orange-700 transition-colors duration-200 py-1 px-2 rounded cursor-pointer z-10"
                  type="button"
                >
                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden xs:inline">Change Vehicle</span>
                  <span className="xs:hidden">Change</span>
                </button>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <span className="bg-yellow-400 border-2 border-black rounded px-2 py-0.5 font-mono font-bold text-black text-sm">
                  {vehicleData?.regNumber}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{vehicleData?.fuelType}</span>
              </div>
            </div>
            
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                localStorage.removeItem('warrantyVehicleData');
                localStorage.removeItem('warrantyFormData');
                if (onChangeVehicle) {
                  onChangeVehicle();
                } else {
                  navigate('/', { replace: true });
                }
              }}
              className="hidden sm:flex items-center gap-2 text-sm sm:text-base font-medium text-orange-600 hover:text-orange-700 transition-colors duration-200 py-1 px-2 rounded flex-shrink-0 cursor-pointer z-10"
              type="button"
            >
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Change</span>
            </button>
          </div>
        </div>

        {/* Price Help Trigger moved to above Comprehensive Cover */}

        {/* Choose Warranty Duration - Moved to top */}
        <div id="duration-price-section" className="section-header rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
                1
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 flex-shrink-0" />
                Choose your cover duration
              </h2>
            </div>
            <span className="text-sm text-gray-600 font-bold text-center w-full sm:w-auto sm:text-base sm:self-center">All parts included at no extra cost</span>
          </div>
          

          {validationErrors.paymentType && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-600 font-medium">
                Please choose a warranty duration to continue.
              </AlertDescription>
            </Alert>
          )}

          {/* Vehicle age restrictions message */}
          {vehicleAge === 15 && (
            <Alert className="mb-6 border-orange-200 bg-orange-50">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Due to your vehicle being 15 years old, only 1-year warranty coverage is available.
              </AlertDescription>
            </Alert>
          )}
          
          {vehicleAge === 14 && (
            <Alert className="mb-6 border-orange-200 bg-orange-50">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Due to your vehicle being 14 years old, warranty coverage is available for up to 2 years.
              </AlertDescription>
            </Alert>
          )}

          {/* Vehicle mileage restrictions message */}
          {vehicleMileage >= 140000 && vehicleAge < 14 && (
            <Alert className="mb-6 border-orange-200 bg-orange-50">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Due to your vehicle having 140,000+ miles, only 1-year warranty coverage is available.
              </AlertDescription>
            </Alert>
          )}
          
          {vehicleMileage > 120000 && vehicleMileage < 140000 && vehicleAge < 14 && (
            <Alert className="mb-6 border-orange-200 bg-orange-50">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Based on your vehicle's mileage, you're eligible for warranty cover for up to 2 years.
              </AlertDescription>
            </Alert>
          )}
          <div className={`grid gap-6 mb-8 ${
            availableDurations.length === 1 
              ? 'grid-cols-1 max-w-md mx-auto' 
              : availableDurations.length === 2 
                ? 'grid-cols-1 lg:grid-cols-2 lg:max-w-3xl lg:mx-auto' 
                : 'grid-cols-1 lg:grid-cols-3'
          }`}>
            {[
              { 
                id: '12months', 
                label: '1-year cover', 
                badge: null, 
                planName: 'Platinum Complete Plan',
                features: [
                  'All mechanical & electrical parts',
                  'Up to 10 claims per year',
                  'Total cover up to vehicle value',
                  'Labour costs included',
                  'Fault diagnostics',
                  'Consequential damage cover',
                  'Fast claims process',
                  'Choose your own garage',
                  '14-day money-back guarantee',
                  'Optional extras available',
                  'Pre-existing faults are not covered'
                ]
              },
              { 
                id: '24months', 
                label: '2-year cover', 
                badge: `RECOMMENDED FOR YOUR ${(vehicleData?.model && vehicleData.model.toLowerCase() !== 'unknown') ? vehicleData.model.toUpperCase() : (vehicleData?.vehicleType?.toUpperCase() || 'VEHICLE')}`, 
                planName: 'Platinum Complete Plan',
                features: [
                  'All mechanical & electrical parts',
                  'Unlimited Claims',
                  'Total cover up to vehicle value',
                  'Labour costs included',
                  'Fault diagnostics',
                  { text: 'Vehicle recovery', isExtra: true },
                  'Consequential damage cover',
                  'Fast claims process',
                  'Choose your own garage',
                  '14-day money-back guarantee',
                  'Optional extras available',
                  'Pre-existing faults are not covered'
                ]
              },
              { 
                id: '36months', 
                label: '3-year cover', 
                badge: 'BEST VALUE', 
                planName: 'Platinum Complete Plan',
                features: [
                  'All mechanical & electrical parts',
                  'Unlimited Claims',
                  'Total cover up to vehicle value',
                  'Labour costs included',
                  'Fault diagnostics',
                  { text: 'Vehicle recovery', isExtra: true },
                  { text: 'Europe repair cover', isExtra: true },
                  { text: 'Vehicle rental cover', isExtra: true },
                  'Consequential damage cover',
                  'Fast claims process',
                  'Choose your own garage',
                  '14-day money-back guarantee',
                  'Optional extras available',
                  'Pre-existing faults are not covered'
                ]
              }
            ].filter(duration => availableDurations.includes(duration.id as any)).map((duration) => {
              const durationId = duration.id as '12months' | '24months' | '36months';
              const isSelected = paymentType === durationId;
              const [isExpanded, setIsExpanded] = React.useState(false);
              
              // Calculate pricing for this duration
              const warrantyYears = durationId === '12months' ? 1 : durationId === '24months' ? 2 : 3;
              const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
              
              // All cards must use the user's selected claim limit for consistent pricing
              // Previously defaulting non-selected cards to £2000 caused price jumps when switching durations
              const cardClaimLimit = selectedClaimLimit;
              
              // Map £5000 to £2000 for base price lookup (already handled in getPricingData)
              const basePrice = getPricingData(voluntaryExcess, cardClaimLimit, durationId);
              const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
              
              // Calculate duration months for adjustments
              const durationMonths = durationId === '12months' ? 12 : durationId === '24months' ? 24 : 36;
              
              // NO automatic discounts - base prices from Excel are already final
              // The base price already includes multi-year pricing
              const finalBasePrice = adjustedBasePrice;
              
              // Labour rate adjustment: £50=-£5/mo, £70=base(0), £100=+£8/mo, £200=+£24/mo
              // Apply user's selection consistently to all cards for fair comparison
              const labourMonthlyAdjust = selectedLabourRate === 50 ? -5 : selectedLabourRate === 70 ? 0 : selectedLabourRate === 100 ? 8 : selectedLabourRate === 200 ? 24 : 0;
              const labourTotalAdjust = labourMonthlyAdjust * durationMonths;
              
              // Boost addon: +£5/month × 12 payments = £60 total (same for all durations)
              // Apply user's selection consistently to all cards for fair comparison
              const boostTotalAdjust = boostAddon ? 60 : 0;
              
              // Get auto-included add-ons for THIS card's duration (not the selected plan)
              const thisCardAutoIncluded = getAutoIncludedAddOns(durationId);
              
              // For plan card display, only include add-ons that:
              // 1. Are auto-included for THIS card's duration, OR
              // 2. Are manually selected AND not auto-included for any duration (truly manual selections)
              const allPossibleAutoIncluded = ['breakdown', 'motFee', 'rental', 'tyre'];
              const cardAddOns = { ...selectedProtectionAddOns };
              
              // Reset auto-included add-ons for card display - each card shows its own auto-included
              allPossibleAutoIncluded.forEach(addonKey => {
                // Set to true only if auto-included for THIS card's duration
                // This prevents the 1-year card from including add-ons that were auto-selected for 3-year
                cardAddOns[addonKey] = thisCardAutoIncluded.includes(addonKey);
              });
              
              // Calculate add-on price for this duration using card-specific add-ons
              const durationAddOnPrice = calculateAddOnPrice(cardAddOns, durationId, durationMonths);
              
               // Add £3000/£5000 claim limit surcharge if applicable for this card
               const cardPremiumSurcharge = getClaimLimitSurcharge(cardClaimLimit, durationId, voluntaryExcess || 100);
              
              // Calculate total price with all adjustments including add-ons
              const totalPriceWithAdjustments = finalBasePrice + labourTotalAdjust + boostTotalAdjust + durationAddOnPrice + cardPremiumSurcharge;
              
              // Calculate display monthly price (always divide by 12, round DOWN)
              const displayedMonthlyPrice = Math.floor(totalPriceWithAdjustments / 12);
              
              // Pay in full = monthly × 12 (what user actually pays over 12 months)
              const displayedAnnualPrice = displayedMonthlyPrice * 12;
              
              // Promotional savings for display (Was price = Pay in full + savings)
              const savingsAmount = durationId === '24months' ? 100 : durationId === '36months' ? 200 : 0;
              
              const dailyPriceLabel = (() => {
                const daily = (displayedMonthlyPrice * 12) / (durationId === '36months' ? 1095 : durationId === '24months' ? 730 : 365);
                return daily < 1 ? `${Math.round(daily * 100)}p` : `£${daily.toFixed(2)}`;
              })();
              const stripeSavings = Math.floor(displayedAnnualPrice * 0.10);
              const isPopular = durationId === '24months';
              const isBestValue = durationId === '36months';

              return (
                <div
                  key={durationId}
                  onClick={() => {
                    console.log('🎯 Duration card clicked:', { durationId, currentPaymentType: paymentType });
                    isUserPaymentTypeChange.current = true;
                    setPaymentType(durationId);
                  }}
                  className={cn(
                    "relative p-6 pt-7 rounded-2xl border-2 transition-all pointer-events-auto cursor-pointer hover:shadow-lg",
                    isPopular
                      ? "border-[#FF7A00] bg-white shadow-[0_4px_20px_-8px_rgba(255,122,0,0.35)]"
                      : isSelected
                        ? "border-[#FF7A00] bg-white shadow-[0_4px_20px_-8px_rgba(255,122,0,0.35)]"
                        : "border-gray-300 bg-white hover:border-orange-300"
                  )}
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  {/* Top badge — improved styling, brand-orange for popular, green for best value */}
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1.5 bg-[#FF7A00] text-white text-xs sm:text-sm font-bold px-4 py-1.5 rounded-full shadow-md whitespace-nowrap">
                        <Star className="w-3.5 h-3.5 fill-white" />
                        PERFECT FOR YOUR {(vehicleData?.model && vehicleData.model.toLowerCase() !== 'unknown') ? vehicleData.model.toUpperCase() : (vehicleData?.vehicleType?.toUpperCase() || 'VEHICLE')}
                      </span>
                    </div>
                  )}
                  {isBestValue && (
                    <div className="absolute -top-3 right-4 z-10">
                      <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                        BEST VALUE
                      </span>
                    </div>
                  )}

                  {/* Selection Checkbox - Top Right */}
                  <div
                    className="absolute top-4 right-4 cursor-pointer z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      isUserPaymentTypeChange.current = true;
                      setPaymentType(durationId);
                    }}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                      isSelected
                        ? "bg-green-500 border-green-500"
                        : "bg-white border-gray-300 hover:border-green-400"
                    )}>
                      {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                    </div>
                  </div>

                  {/* Most popular choice — social proof */}
                  {isPopular && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Check className="w-4 h-4 text-green-600" strokeWidth={3} />
                      <span className="text-sm font-semibold text-green-700">Most popular choice</span>
                    </div>
                  )}

                  {/* Duration Title */}
                  <h4 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-1 leading-tight tracking-tight">
                    {duration.label}
                  </h4>
                  <p className="text-sm text-gray-500 mb-3">{duration.planName}</p>

                  {/* Price Section — DAILY PRICE IS HERO */}
                  <div className="mb-4">
                    <div className="text-xs font-bold text-[#FF7A00] uppercase tracking-wide mb-0.5">Only</div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-4xl sm:text-5xl font-extrabold text-[#FF7A00] leading-none">
                        {dailyPriceLabel}
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-[#FF7A00] leading-none">/day</span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                      <span className="text-base sm:text-lg font-semibold text-black">£{displayedMonthlyPrice}/month</span>
                      <span className="text-xs sm:text-sm font-medium text-gray-600">(12 payments only)</span>
                    </div>

                    {/* Equivalent cost per month of cover */}
                    {durationId === '24months' && (
                      <div className="inline-block bg-white/70 border border-gray-200 rounded-full px-3 py-1 mt-2">
                        <p className="text-xs sm:text-sm font-semibold text-gray-600">
                          Approx. £{Math.floor(displayedMonthlyPrice / 2)}/month over 2 years
                        </p>
                      </div>
                    )}
                    {durationId === '36months' && (
                      <div className="inline-block bg-white/70 border border-gray-200 rounded-full px-3 py-1 mt-2">
                        <p className="text-xs sm:text-sm font-semibold text-gray-600">
                          Approx. £{Math.floor(displayedMonthlyPrice / 3)}/month over 3 years
                        </p>
                      </div>
                    )}

                    {/* Free year benefit lines */}
                    {durationId === '24months' && (
                      <div className="space-y-1 mt-3">
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" strokeWidth={3} />
                          <span className="text-sm font-medium text-black">No payments in year 2</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" strokeWidth={3} />
                          <span className="text-sm font-medium text-black">Includes extra benefits</span>
                        </div>
                      </div>
                    )}
                    {durationId === '36months' && (
                      <div className="space-y-1 mt-3">
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" strokeWidth={3} />
                          <span className="text-sm font-medium text-black">No payments in years 2 & 3</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" strokeWidth={3} />
                          <span className="text-sm font-medium text-black">Includes extra benefits</span>
                        </div>
                      </div>
                    )}

                    {/* AMPLIFIED savings panel */}
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mt-4">
                      <div>
                        <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">Save</div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-green-700 leading-none mt-0.5">
                          £{stripeSavings} today
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Pay in full</div>
                        <div className="text-sm font-bold text-black">£{displayedAnnualPrice - stripeSavings}</div>
                        <div className="text-xs text-red-500 line-through">£{displayedAnnualPrice}</div>
                      </div>
                    </div>
                  </div>

                  {/* What's Included Collapsible */}
                  <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                    <CollapsibleTrigger className="w-full mb-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between w-full border border-gray-300 bg-white rounded-lg px-4 py-3 hover:border-gray-400 transition-colors">
                        <span className="text-sm font-medium text-gray-800">See What's Included</span>
                        <ChevronDown
                          className={cn(
                            "w-5 h-5 text-gray-600 transition-transform duration-300",
                            isExpanded && "transform rotate-180"
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mb-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                        {duration.features.map((feature, idx) => {
                          const featureText = typeof feature === 'string' ? feature : feature.text;
                          const isExtra = typeof feature === 'object' && feature.isExtra;
                          const isExclusion = featureText.toLowerCase().includes('pre-existing faults');
                          return (
                            <div key={idx} className="flex items-start gap-2">
                              {isExclusion ? (
                                <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                              ) : isExtra ? (
                                <span className="text-base mt-0 flex-shrink-0">⭐</span>
                              ) : (
                                <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              )}
                              <span className="text-sm text-gray-700">
                                {featureText}{isExtra && ' (Bonus benefit)'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Forward-driving CTA — replaces dead-end "Selected" */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      isUserPaymentTypeChange.current = true;
                      setPaymentType(durationId);
                      // Scroll to next section to keep momentum
                      setTimeout(() => {
                        const next = document.getElementById('duration-price-section');
                        const nextSibling = next?.nextElementSibling as HTMLElement | null;
                        if (nextSibling) nextSibling.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 50);
                    }}
                    className={cn(
                      "w-full mb-1.5 font-bold text-base py-6 transition-all duration-300 group",
                      "bg-brand-orange hover:bg-brand-orange/90 text-white border-2 border-brand-orange"
                    )}
                    size="lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span>Continue with {duration.label}</span>
                      <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </Button>

                  {/* Email Quote Link */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEmailQuoteDialog(durationId);
                    }}
                    className="w-full text-center text-sm text-black hover:text-orange-600 transition-colors pointer-events-auto flex items-center justify-center gap-1"
                  >
                    <Mail className="w-4 h-4 text-orange-500" />
                    <span className="underline">Email me this quote</span>
                  </button>

                  {/* See Full Cover Details Link */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const coverSection = document.getElementById('your-cover-details');
                      coverSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-full mt-3 text-center text-sm text-black hover:text-green-600 transition-colors pointer-events-auto flex items-center justify-center gap-1"
                  >
                    <span>🔍 See full cover details</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Labour Rate Selection - NEW */}
        <div className="bg-gray-50 rounded-lg p-4 sm:p-8 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
              2
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
              <Settings className="w-5 h-5 flex-shrink-0" />
              Choose your labour rate
            </h2>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Pick the hourly rate that works best for your repair needs.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setSelectedLabourRate(50)}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedLabourRate === 50
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <span className="absolute -top-3 right-4 bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">BEST VALUE</span>
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£50 </span>
                <span className="text-sm font-medium text-foreground">per hour</span>
              </div>
              <p className="text-xl font-bold text-black">Local Garages</p>
              <p className="text-xs text-muted-foreground mt-1">Affordable option for smaller garages.</p>
            </button>
            
            <button
              onClick={() => setSelectedLabourRate(70)}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedLabourRate === 70
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <span className="absolute -top-3 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold">MOST POPULAR</span>
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£70 </span>
                <span className="text-sm font-medium text-foreground">per hour</span>
              </div>
              <p className="text-xl font-bold text-black">Independent Garages</p>
              <p className="text-xs text-muted-foreground mt-1">Ideal for your trusted local garage.</p>
            </button>
            
            <button
              onClick={() => setSelectedLabourRate(100)}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedLabourRate === 100
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£100 </span>
                <span className="text-sm font-medium text-foreground">per hour</span>
              </div>
              <p className="text-xl font-bold text-black">Approved Garages</p>
              <p className="text-xs text-muted-foreground mt-1">Covers most garages nationwide.</p>
            </button>
            
            <button
              onClick={() => setSelectedLabourRate(200)}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedLabourRate === 200
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£200 </span>
                <span className="text-sm font-medium text-foreground">per hour</span>
              </div>
              <p className="text-xl font-bold text-black">Expert Garages</p>
              <p className="text-xs text-muted-foreground mt-1">Perfect for main dealers and specialists.</p>
            </button>
          </div>
        </div>

        {/* Choose Your Excess Amount */}
        <div id="excess-amount-section" className={`section-header rounded-lg p-4 sm:p-6 transition-all duration-200 ${
          validationErrors.voluntaryExcess ? 'border-2 border-red-500' : ''
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
              3
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 scale-x-[-1] flex-shrink-0" />
              Choose your excess amount
            </h2>
          </div>
          
          {validationErrors.voluntaryExcess && (
            <Alert variant="destructive" className="mb-4 ml-11">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-600 font-medium">
                Please select your excess amount before continuing.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex gap-1.5 flex-wrap justify-start ml-11">
            {[0, 50, 100, 150].map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  toggleVoluntaryExcess(amount);
                  setValidationErrors(prev => ({ ...prev, voluntaryExcess: false }));
                }}
                className={`px-2.5 py-2 rounded-lg transition-all duration-200 text-center relative min-w-[50px] text-sm ${
                  voluntaryExcess === amount
                    ? 'bg-orange-500/10 border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                    : 'neutral-container shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-orange-500/20'
                }`}
              >
                <div className="text-base font-bold text-black">£{amount}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Claim Limit Selection */}
        <div id="claim-limit-section" className={`section-header rounded-lg p-4 sm:p-6 transition-all duration-200 ${
          validationErrors.claimLimit ? 'border-2 border-red-500' : ''
        }`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
              4
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              Choose your claim limit 🚗
            </h2>
            
            <Dialog>
              <DialogTrigger asChild>
                <button className="ml-2 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-green-50 transition-colors border border-green-200 shadow-sm">
                  <Info className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-600">Details</span>
                </button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-[624px] p-5 rounded-xl" hideCloseButton>
                <DialogClose className="absolute right-3 top-3 rounded-full p-1.5 bg-black hover:bg-gray-800 transition-colors z-50 shadow-lg">
                  <X className="h-4 w-4 text-white" strokeWidth={3} />
                  <span className="sr-only">Close</span>
                </DialogClose>
                
                <DialogHeader className="pr-8">
                  <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    Claim limit – what you are covered for
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-2 pt-1 text-xs">
                  <p className="text-muted-foreground leading-relaxed">
                    Your claim limit is the maximum amount we pay towards each repair, including <span className="font-semibold text-foreground">parts and labour</span>.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Most repairs cost between <span className="font-semibold text-foreground">£700 and £1,100</span>, so many customers are fully covered.
                  </p>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { val: '£1,000', label: 'Essential Cover', desc: 'Smaller repairs & everyday faults.' },
                      { val: '£2,000', label: 'Most Popular', desc: 'Common repairs & higher value jobs.', highlight: true },
                      { val: '£3,000', label: 'Strong Protection', desc: 'Extra reassurance for costlier repairs.' },
                      { val: '£5,000', label: 'Maximum Protection', desc: 'Hybrid, luxury or specialist vehicles.' },
                    ].map((t) => (
                      <div key={t.val} className={`rounded-lg border p-2 ${t.highlight ? 'border-success bg-success/5' : 'border-border bg-muted/30'}`}>
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-foreground text-xs">{t.val}</span>
                          <span className={`text-[10px] font-semibold ${t.highlight ? 'text-success' : 'text-muted-foreground'}`}>({t.label})</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{t.desc}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Higher limits cover larger repairs like <span className="font-medium text-foreground">engines, gearboxes & hybrid systems</span>.
                  </p>

                  <div className="bg-muted/50 border border-border rounded-lg p-2.5 space-y-1">
                    <h5 className="font-semibold text-foreground text-xs">How your claim is paid</h5>
                    <p className="text-[11px] text-muted-foreground">With a <span className="font-bold text-foreground">£2,000</span> limit:</p>
                    <div className="text-[11px] space-y-0.5">
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Under limit (£1,800):</span> We pay <span className="font-semibold text-success">£1,800</span>, you pay excess only.</p>
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Over limit (£2,400):</span> We pay <span className="font-semibold text-success">£2,000</span>, you pay <span className="font-semibold text-foreground">£400</span> + excess.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-[10px] text-muted-foreground font-medium">
                    <span>✓ No hidden fees</span>
                    <span>✓ Parts & labour included</span>
                    <span>✓ Protect from day one</span>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          {validationErrors.claimLimit && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-600 font-medium">
                Please choose a claim limit to continue.
              </AlertDescription>
            </Alert>
          )}
          
          <p className="text-lg font-medium text-gray-600 mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 flex-shrink-0" /> Set your claim limit - cover up to your car's <span className="font-bold">full value</span> 🚗
          </p>

          {/* Claim Limit Tier Cards */}
          {(() => {
            const isPremium = isPremiumVehicle(vehicleData?.make);
            const visibleTiers = isPremium 
              ? CLAIM_LIMIT_TIERS.filter(t => t.value !== 5000)
              : [...CLAIM_LIMIT_TIERS];
            
            // Determine displayed selection - now direct since we set claim limit directly
            const displayedLimit = selectedClaimLimit;
            
            return (
              <div className={cn(
                "grid gap-4",
                visibleTiers.length <= 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
              )}>
                {visibleTiers.map((tier) => {
                  const isSelected = displayedLimit === tier.value;
                  const isPopular = tier.popular;
                  
                  return (
                    <div 
                      key={tier.value}
                      className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                        isSelected
                          ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                          : 'border-2 border-gray-200 hover:border-orange-300 hover:shadow-md'
                      }`}
                      onClick={() => {
                        // Set claim limit directly - surcharge handles pricing for £3000/£5000
                        setSelectedClaimLimit(tier.value);
                        setBoostAddon(false);
                        setValidationErrors(prev => ({ ...prev, claimLimit: false }));
                      }}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                          MOST POPULAR
                        </div>
                      )}
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-semibold text-gray-500 mb-1">{tier.name}</h4>
                          <div className="text-3xl font-bold text-black">
                            £{(tier.displayValue ?? tier.value).toLocaleString()} <span className="text-base">per claim</span>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Price Help Trigger - Above Comprehensive Cover */}
        <div>
          <PriceHelpTrigger onClick={() => setShowPriceHelpPanel(true)} />
        </div>

        <div id="whats-covered" className="section-header rounded-lg p-4 sm:p-8 mb-8">
          <Collapsible open={whatsCoveredOpen} onOpenChange={setWhatsCoveredOpen}>
            {/* Header row with title and button */}
            <div className="flex items-start justify-between mb-4">
              <CollapsibleTrigger className="flex-1">
                <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-black flex-shrink-0" />
                  <h2 className="text-lg sm:text-xl font-semibold text-black">
                    Comprehensive Cover
                  </h2>
                  <ChevronDown className="w-5 h-5 sm:w-8 sm:h-8 text-black transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              
              {/* Parts & components button - top right on desktop */}
              <CollapsibleTrigger asChild>
                <button className="hidden md:inline-flex w-auto items-center justify-center gap-2 bg-black hover:bg-gray-800 rounded-lg px-6 py-3 transition-colors group cursor-pointer">
                  <Wrench className="w-5 h-5 text-white" />
                  <span className="text-base font-medium text-white whitespace-nowrap">View parts list</span>
                  <ChevronDown className="w-5 h-5 text-white transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
            </div>
            
            {/* Summary text below heading */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <p className="text-muted-foreground font-bold">
                      Labour, Electrical & Mechanical Parts – Everything Covered.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const detailsSection = document.getElementById('your-cover-details');
                      detailsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="text-base text-primary hover:text-primary/80 underline text-left w-fit transition-colors ml-7"
                  >
                    See full policy details
                  </button>
                </div>
              </div>
            </div>
            
            {/* Mobile-only Parts & components button */}
            <CollapsibleTrigger asChild>
              <button className="md:hidden w-full flex justify-center items-center py-2 mb-6 group cursor-pointer">
                <div className="w-full max-w-sm flex items-center justify-center gap-2 bg-black hover:bg-gray-800 rounded-lg px-6 py-3 transition-colors">
                  <Wrench className="w-5 h-5 text-white" />
                  <span className="text-base font-medium text-white whitespace-nowrap">View parts list</span>
                  <ChevronDown className="w-5 h-5 text-white transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                </div>
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="space-y-6 pt-2">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-black text-white hover:bg-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <Car className="w-6 h-6" />
                  <span className="text-lg">Petrol & Diesel Vehicles</span>
                </div>
                <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="grid md:grid-cols-2 gap-6">
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Engine & Internal Components (pistons, valves, camshafts, timing chains, seals, gaskets)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Gearbox / Transmission Systems (manual, automatic, DSG, CVT, dual-clutch, transfer boxes)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Drivetrain & Clutch Assemblies (flywheel, driveshafts, differentials)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Turbocharger & Supercharger Units</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Fuel Delivery Systems (tanks, pumps, injectors, fuel rails, fuel control electronics)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Cooling & Heating Systems (radiators, thermostats, water pumps, cooling fans, heater matrix)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Exhaust & Emissions Systems (catalytic converters, DPFs, OPFs, EGR valves, NOx sensors, AdBlue/Eolys systems)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Braking Systems (ABS, calipers, cylinders, master cylinders)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Suspension & Steering Systems (shocks, struts, steering racks, power/electric steering pumps, electronic suspension)</span>
                      </li>
                    </ul>
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Air Conditioning & Climate Control Systems</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Electrical Components & Charging Systems (alternators, starter motors, wiring looms, connectors, relays)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Electronic Control Units (ECUs) & Sensors (engine management, ABS, traction control, emissions sensors)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Lighting & Ignition Systems (headlights, indicators, ignition coils, switches, control modules)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Factory-Fitted Multimedia & Infotainment Systems (screens, sat nav, audio, digital displays)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Driver Assistance Systems (adaptive cruise control, lane assist, steering assist, parking sensors, reversing cameras)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Safety Systems (airbags, seatbelts, pretensioners, safety restraint modules)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Convertible power-hood, motors, hydraulic parts, buttons, switches, wiring, sensors and related parts</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <button 
                      onClick={() => document.getElementById('your-cover-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-orange-500 hover:text-orange-600 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                      Need more details? <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </button>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                        <span className="text-sm font-medium">Close</span>
                        <ChevronDown className="w-5 h-5 rotate-180" />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-gray-600 text-white hover:bg-gray-700 font-semibold py-4 px-6 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <Battery className="w-6 h-6" />
                  <span className="text-lg">Hybrid & PHEV Vehicles</span>
                </div>
                <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-5 h-5 text-black flex-shrink-0" />
                    <p className="text-black font-medium">
                      Includes ALL related petrol/diesel engine parts and labour PLUS:
                    </p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Hybrid Drive Motors & ECUs</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Hybrid Battery Failure</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Power Control Units, Inverters & DC-DC Converters</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Regenerative Braking Systems</span>
                      </li>
                    </ul>
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>High-Voltage Cables & Connectors</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Cooling Systems for Hybrid Components</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Charging Ports & On-Board Charging Modules</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Hybrid Transmission Components</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <button 
                      onClick={() => document.getElementById('your-cover-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-orange-500 hover:text-orange-600 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                      Need more details? <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </button>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                        <span className="text-sm font-medium">Close</span>
                        <ChevronDown className="w-5 h-5 rotate-180" />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-orange-500 text-white hover:bg-orange-600 font-semibold py-4 px-6 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <Zap className="w-6 h-6" />
                  <span className="text-lg">Electric vehicles (EVs)</span>
                </div>
                <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-5 h-5 text-black flex-shrink-0" />
                    <p className="text-black font-medium">
                      Includes ALL related petrol/diesel engine parts and labour PLUS:
                    </p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>EV Drive Motors & Reduction Gear</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>EV Transmission & Reduction Gearbox Assemblies</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>High-Voltage Battery Failure</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Power Control Units & Inverters</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>On-Board Charger (OBC) & Charging Ports</span>
                      </li>
                    </ul>
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>DC-DC Converters</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Thermal Management Systems</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>High-Voltage Cables & Connectors</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>EV-Specific Control Electronics</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Regenerative Braking System Components</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <button 
                      onClick={() => document.getElementById('your-cover-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-orange-500 hover:text-orange-600 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                      Need more details? <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </button>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                        <span className="text-sm font-medium">Close</span>
                        <ChevronDown className="w-5 h-5 rotate-180" />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-green-500 text-white hover:bg-green-600 font-semibold py-4 px-6 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <Bike className="w-6 h-6" />
                  <span className="text-lg">Motorcycles (Petrol, Hybrid, EV)</span>
                </div>
                <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="grid md:grid-cols-2 gap-6">
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Engine / Motor & Drivetrain Components</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Gearbox / Transmission Systems</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>ECUs, Sensors & Control Modules</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Electrical Systems & Wiring</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>High-Voltage Battery Failure (Hybrid & EV)</span>
                      </li>
                    </ul>
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Suspension & Steering Systems</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Braking Systems</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Cooling & Thermal Systems</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Lighting & Ignition Systems</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Instrumentation & Rider Controls</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <button 
                      onClick={() => document.getElementById('your-cover-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-orange-500 hover:text-orange-600 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                      Need more details? <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </button>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                        <span className="text-sm font-medium">Close</span>
                        <ChevronDown className="w-5 h-5 rotate-180" />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
                {/* What's Not Covered Section - Now nested inside What's Covered */}
                <div className="mt-6">
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-left bg-red-100 text-red-700 hover:bg-red-200 font-semibold py-4 px-6 rounded-lg transition-colors group">
                      <div className="flex items-center gap-3">
                        <X className="w-6 h-6" />
                        <span className="text-lg">What's not covered</span>
                      </div>
                      <ChevronDown className="w-6 h-6 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-4 p-6 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-gray-700 font-medium mb-4">
                          We keep things straightforward and transparent.
                        </p>
                        <h4 className="font-semibold text-red-700 mb-3">What's Not Included:</h4>
                        <ul className="space-y-2 mb-6">
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Pre-existing faults</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Routine servicing and maintenance</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Tyres, brake pads, and wear & tear items</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Accidental damage or accident repairs</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Motor trader-owned or operated vehicles</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Hire and reward use (taxis, rentals, couriers)</span>
                          </li>
                        </ul>
                        
                        {/* Close button - closes this section */}
                        <CollapsibleTrigger asChild>
                          <button className="w-full flex items-center justify-center gap-2 pt-4 border-t border-red-300 text-red-600 hover:text-red-700 font-medium transition-colors cursor-pointer">
                            <span>Close</span>
                            <ChevronDown className="w-5 h-5 rotate-180" />
                          </button>
                        </CollapsibleTrigger>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Cover Details Section */}
        <div id="your-cover-details" className="pt-2 pb-6 md:pt-4 md:pb-10 space-y-4">
          {/* Crystal Clear Cover Card - Original Design */}
          <div className="bg-card rounded-xl border-2 border-border p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <span>Your cover, made crystal clear</span>
                <span className="text-xl">💎</span>
              </h3>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-1 text-sm font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-secondary transition-colors w-fit"
              >
                <ArrowUp className="w-4 h-4" />
                Back to Plans
              </button>
            </div>

            {/* Summary Bullets */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>No hidden catches</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>Easy claims, Fast payouts</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>14-day money-back guarantee</span>
              </div>
            </div>

            {/* Microcopy */}
            <p className="text-sm text-muted-foreground mb-4 italic">
              Want the details? Expand below — no jargon, no surprises.
            </p>

            {/* Your Platinum Plan Collapsible */}
            <Collapsible className="mb-3">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center gap-2 py-2 text-left hover:opacity-80 transition-opacity">
                  <ChevronDown className="w-4 h-4 text-green-600 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  <span className="font-medium text-green-600">Your Platinum Plan</span>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="ml-6 p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 text-sm text-foreground mb-4">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="font-medium">The most comprehensive warranty plan</span>
                  </div>
                  {platinumDocUrl && (
                    <a
                      href={platinumDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-sm font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      View full plan (PDF)
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Terms & Conditions Collapsible */}
            <Collapsible>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center gap-2 py-2 text-left hover:opacity-80 transition-opacity">
                  <ChevronDown className="w-4 h-4 text-green-600 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  <span className="font-medium text-green-600">Terms & Conditions</span>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="ml-6 p-4 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-sm text-foreground mb-3">
                    Our terms are written in plain English so you know exactly what you're getting.
                  </p>
                  {termsDocUrl && (
                    <a
                      href={termsDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-sm font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      View Terms & Conditions (PDF)
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

      </div>

      {/* Bottom padding for sticky bar */}
      <div className="pb-20 md:pb-24 -mt-4"></div>

      {/* Sticky Total Bar - Always visible */}
      {!vehicleAgeError && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t-2 border-green-200 shadow-lg z-50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 max-w-6xl mx-auto gap-4">
            
            {/* Loading State */}
            {plansLoading && (
              <div className="flex items-center justify-center w-full py-2">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-600 font-medium">Loading pricing plans...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {!plansLoading && plansError && (
              <div className="flex items-center justify-center w-full py-2 gap-4">
                <span className="text-red-600 font-medium">{plansError}</span>
                <Button
                  onClick={retryFetchPlans}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            )}

            {/* Normal State - Show pricing */}
            {!plansLoading && !plansError && displayPlans.length > 0 && paymentType && (
              <>
                {/* Mobile Layout - Collapsible */}
                {(() => {
                  // Pay in full = monthly × 12
                  const payInFull = displayMonthlyPrice * 12;
                  const stripeSavings = Math.floor(payInFull * 0.10);
                  return (
                    <div className="flex flex-col md:hidden gap-2 w-full">
                      {/* Collapsible Header */}
                      <button
                        onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                        className="flex items-center justify-center w-full relative"
                      >
                        {/* Centered Content */}
                        <div className="flex flex-col items-center text-center">
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-bold text-gray-900">Total:</span>
                            <span className="text-lg font-bold text-gray-900">£{displayMonthlyPrice}/mo</span>
                            <span className="text-xs text-gray-600">0% APR</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs mt-0.5">
                            <span className="font-bold text-green-600">Pay in full £{payInFull}</span>
                            <span className="text-gray-500">– You save £{stripeSavings} today</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs mt-1">
                            <span className="font-semibold text-gray-800">
                              {paymentType === '12months' && '1-Year Cover'}
                              {paymentType === '24months' && '2-Year Cover'}
                              {paymentType === '36months' && '3-Year Cover'}
                            </span>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-500">12 easy payments</span>
                          </div>
                        </div>
                        
                        {/* Details Chevron - Positioned Right */}
                        <div className="absolute right-0 flex flex-col items-center">
                          <div className={`p-1.5 rounded-full bg-green-600 transition-transform duration-300 ${isSummaryExpanded ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronUp className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-[10px] font-medium text-green-600 mt-0.5">Details</span>
                        </div>
                      </button>
                      
                      {/* Expandable Content */}
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSummaryExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="flex items-center justify-center gap-4 py-2 border-t border-gray-100">
                          {/* Trustpilot */}
                          <a 
                            href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:opacity-80 transition-opacity"
                          >
                            <TrustpilotHeader className="h-3 scale-[0.5] origin-center" />
                          </a>
                          {/* Year Free Badge */}
                          {paymentType !== '12months' && (
                            <span className="text-gray-900 text-xs font-medium">
                              {paymentType === '24months' && 'Year 2 FREE 🎉'}
                              {paymentType === '36months' && 'Years 2 & 3 FREE 🎉'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* CTA Button - Always visible */}
                      <Button
                        onClick={handleSelectPlan}
                        size="lg"
                        className="w-full text-base font-semibold py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl"
                      >
                        Continue to checkout
                        <ArrowRight className="w-4 h-4 ml-2" strokeWidth={3} />
                      </Button>
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
                        <Lock className="h-3 w-3" />
                        <span>Secure checkout – 14 days to cancel</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Desktop Layout - Clean 4-Section Card with Equal Spacing */}
                {(() => {
                  // Pay in full = monthly × 12
                  const payInFull = displayMonthlyPrice * 12;
                  const stripeSavings = Math.floor(payInFull * 0.10);
                  return (
                    <div className="hidden md:flex md:items-stretch md:justify-between w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                      
                      {/* SECTION 1: Trust & Reassurance */}
                      <div className="flex flex-col items-center justify-center px-3 lg:px-6 py-4 border-r border-gray-100 min-w-fit">
                        <a 
                          href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:opacity-80 transition-opacity"
                        >
                          <TrustpilotHeader className="flex-shrink-0 scale-[0.7] origin-center" />
                        </a>
                        <div className="text-xs text-gray-500 mt-1.5 whitespace-nowrap">Easy Claims</div>
                      </div>
                      
                      {/* SECTION 2: Price */}
                      <div className="flex-1 flex flex-col items-center justify-center px-3 lg:px-6 py-4 border-r border-gray-100 text-center min-w-0">
                        <div className="text-xl lg:text-2xl font-bold text-gray-900 whitespace-nowrap">
                          Total: £{displayMonthlyPrice}/Month <span className="text-sm lg:text-base font-normal text-gray-600">– 0% APR</span>
                        </div>
                        <div className="text-xs lg:text-sm text-gray-500 mt-0.5 whitespace-nowrap">
                          Only 12 payments
                        </div>
                        <div className="flex items-center gap-1 lg:gap-2 text-xs lg:text-sm mt-0.5 flex-wrap justify-center">
                          <span className="font-bold text-green-600">Pay in full £{payInFull}</span>
                          <span className="text-gray-600 whitespace-nowrap">– You save £{stripeSavings} today</span>
                        </div>
                      </div>
                      
                      {/* SECTION 3: Cover & Free Years */}
                      <div className="flex flex-col items-center justify-center px-3 lg:px-6 py-4 border-r border-gray-100 text-center min-w-fit">
                        <span className="font-bold text-gray-900 text-sm lg:text-base whitespace-nowrap">
                          {paymentType === '12months' && '1-Year Cover'}
                          {paymentType === '24months' && '2-Year Cover'}
                          {paymentType === '36months' && '3-Year Cover'}
                        </span>
                        {paymentType !== '12months' && (
                          <span className="text-gray-900 text-xs lg:text-sm font-bold mt-1 whitespace-nowrap">
                            {paymentType === '24months' && 'No payments in year 2'}
                            {paymentType === '36months' && 'No payments in years 2 & 3'}
                          </span>
                        )}
                      </div>
                      
                      {/* SECTION 4: CTA */}
                      <div className="flex flex-col items-center justify-center px-3 lg:px-6 py-4 min-w-fit">
                        <Button
                          onClick={handleSelectPlan}
                          size="lg"
                          className="text-base lg:text-lg font-semibold px-4 lg:px-8 py-3 lg:py-3.5 bg-green-600 hover:bg-green-700 hover:shadow-lg text-white rounded-xl whitespace-nowrap"
                        >
                          Continue to checkout
                          <ArrowRight className="w-4 lg:w-5 h-4 lg:h-5 ml-2" strokeWidth={3} />
                        </Button>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 whitespace-nowrap">
                          <Lock className="h-3 w-3 flex-shrink-0" />
                          <span>Secure checkout – 14 days to cancel</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            
          </div>

          {/* Panda mascot moved to PriceHelpPanel callback section */}
        </div>
      )}

      {/* Email Quote Dialog */}
      <Dialog open={emailQuoteDialogOpen} onOpenChange={setEmailQuoteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Email Your Quote</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <p className="text-gray-600">
              Enter your email address and we'll send you this warranty quote instantly.
            </p>
            
            {/* Quote Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Plan:</span>
                <span className="font-bold">Platinum Complete</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Duration:</span>
                <span className="font-bold">
                  {emailQuoteDuration === '12months' ? '1-Year Cover' : 
                   emailQuoteDuration === '24months' ? '2-Year Cover' : '3-Year Cover'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Claim Limit:</span>
                <span className="font-bold">£{getDisplayClaimLimitValue(selectedClaimLimit).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Excess:</span>
                <span className="font-bold">£{voluntaryExcess}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Labour Rate:</span>
                <span className="font-bold">£{selectedLabourRate}/hr</span>
              </div>
              <div className="flex justify-between items-start border-t pt-2 mt-2">
                <span className="text-gray-600">Total Monthly Payment:</span>
                <div className="text-right">
                  <span className="font-bold">
                    £{(() => {
                      // Use the same calculation as the main pricing
                      // If email quote duration matches current paymentType, use current monthlyPrice
                      if (emailQuoteDuration === paymentType) {
                        return monthlyPrice;
                      }
                      
                      // Otherwise calculate for the selected duration using centralized logic
                      const warrantyYears = emailQuoteDuration === '12months' ? 1 : emailQuoteDuration === '24months' ? 2 : 3;
                      const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
                      const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, emailQuoteDuration);
                      const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
                      
                      // Calculate labour rate adjustment for this duration
                      const durationMonths = emailQuoteDuration === '12months' ? 12 : emailQuoteDuration === '24months' ? 24 : 36;
                      const labourRateTotalAdj = calculateLabourRateAdjustment(selectedLabourRate, emailQuoteDuration as PaymentPeriod);
                      
                       // Calculate premium surcharge for £3k/£5k
                       const premSurcharge = getClaimLimitSurcharge(selectedClaimLimit, emailQuoteDuration, voluntaryExcess || 100);
                      
                      // Calculate add-on price including transfer cover
                      const addOnCost = calculateAddOnPrice(selectedProtectionAddOns, emailQuoteDuration, durationMonths);
                      
                      // Total price for this duration
                      const total = adjustedBasePrice + labourRateTotalAdj + addOnCost + premSurcharge;
                      
                      // Monthly = floor(total / 12)
                      return Math.floor(total / 12);
                    })()}/month
                  </span>
                  <div className="text-xs text-gray-500">(12 easy payments)</div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Cost:</span>
                <span className="font-bold text-green-600">
                  £{(() => {
                    // Use the same calculation as the main pricing
                    if (emailQuoteDuration === paymentType) {
                      return monthlyPrice * 12;
                    }
                    
                    // Otherwise calculate for the selected duration
                    const warrantyYears = emailQuoteDuration === '12months' ? 1 : emailQuoteDuration === '24months' ? 2 : 3;
                    const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
                    const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, emailQuoteDuration);
                    const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
                    
                    const durationMonths = emailQuoteDuration === '12months' ? 12 : emailQuoteDuration === '24months' ? 24 : 36;
                    const labourRateTotalAdj = calculateLabourRateAdjustment(selectedLabourRate, emailQuoteDuration as PaymentPeriod);
                    const premSurcharge = getClaimLimitSurcharge(selectedClaimLimit, emailQuoteDuration, voluntaryExcess || 100);
                    const addOnCost = calculateAddOnPrice(selectedProtectionAddOns, emailQuoteDuration, durationMonths);
                    
                    const total = adjustedBasePrice + labourRateTotalAdj + addOnCost + premSurcharge;
                    
                    // Total = floor(total / 12) * 12
                    return Math.floor(total / 12) * 12;
                  })()}
                </span>
              </div>
            </div>
            
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-gray-900">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={emailQuoteEmail}
                onChange={(e) => setEmailQuoteEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 border-2 border-orange-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setEmailQuoteDialogOpen(false)}
                className="flex-1"
                disabled={emailQuoteSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendQuoteEmail}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                disabled={emailQuoteSending}
              >
                {emailQuoteSending ? 'Sending...' : 'Send Quote'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price Help Panel - Desktop Slide-in */}
      <PriceHelpPanel
        isOpen={showPriceHelpPanel}
        onClose={() => setShowPriceHelpPanel(false)}
        currentExcess={voluntaryExcess}
        currentClaimLimit={selectedClaimLimit}
        currentLabourRate={selectedLabourRate}
        onExcessChange={setVoluntaryExcess}
        onClaimLimitChange={setSelectedClaimLimit}
        onLabourRateChange={setSelectedLabourRate}
        currentMonthlyPrice={monthlyPrice}
      />

    </div>
  );
};

export default PricingTable;