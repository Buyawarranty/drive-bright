import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWhatsAppConversations } from '@/hooks/useWhatsAppConversations';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useIsManagement } from '@/hooks/useIsManagement';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import WhatsAppLeadCard from './WhatsAppLeadCard';
import { tagChipClass, useTagsByConversation, useWhatsAppTagList } from '@/hooks/useWhatsAppTags';
import WhatsAppConversationPanel from './WhatsAppConversationPanel';
import WhatsAppManagerDashboard from './WhatsAppManagerDashboard';
import WhatsAppHotLeadAlerts from './WhatsAppHotLeadAlerts';
import WhatsAppLeadImport from './WhatsAppLeadImport';
import WhatsAppBulkTemplateSend from './WhatsAppBulkTemplateSend';
import WhatsAppAwayReply from './WhatsAppAwayReply';

import type { WhatsAppPipelineStatus } from '@/lib/whatsappPipeline';

interface Props {
  userRole?: string;
}

/** WhatsApp Leads: available queue, the agent's own inbox and (for managers) the dashboard. */
export const WhatsAppLeadsTab: React.FC<Props> = ({ userRole }) => {
  const adminId = useCurrentAdminId();
  const { isManagement } = useIsManagement();
  const {
    conversations,
    loading,
    error,
    claimLead,
    reassignLead,
    setPipelineStatus,
    setFollowUp,
    markRead,
  } = useWhatsAppConversations();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taking, setTaking] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const agentIds = useMemo(
    () => conversations.map((c) => c.assigned_to).filter(Boolean) as string[],
    [conversations],
  );
  const agents = useAllAdminUsersMap(agentIds);

  const conversationIds = useMemo(() => conversations.map((c) => c.id), [conversations]);
  const tagsByConversation = useTagsByConversation(conversationIds);
  const { tags: allTags } = useWhatsAppTagList();
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const cardTags = (id: string) =>
    allTags.filter((t) => (tagsByConversation[id] || []).includes(t.id));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/[^\d]/g, '');
    return conversations.filter((c) => {
      if (tagFilter && !(tagsByConversation[c.id] || []).includes(tagFilter)) return false;
      if (!q) return true;
      return (
        (c.display_name || '').toLowerCase().includes(q) ||
        (c.last_message_preview || '').toLowerCase().includes(q) ||
        (digits.length >= 4 && c.phone_normalized.includes(digits.slice(-9)))
      );
    });
  }, [conversations, search, tagFilter, tagsByConversation]);

  const available = filtered.filter((c) => !c.assigned_to && c.is_open);
  const mine = filtered.filter((c) => c.assigned_to === adminId);
  const selected = conversations.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    if (selected && selected.unread_count > 0 && selected.assigned_to === adminId) {
      void markRead(selected.id);
    }
  }, [selected, adminId, markRead]);

  const handleTake = async (conversationId: string) => {
    if (!adminId) return;
    setTaking(conversationId);
    const res = await claimLead(conversationId, adminId);
    setTaking(null);
    if (res.ok) {
      setSelectedId(conversationId);
      toast.success('Lead is yours - the customer is waiting');
    } else {
      toast.error(
        res.reason === 'already_taken'
          ? 'Another agent has just taken that lead.'
          : 'That lead could not be taken.',
      );
    }
  };

  const handleStatus = async (status: WhatsAppPipelineStatus) => {
    if (!selected) return;
    const res = await setPipelineStatus(selected, status, adminId);
    if (!res.ok) toast.error('The status could not be saved.');
  };

  const handleFollowUp = async (whenIso: string | null) => {
    if (!selected) return;
    const res = await setFollowUp(selected.id, whenIso);
    if (!res.ok) toast.error('The follow-up time could not be saved.');
  };

  const canReply = !!selected && (selected.assigned_to === adminId || isManagement);

  return (
    <div className="space-y-4">
      <WhatsAppHotLeadAlerts
        conversations={conversations}
        currentAdminId={adminId}
        onOpen={(id) => setSelectedId(id)}
        onTake={(id) => void handleTake(id)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp Leads
        </h2>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, number or message"
          className="h-9 w-full max-w-xs"
        />
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Filter by tag</span>
          <button type="button" onClick={() => setTagFilter(null)}>
            <Badge variant={tagFilter ? 'outline' : 'default'}>All</Badge>
          </button>
          {allTags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}
            >
              <Badge
                className={
                  tagFilter === t.id ? tagChipClass(t.color) : 'bg-muted text-foreground border-border'
                }
              >
                {t.name}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
          WhatsApp leads could not be loaded. Nothing has been lost - try again in a moment.
        </p>
      )}

      {isManagement && <WhatsAppBulkTemplateSend />}
      {isManagement && <WhatsAppLeadImport />}




      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">
            Available leads
            {available.length > 0 && <Badge className="ml-2">{available.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="mine">
            My WhatsApp leads
            {mine.length > 0 && <Badge className="ml-2">{mine.length}</Badge>}
          </TabsTrigger>
          {isManagement && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
        </TabsList>

        <TabsContent value="queue" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,380px)_1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Hottest first</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {!loading && available.length === 0 && (
                  <p className="text-sm text-muted-foreground">No WhatsApp leads waiting right now.</p>
                )}
                {available.map((c) => (
                  <WhatsAppLeadCard
                    key={c.id}
                    conversation={c}
                    agent={c.assigned_to ? agents.get(c.assigned_to) : undefined}
                    isSelected={c.id === selectedId}
                    canTake={!!adminId}
                    taking={taking === c.id}
                    onTake={() => void handleTake(c.id)}
                    onOpen={() => setSelectedId(c.id)}
                    tags={cardTags(c.id)}
                  />
                ))}
              </CardContent>
            </Card>
            <div className="min-h-[400px]">
              {selected ? (
                <WhatsAppConversationPanel
                  conversation={selected}
                  currentAdminId={adminId}
                  canReply={canReply}
                  onStatusChange={handleStatus}
                  onFollowUpChange={handleFollowUp}
                />
              ) : (
                <Card className="flex h-full items-center justify-center">
                  <p className="p-6 text-sm text-muted-foreground">
                    Pick a customer to read their WhatsApp conversation.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mine" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,380px)_1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">My customers</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto">
                {mine.length === 0 && (
                  <p className="text-sm text-muted-foreground">You have no WhatsApp leads yet.</p>
                )}
                {mine.map((c) => (
                  <WhatsAppLeadCard
                    key={c.id}
                    conversation={c}
                    agent={c.assigned_to ? agents.get(c.assigned_to) : undefined}
                    isSelected={c.id === selectedId}
                    canTake={false}
                    onTake={() => undefined}
                    onOpen={() => setSelectedId(c.id)}
                    tags={cardTags(c.id)}
                  />
                ))}
              </CardContent>
            </Card>
            <div className="min-h-[400px]">
              {selected ? (
                <WhatsAppConversationPanel
                  conversation={selected}
                  currentAdminId={adminId}
                  canReply={canReply}
                  onStatusChange={handleStatus}
                  onFollowUpChange={handleFollowUp}
                />
              ) : (
                <Card className="flex h-full items-center justify-center">
                  <p className="p-6 text-sm text-muted-foreground">
                    Pick a customer to carry on the conversation.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {isManagement && (
          <TabsContent value="dashboard" className="mt-3">
            <WhatsAppManagerDashboard conversations={conversations} onReassign={reassignLead} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default WhatsAppLeadsTab;
