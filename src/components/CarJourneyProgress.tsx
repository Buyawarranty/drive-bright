import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import buyAWarrantyLogo from '/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png';

interface CarJourneyProgressProps {
  currentStep: number;
  onStepChange?: (step: number) => void;
  onLogoClick?: () => void;
}

const steps = [
  { id: 1, title: 'Enter reg plate', description: 'Enter your vehicle details' },
  { id: 2, title: 'Receive quote', description: 'Get your personalized quote' },
  { id: 3, title: 'Choose your plan', description: 'Select your coverage options' },
  { id: 4, title: 'Review & Confirm', description: 'Complete your purchase' }
];

const CarJourneyProgress: React.FC<CarJourneyProgressProps> = ({ 
  currentStep, 
  onStepChange,
  onLogoClick
}) => {
  const [animatedStep, setAnimatedStep] = useState(currentStep);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedStep(currentStep);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const getCarPosition = () => {
    const progress = Math.min(Math.max((animatedStep - 1) / 3, 0), 1);
    return `${progress * 85 + 7.5}%`;
  };

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4">
      {/* Brand Header */}
      <div className="text-center mb-8">
        {onLogoClick ? (
          <button
            onClick={onLogoClick}
            className="inline-block transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded cursor-pointer"
            aria-label="Go back to home page"
          >
            <img 
              src={buyAWarrantyLogo} 
              alt="Buy a Warranty Logo" 
              className="h-10 sm:h-12 w-auto mx-auto"
            />
          </button>
        ) : (
          <Link
            to="/"
            className="inline-block transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
            aria-label="Go back to home page"
          >
            <img 
              src={buyAWarrantyLogo} 
              alt="Buy a Warranty Logo" 
              className="h-10 sm:h-12 w-auto mx-auto"
            />
          </Link>
        )}
      </div>

      {/* Progress Container */}
      <div className="relative">
        {/* Progress Line */}
        <div className="relative h-2 bg-gray-200 rounded-full">
          <div 
            className="h-full bg-[#1e40af] rounded-full transition-all duration-1000 ease-in-out"
            style={{ width: `${Math.max(12.5 + (currentStep - 1) / 3 * 75, 12.5)}%` }}
          ></div>
        </div>

        {/* Moving Car */}
        <div 
          className="absolute -top-6 transition-all duration-1000 ease-in-out transform"
          style={{ 
            left: getCarPosition(),
            transform: 'translateX(-50%)',
            animation: 'gentle-bounce 4s ease-in-out infinite'
          }}
        >
          <svg width="48" height="32" viewBox="0 0 48 32" className="drop-shadow-md">
            {/* Car Body */}
            <rect x="3" y="12" width="42" height="12" rx="3" fill="#ea580c" />
            <rect x="9" y="6" width="30" height="9" rx="3" fill="#fb923c" />
            
            {/* Windows */}
            <rect x="12" y="7" width="9" height="6" rx="1.5" fill="#fef3c7" opacity="0.9" />
            <rect x="27" y="7" width="9" height="6" rx="1.5" fill="#fef3c7" opacity="0.9" />
            
            {/* Wheels */}
            <circle cx="12" cy="22" r="4.5" fill="#374151" />
            <circle cx="36" cy="22" r="4.5" fill="#374151" />
            <circle cx="12" cy="22" r="3" fill="#6b7280" />
            <circle cx="36" cy="22" r="3" fill="#6b7280" />
            
            {/* Headlights */}
            <circle cx="42" cy="16" r="2" fill="#fef3c7" opacity="0.9" />
            <circle cx="42" cy="20" r="2" fill="#fef3c7" opacity="0.9" />
          </svg>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between items-start mt-4">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            const isCompleted = status === 'completed';
            const isCurrent = status === 'current';
            
            return (
              <div key={step.id} className="flex flex-col items-center">
                {/* Step Circle */}
                <div 
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300
                    ${isCompleted 
                      ? 'bg-green-500 text-white' 
                      : isCurrent 
                        ? 'bg-[#ea580c] text-white' 
                        : 'bg-gray-300 text-gray-600'
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                
                {/* Step Title Only */}
                <div className="mt-3 text-center max-w-32">
                  <h3 className={`
                    font-medium text-sm transition-colors duration-300
                    ${isCurrent ? 'text-[#ea580c]' : isCompleted ? 'text-green-600' : 'text-gray-500'}
                  `}>
                    {step.title}
                  </h3>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CarJourneyProgress;