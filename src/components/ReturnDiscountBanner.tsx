import React, { useState, useEffect } from 'react';
import { X, Gift, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface ReturnDiscountBannerProps {
  firstPurchaseDate: string | null;
  customerEmail: string | null;
  onDismiss?: () => void;
}

export const ReturnDiscountBanner: React.FC<ReturnDiscountBannerProps> = ({ 
  firstPurchaseDate,
  customerEmail,
  onDismiss 
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check minimized state from localStorage
    const minimized = localStorage.getItem('returnDiscountBanner_minimized') === 'true';
    setIsMinimized(minimized);

    // Check if discount was already used
    const discountUsed = localStorage.getItem('returnDiscount_used') === 'true';
    
    if (!firstPurchaseDate || discountUsed) {
      setIsEligible(false);
      return;
    }

    // Calculate if within 30 days
    const purchaseDate = new Date(firstPurchaseDate);
    const now = new Date();
    const diffTime = now.getTime() - purchaseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const remaining = 30 - diffDays;

    if (remaining > 0) {
      setIsEligible(true);
      setDaysRemaining(remaining);
      
      // Generate or retrieve discount code
      const storedCode = localStorage.getItem('returnDiscount_code');
      if (storedCode) {
        setDiscountCode(storedCode);
      } else {
        createDiscountCode();
      }
    } else {
      setIsEligible(false);
    }
  }, [firstPurchaseDate]);

  const createDiscountCode = async () => {
    try {
      // Create a unique return discount code
      const code = `RETURN20-${Date.now().toString(36).toUpperCase()}`;
      
      // Store in Supabase
      const validFrom = new Date();
      const validTo = new Date();
      validTo.setDate(validTo.getDate() + daysRemaining);

      const { error } = await supabase.functions.invoke('create-discount-code', {
        body: {
          code,
          type: 'percentage',
          value: 20,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          usageLimit: 1,
          applicableProducts: ['all'],
          active: true,
          campaignSource: 'return_customer'
        }
      });

      if (!error) {
        setDiscountCode(code);
        localStorage.setItem('returnDiscount_code', code);
      }
    } catch (error) {
      console.error('Error creating discount code:', error);
    }
  };

  const handleMinimize = () => {
    localStorage.setItem('returnDiscountBanner_minimized', 'true');
    setIsMinimized(true);
    onDismiss?.();
  };

  const handleExpand = () => {
    localStorage.setItem('returnDiscountBanner_minimized', 'false');
    setIsMinimized(false);
  };

  const handleGetDiscount = () => {
    // Store code in localStorage for auto-apply if available
    if (discountCode) {
      localStorage.setItem('autoApplyDiscountCode', discountCode);
    }
    // Always navigate to homepage to create new order
    navigate('/');
  };

  if (!isEligible) {
    return null;
  }

  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={handleExpand}
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg rounded-full px-4 py-3 flex items-center gap-2"
        >
          <Gift className="h-4 w-4" />
          <span className="font-semibold">20% Off Available</span>
        </Button>
      </div>
    );
  }

  // Full banner view
  return (
    <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 relative animate-in slide-in-from-top duration-500 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-3 flex-1">
          <Gift className="h-8 w-8 flex-shrink-0" />
          <div>
            <p className="font-bold text-lg">Got Another Vehicle?</p>
            <p className="text-sm text-orange-100">
              Enjoy 20% off your next warranty — offer ends in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}.
            </p>
            {discountCode && (
              <p className="text-xs text-orange-100 mt-1">
                Code: <span className="font-mono font-semibold">{discountCode}</span>
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleGetDiscount}
            variant="secondary"
            size="sm"
            className="bg-white text-orange-600 hover:bg-orange-50 font-semibold"
          >
            Buy Now
          </Button>
          <Button
            onClick={handleMinimize}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-orange-700 h-8 w-8"
            title="Minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
