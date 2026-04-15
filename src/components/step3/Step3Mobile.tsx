import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { getBaseClaimLimit, getClaimLimitSurcharge } from '@/lib/claimLimitTiers';
import { trackStepCompletion, trackBeginCheckout } from '@/utils/analytics';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import PriceHelpPanel from './PriceHelpPanel';
import PriceHelpTrigger from './PriceHelpTrigger';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

import Step3Header from './Step3Header';
import Step3Hero from './Step3Hero';
import TermSelector from './TermSelector';
import ExcessSelector from './ExcessSelector';
import ClaimLimitSelector from './ClaimLimitSelector';
import LabourRateSelector from './LabourRateSelector';
import ExtrasSelector from './ExtrasSelector';
import CoverageTransparency from './CoverageTransparency';
import StickyFooter from './StickyFooter';

interface Step3MobileProps {
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
    totalPrice: number;
    monthlyPrice: number;
    voluntaryExcess: number;
    selectedAddOns: { [addon: string]: boolean };
    protectionAddOns?: { [key: string]: boolean };
    claimLimit?: number;
    labourRate?: number;
    boostAddon?: boolean;
  }) => void;
  previousPaymentType?: '12months' | '24months' | '36months';
  previousVoluntaryExcess?: number;
  previousClaimLimit?: number;
  previousSelectedAddOns?: { [addon: string]: boolean };
  previousProtectionAddOns?: { [key: string]: boolean };
  previousLabourRate?: number;
  previousBoostAddon?: boolean;
}

