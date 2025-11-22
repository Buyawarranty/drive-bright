import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Mail, FileText, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const WhatHappensNext: React.FC = () => {
  const handlePortalClick = () => {
    // This will be implemented based on your customer portal URL
    window.open('https://www.buyawarranty.co.uk/customer-portal', '_blank');
  };

  return (
    <Card className="border border-border shadow-sm bg-background">
      <CardContent className="p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6">
          What Happens Next
        </h2>
        
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground mb-1">
                Your warranty is now active
              </p>
              <p className="text-sm text-muted-foreground">
                No need to do anything – you're covered from today.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Mail className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground mb-1">
                Documents on the way
              </p>
              <p className="text-sm text-muted-foreground">
                Your warranty documents will arrive by email within the next few minutes.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground mb-1">
                Got questions?
              </p>
              <p className="text-sm text-muted-foreground">
                We're here to help – reach out anytime.
              </p>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};
