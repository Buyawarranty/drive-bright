
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { CarDrivingSpinner } from '@/components/ui/car-driving-spinner';
import { TrophySpinner } from '@/components/ui/trophy-spinner';
import { SEOHead } from '@/components/SEOHead';
import { ArrowRight, Clock } from 'lucide-react';
import pandaCelebratingOrangeCar from '@/assets/panda-celebrating-orange-car.png';
import { trackPurchaseComplete, trackButtonClick } from '@/utils/analytics';
import { sendTrustpilotInvitation } from '@/utils/trustpilotInvite';
import { ConfirmationSection } from '@/components/thankYou/ConfirmationSection';
import { OrderSummary } from '@/components/thankYou/OrderSummary';
import { WhatHappensNext } from '@/components/thankYou/WhatHappensNext';
import { TrustpilotReviewSection } from '@/components/thankYou/TrustpilotReviewSection';
import { NeedHelpSection } from '@/components/thankYou/NeedHelpSection';
import { ShareAndSaveSection } from '@/components/thankYou/ShareAndSaveSection';
import { TrustSecurityFooter } from '@/components/thankYou/TrustSecurityFooter';
import { FeedbackSection } from '@/components/thankYou/FeedbackSection';

// Extend Window interface for gtag
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

const ThankYou = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Extract ALL URL params for order summary display
  const plan = searchParams.get('plan') || 'Platinum';
  const duration = searchParams.get('duration') || searchParams.get('payment') || searchParams.get('paymentType') || '';
  const sessionId = searchParams.get('session_id');
  const email = searchParams.get('email');
  const firstName = searchParams.get('first_name');
  const lastName = searchParams.get('last_name');
  const mobile = searchParams.get('mobile');
  const street = searchParams.get('street');
  const postcode = searchParams.get('postcode');
  const vehicle = searchParams.get('vehicle') || `${searchParams.get('vehicle_make') || ''} ${searchParams.get('vehicle_model') || ''}`.trim();
  const vehicleReg = searchParams.get('vehicle_reg');
  const mileage = searchParams.get('mileage');
  const claimLimit = searchParams.get('claim_limit');
  const labourRate = searchParams.get('labour_rate');
  const excess = searchParams.get('excess');
  const addons = searchParams.get('addons');
  const finalAmount = searchParams.get('final_amount') || searchParams.get('total_price');
  const monthlyPrice = searchParams.get('monthly_price');
  
  // Detect source - check for bumper indicators if source param is missing
  const source = searchParams.get('source') || 
    (searchParams.get('bumper_order_id') ? 'bumper' : null) ||
    (sessionId && sessionId.startsWith('cs_') ? 'stripe' : null) ||
    (sessionId && sessionId.startsWith('VW-') ? 'bumper' : null);
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [policyNumber, setPolicyNumber] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isGtagReady, setIsGtagReady] = useState(false);

  // Load Google Ads gtag script on page load
  useEffect(() => {
    // Check if gtag already exists and is ready
    if (typeof window !== 'undefined' && window.gtag) {
      console.log('✅ Google Ads gtag already available');
      setIsGtagReady(true);
      return;
    }

    // Check if script already exists
    if (document.querySelector('script[src*="googletagmanager.com/gtag"]')) {
      console.log('✅ Google Ads gtag script already loaded, waiting for initialization');
      // Poll for gtag to be ready
      const checkInterval = setInterval(() => {
        if (window.gtag) {
          console.log('✅ gtag now ready');
          setIsGtagReady(true);
          clearInterval(checkInterval);
        }
      }, 100);
      // Clear after 5 seconds max
      setTimeout(() => clearInterval(checkInterval), 5000);
      return;
    }

    // Load gtag.js script
    const script = document.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-17325228149';
    script.async = true;
    
    script.onload = () => {
      console.log('✅ Google Ads gtag script loaded on ThankYou page');
      
      // Initialize dataLayer and gtag
      window.dataLayer = window.dataLayer || [];
      function gtag(...args: any[]) {
        window.dataLayer.push(args);
      }
      window.gtag = gtag as any;
      
      gtag('js', new Date());
      gtag('config', 'AW-17325228149');
      
      console.log('✅ Google Ads tracking initialized on ThankYou page');
      setIsGtagReady(true);
    };
    
    script.onerror = () => {
      console.error('❌ Failed to load Google Ads gtag script');
      // Still set ready to true so we don't block the page
      setIsGtagReady(true);
    };
    
    document.head.appendChild(script);
    
    return () => {
      // Cleanup if needed
      const existingScript = document.querySelector('script[src*="googletagmanager.com/gtag"]');
      if (existingScript && existingScript === script) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Calculate 24-hour expiry time
  useEffect(() => {
    const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
    
    const updateTimer = () => {
      const now = Date.now();
      const remaining = expiryTime - now;
      
      if (remaining <= 0) {
        setTimeRemaining('Expired');
        return;
      }
      
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeRemaining(`${hours}h ${minutes}m`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // CRITICAL: Wait for gtag to be ready before processing
    // This prevents race condition where conversion fires before gtag is loaded
    if (!isGtagReady) {
      console.log('[THANK-YOU] Waiting for gtag to be ready...');
      return;
    }

    // Debug: Log all URL parameters
    console.log('[THANK-YOU] URL Parameters:', {
      plan: searchParams.get('plan'),
      payment: searchParams.get('payment'),
      duration: searchParams.get('duration'),
      session_id: searchParams.get('session_id'),
      source: searchParams.get('source'),
      policy_number: searchParams.get('policy_number'),
      final_amount: searchParams.get('final_amount'),
      allParams: Object.fromEntries(searchParams.entries()),
      isGtagReady
    });
    
    const processPayment = async () => {
      // For Bumper payments, we get data from URL params
      if (source === 'bumper') {
        // Bumper flow already processed - just show success
        setIsProcessing(false);
        
        // Extract policy number if available
        const policyNum = searchParams.get('policy_number') || searchParams.get('warranty_number');
        if (policyNum) {
          setPolicyNumber(policyNum);
          toast.success('Your warranty policy has been created successfully!');
        }
        
        // Set enhanced conversion data FIRST (before conversion event)
        const email = searchParams.get('email');
        const mobile = searchParams.get('mobile');
        const firstName = searchParams.get('first_name');
        const lastName = searchParams.get('last_name');
        const street = searchParams.get('street');
        const postcode = searchParams.get('postcode');
        
        if (typeof window !== 'undefined' && window.gtag && (email || (firstName && lastName))) {
          const userData: any = {};
          
          if (email) {
            userData.email = email;
          }
          
          // Format phone to E.164 if available
          if (mobile) {
            let formattedPhone = mobile.replace(/\s+/g, '').replace(/^0/, '+44');
            if (!formattedPhone.startsWith('+')) {
              formattedPhone = '+44' + formattedPhone;
            }
            userData.phone_number = formattedPhone;
          }
          
          // Add address data if we have name
          if (firstName || lastName || street || postcode) {
            userData.address = {};
            if (firstName) userData.address.first_name = firstName;
            if (lastName) userData.address.last_name = lastName;
            if (street) userData.address.street = street;
            if (postcode) userData.address.postal_code = postcode;
            userData.address.country = 'GB';
          }
          
          // Set user_data globally for enhanced conversions
          window.gtag('set', 'user_data', userData);
          console.log('✅ Enhanced conversion user_data set:', userData);
        }
        
        // Track purchase
        const finalAmountStr = searchParams.get('final_amount');
        const finalAmount = finalAmountStr ? parseFloat(finalAmountStr) : 0;
        
        // CRITICAL: Only track if we have valid amount and session
        if (finalAmount > 0 && sessionId) {
          console.log('✅ Tracking Bumper purchase with amount:', finalAmount, 'sessionId:', sessionId);
          trackPurchaseComplete(
            finalAmount,
            sessionId,
            {
              email: email || undefined,
              phone: mobile || undefined,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              address: street || undefined
            }
          );
        } else {
          console.error('❌ TRACKING FAILED (Bumper): Missing or invalid data', {
            finalAmount,
            finalAmountStr,
            sessionId,
            email,
            mobile
          });
        }
        
        // Send Trustpilot review invitation
        if (email && (firstName || lastName) && policyNum) {
          const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Customer';
          sendTrustpilotInvitation({
            recipientEmail: email,
            recipientName: fullName,
            referenceId: policyNum,
            orderDate: new Date().toISOString(),
            productName: `${plan} Warranty - ${duration}`,
          });
        }
        
        return;
      }
      
      // For Stripe payments, we need the session ID
      // But check if we have policy_number which means payment was already processed
      const existingPolicyNumber = searchParams.get('policy_number') || searchParams.get('warranty_number');
      
      // If we have source identified or any useful data, we can show the page
      const hasSufficientData = searchParams.get('final_amount') || searchParams.get('email') || searchParams.get('plan') || source;
      
      // Only show error if we truly have no data at all
      if (!sessionId && !existingPolicyNumber && !hasSufficientData) {
        console.error('Missing payment session information', { sessionId, existingPolicyNumber, source, hasSufficientData });
        toast.error('Missing payment session information');
        setIsProcessing(false);
        return;
      }
      
      // If we have policy number but no session, or have sufficient display data, skip processing
      if ((existingPolicyNumber && !sessionId) || (!sessionId && hasSufficientData)) {
        console.log('Payment data available, showing confirmation', { existingPolicyNumber, hasSufficientData });
        if (existingPolicyNumber) setPolicyNumber(existingPolicyNumber);
        setIsProcessing(false);
        return;
      }

      try {
        // Process Stripe payment - the edge function will get plan/payment type from session metadata
        console.log('Processing Stripe payment...', { sessionId });
        
        const result = await supabase.functions.invoke('process-stripe-success', {
          body: {
            sessionId
          }
        });
        
        const data = result.data;
        const error = result.error;

        if (error) {
          console.error('Payment processing error:', error);
          toast.error('Error processing payment');
        } else {
          console.log('Payment processed successfully:', data);
          // Check both top-level policyNumber and nested data.policyNumber
          const warrantyNumber = data?.policyNumber || data?.data?.policyNumber;
          if (warrantyNumber) {
            setPolicyNumber(warrantyNumber);
          }
          toast.success('Your warranty policy has been created successfully!');
          
          // Set enhanced conversion data FIRST (before conversion event)
          const email = searchParams.get('email') || data?.customerEmail;
          const mobile = searchParams.get('mobile') || data?.customerPhone;
          const firstName = searchParams.get('first_name') || data?.firstName;
          const lastName = searchParams.get('last_name') || data?.lastName;
          const street = searchParams.get('street') || data?.address;
          const postcode = searchParams.get('postcode');
          
          if (typeof window !== 'undefined' && window.gtag && (email || (firstName && lastName))) {
            const userData: any = {};
            
            if (email) {
              userData.email = email;
            }
            
            // Format phone to E.164 if available
            if (mobile) {
              let formattedPhone = mobile.replace(/\s+/g, '').replace(/^0/, '+44');
              if (!formattedPhone.startsWith('+')) {
                formattedPhone = '+44' + formattedPhone;
              }
              userData.phone_number = formattedPhone;
            }
            
            // Add address data if we have name
            if (firstName || lastName || street || postcode) {
              userData.address = {};
              if (firstName) userData.address.first_name = firstName;
              if (lastName) userData.address.last_name = lastName;
              if (street) userData.address.street = street;
              if (postcode) userData.address.postal_code = postcode;
              userData.address.country = 'GB';
            }
            
            // Set user_data globally for enhanced conversions
            window.gtag('set', 'user_data', userData);
            console.log('✅ Enhanced conversion user_data set:', userData);
          }
          
          // Track Google Ads purchase conversion
          const transactionId = data?.policyNumber || sessionId || `ORDER_${Date.now()}`;
          const finalAmount = searchParams.get('final_amount') 
            ? parseFloat(searchParams.get('final_amount')!) 
            : data?.amount || 0;
          
          // CRITICAL: Only track if we have a valid amount
          if (finalAmount > 0) {
            console.log('✅ Tracking purchase with amount:', finalAmount, 'transactionId:', transactionId);
            trackPurchaseComplete(
              finalAmount,
              transactionId,
              {
                email: email,
                phone: mobile,
                firstName: firstName,
                lastName: lastName,
                address: street
              }
            );
          } else {
            console.error('❌ TRACKING FAILED: Missing or invalid amount', {
              finalAmount,
              searchParamAmount: searchParams.get('final_amount'),
              dataAmount: data?.amount,
              sessionId,
              email,
              mobile
            });
          }
          
          // Send Trustpilot review invitation
          if (email && (firstName || lastName) && transactionId) {
            const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Customer';
            sendTrustpilotInvitation({
              recipientEmail: email,
              recipientName: fullName,
              referenceId: transactionId,
              orderDate: new Date().toISOString(),
              productName: `${plan} Warranty - ${duration}`,
            });
          }
          
          // Check if user enabled "Add Another Warranty" during checkout
          const addAnotherWarranty = searchParams.get('addAnotherWarranty');
          if (addAnotherWarranty === 'true') {
            // Set the localStorage flag for the 10% discount ONLY when user actively clicked the component
            localStorage.setItem('addAnotherWarrantyDiscount', 'true');
            
            // Redirect to step 1 after a short delay
            setTimeout(() => {
              const url = new URL(window.location.origin);
              url.searchParams.set('step', '1');
              window.location.href = url.toString();
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Payment processing failed:', error);
        toast.error('Failed to process payment');
      } finally {
        setIsProcessing(false);
      }
    };

    processPayment();

    // Trigger elegant confetti animation on load (5 seconds like Canva)
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const defaults = { 
      startVelocity: 20, 
      spread: 360, 
      ticks: 80, 
      zIndex: 0,
      scalar: 1.8,
      gravity: 0.5,
      drift: 0,
      colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 30 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 300);

    return () => clearInterval(interval);
  }, [sessionId, plan, duration, source, isGtagReady]);

  const handleGetSecondWarranty = () => {
    // Track CTA click
    trackButtonClick('second_warranty_cta', {
      page: 'thank_you',
      discount: '10%'
    });
    
    // Set the localStorage flag for the 10% discount
    localStorage.setItem('addAnotherWarrantyDiscount', 'true');
    
    const url = new URL(window.location.origin);
    url.searchParams.set('step', '1');
    window.location.href = url.toString();
  };

  const handleReturnHome = () => {
    trackButtonClick('return_home', { page: 'thank_you' });
    window.location.href = 'https://www.buyawarranty.co.uk';
  };

  // Customer data already extracted at the top of component

  return (
    <div className="bg-gradient-to-br from-background via-background to-muted/20 min-h-screen">
      <SEOHead 
        title="Thank You! Your Warranty is Active | Buy-A-Warranty"
        description="Your car warranty purchase is complete. Your policy is now active and documents are on their way to your inbox."
        keywords="warranty purchase complete, policy confirmation, car warranty active, thank you"
      />
      
      {/* Trustpilot header */}
      <div className="w-full px-4 pt-4 pb-0">
        <div className="max-w-4xl mx-auto">
          <TrustpilotHeader />
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4 pt-2 pb-6 md:pt-4 md:pb-10">
        {isProcessing ? (
          <div className="text-center py-12">
            <TrophySpinner />
            <p className="text-muted-foreground mt-4">Processing your warranty registration...</p>
          </div>
        ) : (
          <>
            {/* Check if redirecting to second warranty */}
            {searchParams.get('addAnotherWarranty') === 'true' ? (
              <div className="text-center mb-8">
                <Card className="border-2 border-primary shadow-lg">
                  <CardContent className="p-6">
                    <p className="text-foreground font-bold text-xl mb-2">
                      🎉 Redirecting you to add your next vehicle
                    </p>
                    <p className="text-muted-foreground text-lg mb-4">
                      with 10% discount applied!
                    </p>
                    <CarDrivingSpinner />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Celebration Image */}
                <div className="flex justify-center mb-3">
                  <img 
                    src={pandaCelebratingOrangeCar}
                    alt="Celebrating panda with orange car" 
                    className="w-full max-w-xs md:max-w-sm h-auto object-contain"
                  />
                </div>

                {/* Confirmation Section */}
                <ConfirmationSection 
                  firstName={firstName || undefined}
                  email={email || undefined}
                  policyNumber={policyNumber || undefined}
                  source={source || undefined}
                />

                {/* Order Summary */}
                <OrderSummary 
                  plan={plan}
                  paymentType={duration || undefined}
                  warrantyStartDate={undefined}
                  duration={duration || undefined}
                  warrantyNumber={policyNumber || searchParams.get('warranty_number') || searchParams.get('policy_number') || undefined}
                  monthlyPrice={monthlyPrice ? parseFloat(monthlyPrice) : undefined}
                  totalPrice={finalAmount ? parseFloat(finalAmount) : undefined}
                  originalPrice={searchParams.get('original_price') ? parseFloat(searchParams.get('original_price')!) : undefined}
                  vehicle={vehicle || undefined}
                  vehicleReg={vehicleReg || undefined}
                  mileage={mileage || undefined}
                  claimLimit={claimLimit ? parseInt(claimLimit) : undefined}
                  labourRate={labourRate ? parseInt(labourRate) : undefined}
                  excess={excess ? parseInt(excess) : undefined}
                  addons={addons || undefined}
                  paidInFull={source === 'stripe'}
                  source={source || undefined}
                />

                {/* What Happens Next */}
                <WhatHappensNext />

                {/* Trustpilot Review Section */}
                <TrustpilotReviewSection />

                {/* Second Purchase Offer */}
                <Card className="border-2 border-primary shadow-lg bg-gradient-to-br from-primary/5 to-background">
                  <CardContent className="p-6 md:p-8 text-center">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                      🚗 Got Another Vehicle?
                    </h2>
                    <p className="text-lg text-muted-foreground mb-3">
                      Get <span className="font-bold text-primary">10% off</span> a second warranty – valid for 24 hours!
                    </p>
                    <p className="text-primary font-semibold mb-6 flex items-center justify-center gap-2">
                      <Clock className="w-5 h-5" />
                      {timeRemaining && timeRemaining !== 'Expired' 
                        ? `Offer expires in ${timeRemaining}` 
                        : 'Limited time offer'}
                    </p>
                    <Button
                      onClick={handleGetSecondWarranty}
                      size="lg"
                      className="w-full md:w-auto bg-primary hover:bg-primary/90 text-lg px-8 py-6 font-semibold shadow-lg hover:shadow-xl transition-all"
                    >
                      Get 10% off a 2nd warranty
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Need Help */}
                <NeedHelpSection />

                {/* Quick Feedback */}
                <FeedbackSection 
                  onSurveyClick={() => trackButtonClick('feedback_survey', { page: 'thank_you' })}
                  policyNumber={policyNumber || undefined}
                />

                {/* Share & Save */}
                <ShareAndSaveSection 
                  onReferClick={() => trackButtonClick('refer_friend', { page: 'thank_you' })}
                  customerName={firstName || undefined}
                />

                {/* Trust & Security Footer */}
                <TrustSecurityFooter />

                {/* Return Home Button */}
                <div className="text-center pt-4">
                  <Button
                    onClick={handleReturnHome}
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Return to Buy-A-Warranty.co.uk
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ThankYou;
