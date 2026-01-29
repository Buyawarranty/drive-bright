import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, Shield, Car, AlertCircle, Loader2 } from 'lucide-react';
import { StripeProvider } from './StripeProvider';
import { StripePaymentForm } from './StripePaymentForm';
import { useNavigate } from 'react-router-dom';

interface OrderSummary {
  vehicleReg: string;
  vehicleMake: string;
  vehicleModel: string;
  planName: string;
  duration: string;
  amount: number;
  originalAmount?: number;
  savings?: number;
}

interface EmbeddedCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientSecret: string | null;
  orderSummary: OrderSummary;
  onPaymentSuccess?: () => void;
}

export const EmbeddedCheckoutModal: React.FC<EmbeddedCheckoutModalProps> = ({
  isOpen,
  onClose,
  clientSecret,
  orderSummary,
  onPaymentSuccess,
}) => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentStatus('idle');
      setErrorMessage(null);
      setShowExitConfirmation(false);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isProcessing) {
      setShowExitConfirmation(true);
      return;
    }
    onClose();
  };

  const handleConfirmExit = () => {
    setShowExitConfirmation(false);
    setIsProcessing(false);
    onClose();
  };

  const handlePaymentSuccess = () => {
    setPaymentStatus('success');
    setIsProcessing(false);
    
    // Optional callback
    if (onPaymentSuccess) {
      onPaymentSuccess();
    }
    
    // Redirect to thank you page after animation
    setTimeout(() => {
      navigate('/thank-you?source=embedded');
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    setPaymentStatus('error');
    setErrorMessage(error);
    setIsProcessing(false);
  };

  const formatPlanName = (name: string) => {
    return name
      .replace(/vehicle/gi, '')
      .replace(/car/gi, '')
      .replace(/plan/gi, '')
      .replace(/premium/gi, 'Platinum')
      .trim() || 'Platinum';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Exit Confirmation Overlay */}
        {showExitConfirmation && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center rounded-lg">
            <div className="bg-white p-6 rounded-xl shadow-xl mx-4 max-w-sm">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Payment in progress</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your payment is being processed. Are you sure you want to cancel?
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowExitConfirmation(false)}
                >
                  Continue Payment
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleConfirmExit}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {paymentStatus === 'success' ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-[scale-in_0.3s_ease-out]">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground text-center mb-4">
              Your warranty is now active. Redirecting to your confirmation...
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Redirecting...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="p-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-semibold">Complete Your Purchase</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Secure checkout powered by Stripe
                    </DialogDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 rounded-full"
                  disabled={isProcessing}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogHeader>

            {/* Order Summary */}
            <div className="p-6 bg-muted/30 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Order Summary</h3>
              
              {/* Vehicle Info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center border border-border">
                  <Car className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {orderSummary.vehicleMake} {orderSummary.vehicleModel}
                  </p>
                  <p 
                    className="text-xs font-mono font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-black inline-block"
                    style={{ backgroundColor: '#FCD34D' }}
                  >
                    {orderSummary.vehicleReg}
                  </p>
                </div>
              </div>
              
              {/* Plan Info */}
              <div className="flex items-center justify-between py-3 border-t border-border/50">
                <div>
                  <p className="font-medium text-foreground">{formatPlanName(orderSummary.planName)} Warranty</p>
                  <p className="text-sm text-muted-foreground">{orderSummary.duration}</p>
                </div>
                <div className="text-right">
                  {orderSummary.originalAmount && orderSummary.savings && orderSummary.savings > 0 && (
                    <>
                      <p className="text-sm text-muted-foreground line-through">
                        £{orderSummary.originalAmount.toFixed(2)}
                      </p>
                      <p className="text-xs text-green-600 font-medium">
                        Save £{orderSummary.savings.toFixed(2)}
                      </p>
                    </>
                  )}
                  <p className="text-xl font-bold text-foreground">£{orderSummary.amount.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="p-6">
              {clientSecret ? (
                <StripeProvider clientSecret={clientSecret}>
                  <StripePaymentForm
                    amount={orderSummary.amount}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                  />
                </StripeProvider>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmbeddedCheckoutModal;
