import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Users } from 'lucide-react';
import { Lead } from '@/hooks/useLeads';
import { subDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeadCallAnalyticsTilesProps {
  leads: Lead[];
  className?: string;
}

export const LeadCallAnalyticsTiles: React.FC<LeadCallAnalyticsTilesProps> = ({ leads, className }) => {
  const sevenDaysAgo = subDays(new Date(), 7);

  // Filter leads from last 7 days
  const recentLeads = leads.filter(lead => 
    new Date(lead.created_at) >= sevenDaysAgo &&
    lead.status !== 'converted' &&
    lead.status !== 'lost' &&
    lead.status !== 'fake_lead'
  );

  // Count leads with 0 calls
  const leadsWithZeroCalls = recentLeads.filter(lead => !lead.call_count || lead.call_count === 0).length;

  // Count leads with 1-2 calls
  const leadsWithFewCalls = recentLeads.filter(lead => 
    lead.call_count && lead.call_count >= 1 && lead.call_count <= 2
  ).length;

  // Count leads at max attempts (3+)
  const leadsAtMaxAttempts = recentLeads.filter(lead => 
    lead.call_count && lead.call_count >= 3
  ).length;

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {/* Leads with 0 calls */}
      <Card className="flex-1 min-w-[140px] border-amber-200 bg-amber-50/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-amber-100">
              <PhoneOff className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Not called (7d)</p>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-amber-700">{leadsWithZeroCalls}</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700 border-amber-300">
                  0 calls
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads with 1-2 calls */}
      <Card className="flex-1 min-w-[140px] border-blue-200 bg-blue-50/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-blue-100">
              <Phone className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In progress (7d)</p>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-blue-700">{leadsWithFewCalls}</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-300">
                  1-2 calls
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads at max attempts */}
      <Card className="flex-1 min-w-[140px] border-red-200 bg-red-50/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-red-100">
              <Users className="h-3.5 w-3.5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max attempts (7d)</p>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-red-700">{leadsAtMaxAttempts}</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-100 text-red-700 border-red-300">
                  3+ calls
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
