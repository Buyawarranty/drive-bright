import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check, Shield, Sliders } from 'lucide-react';

interface HowPricingWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HowPricingWorksModal: React.FC<HowPricingWorksModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[90vw] max-w-lg mx-auto bg-white rounded-xl p-6 sm:p-8">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-green" />
            How your price is calculated
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-sm sm:text-base">
            Transparent, personalised pricing with no hidden fees.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-5 space-y-6">
          {/* Section 1 - What affects price */}
          <div className="space-y-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Your quote is based on:
            </h3>
            
            <ul className="space-y-2.5">
              {[
                "Your vehicle's age and mileage",
                "The level of cover you choose",
                "Your claim limit",
                "Your labour rate",
                "Your chosen excess",
                "How far and how often you drive",
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <Check className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 text-sm sm:text-base">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 2 - You're in control */}
          <div className="bg-green-50 border border-green-100 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-brand-green" />
              <h4 className="font-semibold text-gray-900 text-sm sm:text-base">You're in control</h4>
            </div>
            <p className="text-gray-700 text-sm">
              Adjust your cover level, excess and claim limit to find a price that works for you. No pressure, no sales calls.
            </p>
          </div>
          
          {/* Footer reassurance */}
          <p className="text-gray-500 text-xs sm:text-sm text-center pt-2 border-t border-gray-100">
            All prices shown include VAT. Cancel anytime with no fees.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HowPricingWorksModal;
