import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { prettyWhatsAppPhone } from '@/lib/whatsappHeat';
import { pipelineLabel } from '@/lib/whatsappPipeline';
import type { WhatsAppConversation } from '@/hooks/useWhatsAppConversations';

interface Props {
  conversations: WhatsAppConversation[];
  onReassign: (conversationId: string, agentId: string) => Promise<{ ok: boolean; reason?: string }>;
}

interface AgentRow {
  id: string;
  name: string;
  assigned: number;
  handled: number;
  quotesSent: number;
  won: number;
  conversionRate: number;
  avgResponseMins: number | null;
}

const Tile: React.FC<{ label: string; value: string | number; tone?: string }> = ({ label, value, tone }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-2xl font-bold ${tone || ''}`}>{value}</p>
  </div>
);

/** Management view of the WhatsApp sales operation. */
export const WhatsAppManagerDashboard: React.FC<Props> = ({ conversations, onReassign }) => {
  const [salesAgents, setSalesAgents] = useState<Array<{ id: string; name: string }>>([]);
  const agentIds = useMemo(
    () => conversations.map((c) => c.assigned_to).filter(Boolean) as string[],
    [conversations],
  );
  const agentsMap = useAllAdminUsersMap(agentIds);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead'])
        .eq('is_active', true);
      if (cancelled) return;
      setSalesAgents(
        (data || []).map((u: any) => ({
          id: u.id,
          name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unassigned = conversations.filter((c) => !c.assigned_to);
  const hotWaiting = unassigned.filter((c) => c.heat === 'hot');
  const notReplied = conversations.filter((c) => c.last_direction === 'inbound');
  const responded = conversations.filter((c) => typeof c.first_response_seconds === 'number');
  const avgResponse = responded.length
    ? Math.round(
        responded.reduce((s, c) => s + (c.first_response_seconds || 0), 0) / responded.length / 60,
      )
    : null;

  const agentRows: AgentRow[] = useMemo(() => {
    const byAgent = new Map<string, WhatsAppConversation[]>();
    conversations.forEach((c) => {
      if (!c.assigned_to) return;
      const list = byAgent.get(c.assigned_to) || [];
      list.push(c);
      byAgent.set(c.assigned_to, list);
    });
    return Array.from(byAgent.entries())
      .map(([id, list]) => {
        const agent = agentsMap.get(id);
        const quotesSent = list.filter((c) =>
          ['quote_sent', 'hot_opportunity', 'follow_up', 'won'].includes(c.pipeline_status),
        ).length;
        const won = list.filter((c) => c.pipeline_status === 'won').length;
        const withResponse = list.filter((c) => typeof c.first_response_seconds === 'number');
        return {
          id,
          name: agent
            ? [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email
            : 'Unknown agent',
          assigned: list.length,
          handled: list.filter((c) => c.last_agent_reply_at).length,
          quotesSent,
          won,
          conversionRate: list.length ? Math.round((won / list.length) * 100) : 0,
          avgResponseMins: withResponse.length
            ? Math.round(
                withResponse.reduce((s, c) => s + (c.first_response_seconds || 0), 0) /
                  withResponse.length /
                  60,
              )
            : null,
        };
      })
      .sort((a, b) => b.assigned - a.assigned);
  }, [conversations, agentsMap]);

  const handleReassign = async (conversationId: string, agentId: string) => {
    const res = await onReassign(conversationId, agentId);
    if (res.ok) toast.success('Lead reassigned');
    else toast.error('That lead could not be reassigned.');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Unassigned leads" value={unassigned.length} />
        <Tile label="Hot leads waiting" value={hotWaiting.length} tone="text-destructive" />
        <Tile label="Conversations" value={conversations.length} />
        <Tile label="Quotes sent" value={agentRows.reduce((s, a) => s + a.quotesSent, 0)} />
        <Tile label="Deals won" value={agentRows.reduce((s, a) => s + a.won, 0)} />
        <Tile
          label="Avg response"
          value={avgResponse == null ? '-' : `${avgResponse} min`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">By agent</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Agent</th>
                <th className="py-2">Assigned</th>
                <th className="py-2">Handled</th>
                <th className="py-2">Quotes sent</th>
                <th className="py-2">Won</th>
                <th className="py-2">Conversion</th>
                <th className="py-2">Avg response</th>
              </tr>
            </thead>
            <tbody>
              {agentRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-3 text-muted-foreground">
                    No WhatsApp leads assigned yet.
                  </td>
                </tr>
              )}
              {agentRows.map((a) => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="py-2 font-medium">{a.name}</td>
                  <td className="py-2">{a.assigned}</td>
                  <td className="py-2">{a.handled}</td>
                  <td className="py-2">{a.quotesSent}</td>
                  <td className="py-2">{a.won}</td>
                  <td className="py-2">{a.conversionRate}%</td>
                  <td className="py-2">{a.avgResponseMins == null ? '-' : `${a.avgResponseMins} min`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Waiting on a reply ({notReplied.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {notReplied.length === 0 && (
            <p className="text-sm text-muted-foreground">Every customer has had a reply.</p>
          )}
          {notReplied.slice(0, 40).map((c) => {
            const agent = c.assigned_to ? agentsMap.get(c.assigned_to) : undefined;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {c.display_name || prettyWhatsAppPhone(c.phone)}{' '}
                    <span className="text-xs text-muted-foreground">{prettyWhatsAppPhone(c.phone)}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{c.last_message_preview}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{pipelineLabel(c.pipeline_status)}</Badge>
                  <Badge variant="outline">
                    {agent
                      ? [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email
                      : 'Unassigned'}
                  </Badge>
                  <Select onValueChange={(v) => handleReassign(c.id, v)}>
                    <SelectTrigger className="h-8 w-[170px]">
                      <SelectValue placeholder="Reassign to…" />
                    </SelectTrigger>
                    <SelectContent>
                      {salesAgents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppManagerDashboard;
