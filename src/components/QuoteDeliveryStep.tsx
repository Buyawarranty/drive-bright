import React, { useState } from 'react';
import { ArrowLeft, Mail, Check, Lock, Phone, CheckCircle, Zap, ArrowRight, Ban, BellOff, MessageCircle, Star } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import MobileNavigation from '@/components/MobileNavigation';
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
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidPhone = /^(?:(?:\+44\s?|0)7\d{9}|(?:\+44\s?|0)[1-9]\d{8,9})$/.test(phone.replace(/\s/g, ''));
  const isFormValid = isValidEmail && isValidPhone;

  const handleSkipClick = async () => {
    try {
      if (email.trim()) {
        await supabase.functions.invoke('track-abandoned-cart', {
          body: {
            full_name: email.trim(),
            email: email.trim(),
            phone: phone || '',
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
    setEmailError('');
    setPhoneError('');
    
    // Validate and show errors
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
    
    try {
      // Send quote email
      const { error: emailError } = await supabase.functions.invoke('send-quote-email', {
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

      if (emailError) {
        console.error('Error sending quote email:', emailError);
      }

      // Track abandoned cart
      await supabase.functions.invoke('track-abandoned-cart', {
        body: {
          full_name: email.trim(),
          email: email.trim(),
          phone: phone || '',
          vehicle_reg: vehicleData?.regNumber,
          vehicle_make: vehicleData?.make,
          vehicle_model: vehicleData?.model,
          vehicle_year: vehicleData?.year,
          mileage: vehicleData?.mileage,
          step_abandoned: 2
        }
      });

      // Create lead in sales_leads table
      const { data: nextUserId } = await supabase.rpc('get_next_sales_user');
      
      const { data: existingLead } = await supabase
        .from('sales_leads')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      
      if (!existingLead) {
        await supabase
          .from('sales_leads')
          .insert({
            email: email.trim().toLowerCase(),
            phone: phone || null,
            lead_source: 'website',
            status: 'new',
            priority: 'medium',
            plan_interest: 'Quote Requested',
            vehicle_reg: vehicleData?.regNumber || null,
            vehicle_make: vehicleData?.make || null,
            vehicle_model: vehicleData?.model || null,
            vehicle_year: vehicleData?.year || null,
            vehicle_type: vehicleData?.vehicleType || 'car',
            mileage: vehicleData?.mileage || null,
            assigned_to: nextUserId || null,
            assigned_at: nextUserId ? new Date().toISOString() : null,
            next_action_type: 'call',
            next_action_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            notes: `Quote requested via website. Vehicle: ${vehicleData?.make} ${vehicleData?.model} (${vehicleData?.regNumber}).`,
            last_activity_date: new Date().toISOString()
          });
      } else {
        await supabase
          .from('sales_leads')
          .update({ 
            last_activity_date: new Date().toISOString(),
            notes: `Quote re-requested. Vehicle: ${vehicleData?.make} ${vehicleData?.model} (${vehicleData?.regNumber})`
          })
          .eq('id', existingLead.id);
      }
    } catch (error) {
      console.error('Error in quote flow:', error);
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
      firstName: 'Valued Customer', 
      lastName: '',
      sendQuoteEmail: true
    });
  };

  return (
    <section className="bg-white min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex justify-start items-center mb-6">
          <button 
            type="button" 
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium py-2 px-3 rounded-lg transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Vehicle Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 mb-6">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <div className="bg-[#FFD700] text-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded font-bold text-xs sm:text-sm tracking-wide border-2 border-black">
              {vehicleData.regNumber}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm sm:text-base">
                {vehicleData.make} {vehicleData.model}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {vehicleData.year} • {parseInt(vehicleData.mileage) <= 120000 ? 'Under 120k miles' : 'Over 120k miles'} • {vehicleData.fuelType}
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

        {/* Main Content */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            🎉 Your warranty quote is ready!
          </h1>
          <p className="text-gray-600 mb-3">
            Enter your email and phone to get your quote instantly.
          </p>
          {/* Quick Benefits */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-brand-orange" />
              Instant quote
            </span>
            <span className="flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-brand-orange" />
              No obligation
            </span>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 mb-6">
          {/* Email Input */}
          <div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                data-ga4-event="step2_email_input"
                className={`w-full pl-12 pr-12 py-4 text-base text-gray-900 placeholder:text-gray-500 border-2 rounded-xl focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all bg-white ${
                  emailError ? 'border-red-500' : email && isValidEmail ? 'border-green-600' : 'border-gray-400'
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
          </div>
          
          {/* Phone Input - Progressive Disclosure */}
          {isValidEmail && (
            <div className="animate-fade-in">
              <p className="text-sm text-gray-600 mb-2">
                ✨ Great! Add your phone to unlock exclusive discounts and expert advice.
              </p>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="tel"
                  placeholder="UK mobile number"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError('');
                  }}
                  data-ga4-event="step2_phone_input"
                  className={`w-full pl-12 pr-12 py-4 text-base text-gray-900 placeholder:text-gray-500 border-2 rounded-xl focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all bg-white ${
                    phoneError ? 'border-red-500' : phone && isValidPhone ? 'border-green-600' : 'border-gray-400'
                  }`}
                />
                {phone && isValidPhone && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" strokeWidth={2.5} />
                  </div>
                )}
              </div>
              {phoneError && (
                <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 bg-red-500 rounded-full"></span>
                  {phoneError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Primary CTA */}
        <button 
          onClick={handleSubmit}
          disabled={vehicleData.blocked || sendingEmail}
          data-ga4-event="step2_show_price_click"
          className={`w-full flex items-center justify-center gap-2 text-white font-bold py-5 px-8 rounded-xl shadow-lg text-lg ${
            vehicleData.blocked || sendingEmail 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-brand-orange hover:bg-orange-600 active:scale-[0.98] animate-cta-enhanced'
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

        {/* Trust Line */}
        <div className="text-center mt-4 text-gray-500 text-sm">
          <p className="flex items-center justify-center gap-1">
            <span>🔒 We never share your details. 100% privacy guaranteed</span>
          </p>
        </div>

        {/* Spacer for sticky footer */}
        <div className="h-32"></div>
      </div>

      {/* Branded Help Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-200 py-4 px-4 z-50">
        <div className="max-w-xl mx-auto">
          <p className="text-center text-gray-700 font-medium text-sm mb-3">
            Need advice? Have any questions?
          </p>
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <a 
              href="tel:03302295040"
              className="flex items-center gap-1.5 text-gray-700 text-sm hover:text-brand-orange transition-colors"
            >
              <Phone className="w-4 h-4 text-brand-orange" />
              <span>0330 229 5040</span>
            </a>
            <a 
              href="https://wa.me/447960109395" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-gray-700 text-sm hover:text-green-600 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-green-600" />
              <span>WhatsApp</span>
            </a>
            <a 
              href="https://uk.trustpilot.com/review/warrantywise.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-gray-700 text-sm hover:text-green-600 transition-colors"
            >
              <Star className="w-4 h-4 text-green-600 fill-green-600" />
              <span>Trustpilot</span>
            </a>
          </div>
        </div>
      </div>

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
