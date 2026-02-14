import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import trustpilotStars from '@/assets/trustpilot-5-stars.png';

export const TrustpilotReviewSection: React.FC = () => {
  const handleReviewClick = () => {
    window.open('https://uk.trustpilot.com/review/buyawarranty.co.uk', '_blank');
  };

  return (
    <Card className="border border-border shadow-sm bg-gradient-to-br from-yellow-50 to-background">
      <CardContent className="p-6 md:p-8 text-center">
        <div className="flex justify-center mb-4">
          <img 
            src={trustpilotStars} 
            alt="Trustpilot 5 stars" 
            className="h-20 md:h-24 w-auto object-contain"
          />
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">
          Enjoying Your Experience?
        </h3>
        <p className="text-sm md:text-base text-muted-foreground mb-2">
          Your feedback makes a real difference.
        </p>
        <p className="text-sm md:text-base text-muted-foreground mb-5">
          If we've helped today, could you spare just 30 seconds to leave a quick review on Trustpilot? It really helps others choose with confidence and we appreciate it.
        </p>
        <Button
          onClick={handleReviewClick}
          className="bg-[#00b67a] hover:bg-[#00a870] text-white px-8 py-3 text-base font-semibold rounded-xl"
        >
          Leave Your Review Now
        </Button>
      </CardContent>
    </Card>
  );
};
