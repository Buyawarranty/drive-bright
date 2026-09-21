import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Check, Lock, Phone, CheckCircle, Zap, ArrowRight, Ban, BellOff, MessageCircle, Star, User, Car, Rocket, PhoneCall, Gauge, ChevronDown, ChevronUp, Info, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import { getStoredFbclid, getStoredFbReferrer, getSessionFbclid, getSessionFbReferrer } from '@/utils/fbclidCapture';
import { getSessionMsclkid } from '@/utils/msclkidCapture';
import { getSessionTtclid } from '@/utils/ttclidCapture';
import { getStoredGclid, getSessionOrUrlGclid, getAttributionGclid, getTrackingSessionId } from '@/utils/gclidCapture';
import { getSessionUtms, compactUtms } from '@/utils/utmCapture';
import { getAbVariant } from '@/utils/abVariant';
import MobileNavigation from '@/components/MobileNavigation';
import HelpFAB from '@/components/HelpFAB';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';
import { SALES_PHONE, SALES_PHONE_TEL } from '@/constants/contact';

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
    motMileage?: number;
    motDate?: string;
  };
  onNext: (data: { email: string; phone: string; firstName: string; lastName: string; sendQuoteEmail?: boolean }) => void;
  onBack: () => void;
  onSkip: () => void;
  onUpdateVehicle?: (partial: { mileage: string; motMileage: number }) => void;
}

