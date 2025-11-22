import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Gift, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { trackFormSubmission, trackEvent } from '@/utils/analytics';

interface EmailCapturePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscountCodeGenerated?: (code: string) => void;
}

export const EmailCapturePopup: React.FC<EmailCapturePopupProps> = ({ 
  isOpen, 
  onClose, 
  onDiscountCodeGenerated 
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();

  // Present popping effect when popup opens
  useEffect(() => {
    if (isOpen) {
      confetti({
        particleCount: 6,
        spread: 45,
        origin: { y: 0.6 },
        shapes: ['square'],
        colors: ['#f97316', '#fbbf24', '#34d399']
      });
    }
  }, [isOpen]);

  const copyToClipboard = async () => {
    if (discountCode) {
      try {
        await navigator.clipboard.writeText(discountCode);
        setHasCopied(true);
        toast({
          title: "Copied!",
          description: "Discount code copied to clipboard",
        });
        setTimeout(() => setHasCopied(false), 2000);
      } catch (err) {
        toast({
          title: "Copy failed",
          description: "Please copy the code manually",
          variant: "destructive"
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Track email capture popup submission
    trackFormSubmission('checkout_email_capture', { email_provided: !!email });
    
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive"
      });
      trackEvent('form_error', { form_name: 'checkout_email_capture', error: 'email_missing' });
      return;
    }

    setIsLoading(true);

    try {
      // Generate discount code using auto-generate function
      const { data: discountData, error: discountError } = await supabase.functions.invoke('auto-generate-discount', {
        body: { 
          customerEmail: email,
          orderAmount: 1000 // Pass a base amount for percentage calculation
        }
      });

      if (discountError) throw discountError;

      console.log('Discount response:', discountData);
      
      // The auto-generate-discount function returns the discount code
      const generatedCode = discountData?.discountCode?.code || `SAVE25-${Date.now().toString().slice(-6)}`;
      setDiscountCode(generatedCode);
      setShowSuccess(true);

      // Add to newsletter signups table
      const { error: newsletterError } = await supabase
        .from('newsletter_signups')
        .insert({
          email,
          discount_amount: 25,
          source: 'checkout_popup',
          status: 'active',
          ip_address: null,
          user_agent: navigator.userAgent
        });

      if (newsletterError) {
        console.error('Newsletter signup error:', newsletterError);
      }

      // Track successful discount code generation
      trackEvent('checkout_email_capture_success', { 
        email: email,
        discount_code: generatedCode 
      });
      trackEvent('conversion', { 
        conversion_type: 'checkout_email_capture',
        value: 25 
      });

      // Present success effect
      confetti({
        particleCount: 10,
        spread: 60,
        origin: { y: 0.5 },
        shapes: ['square'],
        colors: ['#f97316', '#fbbf24', '#34d399'],
        gravity: 0.8,
        scalar: 1.2
      });

      // Send email with discount code
      const { error: emailError } = await supabase.functions.invoke('send-discount-email', {
        body: {
          email,
          discountCode: generatedCode,
          discountAmount: 25
        }
      });

      if (emailError) {
        console.error('Email sending failed:', emailError);
      } else {
        console.log('Discount email sent successfully');
      }

      // Notify parent component about the generated code
      if (onDiscountCodeGenerated) {
        onDiscountCodeGenerated(generatedCode);
      }

      // Auto close after 4 seconds
      setTimeout(() => {
        onClose();
      }, 4000);

    } catch (error) {
      console.error('Error generating discount:', error);
      toast({
        title: "Error",
        description: "Failed to generate discount code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md mx-auto bg-white rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
        <div className="relative">
          {/* Large, visible close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors shadow-md"
            aria-label="Close popup"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>

          {/* Header */}
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 px-6 pt-6 pb-4">
            <div className="text-center">
              <div className="mb-4">
                <img 
                  src="/lovable-uploads/baw-logo-new-2025.png" 
                  alt="BuyAWarranty" 
                  className="h-8 mx-auto"
                />
              </div>
              
              {!showSuccess ? (
                <>
                  <div className="flex justify-center space-x-2 mb-4">
                    <Gift className="h-8 w-8 text-orange-500 animate-bounce" />
                    <Gift className="h-8 w-8 text-yellow-500 animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <Gift className="h-8 w-8 text-green-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Hey! Want £25 off your warranty?
                  </h2>
                  
                  <p className="text-gray-700 text-base leading-relaxed">
                    Enter your email below and we&apos;ll instantly apply £25 off to your checkout – plus send you the discount code for safekeeping!
                  </p>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-4">🎉</div>
                  <h2 className="text-2xl font-bold text-green-600 mb-2">
                    £25 Discount Applied to Checkout!
                  </h2>
                  
                  <div className="bg-white border-2 border-green-200 rounded-lg p-4 mb-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <code className="text-xl font-bold text-gray-900 tracking-wider">{discountCode}</code>
                      <Button
                        onClick={copyToClipboard}
                        variant="outline"
                        size="sm"
                        className="ml-2 border-green-300 text-green-600 hover:bg-green-50"
                      >
                        {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm">
                    Perfect! Your £25 discount has been automatically added to the checkout page. We&apos;ve also emailed you the discount code for your records.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          {!showSuccess && (
            <div className="px-6 pb-6 bg-white">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="Your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 pl-4 pr-4 text-base border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-orange-500 transition-colors"
                    required
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors text-base"
                >
                  {isLoading ? 'Generating...' : 'Get My Discount Code'}
                </Button>
              </form>

              <p className="text-xs text-gray-500 text-center mt-4 leading-relaxed">
                We'll occasionally send you useful warranty tips. Unsubscribe anytime – no worries!
              </p>
            </div>
          )}

          {showSuccess && (
            <div className="px-6 pb-6 bg-white text-center">
              <p className="text-sm text-gray-500">
                This window will close automatically in a few seconds.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};