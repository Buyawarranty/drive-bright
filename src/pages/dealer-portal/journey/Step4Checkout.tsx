import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DealerJourneyLayout } from '@/components/dealer/journey/DealerJourneyLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDealerJourney, DEALER_PLAN_LABELS } from '@/contexts/DealerJourneyContext';
import { useDealerAuth } from '@/hooks/useDealerAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard, FileText } from 'lucide-react';

const Step4Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { dealer } = useDealerAuth();
  const { vehicle, customer, plan, discount_pct } = useDealerJourney();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState<null | 'pay' | 'invoice'>(null);

  useEffect(() => {
    if (!vehicle) navigate('/dealer-portal/quote/vehicle', { replace: true });
    else if (!customer) navigate('/dealer-portal/quote/customer', { replace: true });
    else if (!plan) navigate('/dealer-portal/quote/pricing', { replace: true });
  }, [vehicle, customer, plan, navigate]);

  if (!vehicle || !customer || !plan || !dealer) return null;

  const submit = async (paymentMethod: 'pay_now' | 'invoice') => {
    setSubmitting(paymentMethod === 'pay_now' ? 'pay' : 'invoice');
    try {
      const { data, error } = await supabase.functions.invoke('dealer-create-checkout', {
        body: {
          dealer_id: dealer.id,
          payment_method: paymentMethod,
          vehicle,
          customer,
          plan,
          discount_pct,
        },
      });

      if (error) throw error;

      if (paymentMethod === 'pay_now') {
        if (data?.checkout_url) {
          window.location.href = data.checkout_url;
          return;
        }
        throw new Error('No Stripe checkout URL returned');
      }

      // Invoice path → straight to confirmation
      if (data?.customer_id) {
        navigate(`/dealer-portal/quote/confirmation?id=${data.customer_id}&method=invoice`);
        return;
      }
      throw new Error('Order creation failed');
    } catch (err: any) {
      console.error('Dealer checkout error', err);
      toast({
        title: 'Checkout failed',
        description: err?.message || 'Please try again',
        variant: 'destructive',
      });
      setSubmitting(null);
    }
  };

  return (
    <DealerJourneyLayout step={4} title="Review & checkout" subtitle="Confirm the order and choose how you'd like to pay.">
      {/* Summary */}
      <Card className="bg-gray-900 border-gray-800 mb-6">
        <CardContent className="pt-6 space-y-4">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Vehicle</h3>
            <p className="text-white font-semibold">
              {vehicle.reg} {vehicle.make ? `· ${vehicle.make}` : ''} {vehicle.model || ''}
            </p>
            <p className="text-sm text-gray-400">{vehicle.year ? `${vehicle.year} · ` : ''}{vehicle.mileage} miles</p>
          </div>
          <div className="border-t border-gray-800 pt-4">
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Customer</h3>
            <p className="text-white font-semibold">{customer.name}</p>
            <p className="text-sm text-gray-400">{customer.email} · {customer.phone}</p>
            <p className="text-sm text-gray-400">{customer.address_line1}, {customer.town}, {customer.postcode}</p>
          </div>
          <div className="border-t border-gray-800 pt-4">
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Plan</h3>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white font-semibold">{DEALER_PLAN_LABELS[plan.plan_type]} · {plan.duration_months} months</p>
                {discount_pct > 0 && (
                  <p className="text-xs text-gray-500 line-through">Retail £{plan.retail_price.toFixed(2)}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">£{plan.dealer_price.toFixed(2)}</p>
                {discount_pct > 0 && (
                  <p className="text-xs text-orange-400 font-semibold">{discount_pct}% dealer discount applied</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <CreditCard className="h-6 w-6 text-orange-500 mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Pay now</h3>
            <p className="text-sm text-gray-400 mb-4">Card payment via Stripe. Warranty activates instantly.</p>
            <Button
              onClick={() => submit('pay_now')}
              disabled={submitting !== null}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {submitting === 'pay' ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay £${plan.dealer_price.toFixed(2)}`}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <FileText className="h-6 w-6 text-amber-400 mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Add to monthly invoice</h3>
            <p className="text-sm text-gray-400 mb-4">No card needed. We'll bill it on your next invoice.</p>
            <Button
              onClick={() => submit('invoice')}
              disabled={submitting !== null}
              variant="outline"
              className="w-full border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
            >
              {submitting === 'invoice' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add to invoice'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DealerJourneyLayout>
  );
};

export default Step4Checkout;
