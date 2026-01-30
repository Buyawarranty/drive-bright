import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check } from 'lucide-react';

interface HowPricingWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HowPricingWorksModal: React.FC<HowPricingWorksModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg mx-auto bg-white rounded-xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900">
            How our pricing works
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4 space-y-6">
          {/* Intro Line */}
          <p className="text-gray-700 text-base sm:text-lg font-medium">
            Fair and flexible pricing based on your car — no surprises.
          </p>
          
          {/* Section 1 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              What affects your price
            </h3>
            
            <p className="text-gray-700 text-sm sm:text-base">
              Your quote is based on:
            </p>
            
            <ul className="space-y-2.5">
              {[
                "Your vehicle's age and mileage",
                "The level of cover you choose",
                "Your claim limit",
                "Your labour rate",
                "Your chosen excess",
                "How far and how often you drive",
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 text-sm sm:text-base">{item}</span>
                </li>
              ))}
            </ul>
            
            <p className="text-gray-600 text-sm italic mt-4">
              These factors help us keep your price fair and accurate.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HowPricingWorksModal;
