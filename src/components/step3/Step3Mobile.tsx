import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateVehicleEligibility, calculateVehiclePriceAdjustment, applyPriceAdjustment } from '@/lib/vehicleValidation';
import { calculateAddOnPrice, getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { trackStepCompletion, trackBeginCheckout } from '@/utils/analytics';
import { AlertCircle, ArrowLeft } from 'lucide-react';
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
    previousClaimLimit || 1250
  );
  const [selectedLabourRate, setSelectedLabourRate] = useState<number>(
    previousLabourRate || 50
  );
  const [boostAddon, setBoostAddon] = useState(previousBoostAddon || false);
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

  // Pricing matrix
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

  // Get base price from pricing table
  const getBasePrice = useCallback((term: string, excess: number, claimLimit: number) => {
    const periodData = pricingTable[term as keyof typeof pricingTable] || pricingTable['12months'];
    const excessData = periodData[excess as keyof typeof periodData] || periodData[100];
    return excessData[claimLimit as keyof typeof excessData] || excessData[1250];
  }, []);

  // Calculate vehicle price adjustment
  const vehiclePriceAdjustment = useMemo(() => {
    const warrantyYears = paymentType === '12months' ? 1 : paymentType === '24months' ? 2 : 3;
    return calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
  }, [vehicleData, paymentType]);

  // Calculate display monthly price
  const calculateMonthlyPrice = useCallback((term: string = paymentType || '24months') => {
    const basePrice = getBasePrice(term, voluntaryExcess || 100, selectedClaimLimit || 1250);
    const adjustedPrice = applyPriceAdjustment(basePrice, vehiclePriceAdjustment);

    // Apply discounts
    let discountedPrice = adjustedPrice;
    if (term === '24months') discountedPrice -= 100;
    if (term === '36months') discountedPrice -= 200;

    // Add-on prices
    const durationMonths = term === '12months' ? 12 : term === '24months' ? 24 : 36;
    const addOnPrice = calculateAddOnPrice(selectedProtectionAddOns, term, durationMonths);

    // Boost addon
    const boostCost = boostAddon ? 60 : 0;

    // Labour rate adjustment
    const labourAdjust = selectedLabourRate === 40 ? -36 : selectedLabourRate === 70 ? 48 : selectedLabourRate === 100 ? 96 : 0;

    const totalPrice = discountedPrice + addOnPrice + boostCost + labourAdjust;
    return Math.round(totalPrice / 12);
  }, [paymentType, voluntaryExcess, selectedClaimLimit, vehiclePriceAdjustment, selectedProtectionAddOns, boostAddon, selectedLabourRate, getBasePrice]);

  // Current monthly price
  const currentMonthlyPrice = useMemo(() => calculateMonthlyPrice(), [calculateMonthlyPrice]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    return paymentType !== null && voluntaryExcess !== null && selectedClaimLimit !== null;
  }, [paymentType, voluntaryExcess, selectedClaimLimit]);

  // Handle continue
  const handleContinue = async () => {
    if (!isFormValid) {
      toast.error('Please complete all selections');
      return;
    }

    setLoading(true);
    try {
      const term = paymentType!;
      const durationMonths = term === '12months' ? 12 : term === '24months' ? 24 : 36;
      const basePrice = getBasePrice(term, voluntaryExcess!, selectedClaimLimit!);
      const adjustedPrice = applyPriceAdjustment(basePrice, vehiclePriceAdjustment);

      let discountedPrice = adjustedPrice;
      if (term === '24months') discountedPrice -= 100;
      if (term === '36months') discountedPrice -= 200;

      const addOnPrice = calculateAddOnPrice(selectedProtectionAddOns, term, durationMonths);
      const boostCost = boostAddon ? 60 : 0;
      const labourAdjust = selectedLabourRate === 40 ? -36 : selectedLabourRate === 70 ? 48 : selectedLabourRate === 100 ? 96 : 0;

      const totalPrice = discountedPrice + addOnPrice + boostCost + labourAdjust;
      const effectiveClaimLimit = boostAddon ? selectedClaimLimit! + 1000 : selectedClaimLimit!;

      // Track analytics
      trackStepCompletion(3, 'plan_selection', {
        email: vehicleData?.email,
        phone: vehicleData?.phone,
        firstName: vehicleData?.firstName,
        lastName: vehicleData?.lastName,
        address: vehicleData?.address
      });

      trackBeginCheckout(totalPrice, [{
        item_name: 'Platinum Complete Plan',
        item_id: 'platinum',
        price: totalPrice,
        quantity: 1
      }], {
        email: vehicleData?.email,
        phone: vehicleData?.phone,
        firstName: vehicleData?.firstName,
        lastName: vehicleData?.lastName,
        address: vehicleData?.address
      });

      // Call onPlanSelected
      onPlanSelected?.(
        'platinum',
        term,
        'Platinum Complete Plan',
        {
          totalPrice,
          monthlyPrice: Math.round(totalPrice / 12),
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
    <div className="min-h-screen bg-background pb-32">
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
                  ? `Based on your vehicle's age (${vehicleAge} years), warranty duration options are limited.`
                  : `Based on your vehicle's mileage (${vehicleMileage.toLocaleString()} miles), warranty duration options are limited.`
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
        />

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
        />

        <LabourRateSelector
          selectedLabourRate={selectedLabourRate}
          onLabourRateChange={setSelectedLabourRate}
          currentMonthlyPrice={currentMonthlyPrice}
        />

        <ExtrasSelector
          selectedAddOns={selectedProtectionAddOns}
          onAddOnChange={handleAddOnChange}
          paymentType={paymentType || '24months'}
          currentMonthlyPrice={currentMonthlyPrice}
        />

        <CoverageTransparency
          platinumDocUrl={platinumDocUrl}
          termsDocUrl={termsDocUrl}
        />
      </div>

      <StickyFooter
        monthlyPrice={currentMonthlyPrice}
        onContinue={handleContinue}
        isLoading={loading}
        isValid={isFormValid}
      />
    </div>
  );
};

export default Step3Mobile;
