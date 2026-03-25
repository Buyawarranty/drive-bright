import React from 'react';
import { usePendingAccessRequests } from '@/hooks/useLeadAccessRequests';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, X, Lock, User } from 'lucide-react';
import { format } from 'date-fns';

interface PendingAccessRequestsPanelProps {
  currentAdminUserId: string;
}

export const PendingAccessRequestsPanel: React.FC<PendingAccessRequestsPanelProps> = ({ currentAdminUserId }) => {
  const { pendingRequests, reviewRequest } = usePendingAccessRequests();

  // Fetch agent names and lead details
  const { data: agentMap = {} } = useQuery({
    queryKey: ['admin-users-map-for-requests'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email');
      const map: Record<string, string> = {};
      data?.forEach(u => {
        map[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
      });
      return map;
    },
  });

  const { data: leadMap = {} } = useQuery({
    queryKey: ['leads-map-for-requests', pendingRequests.map(r => r.lead_id)],
    queryFn: async () => {
      if (pendingRequests.length === 0) return {};
      const ids = pendingRequests.map(r => r.lead_id);
      const { data } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, email, vehicle_reg')
        .in('id', ids);
      const map: Record<string, any> = {};
      data?.forEach(l => { map[l.id] = l; });
      return map;
    },
    enabled: pendingRequests.length > 0,
  });

  if (pendingRequests.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-600" />
          Paid Lead Access Requests
          <Badge className="bg-amber-500 text-white text-[10px]">{pendingRequests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendingRequests.map(req => {
          const lead = leadMap[req.lead_id];
          const agentName = agentMap[req.requested_by] || 'Unknown Agent';
          return (
            <div key={req.id} className="flex items-center justify-between gap-3 p-2 bg-white rounded-lg border text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium">{agentName}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-[10px]">
                    {lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email : req.lead_id.slice(0, 8)}
                  </span>
                  {lead?.vehicle_reg && (
                    <Badge variant="outline" className="font-mono text-[10px] bg-yellow-400 text-black border-yellow-500 rounded-sm">
                      {lead.vehicle_reg}
                    </Badge>
                  )}
                </div>
                {req.reason && (
                  <p className="text-muted-foreground mt-0.5 truncate">{req.reason}</p>
                )}
                <p className="text-muted-foreground text-[10px]">{format(new Date(req.created_at), 'dd MMM HH:mm')}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  className="h-7 px-2 text-[11px] bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => reviewRequest.mutate({ requestId: req.id, status: 'approved', approvedBy: currentAdminUserId })}
                  disabled={reviewRequest.isPending}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => reviewRequest.mutate({ requestId: req.id, status: 'denied', approvedBy: currentAdminUserId })}
                  disabled={reviewRequest.isPending}
                >
                  <X className="h-3 w-3 mr-1" />
                  Deny
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
