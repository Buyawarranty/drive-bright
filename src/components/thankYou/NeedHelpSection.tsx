import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, HelpCircle } from 'lucide-react';

export const NeedHelpSection: React.FC = () => {
  const handleContactSupport = () => {
    window.open('https://buyawarranty.co.uk/contact-us/', '_blank');
  };

  const handleFAQClick = () => {
    window.open('https://www.buyawarranty.co.uk/faq', '_blank');
  };

  return (
    <Card className="border border-border shadow-sm bg-background">
      <CardContent className="p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 text-center">
          Need Help?
        </h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          <Button
            onClick={handleContactSupport}
            variant="outline"
            size="lg"
            className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5"
          >
            <Mail className="w-6 h-6 text-primary" />
            <span className="font-semibold">Contact Support</span>
            <span className="text-xs text-muted-foreground">Get help from our team</span>
          </Button>
          
          <Button
            onClick={handleFAQClick}
            variant="outline"
            size="lg"
            className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5"
          >
            <HelpCircle className="w-6 h-6 text-primary" />
            <span className="font-semibold">What's Covered?</span>
            <span className="text-xs text-muted-foreground">View warranty FAQs</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
