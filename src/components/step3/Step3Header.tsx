import React from 'react';
import { Star, Shield, Lock, Check } from 'lucide-react';
import trustpilotLogo from "@/assets/trustpilot-excellent-box.webp";

interface Step3HeaderProps {
  currentStep: number;
}

const steps = ['Term', 'Excess', 'Claim', 'Labour', 'Extras', 'Checkout'];

const Step3Header: React.FC<Step3HeaderProps> = ({ currentStep }) => {
  return (
    <div className="bg-white border-b border-border sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <a href="/" className="hover:opacity-80 transition-opacity">
            <img 
              src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" 
              alt="buyawarranty" 
              className="h-7 w-auto"
            />
          </a>
        </div>
        
        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-1 mb-4">
          {steps.map((step, index) => (
            <React.Fragment key={step}>
              <div 
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index < currentStep 
                    ? 'bg-success' 
                    : index === currentStep 
                      ? 'bg-primary' 
                      : 'bg-border'
                }`}
              />
              {index < steps.length - 1 && (
                <div className={`w-4 h-0.5 ${
                  index < currentStep ? 'bg-success' : 'bg-border'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
        
        {/* Trust Signals */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="flex">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="w-3 h-3 fill-success text-success" />
              ))}
            </div>
            <span className="font-medium">Excellent</span>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>14-day cancellation</span>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Secure checkout</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3Header;
