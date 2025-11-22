import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Check, ArrowLeft, Info, FileText, ExternalLink, Plus, Crown, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { calculateVehiclePriceAdjustment, applyPriceAdjustment } from '@/lib/vehicleValidation';


interface SpecialPlan {
  id: string;
  vehicle_type: string;
  name: string;
  monthly_price: number;
  yearly_price: number | null;
  two_yearly_price: number | null;
  three_yearly_price: number | null;
  coverage: string[];
  is_active: boolean;
  pricing_matrix?: any;
}

interface VehicleData {
  regNumber: string;
  mileage: string;
  email: string;
  phone: string;
  firstName: string;
  address: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  vehicleType?: string;
}

interface SpecialVehiclePricingProps {
  vehicleData: VehicleData;
  onBack: () => void;
  onPlanSelected?: (planId: string, paymentType: string, planName?: string, pricingData?: {totalPrice: number, monthlyPrice: number, voluntaryExcess: number, selectedAddOns: {[addon: string]: boolean}}) => void;
}

const SpecialVehiclePricing: React.FC<SpecialVehiclePricingProps> = ({ vehicleData, onBack, onPlanSelected }) => {
  const [plans, setPlans] = useState<SpecialPlan[]>([]);
  const [paymentType, setPaymentType] = useState<'yearly' | 'two_yearly' | 'three_yearly'>('yearly');
  const [voluntaryExcess, setVoluntaryExcess] = useState<number>(50);
  const [selectedClaimLimit, setSelectedClaimLimit] = useState<number>(1250);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isFloatingBarVisible, setIsFloatingBarVisible] = useState(false);
  const [pdfUrls, setPdfUrls] = useState<{[planName: string]: string}>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchSpecialPlans();
    fetchPdfUrls();
  }, [vehicleData.vehicleType]);

  useEffect(() => {
    const handleScroll = () => {
      // Show floating bar when user scrolls past the initial pricing cards
      const scrollY = window.scrollY;
      setIsFloatingBarVisible(scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchSpecialPlans = async () => {
    try {
      const typeKey = (vehicleData.vehicleType || '').toUpperCase();
      const { data, error } = await supabase
        .from('special_vehicle_plans')
        .select('*')
        .eq('vehicle_type', typeKey)
        .eq('is_active', true)
        .order('monthly_price');

      if (error) throw error;

      if (data && data.length > 0) {
        const processedPlans = data.map(plan => ({
          ...plan,
          coverage: Array.isArray(plan.coverage) ? plan.coverage.map(item => String(item)) : []
        }));
        setPlans(processedPlans);
      } else {
        // Create default plans structure similar to regular cars
        const defaultPlans = [
          {
            id: 'essential',
            vehicle_type: typeKey,
            name: `${getVehicleTypeTitle()} Essential`,
            monthly_price: 0,
            yearly_price: null,
            two_yearly_price: null,
            three_yearly_price: null,
            coverage: [
              'Engine & Transmission',
              'Cooling System',
              'Fuel System',
              'Electrical System',
              'Air Conditioning',
              'Steering & Suspension'
            ],
            is_active: true,
            pricing_matrix: {}
          }
        ];
        setPlans(defaultPlans);
      }
    } catch (error) {
      console.error('Error fetching special vehicle plans:', error);
      toast({
        title: "Error",
        description: "Failed to load vehicle plans. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  // Get base pricing from database and apply vehicle-specific adjustments
  const getPricingData = (excess: number, claimLimit: number, paymentPeriod: string) => {
    // Get the first (and typically only) plan
    const plan = plans[0];
    if (!plan?.pricing_matrix) {
      console.warn('No pricing matrix found, using fallback prices');
      return 547; // Fallback price (1 year, £0 excess, £750 claim limit)
    }

    // Map payment period to database format and warranty years
    const periodMap = {
      'yearly': { dbPeriod: '12', warrantyYears: 1 },
      'two_yearly': { dbPeriod: '24', warrantyYears: 2 }, 
      'three_yearly': { dbPeriod: '36', warrantyYears: 3 }
    };
    
    const { dbPeriod, warrantyYears } = periodMap[paymentPeriod as keyof typeof periodMap] || { dbPeriod: '12', warrantyYears: 1 };
    
    console.log('💰 calculatePlanPrice Debug:', {
      paymentType: `${warrantyYears * 12}months`,
      voluntaryExcess: excess,
      selectedClaimLimit: claimLimit,
      vehicleData,
    });
    
    // Get base price from database using new 3-level nested structure
    let basePrice = 547; // fallback price (1 year, £0 excess, £750 claim limit)
    try {
      const periodData = plan.pricing_matrix[dbPeriod];
      if (periodData && periodData[excess] && periodData[excess][claimLimit]) {
        basePrice = periodData[excess][claimLimit].price;
        console.log('Found price in matrix:', {
          basePrice,
          voluntaryExcess: excess,
          selectedClaimLimit: claimLimit,
          paymentType: `${warrantyYears * 12}months`
        });
      } else {
        console.warn('Price not found in matrix, using fallback:', {
          dbPeriod,
          excess,
          claimLimit,
          availableExcess: periodData ? Object.keys(periodData) : 'no period data'
        });
      }
    } catch (error) {
      console.error('Error parsing pricing matrix:', error);
    }
    
    // Apply vehicle-specific adjustments (van premium, motorbike discount, etc.)
    const vehiclePriceAdjustment = calculateVehiclePriceAdjustment(vehicleData as any, warrantyYears);
    const adjustedPrice = applyPriceAdjustment(basePrice, vehiclePriceAdjustment);
    
    console.log('🏍️ Motorbike/Vehicle adjustment applied:', {
      basePrice,
      adjustedPrice,
      adjustment: vehiclePriceAdjustment,
      vehicleType: vehicleData.vehicleType,
      isMotorbike: vehicleData.vehicleType === 'MOTORBIKE',
      discountApplied: vehiclePriceAdjustment.adjustmentAmount !== 0
    });
    
    return adjustedPrice;
  };

  const calculatePlanPrice = (claimLimit: number) => {
    return getPricingData(voluntaryExcess, claimLimit, paymentType);
  };

  const getMonthlyDisplayPrice = (claimLimit: number) => {
    const totalPrice = calculatePlanPrice(claimLimit);
    const months = paymentType === 'yearly' ? 12 : paymentType === 'two_yearly' ? 24 : 36;
    return Math.round(totalPrice / months);
  };

  const getPlanSavings = (claimLimit: number) => {
    if (paymentType === 'yearly') return null;
    
    const yearlyPrice = getPricingData(voluntaryExcess, claimLimit, 'yearly');
    const currentPrice = calculatePlanPrice(claimLimit);
    const yearlyEquivalent = paymentType === 'two_yearly' ? yearlyPrice * 2 : yearlyPrice * 3;
    
    const savings = Math.round(yearlyEquivalent - currentPrice);
    return savings > 0 ? savings : 0;
  };


  const handlePurchase = (claimLimit: number) => {
    const selectedPlan = plans[0]; // Use first plan as base
    if (!selectedPlan) return;
    
    if (onPlanSelected) {
      const totalPrice = calculatePlanPrice(claimLimit);
      const monthlyPrice = getMonthlyDisplayPrice(claimLimit);
      
      const pricingData = {
        totalPrice,
        monthlyPrice,
        voluntaryExcess,
        selectedAddOns: {},
        claimLimit
      };
      
      // Create plan name based on claim limit
      const planName = claimLimit === 750 ? `${getVehicleTypeTitle()} Essential` :
                      claimLimit === 1250 ? `${getVehicleTypeTitle()} Advantage` :
                      `${getVehicleTypeTitle()} Elite`;
      
      onPlanSelected(selectedPlan.id, paymentType, planName, pricingData);
    }
  };

  const getPaymentLabel = () => {
    switch (paymentType) {
      case 'yearly': return 'per year';
      case 'two_yearly': return 'for 2 years';
      case 'three_yearly': return 'for 3 years';
      default: return 'per month';
    }
  };

  const getVehicleTypeTitle = () => {
    switch (vehicleData.vehicleType) {
      case 'EV': return 'Electric Vehicle';
      case 'PHEV': return 'PHEV / Hybrid';
      case 'MOTORBIKE': return 'Motorbikes';
      default: return vehicleData.vehicleType;
    }
  };

  if (loading) {
    return (
      <div className="bg-[#e8f4fb] min-h-screen flex items-center justify-center">
        <div className="text-center">Loading special vehicle plan...</div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-[#e8f4fb] min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <p className="mb-4">No special plans found for this vehicle type.</p>
          <Button onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="bg-[#e8f4fb] min-h-screen overflow-x-hidden">
        {/* Back Button and Trustpilot Header */}
        <div className="mb-4 sm:mb-8 px-4 sm:px-8 pt-4 sm:pt-8 flex justify-between items-center">
          <Button 
            variant="outline" 
            onClick={onBack}
            className="flex items-center gap-2 hover:bg-white text-base sm:text-lg px-4 sm:px-6 py-2 sm:py-3"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            Back
          </Button>
          
          <div className="flex items-center gap-4">
            <TrustpilotHeader />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-6 sm:mb-10 px-4 sm:px-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-6">
            Your Warranty Quote
          </h1>
          
          {/* Vehicle Registration Display */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center bg-[#ffdb00] text-gray-900 font-bold text-sm sm:text-lg px-3 sm:px-4 py-2 sm:py-3 rounded-[6px] shadow-sm leading-tight border-2 border-black">
              <img 
                src="/lovable-uploads/5fdb1e2d-a10b-4cce-b083-307d56060fc8.png" 
                alt="GB Flag" 
                className="w-[20px] h-[14px] sm:w-[25px] sm:h-[18px] mr-2 sm:mr-3 object-cover rounded-[2px]"
              />
              <div className="font-bold font-sans tracking-normal">
                {vehicleData.regNumber}
              </div>
            </div>
          </div>

          {/* Vehicle Details */}
          {vehicleData.make && vehicleData.model && (
            <div className="mb-6 bg-white rounded-lg p-4 shadow-sm border max-w-md mx-auto">
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                {vehicleData.make} {vehicleData.model}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:text-base text-gray-600">
                {vehicleData.fuelType && <span><strong>Fuel:</strong> {vehicleData.fuelType}</span>}
                {vehicleData.year && <span><strong>Year:</strong> {vehicleData.year}</span>}
                {vehicleData.transmission && <span><strong>Transmission:</strong> {vehicleData.transmission}</span>}
                <span><strong>Mileage:</strong> {parseInt(vehicleData.mileage).toLocaleString()} miles</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Period Toggle */}
        <div className="flex justify-center mb-8 px-4">
          <div className="bg-white rounded-2xl p-1 shadow-lg border border-gray-200 inline-flex">
            <button
              onClick={() => setPaymentType('yearly')}
              className={`px-6 py-2 rounded-xl text-base font-semibold transition-all duration-200 ${
                paymentType === 'yearly' 
                  ? 'bg-[#1a365d] text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
             >
                12 Months
             </button>
            <div className="relative">
              <button
                onClick={() => setPaymentType('two_yearly')}
                className={`px-6 py-2 rounded-xl text-base font-semibold transition-all duration-200 ${
                  paymentType === 'two_yearly' 
                    ? 'bg-[#1a365d] text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
               >
                 24 Months
               </button>
               <div className="absolute -top-3 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold transform translate-x-3">
                 MOST POPULAR
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setPaymentType('three_yearly')}
                className={`px-6 py-2 rounded-xl text-base font-semibold transition-all duration-200 ${
                  paymentType === 'three_yearly' 
                    ? 'bg-[#1a365d] text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
               >
                 36 Months
               </button>
               <div className="absolute -top-3 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold transform translate-x-3">
                 Save £{getPlanSavings(1250) || 54} vs annual
              </div>
            </div>
          </div>
        </div>

        {/* Voluntary Excess Selection */}
        <div className="flex justify-center mb-8 px-4">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 w-full max-w-2xl">
            <h3 className="text-xl font-bold text-center mb-4 text-gray-900">Voluntary Excess Amount</h3>
            <div className="flex justify-center gap-3">
              {[0, 50, 100, 150].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setVoluntaryExcess(amount)}
                  className={`px-6 py-2 rounded-xl text-base font-semibold transition-all duration-200 min-w-[80px] ${
                    voluntaryExcess === amount
                      ? 'bg-[#1a365d] text-white border-2 border-[#1a365d]'
                      : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-[#1a365d]'
                  }`}
                >
                  £{amount}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Claim Limit Selection */}
        <div className="max-w-6xl mx-auto px-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-[#1a365d] text-white rounded-full flex items-center justify-center font-bold text-lg">
                3
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Choose Your Claim Limit
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Essential Plan - £750 */}
              <div className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                selectedClaimLimit === 750 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
              onClick={() => setSelectedClaimLimit(750)}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xl font-bold text-black">£750 per claim</div>
                  <Info className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-lg font-semibold text-gray-700 mb-2">
                  {getVehicleTypeTitle()} Essential
                </div>
                <div className="text-gray-600">
                  Confidence for the everyday drive.
                </div>
              </div>

              {/* Advantage Plan - £1,250 */}
              <div className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 relative ${
                selectedClaimLimit === 1250 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
              onClick={() => setSelectedClaimLimit(1250)}>
                <div className="absolute -top-2 right-4">
                  <Badge className="bg-orange-500 text-white font-bold px-3 py-1">
                    MOST POPULAR
                  </Badge>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xl font-bold text-black">£1,250 cover</div>
                  <Info className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-lg font-semibold text-gray-700 mb-2">
                  {getVehicleTypeTitle()} Advantage
                </div>
                <div className="text-gray-600">
                  Balanced protection for life's bigger bumps.
                </div>
              </div>

              {/* Elite Plan - £2,000 */}
              <div className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                selectedClaimLimit === 2000 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
              onClick={() => setSelectedClaimLimit(2000)}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xl font-bold text-black">£2,000 cover</div>
                  <Info className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-lg font-semibold text-gray-700 mb-2">
                  {getVehicleTypeTitle()} Elite
                </div>
                <div className="text-gray-600">
                  Top-tier cover for total peace of mind.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Warranty Duration and Price Section */}
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-[#1a365d] text-white rounded-full flex items-center justify-center font-bold text-lg">
                4
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Choose Warranty Duration and Price
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1 Year Plan */}
              <div className={`border-2 rounded-xl p-6 ${
                paymentType === 'yearly' 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">1 Year</h3>
                  <Crown className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-gray-600 mb-2">Comprehensive coverage</p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Drive now, pay later</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">12 interest-free payments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Complete coverage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Claim payouts in 90 minutes</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-black mb-2">
                    £{calculatePlanPrice(selectedClaimLimit)} cover
                  </div>
                  <div className="text-gray-500 mb-2">or</div>
                  <div className="text-2xl font-bold text-orange-600">
                    £{getMonthlyDisplayPrice(selectedClaimLimit)}/mo
                  </div>
                </div>
              </div>

              {/* 2 Years Plan */}
              <div className={`border-2 rounded-xl p-6 relative ${
                paymentType === 'two_yearly' 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-gray-200 bg-white'
              }`}>
                <div className="absolute -top-2 right-4">
                  <Badge className="bg-green-500 text-white font-bold px-3 py-1">
                    MOST POPULAR
                  </Badge>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">2 Years</h3>
                  <Crown className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-gray-600 mb-2">Extended protection</p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Drive now, pay later</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">24 interest-free payments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Complete coverage</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-semibold">Save £{getPlanSavings(selectedClaimLimit)} vs annual</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-black mb-2">
                    £{calculatePlanPrice(selectedClaimLimit)} cover
                  </div>
                  <div className="text-gray-500 mb-2">or</div>
                  <div className="text-2xl font-bold text-orange-600">
                    £{getMonthlyDisplayPrice(selectedClaimLimit)}/mo
                  </div>
                </div>
              </div>

              {/* 3 Years Plan */}
              <div className={`border-2 rounded-xl p-6 ${
                paymentType === 'three_yearly' 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">3 Years</h3>
                  <Crown className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-gray-600 mb-2">Maximum protection</p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Drive now, pay later</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">36 interest-free payments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Complete coverage</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-semibold">Save £{getPlanSavings(selectedClaimLimit)} vs annual</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-black mb-2">
                    £{calculatePlanPrice(selectedClaimLimit)} cover
                  </div>
                  <div className="text-gray-500 mb-2">or</div>
                  <div className="text-2xl font-bold text-orange-600">
                    £{getMonthlyDisplayPrice(selectedClaimLimit)}/mo
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Plan Summary */}
            <div className="mt-8 bg-gray-50 rounded-xl p-6">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-700 mb-2">
                  Duration: {paymentType === 'yearly' ? '12 Months' : paymentType === 'two_yearly' ? '24 Months' : '36 Months'}
                </div>
                <div className="text-3xl font-bold text-orange-600 mb-4">
                  £{getMonthlyDisplayPrice(selectedClaimLimit)}/mo (£{calculatePlanPrice(selectedClaimLimit)})
                </div>
                <Button
                  onClick={() => handlePurchase(selectedClaimLimit)}
                  disabled={checkoutLoading}
                  className="px-8 py-3 text-lg font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-colors duration-200"
                >
                  {checkoutLoading ? 'Processing...' : 'Continue to Payment'}
                </Button>
              </div>
            </div>

            {/* Coverage Details */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-bold text-lg mb-4 text-gray-900">What's Covered:</h4>
                <div className="space-y-2">
                  {plans[0]?.coverage.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-base text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warranty Plan Details PDF */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900">Warranty Plan Details</h4>
                    <p className="text-sm text-gray-600">*Full breakdown of coverage</p>
                  </div>
                </div>
                {(() => {
                  let pdfUrl = null;
                  const vehicleType = vehicleData.vehicleType?.toLowerCase();

                  if (vehicleType === 'motorbike') {
                    pdfUrl = pdfUrls['motorbike'];
                  } else if (vehicleType === 'electric' || vehicleType === 'ev') {
                    pdfUrl = pdfUrls['electric'];
                  } else if (vehicleType === 'phev' || vehicleType === 'hybrid') {
                    pdfUrl = pdfUrls['phev'];
                  } else {
                    pdfUrl = pdfUrls['premium'];
                  }

                  return pdfUrl ? (
                    <Button
                      variant="outline"
                      className="w-full text-sm bg-white hover:bg-gray-50 border-gray-300"
                      onClick={() => window.open(pdfUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View PDF
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full text-sm bg-white border-gray-300"
                      disabled
                    >
                      PDF Not Available
                    </Button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Bottom Bar */}
        {isFloatingBarVisible && plans.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
            <div className="max-w-6xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-orange-600">
                    {selectedClaimLimit === 750 ? `${getVehicleTypeTitle()} Essential` :
                     selectedClaimLimit === 1250 ? `${getVehicleTypeTitle()} Advantage` :
                     `${getVehicleTypeTitle()} Elite`}
                  </h4>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm">£</span>
                    <span className="text-2xl font-bold">{getMonthlyDisplayPrice(selectedClaimLimit)}</span>
                    <span className="text-sm text-gray-600">x {paymentType === 'yearly' ? '12' : paymentType === 'two_yearly' ? '24' : '36'} easy payments</span>
                  </div>
                </div>
                <Button
                  onClick={() => handlePurchase(selectedClaimLimit)}
                  disabled={checkoutLoading}
                  className="ml-4 px-6 py-2 font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors duration-200"
                >
                  {checkoutLoading ? 'Processing...' : 'Continue to Payment'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default SpecialVehiclePricing;
