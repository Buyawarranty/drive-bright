import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { HelpCircle, Phone, MessageCircle } from 'lucide-react';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';

interface HelpMeChooseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpMeChooseModal: React.FC<HelpMeChooseModalProps> = ({ isOpen, onClose }) => {
  const [showCallback, setShowCallback] = useState(false);

  return (
    <>
      <Dialog open={isOpen && !showCallback} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="w-5 h-5 text-primary" />
              Need more cover?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
              Not sure which limit is right for you? Our team can help you choose
              the best option for your vehicle and budget.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            <button
              onClick={() => {
                setShowCallback(true);
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-brand-orange" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Request a callback</p>
                <p className="text-xs text-muted-foreground">
                  We'll call you to help pick the right limit
                </p>
              </div>
            </button>

            <a
              href="https://wa.me/message/SPQPJ6O3UBF5B1"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Start live chat</p>
                <p className="text-xs text-muted-foreground">Chat with us on WhatsApp</p>
              </div>
            </a>
          </div>
        </DialogContent>
      </Dialog>

      <RequestCallbackModal
        isOpen={showCallback}
        onClose={() => {
          setShowCallback(false);
          onClose();
        }}
      />
    </>
  );
};

export default HelpMeChooseModal;
