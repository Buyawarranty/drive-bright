import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Info, Shield, Clock, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { calculateAddOnPrice, getAutoIncludedAddOns } from '@/lib/addOnsUtils';
import { calculateVehiclePriceAdjustment, applyPriceAdjustment } from '@/lib/vehicleValidation';
import { supabase } from '@/integrations/supabase/client';
import pandaImage from '@/assets/panda-honest-cover.png';

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
  const navigate = useNavigate();
  
  // Step 1: Labour Rate & Claim Limit
  const [labourRate, setLabourRate] = useState<number>(70);
  const [claimLimit, setClaimLimit] = useState<number>(1250);
  const [boostAddOn, setBoostAddOn] = useState<boolean>(false);
  
  // Step 2: Plan Selection
  const [selectedPlan, setSelectedPlan] = useState<'essential' | 'advanced' | 'elite' | null>('advanced');
  const [selectedDuration, setSelectedDuration] = useState<'12' | '24' | '36'>('24');
  
  // Step 3: Add-ons
  const [selectedAddOns, setSelectedAddOns] = useState<{[key: string]: boolean}>({
    breakdown: false,
    diagnostics: false,
    courtesyCar: false,
    battery: false,
    wearTear: false
  });
  
  // UI State
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [expandedTerms, setExpandedTerms] = useState<boolean>(false);
  const [expandedCoverage, setExpandedCoverage] = useState<boolean>(false);
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string>('');

  // Fetch Platinum warranty plan PDF
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

  // Calculate pricing based on selections
  const calculatePrice = (plan: string, duration: string) => {
    const baseMonthly = plan === 'essential' ? 30 : plan === 'advanced' ? 45 : 60;
    const labourMultiplier = labourRate === 40 ? 0.8 : labourRate === 100 ? 1.2 : 1;
    const claimMultiplier = claimLimit === 750 ? 0.85 : claimLimit === 2000 ? 1.15 : 1;
    const boostCost = boostAddOn ? 7 : 0;
    
    const monthlyPrice = Math.round(baseMonthly * labourMultiplier * claimMultiplier + boostCost);
    const months = parseInt(duration);
    const totalPrice = monthlyPrice * months;
    
    // Apply duration discounts
    const discount = duration === '24' ? 100 : duration === '36' ? 200 : 0;
    
    return {
      monthlyPrice,
      totalPrice: totalPrice - discount,
      savings: discount,
      originalPrice: totalPrice
    };
  };

  const planDetails: Record<'essential' | 'advanced' | 'elite', {
    name: string;
    tagline: string;
    color: string;
    activeColor: string;
    badge?: string;
    features: string[];
    exclusions: string[];
  }> = {
    essential: {
      name: 'Essential',
      tagline: 'Affordable, Key Components',
      color: 'bg-gray-100 border-gray-300',
      activeColor: 'bg-gray-50 border-gray-500 ring-2 ring-gray-500 shadow-[0_0_20px_rgba(107,114,128,0.3)]',
      features: [
        'Engine & Gearbox',
        'Steering System',
        'Braking System',
        'Electrical Components',
        'Up to 5 claims per year'
      ],
      exclusions: [
        'Wear & tear items',
        'Consequential damage',
        'Pre-existing faults'
      ]
    },
    advanced: {
      name: 'Advanced',
      tagline: 'More Coverage, Fewer Worries',
      color: 'bg-orange-50 border-orange-300',
      activeColor: 'bg-orange-50 border-orange-500 ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]',
      badge: 'Most Popular',
      features: [
        'All Essential coverage',
        'Suspension & Cooling',
        'Fuel System',
        'Hybrid Components',
        'MOT test fee',
        'Up to 10 claims per year',
        'Fault diagnostics'
      ],
      exclusions: [
        'Some wear & tear items',
        'Pre-existing faults'
      ]
    },
    elite: {
      name: 'Elite',
      tagline: 'Maximum Protection, Top-Tier Benefits',
      color: 'bg-blue-50 border-blue-300',
      activeColor: 'bg-blue-50 border-blue-600 ring-2 ring-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]',
      badge: 'Best Protection',
      features: [
        'All Advanced coverage',
        'Unlimited claims',
        'Consequential damage',
        'Wear & tear protection',
        'Europe repair cover',
        'Vehicle rental',
        'Transfer cover',
        'Priority claims'
      ],
      exclusions: [
        'Pre-existing faults only'
      ]
    }
  };

  const currentPrice = selectedPlan ? calculatePrice(selectedPlan, selectedDuration) : null;

  const handleContinue = () => {
    if (selectedPlan) {
      // Map duration to payment type format expected by checkout
      const paymentType = selectedDuration === '12' ? '12months' : 
                         selectedDuration === '24' ? '24months' : '36months';
      onNext(paymentType);
    }
  };

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
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

        {/* Main Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Build Your Cover</h1>
          <p className="text-lg text-gray-600">Customise your protection in 3 simple steps</p>
        </div>

        {/* Vehicle Info Banner */}
        <div className="bg-white rounded-lg p-6 mb-8 border border-gray-200 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900 text-lg">{vehicleData.regNumber}</div>
              <div className="text-gray-500 text-xs">Registration</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900">{vehicleData.make} {vehicleData.model}</div>
              <div className="text-gray-500 text-xs">Vehicle</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900">{vehicleData.year}</div>
              <div className="text-gray-500 text-xs">Year</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900">{vehicleData.mileage || 'N/A'}</div>
              <div className="text-gray-500 text-xs">Mileage</div>
            </div>
          </div>
        </div>

        {/* Step 1: Vehicle Information & Settings */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg">
              1
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Set Your Cover Settings</h2>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-6">
            {/* Labour Rate Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Labour Rate per Hour</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setLabourRate(40)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    labourRate === 40 
                      ? 'border-gray-500 bg-gray-50 ring-2 ring-gray-500 shadow-[0_0_20px_rgba(107,114,128,0.3)]' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-lg text-gray-900">£40/hr</div>
                    {labourRate === 40 && <Badge variant="secondary" className="bg-gray-200 text-gray-800">Cheapest</Badge>}
                  </div>
                  <div className="text-sm text-gray-600">Ideal for independent garages and basic repairs</div>
                </button>

                <button
                  onClick={() => setLabourRate(70)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    labourRate === 70 
                      ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-lg text-gray-900">£70/hr</div>
                    {labourRate === 70 && <Badge className="bg-orange-500 text-white">Recommended</Badge>}
                  </div>
                  <div className="text-sm text-gray-600">Covers most reputable garages</div>
                </button>

                <button
                  onClick={() => setLabourRate(100)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    labourRate === 100 
                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-lg text-gray-900">£100/hr</div>
                    {labourRate === 100 && <Badge className="bg-blue-600 text-white">Premium Cover</Badge>}
                  </div>
                  <div className="text-sm text-gray-600">Perfect for main dealers and specialists</div>
                </button>
              </div>
              <div className="mt-3 flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                <p>If your repair costs exceed this hourly rate, you'll need to cover the difference.</p>
              </div>
            </div>

            {/* Claim Limit Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Claim Limit per Repair</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setClaimLimit(750)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    claimLimit === 750 
                      ? 'border-gray-500 bg-gray-50 ring-2 ring-gray-500 shadow-[0_0_20px_rgba(107,114,128,0.3)]' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-2xl text-gray-900 mb-1">£750</div>
                  <div className="text-sm text-gray-600">Basic protection</div>
                </button>

                <button
                  onClick={() => setClaimLimit(1250)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    claimLimit === 1250 
                      ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-bold text-2xl text-gray-900">£1,250</div>
                    {claimLimit === 1250 && <Badge className="bg-orange-500 text-white">Most Popular</Badge>}
                  </div>
                  <div className="text-sm text-gray-600">Balanced coverage</div>
                </button>

                <button
                  onClick={() => setClaimLimit(2000)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    claimLimit === 2000 
                      ? 'border-green-600 bg-green-50 ring-2 ring-green-600 shadow-[0_0_20px_rgba(34,197,94,0.4)]' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-bold text-2xl text-gray-900">£2,000</div>
                    {claimLimit === 2000 && <Badge className="bg-green-600 text-white">Recommended</Badge>}
                  </div>
                  <div className="text-sm text-gray-600">Maximum protection</div>
                </button>
              </div>

              {/* Boost Add-On */}
              {(claimLimit === 1000 || claimLimit === 2000) && (
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 mb-1">💪 Boost Your Claim Limit</div>
                      <div className="text-sm text-gray-600">Add +£1,000 to your claim limit for just £7/month</div>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={boostAddOn}
                        onChange={(e) => setBoostAddOn(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <strong className="text-gray-900">Your settings:</strong> £{labourRate}/hr labour, £{claimLimit.toLocaleString()} claim limit{boostAddOn && ' (+£1,000 boost)'}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Pick Your Plan */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg">
              2
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Pick Your Plan</h2>
          </div>

          {/* Duration Selector */}
          <div className="mb-6 flex justify-center">
            <div className="inline-flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
              <button
                onClick={() => setSelectedDuration('12')}
                className={`px-6 py-3 rounded-md font-medium transition-all ${
                  selectedDuration === '12'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                1 Year
              </button>
              <button
                onClick={() => setSelectedDuration('24')}
                className={`px-6 py-3 rounded-md font-medium transition-all relative ${
                  selectedDuration === '24'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                2 Years
                <span className="ml-2 text-xs">Save £100</span>
              </button>
              <button
                onClick={() => setSelectedDuration('36')}
                className={`px-6 py-3 rounded-md font-medium transition-all relative ${
                  selectedDuration === '36'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                3 Years
                <span className="ml-2 text-xs">Save £200</span>
              </button>
            </div>
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['essential', 'advanced', 'elite'] as const).map((plan) => {
              const details = planDetails[plan];
              const pricing = calculatePrice(plan, selectedDuration);
              const isSelected = selectedPlan === plan;

              return (
                <div
                  key={plan}
                  className={`rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected ? details.activeColor : `${details.color} hover:border-gray-400`
                  }`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <div className="p-6">
                    {/* Badge */}
                    {details.badge && (
                      <div className="mb-3">
                        <Badge className={plan === 'advanced' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}>
                          {details.badge}
                        </Badge>
                      </div>
                    )}

                    {/* Plan Name */}
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{details.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">{details.tagline}</p>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="text-4xl font-bold text-gray-900">
                        £{pricing.monthlyPrice}
                        <span className="text-lg font-normal text-gray-600">/mo</span>
                      </div>
                      {pricing.savings > 0 && (
                        <div className="text-sm text-green-600 font-medium mt-1">
                          Save £{pricing.savings} total
                        </div>
                      )}
                      <div className="text-sm text-gray-500 mt-1">
                        £{pricing.totalPrice.toLocaleString()} total
                      </div>
                    </div>

                    {/* Top Features */}
                    <div className="space-y-2 mb-4">
                      {details.features.slice(0, 5).map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* View Details */}
                    <Collapsible open={expandedPlan === plan} onOpenChange={(open) => setExpandedPlan(open ? plan : null)}>
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors w-full">
                        {expandedPlan === plan ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>View full details</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4 pt-4 border-t border-gray-200">
                        <div className="space-y-4">
                          <div>
                            <div className="font-semibold text-gray-900 mb-2 text-sm">All Features:</div>
                            <div className="space-y-1">
                              {details.features.map((feature, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                  <Check className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                                  <span className="text-gray-600">{feature}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 mb-2 text-sm">Exclusions:</div>
                            <div className="space-y-1">
                              {details.exclusions.map((exclusion, idx) => (
                                <div key={idx} className="text-sm text-gray-600">• {exclusion}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Select Button */}
                    <Button
                      className={`w-full mt-4 ${
                        isSelected
                          ? 'bg-gray-900 text-white hover:bg-gray-800'
                          : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlan(plan);
                      }}
                    >
                      {isSelected ? 'Selected' : 'Select this plan'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Add Extras */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg">
              3
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Add Extras</h2>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'breakdown', name: 'Breakdown Recovery', price: 5 },
                { key: 'diagnostics', name: 'Fault Diagnostics', price: 3 },
                { key: 'courtesyCar', name: 'Courtesy Car', price: 8 },
                { key: 'battery', name: 'Battery Cover', price: 4 },
                { key: 'wearTear', name: 'Wear & Tear', price: 6 }
              ].map((addon) => (
                <label
                  key={addon.key}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedAddOns[addon.key]
                      ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedAddOns[addon.key]}
                      onChange={(e) => setSelectedAddOns({ ...selectedAddOns, [addon.key]: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{addon.name}</div>
                      <div className="text-sm text-gray-600">+£{addon.price}/mo</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Trust Section - We Pay Out */}
        <div className="mb-12 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-8 border border-green-200">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <img src={pandaImage} alt="Just Honest Cover" className="w-48 h-48 object-contain" />
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">We Pay Out – 94% of Claims Approved Fast</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-900">94% Approved</div>
                    <div className="text-sm text-gray-600">Claims processed quickly</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-900">Clear Terms</div>
                    <div className="text-sm text-gray-600">No hidden catches</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Award className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-900">We Say YES</div>
                    <div className="text-sm text-gray-600">Looking for reasons to approve</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg">
                  <Shield className="w-5 h-5" />
                  <span className="font-semibold">14-Day Money-Back Guarantee</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-400 text-xl">★</span>
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-700">Rated Excellent on Trustpilot</span>
                </div>
              </div>
              <p className="text-gray-700 italic">"Don't just take our word for it – see what customers say."</p>
              <p className="text-lg font-semibold text-gray-900 mt-4">Real protection. Real peace of mind. Guaranteed.</p>
            </div>
          </div>
        </div>

        {/* Cover Details Section */}
        <div className="mb-12 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Cover Details – Clear & Simple</h3>
          <p className="text-gray-600 mb-6">Want to know exactly what's included? Click below to see everything in plain English before you buy.</p>
          
          <div className="space-y-4">
            {/* What's Included */}
            <Collapsible open={expandedCoverage} onOpenChange={setExpandedCoverage}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <span className="font-semibold text-gray-900">What's Included</span>
                {expandedCoverage ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 bg-gray-50 rounded-lg">
                <div className="prose prose-sm max-w-none text-gray-700">
                  <p>Your warranty covers all mechanical and electrical components including engine, gearbox, transmission, cooling system, steering, braking, suspension, and more. Labour costs are included up to your selected hourly rate.</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Terms & Conditions */}
            <Collapsible open={expandedTerms} onOpenChange={setExpandedTerms}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <span className="font-semibold text-gray-900">Terms & Conditions</span>
                {expandedTerms ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 bg-gray-50 rounded-lg">
                {platinumDocUrl ? (
                  <a
                    href={platinumDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
                  >
                    View Full Terms & Conditions (PDF)
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <p className="text-gray-600">Loading document...</p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          <p className="text-sm text-gray-500 mt-4 text-center italic">No jargon. No hidden catches. Just the facts.</p>
        </div>

        {/* Continue Button */}
        {selectedPlan && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 shadow-lg rounded-t-xl">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Total Monthly Payment</div>
                <div className="text-3xl font-bold text-gray-900">
                  £{currentPrice?.monthlyPrice}/month
                </div>
                <div className="text-sm text-gray-600">
                  £{currentPrice?.totalPrice.toLocaleString()} total
                  {currentPrice && currentPrice.savings > 0 && (
                    <span className="text-green-600 font-medium ml-2">
                      (Save £{currentPrice.savings})
                    </span>
                  )}
                </div>
              </div>
              <Button
                onClick={handleContinue}
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                Continue to Checkout
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WarrantyDurationStep;
