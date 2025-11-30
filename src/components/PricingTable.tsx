import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/protected-button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, ArrowLeft, Info, FileText, ExternalLink, ChevronDown, ChevronUp, Plus, Infinity, Zap, Car, Cog, Settings, Droplets, Cpu, Snowflake, Search, Users, RotateCcw, MapPin, X, Shield, Hash, Calendar, Gauge, Fuel, Edit, HelpCircle, Gift, ArrowRight, DollarSign, MousePointerClick, ShieldCheck, PartyPopper, CheckCircle, Crown, Battery, Bike, AlertTriangle, AlertCircle } from 'lucide-react';
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
  // Email quote dialog states
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailForQuote, setEmailForQuote] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [selectedPlanForEmail, setSelectedPlanForEmail] = useState<{
    title: string;
    monthlyPrice: number;
    totalPrice: number;
    paymentType: string;
  } | null>(null);

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
  const [selectedLabourRate, setSelectedLabourRate] = useState<number>(70);
  
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

  const handleEmailQuote = (planData: { title: string; monthlyPrice: number; totalPrice: number; paymentType: string }) => {
    setSelectedPlanForEmail(planData);
    setShowEmailDialog(true);
    setEmailForQuote('');
    setEmailError('');
  };

  const validateEmail = (email: string) => {
    if (!email.trim()) {
      setEmailError('Email address is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSendQuoteEmail = async () => {
    if (!validateEmail(emailForQuote) || !selectedPlanForEmail) {
      return;
    }

    setSendingEmail(true);

    try {
      const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-quote-email', {
        body: {
          email: emailForQuote.trim(),
          firstName: '',
          lastName: '',
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
            price: selectedPlanForEmail.totalPrice,
            paymentType: selectedPlanForEmail.paymentType
          }
        }
      });

      if (emailError) {
        console.error('Error sending quote email:', emailError);
        toast.error('Failed to send email. Please try again.');
      } else {
        console.log('Quote email sent successfully:', emailResponse);
        toast.success('Quote sent to your email!');
        setShowEmailDialog(false);
        setEmailForQuote('');
      }
    } catch (error) {
      console.error('Error sending quote email:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
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
          claimLimit: selectedClaimLimit,
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
            <Button onClick={onBack} variant="outline" className="mr-4">
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
            <Button onClick={onBack} variant="outline" className="mr-4">
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
              className="flex items-center gap-2 text-base font-medium py-3 px-6 rounded-lg border transition-all duration-200 bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
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

      {/* Build Your Cover heading and Trustpilot on same line */}
      <div className="max-w-6xl mx-auto px-4 pt-5 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <Shield className="w-6 h-6 text-orange-500" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              Build Your Cover
            </h1>
          </div>
          <TrustpilotHeader className="h-8 sm:h-10" />
        </div>
      </div>

      {/* Configuration Sections */}
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-6">
        
        {/* Vehicle Information */}
        <div className="section-header rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold">
                1
              </div>
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Car className="h-5 w-5" />
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
        <div className="section-header rounded-lg p-8 mb-8">
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between gap-2 mb-4 cursor-pointer group">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-black flex-shrink-0" />
                  <h2 className="text-lg sm:text-2xl font-bold text-black">
                    What's Covered?
                  </h2>
                </div>
                <button className="inline-flex items-center gap-1 sm:gap-2 bg-white border border-gray-200 rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 shadow-sm hover:shadow transition-shadow">
                  <span className="text-xs sm:text-sm font-medium text-blue-600 whitespace-nowrap">What You Get</span>
                  <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                </button>
              </div>
            </CollapsibleTrigger>
            
            {/* Summary text below heading */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-muted-foreground font-bold">
                    All-in-one cover – Labour, electrical and mechanical parts included.
                  </p>
                </div>
                {/* Instant Cover Badge - below What You Get on desktop */}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 rounded-md px-3 py-1.5 sm:py-2 cursor-pointer w-fit">
                        <span className="text-xs sm:text-sm font-semibold text-green-700 whitespace-nowrap">⚡ Instant cover</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>🛡️ Cover starts immediately after purchase – excludes pre-existing conditions.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <CollapsibleContent>
              
              <div className="space-y-6">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-3 w-full text-left text-orange-500 hover:text-orange-600 font-medium py-2 transition-colors group">
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-5 h-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  <Car className="w-5 h-5" />
                </div>
                <span>Cars (Petrol, Diesel, Hybrid, EV)</span>
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
              <CollapsibleTrigger className="flex items-center gap-3 w-full text-left text-orange-500 hover:text-orange-600 font-medium py-2 transition-colors group">
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-5 h-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  <Battery className="w-5 h-5" />
                </div>
                <span>Hybrid Vehicles</span>
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
              <CollapsibleTrigger className="flex items-center gap-3 w-full text-left text-orange-500 hover:text-orange-600 font-medium py-2 transition-colors group">
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-5 h-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  <Zap className="w-5 h-5" />
                </div>
                <span>Electric Vehicles (EVs)</span>
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
              <CollapsibleTrigger className="flex items-center gap-3 w-full text-left text-orange-500 hover:text-orange-600 font-medium py-2 transition-colors group">
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-5 h-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  <Bike className="w-5 h-5" />
                </div>
                <span>Motorcycles (Petrol, Hybrid, EV)</span>
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
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-3 w-full text-left text-orange-600 hover:text-orange-700 font-medium py-3 transition-colors group">
                      <div className="flex items-center gap-2">
                        <ChevronDown className="w-5 h-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <span>What's not covered</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-4 p-6 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-gray-700 font-medium mb-4">
                          We keep things straightforward and transparent.
                        </p>
                        <h4 className="font-semibold text-orange-700 mb-3">What's Not Included:</h4>
                        <ul className="space-y-2">
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Pre-existing faults</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Routine servicing and maintenance (such as fluids or brake pads)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <X className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">Vehicles used for hire or reward (including taxis, rentals, or couriers)</span>
                          </li>
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Labour Rate Selection - NEW */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold">
              2
            </div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Choose Your Labour Rate
            </h2>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Select the hourly labour rate that matches your preferred garage type
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <span className="text-2xl font-bold text-foreground">£40/hr</span>
              </div>
              <p className="text-sm text-gray-900 font-medium">Independent Garages</p>
              <p className="text-xs text-muted-foreground mt-1">Ideal for independent garages</p>
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
                <span className="text-2xl font-bold text-foreground">£70/hr</span>
              </div>
              <p className="text-sm text-gray-900 font-medium">Most Garages</p>
              <p className="text-xs text-muted-foreground mt-1">Covers most reputable garages.</p>
            </button>
            
            <button
              onClick={() => setSelectedLabourRate(100)}
              className={`relative bg-white p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedLabourRate === 100
                  ? 'border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <span className="absolute -top-3 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">PREMIUM COVER</span>
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">£100/hr</span>
              </div>
              <p className="text-sm text-gray-900 font-medium">Dealer Approved</p>
              <p className="text-xs text-muted-foreground mt-1">Perfect for main dealers and specialists.</p>
            </button>
          </div>
        </div>

        {/* Choose Your Excess Amount */}
        <div id="excess-amount-section" className={`section-header rounded-lg p-6 transition-all duration-200 ${
          validationErrors.voluntaryExcess ? 'border-2 border-red-500' : ''
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold">
              3
            </div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 scale-x-[-1]" />
              Choose Your Excess Amount
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
        <div id="claim-limit-section" className={`section-header rounded-lg p-6 transition-all duration-200 ${
          validationErrors.claimLimit ? 'border-2 border-red-500' : ''
        }`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold">
              4
            </div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Pick Your Claim Limit
            </h2>
            
            <Dialog>
              <DialogTrigger asChild>
                <button className="ml-2 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-blue-50 transition-colors border border-blue-200 shadow-sm">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-blue-600">Details</span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" hideCloseButton>
                <DialogClose className="absolute right-4 top-4 rounded-full p-3 bg-gray-200 hover:bg-gray-300 transition-colors z-50 shadow-md">
                  <X className="h-7 w-7 text-gray-700" />
                  <span className="sr-only">Close</span>
                </DialogClose>
                
                <DialogHeader className="pr-12">
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                    Understanding Your Claim Limit
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <p className="text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-900">What is a Claim Limit?</span> Your claim limit is the maximum amount we'll pay per claim for covered repairs. If your repair costs exceed your chosen limit, you'll need to pay the difference.
                  </p>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Info className="w-5 h-5 text-blue-600" />
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
          
          <p className="text-sm text-muted-foreground mb-6">
            Choose the coverage level that best suits your needs and budget
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Essential */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 750
                  ? 'border-2 border-gray-400 shadow-lg shadow-gray-400/30'
                  : 'border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(750);
                setValidationErrors(prev => ({ ...prev, claimLimit: false }));
              }}
            >
              <h4 className="text-xl font-bold text-black mb-1">AutoCare Essential</h4>
              <div className="text-3xl font-bold text-black mb-2">
                £{selectedClaimLimit === 750 && boostAddon ? '1,750' : '750'} per claim
              </div>
              <p className="text-sm text-gray-600">Confidence for the everyday drive.</p>
            </div>
            
            {/* Advanced */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 1250
                  ? 'border-2 border-orange-500 shadow-lg shadow-orange-500/30'
                  : 'border-2 border-orange-200 hover:border-orange-300 hover:shadow-md'
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
                £{selectedClaimLimit === 1250 && boostAddon ? '2,250' : '1,250'} per claim
              </div>
              <p className="text-sm text-gray-600">Balanced protection for life's bigger bumps.</p>
            </div>
            
            {/* Elite */}
            <div 
              className={`p-6 rounded-lg transition-all duration-200 text-left relative cursor-pointer bg-white ${
                selectedClaimLimit === 2000
                  ? 'border-2 border-blue-600 shadow-lg shadow-blue-600/30'
                  : 'border-2 border-blue-200 hover:border-blue-300 hover:shadow-md'
              }`}
              onClick={() => {
                setSelectedClaimLimit(2000);
                setValidationErrors(prev => ({ ...prev, claimLimit: false }));
              }}
            >
              <div className="absolute -top-3 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                <Crown className="w-3 h-3" />
                BEST PROTECTION
              </div>
              <h4 className="text-xl font-bold text-black mb-1">AutoCare Elite</h4>
              <div className="text-3xl font-bold text-black mb-2">
                £{selectedClaimLimit === 2000 && boostAddon ? '3,000' : '2,000'} per claim
              </div>
              <p className="text-sm text-gray-600">Top-tier cover for total peace of mind.</p>
            </div>
          </div>
          
          {/* Boost Add-On */}
          <div className={`mt-6 p-6 bg-white rounded-lg border-2 transition-all duration-200 ${
            boostAddon 
              ? 'border-orange-400 shadow-[0_0_30px_rgba(251,146,60,0.5)]' 
              : 'border-orange-200 hover:border-orange-300'
          }`}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                    boostAddon 
                      ? 'bg-green-600 border-green-600' 
                      : 'bg-white border-gray-300 hover:border-green-500'
                  }`}
                  onClick={() => setBoostAddon(!boostAddon)}
                  >
                    {boostAddon && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-lg font-bold text-gray-900">🚀 Boost Your Claim Limit</h4>
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
                      <span>for £4.99/month</span>
                      <span className="text-sm text-gray-500">• Only 12 Payments (0% APR)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>


        {/* Choose Warranty Duration */}
        <div id="duration-price-section">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold">
              5
            </div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Choose Your Duration
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 md:items-stretch">
            {[
              {
                id: '12months',
                title: '1-Year Cover',
                subtitle: '',
                description: 'Flexible protection for 12 month cover',
                planName: 'Platinum Complete Plan',
                features: [
                  '✅ All mechanical & electrical parts',
                  '✅ Up to 10 claims per year',
                  '✅ Up to the value of your vehicle',
                  '✅ Labour costs included',
                  '✅ Fault diagnostics',
                  '✅ Consequential damage cover',
                  '✅ Fast claims process',
                  '✅ Choose your own garage',
                  '✅ 14-day money-back guarantee',
                  '✅ Optional extras available',
                  '❌ Pre-existing faults are not covered'
                ],
                isPopular: false,
                isStarter: false
              },
              {
                id: '24months',
                title: '2-Year Cover',
                subtitle: 'MOST POPULAR',
                description: 'Balanced Protection and Value',
                planName: 'Platinum Complete Plan',
                features: [
                  '✅ All mechanical & electrical parts',
                  '✅ Unlimited Claims',
                  '✅ Up to the value of your vehicle',
                  '✅ Labour costs included',
                  '✅ Fault diagnostics',
                  '✅ Vehicle recovery claim-back',
                  '✅ Consequential damage cover',
                  '✅ Fast claims process',
                  '✅ Choose your own garage',
                  '✅ 14-day money-back guarantee',
                  '✅ Optional extras available',
                  '❌ Pre-existing faults are not covered'
                ],
                isPopular: true
              },
              {
                id: '36months',
                title: '3-Year Cover',
                subtitle: 'BEST VALUE',
                description: 'Extended cover for longer peace of mind',
                planName: 'Platinum Complete Plan',
                features: [
                  '✅ All mechanical & electrical parts',
                  '✅ Unlimited Claims',
                  '✅ Up to the value of your vehicle',
                  '✅ Labour costs included',
                  '✅ Fault diagnostics',
                  '✅ Vehicle recovery claim-back',
                  '✅ Europe repair cover',
                  '✅ Vehicle rental cover',
                  '✅ Consequential damage cover',
                  '✅ Fast claims process',
                  '✅ Choose your own garage',
                  '✅ 14-day money-back guarantee',
                  '✅ Optional extras available',
                  '❌ Pre-existing faults are not covered'
                ],
                isBestValue: true
              }
            ].map((option) => {
              // CRITICAL FIX: Each plan must calculate its OWN vehicle adjustment independently
              // Calculate warranty years for THIS specific plan option
              const optionWarrantyYears = option.id === '12months' ? 1 : 
                                        option.id === '24months' ? 2 : 3;
              
              // Calculate vehicle adjustment specifically for THIS plan duration
              const optionVehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, optionWarrantyYears);
              
              // Get the pure base price for THIS specific plan (independent of current selection)
              const planBasePrice = getPricingData(voluntaryExcess, selectedClaimLimit, option.id);
              const planAdjustedBasePrice = applyPriceAdjustment(planBasePrice, optionVehicleAdjustment);
              const durationMonths = option.id === '12months' ? 12 : option.id === '24months' ? 24 : 36;
              
              // Calculate add-on costs ONLY for the currently selected payment type for display purposes
              let protectionAddOnPrice = 0;
              if (paymentType === option.id) {
                // Only calculate add-ons for the selected option for total cost calculation
                protectionAddOnPrice = calculateAddOnPrice(selectedProtectionAddOns, option.id, durationMonths);
              }
              
              // Add boost addon cost if selected (£84 for all durations since it's charged as £7/month for 12 months only)
              const boostCost = boostAddon ? 84 : 0;
              
              // Apply automatic discounts for multi-year plans
              let discountedPrice = planAdjustedBasePrice;
              if (option.id === '24months') {
                discountedPrice = planAdjustedBasePrice - 100; // £100 discount for 2-year plans
              } else if (option.id === '36months') {
                discountedPrice = planAdjustedBasePrice - 200; // £200 discount for 3-year plans
              }
              
              // Plan price display: show discounted price ÷ 12
              const baseDisplayedMonthlyPrice = Math.round(discountedPrice / 12);
              
              // Labour rate adjustment for display only (doesn't affect actual pricing/APIs)
              const labourRateAdjustment = selectedLabourRate === 40 ? -3 : selectedLabourRate === 100 ? 3 : 0;
              const displayedMonthlyPrice = baseDisplayedMonthlyPrice + labourRateAdjustment;
              
              // Adjust total annual display price by labour rate (£3/month * 12 months)
              const displayedAnnualPrice = discountedPrice + (labourRateAdjustment * 12);
              
              // Total cost calculation: discounted base + add-ons + boost (only for the selected plan)
              const totalPriceWithAddOns = discountedPrice + protectionAddOnPrice + boostCost;
              
              return (
                <div
                  key={option.id}
                  className={`relative p-6 rounded-lg transition-all duration-200 text-left w-full border-2 flex flex-col cursor-pointer bg-white ${
                    option.id === '12months' ? 'h-auto' : 'h-full'
                  } ${
                    paymentType === option.id 
                      ? 'border-orange-500 shadow-lg shadow-orange-500/30' 
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                   onClick={() => setPaymentType(option.id as '12months' | '24months' | '36months')}
                 >
                   {/* Badge Pills - positioned absolutely outside border */}
                   {option.isPopular && (
                      <span className="absolute -top-3 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        MOST POPULAR
                      </span>
                    )}
                    {option.isBestValue && (
                      <span className="absolute -top-3 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        BEST VALUE
                      </span>
                    )}
                  
                   {/* Title */}
                   <div className="mb-3">
                     <div className="flex items-center justify-between mb-1">
                       <h4 className="text-2xl font-bold text-gray-900">
                         {option.title.replace('⭐️ ', '').replace('🏆 ', '')}
                       </h4>
                       {option.id === '24months' && (
                          <span className="text-green-600 text-sm font-bold">
                            Save £100
                          </span>
                       )}
                       {option.id === '36months' && (
                          <span className="text-green-600 text-sm font-bold">
                            Save £200
                          </span>
                       )}
                     </div>
                    <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                    <h5 className="font-semibold text-gray-900">{option.planName}</h5>
                  </div>
                  
                   {/* What's included */}
                   <div className="mb-6 flex-grow">
                     <h6 className="font-semibold text-gray-900 mb-3">Your Platinum Plan:</h6>
                     <div className="space-y-1">
                       {option.features.map((feature, index) => {
                         const isCheck = feature.startsWith('✅');
                         const text = feature.replace(/^[✅❌]\s*/, '');
                         return (
                           <div key={index} className="flex items-start text-sm">
                             {isCheck ? (
                               <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                             ) : (
                               <X className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                             )}
                             <span className={isCheck ? 'text-gray-700' : 'text-black'}>
                               {text}
                             </span>
                           </div>
                         );
                       })}
                     </div>
                     
                     {/* Cover details link */}
                     <div className="mt-3">
                       <button
                         className="text-sm text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1"
                         onClick={(e) => {
                           e.stopPropagation();
                           const section = document.getElementById('your-cover-details');
                           if (section) {
                             section.scrollIntoView({ behavior: 'smooth' });
                           }
                         }}
                       >
                         🔍 See Full Cover Details
                       </button>
                     </div>
                   </div>
                   
                      {/* Pricing */}
                     <div className="mb-4 text-center mt-auto">
                         <div className="text-4xl font-bold text-green-600 mb-3">
                           £{displayedMonthlyPrice}/month
                         </div>
                       <div className="text-base text-gray-700 mb-4 space-y-1">
                          {option.id === '12months' && (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-green-500 text-lg">✓</span>
                              <span className="font-medium">12 monthly payments</span>
                            </div>
                          )}
                          {option.id === '24months' && (
                            <>
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-green-500 text-lg">✓</span>
                                <span className="font-medium">12 monthly payments</span>
                              </div>
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-green-500 text-lg">✓</span>
                                <span className="font-medium">No payments in Year 2</span>
                              </div>
                            </>
                          )}
                          {option.id === '36months' && (
                            <>
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-green-500 text-lg">✓</span>
                                <span className="font-medium">12 monthly payments</span>
                              </div>
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-green-500 text-lg">✓</span>
                                <span className="font-medium">No payments in Years 2 & 3</span>
                              </div>
                            </>
                          )}
                        </div>
                         <div className="text-center">
                           {option.id === '12months' ? (
                              <div className="text-center">
                                <div className="text-2xl font-bold text-black mb-2">£{displayedAnnualPrice}</div>
                                <div className="text-base text-gray-600">1 Year Cover</div>
                              </div>
                           ) : (
                              <div className="text-center">
                                <div className="text-base text-gray-600 mb-1">
                                  Was <span className="line-through text-gray-500 font-semibold">£{planAdjustedBasePrice}</span> →
                                </div>
                                <div className="text-2xl font-bold text-black mb-2">£{displayedAnnualPrice}</div>
                                <div className="text-sm text-green-600 font-bold">
                                  Save £{planAdjustedBasePrice - displayedAnnualPrice}
                                </div>
                              </div>
                           )}
                         </div>
                   </div>
                  
                    {/* Select Button */}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaymentType(option.id as '12months' | '24months' | '36months');
                      }}
                      className={`w-full py-3 text-lg font-semibold transition-all mb-3 ${
                        paymentType === option.id
                          ? 'bg-black hover:bg-gray-800 text-white'
                          : 'bg-orange-500 hover:bg-orange-600 text-white'
                      }`}
                    >
                      {paymentType === option.id ? 'Selected' : 'Select'}
                    </Button>
                   
                   {/* Email Quote Button */}
                   <Button
                     type="button"
                     onClick={(e) => {
                       e.stopPropagation();
                       handleEmailQuote({
                         title: option.title,
                         monthlyPrice: displayedMonthlyPrice,
                         totalPrice: displayedAnnualPrice,
                         paymentType: option.id
                       });
                     }}
                      className="w-full py-3 text-base font-semibold bg-white border-2 border-primary text-primary hover:bg-primary/5"
                    >
                   📧 Email Quote
                   </Button>
                </div>
              );
            })}
          </div>
        </div>


        {/* Add-On Protection Packages */}
        <div className="section-header rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold">
              6
            </div>
            <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Add Extras
            </h3>
            <p className="text-muted-foreground ml-2">Enhance your warranty ✨</p>
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
        <div className="mt-16 mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
          <div className="flex items-center max-w-6xl mx-auto gap-8">
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-foreground mb-6">
                94% of Claims Approved Fast
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
                Real protection. Real peace of mind. Guaranteed.
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
              <div className="w-60 h-60 flex flex-col items-center justify-center bg-green-50 rounded-full border-4 border-green-200">
                <ShieldCheck className="w-24 h-24 text-green-600 mb-2" />
                <div className="text-center px-4">
                  <p className="text-sm font-bold text-green-700">14 day money</p>
                  <p className="text-sm font-bold text-green-700">back guarantee</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information Section - Redesigned */}
        <div id="your-cover-details" className="bg-white rounded-lg p-8 border border-gray-200 shadow-sm">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              Your Cover, Made Crystal Clear 🛡️
            </h3>
            <p className="text-muted-foreground text-base">
              ✅ See what's included - clear terms, no jargon, no surprises.
            </p>
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
                    <li>• Fast and easy claims</li>
                    <li>• All labour costs</li>
                    <li>• Fast fault diagnostics</li>
                    <li>• Consequential damage protection</li>
                    <li>• 14-day money-back guarantee</li>
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
                      ? 'Only 12 Payments (0% APR)'
                      : paymentType === '24months' 
                        ? 'Only 12 Payments (0% APR)'
                        : 'Only 12 Payments (0% APR)'
                    }
                  </span>
                </div>
                
                 {/* Total Cost - Show final total only */}
                <div className="text-lg font-medium text-gray-600">
                  Total: £{Math.round(totalDiscountedPrice)}
                </div>
              </div>
              <Button
                onClick={handleSelectPlan}
                size="lg"
                className="text-lg font-semibold px-12 py-3.5"
              >
                  Continue to Checkout
                  <ArrowRight className="w-5 h-5 ml-2" strokeWidth={4.5} />
              </Button>
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
                    ? 'Only 12 Payments (0% APR)'
                    : paymentType === '24months' 
                      ? 'Only 12 Payments (0% APR)'
                      : 'Only 12 Payments (0% APR)'
                  }
                </span>
              </div>
              
              {/* Payment Terms and Total for footer */}
              <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-bold">
                <span className="text-gray-500">
                  {paymentType === '12months' 
                    ? '1 Year Cover'
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
              <Button
                onClick={handleSelectPlan}
                size="lg"
                className="text-base md:text-lg font-semibold px-8 md:pl-12 md:pr-10 py-3 md:py-3.5 bg-primary hover:bg-primary/90 w-full md:w-auto"
              >
                    Continue to Pay
                    <ArrowRight className="w-5 h-5 ml-1" strokeWidth={4.5} />
              </Button>
              <span className="text-base md:text-lg font-medium text-gray-600 text-center md:text-right">
                Total: £{Math.round(totalDiscountedPrice)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Email Quote Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Email Your Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Enter your email address and we'll send you this warranty quote instantly.
            </p>
            
            {selectedPlanForEmail && (
              <div className="bg-white rounded-lg p-4 space-y-2 border border-gray-200 shadow-sm">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Plan:</span>
                  <span className="font-medium">Platinum Complete</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{selectedPlanForEmail.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monthly Payment:</span>
                  <span className="font-medium">£{selectedPlanForEmail.monthlyPrice}/month</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="font-medium text-green-600">£{selectedPlanForEmail.totalPrice}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email-quote" className="text-sm font-medium">
                Email Address
              </label>
              <input
                id="email-quote"
                type="email"
                value={emailForQuote}
                onChange={(e) => {
                  setEmailForQuote(e.target.value);
                  if (emailError) setEmailError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSendQuoteEmail();
                  }
                }}
                placeholder="your.email@example.com"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  emailError ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={sendingEmail}
              />
              {emailError && (
                <p className="text-sm text-red-500">{emailError}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowEmailDialog(false)}
                disabled={sendingEmail}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendQuoteEmail}
                disabled={sendingEmail || !emailForQuote.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {sendingEmail ? 'Sending...' : 'Send Quote'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default PricingTable;