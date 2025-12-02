import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Calendar, CheckCircle2 } from 'lucide-react';

interface OrderSummaryProps {
  plan?: string;
  paymentType?: string;
  warrantyStartDate?: string;
  duration?: string;
  monthlyPrice?: number;
  totalPrice?: number;
  originalPrice?: number;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  plan,
  paymentType,
  warrantyStartDate,
  duration,
  monthlyPrice,
  totalPrice,
  originalPrice
}) => {
  const formatDate = (date: string | undefined): string => {
    if (!date) {
      const today = new Date();
      return today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Parse duration to get years
  const durationYears = duration ? parseInt(duration.replace(/[^\d]/g, '')) : 1;
  const hasSavings = originalPrice && totalPrice && originalPrice > totalPrice;
  const savings = hasSavings ? originalPrice - totalPrice : 0;

  return (
    <Card className="border border-border shadow-sm bg-background">
      <CardContent className="p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          Order Summary
        </h2>
        
        <div className="space-y-6">
          {/* Payment Breakdown Section */}
          {monthlyPrice && totalPrice && (
            <div className="bg-gray-50 rounded-lg p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Your Warranty Plan</p>
                  <p className="text-base font-medium text-foreground">
                    Includes: {durationYears === 1 ? '12 months' : `${durationYears} years`} cover
                  </p>
                </div>
                <div className="text-right">
                  {hasSavings && (
                    <p className="text-sm text-muted-foreground line-through">£{originalPrice}</p>
                  )}
                  <p className="text-2xl font-bold text-foreground">£{totalPrice}</p>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-2 pt-3 border-t border-gray-200">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">
                    {paymentType === 'Monthly' ? (
                      <span>£{monthlyPrice}/month</span>
                    ) : (
                      <span>Only 12 easy payments</span>
                    )}
                  </p>
                </div>
                
                {durationYears > 1 && paymentType === 'Monthly' && (
                  <>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground">
                        Only 12 easy payments
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground">
                        Nothing to pay in Year {durationYears === 2 ? '2' : '2 and 3'}
                      </p>
                    </div>
                  </>
                )}

                {hasSavings && (
                  <div className="pt-2 mt-2 border-t border-gray-200">
                    <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2">
                      <p className="text-sm font-semibold text-green-700">
                        You save £{savings}!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Original Product Details */}
          <div className="flex justify-between items-start pb-4 border-b border-border">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Product</p>
              <p className="text-base md:text-lg font-semibold text-foreground">
                {plan ? `${plan} Warranty` : 'Comprehensive Warranty'}
                {paymentType && ` – ${paymentType}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Warranty Start Date</p>
              <p className="text-base font-semibold text-foreground">
                {formatDate(warrantyStartDate)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
