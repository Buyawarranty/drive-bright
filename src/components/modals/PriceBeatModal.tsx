import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import PriceBeatBanner from '@/components/step3/PriceBeatBanner';

interface PriceBeatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PriceBeatModal: React.FC<PriceBeatModalProps> = ({ isOpen, onClose }) => (
  <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl [&>button]:top-3 [&>button]:right-3 [&>button]:z-10 [&_button[aria-label='Close']]:hidden">
      <DialogTitle className="sr-only">Price Beat Guarantee</DialogTitle>
      <div className="pt-4 px-3 pb-4">
        <PriceBeatBanner
          startExpanded
          className="border-0 bg-transparent [&>div:first-child]:px-1"
        />
      </div>
    </DialogContent>
  </Dialog>
);

export default PriceBeatModal;
