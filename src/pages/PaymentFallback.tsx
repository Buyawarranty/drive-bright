
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TrustpilotHeader from '@/components/TrustpilotHeader';

interface TransactionData {
  plan_id: string;
  payment_type: string;
  customer_data: any;
  vehicle_data: any;
  protection_addons: any;
  final_amount: number;
  discount_code: string;
  claim_limit: number;
}

const PaymentFallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [transactionData, setTransactionData] = useState<TransactionData | null>(null);
  
  const transactionId = searchParams.get('tx');
  const plan = searchParams.get('plan');
  const email = searchParams.get('email');

  // Fetch transaction data if tx parameter exists
  useEffect(() => {
    const fetchTransactionData = async () => {
      if (!transactionId) {
        setFetchingData(false);
        return;
      }

      try {
        console.log('=== FETCHING TRANSACTION DATA FOR FALLBACK ===');
        console.log('Transaction ID:', transactionId);

        const { data, error } = await supabase
          .from('bumper_transactions')
          .select('*')
          .eq('transaction_id', transactionId)
          .single();

        if (error) {
          console.error('Error fetching transaction:', error);
          toast.error('Failed to load transaction data');
        } else if (data) {
          console.log('Transaction data retrieved:', data);
          setTransactionData({
            plan_id: data.plan_id,
            payment_type: data.payment_type,
            customer_data: data.customer_data,
            vehicle_data: data.vehicle_data,
            protection_addons: data.protection_addons,
            final_amount: data.final_amount,
            discount_code: data.discount_code,
            claim_limit: data.claim_limit
          });
        }
      } catch (err) {
        console.error('Error fetching transaction data:', err);
      } finally {
        setFetchingData(false);
      }
    };

    fetchTransactionData();
  }, [transactionId]);

  const handleStripeCheckout = async () => {
    setLoading(true);
    
    try {
      console.log('=== FALLBACK TO STRIPE CHECKOUT ===');
      
      // Use transaction data if available, otherwise fall back to URL params
      if (transactionData) {
        console.log('Using stored transaction data:', transactionData);
        
        const customerData = transactionData.customer_data || {};
        const vehicleData = transactionData.vehicle_data || {};
        const protectionAddOns = transactionData.protection_addons || {};
        
        // Extract labour rate and voluntary excess from protection add-ons
        const labourRate = protectionAddOns.labourRate || 50;
        const voluntaryExcess = protectionAddOns.voluntaryExcess || 100;
        
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: {
            planId: transactionData.plan_id,
            planName: 'platinum', // Default to platinum
            paymentType: transactionData.payment_type,
            voluntaryExcess: voluntaryExcess,
            vehicleData: {
              regNumber: vehicleData.regNumber || customerData.vehicle_reg || '',
              make: vehicleData.make || customerData.vehicle_make || '',
              model: vehicleData.model || customerData.vehicle_model || '',
              year: vehicleData.year || customerData.vehicle_year || '',
              fuelType: vehicleData.fuelType || customerData.vehicle_fuel_type || '',
              transmission: vehicleData.transmission || customerData.vehicle_transmission || '',
              mileage: vehicleData.mileage || customerData.vehicle_mileage || '',
              vehicleType: vehicleData.vehicleType || 'standard',
              email: customerData.email || ''
            },
            customerData: {
              email: customerData.email || '',
              first_name: customerData.first_name || '',
              last_name: customerData.last_name || '',
              phone: customerData.phone || customerData.mobile || '',
              mobile: customerData.mobile || customerData.phone || '',
              street: customerData.street || customerData.address_line_1 || '',
              town: customerData.town || customerData.city || '',
              county: customerData.county || '',
              postcode: customerData.postcode || '',
              country: customerData.country || 'United Kingdom',
              building_name: customerData.building_name || '',
              flat_number: customerData.flat_number || '',
              building_number: customerData.building_number || '',
              vehicle_reg: vehicleData.regNumber || customerData.vehicle_reg || ''
            },
            discountCode: transactionData.discount_code || '',
            finalAmount: transactionData.final_amount,
            claimLimit: transactionData.claim_limit || 1250,
            protectionAddOns: {
              breakdown: protectionAddOns.breakdown || false,
              rental: protectionAddOns.rental || false,
              wearAndTear: protectionAddOns.wearAndTear || false,
              tyre: protectionAddOns.tyre || false,
              european: protectionAddOns.european || false,
              transfer: protectionAddOns.transfer || false,
              motFee: protectionAddOns.motFee || false,
              motRepair: protectionAddOns.motRepair || false,
              lostKey: protectionAddOns.lostKey || false,
              consequential: protectionAddOns.consequential || false
            }
          }
        });

        console.log('=== STRIPE FALLBACK RESPONSE ===');
        console.log('Data:', data);
        console.log('Error:', error);

        if (error) {
          console.error('Stripe fallback error:', error);
          toast.error('Failed to create payment session: ' + error.message);
          return;
        }

        if (data?.url) {
          console.log('=== REDIRECTING TO STRIPE FALLBACK ===');
          console.log('Checkout URL:', data.url);
          window.location.href = data.url;
        } else {
          console.error('No checkout URL received:', data);
          toast.error('No payment URL received');
        }
      } else {
        // Legacy fallback for old URL format without transaction ID
        console.log('No transaction data, using legacy fallback');
        console.log('Plan:', plan);
        console.log('Email:', email);
        
        const vehicleData = {
          email: email || 'guest@buyawarranty.com',
          regNumber: searchParams.get('reg') || '',
          mileage: searchParams.get('mileage') || '',
          fullName: searchParams.get('name') || '',
          phone: searchParams.get('phone') || '',
          address: searchParams.get('address') || ''
        };

        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: {
            planId: plan,
            paymentType: 'yearly',
            vehicleData: vehicleData
          }
        });

        console.log('=== STRIPE FALLBACK RESPONSE ===');
        console.log('Data:', data);
        console.log('Error:', error);

        if (error) {
          console.error('Stripe fallback error:', error);
          toast.error('Failed to create payment session: ' + error.message);
          return;
        }

        if (data?.url) {
          console.log('=== REDIRECTING TO STRIPE FALLBACK ===');
          console.log('Checkout URL:', data.url);
          window.location.href = data.url;
        } else {
          console.error('No checkout URL received:', data);
          toast.error('No payment URL received');
        }
      }
    } catch (error) {
      console.error('Error creating fallback payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="bg-[#e8f4fb] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your order details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#e8f4fb] min-h-screen flex flex-col">
      {/* Trustpilot header */}
      <div className="w-full px-4 pt-4">
        <div className="max-w-6xl mx-auto">
          <TrustpilotHeader />
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          {/* Logo */}
          <div className="mb-6">
            <img 
              src="/lovable-uploads/bb0fa2d5-1f65-4892-bf89-bacc1ee33384.png" 
              alt="Buy a Warranty Logo" 
              className="h-12 mx-auto mb-6"
            />
          </div>
          
          <div className="mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              ⚠️ Oops! Payment Didn't Go Through
            </h1>
            <p className="text-gray-600 mb-6">
              We couldn't process your payment with the usual method. No worries — you can still continue safely using an alternative way to pay 😊
            </p>
            
            {/* Show order summary if transaction data available */}
            {transactionData && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-gray-900 mb-2">Your Order:</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>Total: <span className="font-bold">£{transactionData.final_amount}</span></p>
                  {transactionData.discount_code && (
                    <p className="text-green-600">
                      Discount Applied: {transactionData.discount_code}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <p className="text-gray-700 mb-6 font-medium">
              👉 Tap below to try a secure payment option
            </p>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={handleStripeCheckout}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {loading ? 'Processing...' : 'Continue to Secure Payment'}
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Back to Home
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              🔒 Your payment will be safe and secure - we've got your back!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentFallback;
