import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CreditCard, CheckCircle, AlertCircle, Plus, Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CartItem } from '@/contexts/CartContext';
import { trackFormSubmission, trackConversion, trackEvent } from '@/utils/analytics';
import { getAddOnInfo, isAddOnAutoIncluded, normalizePaymentType } from '@/lib/addOnsUtils';

interface MultiWarrantyCheckoutProps {
  items: CartItem[];
  onBack: () => void;
  onAddAnother?: () => void;
}

const MultiWarrantyCheckout: React.FC<MultiWarrantyCheckoutProps> = ({ items, onBack, onAddAnother }) => {
  const [customerData, setCustomerData] = useState(() => {
    try {
      const saved = localStorage.getItem('multiWarrantyCheckoutData');
      if (saved) {
        console.log('✅ Restored checkout data from localStorage');
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('❌ Failed to restore checkout data (iOS/Safari):', error);
    }
    return {
      first_name: '',
      last_name: '',
      email: '',
      mobile: '',
      flat_number: '',
      building_name: '',
      building_number: '',
      street: '',
      town: '',
      county: '',
      postcode: '',
      country: 'United Kingdom',
      discount_code: ''
    };
  });

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [showValidation, setShowValidation] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'stripe' | 'bumper'>(() => {
    try {
      const saved = localStorage.getItem('multiWarrantyPaymentMethod');
      return (saved as 'stripe' | 'bumper') || 'stripe';
    } catch (error) {
      console.error('❌ Failed to restore payment method:', error);
      return 'stripe';
    }
  });
  const [discountValidation, setDiscountValidation] = useState<{
    valid: boolean;
    message: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('multiWarrantyDiscountValidation');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('❌ Failed to restore discount validation:', error);
      return null;
    }
  });

  // Calculate total price
  const totalPrice = items.reduce((sum, item) => sum + item.pricingData.totalPrice, 0);
  const subtotalAfterMultiDiscount = totalPrice;
  const finalPrice = discountValidation ? (subtotalAfterMultiDiscount - discountValidation.discountAmount) : subtotalAfterMultiDiscount;
  
  console.log('MultiWarrantyCheckout Debug:', {
    itemsCount: items.length,
    totalPrice,
    subtotalAfterMultiDiscount,
    finalPrice,
    discountValidation,
    items: items.map(item => ({
      id: item.id,
      regNumber: item.vehicleData.regNumber,
      planName: item.planName,
      totalPrice: item.pricingData.totalPrice
    }))
  });

  // Show error if cart is empty after restoration attempt
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle />
              Cart Empty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">Your cart appears to be empty. This may happen if:</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Your session expired</li>
              <li>Browser storage is disabled</li>
              <li>You're in private/incognito mode</li>
            </ul>
            <Button onClick={onBack} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Quote
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check for URL discount parameters (existing and return discount)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const discountParam = urlParams.get('discount');
    const discountMessage = urlParams.get('discountMessage');
    const returnDiscount = urlParams.get('returnDiscount');
    
    if (discountParam === '10' || returnDiscount === 'true') {
      const discountAmount = subtotalAfterMultiDiscount * 0.1;
      const finalAmount = subtotalAfterMultiDiscount - discountAmount;
      
      setDiscountValidation({
        valid: true,
        message: returnDiscount === 'true' 
          ? '10% Off 2nd Purchase - Automatically Applied!'
          : (discountMessage || 'Your 10% discount has been applied!'),
        discountAmount: discountAmount,
        finalAmount: finalAmount
      });
      
      setCustomerData(prev => ({ ...prev, discount_code: returnDiscount === 'true' ? 'RETURN10' : '10OFF' }));
      
      if (!discountValidation) {
        toast.success(returnDiscount === 'true' ? '10% return discount applied!' : '10% discount automatically applied!');
      }
    }
  }, [totalPrice]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('multiWarrantyCheckoutData', JSON.stringify(customerData));
    } catch (error) {
      console.error('❌ Failed to save checkout data:', error);
    }
  }, [customerData]);

  // Save payment method to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('multiWarrantyPaymentMethod', selectedPaymentMethod);
    } catch (error) {
      console.error('❌ Failed to save payment method:', error);
    }
  }, [selectedPaymentMethod]);

  // Save discount validation to localStorage whenever it changes
  useEffect(() => {
    try {
      if (discountValidation) {
        localStorage.setItem('multiWarrantyDiscountValidation', JSON.stringify(discountValidation));
      } else {
        localStorage.removeItem('multiWarrantyDiscountValidation');
      }
    } catch (error) {
      console.error('❌ Failed to save discount validation:', error);
    }
  }, [discountValidation]);

  // Handle page visibility, popstate, and pageshow to detect when user returns from payment gateway
  useEffect(() => {
    // Reset loading state on mount (in case user returned via back button)
    setLoading(false);
    
    // iOS-specific: Restore data immediately on mount
    try {
      const savedData = localStorage.getItem('multiWarrantyCheckoutData');
      const savedDiscount = localStorage.getItem('multiWarrantyDiscountValidation');
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setCustomerData(parsed);
        console.log('✅ iOS: Restored customer data on mount');
      }
      if (savedDiscount) {
        setDiscountValidation(JSON.parse(savedDiscount));
        console.log('✅ iOS: Restored discount validation on mount');
      }
    } catch (error) {
      console.error('❌ iOS restoration error:', error);
    }
    
    const handleVisibilityChange = () => {
      try {
        if (!document.hidden) {
          // User returned to the page - restore data from localStorage
          console.log('✅ User returned to checkout page (visibility) - restoring data');
          const savedData = localStorage.getItem('multiWarrantyCheckoutData');
          const savedDiscount = localStorage.getItem('multiWarrantyDiscountValidation');
          
          if (savedData) {
            const parsed = JSON.parse(savedData);
            setCustomerData(parsed);
            console.log('Restored customer data:', parsed);
          }
          if (savedDiscount) {
            setDiscountValidation(JSON.parse(savedDiscount));
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Visibility change error:', error);
        setLoading(false);
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      try {
        // Handles back button navigation from payment gateway
        console.log('✅ Page shown (pageshow) - restoring data, persisted:', event.persisted);
        const savedData = localStorage.getItem('multiWarrantyCheckoutData');
        const savedDiscount = localStorage.getItem('multiWarrantyDiscountValidation');
        
        if (savedData) {
          const parsed = JSON.parse(savedData);
          setCustomerData(parsed);
          console.log('Restored customer data from pageshow');
        }
        if (savedDiscount) {
          setDiscountValidation(JSON.parse(savedDiscount));
        }
        setLoading(false);
      } catch (error) {
        console.error('❌ Pageshow error:', error);
        setLoading(false);
      }
    };

    const handlePopState = (event: PopStateEvent) => {
      try {
        // User clicked back button - restore data
        console.log('✅ Back button detected (popstate) - restoring data');
        const savedData = localStorage.getItem('multiWarrantyCheckoutData');
        const savedDiscount = localStorage.getItem('multiWarrantyDiscountValidation');
        
        if (savedData) {
          const parsed = JSON.parse(savedData);
          setCustomerData(parsed);
        }
        if (savedDiscount) {
          setDiscountValidation(JSON.parse(savedDiscount));
        }
        setLoading(false);
      } catch (error) {
        console.error('❌ Popstate error:', error);
        setLoading(false);
      }
    };

    // iOS Safari compatibility: Use passive listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePopState);
    
    // iOS fallback: Also listen for focus events
    const handleFocus = () => {
      try {
        console.log('✅ Window focused - checking for restored data');
        const savedData = localStorage.getItem('multiWarrantyCheckoutData');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          setCustomerData(parsed);
        }
        setLoading(false);
      } catch (error) {
        console.error('❌ Focus event error:', error);
      }
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Total price calculation moved up

  const handleInputChange = (field: string, value: string) => {
    setCustomerData(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateFields = () => {
    const errors: {[key: string]: string} = {};
    
    if (!customerData.first_name.trim()) errors.first_name = 'First name is required';
    if (!customerData.last_name.trim()) errors.last_name = 'Last name is required';
    if (!customerData.email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(customerData.email)) errors.email = 'Email format is invalid';
    if (!customerData.mobile.trim()) errors.mobile = 'Mobile number is required';
    if (!customerData.street.trim()) errors.street = 'Address is required';
    if (!customerData.town.trim()) errors.town = 'Town/City is required';
    if (!customerData.postcode.trim()) errors.postcode = 'Postcode is required';
    
    return errors;
  };

  const handleValidateDiscount = async () => {
    if (!customerData.discount_code.trim()) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: {
          code: customerData.discount_code,
          customerEmail: customerData.email,
          orderAmount: subtotalAfterMultiDiscount
        }
      });

      if (error) throw error;

      if (data.valid) {
        setDiscountValidation({
          valid: true,
          message: `Discount applied! You save £${data.discountAmount.toFixed(2)}`,
          discountAmount: data.discountAmount,
          finalAmount: data.finalAmount
        });
        toast.success(`Discount applied! You save £${data.discountAmount.toFixed(2)}`);
      } else {
        setDiscountValidation({
          valid: false,
          message: data.error || 'Invalid discount code',
          discountAmount: 0,
          finalAmount: subtotalAfterMultiDiscount
        });
        toast.error(data.error || 'Invalid discount code');
      }
    } catch (error) {
      console.error('Discount validation error:', error);
      setDiscountValidation({
        valid: false,
        message: 'Failed to validate discount code',
        discountAmount: 0,
        finalAmount: subtotalAfterMultiDiscount
      });
      toast.error('Failed to validate discount code');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔴 CHECKOUT BUTTON CLICKED - Payment method:', selectedPaymentMethod);
    
    // Track abandoned cart for multi-warranty BEFORE validation
    try {
      // Track each item as a separate potential abandoned cart
      for (const item of items) {
        await supabase.functions.invoke('track-abandoned-cart', {
          body: {
            email: customerData.email || '',
            full_name: `${customerData.first_name} ${customerData.last_name}`.trim(),
            phone: customerData.mobile || null,
            vehicle_reg: item.vehicleData.regNumber || null,
            vehicle_make: item.vehicleData.make || null,
            vehicle_model: item.vehicleData.model || null,
            vehicle_year: item.vehicleData.year || null,
            mileage: item.vehicleData.mileage || null,
            plan_id: item.planId || null,
            plan_name: item.planName || null,
            payment_type: item.paymentType || null,
            vehicle_type: item.vehicleData.vehicleType || 'car',
            step_abandoned: 4,
            // Pricing details
            total_price: item.pricingData.totalPrice || 0,
            voluntary_excess: item.pricingData.voluntaryExcess || 0,
            claim_limit: item.pricingData.claimLimit || 1250,
            // Address for contact
            address: {
              flat_number: customerData.flat_number || '',
              building_name: customerData.building_name || '',
              building_number: customerData.building_number || '',
              street: customerData.street || '',
              town: customerData.town || '',
              county: customerData.county || '',
              postcode: customerData.postcode || '',
              country: customerData.country || 'United Kingdom'
            },
            // Protection add-ons
            protection_addons: item.pricingData.selectedAddOns || {}
          }
        });
      }
      console.log('✅ Multi-warranty abandoned carts tracked with full details');
    } catch (error) {
      console.error('Failed to track abandoned carts:', error);
      // Don't block checkout if tracking fails
    }
    
    setShowValidation(true);
    
    // Track checkout attempt
    trackEvent('checkout_start', {
      payment_method: selectedPaymentMethod,
      item_count: items.length,
      total_value: totalPrice
    });
    
    const errors = validateFields();
    console.log('🔍 Form validation results:', { errors, fieldCount: Object.keys(errors).length });
    setFieldErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      console.error('❌ Form validation failed with errors:', errors);
      toast.error('Please complete all required fields correctly');
      trackEvent('checkout_error', { error_type: 'validation_failed' });
      return;
    }

    // Explicitly save all data before redirect to ensure persistence (iOS-safe)
    try {
      localStorage.setItem('multiWarrantyCheckoutData', JSON.stringify(customerData));
      localStorage.setItem('multiWarrantyPaymentMethod', selectedPaymentMethod);
      if (discountValidation) {
        localStorage.setItem('multiWarrantyDiscountValidation', JSON.stringify(discountValidation));
      }
      console.log('✅ All checkout data saved before redirect');
    } catch (error) {
      console.error('❌ Failed to save data before redirect (iOS):', error);
      toast.error('Unable to save your information. Please check your browser settings.');
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      console.log('💳 Processing checkout with payment method:', selectedPaymentMethod);
      console.log('📊 Checkout summary:', {
        totalItems: items.length,
        totalPrice,
        finalPrice,
        discountApplied: discountValidation?.valid,
        discountAmount: discountValidation?.discountAmount
      });
      
      if (selectedPaymentMethod === 'bumper') {
        console.log('🚀 Starting Bumper checkout process');
        console.log('📋 Items to process:', items.map(item => ({
          planName: item.planName,
          regNumber: item.vehicleData.regNumber,
          totalPrice: item.pricingData.totalPrice,
          hasProtectionAddOns: !!item.pricingData.selectedAddOns
        })));
        console.log('👤 Customer data:', {
          name: `${customerData.first_name} ${customerData.last_name}`,
          email: customerData.email,
          phone: customerData.mobile,
          hasAddress: !!(customerData.street && customerData.postcode)
        });
        console.log('💰 Pricing:', {
          totalPrice,
          finalPrice,
          discount: discountValidation?.discountAmount || 0
        });
        
        // Try Bumper first for multi-warranty checkout
        const { data, error } = await supabase.functions.invoke('create-multi-warranty-bumper-checkout', {
          body: {
            items: items.map(item => ({
              planName: item.planName.toLowerCase(),
              paymentType: item.paymentType,
              claimLimit: item.pricingData.claimLimit,
              voluntaryExcess: item.pricingData.voluntaryExcess,
              vehicleData: item.vehicleData,
              selectedAddOns: item.pricingData.selectedAddOns,
              protectionAddOns: {
                tyre: item.pricingData.selectedAddOns?.tyre || false,
                wearTear: item.pricingData.selectedAddOns?.wearTear || false,
                european: item.pricingData.selectedAddOns?.european || false,
                breakdown: item.pricingData.selectedAddOns?.breakdown || false,
                rental: item.pricingData.selectedAddOns?.rental || false,
                transfer: item.pricingData.selectedAddOns?.transfer || false,
                motRepair: item.pricingData.selectedAddOns?.motRepair || false,
                motFee: item.pricingData.selectedAddOns?.motFee || false,
                lostKey: item.pricingData.selectedAddOns?.lostKey || false,
                consequential: item.pricingData.selectedAddOns?.consequential || false
              },
              totalPrice: item.pricingData.totalPrice
            })),
            customerData: customerData,
            discountCode: customerData.discount_code || null,
            originalAmount: totalPrice,
            finalAmount: finalPrice
          }
        });

        console.log('🔍 Bumper API Response:', { data, error });

        if (error) {
          console.error('❌ Bumper function error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          toast.error(`Payment processing failed: ${error.message || 'Please try again'}`);
          setLoading(false);
          return;
        }

        if (data.fallbackToStripe) {
          // If Bumper failed, show user-friendly message and let them choose
          console.log('🔄 Bumper fallback detected:', data.fallbackReason);
          console.log('🔍 Full Bumper response data:', data);
          
          const fallbackMessages = {
            missing_credentials: 'Monthly Interest-Free Credit is temporarily unavailable. Please try again or use card payment.',
            no_customer_data: 'Unable to process monthly payments. Please try again or use card payment.',
            credit_check_failed: 'Your credit application was not approved. Please use card payment instead.',
            error: 'Monthly Interest-Free Credit is temporarily unavailable. Please try again or use card payment.'
          };
          
          const message = fallbackMessages[data.fallbackReason] || fallbackMessages.error;
          
          // For debugging - show the actual fallback reason to help identify the issue
          console.error('❌ Bumper checkout failed with reason:', data.fallbackReason);
          
          toast.error(message, {
            duration: 8000,
            action: {
              label: 'Use Card Payment',
              onClick: () => {
                // Switch to Stripe payment method
                setSelectedPaymentMethod('stripe');
                toast.dismiss();
              }
            }
          });
          
          setLoading(false);
          return; // Don't automatically process - let user choose
        } else if (data.url) {
          console.log('✅ Bumper checkout URL received:', data.url);
          // Track successful checkout redirect to Bumper
          trackConversion('checkout_redirect', finalPrice);
          trackEvent('payment_redirect', { 
            method: 'bumper', 
            amount: finalPrice,
            item_count: items.length 
          });
          
          // Mark return discount as used if applicable
          if (customerData.discount_code === 'RETURN10') {
            localStorage.setItem('returnDiscount_used', 'true');
          }
          
          // Redirect to Bumper checkout
          window.location.href = data.url;
        } else {
          console.error('❌ No URL received from Bumper:', data);
          toast.error('Failed to create Bumper checkout session - no redirect URL received');
        }
      } else {
        // Create Stripe multi-warranty checkout with 5% discount
        const stripeDiscountedPrice = Math.round(finalPrice * 0.95);
        const { data, error } = await supabase.functions.invoke('create-multi-warranty-checkout', {
          body: {
            items: items.map(item => ({
              planName: item.planName.toLowerCase(),
              paymentType: item.paymentType,
              claimLimit: item.pricingData.claimLimit,
              voluntaryExcess: item.pricingData.voluntaryExcess,
              vehicleData: item.vehicleData,
              selectedAddOns: item.pricingData.selectedAddOns,
            protectionAddOns: {
              tyre: item.pricingData.selectedAddOns?.tyre || false,
              wearTear: item.pricingData.selectedAddOns?.wearTear || false,
              european: item.pricingData.selectedAddOns?.european || false,
              breakdown: item.pricingData.selectedAddOns?.breakdown || false,
              rental: item.pricingData.selectedAddOns?.rental || false,
              transfer: item.pricingData.selectedAddOns?.transfer || false,
              motRepair: item.pricingData.selectedAddOns?.motRepair || false,
              motFee: item.pricingData.selectedAddOns?.motFee || false,
              lostKey: item.pricingData.selectedAddOns?.lostKey || false,
              consequential: item.pricingData.selectedAddOns?.consequential || false
            },
              totalPrice: item.pricingData.totalPrice
            })),
            customerData: customerData,
            discountCode: customerData.discount_code || null,
            originalAmount: totalPrice,
            finalAmount: stripeDiscountedPrice
          }
        });

        if (error) throw error;

        if (data.url) {
          // Track successful checkout redirect to Stripe
          trackConversion('checkout_redirect', stripeDiscountedPrice);
          trackEvent('payment_redirect', { 
            method: 'stripe_direct', 
            amount: stripeDiscountedPrice,
            item_count: items.length 
          });
          
          // Mark return discount as used if applicable
          if (customerData.discount_code === 'RETURN10') {
            localStorage.setItem('returnDiscount_used', 'true');
          }
          
          // Redirect to Stripe checkout
          window.location.href = data.url;
        } else {
          toast.error('Failed to create checkout session');
        }
      }
    } catch (error) {
      console.error('Multi-warranty checkout error:', error);
      toast.error('Failed to proceed to checkout');
    } finally {
      setLoading(false);
    }
  };

  const formatVehicleDisplay = (item: CartItem) => {
    const { vehicleData } = item;
    if (vehicleData.make && vehicleData.model) {
      return `${vehicleData.year || ''} ${vehicleData.make} ${vehicleData.model}`.trim();
    }
    return vehicleData.regNumber;
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Back Button */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <Button variant="outline" onClick={onBack} className="mb-0">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cart
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Personal Details Form */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Personal Details</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">First Name *</Label>
                  <Input
                    id="first_name"
                    placeholder="Enter first name"
                    value={customerData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    required
                    className={`mt-1 ${fieldErrors.first_name ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.first_name && (
                    <p className="text-red-500 text-sm mt-1">{fieldErrors.first_name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">Last Name *</Label>
                  <Input
                    id="last_name"
                    placeholder="Enter last name"
                    value={customerData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    required
                    className={`mt-1 ${fieldErrors.last_name ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.last_name && (
                    <p className="text-red-500 text-sm mt-1">{fieldErrors.last_name}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={customerData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  className={`mt-1 ${fieldErrors.email ? 'border-red-500' : ''}`}
                />
                {fieldErrors.email && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>
                )}
              </div>

              {/* Mobile */}
              <div>
                <Label htmlFor="mobile" className="text-sm font-medium text-gray-700">Mobile Number *</Label>
                <Input
                  id="mobile"
                  placeholder="Enter mobile number"
                  value={customerData.mobile}
                  onChange={(e) => handleInputChange('mobile', e.target.value)}
                  required
                  className={`mt-1 ${fieldErrors.mobile ? 'border-red-500' : ''}`}
                />
                {fieldErrors.mobile && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.mobile}</p>
                )}
              </div>

              {/* Address Details */}
              <div className="pt-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Address Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="street" className="text-sm font-medium text-gray-700">Address Line 1 *</Label>
                    <Input
                      id="street"
                      placeholder="Street address and house/building number"
                      value={customerData.street}
                      onChange={(e) => handleInputChange('street', e.target.value)}
                      required
                      className={`mt-1 ${fieldErrors.street ? 'border-red-500 focus:border-red-500' : ''}`}
                    />
                    {fieldErrors.street && (
                      <p className="text-red-500 text-sm mt-1">{fieldErrors.street}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="building_name" className="text-sm font-medium text-gray-700">Address Line 2 (optional)</Label>
                    <Input
                      id="building_name"
                      placeholder="Apartment, flat, building name"
                      value={customerData.building_name}
                      onChange={(e) => handleInputChange('building_name', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="town" className="text-sm font-medium text-gray-700">Town/City *</Label>
                      <Input
                        id="town"
                        placeholder="Enter town/city"
                        value={customerData.town}
                        onChange={(e) => handleInputChange('town', e.target.value)}
                        required
                        className={`mt-1 ${fieldErrors.town ? 'border-red-500 focus:border-red-500' : ''}`}
                      />
                      {fieldErrors.town && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.town}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="county" className="text-sm font-medium text-gray-700">County</Label>
                      <Input
                        id="county"
                        placeholder="Enter county"
                        value={customerData.county}
                        onChange={(e) => handleInputChange('county', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="postcode" className="text-sm font-medium text-gray-700">Postcode *</Label>
                    <Input
                      id="postcode"
                      placeholder="Enter postcode"
                      value={customerData.postcode}
                      onChange={(e) => handleInputChange('postcode', e.target.value)}
                      required
                      className={`mt-1 ${fieldErrors.postcode ? 'border-red-500 focus:border-red-500' : ''}`}
                    />
                    {fieldErrors.postcode && (
                      <p className="text-red-500 text-sm mt-1">{fieldErrors.postcode}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Discount Code */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Label htmlFor="discount_code" className="text-sm font-medium text-gray-700 mb-2 block">Discount Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="discount_code"
                    placeholder="Enter discount code"
                    value={customerData.discount_code}
                    onChange={(e) => handleInputChange('discount_code', e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleValidateDiscount}
                    disabled={!customerData.discount_code.trim() || loading}
                    className="px-6"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Complete Your Order Section */}
          <div>
            {/* Header with shield icon */}
            <div className="mb-6 flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-full">
                <div className="w-6 h-6 bg-orange-500 rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">You're almost covered!</h1>
            </div>

            {/* Complete Your Order Card */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gray-800 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  5
                </div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  Complete Your Order
                </h2>
              </div>

              {/* Plan Summary */}
              {items.length > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{items[0].planName} Plan</h3>
                    <p className="text-gray-600">
                      {items[0].paymentType === 'yearly' ? '12 months' : 
                       items[0].paymentType === 'two_yearly' ? '24 months' : '36 months'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-600 text-white px-2 py-1 rounded-l flex items-center gap-1">
                      <span className="text-xs">🇬🇧</span>
                      <span className="text-sm font-medium">UK</span>
                    </div>
                    <div className="bg-yellow-400 text-black px-3 py-1 rounded-r font-bold">
                      {customerData.postcode || 'Enter postcode'}
                    </div>
                    <button 
                      type="button"
                      className="text-orange-500 text-sm font-medium ml-2 hover:underline"
                      onClick={() => {
                        document.getElementById('postcode')?.focus();
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h3>
              
              {/* Discount Alert for Second Purchase */}
              {discountValidation && discountValidation.valid && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-green-600 text-2xl">🎉</div>
                    <div>
                      <h4 className="text-green-800 font-bold text-lg">
                        10% Discount Applied!
                      </h4>
                      <p className="text-green-700">
                        {discountValidation.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Confidence Message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  Shop with confidence - cancel anytime within 14 days for a full refund ✅
                </p>
              </div>
              
              
              {/* Warranty Items */}
              <div className="space-y-8 mb-6">
                {items.map((item, index) => (
                  <div key={item.id}>
                    {/* Warranty Header */}
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-gray-900">Warranty {index + 1}</h2>
                      <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                        {item.planName}
                      </Badge>
                    </div>

                    {/* Vehicle Registration Badge */}
                    <div className="flex justify-center mb-6">
                      <div className="bg-yellow-400 border-2 border-black rounded-lg px-6 py-3 flex items-center gap-3">
                        <span className="text-black font-bold text-lg tracking-wider">
                          {item.vehicleData.regNumber}
                        </span>
                      </div>
                    </div>

                    {/* Plan Details */}
                    <div className="space-y-4 text-base">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Plan:</span>
                        <span className="font-bold text-gray-900">{
                          (() => {
                            // Check if it's a motorcycle based on make and model
                            const makeLC = item.vehicleData.make?.toLowerCase().trim() || '';
                            const modelLC = item.vehicleData.model?.toLowerCase().trim() || '';
                            
                            const isKnownMotorbikeManufacturer = ['yamaha', 'kawasaki', 'ducati', 'ktm', 'harley-davidson', 'harley davidson', 
                              'triumph', 'aprilia', 'mv agusta', 'benelli', 'moto guzzi', 'indian', 
                              'husqvarna', 'beta', 'sherco', 'gas gas', 'royal enfield', 'norton', 
                              'zero', 'energica'].includes(makeLC);
                            
                            const isMotorbike = isKnownMotorbikeManufacturer || 
                                              ['honda', 'bmw', 'suzuki'].includes(makeLC) && 
                                              (modelLC.includes('gsx') || modelLC.includes('cbr') || modelLC.includes('ninja') || 
                                               modelLC.includes('r1') || modelLC.includes('mt') || modelLC.includes('fazer'));
                            
                            return isMotorbike 
                              ? item.planName.replace(/Car/gi, 'Bike')
                              : item.planName.replace(/Bike/gi, 'Car');
                          })()
                        }</span>
                      </div>
                      
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Cover period:</span>
                        <span className="text-gray-900 font-medium">
                          {item.paymentType === 'yearly' ? '12 months' : 
                           item.paymentType === 'two_yearly' ? '24 months' : '36 months'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Claim Limit:</span>
                        <span className="text-gray-900 font-medium">£{(item.pricingData.claimLimit || 2000).toLocaleString()}</span>
                      </div>
                      
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Voluntary Excess:</span>
                        <span className="text-gray-900 font-medium">£{item.pricingData.voluntaryExcess}</span>
                      </div>

                       {/* Add-ons Display */}
                       {item.pricingData.selectedAddOns && Object.values(item.pricingData.selectedAddOns).some(Boolean) && (
                         <div className="pt-4 border-t border-gray-100">
                           {(() => {
                             // Get duration in months based on payment type
                             const getDurationMonths = (paymentType: string) => {
                               const normalized = normalizePaymentType(paymentType);
                               return normalized === '24months' ? 24 : 
                                      normalized === '36months' ? 36 : 12;
                             };
                            
                             const durationMonths = getDurationMonths(item.paymentType);
                             const addOnInfos = getAddOnInfo(item.paymentType, durationMonths);
                             
                             // Create a map of selected add-ons from pricing data
                             const selectedAddOns = item.pricingData.selectedAddOns || {};
                             
                             // Separate paid and free add-ons
                             const paidAddOns: any[] = [];
                             const freeAddOns: any[] = [];
                             
                             addOnInfos.forEach(addOn => {
                               // Map different key formats to consistent ones
                               const keyMappings: { [key: string]: string } = {
                                 'wearTear': 'wearAndTear'
                               };
                               
                               const mappedKey = keyMappings[addOn.key] || addOn.key;
                               const isSelected = selectedAddOns[addOn.key] || selectedAddOns[mappedKey];
                               
                               if (isSelected) {
                                 if (addOn.isAutoIncluded) {
                                   freeAddOns.push(addOn);
                                 } else {
                                   paidAddOns.push(addOn);
                                 }
                               }
                             });
                             
                             return (
                               <>
                                 {/* Display Paid Add-ons in Order Summary */}
                                 {paidAddOns.length > 0 && (
                                   <div className="mb-4">
                                     <div className="mb-2">
                                       <span className="text-gray-600 font-medium">Additional Protection:</span>
                                     </div>
                                      <div className="space-y-3">
                                        {paidAddOns.map(addOn => {
                                          // Calculate display price matching step 3 format
                                          let priceDisplay;
                                          let priceSubtext;
                                          
                                          if (addOn.oneTimePrice) {
                                            // One-time fee (e.g., Transfer Cover)
                                            priceDisplay = `Just £${addOn.oneTimePrice} one-time fee`;
                                            priceSubtext = null;
                                          } else {
                                            // Monthly add-on - spread over 12 payments
                                            const totalCost = addOn.monthlyPrice * durationMonths;
                                            const monthlyPayment = totalCost / 12;
                                            priceDisplay = `Only £${monthlyPayment.toFixed(2)} per month`;
                                            
                                            // Determine duration text
                                            const paymentTypeNormalized = normalizePaymentType(item.paymentType);
                                            const durationText = paymentTypeNormalized === '12months' ? '1 year' : 
                                                               paymentTypeNormalized === '24months' ? '2 year' : 
                                                               '3 year';
                                            priceSubtext = `Spread over 12 interest-free payments for full ${durationText} coverage.`;
                                          }
                                          
                                          return (
                                            <div key={addOn.key} className="text-sm">
                                              <div className="flex items-start gap-2">
                                                <span className="text-blue-600 mt-0.5">+</span>
                                                <div className="flex-1">
                                                  <span className="text-gray-700 block">{addOn.name}</span>
                                                  <div className="mt-1">
                                                    <div className="text-gray-900 font-medium">
                                                      {priceDisplay}
                                                    </div>
                                                    {priceSubtext && (
                                                      <div className="text-xs text-gray-600 mt-0.5">
                                                        {priceSubtext}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                   </div>
                                 )}
                                 
                                 {/* Display Free Add-ons as Included Protection */}
                                 {freeAddOns.length > 0 && (
                                   <div className="pt-2 border-t border-gray-100">
                                     <div className="mb-2">
                                       <span className="text-gray-600 font-medium">Included Protection:</span>
                                     </div>
                                     <div className="space-y-1">
                                       {freeAddOns.map(addOn => (
                                         <div key={addOn.key} className="flex items-center justify-between text-sm text-gray-700">
                                           <div className="flex items-center gap-2">
                                             <span className="text-green-600">✓</span>
                                             <span>{addOn.name}</span>
                                           </div>
                                           <span className="text-green-600 font-medium">FREE</span>
                                         </div>
                                       ))}
                                     </div>
                                   </div>
                                 )}
                               </>
                             );
                           })()}
                         </div>
                       )}
                    </div>

                    {/* Separator line between warranties */}
                    {index < items.length - 1 && (
                      <hr className="my-8 border-gray-300" />
                    )}
                  </div>
                ))}
              </div>

               {/* Overall Total */}
               <div className="border-t border-gray-200 pt-4 mb-6">
                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-gray-900">Subtotal:</span>
                      <span className="text-lg font-medium text-gray-900">£{totalPrice}</span>
                    </div>
                    
                     {discountValidation && discountValidation.valid && (
                       <div className="flex justify-between items-center text-green-600">
                         <span className="text-sm font-medium">Discount applied:</span>
                         <span className="text-sm font-medium">-£{Math.round(discountValidation.discountAmount)}</span>
                       </div>
                     )}
                    
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-lg font-bold text-gray-900">Total to Pay:</span>
                      <span className="text-xl font-bold text-blue-600">£{Math.round(finalPrice)}</span>
                    </div>
                 </div>
               </div>

               {/* Discount Code Section */}
               <div className="mb-6">
                 <Label htmlFor="cart_discount_code" className="text-sm font-medium text-gray-700 mb-2 block">
                   Discount Code
                   <span className="ml-2 text-xs text-gray-500">ⓘ</span>
                 </Label>
                 {discountValidation && discountValidation.valid && customerData.discount_code === '10OFF' ? (
                   <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                     <div className="flex items-center justify-between">
                       <span className="text-sm text-green-700 font-medium">10% Discount Applied</span>
                       <Badge variant="secondary" className="bg-green-100 text-green-800">
                         10OFF
                       </Badge>
                     </div>
                     <p className="text-xs text-green-600 mt-1">
                       Your additional warranty discount is already applied!
                     </p>
                   </div>
                 ) : (
                   <div className="flex gap-2 mb-2">
                     <Input
                       id="cart_discount_code"
                       placeholder="Enter discount code"
                       value={customerData.discount_code}
                       onChange={(e) => handleInputChange('discount_code', e.target.value)}
                       className="flex-1"
                     />
                     <Button 
                       type="button" 
                       variant="outline" 
                       onClick={handleValidateDiscount}
                       disabled={!customerData.discount_code.trim() || loading}
                       className="px-6"
                     >
                       Apply
                     </Button>
                   </div>
                 )}
                {discountValidation && (
                  <div className={`text-sm px-3 py-2 rounded-md ${
                    discountValidation.valid 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {discountValidation.valid ? 
                        <CheckCircle className="w-4 h-4" /> : 
                        <AlertCircle className="w-4 h-4" />
                      }
                      {discountValidation.message}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="bumper"
                      name="paymentMethod"
                      value="bumper"
                      checked={selectedPaymentMethod === 'bumper'}
                      onChange={(e) => {
                        console.log('🔄 Payment method changed to Bumper');
                        setSelectedPaymentMethod('bumper');
                        localStorage.setItem('multiWarrantyPaymentMethod', 'bumper');
                        setLoading(false);
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="bumper" className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">Monthly Interest-Free Credit</span>
                        <Badge variant="default" className="text-xs bg-green-600">0% Interest</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Pay £{Math.round(finalPrice / 12)} in 12 monthly payments = £{finalPrice} total</p>
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-3 border border-amber-200 rounded-lg p-4 bg-gradient-to-r from-amber-50 to-orange-50 hover:border-amber-300 transition-colors">
                    <input
                      type="radio"
                      id="stripe"
                      name="paymentMethod"
                      value="stripe"
                      checked={selectedPaymentMethod === 'stripe'}
                      onChange={(e) => {
                        console.log('🔄 Payment method changed to Stripe');
                        setSelectedPaymentMethod('stripe');
                        localStorage.setItem('multiWarrantyPaymentMethod', 'stripe');
                        setLoading(false);
                      }}
                      className="w-4 h-4 text-amber-600 mt-1"
                    />
                    <label htmlFor="stripe" className="flex-1 cursor-pointer">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-base font-bold text-gray-900">Pay in Full Today</span>
                            <p className="text-xs text-gray-600 mt-0.5">One-time payment, instant coverage</p>
                          </div>
                          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap ml-2">
                            💰 Save 5% Today
                          </div>
                        </div>
                        <div className="bg-white/60 rounded-md px-3 py-2 border border-amber-100">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900">£{Math.round(finalPrice * 0.95)}</span>
                            <span className="text-sm text-gray-500 line-through">£{finalPrice}</span>
                            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Save £{Math.round(finalPrice * 0.05)}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="inline-flex items-center gap-1">
                              <CreditCard size={12} className="text-gray-500" />
                              Secure payment powered by Stripe
                            </span>
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 text-base"
                size="lg"
              >
                {loading ? (
                  'Processing...'
                ) : (
                  selectedPaymentMethod === 'bumper' ? 'Continue with Bumper' : 'Continue with Stripe'
                )}
              </Button>
              
              <div className="text-xs text-gray-500 text-center mt-3">
                <p className="flex items-center justify-center gap-1">
                  <CreditCard size={12} className="text-blue-600" />
                  Secure checkout powered by Stripe
                </p>
                <p>All major cards accepted</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiWarrantyCheckout;