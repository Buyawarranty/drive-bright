import React from 'react';
import { Check } from 'lucide-react';

interface CompactProgressBarProps {
  currentStep: number;
}

const steps = [
  { id: 1, title: 'Enter Reg Plate' },
  { id: 2, title: 'Receive Quote' },
  { id: 3, title: 'Choose Your Plan' },
  { id: 4, title: 'Review & Pay' }
];

// Original car icon with gentle bounce animation
const CarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="40" height="28" viewBox="0 0 48 32" className={className}>
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
);

const CompactProgressBar: React.FC<CompactProgressBarProps> = ({ currentStep }) => {
  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  // Calculate car position based on current step (matches original progress bar)
  const getCarPosition = () => {
    const progress = Math.min(Math.max((currentStep - 1) / 3, 0), 1);
    return `calc(${progress * 80 + 10}% - 24px)`;
  };

  return (
    <div className="w-full bg-white border-b border-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Desktop car animation with blue progress line - hidden on mobile */}
        <div className="hidden sm:block relative mb-4">
          {/* Blue progress line */}
          <div className="relative h-2 bg-gray-200 rounded-full">
            <div 
              className="h-full bg-[#1e40af] rounded-full transition-all duration-1000 ease-in-out"
              style={{ width: `${Math.max(12.5 + (currentStep - 1) / 3 * 75, 12.5)}%` }}
            />
          </div>
          
          {/* Moving car with bounce animation */}
          <div 
            className="absolute -top-6 transition-all duration-1000 ease-in-out"
            style={{ 
              left: getCarPosition(),
              animation: 'gentle-bounce 4s ease-in-out infinite'
            }}
          >
            <CarIcon className="w-10 h-7 sm:w-12 sm:h-8 drop-shadow-md" />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            const isCompleted = status === 'completed';
            const isCurrent = status === 'current';
            const isLast = index === steps.length - 1;

            return (
              <React.Fragment key={step.id}>
                {/* Step Item */}
                <div className="flex flex-col items-center flex-shrink-0">
                  {/* Circle */}
                  <div 
                    className={`
                      w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-300
                      ${isCompleted 
                        ? 'bg-green-500 text-white shadow-sm' 
                        : isCurrent 
                          ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-200' 
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={3} />
                    ) : (
                      <span>{step.id}</span>
                    )}
                  </div>
                  
                  {/* Label */}
                  <span 
                    className={`
                      mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-medium text-center leading-tight max-w-[70px] sm:max-w-[90px] transition-colors duration-300
                      ${isCurrent 
                        ? 'text-orange-600 font-semibold' 
                        : isCompleted 
                          ? 'text-green-600' 
                          : 'text-slate-400'
                      }
                    `}
                  >
                    {step.title}
                  </span>
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="flex-1 mx-1.5 sm:mx-3 h-0.5 relative -mt-6 sm:-mt-7">
                    <div className="absolute inset-0 bg-slate-200 rounded-full" />
                    <div 
                      className={`
                        absolute inset-y-0 left-0 rounded-full transition-all duration-500
                        ${isCompleted ? 'bg-green-500 w-full' : 'bg-slate-200 w-0'}
                      `}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CompactProgressBar;
