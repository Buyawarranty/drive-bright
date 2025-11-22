import React from 'react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentStep, totalSteps, steps }) => {
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full bg-white border-b border-gray-200 shadow-sm overflow-x-hidden">

      <div className="max-w-4xl mx-auto px-4 py-2 sm:py-4">
        {/* Progress Bar */}
        <div className="relative">
          {/* Background Progress Track */}
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          {/* Active Progress Fill - Using orange color to match button */}
          <div 
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ 
              width: `${progressPercentage}%`,
              backgroundColor: '#eb4b00' // Orange color to match button
            }}
          />
          </div>

          {/* Step Labels */}
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const isActive = stepNumber === currentStep;
              const isCompleted = stepNumber < currentStep;
              
              return (
                <div 
                  key={index} 
                  className={`flex flex-col items-center text-center ${
                    isActive ? 'font-semibold' : 
                    isCompleted ? '' : 'text-gray-400'
                  }`}
                  style={{
                    color: isActive || isCompleted ? '#00B67A' : undefined
                  }}
                >
                  {/* Step Circle */}
                  <div 
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                      isActive || isCompleted ? 'text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                    style={{
                      backgroundColor: isCompleted ? '#00B67A' : isActive ? '#00B67A' : undefined
                    }}
                  >
                    {isCompleted ? '✓' : stepNumber}
                  </div>
                  
                  {/* Step Label */}
                  <span className="text-xs font-medium px-1">{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;
