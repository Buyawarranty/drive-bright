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
  const [paymentType, setPaymentType] = useState<'12months' | '24months' | '36months' | null>(previousPaymentType || '24months');
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
  // Validate previousClaimLimit is a valid option (750, 1250, 2000), otherwise default to 1250
  // Account for boost addon which adds 1000 to the claim limit value
  const validClaimLimits = [750, 1250, 2000];
  const getValidatedClaimLimit = (): number => {
    if (!previousClaimLimit) return 1250;
    // Check if it's a valid base claim limit
    if (validClaimLimits.includes(previousClaimLimit)) return previousClaimLimit;
    // Check if it's a boosted claim limit (base + 1000)
    const possibleBaseLimit = previousClaimLimit - 1000;
    if (validClaimLimits.includes(possibleBaseLimit)) return possibleBaseLimit;
    // Default to 1250
    return 1250;
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
  const [selectedLabourRate, setSelectedLabourRate] = useState<number>(previousLabourRate || 50);
  
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

  // Ensure selected payment type is valid for vehicle age
  useEffect(() => {
    console.log('🔄 Payment Type Validation:', { paymentType, availableDurations });
    if (paymentType && !availableDurations.includes(paymentType)) {
      // If current selection is not available, default to 12months
      console.log('⚠️ Resetting payment type to 12months - current selection not available');
      setPaymentType('12months');
    }
  }, [paymentType, availableDurations]);

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
            step_abandoned: 3
          }
        });
        console.log('✅ Tracked abandoned cart at Step 3 (Pricing Page) for:', vehicleData.email);
      } catch (error) {
        console.error('Error tracking abandoned cart on pricing page:', error);
      }
    };
    
    trackPricingPageView();
  }, []); // Only run once when component mounts

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

  // Get pricing data using your exact pricing structure
  const getPricingData = (excess: number, claimLimit: number, paymentPeriod: string) => {
    // BASE prices from CURRENT_PRICE_DEC_2025.xlsx at £50/hr labour rate
    const pricingTable = {
      '12months': {
        0: { 750: 467, 1250: 497, 2000: 587 },
        50: { 750: 437, 1250: 457, 2000: 547 },
        100: { 750: 387, 1250: 417, 2000: 507 },
        150: { 750: 367, 1250: 387, 2000: 477 }
      },
      '24months': {
        0: { 750: 897, 1250: 937, 2000: 1027 },
        50: { 750: 827, 1250: 877, 2000: 957 },
        100: { 750: 737, 1250: 787, 2000: 877 },
        150: { 750: 697, 1250: 737, 2000: 827 }
      },
      '36months': {
        0: { 750: 1347, 1250: 1397, 2000: 1497 },
        50: { 750: 1247, 1250: 1297, 2000: 1397 },
        100: { 750: 1097, 1250: 1177, 2000: 1277 },
        150: { 750: 1047, 1250: 1097, 2000: 1197 }
      }
    };
    
    const periodData = pricingTable[paymentPeriod as keyof typeof pricingTable] || pricingTable['12months'];
    const excessData = periodData[excess as keyof typeof periodData] || periodData[0];
    return excessData[claimLimit as keyof typeof excessData] || excessData[1250];
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
    
    // Use your exact pricing structure
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
    const durationMonths = paymentType === '12months' ? 12 : 
                          paymentType === '24months' ? 24 : 36;
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
  
  // Calculate boost addon cost (£5/month for 12 months = £60)
  const boostAddonCost = useMemo(() => {
    return boostAddon ? 60 : 0;
  }, [boostAddon]);

  // Memoized total price calculation - should be base price + add-ons + boost for consistency
  const totalPrice = useMemo(() => {
    return basePlanPrice + addOnPrice + boostAddonCost;
  }, [basePlanPrice, addOnPrice, boostAddonCost]);

  // Memoized discounted base price for display
  const discountedBasePlanPrice = useMemo(() => {
    let discountedPrice = basePlanPrice;
    if (paymentType === '24months') {
      discountedPrice = basePlanPrice - 100; // £100 discount for 2-year plans
    } else if (paymentType === '36months') {
      discountedPrice = basePlanPrice - 200; // £200 discount for 3-year plans
    }
    return discountedPrice;
  }, [basePlanPrice, paymentType]);

  // Memoized total discounted price (with add-ons and boost - for API/checkout)
  const totalDiscountedPrice = useMemo(() => {
    return discountedBasePlanPrice + addOnPrice + boostAddonCost;
  }, [discountedBasePlanPrice, addOnPrice, boostAddonCost]);

  // Memoized total discounted price WITHOUT boost and WITHOUT one-time add-ons (for monthly display calculations)
  const totalDiscountedPriceWithoutBoost = useMemo(() => {
    return discountedBasePlanPrice + recurringAddOnPrice;
  }, [discountedBasePlanPrice, recurringAddOnPrice]);

  // Memoized labour rate adjustment based on duration
  // Labour rate £40/hr = -£5/month, £50/hr (base) = 0, £70/hr = +£4/month, £100/hr = +£8/month
  const labourRateDisplayAdjustment = useMemo(() => {
    return selectedLabourRate === 40 ? -5 : selectedLabourRate === 70 ? 4 : selectedLabourRate === 100 ? 8 : 0;
  }, [selectedLabourRate]);

  // Memoized boost display adjustment (display only - £5/month instead of actual £7/month)
  const boostDisplayAdjustment = useMemo(() => {
    return boostAddon ? 5 : 0;
  }, [boostAddon]);

  // Memoized display monthly price - includes base + labour + boost + recurring add-ons
  const displayMonthlyPrice = useMemo(() => {
    const durationMonths = paymentType === '12months' ? 12 : paymentType === '24months' ? 24 : 36;
    const labourTotalAdjust = labourRateDisplayAdjustment * durationMonths;
    const boostTotalAdjust = boostDisplayAdjustment * durationMonths;
    const totalPrice = basePlanPrice + labourTotalAdjust + boostTotalAdjust + recurringAddOnPrice;
    return Math.floor(totalPrice / 12);
  }, [basePlanPrice, paymentType, labourRateDisplayAdjustment, boostDisplayAdjustment, recurringAddOnPrice]);

  // Memoized display total price - exact total including all add-ons
  const displayTotalPrice = useMemo(() => {
    const durationMonths = paymentType === '12months' ? 12 : paymentType === '24months' ? 24 : 36;
    const labourTotalAdjust = labourRateDisplayAdjustment * durationMonths;
    const boostTotalAdjust = boostDisplayAdjustment * durationMonths;
    return basePlanPrice + labourTotalAdjust + boostTotalAdjust + recurringAddOnPrice + oneTimeAddOnPrice;
  }, [basePlanPrice, paymentType, labourRateDisplayAdjustment, boostDisplayAdjustment, recurringAddOnPrice, oneTimeAddOnPrice]);

  // Memoized monthly price calculation - always divide total by 12 for monthly payments
  const monthlyPrice = useMemo(() => {
    // Always show 12 monthly payments regardless of plan duration for display
    return Math.round(totalPrice / 12);
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
    // Always show 12 monthly installments regardless of plan duration
    return Math.round(totalPrice / 12);
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
      
      // Calculate boost addon cost (£5/month for 12 months = £60)
      const boostCost = boostAddon ? 60 : 0;
      
      // Calculate labour rate display adjustment (annual)
      let labourRateAdjust = 0;
      if (selectedLabourRate === 40) {
        labourRateAdjust = -3 * 12; // -£36 annually
      } else if (selectedLabourRate === 70) {
        labourRateAdjust = 4 * 12; // +£48 annually
      } else if (selectedLabourRate === 100) {
        labourRateAdjust = 8 * 12; // +£96 annually
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
      const warrantyYears = emailQuoteDuration === '12months' ? 1 : emailQuoteDuration === '24months' ? 2 : 3;
      const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
      const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, emailQuoteDuration);
      const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
      
      // Apply automatic discounts
      let discountedPrice = adjustedBasePrice;
      if (emailQuoteDuration === '24months') {
        discountedPrice = adjustedBasePrice - 100;
      } else if (emailQuoteDuration === '36months') {
        discountedPrice = adjustedBasePrice - 200;
      }
      
      const baseMonthlyPrice = Math.round(discountedPrice / 12);
      const labourRateAdjustment = selectedLabourRate === 40 ? -3 : selectedLabourRate === 70 ? 4 : selectedLabourRate === 100 ? 8 : 0;
      const boostDisplayAdjustment = boostAddon ? 5 : 0;
      const displayedMonthlyPrice = Math.round(baseMonthlyPrice + labourRateAdjustment + boostDisplayAdjustment);

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
            paymentType: emailQuoteDuration
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
                {vehicleData?.mileage ? parseInt(vehicleData.mileage).toLocaleString() : '0'} miles
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
                  {vehicleData?.mileage ? parseInt(vehicleData.mileage).toLocaleString() : '0'} miles
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
                1
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 flex-shrink-0" />
                Choose your cover duration
              </h2>
            </div>
            <span className="text-sm text-gray-600 font-bold text-center w-full sm:w-auto sm:text-base sm:self-center">0% APR · All Parts included at No Extra Cost</span>
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
              ? 'grid-cols-1 md:max-w-md md:mx-auto' 
              : availableDurations.length === 2 
                ? 'grid-cols-1 md:grid-cols-2 md:max-w-3xl md:mx-auto' 
                : 'grid-cols-1 md:grid-cols-3'
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
                badge: 'MOST POPULAR', 
                planName: 'Platinum Complete Plan',
                features: [
                  'All mechanical & electrical parts',
                  'Unlimited Claims',
                  'Total cover up to vehicle value',
                  'Labour costs included',
                  'Fault diagnostics',
                  'Vehicle recovery claim-back',
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
                  'Vehicle recovery claim-back',
                  'Europe repair cover',
                  'Vehicle rental cover',
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
              
              // Labour rate adjustment: £40=-£5/mo, £50=base, £70=+£4/mo, £100=+£8/mo
              const labourMonthlyAdjust = selectedLabourRate === 40 ? -5 : selectedLabourRate === 70 ? 4 : selectedLabourRate === 100 ? 8 : 0;
              const labourTotalAdjust = labourMonthlyAdjust * durationMonths;
              
              // Boost addon: +£5/month for duration
              const boostTotalAdjust = boostAddon ? (5 * durationMonths) : 0;
              
              // Calculate total price with all adjustments (exact Excel price + adjustments)
              const totalPriceWithAdjustments = finalBasePrice + labourTotalAdjust + boostTotalAdjust;
              
              // Calculate display monthly price (always divide by 12, round DOWN)
              const displayedMonthlyPrice = Math.floor(totalPriceWithAdjustments / 12);
              
              // Pay in full = exact total price (NOT monthly × 12)
              const displayedAnnualPrice = totalPriceWithAdjustments;
              
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
                  className={`relative p-6 rounded-lg border-2 transition-all bg-white pointer-events-auto cursor-pointer hover:shadow-lg ${
                    isSelected
                      ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                      : 'border-gray-300 hover:border-orange-300'
                  }`}
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  {/* Badge */}
                  {duration.badge && (
                    <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      durationId === '24months' ? 'bg-orange-500 text-white' : 'bg-green-600 text-white'
                    }`}>
                      {duration.badge}
                    </span>
                  )}
                  
                  {/* Selection Checkbox - Top Right */}
                  <div 
                    className="absolute top-4 right-4 cursor-pointer"
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

                  {/* Duration Title */}
                  <h4 className="text-xl font-bold text-gray-900 mb-1">
                    {duration.label}
                  </h4>
                  <p className="text-sm text-gray-500 mb-3">{duration.planName}</p>
                  
                  {/* Price Section */}
                  <div className="mb-4">
                    {/* Price Headline */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-black">£{displayedMonthlyPrice}/month</span>
                      <span className="text-sm font-bold text-gray-400">(12 payments only)</span>
                    </div>
                    
                    {/* Free year benefit line with tick */}
                    {durationId === '24months' && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-black">Year 2 FREE cover</span>
                      </div>
                    )}
                    {durationId === '36months' && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-black">Years 2 & 3 FREE cover</span>
                      </div>
                    )}
                    
                    {/* Pay in full with was price */}
                    <div className="text-sm mt-2">
                      {/* Pay in full = exact total price from Excel */}
                      <span className="font-bold text-black">Pay in full £{displayedAnnualPrice}</span>
                      {savingsAmount > 0 && (
                        <span className="text-red-500 line-through ml-1">(Was £{displayedAnnualPrice + savingsAmount})</span>
                      )}
                    </div>
                    
                    {/* Savings line */}
                    {savingsAmount > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-sm font-bold text-green-600">Save £{savingsAmount} Today 🔥</span>
                      </div>
                    )}
                  </div>
                  
                  {/* What's Included Collapsible */}
                  <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                    <CollapsibleTrigger className="w-full mb-4">
                      <div className="flex items-center justify-between w-full border border-gray-300 rounded-lg px-4 py-3 hover:border-gray-400 transition-colors">
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
                          const isExclusion = feature.toLowerCase().includes('pre-existing faults');
                          return (
                            <div key={idx} className="flex items-start gap-2">
                              {isExclusion ? (
                                <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              )}
                              <span className="text-sm text-gray-700">{feature}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* CTA Button with Hover Effect and Arrow */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      isUserPaymentTypeChange.current = true;
                      setPaymentType(durationId);
                    }}
                    className={cn(
                      "w-full mb-1.5 font-bold text-base py-6 transition-all duration-300 group",
                      isSelected
                        ? "bg-black hover:bg-black/90 text-white shadow-lg border-2 border-black"
                        : "bg-brand-orange hover:bg-brand-orange/90 text-white border-2 border-brand-orange"
                    )}
                    size="lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span>{isSelected ? 'Selected' : 'Select this plan'}</span>
                      {!isSelected && <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />}
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

        <div id="whats-covered" className="section-header rounded-lg p-4 sm:p-8 mb-8">
          <Collapsible open={whatsCoveredOpen} onOpenChange={setWhatsCoveredOpen}>
            {/* Header row with title and button */}
            <div className="flex items-start justify-between mb-4">
              <CollapsibleTrigger className="flex-1">
                <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-black flex-shrink-0" />
                  <h2 className="text-lg sm:text-xl font-semibold text-black">
                    Instant all-in-one cover
                  </h2>
                  <ChevronDown className="w-5 h-5 sm:w-8 sm:h-8 text-black transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              
              {/* Parts & components button - top right on desktop */}
              <CollapsibleTrigger asChild>
                <button className="hidden md:inline-flex items-center gap-3 bg-brand-orange hover:bg-brand-orange/90 rounded-lg px-6 py-4 shadow-md transition-colors group cursor-pointer">
                  <Info className="w-5 h-5 text-white" />
                  <span className="text-lg font-medium text-white whitespace-nowrap">Parts & components list</span>
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
                <div className="inline-flex items-center gap-3 bg-brand-orange hover:bg-brand-orange/90 rounded-lg px-7 py-4 shadow-md transition-colors">
                  <Info className="w-5 h-5 text-white" />
                  <span className="text-lg font-medium text-white whitespace-nowrap">Parts & components list</span>
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
            Select the hourly labour rate that matches your preferred garage type
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setSelectedLabourRate(40)}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedLabourRate === 40
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <span className="absolute -top-3 right-4 bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">BEST VALUE</span>
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£40 </span>
                <span className="text-sm font-medium text-foreground">per hour</span>
              </div>
              <p className="text-xl font-bold text-black">Local Garages</p>
              <p className="text-xs text-muted-foreground mt-1">Affordable option for smaller garages.</p>
            </button>
            
            <button
              onClick={() => setSelectedLabourRate(50)}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedLabourRate === 50
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <span className="absolute -top-3 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold">MOST POPULAR</span>
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£50 </span>
                <span className="text-sm font-medium text-foreground">per hour</span>
              </div>
              <p className="text-xl font-bold text-black">Independent Garages</p>
              <p className="text-xs text-muted-foreground mt-1">Ideal for your trusted local garage.</p>
            </button>
            
            <button
              onClick={() => setSelectedLabourRate(70)}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedLabourRate === 70
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£70 </span>
                <span className="text-sm font-medium text-foreground">per hour</span>
              </div>
              <p className="text-xl font-bold text-black">Approved Garages</p>
              <p className="text-xs text-muted-foreground mt-1">Covers most garages nationwide.</p>
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
              Choose your claim limit
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
                    Understanding Your Claim Limit
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <p className="text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-900">What is a Claim Limit?</span> Your claim limit is the maximum amount we'll pay per claim for covered repairs. If your repair costs exceed your chosen limit, you'll need to pay the difference.
                  </p>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Info className="w-5 h-5 text-green-600" />
                      How It Works - Example:
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium text-gray-900 mb-2">Advanced Coverage (£1,250 limit):</p>
                        <div className="ml-4 space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-foreground">If your repair costs £1,250 or less:</p>
                              <p className="text-muted-foreground">We'll cover the full cost of parts and labour, within the limits of your warranty plan.</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-foreground">If your repair costs more than £1,250:</p>
                              <p className="text-muted-foreground">You'll simply pay the difference. For example, if the total is £1,400, we'll cover £1,250 and you'll only pay £150.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-gray-700 text-sm">
                      <span className="font-semibold text-gray-900">💡 Pro Tip:</span> Choose a higher limit for greater peace of mind. Most major repairs fall within the £1,250-£2,000 range, making our Advanced and Elite plans the most popular choices for comprehensive protection.
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-700 text-sm">
                      Your excess amount and claim limits depend on the cover options you choose – there are no hidden fees. Just clear, reliable protection to help you manage unexpected repair bills.
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-gray-700 text-sm">
                      Plus, with nationwide support and fast claims processing, we'll get you back on the road quickly and with confidence.
                    </p>
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
            <Wrench className="w-5 h-5 flex-shrink-0" /> Set your claim limit - cover up to your car's full value
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Essential */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 750
                  ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-2 border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(750);
                setValidationErrors(prev => ({ ...prev, claimLimit: false }));
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xl font-bold text-black mb-1">AutoCare Essential</h4>
                  <div className="text-3xl font-bold text-black">
                    £{selectedClaimLimit === 750 && boostAddon ? '1,750' : '750'} <span className="text-base">per claim</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedClaimLimit === 750 ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {selectedClaimLimit === 750 && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
            </div>
            
            {/* Advanced */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 1250
                  ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-2 border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(1250);
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
                    £{selectedClaimLimit === 1250 && boostAddon ? '2,250' : '1,250'} <span className="text-base">per claim</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedClaimLimit === 1250 ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {selectedClaimLimit === 1250 && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
            </div>
            
            {/* Elite */}
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
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xl font-bold text-black mb-1">AutoCare Elite</h4>
                  <div className="text-3xl font-bold text-black">
                    £{selectedClaimLimit === 2000 && boostAddon ? '3,000' : '2,000'} <span className="text-base">per claim</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedClaimLimit === 2000 ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {selectedClaimLimit === 2000 && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
            </div>
          </div>
          
          {/* Boost Add-On */}
          <div 
            className={`mt-4 p-6 rounded-lg transition-all duration-200 cursor-pointer bg-white ${
              boostAddon 
                ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30' 
                : 'border-2 border-gray-200 hover:border-orange-300 hover:shadow-md'
            }`}
            onClick={() => setBoostAddon(!boostAddon)}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xl font-bold text-black">🚀 Boost Claim Limit</h4>
                  <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">UPGRADE</span>
                </div>
                <div className="text-3xl font-bold text-black mb-1">
                  £{selectedClaimLimit.toLocaleString()} → £{(selectedClaimLimit + 1000).toLocaleString()}
                </div>
                <p className="text-sm text-gray-600">+ £5/month x 12 payments</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                boostAddon ? 'bg-green-500 border-green-500' : 'border-gray-300'
              }`}>
                {boostAddon && <Check className="w-4 h-4 text-white" />}
              </div>
            </div>
          </div>
        </div>
        <div className="section-header rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
              6
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <h3 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 flex-shrink-0" />
                Optional Add-Ons
              </h3>
              <p className="text-muted-foreground text-base font-bold">Boost Your Cover ✨</p>
            </div>
          </div>
          <AddOnProtectionPackages 
            selectedAddOns={selectedProtectionAddOns}
            paymentType={paymentType}
            onAddOnChange={(addOnKey, selected) => 
              setSelectedProtectionAddOns(prev => ({ ...prev, [addOnKey]: selected }))
            }
          />
        </div>

        {/* Conversion-Optimized Trust & Action Section */}
        <div id="your-cover-details" className="pt-2 pb-6 md:pt-4 md:pb-10 space-y-4">
          
          {/* Main Trust & CTA Card */}
          <div className="bg-gradient-to-br from-green-100 via-green-50 to-white rounded-2xl border-2 border-green-200 p-6 md:p-8 shadow-lg">
            
            {/* Trust Signals Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3 bg-white rounded-lg p-4 border border-green-100">
                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="font-bold text-green-800 text-lg">94%</span>
                  <p className="text-base text-gray-600">of claims approved fast</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white rounded-lg p-4 border border-green-100">
                <a 
                  href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full hover:opacity-90 transition-opacity"
                >
                  <TrustpilotHeader className="scale-90" />
                  <div>
                    <span className="font-bold text-gray-800 text-sm">Excellent</span>
                    <p className="text-xs text-gray-500">Thousands of UK drivers</p>
                  </div>
                </a>
              </div>
              
              <div className="flex items-center gap-3 bg-white rounded-lg p-4 border border-green-100">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <span className="font-bold text-orange-600">14-Day</span>
                  <p className="text-sm text-gray-600">Money-back guarantee</p>
                </div>
              </div>
            </div>

            {/* Price Summary & CTA */}
            <div className="bg-white rounded-xl border-2 border-green-300 p-5 md:p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-stretch gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">Your Platinum Plan</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gray-900">£{displayMonthlyPrice}/month</span>
                      <span className="text-sm text-black">(Only 12 payments)</span>
                    </div>
                    <p className="text-sm text-black mt-1">
                      Or pay in full: £{Math.round(displayTotalPrice)} <span className="text-green-600 font-medium">(Save 10% at checkout)</span>
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2 w-full md:w-auto md:justify-center md:mt-8">
                    <Button
                      onClick={handleSelectPlan}
                      className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 px-8 text-lg shadow-lg hover:shadow-xl transition-all animate-cta-enhanced w-full md:w-auto"
                    >
                      <span className="md:hidden">Checkout securely</span>
                      <span className="hidden md:inline">Continue to secure payment</span>
                      <ArrowRight className="w-5 h-5 ml-2" strokeWidth={4.5} />
                    </Button>
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                      <Lock className="w-3 h-3" />
                      <span>Secure checkout – SSL encrypted</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Urgency micro-copy */}
              <p className="text-center md:text-left text-sm text-green-700 mt-4 font-medium">
                ⚡ You're covered in 60 seconds – no payment taken until confirmation
              </p>
            </div>
          </div>

          {/* Crystal Clear Cover Card - Original Design */}
          <div className="bg-card rounded-xl border-2 border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <span>Your cover, made crystal clear</span>
                <span className="text-xl">💎</span>
              </h3>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-1 text-sm font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-secondary transition-colors"
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
                {/* Mobile Layout - Collapsible & Centralized */}
                <div className="flex flex-col md:hidden gap-2 w-full">
                  {/* Collapse/Expand Header - Centralized */}
                  <button
                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    className="flex items-center justify-center w-full py-1 -mt-1 relative"
                  >
                    <div className="flex flex-col items-center text-center">
                      <span className="text-xl font-bold text-gray-900">
                        £{displayMonthlyPrice}/Month <span className="text-base text-gray-400">– 0% APR</span>
                      </span>
                      <span className="text-sm text-gray-600">Only 12 payments</span>
                      <span className="text-sm text-gray-900 font-medium">Pay in full: £{Math.round(displayTotalPrice)}</span>
                    </div>
                    <div className="absolute right-0 flex flex-col items-center">
                      <div className={`p-1.5 rounded-full bg-green-600 transition-transform duration-300 ${isSummaryExpanded ? 'rotate-0' : 'rotate-180'}`}>
                        <ChevronDown className="w-5 h-5 text-white" />
                      </div>
                      {/* Details text underneath - only show when collapsed */}
                      {!isSummaryExpanded && (
                        <span className="text-xs font-medium text-green-600 mt-1.5">Details</span>
                      )}
                    </div>
                  </button>
                  
                  {/* Expandable Content - Centralized */}
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSummaryExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {/* Price Details */}
                    <div className="text-center space-y-0.5 pb-2">
                      <div className="text-sm text-black font-bold">
                        {paymentType === '12months' && <span>1-Year Cover</span>}
                        {paymentType === '24months' && <><span>Year 2 FREE</span> 🎉 · <span>2-Year Cover</span></>}
                        {paymentType === '36months' && <><span>Years 2 & 3 FREE</span> 🎉 · <span>3-Year Cover</span></>}
                      </div>
                      <div className="text-sm text-black">
                        14 days to cancel
                      </div>
                    </div>
                    
                    {/* Trustpilot Badge */}
                    <a 
                      href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex justify-center items-center hover:opacity-80 transition-opacity pb-2"
                    >
                      <TrustpilotHeader className="h-4 scale-75" />
                    </a>
                  </div>
                  
                  {/* CTA Button - Always visible */}
                  <Button
                    onClick={handleSelectPlan}
                    size="lg"
                    className="w-full text-lg font-semibold py-3.5 bg-green-600 hover:bg-green-700 text-white animate-cta-enhanced"
                  >
                    Continue to checkout
                    <ArrowRight className="w-5 h-5 ml-2" strokeWidth={4.5} />
                  </Button>
                </div>

                {/* Desktop Layout - Clean 4-Section Card with Equal Spacing */}
                <div className="hidden md:flex md:items-stretch md:justify-between w-full bg-gray-50 rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  
                  {/* SECTION 1: Trust & Reassurance */}
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
                    <a 
                      href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:opacity-80 transition-opacity"
                    >
                      <TrustpilotHeader className="flex-shrink-0 scale-75" />
                    </a>
                  </div>
                  
                  {/* SECTION 2: Price */}
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      £{displayMonthlyPrice}/Month <span className="text-lg text-gray-400">– 0% APR</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      Only 12 payments
                    </div>
                    <div className="text-sm text-gray-900 font-medium mt-0.5">
                      Pay in full: £{Math.round(displayTotalPrice)}
                    </div>
                  </div>
                  
                  {/* SECTION 3: Cover & Free Years - Centered on desktop */}
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 text-center">
                    <div className="text-sm text-gray-900">
                      {paymentType !== '12months' && (
                        <span className="text-green-600 font-bold">
                          {paymentType === '24months' && 'Year 2 FREE 🎉'}
                          {paymentType === '36months' && 'Years 2 & 3 FREE 🎉'}
                        </span>
                      )}
                      {paymentType !== '12months' && ' | '}
                      <span className="font-bold text-black">
                        {paymentType === '12months' && '1-Year Cover'}
                        {paymentType === '24months' && '2-Year Cover'}
                        {paymentType === '36months' && '3-Year Cover'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      14 days to cancel
                    </div>
                  </div>
                  
                  {/* SECTION 4: CTA */}
                  <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
                    <Button
                      onClick={handleSelectPlan}
                      size="lg"
                      className="text-lg font-semibold px-8 py-3.5 bg-green-600 hover:bg-green-700 hover:shadow-lg text-white animate-cta-enhanced"
                    >
                      Continue to checkout
                      <ArrowRight className="w-5 h-5 ml-2" strokeWidth={3} />
                    </Button>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                      <Lock className="h-3 w-3" />
                      <span>Secure checkout – No hidden fees</span>
                    </div>
                  </div>
                </div>
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
              <div className="flex justify-between items-start border-t pt-2 mt-2">
                <span className="text-gray-600">Monthly Payment:</span>
                <div className="text-right">
                  <span className="font-bold">
                    £{(() => {
                      // Calculate base price for the selected emailQuoteDuration
                      const warrantyYears = emailQuoteDuration === '12months' ? 1 : emailQuoteDuration === '24months' ? 2 : 3;
                      const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
                      const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, emailQuoteDuration);
                      const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
                      
                      // Apply duration discount
                      let discountedPrice = adjustedBasePrice;
                      if (emailQuoteDuration === '24months') {
                        discountedPrice = adjustedBasePrice - 100;
                      } else if (emailQuoteDuration === '36months') {
                        discountedPrice = adjustedBasePrice - 200;
                      }
                      
                      // Calculate monthly from total (always 12 payments)
                      const baseMonthlyPrice = Math.round(discountedPrice / 12);
                      
                      // Apply labour rate display adjustment
                      const labourRateAdj = selectedLabourRate === 40 ? -3 : selectedLabourRate === 70 ? 4 : selectedLabourRate === 100 ? 8 : 0;
                      
                      // Apply boost display adjustment
                      const boostAdj = boostAddon ? 5 : 0;
                      
                      return Math.round(baseMonthlyPrice + labourRateAdj + boostAdj);
                    })()}/month
                  </span>
                  <div className="text-xs text-gray-500">(12 payments only)</div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Cost:</span>
                <span className="font-bold text-green-600">
                  £{(() => {
                    // Calculate base price for the selected emailQuoteDuration
                    const warrantyYears = emailQuoteDuration === '12months' ? 1 : emailQuoteDuration === '24months' ? 2 : 3;
                    const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
                    const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, emailQuoteDuration);
                    const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
                    
                    // Apply duration discount
                    let discountedPrice = adjustedBasePrice;
                    if (emailQuoteDuration === '24months') {
                      discountedPrice = adjustedBasePrice - 100;
                    } else if (emailQuoteDuration === '36months') {
                      discountedPrice = adjustedBasePrice - 200;
                    }
                    
                    // Apply display adjustments to total (12 months worth)
                    const labourRateAdj = selectedLabourRate === 40 ? -3 : selectedLabourRate === 70 ? 4 : selectedLabourRate === 100 ? 8 : 0;
                    const boostAdj = boostAddon ? 5 : 0;
                    const totalAdjustment = (labourRateAdj + boostAdj) * 12;
                    
                    return discountedPrice + totalAdjustment;
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

    </div>
  );
};

export default PricingTable;