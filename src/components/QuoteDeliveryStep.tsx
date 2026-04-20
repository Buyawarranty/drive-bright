import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Check, Lock, Phone, CheckCircle, Zap, ArrowRight, Ban, BellOff, MessageCircle, Star, User, Car, Rocket, PhoneCall } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import { getStoredFbclid, getStoredFbReferrer } from '@/utils/fbclidCapture';
import { getStoredGclid } from '@/utils/gclidCapture';
import MobileNavigation from '@/components/MobileNavigation';
import HelpFAB from '@/components/HelpFAB';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';

import trustpilotLogo from '/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface QuoteDeliveryStepProps {
  vehicleData: {
    regNumber: string;
    mileage: string;
    make?: string;
    model?: string;
    fuelType?: string;
    transmission?: string;
    year?: string;
    vehicleType?: string;
    blocked?: boolean;
    blockReason?: string;
  };
  onNext: (data: { email: string; phone: string; firstName: string; lastName: string; sendQuoteEmail?: boolean }) => void;
  onBack: () => void;
  onSkip: () => void;
}

const QuoteDeliveryStep: React.FC<QuoteDeliveryStepProps> = ({ vehicleData, onNext, onBack, onSkip }) => {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [firstNameError, setFirstNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Restore form fields from localStorage on mount
  useEffect(() => {
    try {
      const savedCustomerData = localStorage.getItem('buyawarranty_customerData');
      if (savedCustomerData) {
        const parsed = JSON.parse(savedCustomerData);
        if (parsed.first_name) setFirstName(parsed.first_name);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.phone) setPhone(parsed.phone);
        console.log('✅ Restored Step 2 form data from localStorage');
      }
    } catch (error) {
      console.error('Error restoring customer data:', error);
    }
  }, []);

  const isValidFirstName = firstName.trim().length >= 2;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidPhone = /^(?:(?:\+44\s?|0)7\d{9}|(?:\+44\s?|0)[1-9]\d{8,9}|\+91[6-9]\d{9})$/.test(phone.replace(/\s/g, ''));
  const isFormValid = isValidFirstName && isValidEmail && isValidPhone;

  const handleSkipClick = async () => {
    try {
      if (email.trim()) {
        await supabase.functions.invoke('track-abandoned-cart', {
          body: {
            full_name: firstName.trim() || null,
            email: email.trim(),
            phone: phone.trim() || undefined,
            vehicle_reg: vehicleData?.regNumber,
            vehicle_make: vehicleData?.make,
            vehicle_model: vehicleData?.model,
            vehicle_year: vehicleData?.year,
            mileage: vehicleData?.mileage,
            step_abandoned: 2
          }
        });
      }
    } catch (error) {
      console.error('Error tracking abandoned cart on skip:', error);
    }
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    setTimeout(() => {
      onSkip();
    }, 300);
  };

  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);
    setFirstNameError('');
    setEmailError('');
    setPhoneError('');
    
    // Validate and show errors
    if (!firstName.trim()) {
      setFirstNameError('Please enter your first name');
    } else if (!isValidFirstName) {
      setFirstNameError('First name must be at least 2 characters');
    }
    
    if (!email.trim()) {
      setEmailError('Please enter your email address');
    } else if (!isValidEmail) {
      setEmailError('Please enter a valid email address');
    }
    
    if (!phone.trim()) {
      setPhoneError('Please enter your phone number');
    } else if (!isValidPhone) {
      setPhoneError('Please enter a valid UK phone number');
    }
    
    if (!isFormValid) return;
    
    setSendingEmail(true);

    // Track Step 2 attempt immediately (before any server calls)
    const sessionId = (() => {
      try { return sessionStorage.getItem('baw_session_id') || crypto.randomUUID(); } catch { return crypto.randomUUID(); }
    })();
    try {
      await supabase.from('step2_submission_attempts').insert({
        session_id: sessionId,
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        first_name: firstName.trim() || null,
        vehicle_reg: vehicleData?.regNumber?.toUpperCase().replace(/\s/g, '') || null,
        vehicle_make: vehicleData?.make || null,
        vehicle_model: vehicleData?.model || null,
        vehicle_year: vehicleData?.year || null,
        mileage: vehicleData?.mileage || null,
        attempt_status: 'attempted',
      });
    } catch (e) {
      // Don't block the user flow if tracking fails
      console.error('Step 2 attempt tracking failed:', e);
    }
    
    try {
      // Send quote email
      const { error: quoteEmailError } = await supabase.functions.invoke('send-quote-email', {
        body: {
          email: email.trim(),
          firstName: 'Valued Customer',
          lastName: '',
          vehicleData: {
            regNumber: vehicleData.regNumber,
            make: vehicleData.make,
            model: vehicleData.model,
            year: vehicleData.year,
            mileage: vehicleData.mileage,
            vehicleType: vehicleData.vehicleType || 'car',
            fuelType: vehicleData.fuelType,
            transmission: vehicleData.transmission
          },
          isInitialQuote: true
        }
      });

      if (quoteEmailError) {
        console.error('Error sending quote email:', quoteEmailError);
      }
      // Update the existing abandoned_cart with step 2 data (name, email, phone).
      // The trigger on abandoned_carts will update the corresponding sales_lead.
      // We do NOT insert directly into sales_leads to avoid duplicates.
      
      // Save customer data to localStorage for Step 4 pre-population
      try {
        const existingCustomerData = localStorage.getItem('buyawarranty_customerData');
        const parsedData = existingCustomerData ? JSON.parse(existingCustomerData) : {};
        localStorage.setItem('buyawarranty_customerData', JSON.stringify({
          ...parsedData,
          first_name: firstName.trim(),
          email: email.trim(),
          phone: phone.trim()
        }));
        console.log('✅ Saved customer data to localStorage for Step 4');
      } catch (error) {
        console.error('Error saving customer data to localStorage:', error);
      }

      // Try to update the existing abandoned_cart with step 2 contact info.
      // The trigger will propagate changes to the sales_lead automatically.
      const normalizedEmail = email.trim().toLowerCase();
      const regNumber = vehicleData?.regNumber?.toUpperCase().replace(/\s/g, '') || '';
      const storedFbclid = getStoredFbclid();
      const storedGclid = getStoredGclid();
      const utmSource = new URLSearchParams(window.location.search).get('utm_source');
      
      let cartUpdated = false;
      
      if (regNumber) {
        // Find and update the most recent abandoned cart for this vehicle
        const { data: existingCarts } = await supabase
          .from('abandoned_carts')
          .select('id')
          .eq('vehicle_reg', regNumber)
          .eq('is_converted', false)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (existingCarts && existingCarts.length > 0) {
          const { error: updateError } = await supabase
            .from('abandoned_carts')
            .update({
              email: normalizedEmail,
              full_name: firstName.trim(),
              phone: phone.trim() || null,
              step_abandoned: 2,
              updated_at: new Date().toISOString(),
              ...(() => {
                const fb = storedFbclid || getStoredFbclid();
                const gc = storedGclid || getStoredGclid();
                const fbRef = !fb ? getStoredFbReferrer() : null;
                if (fb || gc || utmSource || fbRef) {
                  return {
                    cart_metadata: {
                      ...(fb ? { fbclid: fb } : {}),
                      ...(gc ? { gclid: gc } : {}),
                      ...(utmSource ? { utm_source: utmSource } : {}),
                      ...(fbRef ? { fb_referrer: fbRef } : {}),
                    }
                  };
                }
                return {};
              })()
            })
            .eq('id', existingCarts[0].id);
          
          if (!updateError) {
            cartUpdated = true;
            console.log('✅ Updated existing abandoned cart with step 2 data');
          }
        }
      }

      // If no existing cart was found/updated, create a new abandoned cart entry.
      // The trigger will create the sales_lead automatically.
      if (!cartUpdated) {
        const { error: cartInsertError } = await supabase
          .from('abandoned_carts')
          .insert({
            email: normalizedEmail,
            full_name: firstName.trim(),
            phone: phone.trim() || null,
            vehicle_reg: regNumber || null,
            vehicle_make: vehicleData?.make || null,
            vehicle_model: vehicleData?.model || null,
            vehicle_year: vehicleData?.year || null,
            vehicle_type: vehicleData?.vehicleType || 'car',
            mileage: vehicleData?.mileage || null,
            step_abandoned: 2,
            ...((() => {
                const fbRef = !storedFbclid ? getStoredFbReferrer() : null;
                if (storedFbclid || storedGclid || utmSource || fbRef) {
                  return {
                    cart_metadata: {
                      ...(storedFbclid ? { fbclid: storedFbclid } : {}),
                      ...(storedGclid ? { gclid: storedGclid } : {}),
                      ...(utmSource ? { utm_source: utmSource } : {}),
                      ...(fbRef ? { fb_referrer: fbRef } : {}),
                    }
                  };
                }
                return {};
              })())
          });

        if (cartInsertError) {
          console.error('Error creating abandoned cart, retrying via track-abandoned-cart edge function:', cartInsertError);

          const fallbackFbclid = getStoredFbclid();
          const fallbackGclid = getStoredGclid();
          const { error: fallbackTrackError } = await supabase.functions.invoke('track-abandoned-cart', {
            body: {
              full_name: firstName.trim(),
              email: normalizedEmail,
              phone: phone.trim() || undefined,
              vehicle_reg: regNumber || undefined,
              vehicle_make: vehicleData?.make,
              vehicle_model: vehicleData?.model,
              vehicle_year: vehicleData?.year,
              mileage: vehicleData?.mileage,
              vehicle_type: vehicleData?.vehicleType || 'car',
              step_abandoned: 2,
              ...(fallbackFbclid ? { fbclid: fallbackFbclid } : {}),
              ...(fallbackGclid ? { gclid: fallbackGclid } : {}),
            }
          });

          if (fallbackTrackError) {
            console.error('Fallback track-abandoned-cart also failed:', fallbackTrackError);
          } else {
            console.log('✅ Recovered via track-abandoned-cart fallback');
          }
        } else {
          console.log('✅ Created new abandoned cart (trigger will create lead)');
        }
      }

      // Mark Step 2 attempt as successful
      try {
        await supabase.from('step2_submission_attempts')
          .update({ attempt_status: 'success' })
          .eq('session_id', sessionId)
          .eq('email', email.trim().toLowerCase())
          .eq('attempt_status', 'attempted');
      } catch { /* non-blocking */ }

      // Schedule SMS to be sent 10 minutes after quote submission
      try {
        console.log('Scheduling delayed SMS for:', phone);
        const sendAfter = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const { error: scheduleError } = await supabase
          .from('scheduled_sms')
          .insert({
            phone: phone.trim(),
            first_name: firstName.trim() || 'there',
            vehicle_make: vehicleData?.make || null,
            vehicle_model: vehicleData?.model || null,
            send_after: sendAfter,
          });
        
        if (scheduleError) {
          console.error('Error scheduling SMS:', scheduleError);
        } else {
          console.log('✅ SMS scheduled to send at:', sendAfter);
        }
      } catch (smsError) {
        console.error('Failed to schedule SMS:', smsError);
      }
    } catch (error) {
      console.error('Error in quote flow:', error);
      // Mark Step 2 attempt as failed
      try {
        await supabase.from('step2_submission_attempts')
          .update({ attempt_status: 'failed', error_message: String(error), error_source: 'quote_flow' })
          .eq('session_id', sessionId)
          .eq('email', email.trim().toLowerCase())
          .eq('attempt_status', 'attempted');
      } catch { /* non-blocking */ }
    }
    
    setSendingEmail(false);
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Proceed to step 3 with the collected data
    onNext({ 
      email: email.trim(), 
      phone: phone, 
      firstName: firstName.trim() || 'Valued Customer', 
      lastName: '',
      sendQuoteEmail: true
    });
  };

  return (
    <section className="bg-white min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
        {/* Main Heading */}

        <div className="text-center mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full mr-2">
              <Rocket className="w-4 h-4" />
            </span>
            Only 3 quick details for your best price
          </h1>
          <div className="flex items-center justify-center gap-3 mt-1">
            <button 
              type="button" 
              onClick={onBack}
              className="flex items-center gap-1 text-sm font-medium py-1 px-2.5 rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <p className="text-gray-700 flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-orange" />
              See your quote in a few seconds
            </p>
          </div>
        </div>

        {/* Vehicle Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 mb-6">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <div className="bg-[#FFD700] text-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded font-bold text-xs sm:text-sm tracking-wide border-2 border-black">
              {vehicleData.regNumber}
            </div>
            <div className="flex-1 min-w-0">
              {(vehicleData.make || vehicleData.model) && (
                <p className="font-semibold text-gray-900 text-sm sm:text-base">
                  {vehicleData.make} {vehicleData.model} {vehicleData.year && `(${vehicleData.year})`}
                </p>
              )}
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {parseInt(vehicleData.mileage) <= 120000 ? 'Under 120,000 miles' : 'Over 120,000 miles'}
                {vehicleData.fuelType && ` • ${vehicleData.fuelType}`}
                {vehicleData.transmission && ` • ${vehicleData.transmission}`}
              </p>
            </div>
            <button
              onClick={onBack}
              className="text-primary text-xs sm:text-sm font-medium hover:underline flex-shrink-0"
            >
              Edit
            </button>
          </div>
        </div>

        {vehicleData.blocked && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-semibold mb-1">Warranty Coverage Not Available</p>
            <p className="text-red-600 text-sm">
              {vehicleData.blockReason || "This vehicle isn't eligible due to specialist parts and a limited repair network."}
            </p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4 mb-6">
          {/* First Name Input */}
          <div className="pt-2">
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              Your first name
            </label>
            <div className="relative">
              <User className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${firstName && isValidFirstName ? 'text-gray-700' : 'text-gray-500'}`} />
              <input
                type="text"
                placeholder="e.g. John"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setFirstNameError('');
                }}
                autoComplete="given-name"
                data-ga4-event="step2_firstname_input"
                className={`w-full pl-12 pr-12 py-4 text-base placeholder:text-gray-500 border-2 rounded-xl focus:ring-0 focus:border-gray-500 focus:shadow-sm transition-all bg-gray-100 text-gray-700 font-bold ${
                  hasAttemptedSubmit && !isValidFirstName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {firstName && isValidFirstName && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" strokeWidth={2.5} />
                </div>
              )}
            </div>
            {firstNameError && (
              <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                <span className="inline-block w-1 h-1 bg-red-500 rounded-full"></span>
                {firstNameError}
              </p>
            )}
          </div>

          {/* Email Input - Shown by default */}
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              Your email address
            </label>
            <div className="relative">
              <Mail className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${email && isValidEmail ? 'text-gray-700' : 'text-gray-500'}`} />
              <input
                type="email"
                placeholder="e.g. john@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                data-ga4-event="step2_email_input"
                className={`w-full pl-12 pr-12 py-4 text-base placeholder:text-gray-500 border-2 rounded-xl focus:ring-0 focus:border-gray-500 focus:shadow-sm transition-all bg-gray-100 text-gray-700 font-bold ${
                  emailError || (email && !isValidEmail) ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {email && isValidEmail && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" strokeWidth={2.5} />
                </div>
              )}
            </div>
            {emailError && (
              <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                <span className="inline-block w-1 h-1 bg-red-500 rounded-full"></span>
                {emailError}
              </p>
            )}
            {!emailError && email && !isValidEmail && (
              <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                <span className="inline-block w-1 h-1 bg-red-500 rounded-full"></span>
                Please enter a valid email address
              </p>
            )}
          </div>
          
          {/* Phone Input - Always visible */}
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              Your mobile number
            </label>
            <div className="relative">
              <Phone className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${phone && isValidPhone ? 'text-gray-700' : 'text-gray-500'}`} />
              <input
                type="tel"
                placeholder="UK mobile number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError('');
                }}
                data-ga4-event="step2_phone_input"
                className={`w-full pl-12 pr-12 py-4 text-base placeholder:text-gray-500 border-2 rounded-xl focus:ring-0 focus:border-gray-500 focus:shadow-sm transition-all bg-gray-100 text-gray-700 font-bold ${
                  phoneError || (phone && !isValidPhone) ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {phone && isValidPhone && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" strokeWidth={2.5} />
                </div>
              )}
            </div>
            {(phoneError || (phone && !isValidPhone)) ? (
              <p className="text-red-500 text-xs mt-1.5">
                {phoneError || 'Please enter a valid UK phone number'}
              </p>
            ) : (
              <p className="text-gray-500 mt-1.5 text-sm">
                Unlock exclusive discounts and get expert advice
              </p>
            )}
          </div>
        </div>

        {/* Primary CTA */}
        <button 
          onClick={handleSubmit}
          disabled={vehicleData.blocked || sendingEmail}
          data-ga4-event="step2_show_price_click"
          className={`w-full flex items-center justify-center gap-2 text-white font-bold py-5 px-8 rounded-xl shadow-lg text-lg transition-colors ${
            vehicleData.blocked || sendingEmail 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-brand-orange hover:bg-black active:scale-[0.98] animate-cta-enhanced'
          }`}
        >
          {sendingEmail ? (
            'Sending...'
          ) : (
            <>
              Show my price now
              <ArrowRight className="w-6 h-6" strokeWidth={3} />
            </>
          )}
        </button>

        {/* Quick Benefits - Below CTA */}
        <div className="flex items-center justify-center gap-6 text-sm text-gray-600 mt-4">
          <span className="flex items-center gap-1.5">
            <Rocket className="w-4 h-4 text-brand-orange" />
            Instant quote
          </span>
          <span className="flex items-center gap-1.5">
            <Car className="w-4 h-4 text-brand-orange" />
            Tailored to your vehicle
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-brand-orange" />
            No obligation
          </span>
        </div>

        {/* Trust Line */}
        <div className="text-center mt-3 text-gray-500 text-sm">
          <p className="flex flex-col items-center justify-center gap-0.5">
            <span>🔒 We never share your details.</span>
            <span>100% privacy guaranteed</span>
          </p>
        </div>

        {/* Trustpilot Badge - Mobile only */}
        <div className="md:hidden mt-3 flex justify-center">
          <img src={trustpilotLogo} alt="Trustpilot 5 stars" className="h-auto w-20 object-contain" />
        </div>

        {/* Spacer for sticky footer on desktop */}
        <div className="hidden md:block h-20"></div>
      </div>

      {/* Mobile: Floating Action Button */}
      <HelpFAB />

      {/* Desktop: Branded Help Footer (hidden on mobile) */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 bg-white border-t-[3px] border-green-600/50 py-4 px-4 z-50">
        <div className="max-w-xl mx-auto">
          <p className="text-center text-gray-800 font-semibold text-sm mb-3">
            Need advice? We're here to help.
          </p>
          <div className="flex items-center justify-center gap-6 sm:gap-8">
            <a 
              href="tel:03302295040"
              className="flex items-center gap-2 text-gray-700 text-sm font-medium hover:text-brand-orange transition-colors"
            >
              <Phone className="w-5 h-5 text-brand-orange" />
              <span>0330 229 5040</span>
            </a>
            <button 
              onClick={() => setShowCallbackModal(true)}
              className="flex items-center gap-2 text-gray-700 text-sm font-medium hover:text-brand-orange transition-colors"
            >
              <PhoneCall className="w-5 h-5 text-brand-orange" />
              <span>Request Call-Back</span>
            </button>
          </div>
        </div>
      </div>

      <RequestCallbackModal 
        isOpen={showCallbackModal} 
        onClose={() => setShowCallbackModal(false)} 
      />

      {/* Success Popup */}
      <Dialog open={showSuccessPopup} onOpenChange={setShowSuccessPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 text-center">
              Quote Sent Successfully!
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600 mt-2">
              Thank you for your interest! Our team will contact you soon with the best warranty offers for your {vehicleData.make} {vehicleData.model}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <button
              onClick={() => setShowSuccessPopup(false)}
              className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-primary hover:bg-primary/90 transition-all"
            >
              Got it, thanks!
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default QuoteDeliveryStep;
