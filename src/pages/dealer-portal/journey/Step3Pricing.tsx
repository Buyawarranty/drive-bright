import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DealerJourneyLayout } from '@/components/dealer/journey/DealerJourneyLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDealerJourney, calcDealerPrice, DEALER_PLAN_LABELS } from '@/contexts/DealerJourneyContext';
import { Check } from 'lucide-react';

type PlanType = 'basic' | 'gold' | 'platinum';
type Duration = 3 | 12 | 24 | 36;

const DURATIONS: Duration[] = [3, 12, 24, 36];
const PLANS: PlanType[] = ['basic', 'gold', 'platinum'];

const PLAN_FEATURES: Record<PlanType, string[]> = {
  basic: ['Mechanical breakdown', 'UK-wide repair network', 'Designed for everyday cover'],
  gold: ['Everything in Basic', 'Electrical components', 'Higher claim limit'],
  platinum: ['Everything in Gold', 'Premium parts cover', 'Highest claim limit'],
};

const Step3Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { vehicle, customer, plan, setPlan, discount_pct } = useDealerJourney();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(plan?.plan_type || 'gold');
  const [duration, setDuration] = useState<Duration>(plan?.duration_months || 12);

  useEffect(() => {
    if (!vehicle) navigate('/dealer-portal/quote/vehicle', { replace: true });
    else if (!customer) navigate('/dealer-portal/quote/customer', { replace: true });
  }, [vehicle, customer, navigate]);

  const handleNext = () => {
    const { retail, dealer } = calcDealerPrice(selectedPlan, duration, discount_pct);
    setPlan({
      plan_type: selectedPlan,
      duration_months: duration,
      retail_price: retail,
      dealer_price: dealer,
    });
    navigate('/dealer-portal/quote/checkout');
  };

  return (
    <DealerJourneyLayout step={3} title="Plan & pricing" subtitle="Choose the cover that suits your customer.">
      {/* Duration selector */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-300 block mb-3">Cover duration</label>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                duration === d
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {d} months
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((p) => {
          const { retail, dealer } = calcDealerPrice(p, duration, discount_pct);
          const isSelected = selectedPlan === p;
          const hasDiscount = discount_pct > 0;
          return (
            <Card
              key={p}
              onClick={() => setSelectedPlan(p)}
              className={`bg-gray-900 cursor-pointer transition-all ${
                isSelected ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{DEALER_PLAN_LABELS[p]}</h3>
                  {isSelected && <Check className="h-5 w-5 text-orange-500" />}
                </div>
                <div className="mb-4">
                  {hasDiscount && (
                    <p className="text-xs text-gray-500 line-through">Retail £{retail.toFixed(2)}</p>
                  )}
                  <p className="text-3xl font-bold text-white">
                    £{dealer.toFixed(2)}
                    {hasDiscount && (
                      <span className="ml-2 text-xs font-semibold text-orange-400 align-middle">
                        -{discount_pct}%
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Dealer price · {duration} mo cover</p>
                </div>
                <ul className="space-y-2">
                  {PLAN_FEATURES[p].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleNext} size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
          Continue → Checkout
        </Button>
      </div>
    </DealerJourneyLayout>
  );
};

export default Step3Pricing;
