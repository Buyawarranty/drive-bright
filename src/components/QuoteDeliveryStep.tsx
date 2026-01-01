import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Zap, Mail, Car, Edit3, Check, Lock, Phone, CheckCircle, X } from 'lucide-react';
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
  const [showContactForm, setShowContactForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    phone: false
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const handleSkipClick = async () => {
    // Track abandoned cart only if we have a valid email
    try {
      if (email.trim()) {
        await supabase.functions.invoke('track-abandoned-cart', {
          body: {
            full_name: `${firstName} ${lastName}`.trim() || email.trim(),
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
    
    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Small delay to let confetti start before navigating
    setTimeout(() => {
      onSkip();
    }, 300);
  };

  const handleEmailQuoteClick = () => {
    setShowContactForm(true);
  };

  const validateForm = () => {
    const newErrors = {
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    };

    if (!email.trim()) {
      newErrors.email = 'Enter email address';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter a valid email address';
    }

    setErrors(newErrors);
    return !newErrors.email;
  };

  const handleSubmitContactForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSendingEmail(true);

    try {
      // Send quote email
      console.log('QUOTE EMAIL: Sending quote email with data:', {
        email: email.trim(),
        vehicleData,
        currentUrl: window.location.href,
        origin: window.location.origin
      });

      const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-quote-email', {
        body: {
          email: email.trim(),
          firstName: firstName.trim() || 'Valued Customer',
          lastName: lastName.trim() || '',
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
        console.error('QUOTE EMAIL: Error sending quote email:', emailError);
        // Still proceed with the flow even if email fails
      } else {
        console.log('QUOTE EMAIL: Quote email sent successfully:', emailResponse);
      }

      // Track abandoned cart if email is provided
      if (email.trim()) {
        try {
          await supabase.functions.invoke('track-abandoned-cart', {
            body: {
              full_name: email,
              email: email,
              phone: '',
              vehicle_reg: vehicleData?.regNumber,
              vehicle_make: vehicleData?.make,
              vehicle_model: vehicleData?.model,
              vehicle_year: vehicleData?.year,
              mileage: vehicleData?.mileage,
              step_abandoned: 2
            }
          });
        } catch (error) {
          console.error('Error tracking abandoned cart:', error);
        }
      }
      
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      // Small delay to let confetti start before navigating
      setTimeout(() => {
        onNext({ firstName: '', lastName: '', email: email.trim(), phone: '', sendQuoteEmail: true });
      }, 300);

    } catch (error) {
      console.error('Error in quote submission:', error);
      // Still proceed with the flow
      setTimeout(() => {
        onNext({ firstName: '', lastName: '', email: email.trim(), phone: '', sendQuoteEmail: true });
      }, 300);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleFieldBlur = (field: 'firstName' | 'lastName' | 'email' | 'phone') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateForm();
  };

  const isFormValid = email.trim() && !errors.email;
  const areRequiredFieldsFilled = true; // No longer needed but keeping for compatibility

  return (
    <section className="bg-[#e8f4fb] py-1 sm:py-6 min-h-screen px-2 sm:px-0">
      
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-3 sm:p-12 relative">
        {/* Header with Back Button and Mobile Menu */}
        <div className="flex justify-between items-center mb-2 sm:mb-6">
          <div className="flex-1">
            <button 
              type="button" 
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200 bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Back
            </button>
          </div>
          <div className="flex-1 flex justify-end">
            <MobileNavigation />
          </div>
        </div>

        {/* Vehicle Details Section - Orange Gradient Header + Labelled Grid */}
        <div className="rounded-xl overflow-hidden mb-2 sm:mb-4">
          {/* Orange Header */}
          <div className="p-3 sm:p-4" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="bg-green-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-sm sm:text-lg tracking-wide shadow-md">
                  {vehicleData.regNumber}
                </div>
                <button
                  onClick={onBack}
                  className="text-white/80 hover:text-white text-xs sm:text-sm underline transition-colors"
                >
                  Edit vehicle details
                </button>
              </div>
              
              <h3 className="text-white font-bold text-base sm:text-xl tracking-wide">
                {vehicleData.make?.toUpperCase()} {vehicleData.model?.toUpperCase()}, {vehicleData.year}
              </h3>
              
              <div className="hidden sm:flex items-center gap-6 text-white/90 text-sm">
                {vehicleData.fuelType && (
                  <div className="text-center">
                    <div className="text-white/70 text-xs uppercase tracking-wide">Fuel Type</div>
                    <div className="font-semibold">{vehicleData.fuelType}</div>
                  </div>
                )}
                {vehicleData.transmission && (
                  <div className="text-center">
                    <div className="text-white/70 text-xs uppercase tracking-wide">Transmission</div>
                    <div className="font-semibold">{vehicleData.transmission}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Labelled Vehicle Details Grid */}
          <div className="bg-gray-50 p-3 sm:p-5 border border-gray-200 border-t-0 rounded-b-xl">
            <div className="grid grid-cols-3 gap-3 sm:gap-6 text-xs sm:text-sm">
              <div>
                <span className="text-gray-500 font-medium">Reg:</span>
                <div className="font-bold text-gray-900 mt-0.5">{vehicleData.regNumber}</div>
              </div>
              {vehicleData.make && (
                <div>
                  <span className="text-gray-500 font-medium">Make:</span>
                  <div className="font-bold text-gray-900 mt-0.5">{vehicleData.make.toUpperCase()}</div>
                </div>
              )}
              {vehicleData.model && (
                <div>
                  <span className="text-gray-500 font-medium">Model:</span>
                  <div className="font-bold text-gray-900 mt-0.5">{vehicleData.model.toUpperCase()}</div>
                </div>
              )}
              {vehicleData.year && (
                <div>
                  <span className="text-gray-500 font-medium">Year:</span>
                  <div className="font-bold text-gray-900 mt-0.5">{vehicleData.year}</div>
                </div>
              )}
              <div>
                <span className="text-gray-500 font-medium">Mileage:</span>
                <div className="font-bold text-gray-900 mt-0.5">{vehicleData.mileage}</div>
              </div>
              {vehicleData.fuelType && (
                <div>
                  <span className="text-gray-500 font-medium">Fuel:</span>
                  <div className="font-bold text-gray-900 mt-0.5">{vehicleData.fuelType}</div>
                </div>
              )}
            </div>
          </div>
          
          {vehicleData.blocked && (
            <div className="bg-red-600 px-3 sm:px-6 py-2 sm:py-3">
              <p className="text-white font-bold text-xs sm:text-base mb-0.5">Warranty Coverage Not Available</p>
              <p className="text-red-100 text-xs sm:text-sm">
                {vehicleData.blockReason || "Sorry about this - this vehicle isn't eligible due to specialist parts and a limited repair network."}
              </p>
            </div>
          )}
        </div>
        
        {/* Divider */}
        <div className="border-t border-gray-200 my-2 sm:my-4"></div>

        {!showContactForm ? (
          <>
            <div className="text-center mb-3 sm:mb-8">
              <h1 className="text-lg sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-4 leading-tight">
                Great, your {vehicleData.make} {vehicleData.model} details are confirmed!
              </h1>
              <p className="text-sm sm:text-lg text-gray-600">
                Now let's get your instant warranty quote.
              </p>
            </div>

            <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-8">
              {/* Primary option - Email & Phone fields with Get My Quote */}
              <div className="space-y-3 sm:space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all ${
                      email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'border-green-500' : 'border-gray-300'
                    }`}
                  />
                  {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                    <CheckCircle className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                  )}
                </div>
                
                <div className="relative">
                  <Phone className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all ${
                      phone && phone.length >= 10 ? 'border-green-500' : 'border-gray-300'
                    }`}
                  />
                  {phone && phone.length >= 10 && (
                    <CheckCircle className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                  )}
                </div>
                
                <button 
                  onClick={async () => {
                    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
                      return;
                    }
                    
                    setSendingEmail(true);
                    
                    try {
                      // Send quote email
                      console.log('QUOTE EMAIL: Sending quote email with data:', {
                        email: email.trim(),
                        vehicleData,
                        currentUrl: window.location.href,
                        origin: window.location.origin
                      });

                      const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-quote-email', {
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
                        console.error('QUOTE EMAIL: Error sending quote email:', emailError);
                      } else {
                        console.log('QUOTE EMAIL: Quote email sent successfully:', emailResponse);
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
                    } catch (error) {
                      console.error('Error in quote flow:', error);
                    }
                    
                    setSendingEmail(false);
                    
                    // Trigger confetti
                    confetti({
                      particleCount: 100,
                      spread: 70,
                      origin: { y: 0.6 }
                    });
                    
                    // Show success popup instead of proceeding to next step
                    setShowSuccessPopup(true);
                  }}
                  disabled={vehicleData.blocked || !email.trim() || !/\S+@\S+\.\S+/.test(email) || sendingEmail}
                  className={`w-full flex items-center justify-center text-white font-bold py-3 sm:py-5 px-4 sm:px-8 rounded-xl transition-all duration-200 shadow-lg ${
                    vehicleData.blocked || !email.trim() || !/\S+@\S+\.\S+/.test(email) || sendingEmail ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  style={{ backgroundColor: vehicleData.blocked || !email.trim() || sendingEmail ? '#9ca3af' : '#f97316' }}
                  onMouseEnter={(e) => {
                    if (!vehicleData.blocked && email.trim() && !sendingEmail) {
                      e.currentTarget.style.backgroundColor = '#ea580c';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!vehicleData.blocked && email.trim() && !sendingEmail) {
                      e.currentTarget.style.backgroundColor = '#f97316';
                    }
                  }}
                >
                  <span className="text-base sm:text-xl">
                    {sendingEmail ? 'Sending...' : 'Get My Quote'}
                  </span>
                </button>
                
                <p className="text-center text-xs sm:text-sm text-gray-500 flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                  Your information is safe & secure
                </p>
              </div>

              <div className="relative my-3 sm:my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 sm:px-6 py-1 sm:py-2 text-gray-700 text-sm sm:text-lg font-semibold border border-gray-300 rounded-full">
                    or
                  </span>
                </div>
              </div>

              {/* Secondary option - View my quote now (Blue) */}
              <button 
                onClick={handleSkipClick}
                disabled={vehicleData.blocked}
                className={`w-full flex items-center justify-center text-white font-bold py-3 sm:py-5 px-4 sm:px-8 rounded-xl transition-all duration-200 relative shadow-lg ${
                  vehicleData.blocked ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{ backgroundColor: vehicleData.blocked ? '#9ca3af' : '#224380' }}
                onMouseEnter={(e) => {
                  if (!vehicleData.blocked) {
                    e.currentTarget.style.backgroundColor = '#1e3a70';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!vehicleData.blocked) {
                    e.currentTarget.style.backgroundColor = '#224380';
                  }
                }}
              >
                <Zap className="w-4 h-4 sm:w-6 sm:h-6 absolute left-3 sm:left-8" />
                <div className="text-center px-6 sm:px-12">
                  <div className="text-sm sm:text-xl leading-tight">
                    View my quote now
                  </div>
                </div>
                <span className="text-lg sm:text-2xl absolute right-3 sm:right-8">→</span>
              </button>
            </div>

          </>
        ) : (
          <>
            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-3 sm:mb-4">See your prices instantly ⚡ & get them by email</h2>
            </div>

            <form onSubmit={handleSubmitContactForm}>
              <div className="mb-6 sm:mb-8">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className={`w-full border-2 rounded-[6px] px-[12px] sm:px-[16px] py-[12px] sm:py-[14px] pr-12 focus:outline-none transition-all duration-200 text-base placeholder:text-gray-500 ${
                      touched.email && errors.email ? 'border-red-500' : email.trim() && /\S+@\S+\.\S+/.test(email) ? 'border-green-500' : 'border-gray-400'
                    }`}
                    onFocus={(e) => {
                      e.target.style.borderColor = touched.email && errors.email ? '#ef4444' : '#224380';
                    }}
                    onBlur={(e) => {
                      handleFieldBlur('email');
                      const isValid = email.trim() && /\S+@\S+\.\S+/.test(email);
                      e.target.style.borderColor = touched.email && errors.email ? '#ef4444' : isValid ? '#22c55e' : '#d1d5db';
                    }}
                    required
                  />
                  {email.trim() && /\S+@\S+\.\S+/.test(email) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                {touched.email && errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
                <p className="text-gray-500 text-sm mt-2 text-center">No spam. Unsubscribe anytime.</p>
              </div>

              <div className="flex justify-end items-center">
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      // Trigger confetti
                      confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                      });
                      
                      // Small delay to let confetti start before navigating
                      setTimeout(() => {
                        onSkip();
                      }, 300);
                    }}
                    className="flex items-center justify-center gap-2 text-sm sm:text-base font-medium py-3 sm:py-3 px-4 sm:px-6 rounded-lg border-2 transition-all duration-200 hover-scale"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: '#d1d5db',
                      color: '#6b7280'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#9ca3af';
                      e.currentTarget.style.color = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.color = '#6b7280';
                    }}
                  >
                    Skip this step
                  </button>
                  
                  <button 
                    type="submit" 
                    disabled={!!errors.email || sendingEmail}
                    title={sendingEmail ? "Processing..." : ""}
                    className="flex items-center justify-center gap-2 text-white text-base sm:text-lg font-bold py-3 sm:py-3 px-6 sm:px-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      backgroundColor: '#eb4b00'
                    }}
                    onMouseEnter={(e) => {
                      if (!errors.email && !sendingEmail) {
                        e.currentTarget.style.backgroundColor = '#d43f00';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!errors.email && !sendingEmail) {
                        e.currentTarget.style.backgroundColor = '#eb4b00';
                      }
                    }}
                  >
                    {sendingEmail ? 'Processing...' : 'See prices'}
                    {!sendingEmail && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
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
              className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200"
              style={{ backgroundColor: '#f97316' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ea580c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f97316'}
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