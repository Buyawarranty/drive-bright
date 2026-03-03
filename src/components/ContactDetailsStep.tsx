
import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { trackFormSubmission, trackStepCompletion } from '@/utils/analytics';
import { AddressAutocomplete, AddressData } from '@/components/ui/address-autocomplete';

interface ContactDetailsStepProps {
  onNext: (data: { email: string; phone: string; firstName: string; lastName?: string; address: string }) => void;
  onBack: () => void;
  initialData?: {
    regNumber: string;
    mileage: string;
    email: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    address?: string;
  };
}

const ContactDetailsStep: React.FC<ContactDetailsStepProps> = ({ onNext, onBack, initialData }) => {
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [firstName, setFirstName] = useState(initialData?.firstName || '');
  const [address, setAddress] = useState(initialData?.address || '');

  const handleAddressSelect = (addressData: AddressData) => {
    // Format the full address from components
    const parts = [
      addressData.line_1,
      addressData.line_2,
      addressData.town,
      addressData.county,
      addressData.postcode,
    ].filter(Boolean);
    setAddress(parts.join(', '));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && phone && firstName && address) {
      // Track contact details form completion
      trackFormSubmission('contact_details', {
        has_email: !!email,
        has_phone: !!phone,
        has_address: !!address
      });
      
      // Track step 2 completion for Google Ads with enhanced conversion data
      trackStepCompletion(2, 'contact_details', {
        email,
        phone,
        firstName,
        address
      });

      onNext({ 
        email, 
        phone,
        firstName,
        address
      });
    }
  };

  const isFormValid = email && phone && firstName && address;

  return (
    <section className="bg-[#e8f4fb] py-10 min-h-screen">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="flex items-start mb-6">
          <div>
            <h2 className="text-4xl font-bold text-gray-800 text-left">Now, let's find out about you 🤔</h2>
            <p className="text-lg text-gray-600 mt-2 text-left">We need these details to provide you with your personalized quote and warranty information.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* First Name Field */}
          <div className="mb-6">
            <label className="block font-semibold mb-3 text-gray-700 text-xl">Your First Name</label>
            <div className="relative">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                className="w-full border-2 border-gray-300 rounded-[6px] px-[16px] py-[12px] pr-[50px] focus:outline-none transition-all duration-200"
                onFocus={(e) => e.target.style.borderColor = '#224380'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                required
              />
              {firstName.trim() && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Address Field with getaddress.io autocomplete */}
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <label className="block font-semibold mb-2 text-gray-700 text-xl">Address</label>
              <span 
                className="cursor-pointer text-sm ml-1" 
                style={{ color: '#224380' }} 
                title="Your home address for warranty registration"
              >
                ?
              </span>
            </div>
            <AddressAutocomplete
              placeholder="Start typing postcode or address..."
              onAddressSelect={handleAddressSelect}
              initialValue={address}
              className="w-full border-2 border-gray-300 rounded-[6px] px-[16px] py-[12px] focus:outline-none transition-all duration-200 focus:border-[#224380]"
            />
            <p className="text-sm text-gray-500 mt-1">Or type your full address manually below</p>
            <div className="relative mt-2">
              <input
                id="address-input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address (e.g., 10 Downing Street, London, SW1A 2AA)"
                className="w-full border-2 border-gray-300 rounded-[6px] px-[16px] py-[12px] pr-[50px] focus:outline-none transition-all duration-200"
                onFocus={(e) => {
                  e.target.style.borderColor = '#224380';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                }}
                required
              />
              {address.trim() && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Email Field */}
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <label className="block font-semibold mb-2 text-gray-700 text-xl">Email Address</label>
              <span 
                className="cursor-pointer text-sm ml-1" 
                style={{ color: '#224380' }} 
                title="We'll send your quote and warranty documents to this email"
              >
                ?
              </span>
            </div>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full border-2 border-gray-300 rounded-[6px] px-[16px] py-[12px] pr-[50px] focus:outline-none transition-all duration-200"
                onFocus={(e) => {
                  e.target.style.borderColor = '#224380';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                }}
                required
              />
              {email.trim() && email.includes('@') && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Phone Field */}
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <label className="block font-semibold mb-2 text-gray-700 text-xl">Phone Number</label>
              <span 
                className="cursor-pointer text-sm ml-1" 
                style={{ color: '#224380' }} 
                title="For quick updates about your warranty application"
              >
                ?
              </span>
            </div>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                
                className="w-full border-2 border-gray-300 rounded-[6px] px-[16px] py-[12px] pr-[50px] focus:outline-none transition-all duration-200"
                onFocus={(e) => {
                  e.target.style.borderColor = '#224380';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                }}
                required
              />
              {phone.trim() && /^(\+44|0)[0-9]{10}$/.test(phone.replace(/\s/g, '')) && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Button Group */}
          <div className="flex gap-4">
            <button 
              type="button" 
              onClick={onBack}
              className="flex-1 flex items-center justify-center gap-2 text-[15px] font-bold py-[12px] px-[20px] rounded-[6px] border-2 transition-all duration-200"
              style={{
                backgroundColor: 'white',
                borderColor: '#224380',
                color: '#224380'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f8ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button 
              type="submit" 
              disabled={!isFormValid}
              className="flex-1 text-white text-[15px] font-bold py-[12px] px-[20px] rounded-[6px] border-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isFormValid ? '#eb4b00' : '#e5e7eb',
                borderColor: isFormValid ? '#eb4b00' : '#d1d5db'
              }}
              onMouseEnter={(e) => {
                if (isFormValid) {
                  e.currentTarget.style.backgroundColor = '#d43f00';
                }
              }}
              onMouseLeave={(e) => {
                if (isFormValid) {
                  e.currentTarget.style.backgroundColor = '#eb4b00';
                }
              }}
            >
              Get my quote →
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default ContactDetailsStep;
