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

// Lovable, minimal car icon component
const CarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 48 24" 
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Car body - warm, friendly shape */}
    <path 
      d="M8 16C8 16 10 8 16 8H32C36 8 40 12 42 16H8Z" 
      fill="#F97316" 
      stroke="#EA580C" 
      strokeWidth="1"
    />
    {/* Car roof - soft curve */}
    <path 
      d="M14 8C14 8 16 4 22 4H28C32 4 34 8 34 8" 
      fill="#FB923C" 
      stroke="#EA580C" 
      strokeWidth="1"
    />
    {/* Windows */}
    <path 
      d="M16 7C16 7 17 5 22 5H27C30 5 31 7 31 7L30 8H17L16 7Z" 
      fill="#BAE6FD" 
      stroke="#7DD3FC" 
      strokeWidth="0.5"
    />
    {/* Car base */}
    <rect x="6" y="15" width="38" height="4" rx="1" fill="#EA580C" />
    {/* Front headlight */}
    <ellipse cx="41" cy="14" rx="2" ry="1.5" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="0.5" />
    {/* Rear light */}
    <ellipse cx="8" cy="14" rx="1.5" ry="1" fill="#FCA5A5" stroke="#EF4444" strokeWidth="0.5" />
    {/* Front wheel */}
    <circle cx="34" cy="19" r="4" fill="#374151" stroke="#1F2937" strokeWidth="1" />
    <circle cx="34" cy="19" r="2" fill="#6B7280" />
    <circle cx="34" cy="19" r="0.8" fill="#9CA3AF" />
    {/* Rear wheel */}
    <circle cx="14" cy="19" r="4" fill="#374151" stroke="#1F2937" strokeWidth="1" />
    <circle cx="14" cy="19" r="2" fill="#6B7280" />
    <circle cx="14" cy="19" r="0.8" fill="#9CA3AF" />
    {/* Wheel shine effect */}
    <path d="M32 17.5C32.5 17 33.5 17 34 17.5" stroke="#9CA3AF" strokeWidth="0.5" strokeLinecap="round" />
    <path d="M12 17.5C12.5 17 13.5 17 14 17.5" stroke="#9CA3AF" strokeWidth="0.5" strokeLinecap="round" />
  </svg>
);

const CompactProgressBar: React.FC<CompactProgressBarProps> = ({ currentStep }) => {
  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  // Calculate car position based on current step (0% to 100%)
  const getCarPosition = () => {
    // Position the car at the current step's circle position
    const stepPercentages = [0, 33.33, 66.66, 100];
    return stepPercentages[currentStep - 1] || 0;
  };

  return (
    <div className="w-full bg-white border-b border-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Desktop car animation - hidden on mobile */}
        <div className="hidden sm:block relative h-8 mb-2">
          <div 
            className="absolute transition-all duration-700 ease-out"
            style={{ 
              left: `calc(${getCarPosition()}% - 24px)`,
              top: '0'
            }}
          >
            <CarIcon className="w-12 h-6 drop-shadow-sm" />
            {/* Motion lines for animation effect */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 flex flex-col gap-0.5 opacity-60">
              <div className="w-2 h-0.5 bg-slate-300 rounded-full" />
              <div className="w-3 h-0.5 bg-slate-300 rounded-full" />
              <div className="w-2 h-0.5 bg-slate-300 rounded-full" />
            </div>
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
