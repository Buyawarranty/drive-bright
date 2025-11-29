import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Crown, Check, ArrowLeft, X, FileText, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { calculateAddOnPrice, getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { calculateVehiclePriceAdjustment, applyPriceAdjustment } from '@/lib/vehicleValidation';
import { supabase } from '@/integrations/supabase/client';

interface WarrantyDurationStepProps {
  vehicleData: any;
  planId: string;
  planName?: string;
  pricingData?: {
    totalPrice: number;
    monthlyPrice: number;
    voluntaryExcess: number;
    selectedAddOns: {[addon: string]: boolean};
    protectionAddOns?: {[key: string]: boolean};
    claimLimit?: number;
  };
  onNext: (paymentType: string) => void;
  onBack: () => void;
}

const WarrantyDurationStep: React.FC<WarrantyDurationStepProps> = ({
  vehicleData,
  planId,
  planName,
  pricingData,
  onNext,
  onBack
}) => {
  console.log('🎯 WarrantyDurationStep - Component rendered with props:', {
    vehicleData: vehicleData?.regNumber,
    planId,
    planName,
    pricingData: {
      voluntaryExcess: pricingData?.voluntaryExcess,
      claimLimit: pricingData?.claimLimit,
      protectionAddOns: pricingData?.protectionAddOns,
      selectedAddOns: pricingData?.selectedAddOns,
      totalPrice: pricingData?.totalPrice
    }
  });
  
  const [selectedPaymentType, setSelectedPaymentType] = useState<string | null>(null);
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string>('');
  const navigate = useNavigate();

  // Fetch Platinum warranty plan PDF from Supabase
  useEffect(() => {
    const fetchPlatinumDoc = async () => {
      const { data } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'platinum')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setPlatinumDocUrl(data.file_url);
      }
    };
    
    fetchPlatinumDoc();
  }, []);

  // State to manage protection add-ons with auto-inclusion logic
  const [currentProtectionAddOns, setCurrentProtectionAddOns] = useState<{[key: string]: boolean}>(() => {
    // Initialize with passed data or defaults (no auto-inclusion until plan is selected)
    if (pricingData?.protectionAddOns) {
      return { ...pricingData.protectionAddOns };
    }
    
    // Default all add-ons to false until a plan is selected
    const defaultAddOns: {[key: string]: boolean} = {
      breakdown: false,
      motRepair: false,
      motFee: false,
      tyre: false,
      wearTear: false,
      european: false,
      rental: false,
      transfer: false
    };
    
    return defaultAddOns;
  });

  // Update protection add-ons when payment type changes within this step
  useEffect(() => {
    if (!selectedPaymentType) return; // Don't update if no plan is selected
    
    const newAutoIncluded = getAutoIncludedAddOns(selectedPaymentType);
    
    console.log('WarrantyDurationStep - Payment type changed:', selectedPaymentType);
    console.log('WarrantyDurationStep - New auto-included add-ons:', newAutoIncluded);
    
    setCurrentProtectionAddOns(prev => {
      // Get all possible auto-included add-ons from all plans
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
      
      console.log('WarrantyDurationStep - Updated protection add-ons:', updated);
      return updated;
    });
  }, [selectedPaymentType]);

  // Get pricing data using the exact pricing structure from the matrix
  const getPricingForDuration = (paymentPeriod: string) => {
    if (!pricingData) return { totalPrice: 0, monthlyPrice: 0 };
    
    const { voluntaryExcess = 50, claimLimit = 1250, protectionAddOns = {}, selectedAddOns = {} } = pricingData;
    
    console.log('WarrantyDurationStep - getPricingForDuration Debug:', {
      paymentPeriod,
      receivedPricingData: pricingData,
      voluntaryExcess,
      claimLimit,
      protectionAddOns,
      selectedAddOns
    });
    
    // Updated pricing matrix matching new database structure
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
    const excessData = periodData[voluntaryExcess as keyof typeof periodData] || periodData[50];
    const baseWarrantyPrice = excessData[claimLimit as keyof typeof excessData] || excessData[1250];
    
    // Apply vehicle-specific price adjustments (van, motorbike, etc.)
    const warrantyYears = paymentPeriod === '12months' ? 1 : 
                         paymentPeriod === '24months' ? 2 : 3;
    const vehiclePriceAdjustment = calculateVehiclePriceAdjustment(vehicleData, warrantyYears);
    const adjustedBasePrice = applyPriceAdjustment(baseWarrantyPrice, vehiclePriceAdjustment);
    
    // Calculate addon prices for this duration
    const durationMonths = paymentPeriod === '12months' ? 12 : 
                          paymentPeriod === '24months' ? 24 : 
                          paymentPeriod === '36months' ? 36 : 12;
    
    // Plan-specific addons (from step 3 selection)
    const planAddOnCount = Object.values(selectedAddOns || {}).filter(Boolean).length;
    const planAddOnPrice = planAddOnCount * 2 * durationMonths; // £2 per add-on per month * duration
    
    // Protection addons (from step 3 selection - use current state for this step)
    // Calculate protection add-on price using centralized utility with current add-ons
    const protectionAddOnPrice = calculateAddOnPrice(currentProtectionAddOns || {}, paymentPeriod, durationMonths);
    
    const totalPrice = adjustedBasePrice + planAddOnPrice + protectionAddOnPrice;
    
    // Apply automatic discounts for multi-year plans
    let discountedPrice = totalPrice;
    if (paymentPeriod === '24months') {
      discountedPrice = totalPrice - 100; // £100 discount for 2-year plans
    } else if (paymentPeriod === '36months') {
      discountedPrice = totalPrice - 200; // £200 discount for 3-year plans
    }
    
    const monthlyPrice = Math.round(discountedPrice / 12); // Always use 12 months for monthly calculation
    
    console.log('WarrantyDurationStep - Calculated pricing:', {
      paymentPeriod,
      baseWarrantyPrice,
      adjustedBasePrice,
      vehiclePriceAdjustment: vehiclePriceAdjustment.adjustmentAmount,
      planAddOnPrice,
      protectionAddOnPrice,
      totalPrice,
      discountedPrice,
      monthlyPrice,
      selectedFromMatrix: `${voluntaryExcess}_${claimLimit}`,
      durationMonths,
      addOnBreakdown: {
        planAddOnCount,
        protectionAddOns: currentProtectionAddOns
      }
    });
    
    // Return discounted price as totalPrice, no originalPrice to avoid showing fake strikethrough
    return { totalPrice: discountedPrice, monthlyPrice };
  };

  // Memoize pricing calculations with stable dependencies to prevent fluctuations on re-render
  const vehicleDataStable = useMemo(() => vehicleData, [vehicleData?.regNumber, vehicleData?.make, vehicleData?.model, vehicleData?.vehicleType]);
  const pricingDataStable = useMemo(() => {
    console.log('🔄 WarrantyDurationStep - pricingData dependency changed:', {
      voluntaryExcess: pricingData?.voluntaryExcess,
      claimLimit: pricingData?.claimLimit,
      selectedAddOns: pricingData?.selectedAddOns,
      protectionAddOns: pricingData?.protectionAddOns
    });
    return pricingData;
  }, [
    pricingData?.voluntaryExcess, 
    pricingData?.claimLimit, 
    JSON.stringify(pricingData?.selectedAddOns),
    JSON.stringify(pricingData?.protectionAddOns)
  ]);
  
  const pricingData12 = useMemo(() => {
    const result = getPricingForDuration('12months');
    console.log('📊 WarrantyDurationStep - 12 months pricing calculated:', result);
    return result;
  }, [vehicleDataStable, pricingDataStable]);
  
  const pricingData24 = useMemo(() => {
    const result = getPricingForDuration('24months');
    console.log('📊 WarrantyDurationStep - 24 months pricing calculated:', result);
    return result;
  }, [vehicleDataStable, pricingDataStable]);
  
  const pricingData36 = useMemo(() => {
    const result = getPricingForDuration('36months');
    console.log('📊 WarrantyDurationStep - 36 months pricing calculated:', result);
    return result;
  }, [vehicleDataStable, pricingDataStable]);

  const durationOptions = useMemo(() => [
    {
      id: '12months',
      title: '1-Year Cover',
      subtitle: 'STARTER',
      description: 'Flexible protection for 12 month cover',
      planTitle: 'Platinum Complete Plan',
      features: [
        'All mechanical & electrical parts',
        'Up to 10 claims per year',
        'Labour costs covered',
        'Fault diagnostics',
        'Consequential damage cover',
        'Fast claims process',
        '14-day money-back guarantee',
        'Optional extras available'
      ],
      exclusions: [
        'Pre-existing faults are not covered'
      ],
      ...pricingData12,
      isPopular: false,
      isBestValue: false,
      isStarter: true,
      savePercent: undefined,
      originalPrice: undefined
    },
    {
      id: '24months',
      title: '2-Year Cover — Save £100 Today',
      subtitle: 'MOST POPULAR',
      description: 'Balanced Protection and Value',
      planTitle: 'Platinum Complete Plan',
      features: [
        'All mechanical & electrical parts',
        'Unlimited Claims',
        'Labour costs covered',
        'Fault diagnostics',
        'MOT test fee',
        'Vehicle recovery claim-back',
        'Consequential damage cover',
        'Fast claims process',
        '14-day money-back guarantee',
        'Optional extras available'
      ],
      exclusions: [
        'Pre-existing faults are not covered'
      ],
      ...pricingData24,
      originalPrice: (pricingData24 as any).totalPrice + 100, // Show base matrix price before discount
      isPopular: true,
      isBestValue: false,
      isStarter: false,
      savePercent: undefined
    },
    {
      id: '36months',
      title: '3-Year Cover — Save £200 Today',
      subtitle: 'BEST VALUE',
      description: 'Extended cover for longer peace of mind',
      planTitle: 'Platinum Complete Plan',
      features: [
        'All mechanical & electrical parts',
        'Unlimited Claims',
        'Labour costs covered',
        'Fault diagnostics',
        'Vehicle recovery claim-back',
        'MOT test fee',
        'Europe repair cover',
        'Vehicle rental cover',
        'Consequential damage cover',
        'Fast claims process',
        '14-day money-back guarantee',
        'Optional extras available'
      ],
      exclusions: [
        'Pre-existing faults are not covered'
      ],
      ...pricingData36,
      originalPrice: (pricingData36 as any).totalPrice + 200, // Show base matrix price before discount
      isPopular: false,
      isBestValue: true,
      isStarter: false,
      savePercent: undefined
    }
  ], [pricingData12, pricingData24, pricingData36]);

  const handleContinue = () => {
    if (selectedPaymentType) {
      onNext(selectedPaymentType);
    }
  };

  return (
    <div className="bg-[#e8f4fb] min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-6">
        
        {/* Back Button */}
        <div className="mb-6">
          <Button
            onClick={onBack}
            variant="outline"
            className="flex items-center gap-2 bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        {/* Header with Logo */}
        <div className="flex justify-center mb-8">
          <a href="/" className="hover:opacity-80 transition-opacity">
            <img 
              src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" 
              alt="Buy a Warranty" 
              className="h-8 w-auto"
            />
          </a>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Build your warranty</h1>
          <p className="text-gray-600">Select the coverage period that works best for you</p>
        </div>

        {/* Vehicle Info Banner */}
        <div className="bg-white rounded-lg p-4 mb-8 border border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex-1 text-center">
              <span className="font-semibold">{vehicleData.regNumber}</span>
            </div>
            <div className="flex-1 text-center">
              <span>{vehicleData.make} {vehicleData.model}</span>
            </div>
            <div className="flex-1 text-center">
              <span>{vehicleData.year}</span>
            </div>
            <div className="flex-1 text-center">
              <span>{planName}</span>
            </div>
          </div>
        </div>

        {/* Duration Options */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gray-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              4
            </div>
            <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Choose Warranty Duration and Price
            </h3>
          </div>

          {/* Complete Protection Button */}
          <div className="mb-6">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors duration-200 font-medium">
              <span>Complete Protection</span>
              <div className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                i
              </div>
              <span className="text-sm">What's Included?</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {durationOptions.map((option) => (
              <div
                key={option.id}
                onClick={() => setSelectedPaymentType(option.id)}
                className={`relative p-4 sm:p-6 rounded-xl transition-all duration-200 text-left w-full cursor-pointer border-2 ${
                  selectedPaymentType === option.id 
                    ? 'border-orange-500 bg-orange-50' 
                    : 'border-gray-200 bg-white hover:border-orange-300'
                }`}
              >
                {/* Save Percentage Ribbon - Top Right */}
                {option.savePercent && (
                  <div className="absolute -top-2 -right-2 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10">
                    Save {option.savePercent}
                  </div>
                )}

                {/* Badge Pills - Top Left */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {option.isStarter && (
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      STARTER
                    </span>
                  )}
                  {option.isPopular && (
                    <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      MOST POPULAR
                    </span>
                  )}
                  {option.isBestValue && (
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      BEST VALUE
                    </span>
                  )}
                </div>
                
                {/* Title */}
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-gray-900 mb-1">
                    {option.id === '12months' && '✅ '}
                    {option.id === '24months' && '⭐️ '}
                    {option.id === '36months' && '🏆 '}
                    {option.title.split('—')[0].trim()}
                    {option.title.includes('—') && (
                      <>
                        {' — '}
                        <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          {option.title.split('—')[1].trim()}
                        </span>
                      </>
                    )}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                  <h5 className="text-sm font-semibold text-gray-800 mb-2">{option.planTitle}</h5>
                  <p className="text-sm font-medium text-gray-700 mb-3">What's included:</p>
                </div>
                
                {/* Features List - Show all features */}
                <div className="space-y-2 mb-4">
                  {option.features.map((feature, index) => (
                    <div key={index} className="flex items-start text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                  {option.exclusions.map((exclusion, index) => (
                    <div key={`exclusion-${index}`} className="flex items-start text-sm text-gray-700">
                      <X className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{exclusion}</span>
                    </div>
                  ))}
                </div>
                
                {/* Pricing Section */}
                <div className="space-y-2 mt-6 mb-4">
                  <div className="text-3xl font-bold text-gray-900">
                    £{option.monthlyPrice}/month
                  </div>
                  <div className="text-sm text-gray-600">
                    {option.id === '12months' 
                      ? '12 monthly payments' 
                      : option.id === '24months' 
                        ? '12 monthly payments' 
                        : '12 monthly payments'
                    }
                  </div>
                  <div className="text-sm text-gray-600 mb-1">
                    {option.id === '24months' 
                      ? 'Coverage continues in Year 2 at no extra cost' 
                      : option.id === '36months'
                        ? 'Coverage continues in Year 2 & 3 at no extra cost'
                        : ''
                    }
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">
                      Total cost:
                    </div>
                    {option.originalPrice ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base line-through text-gray-500">£{option.originalPrice}</span>
                          <span className="text-4xl font-bold text-green-600">£{option.totalPrice}</span>
                        </div>
                        <div className="text-lg font-semibold text-green-600">
                          You save £{option.originalPrice - option.totalPrice}!
                        </div>
                      </div>
                    ) : (
                      <div className="text-4xl font-bold text-blue-600">
                        £{option.totalPrice}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Select Button */}
                <div className="mt-4">
                  <Button 
                    className={`w-full font-semibold mb-3 ${
                      selectedPaymentType === option.id 
                        ? 'bg-green-600 hover:bg-green-700 text-white border-2 border-green-600' 
                        : 'bg-white border-2 border-orange-500 text-orange-500 hover:bg-orange-50'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPaymentType(option.id);
                    }}
                  >
                    {selectedPaymentType === option.id ? 'Selected' : 'Select'}
                  </Button>
                  
                  <Button 
                    type="button"
                    className="w-full font-semibold text-base py-3.5 bg-white border-2 border-gray-500 text-gray-800 hover:bg-gray-50 hover:border-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      const mailto = `mailto:?subject=Car Warranty Quote - ${vehicleData?.regNumber || 'Vehicle'}&body=I'd like to share this warranty quote with you:%0D%0A%0D%0APlan: Platinum Complete Plan%0D%0ADuration: ${option.title}%0D%0AMonthly Payment: £${option.monthlyPrice}%0D%0ATotal Cost: £${option.totalPrice}%0D%0A%0D%0AGet your own quote at: https://buyawarranty.co.uk`;
                      window.location.href = mailto;
                    }}
                  >
                    📧 Email Quote
                  </Button>
                </div>
                
                <div className="text-xs text-gray-500 text-center mt-3">
                  *For more info please 'Your Cover, Made Clear' below
                </div>
              </div>
            ))}
          </div>

          {/* Full Platinum Plan Section */}
          <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-8 mb-8 border border-gray-200 shadow-lg">
            <div className="text-center">
              <div className="mb-4">
                <Crown className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Discover everything the Platinum Plan offers and any limitations
                </h3>
                <p className="text-base text-gray-700 mb-2">
                  Click here for complete details and peace of mind
                </p>
                <p className="text-sm text-gray-600 font-medium">
                  Wondering if we actually pay out? Fair question — and the answer is yes. We genuinely value our customers, and when something goes wrong, we look for reasons to say Yes, not excuses to say no.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                {platinumDocUrl ? (
                  <a 
                    href={platinumDocUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
                  >
                    <FileText className="w-4 h-4" />
                    View Full Platinum Plan Details
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-gray-400 text-white font-medium px-6 py-3 rounded-lg cursor-not-allowed">
                    <FileText className="w-4 h-4" />
                    Loading PDF...
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Complete coverage breakdown</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>All terms & conditions</span>
                </div>
              </div>
            </div>
          </div>

          {/* One Last Thing Section - Only show when plan is selected */}
          {selectedPaymentType && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                One last thing before we take your payment...
              </h3>
              
              <p className="text-gray-700 mb-6">
                By submitting this payment and checking the box in this section, I agree to the terms and conditions, fare rules applicable to my booking and general conditions of carriage.
              </p>

              <div className="space-y-4">
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full text-left text-orange-500 hover:text-orange-600 font-medium py-3">
                    <span>Terms and conditions</span>
                    <ChevronDown className="w-8 h-8 text-orange-500 transition-transform duration-200" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 text-gray-900 text-sm">
                    <p>Complete terms and conditions for your warranty coverage, including coverage details, claim procedures, and policy limitations.</p>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full text-left text-orange-500 hover:text-orange-600 font-medium py-3">
                    <span>Fare rules</span>
                    <ChevronDown className="w-8 h-8 text-orange-500 transition-transform duration-200" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 text-gray-900 text-sm">
                    <p>Pricing structure, payment terms, and billing information for your selected warranty plan.</p>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full text-left text-orange-500 hover:text-orange-600 font-medium py-3">
                    <span>General conditions of carriage</span>
                    <ChevronDown className="w-8 h-8 text-orange-500 transition-transform duration-200" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 text-gray-900 text-sm">
                    <p>Standard terms that apply to the provision of warranty services and customer obligations.</p>
                  </CollapsibleContent>
                </Collapsible>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-900 mb-4">
                    I agree that the personal data, which has been provided in connection with this booking, may be passed to government authorities for border control and aviation security purposes.
                  </p>

                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-left text-orange-500 hover:text-orange-600 font-medium py-3">
                      <span>Government access to booking records</span>
                      <ChevronDown className="w-8 h-8 text-orange-500 transition-transform duration-200" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 text-gray-900 text-sm">
                      <p>Information about how your personal data may be shared with relevant authorities as required by law.</p>
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-900 mb-4">
                    I agree that I have read and understood the forbidden articles and substances list.
                  </p>

                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-left text-orange-500 hover:text-orange-600 font-medium py-3">
                      <span>Forbidden articles and substances list</span>
                      <ChevronDown className="w-8 h-8 text-orange-500 transition-transform duration-200" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 text-gray-900 text-sm">
                      <p>List of prohibited items and substances that are not covered under the warranty policy.</p>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </div>
          )}

          {/* Continue Button */}
          <div className="flex justify-center">
            <Button 
              onClick={handleContinue}
              disabled={!selectedPaymentType}
              className={`font-bold px-12 py-4 text-lg rounded-lg ${
                selectedPaymentType 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {selectedPaymentType ? 'Continue to Checkout' : 'Select a Plan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarrantyDurationStep;