import React, { useState } from 'react';
import { ProtectedButton } from "@/components/ui/protected-button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface VehicleWidgetProps {
  redirectUrl?: string;
  className?: string;
}

export function VehicleWidget({ redirectUrl = window.location.origin, className = "" }: VehicleWidgetProps) {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatRegNumber = (value: string): string => {
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    if (cleaned.length <= 4) return cleaned;
    return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
  };

  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRegNumber(e.target.value);
    if (formatted.length <= 8) {
      setRegistrationNumber(formatted);
    }
  };

  const handleSubmit = async () => {
    if (!registrationNumber.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Store the registration number in sessionStorage for the main app
      sessionStorage.setItem('widgetRegistration', registrationNumber.replace(/\s/g, ''));
      
      // Redirect to the main application
      window.open(`${redirectUrl}?from=widget`, '_blank');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-md mx-auto space-y-4 ${className}`}>
      <div className="space-y-4">
        {/* Registration Number Input */}
        <div className="relative">
          <div className="flex items-center bg-yellow-400 border-2 border-black rounded-lg p-3">
            <img 
              src="/lovable-uploads/081c51be-1add-43a7-b083-4895a3a22de3.png" 
              alt="UK Plate Symbol" 
              className="w-8 h-6 mr-3 rounded-sm"
            />
            <Input
              type="text"
              value={registrationNumber}
              onChange={handleRegChange}
              placeholder="Enter reg plate"
              className="bg-transparent border-none text-lg font-bold text-gray-600 placeholder-gray-500 focus:ring-0 focus:outline-none p-0 !bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              maxLength={8}
            />
          </div>
        </div>

        {/* Get My Quote Button */}
        <ProtectedButton 
          actionType="widget_quote_request"
          onClick={handleSubmit}
          disabled={!registrationNumber.trim() || isLoading}
          className="w-full text-white font-semibold p-3 text-lg rounded-lg border-2 border-black disabled:opacity-50"
          style={{
            backgroundColor: '#eb4b00',
            borderColor: '#eb4b00'
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = '#d43f00';
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = '#eb4b00';
            }
          }}
        >
          Get my quote
        </ProtectedButton>
      </div>
    </div>
  );
}