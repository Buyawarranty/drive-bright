import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Gift, Star, Loader2 } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotLogo from '/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShareAndSaveSectionProps {
  onReferClick?: () => void;
  customerName?: string;
}

export const ShareAndSaveSection: React.FC<ShareAndSaveSectionProps> = ({
  onReferClick,
  customerName
}) => {
  const [friendEmail, setFriendEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReferClick = async () => {
    if (!friendEmail || !friendEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (onReferClick) {
      onReferClick();
    }

    setIsSubmitting(true);

    try {
      // Get current user's email for referrer tracking
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.functions.invoke('send-referral-email', {
        body: {
          friendEmail,
          referrerName: customerName || 'A Friend',
          referrerEmail: user?.email || null
        }
      });

      if (error) throw error;

      toast.success('Referral sent! Your friend will receive an email shortly.');
      setFriendEmail('');
    } catch (error) {
      console.error('Error sending referral:', error);
      toast.error('Failed to send referral. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrustpilotClick = () => {
    window.open('https://uk.trustpilot.com/review/buyawarranty.co.uk', '_blank');
  };

  return (
    <Card className="border-2 border-primary shadow-lg bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 text-center">
          Share & Save
        </h2>
        
        <div className="space-y-6">
          {/* Referral Section */}
          <div className="text-center p-6 bg-background rounded-lg border border-border">
            <Gift className="w-10 h-10 text-primary mx-auto mb-3" />
            <h3 className="font-bold text-foreground mb-2">
              Refer a mate and get £30 off your next warranty!
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share the love and save on your future coverage
            </p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter friend's email"
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
                className="flex-1"
                disabled={isSubmitting}
              />
              <Button
                onClick={handleReferClick}
                className="bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  '📨 Refer a Friend'
                )}
              </Button>
            </div>
          </div>
          
          {/* Trustpilot Section */}
          <div className="text-center p-6 bg-background rounded-lg border border-border">
            <Star className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
            <h3 className="font-bold text-foreground mb-3">
              See what others are saying
            </h3>
            <button
              onClick={handleTrustpilotClick}
              className="inline-block transition-opacity hover:opacity-80"
            >
              <OptimizedImage 
                src={trustpilotLogo} 
                alt="Trustpilot 5 stars" 
                className="h-auto w-32 object-contain mx-auto"
                priority={false}
                width={120}
                height={37}
              />
            </button>
            <p className="text-sm text-muted-foreground mt-2">
              Rated Excellent on Trustpilot
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
