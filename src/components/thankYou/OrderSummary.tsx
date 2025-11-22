import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Calendar } from 'lucide-react';

interface OrderSummaryProps {
  plan?: string;
  paymentType?: string;
  warrantyStartDate?: string;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  plan,
  paymentType,
  warrantyStartDate
}) => {
  const formatDate = (date: string | undefined): string => {
    if (!date) {
      const today = new Date();
      return today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <Card className="border border-border shadow-sm bg-background">
      <CardContent className="p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          Your Order Summary
        </h2>
        
        <div className="space-y-4">
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
            <Calendar className="w-5 h-5 text-primary" />
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