const Step3Mobile: React.FC<Step3MobileProps> = ({
  vehicleData,
  onBack,
  onPlanSelected,
  previousPaymentType,
  previousVoluntaryExcess,
  previousClaimLimit,
  previousSelectedAddOns,
  previousProtectionAddOns,
  previousLabourRate,
  previousBoostAddon
}) => {
  // State
  const [paymentType, setPaymentType] = useState<'12months' | '24months' | '36months' | null>(
    previousPaymentType || '24months'
  );
  const [voluntaryExcess, setVoluntaryExcess] = useState<number | null>(
    previousVoluntaryExcess !== undefined ? previousVoluntaryExcess : 100
  );
  const [selectedClaimLimit, setSelectedClaimLimit] = useState<number | null>(
    previousClaimLimit || 2000
  );
  const [selectedLabourRate, setSelectedLabourRate] = useState<number>(
    previousLabourRate ?? 70
  );
  const [boostAddon, setBoostAddon] = useState(previousBoostAddon !== undefined ? previousBoostAddon : false);
  const [selectedProtectionAddOns, setSelectedProtectionAddOns] = useState<{ [key: string]: boolean }>(
    previousProtectionAddOns || {
      breakdown: false,
      wearAndTear: false,
      tyre: false,
      european: false,
      rental: false,
      transfer: false
    }
  );
  const [loading, setLoading] = useState(false);
  const [platinumDocUrl, setPlatinumDocUrl] = useState('');
  const [termsDocUrl, setTermsDocUrl] = useState('');
  const [showPriceHelpPanel, setShowPriceHelpPanel] = useState(false);

  // Fetch documents
  useEffect(() => {
    const fetchDocuments = async () => {
      const { data: termsData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'terms-and-conditions')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (termsData) setTermsDocUrl(termsData.file_url);

      const { data: platinumData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'platinum')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (platinumData) setPlatinumDocUrl(platinumData.file_url);
    };

    fetchDocuments();
  }, []);

  // Vehicle validation
  const vehicleValidation = useMemo(() => validateVehicleEligibility(vehicleData), [vehicleData]);

  // Vehicle age/mileage calculations
  const vehicleAge = useMemo(() => {
    if (vehicleData?.year) {
      const currentYear = new Date().getFullYear();
      return currentYear - parseInt(vehicleData.year);
    }
    return 0;
  }, [vehicleData?.year]);

  const vehicleMileage = useMemo(() => {
    if (vehicleData?.mileage) {
      const mileageStr = String(vehicleData.mileage).replace(/[^0-9]/g, '');
      return parseInt(mileageStr) || 0;
    }
    return 0;
  }, [vehicleData?.mileage]);

  // Available durations based on vehicle age/mileage
  const availableDurations = useMemo(() => {
    type DurationType = '12months' | '24months' | '36months';
    const allDurations: DurationType[] = ['12months', '24months', '36months'];

    let ageBasedDurations: DurationType[] = allDurations;
    if (vehicleAge === 15) {
      ageBasedDurations = ['12months'];
    } else if (vehicleAge === 14) {
      ageBasedDurations = ['12months', '24months'];
    }

    let mileageBasedDurations: DurationType[] = allDurations;
    if (vehicleMileage >= 140000) {
      mileageBasedDurations = ['12months'];
    } else if (vehicleMileage > 120000) {
      mileageBasedDurations = ['12months', '24months'];
    }

    const finalDurations = ageBasedDurations.filter(d => mileageBasedDurations.includes(d));
    return finalDurations.length > 0 ? finalDurations : ['12months' as DurationType];
  }, [vehicleAge, vehicleMileage]);

  // Ensure selected payment type is valid
  useEffect(() => {
    if (paymentType && !availableDurations.includes(paymentType)) {
      setPaymentType('12months');
    }
  }, [paymentType, availableDurations]);

  // Auto-include add-ons based on payment type
  useEffect(() => {
    if (!paymentType) return;
    
    const autoIncluded = getAutoIncludedAddOns(paymentType);
    setSelectedProtectionAddOns(prev => {
      const updated = { ...prev };
      autoIncluded.forEach(key => {
        updated[key] = true;
      });
      return updated;
    });
  }, [paymentType]);

  // Get base price from centralized pricing matrix (uses promo logic for 2yr/3yr £2000 limit)
  const getBasePrice = useCallback((term: string, excess: number, claimLimit: number) => {
    // Map £5000 to £2000 for base price lookup (surcharge added separately)
    const effectiveLimit = getBaseClaimLimit(claimLimit);
    return getCentralizedBasePrice(term as PaymentPeriod, excess, effectiveLimit);
  }, []);

  // Calculate vehicle price adjustment
  const vehiclePriceAdjustment = useMemo(() => {
    const warrantyYears = paymentType === '12months' ? 1 : paymentType === '24months' ? 2 : 3;
    return calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
  }, [vehicleData, paymentType]);


  // CRITICAL: Compute "effective add-ons" synchronized with paymentType to prevent race condition.
  // When switching durations, paymentType updates immediately but selectedProtectionAddOns
  // updates asynchronously via useEffect, causing a brief frame with wrong prices.
  const effectiveAddOns = useMemo(() => {
    if (!paymentType) return selectedProtectionAddOns;
    const autoIncluded = getAutoIncludedAddOns(paymentType);
    const allPossibleAutoIncluded = ['breakdown', 'motFee', 'rental', 'tyre'];
    const normalized = { ...selectedProtectionAddOns };
    
    autoIncluded.forEach(key => { normalized[key] = true; });
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

  // Calculate total price for a term using centralized functions
  // All cards use the user's selected claim limit for consistent pricing
  const calculateTotalPrice = useCallback((term: string = paymentType || '24months') => {
    // Always use user's selected claim limit for ALL terms to prevent price jumps when switching
    const termClaimLimit = selectedClaimLimit || 2000;
    
    const basePrice = getBasePrice(term, voluntaryExcess || 100, termClaimLimit);
    
    // Calculate vehicle adjustment for this specific term
    const warrantyYears = term === '12months' ? 1 : term === '24months' ? 2 : 3;
    const termVehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
    const adjustedPrice = applyPriceAdjustment(basePrice, termVehicleAdjustment);

    const durationMonths = DURATION_MONTHS[term as PaymentPeriod] || 12;
    
    // Compute effective add-ons for THIS specific term (not relying on async state)
    const termAutoIncluded = getAutoIncludedAddOns(term);
    const allPossibleAutoIncluded = ['breakdown', 'motFee', 'rental', 'tyre'];
    const termAddOns = { ...selectedProtectionAddOns };
    termAutoIncluded.forEach(key => { termAddOns[key] = true; });
    allPossibleAutoIncluded.forEach(key => {
      if (!termAutoIncluded.includes(key)) {
        const wasAutoInOther = getAutoIncludedAddOns('24months').includes(key) || 
                               getAutoIncludedAddOns('36months').includes(key);
        if (wasAutoInOther) {
          termAddOns[key] = false;
        }
      }
    });
    
    const addOnPrice = calculateAddOnPrice(termAddOns, term, durationMonths);
    const labourAdjust = calculateLabourRateAdjustment(selectedLabourRate, term as PaymentPeriod);
    
     // £3000 and £5000 claim limit surcharge
    const premiumSurcharge = getClaimLimitSurcharge(termClaimLimit, term, voluntaryExcess || 100);
    
    return adjustedPrice + addOnPrice + labourAdjust + premiumSurcharge;
  }, [paymentType, voluntaryExcess, selectedClaimLimit, vehicleData, selectedProtectionAddOns, selectedLabourRate, getBasePrice]);

  // Calculate monthly price (total / 12, ALWAYS rounded DOWN)
  const calculateMonthlyPrice = useCallback((term: string = paymentType || '24months') => {
    const totalPrice = calculateTotalPrice(term);
    return Math.floor(totalPrice / 12);
  }, [calculateTotalPrice, paymentType]);

  // Current monthly price
  const currentMonthlyPrice = useMemo(() => calculateMonthlyPrice(), [calculateMonthlyPrice]);

  // Calculate total price for sticky footer (exact total, not monthly × 12)
  const currentTotalPrice = useMemo(() => calculateTotalPrice(), [calculateTotalPrice]);

  // Free year text for sticky footer
  const freeYearText = useMemo(() => {
    if (paymentType === '24months') return 'Year 2: £0/month';
    if (paymentType === '36months') return 'Years 2 & 3: £0/month';
    return undefined;
  }, [paymentType]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    return paymentType !== null && voluntaryExcess !== null && selectedClaimLimit !== null;
  }, [paymentType, voluntaryExcess, selectedClaimLimit]);

  // Check if any optional add-ons are selected (excluding auto-included ones)
  const hasAddOnsSelected = useMemo(() => {
    const autoIncluded = paymentType ? getAutoIncludedAddOns(paymentType) : [];
    // Check if any add-on is selected that isn't auto-included, OR if boost is enabled
    const hasManualAddOns = Object.entries(effectiveAddOns).some(
      ([key, value]) => value && !autoIncluded.includes(key)
    );
    return hasManualAddOns || boostAddon;
  }, [effectiveAddOns, paymentType, boostAddon]);

  // Handle continue
  const handleContinue = async () => {
    if (!isFormValid) {
      toast.error('Please complete all selections');
      return;
    }

    setLoading(true);
    try {
      const term = paymentType!;

      // CRITICAL: Use the SAME values that are displayed on screen (currentMonthlyPrice, currentTotalPrice)
      // instead of recalculating, to guarantee Step 3 display matches what Step 4 receives.
      const displayedMonthly = currentMonthlyPrice;
      const displayedTotal = currentTotalPrice;
      
      const effectiveClaimLimit = selectedClaimLimit!;

      // Track analytics
      trackStepCompletion(3, 'plan_selection', {
        email: vehicleData?.email,
        phone: vehicleData?.phone,
        firstName: vehicleData?.firstName,
        lastName: vehicleData?.lastName,
        address: vehicleData?.address
      });

      trackBeginCheckout(displayedTotal, [{
        item_name: 'Platinum Complete Plan',
        item_id: 'platinum',
        price: displayedTotal,
        quantity: 1
      }], {
        email: vehicleData?.email,
        phone: vehicleData?.phone,
        firstName: vehicleData?.firstName,
        lastName: vehicleData?.lastName,
        address: vehicleData?.address
      });

      // Use displayMonthlyPrice * 12 as totalPrice to match what's shown in Step 3
      // This ensures Step 4 receives the EXACT same values displayed on screen
      const consistentTotalPrice = displayedMonthly * 12;

      // Call onPlanSelected
      onPlanSelected?.(
        'platinum',
        term,
        'Platinum Complete Plan',
        {
          totalPrice: consistentTotalPrice,
          monthlyPrice: displayedMonthly,
          voluntaryExcess: voluntaryExcess!,
          selectedAddOns: {},
          protectionAddOns: selectedProtectionAddOns,
          claimLimit: effectiveClaimLimit,
          labourRate: selectedLabourRate,
          boostAddon
        }
      );
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast.error('Failed to select plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle add-on change
  const handleAddOnChange = (key: string, selected: boolean) => {
    setSelectedProtectionAddOns(prev => ({
      ...prev,
      [key]: selected
    }));
  };

  // Check vehicle eligibility
  if (!vehicleValidation.isValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-destructive mb-2">Vehicle Not Eligible</h2>
          <p className="text-destructive/80 mb-6">{vehicleValidation.errorMessage}</p>
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Show restriction alert if durations are limited
  const showRestrictionAlert = availableDurations.length < 3;

  return (
    <div className="min-h-screen bg-background pb-32 px-2 sm:px-0">
      <Step3Header currentStep={0} />
      
      <div className="max-w-2xl mx-auto">
        <Step3Hero vehicleData={vehicleData} onBack={onBack} />

        {/* Restriction Alert */}
        {showRestrictionAlert && (
          <div className="px-4 mb-4">
            <Alert className="border-primary/30 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                {vehicleAge >= 14 
                  ? `As your vehicle is ${vehicleAge} years old, you're eligible for up to ${availableDurations.length === 1 ? '1 year' : '2 years'} of warranty cover.`
                  : `As your vehicle has ${vehicleMileage.toLocaleString()} miles, you're eligible for up to ${availableDurations.length === 1 ? '1 year' : '2 years'} of warranty cover.`
                }
              </AlertDescription>
            </Alert>
          </div>
        )}

        <TermSelector
          selectedTerm={paymentType}
          onTermChange={(term) => setPaymentType(term)}
          availableDurations={availableDurations}
          getPriceForTerm={calculateMonthlyPrice}
          getTotalForTerm={calculateTotalPrice}
          hasAddOnsSelected={hasAddOnsSelected}
          vehicleModel={vehicleData?.model}
          vehicleType={vehicleData?.vehicleType}
        />

        {/* Price Help Trigger */}
        <div className="px-4 mb-4 mt-4">
          <PriceHelpTrigger onClick={() => setShowPriceHelpPanel(true)} />
        </div>

        <ExcessSelector
          selectedExcess={voluntaryExcess}
          onExcessChange={setVoluntaryExcess}
          currentMonthlyPrice={currentMonthlyPrice}
        />

        <ClaimLimitSelector
          selectedClaimLimit={selectedClaimLimit}
          onClaimLimitChange={setSelectedClaimLimit}
          currentMonthlyPrice={currentMonthlyPrice}
          boostAddon={boostAddon}
          onBoostChange={setBoostAddon}
          boostPrice={5}
          paymentType={paymentType}
          vehicleMake={vehicleData?.make}
          voluntaryExcess={voluntaryExcess || 100}
        />

        <LabourRateSelector
          selectedLabourRate={selectedLabourRate}
          onLabourRateChange={setSelectedLabourRate}
          currentMonthlyPrice={currentMonthlyPrice}
        />

        {/* Add-ons section removed - auto-included add-ons for 24/36 month plans are handled by getAutoIncludedAddOns in addOnsUtils.ts */}

        <CoverageTransparency
          platinumDocUrl={platinumDocUrl}
          termsDocUrl={termsDocUrl}
        />
      </div>

      <StickyFooter
        monthlyPrice={currentMonthlyPrice}
        totalPrice={currentTotalPrice}
        freeYearText={freeYearText}
        onContinue={handleContinue}
        isLoading={loading}
        isValid={isFormValid}
        paymentPeriod={paymentType}
        hasAddOnsSelected={hasAddOnsSelected}
      />

      {/* Price Help Panel - Slide-in (Desktop) / Bottom Sheet (Mobile) */}
      <PriceHelpPanel
        isOpen={showPriceHelpPanel}
        onClose={() => setShowPriceHelpPanel(false)}
        currentExcess={voluntaryExcess}
        currentClaimLimit={selectedClaimLimit}
        currentLabourRate={selectedLabourRate}
        onExcessChange={setVoluntaryExcess}
        onClaimLimitChange={setSelectedClaimLimit}
        onLabourRateChange={setSelectedLabourRate}
        currentMonthlyPrice={currentMonthlyPrice}
      />
    </div>
  );
};

export default Step3Mobile;
