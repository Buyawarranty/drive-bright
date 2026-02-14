import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';
import type { AdminUser } from '@/hooks/useLeads';

interface AgentOverviewPanelProps {
  leads?: any[];
  salesUsers: AdminUser[];
}

interface AgentPresence {
  admin_user_id: string;
  status: string;
  last_seen_at: string;
  last_interaction_at: string | null;
  last_activity_at: string | null;
  current_tab: string | null;
}

interface AgentOnlineTime {
  admin_user_id: string;
  total_online_seconds: number;
  first_online_at: string | null;
  session_count: number;
}

interface AgentLeadCounts {
  assigned_to: string;
  total: number;
  new_count: number;
  contacted_count: number;
  paid_count: number;
}

export const AgentOverviewPanel: React.FC<AgentOverviewPanelProps> = ({ leads, salesUsers }) => {
  const [presenceData, setPresenceData] = useState<AgentPresence[]>([]);
  const [onlineTimeData, setOnlineTimeData] = useState<AgentOnlineTime[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, { total: number; new: number; contacted: number; paid: number }>>({});

  useEffect(() => {
    const fetchPresence = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('admin_user_id, status, last_seen_at, last_interaction_at, last_activity_at, current_tab');
      if (data) setPresenceData(data as AgentPresence[]);
    };

    const fetchOnlineTime = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('user_daily_online_time')
        .select('admin_user_id, total_online_seconds, first_online_at, session_count')
        .eq('date', today);
      if (data) setOnlineTimeData(data as AgentOnlineTime[]);
    };

    const fetchLeadCounts = async () => {
      if (leads && leads.length > 0) {
        const counts: Record<string, { total: number; new: number; contacted: number; paid: number }> = {};
        leads.forEach((l: any) => {
          if (!l.assigned_to) return;
          if (!counts[l.assigned_to]) counts[l.assigned_to] = { total: 0, new: 0, contacted: 0, paid: 0 };
          counts[l.assigned_to].total++;
          if (l.status === 'new') counts[l.assigned_to].new++;
          if (l.status === 'contacted') counts[l.assigned_to].contacted++;
          if (l.is_paid === true) counts[l.assigned_to].paid++;
        });
        setLeadCounts(counts);
        return;
      }

      const { data } = await supabase
        .from('sales_leads')
        .select('assigned_to, status, is_paid')
        .not('assigned_to', 'is', null);
      
      if (data) {
        const counts: Record<string, { total: number; new: number; contacted: number; paid: number }> = {};
        data.forEach((l: any) => {
          if (!counts[l.assigned_to]) counts[l.assigned_to] = { total: 0, new: 0, contacted: 0, paid: 0 };
          counts[l.assigned_to].total++;
          if (l.status === 'new') counts[l.assigned_to].new++;
          if (l.status === 'contacted') counts[l.assigned_to].contacted++;
          if (l.is_paid === true) counts[l.assigned_to].paid++;
        });
        setLeadCounts(counts);
      }
    };

    fetchPresence();
    fetchOnlineTime();
    fetchLeadCounts();

    const interval = setInterval(() => {
      fetchPresence();
      fetchOnlineTime();
    }, 30000);
    return () => clearInterval(interval);
  }, [leads]);

  const agents = salesUsers.filter(u => u.role !== 'admin');

  const formatOnlineTime = (agentId: string, presence?: AgentPresence) => {
    const record = onlineTimeData.find(t => t.admin_user_id === agentId);
    let totalSeconds = record?.total_online_seconds || 0;

    // If agent is currently online, add live elapsed time since last_activity_at
    if (presence?.status === 'online' && presence?.last_activity_at) {
      const elapsed = Math.floor((Date.now() - new Date(presence.last_activity_at).getTime()) / 1000);
      if (elapsed > 0 && elapsed < 86400) {
        totalSeconds += elapsed;
      }
    }

    if (totalSeconds <= 0) return '—';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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
                <th className="pb-3 font-medium text-center">Online Today</th>
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
                const presence = presenceData.find(p => p.admin_user_id === agent.id);
                const counts = leadCounts[agent.id] || { total: 0, new: 0, contacted: 0, paid: 0 };

                return (
                  <tr key={agent.id} className="border-b hover:bg-muted/30">
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{agent.first_name} {agent.last_name}</p>
                        <p className="text-xs text-muted-foreground">{agent.email}</p>
                      </div>
                    </td>
                    <td className="py-3">{getStatusBadge(presence?.status)}</td>
                    <td className="py-3 text-center">
                      <span className={`text-xs font-medium ${presence?.status === 'online' ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {formatOnlineTime(agent.id, presence)}
                      </span>
                    </td>
                    <td className="py-3 text-center font-medium">{counts.total}</td>
                    <td className="py-3 text-center">
                      <Badge variant="outline">{counts.new}</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant="secondary">{counts.contacted}</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge className="bg-green-100 text-green-700">{counts.paid}</Badge>
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
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
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