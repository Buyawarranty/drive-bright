import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, Clock, Activity } from 'lucide-react';
import type { Lead, AdminUser } from '@/hooks/useLeads';

interface AgentOverviewPanelProps {
  leads: Lead[];
  salesUsers: AdminUser[];
}

interface AgentPresence {
  admin_user_id: string;
  status: string;
  last_seen_at: string;
  last_interaction_at: string | null;
  current_tab: string | null;
}

export const AgentOverviewPanel: React.FC<AgentOverviewPanelProps> = ({ leads, salesUsers }) => {
  const [presenceData, setPresenceData] = useState<AgentPresence[]>([]);

  useEffect(() => {
    const fetchPresence = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('admin_user_id, status, last_seen_at, last_interaction_at, current_tab');
      if (data) setPresenceData(data);
    };
    fetchPresence();

    // Refresh every 30 seconds
    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, []);

  const agents = salesUsers.filter(u => u.role !== 'admin');

  const getAgentPresence = (agentId: string) => {
    return presenceData.find(p => p.admin_user_id === agentId);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Online</Badge>;
      case 'away':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Away</Badge>;
      case 'busy':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Busy</Badge>;
      default:
        return <Badge variant="secondary">Offline</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Agent Overview
        </CardTitle>
        <CardDescription>Monitor agent activity, assigned leads, and performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium">Agent</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-center">Assigned</th>
                <th className="pb-3 font-medium text-center">New</th>
                <th className="pb-3 font-medium text-center">Contacted</th>
                <th className="pb-3 font-medium text-center">Paid</th>
                <th className="pb-3 font-medium">Last Active</th>
                <th className="pb-3 font-medium">Current Tab</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => {
                const presence = getAgentPresence(agent.id);
                const agentLeads = leads.filter(l => l.assigned_to === agent.id);
                const newLeads = agentLeads.filter(l => l.status === 'new').length;
                const contactedLeads = agentLeads.filter(l => l.status === 'contacted').length;
                const paidLeads = agentLeads.filter(l => l.is_paid === true).length;

                return (
                  <tr key={agent.id} className="border-b hover:bg-muted/30">
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{agent.first_name} {agent.last_name}</p>
                        <p className="text-xs text-muted-foreground">{agent.email}</p>
                      </div>
                    </td>
                    <td className="py-3">{getStatusBadge(presence?.status)}</td>
                    <td className="py-3 text-center font-medium">{agentLeads.length}</td>
                    <td className="py-3 text-center">
                      <Badge variant="outline">{newLeads}</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant="secondary">{contactedLeads}</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge className="bg-green-100 text-green-700">{paidLeads}</Badge>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {presence?.last_interaction_at 
                        ? new Date(presence.last_interaction_at).toLocaleString('en-GB', { 
                            hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' 
                          })
                        : 'Never'}
                    </td>
                    <td className="py-3 text-xs text-muted-foreground capitalize">
                      {presence?.current_tab?.replace(/-/g, ' ') || '—'}
                    </td>
                  </tr>
                );
              })}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No sales agents found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