const QuoteDeliveryStep: React.FC<QuoteDeliveryStepProps> = ({ vehicleData, onNext, onBack, onSkip, onUpdateVehicle }) => {
  const MILEAGE_RANGES: { label: string; value: string; min: number; max: number; mid: number }[] = [
    { label: 'Under 10,000 miles', value: '0-9999', min: 0, max: 9999, mid: 5000 },
    { label: '10,000 – 29,999 miles', value: '10000-29999', min: 10000, max: 29999, mid: 20000 },
    { label: '30,000 – 49,999 miles', value: '30000-49999', min: 30000, max: 49999, mid: 40000 },
    { label: '50,000 – 69,999 miles', value: '50000-69999', min: 50000, max: 69999, mid: 60000 },
    { label: '70,000 – 89,999 miles', value: '70000-89999', min: 70000, max: 89999, mid: 80000 },
    { label: '90,000 – 99,999 miles', value: '90000-99999', min: 90000, max: 99999, mid: 95000 },
    { label: '100,000 – 109,999 miles', value: '100000-109999', min: 100000, max: 109999, mid: 105000 },
    { label: '110,000 – 119,999 miles', value: '110000-119999', min: 110000, max: 119999, mid: 115000 },
    { label: '120,000 – 134,999 miles', value: '120000-134999', min: 120000, max: 134999, mid: 127000 },
    { label: '135,000 – 150,000 miles', value: '135000-150000', min: 135000, max: 150000, mid: 142000 },
  ];

  const findRangeForMileage = (n: number) =>
    MILEAGE_RANGES.find((r) => n >= r.min && n <= r.max)?.value || '';

  const [isEditingMileage, setIsEditingMileage] = useState(false);
  const initialMot = parseInt(vehicleData.mileage || '0', 10) || (vehicleData.motMileage || 0);
  const [mileageBand, setMileageBand] = useState<'under' | 'over'>(initialMot >= 120000 ? 'over' : 'under');
  const [mileageEditError, setMileageEditError] = useState('');
  const [mileageBandSaved, setMileageBandSaved] = useState<'under' | 'over' | null>(null);

  const handleSelectBand = (band: 'under' | 'over') => {
    const current = vehicleData.motMileage || parseInt(vehicleData.mileage || '0', 10) || 0;
    const n = band === 'under'
      ? (current > 0 && current < 120000 ? current : 100000)
      : (current >= 120000 && current <= 150000 ? current : 125000);
    setMileageBand(band);
    setMileageBandSaved(band);
    setMileageEditError('');
    onUpdateVehicle?.({ mileage: String(n), motMileage: n });
    setIsEditingMileage(false);
  };

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
  // A/B variant — in "B" the phone field is optional.
  const isVariantB = getAbVariant() === 'b';
  const phoneOkForSubmit = isVariantB
    ? (phone.trim() === '' || isValidPhone)
    : isValidPhone;
  const isFormValid = isValidFirstName && isValidEmail && phoneOkForSubmit;

  const handleSkipClick = async () => {
    try {
      if (email.trim()) {
        const skipFbclid = getSessionFbclid();
        const skipGclid = getSessionOrUrlGclid();
        const skipGclidAny = getAttributionGclid();
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
            step_abandoned: 2,
            ...(skipFbclid ? { fbclid: skipFbclid } : {}),
            ...(skipGclid ? { gclid: skipGclid } : {}),
            ...(skipGclidAny ? { gclid_any: skipGclidAny } : {}),
            ...(getTrackingSessionId() ? { tracking_session_id: getTrackingSessionId() } : {}),
            ...((() => { const ms = getSessionMsclkid(); return ms ? { msclkid: ms } : {}; })()),
            ...((() => { const tt = getSessionTtclid(); return tt ? { ttclid: tt } : {}; })()),
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
      // In variant B the phone is optional, so don't block submission.
      if (!isVariantB) setPhoneError('Please enter your phone number');
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
      // Send quote email in the background. It attaches two PDFs and can take
      // 7-15s — awaiting it left the button stuck on "Sending..." and blocked
      // the customer from reaching step 3.
      supabase.functions.invoke('send-quote-email', {
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
      }).then(({ error: quoteEmailError }) => {
        if (quoteEmailError) console.error('Error sending quote email:', quoteEmailError);
      }).catch((e) => console.error('Error sending quote email:', e));

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
      // Use SESSION-scoped attribution for cart_metadata so a stale 90-day-old
      // gclid/fbclid in localStorage doesn't reclassify organic visitors as paid.
      // Long-lived getStoredFbclid / getStoredGclid remain for conversion uploads only.
      const storedFbclid = getSessionFbclid();
      const storedGclid = getSessionOrUrlGclid();
      const attributionGclid = getAttributionGclid();
      const trackingSessionId = getTrackingSessionId();
      const storedMsclkid = getSessionMsclkid();
      const storedTtclid = getSessionTtclid();
      // Pull all 5 UTMs from session (utm_source/medium/campaign/term/content).
      // Fallback: if session is empty but URL still has them, read live.
      const sessionUtms = compactUtms(getSessionUtms());
      const liveParams = new URLSearchParams(window.location.search);
      const utms: Record<string, string> = { ...sessionUtms };
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach((k) => {
        if (!utms[k]) {
          const v = liveParams.get(k);
          if (v) utms[k] = v;
        }
      });
      const utmSource = utms.utm_source || null;
      
      let cartUpdated = false;
      
      if (regNumber) {
        // Find the most recent open abandoned cart for this vehicle via SECURITY DEFINER RPC
        // (avoids exposing the abandoned_carts table to anonymous SELECT).
        const { data: existingCartId } = await supabase
          .rpc('find_open_cart_id_by_reg', { _vehicle_reg: regNumber });

        if (existingCartId) {
          const { error: updateError } = await supabase
            .from('abandoned_carts')
            .update({
              email: normalizedEmail,
              full_name: firstName.trim(),
              phone: phone.trim() || null,
              step_abandoned: 2,
              updated_at: new Date().toISOString(),
              ...(() => {
                const fb = storedFbclid || getSessionFbclid();
                const gc = storedGclid || getSessionOrUrlGclid();
                const ms = storedMsclkid || getSessionMsclkid();
                const tt = storedTtclid || getSessionTtclid();
                const fbRef = !fb ? getSessionFbReferrer() : null;
                const abVariant: 'a' | 'b' = isVariantB ? 'b' : 'a';
                return {
                  cart_metadata: {
                    ...(fb ? { fbclid: fb } : {}),
                    ...(gc ? { gclid: gc } : {}),
                    ...(attributionGclid ? { gclid_any: attributionGclid } : {}),
                    ...(trackingSessionId ? { tracking_session_id: trackingSessionId } : {}),
                    ...(ms ? { msclkid: ms } : {}),
                    ...(tt ? { ttclid: tt } : {}),
                    ...utms,
                    ...(fbRef ? { fb_referrer: fbRef } : {}),
                    ab_variant: abVariant,
                  }
                };
              })()
            })
            .eq('id', existingCartId as string);

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
                const fbRef = !storedFbclid ? getSessionFbReferrer() : null;
                const abVariant: 'a' | 'b' = isVariantB ? 'b' : 'a';
                return {
                  cart_metadata: {
                    ...(storedFbclid ? { fbclid: storedFbclid } : {}),
                    ...(storedGclid ? { gclid: storedGclid } : {}),
                    ...(attributionGclid ? { gclid_any: attributionGclid } : {}),
                    ...(trackingSessionId ? { tracking_session_id: trackingSessionId } : {}),
                    ...(storedMsclkid ? { msclkid: storedMsclkid } : {}),
                    ...(storedTtclid ? { ttclid: storedTtclid } : {}),

                    ...utms,
                    ...(fbRef ? { fb_referrer: fbRef } : {}),
                    ab_variant: abVariant,
                  }
                };
              })())
          });

        if (cartInsertError) {
          console.error('Error creating abandoned cart, retrying via track-abandoned-cart edge function:', cartInsertError);

          const fallbackFbclid = getSessionFbclid();
          const fallbackGclid = getSessionOrUrlGclid();
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
              ...(attributionGclid ? { gclid_any: attributionGclid } : {}),
              ...(trackingSessionId ? { tracking_session_id: trackingSessionId } : {}),
              ...(storedMsclkid ? { msclkid: storedMsclkid } : {}),
              ...(storedTtclid ? { ttclid: storedTtclid } : {}),
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

      // Schedule SMS to be sent 90 seconds after quote submission
      // (guarded: only one welcome SMS per number per 30 days)
      try {
        const digits = phone.replace(/\D/g, '');
        const tail = digits.slice(-9);
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: existingSms } = await supabase
          .from('scheduled_sms')
          .select('id')
          .like('phone', `%${tail}`)
          .gte('created_at', since)
          .limit(1);

        if (existingSms && existingSms.length > 0) {
          console.log('Welcome SMS already queued/sent for this number — skipping');
        } else {
          console.log('Scheduling delayed SMS for:', phone);
          const sendAfter = new Date(Date.now() + 90 * 1000).toISOString();
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

  // ===== Variant B redesigned layout =====
  if (isVariantB) {
    return (
      <section className="bg-white min-h-[100dvh] pb-4 mobile-quote-page">
        <div className="max-w-xl mx-auto mobile-quote-card pt-3 sm:pt-8">
          <div className="flex items-start gap-2.5 mb-2 sm:mb-1">
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back to the previous step"
              className="flex-shrink-0 inline-flex items-center gap-1.5 mt-1 text-sm font-semibold py-1.5 px-3 rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-start gap-2.5 flex-1">
              <span className="inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-brand-orange text-white shadow-md flex-shrink-0">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" />
              </span>
              <h1 className="mq-heading sm:!text-4xl font-extrabold text-gray-900 leading-tight">
                Only 3 quick details to see your quote
              </h1>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mb-3 sm:mb-5">
            <p className="text-gray-700 flex items-center gap-2 text-sm sm:text-base">
              <Zap className="w-4 h-4 text-brand-orange" fill="currentColor" />
              Your price is seconds away
            </p>
          </div>

          {/* Vehicle summary card */}
          <div className="border border-gray-200 rounded-xl p-2.5 sm:p-4 mb-3 sm:mb-6 flex items-center gap-3 sm:gap-4">
            <div className="bg-[#FFD11A] text-black px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-md font-extrabold text-sm sm:text-base tracking-wider border-2 border-black flex-shrink-0">
              {vehicleData.regNumber}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm sm:text-lg uppercase truncate">
                {vehicleData.make} {vehicleData.model} {vehicleData.year && `(${vehicleData.year})`}
              </p>
              {vehicleData.fuelType && (
                <p className="text-xs sm:text-sm text-gray-500 capitalize">{vehicleData.fuelType.toLowerCase()}</p>
              )}
            </div>
            <button
              onClick={onBack}
              className="text-brand-orange text-sm font-semibold hover:underline flex items-center gap-1 flex-shrink-0"
            >
              Edit
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
          </div>

          {vehicleData.blocked && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-800 font-semibold mb-1">Warranty Coverage Not Available</p>
              <p className="text-red-600 text-sm">
                {vehicleData.blockReason || "This vehicle isn't eligible due to specialist parts and a limited repair network."}
              </p>
            </div>
          )}

          {/* First name */}
          <div className="mb-2 sm:mb-5">
            <label className="block font-bold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">Your first name</label>
            <div className="relative">
              <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${firstName && isValidFirstName ? 'text-gray-700' : 'text-gray-500'}`} />
              <input
                type="text"
                placeholder="e.g. John"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setFirstNameError(''); }}
                autoComplete="given-name"
                data-ga4-event="step2_firstname_input"
                className={`mq-input w-full pl-12 pr-12 py-2.5 sm:py-3.5 text-base placeholder:text-gray-500 border-2 rounded-xl focus:ring-0 focus:border-gray-500 focus:shadow-sm transition-all bg-gray-100 text-gray-700 font-bold ${
                  hasAttemptedSubmit && !isValidFirstName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {firstName && isValidFirstName && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" strokeWidth={2.5} />
                </div>
              )}
            </div>
            {firstNameError && <p className="text-red-500 text-sm mt-1.5">{firstNameError}</p>}
          </div>

          {/* Email */}
          <div className="mb-2 sm:mb-5">
            <label className="block font-bold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">Your email address</label>
            <div className="relative">
              <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${email && isValidEmail ? 'text-gray-700' : 'text-gray-500'}`} />
              <input
                type="email"
                placeholder="e.g. john@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                data-ga4-event="step2_email_input"
                className={`mq-input w-full pl-12 pr-12 py-2.5 sm:py-3.5 text-base placeholder:text-gray-500 border-2 rounded-xl focus:ring-0 focus:border-gray-500 focus:shadow-sm transition-all bg-gray-100 text-gray-700 font-bold ${
                  emailError || (email && !isValidEmail) ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {email && isValidEmail && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" strokeWidth={2.5} />
                </div>
              )}
            </div>
            {emailError && <p className="text-red-500 text-sm mt-1.5">{emailError}</p>}
            {!emailError && email && !isValidEmail && (
              <p className="text-red-500 text-sm mt-1.5">Please enter a valid email address</p>
            )}
          </div>

          {/* Mobile number (optional) */}
          <div className="mb-2">
            <label className="block font-bold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">
              Your mobile number <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <div className="relative">
              <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${phone && isValidPhone ? 'text-gray-700' : 'text-gray-500'}`} />
              <input
                type="tel"
                placeholder="UK mobile number"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(''); }}
                data-ga4-event="step2_phone_input"
                className={`mq-input w-full pl-12 pr-12 py-2.5 sm:py-3.5 text-base placeholder:text-gray-500 border-2 rounded-xl focus:ring-0 focus:border-gray-500 focus:shadow-sm transition-all bg-gray-100 text-gray-700 font-bold ${
                  phoneError || (phone && !isValidPhone) ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {phone && isValidPhone && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" strokeWidth={2.5} />
                </div>
              )}
            </div>
            <p className="hidden sm:block text-sm text-gray-500 mt-2">
              Add your number if you'd like help with your quote. No cold calling.
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={handleSubmit}
            disabled={vehicleData.blocked || sendingEmail}
            data-ga4-event="step2_show_price_click"
            className={`mq-cta w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 sm:py-5 px-8 rounded-xl shadow-md text-base sm:text-lg mt-3 sm:mt-6 ${
              vehicleData.blocked || sendingEmail
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-brand-orange hover:bg-brand-orange/90 animate-breathing'
            }`}
          >
            {sendingEmail ? 'Sending...' : (
              <>
                Show my price now
                <ArrowRight className="w-6 h-6" strokeWidth={3} />
              </>
            )}
          </button>

          {/* Trust pills */}
          <div className="hidden sm:flex items-center justify-center divide-x divide-gray-200 mt-5 text-sm text-gray-700">
            <div className="flex items-center gap-1.5 px-3">
              <Zap className="w-4 h-4 text-brand-orange" fill="currentColor" /> Instant quote
            </div>
            <div className="flex items-center gap-1.5 px-3">
              <Car className="w-4 h-4 text-brand-orange" /> Tailored to your vehicle
            </div>
            <div className="flex items-center gap-1.5 px-3">
              <ShieldCheck className="w-4 h-4 text-brand-orange" /> No obligation
            </div>
          </div>

          {/* Privacy + call CTA */}
          <div className="text-center text-xs sm:text-sm text-gray-600 mt-2 sm:mt-4 mq-trust-row">
            <p className="flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4" />
              We never share your details.
            </p>
            <p className="mt-1.5">
              Prefer to speak to someone?{' '}
              <a href={SALES_PHONE_TEL} className="font-bold text-brand-orange hover:underline whitespace-nowrap">
                Call {SALES_PHONE}
              </a>
            </p>
          </div>


          {/* Reassurance block – appears on tall screens to fill empty space */}
          <div className="mq-post-cta hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 text-sm text-gray-700">
            <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-[#00B67A]" fill="#00B67A" /> Rated Excellent on Trustpilot</span>
            </div>

          {/* Help footer – desktop only */}
          <div className="hidden sm:block bg-gray-50 rounded-xl mt-6 px-5 py-4 text-center">
            <p className="font-bold text-gray-900 mb-1">15+ years experience helping UK drivers</p>
            <div className="flex items-center justify-center gap-3 text-sm">
              <a href={SALES_PHONE_TEL} className="flex items-center gap-1.5 font-bold text-gray-900 hover:underline">
                <Phone className="w-4 h-4 text-brand-orange" />
                {SALES_PHONE}
              </a>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">Mon–Fri 9am–6pm</span>
            </div>
          </div>
        </div>

        <RequestCallbackModal isOpen={showCallbackModal} onClose={() => setShowCallbackModal(false)} />
      </section>
    );
  }

  return (
    <section className="bg-white min-h-[100dvh] mobile-quote-page">
      <div className="max-w-xl mx-auto mobile-quote-card py-3 sm:py-4">
        {/* Main Heading */}

        <div className="mb-4 sm:mb-3">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back to the previous step"
              className="flex-shrink-0 inline-flex items-center gap-1.5 mt-1 text-sm font-semibold py-1.5 px-3 rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <h1 className="flex-1 text-2xl sm:text-3xl font-bold text-gray-900 text-center">
              <span className="inline-flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full mr-2">
                <Rocket className="w-4 h-4" />
              </span>
              Only 3 quick details for your best price
            </h1>
          </div>
          <div className="flex items-center justify-center gap-3 mt-1">
            <p className="text-gray-700 flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-orange" />
              Your price is seconds away
            </p>
          </div>
        </div>

        {/* Combined Vehicle + Mileage Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl mb-6 sm:mb-3 overflow-hidden">
          {/* Vehicle row */}
          <div className="p-3 sm:p-4">
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
                {(vehicleData.fuelType || vehicleData.transmission) && (
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {[vehicleData.fuelType, vehicleData.transmission].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>
              <button
                onClick={onBack}
                className="text-primary text-xs sm:text-sm font-medium hover:underline flex-shrink-0"
              >
                Edit
              </button>
            </div>
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
        <div className="space-y-2 sm:space-y-2.5 mb-3 sm:mb-3">
          {/* First Name Input */}
          <div className="pt-1 sm:pt-0">
            <label className="block text-sm sm:text-base font-semibold text-gray-800 mb-1">
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
                className={`mq-input w-full pl-12 pr-12 py-2.5 text-base placeholder:text-gray-500 border-2 rounded-xl focus:ring-0 focus:border-gray-500 focus:shadow-sm transition-all bg-gray-100 text-gray-700 font-bold ${
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
            <label className="block text-sm sm:text-base font-semibold text-gray-800 mb-1">
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
                className={`mq-input w-full pl-12 pr-12 py-2.5 text-base placeholder:text-gray-500 border-2 rounded-xl focus:ring-0 focus:border-gray-500 focus:shadow-sm transition-all bg-gray-100 text-gray-700 font-bold ${
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
            <label className="block text-sm sm:text-base font-semibold text-gray-800 mb-1">
              Your mobile number{isVariantB && <span className="text-sm font-normal text-gray-500 ml-2">(optional)</span>}
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
                className={`mq-input w-full pl-12 pr-12 py-2.5 text-base placeholder:text-gray-500 border-2 rounded-xl focus:ring-0 focus:border-gray-500 focus:shadow-sm transition-all bg-gray-100 text-gray-700 font-bold ${
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
              <p className="hidden sm:block text-gray-500 mt-1.5 text-sm">
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
          className={`mq-cta w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg text-base sm:text-lg ${
            vehicleData.blocked || sendingEmail 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-brand-orange hover:bg-brand-orange/90 animate-breathing'
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

        {/* Quick Benefits - Below CTA (desktop) */}
        <div className="hidden sm:flex items-center justify-center gap-6 text-sm text-gray-600 mt-2">
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

        {/* Trust Line + Call CTA */}
        <div className="text-center mt-2 text-gray-600 text-xs sm:text-sm mq-trust-row">
          <p className="flex items-center justify-center gap-1">
            <span>🔒 We never share your details.</span>
          </p>

          <p className="mt-1">
            <span className="text-gray-600">Prefer to speak to someone? </span>
            <a href={SALES_PHONE_TEL} className="font-bold text-brand-orange hover:underline whitespace-nowrap">
              Call {SALES_PHONE}
            </a>
          </p>
          <p className="mt-1 text-gray-500">15+ years experience helping UK drivers</p>
        </div>

        {/* Reassurance block – appears on tall screens to fill empty space */}
        <div className="mq-post-cta hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4 text-sm text-gray-700">
          <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-[#00B67A]" fill="#00B67A" /> Rated Excellent on Trustpilot</span>
          
        </div>

        {/* Trustpilot Badge - Mobile only */}
        <div className="md:hidden mt-2 flex justify-center">
          <img src={trustpilotLogo} alt="Trustpilot 5 stars" className="h-auto w-16 object-contain" />
        </div>

      </div>

      {/* Mobile: Floating Action Button */}
      <HelpFAB />


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
