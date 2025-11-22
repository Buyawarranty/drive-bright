import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Mail } from 'lucide-react';

interface ConfirmationSectionProps {
  firstName?: string;
  email?: string;
  policyNumber?: string;
  source?: string;
}

export const ConfirmationSection: React.FC<ConfirmationSectionProps> = ({
  firstName,
  email,
  policyNumber,
  source
}) => {
  return (
    <Card className="border-2 border-success shadow-lg bg-gradient-to-br from-success/5 to-background">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <CheckCircle className="w-12 h-12 text-success" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Thanks{firstName ? `, ${firstName}` : ''} – your payment went through smoothly!
            </h1>
            
            {policyNumber && (
              <p className="text-lg text-foreground mb-3">
                Your order reference is <span className="font-bold font-mono">{policyNumber}</span>.
              </p>
            )}
            
            {email && (
              <div className="flex items-start gap-2">
                <Mail className="w-5 h-5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                <p className="text-base text-foreground">
                  We've sent a confirmation to <span className="font-semibold">{email}</span> – keep an eye on your inbox.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
