import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Phone, Mail, Clock } from 'lucide-react';

export const TrustSecurityFooter: React.FC = () => {
  return (
    <Card className="border border-border shadow-sm bg-muted/30">
      <CardContent className="p-6 md:p-8">
        <div className="text-center mb-6">
          <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Your trusted warranty partner
          </h3>
          <p className="text-sm text-muted-foreground">
            <a 
              href="https://www.buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline font-semibold"
            >
              buyawarranty.co.uk
            </a>
          </p>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="flex items-start gap-3 p-4 bg-background rounded-lg border border-border">
            <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="font-semibold text-foreground text-sm mb-1">Claims Line</p>
              <a 
                href="tel:03302295045" 
                className="text-sm text-primary hover:underline"
              >
                0330 229 5045
              </a>
              <p className="text-xs text-muted-foreground mt-1">
                <a 
                  href="mailto:claims@buyawarranty.co.uk"
                  className="hover:text-foreground"
                >
                  claims@buyawarranty.co.uk
                </a>
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 bg-background rounded-lg border border-border">
            <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="font-semibold text-foreground text-sm mb-1">Customer Support</p>
              <a 
                href="tel:03302295040" 
                className="text-sm text-primary hover:underline"
              >
                0330 229 5040
              </a>
              <p className="text-xs text-muted-foreground mt-1">
                <a 
                  href="mailto:support@buyawarranty.co.uk"
                  className="hover:text-foreground"
                >
                  support@buyawarranty.co.uk
                </a>
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            <span>Secure Payment</span>
          </div>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>Mon–Fri, 9am–5:30pm</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
