import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

export const TrustpilotReviewSection: React.FC = () => {
  const handleReviewClick = () => {
    window.open('https://uk.trustpilot.com/review/buyawarranty.co.uk', '_blank');
  };

  return (
    <Card className="border border-border shadow-sm bg-gradient-to-br from-yellow-50 to-background">
      <CardContent className="p-6 md:p-8 text-center">
        <div className="flex justify-center mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} className="w-8 h-8 fill-yellow-500 text-yellow-500" />
          ))}
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">
          Enjoying Your Experience?
        </h3>
        <p className="text-sm md:text-base text-muted-foreground mb-4">
          Please share your thoughts on Trustpilot – it only takes a minute and really helps others make confident decisions.
        </p>
        <Button
          onClick={handleReviewClick}
          className="bg-[#00b67a] hover:bg-[#00a870] text-white"
        >
          ⭐ Leave Your Review Now
        </Button>
      </CardContent>
    </Card>
  );
};
