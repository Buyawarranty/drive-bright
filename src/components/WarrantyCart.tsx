import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, ShoppingCart, ArrowRight, ArrowLeft, CheckCircle, Info, AlertCircle, CreditCard } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { getWarrantyDurationDisplay } from '@/lib/warrantyDurationUtils';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

interface WarrantyCartProps {
  onAddMore: () => void;
  onProceedToCheckout: (items: any[]) => void;
}

const WarrantyCart: React.FC<WarrantyCartProps> = ({ onAddMore, onProceedToCheckout }) => {
  const { items, removeFromCart, clearCart, getTotalPrice, getItemCount } = useCart();
  const navigate = useNavigate();
  const [discountCode, setDiscountCode] = useState('');
  const [showDiscountInfo, setShowDiscountInfo] = useState(false);
  const [discountValidation, setDiscountValidation] = useState<{
    valid: boolean;
    message: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);

  if (items.length === 0) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
          <p className="text-gray-600 mb-6">Add your first warranty to get started</p>
          <Button onClick={onAddMore} className="bg-blue-600 hover:bg-blue-700 text-white">
            Add Your First Warranty
          </Button>
        </div>
      </div>
    );
  }

  const subtotal = getTotalPrice();
  const multiWarrantyDiscount = getItemCount() >= 2 ? subtotal * 0.1 : 0; // 10% multi-warranty discount
  const additionalDiscount = discountValidation?.valid ? discountValidation.discountAmount : 0;
  const totalDiscountAmount = multiWarrantyDiscount + additionalDiscount;
  const finalTotal = subtotal - totalDiscountAmount;

  // Debug logging
  console.log('WarrantyCart Debug:', {
    itemCount: getItemCount(),
    subtotal,
    multiWarrantyDiscount,
    additionalDiscount,
    totalDiscountAmount,
    finalTotal,
    items: items.map(item => ({
      id: item.id,
      regNumber: item.vehicleData.regNumber,
      planName: item.planName,
      totalPrice: item.pricingData.totalPrice
    }))
  });

  const handleProceedToCheckout = () => {
    if (items.length === 0) return;
    onProceedToCheckout(items);
  };

  const handleValidateDiscount = async () => {
    if (!discountCode.trim()) return;
    
    // Prevent multiple rapid clicks
    if (validatingDiscount) return;
    
    setValidatingDiscount(true);
    setDiscountValidation(null); // Clear previous validation state
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: {
          code: discountCode.trim(),
          customerEmail: '', // We don't have customer email at this stage
          orderAmount: subtotal
        }
      });

      if (error) {
        console.error('Discount validation error:', error);
        throw error;
      }

      if (data.valid) {
        setDiscountValidation({
          valid: true,
          message: `✓ Discount code "${discountCode.toUpperCase()}" applied successfully!`,
          discountAmount: data.discountAmount,
          finalAmount: data.finalAmount
        });
        toast.success(`Discount applied! You save £${data.discountAmount.toFixed(2)}`);
      } else {
        setDiscountValidation({
          valid: false,
          message: data.error || 'Invalid discount code',
          discountAmount: 0,
          finalAmount: subtotal
        });
        toast.error(data.error || 'Invalid discount code');
      }
    } catch (error) {
      console.error('Discount validation error:', error);
      setDiscountValidation({
        valid: false,
        message: 'Failed to validate discount code. Please try again.',
        discountAmount: 0,
        finalAmount: subtotal
      });
      toast.error('Failed to validate discount code');
    } finally {
      setValidatingDiscount(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Back Button */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <Button variant="outline" onClick={onAddMore} className="mb-0">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plans
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Cart Items */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900">
                Your Warranty Cart ({getItemCount()} {getItemCount() === 1 ? 'item' : 'items'})
              </h1>
              
              {/* Clear Cart Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Cart
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Cart</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove all warranties from your cart? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        clearCart();
                        toast.success('Cart cleared successfully');
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Clear Cart
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
            {/* Multi-warranty discount banner */}
            {getItemCount() >= 2 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">🎉</div>
                  <div>
                    <div className="font-bold text-green-800">Multi-Warranty Discount Applied!</div>
                    <div className="text-green-700">You're saving 10% by purchasing multiple warranties together. Smart choice!</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {items.map((item, index) => (
                <div key={item.id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Vehicle Registration */}
                      <div className="flex items-center mb-4">
                        <div className="inline-flex items-center bg-[#ffdb00] text-gray-900 font-bold text-lg px-4 py-3 rounded-[6px] shadow-sm leading-tight border-2 border-black">
                          <div className="font-bold font-sans tracking-normal">
                            {item.vehicleData.regNumber}
                          </div>
                        </div>
                      </div>

                      {/* Plan Details */}
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Plan:</span>
                          <span className="font-semibold">{item.planName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cover period:</span>
                          <span className="font-semibold">{getWarrantyDurationDisplay(item.paymentType)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Voluntary Excess:</span>
                          <span className="font-semibold">£{item.pricingData.voluntaryExcess}</span>
                        </div>
                      </div>

                      {/* Add-ons */}
                      {Object.entries(item.pricingData.selectedAddOns).some(([_, selected]) => selected) && (
                        <div className="mt-4">
                          <div className="text-sm font-medium text-gray-700 mb-2">Add-ons:</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(item.pricingData.selectedAddOns).map(([addon, selected]) => {
                              if (!selected) return null;
                              
                              const addOnNames: {[key: string]: string} = {
                                'tyre': 'Tyre Cover',
                                'wearTear': 'Wear & Tear',
                                'european': 'European Cover',
                                'breakdown': 'Breakdown Recovery',
                                'rental': 'Vehicle Rental',
                                'transfer': 'Transfer Cover'
                              };
                              
                              return (
                                <Badge key={addon} variant="secondary" className="text-xs">
                                  {addOnNames[addon] || addon}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-right ml-4">
                      {/* Monthly Payment Display */}
                      <div className="text-green-600 font-medium mb-1">
                        Payment: £{item.pricingData.monthlyPrice} x 12 monthly payments
                      </div>
                      
                      <div className="text-2xl font-bold text-blue-600 mb-2">
                        £{item.pricingData.totalPrice}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          removeFromCart(item.id);
                          toast.success('Item removed from cart');
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Another Warranty - Redesigned */}
            <div className="mt-6 space-y-4">
              {/* Add Another Warranty Button */}
              <Button
                onClick={onAddMore}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 text-lg rounded-lg flex items-center justify-center gap-3"
                size="lg"
              >
                <Plus className="w-5 h-5" />
                Add Another Warranty
              </Button>
              
              {/* Limited-Time Offer Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 rounded-full p-3 flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">🔥</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      🛡️ Exclusive 10% Discount — Limited Time!
                    </h3>
                    <p className="text-gray-700 mb-3">
                      Protect another vehicle now and save 10% on your entire order instantly.
                    </p>
                    <p className="text-gray-600 text-sm font-medium">
                      This special offer expires at checkout — secure your savings today!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="space-y-6">
            {/* Order Summary Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-6">Order Summary</h1>
              
              {/* Confidence Message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center text-green-800 font-medium">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Shop with confidence - cancel anytime within 14 days for a full refund 💸
                </div>
              </div>
              
                <div className="space-y-4 mb-6">
                  {items.map((item, index) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-gray-600">Warranty {index + 1} ({item.planName}):</span>
                      <span className="font-semibold">£{item.pricingData.totalPrice}</span>
                    </div>
                  ))}
                </div>

              {/* Payment Summary */}
              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold">£{Math.round(subtotal)}</span>
                  </div>
                  
                  {getItemCount() >= 2 && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="text-sm">Multi-warranty discount (10%):</span>
                      <span className="text-sm font-medium">-£{Math.round(multiWarrantyDiscount)}</span>
                    </div>
                  )}
                  
                  {discountValidation && discountValidation.valid && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="text-sm">Discount code applied:</span>
                      <span className="text-sm font-medium">-£{discountValidation.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="font-semibold text-gray-900">Total Price:</span>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        £{Math.round(finalTotal)} for entire cover period
                      </div>
                    </div>
                  </div>
                </div>

                {/* Discount Code Section */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Discount Code</h4>
                    <Collapsible open={showDiscountInfo} onOpenChange={setShowDiscountInfo}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-auto">
                          <Info className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                          <p>Enter a valid discount code to get money off your warranty. The discount will be applied to your final total.</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter discount code"
                      value={discountCode}
                      onChange={(e) => {
                        setDiscountCode(e.target.value);
                        // Clear validation when code changes
                        if (discountValidation) {
                          setDiscountValidation(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && discountCode.trim() && !validatingDiscount) {
                          handleValidateDiscount();
                        }
                      }}
                      className="flex-1"
                      disabled={discountValidation?.valid}
                    />
                    <Button 
                      type="button" 
                      variant={discountValidation?.valid ? "default" : "outline"}
                      onClick={handleValidateDiscount}
                      disabled={!discountCode.trim() || validatingDiscount || discountValidation?.valid}
                      className={discountValidation?.valid ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {validatingDiscount ? 'Validating...' : discountValidation?.valid ? '✓ Applied' : 'Apply'}
                    </Button>
                  </div>
                  
                  {discountValidation && (
                    <div className={`text-sm px-3 py-2 rounded-md mt-2 ${
                      discountValidation.valid 
                        ? 'bg-green-50 text-green-800 border-2 border-green-500 font-medium' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {discountValidation.valid ? 
                            <CheckCircle className="w-4 h-4 text-green-600" /> : 
                            <AlertCircle className="w-4 h-4" />
                          }
                          {discountValidation.message}
                        </div>
                        {discountValidation.valid && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDiscountValidation(null);
                              setDiscountCode('');
                            }}
                            className="text-xs h-auto py-1 px-2"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleProceedToCheckout}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-4 text-lg rounded-lg"
                  size="lg"
                >
                  Proceed to Checkout
                </Button>
                
              </div>

              <div className="text-center mt-4 text-sm text-gray-500 flex items-center justify-center gap-2">
                <CreditCard size={16} className="text-blue-600" />
                Secure checkout powered by Stripe
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarrantyCart;