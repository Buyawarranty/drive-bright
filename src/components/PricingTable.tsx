import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/protected-button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, ArrowLeft, Info, FileText, ExternalLink, ChevronDown, ChevronUp, Plus, Infinity, Zap, Car, Cog, Settings, Droplets, Cpu, Snowflake, Search, Users, RotateCcw, MapPin, X, Shield, Hash, Calendar, Gauge, Fuel, Edit, HelpCircle, Gift, ArrowRight, ArrowUp, DollarSign, MousePointerClick, ShieldCheck, PartyPopper, CheckCircle, Crown, Battery, Bike, AlertTriangle, AlertCircle, Mail } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  onPlanSelected?: (planId: string, paymentType: string, planName?: string, pricingData?: {
    totalPrice: number, 
    monthlyPrice: number, 
    voluntaryExcess: number, 
    selectedAddOns: {[addon: string]: boolean}, 
    protectionAddOns?: {[key: string]: boolean},
    claimLimit?: number,
    labourRate?: number, // Add labour rate to interface
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
}

const PricingTable: React.FC<PricingTableProps> = ({ 
  vehicleData, 
  onBack, 
  onPlanSelected,
  previousPaymentType,
  previousVoluntaryExcess,
  previousClaimLimit,
  previousSelectedAddOns,
  previousProtectionAddOns
}) => {

  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentType, setPaymentType] = useState<'12months' | '24months' | '36months' | null>(previousPaymentType || '24months');
  // If previousVoluntaryExcess is explicitly set (including 0), use it; otherwise default to £100
  const [voluntaryExcess, setVoluntaryExcess] = useState<number | null>(
    previousVoluntaryExcess !== undefined ? previousVoluntaryExcess : 100
  );
  const [selectedAddOns, setSelectedAddOns] = useState<{[planId: string]: {[addon: string]: boolean}}>(
    previousSelectedAddOns ? { 'platinum': previousSelectedAddOns } : {}
  );
  const [boostAddon, setBoostAddon] = useState(false);
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
  const [selectedClaimLimit, setSelectedClaimLimit] = useState<number | null>(previousClaimLimit ?? 1250);
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
  
  // New state for labour rate selection
  const [selectedLabourRate, setSelectedLabourRate] = useState<number>(50);
  
  // Update add-ons when payment type changes to handle auto-included add-ons
  useEffect(() => {
    const newAutoIncluded = getAutoIncludedAddOns(paymentType);
    
    console.log('PricingTable - Payment type changed:', paymentType);
    console.log('PricingTable - New auto-included add-ons:', newAutoIncluded);
    
    setSelectedProtectionAddOns(prev => {
      // All add-ons that can be auto-included in any plan
      const allPossibleAutoIncluded = ['breakdown', 'motFee', 'rental', 'tyre'];
      
      // Create new state object
      const updated: {[key: string]: boolean} = {};
      
      // For each add-on, determine its new state
      Object.keys(prev).forEach(addonKey => {
        const isAutoIncludedInNewPlan = newAutoIncluded.includes(addonKey);
        const wasAutoIncludedPreviously = allPossibleAutoIncluded.includes(addonKey);
        
        if (wasAutoIncludedPreviously) {
          // This add-on can be auto-included - set it based on new plan
          updated[addonKey] = isAutoIncludedInNewPlan;
        } else {
          // This is a user-selectable add-on (not auto-included) - preserve user choice
          updated[addonKey] = prev[addonKey];
        }
      });
      
      console.log('PricingTable - Updated protection add-ons:', updated);
      return updated;
    });
  }, [paymentType]);
  
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

  // Filter available duration options based on vehicle age
  const availableDurations = useMemo(() => {
    type DurationType = '12months' | '24months' | '36months';
    const allDurations: DurationType[] = ['12months', '24months', '36months'];
    
    console.log('🔍 Available Durations Check:', { vehicleAge });
    
    if (vehicleAge === 15) {
      // 15-year-old vehicles: only 1-year option
      console.log('⚠️ 15-year vehicle detected - limiting to 1-year only');
      return ['12months'] as DurationType[];
    } else if (vehicleAge === 14) {
      // 14-year-old vehicles: 1-year and 2-year options
      console.log('⚠️ 14-year vehicle detected - limiting to 1-2 years');
      return ['12months', '24months'] as DurationType[];
    }
    
    // All other vehicles (13 years or younger): all options
    console.log('✅ All duration options available for this vehicle');
    return allDurations;
  }, [vehicleAge]);

  // Ensure selected payment type is valid for vehicle age
  useEffect(() => {
    console.log('🔄 Payment Type Validation:', { paymentType, availableDurations });
    if (paymentType && !availableDurations.includes(paymentType)) {
      // If current selection is not available, default to 12months
      console.log('⚠️ Resetting payment type to 12months - current selection not available');
      setPaymentType('12months');
    }
  }, [paymentType, availableDurations]);

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
  useEffect(() => {
    // Skip auto-inclusion on initial mount if we're restoring from previous selections
    if (isRestoringFromPrevious.current && !hasInitializedAddOns.current) {
      console.log('🔧 Skipping auto-inclusion - restoring from previous selections');
      hasInitializedAddOns.current = true;
      return;
    }
    
    hasInitializedAddOns.current = true;
    
    // Use the imported function to get auto-included add-ons for consistency
    const newAutoIncluded = getAutoIncludedAddOns(paymentType);
    
    console.log('🔧 Payment type changed:', paymentType);
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
      // reset them to false (but only if they were previously auto-included)
      allPossibleAutoIncluded.forEach(addonKey => {
        if (!newAutoIncluded.includes(addonKey)) {
          // Only reset to false if this add-on was previously auto-included
          // This preserves user manual selections while clearing previously auto-included ones
          const wasAutoIncludedBefore = getAutoIncludedAddOns(paymentType === '12months' ? '24months' : '12months').includes(addonKey);
          if (wasAutoIncludedBefore) {
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
    // Updated pricing structure matching new matrix
    const pricingTable = {
      '12months': {
        0: { 750: 547, 1250: 587, 2000: 697 },
        50: { 750: 517, 1250: 537, 2000: 647 },
        100: { 750: 457, 1250: 497, 2000: 597 },
        150: { 750: 427, 1250: 457, 2000: 567 }
      },
      '24months': {
        0: { 750: 1057, 1250: 1097, 2000: 1207 },
        50: { 750: 967, 1250: 1037, 2000: 1127 },
        100: { 750: 867, 1250: 927, 2000: 1037 },
        150: { 750: 817, 1250: 867, 2000: 967 }
      },
      '36months': {
        0: { 750: 1587, 1250: 1637, 2000: 1757 },
        50: { 750: 1467, 1250: 1517, 2000: 1637 },
        100: { 750: 1287, 1250: 1387, 2000: 1507 },
        150: { 750: 1237, 1250: 1287, 2000: 1407 }
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
  
  // Calculate boost addon cost (£7/month for 12 months = £84)
  const boostAddonCost = useMemo(() => {
    return boostAddon ? 84 : 0;
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

  // Memoized total discounted price (with add-ons and boost)
  const totalDiscountedPrice = useMemo(() => {
    return discountedBasePlanPrice + addOnPrice + boostAddonCost;
  }, [discountedBasePlanPrice, addOnPrice, boostAddonCost]);

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
      const oneTimeAddonTotal = selectedProtectionAddOns.transfer && !getAutoIncludedAddOns(paymentType).includes('transfer') ? 19.99 : 0;
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
      
      const totalPrice = discountedBasePrice + recurringAddonTotal + oneTimeAddonTotal;
      
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
      
      onPlanSelected?.(
        selectedPlan.id, 
        selectedPaymentType, 
        selectedPlan.name,
        {
          totalPrice: totalPrice, 
          monthlyPrice: Math.round(totalPrice / 12), 
          voluntaryExcess,
          selectedAddOns: selectedAddOns[selectedPlan.id] || {},
          protectionAddOns: selectedProtectionAddOns,
          claimLimit: effectiveClaimLimit,
          labourRate: selectedLabourRate // Add labour rate to pricing data
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
      const labourRateAdjustment = selectedLabourRate === 50 ? -3 : selectedLabourRate === 100 ? 5 : 0;
      const boostDisplayAdjustment = boostAddon ? -2.01 : 0;
      const displayedMonthlyPrice = baseMonthlyPrice + labourRateAdjustment + boostDisplayAdjustment;

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

      toast.success('Quote email sent successfully!');
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
      
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => {
                console.log('🔙 PricingTable Back button clicked');
                onBack();
              }}
              className="flex items-center gap-2 text-sm font-medium py-2.5 px-4 rounded-lg transition-all duration-200 bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* Mobile Navigation */}
            <div className="lg:hidden">
              <MobileNavigation />
            </div>
          </div>
        </div>
      </div>

      {/* Pick Your Perfect Cover heading and Trustpilot on same line */}
      <div className="max-w-6xl mx-auto px-4 pt-5 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <Shield className="w-6 h-6 text-orange-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              Pick your perfect cover
            </h1>
          </div>
          <TrustpilotHeader className="h-8 sm:h-10" />
        </div>
      </div>

      {/* Configuration Sections */}
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-6">
        
        {/* Vehicle Information */}
        <div className="section-header rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
                1
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
                <Car className="h-5 w-5 flex-shrink-0" />
                Vehicle Information
              </h2>
            </div>
            <Button
              onClick={() => window.location.href = '/'}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Edit className="h-4 w-4" />
              <span className="md:hidden">Edit</span>
              <span className="hidden md:inline">Change vehicle</span>
            </Button>
          </div>
           
            {vehicleData && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-4">
               <div className="flex items-center gap-2">
                 <Hash className="h-5 w-5 text-primary" />
                 <div>
                   <span className="text-muted-foreground block">Registration</span>
                   <span className="font-semibold text-foreground">{vehicleData.regNumber}</span>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <Car className="h-5 w-5 text-primary" />
                 <div>
                   <span className="text-muted-foreground block">Vehicle</span>
                   <span className="font-semibold text-foreground">
                     {vehicleData.make} {vehicleData.model || 'Vehicle'}
                   </span>
                 </div>
               </div>
               {vehicleData.fuelType && (
                 <div className="flex items-center gap-2">
                   <Fuel className="h-5 w-5 text-primary" />
                   <div>
                     <span className="text-muted-foreground block">Fuel Type</span>
                     <span className="font-semibold text-foreground">{vehicleData.fuelType}</span>
                   </div>
                 </div>
               )}
               {vehicleData.year && (
                 <div className="flex items-center gap-2">
                   <Calendar className="h-5 w-5 text-primary" />
                   <div>
                     <span className="text-muted-foreground block">Year</span>
                     <span className="font-semibold text-foreground">{vehicleData.year}</span>
                   </div>
                 </div>
               )}
                <div className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  <div>
                    <span className="text-muted-foreground block">Mileage</span>
                    <span className="font-semibold text-foreground">{parseInt(vehicleData.mileage).toLocaleString()} miles</span>
                  </div>
                </div>
                 </div>
                 </>
                )}
          </div>

        {/* What's Covered Section */}
        <div id="whats-covered" className="section-header rounded-lg p-4 sm:p-8 mb-8">
          <Collapsible open={whatsCoveredOpen} onOpenChange={setWhatsCoveredOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between gap-2 mb-4 cursor-pointer group">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-black flex-shrink-0" />
                  <h2 className="text-lg sm:text-xl font-semibold text-black">
                    What's covered?
                  </h2>
                  <ChevronDown className="w-5 h-5 sm:w-8 sm:h-8 text-black transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                </div>
                {/* Instant Cover Badge with Tooltip */}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex items-center gap-1 sm:gap-2 bg-green-50 border border-green-300 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 w-fit cursor-help">
                        <span className="text-xs sm:text-sm font-semibold text-green-700 whitespace-nowrap">⚡ Instant cover</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>🛡️ Cover starts immediately after purchase</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CollapsibleTrigger>
            
            {/* Summary text below heading */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <p className="text-muted-foreground font-bold">
                      All-in-one cover – Labour, electrical and mechanical parts included.
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
            
            {/* See full coverage button - matches homepage style */}
            <CollapsibleTrigger asChild>
              <button className="w-full flex justify-center items-center py-1 group cursor-pointer">
                <div className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 rounded-full px-5 py-2.5 shadow-md transition-colors">
                  <Info className="w-4 h-4 text-white" />
                  <span className="text-sm font-medium text-white whitespace-nowrap">See full coverage</span>
                  <ChevronDown className="w-4 h-4 text-white transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                </div>
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="space-y-6">
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
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button 
                      onClick={() => document.getElementById('your-cover-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-orange-500 hover:text-orange-600 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                      Need more details? <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </button>
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
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button 
                      onClick={() => document.getElementById('your-cover-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-orange-500 hover:text-orange-600 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                      Need more details? <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </button>
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
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button 
                      onClick={() => document.getElementById('your-cover-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-orange-500 hover:text-orange-600 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                      Need more details? <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </button>
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
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button 
                      onClick={() => document.getElementById('your-cover-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-orange-500 hover:text-orange-600 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                      Need more details? <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </button>
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
                        
                        {/* Close button - closes entire What's Covered section */}
                        <button 
                          onClick={() => setWhatsCoveredOpen(false)}
                          className="w-full flex items-center justify-center gap-2 pt-4 border-t border-red-300 text-red-600 hover:text-red-700 font-medium transition-colors"
                        >
                          <ChevronDown className="w-4 h-4 rotate-180" />
                          <span>Close</span>
                        </button>
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
              Pick your claim limit
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
          
          <p className="text-lg font-medium text-foreground mb-4">
            Choose how much we'll pay for each repair
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Essential */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 750
                  ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(750);
                setValidationErrors(prev => ({ ...prev, claimLimit: false }));
              }}
            >
              <h4 className="text-xl font-bold text-black mb-1">AutoCare Essential</h4>
              <div className="text-3xl font-bold text-black mb-2">
                £{selectedClaimLimit === 750 && boostAddon ? '1,750' : '750'} <span className="text-base">per claim</span>
              </div>
              <p className="text-sm text-gray-600">Confidence for the everyday drive.</p>
            </div>
            
            {/* Advanced */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 1250
                  ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(1250);
                setValidationErrors(prev => ({ ...prev, claimLimit: false }));
              }}
            >
              <div className="absolute -top-3 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                MOST POPULAR
              </div>
              <h4 className="text-xl font-bold text-black mb-1">AutoCare Advantage</h4>
              <div className="text-3xl font-bold text-black mb-2">
                £{selectedClaimLimit === 1250 && boostAddon ? '2,250' : '1,250'} <span className="text-base">per claim</span>
              </div>
              <p className="text-sm text-gray-600">Balanced protection for life's bigger bumps.</p>
            </div>
            
            {/* Elite */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 2000
                  ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(2000);
                setValidationErrors(prev => ({ ...prev, claimLimit: false }));
              }}
            >
              <h4 className="text-xl font-bold text-black mb-1">AutoCare Elite</h4>
              <div className="text-3xl font-bold text-black mb-2">
                £{selectedClaimLimit === 2000 && boostAddon ? '3,000' : '2,000'} <span className="text-base">per claim</span>
              </div>
              <p className="text-sm text-gray-600">Top-tier cover for total peace of mind.</p>
            </div>
          </div>
          
          {/* Boost Add-On */}
          <div 
            className={`mt-6 p-6 bg-white rounded-lg border-2 transition-all duration-200 cursor-pointer ${
              boostAddon 
                ? 'border-[#FF6B35] shadow-[0_0_30px_rgba(255,107,53,0.3)]' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setBoostAddon(!boostAddon)}
          >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                    boostAddon 
                      ? 'bg-green-600 border-green-600' 
                      : 'bg-white border-black hover:border-green-500'
                  }`}>
                    {boostAddon && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-xl font-semibold text-gray-900">🚀 Boost your claim limit</h4>
                    <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-semibold uppercase">Popular Upgrade</span>
                    {boostAddon && (
                      <span className="text-green-600 font-semibold text-sm flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">£{selectedClaimLimit.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">per claim</div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-orange-600" />
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">£{(selectedClaimLimit + 1000).toLocaleString()}</div>
                        <div className="text-xs text-gray-500">per claim</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-gray-700">
                      <span>£4.99/month</span>
                      <span className="text-sm text-gray-500">Only 12 payments (0% APR)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>


        {/* Choose Warranty Duration */}
        <div id="duration-price-section" className="section-header rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
              5
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 flex-shrink-0" />
              Choose your duration
            </h2>
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

          {/* Comparison Cards - All Three Durations */}
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
              
              // Apply automatic discounts
              let discountedPrice = adjustedBasePrice;
              if (durationId === '24months') {
                discountedPrice = adjustedBasePrice - 100;
              } else if (durationId === '36months') {
                discountedPrice = adjustedBasePrice - 200;
              }
              
              // Calculate display monthly price
              const baseMonthlyPrice = Math.round(discountedPrice / 12);
              const labourRateAdjustment = selectedLabourRate === 50 ? -3 : selectedLabourRate === 100 ? 5 : 0;
              const boostDisplayAdjustment = boostAddon ? -2.01 : 0;
              const displayedMonthlyPrice = baseMonthlyPrice + labourRateAdjustment + boostDisplayAdjustment;
              const displayedAnnualPrice = discountedPrice + (labourRateAdjustment * 12) + (boostDisplayAdjustment * 12);
              const savingsAmount = durationId === '24months' ? 100 : durationId === '36months' ? 200 : 0;
              
              return (
                <div
                  key={durationId}
                  onClick={() => {
                    console.log('🎯 Duration card clicked:', { durationId, currentPaymentType: paymentType });
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
                  
                  {/* Collapsible Section for What's Covered */}
                  {/* Selection Checkbox - Top Right */}
                  <div 
                    className="absolute top-4 right-4 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
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
                  
                  {/* Plan Name */}
                  <p className="text-sm text-gray-500 mb-4">Platinum Complete Plan</p>
                  
                  {/* Price Section */}
                  <div className="mb-4">
                    {/* Monthly Price */}
                    <div className="text-3xl font-bold text-black mb-1">
                      £{displayedMonthlyPrice}<span className="text-lg font-normal text-gray-600">/month</span>
                    </div>
                    
                    {/* Total Price */}
                    <div className="text-base text-gray-600 mb-2">
                      Total £{Math.round(displayedAnnualPrice)}
                    </div>
                    
                    {/* Savings */}
                    {savingsAmount > 0 && (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="line-through text-red-500 text-sm">
                          Was £{adjustedBasePrice}
                        </span>
                        <Badge className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1">
                          Save £{savingsAmount} Today
                        </Badge>
                      </div>
                    )}
                    
                    {/* Payment Details - GREEN TEXT */}
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-green-600 font-medium">12 payments, 0% APR</span>
                      </div>
                      {durationId === '24months' && (
                        <div className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-green-600 font-medium">Year 2 Cover is Free</span>
                        </div>
                      )}
                      {durationId === '36months' && (
                        <div className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-green-600 font-medium">Year 2 and 3 Cover is Free</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* What's Included Collapsible */}
                  <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                    <CollapsibleTrigger className="w-full mb-4">
                      <div className="flex items-center justify-between w-full border border-gray-300 rounded-lg px-4 py-3 hover:border-gray-400 transition-colors">
                        <span className="text-lg font-medium text-gray-800">See What's Included</span>
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
                      setPaymentType(durationId);
                    }}
                    className={cn(
                      "w-full mb-3 font-bold text-base py-6 transition-all duration-300 group",
                      isSelected
                        ? "bg-black hover:bg-black/90 text-white shadow-lg border-2 border-black"
                        : "bg-brand-orange hover:bg-brand-orange/90 text-white border-2 border-brand-orange"
                    )}
                    size="lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span>{isSelected ? 'Selected' : 'Get Instant Cover'}</span>
                      {!isSelected && <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />}
                    </div>
                  </Button>
                  
                  {/* Email Quote Link */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEmailQuoteDialog(durationId);
                    }}
                    className="w-full text-center text-sm text-gray-500 hover:text-orange-600 transition-colors pointer-events-auto flex items-center justify-center gap-1"
                  >
                    <Mail className="w-4 h-4" />
                    <span className="underline">Email me this quote</span>
                  </button>
                  
                  {/* See Full Cover Details Link */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const coverSection = document.getElementById('your-cover-details');
                      coverSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-full mt-3 text-center text-sm text-gray-500 hover:text-green-600 transition-colors pointer-events-auto flex items-center justify-center gap-1"
                  >
                    <span>🔍 See full cover details</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add-On Protection Packages */}
        <div className="section-header rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
                6
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 flex-shrink-0" />
                Add extras
              </h3>
            </div>
            <p className="text-muted-foreground sm:ml-2 text-sm">Enhance your warranty ✨</p>
          </div>
          <AddOnProtectionPackages 
            selectedAddOns={selectedProtectionAddOns}
            paymentType={paymentType}
            onAddOnChange={(addOnKey, selected) => 
              setSelectedProtectionAddOns(prev => ({ ...prev, [addOnKey]: selected }))
            }
          />
        </div>

        {/* Trust Section - Redesigned */}
        <div className="mt-16 mb-8 bg-green-50 rounded-2xl p-8 border border-green-200">
          <div className="flex items-center max-w-6xl mx-auto gap-8">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-foreground mb-6">
                94% of claims approved fast
              </h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" strokeWidth={3} />
                  <p className="text-lg text-foreground font-medium">
                    Clear cover – no hidden catches
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" strokeWidth={3} />
                  <p className="text-lg text-foreground font-medium">
                    We look for reasons to say YES
                  </p>
                </div>
              </div>
              
              <p className="text-xl text-black font-bold mb-8">
                🛡️ Real protection. Real peace of mind. Guaranteed.
              </p>
              
              {/* Trustpilot Section */}
              <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                      ⭐ Rated Excellent on Trustpilot
                    </p>
                    <p className="text-sm text-gray-600">Don't just take our word for it – see what customers say.</p>
                  </div>
                  <div className="flex-shrink-0">
                    <a 
                      href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-block hover:opacity-80 transition-opacity"
                    >
                      <TrustpilotHeader className="h-12" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-shrink-0 hidden md:block">
              <div className="w-60 h-60 flex flex-col items-center justify-center bg-orange-50 rounded-full border-4 border-orange-200">
                <ShieldCheck className="w-24 h-24 text-orange-500 mb-2" />
                <div className="text-center px-4">
                  <p className="text-sm font-bold text-orange-600">14 day money</p>
                  <p className="text-sm font-bold text-orange-600">back guarantee</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information Section - Redesigned */}
        <div id="your-cover-details" className="bg-gray-50 rounded-lg p-8 border border-gray-200 shadow-sm">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-foreground">
                Your cover, made crystal clear 🛡️
              </h3>
            </div>
            
            {/* Fixed floating Back to Plans button - bottom right */}
            <Button
              onClick={() => {
                const durationSection = document.getElementById('duration-price-section');
                durationSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              variant="outline"
              size="sm"
              className="fixed bottom-6 right-6 z-50 flex items-center gap-2 text-sm font-medium bg-green-50 hover:bg-green-100 shadow-lg animate-bounce"
            >
              <ArrowUp className="w-4 h-4" />
              Back to Plans
            </Button>
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" strokeWidth={3} />
              <p className="text-black text-lg font-medium">
                See what's included - clear terms, no jargon, no surprises.
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-3 w-full text-left text-orange-500 hover:text-orange-600 font-semibold py-3 transition-colors text-lg group">
                <ChevronDown className="w-5 h-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                <span>Your Platinum Plan</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 pl-7">
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                  <p className="text-gray-700 text-base leading-relaxed mb-4">
                    The Platinum Plan provides comprehensive coverage for your vehicle and complete peace of mind. Key features include:
                  </p>
                  <ul className="text-gray-700 text-base space-y-2 mb-4">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Fast and easy claims</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Fault diagnostics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Consequential damage protection</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>14-day money-back guarantee</span>
                    </li>
                  </ul>
                  {platinumDocUrl ? (
                    <a 
                      href={platinumDocUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium text-base underline"
                    >
                      View Full Platinum Plan Details
                    </a>
                  ) : (
                    <span className="text-gray-400 font-medium text-base">Loading PDF...</span>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-3 w-full text-left text-orange-500 hover:text-orange-600 font-semibold py-3 transition-colors text-lg group">
                <ChevronDown className="w-5 h-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                <span>Terms & Conditions</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 pl-7">
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                  <p className="text-gray-700 text-base leading-relaxed mb-4">
                    Clear, straightforward terms designed to protect you and give you peace of mind.
                  </p>
                  {termsDocUrl ? (
                    <a 
                      href={termsDocUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium text-base underline"
                    >
                      View Full Terms and Conditions
                    </a>
                  ) : (
                    <span className="text-gray-400 font-medium text-base">Loading PDF...</span>
                  )}
                  
                  {/* Back to What's Covered link */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button 
                      onClick={() => {
                        const section = document.getElementById('whats-covered');
                        if (section) {
                          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="text-orange-500 hover:text-orange-600 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                      <ChevronDown className="w-4 h-4 rotate-180" />
                      Back to What's Covered
                    </button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

      </div>

      {/* Continue Button */}
      {!plansLoading && !plansError && !vehicleAgeError && displayPlans.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-0">
          <div className="flex justify-end mt-4">
            <div className="flex flex-col items-end space-y-2">
              <div className="text-right">
                {/* Monthly Price - Main Hook - Show discounted price with add-ons */}
                <div className="text-3xl font-bold text-gray-900">
                  £{Math.round(totalDiscountedPrice / 12)}/month
                </div>
                <div className="flex items-center justify-end gap-1.5 text-base text-gray-600 mb-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>
                    {paymentType === '12months' 
                      ? 'Only 12 payments (0% APR)'
                      : paymentType === '24months' 
                        ? 'Only 12 payments (0% APR)'
                        : 'Only 12 payments (0% APR)'
                    }
                  </span>
                </div>
                
                 {/* Total Cost - Show final total only */}
                <div className="text-lg font-medium text-gray-600">
                  Total: £{Math.round(totalDiscountedPrice)}
                </div>
              </div>
              <div className="flex justify-center">
                <Button
                  onClick={handleSelectPlan}
                  size="lg"
                  className="text-lg font-semibold px-12 py-3.5 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white animate-[breathing_3s_ease-in-out_infinite]"
                >
                  Continue to checkout
                  <ArrowRight className="w-5 h-5 ml-2" strokeWidth={4.5} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Total Bar */}
      {!plansLoading && !plansError && !vehicleAgeError && displayPlans.length > 0 && paymentType && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t-2 border-orange-200 shadow-lg z-50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 max-w-6xl mx-auto gap-4">
            {/* Trustpilot Logo - Moved to left */}
            <div className="hidden md:block flex-shrink-0 mr-4">
              <a 
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <img 
                  src={trustpilotLogo} 
                  alt="Trustpilot Excellent Rating" 
                  className="h-12 w-auto hover:opacity-80 transition-opacity"
                />
              </a>
            </div>
            
            {/* Price Section - Stacked on mobile, center on desktop */}
            <div className="flex flex-col flex-1 text-center">
              {/* Monthly Price - Main Hook - Show discounted price with add-ons */}
              <div className="text-xl md:text-2xl font-bold text-gray-900">
                £{Math.round(totalDiscountedPrice / 12)}/month
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs md:text-sm text-gray-600 mb-1 font-bold">
                <Check className="w-4 h-4 text-green-600" />
                <span>
                  {paymentType === '12months' 
                    ? 'Only 12 payments (0% APR)'
                    : paymentType === '24months' 
                      ? 'Only 12 payments (0% APR)'
                      : 'Only 12 payments (0% APR)'
                  }
                </span>
              </div>
              
              {/* Payment Terms and Total for footer */}
              <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-bold">
                <span className="text-gray-500">
                  {paymentType === '12months' 
                    ? '1 year cover'
                    : paymentType === '24months' 
                      ? 'No payments in Year 2'
                      : 'No payments in Years 2 & 3.'
                  }
                </span>
                {paymentType === '12months' ? (
                  <span className="text-gray-400">•</span>
                ) : paymentType === '24months' ? (
                  <>
                    <span className="text-gray-500">- 🎉</span>
                    <span className="text-gray-500">2 Year Cover</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-500">- 🎉</span>
                    <span className="text-gray-500">3 Year Cover</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-stretch md:items-end gap-2">
              <div className="flex justify-center md:justify-end">
                <Button
                  onClick={handleSelectPlan}
                  size="lg"
                  className="text-base md:text-lg font-semibold px-8 md:px-12 py-3 md:py-3.5 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white w-full md:w-auto animate-[breathing_3s_ease-in-out_infinite]"
                >
                  Continue to checkout
                  <ArrowRight className="w-5 h-5 ml-1" strokeWidth={4.5} />
                </Button>
              </div>
              <span className="text-base md:text-lg font-medium text-gray-600 text-center md:text-right">
                Total: £{Math.round(totalDiscountedPrice)}
              </span>
            </div>
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
                <span className="text-gray-600">Monthly Payment:</span>
                <span className="font-bold">
                  £{(() => {
                    const warrantyYears = emailQuoteDuration === '12months' ? 1 : emailQuoteDuration === '24months' ? 2 : 3;
                    const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
                    const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, emailQuoteDuration);
                    const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
                    
                    let discountedPrice = adjustedBasePrice;
                    if (emailQuoteDuration === '24months') {
                      discountedPrice = adjustedBasePrice - 100;
                    } else if (emailQuoteDuration === '36months') {
                      discountedPrice = adjustedBasePrice - 200;
                    }
                    
                    const baseMonthlyPrice = Math.round(discountedPrice / 12);
                    const labourRateAdjustment = selectedLabourRate === 50 ? -3 : selectedLabourRate === 100 ? 5 : 0;
                    const boostDisplayAdjustment = boostAddon ? -2.01 : 0;
                    return Math.round(baseMonthlyPrice + labourRateAdjustment + boostDisplayAdjustment);
                  })()}/month
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Cost:</span>
                <span className="font-bold text-green-600">
                  £{(() => {
                    const warrantyYears = emailQuoteDuration === '12months' ? 1 : emailQuoteDuration === '24months' ? 2 : 3;
                    const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
                    const basePrice = getPricingData(voluntaryExcess, selectedClaimLimit, emailQuoteDuration);
                    const adjustedBasePrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
                    
                    let discountedPrice = adjustedBasePrice;
                    if (emailQuoteDuration === '24months') {
                      discountedPrice = adjustedBasePrice - 100;
                    } else if (emailQuoteDuration === '36months') {
                      discountedPrice = adjustedBasePrice - 200;
                    }
                    
                    const baseMonthlyPrice = Math.round(discountedPrice / 12);
                    const labourRateAdjustment = selectedLabourRate === 50 ? -3 : selectedLabourRate === 100 ? 5 : 0;
                    const boostDisplayAdjustment = boostAddon ? -2.01 : 0;
                    const displayedMonthlyPrice = baseMonthlyPrice + labourRateAdjustment + boostDisplayAdjustment;
                    return Math.round(displayedMonthlyPrice * 12);
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