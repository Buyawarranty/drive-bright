import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/protected-button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, ArrowLeft, Info, FileText, ExternalLink, ChevronDown, ChevronUp, Plus, Infinity, Zap, Car, Cog, Settings, Droplets, Cpu, Snowflake, Search, Users, RotateCcw, MapPin, X, Shield, Hash, Calendar, Gauge, Fuel, Edit3, HelpCircle, Gift, ArrowRight, ArrowUp, DollarSign, MousePointerClick, ShieldCheck, PartyPopper, CheckCircle, Crown, Battery, Bike, AlertTriangle, AlertCircle, Mail, Wrench, Lock } from 'lucide-react';
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
  BASE_PRICING_MATRIX, 
  DURATION_MONTHS,
  calculateLabourRateAdjustment,
  calculateBoostAdjustment,
  getMarketingSavings,
  type PaymentPeriod
} from '@/lib/pricingMatrix';
import { calculateCPMWithGuardrail, getCoverMonthsFromPaymentType } from '@/lib/cpmUtils';
import pandaCarWarranty from "@/assets/panda-car-warranty-transparent.png";
import trustpilotLogo from "@/assets/trustpilot-excellent-box.webp";
import { trackStepCompletion, trackBeginCheckout } from '@/utils/analytics';

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
  // Boost now adds +£500, so boosted limits are 1500, 2500 (not 3000 as max can't be boosted)
  const wasBoostEnabled = previousBoostAddon || 
    (previousClaimLimit && [1500, 2500].includes(previousClaimLimit));
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
  const initialPaymentTypeRef = React.useRef(previousPaymentType || '24months');
  
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
  // Validate previousClaimLimit is a valid option (1000, 2000, 3000), otherwise default to 1000
  // Account for boost addon which adds 500 to the claim limit value
  const validClaimLimits = [1000, 2000, 3000];
  const getValidatedClaimLimit = (): number => {
    if (!previousClaimLimit) return 2000;
    // Check if it's a valid base claim limit
    if (validClaimLimits.includes(previousClaimLimit)) return previousClaimLimit;
    // Check if it's a boosted claim limit (base + 500)
    const possibleBaseLimit = previousClaimLimit - 500;
    if (validClaimLimits.includes(possibleBaseLimit)) return possibleBaseLimit;
    // Default to 2000
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
  
  // Claim limit dialog state - using new claim limits
  const [claimLimitDialogOpen, setClaimLimitDialogOpen] = useState<{[key: number]: boolean}>({
    1000: false,
    2000: false,
    3000: false
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
            full_name: vehicleData?.firstName && vehicleData?.lastName 
              ? `${vehicleData.firstName} ${vehicleData.lastName}` 
              : vehicleData.email,
            email: vehicleData.email,
            phone: vehicleData?.phone || '',
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
            protection_addons: selectedProtectionAddOns
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
        
        // Only restore if we don't have previous props (user came from email, not back navigation)
        if (!previousPaymentType && !previousClaimLimit && !previousLabourRate) {
          if (settings.paymentType && ['12months', '24months', '36months'].includes(settings.paymentType)) {
            setPaymentType(settings.paymentType);
          }
          if (settings.claimLimit && [750, 1250, 2000].includes(settings.claimLimit)) {
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

  // Get pricing data using centralized pricing matrix with new claim limit keys
  const getPricingData = (excess: number, claimLimit: number, paymentPeriod: string) => {
    const periodData = BASE_PRICING_MATRIX[paymentPeriod as PaymentPeriod] || BASE_PRICING_MATRIX['12months'];
    // Map excess to valid keys (0, 100, 250, 500)
    const validExcess = [0, 100, 250, 500].includes(excess) ? excess : 100;
    const excessData = periodData[validExcess as keyof typeof periodData] || periodData[100];
    // Map claim limit to valid keys (1000, 2000, 3000)
    const validClaimLimit = [1000, 2000, 3000].includes(claimLimit) ? claimLimit : 1000;
    return excessData[validClaimLimit as keyof typeof excessData] || excessData[1000];
  };

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

  // Memoized add-on price calculation
  const addOnPrice = useMemo(() => {
    const durationMonths = DURATION_MONTHS[paymentType as PaymentPeriod] || 12;
    return calculateAddOnPrice(selectedProtectionAddOns, paymentType, durationMonths);
  }, [paymentType, selectedProtectionAddOns]);

  // Memoized one-time add-on price (transfer cover only - not included in monthly)
  const oneTimeAddOnPrice = useMemo(() => {
    const autoIncluded = getAutoIncludedAddOns(paymentType);
    return selectedProtectionAddOns.transfer && !autoIncluded.includes('transfer') ? 19 : 0;
  }, [paymentType, selectedProtectionAddOns]);

  // Memoized recurring add-on price (excludes one-time add-ons)
  const recurringAddOnPrice = useMemo(() => {
    return addOnPrice - oneTimeAddOnPrice;
  }, [addOnPrice, oneTimeAddOnPrice]);
  
  // Calculate boost addon cost using centralized function (£3/month × duration)
  const boostAddonCost = useMemo(() => {
    return calculateBoostAdjustment(boostAddon, paymentType as PaymentPeriod);
  }, [boostAddon, paymentType]);

  // Calculate labour rate total adjustment using centralized function
  const labourRateTotalAdjustment = useMemo(() => {
    return calculateLabourRateAdjustment(selectedLabourRate, paymentType as PaymentPeriod);
  }, [selectedLabourRate, paymentType]);

  // Memoized total price calculation - EXACT Excel price + adjustments (no marketing discount applied)
  const totalPrice = useMemo(() => {
    return basePlanPrice + labourRateTotalAdjustment + boostAddonCost + addOnPrice;
  }, [basePlanPrice, labourRateTotalAdjustment, boostAddonCost, addOnPrice]);

  // Marketing savings (display only - NOT applied to actual price)
  const marketingSavings = useMemo(() => {
    return getMarketingSavings(paymentType as PaymentPeriod);
  }, [paymentType]);

  // "Was" price for display (total + marketing savings)
  const wasPriceForDisplay = useMemo(() => {
    return totalPrice + marketingSavings;
  }, [totalPrice, marketingSavings]);

  // Memoized labour rate per-month adjustment (for display in UI)
  // £50=-5, £70=0 (default), £100=+4, £200=+24 (UPDATED: £100/hr is now +£4, not +£8)
  const labourRateDisplayAdjustment = useMemo(() => {
    return selectedLabourRate === 50 ? -5 : selectedLabourRate === 70 ? 0 : selectedLabourRate === 100 ? 4 : selectedLabourRate === 200 ? 24 : 0;
  }, [selectedLabourRate]);

  // Memoized boost display adjustment (£3/month - using centralized constant)
  const boostDisplayAdjustment = useMemo(() => {
    return boostAddon ? 3 : 0;
  }, [boostAddon]);

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
      
      // Calculate add-on prices using centralized utility
      const totalAddOnPrice = calculateAddOnPrice(selectedProtectionAddOns, paymentType, durationMonths);
      const oneTimeAddonTotal = selectedProtectionAddOns.transfer && !getAutoIncludedAddOns(paymentType).includes('transfer') ? 19 : 0;
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
      
      // Calculate boost addon cost (FIXED: £3/month × 12 payments = £36 total, regardless of cover duration)
      const boostCost = boostAddon ? (3 * 12) : 0;
      
      // Calculate labour rate adjustment for duration (UPDATED: £70=base, £100=+£4/mo)
      let labourRateAdjust = 0;
      if (selectedLabourRate === 50) {
        labourRateAdjust = -5 * durationMonths; // -£5/mo below base
      } else if (selectedLabourRate === 70) {
        labourRateAdjust = 0; // Base rate, no adjustment
      } else if (selectedLabourRate === 100) {
        labourRateAdjust = 4 * durationMonths; // +£4/mo (UPDATED from £8)
      } else if (selectedLabourRate === 200) {
        labourRateAdjust = 24 * durationMonths; // +£24/mo
      }
      
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
      // Calculate boosted claim limit if boost addon is selected
      const effectiveClaimLimit = boostAddon ? selectedClaimLimit + 1000 : selectedClaimLimit;
      
      // Use displayTotalPrice and displayMonthlyPrice to match what's shown in Step 3
      onPlanSelected?.(
        selectedPlan.id, 
        selectedPaymentType, 
        selectedPlan.name,
        {
          totalPrice: displayTotalPrice, 
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
        const boostCost = calculateBoostAdjustment(boostAddon, emailQuoteDuration as PaymentPeriod);
        const addOnCost = calculateAddOnPrice(selectedProtectionAddOns, emailQuoteDuration, durationMonths);
        
        const total = adjustedBasePrice + labourRateTotalAdj + boostCost + addOnCost;
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
              <Zap className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">
                Get Covered in 60 Seconds
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
              <Zap className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">
                Get Covered in 60 Seconds
              </h1>
            </div>

            {/* Spacer for desktop to balance the layout */}
            <div className="hidden sm:block w-20"></div>
          </div>

          {/* Subtitle only - Trustpilot removed (shown in sticky bar) */}
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              Choose your plan, customise options, and pay in 12 easy instalments.
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Sections */}
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-6">
        
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
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {vehicleData?.mileage && parseInt(vehicleData.mileage) >= 120000 ? 'Over 120,000 miles' : 'Under 120,000 miles'}
                </span>
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

        {/* Choose Warranty Duration - Moved to top */}
        <div id="duration-price-section" className="section-header rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
                1
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 flex-shrink-0" />
                Choose your cover duration
              </h2>
            </div>
          </div>
          
          {/* Interactive Info Strip - Collapsible pricing explainer */}
          <Collapsible className="mb-6 group">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/80 shadow-sm hover:shadow-md hover:from-slate-100 hover:to-slate-50 transition-all duration-200 group-data-[state=open]:bg-slate-100 group-data-[state=open]:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white shadow-sm border border-slate-200">
                    <Info className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 text-left">
                    <span className="text-sm font-semibold text-slate-700">How pricing works</span>
                    <span className="text-xs text-[#555555] font-normal">• Only 12 payments • 0% APR • Pay in full & save 10%</span>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 font-medium">12 interest-free monthly payments (0% APR)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 font-medium">Pay in full and save 10%</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 font-medium">Longer cover costs less per month and saves you more money overall</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          

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
              ? 'grid-cols-1 md:max-w-md md:mx-auto' 
              : availableDurations.length === 2 
                ? 'grid-cols-1 md:grid-cols-2 md:max-w-3xl md:mx-auto' 
                : 'grid-cols-1 md:grid-cols-3'
          }`}>
            {[
              { 
                id: '12months', 
                label: '1-Year Cover', 
                badge: null, 
                planName: 'Short-term protection',
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
                label: '2-Year Cover', 
                badge: 'Most Popular', 
                planName: 'Better value per month',
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
                label: '3-Year Cover', 
                badge: 'Best Value', 
                planName: 'Lowest cost per month of cover',
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
              const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, durationId);
              const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
              
              // Calculate duration months for adjustments
              const durationMonths = durationId === '12months' ? 12 : durationId === '24months' ? 24 : 36;
              
              // NO automatic discounts - base prices from Excel are already final
              // The base price already includes multi-year pricing
              const finalBasePrice = adjustedBasePrice;
              
              // Labour rate adjustment: £50=-£5/mo, £70=base(0), £100=+£4/mo, £200=+£24/mo (UPDATED)
              const labourMonthlyAdjust = selectedLabourRate === 50 ? -5 : selectedLabourRate === 70 ? 0 : selectedLabourRate === 100 ? 4 : selectedLabourRate === 200 ? 24 : 0;
              const labourTotalAdjust = labourMonthlyAdjust * durationMonths;
              
              // Boost addon: FIXED £3/month × 12 payments = £36 total (not multiplied by cover duration)
              const boostTotalAdjust = boostAddon ? (3 * 12) : 0;
              
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
              
              // Calculate total price with all adjustments including add-ons
              const totalPriceWithAdjustments = finalBasePrice + labourTotalAdjust + boostTotalAdjust + durationAddOnPrice;
              
              // Calculate display monthly price (always divide by 12, round DOWN)
              const displayedMonthlyPrice = Math.floor(totalPriceWithAdjustments / 12);
              
              // Pay in full = monthly × 12 (what user actually pays over 12 months)
              const displayedAnnualPrice = displayedMonthlyPrice * 12;
              
              // Promotional savings for display (Was price = Pay in full + savings)
              const savingsAmount = durationId === '24months' ? 100 : durationId === '36months' ? 200 : 0;
              
              return (
                <div
                  key={durationId}
                  onClick={() => {
                    console.log('🎯 Duration card clicked:', { durationId, currentPaymentType: paymentType });
                    isUserPaymentTypeChange.current = true;
                    setPaymentType(durationId);
                  }}
                  className={cn(
                    "relative p-6 rounded-xl border-2 transition-all duration-200 pointer-events-auto cursor-pointer bg-white",
                    isSelected 
                      ? "border-orange-500 shadow-lg shadow-orange-500/30" 
                      : "border-gray-200 hover:border-orange-300 hover:shadow-md"
                  )}
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  {/* BEST VALUE tag for 3-year */}
                  {durationId === '36months' && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-[#3A8F45] text-white text-xs font-bold uppercase px-4 py-1.5 rounded-full shadow-sm">
                        Best Value
                      </span>
                    </div>
                  )}

                  {/* Selection indicator - top right */}
                  <div 
                    className="absolute top-4 right-4 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      isUserPaymentTypeChange.current = true;
                      setPaymentType(durationId);
                    }}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                      isSelected 
                        ? "bg-[#2C7A2C] border-[#2C7A2C]" 
                        : "bg-white border-[#CCCCCC] hover:border-[#999999]"
                    )}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>
                  </div>

                  {/* Duration Title */}
                  <h4 className="text-lg font-bold text-[#000000] mb-5">
                    {duration.label}
                  </h4>
                  
                  {/* Main Price - Actual monthly payment FIRST and LARGEST */}
                  <div className="mb-4">
                    {/* Large headline: £X/month for 12 months */}
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-[#000000]">£{displayedMonthlyPrice}</span>
                      <span className="text-base text-[#333333]">/month for 12 months</span>
                    </div>
                    
                    {/* No payments notice - for multi-year plans */}
                    {durationId === '24months' && (
                      <p className="text-sm font-semibold text-[#333333] mb-2">No payments in year 2</p>
                    )}
                    {durationId === '36months' && (
                      <p className="text-sm font-semibold text-[#333333] mb-2">No payments in years 2 or 3</p>
                    )}
                    
                    {/* Average cost badge - soft grey pill (non-interactive) */}
                    {(durationId === '24months' || durationId === '36months') && (
                      <div className="inline-block bg-[#F5F5F5] border border-[#E5E5E5] rounded-full px-2.5 py-1 mb-3">
                        <span className="text-sm font-medium text-[#333333]">
                          Avg. <span className="font-bold">£{calculateCPMWithGuardrail(displayedAnnualPrice, durationId === '24months' ? 24 : 36, displayedMonthlyPrice)}</span>/month over {durationId === '24months' ? '2' : '3'} years
                        </span>
                      </div>
                    )}
                    
                    {/* Total cost */}
                    <p className="text-sm text-[#333333]">
                      Total cost <span className="font-semibold text-[#000000]">£{displayedAnnualPrice}</span>
                    </p>
                  </div>

                  {/* Pay in full savings - Only for 2-year and 3-year */}
                  {(durationId === '24months' || durationId === '36months') && (
                    <div className="bg-[#F7F7F7] border border-[#EDEDED] rounded-lg px-4 py-3 mb-4">
                      <ul className="space-y-1 list-disc list-inside text-sm">
                        <li className="text-[#777777]">Or pay in full and save 10%</li>
                        <li className="text-[#333333]">
                          Was £{displayedAnnualPrice} – now <span className="font-semibold text-[#3A8F45]">£{Math.round(displayedAnnualPrice * 0.9)}</span>
                        </li>
                        <li className="font-semibold text-[#3A8F45]">You save £{Math.round(displayedAnnualPrice * 0.1)}</li>
                      </ul>
                    </div>
                  )}

                  {/* Benefits - Bullet points */}
                  <ul className="space-y-2 mb-5 list-disc list-inside text-sm">
                    {durationId === '12months' && (
                      <li className="text-[#333333]">Ideal for short-term protection</li>
                    )}
                  </ul>
                  
                  {/* What's Included Collapsible - Secondary CTA (grey, non-competing) */}
                  <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                    <CollapsibleTrigger className="w-full mb-4">
                      <div className="flex items-center justify-between w-full bg-white border border-[#D9D9D9] rounded-md px-4 py-3 hover:bg-[#F2F2F2] hover:border-[#C5C5C5] transition-colors">
                        <span className="text-sm font-semibold text-[#444444] hover:text-[#222222]">See what's included</span>
                        <ChevronDown 
                          className={cn(
                            "w-5 h-5 text-[#666666] transition-transform duration-300",
                            isExpanded && "transform rotate-180"
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="mb-4">
                      <div className="bg-[#F7F7F7] border border-[#EDEDED] rounded-lg p-4 space-y-2">
                        {duration.features.map((feature, idx) => {
                          const featureText = typeof feature === 'string' ? feature : feature.text;
                          const isExtra = typeof feature === 'object' && feature.isExtra;
                          const isExclusion = featureText.toLowerCase().includes('pre-existing faults');
                          return (
                            <div key={idx} className="flex items-start gap-2">
                              {isExclusion ? (
                                <X className="w-4 h-4 text-[#777777] mt-0.5 flex-shrink-0" />
                              ) : (
                                <Check className="w-4 h-4 text-[#333333] mt-0.5 flex-shrink-0" />
                              )}
                              <span className="text-sm text-[#333333]">
                                {featureText}{isExtra && ' (Bonus)'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* CTA Button - Primary Brand Orange */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      isUserPaymentTypeChange.current = true;
                      setPaymentType(durationId);
                    }}
                    className={cn(
                      "w-full mb-3 font-semibold text-sm py-5 rounded-md transition-all duration-200",
                      isSelected
                        ? "bg-black hover:bg-gray-800 text-white border-none"
                        : "bg-[#eb4b00] hover:bg-[#d63f00] text-white border-none"
                    )}
                    size="lg"
                  >
                    {isSelected ? 'Selected' : 'Select this plan'}
                  </Button>
                  
                  {/* Links - Simple black text */}
                  <div className="flex flex-col gap-2 items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEmailQuoteDialog(durationId);
                      }}
                      className="text-sm text-[#333333] hover:text-[#000000] transition-colors underline"
                    >
                      Email me this quote
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const coverSection = document.getElementById('your-cover-details');
                        coverSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="text-sm text-[#333333] hover:text-[#000000] transition-colors underline"
                    >
                      View full cover details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Global Explainer Line */}
          <p className="text-center text-sm text-slate-500 mb-8 px-4">
            You pay monthly for 12 months on every plan. Longer cover continues automatically with no further payments.
          </p>
        </div>

        <div id="whats-covered" className="section-header rounded-lg p-4 sm:p-8 mb-8">
          <Collapsible open={whatsCoveredOpen} onOpenChange={setWhatsCoveredOpen}>
            {/* Header row with title and button */}
            <div className="flex items-start justify-between mb-4">
              <CollapsibleTrigger className="flex-1">
                <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-black flex-shrink-0" />
                  <h2 className="text-lg sm:text-xl font-semibold text-black">
                    What's covered by your warranty
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
                            <span className="text-gray-700">Routine servicing and maintenance (such as fluids or brake pads)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Vehicles used for hire or reward (including taxis, rentals, or couriers)</span>
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => {
                toggleVoluntaryExcess(0);
                setValidationErrors(prev => ({ ...prev, voluntaryExcess: false }));
              }}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                voluntaryExcess === 0
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£0 </span>
                <span className="text-sm font-medium text-foreground">excess</span>
              </div>
              <p className="text-xl font-bold text-black">Zero Excess</p>
              <p className="text-xs text-muted-foreground mt-1">No upfront cost when you claim.</p>
            </button>
            
            <button
              onClick={() => {
                toggleVoluntaryExcess(100);
                setValidationErrors(prev => ({ ...prev, voluntaryExcess: false }));
              }}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                voluntaryExcess === 100
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <span className="absolute -top-3 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold">MOST POPULAR</span>
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£100 </span>
                <span className="text-sm font-medium text-foreground">excess</span>
              </div>
              <p className="text-xl font-bold text-black">Best Value</p>
              <p className="text-xs text-muted-foreground mt-1">Best value overall for most drivers.</p>
            </button>
            
            <button
              onClick={() => {
                toggleVoluntaryExcess(250);
                setValidationErrors(prev => ({ ...prev, voluntaryExcess: false }));
              }}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                voluntaryExcess === 250
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£250 </span>
                <span className="text-sm font-medium text-foreground">excess</span>
              </div>
              <p className="text-xl font-bold text-black">Saver Option</p>
              <p className="text-xs text-muted-foreground mt-1">Lower monthly price.</p>
            </button>
            
            <button
              onClick={() => {
                toggleVoluntaryExcess(500);
                setValidationErrors(prev => ({ ...prev, voluntaryExcess: false }));
              }}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                voluntaryExcess === 500
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£500 </span>
                <span className="text-sm font-medium text-foreground">excess</span>
              </div>
              <p className="text-xl font-bold text-black">Budget Option</p>
              <p className="text-xs text-muted-foreground mt-1">Cheapest monthly price.</p>
            </button>
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
              Single repair amount per claim
            </h2>
            
            <Dialog>
              <DialogTrigger asChild>
                <button className="ml-2 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-green-50 transition-colors border border-green-200 shadow-sm">
                  <Info className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-600">Details</span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" hideCloseButton>
                <DialogClose className="absolute right-4 top-4 rounded-full p-4 bg-black hover:bg-gray-800 transition-colors z-50 shadow-lg">
                  <X className="h-8 w-8 text-white" strokeWidth={3} />
                  <span className="sr-only">Close</span>
                </DialogClose>
                
                <DialogHeader className="pr-12">
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <ShieldCheck className="w-6 h-6 text-green-600" />
                    Your claim limit
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-5 py-4">
                  <p className="text-gray-700 leading-relaxed">
                    Your claim limit is the maximum we pay per repair. It covers parts and your chosen labour rate. Any excess you selected is paid once per claim.
                  </p>
                  
                  <p className="text-gray-700 leading-relaxed">
                    Most repair claims average between <span className="font-semibold">£700 and £1,100</span>, so most customers are fully covered.
                  </p>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Example
                    </h4>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      With a £2,000 claim limit: if your repair costs £2,200, we pay £2,000 and you pay the remaining £200 (plus your excess).
                    </p>
                  </div>
                  
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Your excess and claim limit are set when you buy your cover. There are no hidden fees.
                  </p>
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Essential - £1,000 */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 1000
                  ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-2 border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(1000);
                setValidationErrors(prev => ({ ...prev, claimLimit: false }));
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xl font-bold text-black mb-1">AutoCare Essential</h4>
                  <div className="text-3xl font-bold text-black">
                    £{selectedClaimLimit === 1000 && boostAddon ? '1,500' : '1,000'} <span className="text-base">per claim</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedClaimLimit === 1000 ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {selectedClaimLimit === 1000 && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
            </div>
            
            {/* Advantage - £2,000 */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 2000
                  ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-2 border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(2000);
                setValidationErrors(prev => ({ ...prev, claimLimit: false }));
              }}
            >
              <div className="absolute -top-3 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                MOST POPULAR
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xl font-bold text-black mb-1">AutoCare Advantage</h4>
                  <div className="text-3xl font-bold text-black">
                    £{selectedClaimLimit === 2000 && boostAddon ? '2,500' : '2,000'} <span className="text-base">per claim</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedClaimLimit === 2000 ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {selectedClaimLimit === 2000 && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
            </div>
            
            {/* Elite - £3,000 (maximum, no boost available) */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 3000
                  ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-2 border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(3000);
                // Disable boost when selecting max claim limit
                if (boostAddon) setBoostAddon(false);
                setValidationErrors(prev => ({ ...prev, claimLimit: false }));
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xl font-bold text-black mb-1">AutoCare Elite</h4>
                  <div className="text-3xl font-bold text-black">
                    £3,000 <span className="text-base">per claim</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedClaimLimit === 3000 ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {selectedClaimLimit === 3000 && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
            </div>
          </div>
          
          {/* Optional Add-ons Section - Only show boost for £1,000 and £2,000 */}
          {selectedClaimLimit !== 3000 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Optional add-on</h4>
              
              {/* Add Extra Cover Card - Boost adds +£500 */}
              <div 
                onClick={() => setBoostAddon(!boostAddon)}
                className={cn(
                  "relative p-4 rounded-xl cursor-pointer border-2 overflow-hidden",
                  "transition-all duration-300 ease-out transform",
                  boostAddon
                    ? "bg-gradient-to-br from-green-50 to-green-100 border-green-500 shadow-[0_0_16px_rgba(34,197,94,0.35)] scale-[1.01]"
                    : "bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 hover:border-orange-400 hover:shadow-lg hover:scale-[1.005]"
                )}
              >
                {/* Animated background pulse when active */}
                {boostAddon && (
                  <div className="absolute inset-0 bg-green-400/10 animate-pulse pointer-events-none" />
                )}
                
                <div className="relative flex items-center gap-4">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {boostAddon ? (
                      <>
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-lg font-bold text-green-700">
                            Boost Added!
                          </h4>
                        </div>
                        <div className="text-base font-semibold text-green-800">
                          Your cover is now £{((selectedClaimLimit || 1000) + 500).toLocaleString()} per claim 🚀
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          +£3/month × 12 payments
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 className="text-lg font-bold text-foreground mb-0.5">
                          🚀 Add +£500 extra cover
                        </h4>
                        <div className="text-base font-semibold text-foreground">
                          Upgrade to £{((selectedClaimLimit || 1000) + 500).toLocaleString()} per claim
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          +£3/month × 12 payments
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Improved Toggle Switch */}
                  <div className="flex-shrink-0">
                    <div
                      className={cn(
                        "relative inline-flex items-center justify-between rounded-full transition-all duration-300 ease-out",
                        "w-[68px] h-[36px] px-1",
                        boostAddon 
                          ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]" 
                          : "bg-gray-300"
                      )}
                    >
                      {/* ON/OFF Labels */}
                      <span className={cn(
                        "text-[11px] font-bold uppercase pl-1.5 transition-all duration-200",
                        boostAddon ? "text-white" : "text-transparent"
                      )}>
                        ON
                      </span>
                      <span className={cn(
                        "text-[11px] font-bold uppercase pr-1.5 transition-all duration-200",
                        boostAddon ? "text-transparent" : "text-gray-500"
                      )}>
                        OFF
                      </span>
                      
                      {/* Toggle Knob */}
                      <span
                        className={cn(
                          "absolute inline-flex items-center justify-center rounded-full bg-white shadow-md",
                          "w-[28px] h-[28px] top-1",
                          "transition-all duration-300 ease-out",
                          boostAddon 
                            ? "left-[36px] shadow-lg" 
                            : "left-1"
                        )}
                      >
                        {boostAddon ? (
                          <Check className="w-4 h-4 text-green-500" strokeWidth={3} />
                        ) : (
                          <Plus className="w-4 h-4 text-gray-400" strokeWidth={2} />
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Add-ons removed from new business per Jan 2026 update */}

        {/* Conversion-Optimized Trust & Action Section */}
        <div id="your-cover-details" className="pt-2 pb-6 md:pt-4 md:pb-10 space-y-4">
          
          {/* Main Trust & CTA Card */}
          <div className="bg-gradient-to-br from-green-100 via-green-50 to-white rounded-2xl border-2 border-green-200 p-6 md:p-8 shadow-lg">
            
            {/* Trust Signals Row */}
            {(() => {
              const payInFull = displayMonthlyPrice * 12;
              const coverMonths = paymentType === '12months' ? 12 : paymentType === '24months' ? 24 : 36;
              const costPerMonthOfCover = calculateCPMWithGuardrail(payInFull, coverMonths, displayMonthlyPrice);
              const coverYears = paymentType === '12months' ? '1' : paymentType === '24months' ? '2' : '3';
              const savings = getMarketingSavings(paymentType as PaymentPeriod);
              const wasPrice = payInFull + savings;
              
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* 94% Claims Approved */}
                    <div className="flex items-center gap-3 bg-white rounded-lg p-4 border border-[#E5E5E5]">
                      <div className="w-10 h-10 rounded-full bg-[#3A8F45] flex items-center justify-center flex-shrink-0">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <span className="font-bold text-[#3A8F45] text-lg">94%</span>
                        <p className="text-sm text-[#555555]">of claims approved fast</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-white rounded-lg p-4 border border-[#E5E5E5]">
                      <a 
                        href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 w-full hover:opacity-90 transition-opacity"
                      >
                        <TrustpilotHeader className="scale-90" />
                        <div>
                          <span className="font-bold text-[#333333] text-sm">Five‑Star Service</span>
                          <p className="text-xs text-[#777777]">Rated Excellent by UK drivers</p>
                        </div>
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-white rounded-lg p-4 border border-[#E5E5E5]">
                      <div className="w-10 h-10 rounded-full bg-[#FFF3E0] flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-[#E65100]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <span className="font-bold text-[#E65100]">14-Day</span>
                        <p className="text-sm text-[#555555]">Money-back guarantee</p>
                      </div>
                    </div>
                  </div>

                  {/* Price Summary & CTA */}
                  <div className="bg-white rounded-xl border-2 border-[#E5E5E5] p-4 md:p-6">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col md:flex-row md:items-stretch gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg md:text-xl font-bold text-[#000000] mb-2">
                            {coverYears}-Year Cover
                          </h3>
                          
                          {/* Main pricing display - Cost per month of cover */}
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className="text-2xl font-bold text-[#000000]">£{costPerMonthOfCover}</span>
                            <span className="text-sm text-[#333333]">per month</span>
                          </div>
                          
                          <p className="text-sm font-semibold text-[#333333] mb-1">
                            Paid monthly for 12 months <span className="font-bold text-[#000000]">£{displayMonthlyPrice}</span> per month
                          </p>
                          
                          {/* No payments in year 2/3 for multi-year */}
                          {paymentType !== '12months' && (
                            <p className="text-sm font-semibold text-[#333333]">
                              No payments in year {paymentType === '24months' ? '2' : '2 or 3'}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2 w-full md:w-auto md:justify-center md:mt-4">
                          <Button
                            onClick={handleSelectPlan}
                            className="bg-[#3A8F45] hover:bg-[#2F7438] text-white font-bold py-4 px-8 text-lg shadow-lg hover:shadow-xl transition-all animate-breathing w-full md:w-auto"
                          >
                            <span className="md:hidden">Checkout securely</span>
                            <span className="hidden md:inline">Continue to secure payment</span>
                            <ArrowRight className="w-5 h-5 ml-2" strokeWidth={2.5} />
                          </Button>
                          <div className="flex items-center justify-center gap-2 text-xs text-[#777777]">
                            <Lock className="w-3 h-3" />
                            <span>Secure checkout – SSL encrypted</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Urgency micro-copy */}
                    <p className="text-center md:text-left text-sm text-[#3A8F45] mt-3 font-medium">
                      ⚡ You're covered in 60 seconds – no payment taken until confirmation
                    </p>
                  </div>
                </>
              );
            })()}
          </div>

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

      {/* Sticky Total Bar - Always visible - Monochrome Design */}
      {!vehicleAgeError && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#3A8F45] z-50 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 max-w-6xl mx-auto gap-4">
            
            {/* Loading State */}
            {plansLoading && (
              <div className="flex items-center justify-center w-full py-2">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-[#333333] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[#777777] font-medium">Loading pricing plans...</span>
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
                  className="bg-[#333333] hover:bg-[#000000] text-white"
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
                  const payInFull = displayMonthlyPrice * 12;
                  const coverMonths = paymentType === '12months' ? 12 : paymentType === '24months' ? 24 : 36;
                  const costPerMonthOfCover = calculateCPMWithGuardrail(payInFull, coverMonths, displayMonthlyPrice);
                  const payInFullPrice = Math.round(payInFull * 0.9);
                  const savings = payInFull - payInFullPrice;
                  const coverYears = paymentType === '12months' ? '1' : paymentType === '24months' ? '2' : '3';
                  
                  return (
                    <div className="flex flex-col md:hidden w-full bg-white">
                      {/* Collapsed State - Main Row */}
                      <div className="flex items-center justify-between gap-3 px-1">
                        {/* Left Side - Cover Info */}
                        <div className="flex-shrink-0">
                          <p className="text-sm font-bold text-[#000000]">£{displayMonthlyPrice}/mo × 12</p>
                          <p className="text-xs text-[#333333]">
                            <span className="font-semibold text-[#000000]">£{costPerMonthOfCover}/mo</span> avg
                          </p>
                          <p className="text-xs text-[#333333]">Total: £{payInFull}</p>
                        </div>
                        
                        {/* Right Side - CTA Button */}
                        <div className="flex flex-col items-center gap-1">
                          <Button
                            onClick={handleSelectPlan}
                            className="bg-white hover:bg-[#F2F2F2] text-[#000000] font-semibold py-3 px-5 rounded-lg text-sm gap-1.5 border border-[#000000] shadow-none"
                          >
                            Checkout
                            <ArrowRight className="w-4 h-4" strokeWidth={2} />
                          </Button>
                          <div className="flex items-center gap-1 text-[10px] text-[#777777]">
                            <Lock className="w-3 h-3" />
                            <span>Secure checkout – 14 days to cancel</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Show/Hide Details Toggle */}
                      <button
                        onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                        className="w-full flex items-center justify-center gap-1 text-xs text-[#333333] py-2 mt-2 border-t border-[#E5E5E5]"
                        aria-expanded={isSummaryExpanded}
                      >
                        <span>{isSummaryExpanded ? 'Hide details' : 'Show details'}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isSummaryExpanded ? 'rotate-0' : 'rotate-180'}`} />
                      </button>

                      {/* Expanded Content */}
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSummaryExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="px-4 py-4 space-y-4 bg-white border-t border-[#E5E5E5]">
                          {/* Main headline: £X/month for 12 months */}
                          <div className="text-center">
                            <p className="text-lg font-bold text-[#000000]">
                              £{displayMonthlyPrice}/month for 12 months
                            </p>
                          </div>
                          
                          {/* Average per month */}
                          <div className="text-center">
                            <p className="text-sm text-[#555555]">
                              <span className="font-semibold text-[#000000]">£{costPerMonthOfCover}/month</span> average
                            </p>
                          </div>
                          
                          {/* £0 in year 2 & year 3 */}
                          {paymentType !== '12months' && (
                            <p className="text-center text-sm font-semibold text-[#333333]">
                              £0 in year {paymentType === '24months' ? '2' : '2 & year 3'}
                            </p>
                          )}
                          
                          {/* Total */}
                          <p className="text-center text-sm text-[#333333]">
                            Total: <span className="font-semibold text-[#000000]">£{payInFull}</span>
                          </p>
                          
                          {/* Pay in Full Savings */}
                          <div className="text-center pt-3 border-t border-[#E5E5E5]">
                            <p className="text-sm text-[#333333]">
                              Pay in full and <span className="font-semibold text-[#3A8F45]">save £{savings}</span>
                            </p>
                            <p className="text-sm text-[#333333]">
                              <span className="font-bold text-[#000000]">£{payInFullPrice}</span> today <span className="text-[#777777]">(was £{payInFull})</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Desktop Layout - Monochrome 4-Section Design */}
                {(() => {
                  const payInFull = displayMonthlyPrice * 12;
                  const coverMonths = paymentType === '12months' ? 12 : paymentType === '24months' ? 24 : 36;
                  const costPerMonthOfCover = calculateCPMWithGuardrail(payInFull, coverMonths, displayMonthlyPrice);
                  const payInFullPrice = Math.round(payInFull * 0.9);
                  const savings = payInFull - payInFullPrice;
                  const coverYears = paymentType === '12months' ? '1' : paymentType === '24months' ? '2' : '3';
                  
                  return (
                    <div className="hidden md:flex md:items-center md:justify-between w-full gap-6">
                      
                      {/* Far Left Section - Trustpilot + Cancel */}
                      <div className="flex flex-col items-start gap-1.5 min-w-[140px] pr-6 border-r border-[#DDDDDD]">
                        <a 
                          href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                        >
                          <img 
                            src="/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" 
                            alt="Trustpilot" 
                            className="h-6 w-auto"
                          />
                        </a>
                        <span className="text-xs text-[#777777]">14 days to cancel</span>
                      </div>

                      {/* Main Pricing Section (Centre-Left) */}
                      <div className="flex flex-col items-start gap-0.5 px-6 border-r border-[#DDDDDD]">
                        {/* Large headline: £X/month for 12 months */}
                        <p className="text-xl font-bold text-[#000000]">
                          £{displayMonthlyPrice}/month for 12 months
                        </p>
                        
                        {/* Average price line */}
                        <p className="text-sm text-[#333333]">
                          <span className="font-semibold text-[#000000]">£{costPerMonthOfCover}/month</span> average
                        </p>
                        
                        {/* £0 in year 2 & year 3 - for multi-year plans */}
                        {paymentType !== '12months' && (
                          <p className="text-sm font-semibold text-[#333333]">
                            £0 in year {paymentType === '24months' ? '2' : '2 & year 3'}
                          </p>
                        )}
                        
                        {/* Total */}
                        <p className="text-sm text-[#333333]">
                          Total: <span className="font-semibold">£{payInFull}</span>
                        </p>
                      </div>

                      {/* Pay in Full Section */}
                      <div className="flex flex-col items-start gap-1 px-6 border-r border-[#DDDDDD]">
                        <p className="text-sm text-[#333333]">
                          Pay in full and <span className="font-semibold text-[#3A8F45]">save £{savings}</span>
                        </p>
                        <p className="text-sm text-[#333333]">
                          <span className="font-semibold text-[#000000]">£{payInFullPrice}</span> today <span className="text-[#777777]">(was £{payInFull})</span>
                        </p>
                      </div>

                      {/* Far Right CTA Section */}
                      <div className="flex flex-col items-end gap-2 min-w-[180px]">
                        <Button
                          onClick={handleSelectPlan}
                          className="bg-[#3A8F45] hover:bg-[#2F7438] text-white font-semibold py-5 px-6 rounded-lg text-sm gap-2 border-none shadow-none animate-breathing"
                        >
                          Continue to checkout
                          <ArrowRight className="w-4 h-4 text-white" strokeWidth={2} />
                        </Button>
                        <div className="flex items-center gap-1.5 text-xs text-[#777777]">
                          <Lock className="w-3 h-3" />
                          <span>Secure checkout – No hidden fees</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            
          </div>
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
                <span className="font-bold">£{(boostAddon ? selectedClaimLimit + 1000 : selectedClaimLimit).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Excess:</span>
                <span className="font-bold">£{voluntaryExcess}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Labour Rate:</span>
                <span className="font-bold">£{selectedLabourRate}/hr</span>
              </div>
              {(() => {
                // Calculate all pricing values once
                let calculatedMonthlyPrice: number;
                let calculatedTotalCost: number;
                const coverMonths = emailQuoteDuration === '12months' ? 12 : emailQuoteDuration === '24months' ? 24 : 36;
                
                if (emailQuoteDuration === paymentType) {
                  calculatedMonthlyPrice = monthlyPrice;
                  calculatedTotalCost = monthlyPrice * 12;
                } else {
                  const warrantyYears = emailQuoteDuration === '12months' ? 1 : emailQuoteDuration === '24months' ? 2 : 3;
                  const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
                  const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, emailQuoteDuration);
                  const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
                  
                  const durationMonths = emailQuoteDuration === '12months' ? 12 : emailQuoteDuration === '24months' ? 24 : 36;
                  const labourRateTotalAdj = calculateLabourRateAdjustment(selectedLabourRate, emailQuoteDuration as PaymentPeriod);
                  const boostCost = calculateBoostAdjustment(boostAddon, emailQuoteDuration as PaymentPeriod);
                  const addOnCost = calculateAddOnPrice(selectedProtectionAddOns, emailQuoteDuration, durationMonths);
                  
                  const total = adjustedBasePrice + labourRateTotalAdj + boostCost + addOnCost;
                  calculatedMonthlyPrice = Math.floor(total / 12);
                  calculatedTotalCost = calculatedMonthlyPrice * 12;
                }
                
                const costPerMonthOfCover = calculateCPMWithGuardrail(calculatedTotalCost, coverMonths, calculatedMonthlyPrice);
                
                return (
                  <>
                    <div className="flex justify-between items-start border-t pt-2 mt-2">
                      <span className="text-gray-600">Monthly Payment:</span>
                      <div className="text-right">
                        <span className="font-bold text-lg">£{calculatedMonthlyPrice}/month</span>
                        <div className="text-xs text-gray-500">(12 interest-free payments)</div>
                      </div>
                    </div>
                    
                    {emailQuoteDuration !== '12months' && (
                      <div className="flex justify-between items-center bg-[#F0FDF4] rounded-lg px-3 py-2 mt-2">
                        <span className="text-sm text-[#166534]">Works out to just</span>
                        <span className="font-semibold text-[#166534]">£{costPerMonthOfCover}/month of cover</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-600">Total Cost:</span>
                      <span className="font-bold text-[#3A8F45]">£{calculatedTotalCost}</span>
                    </div>
                  </>
                );
              })()}
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

    </div>
  );
};

export default PricingTable;