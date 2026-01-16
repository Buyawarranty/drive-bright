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

const CompactProgressBar: React.FC<CompactProgressBarProps> = ({ currentStep }) => {
  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full bg-white border-b border-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-4">
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
