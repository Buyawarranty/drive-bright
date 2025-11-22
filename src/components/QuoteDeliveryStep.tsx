import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Zap, Mail, Car, Edit3 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import MobileNavigation from '@/components/MobileNavigation';

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
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
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
    <section className="bg-[#e8f4fb] py-4 sm:py-6 min-h-screen px-3 sm:px-0">
      
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-4 sm:p-12 relative">
        {/* Header with Back Button and Mobile Menu */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex-1">
            <button 
              type="button" 
              onClick={onBack}
              className="flex items-center gap-2 text-base font-medium py-2 px-4 rounded-lg border transition-all duration-200 bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
          <div className="flex-1 flex justify-end">
            <MobileNavigation />
          </div>
        </div>

        {/* Vehicle Details Section */}
        <div className="bg-gray-100 rounded-lg p-3 sm:p-6 mb-2 sm:mb-4 border border-gray-300">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Car className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500" />
              <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">Your vehicle details</h3>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base font-medium text-orange-600 hover:text-orange-700 transition-colors duration-200 py-1 px-2 rounded"
            >
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xs:inline">Change Vehicle</span>
              <span className="xs:hidden">Change</span>
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            <div className="flex flex-col p-2 sm:p-0">
              <span className="text-sm sm:text-base text-gray-500 font-medium">Registration</span>
              <span className="text-base sm:text-lg font-semibold text-gray-900 break-all">{vehicleData.regNumber}</span>
            </div>
            
            {vehicleData.make && (
              <div className="flex flex-col p-2 sm:p-0">
                <span className="text-sm sm:text-base text-gray-500 font-medium">Make</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">{vehicleData.make}</span>
              </div>
            )}
            
            {vehicleData.model && (
              <div className="flex flex-col p-2 sm:p-0">
                <span className="text-sm sm:text-base text-gray-500 font-medium">Model</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">{vehicleData.model}</span>
              </div>
            )}
            
            {vehicleData.year && (
              <div className="flex flex-col p-2 sm:p-0">
                <span className="text-sm sm:text-base text-gray-500 font-medium">Year</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">{vehicleData.year}</span>
              </div>
            )}
            
            <div className="flex flex-col p-2 sm:p-0">
              <span className="text-sm sm:text-base text-gray-500 font-medium">Mileage</span>
              <span className="text-base sm:text-lg font-semibold text-gray-900">{vehicleData.mileage}</span>
            </div>
            
            {vehicleData.fuelType && (
              <div className="flex flex-col p-2 sm:p-0">
                <span className="text-sm sm:text-base text-gray-500 font-medium">Fuel Type</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">{vehicleData.fuelType}</span>
              </div>
            )}
            
            {vehicleData.transmission && (
              <div className="flex flex-col p-2 sm:p-0">
                <span className="text-sm sm:text-base text-gray-500 font-medium">Transmission</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">{vehicleData.transmission}</span>
              </div>
            )}
          </div>

          {vehicleData.blocked && (
            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm sm:text-base text-red-800 font-bold mb-1">Warranty Coverage Not Available</p>
              <p className="text-xs sm:text-sm text-red-700">
                {vehicleData.blockReason || "Sorry about this - this vehicle isn't eligible due to specialist parts and a limited repair network."}
              </p>
            </div>
          )}
        </div>

        {!showContactForm ? (
          <>
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight px-2">
                How would you like to receive your quote?
              </h1>
            </div>

            <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
              <button 
                onClick={handleSkipClick}
                disabled={vehicleData.blocked}
                className={`w-full flex items-center justify-center text-white font-bold py-4 sm:py-5 px-4 sm:px-8 rounded-xl transition-all duration-200 relative shadow-lg ${
                  vehicleData.blocked ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{ backgroundColor: vehicleData.blocked ? '#9ca3af' : '#eb4b00' }}
                onMouseEnter={(e) => {
                  if (!vehicleData.blocked) {
                    e.currentTarget.style.backgroundColor = '#d43f00';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!vehicleData.blocked) {
                    e.currentTarget.style.backgroundColor = '#eb4b00';
                  }
                }}
              >
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 absolute left-4 sm:left-8" />
                <div className="text-center px-8 sm:px-12">
                  <div className="text-base sm:text-xl leading-tight">
                    View my quote now
                  </div>
                </div>
                <span className="text-xl sm:text-2xl absolute right-4 sm:right-8">→</span>
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 sm:px-6 py-2 text-gray-700 text-base sm:text-lg font-semibold border border-gray-300 rounded-full">
                    or
                  </span>
                </div>
              </div>

              <div>
                <button 
                  onClick={handleEmailQuoteClick}
                  disabled={vehicleData.blocked}
                  className={`w-full flex items-center justify-center text-white font-bold py-4 sm:py-5 px-4 sm:px-8 rounded-xl transition-all duration-200 relative shadow-lg ${
                    vehicleData.blocked ? 'cursor-not-allowed' : ''
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
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6 absolute left-4 sm:left-8" />
                  <div className="text-center px-8 sm:px-12">
                    <div className="text-base sm:text-xl leading-tight">
                      See now + Get email
                    </div>
                  </div>
                  <span className="text-xl sm:text-2xl absolute right-4 sm:right-8">→</span>
                </button>
                
                <p className="text-center text-sm text-gray-500 mt-2">
                  Unsubscribe at any time
                </p>
              </div>
            </div>

          </>
        ) : (
          <>
            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-3 sm:mb-4">See your prices instantly ⚡ & get them by email</h2>
            </div>

            <form onSubmit={handleSubmitContactForm}>
              <div className="mb-6 sm:mb-8">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={`w-full border-2 rounded-[6px] px-[12px] sm:px-[16px] py-[12px] sm:py-[14px] focus:outline-none transition-all duration-200 text-base ${
                    touched.email && errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  onFocus={(e) => {
                    e.target.style.borderColor = touched.email && errors.email ? '#ef4444' : '#224380';
                  }}
                  onBlur={(e) => {
                    handleFieldBlur('email');
                    e.target.style.borderColor = touched.email && errors.email ? '#ef4444' : '#d1d5db';
                  }}
                  required
                />
                {touched.email && errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
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
                    style={{ backgroundColor: '#224380' }}
                    onMouseEnter={(e) => {
                      if (!errors.email && !sendingEmail) {
                        e.currentTarget.style.backgroundColor = '#1e3a70';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!errors.email && !sendingEmail) {
                        e.currentTarget.style.backgroundColor = '#224380';
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
    </section>
  );
};

export default QuoteDeliveryStep;